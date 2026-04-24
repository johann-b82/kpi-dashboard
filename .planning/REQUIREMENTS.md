# Requirements: v1.22 Backend Consolidation — Directus-First CRUD

**Milestone:** v1.22
**Status:** Defining
**Created:** 2026-04-24

**Core Value:** Eliminate ~25 pure-CRUD FastAPI endpoints by moving the signage admin surface, sales/employee row lookups, and auth-identity into Directus 11 collections. Leave FastAPI focused on compute (parsing, aggregation, SSE, SNMP, PPTX, pairing JWT, Personio sync). Drop duplication; keep guarantees.

**Guiding principle:** Directus = shape. FastAPI = compute.

**Locked architectural decisions (2026-04-24, post-research):**
- **DDL ownership:** Alembic remains sole owner of `public.*` tables. Directus owns metadata rows only (`directus_collections/fields/relations/permissions`).
- **Schema exposure:** Directus snapshot YAML applied via `directus-schema-apply` compose service (stripped of policies/roles) + REST fallback path for issue [#25760](https://github.com/directus/directus/issues/25760).
- **Permissions:** `directus/bootstrap-roles.sh` extended with per-collection Viewer permission rows + explicit `fields` allowlists mirroring Pydantic `*Read` schemas. Admin = built-in `admin_access:true`. Viewer = read-only on `sales_records` + `personio_employees`; **no signage permissions** (preserves pre-v1.22 Admin-only signage).
- **SSE bridge (Option A, decided 2026-04-24):** Postgres `LISTEN/NOTIFY` via Alembic-owned triggers on `signage_{playlists, playlist_items, playlist_tag_map, device_tag_map, schedules, devices}`. FastAPI `lifespan` hosts asyncpg `add_listener` long-lived connection. Trigger on `signage_devices` predicated on `OLD.name IS DISTINCT FROM NEW.name OR ... tag_ids` — calibration columns **excluded** to avoid double-fire against existing FastAPI calibration SSE.
- **Calibration PATCH stays in FastAPI** — `Literal[0,90,180,270]` + existing per-device SSE; compute-shaped.
- **Bulk-replace `PUT /playlists/{id}/items` stays in FastAPI** — atomic DELETE+INSERT; compute-shaped.
- **`DELETE /playlists/{id}` stays in FastAPI** — preserves structured 409 `{detail, schedule_ids}` that frontend `PlaylistDeleteDialog` deep-links off.
- **`GET /signage/analytics/devices` stays in FastAPI** — bucketed uptime aggregate Directus `aggregate` can't express.
- **`GET /signage/devices` is hybrid** — Directus serves rows; resolver exposed via a small new FastAPI endpoint.

**Out of scope (deliberate):**
- Settings rewrite (custom oklch/hex validators + SVG sanitization + ETag + logo BYTEA — not worth churn).
- Uploads metadata GET/DELETE, sensors CRUD, signage media upload, signage pair, signage player SSE — all stay in FastAPI.
- APScheduler jobs (Personio sync, sensor poll) — stay in FastAPI.
- `signage_pairing_sessions` Directus exposure — stays internal / FastAPI-only.
- CAL-PI-07 Pi hardware-timing diagnostic (v1.21 carry-forward) — remains a `/gsd:quick` candidate.

---

## Categories

- **SCHEMA** — Directus metadata + schema bootstrap + Alembic/Directus boundary
- **AUTHZ** — Permission rows + role policies + field allowlists
- **SSE** — Postgres LISTEN/NOTIFY bridge
- **MIG-AUTH** — `me.py` deletion + AuthContext migration
- **MIG-DATA** — `data.py` sales + employees split
- **MIG-SIGN** — signage_admin endpoint migrations (tags, schedules, playlists/items, devices)
- **FE** — frontend adapter seam + cache namespace + contract-snapshot tests
- **CLEAN** — dead code removal, rollback verification, CI guards

---

## v1.22 Requirements

### SCHEMA — Directus metadata + Alembic ownership boundary

- [x] **SCHEMA-01**: Operator can apply a git-checked Directus snapshot YAML that registers the v1.22 collections (`signage_devices`, `signage_playlists`, `signage_playlist_items`, `signage_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, `sales_records`, `personio_employees`) as Directus metadata — never as DDL.
- [x] **SCHEMA-02**: `docker compose up -d` on a fresh volume reproduces all v1.22 Directus collections idempotently via a `directus-schema-apply` compose service that runs after `directus` is healthy and before `directus-bootstrap-roles`.
- [x] **SCHEMA-03**: A CI guard compares `information_schema.columns` hash against a fixture + asserts `directus schema snapshot` produces zero diff against the committed YAML — any drift fails CI.
- [x] **SCHEMA-04**: `DB_EXCLUDE_TABLES` is shrunk to the correct minimal set (admin/Personio raw/sensors/pairing/heartbeat) and a CI guard asserts it is a superset of a hard-coded "never expose" allowlist.
- [x] **SCHEMA-05**: Operators receive a documented "never edit the Data Model UI" rule in `docs/operator-runbook.md`; violation is detected by SCHEMA-03.

### AUTHZ — Policies + per-collection permission rows

- [x] **AUTHZ-01**: `directus/bootstrap-roles.sh` creates per-collection Viewer permission rows with explicit `fields` allowlists for `sales_records` and `personio_employees` — no field star-imports.
- [x] **AUTHZ-02**: Viewer has no permission rows on any `signage_*` collection — matching pre-v1.22 Admin-only signage access.
- [x] **AUTHZ-03**: `directus_users` has a Viewer permission row with an explicit fields allowlist (id, email, first_name, last_name, role, avatar) — `tfa_secret`, `auth_data`, `external_identifier` never exposed.
- [x] **AUTHZ-04**: Bootstrap script is idempotent (GET-before-POST) on every re-run and commits fixed UUIDs for each permission row.
- [x] **AUTHZ-05**: An integration test per collection asserts a Viewer JWT cannot read excluded fields and cannot mutate any `signage_*` collection.

### SSE — Postgres LISTEN/NOTIFY bridge (Option A)

- [x] **SSE-01**: An Alembic migration creates AFTER-INSERT/UPDATE/DELETE triggers on `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_device_tag_map`, `signage_schedules`, and `signage_devices` (the last gated on `OLD.name IS DISTINCT FROM NEW.name OR OLD.tags IS DISTINCT FROM NEW.tags` so calibration updates never double-fire).
- [x] **SSE-02**: Each trigger calls `pg_notify('signage_change', '{"table":..., "op":..., "id":...}')` with payload under 8000 bytes.
- [x] **SSE-03**: FastAPI `lifespan` starts a long-lived asyncpg connection with `add_listener('signage_change', …)` that resolves affected devices using the existing `devices_affected_by_playlist` resolver and calls existing `notify_device()`.
- [x] **SSE-04**: Mutating a collection directly via Directus Data Model UI fires `playlist-changed` / `device-changed` / `schedule-changed` SSE to connected Pi players within 500 ms (integration test).
- [x] **SSE-05**: The `--workers 1` invariant is preserved (single listener). CI guard references this invariant.
- [x] **SSE-06**: Listener auto-reconnects on connection loss; log warning on each reconnect (manual restart of Postgres verifies).

### MIG-AUTH — `me.py` deletion

- [x] **MIG-AUTH-01**: Frontend `AuthContext` reads current user via Directus SDK `readMe({fields:[...]})` — no `/api/me` call.
- [x] **MIG-AUTH-02**: `backend/app/routers/me.py` and its registration in `main.py` + schemas + tests are deleted.
- [x] **MIG-AUTH-03**: All frontend call sites of the old `fetchMe` are migrated or deleted; a CI guard greps for `"/api/me"` and fails.

### MIG-DATA — `data.py` sales + employees split

- [ ] **MIG-DATA-01**: Frontend `/sales` table consumes `sales_records` via Directus SDK (`readItems` + `?filter[order_date]`) — old `GET /api/data/sales` removed.
- [ ] **MIG-DATA-02**: Frontend `/hr` employees table row-data comes from Directus `personio_employees` — old row-data portion of `GET /api/data/employees` removed.
- [ ] **MIG-DATA-03**: A new FastAPI endpoint `GET /api/data/employees/overtime` computes total-hours / overtime roll-up per employee over `?date_from/?date_to` — frontend merges Directus rows with this compute response.
- [ ] **MIG-DATA-04**: `data.py` is deleted (or reduced to the overtime endpoint); router registration updated; tests migrated or removed.

### MIG-SIGN — signage_admin migrations (sub-phased)

- [ ] **MIG-SIGN-01 (Tags)**: `signage_tags` CRUD moves to Directus; `DELETE /api/signage/tags/{id}` FastAPI route removed; frontend `useTags` hook swapped to Directus SDK; SSE `tag_map` bridge verified.
- [ ] **MIG-SIGN-02 (Schedules)**: `signage_schedules` CRUD moves to Directus; `start_hhmm < end_hhmm` enforced via Alembic CHECK + Directus validation hook for friendly error; SSE `schedule-changed` bridge verified; FastAPI router removed.
- [ ] **MIG-SIGN-03 (Playlists + items GET/PUT tags)**: `signage_playlists` GET/POST/PATCH and `playlist_items` GET + `playlists/{id}/tags` PUT move to Directus. `DELETE /playlists/{id}` and bulk `PUT /playlists/{id}/items` **stay in FastAPI** per scope decision. SSE `playlist-changed` bridge verified.
- [ ] **MIG-SIGN-04 (Devices name/tags/delete)**: `signage_devices` PATCH name + DELETE + PUT tags move to Directus. Calibration PATCH **stays in FastAPI**. List endpoint hybrid: Directus serves rows; a new FastAPI `GET /api/signage/resolved/{device_id}` returns the schedule-resolved playlist; frontend merges. SSE `device-changed` / `tag_map` bridges verified.

### FE — Frontend adapter seam

- [ ] **FE-01**: `signageApi.ts` adapter functions wrap Directus SDK calls and return the same response shape existing TanStack Query consumers expect — zero churn in consuming components.
- [ ] **FE-02**: New cache-key namespace `["directus", <collection>, ...]` is introduced; legacy `signageKeys.*` stays independent (not reused).
- [ ] **FE-03**: A one-shot `queryClient.removeQueries({queryKey:["signage"]})` gated by a localStorage flag runs on first post-deploy boot to purge stale cached `/api/signage/*` responses.
- [ ] **FE-04**: `DirectusError` is normalized inside the adapter to the existing `Error(detail)` / `ApiErrorWithBody` contract; FK 409 reshape done in adapter for any Directus-served delete (if scope slider selects Directus-served DELETE).
- [ ] **FE-05**: A contract-snapshot test per migrated endpoint asserts old FastAPI response shape === new adapter-wrapped Directus response (diff empty).

### CLEAN — Cleanup + rollback verification + CI guards

- [ ] **CLEAN-01**: All FastAPI routers / schemas / tests for moved endpoints are deleted; no orphaned imports.
- [ ] **CLEAN-02**: `main.py` router registrations for deleted routers are removed; `/api/*` smoke test confirms the expected surface shrinks.
- [ ] **CLEAN-03**: Git-revert-from-clean rollback E2E: checking out the commit before MIG-SIGN-01 reproduces v1.21 behavior on a fresh `docker compose down -v && up -d` (manual test checklist in `docs/operator-runbook.md`).
- [ ] **CLEAN-04**: CI guards: (a) `/api/me` grep in `frontend/src/`, (b) `GET /api/data/sales` + `/api/data/employees` grep in backend code, (c) `DB_EXCLUDE_TABLES` superset check, (d) SSE `--workers 1` invariant comment preserved.
- [ ] **CLEAN-05**: `README.md` + `docs/architecture.md` (or equivalent) updated to reflect the new Directus/FastAPI boundary with the decision recorded.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SCHEMA-01 | Phase 65 | Complete |
| SCHEMA-02 | Phase 65 | Complete |
| SCHEMA-03 | Phase 65 | Complete |
| SCHEMA-04 | Phase 65 | Complete |
| SCHEMA-05 | Phase 65 | Complete |
| AUTHZ-01 | Phase 65 | Complete |
| AUTHZ-02 | Phase 65 | Complete |
| AUTHZ-03 | Phase 65 | Complete |
| AUTHZ-04 | Phase 65 | Complete |
| AUTHZ-05 | Phase 65 | Complete |
| SSE-01 | Phase 65 | Complete |
| SSE-02 | Phase 65 | Complete |
| SSE-03 | Phase 65 | Complete |
| SSE-04 | Phase 65 | Complete |
| SSE-05 | Phase 65 | Complete |
| SSE-06 | Phase 65 | Complete |
| MIG-AUTH-01 | Phase 66 | Complete |
| MIG-AUTH-02 | Phase 66 | Complete |
| MIG-AUTH-03 | Phase 66 | Complete |
| MIG-DATA-01 | Phase 67 | Pending |
| MIG-DATA-02 | Phase 67 | Pending |
| MIG-DATA-03 | Phase 67 | Pending |
| MIG-DATA-04 | Phase 67 | Pending |
| MIG-SIGN-01 | Phase 68 | Pending |
| MIG-SIGN-02 | Phase 68 | Pending |
| MIG-SIGN-03 | Phase 69 | Pending |
| MIG-SIGN-04 | Phase 70 | Pending |
| FE-01 | Phase 71 | Pending |
| FE-02 | Phase 71 | Pending |
| FE-03 | Phase 71 | Pending |
| FE-04 | Phase 71 | Pending |
| FE-05 | Phase 71 | Pending |
| CLEAN-01 | Phase 71 | Pending |
| CLEAN-02 | Phase 71 | Pending |
| CLEAN-03 | Phase 71 | Pending |
| CLEAN-04 | Phase 71 | Pending |
| CLEAN-05 | Phase 71 | Pending |

---

## Future Requirements (deferred)

- **Settings rewrite to Directus** — reopen when oklch/hex validators + SVG sanitization can be ported as Directus hooks without losing guarantees.
- **Analytics to Directus** — defer until Directus `aggregate` supports windowed uptime-%; may never be feasible.
- **`signage_pairing_sessions` as read-only Directus collection** — ops-debugging convenience only; not needed now.

## Out of Scope (v1.22)

| Item | Reason |
|------|--------|
| Settings rewrite | oklch/hex + SVG sanitization + ETag + logo BYTEA too custom; low ROI |
| Uploads metadata GET/DELETE move | Few endpoints, keeps upload path coherent in FastAPI |
| Sensors CRUD move | Few endpoints; SNMP compute already in FastAPI |
| Signage media CRUD move | Upload + PPTX conversion keep file lifecycle coherent in FastAPI |
| APScheduler → Directus Flows | Python tooling stronger; Fernet creds + retry logic in place |
| `/api/data/sales` search semantics broadening | Keep current narrow filter contract |
| DELETE /playlists 409 reshape to Directus | Preserve `{detail, schedule_ids}` frontend contract |
| CAL-PI-07 Pi hardware-timing walkthrough | Carry-forward from v1.21; independent `/gsd:quick` when Pi diagnostic lands |
