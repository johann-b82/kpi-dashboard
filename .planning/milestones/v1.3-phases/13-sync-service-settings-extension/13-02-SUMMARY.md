---
phase: 13-sync-service-settings-extension
plan: "02"
subsystem: backend
tags: [personio, sync, apscheduler, scheduler, fastapi, lifespan, settings]
dependency_graph:
  requires:
    - "13-01: hr_sync.run_sync(), SyncResult/SyncTestResult/PersonioOptions schemas, PersonioClient with fetch methods"
    - "12-01: PersonioClient with authenticate(), PersonioAuthError/PersonioNetworkError/PersonioAPIError"
  provides:
    - "scheduler.py: APScheduler AsyncIOScheduler lifespan, SYNC_JOB_ID, _run_scheduled_sync"
    - "routers/sync.py: POST /api/sync (full sync) and POST /api/sync/test (credential test)"
    - "routers/settings.py: GET /api/settings/personio-options (live Personio discovery)"
    - "routers/settings.py: PUT /api/settings reschedules APScheduler on interval change"
    - "main.py: wired lifespan and sync_router — full backend API surface complete"
  affects:
    - "13-03: Frontend settings form can now call /api/sync/test and /api/settings/personio-options"
tech_stack:
  added:
    - "APScheduler 3.11.2 AsyncIOScheduler (already in requirements.txt)"
  patterns:
    - "FastAPI asynccontextmanager lifespan for APScheduler start/stop"
    - "app.state.scheduler for runtime scheduler access from request handlers"
    - "Degraded response pattern for /personio-options (returns error field, never 500)"
    - "replace_existing=True on add_job handles both add-new and reschedule in one call"
key_files:
  created:
    - backend/app/scheduler.py
    - backend/app/routers/sync.py
  modified:
    - backend/app/routers/settings.py
    - backend/app/main.py
decisions:
  - "Lifespan attached to app.state.scheduler so PUT /api/settings can access scheduler without global import side-effects"
  - "interval_h == 0 removes the job (manual-only mode) rather than scheduling every 0 hours, per D-07"
  - "GET /personio-options placed before PUT '' to avoid any routing conflicts; path is unique under /api/settings prefix"
  - "_build_read updated to include all 4 new personio config fields so GET/PUT both return complete SettingsRead"
metrics:
  duration: "2m"
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_modified: 4
---

# Phase 13 Plan 02: Sync Service Settings Extension — API Routes and Scheduler Wiring Summary

APScheduler lifespan, POST /api/sync (full sync), POST /api/sync/test (credential test), GET /api/settings/personio-options (live Personio discovery), and PUT /api/settings scheduler reschedule — completing the full backend API surface for Phase 13.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scheduler.py and sync router | c515717 | backend/app/scheduler.py, backend/app/routers/sync.py |
| 2 | Extend settings router and wire main.py | 2f4bf75 | backend/app/routers/settings.py, backend/app/main.py |

## What Was Built

**scheduler.py (new file):**
- `scheduler = AsyncIOScheduler()` — module-level scheduler instance
- `SYNC_JOB_ID = "personio_sync"` — stable job identifier for reschedule/remove
- `_load_sync_interval()` — reads `personio_sync_interval_h` from AppSettings singleton via AsyncSessionLocal
- `_run_scheduled_sync()` — scheduled job entry point; opens its own AsyncSessionLocal session (not FastAPI Depends), calls hr_sync.run_sync(), swallows exceptions (sync meta updated with error status inside run_sync)
- `lifespan(app: FastAPI)` — asynccontextmanager; attaches scheduler to `app.state.scheduler`, conditionally adds sync job (if interval_h > 0), starts scheduler on enter, shuts down on exit

**routers/sync.py (new file):**
- `POST /api/sync` — full blocking Personio sync; credential guard before calling hr_sync.run_sync(); catches PersonioAPIError and returns SyncResult with status="error"
- `POST /api/sync/test` — credential test without data fetch; calls PersonioClient.authenticate() and returns SyncTestResult; catches PersonioAuthError, PersonioNetworkError, PersonioAPIError; always closes client in finally
- `_get_credentials()` — shared helper that reads and decrypts credentials from AppSettings singleton

**routers/settings.py (extended):**
- `GET /api/settings/personio-options` — fetches absence_types and departments live from Personio; returns degraded PersonioOptions with error field (not HTTP 500) when credentials missing or Personio API fails
- `PUT /api/settings` — signature extended with `request: Request`; handles 4 new config fields (personio_sync_interval_h, personio_sick_leave_type_id, personio_production_dept, personio_skill_attr_key); when personio_sync_interval_h changes, immediately reschedules or removes the APScheduler job via request.app.state.scheduler
- `_build_read()` — now includes all 4 new personio config fields in SettingsRead response
- New imports: `AbsenceTypeOption`, `PersonioOptions`, `decrypt_credential`, `PersonioAPIError`, `PersonioClient`

**main.py (updated):**
- Added `from app.scheduler import lifespan`
- Added `from app.routers.sync import router as sync_router`
- Changed `FastAPI(title="KPI Light")` to `FastAPI(title="KPI Light", lifespan=lifespan)`
- Added `app.include_router(sync_router)`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints connect to real Personio API via PersonioClient, real APScheduler instance, and real AppSettings singleton. No hardcoded data.

## Self-Check: PASSED
