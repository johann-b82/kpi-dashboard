---
phase: 13-sync-service-settings-extension
plan: "01"
subsystem: backend
tags: [personio, sync, models, schemas, alembic, hr]
dependency_graph:
  requires:
    - "12-01: HR schema tables (personio_employees, personio_attendance, personio_absences, personio_sync_meta)"
    - "12-02: PersonioClient base class with auth and token caching"
  provides:
    - "PersonioClient.fetch_employees/fetch_attendances/fetch_absences/fetch_absence_types"
    - "hr_sync.run_sync() orchestrator with upsert logic"
    - "AppSettings 3 new nullable columns for KPI configuration"
    - "SyncResult, SyncTestResult, AbsenceTypeOption, PersonioOptions Pydantic schemas"
  affects:
    - "13-02: API routes + scheduler will call hr_sync.run_sync() and use new schemas"
    - "13-03: Frontend settings form will use new SettingsUpdate/SettingsRead fields"
tech_stack:
  added: []
  patterns:
    - "pg_insert().on_conflict_do_update() via sqlalchemy.dialects.postgresql for upsert"
    - "Sequential fetch pattern (not asyncio.gather) to maintain FK ordering"
    - "try/finally around PersonioClient to guarantee close() on error"
key_files:
  created:
    - backend/app/services/hr_sync.py
    - backend/alembic/versions/v1_3_personio_settings_columns.py
  modified:
    - backend/app/models.py
    - backend/app/schemas.py
    - backend/app/services/personio_client.py
decisions:
  - "Adapted _normalize_absence to match actual PersonioAbsence model columns (time_unit + hours) rather than plan's schema which referenced non-existent absence_type_name, days_count, status fields"
  - "Sequential fetches in run_sync() to maintain FK integrity: employees upserted before attendances and absences"
  - "try/finally ensures PersonioClient.close() always called even on fetch errors"
metrics:
  duration: "2m 22s"
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_modified: 5
---

# Phase 13 Plan 01: Sync Service Settings Extension — Backend Foundation Summary

Extended PersonioClient with 4 paginated data-fetch methods, created hr_sync.py orchestrator with FK-ordered upsert logic, added 3 AppSettings KPI configuration columns via Alembic migration, and extended Pydantic schemas for sync responses and settings fields.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend models, schemas, and create Alembic migration | 5347156 | models.py, schemas.py, v1_3_personio_settings_columns.py |
| 2 | Extend PersonioClient with data-fetch methods and create hr_sync.py | 7c4db6e | personio_client.py, hr_sync.py |

## What Was Built

**PersonioClient extensions (personio_client.py):**
- `fetch_employees()` — paginated GET /company/employees (limit=50, offset-based)
- `fetch_attendances()` — paginated GET /company/attendances (same pattern)
- `fetch_absences()` — paginated GET /company/absence-periods (same pattern)
- `fetch_absence_types()` — non-paginated GET /company/absence-types
- All methods use `_get_valid_token()`, handle 401 (PersonioAuthError), 429 (PersonioRateLimitError), timeout (PersonioNetworkError), and other HTTP errors (PersonioAPIError)

**hr_sync.py (new file):**
- `run_sync(session)` — main entry point: decrypt credentials, fetch all 3 entity types sequentially, normalize, upsert in FK order (employees -> attendances -> absences), update sync meta singleton
- `_normalize_employee/attendance/absence` — extract nested `attributes.field.value` Personio shape to flat dicts matching model columns
- `_upsert(session, model, rows)` — generic `pg_insert().on_conflict_do_update()` on PK "id"
- `_update_sync_meta` — updates personio_sync_meta singleton row with counts and status
- `_get_settings` — fetches AppSettings singleton

**models.py extensions:**
- `personio_sick_leave_type_id: Mapped[int | None]` — absence type ID for sick leave KPI
- `personio_production_dept: Mapped[str | None]` — department filter for production employee KPIs
- `personio_skill_attr_key: Mapped[str | None]` — custom attribute key for skill development tracking

**schemas.py extensions:**
- New classes: `SyncResult`, `SyncTestResult`, `AbsenceTypeOption`, `PersonioOptions`
- `SettingsUpdate` extended with `personio_sync_interval_h: Literal[0, 1, 6, 24] | None`, and 3 new config fields
- `SettingsRead` extended with `personio_sync_interval_h: int = 1` and 3 new config fields

**Alembic migration (v1_3_personio_settings_columns.py):**
- revision: d4e5f6a7b8c9, down_revision: c3d4e5f6a7b8
- Adds 3 nullable columns to app_settings table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted _normalize_absence to match actual model columns**
- **Found during:** Task 2 — reviewing PersonioAbsence model before writing normalizer
- **Issue:** Plan's `_normalize_absence` template produced keys (`absence_type_name`, `days_count`, `status`) that don't exist in the `PersonioAbsence` model. The model has `time_unit` (String) and `hours` (Numeric) instead.
- **Fix:** Rewrote `_normalize_absence` to map to actual model columns: `time_unit` extracted from `attrs.get("time_unit", {}).get("value") or "days"` and `hours` from `attrs.get("hours", {}).get("value")`.
- **Files modified:** backend/app/services/hr_sync.py
- **Commit:** 7c4db6e

## Known Stubs

None — all implemented functionality connects to real model columns and real Personio API endpoints. No hardcoded empty values or placeholder data in the sync path.

## Self-Check: PASSED
