# Stack Research — v1.15 Sensor Monitor

**Domain:** Port SNMP temperature/humidity polling into existing KPI Dashboard backend (FastAPI + asyncpg + APScheduler) and add a `/sensors` React route
**Researched:** 2026-04-17
**Confidence:** HIGH (versions verified against PyPI; pysnmp API verified against official lextudio docs)

---

## Context: What Already Exists (Do Not Re-Add)

Zero changes required for any of these — the milestone rides entirely on the existing KPI Dashboard stack:

| Area | Existing Component | Reuse For |
|------|-------------------|-----------|
| Web framework | FastAPI 0.135.x + Uvicorn | New `/api/sensors`, `/api/readings`, `/api/config/sensors`, `/api/poll-now` routes in existing `api` container |
| ORM + DB driver | SQLAlchemy 2.0 async + asyncpg 0.31 | `sensors`, `sensor_readings` tables as new async models |
| Migrations | Alembic 1.18.4 | One new revision: `sensors` + `sensor_readings` tables + indexes |
| Scheduler | APScheduler `AsyncIOScheduler` (same process as Personio sync) | Add `snmp_poll_all` job — do NOT spin up a second scheduler |
| Auth | Directus 11 JWT HS256 + `current_user` / `require_admin` deps | Gate every sensor mutation route on `role == 'Admin'`; reads visible to Admin only (tile is admin-only) |
| Config storage | Postgres (not YAML) | Sensor config lives in `sensors` table; `settings` row gets `sensor_poll_interval_seconds` / thresholds. Drop `config.yaml` pattern entirely |
| Frontend | React 19 + Vite 8 + TS + Tailwind v4 + shadcn/ui (base-ui) + wouter + TanStack Query 5 + Recharts 3.8 + react-i18next + chartDefaults tokens + SegmentedControl + DateRangeContext | New `/sensors` page under App Launcher tile; reuse NavBar/SubHeader/Card/Table/SegmentedControl (time range preset), Recharts LineChart with existing token-based theming, TanStack Query for all reads, apiClient with bearer/401-retry |
| i18n | react-i18next DE/EN | Add `sensors.*` namespace; no new i18n dependency |
| Ops | Nightly `pg_dump` sidecar | Automatically covers new sensor tables — zero work |

**Implication for plan:** this milestone is small. The only backend addition is one Python library (`pysnmp`); the only frontend addition is **zero** npm packages.

---

## Recommended Additions

### Backend — ONE new Python dependency

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| **pysnmp** | `>=7.1.23,<8.0` | Async SNMPv1/v2c/v3 client — GET and WALK over UDP | **This is the actively-maintained package** (not `pysnmp-lextudio`). See "Critical — pysnmp package naming" below. Pure Python (no net-snmp system dependency → Docker image stays slim), native asyncio integration (awaits cleanly inside FastAPI's event loop — same loop asyncpg uses), covers all three SNMP versions. Latest release 2026-04-09. |

That's it. `pyaml`, `jinja2`, and `apscheduler` from the reference `requirements.txt` are **not** ported: config moves to Postgres (no YAML), HTML moves to React (no Jinja), and APScheduler is already installed.

#### Critical — pysnmp package naming (do NOT repeat the reference impl's choice)

The reference app (`/Users/johannbechtold/Documents/snmp-monitor`) uses `pysnmp-lextudio>=5.0`. **Do not copy this.** Current state (PyPI-verified 2026-04-17):

- `pysnmp-lextudio` 6.3.0 — PyPI summary: *"A deprecated package. Please use 'pysnmp' instead."*
- `pysnmp` 7.1.23 — released 2026-04-09, maintained by LeXtudio Inc. (same org that owned `pysnmp-lextudio`). Python 3.10–3.14 support.

Between the original etingof `pysnmp` going dormant and 2024, the community used `pysnmp-lextudio` as a fork. In 2024 LeXtudio re-took control of the original `pysnmp` name on PyPI and deprecated the fork. Installing `pysnmp-lextudio` today pulls the deprecated 6.3.0 line. Install `pysnmp` directly.

**Confidence:** HIGH — verified directly against PyPI JSON API (both package pages).

#### pysnmp 7.x API — IMPORTANT migration note from reference code

The reference `app.py` uses the **old camelCase v3arch** API:
```python
from pysnmp.hlapi.asyncio import getCmd, nextCmd, UdpTransportTarget(...)
```

pysnmp 7 introduces a **new snake_case API** with explicit `v1arch` vs `v3arch` import paths, and `UdpTransportTarget` becomes an **async factory** (`.create(...)`). The old import path still works in 7.x via a compatibility shim, but the documented idiom for new code is:

```python
from pysnmp.hlapi.v3arch.asyncio import (
    CommunityData, ContextData, ObjectIdentity, ObjectType,
    SnmpEngine, UdpTransportTarget, get_cmd,
)

async def snmp_get(host: str, port: int, community: str, oid: str,
                   timeout: float = 3.0, retries: int = 1) -> float | None:
    transport = await UdpTransportTarget.create(
        (host, port), timeout=timeout, retries=retries
    )
    error_indication, error_status, error_index, var_binds = await get_cmd(
        SnmpEngine(),                   # see "SnmpEngine reuse" below
        CommunityData(community, mpModel=1),   # mpModel=1 → SNMPv2c
        transport,
        ContextData(),
        ObjectType(ObjectIdentity(oid)),
    )
    if error_indication or error_status:
        return None
    for _, value in var_binds:
        try: return float(value)
        except (TypeError, ValueError): return None
    return None
```

Use `v3arch` (not `v1arch`) because:
- v3arch works for **all** SNMP versions (v1/v2c/v3) via `CommunityData(mpModel=0|1)` or `UsmUserData(...)` — single code path.
- v1arch is a stripped-down SNMPv1-only dispatcher; would need to be replaced later if any sensor turns out to need v3 auth.
- Our sensors are v2c today (community string `public`), but keeping v3 reachable has zero code cost.

**Confidence:** HIGH — verified against `docs.lextudio.com/pysnmp/v7.1/examples/hlapi/v3arch/asyncio/`.

### Frontend — ZERO new dependencies

Verified against existing stack. All of these are already installed:

| Need | Existing Solution |
|------|-------------------|
| Time-series line chart (temp + humidity over N hours) | **Recharts 3.8.1** — already used for Sales/HR dashboards; reuse `chartDefaults.ts` tokens so dark mode works out of the box; use `ReferenceLine` for min/max thresholds |
| Time range preset selector (1h / 6h / 24h / 7d) | **SegmentedControl** component from v1.5 — drop-in |
| Data fetching + caching + auto-refetch | **TanStack Query 5.97** — `useQuery` with `refetchInterval: poll_interval_seconds * 1000` so the chart live-updates between polls without manual websockets |
| Admin forms (sensor CRUD, thresholds, interval) | **shadcn/ui** (Input, Select, Button, Card) on `@base-ui/react`; **use `render` prop, not `asChild`** (project convention) |
| Toasts for "Poll now" result, save success | Already wired in admin surfaces |
| Bilingual strings | **react-i18next** — add `sensors.*` to existing `en.json` / `de.json` |
| Routing | **wouter** — add `/sensors` route + role-gate with existing `<AdminOnly>` pattern |

**Do NOT add:** `echarts-for-react`, `apexcharts`, `react-chartjs-2`, `tremor`, `visx`, `d3` directly, or any SSE / websocket library. Polling via TanStack Query's `refetchInterval` is correct at 60-second granularity — the backend already has the reading and the tab is admin-only (low concurrency). Websockets add infrastructure (sticky sessions, connection tracking) with no user-visible benefit at this poll rate.

### Database — Plain indexed table, NOT TimescaleDB

This is the most load-bearing decision. See next section.

---

## Database Schema Decision: Plain Indexed Table

**Verdict:** Plain `sensor_readings` table with a composite `(sensor_id, recorded_at DESC)` btree index. **No partitioning. No TimescaleDB.** Revisit only if scale assumptions change by 10×.

### Scale math (from milestone brief)

| Input | Value |
|-------|-------|
| Sensors | 3 |
| Metrics per sensor | 2 (temp, humidity) |
| Poll interval | 60 seconds |
| Rows/day | `3 × 1440 = 4,320` (one row per poll per sensor, temp+hum as columns) |
| Rows/year | `~1.58M` |
| Rows/5 years | `~7.9M` |

(The milestone brief's 8.6k/day assumes one row per metric; storing both metrics in one row halves this. Either way: tiny.)

### Why plain PG wins here

1. **7.9M rows over 5 years is small for Postgres.** Performance degradation from index size swapping in/out of memory typically starts in the **tens of millions** of rows per table, not single-digit millions. Tiger Data / TimescaleDB's own published guidance acknowledges this threshold.
2. **A `(sensor_id, recorded_at DESC)` btree is already optimal** for the only two query shapes we have:
   - `WHERE sensor_id = ? AND recorded_at >= NOW() - INTERVAL '24 hours' ORDER BY recorded_at` — index range scan, sub-millisecond at this size.
   - `SELECT MAX(recorded_at) WHERE sensor_id = ?` — single btree lookup.
3. **TimescaleDB adds significant operational cost:**
   - Requires installing the TimescaleDB extension in the Postgres container (`postgres:17-alpine` does not ship with it — would need `timescale/timescaledb:latest-pg17` image or a custom Dockerfile).
   - Changes backup story: `pg_dump` of hypertables has quirks; nightly sidecar would need validation.
   - Changes Alembic story: hypertable creation is a `SELECT create_hypertable(...)` SQL call, not a native DDL — migration autogeneration doesn't know about chunks.
   - Pulls the stack into **another vendor-specific extension** alongside Directus. More surfaces to track for CVEs and major-version upgrades.
4. **Native PG declarative partitioning (monthly RANGE partitions) is also overkill.** It's a valid middle ground but adds the operational burden of creating/dropping partitions over time (solved by `pg_partman`, but that's yet another extension). At 1.58M rows/year, vacuum and the btree both handle this volume trivially.
5. **Retention is simple.** If it ever matters: one-line scheduled job `DELETE FROM sensor_readings WHERE recorded_at < NOW() - INTERVAL '2 years'` running monthly. With partitioning you'd DROP PARTITION; with 1.58M rows/year a DELETE is perfectly fine.

### When to revisit this decision

Add TimescaleDB **only if** one of these becomes true:

- Sensor count grows to 30+ **and** poll interval drops to 10s (→ ~26M rows/year)
- A downsampling / continuous aggregate requirement emerges (hourly rollup from minute data for multi-year charts)
- Compression becomes necessary (> 50GB on disk)

At v1.15 scope, none of these apply. Flag the decision in `PITFALLS.md` so future-us doesn't forget the threshold.

### Schema recommendation

```sql
-- sensors (config, one row per physical device)
CREATE TABLE sensors (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    host              TEXT NOT NULL,              -- 192.9.201.x internal IP
    port              INTEGER NOT NULL DEFAULT 161,
    community         TEXT NOT NULL DEFAULT 'public',
    temperature_oid   TEXT,
    humidity_oid      TEXT,
    temperature_scale DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    humidity_scale    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sensor_readings (append-only, one row per poll per sensor)
CREATE TABLE sensor_readings (
    id            BIGSERIAL PRIMARY KEY,
    sensor_id     INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    temperature   DOUBLE PRECISION,   -- nullable: SNMP failures record NULL, not "no row"
    humidity      DOUBLE PRECISION,
    error_code    TEXT                -- nullable: populated on SNMP error for debugging
);

CREATE INDEX idx_sensor_readings_sensor_time
    ON sensor_readings (sensor_id, recorded_at DESC);

-- Thresholds + poll interval live in the existing `settings` table
-- (same place Personio sync_interval already lives) as JSONB:
--   settings.value->>'sensor_poll_interval_seconds'
--   settings.value->>'temperature_min'  -- etc
-- (no new dedicated config table — follow the v1.3 Personio precedent)
```

Notes:
- `TIMESTAMPTZ` not `INTEGER` — the reference impl stored Unix seconds as INTEGER because SQLite has no tz type. Postgres has real timestamps; use them. Recharts displays fine from ISO-8601 out of the API.
- One row per poll with temperature + humidity as sibling columns — not one row per metric. Halves write volume and makes `SELECT ts, temperature, humidity WHERE sensor_id=?` a single index scan instead of a join/pivot.
- `error_code` column so failed polls leave a trace without nulling both value columns silently.

---

## Async SNMP Library Comparison

| Library | Latest | Python 3.12+ | Async native | Status | Recommendation |
|---------|--------|--------------|--------------|--------|----------------|
| **pysnmp** | 7.1.23 (2026-04-09) | Yes (3.10–3.14) | Yes (`asyncio`, v1arch + v3arch) | Active — LeXtudio Inc. maintained | **Use this** |
| pysnmp-lextudio | 6.3.0 | Yes | Yes | **Deprecated** — PyPI summary says "Please use pysnmp instead" | Do not use |
| pysnmplib | 5.0.24 | Yes (3.8+) | Yes | Older LeXtudio fork, superseded by pysnmp 7 | Do not use |
| aiosnmp | 0.7.2 | Yes (3.7+) | Yes (native asyncio) | Third-party, low traffic, SNMPv2c only | Do not use — no v3, smaller community |
| easysnmp | 0.2.6 | Partial — C binding to net-snmp | **No (sync only)** | Active but sync | Do not use — would block asyncio event loop on every poll, blocking asyncpg and every FastAPI request mid-poll |

**Why pysnmp over easysnmp explicitly:** easysnmp is faster per-call (C binding) but is **synchronous**. In our FastAPI+asyncpg+APScheduler process, a blocking SNMP call on the event loop stalls every concurrent HTTP request for the duration of the UDP round-trip + retries (up to ~6s with default retries). Running it in `run_in_executor` would work around this but adds thread-pool complexity and a heavier system dependency (net-snmp C libraries in the Docker image). pysnmp is pure-Python, async-native, and at 3 sensors × 60s poll the perf difference is invisible.

**Confidence:** HIGH (pysnmp versions + deprecation verified against PyPI JSON; async event-loop concern follows from basic asyncio semantics).

---

## SNMP Timeout / Retry / Event-Loop Patterns

### Recommended defaults

```python
timeout  = 3.0   # seconds per attempt — matches reference impl
retries  = 1     # total attempts = retries + 1 = 2
# Worst case per sensor call: 2 × 3s = 6s before returning None
```

These match the reference impl's `UdpTransportTarget(..., timeout=3, retries=1)` and are reasonable for an internal LAN (192.9.201.x).

### Pattern: concurrent poll of all sensors

```python
async def poll_all_sensors() -> None:
    async with AsyncSession(engine) as session:
        sensors = (await session.scalars(
            select(Sensor).where(Sensor.enabled == True)
        )).all()

        # Poll concurrently — one SNMP call blocks only itself
        results = await asyncio.gather(
            *(poll_one(s) for s in sensors),
            return_exceptions=True,   # one failing sensor must not skip the others
        )

        # Single batch insert — one round-trip to Postgres for all readings
        session.add_all([r for r in results if isinstance(r, SensorReading)])
        await session.commit()
```

Key points:
- `asyncio.gather(..., return_exceptions=True)` — one flaky sensor with a borked OID cannot break the polling cycle for the others.
- Poll → collect → **one batch INSERT**, not one INSERT per sensor. Reduces DB round-trips from 3 to 1.
- Job runs inside APScheduler's `AsyncIOScheduler` which already uses the FastAPI event loop — no cross-loop marshalling. The reference impl already does this correctly.

### SnmpEngine reuse — important

The reference `snmp_get` creates a fresh `SnmpEngine()` per call. This works but is wasteful (engine initialization loads MIB lookup tables). For our 3-sensor / 60s-interval scale it doesn't matter measurably. Recommended nuance for the plan:

- **Keep one engine per poll cycle, not per-call and not global.**
  - One global `SnmpEngine` across the process lifetime is the textbook optimization but has subtle teardown ordering issues with APScheduler shutdown in lifespan.
  - One engine per call (reference impl's approach) is safe and simple.
  - One engine per `poll_all_sensors()` invocation (3 concurrent calls share it) is the pragmatic middle.

This is a "nice to have" optimization and can be deferred. Ship with per-call engines; revisit only if CPU shows up in profiling.

### APScheduler interval updates (keep existing pattern)

The reference impl calls `scheduler.reschedule_job(...)` when the user edits the poll interval via the admin UI. Keep this pattern — it matches how v1.3 Personio interval updates already work in our codebase. No library change needed.

### Docker networking to 192.9.201.x

The `api` container must be able to reach `192.9.201.0/24`. Docker Compose default bridge networks route to the host's LAN through the host's NAT unless explicitly isolated. Two possible surprises to flag (these belong in PITFALLS, not STACK):

1. If compose sets `network_mode: internal` anywhere → outbound UDP 161 will fail silently. Current `docker-compose.yml` does not do this (no change expected) but verify in the plan.
2. UDP/161 MTU — the reference impl's `snmp_walk` can request lots of bindings; SNMP over UDP can fragment. Keep `max_results` bounded (reference uses 200) — no change required.

---

## Alembic Compatibility

The new migration is a standard create-table + create-index pair. Nothing special — Alembic autogenerate handles this cleanly. **One caveat:** ensure the migration uses `sa.TIMESTAMP(timezone=True)` (or `TIMESTAMPTZ`) not `sa.DateTime()`; the project convention elsewhere is TZ-aware.

No new Alembic extension, no offline-mode gymnastics. Standard boring migration.

---

## Alternatives Considered (And Rejected)

| Need | Recommended | Rejected Alternative | Reason |
|------|-------------|---------------------|--------|
| SNMP client | `pysnmp` 7.x | `pysnmp-lextudio` | Deprecated per PyPI — "please use pysnmp instead" |
| SNMP client | `pysnmp` 7.x | `easysnmp` | Synchronous, would block event loop; requires net-snmp C deps |
| SNMP client | `pysnmp` 7.x | `aiosnmp` | No SNMPv3 support; smaller community |
| pysnmp API path | `v3arch.asyncio` | `v1arch.asyncio` | v3arch covers v1/v2c/v3 with one code path; v1arch locks us to SNMPv1 |
| Time-series store | Plain indexed PG table | TimescaleDB hypertable | 3.1M rows/year is 10× below the threshold; adds extension/backup/migration complexity |
| Time-series store | Plain indexed PG table | Native PG declarative partitioning | Operational burden (partition creation/drop) not justified at this volume |
| Time-series store | Plain indexed PG table | `pg_partman` | Same — yet another extension for data we can trivially manage without |
| Config storage | Postgres `sensors` + `settings` | YAML file on disk (ref impl pattern) | Multi-instance-unsafe, not backed up, not migratable, invisible to admin UI |
| Templates | React page at `/sensors` | Jinja2 (ref impl pattern) | Project is a React SPA — do not introduce a second rendering paradigm |
| Chart library | Recharts (existing) | visx, ECharts | Recharts already themed, dark-mode-ready, and used across the app |
| Live updates | TanStack Query `refetchInterval` | Websockets / SSE | 60s poll cadence doesn't warrant the infra |
| Data transport | Fresh poll via "Poll now" button + scheduler | Server-Sent Events push | Same — admin-only low-concurrency tab |

---

## Installation

### Backend
```bash
# Add to backend/requirements.txt:
pysnmp>=7.1.23,<8.0

# That's the only addition. Do NOT add:
#   pysnmp-lextudio   (deprecated)
#   pyaml             (not needed — config lives in Postgres)
#   jinja2            (React replaces the templates)
#   apscheduler       (already installed)
```

### Frontend
No changes. Zero npm installs. Every component needed is already in the project.

### Docker
No changes to `docker-compose.yml` required beyond the standard rebuild of the `api` image. The `api` container already has outbound network access; SNMP to `192.9.201.x` uses UDP/161 which is unrestricted by the default bridge network.

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| `pysnmp` 7.1.23 is current and actively maintained | HIGH | PyPI JSON API direct query, upload_time 2026-04-09 |
| `pysnmp-lextudio` is deprecated | HIGH | PyPI summary explicitly states "deprecated, please use pysnmp" |
| pysnmp 7 uses `v3arch.asyncio` + `UdpTransportTarget.create()` async factory | HIGH | Official LeXtudio docs (`docs.lextudio.com/pysnmp/v7.1/`) |
| snake_case `get_cmd` is the documented 7.x idiom (old `getCmd` still works) | HIGH | LeXtudio docs + multiple 2025 articles agree |
| Plain PG indexed table adequate for ~1.6M rows/year | HIGH | TimescaleDB's own published guidance identifies "tens of millions of rows per table" as the degradation threshold; we're ~10× below |
| TimescaleDB requires custom Docker image (not in `postgres:17-alpine`) | HIGH | TimescaleDB publishes separate `timescale/timescaledb:latest-pg17` image |
| asyncio `gather(..., return_exceptions=True)` is the right resilience pattern | HIGH | Standard asyncio idiom; matches existing Personio sync pattern in this codebase |
| Recharts covers our visualization needs without additions | HIGH | Already used for Sales + HR dashboards with identical data shape (time, numeric) |
| Docker bridge network reaches 192.9.201.x by default | MEDIUM | Default compose behavior, but depends on host network config — verify in plan |

---

## Sources

- [PySNMP 7.1 v3arch asyncio examples (LeXtudio official)](https://docs.lextudio.com/pysnmp/v7.1/examples/hlapi/v3arch/asyncio/)
- [PySNMP 7.1 GET operation docs](https://docs.lextudio.com/pysnmp/v7.1/docs/hlapi/v1arch/asyncio/manager/cmdgen/getcmd)
- [PySNMP 7.1 API reference](https://docs.lextudio.com/pysnmp/v7.1/docs/api-reference)
- [pysnmp on PyPI — 7.1.23 release metadata](https://pypi.org/pypi/pysnmp/json) (verified via JSON API 2026-04-17)
- [pysnmp-lextudio on PyPI — deprecation notice](https://pypi.org/project/pysnmp-lextudio/) (summary reads: "A deprecated package. Please use 'pysnmp' instead.")
- [TimescaleDB vs PostgreSQL — when to upgrade](https://www.influxdata.com/comparison/postgres-vs-timescaledb/) (corroborated by Tiger Data's own guidance)
- [Tiger Data / TimescaleDB insert-performance threshold article](https://www.tigerdata.com/blog/postgresql-timescaledb-1000x-faster-queries-90-data-compression-and-much-more)
- [PostgreSQL 18 declarative partitioning docs](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [pg_partman extension overview — Crunchy Data](https://www.crunchydata.com/blog/time-partitioning-and-custom-time-intervals-in-postgres-with-pg_partman)
- [Managing PostgreSQL partitions with pg_partman — AWS RDS docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL_Partitions.html)
- Reference implementation (local, not public): `/Users/johannbechtold/Documents/snmp-monitor/app.py` — confirms v2c community strings, `timeout=3 retries=1`, APScheduler interval pattern
