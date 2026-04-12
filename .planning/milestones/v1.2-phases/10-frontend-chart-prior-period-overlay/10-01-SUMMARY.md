---
phase: 10-frontend-chart-prior-period-overlay
plan: "01"
subsystem: frontend-utils
tags: [chart, comparison, i18n, pure-utils, tanstack-query]
dependency_graph:
  requires: [Phase 9 dateUtils.Preset, Phase 9 prevBounds.ts, Phase 8 ChartResponse]
  provides: [selectComparisonMode, formatChartSeriesLabel, extended fetchChartData, extended kpiKeys.chart, 4 EN i18n keys]
  affects: [RevenueChart.tsx (10-02), KpiCardGrid (cache key shape)]
tech_stack:
  added: []
  patterns: [pure-util module pattern, TanStack Query cache key embedding, i18next t injection, TypeScript exhaustiveness switch]
key_files:
  created:
    - frontend/src/lib/chartComparisonMode.ts
    - frontend/scripts/verify-phase-10-01.mts
  modified:
    - frontend/src/lib/periodLabels.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/locales/en.json
decisions:
  - "selectComparisonMode uses exhaustive switch with no default branch for TypeScript compile-time enforcement"
  - "formatChartSeriesLabel injects t() instead of importing i18next — file stays a pure util module"
  - "fetchChartData extension is additive; existing callers without comparison args remain backward-compatible"
  - "kpiKeys.chart embeds comparison+prevStart+prevEnd so TanStack Query invalidates on preset change (D-15)"
  - "4 EN i18n keys added as flat keys matching en.json style; de.json untouched (D-11)"
metrics:
  duration: "~2 min"
  completed: "2026-04-12"
  tasks: 3
  files: 6
---

# Phase 10 Plan 01: Chart Comparison Mode Utils and Data-Layer Extension Summary

One-liner: Pure preset-to-comparison-mode selector + contextual legend label helper + extended fetch/cache-key signatures for prior-period chart overlay.

## What Was Built

This plan delivered the pure data/utility layer required by plan 10-02 to render the prior-period chart overlay:

1. **`frontend/src/lib/chartComparisonMode.ts`** — New file exporting `selectComparisonMode(preset: Preset): ComparisonMode`. Four-case exhaustive switch with no default branch (D-01, D-02, D-03). TypeScript compile-time enforcement of all Preset variants.

2. **`frontend/src/lib/periodLabels.ts`** extended — New `formatChartSeriesLabel(preset, range, locale, t)` returns `{ current: string; prior: string }` for chart legend labels. Handles all 4 presets including Q1→Q4 quarter rollover. Injected `t` keeps the file i18next-free (D-09, D-10).

3. **`frontend/src/lib/api.ts`** extended — `fetchChartData` gains 3 optional params: `comparison?: ComparisonMode`, `prevStart?: string`, `prevEnd?: string`. When comparison is `"none"` or absent, no comparison params are appended — backward-compatible with existing callers. Backend param names are `prev_start` / `prev_end` / `comparison` (verified against `kpis.py`) (D-14).

4. **`frontend/src/lib/queryKeys.ts`** extended — `kpiKeys.chart` factory gains matching optional params; embeds all three in the cache key object so TanStack Query invalidates whenever the selected preset shifts (D-15).

5. **`frontend/src/locales/en.json`** — 4 new flat keys added after `"dashboard.chart.xAxis"`:
   ```json
   "dashboard.chart.series.revenue": "Revenue",
   "dashboard.chart.series.revenueMonth": "Revenue {{month}}",
   "dashboard.chart.series.revenueQuarter": "Revenue Q{{quarter}}",
   "dashboard.chart.series.revenueYear": "Revenue {{year}}"
   ```
   `de.json` untouched (D-11).

6. **`frontend/scripts/verify-phase-10-01.mts`** — Throwaway verification script, 9 assertions, runs under `node --experimental-strip-types`, no new deps.

## Final Function Signatures

**`selectComparisonMode`** (frontend/src/lib/chartComparisonMode.ts):
```ts
export type ComparisonMode = "previous_period" | "previous_year" | "none";
export function selectComparisonMode(preset: Preset): ComparisonMode
```

**`formatChartSeriesLabel`** (frontend/src/lib/periodLabels.ts):
```ts
export interface ChartSeriesLabels { current: string; prior: string; }
export function formatChartSeriesLabel(
  preset: Preset,
  range: DateRangeValue,
  locale: SupportedLocale,
  t: (key: string, options?: Record<string, unknown>) => string,
): ChartSeriesLabels
```

**`fetchChartData`** (frontend/src/lib/api.ts):
```ts
export async function fetchChartData(
  start: string | undefined,
  end: string | undefined,
  granularity: "daily" | "weekly" | "monthly" = "monthly",
  comparison?: ComparisonMode,
  prevStart?: string,
  prevEnd?: string,
): Promise<ChartResponse>
```

**`kpiKeys.chart`** (frontend/src/lib/queryKeys.ts):
```ts
chart: (
  start: string | undefined,
  end: string | undefined,
  granularity: string,
  comparison?: ComparisonMode,
  prevStart?: string,
  prevEnd?: string,
) => ["kpis", "chart", { start, end, granularity, comparison, prevStart, prevEnd }] as const
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | b192791 | feat(10-01): add selectComparisonMode util and formatChartSeriesLabel extension |
| Task 2 | d6f3203 | feat(10-01): extend fetchChartData, kpiKeys.chart, and add 4 EN i18n keys |
| Task 3 | b781e8b | test(10-01): add verify-phase-10-01.mts throwaway verification script |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan delivers pure utility layer only; no UI rendering, no stubs.

## Verification Results

- `cd frontend && npx tsc -b` — exit 0, no `error TS` lines
- `node --experimental-strip-types frontend/scripts/verify-phase-10-01.mts` — exit 0, `Phase 10-01: selectComparisonMode + formatChartSeriesLabel — ALL GREEN`
- `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json', 'utf8'))"` — exit 0
- `git diff --stat frontend/src/locales/de.json` — no changes

## Self-Check: PASSED

- `frontend/src/lib/chartComparisonMode.ts` — FOUND
- `frontend/src/lib/periodLabels.ts` extended — FOUND (`formatChartSeriesLabel` exported)
- `frontend/src/lib/api.ts` extended — FOUND (`comparison?: ComparisonMode` present)
- `frontend/src/lib/queryKeys.ts` extended — FOUND (`comparison, prevStart, prevEnd` in key)
- `frontend/src/locales/en.json` extended — FOUND (4 new keys)
- `frontend/scripts/verify-phase-10-01.mts` — FOUND
- Commit b192791 — FOUND
- Commit d6f3203 — FOUND
- Commit b781e8b — FOUND
