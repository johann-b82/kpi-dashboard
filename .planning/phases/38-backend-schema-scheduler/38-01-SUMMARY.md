---
phase: 38-backend-schema-scheduler
plan: 01
subsystem: backend-db-schema
tags: [alembic, sqlalchemy, pydantic, fernet, snmp, sensors, v1.15]
requires:
  - FERNET_KEY env var (pre-existing, shared with Personio)
  - postgres:17-alpine (pre-existing)
  - alembic head a1b2c3d4e5f7 (HR KPI targets)
provides:
  - sensors table (config + Fernet-encrypted community)
  - sensor_readings table (BigSerial id, UNIQUE(sensor_id, recorded_at), DESC index)
  - sensor_poll_log table (liveness, per PITFALLS M-4)
  - AppSettings + 5 sensor columns (sensor_poll_interval_s + 4 thresholds)
  - Sensor / SensorReading / SensorPollLog SQLAlchemy models
  - SensorRead / Create / Update / ReadingRead / PollNowResult / SnmpProbeRequest / SnmpWalkRequest Pydantic schemas
  - app.security.sensor_community.{encrypt_community, decrypt_community}
  - pysnmp>=7.1.23,<8.0 dependency pin
  - Directus hide: sensors, sensor_readings, sensor_poll_log via DB_EXCLUDE_TABLES
affects:
  - backend/app/models.py (AppSettings extended + 3 new classes)
  - backend/app/schemas.py (SecretStr imported; 7 new schemas appended)
  - backend/requirements.txt (pysnmp pin added)
  - docker-compose.yml (Directus DB_EXCLUDE_TABLES extended)
  - backend/app/security/ (new sensor_community.py)
  - backend/alembic/versions/ (new v1_15_sensor_schema.py revision)
tech-stack:
  added:
    - pysnmp>=7.1.23,<8.0 (runtime use starts in Plan 38-02)
  patterns:
    - Fernet BYTEA for sensitive strings at rest (reuse, per Personio precedent)
    - Pydantic SecretStr at API boundary + write-only secrets (no echo in Read models)
    - Two-table schema: data (sensor_readings) vs. liveness (sensor_poll_log)
    - Per-table autovacuum reloptions for insert-heavy time-series tables
key-files:
  created:
    - backend/app/security/sensor_community.py
    - backend/alembic/versions/v1_15_sensor_schema.py
  modified:
    - backend/app/models.py
    - backend/app/schemas.py
    - backend/requirements.txt
    - docker-compose.yml
decisions:
  - Reused existing FERNET_KEY for community encryption (no second key); PITFALLS C-3
  - SensorRead OMITS community field entirely — community is write-only at the API
  - SecretStr on community in SensorCreate, SensorUpdate, SnmpProbeRequest, SnmpWalkRequest
  - Per-table autovacuum tuning on sensor_readings (vacuum_scale_factor=0.05, analyze=0.02, vacuum_insert_scale_factor=0.1) to prevent M-7 bloat
  - DESC composite index via raw op.execute (Alembic op.create_index doesn't expose DESC cleanly)
  - Seed Produktion sensor in migration upgrade() so scheduler has work from first tick
metrics:
  duration_seconds: 228
  tasks_completed: 2
  files_touched: 6
  commits: 2
  completed_date: 2026-04-18
requirements-completed:
  - SEN-DB-01
  - SEN-DB-02
  - SEN-DB-03
  - SEN-DB-04
  - SEN-DB-05
  - SEN-DB-06
  - SEN-DB-07
  - SEN-DB-08
  - SEN-BE-02
  - SEN-BE-06
  - SEN-BE-07
---

# Phase 38 Plan 01: Sensor DB Foundation Summary

**One-liner:** Alembic migration `v1_15_sensor` creates sensors/sensor_readings/sensor_poll_log + extends app_settings with 5 sensor columns + seeds Produktion with a Fernet-encrypted community; models + SecretStr schemas appended to flat modules; Directus hides the new tables.

## Overview

Landed the DB-layer foundation for Phase 38 (v1.15 Sensor Monitor). Everything downstream — the pysnmp poller (38-02), the APScheduler job and retention cleanup (38-03), the admin endpoints (38-02+), the future dashboard (39) and admin UI (40) — loads the models, imports the schemas, and queries the tables committed here. Zero runtime code; pure data shape.

## What Was Built

### New Alembic revision

| Attribute | Value |
|---|---|
| Revision ID | `v1_15_sensor` |
| Down revision | `a1b2c3d4e5f7` (HR KPI targets) |
| File | `backend/alembic/versions/v1_15_sensor_schema.py` |
| Upgrade path | Creates 3 tables + adds 5 `app_settings` columns + seeds 1 row |
| Downgrade path | Drops in reverse dependency order (readings → poll_log → sensors + columns) |

### Tables created

**`sensors`** (config — one row per device)
- `id SERIAL PK`, `name VARCHAR(100) UNIQUE NOT NULL`, `host VARCHAR(255) NOT NULL`, `port INT NOT NULL DEFAULT 161`
- `community BYTEA NOT NULL` — Fernet ciphertext, never plaintext (C-3)
- `temperature_oid VARCHAR(255) NULL`, `humidity_oid VARCHAR(255) NULL`
- `temperature_scale NUMERIC(10,4) NOT NULL DEFAULT 1.0`, `humidity_scale NUMERIC(10,4) NOT NULL DEFAULT 1.0`
- `enabled BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at TIMESTAMPTZ NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL` (both default `CURRENT_TIMESTAMP`)

**`sensor_readings`** (one row per successful poll)
- `id BIGSERIAL PK`, `sensor_id INT FK→sensors.id ON DELETE CASCADE`, `recorded_at TIMESTAMPTZ NOT NULL`
- `temperature NUMERIC(8,3) NULL`, `humidity NUMERIC(8,3) NULL`, `error_code VARCHAR(100) NULL`
- `UNIQUE(sensor_id, recorded_at)` — prevents scheduled+manual collision (C-5); use ON CONFLICT DO NOTHING
- `INDEX ix_sensor_readings_sensor_recorded_at_desc (sensor_id, recorded_at DESC)` — dominant read pattern
- Per-table autovacuum reloptions (M-7 insert-heavy tuning): `vacuum_scale_factor=0.05, analyze_scale_factor=0.02, vacuum_insert_scale_factor=0.1`

**`sensor_poll_log`** (one row per poll attempt — success OR failure)
- `id BIGSERIAL PK`, `sensor_id INT FK→sensors.id ON DELETE CASCADE`
- `attempted_at TIMESTAMPTZ NOT NULL`, `success BOOLEAN NOT NULL`
- `error_kind VARCHAR(100) NULL`, `latency_ms INT NULL`
- `INDEX ix_sensor_poll_log_sensor_attempted_at_desc (sensor_id, attempted_at DESC)`

### `app_settings` extensions (singleton row)

- `sensor_poll_interval_s INT NOT NULL DEFAULT 60`
- `sensor_temperature_min NUMERIC(8,3) NULL`
- `sensor_temperature_max NUMERIC(8,3) NULL`
- `sensor_humidity_min NUMERIC(8,3) NULL`
- `sensor_humidity_max NUMERIC(8,3) NULL`

### Seed row (Produktion sensor)

| Column | Value |
|---|---|
| `name` | `Produktion` |
| `host` | `192.9.201.27` |
| `port` | `161` |
| `community` | **Fernet ciphertext** (decrypts to `public`); NOT plaintext |
| `temperature_oid` | `1.3.6.1.4.1.21796.4.9.3.1.5.2` |
| `humidity_oid` | `1.3.6.1.4.1.21796.4.9.3.1.5.1` |
| `temperature_scale` | `10.0000` |
| `humidity_scale` | `10.0000` |
| `enabled` | `true` |

Verified via `pg_dump --data-only -t sensors`: `community` column is 96-byte hex-encoded Fernet token starting with `\\x67414141` (`gAAAA` when decoded — the Fernet prefix). Plaintext string `public` appears nowhere as a community value.

### docker-compose.yml DB_EXCLUDE_TABLES — before/after

Before (line 78):
```yaml
DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version
```

After:
```yaml
DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log
```

Three new entries appended (order preserved for diff-friendliness). Directus Data Model UI will hide sensor tables.

### New models & schemas

**SQLAlchemy models** (appended to flat `backend/app/models.py`):
- `Sensor` — includes `readings` + `poll_logs` relationships with `cascade="all, delete-orphan"`
- `SensorReading` — `sa_BigInteger` PK; indexed by (sensor_id, recorded_at)
- `SensorPollLog` — `sa_BigInteger` PK; indexed by (sensor_id, attempted_at)
- `AppSettings` extended with 5 new Mapped columns

**Pydantic schemas** (appended to `backend/app/schemas.py`):
- `SensorRead` — **omits community entirely** (write-only secret)
- `SensorCreate` — `community: SecretStr = Field(..., min_length=1)` (no default, per N-7)
- `SensorUpdate` — all fields optional; `community: SecretStr | None`
- `SensorReadingRead`, `PollNowResult`, `SnmpProbeRequest`, `SnmpWalkRequest`

### New helper module

`backend/app/security/sensor_community.py` — thin wrapper over `app.security.fernet.{encrypt,decrypt}_credential`. Pure semantic clarity at call sites (sensor code reads `encrypt_community(plaintext)` not `encrypt_credential(plaintext)`). NO new Fernet key — reuses `FERNET_KEY` env var (same key that encrypts Personio credentials).

### Dependency pin

`backend/requirements.txt` appended line: `pysnmp>=7.1.23,<8.0`
- **Not** `pysnmp-lextudio` (deprecated per PyPI summary)
- Floor `>=7.1.23` is load-bearing — fixed dispatcher resource leak on timeout paths (PITFALLS C-1)
- Ceiling `<8.0` guards against unplanned major-version churn

## Round-Trip Verification

Executed inside `kpi-dashboard-api-1` container:

```
$ alembic upgrade head           # a1b2c3d4e5f7 → v1_15_sensor (creates tables, seeds Produktion)
$ alembic downgrade -1           # v1_15_sensor → a1b2c3d4e5f7 (drops tables cleanly)
$ alembic upgrade head           # a1b2c3d4e5f7 → v1_15_sensor (re-creates, re-seeds; exactly 1 Produktion row)
$ python -c "<<verify>>"         # ROUND-TRIP + SEED + FERNET + APP_SETTINGS OK
```

The verify script asserted:
- Exactly one Produktion row exists post-round-trip
- host=192.9.201.27, port=161, scales=10.0, enabled=true
- `community` is `bytes` and does NOT contain literal `b'public'`
- `decrypt_community(row.community) == 'public'` (Fernet round-trip intact)
- `app_settings.sensor_poll_interval_s == 60` (default applied via server_default)

## Decisions Made

1. **Reused FERNET_KEY** (no second crypto stack) — PITFALLS C-3. Community ciphertext shares the same rotation lifecycle as Personio credentials.
2. **SecretStr across all community-accepting schemas** — `SensorCreate`, `SensorUpdate`, `SnmpProbeRequest`, `SnmpWalkRequest` (4 occurrences). `SensorRead` intentionally omits the field — community is write-only at the API. PITFALLS N-6/N-7.
3. **Per-table autovacuum reloptions on `sensor_readings`** — `vacuum_scale_factor=0.05`, `analyze_scale_factor=0.02`, `vacuum_insert_scale_factor=0.1`. Prevents M-7 index bloat on insert-only workload (polls every 60s × 3 sensors × 90d = ~400k rows/year).
4. **Two-table schema**: `sensor_readings` holds ONLY successful polls; `sensor_poll_log` records every attempt. Lets UI render "offline 15 min" without scanning chart dataset (PITFALLS M-4).
5. **DESC composite index via raw `op.execute`** because Alembic's `op.create_index` does not expose the DESC ordering cleanly. Downgrade uses `DROP INDEX IF EXISTS` for idempotency.
6. **Seed Produktion row inside `upgrade()`** so `alembic upgrade head` on a fresh DB produces a working system (scheduler has work from first tick).
7. **Migration encrypts inline via `cryptography.fernet.Fernet`** rather than importing `app.security.fernet` — Alembic's path setup differs from the app in some edge cases; inlining the key read + Fernet instantiation guarantees correctness. Upgrade raises `RuntimeError` if `FERNET_KEY` is missing (fail loud, not silent plaintext).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes needed; no Rule 4 architectural escalations.

## Deferred Issues

Logged in `.planning/phases/38-backend-schema-scheduler/deferred-items.md`:

- Pre-existing: `alembic downgrade base` fails on `7022a1dfd988` because its downgrade path sets `end_time NOT NULL` on rows containing NULL values. This is NOT caused by Phase 38 changes. Plan 38-01's own round-trip (upgrade head → downgrade -1 → upgrade head) is **unaffected** and passes — that is the binding contract for SEN-DB-08.

## Carry-Forward for 38-02 (pysnmp service + router)

- `Sensor.community` is `bytes` (Fernet ciphertext). Services calling `snmp_get` / `snmp_walk` MUST call `decrypt_community(sensor.community)` before passing the plaintext to pysnmp's `CommunityData(...)`.
- The shared `SnmpEngine` will live on `app.state.snmp_engine` (Phase 38 decision). Do NOT instantiate per call.
- Use the `v3arch.asyncio` import path: `from pysnmp.hlapi.v3arch.asyncio import ...` (NOT the deprecated `pysnmp.hlapi.asyncio` path used in the reference impl).
- Writes to `sensor_readings` should use `INSERT ... ON CONFLICT (sensor_id, recorded_at) DO NOTHING` to dedupe scheduled+manual poll collisions (SEN-BE-11).

## Carry-Forward for 38-03 (scheduler + retention)

- `AppSettings.sensor_poll_interval_s` is the scheduler interval source. Default is 60 seconds (applied via server_default at DB level).
- Minimum enforcement (`>=5`) is a schema-layer concern deferred to Phase 40 admin UI — NOT this phase. The DB accepts any positive INT today.
- Retention cleanup job deletes `sensor_readings` AND `sensor_poll_log` rows older than 90 days. Fixed retention per OQ-5 decision.
- docker-compose `api` service MUST run with `--workers 1` before the scheduler lands (avoids N-fold duplicate polls). The current command is `--reload` (dev default), still single-worker; Plan 38-03 will add the explicit `--workers 1` guard + comment for prod.

## Key Links

- `v1_15_sensor_schema.py` → `models.py`: migration shape mirrors SQLAlchemy models (autogenerate diff should be empty post-upgrade)
- `sensor_community.py` → `security/fernet.py`: reuses `_get_fernet()` — same FERNET_KEY env
- `schemas.py::SensorCreate.community` → `models.py::Sensor.community`: `SecretStr` plaintext is encrypted via `encrypt_community` before persisting as BYTEA
- `docker-compose.yml::DB_EXCLUDE_TABLES` → sensor tables: Directus Data Model UI hides `sensors`, `sensor_readings`, `sensor_poll_log`

## Commits

| Task | Commit | Message |
|---|---|---|
| Task 1 | `ec38bb7` | feat(38-01): add pysnmp pin, sensor models, and SecretStr schemas |
| Task 2 | `f4bab7c` | feat(38-01): add v1.15 Alembic migration + Directus hide for sensor tables |

## Self-Check: PASSED

- [x] `backend/app/security/sensor_community.py` — FOUND
- [x] `backend/alembic/versions/v1_15_sensor_schema.py` — FOUND
- [x] Commit `ec38bb7` — FOUND in `git log --oneline`
- [x] Commit `f4bab7c` — FOUND in `git log --oneline`
- [x] `alembic heads` returns `v1_15_sensor (head)`
- [x] Task 1 verify (`OK`) — PASSED
- [x] Task 2 verify (`ROUND-TRIP + SEED + FERNET + APP_SETTINGS OK`) — PASSED
- [x] `docker compose config` shows `sensors,sensor_readings,sensor_poll_log` in DB_EXCLUDE_TABLES — VERIFIED
- [x] pg_dump smoke: plaintext `public` does NOT appear as a community value — VERIFIED
