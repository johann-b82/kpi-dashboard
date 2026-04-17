# Requirements: v1.15 Sensor Monitor

**Milestone:** v1.15
**Status:** Active
**Created:** 2026-04-17
**Core Value:** Admin-only environmental monitoring (temperature + humidity via SNMP) integrated into the KPI Dashboard launcher with full CI parity — zero friction from existing admin login to live sensor data.

**Research:** [SUMMARY.md](research/SUMMARY.md) (consolidates STACK, FEATURES, ARCHITECTURE, PITFALLS)
**Locked defaults (2026-04-17):** 3 sensors, sub-page admin UX, global poll interval, global thresholds, 90d retention, skip SQLite import, ship DIFF-01+DIFF-10, alerting out-of-scope.

---

## Active Requirements

### Database & Schema (SEN-DB-*)

- [x] **SEN-DB-01**: Alembic migration creates `sensors` table (id, name unique, host, port default 161, community, temperature_oid, humidity_oid, temperature_scale, humidity_scale, enabled, created_at, updated_at)
- [x] **SEN-DB-02**: Alembic migration creates `sensor_readings` table (id BIGSERIAL, sensor_id FK CASCADE, recorded_at TIMESTAMPTZ, temperature, humidity, error_code) with `UNIQUE(sensor_id, recorded_at)` and index on `(sensor_id, recorded_at DESC)`
- [x] **SEN-DB-03**: Alembic migration creates `sensor_poll_log` table (id, sensor_id FK, attempted_at, success, error_kind, latency_ms) — separates liveness from data
- [x] **SEN-DB-04**: Alembic migration extends `app_settings` with sensor_poll_interval_s (default 60), sensor_temperature_min/max, sensor_humidity_min/max (all nullable except interval)
- [x] **SEN-DB-05**: Migration seeds one default sensor row (Produktion, 192.9.201.27, OIDs from reference config.yaml) so scheduler has work from first tick
- [x] **SEN-DB-06**: Community string stored Fernet-encrypted at rest (reuse existing Personio Fernet key); never decrypted in logs
- [x] **SEN-DB-07**: `sensors` and `sensor_readings` added to `DB_EXCLUDE_TABLES` in docker-compose.yml so Directus Data Model UI hides them
- [x] **SEN-DB-08**: Migration round-trips cleanly — `upgrade → downgrade → upgrade` on fresh DB drops and recreates all tables + app_settings columns

### Backend Service & API (SEN-BE-*)

- [x] **SEN-BE-01**: `backend/app/services/snmp_poller.py` exposes `snmp_get`, `snmp_walk`, `poll_sensor`, `poll_all` as async functions using `pysnmp.hlapi.v3arch.asyncio` (not deprecated v6 path)
- [x] **SEN-BE-02**: `pysnmp>=7.1.23,<8.0` added to `backend/requirements.txt` (NOT `pysnmp-lextudio`)
- [x] **SEN-BE-03**: A single shared `SnmpEngine` is cached on `app.state.snmp_engine` at startup; no per-call instantiation
- [x] **SEN-BE-04**: `poll_all` uses `asyncio.gather(..., return_exceptions=True)` so one sensor failure does not cancel sibling polls
- [x] **SEN-BE-05**: Per-sensor polling uses `timeout=3.0, retries=2`; 3 consecutive failures surface as "offline" in the UI via `sensor_poll_log`
- [x] **SEN-BE-06**: `Sensor` and `SensorReading` (and `SensorPollLog`) SQLAlchemy models appended to the flat `backend/app/models.py`
- [x] **SEN-BE-07**: Pydantic schemas (`SensorRead`, `SensorCreate`, `SensorUpdate`, `SensorReadingRead`, `PollNowResult`, `SnmpProbeRequest`, `SnmpWalkRequest`) appended to `backend/app/schemas.py`; community typed as `SecretStr`
- [x] **SEN-BE-08**: `backend/app/routers/sensors.py` registers `APIRouter(prefix="/api/sensors", dependencies=[Depends(get_current_user), Depends(require_admin)])` — router-level admin gate
- [x] **SEN-BE-09**: Endpoints implemented: `GET /` list sensors, `POST /` create, `PATCH /{id}` update, `DELETE /{id}`, `GET /{id}/readings?hours=N`, `POST /poll-now`, `POST /snmp-probe`, `POST /snmp-walk`, `GET /status` (per-sensor health from poll_log)
- [x] **SEN-BE-10**: `POST /poll-now` awaits `poll_all()` synchronously (blocking like Personio `POST /api/sync`), wrapped in `asyncio.wait_for(..., timeout=30)`; returns `PollNowResult { sensors_polled, errors }`
- [x] **SEN-BE-11**: Writes use `ON CONFLICT (sensor_id, recorded_at) DO NOTHING` to dedupe scheduled vs manual poll collision
- [x] **SEN-BE-12**: Manual poll dedupes if last row for sensor is <2s old (avoids spam clicks creating noise)
- [x] **SEN-BE-13**: Router dependency-audit test enumerates `app.routes` and asserts every `/api/sensors/*` route chain contains `require_admin`
- [x] **SEN-BE-14**: CI grep check: no `import sqlite3` or `import psycopg2` in `backend/app/`; no `time.sleep` in `backend/app/services/snmp*`

### Scheduler (SEN-SCH-*)

- [x] **SEN-SCH-01**: `backend/app/scheduler.py` adds `SENSOR_POLL_JOB_ID = "sensor_poll"` and registers a job on the existing singleton `AsyncIOScheduler` (no second scheduler)
- [x] **SEN-SCH-02**: Job uses `max_instances=1`, `coalesce=True`, `misfire_grace_time=30`; outer `asyncio.wait_for(poll_all(), timeout=min(45, interval-5))`
- [x] **SEN-SCH-03**: On startup, reads `sensor_poll_interval_s` from `app_settings` singleton; if >0, schedules the job
- [x] **SEN-SCH-04**: `PUT /api/settings` (or equivalent admin endpoint) calls `scheduler.reschedule_job(SENSOR_POLL_JOB_ID, trigger="interval", seconds=new)` in try/except; logs transition
- [x] **SEN-SCH-05**: `docker-compose.yml` `api` service runs with `uvicorn --workers 1`; comment explains why (prevents N-fold duplicate polls)
- [x] **SEN-SCH-06**: Retention cleanup job (daily) deletes `sensor_readings` and `sensor_poll_log` rows older than 90 days; fixed retention, not admin-configurable in v1.15

### Frontend Dashboard (SEN-FE-*)

- [x] **SEN-FE-01**: `frontend/src/App.tsx` adds `<Route path="/sensors" component={SensorsPage} />`
- [x] **SEN-FE-02**: `SensorsPage.tsx` follows `HRPage.tsx` shell: `<div className="max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8">` wrapping sensor-specific components
- [x] **SEN-FE-03**: `components/sensors/SensorStatusCards.tsx` renders one KPI card per sensor (temp + humidity side-by-side), current value, threshold-aware badge color (destructive token when out-of-range), per-card freshness footer
- [x] **SEN-FE-04**: `components/sensors/SensorTimeSeriesChart.tsx` renders two stacked Recharts `LineChart` (temperature °C, humidity %), one `Line` per sensor; `ReferenceLine` dashed for min/max thresholds
- [x] **SEN-FE-05**: `chartDefaults.ts` extended with `sensorPalette` (multi-series distinct colors); tokens documented as semantic exception
- [x] **SEN-FE-06**: Time-window selector uses `SegmentedControl` with segments `1h · 6h · 24h · 7d · 30d`; local state or new `SensorTimeWindowContext` — does NOT reuse `DateRangeContext`
- [x] **SEN-FE-07**: `components/sensors/PollNowButton.tsx` calls `POST /api/sensors/poll-now`; on success invalidates all `sensorKeys` queries (cards + charts refetch)
- [x] **SEN-FE-08**: `useSensorReadings` hook uses TanStack Query with `refetchInterval: 15_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`, `staleTime: 5_000`
- [x] **SEN-FE-09**: SubHeader shows route-aware freshness on `/sensors` (aggregate "letzte Messung vor Xs / nächste in Ys")
- [x] **SEN-FE-10**: Error/empty state: when latest reading is null or error_code set, card shows muted "Keine Messwerte — Verbindung prüfen"; chart uses Recharts `connectNulls={false}`
- [x] **SEN-FE-11**: DIFF-01 — delta badges on each KPI card (`+0.3 °C vs. 1 h`, `−2 % vs. 24 h`) via `DeltaBadgeStack` pattern
- [x] **SEN-FE-12**: DIFF-10 — "OK seit Xh" / "Offline seit X min" health chip per sensor, computed from `sensor_poll_log`
- [x] **SEN-FE-13**: All surfaces use Tailwind tokens only (no `dark:` variants, no hex literals outside documented sensorPalette exception) — dark mode works automatically

### Launcher Tile (SEN-LNCH-*)

- [x] **SEN-LNCH-01**: `LauncherPage.tsx` renders a Sensors tile (replacing one Coming Soon slot OR as 5th tile) wrapped in `<AdminOnly>` — invisible to Viewer role
- [x] **SEN-LNCH-02**: Tile uses `Thermometer` icon from lucide-react; label "Sensors" (EN) / "Sensoren" (DE) via `launcher.tile.sensors` i18n key
- [x] **SEN-LNCH-03**: Click navigates to `/sensors`; tile styling matches existing iOS-style pattern (icon-only inside tile, label below)

### Admin Settings (SEN-ADM-*)

- [x] **SEN-ADM-01**: New sub-page `/settings/sensors` (admin-only), reached from a link/button in the main `/settings` page; applies existing `SettingsDraft` + `UnsavedGuard` + `ActionBar` patterns
- [x] **SEN-ADM-02**: Sensor CRUD form lists configured sensors; each row has Edit and Remove; "+ Sensor hinzufügen" opens a new-row form
- [x] **SEN-ADM-03**: Per-sensor fields editable: name, host, port, community (SecretStr — write-only, never displayed), temperature_oid, temperature_scale, humidity_oid, humidity_scale, enabled
- [x] **SEN-ADM-04**: Polling-interval input (integer seconds, 5–86400); save triggers `scheduler.reschedule_job`
- [x] **SEN-ADM-05**: Global threshold inputs: temperature_min, temperature_max, humidity_min, humidity_max (all optional, all NUMERIC)
- [ ] **SEN-ADM-06**: Collapsible "SNMP-Walk (OID-Finder)" section: host/port/community/base-OID inputs → Walk button → results table → click-to-assign to a sensor's OID field
- [ ] **SEN-ADM-07**: "Probe" button per sensor row: triggers `POST /api/sensors/snmp-probe` with the row's config (uncommitted draft OK) and shows live temp+humidity result inline; success/failure toast
- [x] **SEN-ADM-08**: Dirty-guard prompt on navigate-away with unsaved changes (reuse existing `UnsavedChangesDialog`)

### Operations & Docs (SEN-OPS-*)

- [x] **SEN-OPS-01**: Pre-flight verification step in Phase 38: `docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.2` returns a valid reading before any business logic is built
- [ ] **SEN-OPS-02**: Admin guide article `docs/admin/sensor-monitor.md` (EN) + `docs/admin/sensor-monitor.de.md` (DE), following v1.13 admin-guide Markdown pattern; covers: onboarding a new sensor (walk → probe → save), thresholds, polling interval, troubleshooting (offline sensors, Docker network), community-as-secret warning, never-use-public warning
- [ ] **SEN-OPS-03**: Docs index updated (EN + DE) to list the new admin guide article
- [ ] **SEN-OPS-04**: Runbook note for operator: host-mode fallback (`network_mode: host` on `api`) if Docker bridge cannot reach 192.9.201.x; documented in admin guide with known trade-offs

### Internationalization (SEN-I18N-*)

- [x] **SEN-I18N-01**: New `sensors.*` namespace in `frontend/src/locales/en.json` and `de.json` covers all user-visible strings (page title, KPI labels, threshold messages, time-window segments, Poll-now, freshness, admin form fields, probe/walk UI, toast messages) — full DE/EN parity with "du" tone for German
- [x] **SEN-I18N-02**: Launcher tile label key (`launcher.tile.sensors`) added to both locales

---

## Future Requirements (v1.16+ or later)

- **DIFF-02**: Email notification on threshold breach — blocked on SMTP provisioning
- **DIFF-03**: Slack/webhook notification on threshold breach
- **DIFF-04**: Server-side downsampling (hourly AVG/MIN/MAX for ranges >7d; daily for >30d) — revisit if >7d charts feel sluggish
- **DIFF-05**: CSV export of sensor readings — align with DASH-07 when implemented
- **DIFF-07**: Zones / locations grouping for sensors (once ≥5 sensors deployed)
- **DIFF-08**: Per-sensor calibration offsets
- **DIFF-09**: Per-sensor threshold overrides (fall back to global)
- **SEN-FUTURE-01**: Admin-configurable retention policy UI
- **SEN-FUTURE-02**: One-off SQLite `data.db` → Postgres import script
- **SEN-FUTURE-03**: SNMPv3 with auth/priv (required only if network security tightens)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| High-frequency streaming (<10s polls, WebSocket push) | 60s cadence sufficient for environmental sensors; no WebSocket infra |
| Grafana/Prometheus-level metrics platform | Internal tool, not observability stack |
| Third-party cloud sensor integrations (SensorPush, Ubibot, Govee, AWS IoT) | SNMP is the shared protocol for existing physical sensors |
| Native mobile app | Project-level anti-feature (web-first, desktop 1080p+) |
| SNMP traps (UDP 162 listener) | Polling model proven sufficient |
| User-uploaded sensor icons / per-sensor theming | Zero operational value |
| Historical import from standalone SQLite | <weeks of data; re-poll from fresh |
| Retention policy UI in v1.15 | 2.6M rows/year negligible Postgres load; fixed 90d default; revisit if needed |
| Per-sensor access control (viewer-level) | Over-engineering; admin-only app |
| Email / Slack alerting on threshold breach in v1.15 | No SMTP infrastructure; deferred until provisioned |
| Server-side downsampling in v1.15 | Ship plain time-series first; add if chart performance requires |

---

## Traceability

| REQ-ID | Phase | Notes |
|--------|-------|-------|
| SEN-DB-01..08 | 38 | Schema foundation |
| SEN-BE-01..14 | 38 | Polling service + API |
| SEN-SCH-01..06 | 38 | Scheduler integration |
| SEN-FE-01..13 | 39 | Dashboard UI |
| SEN-LNCH-01..03 | 39 | Launcher tile |
| SEN-ADM-01..08 | 40 | Admin settings sub-page |
| SEN-OPS-01 | 38 | Pre-flight Docker SNMP smoke test |
| SEN-OPS-02..04 | 40 | Admin guide docs + runbook |
| SEN-I18N-01 | 39 + 40 | Namespace built cross-phase (dashboard keys in 39, admin keys in 40) |
| SEN-I18N-02 | 39 | Launcher tile label |

**Coverage:**
- Active requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 — initial v1.15 scope*
