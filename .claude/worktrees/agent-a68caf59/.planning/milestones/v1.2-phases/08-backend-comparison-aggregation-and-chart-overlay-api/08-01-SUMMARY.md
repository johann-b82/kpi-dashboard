---
phase: 08
plan: 01
subsystem: backend
tags: [aggregation, sql, services, unit-tests, kpi]
requires:
  - backend/app/models.py (SalesRecord, UploadBatch)
  - backend/app/database.py (AsyncSessionLocal)
provides:
  - aggregate_kpi_summary helper (app.services.kpi_aggregation)
affects:
  - Nothing yet — routers/kpis.py integration lands in 08-02 / 08-03
tech-stack:
  added: []
  patterns:
    - "Async SQLAlchemy 2.0 select() with func.sum/avg/count"
    - "Null-safe aggregation: return None (not zero dict) for empty windows"
    - "Pure-SQL service module isolated from FastAPI layer"
key-files:
  created:
    - backend/app/services/__init__.py
    - backend/app/services/kpi_aggregation.py
    - backend/tests/test_kpi_aggregation.py
  modified: []
decisions:
  - "Helper returns dict | None, not a typed dataclass — keeps the callsite flexible for Pydantic response models added in 08-02 (both summary's nullable previous_period/previous_year and chart's nullable previous series project the same shape)"
  - "Unit tests use year 2099 dates to isolate from real 2026 seed data in the shared dev database — avoids flaky bounded assertions"
  - "test_no_bounds_returns_all_time uses delta-based assertion (before/after) rather than absolute totals to survive arbitrary pre-existing rows in the dev db"
  - "Total_value null-coalescing: row.total_revenue or Decimal('0') — defensive even though WHERE total_value > 0 guarantees it's non-null for non-zero count"
metrics:
  duration: 6min
  tasks_completed: 2
  files_touched: 3
  completed: 2026-04-11
requirements:
  - DELTA-02
  - DELTA-03
  - DELTA-05
  - CHART-02
---

# Phase 8 Plan 1: Generic KPI Aggregation Helper Summary

Extracted pure-SQL `aggregate_kpi_summary(session, start_date, end_date) -> dict | None` into a dedicated service module so the same aggregation drives the current window and every comparison window on both `/api/kpis` and `/api/kpis/chart`.

## What Shipped

### `backend/app/services/kpi_aggregation.py`

```python
async def aggregate_kpi_summary(
    session: AsyncSession,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict | None
```

**Contract:**
- Returns `{"total_revenue": Decimal, "avg_order_value": Decimal, "total_orders": int}` when at least one row matches.
- Returns `None` when `total_orders == 0` — distinguishes "no data" from "legitimate zero" per DELTA-05.
- Unconditional `WHERE total_value > 0` filter (preserves legacy semantics from `routers/kpis.py`).
- `start_date` / `end_date` bounds applied only when not `None` — `(None, None)` means all-time.
- Single round-trip: one `SELECT SUM/AVG/COUNT ... WHERE ...`.

### `backend/tests/test_kpi_aggregation.py`

Four unit tests, one per semantic branch:

| Test | Proves |
|---|---|
| `test_bounded_window_happy_path` | Inside-window rows aggregated; outside-window row ignored |
| `test_empty_window_returns_none` | Zero-match window returns `None`, not `{revenue: 0, ...}` (DELTA-05) |
| `test_no_bounds_returns_all_time` | `(None, None)` aggregates every matching row (delta assertion vs. shared db state) |
| `test_zero_or_negative_total_value_excluded` | Rows with `total_value <= 0` are filtered out (legacy `total_value > 0` preserved) |

All 4 tests pass; full non-rebuild backend suite (69 tests) green.

## How 08-02 / 08-03 Consume It

**08-02 (summary endpoint)** — run three aggregations in parallel:

```python
current, prev_period, prev_year = await asyncio.gather(
    aggregate_kpi_summary(session, start_date, end_date),
    aggregate_kpi_summary(session, prev_period_start, prev_period_end)
        if prev_period_start and prev_period_end else _none(),
    aggregate_kpi_summary(session, prev_year_start, prev_year_end)
        if prev_year_start and prev_year_end else _none(),
)
# current: dict — endpoint 200s with top-level fields from it
# prev_period / prev_year: dict | None — serialize to KpiSummaryComparison | None
```

**08-03 (chart endpoint)** — prior series aggregation per bucket still uses a bucketed SQL query (not this helper — this helper is window-level, not per-bucket). But 08-03's contract test for Phase 8 SC5 WILL call `aggregate_kpi_summary(session, prev_start, prev_end)` and assert its `total_revenue` equals the sum of the prior series buckets returned by the chart endpoint for the same bounds. This helper is the "truth oracle" for that contract test.

## Deviations from Plan

None — plan executed exactly as written.

### Out-of-Scope Observations (not fixed)

- `tests/test_rebuild_assert.py` (2 tests) fails at collection time when run without the `test_rebuild_seed.py` pre-seed step. This is a pre-existing Phase 7 rebuild-persistence harness that expects an explicit seed → docker rebuild → assert sequence documented in `07-06`; not a regression from this plan. Not fixing (scope boundary).

## Self-Check: PASSED

- `backend/app/services/__init__.py` FOUND
- `backend/app/services/kpi_aggregation.py` FOUND
- `backend/tests/test_kpi_aggregation.py` FOUND
- Commit `2217fbf` FOUND (feat 08-01 aggregate helper)
- Commit `10fcdcf` FOUND (test 08-01 unit tests)
- 4/4 unit tests pass; 69/69 non-rebuild backend tests pass
