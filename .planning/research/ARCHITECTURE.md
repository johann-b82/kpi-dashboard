# Architecture Research — v1.22 Backend Consolidation

**Researched:** 2026-04-24
**Scope:** Integration design for moving signage_admin CRUD + data lookups + `me` from FastAPI to Directus 11 on the shared Postgres 17 database.
**Confidence:** HIGH on schema + permission + frontend seam; MEDIUM on SSE-on-Directus-mutation (multiple viable options, ranked below).

---

## Domain

Shared-Postgres, split-responsibility architecture. Two HTTP services both read/write the same database:

- **Alembic** owns DDL for `public.signage_*` (8 tables verified in `v1_16_signage_schema.py`: devices, pairing_sessions, media, playlists, playlist_items, tags, playlist_tag_map, device_tag_map) plus `v1_18_signage_schedules`, `v1_18_signage_heartbeat_event`, and `v1_21_signage_calibration` columns.
- **Directus 11** owns `directus_*` system tables and now (post-v1.22) exposes a subset of `public.signage_*` + `sales_records`, `personio_employees` as Directus Collections with role-based policies.
- **FastAPI** retains compute: resolver (`resolve_playlist_for_device`, `_build_envelope_for_playlist`), SSE fanout (`signage_broadcast`), device-JWT minting (`signage_pair`), PPTX pipeline, APScheduler, media upload POST (multipart + file hashing), heartbeat, analytics read models.

The constraint: **`public` tables become shared writers**. Both sides must read consistent data, and SSE fanout (owned by FastAPI) must still fire when the *write* happens in Directus.

---

## Schema Ownership — Alembic + Directus on Shared Postgres

**Alembic stays the DDL source of truth.** All migrations for `signage_*`, `sales_records`, `personio_*` continue to live in `backend/alembic/versions/` and run in the `migrate` service before Directus starts. This is already enforced by `depends_on: migrate: service_completed_successfully` on the `directus` service in `docker-compose.yml`.

Directus needs to know the tables exist and what the columns mean. Three options for exposing Alembic-owned tables to Directus:

### Option A — Directus "Create from Existing Table" (UI-click)
- **What:** Open Data Model UI, click "Create Collection from Existing Table", Directus introspects `information_schema` and creates `directus_collections` + `directus_fields` metadata rows.
- **Survives fresh deploy?** NO. State lives in `directus_*` tables only — disappears on volume reset unless you `pg_dump` those.
- **In git?** NO.
- **Idempotent?** Only via manual operator discipline.
- **Verdict:** Reject. Dev-machine-reset unfriendly, not reviewable, not reproducible.

### Option B — Directus schema snapshot apply (CLI or API)
- **What:** `npx directus schema snapshot ./directus/snapshot.yaml` on a known-good instance → check into git → `npx directus schema apply ./directus/snapshot.yaml` on boot. Directus 11 exposes this via `POST /schema/diff` + `POST /schema/apply` (used by `@directus/sdk` `readCollections` / `readFields` endpoints) and the bundled CLI.
- **Survives fresh deploy?** YES — snapshot is the reproducible SSOT for Directus Collection metadata.
- **In git?** YES (`directus/snapshot.yaml`).
- **Idempotent?** Diff-first pattern: apply is a no-op when snapshot matches current state. The migrate script can `schema diff --dry-run` to detect drift.
- **Risk:** Directus 11 schema snapshots include `collections`, `fields`, `relations`, and in v11 also `policies` + `permissions` + `roles` + `access`. The v1.11-directus bootstrap (`bootstrap-roles.sh` lines 4–7) explicitly notes "the v10-style snapshot.yml approach (Plan 02) which was rejected by Directus 11's stricter schema apply (policies/access tables and role↔policy decoupling introduced in v11 made the v10 snapshot shape invalid)." That rejection was for a hand-authored snapshot that included roles/policies. A snapshot generated FROM a working v11 instance (not hand-authored) is valid.
- **Verdict:** **Recommended for Collection/Field metadata.** Generate the snapshot once against a known-good configured dev instance, commit, and apply on every boot.

### Option C — Pure REST API bootstrap script (extends `bootstrap-roles.sh`)
- **What:** Same GET-before-POST idempotent shell script pattern already shipped for Viewer role/policy/access, extended to `POST /collections` + `POST /fields` for each Alembic table we want Directus to surface.
- **Survives fresh deploy?** YES.
- **In git?** YES.
- **Idempotent?** Yes (the existing bootstrap-roles.sh already proves the pattern).
- **Cost:** Lots of shell for 8+ tables × 5–15 fields each. Collection metadata (display, icon, translations, field widgets) is verbose in POST bodies.
- **Verdict:** Good for a **handful** of collections (e.g., if we only expose 4 signage tables). At 8+ tables this gets painful to maintain vs. snapshot.

### Recommendation
**Hybrid:**
1. **Collection + Field metadata**: Option B (snapshot apply). Add a `directus-bootstrap-schema` compose service (sibling of `directus-bootstrap-roles`) that runs `npx directus schema apply /snapshot.yaml` against the running Directus. Chain: `migrate` → `directus` → `directus-bootstrap-schema` → `directus-bootstrap-roles` → `api`.
2. **Roles + Policies + Permissions**: Keep Option C (`bootstrap-roles.sh` extended) as the SSOT for authz. Reason: permissions are the *security boundary*; they deserve code review, not a diff-apply mechanism. Roles/policies are also small (2 roles, N policies, N*M permission rows) and the GET-before-POST pattern already exists.

**Rationale for the split:** Schema drift (new column, renamed field) is frequent and low-risk to auto-apply. Permission drift is rare and high-risk — a snapshot apply that quietly grants Viewer write access to `signage_playlists` would be catastrophic; a code-reviewed shell script won't.

**File layout:**
```
directus/
  bootstrap-roles.sh          # existing — roles + policies + permissions (SSOT)
  bootstrap-schema.sh         # new — wraps schema apply
  snapshot.yaml               # new — collection + field metadata only (stripped of policies/roles)
```

**Snapshot stripping:** `schema snapshot` generates a file containing policies/roles/permissions. Before commit, strip those sections (keep only `collections`, `fields`, `relations`). A one-line `yq` filter in `bootstrap-schema.sh` or a pre-commit check prevents accidental re-introduction. This avoids the v1.11 snapshot rejection.

---

## Permissions Model — Admin/Viewer Policy Bootstrap

**Existing state (v1.11 baseline):**
- Built-in `Administrator` role (seeded by `ADMIN_EMAIL`/`ADMIN_PASSWORD` env) — full `admin_access: true`.
- `Viewer` role + `Viewer Read` policy (`admin_access: false`, `app_access: true`) + access row linking them, all with fixed UUIDs in `bootstrap-roles.sh` for idempotency.
- `Viewer Read` policy has **no permission rows yet** — the v1.11 bootstrap only established the role/policy/access skeleton.

**What v1.22 adds:** Permission rows on `Viewer Read` policy for each moved collection, mapped to the existing FastAPI `require_admin`/`get_current_user` split.

### Current FastAPI guard shape
`backend/app/security/directus_auth.py`:
- `get_current_user` → decodes HS256 JWT, maps role UUID → `Role.ADMIN` | `Role.VIEWER`.
- `require_admin` → 403 with `{"detail": "admin role required"}` if role != ADMIN.

`signage_admin/__init__.py` wires `require_admin` on the whole `/api/signage/*` admin router (mutations only; reads/analytics likewise).

### Directus 11 policy → permissions mapping

For each moved collection (`signage_devices`, `signage_playlists`, `signage_playlist_items`, `signage_schedules`, `signage_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`, `sales_records`, `personio_employees`):

| Collection | Administrator (built-in) | Viewer Read policy |
|------------|--------------------------|---------------------|
| `signage_*` (all) | implicit full CRUD via `admin_access: true` | **no permission rows** — Viewers got NO signage access in pre-v1.22 because endpoints required admin. Keep it that way. |
| `sales_records` | full | `read` only with `{ action: "read", fields: ["*"], permissions: {} }` |
| `personio_employees` | full | `read` only |

**Key property:** The `Administrator` role's `admin_access: true` flag bypasses the permissions table entirely — no per-collection permission rows needed for Admin. That's the natural analog of the FastAPI `require_admin` guard: "if role is Admin, skip all permission checks." Directus enforces this at the API layer.

### Extending `bootstrap-roles.sh`

Add a section 4 after the access row that POSTs permission rows. Each permission is a row in `directus_permissions` with fixed UUID for idempotency:

```sh
# --- 4. Permissions for Viewer Read policy ---
ensure_permission() {
  # $1=permission_id (fixed UUID)  $2=collection  $3=action
  local pid="$1" coll="$2" act="$3"
  status=$(api GET "/permissions/${pid}")
  if [ "$status" != "200" ]; then
    api POST "/permissions" "{
      \"id\":\"${pid}\",
      \"policy\":\"${VIEWER_POLICY_ID}\",
      \"collection\":\"${coll}\",
      \"action\":\"${act}\",
      \"fields\":[\"*\"],
      \"permissions\":{}
    }"
  fi
}

ensure_permission "b1111111-0001-...-...-..." "sales_records"       "read"
ensure_permission "b1111111-0002-...-...-..." "personio_employees"  "read"
# No signage_* permissions — Viewers have no signage access (intentional).
```

**SSOT property:** Every policy change is a diff on `bootstrap-roles.sh`. Git blame shows who granted what. Re-runs on a provisioned DB are no-ops. Fresh deploy reaches identical state.

### Admin role detection post-v1.22
FastAPI continues to validate HS256 JWTs for calls to `/api/signage/player/*` (device JWT) and `/api/signage/pair/*` (admin JWT for pairing claims, heartbeat endpoints still admin-gated). `directus_auth.py` logic unchanged. The role UUID → `Role` enum mapping in `config.py` stays in sync with the fixed UUIDs in `bootstrap-roles.sh`.

---

## Frontend Client Seam

### Current state
- `frontend/src/lib/apiClient.ts`: bearer injection (from module-singleton pushed by `AuthContext`), 401→silent-refresh→retry, `Error(body.detail)` contract.
- `frontend/src/lib/directusClient.ts`: SDK singleton, same-origin `/directus` base URL.
- `frontend/src/signage/lib/signageApi.ts`: 20+ methods over `apiClient` + one `apiClientWithBody` variant for 409-body extraction on media/playlist delete.
- `frontend/src/**/use*.ts` TanStack Query hooks consume `signageApi.*`.

After the move, the signage admin pages need to call Directus SDK for CRUD. The question is: how to minimize churn across ~20 TanStack Query hooks and dialog components.

### Options
**(a) Wrap Directus SDK in apiClient-shaped adapters**
- `signageApi.listPlaylists = () => directus.request(readItems('signage_playlists'))`.
- Pro: zero change to every `useQuery({ queryFn: signageApi.listPlaylists })` consumer.
- Con: hides that these calls no longer go through `apiClient` (no bearer injection, different 401 path — SDK handles its own refresh internally).
- Con: error shape differs — SDK throws `DirectusError` with `.errors[0].message`, not `Error(detail)`. Have to normalize.

**(b) Dedicated `directusAdminClient.ts` + `useDirectusQuery` hook**
- New module wrapping `directus.request()` with typed helpers.
- New hook factory that maps `DirectusError` → same `{detail}` shape as `apiClient`.
- Pro: explicit boundary; a reader can see which pages are "Directus-backed" vs "FastAPI-backed".
- Con: touches every consumer (20+ call sites) to switch from `useQuery(signageApi.listX)` to `useDirectusQuery(readItems('x'))`.

**(c) Raw SDK in each queryFn**
- Pro: simplest.
- Con: duplicates error normalization; 20+ `queryFn` closures with `directus.request(readItems(...))` inline.

### Recommendation: **(a) — Wrap SDK in apiClient-shaped adapters inside `signageApi.ts`**

Rationale:
1. **Minimizes churn** in `usePlaylistsQuery`, `useDevicesQuery`, `ScheduleEditDialog`, etc. — the consumer contract stays `signageApi.listPlaylists(): Promise<SignagePlaylist[]>`.
2. The `signageApi` module is already the abstraction layer. It was introduced in Phase 46 for exactly this reason (to hide the difference between `apiClient` and `apiClientWithBody`). Extending it to also hide the difference between `apiClient` and `directus.request()` is the same pattern.
3. Error normalization happens in one place: a `fromDirectus<T>(p: Promise<T>): Promise<T>` wrapper that catches `DirectusError` and rethrows `Error(err.errors?.[0]?.message ?? "request failed")`. For the 409 FK-restrict case, rethrow a `ApiErrorWithBody` with the Directus error detail in `body`.
4. FK-restrict + 409 translation: Directus returns `errors[0].extensions.code === "FOREIGN_KEY_CONSTRAINT_VIOLATION"` with the offending constraint name. Wrapper converts it into the existing `ApiErrorWithBody { status: 409, body: { detail, playlist_ids/schedule_ids } }` contract — but the `playlist_ids`/`schedule_ids` list is NOT in the Directus error payload (Directus just says "FK violation"). Two sub-options:

   - **a1:** On catching the Directus FK error, fire a follow-up SDK query (`readItems('signage_schedules', { filter: { playlist_id: { _eq: id } }, fields: ['id'] })`) to compute the list client-side, then throw the structured 409. Slight extra RTT but keeps the UX identical.
   - **a2:** Expose a tiny FastAPI helper endpoint `GET /api/signage/_meta/playlist-refs/{id}` that returns `{ schedule_ids }`. Only called on delete-failure. Keeps the "compute lives in FastAPI" principle.

   **Pick a1** — zero new FastAPI surface; the SDK call is cheap and already authenticated.

5. The auth token bridge stays: `AuthContext` pushes the token into `apiClient`'s module singleton; the Directus SDK has its own token (set by `directus.login()` / `directus.refresh()`). Both tokens originate from the same Directus auth and are refreshed via the same `directus.refresh()`. One auth path, two delivery mechanisms (bearer header for FastAPI, SDK-internal for Directus calls).

**Net refactor surface:** `signageApi.ts` methods change body (apiClient → directus.request). Consumers unchanged. `apiClientWithBody` stays for the remaining FastAPI endpoints (media upload, player endpoints not moved).

---

## SSE Broadcast After Move (Sequencing Hazard)

**The problem:** Today, `backend/app/routers/signage_admin/playlists.py:39` calls `_notify_playlist_changed()` AFTER `db.commit()`, which calls `signage_broadcast.notify_device()` on the in-process dict. After v1.22, the mutation happens inside Directus (`POST /items/signage_playlists`) — FastAPI never sees it. Player's `/api/signage/player/stream` will never receive the `playlist-changed` event; devices will only re-resolve on the 30s polling fallback.

Ranked options from lowest to highest complexity:

### Option 1 — Postgres LISTEN/NOTIFY trigger on the moved tables (RECOMMENDED)
**Complexity:** LOW-MEDIUM.

Alembic migration adds an `AFTER INSERT/UPDATE/DELETE` trigger on `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`:

```sql
CREATE OR REPLACE FUNCTION signage_notify_change() RETURNS trigger AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'row_id', COALESCE(NEW.id::text, OLD.id::text)
  );
  PERFORM pg_notify('signage_change', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_signage_playlists_notify
  AFTER INSERT OR UPDATE OR DELETE ON signage_playlists
  FOR EACH ROW EXECUTE FUNCTION signage_notify_change();
-- repeat for other tables
```

FastAPI starts a long-lived `LISTEN signage_change` task in `lifespan` (alongside APScheduler). Payloads arrive via asyncpg's `connection.add_listener('signage_change', handler)`. Handler parses `{table, op, row_id}`, calls the existing `devices_affected_by_playlist(db, row_id)` (or equivalent for schedules/devices), and fans out via existing `signage_broadcast.notify_device()`.

**Pros:**
- Database-level truth — fires whether the writer is Directus, psql, Alembic, or anyone else. Single choke point.
- Zero Directus-specific coupling; no Flow configuration checked into Directus export files.
- Uses `asyncpg`'s native LISTEN support — already in the dependency graph.
- `--workers 1` invariant (see `scheduler.py`, `signage_broadcast.py`) already enforced; the single LISTEN connection is correctness-safe.

**Cons:**
- Needs an Alembic migration (one).
- Needs a new `backend/app/services/signage_pg_listen.py` module + `lifespan` integration (~80 LOC).
- NOTIFY payloads capped at 8000 bytes — fine for `{table, op, row_id}` shape but we must keep payloads small (don't dump the row). Resolution still happens in FastAPI by re-reading the DB.

### Option 2 — Directus Flow that POSTs to a FastAPI internal webhook
**Complexity:** MEDIUM.

Directus Flow triggers on `items.*.create|update|delete` for the moved collections. Flow step: Webhook → `POST http://api:8000/api/_internal/signage-changed` with body `{collection, keys, op}`. FastAPI endpoint authenticated by a shared secret (new `SIGNAGE_INTERNAL_SECRET`). Endpoint calls existing fanout helper.

**Pros:**
- All logic stays in FastAPI.
- Flow config is visible in Directus UI, exportable to snapshot.

**Cons:**
- Flows-as-code story is weaker than triggers-as-code (Alembic). Flow config lives in `directus_flows` / `directus_operations` tables; including them in the snapshot.yaml re-introduces the v11-snapshot-apply fragility we rejected in Schema Ownership section.
- New internal auth surface (another shared secret, another HTTP path to lock down).
- Breaks if anyone writes to `signage_playlists` via psql/Alembic (which WILL happen — Alembic runs DDL + seed data on boot).

### Option 3 — Directus hook extension (TypeScript file in `/directus/extensions/`)
**Complexity:** HIGH.

Write a Directus TS hook that fires on `items.signage_playlists.create.after` etc., and POSTs to FastAPI. Compiled into the Directus extension folder, loaded at boot.

**Cons:**
- Introduces a Node/TS build artifact into the repo just for this.
- Same "only fires on Directus writes" limitation as Option 2.
- Extension loading in Docker requires a bind mount + `EXTENSIONS_PATH` env.

### Option 4 — FastAPI scheduled poll
**Complexity:** LOW, but defeats the purpose.

Every 10s, APScheduler runs a job that compares playlist/schedule `updated_at` timestamps to a last-seen watermark and fires SSE. The 30s polling fallback on the player side makes this marginally redundant.

**Cons:**
- Extra DB load every 10s across all moved tables.
- Latency floor of 10s — users see "save" complete instantly in admin UI but the Pi may wait 10s before re-fetching. Today this is near-instant via SSE.
- Adds a third "time-based" moving part to APScheduler (already pinned at `--workers 1` for the same reason).

### Ranking

| # | Option | Complexity | Coverage | Recommendation |
|---|--------|-----------|----------|----------------|
| 1 | Postgres LISTEN/NOTIFY | LOW-MEDIUM | 100% (any writer) | **RECOMMENDED** |
| 2 | Directus Flow → FastAPI webhook | MEDIUM | Directus writes only | Fallback |
| 3 | Directus TS extension | HIGH | Directus writes only | Reject |
| 4 | FastAPI scheduled poll | LOW | 100% but 10s latency | Reject |

**Picked: Option 1.** The triggers live in Alembic (reviewable SQL in git), the listen task reuses existing `signage_broadcast` and `signage_resolver` infrastructure, and the mechanism is writer-agnostic — which matters because `sales_records` bulk inserts via FastAPI's upload path also stay (FastAPI owns upload), and future direct psql patches won't silently break the SSE UX.

**Scope note — which SSE events need coverage:**
- `playlist-changed` — trigger on `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`. Derive affected devices via `devices_affected_by_playlist`.
- `schedule-changed` — trigger on `signage_schedules`. Fan-out to all devices whose tags overlap the schedule's playlist's tags (same derivation).
- `calibration-changed` — stays in FastAPI: the `PATCH /api/signage/devices/{id}/calibration` endpoint (v1.21) is **compute-shaped** (Pydantic `Literal[0,90,180,270]` validation + per-device SSE targeted fanout). Directus' built-in field validation can't replicate the rotation literal enum with a 422 response shape the player relies on. Keep this endpoint in FastAPI.
- Device name/tag changes — trigger on `signage_devices` + `signage_device_tag_map`. Fan-out to `[device_id]`.

Implementation note: To avoid chatty notifications on every `updated_at` bump, gate the trigger on `OLD IS DISTINCT FROM NEW` for updates. Inserts/deletes always fire.

---

## Cross-Boundary Flow Integrity

Each flow traced end-to-end to confirm it still works:

### Flow A — Admin edits playlist items (drag-reorder) → Pi updates
1. Admin UI calls `signageApi.bulkReplaceItems(id, items)` → after v1.22 wraps `directus.request(updateItems(...))` or transactional equivalent.
2. Directus writes `signage_playlist_items` rows, commits.
3. Postgres trigger fires `pg_notify('signage_change', ...)`.
4. FastAPI LISTEN handler receives payload → calls `devices_affected_by_playlist(db, playlist_id)` → `signage_broadcast.notify_device(device_id, {event: "playlist-changed", etag: ...})`.
5. Player's SSE connection on `/api/signage/player/stream` receives the frame.
6. Player issues `GET /api/signage/player/playlist` with `If-None-Match: <cached_etag>`.
7. FastAPI `signage_player` router calls `resolve_playlist_for_device(db, device)` — reads `signage_playlists` (Directus-written) + `signage_playlist_items` + tag maps. Returns 304 or new envelope.

**Verified:** The resolver (`signage_resolver.py`) uses plain SQLAlchemy reads. It does NOT care who wrote the rows, as long as the schema matches. Alembic owns the schema; Directus writes conform by construction (Directus writes through the same columns). No conflict.

### Flow B — Playlist delete blocked by FK RESTRICT
Today: FastAPI catches `IntegrityError`, returns 409 `{detail, schedule_ids}` (see `apiClientWithBody` + `ApiErrorWithBody` in `signageApi.ts`).

After v1.22: Directus SDK `deleteItem('signage_playlists', id)` throws `DirectusError` with `errors[0].extensions.code === "FOREIGN_KEY_VIOLATION"`. The adapter in `signageApi.ts`:
1. Catches the FK error.
2. Issues a follow-up SDK query to compute `schedule_ids` (as described in Frontend Seam section).
3. Throws `ApiErrorWithBody(409, {detail, schedule_ids}, detail)`.
4. Existing dialogs (e.g. `PlaylistDeleteDialog`) continue to read `err.body.schedule_ids` — no UX change.

**Verified:** The FK constraints themselves (`ON DELETE RESTRICT` on `signage_schedules.playlist_id`) live in the Alembic migration. Directus respects them.

### Flow C — Calibration PATCH
Stays in FastAPI. `DeviceEditDialog` calls `signageApi.updateDeviceCalibration()` which continues hitting `PATCH /api/signage/devices/{id}/calibration`. Direct `signage_broadcast.notify_device(id, {event: "calibration-changed"})` still works because FastAPI is the writer.

This creates an asymmetry: `signage_devices.name` updates go through Directus (+ LISTEN/NOTIFY), but `rotation`/`hdmi_mode`/`audio_enabled` go through FastAPI (+ direct broadcast). That's fine — both produce the right SSE events.

**Subtlety:** If the Directus LISTEN trigger fires on ANY `signage_devices` update (including the calibration PATCH from FastAPI), we'd double-fire `playlist-changed`. Fix: the LISTEN trigger on `signage_devices` only fires `device-updated`/`playlist-changed` when tag membership or `name` changed, not on calibration columns. Trigger predicate:

```sql
WHEN (OLD.name IS DISTINCT FROM NEW.name)
-- tag_map changes fire a separate trigger on signage_device_tag_map
```

Calibration SSE is owned end-to-end by the FastAPI PATCH handler (v1.21 pattern preserved).

### Flow D — Resolver reads tables Directus writes
`resolve_playlist_for_device` loads `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_playlists`, `signage_playlist_items`, `signage_schedules`. All these are Alembic-schema tables; Directus writes rows that conform to the Alembic shape. No schema divergence risk because Alembic still owns DDL.

One gotcha: Directus lets Admin users set `enabled = false` on a playlist from the Data Model UI. The resolver already handles this (`SignagePlaylist.enabled.is_(True)` filter). Preserved.

### Flow E — `me` kill
Frontend `getCurrentUser()` call target moves from `GET /api/me` (FastAPI) → `readMe()` (Directus SDK). `AuthContext` already holds the SDK token. The role UUID comes back on the SDK response; `CurrentUser.role` is derived via the same UUID→enum map used in `directus_auth.py` (share the mapping across backend + frontend config).

**One thing to preserve:** `CurrentUser` currently includes `email` as a synthesized placeholder (`directus_auth.py:57` — `f"{user_id}@directus.example.com"`). Directus SDK `readMe({fields: ['email']})` returns the real email, which is actually better. Frontend uses the real email; backend code paths that used placeholder email (if any) should be audited in Phase 1 of v1.22.

---

## Compose / Deployment Ordering

Current chain (`docker-compose.yml`):
```
db (healthcheck)
 └─ migrate (alembic upgrade head, exits)
     ├─ api (waits for migrate completed)
     ├─ directus (waits for db healthy + migrate completed)
     │   └─ directus-bootstrap-roles (waits for directus healthy, exits)
     ├─ frontend (waits for api healthy)
     └─ caddy (waits for api/frontend/directus healthy)
```

### Required changes for v1.22

1. **New service `directus-bootstrap-schema`** — runs `directus schema apply /snapshot.yaml` against the healthy Directus, exits. Must run BEFORE `directus-bootstrap-roles` because permissions reference collections that must exist.

2. **Re-order**:
   ```
   migrate
    └─ directus (healthy)
        └─ directus-bootstrap-schema (exits successfully)
            └─ directus-bootstrap-roles (exits successfully)
                └─ api (NEW: gated on both bootstrap services completed)
   ```

3. **`api` `depends_on` change**: add `directus-bootstrap-roles: condition: service_completed_successfully`. Rationale: if the API starts before Viewer role exists, the JWT role-UUID → enum lookup in `directus_auth.py` will throw 401 for any Viewer login. Currently this races because `directus-bootstrap-roles` is fire-and-forget; it works only because Viewers rarely log in within the first 5 seconds.

4. **`frontend` `depends_on` change**: add `directus-bootstrap-schema: condition: service_completed_successfully`. Rationale: the built frontend bundle queries collections by name (`readItems('signage_playlists')`); if the collection metadata isn't registered yet, the SDK throws. Though, because the frontend is a static bundle served over `/`, the only practical effect is: the first admin page load after a fresh deploy could see a "collection not found" error. Gating the service start on schema-bootstrap completion eliminates the window.

5. **`DB_EXCLUDE_TABLES` env on `directus` service** (line 95 of compose): shrinks. Remove `signage_devices`, `signage_pairing_sessions` (already excluded; revisit) and the moved tables go from hidden-from-Directus → visible-as-Collections. Keep excluded: `upload_batches`, `sales_records` (Phase says move it, but evaluate — see "open question" below), `app_settings` (compute-shaped, stay in FastAPI), `personio_attendance` / `personio_absences` / `personio_sync_meta` (raw sync data, stay FastAPI-managed), `alembic_version`, `sensors`, `sensor_readings`, `sensor_poll_log`, `signage_heartbeat_event` (append-only log, stay FastAPI).

   Revised `DB_EXCLUDE_TABLES`:
   ```
   upload_batches,app_settings,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log,signage_heartbeat_event
   ```
   Surfaced to Directus: `signage_devices`, `signage_pairing_sessions` (read-only for admin visibility), `signage_playlists`, `signage_playlist_items`, `signage_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, `signage_media`, `sales_records`, `personio_employees`.

   **Open question for roadmap:** `signage_pairing_sessions` writes happen exclusively in `signage_pair` router (compute-shaped JWT minting). Exposing the collection read-only in Directus could help ops debugging but isn't required. Default: exclude it (keep FastAPI-only).

6. **`SIGNAGE_DEVICE_JWT_SECRET`** stays on the `api` service only — Directus has no business minting device JWTs.

---

## Recommended Phase Sequence (input to roadmapper)

**Ordering principle:** Make the schema + bootstrap + SSE plumbing reliable FIRST, before any frontend gets ported. Otherwise every frontend-port phase has to carry "and we fixed X in the bootstrap too" as churn.

### Phase A — Schema bootstrap + SSE bridge (backend-only, ships with no user-visible change)
- Add `directus-bootstrap-schema` service + `snapshot.yaml` (generated from a one-time configured dev instance, stripped of policies).
- Add LISTEN/NOTIFY triggers as Alembic migration on the 5 SSE-relevant tables.
- Add `signage_pg_listen.py` service; wire into `lifespan`.
- Extend `bootstrap-roles.sh` with `Viewer Read` permission rows for the read-allowed collections.
- Integration test: admin edits a playlist via Directus Data Model UI (manually) → Pi player receives `playlist-changed`. Proves the bridge works without any frontend changes.
- Rollback window: trivial (roll back the Alembic trigger migration + restore old bootstrap script).

### Phase B — Move `me.py` + frontend `AuthContext` to SDK-only
- Smallest surface. `AuthContext` already holds the SDK.
- Delete `backend/app/routers/me.py` + test.
- Frontend `useCurrentUser()` switches to `directus.request(readMe())`.
- Low blast radius — affects only the header UserMenu and role gates.

### Phase C — Move `data.py` (sales/employees lookups)
- `signageApi.listSales` → `directus.request(readItems('sales_records', { filter, limit, ...}))`.
- Server-side aggregation endpoints (`/api/kpis/*`, `/api/hr/kpis/*`) stay — they're compute, not CRUD.
- Lookups (employee list, sales row list) move.
- Delete the FastAPI `data.py` lookup endpoints only after all frontend call sites are ported.

### Phase D — Move `signage_admin` surface (the big one)
- Port `signageApi.ts` methods one collection at a time: tags → media → playlists/items → devices (name/tags only) → schedules → analytics.
- Each sub-phase: adapter-wrap in `signageApi.ts`, keep consumers unchanged, regression-test the SSE flow.
- Keep: `POST /api/signage/media/upload` (file upload + hashing — compute-shaped), `POST /api/signage/media/{id}/convert` (PPTX pipeline), `PATCH /api/signage/devices/{id}/calibration`, `/api/signage/pair/*`, `/api/signage/player/*`, `/api/signage/analytics/devices` (read-model shaped, could move but has computed uptime buckets — evaluate separately).

### Phase E — Cleanup
- Delete moved FastAPI routers, schemas, tests.
- Shrink `DB_EXCLUDE_TABLES` env.
- Docs update (admin guide screenshots now show Directus Data Model UI paths for Viewer role configuration).

### Sequencing hazards (flag to roadmapper)
- **Phase A must ship standalone.** If Phase A ships inside Phase D, any SSE regression is hidden by the frontend churn. Shipping A alone with "no user-visible change" as the acceptance criterion is the cleanest way to prove the LISTEN bridge is stable.
- **Phase B before Phase D.** Frontend `AuthContext` refactor is the prerequisite for confident SDK usage in other hooks; doing it as a small isolated change de-risks D.
- **Snapshot commit workflow.** The `snapshot.yaml` is generated once from a dev instance. If a future phase adds a field, the workflow is: edit dev Directus UI → `directus schema snapshot` → strip policies → commit. Document this in `directus/README.md` so future migrations don't drift.
- **Don't port `signage_media` CRUD without porting upload**. File upload stays in FastAPI (multipart, hash, PPTX conversion). But the `listMedia`/`getMedia`/`deleteMedia` calls CAN move to Directus. Check that Directus's delete of a `signage_media` row doesn't orphan the file in `directus_uploads` volume (it shouldn't — Directus owns the volume already).
- **Settings deliberately NOT moved** (per PROJECT.md scope). Don't accidentally include `app_settings` in the snapshot.

---

## Sources

- `docker-compose.yml` — existing service graph, Directus version `11.17.2`, `DB_EXCLUDE_TABLES` env (HIGH)
- `caddy/Caddyfile` — existing reverse proxy layout, same-origin Directus path (HIGH)
- `directus/bootstrap-roles.sh` — existing idempotent REST-API bootstrap pattern, fixed-UUID idempotency (HIGH)
- `backend/app/security/directus_auth.py` — current JWT validation + role map (HIGH)
- `backend/app/services/signage_broadcast.py` — in-process fanout, `--workers 1` invariant (HIGH)
- `backend/app/services/signage_resolver.py` — resolver shape; `_build_envelope_for_playlist`, `devices_affected_by_playlist` (HIGH)
- `backend/app/routers/signage_admin/playlists.py` — existing `_notify_playlist_changed` post-commit fanout pattern (HIGH)
- `backend/alembic/versions/v1_16_signage_schema.py`, `v1_18_signage_schedules.py`, `v1_18_signage_heartbeat_event.py`, `v1_21_signage_calibration.py` — Alembic owns all signage DDL (HIGH)
- `frontend/src/lib/apiClient.ts`, `frontend/src/lib/directusClient.ts`, `frontend/src/signage/lib/signageApi.ts` — current client seam + `ApiErrorWithBody` pattern (HIGH)
- Directus 11 schema snapshot/apply: `directus schema snapshot|apply` CLI — documented at `docs.directus.io/reference/cli.html` (MEDIUM — training-data knowledge of Directus 11 CLI; verify exact flag shape during implementation)
- Postgres `LISTEN/NOTIFY` + asyncpg `connection.add_listener` — standard Postgres feature, asyncpg documented support (HIGH)
- v1.11-directus Phase 02 decision (`bootstrap-roles.sh` comment) — rejection of v10 snapshot shape (HIGH)
