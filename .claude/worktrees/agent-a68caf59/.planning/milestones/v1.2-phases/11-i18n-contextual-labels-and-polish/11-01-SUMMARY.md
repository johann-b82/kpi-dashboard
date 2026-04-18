---
phase: 11-i18n-contextual-labels-and-polish
plan: "01"
subsystem: frontend-i18n
tags: [i18n, locale, periodLabels, de-json, parity, intl, typescript]
dependency_graph:
  requires:
    - phase: 09-01
      provides: formatPrevPeriodLabel signature, delta badge infrastructure
    - phase: 10-01
      provides: formatChartSeriesLabel, ChartLabelT type, periodLabels.ts base
  provides:
    - de.json with 119 keys matching en.json parity (I18N-DELTA-01)
    - getLocalizedMonthName(monthIndex, locale) — Intl.DateTimeFormat year-2000 seed helper
    - formatPrevPeriodLabel with required t: ChartLabelT parameter (I18N-DELTA-02)
    - check-locale-parity.mts — persistent CI-ready parity gate
    - verify-phase-11-01.mts — 18+ assertions across de/en locales
  affects: [Phase 11-02 human verification, any future i18n additions]
tech_stack:
  added: []
  patterns:
    - t()-injection pattern for pure utility module testability (no i18next import in periodLabels.ts)
    - Intl.DateTimeFormat year-2000 fixed-seed month name helper (avoids DST edge cases)
    - Persistent locale parity gate (exit-code contract: 0=ok, 1=diverge) runnable via --experimental-strip-types
key_files:
  created:
    - frontend/scripts/check-locale-parity.mts
    - frontend/scripts/verify-phase-11-01.mts
  modified:
    - frontend/src/locales/de.json
    - frontend/src/lib/periodLabels.ts
    - frontend/src/components/dashboard/KpiCardGrid.tsx
key_decisions:
  - "ChartLabelT type moved before formatPrevPeriodLabel in periodLabels.ts to enable required t parameter without forward reference"
  - "formatChartSeriesLabel thisMonth branch refactored to use getLocalizedMonthName instead of direct Intl.DateTimeFormat — single implementation, consistent locale handling"
  - "JSDoc comment 'vs. previous period' in periodLabels.ts is documentation only, not user-facing string — accepted in acceptance criteria check"
requirements-completed: [I18N-DELTA-01, I18N-DELTA-02]
duration: "~10 min"
completed: "2026-04-12"
---

# Phase 11 Plan 01: i18n Contextual Labels — DE Parity + periodLabels t() Routing Summary

**DE locale reaches parity with EN at 119 keys; periodLabels.ts gains `getLocalizedMonthName` via Intl.DateTimeFormat + routes all custom/generic period-label branches through the injected t() function, eliminating every hardcoded EN/DE string.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-12T07:08:00Z
- **Completed:** 2026-04-12T07:18:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `frontend/src/locales/de.json` gains 10 new keys: `dashboard.chart.series.{revenue,revenueMonth,revenueQuarter,revenueYear}` and `dashboard.delta.{vsShortPeriod,vsShortPeriod_one,vsCustomPeriod,vsYear,noBaseline,noBaselineTooltip}` — exact D-15 locked phrasings from CONTEXT.md
- DE locale now has 119 keys, byte-for-byte key parity with `en.json`
- `getLocalizedMonthName(monthIndex, locale)` exported from `periodLabels.ts` — wraps `Intl.DateTimeFormat` with year-2000 seed, returns CLDR month names ("März", "March", etc.)
- `formatPrevPeriodLabel` signature extended with required `t: ChartLabelT` parameter (4th arg, before optional `rangeLengthDays`) — custom short-range and generic-fallback branches now route through t() instead of hardcoded literals
- `formatChartSeriesLabel` thisMonth branch refactored to call `getLocalizedMonthName` instead of constructing its own `Intl.DateTimeFormat` instance
- `KpiCardGrid.tsx` call site updated: `t` passed as 4th argument to `formatPrevPeriodLabel`
- `frontend/scripts/check-locale-parity.mts` created as persistent parity infrastructure — exits 0 on parity, 1 with diff report; runnable via `node --experimental-strip-types`
- `frontend/scripts/verify-phase-11-01.mts` created with 18+ assertions: 4 getLocalizedMonthName cases, 11 formatPrevPeriodLabel cases (de+en, including _one plural, thisMonth, thisQuarter, custom, generic, em-dash), 1 formatChartSeriesLabel thisMonth de case

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 10 DE locale keys + parity check script** - `648a11f` (feat)
2. **Task 2: Extend periodLabels.ts + update call sites + verify script** - `888d7e3` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `frontend/src/locales/de.json` — 10 new DE translation keys inserted between `dashboard.chart.xAxis` and `settings.page_title`; JSON valid; 119 total keys
- `frontend/src/lib/periodLabels.ts` — Adds `getLocalizedMonthName` export; `ChartLabelT` type moved before `formatPrevPeriodLabel`; `formatPrevPeriodLabel` gains required `t` parameter; short-range and generic branches route through `t()`; `formatChartSeriesLabel` thisMonth uses `getLocalizedMonthName`; module header JSDoc updated (TODO removed)
- `frontend/src/components/dashboard/KpiCardGrid.tsx` — `formatPrevPeriodLabel` call updated to pass `t` as 4th argument
- `frontend/scripts/check-locale-parity.mts` — Persistent locale parity gate (new file)
- `frontend/scripts/verify-phase-11-01.mts` — Phase verification script with 18+ assertions (new file)

## Decisions Made

- **ChartLabelT type hoisted above formatPrevPeriodLabel:** The type was originally defined after `formatPrevYearLabel` (Phase 10 placement). To enable the new required `t: ChartLabelT` parameter on `formatPrevPeriodLabel`, the type declaration was moved before both functions. The duplicate declaration lower in the file was removed.
- **formatChartSeriesLabel thisMonth refactored to use getLocalizedMonthName:** The existing implementation used `new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: 'long' })` inline. The refactor removes this duplication — both functions now use the single `getLocalizedMonthName` helper, which uses short locale codes (`"de"` / `"en"`) per D-03. The `LOCALE_TAG` map (with regional codes `"de-DE"` / `"en-US"`) is now only used by `formatPrevYearLabel` for its short-month+year output where regional codes do matter for period formatting.
- **`noBaseline` / `noBaselineTooltip` DE strings:** Both use `"Kein Vergleichszeitraum verfügbar"` — identical text for badge and tooltip, informal "du"-compatible (no verb, no Sie-form), matching the EN pair which also uses identical text for both keys.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 10 new DE keys are wired to real `t()` call sites; `getLocalizedMonthName` uses live `Intl.DateTimeFormat`; no placeholder or hardcoded text flows to the UI.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 11-01 complete. I18N-DELTA-01 and I18N-DELTA-02 are satisfied.
- Phase 11-02 (human verification walkthrough) can proceed immediately.
- Verification gate: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` should be run at the start of any future phase that adds locale strings.
- 6 dead `dashboard.filter.*` locale keys from Phase 9 post-checkpoint remain in `en.json` — Plan 11-02 may address these or they can be deferred.

---

*Phase: 11-i18n-contextual-labels-and-polish*
*Completed: 2026-04-12*
