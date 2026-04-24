---
phase: 67-migrate-data-py-sales-employees-split
plan: 03
subsystem: frontend/data-fetching
tags: [migration, directus-sdk, employees, overtime, mig-data-02, mig-data-03]
requires:
  - Plan 67-01 (FastAPI /api/data/employees/overtime endpoint)
  - Plan 67-02 (Directus SDK readItems pattern established)
  - Phase 65 (Directus personio_employees Viewer allowlist)
  - Phase 66 (Directus SDK readMe pattern in AuthContext.tsx)
provides:
  - fetchEmployees backed by Directus readItems("personio_employees", ...) (row-data only)
  - fetchEmployeesOvertime calling /api/data/employees/overtime (compute roll-up)
  - useEmployeesWithOvertime composite hook merging rows + overtime via useMemo + Map lookup
affects:
  - frontend/src/lib/api.ts
  - frontend/src/components/dashboard/EmployeeTable.tsx
tech-stack:
  added: []
  patterns:
    - "Composite TanStack-Query hook with two useQuery calls + useMemo merge by id (zero-fill on miss)"
    - "Cache-key namespace separation: rows under ['directus', ...], overtime under its own key"
key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/dashboard/EmployeeTable.tsx
decisions:
  - "fetchEmployees signature drops date_from/date_to per D-15 — they only feed fetchEmployeesOvertime now."
  - "useEmployeesWithOvertime row cache-key namespaced ['directus', 'personio_employees', { search }] — avoids collision with legacy hrKpiKeys.employees (Pitfall 4)."
  - "Overtime cache key ['employeesOvertime', date_from, date_to] — invalidates on date-range change only; search edits don't refetch overtime."
  - "Zero-fill semantics preserved: every employee row appears, with 0/0/null for overtime fields when absent from overtime response (mirrors v1.21 data.py behavior)."
  - "fetchEmployees still zero-fills overtime fields itself — keeps EmployeeRow contract intact for any direct caller."
metrics:
  duration: "~4m"
  completed: "2026-04-24"
  tasks: 2
  files_modified: 2
---

# Phase 67 Plan 03: Migrate fetchEmployees + add useEmployeesWithOvertime hook Summary

**One-liner:** Frontend split: `fetchEmployees` reads only Directus `personio_employees` (9 column-backed fields, no date params), `fetchEmployeesOvertime` calls the new FastAPI compute endpoint, and the composite `useEmployeesWithOvertime` hook merges them via `useMemo` + `Map` with zero-fill — `EmployeeTable.tsx` swaps its `useQuery({queryFn: fetchEmployees})` for the composite hook with no other changes.

## What Changed

`frontend/src/lib/api.ts`:
- Added imports: `useMemo` from React, `useQuery` from `@tanstack/react-query` (`readItems` + `directus` already imported by Plan 02).
- Replaced `fetchEmployees` body. Old path: `apiClient<EmployeeRow[]>(`/api/data/employees?${q}`)`. New path: `directus.request(readItems("personio_employees", { filter, sort, limit, fields }))` returning rows zero-filled on the 3 compute fields. Signature dropped `date_from`/`date_to` per D-15.
- Filter translation:
  - `department` → `department: { _icontains: department }`
  - `status` → `status: { _eq: status }`
  - `search` → `_or: [{ first_name: { _icontains } }, { last_name: { _icontains } }, { position: { _icontains } }]`
- `sort: ["last_name"]`, `limit: 500`, explicit 9-field allowlist (id, first_name, last_name, status, department, position, hire_date, termination_date, weekly_working_hours).
- Added `OvertimeEntry` type + `fetchEmployeesOvertime(date_from, date_to)` calling `/api/data/employees/overtime` via `apiClient`.
- Added `useEmployeesWithOvertime({ search, date_from, date_to })` composite hook: two `useQuery` + `useMemo` merge by `employee_id` with zero-fill on miss.

`frontend/src/components/dashboard/EmployeeTable.tsx`:
- Dropped imports: `useQuery` (no longer used), `fetchEmployees` (replaced by hook), `hrKpiKeys` (no longer referenced).
- Added import: `useEmployeesWithOvertime`.
- Replaced the `useQuery({ queryKey: hrKpiKeys.employees(...), queryFn: fetchEmployees(...) })` block with `useEmployeesWithOvertime({ search, date_from, date_to })`.
- Every other line preserved: name mapping, department filter, segmented filter (overtime/active/all), `useTableState`, columns, JSX.

## Cache Key Namespaces (Claude's Discretion per D)

| Query    | Key                                                              | Invalidates on                  |
| -------- | ---------------------------------------------------------------- | ------------------------------- |
| Rows     | `["directus", "personio_employees", { search }]`                 | search change                   |
| Overtime | `["employeesOvertime", date_from, date_to]`                      | date-range change               |

The deliberate separation:
- Editing the search box only refetches rows (cheap Directus query), not overtime (expensive aggregate).
- Changing the date range only refetches overtime, not rows.
- The `["directus", ...]` namespace prefix avoids collision with legacy `hrKpiKeys.employees` cache entries that may still live in older code paths (Pitfall 4 mitigation). `hrKpiKeys.employees` is no longer referenced from `EmployeeTable.tsx`; the helper itself remains in `queryKeys.ts` for any other consumer.

## Zero-Fill Semantics

Two layers preserve the v1.21 contract that every roster employee appears in the table even when they have no attendance in the window:

1. **`fetchEmployees`** zero-fills `total_hours: 0`, `overtime_hours: 0`, `overtime_ratio: null` for every row before returning. Keeps `EmployeeRow` contract intact for any direct caller (e.g. tests).
2. **`useEmployeesWithOvertime` merge** overrides those zero defaults with values from the overtime response when present, falls back to the same zeros when absent. Backend `hr_overtime` only returns employees with attendance (per Plan 01 D-04), so absences map cleanly to zero.

UI rendering (`row.total_hours > 0 ? "${...}h" : "—"`) was already designed for this contract; no JSX changes needed.

## Triple-Alignment Invariant

Three sources must list the same 9 column-backed fields in the same domain shape:
1. **Pydantic `EmployeeRead`** (`backend/app/schemas/_base.py`) — server-side type.
2. **Directus Viewer allowlist** (`directus/bootstrap-roles.sh:181-202`) — server-side authz gate.
3. **TS `EmployeeRow` (9 column-backed half)** + `fields: [...]` array in `frontend/src/lib/api.ts` — client-side request and type promise.

The 3 compute fields (`total_hours`, `overtime_hours`, `overtime_ratio`) deliberately live on `EmployeeRow` but NOT in the Directus `fields:[]` allowlist (Pitfall 3) — Directus would return them as `null`/`undefined` since they're not real columns. They are hydrated only by the merge hook.

## Dropped Imports / Dead Code Note

From `EmployeeTable.tsx`: `useQuery`, `fetchEmployees`, `hrKpiKeys` removed.

`hrKpiKeys.employees` in `frontend/src/lib/queryKeys.ts` is now unreferenced from the dashboard but the helper file itself was NOT touched in this plan (out of scope). Plan 67-04 (CLEAN) is the right place to audit `queryKeys.ts` for dead helpers.

## Deviations from Plan

None — both tasks executed exactly as written.

## Verification

- `cd frontend && npx tsc --noEmit` exits 0 (zero TS errors) after Task 1.
- `cd frontend && npx tsc --noEmit` exits 0 after Task 2.
- `grep -q 'readItems("personio_employees"' frontend/src/lib/api.ts` PASS
- `grep -q 'fetchEmployeesOvertime' frontend/src/lib/api.ts` PASS
- `grep -q 'useEmployeesWithOvertime' frontend/src/lib/api.ts` PASS
- `grep -q 'useEmployeesWithOvertime' frontend/src/components/dashboard/EmployeeTable.tsx` PASS
- `! grep -q 'fetchEmployees' frontend/src/components/dashboard/EmployeeTable.tsx` PASS
- `! grep -q 'hrKpiKeys' frontend/src/components/dashboard/EmployeeTable.tsx` PASS
- 9-field allowlist (Directus fields list) excludes `total_hours`/`overtime_hours`/`overtime_ratio` PASS

Manual smoke (deferred to post-deploy, requires Plan 01 endpoint live in container):
- `/hr` page loads with same employee rows as v1.21, same columns, same filters.
- Network tab shows two requests: `/directus/items/personio_employees?...` (rows) + `/api/data/employees/overtime?date_from&date_to` (compute). `/api/data/employees?...` is NOT called.
- Date-range picker drives overtime badge updates; employees with no attendance render `—` for the 3 overtime columns.

## Commits

- `cc78bbc` — feat(67-03): migrate fetchEmployees to Directus + add useEmployeesWithOvertime hook
- `77edda3` — feat(67-03): consume useEmployeesWithOvertime in EmployeeTable

## Next Plan

`67-04` — delete `data.py` (`/api/data/employees` + `/api/data/sales`) and the `data_router` import/registration in `main.py`; migrate or delete legacy `data.py` tests; add CI grep guard blocking `/api/data/employees` (non-overtime) and `/api/data/sales` from reappearing in `frontend/src/`.

## Self-Check: PASSED

- frontend/src/lib/api.ts — FOUND (modified)
- frontend/src/components/dashboard/EmployeeTable.tsx — FOUND (modified)
- Commit cc78bbc — FOUND
- Commit 77edda3 — FOUND
- TypeScript compile: PASS (0 errors)
- All acceptance grep predicates: PASS
