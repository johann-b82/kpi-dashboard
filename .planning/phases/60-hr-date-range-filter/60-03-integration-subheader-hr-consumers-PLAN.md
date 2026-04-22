---
phase: 60-hr-date-range-filter
plan: 03
type: execute
wave: 2
depends_on:
  - 01
  - 02
files_modified:
  - frontend/src/components/SubHeader.tsx
  - frontend/src/components/dashboard/HrKpiCardGrid.tsx
  - frontend/src/components/dashboard/HrKpiCharts.tsx
  - frontend/src/components/dashboard/EmployeeTable.tsx
autonomous: true
requirements:
  - D-06
  - D-07
  - D-08
  - D-09
  - D-10
  - D-11
  - D-12

must_haves:
  truths:
    - "On /hr, the same DateRangeFilter used on /sales is visible in the SubHeader with identical presets (thisMonth | thisQuarter | thisYear | allTime)"
    - "Switching between /sales and /hr preserves the active preset and range (single shared DateRangeContext — D-08)"
    - "Default landing on /hr with the thisYear preset renders KPI cards + charts + employee table that are visually equivalent to the pre-Phase-60 view (12 monthly buckets, current HR semantics)"
    - "Changing the preset/range refetches /api/hr/kpis, /api/hr/kpis/history, and /api/data/employees with date_from/date_to applied"
    - "HrKpiCharts buckets the x-axis per D-06: daily ≤31d, weekly ≤91d, monthly ≤731d, quarterly otherwise"
    - "EmployeeTable roster is unfiltered by attendance (D-12); only total_hours/overtime_hours/overtime_ratio reflect the active range"
  artifacts:
    - path: frontend/src/components/SubHeader.tsx
      provides: "DateRangeFilter mount on /hr alongside /sales"
    - path: frontend/src/components/dashboard/HrKpiCardGrid.tsx
      provides: "useDateRange()-driven fetchHrKpis call with cache key embedding range"
    - path: frontend/src/components/dashboard/HrKpiCharts.tsx
      provides: "useDateRange()-driven fetchHrKpiHistory call with D-06 bucketing + adaptive X-axis formatter"
    - path: frontend/src/components/dashboard/EmployeeTable.tsx
      provides: "useDateRange()-driven fetchEmployees call with date_from/date_to"
  key_links:
    - from: frontend/src/components/SubHeader.tsx
      to: frontend/src/components/dashboard/DateRangeFilter.tsx
      via: "mount under /hr branch"
      pattern: "location === \"/hr\""
    - from: frontend/src/components/dashboard/HrKpiCardGrid.tsx
      to: frontend/src/lib/api.ts
      via: "fetchHrKpis({ date_from, date_to })"
      pattern: "fetchHrKpis"
    - from: frontend/src/components/dashboard/HrKpiCharts.tsx
      to: frontend/src/lib/chartTimeUtils.ts
      via: "deriveHrBuckets + formatBucketLabel"
      pattern: "deriveHrBuckets"
    - from: frontend/src/components/dashboard/EmployeeTable.tsx
      to: frontend/src/lib/api.ts
      via: "fetchEmployees({ date_from, date_to, search })"
      pattern: "fetchEmployees"
---

<objective>
Wire the shared `DateRangeFilter` into `/hr` and make all three HR dashboard surfaces (KPI cards, charts, employee table) consume `useDateRange()` and refetch on range change. Plan 01 delivered the backend contract, Plan 02 delivered the fetcher and bucketing types — this plan connects them.

Purpose: Deliver the user-visible outcome of Phase 60: one date-range picker drives the whole HR dashboard, and switching between Sales/HR preserves range.
Output: Four modified frontend files. No schema change.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/60-hr-date-range-filter/60-CONTEXT.md
@CLAUDE.md
@frontend/src/components/SubHeader.tsx
@frontend/src/components/dashboard/DateRangeFilter.tsx
@frontend/src/contexts/DateRangeContext.tsx
@frontend/src/components/dashboard/HrKpiCardGrid.tsx
@frontend/src/components/dashboard/HrKpiCharts.tsx
@frontend/src/components/dashboard/EmployeeTable.tsx
@frontend/src/components/dashboard/RevenueChart.tsx

<interfaces>
From Plan 02 (now landed in frontend/src/lib/api.ts):
```typescript
fetchHrKpis(params?: { date_from?: string; date_to?: string }): Promise<HrKpiResponse>
fetchHrKpiHistory(params?: { date_from?: string; date_to?: string }): Promise<HrKpiHistoryPoint[]>
fetchEmployees(params?: { department?: string; status?: string; search?: string; date_from?: string; date_to?: string }): Promise<EmployeeRow[]>
```
From Plan 02 (frontend/src/lib/queryKeys.ts):
```typescript
hrKpiKeys.summary(from?: string, to?: string)
hrKpiKeys.history(from?: string, to?: string)
hrKpiKeys.employees(from?: string, to?: string, search?: string)
```
From Plan 02 (frontend/src/lib/chartTimeUtils.ts):
```typescript
export type HrBucketGranularity = "daily" | "weekly" | "monthly" | "quarterly";
deriveHrBuckets(from: Date, to: Date): { granularity: HrBucketGranularity; buckets: { label: string; start: Date; end: Date }[] }
formatBucketLabel(granularity, date)
```
From frontend/src/lib/dateUtils.ts (existing): `toApiDate(d: Date): string` — `YYYY-MM-DD`.
Sales mirror (frontend/src/components/SubHeader.tsx:138-144): the `/sales` branch mounts `<DateRangeFilter value={range} preset={preset} onChange={handleFilterChange} />` — the `/hr` branch must use exactly the same props.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Mount DateRangeFilter on /hr in SubHeader</name>
  <files>frontend/src/components/SubHeader.tsx</files>
  <read_first>
    - frontend/src/components/SubHeader.tsx (whole file; lines 122-185 especially)
    - frontend/src/contexts/DateRangeContext.tsx
    - frontend/src/components/dashboard/DateRangeFilter.tsx (confirm preset list is unchanged)
  </read_first>
  <action>
    In `frontend/src/components/SubHeader.tsx`, change the `DateRangeFilter` mount gate from `location === "/sales"` (line 138) to `isDashboard` (already computed on line 101 as `/sales || /hr`). Result:
    ```tsx
    {isDashboard && (
      <DateRangeFilter
        value={range}
        preset={preset}
        onChange={handleFilterChange}
      />
    )}
    ```
    Leave the Sales/HR `<Toggle>` above it unchanged. Leave `HrFreshnessIndicator` on the right slot unchanged — it shows Personio sync freshness, independent of the range picker. Do NOT change anything else in this file (no signage block touches, no `/sensors` block touches).

    **D-09 preset-set + i18n guard:** Do NOT modify `DateRangeFilter.tsx` (preset list `thisMonth | thisQuarter | thisYear | allTime` stays). Do NOT add or rename any `kpi.preset.*` i18n keys — the existing Sales presets already cover HR.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; grep -nE "isDashboard &amp;&amp;\\s*\\(\\s*&lt;DateRangeFilter" src/components/SubHeader.tsx &amp;&amp; npx tsc --noEmit 2>&amp;1 | tail -15</automated>
  </verify>
  <done>
    - On /hr the date-range picker is visible and shares state with /sales (verified in Plan 04 manual QA).
    - Type-check is clean.
  </done>
  <acceptance_criteria>
    - `grep -nE "location === \"/sales\" \\&\\& \\(\\s*\\n?\\s*&lt;DateRangeFilter" frontend/src/components/SubHeader.tsx` returns empty (old Sales-only gate removed).
    - `grep -nE "isDashboard \\&\\& \\(" frontend/src/components/SubHeader.tsx` returns ≥2 matches (existing Toggle + new DateRangeFilter mount).
    - **D-09 preset list unchanged:** `git diff frontend/src/components/dashboard/DateRangeFilter.tsx` shows no change to this phase (or the file is not in `files_modified`). `grep -c -E '"thisMonth"|"thisQuarter"|"thisYear"|"allTime"' frontend/src/components/dashboard/DateRangeFilter.tsx` returns the SAME count as on `main` prior to the phase branch (the four preset literals still each appear, no additions, no removals). Run `git show main:frontend/src/components/dashboard/DateRangeFilter.tsx | grep -c -E '"thisMonth"|"thisQuarter"|"thisYear"|"allTime"'` and compare — the counts must be equal.
    - **D-09 no new preset i18n keys:** `git diff --stat main -- frontend/src/locales/ frontend/src/i18n/ 2>/dev/null` shows no added lines under any `kpi.preset.*` key, OR `git diff main -- frontend/src/locales/ frontend/src/i18n/ 2>/dev/null | grep -E "^\\+.*kpi\\.preset\\."` returns empty. (Adjust the locales path if the project uses a different directory.)
    - `cd frontend &amp;&amp; npx tsc --noEmit` exits 0.
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire HrKpiCardGrid + EmployeeTable to useDateRange()</name>
  <files>frontend/src/components/dashboard/HrKpiCardGrid.tsx, frontend/src/components/dashboard/EmployeeTable.tsx</files>
  <read_first>
    - frontend/src/components/dashboard/HrKpiCardGrid.tsx (whole file)
    - frontend/src/components/dashboard/EmployeeTable.tsx (whole file)
    - frontend/src/lib/dateUtils.ts (confirm toApiDate)
    - frontend/src/contexts/DateRangeContext.tsx
  </read_first>
  <action>
    1. `HrKpiCardGrid.tsx`:
       - Import `useDateRange` from `@/contexts/DateRangeContext` and `toApiDate` from `@/lib/dateUtils`.
       - Inside the component, before the `useQuery` call, compute:
         ```tsx
         const { range } = useDateRange();
         const date_from = range.from ? toApiDate(range.from) : undefined;
         const date_to = range.to ? toApiDate(range.to) : undefined;
         ```
       - Replace the query:
         ```tsx
         const { data, isLoading, isError } = useQuery({
           queryKey: hrKpiKeys.summary(date_from, date_to),
           queryFn: () => fetchHrKpis({ date_from, date_to }),
         });
         ```
       - `DeltaBadgeStack` wiring stays as-is; `previous_period` now carries prior-window-same-length value (per Plan 01), and `previous_year` carries the same-window-one-year-ago value. Update `formatHrDeltaLabels` call? NO — leave the label logic alone; `formatHrDeltaLabels` is already range-agnostic per CONTEXT note, and copy updates are deferred. Just feed the new values through the existing `computeDelta` path (current code already does this).
       - Leave the rest of the component (no-sync banner, error banner, 3+2 grid) byte-identical.
    2. `EmployeeTable.tsx`:
       - Same imports (`useDateRange`, `toApiDate`).
       - Inside the component:
         ```tsx
         const { range } = useDateRange();
         const date_from = range.from ? toApiDate(range.from) : undefined;
         const date_to = range.to ? toApiDate(range.to) : undefined;
         ```
       - Replace the query:
         ```tsx
         const { data, isLoading } = useQuery({
           queryKey: hrKpiKeys.employees(date_from, date_to, search || undefined),
           queryFn: () => fetchEmployees({ search: search || undefined, date_from, date_to }),
         });
         ```
       - Roster filtering (D-12) is unchanged: the `overtime | active | all` SegmentedControl still filters in-memory; `selectedDepts` Settings filter still applies. DO NOT add attendance-presence filtering.
       - D-13 guard (`row.overtime_ratio != null`) is already in place — no change.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npx tsc --noEmit 2>&amp;1 | tail -15</automated>
  </verify>
  <done>
    - Type-check clean.
    - Grep confirms `useDateRange()` usage in both files.
    - React Query keys embed `from`/`to`.
  </done>
  <acceptance_criteria>
    - `grep -n "useDateRange" frontend/src/components/dashboard/HrKpiCardGrid.tsx` returns a match.
    - `grep -n "useDateRange" frontend/src/components/dashboard/EmployeeTable.tsx` returns a match.
    - `grep -n "hrKpiKeys.summary" frontend/src/components/dashboard/HrKpiCardGrid.tsx` returns a match.
    - `grep -n "hrKpiKeys.employees" frontend/src/components/dashboard/EmployeeTable.tsx` returns a match.
    - `grep -n "fetchEmployees({" frontend/src/components/dashboard/EmployeeTable.tsx` shows `date_from` and `date_to` passed.
    - `grep -nE "queryKey: \\[\"hr-kpi-history\"\\]|queryKey: hrKpiKeys\\.all\\(\\)" frontend/src/components/dashboard/HrKpiCardGrid.tsx` returns empty (old non-range key gone).
    - `cd frontend &amp;&amp; npx tsc --noEmit` exits 0.
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire HrKpiCharts to useDateRange() + adaptive D-06 bucketing</name>
  <files>frontend/src/components/dashboard/HrKpiCharts.tsx</files>
  <read_first>
    - frontend/src/components/dashboard/HrKpiCharts.tsx (whole file)
    - frontend/src/lib/chartTimeUtils.ts (as modified by Plan 02 — deriveHrBuckets / formatBucketLabel / HrBucketGranularity)
    - frontend/src/components/dashboard/RevenueChart.tsx (as convention reference for range-aware chart queries)
  </read_first>
  <action>
    1. Import additions at the top of `HrKpiCharts.tsx`:
       ```tsx
       import { useDateRange } from "@/contexts/DateRangeContext";
       import { toApiDate } from "@/lib/dateUtils";
       import {
         deriveHrBuckets,
         formatBucketLabel,
         formatMonthYear,
         yearBoundaryDates,
         type HrBucketGranularity,
       } from "@/lib/chartTimeUtils";
       import { hrKpiKeys } from "@/lib/queryKeys";
       ```
       (The existing `formatMonthYear` / `yearBoundaryDates` imports stay — monthly bucketing keeps them. `HrBucketGranularity` is the prop type consumed by `MiniChart` below, so it MUST be imported from `chartTimeUtils` alongside `deriveHrBuckets` / `formatBucketLabel`.)

       **Bucketing source of truth:** Server response (`fetchHrKpiHistory`) is the source of truth for bucket boundaries — the backend `_bucket_windows` helper (Plan 01) already returns one point per bucket with its label attached. `deriveHrBuckets` is used client-side ONLY to pick the tick/label formatter and granularity for the X-axis — do NOT re-bucket server data, do NOT aggregate response points into new buckets client-side.
    2. Inside `HrKpiCharts()`, before the `useQuery`:
       ```tsx
       const { range } = useDateRange();
       const date_from = range.from ? toApiDate(range.from) : undefined;
       const date_to = range.to ? toApiDate(range.to) : undefined;
       const bucketPlan = range.from &amp;&amp; range.to
         ? deriveHrBuckets(range.from, range.to)
         : { granularity: "monthly" as const, buckets: [] };
       ```
    3. Replace query:
       ```tsx
       const { data, isLoading } = useQuery({
         queryKey: hrKpiKeys.history(date_from, date_to),
         queryFn: () => fetchHrKpiHistory({ date_from, date_to }),
       });
       ```
    4. Replace the `formatMonth` and `boundaries` logic inside `MiniChart` so it branches on `granularity`. Easiest path: pass `granularity` as a prop to `MiniChart` (typed `HrBucketGranularity`) and wire the X-axis tickFormatter to `formatBucketLabel(granularity, new Date(label))` when NOT monthly, and preserve the existing `formatMonthYear(m + "-01", locale)` path when monthly so the thisYear-landing visual is byte-identical.
       ```tsx
       interface MiniChartProps { ...; granularity: HrBucketGranularity; }
       ...
       const formatLabel = (m: string) => {
         if (granularity === "monthly") return formatMonthYear(m + "-01", locale);
         if (granularity === "daily") {
           const d = new Date(m);
           return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(d);
         }
         if (granularity === "weekly") return m; // "YYYY-Www" already compact
         // quarterly
         return m; // "YYYY-Qn"
       };
       ```
       For year-boundary reference lines, only render them when `granularity === "monthly"` (current behaviour). Skip boundary lines for other granularities in this plan — can be re-added in a polish pass.

       **Important:** `data` from the fetcher is passed straight to the chart (possibly with the existing gap-fill/merge utilities for monthly only). Do NOT add a client-side `.reduce(...)` or groupBy over `data` to aggregate points into new buckets — bucket boundaries come from the server.
    5. Do NOT change the `<Toggle>` area/bar control — that's orthogonal.
    6. Per D-07 + D-10, when the default `thisYear` preset is active the `range.from` is Jan 1 of the current year and `range.to` is today → `deriveHrBuckets` returns `monthly`, yielding ~12 buckets and preserving the current look.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npx tsc --noEmit 2>&amp;1 | tail -15</automated>
  </verify>
  <done>
    - Type-check clean.
    - Chart refetches on preset change.
    - Default thisYear path still renders monthly buckets with `formatMonthYear` labels identical to pre-Phase-60 (visual parity confirmed in Plan 04).
  </done>
  <acceptance_criteria>
    - `grep -n "deriveHrBuckets" frontend/src/components/dashboard/HrKpiCharts.tsx` returns a match.
    - `grep -n "hrKpiKeys.history" frontend/src/components/dashboard/HrKpiCharts.tsx` returns a match.
    - `grep -n "useDateRange" frontend/src/components/dashboard/HrKpiCharts.tsx` returns a match.
    - `grep -nE "HrBucketGranularity" frontend/src/components/dashboard/HrKpiCharts.tsx` returns a match (prop type imported, not redeclared).
    - `grep -nE "queryKey: \\[\"hr-kpi-history\"\\]" frontend/src/components/dashboard/HrKpiCharts.tsx` returns empty (old static key gone).
    - **No client-side re-bucketing:** `grep -nE "data(\\.points)?\\.reduce\\(|\\.groupBy\\(|bucketize\\(" frontend/src/components/dashboard/HrKpiCharts.tsx` returns empty — the component does NOT re-aggregate server response points into new buckets. (If a legitimate `.reduce` exists for a different purpose, e.g. computing axis extents, document it in the task SUMMARY so reviewers can distinguish from re-bucketing.)
    - `cd frontend &amp;&amp; npx tsc --noEmit` exits 0.
  </acceptance_criteria>
</task>

</tasks>

<verification>
`npx tsc --noEmit` + `npx vitest run` must pass. Manual QA lives in Plan 04.
</verification>

<success_criteria>
- `/hr` renders the shared DateRangeFilter.
- Switching between `/sales` and `/hr` preserves range state (single DateRangeContext).
- All three HR surfaces refetch on range change with correct query keys and correct query-string bounds.
- Default thisYear landing is visually equivalent to pre-Phase-60 `/hr`.
</success_criteria>

<output>
After completion, create `.planning/phases/60-hr-date-range-filter/60-03-SUMMARY.md` recording: cache-key shape, bucket-plan inputs, any adjustments to `MiniChart`, and notes on thisYear-parity verification.
</output>
</output>
