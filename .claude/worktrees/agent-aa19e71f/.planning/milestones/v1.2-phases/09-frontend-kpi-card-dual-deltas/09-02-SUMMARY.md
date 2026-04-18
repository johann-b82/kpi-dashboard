---
phase: 09-frontend-kpi-card-dual-deltas
plan: 02
subsystem: ui
tags: [react, typescript, intl, kpi, deltas, presentational-components, i18n]

requires:
  - phase: 09-frontend-kpi-card-dual-deltas
    plan: 01
    provides: "computeDelta / computePrevBounds / formatPrev*Label pure utilities + extended KpiSummary type — consumed at wiring time by 09-03"
provides:
  - "DeltaBadge — pure presentational single-row badge (arrow + semantic color + Intl locale percent + em-dash fallback with native title tooltip)"
  - "DeltaBadgeStack — two stacked DeltaBadge rows + muted contextual secondary labels"
  - "KpiCard.delta?: ReactNode — backwards-compatible slot prop, renders below value line with mt-3 spacing when non-null"
  - "6 new dashboard.delta.* EN locale keys (vsShortPeriod[_one], vsCustomPeriod, vsYear, noBaseline, noBaselineTooltip)"
  - "deltaFormat.ts helper — factored-out pure formatDeltaText + deltaClassName so Node --experimental-strip-types can unit-test the text contract without a JSX loader"
affects: [09-03-dashboard-wiring, 11-de-locale-parity]

tech-stack:
  added: []
  patterns:
    - "Pure helper factored out of .tsx component (deltaFormat.ts) so the 09-01 no-test-framework verify-script convention can assert the visible-text contract under node --experimental-strip-types"
    - "Presentational components receive already-translated strings as props — zero useTranslation coupling keeps them pure and unit-testable"
    - "Native HTML title attribute for tooltips (no shadcn Tooltip dep) — matches existing LanguageToggle convention"

key-files:
  created:
    - frontend/src/components/dashboard/DeltaBadge.tsx
    - frontend/src/components/dashboard/DeltaBadgeStack.tsx
    - frontend/src/components/dashboard/deltaFormat.ts
    - frontend/scripts/verify-phase-09-02.mts
  modified:
    - frontend/src/components/dashboard/KpiCard.tsx
    - frontend/src/locales/en.json

key-decisions:
  - "Factored formatDeltaText + deltaClassName into deltaFormat.ts (new pure module) so the node --experimental-strip-types verify script can import and assert the text contract — strip-types does not support JSX, so a DeltaBadge.tsx-only approach would have forced adding vitest (a new dep, forbidden)"
  - "Native HTML title attribute for the em-dash tooltip instead of a shadcn Tooltip primitive — no Tooltip component installed, 'no new dependencies' takes precedence, and the LanguageToggle already uses this pattern"
  - "Sign glyph is manually prepended AFTER Intl.NumberFormat(signDisplay: 'never') on Math.abs(value) so layout is uniform across DE/EN regardless of how each locale would natively render the sign"
  - "DE percent format uses NBSP (U+00A0) between number and % — confirmed via direct Node Intl probe; encoded explicitly in verify-phase-09-02.mts assertions"
  - "KpiCard delta guard uses `delta != null` (loose) so both undefined and null render identically to v1.1 — single check, clean TS narrowing, no extra DOM or spacing"
  - "en.json keys inserted in-place between dashboard.chart.* and settings.* blocks; de.json intentionally untouched per 09-CONTEXT i18n section (Phase 11 owns DE parity)"

patterns-established:
  - "Presentational dashboard components that need locale-aware formatting export a pure helper next to the .tsx (component_deltaFormat.ts pattern) so verify scripts can unit-test the pure logic"
  - "No 'success' theme token exists — positive deltas use text-primary as the accepted v1.2 call; Phase 10+ can split if the visual warrants it"

requirements-completed: [CARD-02, CARD-03]

duration: ~3min
completed: 2026-04-11
---

# Phase 9 Plan 2: Presentational Components Summary

**Pure, prop-driven DeltaBadge + DeltaBadgeStack + KpiCard.delta slot + 6 EN delta locale keys — zero data coupling, ready for 09-03 dashboard wiring.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-11T21:53:24Z
- **Completed:** 2026-04-11T21:56:26Z
- **Tasks:** 2 (Task 1 TDD via throwaway verify script, Task 2 auto)
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- Landed the full presentational layer for Phase 9 dual-delta cards as pure prop-driven components with zero hooks, zero i18n coupling, and zero data-layer coupling.
- DeltaBadge renders four visual states (positive / negative / zero / null) with locale-correct Intl percent format (DE uses comma + NBSP, EN uses period) and semantic Tailwind color tokens sourced from the existing theme.
- DeltaBadgeStack composes two DeltaBadge rows with muted contextual secondary labels supplied by the caller.
- KpiCard gained a single optional `delta?: ReactNode` slot prop that is fully backwards-compatible — existing KpiCardGrid callsite (from v1.0) still compiles without modification; only 09-03 will start passing the slot.
- Added 6 new `dashboard.delta.*` EN locale keys (vsShortPeriod + vsShortPeriod_one for i18next plural, vsCustomPeriod, vsYear, noBaseline, noBaselineTooltip) — de.json deliberately untouched for Phase 11's informal "du" pass.
- Extended the 09-01 no-test-framework convention with `frontend/scripts/verify-phase-09-02.mts` — 8 assertions covering positive/negative/zero/null across DE/EN; runs under `node --experimental-strip-types`, exits 0 ("ALL GREEN").

## Task Commits

1. **Task 1: DeltaBadge + DeltaBadgeStack + deltaFormat.ts + verify script** — `e1a8b44` (feat, TDD RED-then-GREEN)
2. **Task 2: KpiCard delta slot + 6 EN locale keys** — `24b0acd` (feat)

## Files Created/Modified

- `frontend/src/components/dashboard/deltaFormat.ts` — pure `formatDeltaText(value, locale)` + `deltaClassName(value)` helpers. Implements CARD-02/03/04 textual contract.
- `frontend/src/components/dashboard/DeltaBadge.tsx` — 34 LOC presentational component, imports from deltaFormat. No hooks, no i18n, no useTranslation.
- `frontend/src/components/dashboard/DeltaBadgeStack.tsx` — 58 LOC composition wrapper, renders two DeltaBadge rows with muted secondary labels.
- `frontend/src/components/dashboard/KpiCard.tsx` — gained `delta?: ReactNode` prop; guard is `delta != null` so undefined and null are both no-ops (v1.1 identity preserved).
- `frontend/src/locales/en.json` — 6 new keys inserted between `dashboard.chart.xAxis` and `settings.page_title`.
- `frontend/scripts/verify-phase-09-02.mts` — 8-case throwaway verify harness.

## Interfaces Exposed to 09-03

```ts
// DeltaBadge.tsx
export interface DeltaBadgeProps {
  value: number | null;            // result of computeDelta()
  locale: 'de' | 'en';
  noBaselineTooltip: string;       // pre-translated (09-03 supplies via t())
}

// DeltaBadgeStack.tsx
export interface DeltaBadgeStackProps {
  prevPeriodDelta: number | null;
  prevYearDelta: number | null;
  prevPeriodLabel: string;         // from formatPrevPeriodLabel() in 09-01
  prevYearLabel: string;           // from formatPrevYearLabel() in 09-01
  locale: 'de' | 'en';
  noBaselineTooltip: string;
}

// KpiCard.tsx — only the new prop shown
interface KpiCardProps {
  // ... existing label / value / isLoading
  delta?: ReactNode;               // render a <DeltaBadgeStack /> here
}
```

09-03's `KpiCardGrid` is expected to:
1. `const delta = computeDelta(current, prior)` for each of prevPeriod / prevYear per card.
2. `const prevPeriodLabel = formatPrevPeriodLabel(preset, prevPeriodStart, locale, rangeLengthDays)`.
3. `const tooltip = t('dashboard.delta.noBaselineTooltip')`.
4. `<KpiCard … delta={<DeltaBadgeStack … />} />`.

## Locale Keys Landed (EN only)

```json
"dashboard.delta.vsShortPeriod":      "vs. {{count}} days earlier",
"dashboard.delta.vsShortPeriod_one":  "vs. 1 day earlier",
"dashboard.delta.vsCustomPeriod":     "vs. previous period",
"dashboard.delta.vsYear":             "vs. {{year}}",
"dashboard.delta.noBaseline":         "No comparison period available",
"dashboard.delta.noBaselineTooltip":  "No comparison period available"
```

**DE parity hand-off:** Phase 11 will add the DE mirrors in `de.json` during its full-milestone informal "du" pass. Same pattern as Phase 6 WCAG contrast badges. The Phase 9 scope intentionally does NOT touch `frontend/src/locales/de.json` — confirmed via `git diff --name-only frontend/src/locales/` showing only `en.json`.

Additionally, `periodLabels.ts` (landed in 09-01) currently inlines EN phrase strings; Phase 11 will migrate it to read these six keys via `t()`.

## Decisions Made

- **Pure helper factoring:** DeltaBadge.tsx is JSX and therefore cannot be imported by Node's `--experimental-strip-types` loader. Rather than adding vitest (a new dep — forbidden), the visible-text logic (`formatDeltaText`) and the class mapping (`deltaClassName`) were factored into `deltaFormat.ts` — a new pure module — so the 09-01 verify-script convention carries forward unchanged. `DeltaBadge.tsx` is a thin JSX wrapper over `deltaFormat.ts`.
- **Native title tooltip:** 09-CONTEXT section E mentioned "existing shadcn Tooltip component", but the shadcn Tooltip primitive is not installed in this project. The "no new dependencies" constraint from CONTEXT plus the existing LanguageToggle precedent made native `title` the right call. Screen readers still announce it, and Phase 10+ can upgrade to a visual tooltip if a future requirement demands it.
- **DE NBSP in percent format:** Node's Intl emits `U+00A0` (not a regular space) between number and % for `de-DE`. This was verified empirically via a direct probe before writing the verify script, and encoded explicitly as `\u00A0` in the assertion expectations to avoid future surprises.
- **Zero delta renders without an arrow:** `▲ 0.0%` or `▼ 0.0%` would misrepresent "no change" as a direction. `formatDeltaText` returns just `0.0%` / `0,0 %` with the muted class. This matches the "no direction" mental model and costs nothing visually.
- **`delta != null` guard:** Covers both `undefined` and `null` in a single check. TS narrows correctly, and the v1.1 render path is preserved byte-for-byte when the caller passes neither prop.

## Deviations from Plan

**1. [Rule 3 — blocking issue] Factored formatDeltaText into deltaFormat.ts (new file)**
- **Found during:** Task 1 TDD RED-step setup
- **Issue:** The plan's Task 1 `<verify>` block requires `npx tsc --noEmit && npm run lint`, and the implicit 09-01 convention uses a node --experimental-strip-types verify script (no test framework). DeltaBadge.tsx cannot be imported by that loader because strip-types does not support JSX. A DeltaBadge.tsx-only design would have forced adding vitest (new dep — forbidden), or skipping RED entirely.
- **Fix:** Extracted the pure text-formatting + class-mapping logic into a new `deltaFormat.ts` sibling module. `DeltaBadge.tsx` imports from it. The verify script imports from `deltaFormat.ts` (plain `.ts`, loader-compatible) and asserts 8 cases.
- **Files modified:** `deltaFormat.ts` created (was not in the plan's files list), `DeltaBadge.tsx` trimmed to a thin JSX wrapper.
- **Commit:** `e1a8b44`
- **Impact on 09-03:** None — consumers still import `DeltaBadge` / `DeltaBadgeStack` from the same paths the plan promised. The new `deltaFormat.ts` is an internal implementation detail unless 09-03 wants to reuse the pure helpers directly.

No other deviations — no auth gates, no architectural decisions, no pre-existing-issue spillover.

## Out-of-Scope Discoveries (not fixed)

`npm run lint` surfaces three pre-existing `react-refresh/only-export-components` errors and one unused-eslint-disable warning in files this plan did not touch: `badge.tsx`, `button.tsx`, `SettingsDraftContext.tsx`, `bootstrap.ts`. These are pre-Phase-9 tech debt and were NOT modified per the scope-boundary rule. They do not block `tsc -b` or `vite build`, both of which are green.

## Issues Encountered

- **Initial verify-script RED failed differently than expected:** the first RED run errored with `ERR_MODULE_NOT_FOUND` because I momentarily pointed the import at `DeltaBadge.ts` before realizing the JSX/strip-types constraint. Pivoted to the `deltaFormat.ts` factoring in the same edit cycle.
- **NBSP vs. regular space in DE Intl output:** initial assertion draft used a regular space, then a direct char-code probe (`node -e "s.charCodeAt(4)"`) revealed `U+00A0`. Assertions were corrected before the GREEN run — the final verify exits "ALL GREEN".

## Verification Evidence

- `cd frontend && node --experimental-strip-types scripts/verify-phase-09-02.mts` → 8/8 PASS, prints "09-02 Task 1 assertions passed" + "ALL GREEN".
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json` → exits 0, no errors.
- `cd frontend && npm run build` → `tsc -b` + `vite build` both green (bundle 1,059.72 kB — ±0 order-of-magnitude change from 09-01 baseline).
- `node -e "JSON.parse(require('fs').readFileSync('frontend/src/locales/en.json','utf8'))"` → exits 0, valid JSON.
- `git diff --name-only frontend/src/locales/` → returns only `frontend/src/locales/en.json`. **de.json untouched — success criterion met.**
- `git log --oneline -3` → both task commits present (`e1a8b44`, `24b0acd`).

## Next Phase Readiness

- `DeltaBadge`, `DeltaBadgeStack`, and `KpiCard.delta` are all importable and typed for 09-03's wiring.
- Phase 9 success criteria still pending 09-03: lift `activePreset` from `DateRangeFilter` to `DashboardPage`, wire `KpiCardGrid` to compute `prevBounds` + fetch via the 09-01-extended `fetchKpiSummary`, call `computeDelta` per card, thread the DeltaBadgeStack through the new slot, and run the human-verification checkpoint (1080p + 1440p, four preset behaviors, DE/EN percent format).
- `RevenueChart.tsx` remains untouched per plan — Phase 10 territory.

## Self-Check: PASSED

- FOUND: frontend/src/components/dashboard/DeltaBadge.tsx
- FOUND: frontend/src/components/dashboard/DeltaBadgeStack.tsx
- FOUND: frontend/src/components/dashboard/deltaFormat.ts
- FOUND: frontend/src/components/dashboard/KpiCard.tsx (modified — delta prop present)
- FOUND: frontend/src/locales/en.json (modified — 6 new keys present)
- FOUND: frontend/scripts/verify-phase-09-02.mts
- FOUND commit: e1a8b44 (Task 1)
- FOUND commit: 24b0acd (Task 2)
- VERIFIED: frontend/src/locales/de.json NOT modified (`git diff --name-only frontend/src/locales/` lists only en.json)
- VERIFIED: `npm run build` exits 0
- VERIFIED: `node --experimental-strip-types scripts/verify-phase-09-02.mts` exits 0 with "ALL GREEN"

## Known Stubs

None. DeltaBadge / DeltaBadgeStack / KpiCard.delta are genuinely complete presentational contracts — they intentionally render nothing useful until 09-03 wires real data through the slot. This is a planned dependency, not a stub: KpiCardGrid in v1.1 does not import these files at all, so there is no regression window.

---
*Phase: 09-frontend-kpi-card-dual-deltas*
*Completed: 2026-04-11*
