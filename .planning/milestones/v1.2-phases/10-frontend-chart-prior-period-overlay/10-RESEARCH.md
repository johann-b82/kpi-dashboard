# Phase 10: Frontend — Chart Prior-Period Overlay - Research

**Researched:** 2026-04-12
**Domain:** Recharts 3.x dual-series composition, TanStack Query cache key extension, TypeScript pure-util patterns
**Confidence:** HIGH

## Summary

Phase 10 is a pure-frontend phase: the backend comparison API is already live (Phase 8 complete), and the frontend already receives `ChartResponse.previous` but ignores it (see RevenueChart.tsx line 87–94 comment). The work is threefold: (1) extend `fetchChartData` and the TanStack Query key to carry `comparison` + prev-bound params, (2) create a pure `selectComparisonMode` util that deterministically maps `Preset` → comparison mode, and (3) update `RevenueChart` to render a second `<Bar>` or `<Line>` at reduced opacity and add a `<Legend>` with contextual labels derived from an extended `periodLabels.ts`.

All decisions are fully locked in 10-CONTEXT.md. No architectural ambiguity remains. The codebase is clean and well-factored: every reusable asset (`computePrevBounds`, `periodLabels.ts`, `ChartResponse` type, `i18n` wiring, CSS token variables) is already in place from Phases 8 and 9.

**Primary recommendation:** Follow the two-plan split from the CONTEXT exactly — Plan 10-01 (pure-layer: util + fetch extension + queryKey), Plan 10-02 (component layer: RevenueChart composition + legend + human verification). No deviations needed.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Create pure util `frontend/src/lib/chartComparisonMode.ts` exporting `selectComparisonMode(preset: Preset): "previous_period" | "previous_year" | "none"`.

**D-02:** Preset → mode mapping:
| Preset | Mode |
|--------|------|
| `thisMonth` | `previous_period` |
| `thisQuarter` | `previous_period` |
| `thisYear` | `previous_year` |
| `allTime` | `none` |

**D-03:** No custom-range branch. `preset` is always one of the 4 presets. Selector is a 4-case switch — no `differenceInDays` threshold, no `Preset | null` handling.

**D-04:** `RevenueChart` derives mode from `preset` prop on every render.

**D-05 (Line mode):** Second `<Line>` with `strokeDasharray="4 4"`, `strokeOpacity={0.4}`, same `stroke="var(--color-success)"`. `dot={false}`.

**D-06 (Bar mode):** Second `<Bar>` with `fill="var(--color-success)"` + `fillOpacity={0.4}`. Recharts groups two `<Bar>` elements side-by-side per X bucket. Order: primary first, prior second.

**D-07:** Both modes keep existing `ResponsiveContainer` + `CartesianGrid` + axis config untouched. No layout changes.

**D-08:** `connectNulls` NOT used. Recharts gap rendering for null buckets — explicit gaps are the desired visual.

**D-09:** Extend `frontend/src/lib/periodLabels.ts` with `formatChartSeriesLabel(preset: Preset, range: DateRangeValue, locale: "de" | "en", t: TFunction): { current: string; prior: string }`.

**D-10:** Output rules per preset (EN only in Phase 10, DE in Phase 11):
| Preset | `current` | `prior` |
|--------|-----------|---------|
| `thisMonth` | `"Revenue {MonthName}"` | `"Revenue {MonthName prev}"` |
| `thisQuarter` | `"Revenue Q{N}"` | `"Revenue Q{N-1 or Q4 prev year}"` |
| `thisYear` | `"Revenue {YYYY}"` | `"Revenue {YYYY-1}"` |
| `allTime` | `"Revenue"` | `""` |

**D-11:** New i18n keys (EN only, `en.json` only — DO NOT touch `de.json`):
```json
"dashboard.chart.series.revenue": "Revenue",
"dashboard.chart.series.revenueMonth": "Revenue {{month}}",
"dashboard.chart.series.revenueQuarter": "Revenue Q{{quarter}}",
"dashboard.chart.series.revenueYear": "Revenue {{year}}"
```

**D-12:** Add `<Legend>` element to both `BarChart` and `LineChart`.

**D-13:** When `mode === "none"` (allTime), render single-series legend using only `current`.

**D-14:** Extend `fetchChartData` with new signature:
```ts
fetchChartData(
  start: string | undefined,
  end: string | undefined,
  granularity: "daily" | "weekly" | "monthly",
  comparison?: "previous_period" | "previous_year" | "none",
  prevStart?: string,
  prevEnd?: string,
): Promise<ChartResponse>
```

**D-15:** Extend `kpiKeys.chart` to embed `comparison` + `prevStart` + `prevEnd` in the cache key.

**D-16:** `RevenueChart` receives `preset` + `range` as new props (additive). `DashboardPage.tsx` line 39 threads them down. Inside the chart: derive mode → prevBounds → pick prev_start/prev_end pair → call fetchChartData → consume `data.previous`.

**D-17:** Reuse `computePrevBounds` as-is (DO NOT duplicate). Pick one of the two bound pairs based on `mode`.

**D-18:** `ChartResponse.previous` is already typed as `ChartPoint[] | null` in `api.ts:88`. No new type work needed beyond extending the fetch signature.

**Claude's Discretion:**
- Recharts' shared tooltip will naturally show both series with their respective `name` labels. No custom content component unless verification in 10-02 reveals it is unreadable.
- When `mode === "none"` (allTime): no comparison params passed; `data.previous` is null; render only current series with single-entry legend.
- When backend returns `previous: null` despite `mode !== "none"` (fresh install): render only current series. No banner — card em-dash badges already communicate this.
- Chart header stays as-is. No changes to header JSX.
- 2-plan split: 10-01 (pure-layer), 10-02 (visual wiring).

### Deferred Ideas (OUT OF SCOPE)
- Tooltip + empty-state explicit discussion — Claude's defaults apply
- Manual comparison-mode toggle — v1.3+
- Success-color token split — unnecessary for Phase 10
- Sparse-prior bucket visual fix beyond Recharts native gap rendering
- DE locale strings — Phase 11
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHART-04 | `RevenueChart` renders `previous_series` as a second Line/Bar at ≤40% opacity, visually subordinated, sharing same X axis | D-05/D-06: `strokeOpacity={0.4}` / `fillOpacity={0.4}`; positional alignment from Phase 8 backend; `ChartResponse.previous` already typed in api.ts |
| CHART-05 | Chart legend shows both series with contextual labels (e.g., "Revenue 2026" / "Revenue 2025") | D-09/D-10/D-11/D-12: `<Legend>` + `name` prop on each series + `formatChartSeriesLabel` in periodLabels.ts + 4 new EN i18n keys |
| CHART-06 | Default comparison mode driven by filter scope, no manual toggle | D-01/D-02/D-03/D-04: `selectComparisonMode(preset)` deterministic 4-case switch in chartComparisonMode.ts |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| recharts | ^3.8.1 | Chart rendering — `Bar`, `Line`, `Legend` | Already installed; verified in package.json |
| @tanstack/react-query | ^5.97.0 | Server state, queryKey extension | Already installed |
| date-fns | ^4.1.0 | `getQuarter`, `getYear`, `subMonths`, etc. | Already installed; used in prevBounds.ts |
| react-i18next | ^17.0.2 | `useTranslation`, `TFunction` | Already installed; already wired in RevenueChart |
| react | ^19.2.4 | Component rendering | Already installed |

**Installation:** No new packages needed. Zero new dependencies for Phase 10.

### No New Dependencies
Phase 9 STATE.md confirms the "no new deps" invariant. Phase 10 CONTEXT.md makes no exception. The verification scripts use `node --experimental-strip-types` (available in Node 25.9.0 on this machine). This pattern continues for 10-01's unit tests.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
frontend/src/
├── lib/
│   ├── chartComparisonMode.ts   # NEW — selectComparisonMode(preset) util (D-01)
│   └── periodLabels.ts          # EXTEND — add formatChartSeriesLabel (D-09)
├── components/dashboard/
│   └── RevenueChart.tsx         # MODIFY — add preset+range props, second series, Legend
├── pages/
│   └── DashboardPage.tsx        # MODIFY — pass preset+range to RevenueChart (line 39)
├── lib/
│   ├── api.ts                   # MODIFY — extend fetchChartData signature (D-14)
│   └── queryKeys.ts             # MODIFY — extend kpiKeys.chart (D-15)
├── locales/
│   └── en.json                  # MODIFY — 4 new keys (D-11); do NOT touch de.json
└── scripts/
    └── verify-phase-10-01.mts   # NEW — throwaway verify script for pure utils
```

### Pattern 1: Recharts Two-Series Bar (Grouped)

Two `<Bar>` children of `<BarChart>` with the same data array. Each bar must have a distinct `dataKey`. For Phase 10, the data array must be merged so each element has both `revenue` (current) and `revenuePrior` (prior) keys.

```tsx
// Source: Recharts 3.x docs — multiple Bar series
<BarChart data={mergedRows}>
  <Bar dataKey="revenue" fill="var(--color-success)" name={labels.current} />
  <Bar dataKey="revenuePrior" fill="var(--color-success)" fillOpacity={0.4} name={labels.prior} />
  <Legend />
</BarChart>
```

**Data merge shape** — both current and previous arrays share the same positional alignment (Phase 8 CHART-01 contract). The merge is a simple `map` over current rows:

```ts
const mergedRows = rows.map((row, i) => ({
  date: row.date,
  revenue: row.revenue,
  revenuePrior: prevRows[i]?.revenue ?? null,
}));
```

When `mode === "none"` or `data.previous === null`, `revenuePrior` is omitted or `null` on every row — Recharts renders no bar for null entries (verified behavior).

### Pattern 2: Recharts Two-Series Line

Two `<Line>` children of `<LineChart>` with same data array. The prior `<Line>` uses `strokeDasharray` + `strokeOpacity`:

```tsx
// Source: Recharts 3.x docs — multiple Line series
<LineChart data={mergedRows}>
  <Line
    type="monotone"
    dataKey="revenue"
    stroke="var(--color-success)"
    strokeWidth={2}
    dot={false}
    name={labels.current}
  />
  <Line
    type="monotone"
    dataKey="revenuePrior"
    stroke="var(--color-success)"
    strokeDasharray="4 4"
    strokeOpacity={0.4}
    dot={false}
    name={labels.prior}
  />
  <Legend />
</LineChart>
```

### Pattern 3: selectComparisonMode Pure Util

Follows the `frontend/src/lib/*.ts` small-pure-module pattern:

```ts
// frontend/src/lib/chartComparisonMode.ts
import type { Preset } from "./dateUtils.ts";

export function selectComparisonMode(
  preset: Preset,
): "previous_period" | "previous_year" | "none" {
  switch (preset) {
    case "thisMonth":    return "previous_period";
    case "thisQuarter":  return "previous_period";
    case "thisYear":     return "previous_year";
    case "allTime":      return "none";
  }
}
```

TypeScript exhaustiveness: `Preset` is a union of 4 string literals. The switch covers all 4 → no default needed; compiler enforces completeness.

### Pattern 4: queryKey Extension (Phase 9 precedent)

`kpiKeys.summary` was extended in Phase 9 to embed `prev` bounds. The `chart` key follows the identical pattern:

```ts
// frontend/src/lib/queryKeys.ts (current)
chart: (start, end, granularity) =>
  ["kpis", "chart", { start, end, granularity }] as const,

// Phase 10 extension
chart: (
  start: string | undefined,
  end: string | undefined,
  granularity: string,
  comparison?: string,
  prevStart?: string,
  prevEnd?: string,
) => ["kpis", "chart", { start, end, granularity, comparison, prevStart, prevEnd }] as const,
```

Existing callers (currently only `RevenueChart`) will be updated in the same plan as the extension — no breakage window.

### Pattern 5: Prev-Bounds Selection Inside Chart

`computePrevBounds` returns both `prev_period_*` and `prev_year_*` pairs. The chart picks one pair based on mode:

```ts
const mode = selectComparisonMode(preset);
const prevBounds = computePrevBounds(preset, range);

const prevStart = mode === "previous_period"
  ? prevBounds.prev_period_start
  : mode === "previous_year"
  ? prevBounds.prev_year_start
  : undefined;

const prevEnd = mode === "previous_period"
  ? prevBounds.prev_period_end
  : mode === "previous_year"
  ? prevBounds.prev_year_end
  : undefined;
```

This is the single-source-of-truth pattern from D-17.

### Anti-Patterns to Avoid

- **Duplicating `computePrevBounds` logic inside the chart:** D-17 explicitly forbids this. The chart must call the existing util and select one of its returned pairs.
- **Passing `comparison="none"` with prev params:** When `mode === "none"`, do not pass `prevStart`/`prevEnd` at all — match backend expectation that `comparison=none` means no prior params.
- **Using `connectNulls={true}`:** D-08 explicitly forbids this. Null gaps are desired.
- **Adding a `null` branch to `selectComparisonMode`:** D-03 forbids it. `preset` is non-nullable in `DashboardPage`.
- **Touching `de.json`:** D-11 explicitly forbids DE translation in Phase 10. Phase 11 handles it.
- **Inline label logic in RevenueChart.tsx:** D-09 mandates using `periodLabels.ts` extension, not inline strings.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Two-series Recharts chart | Custom SVG overlay | `<Bar>` / `<Line>` siblings with different `dataKey` in shared data array | Recharts handles layout, axis alignment, tooltip grouping, legend binding automatically |
| Chart legend | Manual `<div>` legend markup | `<Legend>` component from recharts | `name` prop on `<Bar>`/`<Line>` + `<Legend>` auto-syncs labels, colors, and visibility |
| Null-gap rendering | Zero-fill null buckets or skip logic | Recharts native null handling | Recharts `<Line>` leaves a gap for null data points; `<Bar>` omits null bars — no extra code needed |
| Prev-bounds for chart | Independent date math | `computePrevBounds` (already in `prevBounds.ts`) | Reuse prevents SC5 drift between card badges and chart overlay |
| Comparison mode selection | In-component date math with `differenceInDays` | `selectComparisonMode` (new pure util) | Pure function is independently unit-testable; no side effects; 4-case switch is self-documenting |

**Key insight:** Recharts' data-driven API handles the X-axis alignment problem automatically when both series share the same data array. The "alignment" work is purely a data merge in JS, not SVG manipulation.

---

## Actual File Layout (from Source)

### RevenueChart.tsx — Current State

**Path:** `frontend/src/components/dashboard/RevenueChart.tsx`

**Component shape:** A single functional component with an internal `chartType: "bar" | "line"` state toggle. Two independent render branches — `BarChart` for bar mode, `LineChart` for line mode. No `ComposedChart` — uses the specialized primitives.

**Current imports from recharts:** `ResponsiveContainer`, `BarChart`, `LineChart`, `Bar`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`. No `Legend` currently.

**Data consumption:** `data?.current` is read at line 91; `data.previous` is explicitly ignored (comment at line 87).

**Props:** Currently only `{ startDate?: string; endDate?: string }`. Phase 10 adds `preset: Preset` and `range: DateRangeValue` (additive, non-breaking since DashboardPage is the only caller).

**Query pattern:** Uses `useQuery` with `kpiKeys.chart(startDate, endDate, GRANULARITY)` and `fetchChartData(startDate, endDate, GRANULARITY)`. No `useMemo` for prevBounds — the chart currently doesn't use prevBounds.

**i18n:** Already imports `useTranslation` and uses `t()` for chart title, type buttons, error messages.

**CSS tokens used:** `var(--color-success)` for bar/line fill/stroke. `var(--color-border)` for grid. `var(--color-muted-foreground)` for axes. `var(--color-popover)` for tooltip.

**No ComposedChart needed:** Two `<Bar>` children inside `<BarChart>` is idiomatic Recharts. Two `<Line>` children inside `<LineChart>` is idiomatic Recharts. `ComposedChart` is only needed when mixing Bar and Line in the same chart — not this use case.

### DashboardPage.tsx — Current Prop-Threading

**Path:** `frontend/src/pages/DashboardPage.tsx`

**Line 39:** `<RevenueChart startDate={startDate} endDate={endDate} />`

This is the only change point for prop threading. Both `preset` and `range` are already in scope on `DashboardPage` (state at lines 12 and 13). The KpiCardGrid already receives them (lines 33–38). Adding them to `RevenueChart` is a one-line change.

**`preset` type:** `Preset` (non-nullable, default `"thisYear"`). No null branch needed anywhere in Phase 10.

### api.ts — fetchChartData Current Signature

**Path:** `frontend/src/lib/api.ts`

**Lines 116–127:** `fetchChartData(start, end, granularity)` — 3 params, constructs `URLSearchParams({ granularity })`, adds optional start/end. Returns `Promise<ChartResponse>`.

**`ChartResponse` type (lines 86–89):**
```ts
export interface ChartResponse {
  current: ChartPoint[];
  previous: ChartPoint[] | null;
}
```
`previous` is already typed as `ChartPoint[] | null`. D-18 is confirmed: no new type work needed.

**`ChartPoint` type (lines 70–76):**
```ts
export interface ChartPoint {
  date: string;
  revenue: number | null;
}
```

### queryKeys.ts — chart Key Current Shape

**Path:** `frontend/src/lib/queryKeys.ts`

**Lines 16–18:** `chart: (start, end, granularity) => ["kpis", "chart", { start, end, granularity }]`

Extension adds `comparison`, `prevStart`, `prevEnd` to the object argument — TanStack Query does deep equality on queryKey arrays, so any change to these values triggers a refetch automatically.

### prevBounds.ts — computePrevBounds Signature

**Path:** `frontend/src/lib/prevBounds.ts`

**Signature:** `computePrevBounds(preset: Preset | null, range: { from?: Date; to?: Date }, today: Date = new Date()): PrevBounds`

**Note:** The function signature accepts `Preset | null` (for historical custom range support). Phase 10 will always call it with a non-null `Preset`, so the null branch is never triggered. No changes to this function.

**Returns for `thisYear`:** Only `prev_year_start` and `prev_year_end` — `prev_period_*` are `undefined`. This is intentional (Phase 8 decision D collapse). The chart's mode-based selection handles this correctly: when `mode === "previous_year"`, pick `prev_year_*`.

### periodLabels.ts — Extension Point

**Path:** `frontend/src/lib/periodLabels.ts`

**Current exports:** `formatPrevPeriodLabel`, `formatPrevYearLabel` — both use `Intl.DateTimeFormat` and `date-fns`.

**Extension:** Add `formatChartSeriesLabel(preset, range, locale, t)` returning `{ current: string; prior: string }`. Uses `Intl.DateTimeFormat(locale, { month: "long" })` for month name, `getQuarter()` from date-fns for quarter number, `getYear()` from date-fns for year. Uses `t()` with interpolation for the i18n keys from D-11.

**Note on `TFunction` import:** `periodLabels.ts` currently does NOT import i18next — it is a pure utility. Adding `t: TFunction` as a parameter maintains this pattern (injects the function rather than importing `useTranslation`). The caller (`RevenueChart`) passes `t` from its existing `useTranslation()` hook.

### Backend Endpoint — No Changes Needed

**Path:** `backend/app/routers/kpis.py`

**Lines 114–116:** The `GET /api/kpis/chart` endpoint already accepts `comparison`, `prev_start`, `prev_end` query params. Phase 10 does NOT touch the backend.

---

## Common Pitfalls

### Pitfall 1: Separate Data Arrays for Two Series

**What goes wrong:** Passing two separate data arrays to two `<Bar>` or `<Line>` elements (via separate `data` props on each series element) instead of a single merged array on the chart container.

**Why it happens:** Developers assume each series needs its own data source.

**How to avoid:** Merge current and prior rows into a single array where each element has both `revenue` and `revenuePrior` keys. Both `<Bar>` / `<Line>` elements read different `dataKey` values from the same array. The X axis `dataKey="date"` then works for both series automatically.

**Warning signs:** X axis shows duplicate ticks, series don't align visually, `<Legend>` shows wrong labels.

### Pitfall 2: Missing null Handling on Prior Series Data

**What goes wrong:** Calling `Number(p.revenue)` on prior series points that are `null` (CHART-03 partial prior data) converts null to `0`, producing a fabricated zero bar/line instead of a gap.

**How to avoid:** Mirror the existing current-series coercion pattern: `p.revenue === null ? null : Number(p.revenue)`. Do not call `Number(null)` which returns `0`.

**Warning signs:** Flat line at `€0` for months before data exists.

### Pitfall 3: Forgetting `Legend` Import

**What goes wrong:** `Legend` is not currently imported in RevenueChart.tsx. Adding `<Legend />` JSX without updating the import causes a runtime error.

**How to avoid:** Add `Legend` to the recharts destructured import at the top of RevenueChart.tsx. Also add `getQuarter` and `getYear` to date-fns imports in periodLabels.ts if not already present.

### Pitfall 4: queryKey Not Including prevStart/prevEnd

**What goes wrong:** If the queryKey doesn't embed prev bounds, TanStack Query returns cached data when the date filter changes, even though the prior series bounds changed.

**How to avoid:** D-15 requires embedding `comparison`, `prevStart`, `prevEnd` in the cache key. Verify the queryKey is updated before the fetch function.

**Warning signs:** SC5 failure — "stale overlay from the previous filter" (ROADMAP success criterion 5).

### Pitfall 5: TFunction Type Import for periodLabels Extension

**What goes wrong:** TypeScript errors when importing `TFunction` from i18next in a non-component `.ts` file if the wrong import path is used, or if the function is typed as `any`.

**How to avoid:** Import `import type { TFunction } from "i18next"` (not from "react-i18next"). `i18next` is already a transitive dependency. Alternatively, type the parameter as `(key: string, options?: object) => string` for a minimal inline type.

### Pitfall 6: Bar Grouping vs Stacking

**What goes wrong:** Recharts defaults to grouped (side-by-side) bars for multiple `<Bar>` elements. If someone adds `stackId` accidentally, bars stack instead of group.

**How to avoid:** Do NOT add `stackId` to either `<Bar>`. D-06 specifies grouped (side-by-side). Grouped is Recharts default — no action needed.

---

## Code Examples

Verified patterns from direct source reading:

### Merged Row Construction

```ts
// In RevenueChart.tsx, replace current `rows` derivation
const currentRows = (data?.current ?? []).map((p) => ({
  date: p.date,
  revenue: p.revenue === null ? null : Number(p.revenue),
}));

const prevRows = data?.previous ?? null;

const rows = currentRows.map((row, i) => ({
  date: row.date,
  revenue: row.revenue,
  revenuePrior: prevRows && prevRows[i]?.revenue !== undefined
    ? (prevRows[i].revenue === null ? null : Number(prevRows[i].revenue))
    : undefined,
}));
```

### Legend Addition (BarChart branch)

```tsx
// Add Legend import from recharts, then inside <BarChart>:
<Legend />
<Bar dataKey="revenue" fill="var(--color-success)" name={labels.current} />
{mode !== "none" && data?.previous != null && (
  <Bar dataKey="revenuePrior" fill="var(--color-success)" fillOpacity={0.4} name={labels.prior} />
)}
```

### Legend Addition (LineChart branch)

```tsx
<Legend />
<Line
  type="monotone"
  dataKey="revenue"
  stroke="var(--color-success)"
  strokeWidth={2}
  dot={false}
  name={labels.current}
/>
{mode !== "none" && data?.previous != null && (
  <Line
    type="monotone"
    dataKey="revenuePrior"
    stroke="var(--color-success)"
    strokeDasharray="4 4"
    strokeOpacity={0.4}
    dot={false}
    name={labels.prior}
  />
)}
```

### fetchChartData Extension

```ts
// Source: api.ts line 116+ — extend existing function
export async function fetchChartData(
  start: string | undefined,
  end: string | undefined,
  granularity: "daily" | "weekly" | "monthly" = "monthly",
  comparison?: "previous_period" | "previous_year" | "none",
  prevStart?: string,
  prevEnd?: string,
): Promise<ChartResponse> {
  const params = new URLSearchParams({ granularity });
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  if (comparison && comparison !== "none") {
    params.set("comparison", comparison);
    if (prevStart) params.set("prev_start", prevStart);
    if (prevEnd) params.set("prev_end", prevEnd);
  }
  const res = await fetch(`/api/kpis/chart?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch chart data");
  return res.json();
}
```

Note: backend param names are `prev_start` / `prev_end` (not `prev_start_date`) — confirmed from kpis.py lines 114–115.

### Verify Script Pattern (matching Phase 9 precedent)

```ts
// frontend/scripts/verify-phase-10-01.mts
// Run: node --experimental-strip-types frontend/scripts/verify-phase-10-01.mts
import { selectComparisonMode } from "../src/lib/chartComparisonMode.ts";

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`[FAIL] ${label}\n  expected: ${JSON.stringify(expected)}\n  actual: ${JSON.stringify(actual)}`);
  }
}

assertEq(selectComparisonMode("thisMonth"), "previous_period", "thisMonth");
assertEq(selectComparisonMode("thisQuarter"), "previous_period", "thisQuarter");
assertEq(selectComparisonMode("thisYear"), "previous_year", "thisYear");
assertEq(selectComparisonMode("allTime"), "none", "allTime");
console.log("Phase 10-01: selectComparisonMode — ALL GREEN");
```

---

## Lock-Step Coordination Pattern (SC5)

The KPI cards and chart use independent `useQuery` hooks, but they automatically stay in lock-step because:

1. Both derive their prev bounds from `computePrevBounds(preset, range)` with the same inputs
2. Both embed those bounds in their respective queryKeys
3. `DashboardPage` is the single source of `preset` + `range` state
4. When the user changes the date filter, `DashboardPage.handleFilterChange` updates both `preset` and `range` atomically (via `useState`)
5. Both queries invalidate simultaneously because both queryKeys change simultaneously

No explicit query invalidation coordination is needed — the shared state source + deterministic queryKey derivation provides lock-step behavior automatically.

---

## TypeScript Types — Confirmed No New Work

`ChartResponse.previous: ChartPoint[] | null` is already defined in `api.ts:86-89`. Confirmed by reading the file. D-18 is accurate.

The only type extension is the `fetchChartData` signature (3 new optional params). The `kpiKeys.chart` factory gets inline type widening. The `RevenueChart` props interface gains `preset: Preset` and `range: DateRangeValue` — both types are already imported in the project.

---

## i18n — Current en.json State

The en.json currently has `dashboard.chart.*` keys for title and type buttons. It does NOT have `dashboard.chart.series.*` keys. The 4 new keys from D-11 are additions, not overrides:

```json
"dashboard.chart.series.revenue": "Revenue",
"dashboard.chart.series.revenueMonth": "Revenue {{month}}",
"dashboard.chart.series.revenueQuarter": "Revenue Q{{quarter}}",
"dashboard.chart.series.revenueYear": "Revenue {{year}}"
```

Note: D-10 uses "Umsatz" in the original decision table as a placeholder; D-11 clarifies the EN side uses "Revenue". The actual German strings are Phase 11's responsibility — `de.json` must NOT be touched in Phase 10.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. The Validation Architecture section is skipped per the explicit opt-out.

**Verification strategy follows Phase 9 precedent:**

- **Plan 10-01:** Throwaway `node --experimental-strip-types frontend/scripts/verify-phase-10-01.mts` asserting all 4 cases of `selectComparisonMode`, plus `formatChartSeriesLabel` outputs for all 4 presets × EN locale.
- **Plan 10-02:** Human verification checkpoint — visual inspection at 1080p and 1440p:
  - "Diesen Monat": grouped bars/dashed line visible with 40% opacity prior series; legend shows "Revenue April" / "Revenue March"
  - "Dieses Quartal": prior Q1 overlay visible; legend shows "Revenue Q2" / "Revenue Q1"
  - "Dieses Jahr": prior year overlay visible; legend shows "Revenue 2026" / "Revenue 2025"
  - "Gesamter Zeitraum": single series; legend shows "Revenue" with no prior entry
  - Switching presets: overlay updates in lock-step with card badges (no stale data from prior preset)
  - Null buckets: if prior data is partial, visual gap renders (no fabricated zero line or bar)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 10 is a pure frontend code change. No external tool dependencies beyond Node.js (v25.9.0, confirmed) and the already-running Docker Compose stack (not required for pure utility testing).

---

## Open Questions

1. **`date-fns` `getQuarter` usage in periodLabels.ts extension**
   - What we know: `date-fns` v4.1.0 is installed; `prevBounds.ts` already uses `addDays`, `startOfQuarter`, `subQuarters` etc.
   - What's unclear: Whether `getQuarter` is exported from `date-fns` v4. (It was in v2/v3.) The safe fallback is `Math.floor(date.getMonth() / 3) + 1` which is already used in `periodLabels.ts` line 63 for the badge label.
   - Recommendation: Use the existing pattern `Math.floor(date.getMonth() / 3) + 1` — it's already proven in this codebase. No need to import `getQuarter`.

2. **Legend positioning / styling with Tailwind v4**
   - What we know: Recharts `<Legend>` renders a default horizontal legend below the chart. The existing chart uses `var(--color-*)` CSS tokens for other elements.
   - What's unclear: Whether the default Recharts legend styling conflicts with Tailwind v4's CSS-first config or the ThemeProvider's CSS variable scheme.
   - Recommendation: Accept the Recharts default legend in Plan 10-02. The human verification step explicitly catches visual issues. If the default is visually inconsistent, add `wrapperStyle={{ color: "var(--color-foreground)" }}` to `<Legend>`.

3. **Tooltip behavior with two series**
   - What we know: Claude's Discretion in CONTEXT.md documents the default: Recharts shared tooltip shows both series with their `name` labels + existing `formatCurrency` formatter.
   - What's unclear: Whether the `formatter` prop on `<Tooltip>` needs updating to handle the two-series case.
   - Recommendation: The existing `formatter={(v) => formatCurrency(Number(v))}` applies to all series values. This works correctly for both series. No change needed unless verification reveals it's unreadable.

---

## Sources

### Primary (HIGH confidence)
- Direct source reading: `frontend/src/components/dashboard/RevenueChart.tsx` — exact component shape, imports, data consumption pattern
- Direct source reading: `frontend/src/lib/api.ts` — `ChartResponse` type (lines 86-89), `fetchChartData` signature (lines 116-127), `ChartPoint.revenue: number | null` type
- Direct source reading: `frontend/src/lib/queryKeys.ts` — `kpiKeys.chart` current shape
- Direct source reading: `frontend/src/lib/prevBounds.ts` — `computePrevBounds` signature and return shape
- Direct source reading: `frontend/src/lib/periodLabels.ts` — extension point pattern
- Direct source reading: `frontend/src/pages/DashboardPage.tsx` — prop threading point (line 39)
- Direct source reading: `frontend/src/locales/en.json` — existing keys, gap for `dashboard.chart.series.*`
- Direct source reading: `backend/app/routers/kpis.py` lines 109-116 — backend chart endpoint param names (`prev_start`, `prev_end`, `comparison`)
- Direct source reading: `frontend/scripts/verify-phase-09-01.mts` — verification script pattern
- Direct source reading: `.planning/config.json` — `nyquist_validation: false`
- Direct source reading: `frontend/package.json` — recharts ^3.8.1, react ^19.2.4, date-fns ^4.1.0 confirmed

### Secondary (MEDIUM confidence)
- 10-CONTEXT.md decisions D-01 through D-18 — fully locked implementation decisions
- 10-DISCUSSION-LOG.md — rationale for each decision; no ambiguity remaining
- REQUIREMENTS.md CHART-04/05/06 — success criteria

### Tertiary (LOW confidence)
- None. All findings verified directly from source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json
- Architecture: HIGH — all patterns verified from reading actual source files; Phase 8/9 contracts confirmed
- Pitfalls: HIGH — derived from direct code inspection (null coercion, queryKey shape, data merge requirement)
- Recharts two-series API: HIGH — `Bar`/`Line` sibling pattern is fundamental Recharts; existing chart already uses both primitives

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (Recharts 3.x API is stable; no breaking changes expected in 30 days)
