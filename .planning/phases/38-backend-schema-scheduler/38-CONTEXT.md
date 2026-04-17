# Phase 38: Backend + Schema + Scheduler — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto — decisions derived from locked OQ defaults + research (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY)

<domain>
## Phase Boundary

The sensor data pipeline exists end-to-end in the backend — PostgreSQL schema migrated, pysnmp polls seeded sensors on a scheduled cadence, admin-only `/api/sensors/*` routes return live data, community string encrypted at rest and hidden from Directus. No UI this phase.

**Covers REQs (29):** SEN-DB-01..08, SEN-BE-01..14, SEN-SCH-01..06, SEN-OPS-01.

</domain>

<decisions>
## Implementation Decisions

### Library Pins (locked by research)
- `pysnmp>=7.1.23,<8.0` (NOT `pysnmp-lextudio` — deprecated per PyPI).
- Use `pysnmp.hlapi.v3arch.asyncio` import path (v3arch covers v1/v2c/v3). Reference impl's old `pysnmp.hlapi.asyncio` path is deprecated — do not copy.
- `UdpTransportTarget.create((host, port), timeout=3.0, retries=1)` is an async factory — must be awaited.

### Schema (Alembic migration)
- Three new tables: `sensors`, `sensor_readings`, `sensor_poll_log`.
- `app_settings` singleton extended with `sensor_poll_interval_s` (default 60), `sensor_temperature_min/max`, `sensor_humidity_min/max`.
- `UNIQUE(sensor_id, recorded_at)` on `sensor_readings` + index on `(sensor_id, recorded_at DESC)`.
- `sensor_poll_log` separates liveness from data (prevents M-4 NULL-row ambiguity).
- Migration seeds one default sensor (`Produktion`, `192.9.201.27`, OIDs from reference `config.yaml`, `temperature_scale=10.0`, `humidity_scale=10.0`) so the scheduler has work from first tick.
- Autovacuum tuning on `sensor_readings` for insert-heavy workload.
- `BigInteger` IDs on `sensor_readings` and `sensor_poll_log`.
- Round-trip tested (upgrade → downgrade → upgrade on fresh DB).

### Secret Handling
- Community string stored Fernet-encrypted at rest using the existing Personio Fernet key (reuse — do not introduce a new key).
- Pydantic schemas type community as `SecretStr`; never echoed back in responses; never logged at any level.
- `sensors` + `sensor_readings` added to `DB_EXCLUDE_TABLES` in `docker-compose.yml` so Directus UI does not expose them.

### Admin Gate
- Router-level dependency: `APIRouter(prefix="/api/sensors", dependencies=[Depends(get_current_user), Depends(require_admin)])`. Every endpoint is admin-only.
- A dep-audit test enumerates `app.routes` and asserts every `/api/sensors/*` route chain contains `require_admin`.

### Scheduler
- Reuse the existing `AsyncIOScheduler` singleton in `backend/app/scheduler.py` — add one new job (`SENSOR_POLL_JOB_ID = "sensor_poll"`), do NOT instantiate a second scheduler.
- Mandatory job options: `max_instances=1`, `coalesce=True`, `misfire_grace_time=30`.
- Outer wrapper: `asyncio.wait_for(poll_all(), timeout=min(45, interval-5))`.
- `docker-compose.yml` `api` service runs with `--workers 1` (comment explains why — prevents N-fold duplicate polls).
- Retention cleanup job (daily) deletes readings + poll_log rows older than 90 days. Fixed retention (OQ-5: not admin-configurable in v1.15).
- Shared `SnmpEngine` cached on `app.state.snmp_engine` at startup — no per-call instantiation.

### Poll Semantics
- `POST /api/sensors/poll-now` is synchronous (awaits `poll_all()`) wrapped in `asyncio.wait_for(timeout=30)` — mirrors Personio `POST /api/sync` blocking pattern.
- Manual poll dedupes if last row for the sensor is <2s old.
- Writes use `ON CONFLICT (sensor_id, recorded_at) DO NOTHING`.
- `poll_all` uses `asyncio.gather(..., return_exceptions=True)` so one sensor failure does not cancel siblings.
- 3 consecutive failures surface as "offline" in `sensor_poll_log` (UI reads in Phase 39).
- Timeout defaults: `timeout=3.0, retries=2`.

### Code Structure (locked by architecture research)
- Append `Sensor`, `SensorReading`, `SensorPollLog` to the flat `backend/app/models.py` — **do NOT** create a `models/` package.
- Append new Pydantic schemas to `backend/app/schemas.py` under `# --- v1.15 Sensor schemas ---`.
- New `backend/app/services/snmp_poller.py` — pure async functions (`snmp_get`, `snmp_walk`, `poll_sensor`, `poll_all`), AsyncSession-based writes.
- New `backend/app/routers/sensors.py` — router-level admin gate, all endpoints.
- Modify `backend/app/main.py` — one `app.include_router(sensors_router)` line.
- Modify `backend/app/scheduler.py` — add job id, interval loader, runner, reschedule hook.

### CI Guardrails
- Grep checks in CI: no `import sqlite3` or `import psycopg2` in `backend/app/`; no `time.sleep` in `backend/app/services/snmp*`.
- Router dep-audit test as above.

### Gating Pre-flight (SEN-OPS-01)
- Before any business logic lands, run `docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.2` and confirm a valid reading.
- If it fails: STOP the phase and flag as blocker. Host-mode fallback (network_mode: host) is documented in Phase 40 admin guide, not in this phase.

</decisions>

<code_context>
## Existing Code Insights

- `backend/app/models.py` — flat single module (no `models/` package). Contains `UploadBatch`, `SalesRecord`, `AppSettings`, `PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`, `PersonioSyncMeta`.
- `backend/app/schemas.py` — single file with all Pydantic schemas.
- `backend/app/scheduler.py` — module-level `scheduler = AsyncIOScheduler()` singleton, exposed on `app.state.scheduler`. `SYNC_JOB_ID = "personio_sync"`, `_load_sync_interval()` reads singleton, `_run_scheduled_sync` opens its own session via `async with AsyncSessionLocal()`.
- `backend/app/security/directus_auth.py` — `get_current_user` + `require_admin` dependencies; 403 body `{"detail": "admin role required"}`.
- `backend/app/routers/sync.py` — reference pattern for module-level `get_current_user` + per-endpoint `require_admin`. For sensors, both go at module level (entire feature admin-only).
- `backend/app/services/personio_client.py` — Fernet encryption pattern for credentials at rest. Reuse the key + pattern.
- `backend/app/database.py` — `AsyncSessionLocal`, `get_async_db_session` dep.
- `backend/alembic/env.py` — async engine, `target_metadata = Base.metadata`.
- `backend/alembic/versions/*.py` — linear history; pick latest head as `down_revision`.
- `docker-compose.yml` — `api` service, `DB_EXCLUDE_TABLES` env var already used for Directus hiding.
- Reference implementation: `/Users/johannbechtold/Documents/snmp-monitor/app.py` — reveals behavior to port (not copy): scheduled poll loop, manual poll endpoint, walk/probe admin tools, threshold handling.

</code_context>

<specifics>
## Specific Ideas

- Seed sensor row values lifted from `/Users/johannbechtold/Documents/snmp-monitor/config.yaml`: `name=Produktion`, `host=192.9.201.27`, `port=161`, `community=public` (Fernet-encrypted on write), `temperature_oid=1.3.6.1.4.1.21796.4.9.3.1.5.2`, `humidity_oid=1.3.6.1.4.1.21796.4.9.3.1.5.1`, `temperature_scale=10.0`, `humidity_scale=10.0`.
- Reference the existing `_run_scheduled_sync` in `scheduler.py` for the exact `async with AsyncSessionLocal() as session` + try/except/log pattern for `_run_scheduled_sensor_poll`.
- Reference `sync.py:42-45` for the `POST /api/sync` blocking-await pattern that `POST /api/sensors/poll-now` mirrors.
- Reference Personio Fernet encryption in `personio_client.py` for the community-string encrypt/decrypt helpers.

</specifics>

<deferred>
## Deferred Ideas

- **Per-sensor threshold overrides** — OQ-4 defaults to global only. Add in future milestone if needed (DIFF-09).
- **Admin-configurable retention UI** — OQ-5 defaults to fixed 90d. `SEN-FUTURE-01`.
- **Historical SQLite `data.db` import** — OQ-6 defaults to skip. `SEN-FUTURE-02`.
- **SNMPv3 auth/priv** — not needed on internal network. `SEN-FUTURE-03`.
- **Email/Slack alerting** — OQ-8 out-of-scope; blocked on SMTP. `DIFF-02/DIFF-03`.
- **Server-side downsampling** — OQ-7 defers DIFF-04; ship plain time-series first.
- **SNMP traps (UDP 162 listener)** — explicit out-of-scope.
- **Alternate `--reschedule` semantics on interval change** — if admin changes interval, rescheduling happens inline in PUT /api/settings and logs a structured transition; no retroactive backfill.

</deferred>

<canonical_refs>
## Canonical References

- `.planning/research/SUMMARY.md` — consolidated decisions
- `.planning/research/STACK.md` — pysnmp version + API migration notes
- `.planning/research/ARCHITECTURE.md` — integration points verified against actual file paths
- `.planning/research/PITFALLS.md` — phase-mapped hazards with prevention steps
- `.planning/REQUIREMENTS.md` — 29 REQs owned by this phase
- Reference impl: `/Users/johannbechtold/Documents/snmp-monitor/app.py`, `config.yaml`

</canonical_refs>
