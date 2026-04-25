# Phase 70: MIG-SIGN — Devices - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate device-row CRUD (PATCH name, DELETE, PUT tags, GET list, GET by-id) from `backend/app/routers/signage_admin/devices.py` to Directus SDK on `signage_devices` + `signage_device_tag_map`. Keep `PATCH /api/signage/devices/{id}/calibration` in FastAPI unchanged (Literal[0,90,180,270] validation, fires `calibration-changed` SSE). Add a NEW FastAPI endpoint `GET /api/signage/resolved/{device_id}` that returns the schedule-resolved playlist for a single device; the admin Devices page renders Directus rows merged client-side with a per-device resolved query.

In scope:
- 5 routes in `devices.py` migrating to Directus: GET (list), GET-by-id, PATCH name, DELETE, PUT `/{id}/tags`
- 1 NEW FastAPI route: `GET /api/signage/resolved/{device_id}` (replaces the server-side `_attach_resolved_playlist` merge for the list/by-id surface)
- Frontend `signageApi.ts` swap for the migrated functions (signatures stable per D-00g)
- Frontend admin Devices list refactor: `useQueries` per-device for resolved playlist
- SSE regression coverage extending `tests/signage/test_pg_listen_sse.py`
- CI grep guard for migrated device routes
- Test triage on existing device unit tests + RBAC route catalog
- Admin Directus CRUD smoke for `signage_devices` + `signage_device_tag_map`

Out of scope (intentionally surviving in FastAPI):
- `PATCH /api/signage/devices/{id}/calibration` — Literal[0,90,180,270] validation + targeted `calibration-changed` SSE; v1.21 contract unchanged
- `_notify_device_self` helper — RETAINED in `devices.py`; while PUT-tags migrates, the helper itself is referenced by Phase 65 LISTEN bridge equivalents and is a candidate for shared factoring in Phase 71

Out of scope (deferred to assigned phases):
- Adapter seam structural refactor (Phase 71 FE-01)
- Contract-snapshot tests across all migrated endpoints (Phase 71 FE-04)
- Optimistic-update + rollback patterns (Phase 71 polish)
- Shared `replaceTagMap(collection, parentColumn, parentId, tagIds)` util factored from Phase 69 + Phase 70 (Phase 71 FE-01)

</domain>

<decisions>
## Implementation Decisions

### Architectural locks carried from earlier phases (not revisited)
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton (Phase 29/64; reused 66, 67, 68, 69).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer field allowlists on `signage_*` collections locked in Phase 65 (AUTHZ-04). Admin role is unrestricted (`admin_access: true`, confirmed by Phase 68 D-08 + Phase 69 D-09 smoke).
- **D-00d:** Phase 65 LISTEN bridge already wired for `signage_devices` (UPDATE WHEN-gated on name-only — calibration columns excluded), `signage_device_tag_map` (all rows fire `playlist-changed`). No new Alembic trigger work in this phase. Verified in `backend/alembic/versions/v1_22_signage_notify_triggers.py`.
- **D-00e:** `--workers 1` invariant + single asyncpg listener preserved (Phase 65 D-00c).
- **D-00f:** CI grep-guard pattern from Phase 66/67/68/69 is the template for the new guard added here.
- **D-00g:** Public function signatures in `frontend/src/signage/lib/signageApi.ts` remain stable; internals swap to Directus SDK (Phase 67 D-01 / Phase 68 D-07 / Phase 69 D-00g pattern).
- **D-00h:** Hand-maintained TS row types (`SignageDevice`, etc.) — no Directus schema codegen (Phase 67 D-02).
- **D-00i:** Canonical Directus client import path is `@/lib/directusClient` (Phase 68 Plan 04).
- **D-00j:** Surviving FastAPI route — `PATCH /api/signage/devices/{id}/calibration` is the only device write that stays in FastAPI per ROADMAP success criterion #2; CI guard MUST allow it.

### Hybrid resolved-playlist endpoint
- **D-01:** New FastAPI endpoint: `GET /api/signage/resolved/{device_id}` returns the same shape today's `_attach_resolved_playlist` populates on `SignageDeviceRead`: `{current_playlist_id: UUID|null, current_playlist_name: str|null, tag_ids: list[int]|null}`. Field names match the existing `SignageDeviceRead` extras at `backend/app/routers/signage_admin/devices.py:67-78` so client-side merge is `{...directusRow, ...resolvedResponse}` with zero rename.
- **D-01a:** The endpoint reuses the existing `resolve_playlist_for_device` service + the existing tag_ids select pattern. No new resolver logic — just lift the per-device branch of `_attach_resolved_playlist` into a dedicated route handler.
- **D-01b:** Mounted under a NEW router file (e.g., `backend/app/routers/signage_admin/resolved.py`) registered in `signage_admin/__init__.py` alongside existing routers — keeps the migrated `devices.py` shrinking toward calibration-only.
- **D-01c:** RBAC: route requires Admin (consistent with the rest of `signage_admin`); single-source admin gate inherited from package router (D-10 admin-package invariant).
- **D-01d:** 404 on unknown `device_id` (matches today's `_attach_resolved_playlist` precondition lookup).

### Devices list page merge strategy
- **D-02:** Frontend admin Devices list uses `useQueries` per-device:
  1. `useQuery(['directus', 'signage_devices'], () => directus.request(readItems('signage_devices', { fields: [...], sort: ['created_at'] })))` for the row list
  2. `useQueries({ queries: devices.map(d => ({ queryKey: ['fastapi', 'resolved', d.id], queryFn: () => apiClient<...>(`/api/signage/resolved/${d.id}`) })) })` for per-device resolved data
  3. `useMemo` merges Directus row + matching resolved response by `device_id` → `{...row, ...resolved}` with field names already aligned per D-01
- **D-02a:** Per-device cache key `['fastapi', 'resolved', deviceId]` aligns with SSE bridge: a `device-changed` or `playlist-changed` event for device X invalidates only that single key.
- **D-02b:** N parallel HTTP/2 requests on the resolved endpoint are acceptable for typical device counts (<20 in practice). No bulk endpoint added in this phase.
- **D-02c:** SSE invalidation: on receiving `playlist-changed` (resolver output may have changed) → invalidate `['fastapi', 'resolved', deviceId]` for the targeted device. On `device-changed` (row mutation via Directus or LISTEN bridge) → invalidate `['directus', 'signage_devices']` (list) + `['directus', 'signage_devices', deviceId]` + per-device resolved key.

### Tags PUT diff strategy
- **D-03:** `replaceDeviceTags(deviceId, tagIds)` performs an FE-driven diff via the Directus SDK — IDENTICAL pattern to Phase 69 D-02 (`replacePlaylistTags`):
  1. `readItems('signage_device_tag_map', { filter: { device_id: { _eq: deviceId } }, fields: ['id', 'tag_id'] })`
  2. Compute `toAdd = newIds - existingIds` and `toRemove = existingIds - newIds`
  3. `Promise.all([deleteItems('signage_device_tag_map', toRemoveMapRowIds), createItems('signage_device_tag_map', toAdd.map(tagId => ({ device_id, tag_id })))])`
- **D-03a:** Race tolerance: last-write-wins (single Admin user surface; Phase 69 D-02a parity).
- **D-03b:** SSE: each map-row insert/delete fires `playlist-changed` per Phase 65 trigger on `signage_device_tag_map`. Multi-event tolerance (test asserts at-least-once, not exactly-once — Phase 69 D-02b parity).
- **D-03c:** `_notify_device_self` (today's targeted per-device SSE on FastAPI PUT-tags) is REPLACED at the protocol level by the Phase 65 LISTEN bridge on `signage_device_tag_map` (writer-agnostic). The bridge fires `playlist-changed` for affected device IDs via the resolver tag → device fan-out (Phase 65 D-00d). The FE listener invalidates the per-device resolved cache key (D-02c) so the merged list refreshes. The helper itself stays in `devices.py` for the surviving calibration path's downstream consumers — see D-00d retention note.
- **D-03d:** Implementation primed for Phase 71 shared util factoring: write `replaceDeviceTags` so the diff loop is identical-shaped to `replacePlaylistTags` (collection name + parent FK column + parent id + new tag id list as the only varying inputs).

### Computed-field naming on Directus row
- **D-04:** Keep the existing field names `current_playlist_id` / `current_playlist_name` on `SignageDevice` TS row type. They are populated client-side after merge per D-02; no Directus collection field exists (and won't). Add a TSDoc comment on the type marking them "computed via `/api/signage/resolved/{id}`, not Directus-backed" so the source of truth is documented.
- **D-04a:** No rename to `resolved_*` — would ripple through every consumer (`DevicesPage`, device detail dialogs, badges) without functional benefit.

### Hybrid cache invalidation (full table)
- **D-05:** React Query keys are namespaced by writer surface (Phase 67 D-15 + Phase 69 D-03 pattern):
  - Reads via Directus: `['directus', 'signage_devices', { search? }]`, `['directus', 'signage_devices', deviceId]`, `['directus', 'signage_device_tag_map', { deviceId }]`
  - Reads via FastAPI: `['fastapi', 'resolved', deviceId]` for per-device resolved playlist
  - Surviving FastAPI calibration: keep current `signage_calibration` key (no read counterpart for the PATCH; player-side fetch unchanged)
- **D-05a:** Cross-invalidation rules:
  - After Directus PATCH device name → invalidate `['directus', 'signage_devices']` (list) + `['directus', 'signage_devices', id]`
  - After Directus PUT tags (FE diff) → invalidate `['directus', 'signage_device_tag_map', { deviceId: id }]` + `['fastapi', 'resolved', id]` (resolver output may flip)
  - After Directus DELETE → invalidate `['directus', 'signage_devices']` + remove `['fastapi', 'resolved', id]`
  - After FastAPI PATCH calibration → no list-level invalidation (calibration is per-device player concern; SSE `calibration-changed` handled by player, not admin list)
  - On SSE `playlist-changed` → invalidate `['fastapi', 'resolved', deviceId]` for affected devices (resolver fan-out matches today's player behavior)
- **D-05b:** Optimistic updates explicitly out of scope — Phase 71 polish.

### CI guard precision
- **D-06:** New CI step in `.github/workflows/ci.yml` immediately after the Phase 69 guard, blocking REINTRODUCTION of migrated FastAPI device routes while allowing surviving calibration PATCH. Method-anchored regex:
  - Block: `@router\.(get|patch|delete)\b[^@]*"/api/signage/devices/?\{?[^}]*\}?"?$` (root list + by-id GET, name PATCH, DELETE) — calibrated per Phase 69 D-04 lesson (scope to `devices.py` only to avoid false-positive on Phase 70 calibration PATCH which is on the same file but uses `/{id}/calibration` suffix)
  - Block: `@router\.put\b[^@]*"/api/signage/devices/\{[^}]+\}/tags"` (tags PUT)
  - Allow (do NOT match): `@router.patch` on `/{device_id}/calibration`
  - Allow (do NOT match): `@router.get` on `/api/signage/resolved/{device_id}` (NEW route, lives in resolved.py)
- **D-06a:** Run as a pre-stack step (no DB needed). Mirror existing Phase 67/68/69 guard step shape.
- **D-06b:** Guard scope: limit grep to `backend/app/routers/signage_admin/devices.py` only — same precision lesson as Phase 69 D-04 (scoping per-file avoids cross-file false positives).
- **D-06c:** `_notify_device_self` helper is INTENTIONALLY retained for surviving calibration path; do NOT add a guard against it.

### SSE expectations
- **D-07:** SSE regression cases extend `backend/tests/signage/test_pg_listen_sse.py` (Phase 65 + Phase 68 Plan 06 + Phase 69 Plan 04 pattern):
  - Directus `updateItem('signage_devices', id, {name})` → `device-changed` (or matching event from name-only WHEN-gated UPDATE trigger) within 500ms
  - Directus `deleteItem('signage_devices', id)` → corresponding event within 500ms
  - Directus tag-map diff (the D-03 path) → at least one `playlist-changed` event delivered
  - FastAPI calibration PATCH → `calibration-changed` SSE fires AND `signage_devices` LISTEN trigger does NOT fire (no double event) — regression assertion for v1_22 WHEN-gate
  - The `signage_devices` LISTEN trigger MUST NOT fire on calibration-only updates (success criterion #4)
- **D-07a:** Test latencies: <500 ms for name/delete events; <1000 ms for tag-map diff (Phase 69 Plan 04 parity).

### Test triage
- **D-08:** Existing tests under `backend/tests/signage/` that exercise the FastAPI device routes are triaged per-test by the planner:
  - Tests asserting business behavior of migrated routes (validation, RBAC, 404 shape) → port to Directus-SDK integration tests (admin smoke pattern, Phase 68 Plan 08 / Phase 69 Plan 06)
  - Tests duplicating Directus-side guarantees → delete
  - Tests for surviving calibration PATCH → keep unchanged
  - Tests for `_attach_resolved_playlist` server-side merge → port to test `GET /api/signage/resolved/{id}` directly
- **D-09:** `tests/test_rbac.py` READ_ROUTES updates: remove migrated paths (`GET /devices`, `GET /devices/{id}`) and add `GET /resolved/{id}` (Phase 68 D-10 / Phase 69 D-07 pattern).
- **D-10:** Comment refresh only in `tests/signage/test_permission_field_allowlists.py` (Phase 68 / Phase 69 D-08 pattern).

### Admin permission smoke
- **D-11:** Add Admin Directus CRUD smoke test for `signage_devices` + `signage_device_tag_map`, modeled on Phase 69 Plan 06's `test_admin_directus_crud_smoke.py` extension. Be aware of Phase 69 Plan 06's xfail pattern — if `signage_device_tag_map` is also a composite-PK collection that suffers the same Directus 11 metadata-registration gap, mark the smoke `xfail(strict=False)` and document for Phase 71 CLEAN.

### Claude's Discretion
- Exact Pydantic-to-TS field name parity check for `SignageDevice` row type (planner verifies hand-maintained types match Directus collection schema).
- Plan ordering: tentative wave plan = Wave 1 parallelizable (devices router migration, NEW resolved router, FE swap including `useQueries` merge); Wave 2 (SSE regression + CI guard + admin smoke + test triage). Planner finalizes.
- Whether `replaceDeviceTags` runs `Promise.all` vs sequentially (Phase 69 used parallel — recommend same for parity).
- Whether the new `resolved.py` router carries its own request log decorator or inherits from the package router.
- Whether to bundle "FE merge logic" into the same plan as the FE adapter swap or split into its own plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements
- `.planning/ROADMAP.md` §"Phase 70: MIG-SIGN — Devices" — goal + 4 success criteria
- `.planning/REQUIREMENTS.md` MIG-SIGN-04 — full text of device scope + surviving routes (calibration PATCH, new resolved endpoint)

### Prior CONTEXT.md (carried decisions)
- `.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md` — D-00 architectural locks; LISTEN trigger inventory; `signage_devices` UPDATE WHEN-gate
- `.planning/phases/66-kill-me-py/66-CONTEXT.md` — CI grep guard pattern
- `.planning/phases/67-migrate-data-py-sales-employees-split/67-CONTEXT.md` — D-01 stable-signature migration, D-02 hand-maintained TS, D-15 namespaced React Query keys + cross-invalidation
- `.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md` — D-08 admin_access bet (confirmed); D-09 SSE regression test pattern; Plan 04 directusClient import
- `.planning/phases/69-mig-sign-playlists/69-CONTEXT.md` — D-02 FE-driven tag diff pattern (REUSED here for D-03); D-04 method-anchored CI guard scoped per-file (REUSED for D-06); D-09 admin smoke pattern (REUSED for D-11)

### Code under migration
- `backend/app/routers/signage_admin/devices.py` — GET (list), GET-by-id, PATCH (name), DELETE, PUT `/{id}/tags` migrate; `PATCH /{id}/calibration` (line 122) STAYS; `_attach_resolved_playlist` helper at lines 62-79 is the source for D-01 endpoint shape; `_notify_device_self` helper at lines 29-51 stays
- `backend/app/routers/signage_admin/__init__.py` — register new `resolved` router
- `backend/app/services/signage_resolver.py` — `resolve_playlist_for_device`, `compute_playlist_etag` (reused by new `/resolved/{id}` route per D-01a)
- `backend/app/schemas/signage.py` — `SignageDeviceRead` shape source for D-01 (`current_playlist_id`, `current_playlist_name`, `tag_ids` extras)
- `backend/app/models/signage.py` — `SignageDevice`, `SignageDeviceTagMap` ORM models
- `frontend/src/signage/lib/signageApi.ts` — device functions to swap (signatures stable per D-00g); add `getResolvedForDevice(id)` for D-02
- `frontend/src/signage/admin/DevicesPage.tsx` (and any device detail/dialog files) — refactor to `useQueries` merge pattern per D-02

### LISTEN bridge (Phase 65 — already wired, regression test target)
- `backend/app/services/signage_pg_listen.py` — listener
- `backend/tests/signage/test_pg_listen_sse.py` — extend with device + tag-map regression cases per D-07
- `backend/alembic/versions/v1_22_signage_notify_triggers.py` — `signage_devices_update_notify` WHEN-gate confirms calibration-only updates do NOT fire (success criterion #4 infra-level)

### Test files affected
- `backend/tests/test_rbac.py` — READ_ROUTES updates per D-09 (remove migrated, add `/resolved/{id}`)
- `backend/tests/signage/test_permission_field_allowlists.py` — comment refresh per D-10
- `backend/tests/signage/` (any `test_signage_device*.py`, `test_signage_devices_admin*.py`, `test_resolver*.py`) — D-08 triage targets
- `backend/tests/signage/test_admin_directus_crud_smoke.py` (Phase 69 Plan 06) — extend with device + device_tag_map cases per D-11

### Directus surface
- `directus/snapshots/v1.22.yaml` — `signage_devices`, `signage_device_tag_map` collection definitions
- `directus/bootstrap-roles.sh` §5 — Viewer permissions (Phase 65; not modified by this phase per D-00c + D-11)

### CI
- `.github/workflows/ci.yml` — target for new method-anchored grep guard step per D-06 (model on existing Phase 67/68/69 guard steps)

### Calibration (surviving FastAPI surface — DO NOT touch)
- `backend/app/schemas/signage.py` `SignageCalibrationUpdate` (Literal[0,90,180,270] validator)
- `backend/app/services/signage_broadcast.py` — `notify_device` for `calibration-changed` SSE
- v1.21 phase artifacts under `.planning/phases/62-*` for the calibration contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apiClient.ts` Directus singleton via `@/lib/directusClient` — pattern from Phase 64; reused in Phases 66, 67, 68, 69
- `signageApi.ts` adapter seam (Phases 68 + 69 already swapped tags/schedules/playlists functions) — proven pattern; device functions get the same treatment
- `_attach_resolved_playlist` helper in `devices.py:62-79` — the server-side merge being replaced; its body is the template for the new `/resolved/{id}` route handler
- `resolve_playlist_for_device` + `compute_playlist_etag` services — reused by D-01 endpoint, no changes
- `tests/signage/test_pg_listen_sse.py` SSE regression harness (Phase 65 + Phase 68 + Phase 69) — direct extension target for D-07
- `tests/signage/test_admin_directus_crud_smoke.py` (Phase 69 Plan 06) — direct extension target for D-11
- `useQueries` pattern from TanStack Query — already a project dependency (per CLAUDE.md @tanstack/react-query 5.97.0)

### Established Patterns
- Phase 67 D-15 / Phase 69 D-03: namespaced React Query keys `['directus', collection, params?]` and `['fastapi', surface, params?]`; surviving FastAPI keys kept distinct so cross-invalidation is explicit
- Phase 68 D-07 / Phase 69 D-00g: inline-swap `signageApi.ts`, signatures stable, internals only — consumers untouched
- Phase 65 SSE-01: any row insert/update/delete on a triggered table fires the matching SSE event via the listener; bridge is writer-agnostic
- Phase 65 v1_22 trigger: `signage_devices` UPDATE is WHEN-gated on name-only — calibration columns excluded; success criterion #4 is infra-level invariant
- Phase 69 D-04 / Plan 05 lesson: scope CI grep guards per-file, not per-directory, to avoid cross-file false positives (relevant since calibration PATCH lives in the same `devices.py` as migrated routes)
- Phase 69 Plan 06 lesson: composite-PK Directus collections may xfail admin REST CRUD smoke due to v1.22 metadata-registration gap — applies to `signage_device_tag_map` if it has the same composite-PK shape

### Integration Points
- `frontend/src/signage/lib/signageApi.ts` — single seam for device FE swap + new `getResolvedForDevice` function
- `frontend/src/signage/admin/DevicesPage.tsx` — the consumer that needs the `useQueries` merge (only consumer touched per D-04 keep-current-naming)
- `backend/app/routers/signage_admin/__init__.py` — register new `resolved` router alongside existing routers
- `.github/workflows/ci.yml` — append the method-anchored guard immediately after the Phase 69 guard

</code_context>

<specifics>
## Specific Ideas

- The `replaceDeviceTags` function (D-03) and Phase 69's `replacePlaylistTags` should have visually identical structure so the Phase 71 shared util refactor is mechanical (only the collection name + parent FK column + parent id + new tag list vary between the two).
- The `useQueries` merge in `DevicesPage` is the project's first use of `useQueries` for cross-source merging — planner should add a brief inline comment block explaining the merge contract (Directus row + per-device FastAPI resolved → merged shape preserves `current_playlist_*` field names).
- New `resolved.py` router file is small (one route) but creating it as a separate module rather than bolting onto `devices.py` keeps the migrated `devices.py` shrinking toward calibration-only — clean for Phase 71 CLEAN dead-code deletion.
- `_notify_device_self` is referenced only by surviving calibration logic post-phase; the helper can be inlined or kept — planner's call. Phase 71 CLEAN may consolidate.

</specifics>

<deferred>
## Deferred Ideas

- Optimistic update + rollback for tag-map writes — Phase 71 polish
- Bulk `GET /api/signage/resolved?device_ids=...` endpoint — only justified if device count grows past ~50; not in this phase
- Renaming `current_playlist_*` to `resolved_*` — cosmetic, deferred (or never, per D-04a)
- Consolidating `_notify_device_self` / `_notify_playlist_changed` into a shared service — Phase 71 CLEAN
- Shared `replaceTagMap(collection, parentColumn, parentId, tagIds)` util factored from Phase 69 + Phase 70 implementations — Phase 71 FE-01
- Contract-snapshot tests per migrated endpoint — Phase 71 FE-04

</deferred>

---

*Phase: 70-mig-sign-devices*
*Context gathered: 2026-04-25*
