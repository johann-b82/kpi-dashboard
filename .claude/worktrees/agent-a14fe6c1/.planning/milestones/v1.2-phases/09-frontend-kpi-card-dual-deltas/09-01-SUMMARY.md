---
phase: 09-frontend-kpi-card-dual-deltas
plan: 01
subsystem: ui
tags: [react, typescript, date-fns, intl, tanstack-query, kpi, deltas, pure-functions]

requires:
  - phase: 08-backend-comparison-aggregation-and-chart-overlay-api
    provides: "/api/kpis accepts prev_period_* / prev_year_* params and returns nullable previous_period + previous_year siblings"
provides:
  - "computeDelta(current, prior) — null-safe delta math (CARD-04/CARD-05 baseline branch)"
  - "computePrevBounds(preset, range, today?) — preset-aware prior-window bounds including Phase 8 thisYear collapse and custom N-day window math"
  - "formatPrevPeriodLabel / formatPrevYearLabel — Intl-based secondary labels for both delta badges (DE + EN)"
  - "getPresetRange migrated to to-date (MTD/QTD/YTD) semantics with injectable `today` override"
  - "Extended KpiSummary type with nullable previous_period/previous_year"
  - "fetchKpiSummary(start, end, prev?) forwards prev_* query params"
  - "kpiKeys.summary embeds PrevBounds in the TanStack cache key"
affects: [09-02-components, 09-03-dashboard-wiring, 10-chart-overlay]

tech-stack:
  added: []
  patterns:
    - "Pure-function foundation module pattern: lib/*.ts files with no React/i18next imports, injectable `today: Date` param for deterministic testing"
    - "Throwaway verification script via Node `--experimental-strip-types` — no test framework dependency"

key-files:
  created:
    - frontend/src/lib/delta.ts
    - frontend/src/lib/prevBounds.ts
    - frontend/src/lib/periodLabels.ts
    - frontend/scripts/verify-phase-09-01.mts
  modified:
    - frontend/src/lib/dateUtils.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts

key-decisions:
  - "Skipped introducing vitest/jest; assertions live in a throwaway Node --experimental-strip-types script (09-01-PLAN test_strategy)"
  - "computePrevBounds uses date-fns helpers already in frontend (no new deps) and returns PrevBounds with `undefined` (not null) fields so URLSearchParams skips them naturally"
  - "formatPrevPeriodLabel carries an optional rangeLengthDays hint so the custom <7-day branch can produce 'vs. N Tage zuvor' / 'vs. N days earlier' without importing range math"
  - "periodLabels.ts inlines phrase strings (no i18next) — Phase 11 will extract to locale keys"
  - "fetchKpiSummary / kpiKeys.summary gained optional PrevBounds param so existing KpiCardGrid callsite compiles unchanged (09-03 upgrades it)"

patterns-established:
  - "All pure-function utilities accept an optional `today: Date = new Date()` so tests/scripts can pin time without mocks"
  - "Intra-frontend imports inside lib/*.ts use explicit `.ts` extensions so the Node strip-types script resolves the graph without bundler"

requirements-completed: [CARD-04, CARD-05]

duration: ~15min
completed: 2026-04-11
---

# Phase 9 Plan 1: Pure-Function Foundation Summary

**Dual-delta KPI card foundation: null-safe computeDelta, preset-aware computePrevBounds, Intl-based formatPrevPeriodLabel/formatPrevYearLabel, to-date getPresetRange migration, and extended KpiSummary / fetchKpiSummary / kpiKeys.summary carrying the Phase 8 prev_period / prev_year contract.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-11T21:46Z
- **Completed:** 2026-04-11T21:51Z
- **Tasks:** 3 (all auto, TDD-style for Tasks 1–2)
- **Files modified/created:** 7

## Accomplishments

- Landed three new side-effect-free modules in `frontend/src/lib/` (delta, prevBounds, periodLabels) with zero React/i18next coupling.
- Migrated `getPresetRange` to to-date semantics (MTD/QTD/YTD) per 09-CONTEXT section A — a behavior change to a v1.0 utility, backwards-compatible via the optional `today` override.
- Extended `KpiSummary` to match Phase 8's nullable `previous_period` / `previous_year` shape, added `KpiSummaryComparison` alias, and taught `fetchKpiSummary` + `kpiKeys.summary` to forward and cache prev bounds — all via optional args so the existing `KpiCardGrid` call site still compiles.
- Authored `frontend/scripts/verify-phase-09-01.mts`: a single Node 22+ `--experimental-strip-types` runnable that asserts every behavior row from the plan's <behavior> blocks. Prints "09-01 Task N assertions passed" per section and ends with "ALL GREEN".

## Task Commits

1. **Task 1: delta.ts + prevBounds.ts + verify script scaffold** — `51db89d` (feat)
2. **Task 2: periodLabels.ts + verify script extension** — `d2a78e4` (feat)
3. **Task 3: getPresetRange migration + KpiSummary/fetchKpiSummary/kpiKeys extension** — `7185f8a` (feat)

## Files Created/Modified

- `frontend/src/lib/delta.ts` — `computeDelta(current, prior)` with null/zero-prior → null branches.
- `frontend/src/lib/prevBounds.ts` — `computePrevBounds(preset, range, today?)` covering thisMonth/thisQuarter/thisYear/allTime/custom branches; imports `toApiDate` + `Preset` from dateUtils with `.ts` extension for Node loader compatibility.
- `frontend/src/lib/periodLabels.ts` — `formatPrevPeriodLabel(preset, prevPeriodStart, locale, rangeLengthDays?)` and `formatPrevYearLabel(prevYearStart, locale)` using `Intl.DateTimeFormat`.
- `frontend/src/lib/dateUtils.ts` — `getPresetRange` now returns `[startOf{Month,Quarter,Year}(today), today]` for preset branches; `endOfMonth/Quarter/Year` imports removed.
- `frontend/src/lib/api.ts` — new `KpiSummaryComparison` type; `KpiSummary` gains nullable `previous_period` / `previous_year`; `fetchKpiSummary` accepts optional `PrevBounds` and forwards four query params.
- `frontend/src/lib/queryKeys.ts` — `kpiKeys.summary` embeds `PrevBounds` in the cache key for automatic TanStack Query invalidation on filter change.
- `frontend/scripts/verify-phase-09-01.mts` — throwaway runtime verification harness.

## Decisions Made

- **Signature refinement on `formatPrevPeriodLabel`:** Added `rangeLengthDays?: number` parameter. CONTEXT.md section D shows a table with "custom short (< 7d)" and "custom generic" branches but does not list a signature. The cleanest way to distinguish these without re-importing `date-fns.differenceInDays` in the label module was to let the caller pass range length as a hint. The custom/generic branch still works with `rangeLengthDays === undefined` (falls through to generic fallback).
- **No 1-day special-case for DE:** The plan's action block documents this as deferred to Phase 11's `vsShortPeriod_one` i18n key (explicit carve-out in plan step 2). Only EN gets the `vs. 1 day earlier` vs. `vs. N days earlier` split today.
- **Explicit `.ts` import extensions inside `lib/`:** Node's `--experimental-strip-types` ESM loader does not honor bundler-style extensionless imports. `tsconfig.app.json` already has `allowImportingTsExtensions: true` so the `.ts` suffix is also valid for `tsc -b`, `tsc --noEmit`, and Vite. `prevBounds.ts`, `periodLabels.ts`, `api.ts`, and `queryKeys.ts` all import from `./dateUtils.ts` / `./prevBounds.ts`. Existing v1.1 sibling files still use extensionless imports — this convention is scoped to the Phase 9 additions/changes to keep the blast radius minimal.

## Deviations from Plan

None - plan executed exactly as written. The `.ts` extension convention noted above was an implementation detail required to satisfy the plan's own verification command (`node --experimental-strip-types …`), not a deviation from the plan's intent.

## Issues Encountered

- **First run of the verify script failed** with `ERR_MODULE_NOT_FOUND` on `./dateUtils` (no extension) — resolved by switching to `./dateUtils.ts`. Both `tsc --noEmit` and the script pass after the fix; no change to runtime behavior.

## Verification Evidence

- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` → exits 0.
- `cd frontend && node --experimental-strip-types scripts/verify-phase-09-01.mts` → prints all three "assertions passed" lines and "ALL GREEN", exits 0.
- `cd frontend && npm run build` → `tsc -b` + `vite build` both green (bundle 1,059 kB — unchanged order of magnitude from pre-plan baseline; Vite chunk-size warning is pre-existing).
- `grep -rn 'endOfYear\|endOfMonth\|endOfQuarter' frontend/src/` → only a JSDoc comment reference in `dateUtils.ts` (no code imports/usages).
- No new entries in `frontend/package.json` — zero new deps.

## Next Phase Readiness

- All four utility signatures (`computeDelta`, `computePrevBounds`, `formatPrevPeriodLabel`, `formatPrevYearLabel`) are now importable by 09-02's `DeltaBadge` / `DeltaBadgeStack` components.
- `fetchKpiSummary` and `kpiKeys.summary` are ready for 09-03's dashboard wiring — 09-03 just needs to compute `prevBounds = computePrevBounds(activePreset, range)` in `DashboardPage` / `KpiCardGrid` and thread it through the existing call sites.
- `getPresetRange` now requires callers to be aware that `to` is "today" not "end of period" — relevant for 09-03 and for Phase 10 chart wiring; documented in the updated JSDoc on the function.

## Self-Check: PASSED

- FOUND: frontend/src/lib/delta.ts
- FOUND: frontend/src/lib/prevBounds.ts
- FOUND: frontend/src/lib/periodLabels.ts
- FOUND: frontend/src/lib/dateUtils.ts (modified)
- FOUND: frontend/src/lib/api.ts (modified)
- FOUND: frontend/src/lib/queryKeys.ts (modified)
- FOUND: frontend/scripts/verify-phase-09-01.mts
- FOUND commit: 51db89d (Task 1)
- FOUND commit: d2a78e4 (Task 2)
- FOUND commit: 7185f8a (Task 3)

---
*Phase: 09-frontend-kpi-card-dual-deltas*
*Completed: 2026-04-11*
