---
phase: 65-foundation-schema-authz-sse-bridge
plan: "04"
subsystem: api
tags: [asyncpg, postgres, listen-notify, sse, fastapi, lifespan]

# Dependency graph
requires:
  - phase: 65-03
    provides: Alembic-managed signage_notify() trigger + signage_change NOTIFY channel
  - phase: 65-02
    provides: devices_affected_by_playlist, devices_affected_by_device_update, notify_device resolvers
provides:
  - signage_pg_listen service module with listener + reconnect + handler dispatch
  - FastAPI lifespan wired to start/stop the listener task
affects: [65-05, 66, 67, 68, 69, 70, 71]

# Tech tracking
tech-stack:
  added: [asyncpg (LISTEN/NOTIFY connection)]
  patterns:
    - long-lived asyncpg connection hosted in FastAPI lifespan for Postgres LISTEN/NOTIFY
    - exponential backoff reconnect loop (1s->30s, infinite, fail-soft startup)
    - schedule dispatch via explicit SELECT playlist_id then devices_affected_by_playlist

key-files:
  created:
    - backend/app/services/signage_pg_listen.py
  modified:
    - backend/app/scheduler.py

key-decisions:
  - "Schedule branch uses fetch-then-call pattern: SELECT SignageSchedule.playlist_id by schedule_id, then call devices_affected_by_playlist(db, playlist_id) — no schedule-aware resolver exists in signage_resolver.py"
  - "Listener task is fail-soft: initial connect failure logs ERROR once and retries in background; /api/* continues serving"
  - "Fresh asyncpg.connect() per reconnect iteration — closed connection is never reused (Pitfall 2)"

patterns-established:
  - "asyncpg LISTEN pattern: connect -> add_listener -> sleep loop -> reconnect on any Exception except CancelledError"
  - "Lifespan ordering: scheduler.start() -> signage_pg_listen.start(app) -> yield -> signage_pg_listen.stop(app) -> scheduler.shutdown()"

requirements-completed: [SSE-03, SSE-06]

# Metrics
duration: 3min
completed: "2026-04-24"
---

# Phase 65 Plan 04: SSE Bridge — Asyncpg Listener Summary

**Asyncpg long-lived LISTEN connection on `signage_change`, dispatching INSERT/UPDATE/DELETE events to affected player SSE streams via resolver + notify_device() with exponential-backoff reconnect**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-24T18:00:50Z
- **Completed:** 2026-04-24T18:03:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `signage_pg_listen.py` (~161 lines): asyncpg LISTEN loop with 1s->30s exponential backoff, fail-soft initial connect, per-table dispatch to `notify_device()` via existing resolvers
- Schedule branch explicitly SELECTs `SignageSchedule.playlist_id` then calls `devices_affected_by_playlist(db, playlist_id)` — binding contract from plan 04 (no schedule-aware resolver in signage_resolver.py)
- Wired `start(app)` / `stop(app)` into FastAPI `lifespan` in `scheduler.py` after `scheduler.start()` / before `scheduler.shutdown()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create signage_pg_listen listener + reconnect + handler** - `02d1cd1` (feat)
2. **Task 2: Wire signage_pg_listen into FastAPI lifespan** - `51b68ee` (feat)

## Files Created/Modified
- `backend/app/services/signage_pg_listen.py` - Asyncpg LISTEN service: `_pg_dsn()`, `_handle_notify()`, `_listener_loop()`, `start()`, `stop()`
- `backend/app/scheduler.py` - Added `from app.services import signage_pg_listen` import + lifespan start/stop calls

## Decisions Made
- Schedule dispatch uses the "fetch-then-call" binding contract: SELECT `SignageSchedule.playlist_id` by `schedule_id`, then call `devices_affected_by_playlist(db, playlist_id)`. No `devices_affected_by_schedule` function was found in `signage_resolver.py` (confirmed during execution — consistent with plan confirmation at planning time).
- DELETE events on `signage_schedules` produce `affected = []` (no affected devices): schedule row is gone so `scalar_one_or_none()` returns `None`; the 30s SSE poll is the durability floor.
- `signage_devices` DELETE events similarly produce `affected = []` — a deleted device has no live SSE session.

## Deviations from Plan

None — plan executed exactly as written. The `devices_affected_by_schedule` check confirmed: no such function exists in `signage_resolver.py`. The fetch-then-call pattern was applied as specified.

## Issues Encountered

None.

## Known Stubs

None — all dispatch paths are fully wired to existing resolvers and `notify_device()`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 65-04 closes the server-side SSE bridge loop: Postgres NOTIFY -> asyncpg listener -> resolver -> notify_device() -> SSE frame
- Plan 65-05 (CI guard) can now grep for `--workers 1 INVARIANT` in `signage_pg_listen.py` (phrase confirmed present)
- The full bridge (65-01 schema + 65-02 broadcast + 65-03 triggers + 65-04 listener) is in place; Phase 66+ endpoint migrations can rely on SSE push correctness

---
*Phase: 65-foundation-schema-authz-sse-bridge*
*Completed: 2026-04-24*
