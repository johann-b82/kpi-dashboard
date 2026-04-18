# ARCHITECTURE — v1.15 Sensor Monitor Integration

**Researched:** 2026-04-17
**Confidence:** HIGH on backend integration (verified against actual file paths); MEDIUM on Docker networking and pysnmp version pin.

---

## 1. Backend Integration Points

The existing backend is flatter than the STACK template implies — **no `app/models/` package**, and **no `app/security/` beyond `directus_auth.py`**.

| Concern | Existing file | SNMP work |
|---------|--------------|-----------|
| SQLAlchemy models | `backend/app/models.py` (flat single module: `UploadBatch`, `SalesRecord`, `AppSettings`, `PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`, `PersonioSyncMeta`) | **Append** `Sensor`, `SensorReading` — do NOT create a `models/` package |
| Pydantic schemas | `backend/app/schemas.py` | **Append** v1.15 section with `SensorRead`, `SensorCreate`, `SensorUpdate`, `SensorReadingRead`, `PollNowResult`, `SnmpProbeRequest`, `SnmpWalkRequest` |
| Routers | `backend/app/routers/{uploads,kpis,settings,sync,hr_kpis,data,me}.py` | **New:** `backend/app/routers/sensors.py` with `APIRouter(prefix="/api/sensors", dependencies=[Depends(get_current_user), Depends(require_admin)])` — entire feature is admin-only |
| Service layer | `backend/app/services/*.py` | **New:** `backend/app/services/snmp_poller.py` (`snmp_get`, `snmp_walk`, `poll_sensor`, `poll_all` — AsyncSession-based) |
| Auth | `backend/app/security/directus_auth.py` | **Reuse as-is** — `get_current_user` + `require_admin` |
| Main app wiring | `backend/app/main.py` (8 `include_router` calls) | **Modify:** add `app.include_router(sensors_router)` |
| ASGI lifespan / scheduler | `backend/app/scheduler.py` (module-level `scheduler = AsyncIOScheduler()`, job id `"personio_sync"`, `_load_sync_interval()`) | **Modify same file:** add `SENSOR_POLL_JOB_ID = "sensor_poll"`, `_load_sensor_interval`, `_run_scheduled_sensor_poll` |
| DB session | `backend/app/database.py` — `AsyncSessionLocal`, `get_async_db_session` dep | Reuse; scheduler job opens its own session `async with AsyncSessionLocal()` |
| Alembic | `backend/alembic/versions/*.py` | **New migration** — point `down_revision` to current head |
| Backend deps | `backend/requirements.txt` | **Add:** `pysnmp>=7.1.23,<8.0` (NOT `pysnmp-lextudio` — deprecated) |

**Convention call-outs (verified):**
- Routers use module-level `dependencies=[Depends(get_current_user)]` and per-endpoint `dependencies=[Depends(require_admin)]`. For sensors, put both at module level since every endpoint is admin.
- Scheduled jobs open their own session — don't use `Depends`.
- 403 body is `{"detail": "admin role required"}` — frontend `apiClient.ts` 403 handling works unchanged.

---

## 2. APScheduler — Single Scheduler, Two Jobs

**Decision: single scheduler singleton.** Verified from `scheduler.py:17` (`scheduler = AsyncIOScheduler()` module-level, exposed on `app.state.scheduler`). FastAPI allows only one `lifespan`. Adding a second scheduler would break lifespan + confuse graceful shutdown.

```python
SYNC_JOB_ID = "personio_sync"          # existing
SENSOR_POLL_JOB_ID = "sensor_poll"     # NEW

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.scheduler = scheduler
    # existing Personio wiring...
    # NEW:
    sensor_interval_s = await _load_sensor_interval()
    if sensor_interval_s > 0:
        scheduler.add_job(
            _run_scheduled_sensor_poll, "interval", seconds=sensor_interval_s,
            id=SENSOR_POLL_JOB_ID, replace_existing=True, max_instances=1,
        )
    scheduler.start()
    yield
    scheduler.shutdown()
```

**Reschedule on settings change** (matches reference `scheduler.reschedule_job` call): `PUT /api/settings` (sensor poll interval) calls `scheduler.reschedule_job(SENSOR_POLL_JOB_ID, trigger="interval", seconds=new_seconds)` in try/except.

**Gotcha:** `max_instances=1` is mandatory. 3s timeout × N sensors × 2 retries × 2 OIDs could overlap a 60s interval. Personio uses this guard too.

---

## 3. Admin Role Enforcement

```python
# backend/app/routers/sensors.py
router = APIRouter(
    prefix="/api/sensors",
    tags=["sensors"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
```

Applies to every endpoint (list, readings, poll-now, config CRUD, probe, walk).

---

## 4. Frontend Integration

| Concern | Existing file | SNMP work |
|---------|--------------|-----------|
| Routing | `frontend/src/App.tsx` | Add `<Route path="/sensors" component={SensorsPage} />`. LauncherPage is at `/` (not `/home`). |
| Launcher tile | `frontend/src/pages/LauncherPage.tsx` — `isAdmin = user?.role === "admin"` already wired but unused | Replace one coming-soon slot (or add 5th tile) with `<AdminOnly>`-wrapped Sensors tile. Icon: `Thermometer` or `Activity` from lucide-react. i18n: `launcher.tile.sensors`. |
| Sensors page | **new:** `frontend/src/pages/SensorsPage.tsx` | Follow HRPage shell pattern |
| Sensor components | — | **New folder:** `frontend/src/components/sensors/{SensorStatusCards,SensorTimeSeriesChart,PollNowButton}.tsx` |
| Admin config | `frontend/src/pages/SettingsPage.tsx`, `frontend/src/components/settings/{PersonioCard,HrTargetsCard}.tsx` | **Recommendation:** new dedicated sub-page `/settings/sensors`. Alternate: new `SensorsCard` in SettingsPage (PersonioCard pattern). **Roadmap decision at Phase 40 kickoff.** |
| API client | `frontend/src/lib/api.ts` + `apiClient.ts` | Append `fetchSensors`, `fetchSensorReadings`, `pollNow`, CRUD, probe, walk |
| Query keys | `frontend/src/lib/queryKeys.ts` | Append `sensorKeys` |
| i18n | `frontend/src/locales/{en,de}.json` | New `sensors.*` namespace, full parity |

**NavBar note:** Sensors is admin-only, accessed from launcher — do NOT add a top-nav tab.

---

## 5. Data Flow

```
APScheduler "sensor_poll" (every N seconds)
  └─ async with AsyncSessionLocal() as session
       snmp_poller.poll_all(session)
         └─ asyncio.gather over sensors
              snmp_get(host, port, community, oid)  # UDP 161 outbound
         └─ session.add(SensorReading(sensor_id, ts=UTC, temperature, humidity))
       session.commit()

GET /api/sensors/{id}/readings?hours=24
  └─ require_admin
  └─ query SensorReading WHERE sensor_id=? AND ts >= now() - interval
  └─ returns SensorReadingRead[]
     TanStack Query caches (sensorKeys.readings(id, 24))
     SensorTimeSeriesChart renders via Recharts

POST /api/sensors/poll-now
  └─ require_admin
  └─ await snmp_poller.poll_all(session)  # blocking — matches Personio POST /api/sync
  └─ returns PollNowResult { sensors_polled, errors }
     onSuccess → queryClient.invalidateQueries(sensorKeys.all)
```

**Manual poll bypasses scheduler** — directly calls `poll_all()`. Avoids `max_instances=1` blocking on-demand poll during scheduled run.

**Timeout:** add `asyncio.wait_for(poll_all(session), timeout=30)` if N>5 sensors likely (N=1 now).

---

## 6. Schema Migration

New `backend/alembic/versions/v1_15_sensor_schema.py`:

```python
op.create_table(
    "sensors",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("name", sa.String(100), nullable=False, unique=True),
    sa.Column("host", sa.String(255), nullable=False),
    sa.Column("port", sa.Integer(), nullable=False, server_default="161"),
    sa.Column("community", sa.String(100), nullable=False, server_default="public"),
    sa.Column("temperature_oid", sa.String(255), nullable=True),
    sa.Column("humidity_oid", sa.String(255), nullable=True),
    sa.Column("temperature_scale", sa.Numeric(10, 4), nullable=False, server_default="1.0"),
    sa.Column("humidity_scale", sa.Numeric(10, 4), nullable=False, server_default="1.0"),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
              server_default=sa.text("CURRENT_TIMESTAMP")),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
              server_default=sa.text("CURRENT_TIMESTAMP")),
)

op.create_table(
    "sensor_readings",
    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
    sa.Column("sensor_id", sa.Integer(),
              sa.ForeignKey("sensors.id", ondelete="CASCADE"), nullable=False),
    sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
    sa.Column("temperature", sa.Numeric(8, 3), nullable=True),
    sa.Column("humidity", sa.Numeric(8, 3), nullable=True),
)
op.create_index("ix_sensor_readings_sensor_ts", "sensor_readings", ["sensor_id", "ts"])

# app_settings singleton extensions
op.add_column("app_settings", sa.Column("sensor_poll_interval_s", sa.Integer(),
              nullable=False, server_default="60"))
op.add_column("app_settings", sa.Column("sensor_temperature_min", sa.Numeric(8,3), nullable=True))
op.add_column("app_settings", sa.Column("sensor_temperature_max", sa.Numeric(8,3), nullable=True))
op.add_column("app_settings", sa.Column("sensor_humidity_min", sa.Numeric(8,3), nullable=True))
op.add_column("app_settings", sa.Column("sensor_humidity_max", sa.Numeric(8,3), nullable=True))
```

**Thresholds live on `app_settings`, not per-sensor row** — matches reference impl + existing singleton pattern. Per-sensor override is additive if ever needed.

**Directus visibility:** add `sensors` and `sensor_readings` to `DB_EXCLUDE_TABLES` in `docker-compose.yml` (critical — otherwise Directus exposes them in Data Model UI).

**BigInteger for readings.id:** 60s × 1 sensor = ~525k rows/year. BigInt is cheap insurance.

**Seed:** one default sensor row in the migration (Produktion, 192.9.201.27, OIDs from reference `config.yaml`) so the scheduler has work from first tick.

**SQLite data.db import: skip.** Re-poll from fresh; not worth scope. Optional post-launch tool `scripts/import_legacy_sensor_sqlite.py` if ever needed.

---

## 7. Phase Breakdown — 3 Phases

**Phase 38 — Sensor backend + schema + scheduler (foundation)**
- Alembic revision: `sensors`, `sensor_readings`, `app_settings` column extensions
- `app/models.py`: `Sensor`, `SensorReading`
- `app/schemas.py`: Pydantic schemas
- `app/services/snmp_poller.py`
- `app/routers/sensors.py`: CRUD + `/readings` + `/poll-now` + `/snmp-probe` + `/snmp-walk`
- `app/main.py`: register router
- `app/scheduler.py`: add sensor job wiring
- `backend/requirements.txt`: `pysnmp>=7.1.23,<8.0`
- `docker-compose.yml`: extend `DB_EXCLUDE_TABLES`
- Seed one sensor row in migration
- **Verification:** `/api/sensors` returns seeded row; `/api/sensors/poll-now` returns 200 with data; scheduled tick populates readings. No UI yet.

**Phase 39 — /sensors dashboard UI + launcher tile**
- `frontend/src/pages/SensorsPage.tsx`
- `frontend/src/components/sensors/{SensorStatusCards,SensorTimeSeriesChart,PollNowButton}.tsx`
- `frontend/src/lib/api.ts` + `queryKeys.ts`
- `App.tsx`: `<Route path="/sensors">`
- `LauncherPage.tsx`: admin-gated Sensors tile
- Full `sensors.*` i18n DE/EN parity
- **Verification:** tile visible only to admins; page shows live data; poll-now refreshes via invalidation.

**Phase 40 — Admin settings + docs + hardening**
- Decide at kickoff: sub-page vs. card — recommend `/settings/sensors` sub-page
- Sensor CRUD form, probe + walk UI, polling interval input, thresholds
- `scheduler.reschedule_job` on interval change
- Admin guide Markdown: `docs/admin/sensor-monitor.md` (EN + DE)
- Optional: `scripts/import_legacy_sensor_sqlite.py`
- **Verification:** admin CRUD works; probe/walk tools function; interval rescheduling effective without restart; bilingual docs rendered.

**Rationale:** Phase 38 before 39 (UI needs real endpoints). Phase 39 before 40 (user-visible win ships early; admin tooling is polish).

**Cross-cutting hazards for every phase:**
- DE/EN i18n parity is a hard gate
- No direct `fetch()` — everything through `apiClient<T>()`
- No `dark:` variants — token-only Tailwind (v1.9 rule)
- D-rule parity in phase plans

---

## 8. Docker Networking to 192.9.201.27

**Most likely: no compose changes needed.**

- `api` service uses default bridge (no `networks:` or `network_mode:` override)
- Docker bridge NATs outbound through host default route
- UDP 161 outbound is standard — works if the **host** can reach the target

**Pre-flight check before Phase 38:** from Docker host, run:
```bash
snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.2
```
If this works from host, it works from container.

**If host reaches 192.9.201.27 only via non-default interface** (VPN `tun0`, bridge requiring host MAC), then `network_mode: host` on `api` is needed — but that breaks port mapping and internal DNS. **Less invasive alternative:** `macvlan` network.

**Recommendation:** assume default bridge works; add pre-flight to Phase 38 plan. Flag as PITFALL.

**`extra_hosts:` is NOT helpful** — it only rewrites DNS, not routing.

---

## 9. Open Questions / Pre-flight Items

- Exact pysnmp version pin — confirm >=7.1.23 at Phase 38 kickoff; v7 import path is `pysnmp.hlapi.v3arch.asyncio` (reference impl uses the OLD v6 `pysnmp.hlapi.asyncio` path — will break on port).
- Docker host reachability to 192.9.201.27 — ad-hoc snmpget test on deploy host.
- Admin-config UI location (sub-page vs. card) — Phase 40 kickoff decision.
- Poll interval: global in `app_settings` (recommended) vs. per-sensor. Global matches reference + Personio.

---

## Confidence Summary

| Area | Level | Reason |
|------|-------|--------|
| Backend integration | HIGH | Verified against actual file paths |
| Single-scheduler decision | HIGH | Verified from `scheduler.py` |
| `require_admin` reuse | HIGH | Pattern confirmed in `directus_auth.py` + `sync.py` |
| Frontend integration | HIGH | Verified from `App.tsx`, `LauncherPage.tsx`, `AdminOnly.tsx`, `PersonioCard.tsx` |
| Schema shape | HIGH | Mirrors v1.3 HR migration |
| Phase sizing | MEDIUM | Could shrink to 2 phases by merging 39+40 |
| Docker networking | MEDIUM | Default bridge almost certainly works; depends on host routing |
| pysnmp version | MEDIUM | Stack research recommends >=7.1.23; v7 import path change is a real porting gotcha |
