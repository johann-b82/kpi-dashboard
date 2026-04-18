# Phase 31: Chart Readability - Research

**Researched:** 2026-04-16
**Domain:** Recharts x-axis formatting, time-series gap-filling, React/TypeScript frontend
**Confidence:** HIGH

## Summary

Phase 31 is a pure frontend change. The three requirements touch two surfaces: (1) the `formatXAxis` tick formatter functions inside `RevenueChart.tsx` and the `formatMonth` formatter inside `HrKpiCharts.tsx` (MiniChart), and (2) the data layer that feeds those charts — either the backend response or a client-side normalization step.

CHART-01 (year-aware tick labels, e.g. `Nov '25`) requires changing the `Intl.DateTimeFormat` calls in both chart files. CHART-02 (year boundary separator) requires either a Recharts `ReferenceLine` per year-turn or a custom `XAxis` tick renderer that visually emphasizes the first month of a new year. CHART-03 (gap-filled month series — axis labels for months with no data) requires generating a full month spine on the frontend and left-joining the API data into it, because the backend `/api/kpis/chart` endpoint only returns buckets that exist in the database, and the HR history endpoint returns exactly 12 months (always dense, no gap issue there).

No backend API changes are needed. The scope is isolated to `RevenueChart.tsx`, `HrKpiCharts.tsx`, and a new shared utility (e.g. `src/lib/chartTimeUtils.ts`) for the month-spine generator and tick formatter.

**Primary recommendation:** Add a shared `buildMonthSpine(start, end)` utility that generates the full ISO-month sequence for the selected date range, merge API data into it (null for missing months), and update both `formatXAxis` / `formatMonth` to emit `MMM 'YY` format. Use Recharts `ReferenceLine` for year-boundary markers.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHART-01 | All chart x-axes display year alongside month (e.g., `Nov '25`) on both Sales and HR dashboards | Change `Intl.DateTimeFormat` options in `formatXAxis` (RevenueChart) and `formatMonth` (MiniChart) to include 2-digit year |
| CHART-02 | When chart data spans multiple years, a visual year grouping/separator distinguishes year boundaries | Add Recharts `ReferenceLine` at each year-turn ISO date, or use a custom `XAxis` tick component that renders a bolder/colored label for January ticks |
| CHART-03 | Charts show all months in the date range on the x-axis, even months with no data | Generate a full month spine client-side for the Sales chart (HR already returns a fixed 12-month dense array). Left-join API data into the spine — missing months get `revenue: null` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack is locked: React 19, TypeScript, Vite, Recharts 3.8.1, Tailwind CSS 4, TanStack Query 5
- All chart defaults (axis/grid/tooltip tokens) must go through `src/lib/chartDefaults.ts` (CSS variable tokens, dark-mode safe)
- No backend API changes required for this phase (scope is frontend only)
- Docker Compose constraint does not affect this phase
- Do not use `--reload` in production Docker; irrelevant to this phase
- GSD workflow enforcement: all edits through GSD commands

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| recharts | 3.8.1 | `XAxis tickFormatter`, `ReferenceLine`, custom `tick` prop | All needed APIs are present in this version |
| React | 19.2.5 | Functional components, hooks | — |
| TypeScript | 5.x | Type safety | — |

### No New Dependencies

All requirements are achievable with the existing Recharts 3.8.1 API. Do not add libraries.

**Relevant Recharts APIs (HIGH confidence — verified from Recharts 3.x docs):**

- `XAxis tickFormatter`: `(value: string, index: number) => string` — simplest path for CHART-01
- `XAxis tick`: accepts a React component for fully custom SVG tick rendering — needed for CHART-02 if using a visual emphasis approach
- `ReferenceLine`: `y`/`x` prop, `strokeDasharray`, `label` — already used in `HrKpiCharts.tsx` for target lines; reuse pattern for year boundary vertical lines
- `XAxis ticks` (explicit array): pass an explicit `ticks` array to force Recharts to show specific x-axis values even when data is null at those positions — critical for CHART-03

## Architecture Patterns

### Recommended Project Structure (additions only)

```
frontend/src/
├── lib/
│   ├── chartDefaults.ts      # existing — do not change tokens
│   └── chartTimeUtils.ts     # NEW — month spine + tick formatter
├── components/dashboard/
│   ├── RevenueChart.tsx      # EDIT — formatXAxis, data normalization
│   └── HrKpiCharts.tsx       # EDIT — formatMonth in MiniChart
```

### Pattern 1: Month Spine Generator (CHART-03 Sales chart)

**What:** Generate the full ordered list of ISO month strings (`YYYY-MM`) that cover `[startDate, endDate]`, then merge API `ChartPoint[]` into it, producing null revenue for empty months.

**When to use:** Only for the Sales/Revenue chart. HR already returns a 12-month dense array (the backend always fills all 12 slots in `get_hr_kpi_history`) — no client-side gap-fill needed there.

**Key insight on HR gap fill:** The HR backend endpoint (`/api/hr/kpis/history`) always loops over the last 12 calendar months and emits a row for each, even if KPIs are null. So `HrKpiCharts.tsx` already has a dense month array. Gap-filling is not needed client-side for HR. However, the x-axis label for HR still needs the year appended (CHART-01) and year-boundary markers still apply (CHART-02).

**Example — spine + merge:**
```typescript
// src/lib/chartTimeUtils.ts

/** Generate every YYYY-MM string from startDate to endDate inclusive. */
export function buildMonthSpine(startDate: string, endDate: string): string[] {
  const spine: string[] = [];
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    spine.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return spine;
}

/** Merge API ChartPoint[] into a dense month spine. Missing months → revenue: null */
export function mergeIntoSpine(
  spine: string[],
  points: ChartPoint[],
): ChartPoint[] {
  const map = new Map(points.map(p => [p.date.slice(0, 7), p.revenue]));
  return spine.map(date => ({
    date,
    revenue: map.get(date.slice(0, 7)) ?? null,
  }));
}

/** Format a date string as "Nov '25" */
export function formatMonthYear(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(d);
  const year = String(d.getFullYear()).slice(2);
  return `${month} '${year}`;
}

/** Return all year-boundary ISO dates (Jan 01 of each year) present in the spine. */
export function yearBoundaryDates(spine: string[]): string[] {
  return spine.filter(d => d.slice(5, 7) === "01");
}
```

### Pattern 2: Year-Aware Tick Formatter (CHART-01)

Replace the current `formatXAxis` in `RevenueChart.tsx`:

```typescript
// Before (current code):
return new Intl.DateTimeFormat(locale, { month: "short" }).format(d);

// After:
return formatMonthYear(dateStr, locale);  // → "Nov '25"
```

Same change in `MiniChart.formatMonth` inside `HrKpiCharts.tsx`.

**Edge case — `thisMonth` preset:** `RevenueChart` uses calendar-week labels when preset is `thisMonth`. Do NOT apply year formatting in that branch. Only apply it to the `thisQuarter`, `thisYear`, `allTime` (month-granularity) branches.

### Pattern 3: Year Boundary Separator (CHART-02)

Use Recharts `ReferenceLine` with `x` prop (vertical line) at each January 1st date present in the chart data. This already matches the `ReferenceLine` usage pattern in `HrKpiCharts.tsx` (used for target lines).

```typescript
// In BarChart / AreaChart render:
{yearBoundaryDates(spine).map(date => (
  <ReferenceLine
    key={date}
    x={date}
    stroke="var(--color-border)"
    strokeDasharray="4 2"
    strokeWidth={1}
    label={{
      value: date.slice(0, 4),  // "2025"
      position: "insideTopLeft",
      fontSize: 10,
      fill: "var(--color-muted-foreground)",
    }}
  />
))}
```

**For HR MiniCharts:** Apply the same `ReferenceLine` pattern. MiniChart already accepts `data` as a prop — derive year boundaries from the `month` field of the data array inside `MiniChart`.

**Consideration — `thisMonth` preset:** Only one month in view, never a year boundary. Guard the ReferenceLine rendering to skip when spine length < 13 months (no multi-year) or simply check `yearBoundaryDates(spine).length > 0`.

### Pattern 4: Explicit XAxis `ticks` array (CHART-03 x-axis label guarantee)

When a spine is generated client-side, pass it explicitly as the `ticks` prop on `XAxis` to guarantee Recharts renders tick marks for all months, not just those with data:

```typescript
<XAxis
  dataKey="date"
  ticks={spine}   // force all months to show
  {...axisProps}
  tickFormatter={formatXAxis}
/>
```

Without `ticks`, Recharts auto-selects tick positions from data rows — months where `revenue` is null may be skipped. The explicit `ticks` prop overrides this.

### Anti-Patterns to Avoid

- **Don't add year label via a second XAxis:** Using two stacked `XAxis` components (one for month, one for year) creates layout complexity and clashes with the existing `axisProps` shared defaults. Use the combined `Nov '25` string in the single existing axis instead.
- **Don't gap-fill on the backend:** The phase is scoped as frontend-only and no backend API changes are desired. Compute the spine client-side.
- **Don't modify `chartDefaults.ts` for phase-specific styling:** Year boundary lines should use existing CSS variable tokens (`--color-border`, `--color-muted-foreground`) passed inline, not added to the shared defaults file.
- **Don't apply year label to weekly/calendar-week axis:** The `thisMonth` branch in `RevenueChart.formatXAxis` uses `KW N` / `CW N` format. Leave that branch unchanged.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Year boundary detection | Custom date arithmetic | `date.slice(5,7) === "01"` filter on spine | Trivial after spine is built |
| Locale month name | Custom locale string map | `Intl.DateTimeFormat` with `month: "short"` | Already used in codebase; locale-aware |
| Vertical separator line | Custom SVG overlay | Recharts `ReferenceLine x=` | Already proven in HrKpiCharts for horizontal target lines |

## Common Pitfalls

### Pitfall 1: Recharts ignores null-value ticks without explicit `ticks` prop

**What goes wrong:** If the data array contains `{ date: "2024-11-01", revenue: null }` and the `ticks` prop is not set, Recharts may skip rendering that tick on the x-axis. The month label disappears despite the data row being present.

**Why it happens:** Recharts auto-calculates tick positions from the domain of non-null data values by default.

**How to avoid:** Always pass `ticks={spine}` explicitly on `XAxis` when gap-filling is active (Sales chart). The HR chart does not need this because its data is always dense.

**Warning signs:** Missing month labels in the middle of the x-axis when date range straddles a gap.

### Pitfall 2: `ReferenceLine x=` must match exact `dataKey` value

**What goes wrong:** `ReferenceLine x="2025-01-01"` fails silently if the actual `dataKey="date"` values are formatted differently (e.g. `"2025-01"` without the day).

**Why it happens:** Recharts matches `x` to `dataKey` values by string equality.

**How to avoid:** The spine generates dates as `YYYY-MM-01` ISO strings. Ensure `ReferenceLine x` values use the same `YYYY-MM-01` format, matching the `date` field in `ChartPoint`.

**Warning signs:** Year boundary lines not appearing despite code being in place.

### Pitfall 3: `startDate` may be undefined (allTime preset)

**What goes wrong:** `buildMonthSpine(startDate, endDate)` receives `undefined` when the user selects "All Time" — the preset resolves to `{ from: undefined, to: undefined }`.

**Why it happens:** `getPresetRange("allTime")` returns `{ from: undefined, to: undefined }` by design. The backend handles open-ended queries; the frontend must handle the same for spine generation.

**How to avoid:** When `startDate` or `endDate` is undefined, derive spine bounds from the actual API response data (`data.current[0].date` to `data.current[last].date`) rather than from the preset. If the API returns zero points, return an empty spine.

**Warning signs:** TypeError on `startDate.split("-")` at runtime.

### Pitfall 4: `thisMonth` preset uses weekly buckets — don't reformat those ticks

**What goes wrong:** Applying `formatMonthYear` to the `thisMonth` branch outputs a month label (`Apr '26`) instead of the expected calendar-week label (`KW 16`).

**Why it happens:** The `thisMonth` branch in `RevenueChart.formatXAxis` has its own label format. The refactor must preserve this branching.

**How to avoid:** Keep the `if (preset === "thisMonth")` branch intact and unchanged; only modify the fallthrough case.

### Pitfall 5: HR MiniChart uses `"YYYY-MM"` month format, not `"YYYY-MM-DD"`

**What goes wrong:** `formatMonthYear` receives `"2025-11"` (no day component) and `new Date("2025-11")` parses as `Invalid Date` in some browsers.

**Why it happens:** The HR history API returns `month: "YYYY-MM"` (see `HrKpiHistoryPoint.month`), not full ISO dates. The backend emits `f"{year}-{month:02d}"`.

**How to avoid:** In `MiniChart.formatMonth`, append `-01` before constructing the `Date`: `new Date(m + "-01")`. This is already done in the current code (`new Date(m + "-01")`). Keep this pattern when integrating `formatMonthYear`.

## Code Examples

### Updated formatXAxis (RevenueChart.tsx)

```typescript
// Source: existing file pattern + formatMonthYear from chartTimeUtils.ts
const formatXAxis = (dateStr: string) => {
  const d = new Date(dateStr);
  if (preset === "thisMonth") {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
    const cw = Math.ceil((days + jan1.getDay() + 1) / 7);
    return i18nLocale === "de" ? `KW ${cw}` : `CW ${cw}`;
  }
  // Multi-month view: include year
  return formatMonthYear(dateStr, locale);  // "Nov '25"
};
```

### Updated formatMonth (HrKpiCharts.tsx MiniChart)

```typescript
// Source: existing pattern — append "-01" to handle "YYYY-MM" input
const formatMonth = (m: string) => {
  return formatMonthYear(m + "-01", locale);  // "Nov '25"
};
```

### Gap-filled rows construction (RevenueChart.tsx)

```typescript
// Replace the current `rows` construction:
const currentPoints = data?.current ?? [];
const spine = (startDate && endDate)
  ? buildMonthSpine(startDate, endDate)
  : currentPoints.map(p => p.date);

const mergedCurrent = mergeIntoSpine(spine, currentPoints);

const rows = mergedCurrent.map((p, i) => {
  const priorRaw = prevPoints ? (prevPoints[i]?.revenue ?? null) : null;
  return {
    date: p.date,
    revenue: p.revenue,
    revenuePrior: prevPoints === null ? undefined : priorRaw,
  };
});
```

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. This is a pure frontend code change within the existing Docker Compose stack. No new CLIs, runtimes, or services required.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (detected via vite config) |
| Config file | `frontend/vite.config.ts` (check for `test` block) or `vitest.config.ts` |
| Quick run command | `cd frontend && npm test -- --run` |
| Full suite command | `cd frontend && npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHART-01 | `formatMonthYear("2025-11-01", "en-US")` returns `"Nov '25"` | unit | `npm test -- --run src/lib/chartTimeUtils.test.ts` | ❌ Wave 0 |
| CHART-02 | `yearBoundaryDates` returns only Jan-01 dates | unit | `npm test -- --run src/lib/chartTimeUtils.test.ts` | ❌ Wave 0 |
| CHART-03 | `buildMonthSpine` + `mergeIntoSpine` fills missing months with null revenue | unit | `npm test -- --run src/lib/chartTimeUtils.test.ts` | ❌ Wave 0 |
| CHART-03 | Regression: existing chart features (bar/line toggle, prior overlay) still work | smoke | Visual check — manual only | N/A |

### Sampling Rate

- **Per task commit:** `cd frontend && npm run lint` (fast lint gate)
- **Per wave merge:** `cd frontend && npm test -- --run`
- **Phase gate:** Full suite green + manual visual check of both dashboards before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/lib/chartTimeUtils.test.ts` — covers CHART-01, CHART-02, CHART-03 utility functions
- [ ] Verify `vitest` is in devDependencies: `cat frontend/package.json | grep vitest`

## State of the Art

| Old Approach | Current Approach | Impact for This Phase |
|--------------|------------------|----------------------|
| Month-only tick label: `"Nov"` | Month + year: `"Nov '25"` | Need to update both chart files |
| Backend-only data rows → sparse axis | Client-side spine + merge → dense axis | Need `buildMonthSpine` + `mergeIntoSpine` utility |
| No year boundary markers | `ReferenceLine x=` vertical separators | New JSX in both chart components |

## Open Questions

1. **Is Vitest already configured in the frontend?**
   - What we know: Vite 8.0.8 is installed; Vitest is Vite-native
   - What's unclear: Whether `vitest` is in `devDependencies` and `package.json` test script exists
   - Recommendation: Wave 0 task should check `package.json` and add `vitest` + test script if missing

2. **allTime preset: how many months can the spine be?**
   - What we know: Data goes back to whenever first CSV was uploaded — could be 24+ months
   - What's unclear: Whether x-axis label density becomes unreadable at 24+ ticks
   - Recommendation: Recharts auto-hides overlapping ticks (`interval="preserveStartEnd"` or `interval={n}`). If needed, set `interval={Math.ceil(spine.length / 12) - 1}` so ~12 ticks always show regardless of range. This is a low-risk polish decision left to planner discretion.

## Sources

### Primary (HIGH confidence)
- Recharts 3.x source — `XAxis` `ticks` prop and `tickFormatter` signature confirmed from existing working code in repo
- `RevenueChart.tsx` and `HrKpiCharts.tsx` — direct code inspection (canonical truth for what's currently in production)
- `backend/app/routers/kpis.py` — confirmed no backend gap-fill; SQL only returns rows that exist in DB
- `backend/app/routers/hr_kpis.py` — confirmed HR history always returns 12 dense months (no gap-fill needed)
- `frontend/src/lib/api.ts` — confirmed `HrKpiHistoryPoint.month` is `"YYYY-MM"` format

### Secondary (MEDIUM confidence)
- Recharts `ReferenceLine` `x` prop usage pattern inferred from existing `y` usage in `HrKpiCharts.tsx` (same component, same props API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing Recharts 3.8.1 supports all needed APIs
- Architecture: HIGH — patterns derived directly from existing working codebase code
- Pitfalls: HIGH — derived from direct reading of current formatXAxis, data shapes, and API contract

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable stack, no third-party churn expected)
