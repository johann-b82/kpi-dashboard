---
phase: 08-backend-comparison-aggregation-and-chart-overlay-api
verified: 2026-04-11T00:00:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification: []
---

# Phase 8: Backend — Comparison Aggregation and Chart Overlay API — Verification Report

**Phase Goal:** A curl-testable backend where `summary` and `chart` endpoints return current-period figures plus two aligned baselines (previous period + previous year), computed in SQL, null-safe for missing windows, with zero drift between card deltas and chart overlays.

**Verified:** 2026-04-11
**Status:** PASSED (with one minor doc-drift FLAG, non-blocking)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria, reframed against real API paths `/api/kpis`)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Summary endpoint returns current + nullable `previous_period` + nullable `previous_year` siblings with matching schema | VERIFIED | `schemas.py:48-53` KpiSummary with both nullable siblings; `kpis.py:71-77` return wiring |
| 2 | "Gesamter Zeitraum" (no bounds + no prev_* params) → both comparison objects null | VERIFIED | `kpis.py:54-56` — half-specified window returns None; test `test_summary_baseline_no_prev_params` |
| 3 | Prior window with zero rows → comparison is `null`, not zero-value object (DELTA-05) | VERIFIED | `kpi_aggregation.py:61-62` early-returns `None` when `total_orders == 0`; test `test_summary_prev_window_with_zero_rows_returns_null_not_zero_object` |
| 4 | `/api/kpis/chart?comparison=previous_period` returns `previous` series aligned to current X-domain with `null` for missing buckets | VERIFIED | `kpis.py:155-166` positional alignment + null trailing; tests `test_chart_with_previous_period_returns_aligned_series` + `test_chart_partial_prior_data_emits_nulls` |
| 5 | Summary `previous_period.total_revenue` == sum(chart `previous` buckets) for same bounds — SQL reuse, no drift | VERIFIED | Both endpoints route through helpers with the identical `WHERE total_value > 0` filter; `test_chart_prior_sum_equals_summary_previous_period` is the exact-Decimal SC5 contract test |

**Score:** 5/5 truths verified

### Required Artifacts (Levels 1-4)

| Artifact | Exists | Substantive | Wired | Data Flows | Status |
|----------|--------|-------------|-------|------------|--------|
| `backend/app/services/kpi_aggregation.py` | Yes | Yes (68 lines, null-safe, `>0` filter, bounds optional) | Yes (imported by `routers/kpis.py`) | Yes (real async DB query) | VERIFIED |
| `backend/app/schemas.py` (KpiSummary + KpiSummaryComparison + ChartResponse + ChartPoint nullable) | Yes | Yes | Yes (imported by `routers/kpis.py`; `ChartResponse` used as `response_model`) | Yes | VERIFIED |
| `backend/app/routers/kpis.py` (new params + chart overlay) | Yes | Yes (4 `prev_*` params on summary; `comparison` + `prev_start`/`prev_end` on chart; positional shift) | Yes | Yes | VERIFIED |
| `backend/tests/test_kpi_aggregation.py` | Yes | Yes (4 unit tests) | Yes (pytest collects) | n/a | VERIFIED |
| `backend/tests/test_kpi_endpoints.py` (expanded) | Yes | Yes (5 new summary tests: baseline, both-populated, half-specified, zero-rows, negative-rows) | Yes | n/a | VERIFIED |
| `backend/tests/test_kpi_chart.py` | Yes | Yes (4 chart tests incl. SC5 contract) | Yes | n/a | VERIFIED |
| `frontend/src/lib/api.ts` (ChartResponse + fetchChartData wrapped shape) | Yes | Yes (lines 69-72 ChartResponse, lines 91-102 fetchChartData) | Yes (imported by RevenueChart) | Yes | VERIFIED |
| `frontend/src/components/dashboard/RevenueChart.tsx` (consumes `.current`) | Yes | Yes (line 91 `data?.current ?? []`) | Yes | Yes | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `routers/kpis.py::get_kpi_summary` | `services/kpi_aggregation.aggregate_kpi_summary` | direct `await aggregate_kpi_summary(db, ...)` for all 3 windows | WIRED | Single source of truth, SC5 (no drift) preserved |
| `routers/kpis.py::get_chart_data` | `_bucketed_series` (current) + `_bucketed_series` (prior) | sequential awaits (see deviation note) | WIRED | Same `WHERE total_value > 0` filter as aggregation helper |
| `routers/kpis.py::get_chart_data` | response-level positional alignment | lines 155-166 — dates rewritten to current X-domain, missing trailing → `None` | WIRED | CHART-01, CHART-03 satisfied |
| `frontend/src/lib/api.ts::fetchChartData` | `ChartResponse` type | return `Promise<ChartResponse>` | WIRED | Type-level migration complete |
| `RevenueChart.tsx` | `fetchChartData` | `data?.current ?? []` destructure | WIRED | Atomic frontend migration prevents broken main |

### Context Decision Compliance

| Decision | Requirement | Status | Evidence |
|----------|-------------|--------|----------|
| A — Summary additive, non-breaking | Top-level current fields preserved + nullable siblings | HONORED | `schemas.py:48-53` extends KpiSummary in place; legacy consumers unaffected |
| B — Chart wrapped, breaking, atomic migration | Backend ships `{current, previous}`; frontend adapter + RevenueChart migrated in same phase | HONORED | All 4 files migrated; summary documents 4 commits; build green |
| C — Backend-dumb prior bounds | No backend date math; both `prev_*_start` and `prev_*_end` required for comparison to populate | HONORED | `kpis.py:52-56` half-specified → None; `kpis.py:141-145` same gate on chart endpoint |
| D — Year-scope `previous_period=null` collapse | No backend branching; Phase 9 simply omits params | HONORED (naturally) | Backend returns None when params absent — no special-casing |
| E — Prior timestamps shifted to current X-domain | Prior buckets relabeled with current dates | HONORED | `kpis.py:159-165` rewrites `date=current_date.isoformat()` for each prior bucket |
| Performance note — parallel via `asyncio.gather` | **INTENTIONAL DEVIATION** | HONORED with justification | Sequential awaits used — SQLAlchemy AsyncSession is not safe for concurrent `execute()` on a single connection. Documented in 08-02 + 08-03 SUMMARY + code docstrings. Latency impact <100ms. Safer + more robust than gather on shared session. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `get_kpi_summary` | `current`, `prev_period`, `prev_year` | `aggregate_kpi_summary` → `SELECT SUM/AVG/COUNT FROM sales_records WHERE total_value > 0 AND order_date BETWEEN ...` | Yes — real SQLAlchemy query against Postgres | FLOWING |
| `get_chart_data` | `current_rows`, `prior_rows` | `_bucketed_series` → `SELECT date_trunc(...), SUM(total_value) FROM sales_records ...` | Yes — real bucketed query | FLOWING |
| `RevenueChart` | `rows` | `fetchChartData(...)` via TanStack Query; consumes `data?.current` | Yes — real backend fetch | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command / Check | Result | Status |
|----------|-----------------|--------|--------|
| Aggregation helper has `WHERE total_value > 0` filter | `kpi_aggregation.py:53` | Present | PASS |
| Aggregation helper returns None for zero-row window | `kpi_aggregation.py:61-62` | `if (row.total_orders or 0) == 0: return None` | PASS |
| Summary requires both `prev_*_start/end` | `kpis.py:54-56` | `if s is None or e is None: return None` | PASS |
| Chart requires both `prev_start/end` + `comparison != "none"` | `kpis.py:141-145` | Three-part gate | PASS |
| Chart null trailing buckets (CHART-03) | `kpis.py:162-165` | `ChartPoint(date=..., revenue=None)` | PASS |
| Chart prior date rewriting (Decision E) | `kpis.py:160-161` | `date=current_date.isoformat()` | PASS |
| Contract test enforces SC5 Decimal equality | `test_kpi_chart.py:191 test_chart_prior_sum_equals_summary_previous_period` | Present | PASS |
| Frontend build compiles against new ChartResponse | 08-03 SUMMARY notes `npm run build` + `tsc -b` green | Reported green | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DELTA-01 | 08-02 | Summary returns `previous_period` + `previous_year` siblings or null | SATISFIED | `schemas.py:48-53`, `kpis.py:71-77` |
| DELTA-02 | 08-02 | Previous-period window derivation via SQL | SATISFIED (via decision C — frontend sends bounds, backend runs same SQL helper) | `kpi_aggregation.py` single helper reused; prior-period window SQL is identical to current |
| DELTA-03 | 08-02 | Prior-year window handling (leap-year safe) | SATISFIED (via decision C) | Same — backend is bounds-agnostic; no leap-year math needed in backend; Phase 9 will handle calendar math |
| DELTA-04 | 08-02 | Null comparisons for "Gesamter Zeitraum" | SATISFIED | `kpis.py:54-56` half-specified → None; test `test_summary_baseline_no_prev_params` |
| DELTA-05 | 08-01, 08-02 | Null vs. zero-value distinction | SATISFIED | `kpi_aggregation.py:61-62`; test `test_summary_prev_window_with_zero_rows_returns_null_not_zero_object` |
| CHART-01 | 08-03 | `comparison` query param + aligned `previous` series | SATISFIED | `kpis.py:116` + alignment lines 155-166; test `test_chart_with_previous_period_returns_aligned_series` |
| CHART-02 | 08-03 | Chart reuses card SQL (no drift) | SATISFIED | Both endpoints carry the same `WHERE total_value > 0` filter; SC5 contract test enforces Decimal equality |
| CHART-03 | 08-03 | Null buckets for partial prior data | SATISFIED | `kpis.py:162-165` emits `revenue=None`; test `test_chart_partial_prior_data_emits_nulls` |

All 8 in-scope requirements satisfied. No orphaned requirements for this phase.

**Doc-drift note (non-blocking):** `.planning/REQUIREMENTS.md` checklist marks DELTA-01..05 + CHART-01..03 as `[x]` (lines 13-23) but the traceability table at lines 50-57 still reads "Not started". These should be reconciled to "Complete" to match the checklist.

**DELTA-02 / DELTA-03 nuance:** The literal requirement wording says "the backend derives" the previous-period/prior-year windows. CONTEXT decision C (user-approved) inverted this: the backend is bounds-agnostic, Phase 9 frontend computes the bounds. The SQL helper used by the backend is identical for current and comparison windows, which honors the requirement's spirit (leap-year safe, SQL-based, timezone-neutral) even though the date-math location moved. REQUIREMENTS.md prose should eventually be updated to match the decision, per the Scouting-Findings section of 08-CONTEXT.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/routers/kpis.py` | 45-49, 138-140 | Documented intentional deviation (sequential awaits vs. plan's `asyncio.gather`) | Info | Not a stub — correctness fix. Justified in code docstring + 08-02/08-03 SUMMARY. Non-issue. |
| `backend/app/routers/kpis.py` | 155-166 | Positional alignment algorithm has known limitation for sparse-prior data (prior has more buckets than current → excess dropped; prior has fewer → trailing nulls) | Warning | Documented limitation. Not a stub. Contract test uses matched bucket counts. See "Known Limitation Assessment" below. |

No blockers. No TODOs, no placeholders, no empty implementations, no unhandled edge cases left silent.

### Known Limitation Assessment — Sparse-Prior Bucket Alignment (from 08-03 SUMMARY)

**The limitation:** `_bucketed_series` returns only buckets that have data. When the prior window has more distinct non-empty buckets than the current window, positional alignment drops the excess. When the prior has fewer, trailing buckets render as `null` gaps (the intended CHART-03 path).

**Is it a silent bug?** No. It is:
1. Documented in the code (implicit via the algorithm) and explicitly called out in 08-03 SUMMARY "Known limitation" + "Deviations from Plan" sections.
2. Flagged forward for Phase 10 to revisit if visual drift surfaces, with a named mitigation (dense-bucket generation, ~20 LOC, isolated change).
3. Not exercised by the contract test (matched seed counts ensure data preservation), but this is a deliberate and disclosed choice.

**Does it block Phase 9?** No. Phase 9 (KPI Card Dual Deltas) consumes only the summary endpoint, which does not use `_bucketed_series`. The summary path is unaffected.

**Does it block Phase 10?** Potentially a low-risk soft-block. Phase 10 wires the ghosted overlay series from `data.previous` into `RevenueChart`. If Phase 9's preset-to-bounds mapper ships equal-width windows (which decision C expects — same-length prior period, calendar-matched prior year), the limitation never triggers and Phase 10 proceeds cleanly. If visual drift surfaces during Phase 10 human verification, the documented fix is a small, isolated refactor to `_bucketed_series` — the contract test will act as a regression guard. **Recommendation:** Phase 10 planner should add a line-item to validate overlay alignment against multiple preset scopes during human verification, and keep the dense-bucket fallback patch ready.

### Human Verification Required

None blocking for phase completion. The backend is curl-testable (confirmed in 08-03 SUMMARY by manual curl returning `{"current":[...],"previous":null}`). Visual overlay verification is explicitly Phase 10's responsibility.

### Gaps Summary

No gaps blocking Phase 8 goal achievement. The phase delivers:

1. A working `aggregate_kpi_summary` helper with unit tests covering bounded, unbounded, empty, and zero/negative-value paths (4 tests).
2. A fully null-safe summary endpoint with 5 new integration tests covering baseline, both-populated, half-specified, zero-row, and negative-row branches.
3. A wrapped chart endpoint with 4 integration tests including the Phase 8 SC5 contract test proving SQL reuse via exact-Decimal equality.
4. An atomic frontend migration (ChartResponse type + fetchChartData + RevenueChart) keeping `main` buildable.
5. All 5 CONTEXT decisions honored (additive summary, wrapped breaking chart, backend-dumb bounds, year-scope natural null, prior-timestamp shifting).

One intentional architectural deviation (sequential awaits vs. `asyncio.gather`) is well-documented and correct — SQLAlchemy AsyncSession concurrency safety is the right priority. The sparse-prior bucket limitation is a disclosed, flagged-forward known-issue, not a silent bug.

**Doc-drift flag (non-blocking):** REQUIREMENTS.md traceability table (lines 50-57) still says "Not started" for DELTA/CHART Phase 8 rows while the checklist above (lines 13-23) is `[x]`. Trivial sync needed.

---

**Verified by:** Claude (gsd-verifier, Opus 4.6 1M)
**Verified on:** 2026-04-11
