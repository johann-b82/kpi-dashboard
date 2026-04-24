# Phase 67: Migrate `data.py` — Sales + Employees split - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 67-migrate-data-py-sales-employees-split
**Areas discussed:** Frontend fetch shape, Overtime endpoint shape, Sales filter translation, data.py fate + file layout

---

## Frontend fetch shape

### Wrapper placement

| Option | Description | Selected |
|--------|-------------|----------|
| Replace internals, keep signatures | fetchSalesRecords / fetchEmployees stay in lib/api.ts; internals swap from apiClient to directus.request(readItems). Types kept. Minimum caller churn. Mirrors Phase 66. | ✓ |
| Delete wrappers, hooks call SDK | Remove wrappers and Row types; new useSalesRecords / useEmployees hooks own the SDK call; components import hooks. | |
| New hooks next to wrappers | Keep wrappers as migration shim; add hooks that call SDK directly; migrate components; delete wrappers after. Two-step. | |

### Typing

| Option | Description | Selected |
|--------|-------------|----------|
| Keep hand-written Row types | SalesRecordRow / EmployeeRow stay in lib/api.ts. Matches Viewer allowlist 1:1. Stable. | ✓ |
| Generate Directus schema types | Run SDK type-generation; readItems infers. Adds build step / artifact to sync. | |

---

## Overtime endpoint shape

### Response shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array of rows | [{employee_id, total_hours, overtime_hours, overtime_ratio}, ...]. Explicit, easy to merge. | ✓ |
| Map keyed by employee_id | Object keyed by id; cheaper lookup but awkward numeric keys. | |
| Composite (backend merges) | Backend fetches rows + computes + returns joined; re-introduces row-data responsibility. Contradicts the split. | |

### Default-date behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Require both — 422 if missing | No fallback; frontend always passes explicit range. Matches MIG-DATA-03 wording. | ✓ |
| Fallback to current month | Parity with today; leaks default into API contract. | |

### Merge location

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend React Query merge | Two hooks (useEmployees + useEmployeesOvertime); useMemo joins by employee_id. Clean split, independent invalidation. | ✓ |
| Single composite hook | One hook fires both requests in parallel; returns joined array. Harder to invalidate independently. | |

---

## Sales filter translation

### Date range

| Option | Description | Selected |
|--------|-------------|----------|
| _between with [start, end] | Use `_between` when both set; fall back to `_gte` / `_lte` for single-sided. | ✓ |
| Always _gte + _lte pair | `_and` of two operators regardless; verbose, same semantics. | |

### Multi-field search

| Option | Description | Selected |
|--------|-------------|----------|
| _or with _icontains per field | 1:1 replacement of today's ilike OR chain over order_number / customer_name / project_name. | ✓ |
| Full-text `search` param | Directus top-level search; scans all string fields. Behavior change. | |

### Row cap

| Option | Description | Selected |
|--------|-------------|----------|
| Keep limit: 500 | Same as today. No behavior change. | ✓ |
| Raise cap | e.g. 2000 or unlimited. Regresses paint time on slow tables. Out of scope. | |

### Sort preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror server-side sort | `sort: ['-order_date']` for sales; `sort: ['last_name']` for employees. Preserves paint order. | ✓ |
| Drop server sort, sort on frontend | Skip sort param; table sorts after fetch. First-paint order changes until JS sorts. | |

---

## data.py fate + file layout

### File location

| Option | Description | Selected |
|--------|-------------|----------|
| New backend/app/routers/hr_overtime.py | Delete data.py; purpose-named file. | ✓ |
| Reduce data.py to overtime only | Keep filename, shrink to one GET. Leaves grab-bag name. | |
| Move into hr_kpis.py | Mix per-employee rows with aggregate KPIs — different consumer shapes. | |

### Route prefix

| Option | Description | Selected |
|--------|-------------|----------|
| /api/data/employees/overtime | Exact spec wording (MIG-DATA-03). Router `prefix="/api/data"`. | ✓ |
| /api/hr/overtime | Matches hr_kpis.py neighborhood. Requires updating spec wording. | |

### Test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Port existing data.py overtime tests | Preserve all compute edge cases (null times, zero hours, break subtraction, weekly_hours fallback). Add 422 test. | ✓ |
| Fresh tests only | Cleaner contract; loses existing edge-case coverage. | |

---

## Claude's Discretion

- React Query `queryKey` shape for `useEmployeesOvertime`.
- `staleTime` for the two new hooks.
- `useQueries` vs two `useQuery` calls.
- Exact 422 `detail` message wording.
- Row type property order.
- Grep-guard quote-style in YAML.

## Deferred Ideas

- Directus schema type-generation (`schema.d.ts`).
- Pagination beyond 500-row cap.
- Top-level Directus full-text `search`.
- Moving `hr_overtime.py` and `hr_kpis.py` under a shared `hr/` package.
