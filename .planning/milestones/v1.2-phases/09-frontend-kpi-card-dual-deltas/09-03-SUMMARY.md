---
phase: 09-frontend-kpi-card-dual-deltas
plan: 03
subsystem: ui
tags: [react, tanstack-query, dashboard, kpi, deltas, i18n, date-fns]

# Dependency graph
requires:
  - phase: 08-backend-comparison-aggregation-and-chart-overlay-api
    provides: "previous_period + previous_year objects on /api/dashboard/summary"
  - phase: 09-frontend-kpi-card-dual-deltas (plans 09-01, 09-02)
    provides: "computePrevBounds, computeDelta, periodLabels, KpiSummary type, DeltaBadge, DeltaBadgeStack, KpiCard delta slot"
provides:
  - "DashboardPage owns range + activePreset (single source of truth)"
  - "Fully controlled DateRangeFilter — no internal preset state"
  - "KpiCardGrid wired end-to-end: prev bounds → fetch → deltas → contextual labels → DeltaBadgeStack per card"
  - "Right-aligned preset button bar (label dropped, custom range removed)"
  - "Right-side delta layout — badges sit beside the KPI value, not below"
affects: [10-frontend-chart-prior-period-overlay, 11-i18n-contextual-labels-and-polish]

# Tech tracking
tech-stack:
  added: []  # no new deps; date-fns already present
  patterns:
    - "Lift-state-up: domain state (preset, range) lives in DashboardPage; DateRangeFilter is presentational/controlled"
    - "Single useMemo for prevBounds keyed on (preset, range.from, range.to) so TanStack Query queryKey is stable across renders"
    - "Shared label computation per render — prev*Label computed once in KpiCardGrid and passed identically to all 3 DeltaBadgeStack instances"
    - "Right-aligned delta slot via flex items-center justify-between in KpiCard — vertically centers badges against the value baseline"

key-files:
  created: []
  modified:
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/components/dashboard/DateRangeFilter.tsx
    - frontend/src/components/dashboard/KpiCardGrid.tsx
    - frontend/src/components/dashboard/KpiCard.tsx

key-decisions:
  - "Custom date range picker removed entirely from v1.2 — Preset is no longer nullable in DashboardPage / DateRangeFilter / KpiCardGrid props (was Preset | null in plan)"
  - "ZEITRAUM filter label dropped — preset bar speaks for itself; bar right-aligned within the dashboard width"
  - "Delta badges render to the right of the KPI value (vertically centered, flex justify-between) instead of stacked below — keeps card heights uniform and reads better at 1920×1080"
  - "Locale keys for the removed custom-range UI (dashboard.filter.label, .custom, .from, .to, .apply, .reset) are now dead in en.json — Phase 11 must drop them from BOTH locale files when adding the DE delta keys"

patterns-established:
  - "Right-side delta slot pattern — KpiCard.tsx layout: <div flex items-center justify-between gap-4> with value on the left and delta slot (text-right, flex-shrink-0) on the right"
  - "Right-aligned filter bar pattern — DateRangeFilter wraps its preset buttons in `flex flex-wrap items-center justify-end`"

requirements-completed: [CARD-01, CARD-05]

# Metrics
duration: ~21min
completed: 2026-04-12
---

# Phase 9 Plan 3: Dashboard Integration Summary

**DashboardPage now owns preset+range, KpiCardGrid wires the full prev-bounds → delta → contextual-label → DeltaBadgeStack pipeline, and the dashboard ships with right-side delta badges + a right-aligned preset bar (no custom range picker, no ZEITRAUM label).**

## Performance

- **Duration:** ~21 min (state-lift + integration + 4 post-checkpoint refinements)
- **Started:** 2026-04-11T22:00:00Z
- **Task 1 commit:** 2026-04-11T22:00:33Z
- **Task 2 commit:** ~2026-04-11T22:05Z
- **Last refinement commit:** 2026-04-11T22:21:36Z
- **Tasks:** 3 (2 auto + 1 human-verify, approved)
- **Files modified:** 4

## Accomplishments

- Lifted `activePreset` state out of DateRangeFilter and into DashboardPage so range + preset always update together
- Wired `KpiCardGrid` end-to-end: `computePrevBounds` → `fetchKpiSummary` (with prev_* params in the query key) → `computeDelta` per KPI per baseline → `formatPrevPeriodLabel` / `formatPrevYearLabel` → one `DeltaBadgeStack` per card
- Verified all 4 presets × DE/EN at 1920×1080 against the live Docker stack — user approved
- Shipped 4 post-approval UI refinements that materially changed the final card layout and the filter bar (see below)

## Task Commits

1. **Task 1: Lift activePreset to DashboardPage** — `d9c0c9b` (feat)
2. **Task 2: Wire KpiCardGrid with prev bounds + deltas + DeltaBadgeStack** — `06fa47c` (feat)
3. **Task 3: Human verification at 1920×1080 in DE + EN** — APPROVED (no commit; gating only)

### Post-checkpoint refinements (after user approval)

4. `109310e` — fix(09-03): lay delta badges on the right of KpiCard, not below
5. `0a59d3e` — fix(09-03): align delta stack vertically with the KPI value
6. `a046a14` — fix(09-03): drop ZEITRAUM label and right-align the preset buttons
7. `b03bfba` — fix(09-03): remove custom date range picker entirely

**Plan metadata:** _(this commit)_

## Files Created/Modified

- `frontend/src/pages/DashboardPage.tsx` — owns `preset` + `range` state; passes both into DateRangeFilter and KpiCardGrid; RevenueChart call unchanged (Phase 10 territory)
- `frontend/src/components/dashboard/DateRangeFilter.tsx` — fully controlled; `Preset` (non-nullable) prop + `onChange(value, preset)`; popoverOpen / pendingRange / Calendar / "ZEITRAUM" label / Custom button / Apply / Reset all REMOVED; bar wraps in `flex flex-wrap items-center justify-end`
- `frontend/src/components/dashboard/KpiCardGrid.tsx` — accepts `{startDate, endDate, preset, range}`; useMemo'd `prevBounds`; query key + queryFn both pass prevBounds; computes shared `prevPeriodLabel` / `prevYearLabel` / `noBaselineTooltip`; renders DeltaBadgeStack in the new `delta` slot of all 3 KpiCards
- `frontend/src/components/dashboard/KpiCard.tsx` — value + delta now sit in a `flex items-center justify-between gap-4` row so badges render to the right of the value at the same vertical center

## Decisions Made

**Custom range deletion (D-09-03-A):** Phase 9 ships with preset-only filtering. The original plan kept `Preset | null` everywhere and a Popover-driven custom range. After walking the verification matrix the user requested complete removal because (a) custom ranges added a UI surface that none of the presets covered well at 1920×1080, (b) the prev-period label fallbacks for arbitrary 60-day windows read awkwardly compared to the named preset labels, and (c) the test matrix shrinks from 6 cells × 2 langs × 2 viewports to 4 cells × 2 langs × 1 viewport. Side effects:
- `Preset` is no longer nullable in DashboardPage / DateRangeFilter / KpiCardGrid prop types — the plan's `Preset | null` is now `Preset`. `prevBounds.ts` and `periodLabels.ts` still accept `Preset | null` (foundation layer kept the nullable contract for safety; passing the non-null value works fine).
- `custom` branches inside `formatPrevPeriodLabel` (rangeLengthDays + "vs. previous period" / "vs. N days earlier") are now unreachable from production code paths but were intentionally LEFT in periodLabels.ts so the unit tests in 09-01 still pass and a future "compare arbitrary windows" feature can re-enable the picker without re-implementing the labels.

**Right-side delta layout (D-09-03-B):** Original plan had badges stacked below the value. Final layout puts them to the right of the value (`flex items-center justify-between gap-4`), vertically centered against the value baseline. Reads better, keeps card heights uniform, no badge wrap at 1920×1080.

**Filter bar layout (D-09-03-C):** Dropped the "ZEITRAUM" / "Date range" label and right-aligned the preset buttons (`justify-end`). Visual whitespace is cleaner and matches the stripped-down preset-only model.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 → user-approved] Custom date range picker removed**
- **Found during:** Task 3 (human verification, post-approval refinement)
- **Issue:** Plan kept the Popover + Calendar + Apply/Reset path for custom ranges; user decided this UI surface didn't pull its weight against preset-only filtering.
- **Fix:** Deleted Popover/Calendar imports, `pendingRange`, `popoverOpen`, `applyCustom`, `resetToDefault`, the "Custom…" button, and the entire popover JSX. Tightened `Preset | null` → `Preset` in DashboardPage / DateRangeFilter / KpiCardGrid props (`prevBounds.ts` + `periodLabels.ts` still accept null on the foundation layer).
- **Files modified:** DateRangeFilter.tsx, DashboardPage.tsx, KpiCardGrid.tsx
- **Verification:** User walked all 4 presets in DE + EN at 1920×1080
- **Committed in:** `b03bfba`

**2. [Rule 2 - UX correctness] Delta layout flipped from below-value to right-of-value**
- **Found during:** Task 3 (human verification)
- **Issue:** Stacking deltas below the value made cards taller than the design accommodated and the badges wrapped awkwardly at 1080p.
- **Fix:** Restructured KpiCard's body into `flex items-center justify-between gap-4` so the delta slot lives on the right and is vertically centered against the value. KpiCardGrid still passes the same `<DeltaBadgeStack />` — only KpiCard changed.
- **Files modified:** KpiCard.tsx (then a follow-up to align vertically with the value baseline)
- **Verification:** Visual at 1920×1080
- **Committed in:** `109310e`, `0a59d3e`

**3. [Rule 2 - UX correctness] Filter bar visual tightening**
- **Found during:** Task 3 (human verification)
- **Issue:** "ZEITRAUM" label + left-aligned preset bar fought the new right-side delta layout for visual weight.
- **Fix:** Removed the `dashboard.filter.label` element and changed the wrapper to `flex flex-wrap items-center justify-end`.
- **Files modified:** DateRangeFilter.tsx
- **Verification:** Visual
- **Committed in:** `a046a14`

---

**Total deviations:** 3 user-approved post-checkpoint refinements
**Impact:** All three preserve plan intent (CARD-01 + CARD-05 still satisfied) while improving the human-verified UX. No regressions to RevenueChart, Upload, Settings, or LanguageToggle.

## Post-checkpoint refinements (Phase 11 hand-off)

These four commits landed AFTER human verification approval and changed the final shipping layout vs. what 09-03-PLAN.md described. Phase 11 must consume this list:

1. **Right-side delta layout** (`109310e`, `0a59d3e`) — Badges sit on the right of the KPI value, vertically centered. Plan said "below the value". KpiCard.tsx is the only file affected; DeltaBadgeStack itself is unchanged.
2. **Filter bar tightening** (`a046a14`) — `dashboard.filter.label` element deleted. Bar is right-aligned (`justify-end`).
3. **Custom range removal** (`b03bfba`) — Popover/Calendar/Apply/Reset/Custom-button all gone from DateRangeFilter. `Preset` is non-nullable in the dashboard prop chain. **Phase 11 locale impact:** the following keys are now DEAD in `en.json` and must be deleted (not translated to DE):
   - `dashboard.filter.label`
   - `dashboard.filter.custom`
   - `dashboard.filter.from`
   - `dashboard.filter.to`
   - `dashboard.filter.apply`
   - `dashboard.filter.reset`

   The 4 active filter keys remain: `dashboard.filter.thisMonth`, `.thisQuarter`, `.thisYear`, `.allTime`.

4. **Inline DE strings still in periodLabels.ts** — `formatPrevPeriodLabel` returns hardcoded strings like `"vs. März"` / `"vs. Q1"` / `"vs. previous period"`. These are NOT in any locale file. Phase 11 must extract them via `Intl.DateTimeFormat` (per I18N-DELTA-02) and remove the hardcoded literals. The custom-range branches in this file (rangeLengthDays-driven) are unreachable in production but kept alive by the 09-01 unit tests — Phase 11 can leave them or extract them; either is fine.

## DashboardPage → child contract (final)

```ts
// DashboardPage state
const [preset, setPreset] = useState<Preset>("thisYear");
const [range, setRange]   = useState<DateRangeValue>(/* getPresetRange("thisYear") */);

// DateRangeFilter props
{ value: DateRangeValue; preset: Preset; onChange: (v, p) => void }

// KpiCardGrid props
{ startDate?: string; endDate?: string; preset: Preset | null; range: DateRangeValue }
// (KpiCardGrid still types preset as nullable for foundation-layer compatibility,
//  but in practice DashboardPage always passes a non-null Preset.)

// RevenueChart props — UNCHANGED, Phase 10 owns it
{ startDate?: string; endDate?: string }
```

## Issues Encountered

None. Verification passed first walk-through; all four refinements were polish, not bugfixes.

## RevenueChart status (Phase 10 readiness)

`frontend/src/components/dashboard/RevenueChart.tsx` was NOT touched by 09-03 — verified via `git diff --name-only d9c0c9b^..b03bfba`. Signature is `{ startDate?: string; endDate?: string }`. Phase 10 can extend it without merge conflicts.

## Next Phase Readiness

- Phase 9 complete — 3/3 plans landed, CARD-01 through CARD-05 satisfied (CARD-02/03/04 from 09-02, CARD-01/05 from 09-03)
- Phase 10 ready: RevenueChart untouched, prev-bounds query key invalidation pattern proven, DateRangeFilter is now fully controlled so Phase 10 can subscribe to preset changes the same way
- Phase 11 must:
  1. Delete the 6 dead `dashboard.filter.*` keys from en.json (and avoid adding them to de.json)
  2. Add DE parity for the 6 delta keys landed in 09-02
  3. Extract hardcoded period labels from `frontend/src/lib/periodLabels.ts` to `Intl.DateTimeFormat` per I18N-DELTA-02

## Self-Check: PASSED

All 4 modified files present on disk. All 6 task + refinement commits present in `git log --oneline --all`.

---
*Phase: 09-frontend-kpi-card-dual-deltas*
*Completed: 2026-04-12*
