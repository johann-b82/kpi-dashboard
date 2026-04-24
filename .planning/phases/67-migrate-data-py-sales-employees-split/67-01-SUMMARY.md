---
phase: 67-migrate-data-py-sales-employees-split
plan: 01
subsystem: backend/api
tags: [backend, hr, overtime, fastapi, mig-data]
requires:
  - PersonioAttendance + PersonioEmployee models (existing)
  - get_current_user Directus JWT dep (existing)
  - get_async_db_session (existing)
provides:
  - GET /api/data/employees/overtime?date_from&date_to → flat array of {employee_id, total_hours, overtime_hours, overtime_ratio}
  - hr_overtime_router registered in app.main alongside data_router
affects:
  - backend/app/main.py (router registration, +2 lines)
  - frontend Plans 67-02 / 67-03 unblocked (compute endpoint live alongside legacy /api/data/employees)
tech-stack:
  added: []
  patterns:
    - Compute-only FastAPI endpoint with required Query(...) params (FastAPI-native 422 on missing)
    - Inverted-range guard returns 422 (D-07 — diverges from data.py 400)
key-files:
  created:
    - backend/app/routers/hr_overtime.py
    - backend/tests/test_hr_overtime_router.py
  modified:
    - backend/app/main.py
decisions:
  - "Endpoint returns flat dict array (not Pydantic model) — D-04. Frontend zero-fills missing employees."
  - "Inverted range → 422 (FastAPI semantic) instead of 400 (data.py legacy) — D-07."
  - "data_router stays mounted; Plan 04 removes after frontend Plans 02/03 migrate consumers."
metrics:
  duration: "~3 min"
  completed: 2026-04-24
---

# Phase 67 Plan 01: hr_overtime endpoint Summary

**One-liner:** New compute-only `GET /api/data/employees/overtime` endpoint lifts the data.py overtime aggregation block verbatim into a purpose-named `hr_overtime.py` router and registers it alongside the still-live `data_router` so frontend Plans 02/03 can build against it before Plan 04 deletes data.py.

## What Shipped

- **`backend/app/routers/hr_overtime.py`** — new router file (98 LOC). Single endpoint `@router.get("/employees/overtime")` with router-level prefix `/api/data`, tags `["data"]`, dependencies `[Depends(get_current_user)]`. Required `date_from: date = Query(...)` + `date_to: date = Query(...)` → FastAPI-native 422 on absence. Inverted range raises `HTTPException(status_code=422, detail="date_from must be <= date_to")`. Compute body byte-equivalent to `data.py:89-125` overtime block; trailing employee-loop swapped from `EmployeeRead` mutation to flat-dict assembly per D-04. Response shape: `list[{"employee_id": int, "total_hours": float, "overtime_hours": float, "overtime_ratio": float | None}]` — only employees WITH attendance appear; `overtime_ratio` is `None` when `total == 0` or `ot == 0` (preserves D-08 predicate `total > 0 and ot > 0`).
- **`backend/app/main.py`** — added `from app.routers.hr_overtime import router as hr_overtime_router` immediately below the `data_router` import, and `app.include_router(hr_overtime_router)` immediately below `app.include_router(data_router)`. `data_router` intentionally untouched (Plan 04 removes).
- **`backend/tests/test_hr_overtime_router.py`** — 6 tests covering: module-level route registration, 422 for missing date_from/date_to/both, 422 with exact detail string for inverted range, 401 for unauthenticated. All 6 pass; existing `tests/test_rbac.py` GET routes still pass (24/24).

## Behavior Contract

| Request                                                        | Status | Body                                                                           |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| GET /employees/overtime (no auth)                              | 401    | `{"detail":"..."}` from get_current_user                                       |
| GET /employees/overtime + valid auth, no params                | 422    | FastAPI Query(...) missing-param shape                                         |
| GET /employees/overtime + valid auth, only date_from           | 422    | FastAPI Query(...) missing-param shape                                         |
| GET /employees/overtime + valid auth, date_from > date_to      | 422    | `{"detail":"date_from must be <= date_to"}`                                    |
| GET /employees/overtime + valid auth, valid range, no rows     | 200    | `[]`                                                                           |
| GET /employees/overtime + valid auth, valid range, attendance  | 200    | `[{"employee_id":N, "total_hours":X.X, "overtime_hours":Y.Y, "overtime_ratio":Z.ZZZZ\|null}, ...]` |

## Note on `data_router`

`data_router` is **still mounted** with `/api/data/sales` + `/api/data/employees`. This is deliberate per the phase sequencing:

- Plan 02 migrates frontend `fetchSalesRecords` → Directus SDK
- Plan 03 migrates frontend employees fetch → Directus SDK + new `/api/data/employees/overtime`
- Plan 04 deletes `data.py` + the `data_router` import/registration

Both routers share the `/api/data` prefix without route collision because the new endpoint path (`/employees/overtime`) does not conflict with `data.py`'s `/sales` or `/employees`.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 produced byte-for-byte the action blocks specified.

## Verification

- `docker exec kpi-dashboard-api-1 python -c "from app.routers.hr_overtime import router; ..."` → OK
- `docker exec kpi-dashboard-api-1 python -c "from app.main import app; paths = {r.path for r in app.routes}; assert '/api/data/employees/overtime' in paths and '/api/data/sales' in paths and '/api/data/employees' in paths"` → OK
- `docker exec kpi-dashboard-api-1 python -m pytest tests/test_hr_overtime_router.py` → 6 passed
- `docker exec kpi-dashboard-api-1 python -m pytest tests/test_rbac.py -k GET` → 24 passed (no regression)
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/openapi.json` → 200; OpenAPI confirms route presence

**Note on plan's curl assertion:** The plan's verification section suggested `curl http://localhost:8000/api/data/employees/overtime` should return 422 for missing params. In reality the router-level `Depends(get_current_user)` runs before query validation, so unauthenticated requests return 401 — query validation 422 only surfaces with a valid bearer token (verified in the test suite). This is FastAPI's documented dependency-resolution order, not a plan defect.

## Commits

- `38c9524` — test(67-01): add failing tests for hr_overtime router
- `ca819cf` — feat(67-01): add hr_overtime router with GET /employees/overtime
- `730d4df` — feat(67-01): register hr_overtime_router in main.py

## Self-Check: PASSED

- backend/app/routers/hr_overtime.py — FOUND
- backend/tests/test_hr_overtime_router.py — FOUND
- backend/app/main.py — MODIFIED (registration committed)
- Commits 38c9524, ca819cf, 730d4df — all present in git log

