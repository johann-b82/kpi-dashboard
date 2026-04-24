---
phase: 67-migrate-data-py-sales-employees-split
plan: 04
subsystem: api
tags: [fastapi, cleanup, ci-guard, pytest, directus]

requires:
  - phase: 67-01
    provides: hr_overtime router (kept registered after data.py removal)
  - phase: 67-02
    provides: fetchSalesRecords on Directus SDK (frontend off /api/data/sales)
  - phase: 67-03
    provides: fetchEmployees on Directus + composite overtime hook (frontend off /api/data/employees)
provides:
  - Deletion of backend/app/routers/data.py and its main.py registration
  - Dedicated test_hr_overtime_endpoint.py (8 tests; 400→422 update)
  - test_rbac.py READ_ROUTES swapped: dropped /api/data/sales + /api/data/employees, added /api/data/employees/overtime
  - CI grep guard preventing reintroduction of /api/data/sales or /api/data/employees in backend/app/
affects: [future migrations off legacy /api/data/* endpoints, RBAC test surface]

tech-stack:
  added: []
  patterns:
    - "CI grep guard modeled on Phase 66 /api/me guard (regex allows /api/data/employees/overtime)"

key-files:
  created:
    - backend/tests/test_hr_overtime_endpoint.py
  modified:
    - backend/app/main.py
    - backend/tests/test_rbac.py
    - backend/tests/test_hr_kpi_range.py
    - backend/tests/signage/test_permission_field_allowlists.py
    - .github/workflows/ci.yml
  deleted:
    - backend/app/routers/data.py

key-decisions:
  - "CI guard regex permits /api/data/employees/overtime explicitly (trailing non-/ char check) so the new endpoint isn't flagged"
  - "Overtime test cases extracted into a dedicated file rather than left in test_hr_kpi_range.py to keep concerns single-purpose"

patterns-established:
  - "Pre-stack grep guards in CI: copy Phase 66 /api/me pattern when retiring legacy endpoints"

requirements-completed:
  - MIG-DATA-04

duration: ~35min
completed: 2026-04-24
---

# Phase 67-04: Delete data.py + tests + CI guard

**Legacy data.py router removed; overtime endpoint isolated in its own test file; CI guard prevents regression.**

## Performance

- **Duration:** ~35 min (including stream-timeout recovery)
- **Completed:** 2026-04-24
- **Tasks:** 2/2
- **Files modified:** 6 (1 deleted, 1 created, 4 modified, plus CI workflow)

## Accomplishments
- Deleted `backend/app/routers/data.py` (127 lines) and removed its main.py import + registration
- Ported overtime compute tests into dedicated `test_hr_overtime_endpoint.py` (8 tests; 5 compute + 3 × 422)
- Updated `test_rbac.py` READ_ROUTES: dropped `/api/data/sales` + bare `/api/data/employees`, added `/api/data/employees/overtime` with valid date params
- Added CI grep guard modeled on Phase 66's `/api/me` guard

## Task Commits

1. **Task 1: Delete data.py + add overtime endpoint test suite** — `fa70e5e` (feat)
2. **Task 2: Add CI guard for legacy /api/data/* endpoints** — `8f640cd` (chore)

## Files Created/Modified
- `backend/app/routers/data.py` — DELETED
- `backend/app/main.py` — Removed `data_router` import + registration; `hr_overtime_router` remains
- `backend/tests/test_hr_overtime_endpoint.py` — NEW; 8 tests (compute + 422 cases)
- `backend/tests/test_hr_kpi_range.py` — Removed `test_employees_range_scopes_attendance` + `/api/data/employees` parametrize row
- `backend/tests/test_rbac.py` — READ_ROUTES swap
- `backend/tests/signage/test_permission_field_allowlists.py` — Updated stale comments to reflect Phase 67 complete
- `.github/workflows/ci.yml` — New "Guard — no /api/data/sales or /api/data/employees in backend" step

## Verification
- 54/54 targeted backend tests pass
- CI guard regex explicitly allows `/api/data/employees/overtime`

## Notes
Stream timeout occurred after both task commits landed; SUMMARY.md was authored inline by the orchestrator from the executor's commit messages and verification output.
