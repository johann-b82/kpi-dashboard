---
phase: 15-hr-kpi-cards-dashboard
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, hr-kpis, personio, async]

requires:
  - phase: 12-hr-schema-personio-client
    provides: PersonioEmployee, PersonioAttendance, PersonioAbsence models and Personio sync
  - phase: 13-sync-service-settings-extension
    provides: AppSettings KPI config columns (sick_leave_type_id, production_dept, skill_attr_key)
provides:
  - GET /api/hr/kpis endpoint returning all 5 HR KPIs with prior-period comparisons
  - HrKpiValue and HrKpiResponse Pydantic schemas
  - hr_kpi_aggregation.py service with compute_hr_kpis entry point
affects: [15-02-hr-kpi-cards-frontend, frontend-hr-dashboard]

tech-stack:
  added: []
  patterns: [calendar-month-window-aggregation, sequential-async-kpi-computation, cross-source-kpi-join]

key-files:
  created:
    - backend/app/services/hr_kpi_aggregation.py
    - backend/app/routers/hr_kpis.py
  modified:
    - backend/app/schemas.py
    - backend/app/main.py

key-decisions:
  - "Sequential awaits for all KPI computations on shared AsyncSession (no asyncio.gather)"
  - "Single /api/hr/kpis endpoint returns all 5 KPIs in one response (not per-KPI endpoints)"
  - "Revenue per Production Employee reuses aggregate_kpi_summary for revenue numerator"
  - "Skill development uses JSONB path query on raw_json for configured attribute key"

patterns-established:
  - "HR KPI calendar month windows: _month_bounds + _prev_month helpers for consistent date arithmetic"
  - "Headcount snapshot at end-of-month: _headcount_at_eom with optional department filter"
  - "Configurable KPI pattern: is_configured=False when required AppSettings field is null"

requirements-completed: [HRKPI-01, HRKPI-02, HRKPI-03, HRKPI-04, HRKPI-05, HRKPI-06]

duration: 3min
completed: 2026-04-12
---

# Phase 15 Plan 01: HR KPI Backend Aggregation Summary

**All 5 HR KPI computations (overtime, sick leave, fluctuation, skill dev, revenue/employee) with calendar month windows and prior-period comparisons via GET /api/hr/kpis**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T14:34:34Z
- **Completed:** 2026-04-12T14:37:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- HrKpiValue/HrKpiResponse Pydantic schemas with value, is_configured, previous_period, previous_year fields
- hr_kpi_aggregation.py service with 5 KPI computation functions, 3 helpers, and compute_hr_kpis orchestrator
- GET /api/hr/kpis endpoint registered in FastAPI app, computes fixed calendar month windows server-side
- Cross-source Revenue per Production Employee joins SalesRecord revenue with PersonioEmployee headcount

## Task Commits

Each task was committed atomically:

1. **Task 1: Pydantic schemas + HR KPI aggregation service** - `8c7a649` (feat)
2. **Task 2: HR KPI router and main.py registration** - `2599091` (feat)

## Files Created/Modified
- `backend/app/services/hr_kpi_aggregation.py` - All 5 KPI computation functions + helpers + orchestrator
- `backend/app/routers/hr_kpis.py` - GET /api/hr/kpis endpoint
- `backend/app/schemas.py` - HrKpiValue and HrKpiResponse Pydantic models
- `backend/app/main.py` - Router registration for hr_kpis_router

## Decisions Made
- Sequential awaits for all KPI computations (no asyncio.gather on shared AsyncSession per Pitfall 2)
- Single endpoint returns all 5 KPIs -- avoids N+1 API calls from frontend
- Revenue/employee reuses existing aggregate_kpi_summary for consistent revenue semantics
- Skill development uses JSONB path query rather than separate table (proxy metric)
- Weekday count helper for sick leave denominator (Mon-Fri approximation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Python 3.9 on host cannot import the codebase (uses X | None union syntax); verification done via AST parse + grep checks instead of runtime import. Docker runtime uses Python 3.12+.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend endpoint ready for frontend consumption in Plan 15-02
- HrKpiResponse shape matches UI-SPEC card requirements (5 KPIs, each with value/is_configured/previous_period/previous_year)
- No blockers for frontend integration

---
*Phase: 15-hr-kpi-cards-dashboard*
*Completed: 2026-04-12*
