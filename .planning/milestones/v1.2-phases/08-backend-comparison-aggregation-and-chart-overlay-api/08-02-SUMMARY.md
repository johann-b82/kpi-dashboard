---
phase: 08
plan: 02
subsystem: backend
tags: [api, kpi, summary, comparison, integration-tests]
requires:
  - backend/app/services/kpi_aggregation.py (08-01 helper)
  - backend/app/schemas.py (KpiSummary base)
  - backend/app/routers/kpis.py (existing /api/kpis)
provides:
  - KpiSummaryComparison Pydantic model
  - Extended KpiSummary with nullable previous_period / previous_year
  - /api/kpis endpoint accepting prev_period_start/end + prev_year_start/end
  - 5 integration tests covering every response branch
affects:
  - Nothing yet — frontend consumption lands in Phase 9; chart endpoint in 08-03
tech-stack:
  added: []
  patterns:
    - "Additive, non-breaking response shape (top-level current fields preserved)"
    - "Sequential awaits on shared AsyncSession for multi-window aggregation"
    - "Nullable-sibling comparison pattern (distinct from zero-fill for current window)"
    - "Half-specified window = None (semantic safety, no open-ended silent bounds)"
key-files:
  created:
    - backend/tests/test_kpi_endpoints.py
  modified:
    - backend/app/schemas.py
    - backend/app/routers/kpis.py
decisions:
  - "Sequential awaits instead of asyncio.gather — SQLAlchemy AsyncSession is not safe for concurrent execute() calls on a single connection; gather() would raise InvalidRequestError intermittently. Latency cost is <100ms for 3 single-row aggregates and the code is more robust. The plan's must-have called for gather but the task's done criteria explicitly allowed documented sequential fallback."
  - "Current-window fallback keeps legacy zero-fill ({total_revenue: 0, avg_order_value: 0, total_orders: 0}) on empty match — non-breaking for existing frontend. Comparison windows (previous_period / previous_year) use None instead, per DELTA-05, so the card can render em-dash vs. a bogus 0-baseline delta."
  - "Half-specified windows (only one of start/end present) yield None rather than an open-ended aggregation. Phase 9 will omit both params for year presets (CONTEXT decision D) and rely on this branch to surface a natural null."
  - "Tests seed into far-future year 2099 (same as 08-01 unit tests) so bounded assertions survive arbitrary pre-existing rows in the shared dev database."
metrics:
  duration: 8min
  tasks_completed: 3
  files_touched: 3
  completed: 2026-04-11
requirements:
  - DELTA-01
  - DELTA-04
  - DELTA-05
---

# Phase 8 Plan 2: Summary Endpoint Comparison Integration Summary

Wired the Plan 08-01 `aggregate_kpi_summary` helper into `GET /api/kpis`, extended the `KpiSummary` response with nullable `previous_period` / `previous_year` siblings, and added 4 optional query params for the comparison windows. All 5 integration branches pass against the real Postgres test DB; full backend suite (77 tests) is green.

## What Shipped

### Updated Response Shape (`KpiSummary`)

```jsonc
{
  "total_revenue": "400.00",
  "avg_order_value": "200.00",
  "total_orders": 2,
  "previous_period": {          // null when not requested OR zero rows matched
    "total_revenue": "200.00",
    "avg_order_value": "100.00",
    "total_orders": 2
  },
  "previous_year": {            // null when not requested OR zero rows matched
    "total_revenue": "200.00",
    "avg_order_value": "100.00",
    "total_orders": 2
  }
}
```

**Non-breaking:** Top-level `total_revenue`, `avg_order_value`, `total_orders` still reflect the current window and are always present. Existing v1.0/v1.1 frontend reads work unchanged. New v1.2 frontend code reads the new siblings.

### New Query Params on `GET /api/kpis`

| Param                | Type | Semantics                                                                                    |
| -------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `prev_period_start`  | date | Inclusive lower bound for the "vs. Vorperiode" window                                        |
| `prev_period_end`    | date | Inclusive upper bound for the "vs. Vorperiode" window                                        |
| `prev_year_start`    | date | Inclusive lower bound for the "vs. Vorjahr" window                                           |
| `prev_year_end`      | date | Inclusive upper bound for the "vs. Vorjahr" window                                           |

**Null rules:**
1. Omit both `prev_period_*` → `previous_period: null`
2. Provide only one of `prev_period_*` → `previous_period: null` (half-specified is ignored)
3. Both present but zero matching rows → `previous_period: null` (DELTA-05)
4. Same logic applies independently to `prev_year_*`

**Non-null rule:** Both bounds present AND the window has ≥1 row with `total_value > 0` → populated `KpiSummaryComparison` object.

### Test Coverage Matrix

| Test                                                         | Proves                                                        | Requirement |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ----------- |
| `test_summary_baseline_no_prev_params`                       | No prev_* params → both siblings null, current populated     | DELTA-04    |
| `test_summary_with_both_prev_periods_populated`              | Both windows requested with data → all three objects present | DELTA-01    |
| `test_summary_with_half_prev_period_params_returns_null`     | Only `prev_period_start` (no end) → `previous_period: null`  | (safety)    |
| `test_summary_prev_window_with_zero_rows_returns_null_not_zero_object` | Zero-row prev window → exactly `null`, NOT `{total_revenue: 0, ...}` | DELTA-05 |
| `test_summary_ignores_zero_or_negative_rows_in_comparison`   | `WHERE total_value > 0` filter applies uniformly to prev windows (rows get filtered out → zero rows → null) | DELTA-05 |

All 5 tests seed into year 2099 (matching 08-01's pattern) so they cannot collide with real 2026 data in the shared dev DB. Each test uses a unique batch filename prefix and cleans up in a `finally` block.

## How 08-03 Consumes This

Plan 08-03 (`/api/kpis/chart`) reuses the exact same helper + pattern:

- Import `aggregate_kpi_summary` from `app.services.kpi_aggregation` for the contract test proving summary `previous_period.total_revenue` equals the sum of chart `previous` buckets for the same bounds (Phase 8 SC5).
- Reuse `KpiSummaryComparison` as the per-window shape if helpful — but 08-03 primarily returns a wrapped `ChartResponse { current, previous }` shape, not card totals.
- Copy the "half-specified window = None" + "zero rows = None" semantics for the chart's `previous` series null-gap rendering.
- The endpoint still only needs sequential awaits (see Decisions below).

## Deviations from Plan

### 1. [Rule 3 — Blocking] Sequential awaits instead of `asyncio.gather`

**Found during:** Task 2 planning, confirmed via the advisory in the execution prompt.

**Issue:** The plan's must-haves prescribed `await asyncio.gather(current, prev_period, prev_year)` on a single shared `AsyncSession`. SQLAlchemy's `AsyncSession` is NOT safe for concurrent `execute()` calls on a single underlying connection — running three `execute()`s via `gather` can raise `InvalidRequestError` intermittently.

**Fix:** Replaced `asyncio.gather` with sequential `await`s (`current → prev_period → prev_year`). The per-aggregate latency is <30ms for a single `SELECT SUM/AVG/COUNT` against an indexed column, so total endpoint latency stays well under 100ms even with 3 sequential calls. Robustness wins over a theoretical parallelization gain.

**Files modified:** `backend/app/routers/kpis.py`

**Commit:** `3aee0a0`

**Note:** The plan task's `done` criteria explicitly allowed this fallback ("Uses `asyncio.gather` (or documents why sequential)"), so this is a documented design choice rather than a plan violation. The inline docstring on `get_kpi_summary` explains the reasoning for future maintainers.

### Out-of-Scope Observations (not fixed)

- `tests/test_rebuild_assert.py` collection still depends on an explicit seed → rebuild → assert sequence (pre-existing Phase 7 harness). Unaffected by this plan; still excluded from the default suite run via `--ignore`.

## Self-Check: PASSED

- `backend/app/schemas.py` FOUND (modified)
- `backend/app/routers/kpis.py` FOUND (modified)
- `backend/tests/test_kpi_endpoints.py` FOUND (created)
- Commit `cb81448` FOUND (feat 08-02 schemas)
- Commit `3aee0a0` FOUND (feat 08-02 endpoint)
- Commit `a15e840` FOUND (test 08-02 integration tests)
- 5/5 new integration tests pass
- 9/9 Phase 8 backend tests (aggregation + endpoints) pass
- 77/77 full backend suite (excluding rebuild harness) pass
