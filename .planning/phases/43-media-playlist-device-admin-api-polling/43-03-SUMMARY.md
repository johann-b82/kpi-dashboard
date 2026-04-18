---
phase: 43-media-playlist-device-admin-api-polling
plan: 03
subsystem: api
tags: [fastapi, signage, admin-crud, postgres, sqlalchemy, pydantic, router-level-admin-gate]

requires:
  - phase: 41-signage-schema
    provides: signage ORM models (SignageMedia, SignagePlaylist, SignagePlaylistItem, SignageDevice, SignageDeviceTag, maps) + Pydantic schemas
  - phase: 42-signage-auth-pair
    provides: Directus-JWT-admin dep (get_current_user, require_admin), device pairing flow
provides:
  - signage_admin router package under /api/signage/{media,playlists,devices,tags}
  - Media CRUD with 409-on-FK-RESTRICT JSONResponse (flat {detail, playlist_ids})
  - Playlist CRUD + bulk-replace tag assignments (atomic)
  - Playlist items bulk-replace endpoint (atomic DELETE+INSERT)
  - Device admin endpoints + bulk-replace tag assignments
  - Tag CRUD with 409 on in-use delete
affects: [43-04-player-router, 43-05-dep-audit, 46-admin-ui]

tech-stack:
  added: []
  patterns:
    - "Router-level admin gate via APIRouter(dependencies=[Depends(get_current_user), Depends(require_admin)]) on the parent"
    - "Per-resource sub-router modules included into a single parent router (D-01)"
    - "JSONResponse for flat-shape 409 errors (avoids FastAPI's nested HTTPException detail)"
    - "Bulk-replace endpoints: DELETE + bulk INSERT inside a single transaction, single commit"

key-files:
  created:
    - backend/app/routers/signage_admin/__init__.py
    - backend/app/routers/signage_admin/media.py
    - backend/app/routers/signage_admin/playlists.py
    - backend/app/routers/signage_admin/playlist_items.py
    - backend/app/routers/signage_admin/devices.py
    - backend/app/routers/signage_admin/tags.py
    - backend/tests/test_signage_admin_router.py
  modified:
    - backend/app/main.py

key-decisions:
  - "D-21 option (b): POST /media accepts optional directus_file_id and, when uri is absent, stores it into SignageMedia.uri as-is. Keeps the ORM model unchanged (no new column)."
  - "Devices: no POST /devices (creation goes through pairing flow, Phase 42); revoke endpoint stays on signage_pair (not duplicated here)."
  - "Tag DELETE mirrors media DELETE: 409 JSONResponse on IntegrityError when maps reference the tag."
  - "MediaUpdate and PlaylistUpdate are local Pydantic models (not added to app.schemas.signage) — they are admin-router-specific PATCH payload shapes."

patterns-established:
  - "Parent router owns the admin gate; sub-routers MUST NOT re-declare require_admin or get_current_user (enforced by SGN-BE-09 dep-audit in Plan 05)"
  - "409-with-referrers: flat JSON {detail, playlist_ids} returned via JSONResponse"
  - "Bulk-replace tag assignments and playlist items: single transaction, single commit, atomic semantics"

requirements-completed: [SGN-BE-01]

duration: 3m 28s
completed: 2026-04-18
---

# Phase 43 Plan 03: Admin CRUD Router Summary

**Signage admin CRUD under /api/signage/* with a single router-level admin gate, flat 409-with-playlist_ids on media RESTRICT, and atomic bulk-replace for playlist items + tag assignments**

## Performance

- **Duration:** 3m 28s
- **Started:** 2026-04-18T21:44:01Z
- **Completed:** 2026-04-18T21:47:29Z
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- Admin-gated CRUD for media, playlists, playlist items, devices, tags registered under `/api/signage/*`.
- Single `require_admin` dependency on the parent `APIRouter` — sub-routers inherit it (D-01); ready for SGN-BE-09 dep-audit in Plan 05.
- Flat 409 `{detail, playlist_ids}` on media delete when referenced by playlist_items (RESEARCH Pitfall 6).
- Atomic `PUT /playlists/{id}/items` bulk-replace (D-17) and atomic `PUT /{playlists|devices}/{id}/tags` (D-18), both single-transaction.
- 9/9 router tests green covering admin/viewer/no-jwt matrix, media 404/409/204, and bulk-replace semantics for items + device tags + playlist tags.

## Task Commits

1. **Task 1: Build signage_admin router package + wire main.py** — `ee26749` (feat)
2. **Task 2: Router tests (9 tests covering gate + 409 + bulk-replace)** — `68e9628` (test)

## Files Created/Modified

- `backend/app/routers/signage_admin/__init__.py` — parent router with single `require_admin` gate
- `backend/app/routers/signage_admin/media.py` — media CRUD + 409-on-FK-RESTRICT delete (JSONResponse)
- `backend/app/routers/signage_admin/playlists.py` — playlist CRUD + bulk-replace tags
- `backend/app/routers/signage_admin/playlist_items.py` — bulk-replace items endpoint (atomic)
- `backend/app/routers/signage_admin/devices.py` — device list/get/patch/delete + bulk-replace tags
- `backend/app/routers/signage_admin/tags.py` — tag CRUD with 409 on in-use delete
- `backend/app/main.py` — added `signage_admin_router` import and `include_router` call
- `backend/tests/test_signage_admin_router.py` — 9 integration tests

## Decisions Made

- D-21 option (b) implemented by accepting `directus_file_id` in the admin create payload and persisting it in `SignageMedia.uri` when `uri` is not supplied. No schema/ORM change was needed.
- Plan called for `PATCH` on media/playlists but the shared `app.schemas.signage` only defines Base/Create/Read trios and a `SignageDeviceUpdate`. Rather than widen the shared schema module, I introduced router-local `SignageMediaUpdate` and `SignagePlaylistUpdate` Pydantic models for the admin PATCH payloads. This keeps the admin-only fields (partial, no `tag_ids`) out of the public-facing DTO layer.
- Tag DELETE returns a flat 409 JSONResponse on IntegrityError (mirrors media delete). Although the Phase 41 `signage_device_tag_map` / `signage_playlist_tag_map` FKs are `ON DELETE CASCADE`, the JSONResponse branch remains as defense-in-depth if the FK policy is tightened later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Parallel edit to `backend/app/main.py`**
- **Found during:** Task 1 (main.py wiring)
- **Issue:** Wave 2 parallel plan 43-04 added `signage_player_router` to `main.py` between my initial read and write. The first Edit failed with "file modified since read".
- **Fix:** Re-read `main.py`, then added my `signage_admin_router` import and `include_router` call alongside 43-04's `signage_player_router` changes (no overwrite).
- **Files modified:** `backend/app/main.py`
- **Verification:** `GET /api/signage/*` listing in running container shows admin + player + pair endpoints co-registered.
- **Committed in:** `ee26749`

---

**Total deviations:** 1 auto-fixed (1 blocking — merge coordination)
**Impact on plan:** Coordination-only; no scope creep. Wave 2 parallel execution successful.

## Issues Encountered

- Host Python is 3.9; project runs in Docker with Python 3.11 (uses `enum.StrEnum`). Switched verification from bare-metal `python3` to `docker compose exec api python` — this is the canonical path for local verification in this repo.

## Self-Check

- [x] `backend/app/routers/signage_admin/__init__.py` exists
- [x] `backend/app/routers/signage_admin/{media,playlists,playlist_items,devices,tags}.py` exist
- [x] `backend/tests/test_signage_admin_router.py` exists (9 tests)
- [x] `backend/app/main.py` includes `signage_admin_router` (import + include_router)
- [x] Commit `ee26749` present
- [x] Commit `68e9628` present
- [x] `grep -rn require_admin backend/app/routers/signage_admin/` returns only the `__init__.py` line
- [x] `grep -rn "subprocess\.\(run\|Popen\|call\)\|import sqlite3\|import psycopg2" backend/app/routers/signage_admin/` returns 0
- [x] `pytest tests/test_signage_admin_router.py` passes 9/9
- [x] `pytest tests/test_signage_pair_router.py tests/test_sensors_admin_gate.py` still passes (19/19 — no regression)

**Self-Check: PASSED**

## Next Phase Readiness

- All signage admin endpoints registered under `/api/signage/*`.
- Router-level-only admin gate — ready for Plan 05 (SGN-BE-09) dep-audit grep.
- SGN-BE-10 smell check: zero `subprocess.*` / `sqlite3` / `psycopg2` imports in the package.
- Wave 2 parallel with Plan 43-04 (`signage_player`) — main.py now wires both routers.

---
*Phase: 43-media-playlist-device-admin-api-polling*
*Plan: 03*
*Completed: 2026-04-18*
