---
phase: 60-hr-date-range-filter
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/lib/api.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/lib/chartTimeUtils.ts
autonomous: true
requirements:
  - D-01
  - D-06
  - D-07
  - D-08
  - D-11

must_haves:
  truths:
    - "fetchHrKpis({ date_from, date_to }) serialises both as YYYY-MM-DD query params and omits them when undefined"
    - "fetchHrKpiHistory({ date_from, date_to }) does the same"
    - "fetchEmployees({ date_from, date_to, ... }) appends date_from/date_to alongside the existing filters"
    - "hrKpiKeys.summary(from, to) and hrKpiKeys.history(from, to) exist and embed both bounds so TanStack Query invalidates on range change"
    - "chartTimeUtils exposes a pure bucketing function that, given YYYY-MM-DD bounds, returns bucket descriptors (granularity + labels) matching D-06 thresholds: daily ≤31d, weekly ≤91d, monthly ≤731d, quarterly otherwise"
    - "existing buildMonthSpine/mergeIntoSpine/formatMonthYear/yearBoundaryDates exports are preserved (Sales RevenueChart keeps compiling)"
  artifacts:
    - path: frontend/src/lib/api.ts
      provides: "fetchHrKpis, fetchHrKpiHistory, fetchEmployees with date_from/date_to params"
      contains: "date_from"
    - path: frontend/src/lib/queryKeys.ts
      provides: "hrKpiKeys.summary(from, to), hrKpiKeys.history(from, to)"
      contains: "hrKpiKeys"
    - path: frontend/src/lib/chartTimeUtils.ts
      provides: "deriveHrBuckets() + formatBucketLabel()"
      contains: "deriveHrBuckets"
  key_links:
    - from: frontend/src/lib/api.ts
      to: "backend /api/hr/kpis (date_from,date_to)"
      via: "URLSearchParams"
      pattern: "date_from"
    - from: frontend/src/lib/queryKeys.ts
      to: frontend/src/lib/api.ts
      via: "query key factory inputs"
      pattern: "hrKpiKeys\\.(summary|history)"
---

<objective>
Extend the frontend data layer so HR fetchers accept `date_from`/`date_to`, TanStack Query keys embed both bounds, and a pure bucket-derivation utility is available for `HrKpiCharts` to choose daily / weekly / monthly / quarterly granularity per D-06. No component is rewired in this plan — Plan 03 handles that. This plan is the contract layer so the Wave-1 backend work (Plan 01) and Wave-2 integration (Plan 03) meet at well-defined types.

Purpose: Downstream plans consume these types; defining them up-front avoids the "scavenger hunt" anti-pattern.
Output: Three modified library modules. Zero behaviour change on screen (no component touches `useDateRange()` yet).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/60-hr-date-range-filter/60-CONTEXT.md
@CLAUDE.md
@frontend/src/lib/api.ts
@frontend/src/lib/queryKeys.ts
@frontend/src/lib/chartTimeUtils.ts
@frontend/src/contexts/DateRangeContext.tsx

<interfaces>
From frontend/src/lib/api.ts (current signatures to EXTEND):
```typescript
export async function fetchHrKpis(): Promise<HrKpiResponse>
export async function fetchHrKpiHistory(): Promise<HrKpiHistoryPoint[]>
export async function fetchEmployees(params?: {
  department?: string;
  status?: string;
  search?: string;
}): Promise<EmployeeRow[]>
```

From frontend/src/lib/queryKeys.ts (current hrKpiKeys — minimal, must NOT shrink):
```typescript
export const hrKpiKeys = {
  all: () => ["hr", "kpis"] as const,
};
```

From frontend/src/contexts/DateRangeContext.tsx (source of truth):
```typescript
interface DateRangeContextValue {
  preset: Preset;
  range: DateRangeValue;           // { from?: Date; to?: Date }
  handleFilterChange: ...;
}
```

From frontend/src/lib/dateUtils.ts (assumed — already used by Sales): `toApiDate(d: Date): string` formats as `YYYY-MM-DD`. If absent, use `date-fns`'s `format(d, "yyyy-MM-dd")`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend HR fetchers + hrKpiKeys with date_from/date_to</name>
  <files>frontend/src/lib/api.ts, frontend/src/lib/queryKeys.ts</files>
  <read_first>
    - frontend/src/lib/api.ts (lines 310-390 for HR + employees fetchers)
    - frontend/src/lib/queryKeys.ts (whole file)
    - frontend/src/lib/dateUtils.ts (to confirm toApiDate presence)
  </read_first>
  <action>
    1. In `frontend/src/lib/api.ts`, update the three fetchers. Each new param is optional and must be a `YYYY-MM-DD` string (pre-formatted by the caller — fetchers do NOT accept `Date` objects to avoid timezone drift).
       ```typescript
       export async function fetchHrKpis(params?: {
         date_from?: string;
         date_to?: string;
       }): Promise<HrKpiResponse> {
         const q = new URLSearchParams();
         if (params?.date_from) q.set("date_from", params.date_from);
         if (params?.date_to) q.set("date_to", params.date_to);
         const qs = q.toString();
         return apiClient<HrKpiResponse>(`/api/hr/kpis${qs ? `?${qs}` : ""}`);
       }

       export async function fetchHrKpiHistory(params?: {
         date_from?: string;
         date_to?: string;
       }): Promise<HrKpiHistoryPoint[]> {
         const q = new URLSearchParams();
         if (params?.date_from) q.set("date_from", params.date_from);
         if (params?.date_to) q.set("date_to", params.date_to);
         const qs = q.toString();
         return apiClient<HrKpiHistoryPoint[]>(`/api/hr/kpis/history${qs ? `?${qs}` : ""}`);
       }
       ```
       For `fetchEmployees`, add `date_from` and `date_to` to the params object and append via the existing `URLSearchParams` pattern (do NOT rename the function or reorder existing args — keep the `{ department, status, search }` shape, just add both bounds).
    2. `HrKpiHistoryPoint.month` field semantics widen — update the comment to `// bucket label: "YYYY-MM-DD" (daily) | "YYYY-Www" (weekly) | "YYYY-MM" (monthly) | "YYYY-Qn" (quarterly)`. Do NOT rename the `month` field (backend schema keeps the name this phase).
    3. In `frontend/src/lib/queryKeys.ts`, extend `hrKpiKeys`:
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
       Keep the existing `all()` export for anyone still invalidating with the broad key.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npx tsc --noEmit 2>&amp;1 | tail -30</automated>
  </verify>
  <done>
    - Type-check is clean.
    - `grep -n "date_from" frontend/src/lib/api.ts` returns at least 3 matches (one per fetcher).
    - `hrKpiKeys.summary` and `hrKpiKeys.history` both exist and embed `{ from, to }`.
  </done>
  <acceptance_criteria>
    - `grep -nE "export async function fetchHrKpis\\(params\\?" frontend/src/lib/api.ts` returns a match.
    - `grep -nE "export async function fetchHrKpiHistory\\(params\\?" frontend/src/lib/api.ts` returns a match.
    - `grep -nE "date_from\\?:\\s*string" frontend/src/lib/api.ts` returns ≥3 matches.
    - `grep -nE "summary:.*from.*to" frontend/src/lib/queryKeys.ts` returns a match.
    - `grep -nE "history:.*from.*to" frontend/src/lib/queryKeys.ts` returns a match.
    - `grep -nE "employees:.*from.*to" frontend/src/lib/queryKeys.ts` returns a match.
    - `cd frontend &amp;&amp; npx tsc --noEmit` exits 0.
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add D-06 bucket derivation to chartTimeUtils</name>
  <files>frontend/src/lib/chartTimeUtils.ts, frontend/src/lib/chartTimeUtils.test.ts</files>
  <read_first>
    - frontend/src/lib/chartTimeUtils.ts (whole file — preserve existing exports)
    - .planning/phases/60-hr-date-range-filter/60-CONTEXT.md (D-06 thresholds verbatim)
  </read_first>
  <behavior>
    - `deriveHrBuckets(from: Date, to: Date): { granularity: "daily"|"weekly"|"monthly"|"quarterly"; buckets: { label: string; start: Date; end: Date }[] }`
    - Given a 15-day range → granularity="daily", buckets.length === 15, each bucket 1 day wide, labels "YYYY-MM-DD".
    - Given a 60-day range → granularity="weekly", buckets aligned to ISO week (Monday start), first and last buckets clipped to `from`/`to`, labels "YYYY-Www" (ISO week number, 2-digit zero-padded).
    - Given a 1-year range (365d) → granularity="monthly", 12-13 monthly buckets, labels "YYYY-MM", first and last clipped.
    - Given a 5-year range → granularity="quarterly", labels "YYYY-Qn".
    - `from > to` → returns `{ granularity: "daily", buckets: [] }` (no throw).
    - `from == to` (1-day range) → `granularity: "daily", buckets.length === 1`.
    - Target is ~10–30 buckets per CONTEXT D-06; exact counts are determined by thresholds, not by a target clamp.
    - Thresholds (length_days = (to - from) / 86400000 + 1):
      - `length_days <= 31` → daily
      - `length_days <= 91` → weekly
      - `length_days <= 731` → monthly
      - else → quarterly
  </behavior>
  <action>
    1. Write a Vitest test file at `frontend/src/lib/chartTimeUtils.test.ts` (create if absent) that asserts each row of the behaviour table above using fixed dates (e.g. `new Date("2026-04-01")` to `new Date("2026-04-15")` → daily, 15 buckets, first label `"2026-04-01"`). Include a test that label for ISO week 15 of 2026 is `"2026-W15"` and that quarterly label for a bucket starting 2024-04-01 is `"2024-Q2"`. Run tests; they MUST fail initially (RED).
    2. Append to `frontend/src/lib/chartTimeUtils.ts`:
       ```typescript
       export type HrBucketGranularity = "daily" | "weekly" | "monthly" | "quarterly";
       export interface HrBucket { label: string; start: Date; end: Date; }
       export interface HrBucketPlan {
         granularity: HrBucketGranularity;
         buckets: HrBucket[];
       }
       export function deriveHrBuckets(from: Date, to: Date): HrBucketPlan { ... }
       export function formatBucketLabel(granularity: HrBucketGranularity, d: Date): string { ... }
       ```
       Implement using `date-fns`: `differenceInDays`, `addDays`, `startOfISOWeek`, `endOfISOWeek`, `getISOWeek`, `getISOWeekYear`, `startOfMonth`, `endOfMonth`, `addMonths`, `startOfQuarter`, `endOfQuarter`, `addQuarters`, `getQuarter`, `min`, `max`. Clip first/last bucket edges with `max(start, from)` / `min(end, to)`.
    3. Do NOT modify or remove the existing exports (`buildMonthSpine`, `mergeIntoSpine`, `formatMonthYear`, `yearBoundaryDates`) — Sales' `RevenueChart` still imports them.
    4. Run tests again — MUST be green.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npx vitest run src/lib/chartTimeUtils.test.ts 2>&amp;1 | tail -30</automated>
  </verify>
  <done>
    - Tests pass in jsdom env.
    - Sales `RevenueChart.tsx` still compiles (`npx tsc --noEmit` clean).
    - No new runtime dependency added beyond `date-fns` (already used by `prevBounds.ts`).
  </done>
  <acceptance_criteria>
    - `grep -nE "export function deriveHrBuckets" frontend/src/lib/chartTimeUtils.ts` returns a match.
    - `grep -nE "export function formatBucketLabel" frontend/src/lib/chartTimeUtils.ts` returns a match.
    - `grep -nE "export function buildMonthSpine" frontend/src/lib/chartTimeUtils.ts` returns a match (existing export preserved).
    - `cd frontend &amp;&amp; npx vitest run src/lib/chartTimeUtils.test.ts` exits 0 with at least 4 test cases (daily / weekly / monthly / quarterly thresholds).
    - `cd frontend &amp;&amp; npx tsc --noEmit` exits 0.
  </acceptance_criteria>
</task>

</tasks>

<verification>
Type-check + Vitest run on `chartTimeUtils.test.ts`. No UI wired yet — no runtime UAT required this plan.
</verification>

<success_criteria>
- HR fetchers and `hrKpiKeys` accept/emit `date_from`/`date_to`.
- `deriveHrBuckets` + `formatBucketLabel` deliver D-06 thresholds exactly.
- Existing Sales imports from `chartTimeUtils.ts` are untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/60-hr-date-range-filter/60-02-SUMMARY.md` listing: final fetcher signatures, final `hrKpiKeys` shape, bucket-label examples for each granularity, and any choices made around date-fns helpers.
</output>
