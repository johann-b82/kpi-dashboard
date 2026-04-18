---
phase: 31-chart-readability
plan: "01"
subsystem: frontend-lib
tags: [chart, utilities, tdd, typescript]
dependency_graph:
  requires: []
  provides:
    - chartTimeUtils (buildMonthSpine, mergeIntoSpine, formatMonthYear, yearBoundaryDates)
  affects:
    - frontend/src/lib/chartTimeUtils.ts
tech_stack:
  added: [vitest]
  patterns: [TDD red-green, Intl.DateTimeFormat locale-aware formatting]
key_files:
  created:
    - frontend/src/lib/chartTimeUtils.ts
    - frontend/src/lib/chartTimeUtils.test.ts
  modified:
    - frontend/package.json
decisions:
  - Used Map keyed on YYYY-MM slice for mergeIntoSpine to match dates regardless of day component
  - formatMonthYear uses Intl.DateTimeFormat(locale, {month:"short"}) for locale-aware short month names
metrics:
  duration: ~5min
  completed: "2026-04-16"
  tasks: 1
  files: 3
---

# Phase 31 Plan 01: Chart Time Utilities Summary

**One-liner:** Month spine generator, gap-fill merge, locale-aware tick formatter, and year-boundary detector built test-first with vitest (12 tests passing).

## What Was Built

`frontend/src/lib/chartTimeUtils.ts` exports four functions:

- `buildMonthSpine(start, end)` — produces `YYYY-MM-01` strings from start to end inclusive
- `mergeIntoSpine(spine, points)` — fills gaps in API data with `revenue: null`
- `formatMonthYear(dateStr, locale)` — formats as `"Nov '25"` using `Intl.DateTimeFormat`
- `yearBoundaryDates(spine)` — filters spine for January dates (year boundary markers)

Tests cover: multi-month span, single-month, cross-year, gap fill, empty inputs, en-US and de-DE locales, January detection with/without matches, multiple years.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
