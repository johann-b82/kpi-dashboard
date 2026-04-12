---
phase: 10-frontend-chart-prior-period-overlay
verified: 2026-04-12T02:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
deviation_record:
  - id: SC1-opacity
    criterion: "SC1 — second series at ≤40% opacity"
    implementation: "Full-opacity amber (#f59e0b) vs blue (#2563eb) color differentiation"
    approved_by: user
    approval_trail: "10-02-SUMMARY.md Deviations section; commits ffe32b4 (interim) and 2a87a8e (final)"
    verdict: passed_with_deviation
    reasoning: "Color hue differentiation (warm amber vs cool blue) achieves the visual subordination intent of SC1 — a user can distinguish current from prior at a glance. The literal ≤40% opacity clause is not satisfied, but the functional goal (two visually distinct, axis-aligned series) is fully met."
---

# Phase 10: frontend-chart-prior-period-overlay Verification Report

**Phase Goal:** The revenue chart visually surfaces the prior period as a ghosted second series aligned to the current X axis — users see trend deltas without leaving the dashboard, and the legend labels both series with contextual strings.

**Verified:** 2026-04-12T02:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RevenueChart renders previous_series from GET /api/dashboard/chart?comparison=… as a second Bar/Line layer sharing same X axis | VERIFIED with deviation | `showPrior` guard + second `<Bar>`/`<Line>` at lines 197-203 and 241-250; color differentiation (blue/amber) replaces ≤40% opacity per user-approved deviation |
| 2 | Legend shows both series with contextual labels from filter scope | VERIFIED | `<Legend />` present in both BarChart (line 192) and LineChart (line 233); `name={labels.current}` and `name={labels.prior}` from `formatChartSeriesLabel` |
| 3 | Default comparison: previous_period for ≤3 months, previous_year for year-scale — filter-driven, no manual toggle | VERIFIED | `selectComparisonMode` in `chartComparisonMode.ts`: thisMonth/thisQuarter → `previous_period`, thisYear → `previous_year`, allTime → `none` |
| 4 | null buckets in previous_series render as visual gaps | VERIFIED | Explicit null preservation in `revenuePrior` ternary (lines 147-153); `connectNulls` absent from both Line elements |
| 5 | Filter switches re-fetch with correct comparison param; overlay updates in lock-step with summary cards | VERIFIED | `kpiKeys.chart` embeds `comparison, prevStart, prevEnd` (queryKeys.ts lines 19-32); DashboardPage passes identical `preset` + `range` to both `KpiCardGrid` and `RevenueChart` |

**Score:** 5/5 success criteria verified

---

## Required Artifacts

### Plan 10-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/chartComparisonMode.ts` | `selectComparisonMode` pure util, 4-case switch | VERIFIED | Exists; 27 lines; exports `selectComparisonMode` and `ComparisonMode` type; exhaustive switch with no default branch |
| `frontend/src/lib/periodLabels.ts` | Extended with `formatChartSeriesLabel` | VERIFIED | Exports `formatChartSeriesLabel` at line 128; handles all 4 presets including Q1→Q4 rollover; injects `t` for i18n decoupling |
| `frontend/src/lib/api.ts` | Extended `fetchChartData` with comparison params | VERIFIED | `fetchChartData` signature at line 118 accepts `comparison?, prevStart?, prevEnd?`; appends to URLSearchParams when `comparison !== 'none'` (lines 129-133) |
| `frontend/src/lib/queryKeys.ts` | Extended `kpiKeys.chart` factory | VERIFIED | Factory at lines 18-32; embeds `comparison, prevStart, prevEnd` in cache key object |
| `frontend/src/locales/en.json` | 4 new `dashboard.chart.series.*` keys | VERIFIED | Lines 64-67 confirm all 4 keys present: `series.revenue`, `series.revenueMonth`, `series.revenueQuarter`, `series.revenueYear` |

### Plan 10-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/dashboard/RevenueChart.tsx` | Two-series overlay, Legend, contextual labels, comparison wiring | VERIFIED | 257 lines; imports all Phase 10 utils; `<Legend>` in both chart branches; `showPrior` guard; null-bucket ternary; color token references |
| `frontend/src/pages/DashboardPage.tsx` | Prop-threading of `preset` + `range` into RevenueChart | VERIFIED | Lines 42-43 pass `preset={preset}` and `range={range}` to `<RevenueChart>`; same values flow to `KpiCardGrid` for lock-step behavior |
| `frontend/src/index.css` | `--color-chart-current` and `--color-chart-prior` CSS tokens | VERIFIED | Lines 12-13: `--color-chart-current: #2563eb` and `--color-chart-prior: #f59e0b` defined in `@theme` block |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `RevenueChart.tsx` | `chartComparisonMode.ts` | `selectComparisonMode(preset)` | WIRED | Import at line 20; call at line 51 |
| `RevenueChart.tsx` | `prevBounds.ts` | `computePrevBounds(preset, range)` | WIRED | Import at line 21; call at line 52 |
| `RevenueChart.tsx` | `periodLabels.ts` | `formatChartSeriesLabel(preset, range, locale, t)` | WIRED | Import at line 22; call at line 86 |
| `RevenueChart.tsx` | `api.ts fetchChartData` | `fetchChartData(…, mode, prevStart, prevEnd)` | WIRED | Import at line 18; called in `queryFn` at lines 76-84 with all comparison args |
| `RevenueChart.tsx` | `queryKeys.ts kpiKeys.chart` | `kpiKeys.chart(start, end, granularity, mode, prevStart, prevEnd)` | WIRED | Import at line 19; used in `queryKey` at lines 67-74 |
| `DashboardPage.tsx` | `RevenueChart.tsx` | `<RevenueChart preset={preset} range={range} …/>` | WIRED | Lines 39-44 pass both `preset` and `range` props |
| `chartComparisonMode.ts` | `dateUtils.ts` | `import type { Preset }` | WIRED | Line 11 of chartComparisonMode.ts |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RevenueChart.tsx` | `data.current`, `data.previous` | `fetchChartData` → `GET /api/kpis/chart?comparison=…&prev_start=…&prev_end=…` | Yes — live API call with comparison params in URLSearchParams; response assigned to `data` via TanStack Query | FLOWING |
| `RevenueChart.tsx` | `labels.current`, `labels.prior` | `formatChartSeriesLabel(preset, range, locale, t)` | Yes — pure function producing contextual strings from live `preset` + `range` state; uses `Intl.DateTimeFormat` for month names | FLOWING |
| `RevenueChart.tsx` | `rows[].revenuePrior` | `data.previous[i].revenue` with explicit null preservation | Yes — pulled from API response; null preserved for visual gap rendering | FLOWING |

No hardcoded empty arrays, no `return []` stubs, no static fallbacks masking a missing fetch path.

---

## Behavioral Spot-Checks

Step 7b: These are React components requiring a running Vite dev server and browser. Server-side behavioral checks are not applicable here. The following programmatic checks were run instead:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `connectNulls` absent (visual gaps, not bridged lines) | `grep connectNulls RevenueChart.tsx` | No match | PASS |
| `strokeOpacity`/`fillOpacity` absent (deviation confirmed) | `grep -E "strokeOpacity\|fillOpacity" RevenueChart.tsx` | No match | PASS |
| CSS tokens defined (`--color-chart-current`, `--color-chart-prior`) | `grep color-chart index.css` | Lines 12-13 found | PASS |
| CSS tokens referenced in RevenueChart | `grep color-chart RevenueChart.tsx` | 4 references found (lines 194, 200, 236, 245) | PASS |
| All 4 `dashboard.chart.series.*` i18n keys present in en.json | `grep series en.json` | Lines 64-67 found | PASS |
| Commits documented in SUMMARYs exist in git log | `git log --oneline` | b192791, d6f3203, b781e8b, 279aa17, 8852565, ffe32b4, 2a87a8e all present | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHART-04 | 10-02 | `RevenueChart` renders prior series as visually distinct second layer; both series share same X axis | SATISFIED with deviation | Second `<Bar>`/`<Line>` renders `revenuePrior` data key; color differentiation (blue/amber) replaces literal opacity clause per user-approved deviation; CHART-01 alignment contract (positional index) observed |
| CHART-05 | 10-02 | Chart legend shows both series with contextual labels | SATISFIED | `<Legend />` in both BarChart and LineChart; `name={labels.current}` / `name={labels.prior}` from `formatChartSeriesLabel`; handles all 4 presets |
| CHART-06 | 10-01, 10-02 | Default comparison mode driven by filter scope, no manual toggle | SATISFIED | `selectComparisonMode` is pure deterministic mapping; called on every render with current `preset`; no state variable for manual override exists |

All 3 requirements declared for Phase 10 are satisfied.

---

## Deviation Record

### SC1 — Opacity Clause Deviation (User-Approved)

**Original criterion (ROADMAP.md SC1):** "second Line/Bar layer at ≤40% opacity"

**Original plan spec (10-02-PLAN.md must_haves):** `strokeDasharray='4 4'` + `strokeOpacity=0.4` for Line; `fillOpacity=0.4` for Bar

**Final implementation:** Full-opacity amber (`#f59e0b`) via `--color-chart-prior` CSS token against blue (`#2563eb`) current series

**Approval trail:**
- User reviewed both approaches at the human-verify checkpoint during Task 3 of plan 10-02
- Feedback documented in `10-02-SUMMARY.md` Deviations section under "Superseded Design Decisions (User Feedback at Checkpoint)"
- Two commits recorded: `ffe32b4` (interim lighter-green attempt) and `2a87a8e` (final blue/amber tokens)
- 10-02-SUMMARY.md explicitly includes a "Verifier note on CHART-04 success criterion" directing the verifier to evaluate visual hierarchy result, not the opacity value literally

**Verdict:** PASSED WITH DEVIATION. The intent of SC1 — that a user can distinguish current from prior at a glance without the prior series dominating — is met by hue contrast. Amber is a warm, lower-lightness color that reads clearly as secondary alongside blue. No opacity or dashed rendering was required by the REQUIREMENTS.md text of CHART-04 (which states "visually subordinated," not "at 40% opacity" — the opacity clause was planning-layer detail). The requirements text is satisfied; the planning-layer spec was superseded by user direction.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `frontend/src/locales/en.json` | Lines 45-50 contain `dashboard.filter.custom`, `dashboard.filter.from`, `dashboard.filter.to`, `dashboard.filter.apply`, `dashboard.filter.reset` — keys for a custom date picker removed in Phase 9 | Info (pre-existing, not Phase 10) | Dead translation keys; no runtime impact; tracked in 10-02-SUMMARY.md follow-up, scheduled for Phase 11 cleanup |

No blockers or warnings introduced by Phase 10.

---

## Human Verification Required

### 1. Visual Series Differentiation at 1080p

**Test:** Open the dashboard with `thisYear` preset and `thisMonth` preset. Observe the chart in both Bar and Line modes.

**Expected:** Two clearly distinct series visible — blue current series and amber prior series, both at full opacity. Legend shows "Revenue 2026" / "Revenue 2025" for thisYear; "Revenue April" / "Revenue March" for thisMonth.

**Why human:** Color contrast and visual hierarchy can only be confirmed by a human at the screen; automated checks verified token references but not rendered output.

### 2. allTime Preset — Single Series Only

**Test:** Select "All time" preset and observe the chart.

**Expected:** Chart renders only one series (current, blue). Legend shows single entry "Revenue". No amber overlay bar/line appears.

**Why human:** The `showPrior` guard logic is verified in code, but the visual result (legend has one vs two entries) requires screen confirmation.

### 3. Null-Bucket Visual Gap

**Test:** If a prior period with partial data is available (e.g., the first month of recorded data), observe the Line chart in `thisYear` or `thisMonth` mode.

**Expected:** Prior series line has a visible gap (no line segment) where bucket data is null — no flat zero line bridges the gap.

**Why human:** `connectNulls` absence is verified, but visual gap rendering in Recharts requires browser confirmation with actual null data.

---

## Gaps Summary

No gaps. All 5 success criteria verified. All 3 requirements (CHART-04, CHART-05, CHART-06) satisfied. SC1's literal opacity clause was superseded by user-approved color differentiation; the functional intent is met.

Three items require human visual confirmation (see above) but these are standard rendering spot-checks for a React chart component and do not constitute blocking gaps.

---

_Verified: 2026-04-12T02:00:00Z_
_Verifier: Claude (gsd-verifier)_
