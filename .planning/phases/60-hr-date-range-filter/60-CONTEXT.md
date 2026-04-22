# Phase 60: HR Date-Range Filter - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing subheader `DateRangeFilter` (already driving `/sales` via `DateRangeContext`) into the HR dashboard — KPI cards, charts, and employee table — and extend the HR backend with `date_from` / `date_to` query params plus aggregation over arbitrary ranges.

In scope:
- Mount `DateRangeFilter` in `SubHeader` for `/hr` (same presets as Sales).
- Add `date_from`/`date_to` to HR endpoints: `GET /api/hr/kpis`, `GET /api/hr/kpis/history`, `GET /api/data/employees`.
- Reshape HR aggregation services (`compute_hr_kpis`, history loop, employee overtime computation) to operate over any window, not just the current calendar month.
- `HrKpiCardGrid`, `HrKpiCharts`, and `EmployeeTable` consume the shared `DateRangeContext` and refetch when range changes.

Out of scope (deferred):
- New presets beyond the existing `thisMonth | thisQuarter | thisYear | allTime` set.
- Per-dashboard date-range state (shared context wins).
- Personio sync changes.

</domain>

<decisions>
## Implementation Decisions

### KPI Semantics Over Custom Range
- **D-01:** All 5 HR KPIs aggregate over the **whole range as one window** — sum numerators and denominators across the entire `[date_from, date_to]`, return a single number per KPI. Do not average monthly ratios.
- **D-02:** Delta on each KPI card compares **current range vs prior window of same length** (e.g., 45-day range → prior 45 days immediately before `date_from`). Not prior calendar month, not prior year, not hidden for non-month ranges.
- **D-03:** **Fluctuation** = `leavers_with_end_date_in_range / avg_active_headcount_across_range`. No annualization. No raw count.
- **D-04:** **Revenue per production employee** = `sum(sales.order_value where order_date in [from, to]) / avg(production_dept_headcount across range)`. Single range figure; not monthly-then-averaged.
- **D-05:** **Overtime ratio** and **sick-leave ratio** follow the same whole-range aggregation pattern (numerator and denominator each summed across all days in range).

### Chart X-Axis Bucketing
- **D-06:** `HrKpiCharts` buckets the x-axis **automatically by range length**:
  - ≤ 31 days → daily buckets
  - ≤ 13 weeks (~91 days) → weekly buckets (ISO week)
  - ≤ 24 months → monthly buckets
  - > 24 months → quarterly buckets
  Target: ~10–30 points on the chart regardless of range.
- **D-07:** Chart **always reflects the active range** — no independent 12-month history. The default landing state (`thisYear` preset) naturally renders ~12 monthly buckets, preserving the current look for first-time `/hr` loads.

### Presets + Default + State Sharing
- **D-08:** **One shared `DateRangeContext`** drives both `/sales` and `/hr`. Switching between dashboards preserves the active preset/range. No per-dashboard state.
- **D-09:** **Presets = existing Sales set unchanged**: `thisMonth | thisQuarter | thisYear | allTime`. No new HR-specific presets, no new i18n keys needed for presets themselves.
- **D-10:** **Default preset = `thisYear`** (current context default). Already applies app-wide; no change needed.

### EmployeeTable Under Range
- **D-11:** `total_hours` and `overtime_hours` per employee are **computed over the active range** (sum of attendances where `date in [date_from, date_to]`). Drop the current-month hard-coding in `backend/app/routers/data.py:70-88`.
- **D-12:** **Roster = current roster, unfiltered** — the table keeps showing today's employees via the existing `overtime | active | all` segment. Metrics reflect the range; the set of employees does not. No contract-overlap or attendance-presence filtering in this phase.
- **D-13:** `overtime_ratio` per employee (currently computed only when `ot > 0 and total > 0`) keeps the same guard but over range totals.

### Claude's Discretion
- Query param names (`date_from`, `date_to`) are suggested — planner can conform to existing Sales endpoint convention if it differs.
- Exact default window semantics when `date_from`/`date_to` are omitted on the backend (likely: fall back to current-month behavior for safety, or require both). Planner to pick.
- React Query cache-key shape and invalidation behavior when the range changes.
- Loading / skeleton UX while refetching after a range change.
- Empty-state copy (KPI cards and chart) when range contains no attendances / no sales / no leavers.
- Backend implementation: per-KPI helper functions already take `(db, first, last)` windows — reuse is straightforward.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + Requirements
- `.planning/ROADMAP.md` — Phase 60 entry (goal + dependency on Phase 59).
- `.planning/REQUIREMENTS.md` — v1.19 scope. Note: Phase 60 is not in the v1.19 locked scope; this phase is tracked as post-v1.19 work on the roadmap.

### Prior HR / Dashboard Context
- `backend/app/routers/hr_kpis.py` — current HR KPI endpoints; header comment explicitly cites prior D-03 ("no date parameters — server computes fixed calendar month windows"). Phase 60 **overrides** this prior decision.
- `backend/app/services/hr_kpi_aggregation.py` — reusable per-KPI helpers (`_overtime_ratio`, `_sick_leave_ratio`, `_fluctuation`, `_revenue_per_production_employee`) all already take `(db, first, last)` window tuples.
- `backend/app/routers/data.py:47-112` — `/api/data/employees`; current-month attendance aggregation lives here and must switch to the request range.
- `frontend/src/contexts/DateRangeContext.tsx` — shared context; default `thisYear`. Already the single source of truth.
- `frontend/src/components/dashboard/DateRangeFilter.tsx` — preset list (`thisMonth | thisQuarter | thisYear | allTime`); reuse as-is for `/hr`.
- `frontend/src/components/SubHeader.tsx:138-144` — current Sales-only mount of `DateRangeFilter`; extend guard to include `/hr`.
- `frontend/src/components/dashboard/HrKpiCardGrid.tsx`, `HrKpiCharts.tsx`, `EmployeeTable.tsx` — three surfaces that need to consume `useDateRange()` and pass range params to their fetchers.
- `frontend/src/lib/api.ts:319-389` — `fetchHrKpis`, `fetchHrKpiHistory`, `fetchEmployees` — extend signatures with `date_from`/`date_to`.

### Sales Pattern (Mirror)
- `frontend/src/components/dashboard/RevenueChart.tsx` + sales KPI fetchers — reference implementation for wiring `useDateRange()` → fetch params → React Query key. Planner should read this to match conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DateRangeContext` / `useDateRange()` — shared, already mounted at app root. Zero new state plumbing.
- `DateRangeFilter` component — presets + custom picker already built; drop it into `SubHeader` under the `/hr` branch.
- HR aggregation helpers in `hr_kpi_aggregation.py` — all take `(first, last)` date tuples already. Main change is callers passing request-supplied ranges instead of `_month_bounds(today)`.
- Chart time utilities (`chartTimeUtils.ts`, v1.12) — gap-fill + year boundaries; must be extended or complemented for daily/weekly/quarterly bucketing (D-06).

### Established Patterns
- Sales endpoints already accept `date_from`/`date_to`; mirror param naming and validation (FastAPI `Query(...)` with date type, optional-both-or-required-both).
- React Query keys include range params so preset changes invalidate caches cleanly.
- Delta-badge pattern (`kpi.delta.*` i18n namespace, `DeltaBadgeStack`) is already range-agnostic as long as the backend returns prior-period value.

### Integration Points
- `SubHeader.tsx:138` — extend `location === "/sales"` to `isDashboard` (which already covers both `/sales` and `/hr`).
- `HrKpiResponse` / `HrKpiHistoryPoint` schemas (`backend/app/schemas/`) — confirm whether prior-period fields need widening when the window is arbitrary; likely no schema change if delta is returned as a pair `(current, prior)` per KPI.
- Backend tests under `backend/tests/` for HR KPIs — must be regenerated / extended to cover arbitrary windows.

</code_context>

<specifics>
## Specific Ideas

- The default landing experience on `/hr` should look essentially identical to today — because `thisYear` preset + monthly auto-bucketing yields the same ~12-month chart + current-style KPI cards for most of the year.
- Phase 60 explicitly reverses the prior D-03 from the original HR phase. Header comments in `hr_kpis.py` must be updated, not silently contradicted.
- "Same length" prior window for delta is the consistent interpretation for every preset: `thisMonth` → prior full calendar month; `thisQuarter` → prior quarter; custom 45-day → prior 45 days.

</specifics>

<deferred>
## Deferred Ideas

- Annualized fluctuation rate — considered, rejected in favor of simple ratio (D-03).
- HR-specific presets like `last30d` / `last90d` — deferred; revisit if users complain that Sales presets don't fit HR analysis.
- User-picked chart granularity selector (daily/weekly/monthly buttons next to chart) — deferred; auto-bucketing (D-06) is the single source of truth for now.
- Year-over-year delta option on HR KPIs — deferred; prior-window-same-length is the only delta mode in this phase.
- Filtering employee roster by contract overlap or attendance presence — deferred; current roster unfiltered (D-12). Reopen if users ask for "who was here then" analysis.
- Empty/partial range UX beyond basic loading + empty-state copy — deferred to planner discretion + manual QA.

</deferred>

---

*Phase: 60-hr-date-range-filter*
*Context gathered: 2026-04-22*
