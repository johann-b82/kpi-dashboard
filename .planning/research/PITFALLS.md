# Pitfalls — v1.22 Backend Consolidation (Directus-First CRUD)

## Domain

Brownfield migration moving ~25 FastAPI CRUD endpoints to Directus 11 collections on the shared Postgres 17 database. Alembic retains ownership of `public.*` schema; FastAPI retains compute (uploads, KPIs, SSE, SNMP, PPTX, device-JWT pairing, Personio sync). Directus gains a **second write path** into tables it does not own — every pitfall below stems from that dual-writer posture.

**Axes of risk:**
1. Schema ownership drift (Alembic vs Directus Data Model snapshot)
2. Policy surface area (Directus permissions vs existing Admin/Viewer JWT gate)
3. Wire-contract drift (response shape, 409 bodies, pagination envelopes)
4. SSE fanout correctness (mutations now originate outside FastAPI)
5. Frontend cache coherence (TanStack Query + Directus SDK coexistence)
6. Rollback reversibility per endpoint

---

## Pitfall Table (ranked by severity)

| # | Pitfall | Severity | Phase to address | Prevention |
|---|---------|----------|------------------|------------|
| P1 | Directus Data Model rewrites Alembic-owned column types / defaults when you "edit" a field in the UI | CRITICAL | Phase A (schema exposure / collection registration) | Register collections via snapshot/API with `meta` only — never touch `schema` side. CI drift-check `alembic check` + `directus schema snapshot` diff. Test: `test_directus_does_not_touch_public_schema` comparing `information_schema.columns` hash pre/post Directus apply. |
| P2 | `server_default` and CHECK constraints (e.g. `rotation IN (0,90,180,270)`) invisible to Directus → admin UI accepts values Postgres rejects, surfaces as opaque 500 | CRITICAL | Phase A | For each migrated table, mirror every CHECK as Directus field validation (`meta.validation`) + enumerate as dropdown choices. Test matrix: one invalid-value PATCH per constraint → expect 400 with field-level message, not 500. |
| P3 | Directus default Public policy grants read on newly-registered collections → Viewer (and unauth if Public is misconfigured) can read analytics / pairing-code scoped data | CRITICAL | Phase B (policy mapping) | `bootstrap-roles.sh` must explicitly DELETE any auto-created `null` (public) policy permissions for migrated collections before enabling them. Add integration test: unauthenticated `GET /directus/items/signage_devices` returns 403. Add a `policy-audit.sh` CI step that diffs `/permissions` against a fixture. |
| P4 | FK RESTRICT violations surface as Directus generic `{errors:[{extensions:{code:"RECORD_NOT_UNIQUE"}}]}` instead of current `{detail, playlist_ids}` / `{detail, schedule_ids}` 409 contract → frontend toast breaks silently | HIGH | Phase C (playlist/media DELETE migration) | Keep DELETE for playlists + media in FastAPI (exempt from migration) OR add a Directus custom hook that catches FK errors and rethrows with the flat `{detail, <resource>_ids}` shape. Contract test: `test_delete_playlist_with_schedule_returns_flat_409` must pass against whichever backend serves DELETE. |
| P5 | SSE `playlist-changed` / `calibration-changed` events never fire because mutation now happens in Directus — player shows stale data until the 30 s polling fallback catches up | HIGH | Phase C (per endpoint migration) | Wire a Directus **Flow** (event hook: `items.create/update/delete` on `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_devices`.calibration) that POSTs to a new internal FastAPI endpoint `POST /internal/signage/broadcast` (shared-secret auth, localhost-only) which then calls `signage_broadcast.notify_device`. Integration test: mutate via Directus REST → assert SSE frame delivered within 500 ms. Do NOT migrate any signage CRUD endpoint until its Flow hook is shipped. |
| P6 | Directus O2M bulk write on `signage_playlist_items` is not atomic the way `PUT /playlists/{id}/items` is — partial failure leaves half-replaced playlist on the Pi | HIGH | Phase C (playlist_items migration) | Keep `PUT /playlists/{id}/items` bulk-replace in FastAPI (listed as migration candidate but semantically compute-shaped — atomic transaction + SSE fan-out is a compute responsibility). Document as an explicit exemption in `.planning/research/ARCHITECTURE.md` alongside the existing DELETE-playlist exemption. Alternative: Directus Flow with explicit `begin/commit` — but Directus Flows do not guarantee single-transaction semantics across multiple item operations; reject this path. |
| P7 | TanStack Query cache collision: `signageKeys.devices()` = `["signage","devices"]` remains cached with stale FastAPI response shape after frontend switches some call sites to Directus SDK (which returns `{data:[...]}` wrapper) | HIGH | Phase D (frontend refactor) | **Change the key namespace** when migrating: new keys under `["directus","signage_devices"]` etc. Do NOT reuse `signageKeys.devices()` for Directus reads — mixing serialization shapes under the same key causes runtime type errors after HMR. One-shot `queryClient.removeQueries({queryKey: signageKeys.all})` on app boot post-deploy (gated by `localStorage.__directus_migration_v1`). Test: `test_query_key_namespaces_disjoint` greps `src/` for old signageKeys usage in files that also import `@directus/sdk`. |
| P8 | `DB_EXCLUDE_TABLES` drift — removing a table from the exclude list does not surface it in Directus Data Model until `directus schema apply` runs AND the container restarts; stale exclude list re-hides tables after migration | HIGH | Phase A + Phase E (cleanup) | Treat `DB_EXCLUDE_TABLES` as a per-phase deliverable: each table migration PR edits `docker-compose.yml` AND ships a `directus/snapshots/<phase>.yml` that registers the collection. Boot-order invariant: `directus-bootstrap-roles` depends on Directus healthcheck which depends on schema apply. Runbook step: `docker compose restart directus` after every compose edit (not just reload). |
| P9 | Field-level permission leak: Directus collection-level read grant on `signage_devices` exposes `device_secret` / `paired_at` / internal audit columns that the current FastAPI `SignageDeviceRead` schema filters out | HIGH | Phase B | For every migrated collection, explicit `fields` allowlist in the Viewer policy permission row (not `*`). Reference the Pydantic `*Read` schema as the ground truth. Test: `test_viewer_cannot_read_device_secret` — login as Viewer, GET `/directus/items/signage_devices`, assert `device_secret` not in response. |
| P10 | Filter/pagination/sort contract mismatch: current FastAPI returns unwrapped `List[T]` with server-side default sort (`created_at ASC`); Directus returns `{data: T[], meta?}` with no default sort | MEDIUM | Phase D (frontend refactor) | Create a thin `directusList<T>(collection, params)` adapter in `frontend/src/lib/directusClient.ts` that unwraps `.data` and applies the same default sort the FastAPI endpoint used. Map legacy query params: `?search=` → `?filter[name][_icontains]=`, implicit sort → explicit `?sort=created_at`. Contract test: snapshot the old FastAPI response for each endpoint, run through adapter, diff. |
| P11 | Alembic migration-vs-Directus-snapshot conflict: adding a column via Alembic after Directus has cached the collection schema → Directus ignores the new column until you `POST /schema/snapshot` + `POST /schema/apply` | MEDIUM | Phase A + ongoing | CI gate: `make directus-schema-diff` runs after any Alembic migration touching a migrated table. Document in `docs/setup.md` the mandatory `docker compose exec directus npx directus schema snapshot` step. Waiver: the v1.22 freeze rule — no Alembic column-adds on migrated tables during the milestone. |
| P12 | Rollback ambiguity: reverting one migrated endpoint mid-milestone leaves (a) the `DB_EXCLUDE_TABLES` entry gone, (b) the Directus policy row live, (c) frontend imports split between `apiClient` and `directusClient` | MEDIUM | Phase E (cleanup) + per-phase | Per-endpoint rollback recipe in each phase plan, explicitly naming: the `docker-compose.yml` line to revert, the `bootstrap-roles.sh` block to comment out, the `directus/snapshots/*.yml` to drop, and the frontend imports to revert. `git revert` must be sufficient — no manual DB surgery. Phase exit criterion: `git revert HEAD` produces a working stack on a clean `docker compose down -v && up`. |
| P13 | SSE `playlist-changed` etag drift: FastAPI computes etag from `compute_playlist_etag(envelope)` which folds in tag map + schedule state; a Directus-side mutation Flow cannot call that Python helper, so any hook-emitted etag will diverge from what `GET /api/signage/player/playlist` returns → player thinks envelope changed when it hasn't (needless refetch) or didn't (silent stale) | MEDIUM | Phase C | The Directus Flow MUST NOT compute the etag itself — it posts `{event, device_id, playlist_id}` to FastAPI's internal broadcast endpoint, which resolves + computes etag using the existing helper, then calls `notify_device`. Etag computation stays single-sourced in FastAPI. Test: `test_directus_mutation_produces_etag_identical_to_fastapi_mutation` |
| P14 | `signage_media.uri` couples Directus file UUIDs: moving device/playlist CRUD to Directus while media stays in FastAPI means playlist-item create via Directus cannot validate that `media_id` exists without a cross-collection check | MEDIUM | Phase C | Keep media create/update/delete in FastAPI (already scoped out — media.py stays). For playlist_items, add a Directus Flow validation hook on create/update that verifies `media_id` exists in `signage_media` via Directus items API. Alternative: FK ON DELETE RESTRICT (already present) makes Postgres the final guard; accept that Directus will return a raw FK error until the Flow validator lands. Carry P4's prevention. |
| P15 | Public role default permissions on system collections (`directus_users`, `directus_files`) — moving `me.py` to `/users/me` inadvertently exposes fields like `external_identifier`, `auth_data`, `tfa_secret` through Viewer policy if `fields: *` is set | MEDIUM | Phase B | Explicit Viewer-policy `directus_users` read: `fields: id,email,first_name,last_name,role,avatar`. Never `*` on `directus_*` system collections. Test: `test_viewer_me_does_not_leak_tfa_secret`. Directus docs gotcha: the "Administrator" policy defaults include system collections with `*` — this is fine for admin, dangerous if copied to Viewer. |
| P16 | Double-truth on `app_settings` / `signage_schedules.timezone`: if accidentally exposed (not in `DB_EXCLUDE_TABLES` or added later), Directus admins editing a field in the Data Model UI can change column types and silently break Pydantic validation | LOW | Phase A | Belt-and-braces: (a) keep `app_settings` in `DB_EXCLUDE_TABLES` — not a migration candidate. (b) CI assertion that `DB_EXCLUDE_TABLES` in `docker-compose.yml` is a superset of a hard-coded allowlist of "never expose" tables. |
| P17 | `restart: "no"` on `directus-bootstrap-roles` means a policy-bootstrap failure is silent after first boot — operator restarts the stack, bootstrap runs once successfully, later policy edits via the Directus UI get overwritten? (No — GET-before-POST prevents this, but the inverse is also true: a deleted policy is never re-created.) | LOW | Phase B | Accept current semantics (idempotent ensure-exists, not reconcile). Document in `docs/setup.md`: "policies drift from bootstrap script → re-create manually or `docker compose run --rm directus-bootstrap-roles`". Test: running the bootstrap script twice is a no-op (already covered by GET-before-POST). |
| P18 | Mixed-auth state during migration: a request could carry a Directus JWT that FastAPI validates AND hit a FastAPI endpoint that's been partially dual-written; if a Flow hook fails (network blip to internal broadcast), Directus commits the mutation but SSE never fires. Nothing retries | LOW | Phase C | Accept eventual consistency via the existing 30 s polling fallback in the player. Document SLA: "SSE is best-effort; polling is authoritative ceiling." Monitor: WARN log on Flow HTTP failure → surfaces in `docker compose logs directus`. |

---

## Detailed Pitfalls

### P1 — Directus Data Model rewrites Alembic-owned column types/defaults

**What goes wrong:** An admin opens the Directus Data Model UI to rename a field label (`signage_devices.name` → "Display Name"). Directus saves the `meta` row but also re-emits ALTER TABLE statements based on its snapshot — if its snapshot is stale relative to Alembic, it can revert a `server_default`, drop a CHECK constraint, or change a column type (e.g. `TEXT` → `VARCHAR(255)`).

**Why it happens:** Directus assumes it owns the schema it has registered. There is no "meta-only, hands-off schema" mode in v11 — field edits that touch the underlying column will regenerate DDL.

**Consequences:** Silent loss of Alembic invariants. Next `alembic upgrade head` either no-ops (Alembic thinks state matches its last migration, Postgres says otherwise) or fails with "can't add constraint, violating rows exist."

**Prevention:**
- Expose collections **read-only from the Data Model UI perspective** — all Directus admin UI users use the Administrator role, but document "edit schema only via Alembic."
- CI: after every PR, run `alembic upgrade head` on a snapshot DB, then `docker compose exec directus npx directus schema snapshot -`, diff against a committed `directus/schema-snapshot.yml`. Block PR on unexpected drift.
- Pydantic unit test: `test_public_schema_column_hash_unchanged` SHA256s `information_schema.columns WHERE table_schema='public'` and compares to a fixture updated only via Alembic migrations.

**Phase:** Phase A (schema exposure).

### P2 — Loss of CHECK constraints and server_default in Directus field validation

**What goes wrong:** `signage_devices.rotation` has a CHECK `(rotation IN (0,90,180,270))`. Directus surfaces this as a plain `INT` field. Admin UI lets you type `45`, PATCH round-trips to Postgres, FK rejects at COMMIT, Directus returns generic 500.

**Why it happens:** Directus's "discover schema" step reads column types but not all constraint subtypes cleanly — CHECK is best-effort and enum-style CHECKs aren't auto-surfaced as dropdowns.

**Consequences:** Admin sees opaque errors. Worse, Pydantic's `Literal[0,90,180,270]` 422 contract (see `devices.py:122` CAL-BE-03) was the frontend's only validation source — Directus gives up that contract.

**Prevention:** For every CHECK on a migrated table, add explicit Directus `meta.validation` JSON and `meta.options.choices` dropdown. Ship as part of the snapshot. Test matrix:

```python
# tests/directus/test_field_validation.py
@pytest.mark.parametrize("bad_value", [45, -1, 360, 91])
def test_rotation_rejects_invalid(directus_admin_client, device_id, bad_value):
    r = directus_admin_client.patch(f"/items/signage_devices/{device_id}",
                                     json={"rotation": bad_value})
    assert r.status_code == 400
    assert "rotation" in r.json()["errors"][0]["extensions"]["field"]
```

**Phase:** Phase A.

### P3 — Public/Viewer policy leak on newly-registered collections

**What goes wrong:** Directus 11 has a Public policy (role=null). When you register a new collection, if the Public policy has a wildcard grant or you copy-paste from the Administrator policy, you leak reads.

**Specific leak surface for v1.22:**
- `signage_pairing_sessions` (excluded currently, stays excluded — verify)
- `signage_devices.device_secret`
- `signage_heartbeat_event` (analytics-lite, operator internal)

**Prevention:**
- Viewer policy is `app_access: true, admin_access: false` (confirmed in `bootstrap-roles.sh:78–81`). Extend the script to **explicitly add per-collection permission rows** for each migrated collection, with `fields` allowlisted.
- Add Phase B test:

```bash
# tests/directus/test_public_has_no_permissions.sh
TOKEN="" # unauth
for coll in signage_devices signage_playlists signage_playlist_items \
            signage_schedules signage_tags signage_heartbeat_event; do
  status=$(curl -so /dev/null -w '%{http_code}' http://localhost/directus/items/$coll)
  [ "$status" = "403" ] || { echo "LEAK: $coll returned $status to unauth"; exit 1; }
done
```

- Viewer-level leak test: login as Viewer, GET each migrated collection, assert response fields ⊆ `SignageDeviceRead` / `SignagePlaylistRead` / etc.

**Phase:** Phase B (policy mapping).

### P4 — FK RESTRICT 409 shape divergence

**What goes wrong:** Today `DELETE /api/signage/playlists/{id}` when blocked by a schedule returns:

```json
{"detail": "playlist has active schedules", "schedule_ids": ["uuid1", "uuid2"]}
```

(see `playlists.py:177–186`). Frontend `PlaylistsPage.tsx` deep-links into the schedules tab using `schedule_ids`. Directus native `DELETE /items/signage_playlists/{id}` on FK RESTRICT returns:

```json
{"errors": [{"message": "...", "extensions": {"code": "RECORD_NOT_UNIQUE"}}]}
```

No `schedule_ids` array. The deep-link breaks silently (empty array → no navigation).

**Prevention — pick one per resource:**

1. **Keep DELETE in FastAPI** for playlists and media (which has the same `{detail, playlist_ids}` 409 pattern). List in Phase C plan as explicit exemptions. This is the cheapest path.
2. **Directus custom hook** (`extensions/hooks/playlist-delete-409.ts`) that catches FK errors in a `filter("items.delete")` hook and rethrows a custom error with the flat shape. Requires a hooks extension, Directus restart on change, and a TS build step — more infra than it's worth for 2 endpoints.

**Recommendation:** Option 1. Contract test `test_delete_playlist_with_schedule_returns_flat_409` must pass.

**Phase:** Phase C (list the exemption up front; don't migrate the DELETE).

### P5 — SSE fanout silently breaks when mutation leaves FastAPI

**What goes wrong:** Today every mutation in `playlists.py`, `playlist_items.py`, `devices.py` calls `signage_broadcast.notify_device(...)` after commit (documented explicitly as "Pitfall 3" in the source). If `PATCH /directus/items/signage_playlists/{id}` is the new write path, no Python code runs — no SSE frame is pushed.

**Consequences:**
- Player sees stale envelope until the 30 s polling fallback fires.
- `calibration-changed` silent miss → rotation/HDMI mode not applied live. User-visible regression from v1.21.
- ETag-short-circuit optimization in `_notify_playlist_changed` is lost.

**Prevention — mandatory architecture:**

1. New FastAPI endpoint: `POST /internal/signage/broadcast` (shared-secret header, localhost-only bind via `127.0.0.1` check). Payload: `{event, playlist_id?, device_id?}`. Handler:
   - Resolves affected devices (`devices_affected_by_playlist` or single-device for calibration)
   - Resolves envelope + etag via existing helpers
   - Calls `signage_broadcast.notify_device(...)`

2. Directus Flow (one per trigger):
   - `items.signage_playlists.create/update/delete` → POST `/internal/signage/broadcast` with `{event:"playlist-changed", playlist_id}`
   - `items.signage_playlist_items.create/update/delete` → same
   - `items.signage_playlist_tag_map.*` → same
   - `items.signage_device_tag_map.*` → POST with `{event:"playlist-changed", device_id}`
   - `items.signage_devices.update` (when rotation/hdmi_mode/audio_enabled changes) → POST `{event:"calibration-changed", device_id}`
   - `items.signage_schedules.*` → POST `{event:"schedule-changed"}` (broad)

3. **Phase gate:** do not land any Phase-C endpoint migration PR without its matching Flow hook in the same commit.

4. Integration test (can run against docker-compose up stack):

```python
def test_directus_playlist_mutation_fires_sse():
    with sse_subscribe(device_id) as stream:
        directus.patch("/items/signage_playlists/"+pid, json={"name":"new"})
        frame = stream.recv(timeout=2.0)
        assert frame["event"] == "playlist-changed"
        assert frame["playlist_id"] == pid
```

**Phase:** Phase C.

### P6 — O2M bulk-replace not atomic through Directus

**What goes wrong:** `playlist_items.py:72–112` implements `PUT /playlists/{id}/items` as DELETE-all + INSERT-many in **one transaction, one commit**. Directus's items API has no equivalent — you'd do `DELETE /items/signage_playlist_items?filter[playlist_id][_eq]=...` then N × `POST /items/signage_playlist_items`. No wrapping transaction. Partial network failure after delete leaves the playlist empty on the Pi.

**Prevention:** This endpoint is **compute-shaped, not CRUD-shaped** — list as migration exemption. It belongs on the FastAPI side with the other compute endpoints. Update `.planning/research/ARCHITECTURE.md` migration list accordingly.

**Phase:** Phase C planning — exempt up front.

### P7 — TanStack Query cache-key collision

**What goes wrong:** `frontend/src/lib/queryKeys.ts:66–79` defines `signageKeys.devices() = ["signage","devices"]`. If Phase D migrates `DevicesPage.tsx` to Directus SDK but leaves `useAdminSignageEvents.ts` invalidating with `signageKeys.devices()`, and one dialog still uses the old apiClient under the same key, the cache holds one shape today and the other shape tomorrow — runtime `.map is not a function` errors after HMR or route navigation.

**Prevention:**
- Namespace split: new keys `directusKeys.signageDevices()` = `["directus","signage_devices"]`. Do NOT reuse `signageKeys.*` for Directus reads.
- All old-namespace consumers must be migrated in lockstep — a Phase D check: `grep -rn "signageKeys\." frontend/src | grep -v legacy/` returns zero after phase.
- One-shot cache bust on app boot after deploy:

```ts
// main.tsx
if (!localStorage.getItem("__directus_migration_v1_22")) {
  queryClient.removeQueries({ queryKey: ["signage"] });
  localStorage.setItem("__directus_migration_v1_22", "1");
}
```

- Test: `test_no_mixed_cache_keys` ESLint rule (or `check-phase-*`-style grep guard) forbids importing `@directus/sdk` in the same file that imports `signageKeys`.

**Phase:** Phase D (frontend refactor).

### P8 — `DB_EXCLUDE_TABLES` drift + restart semantics

**What goes wrong:**
- (a) You remove `signage_devices` from `DB_EXCLUDE_TABLES` but forget `docker compose restart directus` — Directus still hides it.
- (b) A later Alembic migration adds `signage_devices_audit` table — Directus surfaces it in the Data Model UI because nobody updated the exclude list.
- (c) Someone reorders the exclude list and accidentally drops an entry — bunch of tables go live to admins unintentionally.

**Prevention:**
- Exclude list is a **set, not a list** — alphabetize and one-per-line in compose (breaks the single-string convention; acceptable tradeoff). Or: move to an env var file with comments.
- CI guard: parse `docker-compose.yml` `DB_EXCLUDE_TABLES`, compare against `information_schema.tables WHERE table_schema='public'` minus a per-phase allowlist; fail if any public table is neither excluded nor allowlisted.
- Runbook step `docs/setup.md`: "After editing `DB_EXCLUDE_TABLES`: `docker compose up -d directus` (not `restart` — Directus reads env only on create/recreate with new env)."
- Phase E cleanup: audit final `DB_EXCLUDE_TABLES` matches the "stays in FastAPI" list from PROJECT.md.

**Phase:** Phase A + Phase E.

### P9 — Field-level permission leak (device_secret, etc.)

**What goes wrong:** Viewer policy grants `read` on `signage_devices` with `fields: *`. `device_secret` is now visible to Viewers in admin UI / `/directus/items/signage_devices` responses. Before v1.22, Viewers never hit this endpoint — the FastAPI router used `SignageDeviceRead` which omits secret columns.

**Prevention:**
- Viewer policy per-collection: `fields: ["id","name","rotation","hdmi_mode","audio_enabled","created_at","paired_at","last_heartbeat_at"]` — mirror Pydantic `SignageDeviceRead` exactly.
- `bootstrap-roles.sh` extension: for each migrated collection, POST a permission row with explicit `fields` array. Derive from a single source (e.g. a JSON file committed alongside the script) so the list can be diff-reviewed.
- Test: `test_viewer_cannot_read_device_secret` (login as Viewer, GET `/directus/items/signage_devices`, assert `"device_secret" not in response.json()["data"][0]`).

**Phase:** Phase B.

### P10 — Filter/pagination/sort contract mismatch

**What goes wrong:** `GET /api/signage/playlists` returns `List[SignagePlaylistRead]` (unwrapped, no pagination, sorted by `created_at`). `GET /directus/items/signage_playlists` returns `{data: [...]}`, unsorted by default, 100-row default limit. Frontend code that does `data.map(...)` breaks; implicit-sort assumptions break ordering in the UI.

**Prevention:**
- Adapter in `frontend/src/lib/directusClient.ts`:

```ts
export async function directusList<T>(coll: string, opts: ListOpts = {}): Promise<T[]> {
  const params = new URLSearchParams({
    sort: opts.sort ?? "created_at",
    limit: String(opts.limit ?? -1), // -1 = no limit; migrate to pagination if rows > 1000
    ...(opts.filter ? {filter: JSON.stringify(opts.filter)} : {}),
    ...(opts.fields ? {fields: opts.fields.join(",")} : {}),
  });
  const r = await fetch(`/directus/items/${coll}?${params}`);
  return (await r.json()).data as T[];
}
```

- Contract snapshot test per endpoint: capture old FastAPI response JSON, run Directus through adapter, diff. Ordering must match.
- Document the `-1` limit caveat: fine for ≤5 devices / ≤100 playlists; revisit for large collections.

**Phase:** Phase D.

### P11 — Alembic migration + Directus snapshot reconciliation

**What goes wrong:** During v1.22 someone runs an Alembic migration adding a column to `signage_playlists`. Directus doesn't see it until `directus schema snapshot && schema apply` runs. The admin UI doesn't offer the new field; the REST items API returns it (Directus reads from information_schema on request) but omits field metadata.

**Prevention:**
- Freeze rule during v1.22: no Alembic migrations that add/modify columns on tables in the migration set. If unavoidable, the migration PR must also update the Directus snapshot.
- Post-migration CI step: `make directus-apply-schema` in the `migrate` service or as a new compose service running after Alembic.
- Runbook note in `docs/setup.md` for v1.22+: "Schema changes on Directus-exposed tables = Alembic + snapshot update = two commits in same PR."

**Phase:** Phase A + ongoing.

### P12 — Rollback reversibility per endpoint

**What goes wrong:** Phase C migrates `signage_schedules` CRUD to Directus. A bug surfaces in prod (SSE Flow hook failing 10% of mutations). Rollback needs to revert:
- `docker-compose.yml` `DB_EXCLUDE_TABLES` (re-add `signage_schedules`)
- `bootstrap-roles.sh` (remove schedules permission rows)
- `directus/snapshots/phase-c-schedules.yml` (drop or revert snapshot apply)
- Directus Flow for schedules (disable/delete)
- Frontend: revert `SchedulesPage.tsx` to apiClient, restore `signageKeys.schedules()` usage
- Re-enable FastAPI `routers/signage_admin/schedules.py` (don't delete until Phase E)

**Prevention:**
- Phase C plan rule: **do not delete** the FastAPI router, schemas, or tests for a migrated endpoint until Phase E cleanup. Keep them behind an `ENABLE_LEGACY_SIGNAGE_ROUTERS` env flag if needed, or just don't remove the include.
- Each phase plan carries a **Rollback Recipe** section naming exactly which files to `git revert` and what DB/env state must be reset.
- Test: on a clean environment, `git revert <phase-c-merge>` + `docker compose down -v && docker compose up -d` produces a working stack. Run the E2E smoke tests.

**Phase:** Phase E + per-phase plans.

### P13 — SSE etag drift between Flow-emitted and FastAPI-computed envelopes

**What goes wrong:** If the Directus Flow computes an etag locally (e.g. hash of playlist JSON) and FastAPI's `compute_playlist_etag(envelope)` uses a different algorithm (which it does — it folds in tag maps, schedule state, and media URIs), the player receives etag X from SSE but `GET /api/signage/player/playlist` returns etag Y. Player refetches every SSE frame even when nothing changed (or worse, trusts its cache when something did change).

**Prevention:**
- Flow hook payload is **event + identifier only** — no etag. FastAPI's `/internal/signage/broadcast` handler computes etag server-side via `compute_playlist_etag()`, same function as the envelope endpoint.
- Single-source test: `test_sse_etag_matches_envelope_etag`.

**Phase:** Phase C (designed in alongside P5).

### P14 — Cross-collection validation (media_id on playlist_items)

**What goes wrong:** Directus `POST /items/signage_playlist_items` with a bogus `media_id`. FK catches it at commit, Directus returns generic 500/400, no field-specific error.

**Prevention:**
- Directus Flow validation hook `filter("items.signage_playlist_items.create")` that looks up `media_id` in `signage_media` via the items API and throws a structured error if missing.
- Acceptable fallback: accept the raw FK error. The frontend already validates via `MediaPickerDialog` (user picks from existing media list); bogus IDs only arrive via API abuse.
- Carry P4's prevention recipe — if we keep playlist_items in FastAPI (P6), this pitfall dissolves.

**Phase:** Phase C.

### P15 — Directus system-collection field leak

**What goes wrong:** Viewer policy on `directus_users` with `fields: *` exposes `tfa_secret`, `auth_data`, `external_identifier`.

**Prevention:**
- Explicit Viewer fields list: `["id","email","first_name","last_name","role","avatar"]`.
- The Administrator policy can have `*` — but when creating the Viewer policy, start from empty, not copy-from-admin.
- Test: `test_viewer_me_does_not_leak_tfa_secret`.

**Phase:** Phase B.

### P16 — Accidental `app_settings` exposure

**What goes wrong:** Someone removes `app_settings` from `DB_EXCLUDE_TABLES` "to let admins edit colors from Directus." Directus Data Model UI lets them change column types. Pydantic oklch/hex validators reject values Directus admin just saved.

**Prevention:**
- Hard-coded "never expose" allowlist in a CI guard — asserts `app_settings`, `alembic_version`, `upload_batches`, `sales_records`, `personio_*` all in `DB_EXCLUDE_TABLES`.
- Settings migration is explicitly out of scope (PROJECT.md confirms). Document the invariant in `CLAUDE.md` migration rules.

**Phase:** Phase A.

### P17 — Bootstrap drift after first boot

**What goes wrong:** An operator deletes the Viewer policy via the Directus UI by accident. Restarting the stack does nothing — `bootstrap-roles.sh` is idempotent ensure-exists (GET returns 404 → POST creates), so it SHOULD re-create. But if the policy was partially deleted (role exists, access row exists, policy gone), the GET for policy returns 404 → creates it, but the access row might now point to an orphan. Low probability, documented gap.

**Prevention:**
- Accept current semantics (ensure-exists, not full reconcile).
- Document in `docs/setup.md`: "Policy drift? `docker compose run --rm directus-bootstrap-roles` is safe to re-run."
- Phase B test: run `bootstrap-roles.sh` twice in CI; second run is all "exists — skipping."

**Phase:** Phase B.

### P18 — Flow hook → broadcast failure is fire-and-forget

**What goes wrong:** Directus Flow POSTs to `/internal/signage/broadcast`. api container is momentarily OOM-killed. POST fails. Directus DB mutation already committed. No retry, no SSE frame.

**Prevention:**
- Accept eventual consistency — player's 30 s polling fallback is the safety net. Document as the SLA.
- Flow config: retry once on 5xx with 1 s backoff (Directus Flows support this).
- Operator alert: WARN log aggregation on "broadcast POST failed" patterns.

**Phase:** Phase C.

---

## Phase Mapping Summary

| Phase (proposed) | Pitfalls addressed |
|------------------|---------------------|
| **Phase A — Schema exposure / collection registration** | P1, P2, P8, P11, P16 |
| **Phase B — Policy mapping (Viewer/Admin → Directus policies)** | P3, P9, P15, P17 |
| **Phase C — Per-endpoint migration with Flow hooks for SSE** | P4, P5, P6, P13, P14, P18 |
| **Phase D — Frontend refactor (Directus SDK, cache keys)** | P7, P10 |
| **Phase E — Cleanup, dead-code removal, rollback verification** | P8 (final), P12 |

## Required Test Coverage (new, Phase-gated)

| Test | Phase | Purpose |
|------|-------|---------|
| `test_directus_does_not_touch_public_schema` | A | P1 guard |
| `test_field_validation_matches_pydantic_literal` | A | P2 guard |
| `test_public_unauth_gets_403_on_migrated_collections` | B | P3 guard |
| `test_viewer_fields_subset_of_pydantic_read_schema` | B | P9 guard |
| `test_viewer_me_does_not_leak_tfa_secret` | B | P15 guard |
| `test_delete_playlist_with_schedule_returns_flat_409` | C | P4 guard |
| `test_directus_playlist_mutation_fires_sse_within_500ms` | C | P5 guard |
| `test_sse_etag_matches_envelope_etag` | C | P13 guard |
| `test_query_key_namespaces_disjoint` | D | P7 guard |
| `test_list_contract_unchanged_via_adapter` | D | P10 guard |
| `test_phase_revert_produces_working_stack` | E | P12 guard |

---

## Sources

- `backend/app/routers/signage_admin/devices.py` — current 409 + SSE fan-out patterns
- `backend/app/routers/signage_admin/playlists.py:146–195` — FK RESTRICT `{detail, schedule_ids}` contract
- `backend/app/routers/signage_admin/playlist_items.py:72–112` — atomic bulk-replace transaction
- `backend/app/services/signage_broadcast.py` — `--workers 1` invariant, in-process queue
- `frontend/src/lib/queryKeys.ts:66–79` — `signageKeys` at cache-collision risk
- `docker-compose.yml:93–95` — `DB_EXCLUDE_TABLES` exposure surface
- `directus/bootstrap-roles.sh` — roles-as-code, idempotency model
- Directus 11 docs — [Permissions & Policies](https://docs.directus.io/reference/system/policies.html), [Flows](https://docs.directus.io/app/flows.html), [Schema](https://docs.directus.io/reference/system/schema.html) (confidence MEDIUM — version-specific surface area around policies is recent)
- PROJECT.md:19–36 — v1.22 scope boundaries (what stays in FastAPI)
