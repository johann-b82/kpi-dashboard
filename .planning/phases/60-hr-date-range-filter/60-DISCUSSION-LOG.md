# Phase 60: HR Date-Range Filter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 60-hr-date-range-filter
**Areas discussed:** KPI semantics, Chart bucketing, Presets/state sharing, EmployeeTable filtering

---

## KPI Semantics Over Custom Range

### Aggregation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate over whole range | Sum numerator/denominator across entire range as one window | ✓ |
| Average of monthly values | Compute per-month, average the monthly ratios | |
| Range-aware per KPI | Mix — some whole-range (ratios), others end-of-range snapshots | |

**User's choice:** Aggregate over whole range (recommended).
**Notes:** Most defensible statistically; simplest mental model.

### Delta baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Prior window of same length | For 45-day range, compare to prior 45 days | ✓ |
| Prior calendar month | Always compare to previous calendar month | |
| Same window, prior year | Seasonal comparison | |
| Drop deltas when range ≠ calendar month | Hide delta for custom ranges | |

**User's choice:** Prior window of same length (recommended).
**Notes:** Consistent with Sales semantics; works for any window.

### Fluctuation KPI formula

| Option | Description | Selected |
|--------|-------------|----------|
| Leavers in range / avg headcount in range | Ratio scales to any window | ✓ |
| Annualized rate | Annualize via 365/range_days multiplier | |
| Raw count only | Just show leavers count | |

**User's choice:** Leavers / avg headcount (recommended).

### Revenue-per-production-employee source

| Option | Description | Selected |
|--------|-------------|----------|
| Sum sales revenue in range / avg prod headcount | Single range figure | ✓ |
| Monthly rev/employee, averaged | Per-month then average | |

**User's choice:** Sum revenue / avg headcount (recommended).

---

## Chart X-Axis Bucketing

### Bucketing strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto by range length | ≤31d daily, ≤13w weekly, ≤24m monthly, else quarterly | ✓ |
| Always monthly | Monthly buckets clipped to range | |
| User-picked granularity | Add explicit granularity selector | |

**User's choice:** Auto by range length (recommended).

### Default-load chart behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Chart always reflects range | Default preset renders whatever range says | ✓ |
| Keep 12-month history independent | Cards react to range, chart always 12mo | |

**User's choice:** Chart always reflects range (recommended).

---

## Presets + Default + State Sharing

### State sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Shared context | One DateRangeContext for /sales + /hr | ✓ |
| Separate state per dashboard | Each dashboard remembers its own range | |

**User's choice:** Shared context (recommended).

### Preset set

| Option | Description | Selected |
|--------|-------------|----------|
| Same as Sales (thisMonth/thisQuarter/thisYear/allTime) | Reuse existing preset set | ✓ |
| HR-specific set | Custom set (e.g., drop allTime, add last30d) | |

**User's choice:** Same as Sales (recommended).

---

## EmployeeTable Filtering Under Range

### Per-employee metrics scope

| Option | Description | Selected |
|--------|-------------|----------|
| Metrics computed over active range | total_hours/overtime_hours sum attendances in range | ✓ |
| Keep current-month | Table metrics stay MTD regardless of range | |

**User's choice:** Metrics over active range (recommended).

### Roster filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Current roster, unfiltered | Today's employees; existing segment filter keeps working | ✓ |
| Only employees active within range | Filter by contract-overlap with range | |
| Only employees with attendance in range | Stricter: at least one attendance in range | |

**User's choice:** Current roster, unfiltered (recommended).

---

## Claude's Discretion

- Query param naming (`date_from`/`date_to`) and validation rules — planner to match Sales convention.
- Backend fallback when params omitted — planner's call.
- React Query cache-key design + invalidation on range change.
- Loading / skeleton UX during refetch.
- Empty-state copy when range has no data.

## Deferred Ideas

- Annualized fluctuation, HR-specific presets, user-picked chart granularity, YoY delta option, roster filtering by contract/attendance — all captured in CONTEXT.md `<deferred>`.
