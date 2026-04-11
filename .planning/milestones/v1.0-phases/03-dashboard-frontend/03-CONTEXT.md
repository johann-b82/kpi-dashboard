# Phase 3: Dashboard Frontend - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the KPI query API and interactive React dashboard: summary metric cards, a time-series revenue chart with granularity and chart-type toggles, date range filtering, a shared top navigation bar with data freshness indicator, and client-side routing between dashboard and upload pages. Auto-refresh dashboard data after upload via TanStack Query invalidation.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Layout
- **D-01:** Top navigation bar with "Dashboard" and "Upload" links. Requires adding a client-side router (e.g., react-router).
- **D-02:** Dashboard is the landing page (default route `/`). Upload page moves to `/upload`.
- **D-03:** Language toggle (existing LanguageToggle component) moves into the shared top nav bar.
- **D-04:** Data freshness indicator ("Last updated: [timestamp]") displayed in the top nav bar, visible on every page. This satisfies DASH-04 globally rather than dashboard-only.

### KPI Metric Cards
- **D-05:** Three summary cards only: Total Revenue, Average Order Value, Total Orders. No additional metrics in v1.
- **D-06:** Zero-value orders (total_value = 0) are excluded from all KPI calculations. "Total orders" counts only orders where total_value > 0.
- **D-07:** "Average order value" = arithmetic mean of total_value where total_value > 0. Consistent with revenue exclusion filter.

### Chart Visualization
- **D-08:** Revenue time-series chart with user-selectable granularity toggle: daily, weekly, monthly.
- **D-09:** Chart type toggle between line chart and bar chart. Line chart is the default. (Pulls DASH-05 from v2 into v1 scope.)
- **D-10:** Chart data uses the same zero-value exclusion filter as the metric cards (D-06).

### Date Range Filter
- **D-11:** Combined date filter: four preset quick-range buttons plus a custom calendar date picker (from/to).
- **D-12:** Preset ranges: "This month," "This quarter," "This year," "All time."
- **D-13:** Default date range on initial load: current calendar year.
- **D-14:** Date filter applies to both the summary cards and the chart simultaneously.

### Carried Forward
- **CF-01:** Bilingual UI (DE/EN) with react-i18next — from Phase 2 D-18.
- **CF-02:** TanStack Query `invalidateQueries` after upload for auto-refresh — from STATE.md key decisions.
- **CF-03:** shadcn/ui component library, Tailwind v4 CSS-first config — from Phase 2.
- **CF-04:** Recharts for charting — already installed in package.json.

### Claude's Discretion
- Router library choice (react-router, wouter, TanStack Router)
- Calendar date picker component (shadcn date picker, react-day-picker, etc.)
- Granularity toggle UI (segmented control, button group, dropdown)
- Chart type toggle UI (icon buttons, segmented control)
- API endpoint design for KPI queries (single endpoint with query params vs multiple endpoints)
- Responsive breakpoint strategy for 1080p+ (INFR-03)
- Quick-range button placement relative to the calendar picker

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Documentation
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-04 (dashboard), DASH-05 (chart toggle, pulled into v1), INFR-03 (responsive layout)
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 criteria)
- `CLAUDE.md` — Technology stack with exact versions, Recharts rationale, TanStack Query patterns

### Prior Phase Artifacts
- `.planning/phases/01-infrastructure-and-schema/01-CONTEXT.md` — Docker topology, project structure
- `.planning/phases/02-file-ingestion-pipeline/02-CONTEXT.md` — Data schema (38 columns), parsing decisions, frontend patterns (i18n, shadcn, Tailwind v4)

### Existing Code (key files for Phase 3)
- `backend/app/models.py` — SalesRecord model with `total_value`, `remaining_value`, `order_date` columns
- `backend/app/database.py` — Async engine + session factory
- `backend/app/main.py` — FastAPI app, existing `/api` routes
- `frontend/src/App.tsx` — QueryClientProvider, currently renders UploadPage directly (needs router)
- `frontend/src/lib/api.ts` — Fetch helper pattern for API calls
- `frontend/src/components/ui/card.tsx` — shadcn Card component (reuse for metric cards)
- `frontend/src/components/LanguageToggle.tsx` — Moves into shared nav bar
- `frontend/src/i18n.ts` — i18n configuration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `card.tsx` (shadcn): Reuse for KPI summary metric cards
- `button.tsx` (shadcn): Reuse for preset range buttons, toggles
- `badge.tsx` (shadcn): Could be used for status indicators
- `table.tsx` (shadcn): Available if needed for data tables
- TanStack Query: Already wired with QueryClientProvider in App.tsx
- Recharts: Already in package.json (v3.8.1), not yet used in code
- react-i18next: Fully set up with DE/EN translations
- lucide-react: Icons available for nav, toggles
- sonner: Toast notifications available

### Established Patterns
- TanStack Query `useQuery` / `useMutation` with `queryClient.invalidateQueries` for cache management
- Fetch-based API calls in `frontend/src/lib/api.ts` (no axios)
- shadcn/ui components with Tailwind v4 styling
- i18n via `useTranslation()` hook in every component

### Integration Points
- `App.tsx`: Replace direct UploadPage render with router setup
- `frontend/src/lib/api.ts`: Add KPI/dashboard fetch functions
- `backend/app/main.py`: Add KPI query API endpoints (or new router file)
- `docker-compose.yml`: No changes expected — frontend container already running
- `backend/app/models.py`: Read-only queries against SalesRecord for aggregations

</code_context>

<specifics>
## Specific Ideas

- DASH-05 (chart type toggle: line vs bar) pulled from v2 into v1 scope — user chose to include it
- Data freshness in the nav bar means every page shows staleness, not just dashboard
- Zero-value order exclusion (total_value = 0) is a business rule that applies uniformly to all dashboard calculations
- The `remaining_value` column exists but is not used in v1 dashboard metrics — available for v2 enhancements

</specifics>

<deferred>
## Deferred Ideas

- **DASH-06:** Period-over-period deltas on metric cards — remains in v2
- **DASH-07:** Export filtered data as CSV — remains in v2
- **DASH-08:** Per-upload drill-down view — remains in v2
- **Additional metric cards** (remaining value, customer count) — discussed and explicitly excluded from v1

</deferred>

---

*Phase: 03-dashboard-frontend*
*Context gathered: 2026-04-10*
