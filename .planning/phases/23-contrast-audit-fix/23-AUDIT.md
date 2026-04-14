# Phase 23: Contrast Audit Findings

**Audited:** 2026-04-14
**Tool:** axe DevTools browser extension (Chrome, free tier)
**Baseline:** Post Plans 23-01 + 23-02 (token darkened, splash fixed)
**Scope:** 4 routes × 2 modes = 8 passes, plus cross-route components (NavBar, SubHeader, ThemeToggle, LanguageToggle, bootstrap-splash) recorded inline per route.

## Audit Method

1. Run `cd frontend && npm run dev`
2. Open Chrome with axe DevTools extension installed
3. For each row below: navigate, set mode via ThemeToggle, wait for render, click "Scan All of My Page", record each violation as a row in the route table.
4. Zero violations → write `(no violations)` in the table body.

## Findings

### Route: `/` (Sales dashboard) — Light mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/` (Sales dashboard) — Dark mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/hr` (HR dashboard) — Light mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/hr` (HR dashboard) — Dark mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/upload` — Light mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/upload` — Dark mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/settings` — Light mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

### Route: `/settings` — Dark mode

| Element | Selector | FG color | BG color | Ratio | Required | Status |
|---------|----------|----------|----------|-------|----------|--------|
|         |          |          |          |       |          |        |

## Summary

| Route | Light violations | Dark violations |
|-------|-----------------|----------------|
| `/`        |  |  |
| `/hr`      |  |  |
| `/upload`  |  |  |
| `/settings`|  |  |
| **Total**  |  |  |

## Notes

- All findings here will be addressed in Plan 23-04 (manual WebAIM verification + residual fixes).
- Recharts SVG text elements may not be fully covered by axe — Plan 23-04 includes manual WebAIM pass on chart text.
