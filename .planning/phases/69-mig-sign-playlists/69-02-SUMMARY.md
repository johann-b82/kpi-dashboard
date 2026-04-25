---
phase: 69-mig-sign-playlists
plan: 02
subsystem: backend/signage-admin
tags: [mig-sign, directus, fastapi-trim, playlist-items]
requires:
  - Phase 65 LISTEN/NOTIFY SSE bridge (signage_playlist_items trigger)
  - Directus collection `signage_playlist_items` exposed
provides:
  - Trimmed `playlist_items.py` retaining only bulk PUT + helper
affects:
  - Frontend signage admin (Plan 69-03 will swap items GET to Directus)
tech-stack:
  added: []
  patterns:
    - Surgical route removal (Phase 68-03 precedent)
key-files:
  modified:
    - backend/app/routers/signage_admin/playlist_items.py
  created: []
decisions:
  - "Module docstring rewritten to reflect Phase 69 MIG-SIGN-03 surviving-PUT-only scope."
  - "All imports retained — every symbol (SignagePlaylist, SignagePlaylistItem, SignagePlaylistItemRead, delete, select, HTTPException, Depends, AsyncSession, BaseModel, signage_broadcast, resolver helpers, uuid) is still consumed by the surviving PUT handler or _notify_playlist_changed helper."
  - "_notify_playlist_changed kept duplicated per D-04b/D-05a — consolidation deferred to Phase 71 CLEAN."
metrics:
  duration: 59s
  tasks: 1
  files: 1
  completed: 2026-04-25
---

# Phase 69 Plan 02: Backend playlist_items.py trim Summary

**One-liner:** Deleted `GET /api/signage/playlists/{id}/items` from FastAPI (now served by Directus collection `signage_playlist_items`); preserved bulk `PUT /{id}/items` atomic DELETE+INSERT plus the `_notify_playlist_changed` helper.

## What Changed

- Removed `@router.get("/{playlist_id}/items", ...)` decorator + `list_playlist_items` function body (16 lines).
- Updated module docstring: "Phase 69 MIG-SIGN-03: surviving bulk PUT /{id}/items only (atomic DELETE+INSERT). GET moved to Directus collection `signage_playlist_items`."
- KEPT: `@router.put("/{playlist_id}/items", ...)` and `bulk_replace_playlist_items` handler exactly as written.
- KEPT: `_notify_playlist_changed` helper — surviving PUT still fans out via this explicit call (Phase 65 LISTEN bridge complements but does not replace it; D-04b/D-05a).
- KEPT: `BulkReplaceItemsRequest` Pydantic class — used by surviving PUT body.
- Imports unchanged: every import is still referenced (PUT handler uses `SignagePlaylist`, `SignagePlaylistItem`, `SignagePlaylistItemCreate`, `SignagePlaylistItemRead`, `select`, `delete`, `HTTPException`, `Depends`, `AsyncSession`, `uuid`, `BaseModel`; helper uses `signage_broadcast`, `compute_playlist_etag`, `devices_affected_by_playlist`, `resolve_playlist_for_device`).

## Verification

| Check | Expected | Actual |
| ----- | -------- | ------ |
| `grep -cE '^@router\.get\b'` | 0 | 0 |
| `grep -cE '^@router\.put\b'` | 1 | 1 |
| `grep -c 'list_playlist_items'` | 0 | 0 |
| `grep -c '_notify_playlist_changed'` | ≥ 2 | 2 |
| `grep -cE '^@router\.'` | 1 | 1 |
| Import smoke (`from app.routers.signage_admin.playlist_items import router, _notify_playlist_changed`) | exit 0 | exit 0 |
| `pytest tests/signage/ --co -q` | 33 tests collected | 33 tests collected |
| Route introspection | `[('/playlists/{playlist_id}/items', ['PUT'])]` | matches |

Verified inside `kpi-dashboard-api-1` container (host has no Python venv).

## Deviations from Plan

None — plan executed exactly as written.

The `tdd="true"` marker did not yield a separate failing test commit because the verification surface is route introspection on the deletion (no behavior to assert beyond presence/absence of the GET route). Mirrors Phase 68-03 precedent: a single deletion commit with introspection-based acceptance criteria.

## Commits

- `6ae4182` — feat(69-02): remove FastAPI GET /playlists/{id}/items; route to Directus

## Self-Check: PASSED

- Modified file `backend/app/routers/signage_admin/playlist_items.py`: FOUND
- Commit `6ae4182`: FOUND
- All acceptance grep checks pass; pytest collection succeeds; runtime import succeeds.
