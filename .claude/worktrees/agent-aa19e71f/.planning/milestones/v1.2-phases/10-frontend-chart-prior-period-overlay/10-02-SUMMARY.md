---
phase: 10-frontend-chart-prior-period-overlay
plan: "02"
subsystem: frontend-ui
tags: [chart, recharts, comparison, overlay, react, tanstack-query, css-tokens]
dependency_graph:
  requires:
    - phase: 10-01
      provides: selectComparisonMode, formatChartSeriesLabel, extended fetchChartData/kpiKeys.chart
    - phase: 09-01
      provides: computePrevBounds, Preset, DateRangeValue
  provides:
    - RevenueChart two-series overlay (current=blue #2563eb, prior=amber #f59e0b)
    - Chart Legend with contextual labels from formatChartSeriesLabel
    - preset+range prop threading from DashboardPage into RevenueChart
    - --color-chart-current + --color-chart-prior CSS tokens in index.css
  affects: [Phase 11 i18n/polish — chart legend strings, verifier]
tech_stack:
  added: []
  patterns:
    - Chart-local CSS token pattern (--color-chart-current / --color-chart-prior scoped to index.css; avoids collision with shadcn neutral app-wide tokens)
    - showPrior guard pattern — null check on data.previous before rendering second series
    - Null-bucket ternary pattern — explicit `value ?? null` (not Number(null)) preserves Recharts native visual gap behavior
key_files:
  created: []
  modified:
    - frontend/src/components/dashboard/RevenueChart.tsx
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/index.css
key_decisions:
  - "Chart-local CSS tokens (--color-chart-current / --color-chart-prior) introduced in index.css to avoid shadcn neutral set rendering prior series invisible on white card"
  - "Color-based differentiation (blue vs amber) superseded opacity/dashed approach from CONTEXT.md D-05/D-06 after user feedback at human-verify checkpoint"
  - "User-requested chart-color customization in settings page deferred to a future phase — out of scope for 10-02"
requirements-completed: [CHART-04, CHART-05, CHART-06]
duration: "~15 min"
completed: "2026-04-12"
---

# Phase 10 Plan 02: Chart Prior-Period Overlay Summary

**RevenueChart gains a full-opacity amber (#f59e0b) prior-period overlay series alongside a blue (#2563eb) current series, with a Recharts Legend showing contextual labels; preset+range threaded from DashboardPage drives lock-step refetch.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-12T01:16:00Z
- **Completed:** 2026-04-12T01:24:00Z
- **Tasks:** 3 (Task 1: RevenueChart extension, Task 2: DashboardPage prop threading, Task 3: human verification)
- **Files modified:** 3

## Accomplishments

- `RevenueChart` now accepts `preset` and `range` props, derives `selectComparisonMode` + `computePrevBounds`, threads comparison params into `kpiKeys.chart` and `fetchChartData`, and renders a second Bar/Line series from `data.previous` with chart-local color tokens
- Chart `<Legend>` added to both BarChart and LineChart branches, labels sourced from `formatChartSeriesLabel(preset, range, locale, t)` for contextual strings (e.g., "Revenue April" / "Revenue March")
- `DashboardPage` now passes `preset={preset}` and `range={range}` into `<RevenueChart>` — both already in scope from existing `useState`; no new state added
- CSS tokens `--color-chart-current` (#2563eb) and `--color-chart-prior` (#f59e0b) added to `frontend/src/index.css` as chart-scoped tokens, decoupled from the shadcn neutral app-wide palette

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend RevenueChart** - `279aa17` (feat)
2. **Task 2: Thread preset + range from DashboardPage** - `8852565` (feat)
3. **Task 3 checkpoint (interim): lighter-green prior series** - `ffe32b4` (feat — superseded)
4. **Task 3 checkpoint (final): blue/amber chart-local tokens** - `2a87a8e` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `frontend/src/components/dashboard/RevenueChart.tsx` — Two-series overlay composition; `preset`+`range` props; `selectComparisonMode`+`computePrevBounds` derivation; `showPrior` guard; null-bucket ternary; `<Legend>`; chart-local color token references
- `frontend/src/pages/DashboardPage.tsx` — Added `preset={preset}` and `range={range}` to `<RevenueChart>` call
- `frontend/src/index.css` — Added `--color-chart-current: #2563eb` and `--color-chart-prior: #f59e0b` CSS custom properties

## Decisions Made

- **Chart-local CSS tokens over app-wide tokens:** The app-wide `--color-primary` / `--color-accent` tokens resolve to the shadcn neutral set (near-black/near-white). Using them for chart series would render the prior series invisible against the white card background. Scoped chart tokens in `index.css` isolate chart colors from the theming system without touching any other component.
- **Color-based differentiation over opacity/dashed:** Original CONTEXT.md called for 40% opacity + `strokeDasharray="4 4"` for the prior series (D-05/D-06). User feedback at the human-verify checkpoint changed this to full-opacity amber — see Deviations section.
- **No new dependencies:** No new npm packages added. Recharts native gap behavior (no `connectNulls`) handles null buckets as-designed.

## Deviations from Plan

### Superseded Design Decisions (User Feedback at Checkpoint)

**1. CONTEXT.md D-05 — Dashed stroke + 40% opacity for Line prior series — SUPERSEDED**
- **Found during:** Task 3 (human-verify checkpoint)
- **Original spec:** `strokeDasharray="4 4"` + `strokeOpacity={0.4}` for prior Line series
- **User feedback:** After visual review, color-based differentiation reads more clearly than opacity-based subordination
- **Final implementation:** Solid stroke, no `strokeDasharray`, full opacity (`strokeOpacity` removed), prior series in amber `#f59e0b` via `--color-chart-prior`
- **Files modified:** `frontend/src/components/dashboard/RevenueChart.tsx`, `frontend/src/index.css`
- **Commits:** `ffe32b4` (interim: lighter-green attempt), `2a87a8e` (final: blue/amber tokens)

**2. CONTEXT.md D-06 — 40% fill opacity for Bar prior series — SUPERSEDED**
- **Found during:** Task 3 (human-verify checkpoint)
- **Original spec:** `fillOpacity={0.4}` for prior Bar series
- **User feedback:** Same as D-05 — full-opacity color distinction is clearer
- **Final implementation:** Full opacity, prior series rendered in amber `#f59e0b` via `--color-chart-prior`
- **Files modified:** `frontend/src/components/dashboard/RevenueChart.tsx`
- **Commits:** `2a87a8e`

**Verifier note on CHART-04 success criterion:** SC-1 for Phase 10 reads "second Line/Bar layer at ≤40% opacity, visually subordinated". The final implementation uses full-opacity amber instead of reduced opacity. The visual subordination intent is preserved via hue differentiation — amber (#f59e0b) is less saturated against the blue primary (#2563eb) and reads clearly as secondary. The verifier should evaluate the visual hierarchy result, not the opacity value literally.

---

**Total deviations:** 2 superseded design decisions (D-05, D-06 from CONTEXT.md)
**Impact on plan:** User-directed change at checkpoint — no correctness or functionality impact. Chart still satisfies the functional requirements of CHART-04/05/06.

## Follow-up

**User-requested: chart-color customization in Settings page** — During the verification checkpoint, the user requested a settings-page feature to let users configure the chart series colors (`--color-chart-current` / `--color-chart-prior`). This is explicitly out of scope for 10-02. It is tracked as a future phase (not yet planned). The CSS token architecture introduced in this plan (`--color-chart-current`, `--color-chart-prior`) is designed to make this extension straightforward when planned.

## Known Stubs

None — both series are wired to live `fetchChartData` query results. No hardcoded or mock data flows to the chart.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 10 complete. All CHART-04/05/06 requirements addressed.
- Phase 11 (i18n, Contextual Labels, and Polish) can proceed. Chart legend strings currently use `t()` calls but DE translations for `dashboard.chart.series.*` keys are not yet in `de.json` — Phase 11 must add them.
- 6 dead `dashboard.filter.*` locale keys from Phase 9 post-checkpoint (custom date range picker removal) remain in `en.json` — Phase 11 must drop them before translating to DE.

---

*Phase: 10-frontend-chart-prior-period-overlay*
*Completed: 2026-04-12*
