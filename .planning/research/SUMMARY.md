# Research Summary — v1.22 Backend Consolidation

## Milestone Goal

Move the ~25 pure-CRUD FastAPI endpoints (`signage_admin/{devices,playlists,playlist_items,schedules,tags}`, `data.py` sales + employee row lookups, `me.py`) to Directus 11 collections on the shared Postgres database, preserving Alembic as the sole DDL owner and leaving FastAPI focused on compute (SSE, uploads, KPIs, PPTX, pairing JWT, Personio sync, analytics aggregates, calibration, bulk playlist-item replace).

## Executive Summary

- **Directus = shape, FastAPI = compute — research confirms this principle holds at endpoint granularity.** ~17 of 25 endpoints are a clean mechanical move; ~6 must stay in FastAPI (compute-shaped); 2 split (devices list, /employees).
- **Alembic is sole DDL source of truth.** Directus owns only metadata rows (`directus_collections/fields/relations/permissions`) — never `public.*`. Snapshot YAML + `bootstrap-roles.sh` REST pattern keep this boundary reviewable in git.
- **THE keystone open question is how SSE fanout survives the move** — the 4 researchers split. ARCHITECTURE.md picks Postgres LISTEN/NOTIFY; FEATURES.md + PITFALLS.md pick Directus Flow → FastAPI webhook. Must be decided before roadmapping (see below).
- **Phase A ships backend-only with zero user-visible change** (schema + policies + SSE bridge), proving the bridge works before any endpoint moves. Tags are the smallest-blast-radius first C-sub-phase. `me.py` kill is independent and tiny.
- **Field-level permission discipline non-negotiable:** every Viewer policy permission row needs explicit `fields` allowlist mirroring Pydantic `*Read`. `*` on `directus_users` would leak `tfa_secret`/`auth_data`.

## KEY DECISION TO MAKE — SSE Bridge Mechanism

Every `signage_admin/*` mutation today calls `signage_broadcast.notify_device()` post-commit, driving player `/api/signage/player/stream` SSE. After v1.22 the mutation happens inside Directus (separate process) — FastAPI never sees it. Without a bridge, SSE silently degrades to 30s polling fallback and `calibration-changed` for Directus-owned fields would miss entirely.

### Option A — Postgres `LISTEN/NOTIFY` (ARCHITECTURE.md's pick)

**Mechanism:** Alembic migration adds `AFTER INSERT/UPDATE/DELETE` triggers on `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, `signage_devices` (name+tag columns only — NOT calibration columns). Trigger calls `pg_notify('signage_change', '{table,op,row_id}')`. FastAPI `lifespan` starts long-lived `asyncpg` `connection.add_listener`. Handler re-reads DB, runs existing `devices_affected_by_playlist` resolver, calls existing `notify_device()`. Etag still computed by existing `compute_playlist_etag` helper (single-source).

**Pros:**
- **Writer-agnostic** — fires on Directus, Alembic seed, direct psql, any future writer. Single DB choke point.
- Triggers-as-code in Alembic — reviewable SQL in git, versioned with migrations.
- Zero new HTTP surface, zero new shared secret.
- `--workers 1` invariant already guarantees single-listener correctness.
- No Directus Flow config (which is harder to check into git cleanly).

**Cons:**
- One Alembic migration (5–6 triggers) + ~80 LOC `signage_pg_listen.py` service + `lifespan` wiring.
- `pg_notify` 8000-byte cap → keep payloads small, resolution re-reads DB.
- Needs `WHEN (OLD IS DISTINCT FROM NEW)` discipline + column-level predicate on `signage_devices` so calibration updates (FastAPI-owned SSE) don't double-fire.

**Confidence:** HIGH (asyncpg native + 20-year-stable Postgres feature).

### Option B — Directus Flow → FastAPI Webhook (FEATURES.md + PITFALLS.md's pick)

**Mechanism:** Author 5–7 Directus Flows (one per mutating collection × event). Action trigger on `items.create/update/delete` POSTs to new FastAPI endpoint `POST /api/internal/signage/broadcast` (shared-secret header, localhost-bound). Handler resolves affected devices + computes etag + calls `notify_device()`. For updates/deletes needing pre-mutation values (schedule `old_playlist_id`, playlist-delete fanout), add Filter(Blocking) Flow with `Read Data` op before commit.

**Pros:**
- Directus-native tooling; Flow UI visible to ops.
- No new DB triggers; no Alembic migration for SSE plumbing.
- Same Flow mechanism can reshape FK errors if we take that route.

**Cons:**
- **Not writer-agnostic** — misses Alembic seed, direct psql, future non-Directus writers.
- 5–7 Flows to author/maintain. Flow-as-code story weaker than SQL-as-code (config in `directus_flows`/`directus_operations`, re-introduces snapshot fragility we rejected in v1.11).
- New internal HTTP surface + `SIGNAGE_INTERNAL_SECRET` to lock down.
- Pre-mutation read requires extra Flow step per collection.
- Failure mode: Flow POST fails (api OOM) → Directus commits, SSE never fires. Eventual-consistency vs Option A's DB-ordered delivery.

**Confidence:** MEDIUM-HIGH (documented pattern; exact pre-update payload shape needs Phase 1 spike).

### Recommendation for user

Both are viable, not equally good. **Option A is the stronger architectural pick:** (a) writer-agnostic future-proofs the "two-writers-today-N-tomorrow" shared-Postgres posture; (b) SQL triggers in Alembic are the same SSOT discipline used everywhere else; (c) one small migration + ~80 LOC is less surface than 5–7 Flows + internal webhook + shared secret + per-Flow pre-read; (d) calibration SSE stays end-to-end in FastAPI in both options, so Option A doesn't fight that boundary.

**Option B is the right choice only if** you want Flow tooling as the primary operator-facing story (Flows visible in Directus UI to non-developers), or specifically want to avoid Alembic-level DB triggers. PITFALLS.md + FEATURES.md lean B because it keeps Directus-side mechanics in Directus config — defensible preference, not architectural necessity.

**Explicit user call needed before roadmapping.** Choice changes Phase A deliverables, Phase C per-endpoint template, and rollback recipe per phase.

## Other Convergences (all 4 researchers agree)

1. Alembic is sole DDL owner for `public.*`; Directus writes metadata only.
2. `bootstrap-roles.sh` extended with per-collection Viewer permission rows + explicit `fields` allowlists mirroring Pydantic `*Read`.
3. Calibration PATCH stays in FastAPI (`Literal[0,90,180,270]` + per-device SSE; compute-shaped).
4. `PUT /playlists/{id}/items` bulk-replace stays in FastAPI (atomic DELETE+INSERT; Directus has no equivalent single-transaction bulk replace).
5. `DELETE /playlists/{id}` structured 409 `{detail, schedule_ids}` — keep in FastAPI (recommended) or Flow-reshape. **Scope decision.** Same question for `DELETE /tags/{id}`.
6. `GET /signage/analytics/devices` stays in FastAPI (composite aggregate Directus `aggregate` can't express).
7. `/data/employees` splits: row fetch → Directus `personio_employees`; overtime/total-hours roll-up → new FastAPI `/api/data/employees/overtime`. Frontend merges.
8. `me.py` deletes cleanly; frontend uses Directus SDK `readMe({fields:['id','email','first_name','last_name','role']})`. `directus_users` Viewer fields MUST be an explicit allowlist.
9. Frontend cache-key namespace split: new Directus hooks `["directus", <collection>, ...]`; legacy `signageKeys.*` stays independent. One-shot `queryClient.removeQueries` gated by localStorage flag on first post-deploy boot.
10. Phase A ships backend-only with zero user-visible change. Integration test: mutate a collection via Directus Data Model UI → Pi receives `playlist-changed` within 500ms. Frontend untouched.

## Stack Additions (Minimal)

Core stack unchanged.

| Addition | Why | Confidence |
|---|---|---|
| `@directus/sdk ^21.2.2` — **already present, no bump** | Composable `rest()`+`authentication()` drops into TanStack Query `queryFn`; cookie-mode works behind Caddy. | HIGH |
| `@directus/extensions-sdk 17.1.3` — build-time only, new `directus-extensions/` workspace | Compiles one hook `kpi-validation-hooks` for friendly rotation/enum errors + optional FK-RESTRICT 409 reshape. | HIGH |
| `@directus/errors` — runtime-provided by Directus 11 | `throw new InvalidPayloadError()` → 422/400. No install into image. | HIGH |
| `directus-schema-apply` compose service + `directus/snapshots/v1.22.yaml` (stripped of policies/roles/permissions) | Collection/field/relation metadata only; never DDL. | HIGH (MEDIUM on known issue #25760 "existing-table" edge; REST `POST /collections {schema:null}` is documented fallback) |
| **Do NOT add:** `directus-sync`, `@tanstack/query-directus` bridge, GraphQL codegen, second auth library, second ORM | Fragment SSOTs or duplicate built-in functionality. | HIGH |

**Option-A-only adds:** Alembic migration `v1_22_signage_notify_triggers.py` + `backend/app/services/signage_pg_listen.py` (~80 LOC) + `lifespan` wiring.
**Option-B-only adds:** `POST /api/internal/signage/broadcast` + `SIGNAGE_INTERNAL_SECRET` env + 5–7 Directus Flows.

## Permissions / Schema Ownership Model

**DDL ownership (non-negotiable):**

| Concern | Owner | Tool |
|---|---|---|
| Tables, columns, CHECK, FK, indexes, defaults | **Alembic** | migrations |
| Directus collection metadata (icon, interface, display) | **Directus snapshot** | `npx directus schema apply` — never UI schema edits |
| Roles, policies, access rows | **`bootstrap-roles.sh`** (existing) | GET-before-POST idempotent REST |
| Permission rows + `fields` allowlists | **`bootstrap-roles.sh`** (new section 4) | Same REST pattern, fixed UUIDs |

**Surfaced to Directus (v1.22):** `signage_devices`, `signage_playlists`, `signage_playlist_items`, `signage_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, `signage_media` (already Directus-native), `sales_records`, `personio_employees`.

**Stays excluded:** `alembic_version`, `upload_batches`, `app_settings`, `personio_attendance`, `personio_absences`, `personio_sync_meta`, `sensors`, `sensor_readings`, `sensor_poll_log`, `signage_pairing_sessions`, `signage_heartbeat_event`. CI guard asserts this set is superset of a hard-coded "never expose" allowlist.

**Viewer fields allowlists** mirror Pydantic `*Read` exactly. Example `signage_devices`: `["id","name","rotation","hdmi_mode","audio_enabled","created_at","paired_at","last_heartbeat_at"]` (omits `device_secret`). `directus_users`: `["id","email","first_name","last_name","role","avatar"]` (omits `tfa_secret`, `auth_data`, `external_identifier`).

**Admin/Viewer:** Administrator (built-in) bypasses permissions via `admin_access:true`. Viewer has read-only on `sales_records` + `personio_employees`; **no signage permissions at all** (preserves pre-v1.22 Admin-only signage behavior).

## Endpoint Verdict Roll-up

| Endpoint | Verdict | Phase | Notes |
|---|---|---|---|
| Tags CRUD | **MOVE** (delete 409 shape = scope slider) | C.1 | |
| Schedules CRUD | **MOVE** (needs SSE bridge; `start_hhmm<end_hhmm` via DB CHECK + hook error message) | C.3 | |
| Playlists GET/POST/PATCH | **MOVE** (needs SSE bridge) | C.4 | |
| `DELETE /playlists/{id}` | **KEEP IN FASTAPI** (recommended, preserves `{detail, schedule_ids}` 409) OR Flow+adapter reconstruct | Scope slider | |
| Playlists/{id}/items GET, PUT tags | **MOVE** | C.4 | |
| `PUT /playlists/{id}/items` bulk replace | **KEEP IN FASTAPI** (atomic; compute-shaped) | — | |
| `GET /signage/devices` list/detail | **HYBRID** — Directus serves rows; new FastAPI `GET /signage/resolved/{device_id}` for resolver; frontend merges | C.5 | |
| `PATCH /signage/devices/{id}` (name) | **MOVE** | C.5 | |
| `PATCH /signage/devices/{id}/calibration` | **KEEP IN FASTAPI** (Literal enum + per-device SSE) | — | |
| `DELETE /signage/devices/{id}`, `PUT .../tags` | **MOVE** (needs SSE bridge on device_tag_map) | C.5 | |
| `GET /signage/analytics/devices` | **KEEP IN FASTAPI** | — | |
| `GET /api/data/sales` | **MOVE** (accept broader `?search=` OR encode `filter[_or]`) | C.2 (scope slider) | |
| `GET /api/data/employees` | **SPLIT** — rows to Directus; `/overtime` roll-up new FastAPI | C.2 | |
| `GET /api/me` | **DELETE** (frontend uses SDK `readMe`) | B | |
| Media upload POST, pair/*, player/* stream, PPTX convert | **KEEP** | — | |

## Top Pitfalls (Ranked)

1. **Directus Data Model UI rewriting Alembic-owned schema** (P1, CRITICAL). Field-label edits can regenerate DDL and revert defaults/CHECKs. Prevention: operator discipline + CI `information_schema.columns` hash drift-check. Phase A.
2. **SSE fanout silent break** (P5, HIGH). The keystone decision above. No Phase C endpoint PR lands without matching bridge piece + SSE integration test.
3. **FK RESTRICT 409 shape divergence** (P4, HIGH). Frontend `PlaylistDeleteDialog` deep-links off `schedule_ids`. Prevention: keep DELETE in FastAPI (cheapest) OR Flow Filter(Blocking) Throw Error OR frontend adapter re-queries. Recommend keep-in-FastAPI.
4. **Viewer field-level leak** (P9 + P15, HIGH). Explicit `fields` allowlists per permission row; integration test per collection. Phase B.
5. **TanStack Query cache-key collision** (P7, HIGH). Namespace split (`["directus",...]` vs `signageKeys.*`); localStorage-gated one-shot cache bust; ESLint/grep guard. Phase D.

**Medium-severity noteworthy:** P8 `DB_EXCLUDE_TABLES` drift + `up -d` vs `restart` semantics; P10 filter/sort/pagination contract via `directusList<T>` adapter; P11 Alembic column-add freeze rule during v1.22; P12 per-phase rollback recipe (don't delete FastAPI routers until Phase E); P13 etag single-source discipline (bridge emits event+id only — FastAPI computes etag).

## Recommended Phase Sequence

Ordering principle: ship plumbing before any frontend port. Phase A proves bridge works with zero user-visible change.

- **Phase A — Schema bootstrap + SSE bridge + policy foundation** (backend only, no user-visible change). `directus-schema-apply` service, stripped snapshot YAML, extended `bootstrap-roles.sh`, SSE bridge per user decision, shrunk `DB_EXCLUDE_TABLES`, compose `depends_on` reorder. Acceptance: `docker compose down -v && up -d` reproduces v1.21 behavior; manual Directus UI edit fires SSE to Pi <500ms.
- **Phase B — Kill `me.py`** + `AuthContext` to SDK-only. Smallest surface. Tests `directus_users` Viewer field allowlist.
- **Phase C — Per-endpoint migration** (sub-phases): C.1 Tags → C.2 data.py (sales + /employees split) → C.3 Schedules → C.4 Playlists + items + tag_map → C.5 Devices + device_tag_map → C.6 Analytics review. Each sub-phase adapter-wraps `signageApi.ts`, ships matching SSE bridge piece (if not Phase-A blanket), regression-tests SSE, keeps FastAPI router in place for rollback.
- **Phase D — Frontend refactor.** Directus-backed hooks under `["directus", ...]`. `signageApi.ts` swaps to `directus.request()`. Contract-snapshot test per endpoint (old FastAPI response → adapter → diff empty).
- **Phase E — Cleanup.** Delete moved routers/schemas/tests. Final `DB_EXCLUDE_TABLES` audit + CI guard. Rollback verification test.

**Research flags:** Phase A spike needed only if Option B (Flow pre-update payload shape, Throw Error body shape). Phase C.1 light validation spike. Phase C.4 needs scope decision on DELETE 409 + verify Directus 11 nested-O2M atomic PATCH. Phase B/C.5/D — no new research (standard patterns).

## Open Spikes (before roadmap OR early Phase A)

1. **[BLOCKING] User picks SSE bridge Option A vs B.**
2. Directus `schema apply` against existing Alembic tables (known issue #25760) — REST `POST /collections {schema:null}` fallback path documented. Confirm in Phase A.
3. Directus Flow pre-update payload access (Option B only).
4. Directus 11 nested O2M atomic single-PATCH shape (Phase C.4).
5. FK RESTRICT 409 reshape decision (Phase C.4).
6. `/api/data/sales` search param scope (Phase C.2).
7. `signage_pairing_sessions` exposure (Phase A; default keep excluded).

## Sources

Full citations in `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` sources sections. Key external refs: Directus Schema API docs, Hooks/Flows guides, issue #25760, @directus/sdk + extensions-sdk on npm, asyncpg LISTEN docs. Repo files inspected: `docker-compose.yml`, `caddy/Caddyfile`, `directus/bootstrap-roles.sh`, `backend/app/security/directus_auth.py`, `backend/app/services/{signage_broadcast,signage_resolver}.py`, `backend/app/routers/signage_admin/*`, `backend/app/routers/{data,me}.py`, Alembic versions, `frontend/src/lib/*.ts`, `.planning/PROJECT.md`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack additions | HIGH | Versions verified against npm/Docker Hub; only 1 MEDIUM on schema-apply existing-table edge |
| Feature verdicts (move/keep/split) | HIGH | Per-endpoint walk-through with Directus capability match; 2 MEDIUM (nested O2M atomicity, Flow pre-update payload) |
| Architecture (schema+permissions+frontend seam) | HIGH | v1.11 bootstrap-roles precedent + known Directus 11 patterns |
| SSE bridge mechanism | MEDIUM | Both options viable; researchers disagree; user call needed |
| Pitfalls | HIGH | 18 mapped to phases with test coverage list |

**Overall: HIGH** with single MEDIUM-gated decision (SSE bridge).
