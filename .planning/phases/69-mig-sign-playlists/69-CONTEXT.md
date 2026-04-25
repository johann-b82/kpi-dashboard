# Phase 69: MIG-SIGN — Playlists - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate playlist-metadata CRUD + items GET + tags-replace PUT from FastAPI routers (`backend/app/routers/signage_admin/playlists.py`, `playlist_items.py`) to Directus SDK. Keep `DELETE /api/signage/playlists/{id}` and bulk `PUT /api/signage/playlists/{id}/items` in FastAPI unchanged — they preserve a structured `409 {detail, schedule_ids}` shape and an atomic DELETE+INSERT transaction respectively. Verify the Phase-65 LISTEN/NOTIFY bridge fires `playlist-changed` SSE for writes from both sides.

In scope:
- 4 routes in `playlists.py` migrating to Directus: POST, GET (list), GET-by-id, PATCH
- 1 route in `playlists.py` migrating: PUT `/{id}/tags` (writes `signage_playlist_tag_map`)
- 1 route in `playlist_items.py` migrating: GET `/{id}/items`
- Frontend `signageApi.ts` swap for the migrated functions (signatures stable per D-00g)
- SSE regression coverage extending `tests/signage/test_pg_listen_sse.py`
- CI grep guard for migrated routes
- Test triage on existing playlist + playlist_items unit tests
- Comment refresh in `tests/test_rbac.py` and `tests/signage/test_permission_field_allowlists.py`

Out of scope (intentionally surviving in FastAPI):
- `DELETE /api/signage/playlists/{id}` — preserves 409 schedule_ids deep-link consumed by `PlaylistDeleteDialog`
- `PUT /api/signage/playlists/{id}/items` — atomic bulk DELETE+INSERT, kept for transactional guarantees
- `_notify_playlist_changed` helper — RETAINED in both files; surviving routes still need explicit fan-out alongside the LISTEN bridge

Out of scope (deferred to assigned phases):
- Device CRUD migration (Phase 70)
- Adapter seam structural refactor (Phase 71 FE-01)
- Contract-snapshot tests across all migrated endpoints (Phase 71 FE-04)
- Optimistic-update + rollback patterns (Phase 71 polish)

</domain>

<decisions>
## Implementation Decisions

### Architectural locks carried from earlier phases (not revisited)
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton (Phase 29/64; reused 66, 67, 68).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer field allowlists on `signage_*` collections locked in Phase 65 (AUTHZ-04). Viewer cannot mutate any `signage_*` collection — Admin role is unrestricted (`admin_access: true`, confirmed by Phase 68 D-08 smoke).
- **D-00d:** Phase 65 LISTEN bridge already wired for `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map` (all fire `playlist-changed`). No new Alembic trigger work in this phase.
- **D-00e:** `--workers 1` invariant + single asyncpg listener preserved (Phase 65 D-00c).
- **D-00f:** CI grep-guard pattern from Phase 66/67/68 is the template for the new guard added here.
- **D-00g:** Public function signatures in `frontend/src/signage/lib/signageApi.ts` remain stable; internals swap to Directus SDK (Phase 67 D-01 / Phase 68 D-07 pattern).
- **D-00h:** Hand-maintained TS row types (`SignagePlaylist`, `SignagePlaylistItem`) — no Directus schema codegen (Phase 67 D-02).
- **D-00i:** Canonical Directus client import path is `@/lib/directusClient` (Phase 68 Plan 04 verification — not `@/lib/directus`).

### Items GET shape
- **D-01:** `listPlaylistItems(playlistId)` calls `directus.request(readItems('signage_playlist_items', { filter: { playlist_id: { _eq: playlistId } }, sort: ['position'], fields: [...] }))`. The fields allowlist mirrors `SignagePlaylistItemRead` 1:1: `id`, `playlist_id`, `media_id`, `position`, `duration_s`, `transition`, `created_at`, `updated_at`. This keeps response shape identical to today's FastAPI route, which means surviving bulk `PUT /items` still returns the same TS shape — no FE divergence.
- **D-01a:** Sort by `position` ascending is part of the contract (FE renders items in playback order). Don't drop the `sort` parameter.

### Tags PUT diff strategy
- **D-02:** `replacePlaylistTags(playlistId, tagIds)` performs an FE-driven diff via the Directus SDK:
  1. `readItems('signage_playlist_tag_map', { filter: { playlist_id: { _eq: playlistId } }, fields: ['id', 'tag_id'] })`
  2. Compute `toAdd = newIds - existingIds` and `toRemove = existingIds - newIds`
  3. Fire `deleteItems('signage_playlist_tag_map', toRemoveMapRowIds)` and `createItems('signage_playlist_tag_map', toAdd.map(tagId => ({ playlist_id, tag_id })))` in parallel via `Promise.all`
- **D-02a:** Race tolerance: last-write-wins is acceptable for admin tag editing (single Admin user surface; concurrent edits are rare). No locking required.
- **D-02b:** SSE: each map-row insert/delete fires `playlist-changed` per Phase 65 trigger on `signage_playlist_tag_map`. A multi-row replace therefore produces multiple events; SSE regression test must accept this (do not assert exactly-once).

### Hybrid cache invalidation
- **D-03:** React Query keys are namespaced by writer surface (Phase 67 D-15 pattern):
  - Reads: `['directus', 'signage_playlists', { search? }]`, `['directus', 'signage_playlists', playlistId]`, `['directus', 'signage_playlist_items', { playlistId }]`, `['directus', 'signage_playlist_tag_map', { playlistId }]`
  - Surviving FastAPI: keep current keys for any FastAPI-only data (DELETE has no read counterpart; bulk-PUT items returns the new list)
- **D-03a:** Cross-invalidation rules:
  - After Directus PATCH playlist metadata → invalidate `['directus', 'signage_playlists']` (list) + `['directus', 'signage_playlists', id]`
  - After Directus PUT tags (FE diff) → invalidate `['directus', 'signage_playlist_tag_map', { playlistId: id }]` + `['directus', 'signage_playlists', id]` if playlist row exposes tags
  - After FastAPI DELETE → invalidate `['directus', 'signage_playlists']` (list)
  - After FastAPI bulk-PUT items → invalidate `['directus', 'signage_playlist_items', { playlistId: id }]`
- **D-03b:** Optimistic updates explicitly out of scope — Phase 71 polish.

### CI guard precision
- **D-04:** New CI step in `.github/workflows/ci.yml` immediately after the Phase 68 guard, blocking REINTRODUCTION of migrated FastAPI routes while allowing surviving DELETE + bulk-PUT items. Method-anchored regex:
  - Block: `@router\.(post|get|patch)\b[^@]*"/api/signage/playlists"` (root path POST/GET/PATCH)
  - Block: `@router\.(get|patch)\b[^@]*"/api/signage/playlists/\{[^}]+\}"` (by-id GET/PATCH)
  - Block: `@router\.put\b[^@]*"/api/signage/playlists/\{[^}]+\}/tags"` (tags PUT)
  - Allow (do NOT match): `@router.delete` on `/playlists/{id}` and `@router.put` on `/playlists/{id}/items`
- **D-04a:** Run as a pre-stack step (no DB needed) under `backend/app/`. Mirror the existing Phase 67/68 guard step shape so CI structure stays uniform.
- **D-04b:** `_notify_playlist_changed` helper is INTENTIONALLY retained (used by surviving DELETE + bulk-PUT items). Do NOT add a guard against it.

### Schedule fan-out / SSE expectations
- **D-05:** SSE regression cases extend `backend/tests/signage/test_pg_listen_sse.py` (Phase 65 + Phase 68 Plan 06 pattern):
  - Directus `createItem('signage_playlists', ...)` → `playlist-changed` to a connected device within 500ms
  - Directus `updateItem('signage_playlists', id, {name})` → `playlist-changed` within 500ms
  - Directus `deleteItems('signage_playlist_tag_map', [...])` + `createItems('signage_playlist_tag_map', [...])` (the diff path from D-02) → at least one `playlist-changed` event delivered (do not assert exactly-once)
  - FastAPI bulk-PUT items still fires `playlist-changed` (already covered by Phase 65 — confirm regression-only assertion remains green)
  - FastAPI DELETE still fires `playlist-changed` (regression-only assertion)
- **D-05a:** `_notify_playlist_changed` continues to be invoked from the surviving FastAPI routes; explicit fan-out path is preserved alongside the LISTEN bridge. Both paths producing the event is acceptable (test asserts at-least-once; bridge events are deduplicated by FE per existing pattern).

### Test triage
- **D-06:** Existing tests under `backend/tests/signage/` that exercise the FastAPI playlist or playlist_items routes are triaged per-test by the planner:
  - Tests asserting business behavior of migrated routes (validation, RBAC) → port to Directus-SDK integration tests (Admin smoke pattern, Phase 68 Plan 08)
  - Tests duplicating Directus-side guarantees (e.g., 404 on missing id) → delete
  - Tests for surviving DELETE + bulk-PUT items → keep unchanged
- **D-07:** `tests/test_rbac.py` READ_ROUTES updates: remove the migrated paths (`GET /playlists`, `GET /playlists/{id}`, `GET /playlists/{id}/items`) from the FastAPI route catalog (Phase 68 D-10 pattern).
- **D-08:** Comment refresh only in `tests/signage/test_permission_field_allowlists.py` (Phase 68 Plan 08 pattern).

### Admin permission smoke
- **D-09:** Add Admin Directus CRUD smoke test for `signage_playlists` + `signage_playlist_tag_map`, modeled on Phase 68's `test_admin_directus_crud_smoke.py`. The D-08 admin_access bet was already confirmed in Phase 68 — this smoke is regression coverage for the new collections.

### Claude's Discretion
- Exact Pydantic-to-TS field name parity check for `SignagePlaylist` and `SignagePlaylistItem` row types (planner verifies hand-maintained types match Directus collection schema).
- Plan ordering: Wave 1 = parallelizable (playlists router migration, items router migration, FE swap). Wave 2 = SSE regression + CI guard + admin smoke. Planner finalizes.
- Whether to split the FE swap into one plan or two (playlists fns + items fn + tags fn could co-locate or split per file). Planner decides based on diff size.
- Whether `replacePlaylistTags` runs the SDK delete and create concurrently via `Promise.all` or sequentially (concurrent is recommended for latency; sequential is safer if Directus permission policy needs strict ordering — verify in plan).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements
- `.planning/ROADMAP.md` §"Phase 69: MIG-SIGN — Playlists" — goal + 3 success criteria
- `.planning/REQUIREMENTS.md` MIG-SIGN-03 — full text of playlist scope + surviving routes

### Prior CONTEXT.md (carried decisions)
- `.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md` — D-00 architectural locks; LISTEN trigger inventory (signage_playlists, signage_playlist_items, signage_playlist_tag_map all wired)
- `.planning/phases/66-kill-me-py/66-CONTEXT.md` — CI grep guard pattern
- `.planning/phases/67-migrate-data-py-sales-employees-split/67-CONTEXT.md` — D-01 stable-signature migration pattern, D-02 hand-maintained TS types, D-15 namespaced React Query keys + cross-invalidation
- `.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md` — D-00a–h architectural locks, D-08 admin_access bet (confirmed), D-09 SSE regression test pattern, Plan 04 directusClient import path

### Code under migration
- `backend/app/routers/signage_admin/playlists.py` — POST/GET/GET-by-id/PATCH (migrate), DELETE (stay), PUT `/{id}/tags` (migrate); `_notify_playlist_changed` helper at line 39 (RETAIN for surviving routes)
- `backend/app/routers/signage_admin/playlist_items.py` — GET `/{id}/items` (migrate), bulk PUT `/{id}/items` (stay); `_notify_playlist_changed` helper at line 28 (RETAIN)
- `backend/app/routers/signage_admin/__init__.py` — router registration (lines 11, 20–21)
- `backend/app/schemas/signage.py` — `SignagePlaylistItemRead` at line 93 (8-field fields allowlist source)
- `frontend/src/signage/lib/signageApi.ts` — `listPlaylistItems` at line 167; playlist functions to swap (signatures stable)
- `frontend/src/signage/components/PlaylistDeleteDialog.tsx` — consumes 409 `{detail, schedule_ids}` shape from surviving DELETE; do not regress

### SSE bridge (Phase 65 — already wired, regression test target)
- `backend/app/services/signage_pg_listen.py` — listener
- `backend/tests/signage/test_pg_listen_sse.py` — extend with playlist regression cases per D-05 (Phase 68 Plan 06 pattern)
- Alembic migration that introduced `signage_notify()` triggers (under `backend/alembic/versions/`, `v1_22_*` series)

### Test files affected
- `backend/tests/test_rbac.py` — READ_ROUTES updates per D-07
- `backend/tests/signage/test_permission_field_allowlists.py` — comment refresh per D-08
- `backend/tests/signage/` (any `test_signage_playlist*.py` and `test_signage_playlist_items*.py` files) — D-06 triage targets

### Directus surface
- `directus/snapshots/v1.22.yaml` — `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map` collection definitions
- `directus/bootstrap-roles.sh` §5 — Viewer permissions (Phase 65; not modified by this phase per D-00c + D-09)

### CI
- `.github/workflows/ci.yml` — target for new method-anchored grep guard step per D-04 (model on existing Phase 67/68 guard steps already in this file)

### Smoke / admin coverage
- `backend/tests/signage/test_admin_directus_crud_smoke.py` (Phase 68 Plan 08) — extend with playlist + playlist_tag_map cases per D-09

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apiClient.ts` Directus singleton via `@/lib/directusClient` — pattern from Phase 64; reused in Phases 66, 67, 68
- `signageApi.ts` adapter seam (Phase 68 Plan 04 already swapped tags + schedules functions) — proven pattern; playlist functions get the same treatment
- `_notify_playlist_changed` helper duplicated across `playlists.py` and `playlist_items.py` — both must be preserved for surviving routes; do not consolidate in this phase (refactor candidate for Phase 71)
- `tests/signage/test_pg_listen_sse.py` SSE regression harness from Phase 65 + Phase 68 Plan 06 — direct extension target
- `tests/signage/test_admin_directus_crud_smoke.py` from Phase 68 Plan 08 — direct extension target for D-09

### Established Patterns
- Phase 67 D-15: namespaced React Query keys `['directus', collection, params?]`; surviving FastAPI keys kept distinct so cross-invalidation is explicit
- Phase 68 D-07: inline-swap `signageApi.ts` keeps signatures, swap internals only — consumers untouched
- Phase 65 SSE-01: any row insert/update/delete on a triggered table fires the matching SSE event via the listener; bridge is writer-agnostic

### Integration Points
- `frontend/src/signage/lib/signageApi.ts` — single seam for the playlist FE swap (no consumer file changes expected)
- `frontend/src/signage/components/PlaylistDeleteDialog.tsx` — consumer of surviving FastAPI DELETE 409 shape; verify untouched at end of phase
- `.github/workflows/ci.yml` — append the method-anchored guard immediately after the Phase 68 guard

</code_context>

<specifics>
## Specific Ideas

- The "FE-driven diff" pattern for `replacePlaylistTags` (D-02) is the same pattern that will be reused for `replaceDeviceTags` in Phase 70 — the planner should write `replacePlaylistTags` in a way that makes lifting to a shared util in Phase 71 mechanical (e.g., a private helper that takes collection name + parent FK column + parent id + new tag id list).
- SSE multi-event tolerance (D-02b / D-05): a tag replace producing N delete + M insert events is normal under the LISTEN bridge. FE already deduplicates `playlist-changed` events via the existing player handler — no change needed.

</specifics>

<deferred>
## Deferred Ideas

- Optimistic update + rollback for tag-map writes — Phase 71 polish
- Consolidating the duplicated `_notify_playlist_changed` helper into a shared service — Phase 71 CLEAN
- Shared `replaceTagMap(collection, parentColumn, parentId, tagIds)` util factored from Phase 69 + Phase 70 implementations — Phase 71 FE-01
- Optimistic UI / inline edit affordances on the Playlists admin page — out of v1.22 scope
- Contract-snapshot tests per migrated endpoint — Phase 71 FE-04

</deferred>

---

*Phase: 69-mig-sign-playlists*
*Context gathered: 2026-04-25*
