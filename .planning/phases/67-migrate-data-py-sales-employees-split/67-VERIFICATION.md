---
phase: 67-migrate-data-py-sales-employees-split
verified: 2026-04-24T00:00:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 67: Migrate data.py — Sales + Employees Split — Verification Report

**Phase Goal:** Sales and HR row-data lookups come from Directus; overtime roll-up per employee stays in FastAPI; frontend tables render the same rows and compute values as v1.21 with no user-visible regression.

**Verified:** 2026-04-24
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                       | Status     | Evidence                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1   | `/sales` renders via Directus SDK from `sales_records`; `GET /api/data/sales` removed                       | VERIFIED   | `api.ts:407` calls `readItems("sales_records", {...})`; no `/api/data/sales` route in `main.py`; `data.py` deleted |
| 2   | `/hr` employees renders via Directus `personio_employees`; row-data portion of `GET /api/data/employees` removed | VERIFIED   | `api.ts:471` calls `readItems("personio_employees", {...})`; `data_router` removed from `main.py`         |
| 3   | New FastAPI `GET /api/data/employees/overtime?date_from&date_to` returns per-employee roll-up               | VERIFIED   | `hr_overtime.py` exists (98 lines); router prefix `/api/data` + route `/employees/overtime`; registered in `main.py:30` |
| 4   | Frontend merges Directus rows with overtime compute response                                                | VERIFIED   | `useEmployeesWithOvertime` hook (`api.ts:535`) merges via `useMemo`+Map; `EmployeeTable.tsx:8,28` consumes it |
| 5   | `data.py` deleted; tests migrated/removed; no orphaned imports                                              | VERIFIED   | File deleted; no `data_router` references in `main.py` or any backend file; `test_hr_overtime_endpoint.py` exists with 6 compute + 3 422 tests |
| 6   | Overtime endpoint returns 422 on missing/inverted date params                                               | VERIFIED   | Test suite passes (54 passed, 2 skipped per user note); `hr_overtime.py:36-40` raises 422 on inverted; `Query(...)` enforces required params |
| 7   | CI guard fails on regression (`/api/data/sales` or `/api/data/employees` literal in `backend/app/`)         | VERIFIED   | `ci.yml:86-95` guard step present with MIG-DATA-04 tag; allows `/overtime` via `[^/"]` exclusion          |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                  | Expected                                                                  | Status     | Details                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `backend/app/routers/hr_overtime.py`                      | New router with single GET /employees/overtime, /api/data prefix, auth dep | VERIFIED   | 98 lines, prefix=`/api/data`, tags=`["data"]`, deps=`[Depends(get_current_user)]`    |
| `backend/app/main.py`                                     | hr_overtime_router imported + registered; data_router gone                | VERIFIED   | Line 15 imports, line 30 registers; no data_router anywhere                          |
| `backend/app/routers/data.py`                             | DELETED                                                                   | VERIFIED   | File does not exist                                                                  |
| `frontend/src/lib/api.ts`                                 | Directus SDK for sales + employees + overtime fetcher + composite hook    | VERIFIED   | All four pieces present (lines 379, 471, 510, 535)                                   |
| `frontend/src/components/dashboard/EmployeeTable.tsx`     | Consumes useEmployeesWithOvertime                                         | VERIFIED   | Line 8 imports hook, line 28 consumes it                                             |
| `backend/tests/test_hr_overtime_endpoint.py`              | New test file with compute + 422 cases                                    | VERIFIED   | 285 lines; 6 compute tests + 3 422 tests = 9 (grep counts 11 with shared lines)      |
| `.github/workflows/ci.yml`                                | New guard step blocking regressions                                       | VERIFIED   | Step at line 86 with MIG-DATA-04 tag                                                 |

### Key Link Verification

| From                                                  | To                                              | Via                                            | Status | Details                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `backend/app/main.py`                                 | `backend/app/routers/hr_overtime.py`            | `app.include_router(hr_overtime_router)`       | WIRED  | main.py:15 imports; main.py:30 registers                                      |
| `backend/app/routers/hr_overtime.py`                  | `backend/app/models.py`                         | `from app.models import PersonioAttendance, PersonioEmployee` | WIRED  | hr_overtime.py:20                                                            |
| `frontend/src/lib/api.ts`                             | Directus SDK                                    | `directus.request(readItems(...))`             | WIRED  | sales_records (line 407), personio_employees (line 471)                       |
| `frontend/src/lib/api.ts`                             | `/api/data/employees/overtime` (Plan 01 endpoint) | `apiClient<OvertimeEntry[]>(...)`              | WIRED  | api.ts:516                                                                    |
| `frontend/src/components/dashboard/EmployeeTable.tsx` | `frontend/src/lib/api.ts`                       | `import { useEmployeesWithOvertime }`          | WIRED  | EmployeeTable.tsx:8,28                                                        |
| `.github/workflows/ci.yml`                            | `backend/app/`                                  | grep guard fails on dying-endpoint literals    | WIRED  | ci.yml:91 grep pattern with `/overtime` exclusion                             |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable                              | Source                                                         | Produces Real Data | Status   |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------------ | -------- |
| `hr_overtime.py` GET endpoint     | `total_map`/`overtime_map` → result list   | SQLAlchemy join PersonioAttendance↔PersonioEmployee with date filter | Yes (real DB query) | FLOWING  |
| `fetchSalesRecords` (api.ts)      | `rows` → `SalesRecordRow[]`                | Directus `readItems('sales_records', {filter, sort, limit, fields:[10]})` | Yes (real Directus query) | FLOWING |
| `fetchEmployees` (api.ts)         | `rows` → `EmployeeRow[]`                   | Directus `readItems('personio_employees', {filter, sort, limit, fields:[9]})` | Yes (real Directus query, compute fields zero-filled by design) | FLOWING |
| `fetchEmployeesOvertime` (api.ts) | `OvertimeEntry[]`                          | `apiClient<OvertimeEntry[]>('/api/data/employees/overtime?...')` | Yes (calls live FastAPI endpoint) | FLOWING |
| `useEmployeesWithOvertime` hook   | merged `EmployeeRow[]`                     | useMemo merge of two useQuery results, keyed by employee_id    | Yes (real merge, zero-fill semantics preserve v1.21 behavior) | FLOWING |
| `EmployeeTable.tsx`               | `data` from hook                           | `useEmployeesWithOvertime({search, date_from, date_to})`        | Yes                | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                                         | Command                                                                  | Result                | Status |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------- | ------ |
| `data.py` is deleted                                                             | `test -f backend/app/routers/data.py`                                    | exit 1 (not found)    | PASS   |
| `hr_overtime.py` exists with 98 lines (substantive, not stub)                    | `wc -l backend/app/routers/hr_overtime.py`                               | 98 lines              | PASS   |
| Phase 67 directly-touched test files all pass                                    | `pytest test_hr_overtime_endpoint test_hr_kpi_range test_rbac test_permission_field_allowlists` (per user) | 54 passed, 2 skipped  | PASS   |
| No `/api/data/sales` or bare `/api/data/employees` literal in backend/app/       | `grep -rn '/api/data/sales\|"/api/data/employees"' backend/app/`         | No matches            | PASS   |
| No `data_router` references anywhere in backend                                  | `grep -rn 'data_router\|from app.routers.data' backend`                  | No matches            | PASS   |
| RBAC test exercises overtime route (replaces dead routes)                        | `grep '/api/data/employees/overtime' backend/tests/test_rbac.py`         | line 21 hit           | PASS   |
| CI guard regex blocks dying endpoints AND allows /overtime                        | `grep MIG-DATA-04 .github/workflows/ci.yml`                              | line 78, 86           | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                        | Status    | Evidence                                                                    |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------- |
| MIG-DATA-01 | 67-02       | Frontend `/sales` consumes `sales_records` via Directus SDK; old `GET /api/data/sales` removed                     | SATISFIED | `api.ts:407` readItems("sales_records"); no /api/data/sales in backend/app/ |
| MIG-DATA-02 | 67-03       | Frontend `/hr` row-data via Directus `personio_employees`; row-data portion of `GET /api/data/employees` removed   | SATISFIED | `api.ts:471` readItems("personio_employees"); data.py deleted               |
| MIG-DATA-03 | 67-01, 67-03 | New FastAPI `GET /api/data/employees/overtime`; frontend merges Directus rows with compute response                | SATISFIED | `hr_overtime.py` endpoint + `useEmployeesWithOvertime` merge hook           |
| MIG-DATA-04 | 67-04       | `data.py` deleted; router registration updated; tests migrated/removed                                             | SATISFIED | data.py absent; main.py cleaned; test_rbac/test_hr_kpi_range updated; new test_hr_overtime_endpoint.py + CI guard |

**Note:** REQUIREMENTS.md still marks MIG-DATA-04 as "Pending" in the requirements traceability table (line 135). This is a documentation lag — the underlying work is satisfied. Recommend updating REQUIREMENTS.md `[ ]` → `[x]` and the table row to "Complete" as a follow-up.

**No orphaned requirements** — all four MIG-DATA-* IDs from REQUIREMENTS.md are claimed by Phase 67 plans.

### Anti-Patterns Found

| File                                  | Line | Pattern                                | Severity | Impact                                                                  |
| ------------------------------------- | ---- | -------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `frontend/src/lib/api.ts`             | 379  | Comment string `GET /api/data/sales`   | Info     | Inside code comment explaining swap; not a live reference; CI guard scans backend/ only |

No blockers. No stubs. All implementations substantive (hr_overtime.py is the verbatim-lifted compute loop; api.ts uses real SDK calls; merge hook uses real useMemo+Map; tests exercise real DB seeded fixtures).

### Human Verification Required

The following items remain outside automated verification scope but are not blockers:

1. **Manual smoke — `/sales` page renders identical rows to v1.21**
   - Test: Load `/sales` with Directus Viewer session; compare rows with v1.21 snapshot
   - Expected: Same row count, same column values, same default sort (descending order_date)
   - Why human: Visual comparison; needs running stack with seeded data

2. **Manual smoke — `/hr` page renders identical rows + overtime badges to v1.21**
   - Test: Load `/hr` with date-range covering known attendance; verify total_hours/overtime_hours/overtime_ratio badges match v1.21
   - Expected: All employees appear (zero-fill for those without attendance); overtime values compute identically
   - Why human: Visual comparison; user-visible regression check per phase goal

3. **Manual smoke — Network tab shows correct endpoints**
   - Test: Open browser devtools → Network → load /sales and /hr
   - Expected: `/directus/items/sales_records?...` for sales; `/directus/items/personio_employees?...` + `/api/data/employees/overtime?...` for HR; NO `/api/data/sales` or bare `/api/data/employees` calls
   - Why human: Requires running stack + browser

### Gaps Summary

No gaps. Phase 67 achieved its goal:

- Sales row-data: Directus SDK `readItems('sales_records')` (MIG-DATA-01)
- Employee row-data: Directus SDK `readItems('personio_employees')` (MIG-DATA-02)
- Overtime compute: Preserved verbatim in new `hr_overtime.py` at `/api/data/employees/overtime` (MIG-DATA-03)
- Frontend merge: `useEmployeesWithOvertime` composite hook with zero-fill semantics matching v1.21 (MIG-DATA-03)
- `data.py` deleted, main.py cleaned, tests migrated, CI guard active (MIG-DATA-04)

Phase 67 directly-touched tests pass (54 passed, 2 skipped per user). Pre-existing unrelated failures (test_color_validator collection error; 29 401 auth errors in test_kpi_chart/test_kpi_endpoints/test_settings_api/test_signage_*) are noted as out-of-scope for this verification.

**Follow-up recommended (not a Phase 67 gap):**
- Update `REQUIREMENTS.md` to mark MIG-DATA-04 as `[x]` Complete (line 82) and flip the traceability table row (line 135) from Pending to Complete.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
