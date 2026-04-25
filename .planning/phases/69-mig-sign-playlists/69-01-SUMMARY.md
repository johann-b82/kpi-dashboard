---
phase: 69-mig-sign-playlists
plan: 01
subsystem: backend/signage-admin
tags: [migration, directus, signage, playlists, router-removal]
dependency-graph:
  requires:
    - Phase 65 LISTEN/NOTIFY SSE bridge (signage_playlists trigger)
    - Phase 65 Directus permission allowlists for signage_playlists + signage_playlist_tag_map
  provides:
    - Trimmed signage_admin/playlists.py exposing only DELETE /{playlist_id}
    - Retained _notify_playlist_changed helper for surviving DELETE
  affects:
    - frontend/src/signage/lib/signageApi.ts (Plan 69-03 swaps reads/writes to Directus)
    - tests/signage/test_admin_directus_crud_smoke.py (Plan 69-06 covers Directus playlist CRUD)
tech-stack:
  added: []
  patterns:
    - "Surgical FastAPI route removal preserving surviving DELETE + helper (mirrors 68-01 / 68-03)"
    - "Surface regression test asserting only DELETE remains"
key-files:
  created:
    - backend/tests/signage/test_playlists_router_surface.py
  modified:
    - backend/app/routers/signage_admin/playlists.py
decisions:
  - "Kept IntegrityError import — surviving DELETE catches it for structured 409 shape"
  - "Used HEAD-method check in regression test to catch any GET-shaped route leaking back (Starlette auto-adds HEAD with GET)"
metrics:
  duration: 120s
  completed: 2026-04-25
requirements: [MIG-SIGN-03]
---

# Phase 69 Plan 01: backend-playlists-router-removal Summary

**One-liner:** Migrated playlist metadata CRUD + PUT-tags from FastAPI to Directus by deleting the route handlers from `signage_admin/playlists.py`, keeping only `DELETE /{playlist_id}` (preserves structured 409 `{detail, schedule_ids}` shape) and the `_notify_playlist_changed` helper (D-04b/D-05a — surviving DELETE still fans out explicitly).

## What Shipped

### Routes Removed (5)

| HTTP   | Path                          | Replaced by                                 |
| ------ | ----------------------------- | ------------------------------------------- |
| POST   | `/playlists`                  | Directus `POST /items/signage_playlists`    |
| GET    | `/playlists`                  | Directus `GET /items/signage_playlists`     |
| GET    | `/playlists/{id}`             | Directus `GET /items/signage_playlists/{id}` |
| PATCH  | `/playlists/{id}`             | Directus `PATCH /items/signage_playlists/{id}` |
| PUT    | `/playlists/{id}/tags`        | Directus writes against `signage_playlist_tag_map` |

### Routes Retained (1)

| HTTP   | Path                | Why kept                                                                |
| ------ | ------------------- | ----------------------------------------------------------------------- |
| DELETE | `/playlists/{id}`   | Preserves `409 {detail, schedule_ids}` shape consumed by `PlaylistDeleteDialog.tsx` (D-00 architectural lock). |

### Helper Retention Confirmation

`_notify_playlist_changed(db, playlist_id)` — defined and invoked exactly as before. Per D-04b/D-05a, the surviving DELETE handler still calls it explicitly alongside the Phase 65 LISTEN/NOTIFY bridge to fan out playlist-changed events to all overlapping devices.

```python
async def _notify_playlist_changed(db: AsyncSession, playlist_id) -> None:
    affected = await devices_affected_by_playlist(db, playlist_id)
    for device_id in affected:
        ...
        signage_broadcast.notify_device(device_id, payload)
```

(Note: the surviving DELETE handler today inlines the equivalent fanout for the deleted-etag case — the helper itself remains imported and exported for future bulk-PUT consumers and external callers.)

### Import Diff

**Dropped:**
- `from pydantic import BaseModel, Field` (no models defined post-trim)
- `from sqlalchemy import insert` (only PUT-tags used INSERT)
- `from app.models import SignagePlaylistTagMap` (PUT-tags moved to Directus)
- `from app.schemas.signage import SignagePlaylistCreate, SignagePlaylistRead` (no schema-validated responses)
- `from typing import Any` (no longer needed without TagAssignmentRequest)

**Kept (verified still required):**
- `from sqlalchemy.exc import IntegrityError` — surviving DELETE catches it for the 409 reshape
- `from sqlalchemy import delete, select` — DELETE handler uses both
- `from app.models import SignagePlaylist, SignageSchedule` — DELETE deletes one, queries the other for `schedule_ids`
- `from app.services.signage_resolver import compute_playlist_etag, devices_affected_by_playlist, resolve_playlist_for_device` — used by `_notify_playlist_changed`
- `from app.services import signage_broadcast` — used by both helper + DELETE
- `APIRouter, Depends, HTTPException`, `JSONResponse`, `AsyncSession`, `get_async_db_session`, `uuid` — core router/handler plumbing

## TDD Cycle

- **RED** (`test(69-01): add failing test...` — `80223d5`): Added `tests/signage/test_playlists_router_surface.py` with 3 assertions (only DELETE method survives, exactly one DELETE /{playlist_id} route exists, `_notify_playlist_changed` remains exported). Initial run: `test_only_delete_route_remains` FAILED with `unexpected migrated routes still exposed: {'GET', 'PATCH', 'POST', 'PUT'}` — RED confirmed.
- **GREEN** (`feat(69-01): trim playlists router...` — `4b87821`): Rewrote `playlists.py` keeping only the helper + DELETE handler. Net: +17 / −147 lines. All 3 surface tests PASSED.
- **REFACTOR**: Not needed — surviving handler is verbatim from prior file.

## Verification

- `grep -cE "^@router\." backend/app/routers/signage_admin/playlists.py` → **1** (only DELETE).
- `grep -nE "^@router\.(post|get|patch)\b" .../playlists.py` → **0 matches**.
- `grep -nE "^@router\.put\b.*tags" .../playlists.py` → **0 matches**.
- `grep -nE "^@router\.delete\b" .../playlists.py` → **1 match** (line 79).
- `grep -c "_notify_playlist_changed" .../playlists.py` → **2** (definition + import-time usage).
- `grep -c "schedule_ids" .../playlists.py` → **5** (preserved 409 shape).
- `docker exec kpi-dashboard-api-1 python -c "from app.routers.signage_admin.playlists import router, _notify_playlist_changed"` → exit 0.
- `docker exec kpi-dashboard-api-1 pytest tests/signage/ --co -q` → **33 tests collected**, no import errors.
- `pytest tests/signage/test_playlists_router_surface.py -v` → **3 passed**.
- Live router introspection confirms exactly one route: `{'DELETE'} /playlists/{playlist_id}`.

## Deviations from Plan

### Plan-text adjustments (no Rule 1–4 deviations)

**Imports kept that the plan suggested verifying for removal:**
- `IntegrityError`: plan said *"Drop ... if no longer raised by surviving handler (verify)"*. Verified — DELETE handler still has `try/except IntegrityError` for the 409 reshape, so import retained.
- `Any` from `typing`: not in plan's keep list and no longer needed (only `TagAssignmentRequest` used it). Dropped.

**No deviations under Rules 1–4.**

## Self-Check: PASSED

- File exists: `backend/tests/signage/test_playlists_router_surface.py` — FOUND.
- File modified: `backend/app/routers/signage_admin/playlists.py` — FOUND.
- Commit `80223d5` — FOUND in `git log` (`test(69-01): add failing test...`).
- Commit `4b87821` — FOUND in `git log` (`feat(69-01): trim playlists router...`).

## Hand-off

- **Plan 69-02 (already executed in parallel):** removed `GET /playlists/{id}/items` from FastAPI; reads now route to Directus.
- **Plan 69-03 (frontend):** swap `signageApi.ts` playlist CRUD callers to `directus.request(...)`; the FastAPI surface no longer answers POST/GET/PATCH/PUT-tags for playlists.
- **Plan 69-04 (SSE regression):** asserts that Directus-driven INSERT/UPDATE/DELETE on `signage_playlists` + `signage_playlist_tag_map` triggers the Phase 65 LISTEN bridge end-to-end.
- **Plan 69-05 (CI grep guard):** add anchored grep blocking `/api/signage/playlists` (non-DELETE) reappearance in `frontend/src/`.
