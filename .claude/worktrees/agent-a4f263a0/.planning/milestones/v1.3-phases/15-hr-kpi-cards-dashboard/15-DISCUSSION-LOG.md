# Phase 15: HR KPI Cards & Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 15-hr-kpi-cards-dashboard
**Areas discussed:** KPI computation periods, Card layout & ordering, Fallback & edge states, Cross-source KPI behavior

---

## KPI Computation Periods

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar month | Current month vs. previous month, same month last year | ✓ |
| Rolling 30 days | Last 30 days vs. prior 30 days, same 30 days last year | |
| You decide | Claude picks the most sensible approach | |

**User's choice:** Calendar month
**Notes:** Simple, predictable, matches typical HR reporting cycles.

### Follow-up: Headcount snapshot timing

| Option | Description | Selected |
|--------|-------------|----------|
| End of month | Count active employees as of the last day of the period | ✓ |
| Average | Average of start-of-month and end-of-month headcount | |
| You decide | Claude picks | |

**User's choice:** End of month

---

## Card Layout & Ordering

### Grid arrangement

| Option | Description | Selected |
|--------|-------------|----------|
| 3 + 2 grid | First row: 3 cards, second row: 2 cards left-aligned | ✓ |
| 3 + 2 centered | Same layout but second row centered | |
| 2-column grid | 5 cards in 2 columns (3 rows) | |

**User's choice:** 3 + 2 grid

### Top row selection

| Option | Description | Selected |
|--------|-------------|----------|
| Overtime, SickLeave, Fluctuation | Pure HR metrics top row, cross-source in bottom | ✓ |
| Overtime, SickLeave, Rev/Emp | Business-critical cross-source KPI gets prominence | |
| You decide | Claude picks ordering | |

**User's choice:** Overtime, SickLeave, Fluctuation

---

## Fallback & Edge States

### No sync state

| Option | Description | Selected |
|--------|-------------|----------|
| Empty cards with hint | 5 cards with em-dash + banner above pointing to sync | ✓ |
| Hide cards until first sync | Placeholder only until data exists | |
| Loading skeletons | Pulsing skeleton cards (could be misleading) | |

**User's choice:** Empty cards with hint

### Unconfigured setting

| Option | Description | Selected |
|--------|-------------|----------|
| Inline hint in card | Card shows "nicht konfiguriert" with Settings link | ✓ |
| Em-dash only | Show "—" without explanation | |
| Hide unconfigured cards | Only show computable cards | |

**User's choice:** Inline hint in card

### Error state

| Option | Description | Selected |
|--------|-------------|----------|
| Error banner above cards | Red-tinted banner + em-dash cards (matches Sales) | ✓ |
| Replace grid entirely | Hide all cards, show error block only | |

**User's choice:** Error banner above cards

---

## Cross-Source KPI Behavior

### Department matching

| Option | Description | Selected |
|--------|-------------|----------|
| Exact match on department name | WHERE department = setting | ✓ |
| Contains/partial match | WHERE department ILIKE '%setting%' | |
| You decide | Claude picks based on Personio conventions | |

**User's choice:** Exact match

### Revenue source

| Option | Description | Selected |
|--------|-------------|----------|
| Total revenue, current calendar month | SUM(total_value) for the month | ✓ |
| Auftrags-DB (order margin) | Different column if DB means contribution margin | |
| You decide | Claude inspects SalesRecord columns | |

**User's choice:** Total revenue, current calendar month

---

## Claude's Discretion

- Backend endpoint structure (single vs. per-KPI)
- HR KPI aggregation service naming
- HrKpiCardGrid component design
- Delta badge labels for fixed calendar month
- Pydantic response schema design

## Deferred Ideas

None — discussion stayed within phase scope.
