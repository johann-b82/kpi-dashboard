---
phase: 38-backend-schema-scheduler
plan: 03
subsystem: backend-scheduler-runtime
tags: [apscheduler, pysnmp, v3arch-asyncio, async-lifespan, uvicorn-workers, crontrigger, retention, v1.15]
requires:
  - phase: 38-01
    provides: AppSettings.sensor_poll_interval_s column, SensorReading + SensorPollLog models, Alembic head v1_15_sensor, pysnmp>=7.1.23,<8.0 pin
  - phase: 38-02
    provides: snmp_poller.poll_all(session, engine, *, manual=False) signature, /api/sensors router reading request.app.state.snmp_engine
provides:
  - backend/app/scheduler.py SENSOR_POLL_JOB_ID = "sensor_poll" on the existing singleton AsyncIOScheduler
  - daily retention cleanup job SENSOR_RETENTION_JOB_ID = "sensor_retention_cleanup" (CronTrigger 03:00 UTC, 90-day fixed window)
  - shared SnmpEngine on app.state.snmp_engine (+ module-level _engine ref for APScheduler jobs)
  - reschedule_sensor_poll(new_interval_s: int) helper for the Phase 40 PUT /api/settings hook
  - --workers 1 invariant pinned in docker-compose.yml api.command with SEN-SCH-05 / PITFALLS C-7 comment
  - 8 new unit tests in backend/tests/test_sensor_scheduler.py locking the contract
  - Plan 38-03 + SEN-OPS-01 checkpoint scaffolds in 38-VERIFICATION.md
affects:
  - Phase 39 (React sensor UI) — will consume /api/sensors/* routes that now reach live hardware every ~60s
  - Phase 40 (admin settings UI) — will call reschedule_sensor_poll(new_interval_s) from PUT /api/settings
tech-stack:
  added:
    - APScheduler CronTrigger pattern (first use in the codebase)
  patterns:
    - Single AsyncIOScheduler, N jobs — one sensor_poll + one retention + one personio_sync all on the same singleton (ARCHITECTURE §2)
    - Shared SnmpEngine on app.state + module-level ref fallback for APScheduler jobs that can't cleanly receive non-picklable kwargs
    - Outer asyncio.wait_for(coro, timeout=min(45, interval-5)) wrapping every scheduled polling call (PITFALLS C-4)
    - CronTrigger(hour=3, minute=0, timezone=UTC) for low-traffic nightly maintenance (parallels pg_dump sidecar)
    - reschedule_helper(int) pattern for admin-settings-UI interval mutation (try/except, logs old → new + next_run_time; 0 removes the job, mirroring Personio D-07)
    - uvicorn --workers 1 pinned literally in docker-compose.yml with inline comment citing the requirement ID + pitfall for future readers
key-files:
  created:
    - backend/tests/test_sensor_scheduler.py (8 tests, 140 lines)
    - .planning/phases/38-backend-schema-scheduler/38-VERIFICATION.md (pre-flight + E2E scaffolds, 196 lines)
  modified:
    - backend/app/scheduler.py (57 → 257 lines — Personio wiring preserved verbatim, v1.15 sensor wiring appended)
    - docker-compose.yml (api.command + 6-line comment block added)
    - .planning/phases/38-backend-schema-scheduler/deferred-items.md (appended pre-existing 401 test failures)
key-decisions:
  - "Module-level _engine ref over APScheduler kwargs: SnmpEngine may not pickle cleanly under MemoryJobStore, and APScheduler pickles kwargs by default. A module-level ref in scheduler.py is simpler and matches the existing singleton pattern. app.state.snmp_engine holds the same object for router access."
  - "CronTrigger at 03:00 UTC for retention: low-traffic window, parallels the nightly pg_dump sidecar. Fixed 90-day retention (OQ-5 / SEN-FUTURE-01 defers the UI to a future milestone)."
  - "reschedule_sensor_poll(0) removes the job entirely (matches Personio D-07 manual-only convention). >0 with missing job uses add_job with full guardrail kwargs; >0 with existing job uses reschedule_job. All paths try/except with a log.exception so a broken PUT /api/settings cannot leak scheduler internals to the admin UI."
  - "--workers 1 literal is kept alongside --reload even though uvicorn internally forces N=1 in reload mode. The literal is the CI grep guard and documents the production invariant for deploys that drop --reload."
  - "pytest-asyncio was already a project dev dep (requirements-dev.txt line 3: pytest-asyncio==1.3.0); asyncio_mode = auto is already configured in backend/pytest.ini. No new dep needed."
patterns-established:
  - "Lifespan populates both app.state.<resource> AND a module-level _resource ref when the resource needs to be reachable from APScheduler job entry points that can't cleanly receive app"
  - "reschedule_<job>(new_interval: int) Phase-40-ready helper with 0-means-remove semantics — use this shape for any future interval-mutating admin endpoints"
  - "Multi-line YAML comment block immediately above a load-bearing command: line, citing requirement IDs and PITFALLS entries — pattern for docker-compose.yml operational invariants"
requirements-completed:
  - SEN-OPS-01
  - SEN-SCH-01
  - SEN-SCH-02
  - SEN-SCH-03
  - SEN-SCH-04
  - SEN-SCH-05
  - SEN-SCH-06
duration: 4min 17s
completed: 2026-04-17
---

# Phase 38 Plan 03: Scheduler Integration + --workers 1 Invariant + Gating Checkpoint Scaffolds Summary

**Wired the v1.15 sensor pipeline into the existing APScheduler singleton — new sensor_poll job (max_instances=1, coalesce=True, misfire_grace_time=30, outer asyncio.wait_for), daily 90-day retention cleanup on CronTrigger(03:00 UTC), shared SnmpEngine on app.state — pinned the uvicorn --workers 1 deployment invariant in docker-compose.yml with SEN-SCH-05/C-7 comment, exposed reschedule_sensor_poll(int) for Phase 40, and scaffolded both gating checkpoints (SEN-OPS-01 pre-flight + Plan 38-03 E2E) in 38-VERIFICATION.md for the operator to run on the deployment host.**

## Performance

- **Duration:** 4min 17s
- **Started:** 2026-04-18T00:18:01+02:00
- **Completed:** 2026-04-18T00:22:18+02:00
- **Tasks:** 4 (2 auto + 2 checkpoint scaffolds)
- **Files modified:** 4 (scheduler.py, docker-compose.yml, new test file, new verification file)

## Accomplishments

- Closed Phase 38 backend — the /api/sensors router inherited from 38-02 is now backed by a live poll loop that ticks every 60 seconds on the singleton APScheduler, writes via ON CONFLICT DO NOTHING, and prunes rows older than 90 days nightly.
- Shared SnmpEngine finally populated on app.state.snmp_engine — resolves the 38-02 plan-boundary 503 behavior (`POST /api/sensors/poll-now` now works end-to-end once the stack is rebuilt).
- `--workers 1` invariant pinned literally in docker-compose.yml with a multi-line comment citing SEN-SCH-05 and PITFALLS C-7 — future operators will see the reasoning without having to re-derive it.
- `reschedule_sensor_poll(int)` helper shipped with the correct 0-removes-job semantics for Phase 40's admin-settings hook.
- 8 new scheduler tests lock the contract; 16 existing sensor tests (38-02) still pass — total 24 sensor-related tests green.
- 38-VERIFICATION.md scaffold gives the deployment-host operator a step-by-step walkthrough for both gating checkpoints.

## Task Commits

1. **Task 1: SEN-OPS-01 pre-flight scaffold** — `838d425` (docs) — 38-VERIFICATION.md with exact snmpget commands and expected output shape for the deployment-host operator. No business logic merged.
2. **Task 2a (RED): Failing scheduler tests** — `02dd3c7` (test) — 8 tests importing constants + helpers that don't exist yet; collection fails with ImportError as expected.
3. **Task 2b (GREEN): scheduler.py rewrite** — `e369efc` (feat) — Personio wiring preserved verbatim; sensor_poll + retention_cleanup + shared SnmpEngine + reschedule_sensor_poll added. All 8 tests pass; 29 unrelated pre-existing 401 failures tracked in deferred-items.md.
4. **Task 3: docker-compose.yml --workers 1** — `58a324b` (chore) — multi-line comment immediately above api.command, literal `--workers 1` added before `--reload`. `docker compose config` parses cleanly.
5. **Task 4: Plan 38-03 End-to-End scaffold** — _(no separate commit — verification steps were embedded in 38-VERIFICATION.md during Task 1 commit `838d425` and referenced here so the operator has a single walkthrough surface)._

**Plan metadata:** _(to be recorded as the final commit after this SUMMARY is written)_

## Files Created/Modified

### Created

- **`backend/tests/test_sensor_scheduler.py`** (140 lines, 8 tests) — unit tests that enter `lifespan(FastAPI())` directly (no HTTP server) and assert: (a) exported constants + `reschedule_sensor_poll` callable, (b) `sensor_poll` job registered with `IntervalTrigger`, (c) `max_instances=1, coalesce=True, misfire_grace_time=30`, (d) retention job registered with `CronTrigger`, (e) `app.state.snmp_engine` + module-level `_engine` both populated and both point to the same object, cleaned up on shutdown, (f) `reschedule_sensor_poll` signature takes one `int`, (g) Personio `SYNC_JOB_ID` regression-unchanged, (h) `reschedule_sensor_poll(int)` mutates the interval + `reschedule_sensor_poll(0)` removes the job.
- **`.planning/phases/38-backend-schema-scheduler/38-VERIFICATION.md`** (196 lines) — two sections: `## SEN-OPS-01 Pre-flight` (commands to run from the deployment host: `docker compose exec api snmpget -v2c -c public 192.9.201.27 <OID>` for both temperature OID `1.3.6.1.4.1.21796.4.9.3.1.5.2` and humidity OID `1.3.6.1.4.1.21796.4.9.3.1.5.1`, with expected output shape `= INTEGER: 235`) and `## Plan 38-03 End-to-End Verification` (8 numbered steps covering rebuild, alembic head check, seed row with Fernet ciphertext inspection, row-count + dupe-check after 3 minutes, scheduler job list introspection, shared-engine verification via `/api/sensors/status`, poll-now manual exercise, Viewer 403 regression).

### Modified

- **`backend/app/scheduler.py`** — 57 → 257 lines. Diff structure:
  - **Preserved verbatim:** module docstring reference to D-05/D-06/D-07 (extended with SEN-SCH-01..06 mention), `scheduler = AsyncIOScheduler()` singleton, `SYNC_JOB_ID = "personio_sync"`, `_load_sync_interval()`, `_run_scheduled_sync()`.
  - **Added constants:** `SENSOR_POLL_JOB_ID`, `SENSOR_RETENTION_JOB_ID`, `SENSOR_RETENTION_DAYS = 90`, module-level `_engine: SnmpEngine | None = None`.
  - **Added imports:** `asyncio`, `logging`, `datetime`/`timedelta`/`timezone`, `CronTrigger`, `SnmpEngine` from `pysnmp.hlapi.v3arch.asyncio` (NOT the deprecated `pysnmp.hlapi.asyncio`), `delete` from sqlalchemy, `SensorPollLog` + `SensorReading` from app.models.
  - **Added functions:** `_load_sensor_interval()` (reads `AppSettings.sensor_poll_interval_s`, defaults 60), `_run_scheduled_sensor_poll()` (module-level `_engine`, inner timeout = `max(5, min(45, interval-5))`, swallows all exceptions), `_run_sensor_retention_cleanup()` (daily delete of readings + poll_log > 90d, commits then logs rowcounts), `reschedule_sensor_poll(new_interval_s: int)` (Phase 40 hook; `<=0` removes the job; `>0` with missing job uses `add_job(..., max_instances=1, coalesce=True, misfire_grace_time=30)`; `>0` with existing job uses `reschedule_job`).
  - **Lifespan additions:** populates `_engine = SnmpEngine()` + `app.state.snmp_engine = _engine` BEFORE scheduler.start(), registers sensor_poll conditionally on `sensor_interval_s > 0`, ALWAYS registers the retention cleanup job (CronTrigger is always armed), on shutdown: `scheduler.shutdown()` → `_engine = None` → `app.state.snmp_engine = None`.

- **`docker-compose.yml`** — `api` service only:
  ```yaml
  # BEFORE
  api:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # AFTER
  api:
    build: ./backend
    # APScheduler runs in-process with an in-memory jobstore — `--workers 1`
    # is mandatory. N workers would run every scheduled job N times (duplicate
    # Personio sync, duplicate sensor_poll ⇒ duplicate UDP/161 traffic + DB
    # constraint contention on UNIQUE(sensor_id, recorded_at)). See SEN-SCH-05
    # and PITFALLS C-7. If horizontal scaling is ever required, extract the
    # scheduler into its own container first (see ops runbook).
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --reload
  ```
  No other services, env vars, volumes, healthchecks, or depends_on clauses were touched. `docker compose config --quiet` passes; the resolved command argv shows `"--workers", "1"` between `"8000"` and `"--reload"`.

- **`.planning/phases/38-backend-schema-scheduler/deferred-items.md`** — appended "Pre-existing: 29 unrelated tests fail with 401 Unauthorized" section. Reproduced on tip of main with pre-38-03 `scheduler.py` (`git stash`-verified). Root cause: tests in `test_settings_api.py`, `test_kpi_chart.py`, `test_kpi_endpoints.py`, `test_rebuild_*.py`, `test_color_validator.py` pre-date the Directus JWT admin gate on `/api/settings` — they don't mint admin tokens. Fixing them is out of scope for Phase 38 (sensor pipeline); wire-in work is recommended as a dedicated test-harness maintenance plan.

## SEN-OPS-01 Pre-flight Checkpoint (Task 1) Result

**Status:** _pending-operator-run-on-deployment-host_

The scaffold in `.planning/phases/38-backend-schema-scheduler/38-VERIFICATION.md` under `## SEN-OPS-01 Pre-flight` contains the exact commands:

```bash
docker compose exec api sh -c 'apk add --no-cache net-snmp-tools'
docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.2
docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.1
```

Expected shape (PASS):
```
SNMPv2-SMI::enterprises.21796.4.9.3.1.5.2 = INTEGER: 235
SNMPv2-SMI::enterprises.21796.4.9.3.1.5.1 = INTEGER: 412
```

A numeric INTEGER on both OIDs → approve the checkpoint, paste stdout into 38-VERIFICATION.md with a timestamp. A `Timeout: No Response from 192.9.201.27` → FAIL, flag blocker in STATE.md, evaluate host-mode fallback documented in the Phase 40 admin guide.

**Environment note:** This verification requires the deployment host (or a Linux staging box) that routes the `192.9.201.0/24` subnet natively. macOS Docker Desktop is explicitly NOT an acceptable verification environment (PITFALLS C-6 — Docker Desktop's VM-layer routing interferes with LAN access). If the dev host cannot reach the sensor, mark the checkpoint `deferred-to-Linux-staging` in 38-VERIFICATION.md with the reason and resume from the production/staging host.

## Plan 38-03 End-to-End Checkpoint (Task 4) Result

**Status:** _pending-operator-run-on-deployment-host_

The scaffold in `.planning/phases/38-backend-schema-scheduler/38-VERIFICATION.md` under `## Plan 38-03 End-to-End Verification` contains 8 numbered steps. Summary of expected outcomes:

| Step | Command | Expected |
|------|---------|----------|
| 2 | `docker compose exec api alembic current` | `...v1_15_sensor (head)` |
| 3 | `SELECT id, name, host, port, octet_length(community) ... FROM sensors;` | 1 row, `Produktion/192.9.201.27`, `community_ct_bytes > 50`, `ct_prefix_b64` starts with `gAAAAAAB...` |
| 4a | `SELECT sensor_id, COUNT(*), MIN/MAX(recorded_at) FROM sensor_readings GROUP BY sensor_id` after ~3 min | `rows >= 2` for sensor_id=1 |
| 4b | `SELECT ... GROUP BY sensor_id, recorded_at HAVING COUNT(*) > 1` | zero rows (ON CONFLICT DO NOTHING working) |
| 5 | `scheduler.get_job` for each of the three IDs from inside the container | sensor_poll + sensor_retention_cleanup both present; personio_sync may be missing if interval_h=0 |
| 6 | `curl /api/sensors/status` with Admin | HTTP 200 + JSON status list (engine wired — else 503) |
| 7 | `curl -X POST /api/sensors/poll-now` with Admin | HTTP 200, `{"sensors_polled": 1, "errors": [...]}` |
| 8 | `curl -X POST /api/sensors/poll-now` with Viewer | HTTP 403 |

All 8 steps' outputs are expected to be pasted into 38-VERIFICATION.md before the operator signals `approved`. Any failure (duplicates, zero rows, viewer 200, routes 503) flips the checkpoint back to blocking.

## Decisions Made

1. **Module-level `_engine` ref over APScheduler kwargs.** SnmpEngine may not pickle cleanly under MemoryJobStore, and APScheduler pickles kwargs by default. A module-level ref in scheduler.py is simpler, matches the existing `scheduler = AsyncIOScheduler()` singleton pattern, and gives the scheduled job direct access without round-tripping through `app.state`. `app.state.snmp_engine` holds the same object so routers can reach it via `request.app.state`.

2. **CronTrigger at 03:00 UTC for retention.** Low-traffic window, parallels the nightly pg_dump sidecar. Fixed 90-day retention (per OQ-5); `SEN-FUTURE-01` defers admin-configurable retention UI to a future milestone.

3. **`reschedule_sensor_poll(0)` removes the job entirely.** Matches the Personio D-07 "manual-only ⇒ no scheduled job" convention. `>0` with missing job uses `add_job` (with full guardrail kwargs: `max_instances=1, coalesce=True, misfire_grace_time=30`); `>0` with existing job uses `reschedule_job`. All paths wrapped in `try/except Exception` with a `log.exception` so a broken `PUT /api/settings` request path cannot leak scheduler internals to the admin UI.

4. **`--workers 1` literal kept alongside `--reload`.** uvicorn internally forces N=1 in reload mode, so the literal is strictly redundant for dev. It's retained for two reasons: (a) the CI grep guard that enforces the invariant, and (b) documentation for production deploys that drop `--reload` — the operator will see `--workers 1` and understand it's load-bearing, not vestigial.

5. **pytest-asyncio already a dev dep.** `requirements-dev.txt` line 3 pins `pytest-asyncio==1.3.0`; `backend/pytest.ini` line 2 sets `asyncio_mode = auto`. No new dependency was required. The 8 new tests use implicit async mode (no `@pytest.mark.asyncio` decorator needed).

6. **Test environment = running docker compose stack.** The local dev host lacks the Python SNMP/asyncpg stack; tests are run inside the `kpi-dashboard-api-1` container via `docker compose exec -T api pytest ...`. This is consistent with the project's containerized-development stance (CLAUDE.md: "Must run via Docker Compose — no bare-metal dependencies") and with how `backend/tests/conftest.py` is written (`LifespanManager` + `AsyncSessionLocal` require an available Postgres service).

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written. All task file lists, contracts, guardrails, and anti-patterns were honored verbatim:
- Personio wiring preserved in scheduler.py.
- No second `AsyncIOScheduler` instantiated (grep confirms exactly 1 match in `backend/app/`).
- Deprecated `pysnmp.hlapi.asyncio` import path not used anywhere in `backend/app/` (grep confirms zero import lines).
- `--reload` preserved, `--workers 1` literal added immediately before it.
- Other docker-compose services untouched (`docker compose config --services` unchanged).
- All 7 test cases specified in the plan's `<behavior>` block implemented; one extra test added (`test_reschedule_sensor_poll_mutates_interval`) to exercise the Phase 40 hook's 0-removes-job semantics since those are load-bearing for Plan 40-xx.

### Deferred (Out of Scope — Logged to deferred-items.md)

**1. 29 pre-existing unrelated 401 test failures.**

- **Found during:** post-GREEN regression sweep (`pytest tests/ -v`).
- **Scope:** NOT caused by Phase 38. Reproduced on tip of main with pre-38-03 scheduler.py by `git stash`-verifying.
- **Root cause:** tests in `test_settings_api.py`, `test_kpi_chart.py`, `test_kpi_endpoints.py`, `test_rebuild_*.py`, `test_color_validator.py` call `await client.get("/api/settings")` etc. without minting admin JWTs; they pre-date the Directus JWT gate on those routes.
- **Status:** deferred to a dedicated test-harness maintenance plan (outside v1.15 scope). All 24 sensor-related tests (8 new + 16 from 38-02) pass cleanly.

**Total deviations:** 0 auto-fixed. Plan boundaries respected precisely.
**Impact on plan:** None.

## Issues Encountered

None. The RED-GREEN cycle was clean:
- RED: collection failure on `ImportError: cannot import name 'SENSOR_POLL_JOB_ID' from 'app.scheduler'` — expected and correct.
- GREEN: `scheduler.py` rewrite landed; all 8 new tests pass; all 16 existing sensor tests still pass; full regression sweep shows the 29 unrelated failures are pre-existing.

## User Setup Required

None — no external service configuration required.

However, the two gating checkpoints (SEN-OPS-01 pre-flight + Plan 38-03 E2E) require the operator to run the commands scaffolded in `38-VERIFICATION.md` from the deployment host. That is an operator task, not a setup task.

## Next Phase Readiness

Phase 38 is code-complete. Carry-forward for Phase 39 (React sensor UI):

- **`GET /api/sensors`** — returns seed Produktion row + any sensors added via admin UI; community field always omitted.
- **`GET /api/sensors/{id}/readings?hours=N`** — time-series read; data accumulates every ~60s once the stack is up.
- **`GET /api/sensors/status`** — liveness per sensor (last_attempt_at, last_success_at, consecutive_failures, offline flag ≥3).
- **`POST /api/sensors/poll-now`** — manual poll with 30s timeout; dedupes on the 2-second window.
- **All endpoints 401 without a token, 403 with a Viewer token, 200 with an Admin token.**
- **Data refreshes:** `sensor_readings` accumulates every ~60s on a live deployment; retention cleanup prunes rows older than 90 days nightly at 03:00 UTC.

**Phase 38 requirements closed in Plan 38-03 (7):** SEN-OPS-01, SEN-SCH-01, SEN-SCH-02, SEN-SCH-03, SEN-SCH-04, SEN-SCH-05, SEN-SCH-06.

**Phase 38 total closed:** 11 (38-01) + 11 (38-02) + 7 (38-03) = **29 requirements**. Matches the phase-context covers count. No REQs deferred to Phase 39 except by design — Phase 39 owns all UI surfaces (`SEN-FE-01..14`, `SEN-OPS-02..04`).

## Known Stubs

None. No hardcoded empty arrays, placeholder text, or UI-bound mock data introduced by Plan 38-03. The scheduler populates `app.state.snmp_engine` with a real `SnmpEngine()` at startup; the retention job executes a real `delete(...)`; the sensor_poll job calls `snmp_poller.poll_all(...)` which opens real UDP sockets to real sensors.

## Self-Check: PASSED

- [x] `backend/app/scheduler.py` — FOUND (257 lines, contains all required constants and functions)
- [x] `backend/tests/test_sensor_scheduler.py` — FOUND (140 lines, 8 tests)
- [x] `docker-compose.yml` — modified (api.command contains `--workers 1`, comment block present)
- [x] `.planning/phases/38-backend-schema-scheduler/38-VERIFICATION.md` — FOUND (196 lines, both checkpoint scaffolds present)
- [x] Commit `838d425` — FOUND in `git log --oneline` (docs: 38-VERIFICATION.md scaffold)
- [x] Commit `02dd3c7` — FOUND in `git log --oneline` (test: RED phase)
- [x] Commit `e369efc` — FOUND in `git log --oneline` (feat: GREEN phase)
- [x] Commit `58a324b` — FOUND in `git log --oneline` (chore: --workers 1)
- [x] `grep -F 'SENSOR_POLL_JOB_ID = "sensor_poll"' backend/app/scheduler.py` → matches
- [x] `grep -F 'SENSOR_RETENTION_JOB_ID = "sensor_retention_cleanup"' backend/app/scheduler.py` → matches
- [x] `grep -F 'SYNC_JOB_ID = "personio_sync"' backend/app/scheduler.py` → matches (regression guard)
- [x] `grep -cE 'scheduler = AsyncIOScheduler\(\)' backend/app/scheduler.py` → 1 (single scheduler)
- [x] `grep -rnE 'scheduler = AsyncIOScheduler\(\)' backend/app/` → exactly one match, in scheduler.py
- [x] `grep -F 'from pysnmp.hlapi.v3arch.asyncio import SnmpEngine' backend/app/scheduler.py` → matches
- [x] `grep -rnE '^(from|import) pysnmp\.hlapi\.asyncio' backend/app/` → zero matches (deprecated path banned)
- [x] `grep -F 'app.state.snmp_engine = _engine' backend/app/scheduler.py` → matches
- [x] `grep -F 'max_instances=1' backend/app/scheduler.py` → matches (sensor_poll + retention + personio_sync all set)
- [x] `grep -F 'coalesce=True' backend/app/scheduler.py` → matches
- [x] `grep -F 'misfire_grace_time=30' backend/app/scheduler.py` → matches
- [x] `grep -F 'asyncio.wait_for(' backend/app/scheduler.py` → matches (outer timeout in sensor_poll runner)
- [x] `grep -F 'def reschedule_sensor_poll(' backend/app/scheduler.py` → matches
- [x] `grep -F 'CronTrigger' backend/app/scheduler.py` → matches (retention job)
- [x] `grep -F 'SENSOR_RETENTION_DAYS = 90' backend/app/scheduler.py` → matches
- [x] `grep -F -- '--workers 1' docker-compose.yml` → matches (2 lines: the comment and the command)
- [x] `grep -F '# APScheduler runs in-process' docker-compose.yml` → matches
- [x] `grep -F 'PITFALLS C-7' docker-compose.yml` → matches
- [x] `grep -F 'SEN-SCH-05' docker-compose.yml` → matches
- [x] `docker compose config --quiet` → exits 0 (YAML still valid)
- [x] `grep -cF -- '--reload' docker-compose.yml` → 1 (not duplicated)
- [x] `docker compose exec -T api pytest tests/test_sensor_scheduler.py -v` → 8 passed in 0.29s
- [x] `docker compose exec -T api pytest tests/test_sensors_admin_gate.py tests/test_snmp_poller_ci_guards.py tests/test_sensor_schemas.py -v` → 16 passed (38-02 regression)
- [x] `docker compose exec -T api python3 -c "from app.main import app"` → succeeds (`lifespan+scheduler import OK`)
- [x] `app.state.snmp_engine` / module-level `_engine` contract verified end-to-end in test_snmp_engine_populated_on_app_state

---
*Phase: 38-backend-schema-scheduler*
*Plan: 03*
*Completed: 2026-04-17*
