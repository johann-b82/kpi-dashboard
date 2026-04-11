# Requirements — KPI Light v1.2 Period-over-Period Deltas

**Milestone:** v1.2 Period-over-Period Deltas
**Started:** 2026-04-11
**Goal:** Show at-a-glance growth signals on the dashboard — each summary card gains two delta badges (vs. previous period + vs. prior year), and the chart gains a ghosted prior-period overlay.

---

## v1.2 Requirements

### Backend — Comparison Aggregation

- [x] **DELTA-01**: `GET /api/dashboard/summary` returns — in addition to the existing current-period fields — two parallel comparison objects `previous_period` and `previous_year`, each with the same schema (`total_revenue`, `avg_order_value`, `total_orders`) or `null` when no comparable window exists.
- [x] **DELTA-02**: The backend derives `previous_period` as the same-length window immediately preceding the current `[from, to]` filter (e.g., `[Mar 1, Mar 31]` for a current filter of `[Apr 1, Apr 30]`). Computed via SQL `date_trunc` / interval math, not Python date arithmetic, to stay time-zone safe against the app's UTC Postgres instance.
- [x] **DELTA-03**: The backend derives `previous_year` as the calendar-matched window exactly one year before the current `[from, to]` filter (e.g., `[Apr 1 2025, Apr 30 2025]`). Leap-year edge cases (Feb 29 → Feb 28) are handled without throwing.
- [x] **DELTA-04**: When the current filter is "Gesamter Zeitraum" (no explicit bounds), `previous_period` and `previous_year` are both `null` — no implicit baseline computed.
- [x] **DELTA-05**: When the computed prior window contains no rows in `sales_records`, the corresponding comparison object is `null` (not a zero-value object). Frontend distinguishes "no data" from "legitimate zero".

### Backend — Chart Overlay

- [ ] **CHART-01**: `GET /api/dashboard/chart` gains a `comparison=previous_period|previous_year|none` query parameter (default `none` for backwards compatibility). When not `none`, the response includes a second series `previous_series` with the same bucket keys as the current series, time-shifted to align visually with the current range.
- [x] **CHART-02**: The comparison series in CHART-01 reuses the same aggregation SQL as DELTA-02/DELTA-03 for consistency — no drift between card deltas and chart overlays.
- [ ] **CHART-03**: When `previous_series` has fewer buckets than the current range (partial prior data), missing buckets are emitted as `null` values so Recharts renders gaps instead of fabricating zeros.

### Frontend — KPI Card Deltas

- [ ] **CARD-01**: Each of the 3 existing summary cards (revenue, avg order value, total orders) renders two compact delta badges below the main value: one for `vs. Vorperiode` and one for `vs. Vorjahr`.
- [ ] **CARD-02**: Delta badges show an up-triangle `▲` (green, `--color-primary` or semantic positive token) for positive deltas and a down-triangle `▼` (red, `--color-destructive`) for negative deltas.
- [ ] **CARD-03**: The badge format is `▲ +12,4 %` / `▼ −8,1 %` — German locale uses comma decimal separator, EN locale uses period decimal separator, always one decimal place.
- [ ] **CARD-04**: When the comparison baseline is `null` (no prior data, "Gesamter Zeitraum", first month of data, or divide-by-zero), the badge renders as a grayscale em-dash `—` with a tooltip explaining *why* (`keine Vergleichsperiode verfügbar` / `no comparison period available`).
- [ ] **CARD-05**: Each delta badge is accompanied by a muted secondary label showing what it's comparing to, contextual to the selected date filter — e.g., "vs. März" when the filter is "Dieses Jahr", "vs. Q1" when it's "Dieses Quartal", "vs. Vorwoche" when the filter is a 1-week custom range.

### Frontend — Chart Overlay

- [ ] **CHART-04**: `RevenueChart` renders the `previous_series` from CHART-01 as a second line/bar at reduced opacity (≤40%) below the primary series. Both series share the same X axis; the prior series is visually subordinated.
- [ ] **CHART-05**: The chart legend updates to show both series with their contextual labels (e.g., "Umsatz 2026" and "Umsatz 2025" for year-over-year).
- [ ] **CHART-06**: The default chart comparison mode is `previous_period`. No explicit UI toggle in v1.2 — the mode is driven by the selected date filter scope (short ranges → previous period, year-scale ranges → previous year). A future milestone can expose a manual toggle.

### Frontend — i18n

- [ ] **I18N-DELTA-01**: All new UI strings (badge labels, tooltips, secondary labels, chart legend entries) are added to both `frontend/src/locales/en.json` and `frontend/src/locales/de.json` in informal "du" tone. Locale parity is verified via the same set-diff check used in Phase 7.
- [ ] **I18N-DELTA-02**: Period labels ("März", "Q1", "Vorwoche") are locale-formatted. Use the existing i18next pattern — no new date library added unless a phase plan justifies it; `Intl.DateTimeFormat` is the fallback.

---

## Traceability

| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| DELTA-01 | Summary endpoint returns comparison objects | Phase 8 | Not started |
| DELTA-02 | Previous-period SQL window | Phase 8 | Not started |
| DELTA-03 | Calendar-matched prior-year window | Phase 8 | Not started |
| DELTA-04 | Null comparisons for "Gesamter Zeitraum" | Phase 8 | Not started |
| DELTA-05 | Null distinguishes no-data from zero | Phase 8 | Not started |
| CHART-01 | Chart endpoint `comparison` param + `previous_series` | Phase 8 | Not started |
| CHART-02 | Chart aggregation reuses card SQL | Phase 8 | Not started |
| CHART-03 | Null buckets for partial prior data | Phase 8 | Not started |
| CARD-01 | Dual delta badges on all 3 cards | Phase 9 | Not started |
| CARD-02 | Up/down arrow + positive/negative color | Phase 9 | Not started |
| CARD-03 | Locale-aware percentage formatting | Phase 9 | Not started |
| CARD-04 | Em-dash + tooltip for null baselines | Phase 9 | Not started |
| CARD-05 | Contextual secondary labels (vs. März, vs. Q1) | Phase 9 | Not started |
| CHART-04 | Ghosted prior-period series on RevenueChart | Phase 10 | Not started |
| CHART-05 | Legend shows both series | Phase 10 | Not started |
| CHART-06 | Default mode = previous_period | Phase 10 | Not started |
| I18N-DELTA-01 | Full DE/EN parity for new strings | Phase 11 | Not started |
| I18N-DELTA-02 | Locale-aware period labels | Phase 11 | Not started |

**Phase column** is filled in by the roadmapper.

---

## Out of Scope (v1.2)

- **Manual comparison mode toggle** (user-selectable "vs. Vorperiode | vs. Vorjahr" dropdown) — default is driven by filter scope; manual override is a v1.3+ polish item.
- **Per-KPI custom comparison windows** — e.g. "compare revenue to last quarter but orders to last month". Out of scope; all 3 cards share the same prior window.
- **Sparklines or mini-trend graphs inside cards** — the chart overlay covers the visual-trend use case. No inline graphics on cards.
- **Exported CSV with comparison columns** (DASH-07) — remains deferred.
- **Auth-scoped deltas** ("my team's revenue") — blocked on Authentik (AUTH-01).
