# Research Summary — v1.15 Sensor Monitor

**Milestone:** v1.15 — Port standalone SNMP temperature/humidity monitor into the KPI Dashboard monorepo as an admin-only launcher app.
**Synthesised:** 2026-04-17
**Source files:** [STACK.md](./STACK.md) · [FEATURES.md](./FEATURES.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PITFALLS.md](./PITFALLS.md)
**Overall confidence:** HIGH (versions PyPI-verified; integration points verified against real file paths; pitfalls grounded in direct inspection of both the reference impl and the existing scheduler)

---

## 1. Executive Summary

v1.15 is a **port, not greenfield.** The standalone `snmp-monitor` MVP at `/Users/johannbechtold/Documents/snmp-monitor` already proves polling + threshold + chart UX; our job is to re-implement that behaviour inside the KPI Dashboard's design language and drop duplicated host infrastructure (Jinja templates, SQLite, YAML, standalone FastAPI). Everything rides the existing stack: FastAPI + SQLAlchemy async + asyncpg + APScheduler + Directus JWT + React 19 + Recharts + TanStack Query + react-i18next + Tailwind v4 tokens. **One new backend dependency (`pysnmp>=7.1.23,<8.0`). Zero frontend dependencies.**

Load-bearing decisions: (a) plain indexed Postgres, NOT TimescaleDB (10× below threshold); (b) reuse existing `AsyncIOScheduler` singleton — add `sensor_poll` job alongside `personio_sync`; (c) pysnmp `v3arch.asyncio` — reference impl uses deprecated `pysnmp-lextudio` + old v6 import path; both replaced on port; (d) admin-only at router level.

Biggest risks are integration-shaped: Docker bridge reachability to `192.9.201.x` (must be smoke-tested from inside `api` container before business logic), community-string as secret (Fernet-encrypt, `SecretStr`, Directus-hidden), APScheduler re-entry. All preventable with Phase 38 guardrails. Three-phase roadmap is right-sized.

---

## 2. Key Decisions (Consolidated)

### Stack additions

| Layer | Addition | Version | Notes |
|---|---|---|---|
| Backend | `pysnmp` | `>=7.1.23,<8.0` | **Not** `pysnmp-lextudio` (deprecated). Fixes dispatcher leak in <7.1.22. |
| Backend | — | — | Reference's `pyaml`, `jinja2`, `apscheduler` not ported (config → Postgres; templates → React; scheduler already installed) |
| Frontend | — | — | **Zero npm installs.** All deps already present. |
| Docker | — | — | No compose changes beyond `DB_EXCLUDE_TABLES` + `--workers 1` guard comment |

### pysnmp API idiom (mandatory)

```python
from pysnmp.hlapi.v3arch.asyncio import (
    CommunityData, ContextData, ObjectIdentity, ObjectType,
    SnmpEngine, UdpTransportTarget, get_cmd,
)
# UdpTransportTarget is now an async factory — await .create(...)
transport = await UdpTransportTarget.create((host, port), timeout=3.0, retries=1)
```

Reference impl uses deprecated v6 path `pysnmp.hlapi.asyncio`. Replace on port, don't copy.

### Schema shape

Three new tables + `app_settings` singleton extensions:

```sql
CREATE TABLE sensors (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    host TEXT NOT NULL, port INT NOT NULL DEFAULT 161,
    community TEXT NOT NULL,           -- Fernet-encrypted; SecretStr at API
    temperature_oid TEXT, humidity_oid TEXT,
    temperature_scale NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    humidity_scale    NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    sensor_id INT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    temperature NUMERIC(8,3), humidity NUMERIC(8,3),
    error_code TEXT,
    UNIQUE (sensor_id, recorded_at)
);
CREATE INDEX ix_sensor_readings_sensor_ts ON sensor_readings (sensor_id, recorded_at DESC);

CREATE TABLE sensor_poll_log (           -- liveness, NOT data (PITFALLS §M-4)
    id BIGSERIAL PRIMARY KEY,
    sensor_id INT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL,
    success BOOLEAN NOT NULL,
    error_kind TEXT, latency_ms INT
);

-- app_settings gains:
--   sensor_poll_interval_s INT DEFAULT 60
--   sensor_temperature_min/max, sensor_humidity_min/max
```

**Two-table decision:** `sensor_readings` only holds successful polls; `sensor_poll_log` records every attempt. Separates data from liveness; UI can render "offline 15 min" without scanning chart dataset.

**Seed row:** one default sensor (`Produktion`, `192.9.201.27`) so scheduler has work from first tick.

### Admin gate pattern

```python
router = APIRouter(
    prefix="/api/sensors", tags=["sensors"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
```

Every `/api/sensors/*` route is admin-only. Test enumerates `app.routes` asserting admin dep present.

### Scheduler pattern

```python
SENSOR_POLL_JOB_ID = "sensor_poll"
scheduler.add_job(
    _run_scheduled_sensor_poll, "interval", seconds=sensor_interval_s,
    id=SENSOR_POLL_JOB_ID, replace_existing=True,
    max_instances=1, coalesce=True, misfire_grace_time=30,
)
```

Non-negotiables: `max_instances=1`, `coalesce=True`, outer `asyncio.wait_for(poll_all(), timeout=min(45, interval-5))`. `--workers 1` comment in compose is mandatory.

### Frontend integration

| Surface | Decision |
|---|---|
| Route | `/sensors`, admin-only |
| Launcher tile | Add 5th tile or replace coming-soon slot in `LauncherPage.tsx`, admin-gated. `Thermometer` icon. |
| Page shell | Mirror `HRPage` |
| Chart | Recharts `LineChart` + `ReferenceLine`; extend `chartDefaults.ts` with `sensorPalette` |
| Time window | `SegmentedControl`: `1h · 6h · 24h · 7d · 30d`. Local state — NOT `DateRangeContext`. |
| Data fetch | `refetchInterval: 15_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`, `staleTime: 5_000` |
| Admin config | Dedicated sub-page `/settings/sensors` (recommended) vs. card on `/settings`. Phase 40 kickoff. |
| i18n | `sensors.*` namespace, full DE/EN parity — hard gate |
| Styling | Token-only Tailwind, no `dark:`, no hex literals |

### Phase sizing

Three phases:
1. **Phase 38** — Backend + schema + scheduler
2. **Phase 39** — `/sensors` dashboard UI + launcher tile
3. **Phase 40** — Admin settings + docs + hardening

---

## 3. Top Risks (with Phase Mapping)

Full list in [PITFALLS.md](./PITFALLS.md):

| # | Risk | Phase | Guardrail |
|---|------|-------|-----------|
| C-1 | `SnmpEngine()` per call → RAM leak | 38 | Shared engine on `app.state.snmp_engine`; `pysnmp>=7.1.23` |
| C-2 | Sync DB calls from ref impl block event loop | 38 | `AsyncSessionLocal` only; CI grep ban |
| C-3 | Community string leaked in logs / Directus / pg_dump | 38 | Fernet-encrypt; `SecretStr`; `DB_EXCLUDE_TABLES` |
| C-4 | APScheduler job re-entry | 38 | `max_instances=1, coalesce=True`; `wait_for` |
| C-5 | Duplicate rows from scheduled + manual poll | 38 | `UNIQUE(sensor_id, recorded_at)` + `ON CONFLICT DO NOTHING` |
| C-6 | Docker bridge cannot reach 192.9.201.x | 38 | Pre-flight in-container `snmpget`; host-mode fallback documented |
| C-7 | `uvicorn --workers N>1` runs jobs N times | 38 | `--workers 1` + compose comment |
| C-8 | `time.sleep` blocks loop | 38 | CI grep ban in `services/snmp*` |
| M-3 | `asyncio.gather` default cancels siblings | 38 | `return_exceptions=True` |
| M-4 | NULL-row flood confuses offline vs. no data | 38 | Two-table schema |
| M-5 | TanStack refetch fights poll cadence | 39 | 15s + 5s stale + invalidate on "Poll now" |
| M-6 | Migration not idempotent | 38 | Round-trip test; full reverse drop |
| M-7 | Index bloat on insert-only table | 38 | Per-table autovacuum; retention DELETE |
| N-3 | UDP loss → "offline" false positive | 38 | `retries=2, timeout=2`; 3-consecutive threshold |
| N-6/N-7 | "public" default community; Pydantic echoing secrets | 40 | `SecretStr` no default, `min_length=1`; admin guide |

**Critical-path:** C-6 gates everything. C-3 bakes into Phase 38 schema.

---

## 4. Open Questions (need user input before REQUIREMENTS.md)

| # | Question | Default |
|---|----------|---------|
| OQ-1 | Sensor count at ship time | Assume 3 |
| OQ-2 | Admin UX: sub-page `/settings/sensors` or card on `/settings`? | Sub-page |
| OQ-3 | Polling interval: global or per-sensor? | Global on `app_settings` |
| OQ-4 | Thresholds: global or per-sensor overrides (DIFF-09)? | Global MVP; per-sensor deferred |
| OQ-5 | Retention: fixed 90d or admin-configurable? | Fixed 90d |
| OQ-6 | Legacy SQLite `data.db` import? | Skip |
| OQ-7 | Differentiators: DIFF-01 (deltas), DIFF-04 (downsample), DIFF-10 ("OK seit X")? | Ship DIFF-01+DIFF-10; defer DIFF-04 |
| OQ-8 | Alerting (DIFF-02/03) explicit out-of-scope confirm? | Out of scope (no SMTP) |

---

## 5. Suggested REQ-ID Groups

| Prefix | Scope | Est. | Phase |
|--------|-------|------|-------|
| **SEN-DB-*** | Alembic migration, tables, indexes, autovacuum, seed, DB_EXCLUDE_TABLES, Fernet | 6–8 | 38 |
| **SEN-BE-*** | `snmp_poller`, `/api/sensors/*` routes, `require_admin`, `SecretStr`, exception boundaries | 10–14 | 38 |
| **SEN-SCH-*** | APScheduler job, guards, reschedule, `--workers 1`, retention cleanup | 4–6 | 38 |
| **SEN-FE-*** | `/sensors` page, cards, charts, time-window, Poll-now, freshness, thresholds | 10–12 | 39 |
| **SEN-LNCH-*** | Launcher admin tile + icon + i18n | 2–3 | 39 |
| **SEN-ADM-*** | Admin settings sub-page, CRUD, probe/walk, poll-interval, thresholds | 6–8 | 40 |
| **SEN-OPS-*** | Docker SNMP smoke test, admin guide (EN+DE), host-mode runbook | 3–5 | 38 + 40 |
| **SEN-I18N-*** | `sensors.*` parity gate, "du" tone | 1–2 | Cross-phase |

**Total:** ~42–58 REQs.

---

## 6. Suggested Phase Structure

### Phase 38 — Backend + Schema + Scheduler
API testable via curl, scheduler producing readings, zero UI.
- Alembic migration, `pysnmp>=7.1.23`, models, schemas, `snmp_poller.py`, router with `require_admin`, scheduler wiring
- `DB_EXCLUDE_TABLES` + `--workers 1`; Fernet for community; CI grep checks; router dep-audit test
- **Gating:** `docker compose exec api snmpget ...` against 192.9.201.x must succeed

### Phase 39 — Dashboard UI + Launcher Tile
Admin clicks tile → sees live data with auto-refresh.
- `SensorsPage.tsx`, `components/sensors/*`, `sensorPalette`, route + admin-gated tile
- API client + query keys; `useSensorReadings` with refetch + stale + focus
- SegmentedControl time-window; full `sensors.*` DE/EN parity
- Optional DIFF-01 + DIFF-10
- **Verify:** viewer can't see tile; admin sees live data; Poll-now invalidates

### Phase 40 — Admin Settings + Docs + Hardening
Admin onboards sensors from UI; operator has runbook.
- Kickoff decision: sub-page (recommended) vs. card
- CRUD form; probe + walk (collapsible); poll-interval input → reschedule; global thresholds
- Admin guide: `docs/admin/sensor-monitor.{en,de}.md`
- Optional SQLite import script if OQ-6 reversed
- **Verify:** admin CRUD works; probe/walk work; interval change effective without restart; bilingual docs

---

## 7. Confidence

| Area | Level |
|------|-------|
| Stack additions | HIGH |
| Schema shape | HIGH |
| Backend integration | HIGH |
| Admin-gate | HIGH |
| Single-scheduler | HIGH |
| Frontend integration | HIGH |
| Pitfalls | HIGH |
| Phase sizing | MEDIUM (39+40 could merge) |
| Docker networking | MEDIUM (Linux default likely; Mac dev needs snmpsim) |
| Retention details | LOW (OQ-5 needs user input) |

---

## 8. Sources

- [PySNMP 7.1 v3arch asyncio examples](https://docs.lextudio.com/pysnmp/v7.1/examples/hlapi/v3arch/asyncio/)
- [PySNMP 7.1 changelog — dispatcher leak fix](https://docs.lextudio.com/pysnmp/v7.1/changelog)
- [APScheduler 3.x user guide + FAQ](https://apscheduler.readthedocs.io/en/3.x/)
- [SQLAlchemy 2.0 Async I/O](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [PostgreSQL TIMESTAMPTZ](https://www.postgresql.org/docs/current/datatype-datetime.html)
- PyPI direct query 2026-04-17: `pysnmp` 7.1.23 current; `pysnmp-lextudio` deprecated
- [TimescaleDB vs Postgres threshold](https://www.influxdata.com/comparison/postgres-vs-timescaledb/)
- [pganalyze VACUUM tuning](https://pganalyze.com/blog/5mins-postgres-tuning-vacuum-autovacuum)
