# Phase 39: Dashboard UI + Launcher Tile — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto — decisions from locked OQ defaults + milestone research (SUMMARY/FEATURES/ARCHITECTURE)

<domain>
## Phase Boundary

Admin clicks the Sensors tile on `/` → sees live sensor data: KPI cards per sensor with current values + threshold-aware badges, two stacked time-series charts with reference lines, working time-window selector, Poll-now button refreshing the view, delta badges (DIFF-01), and health chip (DIFF-10). Viewers cannot see the tile at all.

**Covers REQs (17):** SEN-FE-01..13, SEN-LNCH-01..03, SEN-I18N-02, partial SEN-I18N-01 (dashboard keys).

**Depends on:** Phase 38 — all `/api/sensors/*` endpoints live; scheduler producing readings; Directus admin gate enforced.

</domain>

<decisions>
## Implementation Decisions

### Route + Launcher
- New `<Route path="/sensors" component={SensorsPage} />` in `frontend/src/App.tsx`.
- `LauncherPage.tsx` gets a new Sensors tile wrapped in `<AdminOnly>` — invisible to Viewer role. Icon: `Thermometer` from lucide-react. Position: replace one existing Coming Soon slot (not add 5th tile — keep 4 visible for admins).
- Tile styling mirrors existing iOS-style pattern (icon-only inside tile, label below). i18n key: `launcher.tile.sensors` ("Sensors"/"Sensoren").
- Click navigates to `/sensors`.

### Page Shell
- `frontend/src/pages/SensorsPage.tsx` mirrors `HRPage.tsx` shell: `<div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">` wrapping sensor-specific components.
- Components live under `frontend/src/components/sensors/`: `SensorStatusCards.tsx`, `SensorTimeSeriesChart.tsx`, `PollNowButton.tsx`.
- Page is admin-gated (server-side already enforced via router; client-side belt-and-braces via `<AdminOnly>` at route level if possible, else early redirect in SensorsPage).

### KPI Cards (SEN-FE-03 + DIFF-01 + DIFF-10)
- One card per sensor, ~3 expected at ship (OQ-1 default).
- Card contents:
  - Header: sensor name.
  - Primary row: current temperature (`22.4 °C`) + humidity (`54.2 %`) side-by-side, large numeric.
  - Delta badges under each value via `DeltaBadgeStack`-style pattern (`+0.3 °C vs. 1 h`, `−2 % vs. 24 h`). Compute server-side from `/api/sensors/{id}/readings` data — reuse existing delta formatting utilities.
  - Threshold-aware color: `destructive` token on value chip when current value outside global `[min, max]` (thresholds from `app_settings`).
  - Health chip (DIFF-10): "OK seit 2h" (green) / "Offline seit 15 min" (destructive) — computed from `/api/sensors/status` (polling log).
  - Freshness footer: muted "letzte Messung vor Xs".

### Time-Series Chart (SEN-FE-04)
- `SensorTimeSeriesChart.tsx` renders two stacked `Recharts` `LineChart`: temperature (°C), humidity (%).
- One `<Line>` per sensor — colors from new `sensorPalette` exported from `frontend/src/lib/chartDefaults.ts` (multi-series distinct). Each sensor keeps the SAME color across temperature and humidity charts.
- Dashed `<ReferenceLine>` for global min/max thresholds when defined.
- Tooltip uses DE date format (`dd.MM.yyyy HH:mm`) — locale-aware like Sales.
- `connectNulls={false}` — gaps show as absent line segments, not straight-line bridges.
- Year-aware x-axis labels unnecessary for <30d windows.

### Time-Window Selector (SEN-FE-06)
- `SegmentedControl` with segments: `1h · 6h · 24h · 7d · 30d`.
- Local `useState` or new `SensorTimeWindowContext` — **do NOT reuse `DateRangeContext`** (which is absolute-date-range-based).
- Selected window passed as `?hours=N` query to `/api/sensors/{id}/readings`.
- Default: 24h.

### Poll-Now Button (SEN-FE-07)
- `PollNowButton.tsx` calls `POST /api/sensors/poll-now`.
- On success: invalidate all `sensorKeys` queries → cards + charts refetch.
- Loading state while mutation is in flight.
- Toast on error (e.g., "Polling failed — check sensor config").

### Data Fetching (SEN-FE-08)
- New `useSensorReadings` hook (TanStack Query):
  - `queryKey: sensorKeys.readings(sensorId, hours)`
  - `refetchInterval: 15_000` (15s — shorter than the server cadence to catch updates fast; server throttles via UNIQUE constraint anyway)
  - `refetchIntervalInBackground: false` (don't poll when tab hidden)
  - `refetchOnWindowFocus: true` (refresh when user returns)
  - `staleTime: 5_000` (treat as fresh for 5s, avoid refetch stampede)
- Sister hook `useSensorStatus` for health chips (longer stale time OK).

### Launcher Tile (SEN-LNCH-01..03)
- Wrap in `<AdminOnly>` so viewers don't see it at all (requirement).
- `Thermometer` from lucide-react.
- i18n: `launcher.tile.sensors` (EN: "Sensors", DE: "Sensoren").

### SubHeader Route-Aware Freshness (SEN-FE-09)
- SubHeader currently shows HR sync timestamp on `/hr` and upload timestamp on `/sales`. Add a third branch for `/sensors`: aggregate "letzte Messung vor Xs · nächste in Ys" (or similar).
- Data source: max `recorded_at` across all sensors + computed next-poll timestamp from `app_settings.sensor_poll_interval_s`.

### Error/Empty States (SEN-FE-10)
- Card with latest reading null or `error_code` set → muted "Keine Messwerte — Verbindung prüfen".
- Chart: Recharts `connectNulls={false}`.

### Styling (SEN-FE-13)
- Tailwind tokens only — no `dark:` variants, no hex literals outside the documented `sensorPalette` semantic exception.
- `sensorPalette` values: document inline as the one-and-only hex exception with rationale (multi-series distinctness).

### i18n (SEN-I18N-01 dashboard subset, SEN-I18N-02 launcher)
- New `sensors.*` namespace in both `frontend/src/locales/en.json` and `de.json`.
- Required keys for Phase 39:
  - `sensors.title`, `sensors.subtitle` (if used)
  - `sensors.kpi.temperature`, `sensors.kpi.humidity`, `sensors.kpi.freshness` (with `{{seconds}}` interpolation)
  - `sensors.threshold.outOfRange`
  - `sensors.window.{1h,6h,24h,7d,30d}`
  - `sensors.poll.{now,refreshing,lastPoll,failure}`
  - `sensors.status.{okSince,offlineSince}` (with `{{duration}}` interpolation)
  - `sensors.empty.noReadings`
- `launcher.tile.sensors` (EN/DE).
- Admin form keys are Phase 40 scope.

### API Client Extensions
- `frontend/src/lib/api.ts` gains: `fetchSensors`, `fetchSensorReadings(sensorId, hours)`, `pollNow`, `fetchSensorStatus`.
- `frontend/src/lib/queryKeys.ts` gains: `sensorKeys = { all: ["sensors"] as const, list: () => [...], readings: (id, hours) => [...], status: () => [...] }`.
- All calls go through existing `apiClient<T>()` for bearer + 401 refresh — NEVER direct `fetch()`.

### Delta Computation (DIFF-01)
- Compute client-side from existing readings query data (no new API endpoint).
- Find the reading closest to `now() - 1h`, `now() - 24h` — compute delta from current reading.
- If no reading ~1h ago exists (sensor offline), show `—` delta.

### Stretch: Split UI Work Across 2 Plans?
- Option A: Single PLAN covering all of Phase 39.
- Option B (recommended): Split into:
  - **39-01** — foundation + dashboard read path (route, page shell, cards, chart, time-window, API client, query keys, i18n dashboard keys, launcher tile). Covers all MVP SEN-FE + SEN-LNCH.
  - **39-02** — interaction + differentiators (Poll-now button, threshold badges, delta computation DIFF-01, health chip DIFF-10, SubHeader route-aware freshness).
- Planner decides based on complexity; both approaches are acceptable. 39-01 should be independently deployable (basic sensor view works).

</decisions>

<code_context>
## Existing Code Insights

- `frontend/src/App.tsx` — router, AppShell, `isLauncher = location === "/"` padding logic.
- `frontend/src/pages/LauncherPage.tsx` — 4-tile grid with 1 active + 3 coming soon; `const isAdmin = user?.role === "admin"` already wired (currently unused — perfect for the new admin tile).
- `frontend/src/auth/AdminOnly.tsx` — returns `null` for viewers.
- `frontend/src/pages/HRPage.tsx` — exact page shell pattern to mirror.
- `frontend/src/pages/DashboardPage.tsx` — KPI card grid + chart + table pattern reference.
- `frontend/src/components/dashboard/KpiCardGrid.tsx`, `DeltaBadgeStack.tsx` — patterns for value + delta rows.
- `frontend/src/components/ui/segmented-control.tsx` — reusable SegmentedControl.
- `frontend/src/lib/chartDefaults.ts` — Recharts defaults driven by CSS var tokens; extend with `sensorPalette`.
- `frontend/src/lib/apiClient.ts` + `api.ts` + `queryKeys.ts` — existing patterns.
- `frontend/src/components/SubHeader.tsx` — route-aware freshness for `/hr` and `/sales`.
- Backend endpoints live: `GET /api/sensors/`, `GET /api/sensors/{id}/readings?hours=N`, `GET /api/sensors/status`, `POST /api/sensors/poll-now` (from Phase 38 router).

</code_context>

<specifics>
## Specific Ideas

- Reference SubHeader behavior on `/hr` for the route-aware freshness pattern — e.g., `HrFreshnessIndicator` embedded in `SubHeader.tsx`.
- Freshness "vor Xs / nächste in Ys" should use the same `Intl.DateTimeFormat`-style locale-aware formatter as existing `sync.lastSynced`.
- Sensor palette suggestion: 8 distinct-enough colors (cycle if more sensors). Use `oklch`-in-brand or borrow from existing chart color stops if possible.
- Tile position: replace the *first* Coming Soon slot (so Sensors shows up adjacent to KPI Dashboard in the grid).

</specifics>

<deferred>
## Deferred Ideas

- **DIFF-04 server-side downsampling** — OQ-7 defaults defer. Revisit in future milestone if 7d+ charts feel sluggish.
- **Per-sensor thresholds on cards** — OQ-4 MVP is global only. Per-sensor override lives in DIFF-09 (future).
- **Multi-sensor chart overlay legend toggle** — basic legend is sufficient; no toggle in MVP.
- **Zones/locations grouping** — OQ defer; trivial flat grid for ≤3 sensors.
- **Admin tile + viewer-facing tile** — all sensor UX is admin-only in v1.15.
- **Export readings from dashboard** — aligns with future DASH-07 CSV export feature; not in this milestone.

</deferred>

<canonical_refs>
## Canonical References

- `.planning/research/SUMMARY.md` (frontend integration table, i18n keys)
- `.planning/research/FEATURES.md` (UI language map, page shell, chart spec)
- `.planning/research/ARCHITECTURE.md` (section 4 — frontend integration)
- `.planning/REQUIREMENTS.md` (17 REQs owned by this phase)
- `.planning/phases/38-backend-schema-scheduler/38-02-SUMMARY.md` (backend API contract)
- `backend/app/routers/sensors.py` (live endpoint signatures)
- `backend/app/schemas.py` (Pydantic response shapes)

</canonical_refs>
