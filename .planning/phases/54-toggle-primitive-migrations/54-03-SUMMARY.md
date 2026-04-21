---
phase: 54-toggle-primitive-migrations
plan: 03
subsystem: frontend/dashboard
tags: [toggle, migration, charts, ui-consistency, v1.19]
requires:
  - "54-01 (Toggle primitive)"
provides:
  - "HrKpiCharts area/bar switch via Toggle primitive"
  - "RevenueChart bar/area switch via Toggle primitive"
  - "TOGGLE-04 chart call sites closed"
affects:
  - "frontend/src/components/dashboard/HrKpiCharts.tsx"
  - "frontend/src/components/dashboard/RevenueChart.tsx"
tech-stack:
  added: []
  patterns:
    - "Toggle<ChartType> with 2-tuple segments `as const`"
    - "CHART_TYPES narrowed via `as const satisfies readonly [ChartType, ChartType]` to satisfy Toggle's 2-tuple shape"
    - "Tuple-indexed segments (CHART_TYPES[0]/[1]) preserve constant-as-SSOT while avoiding Array.map widening"
key-files:
  created: []
  modified:
    - "frontend/src/components/dashboard/HrKpiCharts.tsx"
    - "frontend/src/components/dashboard/RevenueChart.tsx"
key-decisions:
  - "Narrow CHART_TYPES to a 2-tuple rather than build segments via .map() — map widens the return type out of the tuple shape required by Toggle, so explicit tuple indexing is used"
metrics:
  duration: 98s
  tasks: 2
  files: 2
  completed: 2026-04-21
---

# Phase 54 Plan 03: Chart-Type Migrations Summary

Third and fourth production call sites for the `Toggle` primitive: migrate both chart-type 2-option switches (HrKpiCharts area/bar and RevenueChart bar/area) from `SegmentedControl` to `Toggle`, closing the chart-side of TOGGLE-04.

## What shipped

- `HrKpiCharts` chart-type switch now renders via `Toggle<ChartType>` with `hr.chart.type.area` + `dashboard.chart.type.bar` labels (keys unchanged). The `ChartType = "area" | "bar"` alias, `setChartType` behavior, and all downstream chart rendering are untouched.
- `RevenueChart` chart-type switch now renders via `Toggle<ChartType>`. The `CHART_TYPES` constant was narrowed from `ChartType[]` to `readonly [ChartType, ChartType]` via `as const satisfies ...`, and the Toggle `segments` prop is built by explicit tuple-indexing `CHART_TYPES[0]` / `CHART_TYPES[1]` so the constant stays the single source of truth while satisfying Toggle's 2-tuple type contract.
- Neither file imports from `@/components/ui/segmented-control` anymore.
- Zero i18n key changes; `hr.chart.type.area`, `dashboard.chart.type.bar`, `dashboard.chart.type.area` all reused verbatim.

## Task breakdown

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate HrKpiCharts area/bar switch to Toggle | `20521d8` | `frontend/src/components/dashboard/HrKpiCharts.tsx` |
| 2 | Migrate RevenueChart bar/area switch to Toggle | `61453b9` | `frontend/src/components/dashboard/RevenueChart.tsx` |

## Verification

- `cd frontend && npx tsc --noEmit` — PASS (no errors)
- `grep -q 'from "@/components/ui/toggle"'` in both files — PASS
- `! grep -q 'from "@/components/ui/segmented-control"'` in both files — PASS
- `grep -q '<Toggle'` in both files — PASS
- `! grep -q '<SegmentedControl'` in both files — PASS
- `CHART_TYPES` still referenced in RevenueChart's Toggle segments prop — PASS
- `t(\`dashboard.chart.type.${...}\`)` dynamic key pattern preserved — PASS

Note: `npm run build` emits pre-existing TypeScript errors in unrelated files (`SalesTable.tsx`, `useSensorDraft.ts`, `defaults.ts`, `SchedulesPage.test.tsx`). These errors reproduce on a pristine tree prior to this plan's edits (verified via stash) and are out of scope per the plan's SCOPE BOUNDARY rule. Logged for the milestone-level verifier.

## Deviations from Plan

None — plan executed exactly as written. Both tasks applied the verbatim diffs specified in the plan's `<action>` blocks; verification commands all passed.

## Decisions Made

- **Narrow CHART_TYPES to a 2-tuple.** Toggle requires a `readonly [Segment<T>, Segment<T>]` per Plan 54-01 D-03. `Array.prototype.map` returns `Array<...>`, which widens out of the tuple shape. Explicit tuple indexing on `CHART_TYPES` preserves both Toggle's type discipline and the plan's "CHART_TYPES is SSOT" rule, without duplicating chart-type string literals in the JSX.

## Self-Check: PASSED

- `frontend/src/components/dashboard/HrKpiCharts.tsx` — FOUND (modified, imports Toggle)
- `frontend/src/components/dashboard/RevenueChart.tsx` — FOUND (modified, imports Toggle, CHART_TYPES narrowed)
- Commit `20521d8` — FOUND in `git log`
- Commit `61453b9` — FOUND in `git log`
