# Phase 67: Migrate `data.py` — Sales + Employees split - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Row-data lookups for `/sales` and `/hr` tables move from FastAPI to Directus; overtime roll-up per employee stays in FastAPI as a new dedicated endpoint. `data.py` is deleted. No user-visible regression vs v1.21 row contents, sort order, or overtime badge values.

**In scope:**
1. `fetchSalesRecords` (frontend) swaps from `apiClient("/api/data/sales?...")` to `directus.request(readItems("sales_records", { filter, sort, limit }))`. Public signature + `SalesRecordRow` type unchanged.
2. `fetchEmployees` (frontend) swaps row-data source to `directus.request(readItems("personio_employees", ...))`. Overtime fields on `EmployeeRow` are hydrated via a separate React Query merge.
3. New FastAPI `GET /api/data/employees/overtime?date_from&date_to` returns `[{employee_id, total_hours, overtime_hours, overtime_ratio}, ...]` over the requested window. 422 when either date is missing.
4. New file `backend/app/routers/hr_overtime.py` owns the overtime endpoint. `backend/app/routers/data.py` deleted. `main.py` registration updated.
5. Backend tests: port existing overtime compute assertions from `data.py` tests to the new endpoint; add 422-on-missing-dates test.
6. CI grep guard extends from Phase 66 to also fail on `"/api/data/sales"` and `"/api/data/employees"` reappearing in `backend/app/`.

**Not in scope:**
- Any signage endpoint migration (Phases 68–70).
- Settings, uploads, sensors, media/PPTX, `signage_player`, `signage_pair` — stay in FastAPI.
- HR aggregated KPI endpoints (`hr_kpis.py`) — untouched.
- Directus type-generation / schema.d.ts — deliberately skipped (D-06).
- Pagination beyond today's 500-row cap — out of scope (D-14).
- Changes to Phase 65's Viewer field allowlists — locked.

</domain>

<decisions>
## Implementation Decisions

### Architectural locks carried from earlier phases (not revisited)
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton (Phase 29/64; reused Phase 66).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin default via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer field allowlist on `sales_records` + `personio_employees` locked in Phase 65 (AUTHZ-01). Any field read via `readItems` must already be in that allowlist — planner validates.
- **D-00d:** CI grep-guard pattern from Phase 66 (`"/api/me"` in `frontend/src/`) is the template for this phase's additional guards.
- **D-00e:** `--workers 1` invariant remains; SSE bridge (Phase 65) is not relevant to sales/HR (no SSE on these tables).

### Frontend fetch shape
- **D-01:** `fetchSalesRecords` and `fetchEmployees` in `frontend/src/lib/api.ts` keep their public signatures. Internals swap from `apiClient(...)` to `directus.request(readItems(...))`. Callers (`SalesTable.tsx`, HR table) are not touched except where D-05 requires the employee merge.
- **D-02:** `SalesRecordRow` and `EmployeeRow` types remain hand-written in `lib/api.ts`. No Directus schema type-generation. Field sets are small and stable; keeping them hand-maintained makes the Viewer-allowlist diff explicit.
- **D-03:** `EmployeeRow` retains `total_hours`, `overtime_hours`, `overtime_ratio` fields. These are populated by the frontend merge (D-05), not by the Directus fetch.

### Overtime endpoint shape
- **D-04:** Response is a flat array: `[{employee_id: int, total_hours: float, overtime_hours: float, overtime_ratio: float | null}, ...]`. Only employees with attendance in the requested window appear. Callers expecting a zeroed entry for every employee must derive that on the frontend from the Directus row list.
- **D-05:** Merge happens on the frontend. `useEmployees` (Directus) and `useEmployeesOvertime` (FastAPI) are two React Query hooks; a `useMemo` joins them by `employee_id` and zero-fills the three overtime fields for employees not present in the overtime response. Consumers keep reading the same `EmployeeRow[]` shape.
- **D-06:** Missing `date_from` or `date_to` → FastAPI returns `422` with a clear `detail` message. No fallback to current month. Frontend is expected to pass an explicit range (HR page already owns a date-range filter since Phase 60).
- **D-07:** Both dates must be ≤ each other; `date_from > date_to` → `422`. Preserves today's contract.
- **D-08:** Compute logic is lifted verbatim from `data.py`:
  - Pull `PersonioAttendance` × `PersonioEmployee` rows over the window via the existing join.
  - For each row with both `start_time` and `end_time`: `worked = (end_min − start_min − break_minutes) / 60`; skip if `worked ≤ 0`.
  - `daily_quota = weekly_working_hours / 5.0` (fallback `8.0`); `overtime = max(0, worked − daily_quota)`.
  - Round `total_hours` and `overtime_hours` to 1 decimal; `overtime_ratio = round(ot / total, 4)` only when `total > 0 and ot > 0` else `null`.
- **D-09:** `_month_bounds` helper from `backend/app/services/hr_kpi_aggregation.py` is no longer imported by the new endpoint (no fallback). It remains in place for other HR KPI code.

### Sales filter translation
- **D-10:** Date range → `{ order_date: { _between: [start_date, end_date] } }` when both dates set. When only `start_date` is set → `{ order_date: { _gte: start_date } }`. When only `end_date` is set → `{ order_date: { _lte: end_date } }`. Preserves today's "either-or-both" permissiveness.
- **D-11:** `customer` param → `{ customer_name: { _icontains: customer } }` (1:1 replacement of today's `ilike %customer%`).
- **D-12:** `search` param → `{ _or: [{ order_number: { _icontains: search } }, { customer_name: { _icontains: search } }, { project_name: { _icontains: search } }] }`. Exact mirror of today's ilike OR chain across the same three fields. Top-level Directus `search` param is NOT used (would scan additional fields and change match behavior).
- **D-13:** Sort is preserved server-side: sales → `sort: ['-order_date']`; employees → `sort: ['last_name']`. Directus puts nulls last by default for descending/ascending; matches today's `nullslast()`.
- **D-14:** Row cap stays at 500: pass `limit: 500` to both `readItems` calls. Matches today's `.limit(500)`. Pagination is out of scope.
- **D-15:** Employees filters: `department` → `{ department: { _icontains } }`; `status` → `{ status: { _eq } }`; `search` → `{ _or: [{ first_name: { _icontains } }, { last_name: { _icontains } }, { position: { _icontains } }] }`. `date_from` / `date_to` on `fetchEmployees` stop being sent to the Directus call — they only feed the overtime hook (D-05).

### data.py fate + file layout
- **D-16:** `backend/app/routers/data.py` is deleted in full. Not reduced.
- **D-17:** New file `backend/app/routers/hr_overtime.py` owns the overtime endpoint. Dedicated, grep-able, no "data" grab-bag filename left behind.
- **D-18:** Route path stays verbatim per ROADMAP / REQUIREMENTS.md MIG-DATA-03 wording: `GET /api/data/employees/overtime`. Router `prefix="/api/data"`, `tags=["data"]`. File name and route prefix diverge intentionally — file name reflects purpose, path reflects spec.
- **D-19:** `backend/app/main.py` removes `data` router include and adds `hr_overtime` router include.
- **D-20:** Tests: `backend/tests/test_data_router.py` (or equivalent existing test for data.py) is deleted. Its overtime compute assertions — including the edge cases (null start/end times → skipped, zero hours → skipped, break-minute subtraction, weekly_working_hours fallback to 8h, `overtime_ratio` null when total=0 or ot=0) — are ported to `backend/tests/test_hr_overtime_endpoint.py`. One new 422 test verifies the missing/inverted date behavior from D-06/D-07.
- **D-21:** CI guard: add a pre-stack grep step to `.github/workflows/ci.yml` that fails if either of these literals appears under `backend/app/`: `"/api/data/sales"` or `"/api/data/employees"` (but NOT `"/api/data/employees/overtime"`). Extends the Phase 66 guard pattern; satisfies CLEAN-04 (b).

### Claude's Discretion
- Exact React Query `queryKey` shape for `useEmployeesOvertime` (e.g., `['employeesOvertime', date_from, date_to]`) — planner picks; principle is invalidate-on-date-range-change only.
- `staleTime` / cache TTL for the two new hooks — planner picks the project default.
- Whether `useEmployees` and `useEmployeesOvertime` fire in parallel via `useQueries` or two separate `useQuery` calls — planner picks based on existing code patterns.
- Exact wording of the 422 `detail` message.
- Whether to keep or reshape `SalesRecordRow` / `EmployeeRow` property order — cosmetic.
- Whether to grep guard literals use single-quote or double-quote form in the YAML — match Phase 66 guard style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone v1.22 research
- `.planning/research/SUMMARY.md` — milestone executive summary, endpoint-migration sequencing.
- `.planning/research/FEATURES.md` — per-endpoint verdicts including `data.py` sales + employees split rationale.
- `.planning/research/ARCHITECTURE.md` — Directus-SDK frontend pattern, permission model.
- `.planning/research/PITFALLS.md` — Viewer field leak (P9/P15) applies here.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §MIG-DATA-01..04 — acceptance criteria this phase satisfies.
- `.planning/REQUIREMENTS.md` §CLEAN-04 (b) — CI guard requirement for `/api/data/sales` + `/api/data/employees`.
- `.planning/REQUIREMENTS.md` §AUTHZ-01 — Viewer field allowlists on `sales_records` + `personio_employees` (locked in Phase 65).
- `.planning/ROADMAP.md` §"Phase 67" — goal, success criteria, exact endpoint paths.
- `.planning/PROJECT.md` — project constraints (Dockerized, Directus 11, `--workers 1`).

### Prior phase contexts (direct precedents)
- `.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md` — snapshot apply, Viewer allowlists, trigger bridge.
- `.planning/phases/66-kill-me-py/66-CONTEXT.md` — Directus SDK call pattern (`directus.request(readMe(...))`), CI grep-guard template, apiClient → SDK swap mechanics.
- `.planning/phases/66-kill-me-py/66-01-SUMMARY.md` — implementation details for the `readMe` swap pattern to mirror.

### Existing code integration points
- `backend/app/routers/data.py` — source code + behavior being migrated (deleted in this phase).
- `backend/app/routers/hr_kpis.py` — neighbor HR router; pattern reference for the new `hr_overtime.py` router skeleton.
- `backend/app/services/hr_kpi_aggregation.py` — contains `_month_bounds` helper no longer needed by the new endpoint; no changes expected.
- `backend/app/models.py` — `SalesRecord`, `PersonioEmployee`, `PersonioAttendance` ORM models used by the overtime compute.
- `backend/app/schemas.py` — `SalesRecordRead`, `EmployeeRead` Pydantic schemas; Viewer allowlists in Directus mirror these exactly.
- `backend/app/main.py` — router registration edits.
- `frontend/src/lib/api.ts:355-411` — `SalesRecordRow`, `EmployeeRow`, `fetchSalesRecords`, `fetchEmployees` internals swapped here.
- `frontend/src/lib/apiClient.ts` — Directus SDK singleton; reused.
- `frontend/src/components/dashboard/SalesTable.tsx` — consumer of `fetchSalesRecords`; unchanged by D-01.
- `frontend/src/pages/hr/` (HR table page) — consumer of `fetchEmployees`; receives the merged shape via the new hooks (D-05).
- `.github/workflows/ci.yml` — extend Phase 66's `/api/me` grep guard with two new literals (D-21).

### Directus SDK external refs
- Directus 11 SDK `readItems` + filter operator docs (`_between`, `_gte`, `_lte`, `_icontains`, `_or`, `_eq`).
- Directus sort/limit/`fields` request parameters.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`directus` SDK singleton** (`frontend/src/lib/apiClient.ts`) — request entry point. Already wired with cookie mode + token injection from Phase 29/64.
- **`readMe` swap pattern** (Phase 66, `AuthContext.tsx`) — direct template for `readItems` call shape, import from `@directus/sdk`, error handling.
- **`useTableState` / `SalesTable.tsx`** — existing consumer shape is preserved; row type intersection at the call site means swapping the fetch internals doesn't cascade.
- **`fetchSalesRecords` / `fetchEmployees`** — both wrapper signatures stay; only bodies change. Callers unaffected except HR table's overtime merge.
- **`PersonioAttendance` × `PersonioEmployee` join** and the overtime compute loop — lifted verbatim from `data.py` into `hr_overtime.py`.
- **Phase 66 CI grep guard** (`.github/workflows/ci.yml`) — one additional step in the same shape covers CLEAN-04 (b) half.

### Established Patterns
- **`readItems(collection, { filter, sort, limit, fields })`** as the Directus SDK read call — consistent with Phase 66's `readMe(fields)` style.
- **Hand-written Row types in `lib/api.ts`** with hand-maintained field lists that mirror Pydantic `*Read` / Viewer allowlist.
- **`apiClient.ts` singleton pattern** for the SDK — no per-call instantiation.
- **Router prefix `/api/...`** in FastAPI backend; preserved (`/api/data` prefix remains on the new router).
- **Compose startup chain** (Phase 65 D-03) means Viewer field allowlists are already registered before `backend` starts; the frontend can trust the Viewer `readItems` call will not fail on permission at runtime.

### Integration Points
- New file: `backend/app/routers/hr_overtime.py`.
- Edited file: `backend/app/main.py` (remove `data` include, add `hr_overtime` include).
- Deleted files: `backend/app/routers/data.py`, `backend/tests/test_data*.py` (or equivalent).
- New file: `backend/tests/test_hr_overtime_endpoint.py`.
- Edited files: `frontend/src/lib/api.ts` (internals of `fetchSalesRecords`, `fetchEmployees` + export a new `fetchEmployeesOvertime` or equivalent + new `useEmployeesOvertime` / hook wiring for D-05).
- Edited file: `frontend/src/pages/hr/*` (or the HR table consumer) for the merge in D-05.
- Edited file: `.github/workflows/ci.yml` — one new grep guard step (D-21).

</code_context>

<specifics>
## Specific Ideas

- Mirror Phase 66's success pattern: keep wrapper signatures stable, swap internals only. `SalesTable.tsx` and similar consumers should need zero edits apart from the HR merge.
- `SalesRecordRow` / `EmployeeRow` type stability is a feature, not a limitation — minimises the blast radius of this migration.
- CI grep guards are cheap insurance against regression and are already proven in Phase 66.
- Overtime endpoint must keep today's math identical so the "overtime badge values match v1.21" success criterion (ROADMAP #3) holds trivially from a unit-test perspective.

</specifics>

<deferred>
## Deferred Ideas

- Directus schema type-generation (`schema.d.ts`) — possible future phase if more collections migrate or if Viewer/Admin allowlists diverge per-field.
- Pagination beyond the 500-row cap — separate phase if/when table scale warrants it.
- Full-text `search` param (Directus top-level) — would be a UX change, not a migration.
- Moving `hr_overtime.py` and `hr_kpis.py` into a shared `hr/` package — cosmetic; revisit when `hr_kpis.py` itself is touched.

</deferred>

---

*Phase: 67-migrate-data-py-sales-employees-split*
*Context gathered: 2026-04-24*
