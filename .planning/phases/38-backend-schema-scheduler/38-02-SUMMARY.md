---
phase: 38-backend-schema-scheduler
plan: 02
subsystem: backend-api-surface
tags: [fastapi, pysnmp, v3arch-asyncio, admin-gate, secretstr, on-conflict, v1.15]
requires:
  - Plan 38-01 (Sensor/SensorReading/SensorPollLog models, SecretStr schemas, sensor_community.encrypt/decrypt, pysnmp>=7.1.23,<8.0 pin)
  - backend/app/security/directus_auth.py (get_current_user, require_admin — unchanged)
  - backend/app/database.py (AsyncSessionLocal, get_async_db_session — unchanged)
provides:
  - backend/app/services/snmp_poller (async API — snmp_get, snmp_walk, poll_sensor, poll_all)
  - PollResult + PollAllResult dataclasses (poll_all signature stable for 38-03 scheduler)
  - /api/sensors router with 9 admin-gated endpoints
  - Router-level admin gate enforced by dep-audit test (SEN-BE-13)
  - CI grep tests banning sqlite3/psycopg2/time.sleep (SEN-BE-14)
  - Schema tests locking SecretStr + no-echo contract (C-3, N-7)
affects:
  - backend/app/main.py (one import + one include_router call)
  - app.routes surface: +9 APIRoute entries under /api/sensors/*
tech-stack:
  added:
    - pysnmp 7.1.23 runtime use (import, pinned in 38-01)
  patterns:
    - pysnmp.hlapi.v3arch.asyncio import path (NOT deprecated pysnmp.hlapi.asyncio)
    - Shared SnmpEngine passed as parameter — never instantiated per call
    - asyncio.gather(*, return_exceptions=True) for per-sensor failure isolation
    - postgresql.insert().on_conflict_do_nothing on UNIQUE(sensor_id, recorded_at)
    - Router-level admin gate (APIRouter dependencies=) instead of per-endpoint
    - asyncio.wait_for(timeout=30) for POST /poll-now and POST /snmp-walk
    - _walk_cmd aliased with try/except fallback (walk_cmd → next_cmd for older pysnmp)
key-files:
  created:
    - backend/app/services/snmp_poller.py (369 lines)
    - backend/app/routers/sensors.py (294 lines)
    - backend/tests/test_sensors_admin_gate.py (81 lines)
    - backend/tests/test_snmp_poller_ci_guards.py (90 lines)
    - backend/tests/test_sensor_schemas.py (41 lines)
  modified:
    - backend/app/main.py (+2 lines — import + include_router)
decisions:
  - Router-level admin gate (APIRouter dependencies=), not per-endpoint (PITFALLS M-1)
  - POST /poll-now blocking with asyncio.wait_for(timeout=30) — mirrors Personio POST /api/sync
  - POST /snmp-walk also wrapped in 30s wait_for — prevents runaway walks freezing admin UI (C-8)
  - _walk_cmd try/except fallback (walk_cmd → next_cmd) for pysnmp 7.0.x / 7.1.x compatibility
  - Project uses httpx.AsyncClient + ASGITransport harness (not TestClient) — adopted that
    pattern in test_sensors_admin_gate.py to avoid the event-loop fragility documented in conftest.py
  - 503 returned from poll/probe/walk endpoints when app.state.snmp_engine is missing
    (lifespan population is 38-03's responsibility — plan explicitly forbids modifying scheduler.py)
metrics:
  duration_seconds: 374
  tasks_completed: 2
  files_touched: 6
  commits: 2
  completed_date: 2026-04-17
requirements-completed:
  - SEN-BE-01
  - SEN-BE-03
  - SEN-BE-04
  - SEN-BE-05
  - SEN-BE-08
  - SEN-BE-09
  - SEN-BE-10
  - SEN-BE-11
  - SEN-BE-12
  - SEN-BE-13
  - SEN-BE-14
---

# Phase 38 Plan 02: Sensor API Surface Summary

**One-liner:** Added async pysnmp service (shared-engine, v3arch.asyncio, gather-return-exceptions, on-conflict-do-nothing) and 9-endpoint admin-gated `/api/sensors/*` router wired into `app.main`; locked the contract with 16 tests (schemas, CI guards, dep-audit + 401/403/200 response shape).

## Overview

This plan landed the API-layer half of Phase 38 on top of the 38-01 DB foundation. After this plan, an admin JWT can hit `GET /api/sensors` (returns the seeded Produktion row, community omitted) and `POST /api/sensors/poll-now` (wrapped in a 30-second wait_for, writes de-duped via ON CONFLICT). The scheduler integration (lifespan-initialized `app.state.snmp_engine`, periodic job, retention cleanup, `--workers 1` guard) is deferred to 38-03 as explicitly scoped in the plan.

Zero schema changes — that lived in 38-01. Zero scheduler wiring — that's 38-03.

## What Was Built

### New service: `backend/app/services/snmp_poller.py` (369 lines)

Public async API:

| Function | Signature | Purpose |
|---|---|---|
| `snmp_get` | `(engine, host, port, community, oid, *, timeout=3.0, retries=2) -> float \| None` | Single-OID GET; never raises; returns None on any error |
| `snmp_walk` | `(engine, host, port, community, base_oid, *, max_results=200, timeout=3.0, retries=2) -> list[dict]` | Walk a subtree; returns `[{oid, value, type}]`; capped at max_results |
| `poll_sensor` | `(session, engine, sensor, *, manual=False) -> PollResult` | Poll one sensor; writes poll_log (always) and reading (on success, unless dedupe) |
| `poll_all` | `(session, engine, *, manual=False) -> PollAllResult` | Gather-poll every enabled sensor with return_exceptions=True |

**Internal helpers:**
- `_write_poll_log` — always writes one `sensor_poll_log` row
- `_write_reading_on_conflict` — uses `pg_insert(SensorReading).on_conflict_do_nothing(index_elements=["sensor_id","recorded_at"])`
- `_recent_reading_exists` — supports SEN-BE-12 manual-poll 2-second dedupe window

**Hard constants:**
- `DEFAULT_TIMEOUT = 3.0`
- `DEFAULT_RETRIES = 2` (3 total attempts per PITFALLS N-3)
- `DEFAULT_WALK_MAX = 200`
- `DEDUPE_WINDOW_S = 2`

**Guardrails enforced by CI tests:**
- Imports only from `pysnmp.hlapi.v3arch.asyncio` (grep-banned the deprecated `pysnmp.hlapi.asyncio`)
- Never instantiates `SnmpEngine()` — always accepts as parameter (PITFALLS C-1)
- Never imports `sqlite3` or `psycopg2` (PITFALLS C-2)
- Never calls `time.sleep` (`_time_module.perf_counter()` is allowed; module aliased to keep CI grep clean) (PITFALLS C-8)
- Uses `asyncio.gather(..., return_exceptions=True)` in `poll_all` (PITFALLS M-3)
- Uses `on_conflict_do_nothing` for reading writes (PITFALLS C-5)
- Decrypts community **once per poll** (not per OID), plaintext never logged (PITFALLS C-3)

**`walk_cmd` / `next_cmd` fallback:** pysnmp 7.1.x exposes both `walk_cmd` and `next_cmd` in `v3arch.asyncio`; the module tries `walk_cmd` first and falls back to `next_cmd` in a `try/except ImportError`. Verified in container (pysnmp 7.1.23): `walk_cmd` resolves cleanly.

### New router: `backend/app/routers/sensors.py` (294 lines)

All 9 endpoints are under router-level admin gate — PITFALLS M-1:

```python
router = APIRouter(
    prefix="/api/sensors",
    tags=["sensors"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
```

| Method | Path | Response model | Purpose |
|---|---|---|---|
| GET    | `/api/sensors` | `list[SensorRead]` | List sensors (community OMITTED — C-3) |
| POST   | `/api/sensors` | `SensorRead` (201) | Create; `encrypt_community(SecretStr.get_secret_value())` before persist |
| PATCH  | `/api/sensors/{sensor_id}` | `SensorRead` | Partial update; re-encrypts community if provided |
| DELETE | `/api/sensors/{sensor_id}` | 204 | Cascades readings + poll_log via FK |
| GET    | `/api/sensors/{sensor_id}/readings?hours=N` | `list[SensorReadingRead]` | Window read; 1≤hours≤8760 |
| POST   | `/api/sensors/poll-now` | `PollNowResult` | **`asyncio.wait_for(poll_all(...), timeout=30)`**; 504 on timeout |
| POST   | `/api/sensors/snmp-probe` | `dict` | Probe uncommitted draft; returns live `{temperature, humidity}` |
| POST   | `/api/sensors/snmp-walk` | `list[dict]` | Walk OID tree; wrapped in 30s wait_for (C-8) |
| GET    | `/api/sensors/status` | `list[dict]` | Per-sensor liveness — `last_attempt_at`, `last_success_at`, `consecutive_failures`, `offline` (≥3) |

**Key helper:**
```python
def _engine_from_request(request: Request):
    engine = getattr(request.app.state, "snmp_engine", None)
    if engine is None:
        raise HTTPException(503, "SNMP engine not initialized")
    return engine
```
This is the contract hand-off for 38-03 — the router reads from `request.app.state.snmp_engine`; the lifespan hook in 38-03 populates it at startup.

### main.py wiring (2 lines)

```python
from app.routers.sensors import router as sensors_router
...
app.include_router(sensors_router)
```
Positioned after `sync_router` (existing 8 routers → 9). No other changes to `main.py`. No changes to `scheduler.py`, `docker-compose.yml`, or migration files (all deferred to 38-03).

### New tests

| File | Lines | Count | Purpose |
|---|---|---|---|
| `backend/tests/test_sensor_schemas.py` | 41 | 4 | SecretStr redaction + no-echo contract (C-3, N-7) |
| `backend/tests/test_snmp_poller_ci_guards.py` | 90 | 6 | SEN-BE-14 grep guards + module shape |
| `backend/tests/test_sensors_admin_gate.py` | 81 | 6 | Route count, dep-audit, 401/403/200 contract, poll-now wait_for grep |

**Dep-audit test** (SEN-BE-13 — the machine-readable contract):
```python
def test_every_sensor_route_has_require_admin():
    for route in (r for r in app.routes if isinstance(r, APIRoute) and r.path.startswith("/api/sensors")):
        all_calls = _walk_deps(route.dependant.dependencies)  # recursive
        assert require_admin in all_calls
```
Uses the project's existing `_mint` helper from `tests.test_directus_auth` to forge Admin/Viewer JWTs with the canonical role UUIDs.

### Dedicated integration smoke (ad-hoc, not committed)

Inside a running stack:
```
$ curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/sensors       # 401
$ curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/api/sensors
  -> [{"id":1,"name":"Produktion","host":"192.9.201.27",...}]   # 1 row, NO "community" key
$ curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/api/sensors/poll-now
  -> 503 {"detail":"SNMP engine not initialized"}
```
The `503` on `/poll-now` is the intentional, contract-correct behavior for 38-02 in isolation: the engine is populated in 38-03's lifespan hook. After 38-03 lands, that curl will return a 200 with `PollNowResult`.

## poll_all signature (carry-forward for 38-03)

The scheduler job in 38-03 calls exactly this signature — stable, load-bearing:

```python
async def poll_all(
    session: AsyncSession,
    engine: SnmpEngine,
    *,
    manual: bool = False,
) -> PollAllResult
```

Scheduler wrapper (to be written in 38-03):
```python
async def _run_scheduled_sensor_poll() -> None:
    async with AsyncSessionLocal() as session:
        # Read app.state.snmp_engine at call time (module holds a reference via closure)
        await asyncio.wait_for(
            snmp_poller.poll_all(session, _engine_ref(), manual=False),
            timeout=min(45, interval_s - 5),
        )
```

## Decisions Made

1. **Router-level admin gate over per-endpoint** (PITFALLS M-1). The entire feature is admin-only; coupling the gate to the router makes it impossible to accidentally register an open endpoint. The dep-audit test walks `route.dependant.dependencies` recursively so nested `Depends(...)` are also checked — if a future contributor moves the gate off the router without adding it per-endpoint, the test fails.

2. **`POST /poll-now` blocking with `asyncio.wait_for(timeout=30)`** — mirrors the Personio `POST /api/sync` pattern already in `routers/sync.py`. The 30-second cap is a hard ceiling; a runaway sensor subtree cannot block the FastAPI worker indefinitely.

3. **`POST /snmp-walk` also wrapped in `asyncio.wait_for(timeout=30)`** — not explicitly required by the plan, but defensive against PITFALLS C-8. A malformed `base_oid` could otherwise walk an entire MIB tree. The service-level `max_results` cap is still enforced (default 200, max 500); `wait_for` is belt-and-suspenders.

4. **`_walk_cmd` aliased with `try/except` fallback** — pysnmp 7.1.x exposes `walk_cmd` in `v3arch.asyncio`; older 7.0.x exposes only `next_cmd`. The fallback keeps the service module compatible across the pin range `pysnmp>=7.1.23,<8.0` today while tolerating a minor downgrade if the pin ever drifts. Verified in container (7.1.23) that `walk_cmd` resolves.

5. **Test harness uses `httpx.AsyncClient + ASGITransport + LifespanManager`** (via the project's existing `client` fixture in `conftest.py`), not `starlette.TestClient`. The conftest has commentary on why TestClient plays poorly with async engine pools in this project; matching the existing pattern avoids reintroducing that fragility.

6. **503 on missing `app.state.snmp_engine`** — the plan explicitly forbids modifying `scheduler.py`, so the engine lifecycle belongs to 38-03. The router fails closed with a 503 until that lands, which is more diagnostic than a 500 with an `AttributeError`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Banned `time.sleep` string accidentally matched in docstring**

- **Found during:** Task 1 GREEN cycle (`test_no_time_sleep_in_snmp_services` FAILED)
- **Issue:** The module's guardrails docstring listed `"No time.sleep (C-8)"` as a rule; the CI grep test uses `\btime\.sleep\b` and matched the docstring string (the rule is a grep pattern, not semantic).
- **Fix:** Rephrased to `"No blocking sleep (C-8) — only asyncio.sleep if ever needed"` — same meaning, no banned substring.
- **Files modified:** `backend/app/services/snmp_poller.py`
- **Commit:** `a11a039` (amended as part of Task 1 GREEN — single commit)

No Rule 2/3/4 deviations. Plan boundaries (no `scheduler.py`, no `docker-compose.yml`, no migration changes) respected precisely.

### Plan acceptance-criterion clarification (not a deviation)

The plan's acceptance criteria list `grep -F '@router.get("")' backend/app/routers/sensors.py exits 0`. My implementation renders the list endpoint as `@router.get("", response_model=list[SensorRead])` — literally correct semantically (list endpoint mounted at router root), but the `-F` plain-string grep with the exact `(")` sequence doesn't match because the line continues after the closing quote. The equivalent regex grep `grep -E '^@router\.get\(""' backend/app/routers/sensors.py` matches. Verified the actual acceptance goal (list endpoint at root) via `test_sensor_routes_registered` (9 routes present) and live curl (`GET /api/sensors` → 200 with seed row).

## Deferred Issues

None.

## Carry-Forward for 38-03 (scheduler + retention + --workers 1 + SEN-OPS-01 gating)

**Critical contract:** The router reads `request.app.state.snmp_engine`. 38-03 MUST:

1. **Populate `app.state.snmp_engine` in the lifespan hook:**
   ```python
   @asynccontextmanager
   async def lifespan(app: FastAPI):
       app.state.scheduler = scheduler
       app.state.snmp_engine = SnmpEngine()  # NEW in 38-03 — shared across router + scheduler
       # ... existing Personio job setup ...
       # ... NEW: sensor_poll job (reads AppSettings.sensor_poll_interval_s) ...
       scheduler.start()
       yield
       scheduler.shutdown()
       # NOTE: SnmpEngine in pysnmp 7.x has no explicit close method; the lifespan
       # teardown just drops the reference.
   ```

2. **Add the `sensor_poll` APScheduler job** (id `SENSOR_POLL_JOB_ID = "sensor_poll"`):
   - Trigger: interval, seconds = `AppSettings.sensor_poll_interval_s` (default 60)
   - `max_instances=1, coalesce=True, misfire_grace_time=30`
   - Job entry point: `async def _run_scheduled_sensor_poll()` that opens its own `AsyncSessionLocal`, calls `asyncio.wait_for(snmp_poller.poll_all(session, app.state.snmp_engine, manual=False), timeout=min(45, interval_s - 5))`.

3. **Reschedule hook** — when `PUT /api/settings` changes `sensor_poll_interval_s`, remove the job and re-add with the new interval.

4. **Retention cleanup job** — daily, delete `sensor_readings` + `sensor_poll_log` rows older than 90 days. Fixed per OQ-5.

5. **`docker-compose.yml` `api` service** — add explicit `--workers 1` (comment why: prevents N-fold duplicate polls). Currently runs `--reload` which is dev-only and implicitly single-worker; prod must not override it.

6. **SEN-OPS-01 gating test** — `docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.2` must succeed before 38-03 completes; if it fails, network_mode: host fallback is documented in the Phase 40 admin guide but not implemented here.

**AppSettings interval** — `AppSettings.sensor_poll_interval_s` is the scheduler interval source (default 60, per 38-01 server_default). The DB accepts any positive INT today; minimum `>=5` enforcement is a Phase 40 admin-UI schema-layer concern.

## Key Links

- `backend/app/routers/sensors.py` → `backend/app/services/snmp_poller.py`: `snmp_poller.poll_all(db, engine, manual=True)` called from `POST /poll-now`; `snmp_poller.snmp_get` / `snmp_walk` called from `/snmp-probe` and `/snmp-walk`
- `backend/app/routers/sensors.py` → `backend/app/security/directus_auth.py`: `APIRouter(..., dependencies=[Depends(get_current_user), Depends(require_admin)])` — router-level gate
- `backend/app/services/snmp_poller.py` → `backend/app/security/sensor_community.py`: `decrypt_community(sensor.community)` called ONCE per `poll_sensor` invocation
- `backend/app/main.py` → `backend/app/routers/sensors.py`: `from app.routers.sensors import router as sensors_router` + `app.include_router(sensors_router)`
- `request.app.state.snmp_engine` — **contract hand-off to 38-03**: router reads, lifespan populates

## Commits

| Task | Commit | Message |
|---|---|---|
| Task 1 | `a11a039` | feat(38-02): add async snmp_poller service with shared-engine + on-conflict writes |
| Task 2 | `151ffce` | feat(38-02): add admin-gated /api/sensors router with dep-audit test |

## Self-Check: PASSED

- [x] `backend/app/services/snmp_poller.py` — FOUND (369 lines)
- [x] `backend/app/routers/sensors.py` — FOUND (294 lines)
- [x] `backend/tests/test_sensors_admin_gate.py` — FOUND (81 lines)
- [x] `backend/tests/test_snmp_poller_ci_guards.py` — FOUND (90 lines)
- [x] `backend/tests/test_sensor_schemas.py` — FOUND (41 lines)
- [x] Commit `a11a039` — FOUND in `git log --oneline`
- [x] Commit `151ffce` — FOUND in `git log --oneline`
- [x] All 16 tests PASS (`pytest tests/test_sensors_admin_gate.py tests/test_snmp_poller_ci_guards.py tests/test_sensor_schemas.py -v`)
- [x] `python -c "from app.main import app"` succeeds
- [x] 9 `/api/sensors/*` routes registered (enumerated via APIRoute introspection)
- [x] `grep -rnE "SnmpEngine\(\)" backend/app/services/` returns NO matches (C-1)
- [x] `grep -rnE "from pysnmp\.hlapi\.asyncio" backend/app/` returns NO matches (deprecated path banned)
- [x] `grep -rnE "^\s*(import (sqlite3|psycopg2)|from (sqlite3|psycopg2))" backend/app/` returns NO matches (SEN-BE-14)
- [x] Live curl: `GET /api/sensors` without token → 401; with admin token → 200 + seed row; response body has NO `community` key
- [x] Live curl: `POST /api/sensors/poll-now` with admin token → 503 `{"detail": "SNMP engine not initialized"}` (correct — engine lifecycle is 38-03)
- [x] `backend/app/scheduler.py` — UNCHANGED (plan boundary respected)
- [x] `docker-compose.yml` — UNCHANGED (plan boundary respected)
- [x] No Alembic migration files touched (plan boundary respected)
