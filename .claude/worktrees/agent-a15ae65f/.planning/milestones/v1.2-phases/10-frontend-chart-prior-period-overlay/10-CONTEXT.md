---
phase: 10
phase_name: Frontend — Chart Prior-Period Overlay
milestone: v1.2
created: 2026-04-12
---

# Phase 10 — Context and Decisions

## Goal (from ROADMAP.md)

The revenue chart visually surfaces the prior period as a ghosted second series aligned to the current X axis — users see trend deltas without leaving the dashboard, and the legend labels both series with contextual strings sourced from the selected preset.

## Requirements in Scope

CHART-04 (ghosted prior series ≤40% opacity), CHART-05 (legend with both contextual labels), CHART-06 (default mode driven by filter scope, no manual toggle).

<domain>
## Phase Boundary

Wire the already-live backend `comparison` / `prev_start` / `prev_end` chart params into `RevenueChart`, render a visually subordinated second series in both Line and Bar modes, drive comparison-mode selection from the lifted `preset` state, and label both series via an extension of the existing `periodLabels.ts` util. EN i18n keys land here; DE parity + end-to-end verification belong to Phase 11.

**Not in scope:**
- Manual comparison-mode toggle (v1.2 out-of-scope, requirements §"Out of Scope")
- DE locale strings (Phase 11)
- Custom date ranges — removed in Phase 9-03 ([b03bfba](.), [a046a14](.)); `preset` is always one of the 4 presets
- Sparse-prior bucket fix beyond what Recharts gap rendering already gives us
- Revisiting `computePrevBounds` (Phase 9 util; reused as-is for the chart fetch)
</domain>

<decisions>
## Implementation Decisions

### A. Comparison-Mode Selector

- **D-01:** Create pure util `frontend/src/lib/chartComparisonMode.ts` exporting `selectComparisonMode(preset: Preset): "previous_period" | "previous_year" | "none"`.
- **D-02:** Preset → mode mapping (deterministic, unit-testable):
  | Preset | Mode | Rationale |
  |--------|------|-----------|
  | `thisMonth` | `previous_period` | Same-length prior month overlay (MTD vs. prev MTD) |
  | `thisQuarter` | `previous_period` | Same-length prior quarter overlay (QTD vs. prev QTD) |
  | `thisYear` | `previous_year` | Phase 9 §C collapsed `thisYear`'s prev_period into prev_year; chart mirrors that |
  | `allTime` | `none` | Matches Phase 8 DELTA-04 — no implicit baseline |
- **D-03:** **No custom-range branch.** `DateRangeFilter` no longer exposes custom ranges (removed Phase 9-03); `preset` is always one of the 4 presets. The selector is a 4-case switch — no `differenceInDays` threshold, no `preset | null` handling.
- **D-04:** Satisfies SC3 ("default driven by filter scope, no manual UI toggle"). `RevenueChart` derives the mode from its `preset` prop on every render; TanStack Query refetches when the key changes.

### B. Overlay Visual Style

- **D-05:** **Line mode** — second `<Line>` at `strokeDasharray="4 4"`, `strokeOpacity={0.4}`, same `stroke="var(--color-success)"` as the primary. Dash pattern carries series identity in addition to opacity (colorblind/grayscale safe). `dot={false}` kept consistent with primary.
- **D-06:** **Bar mode** — second `<Bar>` with `fill="var(--color-success)"` + `fillOpacity={0.4}`. Recharts groups two `<Bar>` elements side-by-side per X bucket by default — no overlap. Order: primary first, prior second, so the legend reads current → prior.
- **D-07:** Both modes keep the existing `ResponsiveContainer` + `CartesianGrid` + axis config untouched. No layout changes.
- **D-08:** Null-bucket rendering (CHART-04 interaction with Phase 8 CHART-03) — Recharts `<Line>` renders gaps natively when a data point is `null`; `<Bar>` simply omits the bar for null entries. **No `connectNulls`** — explicit gaps are the desired visual per the goal.

### C. Legend + Contextual Labels

- **D-09:** **Extend `frontend/src/lib/periodLabels.ts`** with `formatChartSeriesLabel(preset: Preset, range: DateRangeValue, locale: "de" | "en", t: TFunction): { current: string; prior: string }`. Co-locates period-name logic with existing badge label utils → single source of truth for month/quarter/year naming.
- **D-10:** Output rules per preset (English side lands in Phase 10; DE parity in Phase 11):
  | Preset | `current` | `prior` | Source |
  |--------|-----------|---------|--------|
  | `thisMonth` | `"Umsatz {MonthName}"` (current month, from `range.to`) | `"Umsatz {MonthName}"` (prev month) | `Intl.DateTimeFormat(locale, { month: "long" })` |
  | `thisQuarter` | `"Umsatz Q{N}"` (current quarter) | `"Umsatz Q{N-1 or Q4 prev year}"` | `getQuarter()` from `date-fns` |
  | `thisYear` | `"Umsatz {YYYY}"` | `"Umsatz {YYYY-1}"` | `getYear()` from `date-fns` |
  | `allTime` | `"Umsatz"` (no prior) | `""` (overlay suppressed — see D-04) | i18n key |
- **D-11:** `"Umsatz"` prefix comes from an i18n key, NOT hardcoded. New keys (EN only this phase):
  ```json
  "dashboard.chart.series.revenue": "Revenue",
  "dashboard.chart.series.revenueMonth": "Revenue {{month}}",
  "dashboard.chart.series.revenueQuarter": "Revenue Q{{quarter}}",
  "dashboard.chart.series.revenueYear": "Revenue {{year}}"
  ```
  Phase 11 lands DE equivalents in informal "du" tone (note: "Umsatz" is a loanword-style domain term, safe as-is).
- **D-12:** **Recharts legend rendering** — add a `<Legend>` element to both the `BarChart` and `LineChart`. The current component has no legend (Phase 3 design). The legend renders both series labels via Recharts' built-in `name` prop on each `Bar`/`Line`. This satisfies SC2 ("legend shows both series with contextual labels").
- **D-13:** When `mode === "none"` (allTime), render a single-series legend using only `current` — keeps visual consistency with the rest of the dashboard even though there's only one series.

### D. Data-Layer Wiring (shared across all three areas)

- **D-14:** **Extend `fetchChartData` in `frontend/src/lib/api.ts`** to accept `comparison` + `prev_start` + `prev_end` query params. Backend contract already lives at [kpis.py:114-116](backend/app/routers/kpis.py#L114-L116). New signature:
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
- **D-15:** **Extend `kpiKeys.chart` in `frontend/src/lib/queryKeys.ts`** to embed `comparison` + `prevStart` + `prevEnd` in the cache key so TanStack Query invalidates whenever the selected preset changes.
- **D-16:** **`RevenueChart` receives `preset` + `range` as props** (additive — Phase 9 already lifted them to `DashboardPage`). Update [DashboardPage.tsx:39](frontend/src/pages/DashboardPage.tsx#L39) to pass both down. Inside the chart:
  1. `mode = selectComparisonMode(preset)`
  2. `prevBounds = computePrevBounds(preset, range)` (reuse Phase 9 util)
  3. Derive `prev_start` / `prev_end` from `prevBounds` (pick `prev_period_*` or `prev_year_*` based on `mode`)
  4. Call `fetchChartData(start, end, 'monthly', mode, prev_start, prev_end)`
  5. Consume `data.previous` (ignored until now) and render second series
- **D-17:** **Single-source-of-truth prev-bounds** — do NOT duplicate `computePrevBounds` logic inside the chart. The chart picks one of the two bound pairs returned by the existing util based on `mode`. This guarantees SC5 ("card deltas and chart overlay update in lock-step — no drift").
- **D-18:** `ChartResponse.previous` is typed `ChartPoint[] | null` (already defined in [api.ts:88](frontend/src/lib/api.ts#L88)). No new type work beyond extending the fetch signature.

### Claude's Discretion

- **Tooltip behavior** when both series are present — user didn't want to discuss this explicitly. Claude's default: Recharts' shared tooltip will naturally show both series with their respective `name` labels and the existing `formatCurrency` formatter. No custom content component needed. If the default is unreadable in practice, plan 10-02's verification step can add a custom content renderer.
- **Empty / null handling**:
  - When `mode === "none"` (allTime): do not pass comparison params; `data.previous` is null; render only the current series and a single-entry legend (D-13).
  - When backend returns `previous: null` despite `mode !== "none"` (fresh install, half-specified): render only the current series. No banner or "no comparison available" chip on the chart — the card em-dash badges already communicate that at-a-glance; a second signal on the chart would be noise.
  - When `previous_series` has null buckets (CHART-03): Recharts gap rendering per D-08.
- **Chart header** — no changes. `Header` JSX stays as-is.
- **Plan count** — Phase 10 roadmap specifies 2 plans (10-01 types/util/fetch extension, 10-02 RevenueChart composition + verification). This matches the decisions above cleanly: 10-01 is pure-layer (no components), 10-02 is the visual wiring.

### Folded Todos

None — no pending todos matched phase 10 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 planning inputs
- `.planning/ROADMAP.md` §"Phase 10: Frontend — Chart Prior-Period Overlay" — goal, success criteria, 2-plan breakdown
- `.planning/REQUIREMENTS.md` §"Frontend — Chart Overlay" — CHART-04 / CHART-05 / CHART-06

### Upstream phase contracts (MUST read)
- `.planning/phases/08-backend-comparison-aggregation-and-chart-overlay-api/08-CONTEXT.md` — chart endpoint contract, prev-series null semantics (CHART-03)
- `.planning/phases/09-frontend-kpi-card-dual-deltas/09-CONTEXT.md` §C — `computePrevBounds` decision table and why `thisYear`'s prev_period collapses into prev_year (drives D-02)
- `.planning/phases/09-frontend-kpi-card-dual-deltas/09-CONTEXT.md` §D — `periodLabels.ts` pattern that Phase 10 extends (D-09)

### Existing code to read
- `frontend/src/components/dashboard/RevenueChart.tsx` — current component; lines 87-94 flag where `data.previous` is silently ignored (Phase 10's wiring point)
- `frontend/src/pages/DashboardPage.tsx` — where `preset` + `range` state live; line 39 is the prop-threading point
- `frontend/src/lib/api.ts` §`ChartResponse`, `fetchChartData` (line 86+, 116+) — shape to extend
- `frontend/src/lib/queryKeys.ts` §`kpiKeys.chart` — cache key to extend
- `frontend/src/lib/prevBounds.ts` — `computePrevBounds` (reused as-is; provides both pairs)
- `frontend/src/lib/periodLabels.ts` — existing locale utils; extend here per D-09
- `backend/app/routers/kpis.py` lines 114-116 — backend accepts `comparison`, `prev_start`, `prev_end`; Phase 10 does NOT touch backend
- `frontend/src/locales/en.json` — where new D-11 keys land (DO NOT touch `de.json`)

### Recharts patterns
- Recharts docs — two-series `<Line>` with `strokeDasharray` + `strokeOpacity`
- Recharts docs — two-series grouped `<Bar>` with `fillOpacity`
- Recharts docs — `<Legend>` component + `name` prop on series

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`computePrevBounds`** ([prevBounds.ts](frontend/src/lib/prevBounds.ts)) — returns both `prev_period_*` and `prev_year_*`; chart picks one pair based on `selectComparisonMode` result. Prevents drift with card deltas (SC5).
- **`periodLabels.ts`** ([periodLabels.ts](frontend/src/lib/periodLabels.ts)) — already does month-name + quarter + year derivation via `Intl` + `date-fns`. Extend with `formatChartSeriesLabel` rather than duplicating.
- **`Preset` type + `getPresetRange`** ([dateUtils.ts](frontend/src/lib/dateUtils.ts)) — to-date semantics from Phase 9; nothing to change.
- **`ChartResponse.previous: ChartPoint[] | null`** ([api.ts:86-89](frontend/src/lib/api.ts#L86-L89)) — already typed; Phase 10 just starts consuming it.
- **`i18n` + `useTranslation`** — already wired in `RevenueChart`; new keys plug into the existing `t()` call.

### Established Patterns
- **Chart component style**: JSX-heavy, two branches (bar/line), `Intl.NumberFormat` for currency, `var(--color-*)` tokens for theming. Stay inside these patterns — don't refactor.
- **Pure-util module pattern**: `frontend/src/lib/*.ts` files are small, pure, unit-testable. `selectComparisonMode` follows suit.
- **i18n split**: EN lands with feature phases; DE parity lands in a dedicated locale phase (same pattern Phase 6/9 used).
- **TanStack Query cache key**: embed every input that should invalidate. Phase 9 added `prev` to `summary`; Phase 10 adds `comparison` + prev bounds to `chart`.

### Integration Points
- **Prop threading**: [DashboardPage.tsx:39](frontend/src/pages/DashboardPage.tsx#L39) — `<RevenueChart>` gains `preset` + `range` props.
- **Fetch extension**: [api.ts:116](frontend/src/lib/api.ts#L116) — `fetchChartData` gains 3 new optional params.
- **Cache key extension**: [queryKeys.ts:13](frontend/src/lib/queryKeys.ts#L13) — `kpiKeys.chart` embeds new params.
- **i18n**: `frontend/src/locales/en.json` gains 4 new keys under `dashboard.chart.series.*`.

</code_context>

<specifics>
## Specific Ideas

- **No custom date range branch anywhere** — the Phase 9-03 removal means `Preset` is effectively non-nullable in the dashboard context. `selectComparisonMode` takes `Preset`, not `Preset | null`. Do NOT introduce a null branch "just in case" — it would be dead code.
- **Visual style is non-negotiable**: dashed + 40% opacity for Line, grouped bars + 40% fill for Bar. These were explicitly chosen for colorblind/grayscale robustness and to avoid "looks like hover state" ambiguity.
- **Legend must exist** — current `RevenueChart` has none. Add `<Legend />` in both chart types.
- **Chart drift prevention**: the same `computePrevBounds` call powers both card deltas and chart overlay. No parallel implementation.

</specifics>

<deferred>
## Deferred Ideas

- **Tooltip + empty-state discussion** — user chose not to explore this gray area explicitly. Claude's defaults in "Claude's Discretion" above apply. If verification in plan 10-02 reveals the default Recharts shared tooltip is unreadable, the plan can add a custom content renderer — but do not add custom tooltip logic speculatively.
- **Manual comparison-mode toggle** — v1.3+ per requirements.
- **Success color split** (distinct "success" vs "primary" tokens for delta badges) — Phase 9 noted this as a possible Phase 10 split; deemed unnecessary here since chart overlay uses `--color-success` for both series at different opacities.
- **Sparse-prior bucket visual fix** beyond native Recharts gap rendering — Phase 8 known limitation; overlay D-08 relies on the gap-by-default behavior, not extra handling.

</deferred>

---

*Phase: 10-frontend-chart-prior-period-overlay*
*Context gathered: 2026-04-12*
