---
phase: 04-backend-schema-api-and-security
plan: 02
subsystem: database
tags: [sqlalchemy, alembic, postgres, bytea, singleton]

requires:
  - phase: 04-backend-schema-api-and-security
    provides: Plan 04-01 test harness / shared fixtures baseline
provides:
  - AppSettings SQLAlchemy ORM model (singleton via CHECK id=1)
  - DEFAULT_SETTINGS canonical dict (6 colors + app_name + default_language)
  - Alembic migration b2c3d4e5f6a7 creating app_settings + seeding singleton row
affects: [04-03-schemas, 04-04-security, 04-05-router, 04-06-integration, 05-frontend-settings]

tech-stack:
  added: []
  patterns:
    - "DB-enforced singleton via CheckConstraint('id = 1')"
    - "Defaults duplicated literally into migration (no import of live app code)"
    - "Logo stored inline as BYTEA on same row (no separate app_logos table)"

key-files:
  created:
    - backend/app/defaults.py
    - backend/alembic/versions/b2c3d4e5f6a7_v1_1_app_settings.py
  modified:
    - backend/app/models.py

key-decisions:
  - "AppSettings is a singleton row enforced by CheckConstraint id=1 (D-01/D-02)"
  - "Migration duplicates DEFAULT_SETTINGS literally, never imports app.defaults (D-18, RESEARCH anti-pattern)"
  - "Logo trio (logo_data BYTEA, logo_mime, logo_updated_at) nullable together — no logo = fallback to app_name text"

patterns-established:
  - "Singleton settings table: PK without autoincrement + CHECK(id=1) + seed row in migration"
  - "Migration seed via op.bulk_insert on the returned Table object from op.create_table"

requirements-completed: [SET-02, SET-04, BRAND-04]

duration: 3min
completed: 2026-04-11
---

# Phase 04 Plan 02: App Settings Table Summary

**Singleton `app_settings` table with DB-enforced `CHECK(id=1)`, inline BYTEA logo columns, and canonical DEFAULT_SETTINGS dict as the persistence backbone for v1.1 branding.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-11T08:28:00Z
- **Completed:** 2026-04-11T08:30:30Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- `AppSettings` ORM model appended to `backend/app/models.py` with 12 columns and `ck_app_settings_singleton` CHECK constraint
- `backend/app/defaults.py` created with canonical 8-key `DEFAULT_SETTINGS` dict (source of truth for reset)
- Alembic migration `b2c3d4e5f6a7` chained on `a1b2c3d4e5f6` creating the table and seeding the singleton row via `op.bulk_insert`

## Task Commits

1. **Task 1: Add AppSettings model + DEFAULT_SETTINGS module** — `de315f1` (feat)
2. **Task 2: Alembic migration to create app_settings and seed singleton** — `6bd2067` (feat)

## Files Created/Modified
- `backend/app/models.py` — Added `CheckConstraint` + `BYTEA` imports and `AppSettings` class (6 color columns, app_name, default_language, nullable logo trio)
- `backend/app/defaults.py` — NEW. `DEFAULT_SETTINGS: Final[dict[str, str]]` with oklch defaults, "KPI Light", "EN"
- `backend/alembic/versions/b2c3d4e5f6a7_v1_1_app_settings.py` — NEW. Creates `app_settings` table with `CheckConstraint("id = 1")`, seeds singleton row via `op.bulk_insert`; defaults duplicated literally; `down_revision = "a1b2c3d4e5f6"`

## Decisions Made
None beyond what the plan already specified — implementation followed the plan's code blocks byte-for-byte.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None. `alembic upgrade head` was not executed here because the backend container is owned by Wave 1 / integration plans (04-06); the migration file is valid Python, chains on the correct head, and will be picked up when the compose stack runs.

## Self-Check: PASSED

- FOUND: backend/app/models.py (AppSettings class present, `ck_app_settings_singleton`, `BYTEA`, `logo_updated_at` all grep-verified)
- FOUND: backend/app/defaults.py (`DEFAULT_SETTINGS` grep-verified, oklch seed values present)
- FOUND: backend/alembic/versions/b2c3d4e5f6a7_v1_1_app_settings.py (revision, down_revision, op.bulk_insert, CheckConstraint all grep-verified; no `from app.defaults` import)
- FOUND commit: de315f1 (Task 1)
- FOUND commit: 6bd2067 (Task 2)

## Next Phase Readiness
- Plan 04-03 (Pydantic schemas) can now import `AppSettings` and `DEFAULT_SETTINGS`
- Plan 04-05 (settings router) has the ORM model and singleton contract it needs
- Plan 04-06 (integration) will run `alembic upgrade head` against this migration as part of its compose bring-up

---
*Phase: 04-backend-schema-api-and-security*
*Completed: 2026-04-11*
