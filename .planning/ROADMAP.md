# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Branding & Settings** — Phases 4–7 (shipped 2026-04-11) — [archive](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Period-over-Period Deltas** — Phases 8–11 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–3) — SHIPPED 2026-04-11</summary>

- [x] Phase 1: Infrastructure and Schema (2/2 plans) — completed 2026-04-10
- [x] Phase 2: File Ingestion Pipeline (4/4 plans) — completed 2026-04-10
- [x] Phase 3: Dashboard Frontend (4/4 plans) — completed 2026-04-11

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 Branding & Settings (Phases 4–7) — SHIPPED 2026-04-11</summary>

- [x] Phase 4: Backend — Schema, API, and Security (6/6 plans) — completed 2026-04-11
- [x] Phase 5: Frontend Plumbing — ThemeProvider and NavBar (3/3 plans) — completed 2026-04-11
- [x] Phase 6: Settings Page and Sub-components (4/4 plans) — completed 2026-04-11
- [x] Phase 7: i18n Integration and Polish (6/6 plans) — completed 2026-04-11

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
Requirements: [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

</details>

### 🚧 v1.2 Period-over-Period Deltas (In Progress)

**Milestone Goal:** Show at-a-glance growth signals on the dashboard — each summary card gains two delta badges (vs. previous period + vs. prior year), and the chart gains a ghosted prior-period overlay. All null-safe for "Gesamter Zeitraum" and fresh installs.

- [ ] **Phase 8: Backend — Comparison Aggregation and Chart Overlay API** - Dual-baseline aggregation: summary endpoint returns `previous_period` + `previous_year` objects, chart endpoint gains `comparison` query param with aligned `previous_series`
- [ ] **Phase 9: Frontend — KPI Card Dual Deltas** - Summary cards render two compact delta badges (vs. Vorperiode + vs. Vorjahr) with up/down arrows, locale-aware percentages, and null-baseline em-dash fallbacks
- [ ] **Phase 10: Frontend — Chart Prior-Period Overlay** - `RevenueChart` renders a ghosted second series at reduced opacity with updated legend; default mode driven by selected date filter scope
- [ ] **Phase 11: i18n, Contextual Labels, and Polish** - Full DE/EN parity for new delta strings in informal "du" tone; contextual period labels ("vs. März", "vs. Q1", "vs. Vorwoche") locale-formatted; end-to-end human verification

## Phase Details

### Phase 8: Backend — Comparison Aggregation and Chart Overlay API
**Goal**: A curl-testable backend exists where the `summary` and `chart` endpoints return current-period figures plus two aligned baselines (previous period + previous year), computed in SQL and null-safe for missing windows — zero drift between card deltas and chart overlays
**Depends on**: Phase 7 (v1.1 shipped stack)
**Requirements**: DELTA-01, DELTA-02, DELTA-03, DELTA-04, DELTA-05, CHART-01, CHART-02, CHART-03
**Success Criteria** (what must be TRUE):
  1. `GET /api/dashboard/summary?from=2026-04-01&to=2026-04-30` returns a response object containing `current`, `previous_period`, and `previous_year` keys; each comparison object has the same shape as `current` (`total_revenue`, `avg_order_value`, `total_orders`) or is `null` when no comparable window exists
  2. `GET /api/dashboard/summary` with no date bounds ("Gesamter Zeitraum") returns both `previous_period` and `previous_year` as `null` — no implicit baseline is computed
  3. `GET /api/dashboard/summary` for a window that has a valid prior-year offset but zero rows in `sales_records` returns `previous_year: null` (not a zero-value object) — null distinguishes "no data" from "legitimate zero"
  4. `GET /api/dashboard/chart?comparison=previous_period` returns a response with a `previous_series` array whose bucket keys align with the current series; partial prior data emits `null` values for missing buckets (not fabricated zeros)
  5. Integration test asserts that the aggregate values returned in `summary.previous_period` equal the sum of bucket values in `chart?comparison=previous_period.previous_series` for the same filter — proving SQL reuse, no drift
**Plans:** TBD
  - [x] 08-01-PLAN.md — SQL window helpers (`previous_period`, `previous_year` interval math; leap-year safe) + unit tests
  - [x] 08-02-PLAN.md — Summary endpoint: extend response schema, wire comparison aggregation, null-safety branches, integration tests for SC 1–3
  - [ ] 08-03-PLAN.md — Chart endpoint: `comparison` query param, `previous_series` alignment with null-gap buckets, integration tests for SC 4–5

### Phase 9: Frontend — KPI Card Dual Deltas
**Goal**: Users see at-a-glance growth signals on every summary card — two compact delta badges (vs. Vorperiode, vs. Vorjahr) render below each value with up/down arrows, semantic colors, locale-correct percentage formatting, and an em-dash fallback (plus tooltip) whenever no baseline exists
**Depends on**: Phase 8
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04, CARD-05
**Success Criteria** (what must be TRUE):
  1. Each of the 3 summary cards (revenue, avg order value, total orders) renders two delta badges stacked below the main value — one labeled "vs. Vorperiode" and one labeled "vs. Vorjahr" — without breaking the existing responsive grid at 1080p and 1440p
  2. A positive delta renders an up-triangle `▲` with the semantic positive color (`--color-primary`) and a negative delta renders a down-triangle `▼` with `--color-destructive`; badge format is `▲ +12,4 %` in DE and `▲ +12.4%` in EN (always one decimal place)
  3. When the backend returns a `null` comparison (Gesamter Zeitraum, fresh install, first-month, divide-by-zero), the badge renders as a grayscale em-dash `—`; hovering the badge shows a tooltip reading "keine Vergleichsperiode verfügbar" in DE or "no comparison period available" in EN
  4. Each delta badge shows a muted secondary label contextual to the selected date filter — e.g., "vs. März" for "Dieses Jahr", "vs. Q1" for "Dieses Quartal", "vs. Vorwoche" for a 1-week custom range — sourced from the filter scope, not hard-coded
  5. Cards still update live on date filter change and on new upload (existing TanStack Query invalidation path) — delta badges re-render with the new baselines without full page reload
**Plans:** TBD
  - [ ] 09-01-PLAN.md — API types + `fetchSummary` extension for `previous_period`/`previous_year`; delta calculation util (`computeDelta`, null-safe, divide-by-zero branch) with unit tests
  - [ ] 09-02-PLAN.md — `DeltaBadge` sub-component: arrow glyph, semantic color, locale-aware `formatPercent`, em-dash fallback, tooltip wiring
  - [ ] 09-03-PLAN.md — `SummaryCard` integration: mount two `DeltaBadge` instances per card, contextual secondary labels from filter scope, human verification checkpoint at 1080p + 1440p
**UI hint**: yes

### Phase 10: Frontend — Chart Prior-Period Overlay
**Goal**: The revenue chart visually surfaces the prior period as a ghosted second series aligned to the current X axis — users see trend deltas without leaving the dashboard, and the legend labels both series with contextual strings
**Depends on**: Phase 9
**Requirements**: CHART-04, CHART-05, CHART-06
**Success Criteria** (what must be TRUE):
  1. `RevenueChart` renders the `previous_series` from `GET /api/dashboard/chart?comparison=…` as a second `Line`/`Bar` layer at ≤40% opacity, visually subordinated to the primary series and sharing the same X axis
  2. The chart legend shows both series with contextual labels sourced from the date filter scope (e.g., "Umsatz 2026" / "Umsatz 2025" for year-over-year; "Umsatz April" / "Umsatz März" for month-over-month)
  3. The default chart comparison mode is `previous_period` for short ranges (≤3 months) and `previous_year` for year-scale ranges — driven by the selected filter, with no manual UI toggle
  4. When the backend returns `previous_series` containing `null` buckets (partial prior data), Recharts renders visual gaps — no fabricated zero line/bar is drawn across the missing range
  5. Switching date filters re-fetches the chart with the correct `comparison` query param and both series update in lock-step with the summary cards — no stale overlay from the previous filter
**Plans:** TBD
  - [ ] 10-01-PLAN.md — API types + `fetchChart` extension for `comparison` param; filter-scope → comparison-mode selector util with unit tests
  - [ ] 10-02-PLAN.md — `RevenueChart` Recharts composition: second Line/Bar at reduced opacity, null-gap handling, updated legend with contextual labels, human verification checkpoint
**UI hint**: yes

### Phase 11: i18n, Contextual Labels, and Polish
**Goal**: Every new UI string — badge labels, tooltips, secondary labels, chart legend — ships in both DE and EN in informal "du" tone with full locale parity; contextual period labels ("März", "Q1", "Vorwoche") are locale-formatted via `Intl.DateTimeFormat` with no new dependencies; end-to-end human verification signs off the full milestone
**Depends on**: Phase 10
**Requirements**: I18N-DELTA-01, I18N-DELTA-02
**Success Criteria** (what must be TRUE):
  1. All new v1.2 strings added in Phases 9–10 exist in both `frontend/src/locales/en.json` and `frontend/src/locales/de.json` — verified by the same host-side locale parity set-diff check used in Phase 7 (exit 0, no missing keys)
  2. German strings are in informal "du" tone consistent with v1.1; loanwords (Dashboard, Upload, KPI) preserved per D-18; tooltips and em-dash fallback copy reviewed for native-speaker fluency
  3. Period labels ("März" / "March", "Q1", "Vorwoche" / "previous week") are generated via `Intl.DateTimeFormat` with the active i18n language — no new date library added, no hard-coded strings in component source
  4. Switching language via the NavBar `LanguageToggle` re-renders all card delta badges, tooltips, and chart legend entries in the new locale without a hard refresh
  5. Human verification checkpoint passes end-to-end: upload `sample_export.csv`, cycle through all 4 preset date filters ("Dieses Jahr", "Dieses Quartal", "Diesen Monat", "Gesamter Zeitraum"), confirm card deltas + chart overlay + contextual labels behave correctly in both DE and EN, and "Gesamter Zeitraum" shows em-dashes everywhere
**Plans:** TBD
  - [ ] 11-01-PLAN.md — EN locale keys pass: enumerate every new string from Phases 9–10, add to `en.json`, update components to use `t()` calls
  - [ ] 11-02-PLAN.md — DE locale keys pass: full informal "du" translation, loanword audit, period label `Intl.DateTimeFormat` util with unit tests
  - [ ] 11-03-PLAN.md — End-to-end human verification checkpoint: all 4 date filters × 2 languages × dual delta badges + chart overlay; milestone sign-off
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure and Schema | v1.0 | 2/2 | Complete | 2026-04-10 |
| 2. File Ingestion Pipeline | v1.0 | 4/4 | Complete | 2026-04-10 |
| 3. Dashboard Frontend | v1.0 | 4/4 | Complete | 2026-04-11 |
| 4. Backend — Schema, API, and Security | v1.1 | 6/6 | Complete | 2026-04-11 |
| 5. Frontend Plumbing — ThemeProvider and NavBar | v1.1 | 3/3 | Complete | 2026-04-11 |
| 6. Settings Page and Sub-components | v1.1 | 4/4 | Complete | 2026-04-11 |
| 7. i18n Integration and Polish | v1.1 | 6/6 | Complete | 2026-04-11 |
| 8. Backend — Comparison Aggregation and Chart Overlay API | v1.2 | 0/3 | Not started | - |
| 9. Frontend — KPI Card Dual Deltas | v1.2 | 0/3 | Not started | - |
| 10. Frontend — Chart Prior-Period Overlay | v1.2 | 0/2 | Not started | - |
| 11. i18n, Contextual Labels, and Polish | v1.2 | 0/3 | Not started | - |
