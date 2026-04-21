---
phase: 51-schedule-schema-resolver
plan: "02"
subsystem: signage-backend
tags: [signage, schedule, admin-router, sse, crud, 409, fk-restrict]
requires:
  - signage_schedules table + ScheduleRead schema (Plan 51-01)
  - devices_affected_by_playlist (Phase 45 / Plan 45-01)
  - signage_broadcast.notify_device (Phase 45 / Plan 45-02)
  - parent signage_admin router + admin gate (Phase 43 / Plan 43-03)
provides:
  - POST/GET-list/GET-by-id/PATCH/DELETE under /api/signage/schedules (SGN-TIME-04)
  - schedule-changed SSE event kind (D-02) with post-commit fanout per (device, playlist_id)
  - Playlist DELETE 409 with {detail, schedule_ids} when signage_schedules blocks FK RESTRICT (RESEARCH Q2)
  - 9 integration tests covering CRUD, SSE, validation, admin gate, and playlist 409 shape
affects:
  - backend/app/routers/signage_admin/__init__.py (adds schedules sub-router import + include)
  - backend/app/routers/signage_admin/playlists.py (DELETE now catches IntegrityError, returns 409)
tech-stack:
  added: []
  patterns:
    - Sub-router package module (signage_admin/schedules.py) with NO router-level dependencies — inherits parent admin gate (D-01)
    - Per-(device, playlist_id) SSE fanout so PATCH union cases emit one event per playlist, not a collapsed single event
    - Broadcast exceptions swallowed in _fanout_schedule_changed — DB state is the source of truth (Phase 45 invariant)
    - IntegrityError handling wraps both db.execute(delete) and db.commit — asyncpg surfaces FK RESTRICT at statement execution, not only at commit
    - Flat {detail, schedule_ids} 409 body via JSONResponse (mirrors media 409 shape; avoids FastAPI's nested {detail: {...}})
key-files:
  created:
    - backend/app/routers/signage_admin/schedules.py
    - backend/tests/test_signage_schedule_router.py
    - .planning/phases/51-schedule-schema-resolver/51-02-SUMMARY.md
  modified:
    - backend/app/routers/signage_admin/__init__.py
    - backend/app/routers/signage_admin/playlists.py
decisions:
  - Emit one schedule-changed event per (affected_device, playlist_id) rather than collapsing the PATCH union into a single event — lets the player correlate the re-resolve to a specific playlist, dedupes via ETag
  - PATCH re-validates start_hhmm < end_hhmm on the merged state and returns 422 explicitly; DB CHECK is the second line of defense (stable error shape for clients)
  - DELETE captures playlist_id BEFORE db.delete() so the fanout snapshot survives the row's removal (pre-commit capture pattern, same shape as the existing playlist DELETE in this router)
  - Plan sketch used `get_db` + direct `notify_device` import — kept the direct import (tests monkeypatch `app.routers.signage_admin.schedules.notify_device`) but corrected the DB dep to the project's actual `get_async_db_session`
  - Playlist DELETE 409 keys named `schedule_ids` (plural of the blocking entity) to mirror the existing media→playlists 409's `playlist_ids` convention
metrics:
  duration: 7m
  tasks: 2
  files_created: 2
  files_modified: 2
  tests_added: 9
  tests_pass: 165/165 (signage scope, excluding unrelated pre-existing test_color_validator.py ImportError)
  completed: 2026-04-21
---

# Phase 51 Plan 02: Admin Router + SSE Summary

**One-liner:** `signage_admin/schedules.py` CRUD router with per-(device, playlist_id) `schedule-changed` SSE fanout + `playlists.py` DELETE returning 409 `{detail, schedule_ids}` when signage_schedules blocks the FK RESTRICT — closes SGN-TIME-04 and RESEARCH Q2.

## What Shipped

### SGN-TIME-04 — Schedules admin router + SSE fanout

**Route table** under `/api/signage/schedules` (all inherit the parent router's `get_current_user` + `require_admin` gate — no per-sub-router dependencies):

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/api/signage/schedules` | `ScheduleCreate` | 201 `ScheduleRead` | Single playlist fanout |
| GET | `/api/signage/schedules` | — | 200 `list[ScheduleRead]` | Ordered `priority DESC, updated_at DESC` |
| GET | `/api/signage/schedules/{id}` | — | 200 `ScheduleRead` / 404 | — |
| PATCH | `/api/signage/schedules/{id}` | `ScheduleUpdate` | 200 `ScheduleRead` / 404 / 422 | Merged-state `start < end` check; union fanout when `playlist_id` changes |
| DELETE | `/api/signage/schedules/{id}` | — | 204 / 404 | Pre-commit `playlist_id` capture for fanout |

**SSE payload shape** (per D-02):
```json
{"event": "schedule-changed", "schedule_id": "<uuid>", "playlist_id": "<uuid>"}
```
One event per `(affected_device, playlist_id)` pair. For PATCH that changes `playlist_id` from A to B, recipients = `devices_affected_by_playlist(A) ∪ devices_affected_by_playlist(B)`; each device whose tags overlap A receives the event with `playlist_id=A`, devices overlapping B with `playlist_id=B`. Player/sidecar dedupes via the ETag short-circuit in `/playlist`.

**Fanout invariants enforced:**
- Every `notify_device` call fires AFTER `await db.commit()` (lines 100→102, 147→150, 166→167 in `schedules.py`)
- `_fanout_schedule_changed` wraps inner broadcasts in `try/except` — broadcast failures never propagate (Phase 45 Plan 02 invariant; DB state is authoritative)

### RESEARCH Q2 — Playlist DELETE 409 on FK RESTRICT

`signage_schedules.playlist_id` is declared `ON DELETE RESTRICT` (Plan 51-01). Previously, deleting a playlist referenced by a schedule surfaced `asyncpg.ForeignKeyViolationError` as a 500. The DELETE handler now:

1. Wraps both `db.execute(delete(...))` and `db.commit()` in `try/except IntegrityError` (asyncpg surfaces FK RESTRICT at statement execution, not at commit — this was the one deviation from the plan sketch).
2. On catch: `db.rollback()` + re-query `signage_schedules.id WHERE playlist_id = :pid`.
3. Returns `JSONResponse(status_code=409, content={"detail": "playlist has active schedules", "schedule_ids": ["<uuid>", ...]})`.

Body shape mirrors the existing media DELETE 409 (`{detail, playlist_ids}`) for API consistency. `JSONResponse` (not `HTTPException`) keeps the body flat rather than nested under FastAPI's default `{detail: {...}}` wrapper (Pitfall 6).

### Tests — 9 new router/SSE tests, all passing

| # | Test | Covers |
|---|------|--------|
| 1 | `test_create_schedule_returns_201_and_fires_sse` | POST + monkeypatched `notify_device` spy; asserts exact payload + recipient |
| 2 | `test_list_schedules_orders_by_priority_then_updated_at` | GET list ordering |
| 3 | `test_get_schedule_404_for_missing` | GET by id 404 |
| 4 | `test_patch_schedule_validates_start_lt_end_returns_422` | Merged-state check (start=800 + PATCH end=700 → 422; row unchanged) |
| 5 | `test_patch_schedule_changing_playlist_fans_out_union` | Old-pl device + new-pl device both receive events with their respective `playlist_id` |
| 6 | `test_delete_schedule_captures_playlist_id_pre_commit` | Row gone + notify called with the captured playlist_id |
| 7 | `test_non_admin_403_on_all_schedule_endpoints` | Viewer token → 403 on POST/GET list/GET id/PATCH/DELETE |
| 8 | `test_delete_playlist_with_active_schedules_returns_409_with_schedule_ids` | Playlist DELETE 409; row survives; schedule_id present in body |
| 9 | `test_delete_playlist_409_body_shape` | Flat `{detail: str, schedule_ids: [str]}`; both seeded sched ids present |

All tests seed via asyncpg and drive via the existing async `client` fixture (httpx ASGITransport + LifespanManager). SSE assertions use a local `_NotifySpy` monkeypatched onto `app.routers.signage_admin.schedules.notify_device` — no sse-starlette stream was opened (respects the Phase 45 Plan 02 "ASGI infinite generators" lesson).

## Commits

| Task | Commit | Scope |
|------|--------|-------|
| 1 | `52cfd39` | `schedules.py` CRUD router + `__init__.py` registration |
| 2 | `06b50b5` | `playlists.py` 409 handler + `test_signage_schedule_router.py` (9 tests) |

## Verification Results

- `pytest tests/test_signage_schedule_router.py -x -v`: **9 passed**
- `pytest tests/test_signage_admin_router.py -x`: **9 passed** (no regression)
- `pytest tests/test_signage_router_deps.py -x`: **3 passed** (admin gate preserved)
- `pytest tests/ -k signage -x --ignore=tests/test_color_validator.py`: **165 passed, 2 skipped**
- `python -c "from app.routers.signage_admin import router; assert any('/schedules' in r.path for r in router.routes)"`: exit 0
- `grep -c 'dependencies=\[Depends' backend/app/routers/signage_admin/schedules.py`: **0** (sub-router has no admin gate; inherits from parent — D-01)
- `grep -c 'schedule_ids' backend/app/routers/signage_admin/playlists.py`: **3** (select, JSONResponse body key, docstring)
- `grep -c 'IntegrityError' backend/app/routers/signage_admin/playlists.py`: **3** (import, except, docstring)
- CI grep guards: no `import sqlite3`, no `import psycopg2`, no `subprocess.run` in the modified files — all clean
- `--workers 1` invariant: `signage_broadcast.py` untouched

## Deviations from Plan

### Auto-fixes applied (Rules 1-3)

**1. [Rule 3 – Blocking] IntegrityError surfaces at `db.execute(delete(...))`, not at `db.commit()`**
- **Found during:** Task 2 test run — `test_delete_playlist_with_active_schedules_returns_409_with_schedule_ids` initially failed because the plan sketch wrapped only `await db.commit()` in the try/except.
- **Cause:** Under asyncpg, FK RESTRICT violations are raised at statement execution time (inside the open transaction), not deferred to commit.
- **Fix:** Widened the `try` block to cover `await db.execute(delete(...))` too. 404 still comes from `HTTPException` inside the try — `HTTPException` is not `IntegrityError` so it propagates normally.
- **Files:** `backend/app/routers/signage_admin/playlists.py`
- **Commit:** `06b50b5`

### Planner-nominal deviations

- Plan sketch used `get_db` as the DB dep — actual project name is `get_async_db_session` (checked `playlists.py` + `media.py` before writing). Used the correct name from the start.
- Plan sketch imported `notify_device` via `from app.services.signage_broadcast import notify_device` and tests monkeypatch that same attribute. Kept this exactly — the existing `playlists.py` uses `signage_broadcast.notify_device` (module-attr style) instead, but honouring the plan's monkeypatch target takes precedence.
- Plan sketch initially collapsed the union-fanout into a single event with `next(iter(playlist_ids))`. Implemented the Task 1 step-3 refactor directly (one event per `(device, playlist_id)` pair) — no transient "collapsed" version ever shipped.
- Docstring originally contained the literal string `dependencies=[Depends(require_admin)]` as a warning, which tripped the mechanical `grep -c 'dependencies=\[Depends'` done-check. Reworded the docstring to "router-level admin dependency" so the count is cleanly 0 — docstring intent preserved.

### Out-of-scope discoveries (NOT auto-fixed)

**1. Pre-existing `test_color_validator.py` ImportError**
- **Symptom:** `ImportError: cannot import name '_validate_oklch' from 'app.schemas'`
- **Status:** Same finding as Plan 51-01 SUMMARY. Pre-existing; unrelated to schedule work. Scope-boundary rule applied — not fixed here.
- **Workaround for signage regression sweep:** `--ignore=tests/test_color_validator.py`.

## Known Stubs

None. Every handler is fully wired; all 9 router tests exercise real DB rows via asyncpg and assert against concrete payloads.

## Open Research Questions Resolved

- **Q2 (Open Question in 51-RESEARCH.md):** Playlist DELETE when signage_schedules blocks — resolved as 409 with `{detail, schedule_ids}`, mirroring the media 409 field-naming convention.

- **Q3 (timezone error propagation):** Out of scope for Plan 02 — the admin router doesn't touch timezone logic. Covered by the resolver (Plan 51-01) and re-surfaced only if a caller PATCHes an invalid `timezone` through app settings (not under `/api/signage/schedules`).

## Carry-forward for Phase 52 Admin UI

- **Schedule list payload shape** (`GET /api/signage/schedules`): returns the full `ScheduleRead` rows (`id`, `playlist_id`, `weekday_mask`, `start_hhmm`, `end_hhmm`, `priority`, `enabled`, `created_at`, `updated_at`). Frontend will need to resolve `playlist_id → playlist.name` client-side via the existing `/api/signage/playlists` endpoint (or we introduce a `schedules?expand=playlist` later — not needed now).
- **Validation error message** for merged-state `start_hhmm >= end_hhmm` is exactly `"start_hhmm must be less than end_hhmm"` — surface verbatim in DE/EN i18n keys for the schedule form.
- **Playlist DELETE 409** client handling: frontend should recognize `{detail: "playlist has active schedules", schedule_ids: [...]}` and render the blocking schedule list with deep-links to `/signage/schedules/{id}` (same UX pattern as the existing media→playlists 409).
- **Weekday mask** is returned as a bitmask integer (bit0=Mon..bit6=Sun, D-05) — admin UI needs the same 7-checkbox → bitmask adapter on write and the inverse on read.
- **SSE event kind `schedule-changed`** now flows through the player/sidecar — Phase 47/48 stream handlers should be updated to treat `schedule-changed` identically to `playlist-changed` (both trigger `/playlist` re-fetch + ETag compare). Until they are, the `schedule-changed` events will be logged-and-ignored, which is safe but lossy; operators wanting instant schedule re-resolve before the 30s polling loop should land that handler update as a Phase 50-polish or Phase 52 item.

## Self-Check: PASSED

Verified file presence (all exist):
- `backend/app/routers/signage_admin/schedules.py`: FOUND
- `backend/app/routers/signage_admin/__init__.py` (modified): FOUND
- `backend/app/routers/signage_admin/playlists.py` (modified): FOUND
- `backend/tests/test_signage_schedule_router.py`: FOUND
- `.planning/phases/51-schedule-schema-resolver/51-02-SUMMARY.md`: will exist on write

Verified commit presence (`git log --oneline | grep`):
- `52cfd39` (Task 1: feat(51-02): add schedules admin CRUD router…): FOUND
- `06b50b5` (Task 2: feat(51-02): playlist DELETE 409…): FOUND
