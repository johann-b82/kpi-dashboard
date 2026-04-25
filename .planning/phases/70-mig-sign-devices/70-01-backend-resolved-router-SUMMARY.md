---
phase: 70-mig-sign-devices
plan: 01
subsystem: api

tags: [fastapi, signage, directus-migration, sse, resolver]

requires:
  - phase: 65-foundation
    provides: SSE bridge + admin gate pattern
  - phase: 69-mig-sign-playlists
    provides: Playlists collection in Directus + tag-map writers
provides:
  - "GET /api/signage/resolved/{device_id} compute-only endpoint"
  - "ResolvedDeviceResponse schema (current_playlist_id, current_playlist_name, tag_ids)"
affects: [70-02-backend-devices-router-trim, 70-03-frontend-signageapi-swap, 70-04-frontend-devices-page-merge]

tech-stack:
  added: []
  patterns:
    - "Hybrid surface — Directus owns rows, FastAPI owns compute (per MIG-SIGN-04)"
    - "FE merge {...directusRow, ...resolvedResponse} via field-name parity"

key-files:
  created:
    - backend/app/routers/signage_admin/resolved.py
  modified:
    - backend/app/routers/signage_admin/__init__.py

key-decisions:
  - "Field names mirror SignageDeviceRead extras exactly (current_playlist_id, current_playlist_name, tag_ids) so FE merge needs no rename layer"
  - "Single-source admin gate inheritance preserved — no per-route Depends(require_admin) in resolved.py"
  - "tag_ids returns None (not []) when device has zero tag-map rows — preserves existing FE optional-chain semantics"

patterns-established:
  - "Per-device compute endpoints live as their own sub-router under signage_admin (separates list from per-row compute)"

requirements-completed: [MIG-SIGN-04]

duration: 53s
completed: 2026-04-25
---

# Phase 70 Plan 01: Backend Resolved Router Summary

**New compute-only `GET /api/signage/resolved/{device_id}` returns the three resolver fields (current_playlist_id, current_playlist_name, tag_ids) the FE merges onto Directus-owned device rows.**

## Performance

- **Duration:** 53s
- **Started:** 2026-04-25T07:43:32Z
- **Completed:** 2026-04-25T07:44:25Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments
- New router file `backend/app/routers/signage_admin/resolved.py` with single `GET /resolved/{device_id}` route, `ResolvedDeviceResponse` Pydantic model, 404 on unknown device, package-level admin gate inherited.
- Resolved router registered in `signage_admin/__init__.py` — route appears in FastAPI route table at `/api/signage/resolved/{device_id}`.

## Task Commits

1. **Task 1: Create resolved.py router** — `d4bf791` (feat)
2. **Task 2: Register resolved router in signage_admin package** — `30369e9` (feat)

## Files Created/Modified
- `backend/app/routers/signage_admin/resolved.py` — new file, 58 LOC, single GET route, ResolvedDeviceResponse model
- `backend/app/routers/signage_admin/__init__.py` — added `resolved` to package import list and `router.include_router(resolved.router)`

## Decisions Made
- None beyond the plan's locked decisions (D-01, D-01a, D-01b, D-01c, D-01d). Wrote the file from the plan's exact code block; verified the `from app.models import SignageDevice, SignageDeviceTagMap` import path matches devices.py line 18.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Host `python3` is 3.9 (no `StrEnum`) and lacks Directus env vars, so the plan's `python -c "..."` verification could not run on the host. Switched to `docker compose exec -T api python -c "..."` against the running api container. Both verification commands passed (`OK Task 1`, `OK Task 2`).

## User Setup Required

None.

## Next Phase Readiness

- Plan 70-02 (devices router trim) can now safely remove `_attach_resolved_playlist` from `devices.py` once the FE migration in Plan 70-03/04 lands.
- Plan 70-03 (signageApi swap) has the new endpoint shape locked: `{current_playlist_id: UUID|null, current_playlist_name: string|null, tag_ids: number[]|null}`.

## Self-Check: PASSED

- `backend/app/routers/signage_admin/resolved.py` — FOUND
- `backend/app/routers/signage_admin/__init__.py` — FOUND
- Commit `d4bf791` — FOUND
- Commit `30369e9` — FOUND
- Route `/api/signage/resolved/{device_id}` — registered (verified in api container)

---
*Phase: 70-mig-sign-devices*
*Completed: 2026-04-25*
