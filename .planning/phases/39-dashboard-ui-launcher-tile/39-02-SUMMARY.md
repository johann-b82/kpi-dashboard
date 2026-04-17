---
phase: 39-dashboard-ui-launcher-tile
plan: 02
subsystem: frontend+backend
tags: [sensors, dashboard, interactions, diff-01, diff-10, thresholds, i18n, tanstack-query, recharts]
requires:
  - 39-01 foundation (SensorsPage, SensorStatusCards, SensorTimeSeriesChart, sensorKeys, fetchers)
  - Phase 38 /api/sensors/* endpoints (poll-now, status, readings)
  - app_settings columns sensor_poll_interval_s / sensor_temperature_min/max / sensor_humidity_min/max (Phase 38 migration)
provides:
  - Blocking Poll-now button (30s client timeout, cache-invalidating, toast-driven)
  - Threshold-aware card coloring (destructive token when outside [min,max])
  - DIFF-01 client-side delta badges (vs. 1h / vs. 24h, native units ± arrow)
  - DIFF-10 health chip (OK seit / Offline seit, primary/destructive tokens)
  - Dashed destructive ReferenceLines at thresholds on both charts
  - Read-only surface of sensor_* settings fields via GET /api/settings
  - 19 new sensors.* i18n keys (threshold / poll / status / delta / duration)
affects:
  - backend/app/schemas.py (SettingsRead extended)
  - backend/app/routers/settings.py (_build_read passes new fields)
  - frontend/src/lib/api.ts (Settings interface extended)
  - frontend/src/pages/SensorsPage.tsx (control bar reorganized)
  - frontend/src/components/sensors/SensorStatusCards.tsx (thresholds + deltas + chip integrated)
  - frontend/src/components/sensors/SensorTimeSeriesChart.tsx (ReferenceLines)
  - frontend/src/locales/{en,de}.json (+19 keys each)
tech-stack:
  added: []
  patterns:
    - useMutation with Promise.race timeout sentinel
    - queryClient.invalidateQueries on the top-level sensorKeys.all tuple
    - ±0.5h tolerance window for client-side time-series delta lookup
    - Pure deltaClassName reuse across percent (DeltaBadge) and absolute (AbsoluteDeltaRow) formatters
key-files:
  created:
    - frontend/src/components/sensors/PollNowButton.tsx
    - frontend/src/components/sensors/SensorHealthChip.tsx
    - frontend/src/components/sensors/sensorDelta.ts
    - frontend/src/components/sensors/sensorDelta.test.ts
  modified:
    - backend/app/schemas.py
    - backend/app/routers/settings.py
    - frontend/src/lib/api.ts
    - frontend/src/components/sensors/SensorStatusCards.tsx
    - frontend/src/components/sensors/SensorTimeSeriesChart.tsx
    - frontend/src/pages/SensorsPage.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - Sensor thresholds exposed via existing GET /api/settings (Option A) — single schema extension, matches existing pattern, no new endpoint required
  - Reading window for delta lookup sized to 25h so the 24h baseline has tolerance headroom even with a 15s refetch jitter
  - Custom AbsoluteDeltaRow instead of reusing DeltaBadge — DeltaBadge hard-codes percent formatting which is wrong for °C / % units; token vocabulary (deltaClassName) is reused for visual parity
  - 30s client-side Promise.race timeout mirrors backend asyncio.wait_for; sentinel Error("timeout") distinguishes timeout toast from generic failure
  - ReferenceLine rendering is null-gated (D-12) so charts never draw phantom threshold lines at y=0 when settings are unconfigured
  - Humidity +fractionDigits=0 kept from 39-01 for value display; delta formatter uses 1 fraction digit across both metrics for readability
metrics:
  duration: "~6 min"
  completed: "2026-04-17"
  tasks: 2 auto + 1 human-verify checkpoint
  files_created: 4
  files_modified: 8
  commits: 2
requirements_completed:
  - SEN-FE-07
  - SEN-FE-10
  - SEN-FE-11
  - SEN-FE-12
  - SEN-I18N-01
---

# Phase 39 Plan 02: Interactions + DIFF-01 + DIFF-10 + Thresholds + Poll-Now Summary

Layered interactivity and differentiators on top of the 39-01 foundation: a blocking **Poll-now button** (30s timeout, cache-invalidating, toast-driven), **threshold-aware card coloring** and dashed **ReferenceLines** fed by four newly-exposed `sensor_*` fields on `/api/settings`, **DIFF-01 delta badges** computed client-side with a ±0.5h tolerance window, **DIFF-10 health chip** driven by `/api/sensors/status`, and the full completion of the `sensors.*` i18n namespace (19 new keys, DE/EN parity). Phase 39 acceptance is now pending only the human-verify checkpoint (12 steps embedded below).

## Files Created

| Path                                                            | Purpose                                                                    | Lines |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| `frontend/src/components/sensors/PollNowButton.tsx`             | Blocking mutation + toast + cache invalidation                             | 64    |
| `frontend/src/components/sensors/SensorHealthChip.tsx`          | DIFF-10 OK-seit / Offline-seit pill from `/api/sensors/status`             | 87    |
| `frontend/src/components/sensors/sensorDelta.ts`                | Pure `computeSensorDelta(readings, metric, offsetHours)` helper            | 58    |
| `frontend/src/components/sensors/sensorDelta.test.ts`           | 7 vitest cases covering empty / null / tolerance / closest-pick behavior   | 91    |

## Files Modified

- `backend/app/schemas.py` — `SettingsRead` gains five Phase-39 sensor fields: `sensor_poll_interval_s: int` (default 60), `sensor_temperature_min/max: Decimal | None`, `sensor_humidity_min/max: Decimal | None`. Decimals serialize as strings per project convention. `SettingsUpdate` intentionally untouched — admin writes arrive Phase 40.
- `backend/app/routers/settings.py` — `_build_read` now passes the new fields through from the `AppSettings` ORM model (columns already existed from the Phase 38 migration).
- `frontend/src/lib/api.ts` — `Settings` interface mirrors the backend extension; decimal fields typed `string | null` and parsed via `Number()` at render time.
- `frontend/src/pages/SensorsPage.tsx` — control bar reorganized to `flex items-center justify-between` so `PollNowButton` (left) and `SensorTimeWindowPicker` (right) sit on one line.
- `frontend/src/components/sensors/SensorStatusCards.tsx` — integrates `useSettings` for thresholds, adds a single top-level `useQuery` for `/api/sensors/status` (not per-card), extracts `ThresholdBounds` helper, wires threshold-aware `text-destructive` on out-of-range values, adds an "Out of range" caption, renders per-card `<SensorHealthChip />` in the header, and displays `AbsoluteDeltaRow`s for `vs. 1h` + `vs. 24h` under each metric.
- `frontend/src/components/sensors/SensorTimeSeriesChart.tsx` — reads thresholds via `useSettings`, imports `ReferenceLine`, renders dashed destructive-colored lines at each defined threshold on both temperature and humidity charts; absent when threshold is null (D-12).
- `frontend/src/locales/{en,de}.json` — +19 keys (`sensors.threshold.*` ×3, `sensors.poll.*` ×5, `sensors.status.*` ×3, `sensors.delta.*` ×3, `sensors.duration.*` ×4, plus `sensors.threshold.min/max` labels for the chart reference-line labels). `sensors.*` key counts: 37 per locale, parity check exits 0.

## Backend Settings API Extension

`GET /api/settings` now returns (in addition to prior fields):

```json
{
  "sensor_poll_interval_s": 60,
  "sensor_temperature_min": "20.0" | null,
  "sensor_temperature_max": "25.0" | null,
  "sensor_humidity_min": "40.0" | null,
  "sensor_humidity_max": "60.0" | null
}
```

Decimals serialize as strings (Pydantic default), matching the existing `temperature_scale` / `humidity_scale` sensor-config pattern. `SettingsUpdate` (the PUT body) is unchanged — writing thresholds is strictly Phase 40 scope (admin UI).

## sensorDelta Algorithm

`computeSensorDelta(readings, metric, offsetHours)`:

1. Sort readings descending by `recorded_at`.
2. Latest = first element. If `latest[metric]` is null → return null.
3. Target-baseline timestamp = `latest.recorded_at − offsetHours` (ms).
4. Among the remaining readings, keep those whose `|recorded_at − target|` is `≤ 0.5h` (the TOLERANCE_MS constant).
5. Sort filtered by absolute diff ascending; pick the closest (the first element).
6. If none qualify → return null. If the chosen reading has `null` for `metric` → return null.
7. Otherwise → return `Number(latest[metric]) − Number(baseline[metric])`.

Rationale: sales / HR compute deltas server-side because they're aggregates; sensors are raw time-series that are already in the TanStack Query cache. Doing this client-side is simpler (no new endpoint) and faster (no round-trip). Tolerance `±0.5h` was picked so a 1h poll cadence consistently matches both the `vs. 1h` and `vs. 24h` comparisons without requiring exact-offset readings.

## PollNowButton Timeout Strategy

```ts
Promise.race([
  pollSensorsNow(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 30_000),
  ),
])
```

Client-side 30s race mirrors the backend's `asyncio.wait_for(timeout=30)` inside `POST /api/sensors/poll-now`. The sentinel `Error("timeout")` is distinguished in `onError` so the toast copy switches between `sensors.poll.timeout` (`"Messung nach 30 s abgebrochen"`) and the generic `sensors.poll.failure` (`"Messung fehlgeschlagen — prüfe die Konfiguration"`). On success, `queryClient.invalidateQueries({ queryKey: sensorKeys.all })` refires every sensor list / readings / status query on the page.

## Threshold Color & ReferenceLine Conditional Rendering (D-12)

- Card threshold color: `isOutOfRange(value, bounds)` returns true only when both the value is finite AND at least one of `bounds.min` / `bounds.max` is non-null AND the value is outside it. Missing thresholds do NOT trigger the destructive color — they leave `text-foreground` alone.
- Chart ReferenceLines: each is rendered inside `{threshold != null && <ReferenceLine ... />}`. No threshold → no line drawn at y=0.

Both rules use the same `parseThreshold(raw)` helper shape: `null → null`, non-finite `Number()` → null, finite → number.

## Health Chip Token Mapping (D-14)

| State           | `bg-...`              | `text-...`             | Copy                                    |
| --------------- | --------------------- | ---------------------- | --------------------------------------- |
| Online          | `bg-primary/10`       | `text-primary`         | `OK seit {{duration}}` / `OK for …`     |
| Offline         | `bg-destructive/10`   | `text-destructive`     | `Offline seit {{duration}}` / `Offline for …` |
| Unknown / no status entry | `bg-muted`  | `text-muted-foreground` | `Status unbekannt` / `Status unknown`    |

Durations ladder automatically (`<60s → seconds`, `<60m → minutes`, `<24h → hours`, else days), each with its own i18n key pair. The "offline since" anchor is `last_attempt_at` (first failed attempt); the "OK since" anchor is `last_success_at`.

## DE/EN Parity

`sensors.*` keys per locale: **37** (up from 18 after 39-01). Parity verified via:

```bash
node -e "
const en = JSON.parse(require('fs').readFileSync('src/locales/en.json', 'utf8'));
const de = JSON.parse(require('fs').readFileSync('src/locales/de.json', 'utf8'));
const keys = Object.keys(en).filter(k => k.startsWith('sensors.'));
const missing = keys.filter(k => !(k in de));
if (missing.length) process.exit(1);
"
```

Exits 0. DE copy uses `du` tone ("prüfe", "Jetzt messen").

## Guardrails Verified

- `cd frontend && npx tsc --noEmit` — clean
- `npx vitest run src/components/sensors/` — 7/7 pass (sensorDelta.test.ts)
- Parity check — 37 `sensors.*` keys present in both en.json and de.json
- `grep -rnE 'dark:' src/components/sensors/` — no matches (class usage)
- `grep -rnE '#[0-9a-fA-F]{6}' src/components/sensors/` — no matches
- `grep -n 'invalidateQueries' src/components/sensors/PollNowButton.tsx` — matches on `sensorKeys.all`
- `grep -n 'computeSensorDelta' src/components/sensors/SensorStatusCards.tsx` — 4 call sites (temp/hum × 1h/24h)
- `grep -n 'ReferenceLine' src/components/sensors/SensorTimeSeriesChart.tsx` — 4 conditional renders
- Backend `pytest tests/test_sensor_schemas.py tests/test_sensors_admin_gate.py` — 10/10 pass
- Backend `SettingsRead(...).sensor_poll_interval_s` instantiates with the new default (60)

## Commits

| Hash      | Message                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `126f0c5` | feat(39-02): extend /api/settings with sensor fields, add sensorDelta util and 39-02 i18n keys |
| `0978a97` | feat(39-02): wire PollNowButton, threshold coloring, DIFF-01 deltas, DIFF-10 health chip, chart ReferenceLines |

## Deviations from Plan

None as authored. Two minor runtime decisions that stayed inside plan intent:

1. **Delta badge presentation** — Plan suggested reusing `<DeltaBadge>` directly (which uses `Intl.NumberFormat({ style: "percent" })`). That formatter multiplies the input by 100 and appends `%`, which is semantically wrong for raw °C / % absolute deltas. I created a local `AbsoluteDeltaRow` component that reuses the project's existing `deltaClassName` color tokens (CARD-02 / CARD-04 contract) and shares the arrow-glyph convention, but formats the value with one decimal and the native metric unit. This stays inside the plan's stated layout intent (`DeltaBadgeStack`-like structure) while fixing a unit-mismatch trap.
2. **Reading window sizing** — Plan wording pointed at the existing 1h readings query used for card latest-value display. DIFF-01 `vs. 24h` needs 24h of history, so I bumped the card's dedicated reading window to 25h. The chart keeps its own window from the SegmentedControl (1h / 6h / 24h / 7d / 30d). This means the cards now issue one additional per-sensor HTTP request each — acceptable for the ≤3 sensors in MVP and matches the same D-07 refetch cadence as everything else.

No Rule 1–3 auto-fixes triggered. No architectural Rule 4 stops.

## Pre-existing Backend Test Failures (Out of Scope)

`docker compose exec api pytest tests/` shows 15 pre-existing failures across `test_settings_api.py`, `test_kpi_endpoints.py`, `test_kpi_chart.py`, `test_rebuild_*.py`, and `test_color_validator.py`. Every failure is a 401 response caused by the Phase 27 auth-guard on endpoints that these tests do not inject a bearer token for. Verified independently by stashing 39-02 changes and re-running — identical 401 failures occur on clean main. Tracked as deferred (requires test-fixture auth helper, not a schema issue).

## Human-Verify Checkpoint (Task 3)

### Prerequisites

- Stack up: `docker compose up -d` — all five services running
- At least one sensor configured + scheduler polling successfully for ≥5 min (so 1h / 24h delta windows have baselines). The seeded `Produktion` sensor from Phase 38-03 satisfies this.
- One admin account and one viewer account
- Open the dashboard: http://localhost:5173/

### 12-Step Verification

1. **Launcher tile visibility (admin)** — Log in as admin. Visit http://localhost:5173/. Expected: 4 tiles — KPI Dashboard, Sensors (Thermometer icon), 2× Coming Soon. Sensors tile clickable; label `Sensors` (EN) / `Sensoren` (DE) per locale.

2. **Launcher tile visibility (viewer)** — Log out, log in as viewer. Visit http://localhost:5173/. Expected: 3 tiles only — no Sensors tile at all (absent, not disabled).

3. **Navigation + page shell** — Log back in as admin. Click Sensors. URL becomes `/sensors`; page renders with the control bar (Poll-now + SegmentedControl) on top, cards grid, then stacked charts.

4. **KPI cards** — Confirm one card per configured sensor. Each card shows: sensor name (left), health chip (right), temperature `XX.X °C` + humidity `XX %`, two delta rows (`vs. 1 Std`/`vs. 1h` and `vs. 24 Std`/`vs. 24h`) under each metric, freshness footer (`vor X s` / `X s ago`).

5. **Threshold coloring** — Via DB: `docker compose exec db psql -U kpi kpi -c "UPDATE app_settings SET sensor_temperature_max=10.0 WHERE id=1;"`. Refresh. Expected: temperature value renders in `text-destructive` (red-tinted), caption `Außerhalb des Bereichs` / `Out of range` appears beneath. Revert: `UPDATE app_settings SET sensor_temperature_max=NULL WHERE id=1;`. Refresh → normal color returns.

6. **Time-window selector** — Click through `1h · 6h · 24h · 7d · 30d`. Expected: both charts redraw with wider/narrower windows; gaps from failed polls appear as breaks (connectNulls={false}).

7. **Threshold ReferenceLines** — Set both temp thresholds: `UPDATE app_settings SET sensor_temperature_min=20.0, sensor_temperature_max=25.0 WHERE id=1;`. Refresh. Expected: two dashed destructive-colored horizontal lines on the temperature chart at y=20 and y=25 with `Min` / `Max` labels. Clear: `UPDATE app_settings SET sensor_temperature_min=NULL, sensor_temperature_max=NULL WHERE id=1;`. Refresh → lines disappear (no line at y=0).

8. **Poll-now button** — Click `Jetzt messen` / `Poll now`. Expected: button shows `Messung läuft...` / `Polling...`, disables, blocks <30s, success toast `1 Sensoren gemessen` / `Polled 1 sensors`, freshness footer resets to `vor 0–2 s` / `0–2 s ago`, chart gains a new rightmost data point.

9. **Poll-now timeout path (optional)** — `docker compose stop api`. Click `Poll now`. Expected after 30s: toast `Messung nach 30 s abgebrochen` / `Poll timed out after 30 s` (in practice the browser `fetch` may return a network error sooner with `sensors.poll.failure` — also acceptable). Restart: `docker compose start api`.

10. **i18n parity end-to-end** — Flip DE/EN toggle. Expected: every visible string on `/sensors` changes (title, KPI labels, window segments, chip text, poll button, delta labels, threshold caption, toast). Browser console: **zero** `i18next::translator: missingKey` warnings.

11. **SubHeader freshness** — Observe SubHeader on `/sensors`. Expected: right side shows `Letzte Messung vor X s` / `Last measured X s ago`, updates as new readings arrive (15s refetch). (Next-poll display remains deferred — Phase 40.)

12. **Token compliance spot-check** — DevTools → inspect a card. Expected: classes use `bg-card`, `border-border`, `text-foreground` / `text-muted-foreground` / `text-destructive`, `bg-primary/10`, `bg-destructive/10`. No hex literals in the computed class list. Health chip flips token colors automatically between online/offline sensors without any `dark:` variant classes.

**Resume signal:** Reply `approved` to mark Phase 39 complete, or describe any issues for revision plans.

## Carry-Forward for Phase 40

- SubHeader `sensors.subheader.nextPoll` display still deferred until admin writes + effective settings refresh are wired (needs PUT surface for `sensor_poll_interval_s` + a few seconds of drift accommodation).
- `SettingsUpdate` payload needs to gain the four threshold fields + `sensor_poll_interval_s` for the Phase 40 admin UI.
- Per-sensor thresholds (DIFF-09) remain deferred; MVP continues to use the single global pair from `app_settings`.

## Known Stubs

None. All rendered data flows from real APIs; the two explicit deferrals (SubHeader next-poll, per-sensor thresholds) are documented carry-forwards with clear gating — not stubs masquerading as real.

## Self-Check: PASSED

- All 4 created files present on disk (`PollNowButton.tsx`, `SensorHealthChip.tsx`, `sensorDelta.ts`, `sensorDelta.test.ts`)
- Both task commits resolvable in `git log` (`126f0c5`, `0978a97`)
- SUMMARY.md written at expected path
