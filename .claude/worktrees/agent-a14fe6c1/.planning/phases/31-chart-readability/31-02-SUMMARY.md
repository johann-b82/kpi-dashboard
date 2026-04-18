---
phase: 31-chart-readability
plan: "02"
subsystem: frontend-charts
tags: [chart, recharts, year-labels, gap-fill, typescript]
dependency_graph:
  requires:
    - chartTimeUtils (from 31-01)
  provides:
    - Year-aware x-axis tick labels on Sales and HR charts
    - Year boundary ReferenceLine separators on both dashboards
    - Gap-filled month spine on RevenueChart
  affects:
    - frontend/src/components/dashboard/RevenueChart.tsx
    - frontend/src/components/dashboard/HrKpiCharts.tsx
tech_stack:
  added: []
  patterns: [Recharts ReferenceLine, buildMonthSpine gap-fill, formatMonthYear locale-aware]
key_files:
  created: []
  modified:
    - frontend/src/components/dashboard/RevenueChart.tsx
    - frontend/src/components/dashboard/HrKpiCharts.tsx
decisions:
  - "RevenueChart uses startDate/endDate props for spine when available, falls back to data bounds"
  - "HR ReferenceLine x= uses YYYY-MM slice (not YYYY-MM-01) to match dataKey='month' format"
metrics:
  duration: ~2min
  completed: "2026-04-16"
  tasks: 2
  files: 2
---

# Phase 31 Plan 02: Chart Integration Summary

**One-liner:** Wired buildMonthSpine, mergeIntoSpine, formatMonthYear, and yearBoundaryDates into RevenueChart and HrKpiCharts — delivering year-aware tick labels, gap-filled axes, and dashed year boundary lines on both dashboards.

## What Was Built

**RevenueChart.tsx:**
- Replaced month-only `Intl.DateTimeFormat` fallthrough with `formatMonthYear(dateStr, locale)` — shows `"Nov '25"` format
- Added `buildMonthSpine(startDate, endDate)` + `mergeIntoSpine` for gap-filled time series (CHART-03)
- Added `ticks={spine}` on both XAxis elements for explicit tick control
- Added `yearBoundaryDates(spine)` and rendered `<ReferenceLine>` dashed separators in both BarChart and AreaChart
- `thisMonth` CW/KW weekly branch left completely unchanged

**HrKpiCharts.tsx:**
- Replaced 3-line `formatMonth` function with single-line `formatMonthYear(m + "-01", locale)`
- Added `yearBoundaryDates` boundary computation inside MiniChart
- Added `<ReferenceLine x={d.slice(0,7)}>` year separators in both AreaChart and BarChart branches
- No gap-fill needed — backend always returns dense 12-month array

## Verification

- TypeScript: `npx tsc --noEmit` exits 0
- Lint: pre-existing errors only (badge.tsx, button.tsx, form.tsx, contexts) — none in modified files
- Unit tests: 12/12 passing (`chartTimeUtils.test.ts`)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
