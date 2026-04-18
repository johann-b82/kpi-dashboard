---
phase: 24-delta-label-unification
plan: 01
subsystem: ui
tags: [i18n, react, typescript, kpi, dashboard, locales]

requires:
  - phase: 20-hr-dashboard
    provides: HrKpiCardGrid using hr.kpi.delta.* namespace (now retired)
  - phase: earlier-sales-dashboard
    provides: KpiCardGrid consuming periodLabels.ts formatters (now retired)
provides:
  - Shared `kpi.delta.{prevMonth,prevQuarter,prevYear}` i18n namespace (DE/EN parity)
  - Concrete prior-period label helpers (absolute month/quarter/year names) for bottom-slot prior-year badges
  - thisYear preset collapsed to single top-slot YTD-vs-YTD badge row
  - allTime preset hides delta badge row entirely
  - periodLabels.ts stripped of delta-badge formatters (formatChartSeriesLabel preserved for RevenueChart)
affects: [future HR granularity additions, future dashboard KPI work, chart-legend-related phases]

tech-stack:
  added: []
  patterns:
    - "Granularity → i18n key mapping via small pure helper in consumer (prevPeriodLabelKey)"
    - "Hide-when-null delta row via conditional `delta={undefined}` passthrough on KpiCard"
    - "Concrete prior-period label templates (vsMonth/vsQuarter/vsYear) interpolated from Date objects"

key-files:
  created: []
  modified:
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - frontend/src/components/dashboard/KpiCardGrid.tsx
    - frontend/src/components/dashboard/HrKpiCardGrid.tsx
    - frontend/src/lib/periodLabels.ts

key-decisions:
  - "Scope expansion: bottom-slot prior-year label shows concrete calendar unit (e.g. `vs. April 2025`, `vs. Q2 2025`, `vs. 2025`) instead of generic `vs. prev. year` — resolved ambiguity uncovered during UAT"
  - "Scope expansion: thisYear preset collapses to single top-slot YTD-vs-YTD row (no duplicate `vs. prev. year` row) — avoids redundant same-granularity comparison"
  - "allTime preset hides entire delta badge row (no em-dash, no placeholder) — per original D-12"
  - "hr.kpi.delta.* deleted with no shim; HR consumer migrated atomically"
  - "periodLabels.ts strip-only (not full delete) — formatChartSeriesLabel preserved because RevenueChart still consumes it"

patterns-established:
  - "Shared kpi.delta.* namespace across domain dashboards (Sales + HR) instead of per-domain copies"
  - "Concrete-label templates expressed as i18n templates with `{{month}}`/`{{quarter}}`/`{{year}}` placeholders rather than Intl formatting at call site"

requirements-completed: [UC-01, UC-02, UC-03, UC-04, UC-05]

duration: ~3h (multi-session with UAT iteration)
completed: 2026-04-14
---

# Phase 24 Plan 01: Delta Label Unification Summary

**Unified Sales + HR delta badges under shared `kpi.delta.*` i18n namespace, added quarter granularity, collapsed thisYear to single YTD row, and replaced generic prior-year labels with concrete calendar-unit labels (e.g. `vs. April 2025`, `vs. Q2 2025`, `vs. 2025`).**

## Performance

- **Duration:** Multi-session (planning + execution + UAT iteration + scope expansion)
- **Completed:** 2026-04-14
- **Tasks:** 6 planned + 3 scope-expansion tasks (concrete labels, quarter label fix, month label fix, thisYear collapse)
- **Files modified:** 5

## Accomplishments

- New shared `kpi.delta.{prevMonth,prevQuarter,prevYear}` i18n namespace with full DE/EN parity
- Added `kpi.delta.vsMonth` / `vsQuarter` / `vsYear` templates for concrete prior-period labels
- Sales KpiCardGrid reads relative labels per preset (thisMonth / thisQuarter / thisYear) and uses concrete prior-year labels on the bottom row
- HR HrKpiCardGrid wired to same shared namespace (monthly + yearly comparisons)
- thisQuarter bottom row shows same-quarter prior-year (`vs. Q2 2025` when viewing Q2 2026)
- thisMonth bottom row shows same-month prior-year (`vs. April 2025` when viewing April 2026)
- thisYear collapsed to single top-slot YTD-vs-YTD row (`vs. 2025`)
- allTime preset hides delta row entirely — no em-dash, no placeholder
- periodLabels.ts stripped of `formatPrevPeriodLabel`, `formatPrevYearLabel`, `LOCALE_TAG`, `EM_DASH`; `formatChartSeriesLabel` preserved for RevenueChart
- Old `hr.kpi.delta.*` and orphan `dashboard.delta.*` keys fully retired (noBaselineTooltip preserved)

## Task Commits

Executed across nine atomic commits:

1. **Locale migration** — `b75c68b` (feat): add `kpi.delta.*` namespace, delete `hr.kpi.delta.*`
2. **HR consumer** — `83fb251` (refactor): HR grid reads from shared namespace
3. **Sales consumer + periodLabels strip** — `41320e2` (refactor): Sales rewrite, `formatChartSeriesLabel` preserved
4. **Orphan-key cleanup** — `ea291f7` (chore): `dashboard.delta.*` orphans removed (`noBaselineTooltip` kept)
5. **Scope expansion: concrete labels (helper + i18n)** — `7bc4972` (feat): `vsMonth` / `vsQuarter` / `vsYear` templates
6. **Scope expansion: grid wiring** — `7b2bc64` (feat): KpiCardGrid + HrKpiCardGrid wired to new helpers
7. **Fix: thisQuarter concrete label** — `21f5629` (fix): bottom row shows same-quarter prior-year (`vs. Q2 2025`)
8. **Fix: thisMonth + HR concrete label** — `f493aff` (fix): bottom row shows same-month prior-year (`vs. April 2025`)
9. **thisYear single-row collapse** — `761828e` (refactor): YTD-vs-YTD single top-row badge

## Files Created/Modified

- `frontend/src/locales/en.json` — added `kpi.delta.prevMonth/prevQuarter/prevYear` + `kpi.delta.vsMonth/vsQuarter/vsYear` templates; removed `hr.kpi.delta.*` and orphan `dashboard.delta.*` keys
- `frontend/src/locales/de.json` — mirrored DE copy (`vs. Vormonat`, `vs. Vorquartal`, `vs. Vorjahr`, DE vsMonth/vsQuarter/vsYear templates)
- `frontend/src/components/dashboard/KpiCardGrid.tsx` — `prevPeriodLabelKey()` helper; hide-when-null via `delta={undefined}`; concrete prior-year labels per preset; thisYear single-row behavior
- `frontend/src/components/dashboard/HrKpiCardGrid.tsx` — reads `kpi.delta.prevMonth` + concrete prior-year month label
- `frontend/src/lib/periodLabels.ts` — stripped delta-badge formatters; `formatChartSeriesLabel` + `getLocalizedMonthName` preserved

## Decisions Made

- **Scope expansion (concrete labels):** During UAT, generic `vs. prev. year` on the bottom row was ambiguous when Sales preset = thisMonth/thisQuarter — could mean "same month last year" or "same quarter last year." Resolved by introducing concrete `vsMonth`/`vsQuarter`/`vsYear` i18n templates interpolated from the active range's Date object. User approved.
- **Scope expansion (thisYear single row):** Original plan kept duplicate `vs. prev. year` rows for thisYear preset. During UAT, this felt redundant — top (relative) and bottom (absolute) both said the same thing. Collapsed to a single top-slot row showing YTD-vs-YTD delta against a `vs. 2025` label.
- **`SupportedLocale` export retained** in `periodLabels.ts` — grep during Task 1 showed external type references; downgrade not safe.
- **periodLabels.ts strip-only** (not full delete) — `formatChartSeriesLabel` still consumed by `RevenueChart.tsx`; chart legend explicitly out of scope per CONTEXT.

## Deviations from Plan

### Scope expansion (user-approved)

**1. Concrete prior-period labels on bottom row**
- **Found during:** Task 6 UAT
- **Issue:** Plan specified generic `vs. prev. year` / `vs. Vorjahr` for bottom-slot prior-year delta regardless of active preset. UAT surfaced that this is ambiguous in context (prior year of *what* unit?).
- **Fix:** Added `kpi.delta.vsMonth` / `vsQuarter` / `vsYear` i18n templates with `{{month}}` / `{{quarter}}` / `{{year}}` placeholders; consumers resolve the concrete calendar unit from active range Date.
- **Committed in:** `7bc4972` (helpers + templates), `7b2bc64` (grid wiring), `21f5629` (quarter fix), `f493aff` (month fix)

**2. thisYear preset collapsed to single top-slot row**
- **Found during:** Task 6 UAT
- **Issue:** Duplicate `vs. prev. year` top + bottom rows on thisYear were redundant (both compared same granularity).
- **Fix:** thisYear renders single top-slot row with YTD-vs-YTD delta and `vs. 2025` absolute label; bottom row removed only for thisYear.
- **Committed in:** `761828e`

---

**Total deviations:** 2 scope expansions (both approved during UAT; both improved product clarity)
**Impact on plan:** Additive — original plan requirements still met; scope expansion strengthens UC-01/UC-02 semantics.

## Issues Encountered

- Initial thisQuarter bottom row showed wrong quarter label — fixed in `21f5629`.
- Initial thisMonth + HR bottom row showed wrong month label — fixed in `f493aff`.
- Both iterations surfaced in UAT and resolved in-session.

## UAT Outcome

All 11 manual UAT checks plus scope-expansion re-verification passed:

- Sales thisMonth: `vs. prev. month` (top) + `vs. March 2026` / `vs. April 2025` (bottom) — EN/DE verified
- Sales thisQuarter: `vs. prev. quarter` (top) + `vs. Q1 2026` / `vs. Q2 2025` (bottom)
- Sales thisYear: single top-slot row `vs. 2025` with YTD-vs-YTD delta; bottom row suppressed
- Sales allTime: badge row hidden entirely
- HR: `vs. prev. month` + concrete `vs. April 2025` / `vs. März 2026` / `vs. April 2025`
- RevenueChart legend regression-free (`formatChartSeriesLabel` path untouched)
- Parity script exits 0; full frontend build clean; zero `i18next missingKey` warnings in console

User approval: "approved" (2026-04-14).

## User Setup Required

None — frontend-only i18n and component changes.

## Next Phase Readiness

- Shared `kpi.delta.*` namespace pattern available for any future dashboard domain (Finance, Operations, etc.)
- Concrete prior-period label templates reusable via `kpi.delta.vs{Month,Quarter,Year}`
- periodLabels.ts slimmed to chart-only surface; future delete becomes trivial if RevenueChart is refactored
- No open blockers; Phase 24 complete; milestone v1.10 awaits Phase 25

---
*Phase: 24-delta-label-unification*
*Completed: 2026-04-14*

## Self-Check: PASSED

All 9 task commits verified on current branch; SUMMARY.md exists at expected path.
