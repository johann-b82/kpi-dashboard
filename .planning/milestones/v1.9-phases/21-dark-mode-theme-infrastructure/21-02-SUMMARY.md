---
phase: 21-dark-mode-theme-infrastructure
plan: "02"
subsystem: frontend-charts
tags: [dark-mode, recharts, tokens, chartDefaults, DM-03]
dependency_graph:
  requires: []
  provides: [DM-03]
  affects: [frontend/src/components/dashboard/RevenueChart.tsx, frontend/src/components/dashboard/HrKpiCharts.tsx]
tech_stack:
  added: []
  patterns: [shared-recharts-token-defaults, css-variable-chart-props]
key_files:
  created:
    - frontend/src/lib/chartDefaults.ts
  modified:
    - frontend/src/components/dashboard/RevenueChart.tsx
    - frontend/src/components/dashboard/HrKpiCharts.tsx
decisions:
  - "Use var(--color-*) form in chartDefaults to match existing chart code convention (not the shorter var(--*) form in UI-SPEC table)"
  - "Spread axisProps with fontSize override pattern (tick: { ...axisProps.tick, fontSize: N }) to preserve component-specific font sizes while inheriting token fill"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-14"
  tasks_completed: 2
  files_modified: 3
---

# Phase 21 Plan 02: Recharts Token Defaults (DM-03) Summary

Extracted shared Recharts CSS-variable props into `chartDefaults.ts` and wired both dashboard chart components to it, closing all token gaps identified in RESEARCH.md so charts auto-adapt when the `.dark` class toggles.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create chartDefaults.ts with 7 Recharts token prop exports | 0944127 | frontend/src/lib/chartDefaults.ts |
| 2 | Wire RevenueChart and HrKpiCharts to chartDefaults | 590fbf2 | RevenueChart.tsx, HrKpiCharts.tsx |

## What Was Built

**`frontend/src/lib/chartDefaults.ts`** — pure constants module with 7 exports:
- `gridProps` — CartesianGrid stroke via `var(--color-border)`
- `axisProps` — XAxis/YAxis stroke, tick fill (`var(--color-muted-foreground)`), tickLine, axisLine all token-based
- `tooltipStyle` — popover background/text/border with `var(--radius-md)` border-radius
- `tooltipLabelStyle` / `tooltipItemStyle` — popover-foreground for label and item text
- `tooltipCursorProps` — accent fill at 0.3 opacity for hover highlight
- `legendWrapperStyle` — muted-foreground text color

**RevenueChart.tsx** — both BarChart and AreaChart variants updated:
- CartesianGrid, XAxis, YAxis, Tooltip, Legend all consume chartDefaults
- Removed inline `borderRadius: "6px"` (now `var(--radius-md)`)
- Added missing `color`, `labelStyle`, `itemStyle`, `cursor` on Tooltip
- Added `legendWrapperStyle` on Legend

**HrKpiCharts.tsx** — MiniChart updated:
- Removed local `tooltipStyle` const (replaced by imported one)
- commonXAxis and commonYAxis JSX elements updated to use axisProps spread
- Both AreaChart and BarChart Tooltip variants wired with full set of token props

## Decisions Made

1. **var(--color-*) form**: Used `var(--color-*)` throughout (matching existing chart code convention) rather than the shorter `var(--)` form shown in the UI-SPEC table — both resolve identically via `@theme inline` in Tailwind v4.

2. **axisProps spread pattern**: For XAxis/YAxis with component-specific font sizes, used `{...axisProps, tick: { ...axisProps.tick, fontSize: N }}` to merge shared token fill with per-component size overrides. RevenueChart uses `fontSize: 12`, HrKpiCharts uses `fontSize: 11`.

## Deviations from Plan

None — plan executed exactly as written. The pre-existing TypeScript errors in `SalesTable.tsx` and `HrKpiCharts.tsx` formatter types were confirmed pre-existing before these changes and are out of scope.

## Known Stubs

None.

## Self-Check: PASSED

Files exist:
- FOUND: frontend/src/lib/chartDefaults.ts
- FOUND: frontend/src/components/dashboard/RevenueChart.tsx (modified)
- FOUND: frontend/src/components/dashboard/HrKpiCharts.tsx (modified)

Commits verified:
- FOUND: 0944127 (feat(21-02): create chartDefaults.ts)
- FOUND: 590fbf2 (feat(21-02): wire RevenueChart and HrKpiCharts to chartDefaults)
