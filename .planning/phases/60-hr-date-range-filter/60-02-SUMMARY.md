---
phase: 60-hr-date-range-filter
plan: 02
subsystem: frontend/data-layer
tags: [hr, frontend, date-range, tanstack-query, chart-bucketing]
requires:
  - Phase 60-01 backend: /api/hr/kpis, /api/hr/kpis/history, /api/data/employees accept date_from/date_to
provides:
  - "fetchHrKpis/fetchHrKpiHistory/fetchEmployees now accept optional { date_from, date_to }"
  - "hrKpiKeys.summary(from,to) / hrKpiKeys.history(from,to) / hrKpiKeys.employees(from,to,search) query-key factories"
  - "deriveHrBuckets(from,to): HrBucketPlan + formatBucketLabel(granularity,date): string"
affects:
  - frontend/src/lib/api.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/lib/chartTimeUtils.ts
tech_stack:
  added:
    - (none — date-fns already a dep; no new runtime deps)
  patterns:
    - "Fetchers accept pre-formatted YYYY-MM-DD strings (callers own the toApiDate conversion) to avoid timezone drift"
    - "Query keys embed the full { from, to } object so TanStack invalidates automatically on range change"
key_files:
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/lib/chartTimeUtils.ts
    - frontend/src/lib/chartTimeUtils.test.ts
decisions:
  - "Fetchers accept pre-formatted YYYY-MM-DD strings instead of Date objects — eliminates timezone-drift risk at the serialisation boundary"
  - "HrKpiHistoryPoint.month comment widened (not renamed) — backend schema stays `month` in this phase; semantic widening only"
  - "deriveHrBuckets clips first/last bucket edges to from/to so downstream aggregation sums match the user's actual range"
  - "Weekly buckets align to ISO week (Monday start) via date-fns startOfISOWeek for cross-locale determinism"
metrics:
  duration_seconds: 124
  tasks_completed: 2
  files_modified: 4
  completed_at: "2026-04-22T13:31:27Z"
---

# Phase 60 Plan 02: Frontend Fetchers + Bucketing Summary

HR fetchers, TanStack query keys, and a pure D-06 bucket-derivation utility now form the frontend data-layer contract for Phase 60. No component consumes `useDateRange()` yet — Plan 03 wires the three HR surfaces (KpiCardGrid, KpiCharts, EmployeeTable).

## What Shipped

### Final Fetcher Signatures (frontend/src/lib/api.ts)

```typescript
export async function fetchHrKpis(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<HrKpiResponse>

export async function fetchHrKpiHistory(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<HrKpiHistoryPoint[]>

export async function fetchEmployees(params?: {
  department?: string;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}): Promise<EmployeeRow[]>
```

All three serialise `date_from`/`date_to` as `YYYY-MM-DD` query params via `URLSearchParams` and omit them when undefined. Callers are expected to pre-format `Date` via `toApiDate()` (`frontend/src/lib/dateUtils.ts`).

### Final `hrKpiKeys` Shape (frontend/src/lib/queryKeys.ts)

```typescript
export const hrKpiKeys = {
  all: () => ["hr", "kpis"] as const,
  summary: (from?: string, to?: string) =>
    ["hr", "kpis", "summary", { from, to }] as const,
  history: (from?: string, to?: string) =>
    ["hr", "kpis", "history", { from, to }] as const,
  employees: (from?: string, to?: string, search?: string) =>
    ["hr", "employees", { from, to, search }] as const,
};
```

`all()` preserved so any broad-key invalidations still compile.

### D-06 Bucket Derivation (frontend/src/lib/chartTimeUtils.ts)

New exports:
- `HrBucketGranularity = "daily" | "weekly" | "monthly" | "quarterly"`
- `HrBucket = { label: string; start: Date; end: Date }`
- `HrBucketPlan = { granularity; buckets: HrBucket[] }`
- `deriveHrBuckets(from: Date, to: Date): HrBucketPlan`
- `formatBucketLabel(granularity, d): string`

Threshold (inclusive `lengthDays = differenceInCalendarDays(to, from) + 1`):
| length_days | granularity |
|-------------|-------------|
| ≤ 31 | daily |
| ≤ 91 | weekly (ISO week, Monday start) |
| ≤ 731 | monthly |
| else | quarterly |

Edge behaviour: `from > to` → `{ granularity: "daily", buckets: [] }` (no throw). `from == to` → 1 daily bucket. First/last bucket edges clipped to `from`/`to`.

### Bucket Label Examples

| granularity | input start | label |
|-------------|-------------|-------|
| daily | 2026-04-15 | `2026-04-15` |
| weekly | 2026-04-06 (Mon, ISO W15) | `2026-W15` |
| monthly | 2026-04-01 | `2026-04` |
| quarterly | 2024-04-01 | `2024-Q2` |

### Date-fns Helpers Chosen

`addDays`, `addMonths`, `addQuarters`, `differenceInCalendarDays`, `endOfISOWeek`, `endOfMonth`, `endOfQuarter`, `format`, `getISOWeek`, `getISOWeekYear`, `getQuarter`, `startOfISOWeek`, `startOfMonth`, `startOfQuarter`. No new runtime dependency.

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run src/lib/chartTimeUtils.test.ts` — 24/24 green (12 pre-existing Sales tests + 12 new bucket tests).
- Existing Sales exports (`buildMonthSpine`, `mergeIntoSpine`, `formatMonthYear`, `yearBoundaryDates`) untouched — RevenueChart continues to compile.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `376b537` feat(60-02): extend HR fetchers + hrKpiKeys with date_from/date_to
- `36b3de0` test(60-02): add failing tests for deriveHrBuckets + formatBucketLabel
- `94cfd40` feat(60-02): implement deriveHrBuckets + formatBucketLabel (D-06)

## Self-Check: PASSED

- frontend/src/lib/api.ts — FOUND
- frontend/src/lib/queryKeys.ts — FOUND
- frontend/src/lib/chartTimeUtils.ts — FOUND
- frontend/src/lib/chartTimeUtils.test.ts — FOUND
- commits 376b537, 36b3de0, 94cfd40 — all present in git log
