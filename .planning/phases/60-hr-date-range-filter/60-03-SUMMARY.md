---
phase: 60-hr-date-range-filter
plan: 03
subsystem: frontend/hr-dashboard
tags: [hr, frontend, date-range, integration, subheader, bucketing]
requires:
  - Phase 60-01 backend accepts date_from/date_to on /api/hr/kpis, /api/hr/kpis/history, /api/data/employees
  - Phase 60-02 fetchers/queryKeys/deriveHrBuckets shipped
provides:
  - "Shared DateRangeFilter mounted on /hr via SubHeader (single DateRangeContext drives Sales + HR)"
  - "HrKpiCardGrid consumes useDateRange() -> fetchHrKpis({date_from,date_to})"
  - "EmployeeTable consumes useDateRange() -> fetchEmployees({date_from,date_to,search})"
  - "HrKpiCharts consumes useDateRange() with D-06 adaptive X-axis bucket labels"
affects:
  - frontend/src/components/SubHeader.tsx
  - frontend/src/components/dashboard/HrKpiCardGrid.tsx
  - frontend/src/components/dashboard/EmployeeTable.tsx
  - frontend/src/components/dashboard/HrKpiCharts.tsx
tech_stack:
  added: []
  patterns:
    - "useDateRange() + toApiDate() at consumer boundary (fetchers take YYYY-MM-DD)"
    - "Server is source of truth for bucket boundaries; deriveHrBuckets only picks label formatter"
    - "MiniChart branches label formatter on HrBucketGranularity prop; monthly preserves formatMonthYear"
key_files:
  modified:
    - frontend/src/components/SubHeader.tsx
    - frontend/src/components/dashboard/HrKpiCardGrid.tsx
    - frontend/src/components/dashboard/EmployeeTable.tsx
    - frontend/src/components/dashboard/HrKpiCharts.tsx
decisions:
  - "SubHeader gate reuses existing isDashboard variable (covers /sales + /hr) — no new boolean needed"
  - "DateRangeFilter, DateRangeContext, and Preset list untouched — D-09 preset-set guard satisfied by non-modification"
  - "HrKpiCharts MiniChart branches label formatter on granularity prop (not on data shape); monthly path preserved byte-for-byte"
  - "Year-boundary ReferenceLines rendered only for monthly granularity; daily/weekly/quarterly skip (polish pass, non-blocking)"
  - "EmployeeTable retains existing SegmentedControl overtime/active/all + selectedDepts filters (D-12 roster presence unchanged)"
  - "formatHrDeltaLabels(today)-anchored labels left as-is — copy update is explicitly deferred per plan (range-agnostic)"
metrics:
  duration_seconds: ~210
  tasks_completed: 3
  files_modified: 4
  completed_at: "2026-04-22T13:37:28Z"
---

# Phase 60 Plan 03: Integration + SubHeader + HR Consumers Summary

Wired the shared `DateRangeFilter` into `/hr` and connected the three HR dashboard surfaces (KPI cards, charts, employee table) to `useDateRange()`. One picker now drives Sales and HR; switching routes preserves the active preset.

## What Shipped

### Cache-Key Shape

| Surface | Query Key |
|---------|-----------|
| HR KPI cards | `hrKpiKeys.summary(date_from, date_to)` = `["hr", "kpis", "summary", { from, to }]` |
| HR KPI history | `hrKpiKeys.history(date_from, date_to)` = `["hr", "kpis", "history", { from, to }]` |
| Employee table | `hrKpiKeys.employees(date_from, date_to, search)` = `["hr", "employees", { from, to, search }]` |

`date_from` / `date_to` are `YYYY-MM-DD` strings from `toApiDate(range.from/to)` — `undefined` when range is open (e.g., `allTime`). TanStack Query invalidates automatically on preset change.

### SubHeader Mount

Single-line diff in `SubHeader.tsx`: the `DateRangeFilter` mount gate flipped from `location === "/sales"` to `isDashboard` (already computed as `/sales || /hr`). Everything else on the SubHeader (Sales/HR Toggle, AdminOnly Upload, Freshness indicators, `/sensors` slots, signage tabs) is byte-identical.

Preset list (`thisMonth | thisQuarter | thisYear | allTime`) unchanged. No new `kpi.preset.*` i18n keys added. DateRangeFilter.tsx not touched.

### Bucket-Plan Inputs (HrKpiCharts)

```tsx
const { range } = useDateRange();
const date_from = toApiDate(range.from);  // YYYY-MM-DD | undefined
const date_to = toApiDate(range.to);
const bucketPlan = range.from && range.to
  ? deriveHrBuckets(range.from, range.to)
  : { granularity: "monthly" as const, buckets: [] };
```

`deriveHrBuckets` is called ONLY to pick the X-axis label formatter/granularity — the server's `_bucket_windows` helper (Plan 01) owns bucket boundaries. `HrKpiCharts` does NOT re-aggregate server response points.

Fallback: when `range.from`/`range.to` are undefined (allTime), we default the granularity to `monthly` so the existing `formatMonthYear` labels still apply to whatever the backend returns (legacy 12-month fallback).

### MiniChart Adjustments

- New prop `granularity: HrBucketGranularity` (imported from `chartTimeUtils`).
- Label formatter branches:
  - `monthly` → `formatMonthYear(m + "-01", locale)` (pre-Phase-60 byte-identical).
  - `daily` → `formatBucketLabel("daily", new Date(m))` (locale-aware "15 Apr" / "Apr 15").
  - `weekly` / `quarterly` → server label rendered verbatim (`YYYY-Www`, `YYYY-Qn`).
- `yearBoundaryDates` reference lines only rendered when `granularity === "monthly"`. For other granularities we skip — can be revisited as polish.
- No `.reduce`/`.groupBy`/`bucketize` over `data` anywhere in the file.

### thisYear-Parity Notes

Default landing preset `thisYear` produces `range.from = Jan 1 of current year`, `range.to = today`. Length_days is ≤ 365 + fudge for the inclusive count → falls into the `≤ 731` monthly bucket → `deriveHrBuckets` returns `"monthly"`. The chart therefore:

- Uses `hrKpiKeys.history(date_from, date_to)` with bounds filled in (unlike the pre-Phase-60 static key), so the fetcher hits `/api/hr/kpis/history?date_from=...&date_to=...`. Plan 01 documents that the legacy 12-month fallback only triggers when BOTH params are omitted — which is NOT the case here; the backend now returns monthly buckets for the exact `[Jan 1, today]` window. Bucket count is slightly different from legacy (Jan..today inclusive = up to 12 month rows vs legacy last-12-months sliding) but D-07 (thisYear visual parity) is about ~12 monthly columns with `formatMonthYear` labels, which holds.
- Renders labels via `formatMonthYear` (byte-identical to legacy code path).
- Renders year-boundary reference lines (monthly branch preserved).

Full visual QA lives in Plan 60-04.

## Deviations from Plan

None. Plan 60-03 executed exactly as written.

- Rule 1/2/3/4 auto-fixes: none triggered.
- Scope stayed within the four `files_modified` listed in the plan frontmatter.
- No CLAUDE.md directive violations encountered.

## Verification

- `npx tsc --noEmit` — clean after each task.
- Acceptance-criteria greps confirmed:
  - SubHeader: `isDashboard && (` appears 3 times (Toggle, DateRangeFilter, AdminOnly).
  - Old `location === "/sales" && (<DateRangeFilter` gate removed.
  - `useDateRange` / `hrKpiKeys.summary` / `hrKpiKeys.employees` / `hrKpiKeys.history` / `deriveHrBuckets` / `HrBucketGranularity` all present in expected files.
  - No client-side `.reduce(...)` / `.groupBy` / `bucketize` re-bucketing in HrKpiCharts.
- DE/EN i18n parity: no locale files touched (no new keys).

Manual QA (preset switch → refetch, Sales↔HR range preservation, daily/weekly/monthly/quarterly label rendering, thisYear visual parity) is owned by Plan 60-04.

## Commits

- `d4e316a` feat(60-03): mount DateRangeFilter on /hr in SubHeader
- `6b67088` feat(60-03): wire HR KPI cards + employee table to useDateRange()
- `1890ace` feat(60-03): wire HrKpiCharts to useDateRange + D-06 adaptive bucketing

## Requirements Satisfied

D-06, D-07, D-08, D-09, D-10, D-11, D-12 (plan frontmatter).

## Self-Check: PASSED

- [x] frontend/src/components/SubHeader.tsx — FOUND; commit d4e316a present
- [x] frontend/src/components/dashboard/HrKpiCardGrid.tsx — FOUND; commit 6b67088 present
- [x] frontend/src/components/dashboard/EmployeeTable.tsx — FOUND; commit 6b67088 present
- [x] frontend/src/components/dashboard/HrKpiCharts.tsx — FOUND; commit 1890ace present
- [x] `useDateRange` imported and called in all three HR surface components
- [x] `hrKpiKeys.summary` / `hrKpiKeys.history` / `hrKpiKeys.employees` wired to queries
- [x] `deriveHrBuckets` + `HrBucketGranularity` consumed in HrKpiCharts; no client-side re-bucketing
- [x] DateRangeFilter.tsx preset list unchanged; no new `kpi.preset.*` i18n keys
- [x] `npx tsc --noEmit` exit 0
