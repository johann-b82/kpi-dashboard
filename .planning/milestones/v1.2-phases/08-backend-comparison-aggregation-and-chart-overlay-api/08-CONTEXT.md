---
phase: 08
phase_name: Backend — Comparison Aggregation and Chart Overlay API
milestone: v1.2
created: 2026-04-11
---

# Phase 8 — Context and Decisions

## Goal (from ROADMAP.md)

A curl-testable backend exists where the `summary` and `chart` endpoints return current-period figures plus two aligned baselines (previous period + previous year), computed in SQL and null-safe for missing windows — zero drift between card deltas and chart overlays.

## Scouting Findings (Corrections to REQUIREMENTS.md)

REQUIREMENTS.md drafted before I scouted the real codebase. Silent corrections to apply during execution:

- **API path:** REQUIREMENTS says `/api/dashboard/summary` / `/api/dashboard/chart`. Real paths are [`/api/kpis`](backend/app/routers/kpis.py#L16) and [`/api/kpis/chart`](backend/app/routers/kpis.py#L43). Use real paths; update REQUIREMENTS.md prose during Phase 8 execution.
- **Query params:** REQUIREMENTS says `from`/`to`. Real params are `start_date`/`end_date`. Stick with existing names.
- **Current summary response shape** ([KpiSummary](backend/app/routers/kpis.py#L16-L40)): flat Pydantic `{ total_revenue, avg_order_value, total_orders }`.
- **Current chart response shape** ([get_chart_data](backend/app/routers/kpis.py#L43-L69)): **bare `list[ChartPoint]`** — will need restructuring (breaking change).
- **Existing filter:** `WHERE total_value > 0` — comparison aggregation MUST apply the same filter to prior windows, or deltas become meaningless.
- **Chart already supports** `granularity=daily|weekly|monthly` (defaults monthly). Comparison series must respect the same granularity.
- **Frontend preset `thisYear`** ([getPresetRange](frontend/src/lib/dateUtils.ts#L13-L25)) currently resolves to `[startOfYear, endOfYear]` — a full calendar year including future dates. Semantically equivalent to YTD for aggregation (future rows don't exist), but the chart x-axis would show empty future buckets. **Flagged for Phase 9 — not Phase 8's problem**: Phase 9 may need to adjust preset bounds to `[startOfYear, today]` (and matching MTD/QTD for other presets).

## Gray Area Decisions

### A. Summary response shape — **ADDITIVE, non-breaking** (Claude default)

**Decision:** Extend [`KpiSummary`](backend/app/routers/kpis.py#L16-L40) with two nullable sibling objects:

```python
class KpiSummary(BaseModel):
    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int
    previous_period: KpiSummaryComparison | None = None
    previous_year: KpiSummaryComparison | None = None

class KpiSummaryComparison(BaseModel):
    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int
```

**Why:** Existing frontend code reading `total_revenue` etc. at the top level continues to work unchanged. New v1.2 code reads the new sibling fields. Zero coordination needed between backend deployment and frontend deployment; no atomic cutover.

**How to apply:** Top-level fields remain `current period`. `previous_period` and `previous_year` are `null` when the caller doesn't request them OR when the requested window yields zero matching rows (distinguishes "no data" from "legitimate zero" per DELTA-05).

---

### B. Chart response shape — **BREAKING, wrapped** (Claude default)

**Decision:** Restructure [`get_chart_data`](backend/app/routers/kpis.py#L43-L69) response from `list[ChartPoint]` to:

```python
class ChartResponse(BaseModel):
    current: list[ChartPoint]
    previous: list[ChartPoint] | None = None
```

**Why:** The bare-array shape has no room to carry a second series without ambiguity. Wrapping is the smallest breaking change and the response stays trivial. No "discriminator on each point" hacks.

**How to apply:**
- Phase 8 ships the new shape + updates `fetchChartData()` in [frontend/src/lib/api.ts](frontend/src/lib/api.ts#L75-L86) and its one consumer `RevenueChart` to read `.current` in the same commit. This is a small atomic change (~20 LOC) — acceptable for a breaking shape change.
- `previous` is `null` when caller does not request a comparison OR when the prior window has no data.
- No `comparison` metadata field on the response — frontend knows what it asked for.

---

### C. Previous-period window math — **FRONTEND-COMPUTED, backend-is-dumb** ⭐ user decision

**Decision:** The backend does not compute `previous_period` / `previous_year` bounds. The frontend sends them as explicit optional query params. The backend just runs the same generic aggregation against whatever bounds it receives.

**New optional query params on `/api/kpis` AND `/api/kpis/chart`:**
- `prev_period_start` (date, optional)
- `prev_period_end` (date, optional)
- `prev_year_start` (date, optional)
- `prev_year_end` (date, optional)

**Semantics:**
- If both `prev_period_start` AND `prev_period_end` are present, the backend computes the `previous_period` comparison object (summary endpoint) or `previous` series (chart endpoint, when `comparison=previous_period` is passed).
- If either param is missing (or both), the comparison object is `null`.
- Same logic independently for `prev_year_*`.
- The chart endpoint uses a new `comparison=previous_period|previous_year|none` query param to pick which prior window feeds its `previous` series. Default `none`. Summary endpoint always returns both (both are cheap — three aggregate queries total).

**Why:** Filter semantics live where the filter UI lives (frontend). Backend stays a single generic aggregator with zero date-math branching, trivial to unit-test. Phase 8 scope stays small and pure-SQL. Phase 9 computes the bounds — which is natural because Phase 9 already owns the preset filter state.

**How to apply in Phase 8:**
- Implement the new query params on both endpoints.
- Reuse the same underlying SQL aggregation helper for all three windows (current / prev_period / prev_year) — proves `SQL reuse, no drift` from Phase 8 SC5.
- Run the 3 aggregations in parallel via `asyncio.gather()` — 1 round-trip latency.
- Null-safety: if either `prev_*_start` or `prev_*_end` is missing → `None`. If both present but zero rows matched → `None` (not a zero-value object). `{total_revenue: 0, avg: 0, count: 0}` is reserved for legitimate zero-value prior windows.

**Deferred to Phase 9 (noted here so nobody re-asks the user):**
Phase 9 frontend will compute prior bounds using a scope-aware strategy:
- For `thisMonth` preset: `prev_period = [startOfPrevMonth, startOfPrevMonth + (today - startOfMonth)]` (MTD-matched prior month), `prev_year = same MTD window in prior year`.
- For `thisQuarter` preset: QTD-matched prior quarter + prior year.
- For `thisYear` preset: `prev_period = null` (see decision D below), `prev_year = [Jan 1 prev year, today - 1 year]` (YTD-matched prior year).
- For `allTime`: both `null`.
- For `custom`: same-length window immediately before (N-day arithmetic shift), and same date range in prior year.

---

### D. "Dieses Jahr" collapse handling — **`previous_period = null` for year scope** ⭐ user decision

**Decision:** When the current filter is "Dieses Jahr" (or any year-scale range), `previous_period = null` and only `previous_year` carries a value (YTD-matched prior year).

**User quote:** _"Für dieses Jahr immer das Vorjahr anzeigen in dem gleichen Zeitbereich, d.h. wenn heute der 11.4. ist, dann letztes Jahr bis 11.4.2025 summieren."_

**Why:** For year-scope filters, `previous_period` (immediate prior N days) mathematically equals `previous_year` (prior calendar year). Showing two identical badges looks like a bug. Nulling `previous_period` makes Phase 9's em-dash fallback (CARD-04) render cleanly: card shows `—` (greyscale, no badge) for "vs. Vorperiode" + `▲ +8,1 %` for "vs. Vorjahr".

**How to apply:**
- Phase 8: no special-casing — backend only runs what frontend asks for. When Phase 9 omits `prev_period_start/end` for the year preset, the backend returns `previous_period: null` naturally.
- Phase 9: the preset-to-bounds mapper emits `prev_period = undefined` for `thisYear`, so those query params are never sent. Backend's null-branch activates.
- Phase 9 Card must render the em-dash + tooltip when either baseline is null (CARD-04 already specifies this).

---

### E. Chart bucket alignment (for overlay rendering) — **BACKEND SHIFTS PRIOR TIMESTAMPS** (Claude default)

**Decision:** The `previous` series returned by `/api/kpis/chart` has its bucket timestamps **shifted to overlap the current range visually**. E.g., if current is April 2026 (daily buckets) and the prior window is March 2026, the prior series' timestamps are re-labeled April 1–30, 2026 (with March values attached). The frontend receives two series that share the same X axis out of the box.

**Why:**
- Alternative is a shared bucket index (0,1,2…) with separate label arrays — but Recharts' `LineChart` / `BarChart` composition is simpler when both series live on the same date-axis domain.
- The "timestamp lie" is scoped to a single endpoint response used only for visual overlay. Absolute dates for audit/reporting go through the summary endpoint, which doesn't shift.
- Phase 10 chart code becomes near-trivial: render two `<Line>` components against the same X axis, drop the second one's opacity to ≤40%.

**How to apply:**
- For each prior bucket, compute the offset between `prev_period_start` and `start_date` in whole buckets (at the current granularity), then shift prior timestamps forward by that offset.
- Bucket count mismatches (prior has fewer buckets than current): emit `null` for missing trailing/leading buckets (CHART-03). Recharts will render a gap.
- Add a regression test: summary `previous_period.total_revenue` MUST equal the sum of `previous` series buckets from the chart endpoint for the same bounds (Phase 8 SC5).

---

## Performance Notes

- All three aggregations (current / prev_period / prev_year) run in parallel via `asyncio.gather()`. Each is a single `SELECT SUM/AVG/COUNT` against `sales_records` with an existing B-tree index on `order_date` ([added in Phase 3](https://github.com/johann-b82/kpi-dashboard/commits/main)). Expected p99 latency: <100ms for 100k rows.
- Chart endpoint runs current + prior series (when comparison requested) in parallel. Same indexing story.
- No new DB schema or migrations. Phase 8 is pure application layer.

## Security / Correctness

- Query params `prev_period_start/end`, `prev_year_start/end`, and `comparison` all validated by FastAPI's existing Pydantic layer. No SQL injection surface (parameterized queries via SQLAlchemy Core, like the rest of the file).
- No auth added in v1.2 — consistent with v1.0/v1.1 pre-auth model (still deferred to Authentik / AUTH-01).

## Out of Scope (Phase 8 only)

- **Frontend changes beyond the atomic chart response shape migration.** Card delta rendering = Phase 9. Chart overlay visual = Phase 10. i18n strings = Phase 11.
- **Manual comparison-mode UI selector.** REQUIREMENTS Out-of-Scope item; chart `comparison` param is driven by filter scope, not a user toggle.
- **Retroactive data backfill or caching.** Each call recomputes. If the dashboard gets slow at 1M+ rows we can add a materialized view in a later milestone.
- **Changing the `thisYear` preset to YTD bounds.** That's a Phase 9 concern (frontend date util); Phase 8 just accepts whatever bounds it receives.

## Open Questions for Researcher

(None — Phase 8 is a narrow extension of an existing SQLAlchemy router. Stack is fully known. Research step can be skipped; plan-phase should go straight to planner.)

## Downstream Agent Contract

**gsd-phase-researcher:** Skip research for Phase 8. Context is complete; stack is known.

**gsd-planner:** Produce 3 plans matching the roadmap:
1. **08-01** — New query param layer + generic aggregation helper + unit tests for the SQL helper at multiple bound configurations. Must include a regression test for the "current = sum of chart buckets for same bounds" invariant.
2. **08-02** — `/api/kpis` endpoint integration: wire new params, return nullable `previous_period` / `previous_year` objects, integration tests covering all branches (both params present, one missing, zero-row window, normal case).
3. **08-03** — `/api/kpis/chart` endpoint integration: new `comparison` param + wrapped response shape + prior-series timestamp shifting + null-gap buckets. Include the atomic frontend API type + `fetchChartData()` + `RevenueChart` update so the app still builds. Include a contract test proving summary `previous_period.total_revenue` == sum of chart `previous` buckets for the same bounds.

**Plans MUST NOT:**
- Introduce new Python date libraries (stick with `datetime` / SQLAlchemy `func.date_trunc` and interval math).
- Touch frontend files beyond the chart API type + `fetchChartData()` + `RevenueChart` update in plan 08-03.
- Add auth, caching, or rate limiting.
- Change the existing `start_date`/`end_date`/`granularity` semantics.
