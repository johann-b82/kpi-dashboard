---
phase: 39-dashboard-ui-launcher-tile
plan: 01
subsystem: frontend
tags: [sensors, dashboard, launcher, i18n, recharts, tanstack-query]
requires:
  - Phase 38 /api/sensors/* endpoints live
  - <AdminOnly>, apiClient<T>(), SegmentedControl existing primitives
provides:
  - /sensors route + SensorsPage shell
  - Admin-gated Sensors launcher tile (SEN-LNCH-01..03)
  - Per-sensor KPI cards with live values + freshness footer
  - Two stacked time-series charts with sensorPalette
  - SensorTimeWindowContext (1h / 6h / 24h / 7d / 30d, default 24h)
  - SubHeader /sensors branch (aggregate last-measured)
  - sensorPalette (documented hex exception)
  - 20 new i18n keys in EN + DE with du tone
affects:
  - frontend/src/App.tsx (new route)
  - frontend/src/pages/LauncherPage.tsx (first coming-soon slot replaced)
  - frontend/src/components/SubHeader.tsx (three-way freshness branch)
tech-stack:
  added: []
  patterns:
    - TanStack Query useQueries for per-sensor parallel fetches
    - D-07 refetch config (15s foreground, no background, refetch on focus, 5s stale)
    - Local-context time-window (not DateRangeContext)
key-files:
  created:
    - frontend/src/pages/SensorsPage.tsx
    - frontend/src/components/sensors/SensorTimeWindow.tsx
    - frontend/src/components/sensors/SensorStatusCards.tsx
    - frontend/src/components/sensors/SensorTimeSeriesChart.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/pages/LauncherPage.tsx
    - frontend/src/components/SubHeader.tsx
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/lib/chartDefaults.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - Context (not useState-in-page) for time window — enables SubHeader/cards/charts to read without prop drilling
  - SubHeader next-poll intentionally deferred; sensor_poll_interval_s not in /api/settings yet (Phase 40)
  - Threshold ReferenceLines deferred to 39-02; min/max thresholds not exposed to frontend yet
  - Decimal fields parsed via Number() at render, never stored as number
metrics:
  duration: "3 min"
  completed: "2026-04-17"
  tasks: 3
  files_created: 4
  files_modified: 8
  commits: 3
requirements_completed:
  - SEN-FE-01
  - SEN-FE-02
  - SEN-FE-03
  - SEN-FE-04
  - SEN-FE-05
  - SEN-FE-06
  - SEN-FE-08
  - SEN-FE-09
  - SEN-FE-13
  - SEN-LNCH-01
  - SEN-LNCH-02
  - SEN-LNCH-03
  - SEN-I18N-02
---

# Phase 39 Plan 01: Dashboard Foundation + Launcher Tile Summary

Delivers the admin-gated Sensor Monitor foundation: `/sensors` route, launcher tile (viewer-invisible), SensorsPage shell mirroring HRPage, per-sensor KPI cards with live values + freshness footer, two stacked Recharts LineCharts (°C / %) with `sensorPalette`, working SegmentedControl time-window (1h · 6h · 24h · 7d · 30d, default 24h), SubHeader aggregate freshness on `/sensors`, TanStack Query D-07 refetch contract, and full DE/EN parity for 20 new keys — all without a single `dark:` variant or hex literal outside the documented `sensorPalette` block.

## Files Created

| Path                                                             | Purpose                                                          | Lines |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| `frontend/src/pages/SensorsPage.tsx`                             | Route component wrapping provider + picker + cards + charts      | 23    |
| `frontend/src/components/sensors/SensorTimeWindow.tsx`           | Context + Provider + `useSensorWindow` + picker                  | 77    |
| `frontend/src/components/sensors/SensorStatusCards.tsx`          | Per-sensor KPI cards (temp + humidity + freshness footer)        | 146   |
| `frontend/src/components/sensors/SensorTimeSeriesChart.tsx`      | Two stacked LineCharts with connectNulls=false + sensorPalette   | 201   |

## Files Modified

- `frontend/src/App.tsx` — eager import + `<Route path="/sensors" component={SensorsPage} />` inserted between `/hr` and `/settings` (before `/` catch).
- `frontend/src/pages/LauncherPage.tsx` — first Coming Soon slot replaced with `<AdminOnly>`-wrapped Sensors tile (Thermometer icon); coming-soon reduced from 3 to 2. Admin sees 4 tiles, Viewer sees 3.
- `frontend/src/components/SubHeader.tsx` — new `SensorFreshnessIndicator` inline; freshness indicator is now a three-way `/sensors` → `/hr` → default ternary.
- `frontend/src/lib/api.ts` — 4 new interfaces (`SensorRead`, `SensorReadingRead`, `SensorStatusEntry`, `PollNowResult`) + 4 fetchers (`fetchSensors`, `fetchSensorReadings`, `fetchSensorStatus`, `pollSensorsNow`). `pollSensorsNow` exported now (interface-first) even though 39-02 is the consumer.
- `frontend/src/lib/queryKeys.ts` — `sensorKeys = { all, list(), readings(id, hours), status() }`.
- `frontend/src/lib/chartDefaults.ts` — `sensorPalette` (8 tailwind-500 hex stops) with full exception-rationale comment block.
- `frontend/src/locales/{en,de}.json` — 20 new keys total (19 `sensors.*` + `launcher.tile.sensors`). DE tone uses "du"/"dein" conventions (e.g., "Letzte Messung vor {{seconds}} s", "Verbindung prüfen").

## TypeScript Shapes Exported

```typescript
SensorRead          // id, name, host, port, oids, scales (string decimals), enabled, timestamps
SensorReadingRead   // id, sensor_id, recorded_at (ISO), temperature/humidity (string|null), error_code
SensorStatusEntry   // sensor_id, last_attempt_at, last_success_at, consecutive_failures, offline
PollNowResult       // sensors_polled, errors[]
SensorWindow        // "1h" | "6h" | "24h" | "7d" | "30d"
```

Decimal fields are typed `string | null` and parsed via `Number(...)` at render time.

## sensorPalette Rationale

Multi-series sensor charts need ≥8 visually distinct hues; the semantic CSS token set (primary/accent/muted/destructive/foreground) only supplies 4–5. The palette is the ONE documented exception to the v1.9 token-only rule — grep bans for hex literals check everywhere else under `frontend/src/` and this file is the allow-listed escape hatch. Each sensor uses the same color index across the temperature and humidity charts so the legend reads consistently between the two stacked panels.

## i18n Keys Added (20 total)

19 dashboard-scope `sensors.*` keys (title, kpi.*, window.*, chart.*, empty.*, subheader.*, error.loading) + `launcher.tile.sensors`. Parity check script confirms identical key sets in `en.json` and `de.json`. Keys reserved for 39-02 (`sensors.threshold.*`, `sensors.poll.*`, `sensors.status.*`, `sensors.delta.*`) intentionally NOT added here — strict 01→02 split.

## Route + Launcher Integration

- `/sensors` resolved by eager-imported `SensorsPage` (mirrors HRPage, not lazy).
- Route inserted inside `<Switch>` before `<Route path="/">` launcher catch so wouter in-order matching picks `/sensors` before falling through.
- Launcher tile: `<AdminOnly>`-wrapped button with `setLocation("/sensors")`, `Thermometer` icon, `launcher.tile.sensors` label. Viewer session collapses the slot to null (3-tile grid); admin session renders 4 tiles.

## Decisions Made

| Decision                                                             | Why                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Context (not useState-in-page) for `SensorTimeWindow`                | Lets future 39-02 components (e.g. delta badge windows, SubHeader decoration) read without prop drilling            |
| SubHeader next-poll display deferred                                 | `sensor_poll_interval_s` lives on `AppSettings` but isn't surfaced via `/api/settings` yet — Phase 40 scope         |
| Threshold ReferenceLines deferred to 39-02                           | Temperature/humidity min/max not yet exposed via settings; marking TODO inline keeps insertion point crisp          |
| `useQueries` parallel fetches (one per sensor) over merged endpoint  | No backend endpoint returns all-sensor readings; per-sensor keys give per-sensor cache invalidation for Poll-now    |
| Decimal fields as `string | null` in TS, `Number()` at render        | Pydantic serializes Decimal as string; parsing at the edge avoids silent precision loss in chart tooltips           |
| `pollSensorsNow` exported in Task 1 (interface-first)                | 39-02 consumer wires the button without re-editing api.ts — reduces merge churn                                     |

## Guardrails Verified

- `npx tsc --noEmit` clean after every commit
- DE/EN parity: `node -e` script exits 0 (20 keys on both sides)
- No `dark:` variants anywhere under `frontend/src/components/sensors/`
- No hex literals anywhere under `frontend/src/components/sensors/`
- `connectNulls={false}` on every `<Line>` (2 charts × sensors)
- All TanStack Query configs match D-07 exactly (`refetchInterval: 15_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`, `staleTime: 5_000`)
- Zero new `fetch(` calls under `frontend/src/` — only the two pre-existing instances (`LoginPage` public logo + `apiClient.ts` internal)
- `<AdminOnly>` wraps the launcher tile; Viewer session collapses the slot

## Commits

| Hash      | Message                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `ee6ea9a` | feat(39-01): add sensor API client, query keys, palette and i18n                |
| `3e126ca` | feat(39-01): add /sensors route, admin launcher tile, page shell and SubHeader branch |
| `3941b0e` | feat(39-01): implement SensorStatusCards and SensorTimeSeriesChart              |

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–3 auto-fixes required; no architectural questions hit.

## Carry-Forward for 39-02

**Interaction + differentiators (not in 39-01):**

- **Poll-now button** — `pollSensorsNow` fetcher already exported from `lib/api.ts`. 39-02 wires a `PollNowButton.tsx` + `useMutation` + invalidate `sensorKeys.all` on success.
- **Threshold-aware badges** (DIFF-01 color chips) — requires settings API extension to surface `sensor_temperature_min/max` and `sensor_humidity_min/max`. Mark TODO removed from chart files once the settings shape is extended.
- **Threshold `<ReferenceLine />`** — same dependency as above. Placeholder comments sit above each LineChart; plug in once thresholds arrive.
- **Delta badges** (DIFF-01) — compute client-side from existing readings query (find reading closest to `now() - 1h`, `now() - 24h`); drop into SensorCard below the value row.
- **Health chip** (DIFF-10) — `/api/sensors/status` already returns `consecutive_failures` + `offline`; compute `okSince` / `offlineSince` from `last_success_at` and render as a colored chip in SensorCard header.
- **SubHeader next-poll** — deferred until settings API exposes `sensor_poll_interval_s` (Phase 40).
- **Reserved i18n keys to add in 39-02 (DE+EN parity):**
  - `sensors.threshold.outOfRange`
  - `sensors.poll.now` / `.refreshing` / `.success` / `.failure`
  - `sensors.status.okSince` / `.offlineSince`
  - `sensors.delta.vsHour` / `.vsDay`

## Known Stubs

None. All components render live data from the API; the two deliberate deferrals (threshold ReferenceLines and SubHeader next-poll) are gated on external settings-API work — not stub data masquerading as real.

## Self-Check: PASSED

- All 4 created files present on disk
- All 3 task commits resolvable in `git log`
