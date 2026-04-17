# Domain Pitfalls: v1.15 Sensor Monitor Integration

**Domain:** SNMP polling + time-series persistence + APScheduler integration inside an existing FastAPI + Postgres + React + Directus stack
**Researched:** 2026-04-17
**Reference implementation reviewed:** `/Users/johannbechtold/Documents/snmp-monitor/app.py` (standalone FastAPI + SQLite + YAML + APScheduler)
**Existing codebase reviewed:** `backend/app/scheduler.py` (Personio APScheduler pattern), `docker-compose.yml` (4-container bridge network), `backend/app/services/hr_sync.py` (existing async-sync pattern)

**Scope:** pitfalls specific to ADDING these features to the running v1.14 stack — not generic SNMP advice.

---

## Critical Pitfalls

### C-1: New `SnmpEngine()` per poll call (reference impl has this bug)

**What goes wrong:** `backend/app/services/snmp_client.py` (port from `app.py:172`) calls `SnmpEngine()` inside `snmp_get()` — a new engine object every poll, per sensor, per OID. On 5 sensors × 2 OIDs × 60-second interval, that's 14,400 engine instantiations per day per pod.

**Why it happens:** copy-pasted from the standalone reference, where the bug is harmless because the app serves one user. Inside the shared `api` container it competes with Personio sync + KPI aggregation on the same event loop.

**Consequences:**
- ~1 MB / 6 s RAM leak when SNMP requests time out (documented pysnmp issue — timeout path doesn't free UDP transport state cleanly in versions < 7.1.22)
- Initialization overhead (`__manageColumns`, MIB symbol export) on every call
- UDP source-port churn — every engine opens a new ephemeral socket, which makes firewall debugging harder

**Prevention:**
- Instantiate **one** `SnmpEngine` in the app startup path (`scheduler.py` lifespan) and stash it on `app.state.snmp_engine`.
- Polling coroutine receives the engine as a parameter; never calls `SnmpEngine()` directly.
- Pin `pysnmp >= 7.1.23` (the version that fixed the dispatcher resource leak).
- Add a test: `poll_all()` runs 1000 iterations against a mock transport; `tracemalloc` diff < 5 MB.

**Detection:** `docker stats kpi-dashboard-api-1` RSS creeping up over 24 hours; compare v1.14 baseline RSS to v1.15.

**Phase mapping:** **Phase 38 (SNMP client service) MUST include the shared-engine pattern and pin pysnmp version.**

**Confidence:** HIGH (pysnmp 7.1 changelog + multiple GitHub issues + direct code inspection of reference impl).

---

### C-2: Blocking sync `sqlite3` calls copied into the async `api` container

**What goes wrong:** The reference impl uses `sqlite3.connect(DB_PATH)` with a synchronous `with` block inside async functions (`app.py:147-152`). Naïvely lifting this into the `api` container — even if the SQL target is rewritten to Postgres — risks another copy-paste trap: calling a sync `psycopg2`/`psycopg.Connection` from inside an `async def` coroutine, blocking the event loop.

**Why it happens:** the reference is not async-aware. A hurried port may leave `sqlite3` calls replaced with `psycopg2`, which is also sync. Meanwhile the rest of the backend uses `AsyncSession` / asyncpg.

**Consequences:** every poll cycle blocks the event loop for 50–500 ms per insert. During the block, `/api/sales/*`, `/api/hr/*`, and Directus-JWT validation all stall. Under load, uvicorn starts dropping requests.

**Prevention:**
- All sensor DB access goes through the **existing** `AsyncSessionLocal` from `app.database`. Follow the pattern in `backend/app/services/hr_sync.py` — open a session per poll cycle, not per insert.
- **Never import `sqlite3` or `psycopg2` anywhere in `backend/app/`.** Add a grep check to CI: `! grep -rnE "import (sqlite3|psycopg2)" backend/app/`.
- Add one integration test that runs `asyncio.gather(poll_all(), fetch_summary_endpoint())` concurrently and asserts both complete within 2× their individual baselines (= no blocking).

**Detection:** `uvicorn --log-level debug` — look for >200 ms gaps between accepted-request and response-sent logs during poll cycles.

**Phase mapping:** **Phase 38 (SNMP + DB) MUST use AsyncSessionLocal and pass the CI grep check.**

**Confidence:** HIGH (direct code inspection + existing project convention).

---

### C-3: Community string leaked in logs and stored in plaintext

**What goes wrong:** The reference impl logs SNMP errors with the host but has no explicit redaction of the community string — and happily accepts it in `/api/config` request bodies and logs it via Pydantic's default `__repr__` on validation errors. `config.yaml` stores community strings as plaintext. When ported, the same pattern would put plaintext community strings in the Postgres `sensors` table.

**Why it happens:** community strings are "just a string" in SNMP v2c. Developers treat them as configuration, not as credentials. In reality a v2c community gives read access to temperature, humidity, uptime, interface stats, and often interface descriptions — it is a secret.

**Consequences:**
- Community strings end up in `docker logs api` (accessible to anyone who can shell into the host)
- Directus `/items/sensors` exposes them to any authenticated user (Directus doesn't know the field is sensitive) — but we plan to exclude the `sensors` table from Directus via `DB_EXCLUDE_TABLES`, which mitigates this specific exposure.
- A routine `pg_dump` backup (nightly backup sidecar, `.planning/PROJECT.md`) propagates them into on-disk backups with world-readable defaults.

**Prevention:**
- Encrypt `sensors.community` at rest with the same **Fernet key already used for Personio credentials** (`.planning/PROJECT.md` references this in v1.3). Reuse the encryption helpers — do not introduce a second crypto layer.
- Add `community` to the Pydantic schema as `SecretStr`; FastAPI will redact it in error responses.
- Use a structured-logger formatter that strips the `community` key from log records (wrap `log.warning(...)` with a helper that takes the sensor object and logs only `sensor.name` + `sensor.host`).
- Add the `sensors` table name to the `DB_EXCLUDE_TABLES` env var in `docker-compose.yml` (alongside existing Alembic-managed tables) — belt-and-suspenders even though the table will be admin-only anyway.
- Add the sensors backup volume path to the documented 0600-permissions expectation in `docs/admin-guide/system-setup.{en,de}.md`.

**Detection:** `grep -i "community" backups/*.sql | grep -v "^--"` should return zero non-comment matches (ciphertext only).

**Phase mapping:** **Phase 39 (sensor config schema + Alembic migration) MUST encrypt community at rest and SecretStr at the API boundary; admin-guide update in Phase 43.**

**Confidence:** HIGH (direct code inspection of reference impl + project's existing Fernet pattern).

---

### C-4: APScheduler job re-entry when a poll cycle exceeds the interval

**What goes wrong:** The reference impl registers `scheduler.add_job(poll_all, "interval", seconds=60)` without `max_instances` or `coalesce`. If 5 sensors × 3 s timeout × 1 retry = up to 30 s of sequential waits (or longer with `asyncio.gather` but still bounded by the slowest sensor), a slow/offline host during a poll will cause the next 60-second tick to fire — but the previous run may still be in-flight. By default APScheduler allows the second run to start, and two poll cycles race on the same DB session / same UDP source ports.

**Why it happens:** APScheduler's defaults are permissive: `max_instances=1` is the documented default, but `coalesce=False`. Worse, the reference impl doesn't set `max_instances` explicitly — it relies on the default. When copy-pasted into an unfamiliar codebase, someone may bump `max_instances=3` "to be safe" and hit the re-entry bug.

**Consequences:**
- Duplicate rows for the same `(sensor_id, poll_tick)` if the unique constraint isn't in place (see C-5)
- Inconsistent "last seen" values in the UI
- If polling ever hits a deadlock on the UDP side (host stopped responding mid-query), the scheduler's ThreadPoolExecutor fills up

**Prevention:**
- **Always** pass `max_instances=1, coalesce=True, misfire_grace_time=30` on the sensor poll job. Match the existing Personio pattern in `backend/app/scheduler.py:52` which already uses `max_instances=1`.
- Poll cycle itself must bound its own runtime: `asyncio.wait_for(poll_all(), timeout=min(45, interval - 5))`. Aborting a poll is better than overlapping with the next.
- On every poll, log `scheduler.get_job(JOB_ID).next_run_time` after completion — if consistently > 2 intervals away, the job is chronically late and interval should be widened.

**Detection:** Log a warning when a poll cycle takes > 80% of the configured interval.

**Phase mapping:** **Phase 40 (APScheduler integration) MUST mirror the existing Personio job settings exactly: `max_instances=1, coalesce=True, replace_existing=True`, plus add `misfire_grace_time=30` and an outer `asyncio.wait_for` timeout.**

**Confidence:** HIGH (APScheduler docs + existing code pattern in `backend/app/scheduler.py`).

---

### C-5: Unique constraint missing on `(sensor_id, recorded_at)` — duplicate rows on manual + auto poll collision

**What goes wrong:** Two code paths can write a reading for the same sensor at the same instant: (a) the scheduled poll, (b) a user clicking "Poll now" in the UI. The reference impl uses `int(time.time())` resolution (whole seconds) and has no unique constraint, so two writes < 1 s apart produce two rows for the same second. Under the ported schema with `timestamp with time zone`, we get microsecond resolution, so exact collisions become rare — but a "Poll now" click followed by the scheduled poll firing within the same second is still common.

**Why it happens:** Reference impl treats `readings` as append-only with no dedup. When manual-poll was added late in development, no one revisited the insertion logic.

**Consequences:**
- Chart shows two dots at the same timestamp, one possibly `NULL` for humidity (see C-11)
- KPI aggregation double-counts if we add any summary endpoint
- Import from old SQLite history (C-9) can clash with fresh polls if imported timestamps overlap

**Prevention:**
- Alembic migration creates `UNIQUE INDEX readings_sensor_recorded_at_uq ON sensor_readings(sensor_id, recorded_at)`.
- Insert code uses `INSERT ... ON CONFLICT (sensor_id, recorded_at) DO NOTHING` (SQLAlchemy: `postgresql.insert(...).on_conflict_do_nothing()`).
- "Poll now" handler does not write if the most recent row for that sensor is < 2 s old; it just returns the existing latest row.

**Detection:** test — schedule poll, manually trigger poll 500 ms later, assert exactly one row inserted.

**Phase mapping:** **Phase 39 (schema) MUST include the unique index and ON CONFLICT pattern.**

**Confidence:** HIGH (direct inspection of reference impl insert path + SQL standard).

---

### C-6: Docker bridge network cannot reach 192.9.201.x from `api` container by default

**What goes wrong:** The existing `docker-compose.yml` (lines 22–39) puts `api` on Docker's default bridge network. Containers on the default bridge can reach the host's LAN via the host's routing table by default on Linux — but this is only true when:
1. The host has a working route to 192.9.201.0/24, **and**
2. `sysctl net.ipv4.ip_forward = 1` on the host, **and**
3. The Docker bridge's iptables MASQUERADE rule is intact (the default), **and**
4. No firewall drops UDP 161 outbound from the bridge subnet, **and**
5. No Docker Desktop VM boundary is in the way (macOS / Windows)

On the operator's Mac (where the stack gets developed), **none of this works by default** because Docker Desktop's VM does not have the host's 192.9.201.x route. `host.docker.internal` only resolves the host — not other LAN hosts.

**Why it happens:** developers test locally with Docker Desktop, assume it'll work on Linux too, and learn at production deploy that SNMP times out from inside the container.

**Consequences:** every `snmp_get()` returns `None`, charts are empty, operators assume the sensor is offline, milestone perceived-broken on day one.

**Prevention:**
- Add a verification section to Phase 38 plan: from inside the running `api` container, `snmpget -v2c -c public 192.9.201.10 1.3.6.1.2.1.1.1.0` must succeed before any application code ships. Install `snmp` in the backend Dockerfile's dev layer (or a documented `docker compose exec api apk add net-snmp-tools` line in verification steps).
- Document the fallback: if bridge mode fails on the deployment host, the `api` service can be switched to `network_mode: "host"` in a compose override file. Flag the tradeoff — loses container port isolation, binds 8000 directly to host.
- For macOS dev machines: document that SNMP testing must happen on the Linux production host (or via a cheap `snmpsim` mock container the dev can run locally). Do not block development on operator-network reachability.
- Do not use `network_mode: host` in the committed `docker-compose.yml` — that would break the other three services' port mappings.

**Detection:** Phase 38 verification checklist item: `docker compose exec api snmpget ...` produces a value. Screenshot of successful snmpget goes in `38-VERIFICATION.md`.

**Phase mapping:** **Phase 38 (SNMP client service) MUST include the in-container `snmpget` smoke test as a gating verification step before any business logic is written. Phase 43 (admin guide) MUST document the host-mode fallback.**

**Confidence:** HIGH (Docker networking docs + direct analysis of existing `docker-compose.yml`).

---

### C-7: AsyncIOScheduler + uvicorn `--workers > 1` fires every job N times

**What goes wrong:** The existing `api` command in `docker-compose.yml:24` is `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`. Today there's only one worker (default), so the Personio sync job runs once every hour. If anyone ever adds `--workers 4` for scaling, the sensor poll fires 4×/minute — 4 SNMP GETs against every host, 4 DB inserts per cycle, 4× unique-constraint contention.

**Why it happens:** default APScheduler in-memory job store has no cross-process coordination. Each worker process is a separate Python interpreter; each runs its own scheduler.

**Consequences:**
- Quadruple SNMP load on the physical sensors (rate-limit or trigger agent-side misbehavior)
- ON CONFLICT traffic on every insert
- Unpredictable interval — races between workers mean actual cadence is closer to `interval / N`

**Prevention:**
- Keep `--workers 1` on the `api` service. Document this constraint with a comment in `docker-compose.yml` referencing both the Personio job (existing) and the sensor poll job (new):
  ```yaml
  # DO NOT set --workers > 1. APScheduler runs in-process with an in-memory job
  # store; multiple workers would run each job N times. Scale via replicas only
  # if a shared job store (Redis) is introduced first.
  ```
- If horizontal scaling is ever needed, the remediation path is: extract the scheduler into a separate `scheduler` service container (like the existing `migrate` service pattern), and let the `api` service stay stateless with `--workers N`.

**Detection:** health-check assertion — `GET /api/sensors/_diag/scheduler` (admin-only) returns the job list; the count of "sensor_poll" jobs is exactly 1.

**Phase mapping:** **Phase 40 (APScheduler integration) MUST add a `--workers 1` comment in compose and the admin-only diag endpoint.**

**Confidence:** HIGH (APScheduler docs, FAQ explicit on this, multiple GitHub issues).

---

### C-8: Event-loop blocked by `time.sleep` or sync iterator in walk/discover flows

**What goes wrong:** The reference impl's `snmp_walk` uses `async for ... in nextCmd(...)` correctly (`app.py:210`). **But** if the walk is ported and the developer adds a "rate limit" with `time.sleep(0.1)` between results, or replaces `async for` with a sync `for` because "it looked cleaner," the coroutine blocks the entire event loop for the duration of the walk.

**Why it happens:** `async for` with large walk results can look janky in logs, tempting developers to "pace" it. Also, pysnmp's sync API still exists in other modules (`pysnmp.hlapi.v1arch.asyncio` vs `pysnmp.hlapi.v3arch.asyncio`) — mixing them silently falls back to blocking.

**Consequences:** A user clicking "Walk OIDs" in the admin UI freezes every other request for the duration of the walk (up to `max_results * (timeout + retries)` = minutes in worst case).

**Prevention:**
- All timing in poll/walk paths: **only `asyncio.sleep`, never `time.sleep`**. Add a grep check to CI: `! grep -rn "time.sleep" backend/app/services/snmp*`.
- Import path is locked: `from pysnmp.hlapi.v3arch.asyncio import ...` — document this in the service module docstring. The older `pysnmp.hlapi.asyncio` path used by the reference impl (`app.py:28-37`) still works but is the deprecated v1arch path in pysnmp 7.x.
- Cap walk results at `max_results=200` server-side (reference impl does this — keep it). Also cap walk wall-clock time with `asyncio.wait_for(snmp_walk(...), timeout=30)`.

**Detection:** load test — fire a walk and 20 concurrent `/api/sensors` GETs; 95th percentile latency of the GETs must stay < 500 ms.

**Phase mapping:** **Phase 38 (SNMP client) MUST use v3arch.asyncio import and wrap walk in asyncio.wait_for.**

**Confidence:** HIGH (pysnmp 7.1 docs + direct inspection).

---

## Moderate Pitfalls

### M-1: Directus admin gate bypassed by the sensors static assets or WebSocket

**What goes wrong:** The v1.11 auth pattern gates FastAPI mutation routes on `role == 'Admin'`. If the sensors milestone adds (a) a WebSocket endpoint for live updates, (b) an `unauthenticated` endpoint for a shared "public dashboard" display, or (c) serves sensor chart data via a differently-mounted router — any one of these can slip past the existing gate.

**Why it happens:** the admin-gate dependency (`Depends(require_admin)`) has to be added to every new route. Missing it is a silent failure.

**Consequences:** a Viewer account reads temperature/humidity data they shouldn't see; worse, the walk endpoint (which can discover arbitrary OIDs including interface descriptions, SNMP community enumeration) becomes accessible.

**Prevention:**
- Every new sensor route registers with `dependencies=[Depends(require_admin)]` at the **router** level, not per-endpoint. Example in `backend/app/routers/sensors.py`:
  ```python
  router = APIRouter(
      prefix="/api/sensors",
      tags=["sensors"],
      dependencies=[Depends(require_admin)],
  )
  ```
- Add a test that enumerates `app.routes` and asserts every route under `/api/sensors/*` has `require_admin` in its dependency chain. This catches routers added later that forget the gate.
- Do NOT add a WebSocket endpoint in this milestone. Frontend polling via TanStack Query is sufficient (see M-5). WebSocket auth with Directus JWT has its own set of gotchas (query-param tokens, refresh mid-session) — out of scope for v1.15.
- If the "public dashboard" anti-pattern comes up, redirect the discussion to a dedicated public-read role in Directus later; do not bolt on anonymous endpoints.

**Phase mapping:** **Phase 41 (API routes) MUST apply `require_admin` at router level and include the dependency-audit test. Phase 42 verification has a click-path confirming Viewer login cannot see the sensor tile in the App Launcher.**

**Confidence:** HIGH (FastAPI router pattern + existing project convention).

---

### M-2: Interval drift when config changes mid-cycle (reference impl has this bug)

**What goes wrong:** Reference impl `app.py:415-421` calls `scheduler.reschedule_job` inside the PUT /api/config handler, but does not interrupt an in-flight poll. If the user changes the interval from 60 s to 300 s while a poll is running, the next poll fires at `now + 300s`, not `poll_start + 300s` — causing a visible gap.

**Why it happens:** `reschedule_job` sets the next run time based on the new trigger from the current moment. APScheduler has no "restart the interval relative to the in-flight job" option.

**Consequences:** minor UX glitch — chart gaps after an interval change. Not a correctness issue, but confusing.

**Prevention:**
- In the PUT /api/sensor-settings handler (Phase 41), after `reschedule_job`, log the old interval, new interval, and computed next_run_time so operators can reason about gaps.
- Document in admin-guide article: "interval changes take effect immediately but may cause a one-cycle gap." Same pattern as Personio's D-06.
- If interval change frequency is low (expected: once per month by an admin), the gap is acceptable.

**Phase mapping:** **Phase 41 (admin config API) — log the transition, document in admin guide.**

**Confidence:** HIGH (APScheduler docs + direct code inspection).

---

### M-3: `asyncio.gather` of all sensors with `return_exceptions=False` — one failure cancels others

**What goes wrong:** Reference impl uses `asyncio.gather(*(poll_sensor(s) for s in cfg.sensors))` at `app.py:252` with default arguments. If one sensor raises an unexpected exception (not the `try/except` inside `snmp_get` — a programming error like `AttributeError`), the default `return_exceptions=False` propagates and cancels all sibling poll tasks.

**Why it happens:** Most of the time, sensor errors are caught inside `snmp_get` and return `None`. But an unanticipated exception (bad OID string, pysnmp internal error) escapes.

**Consequences:** one misconfigured sensor taking down the polling of all other sensors, silently, until the next scheduler tick.

**Prevention:**
- Use `asyncio.gather(*tasks, return_exceptions=True)` and iterate results logging exceptions per sensor.
- Better: wrap each `poll_sensor` call in its own `try/except Exception` with per-sensor logging, so the error attribution is unambiguous.
- Include sensor name/id in every log message from the poll path (structured log fields, not string concatenation).

**Phase mapping:** **Phase 38 (poll orchestration) MUST wrap each sensor in its own exception boundary; gather uses `return_exceptions=True`.**

**Confidence:** HIGH (asyncio docs + direct inspection).

---

### M-4: Sensor offline fills DB with NULL rows

**What goes wrong:** Reference impl `app.py:243-246` has a guard: if `temp is None and hum is None`, skip the insert. **But** if a sensor has only `temperature_oid` set (no humidity), a single SNMP timeout yields `temp=None, hum=None` (because humidity is always None), and the guard kicks in — silently, the sensor appears to have no data ever, and the user can't tell from the DB whether it's "offline" or "misconfigured."

**Why it happens:** the offline-detection logic is tangled with the "no data" logic.

**Consequences:**
- No way to render a "last contact: 3h ago" indicator without scanning the raw DB
- The chart looks identical for "sensor unplugged" and "sensor responding with zero" (hard to troubleshoot)
- Readings table grows slower than expected, so disk space monitoring underestimates

**Prevention:**
- **Two tables:** `sensor_readings` (only rows where at least one value succeeded) + `sensor_poll_log` (one row per poll attempt: sensor_id, attempted_at, success bool, error_kind enum, latency_ms). Keep poll_log trimmed (e.g. 7 days rolling).
- Poll logic writes to poll_log *always*, to sensor_readings *only on success*.
- Expose `GET /api/sensors/:id/status` = { last_success_at, last_attempt_at, consecutive_failures, last_error }. Chart UI can show "offline for 15 min" without touching sensor_readings.
- Alembic migration creates both tables.

**Phase mapping:** **Phase 39 (schema) MUST include both `sensor_readings` and `sensor_poll_log` tables. Phase 41 (API) includes `/status` endpoint.**

**Confidence:** MEDIUM (pattern well-established in monitoring ecosystem, but we don't have a single canonical source — multiple prometheus/telegraf patterns converge on this shape).

---

### M-5: TanStack Query refetchInterval fights the server-side poll

**What goes wrong:** Naïve React implementation sets `refetchInterval: 60_000` on the `/api/sensors/:id/readings` query. But the server-side poll also runs at 60 s interval with no phase alignment. 50% of the time, the frontend fetches readings *just before* the new poll completes — the user sees a stale dataset, refreshes, sees the new one a second later, thinks the UI is laggy.

**Why it happens:** `refetchInterval` is client-driven with no coordination with the server's polling cadence.

**Consequences:** perceived UI lag; confused users who hit refresh twice.

**Prevention:**
- Use a shorter, out-of-phase `refetchInterval` on the readings query — e.g., 15 s when `/sensors` tab is visible. This is cheap (indexed range query) and guarantees the UI picks up new rows within 15 s of a server poll regardless of phase.
- `refetchIntervalInBackground: false` — when the user leaves the `/sensors` tab, stop polling. TanStack Query default is `false` already, but set it explicitly as documentation.
- `refetchOnWindowFocus: true` — matches the existing app pattern so the user returning to the tab sees fresh data without waiting.
- `staleTime: 5_000` — re-queries within 5 s dedupe.
- "Poll now" button uses `queryClient.invalidateQueries` on the readings key so the chart updates immediately after the manual poll returns.

**Phase mapping:** **Phase 42 (frontend sensors page) — document these 4 TanStack Query settings in the hook that wraps the readings query.**

**Confidence:** HIGH (TanStack Query v5 docs + existing project patterns in `frontend/src/hooks/`).

---

### M-6: Alembic migration not idempotent / bad downgrade

**What goes wrong:** A hand-written Alembic migration for sensor tables has two easy traps: (a) `op.create_table` without `if_not_exists` — running `alembic upgrade head` twice on a partially-migrated DB fails; (b) `downgrade()` left as `pass` because "we never downgrade" — until a deployment needs to roll back v1.15 after discovering a UAT problem.

**Why it happens:** Speed pressure; developers assume migrations only run forward.

**Consequences:**
- Stuck upgrade when a previous migration partially succeeded
- No rollback path if v1.15 is released and has to be pulled
- Directus bootstrap may fight with Alembic if the `sensors` table name collides with any future Directus collection (unlikely but possible)

**Prevention:**
- Migration `upgrade()` uses `op.execute("CREATE TABLE IF NOT EXISTS ...")` via SQL *or* runs a sanity check via `op.get_bind()` to verify the table doesn't exist before creation — mirrors the pattern used in v1.11 Directus-coexistence migrations.
- Migration `downgrade()` explicitly drops both `sensor_readings` and `sensors` **plus** any indexes and unique constraints, in reverse dependency order.
- Migration is tested: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` in a fresh DB during Phase 39 verification.
- Seed data (if any) goes in a **separate** data migration file, not mixed with schema, so rollback separates cleanly.
- Add `sensors, sensor_readings, sensor_poll_log` to the `DB_EXCLUDE_TABLES` env var in `docker-compose.yml` (Directus) so Directus doesn't auto-mount them in the Data Model UI.

**Phase mapping:** **Phase 39 (Alembic migration) — implement idempotent upgrade + full downgrade + round-trip test in verification.**

**Confidence:** HIGH (Alembic docs + existing project patterns from v1.11 migration work).

---

### M-7: Index bloat on `sensor_readings(recorded_at)` under write-heavy workload

**What goes wrong:** Default Postgres autovacuum threshold is `autovacuum_vacuum_scale_factor = 0.2` — meaning autovacuum doesn't run until 20% of the table is dead tuples. On an insert-only workload (which time-series readings mostly are), there are no dead tuples, so **autovacuum rarely runs**. But btree indexes on monotonically-increasing columns (timestamp) can still bloat because of how btree splits work, and ANALYZE is also deferred — meaning the query planner's stats for `recorded_at` go stale, and range queries like `WHERE recorded_at >= now() - interval '24h'` may choose sequential scans over index range scans.

**Why it happens:** insert-only workloads don't trigger the standard autovacuum knobs. It's a classic time-series-in-general-purpose-DB trap.

**Consequences:**
- Query latency on the readings endpoint degrades over months, not days — hard to notice in QA
- Chart rendering slows from 50 ms to several seconds at the 100k-row mark
- No alerts, because nothing "fails"

**Prevention:**
- Set per-table autovacuum tuning in the Alembic migration:
  ```sql
  ALTER TABLE sensor_readings SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_insert_scale_factor = 0.1  -- Postgres 13+; triggers vacuum on insert volume
  );
  ```
- Index strategy: composite btree on `(sensor_id, recorded_at DESC)` — matches the dominant query pattern `WHERE sensor_id = ? AND recorded_at >= ? ORDER BY recorded_at DESC LIMIT ?`. A single-column index on `recorded_at` alone is not needed and adds write overhead.
- Capacity math and retention policy: at 60-second polling × 10 sensors × 2 values × 365 days = ~10.5 M rows/year. A ~30 B row × 10 M = ~300 MB. Add a **retention cleanup job**: `DELETE FROM sensor_readings WHERE recorded_at < now() - interval '90 days'` runs nightly via APScheduler. Document the retention period in the admin guide and make it admin-configurable only if needed.
- After retention delete job runs, it issues `VACUUM (INDEX_CLEANUP ON) sensor_readings` explicitly — or relies on autovacuum now that dead tuples exist.

**Phase mapping:** **Phase 39 (schema) sets per-table autovacuum knobs. Phase 40 (scheduler) adds the retention cleanup job.**

**Confidence:** MEDIUM (Postgres vacuum docs + pganalyze writeups; actual bloat behavior is workload-dependent).

---

### M-8: SQLite → Postgres one-off import — timezone mismatch and duplicate-key risk

**What goes wrong:** The reference impl's `data.db` stores `ts` as `INTEGER` Unix seconds (`app.py:151`). A naïve import script does `datetime.fromtimestamp(row["ts"])` and inserts into Postgres — but `fromtimestamp` on a machine in Europe/Berlin produces a naive local datetime, not UTC. Inserted into `timestamp with time zone`, Postgres interprets it as the session's `timezone` setting (UTC if set that way on the `api` container, Europe/Berlin if on the operator's laptop).

**Why it happens:** Unix seconds → datetime conversion has a subtle tz trap. `datetime.fromtimestamp(ts)` is local; `datetime.fromtimestamp(ts, tz=timezone.utc)` is UTC. The docs don't make this prominent.

**Consequences:** imported historical readings are off by 1 or 2 hours vs. freshly-polled readings. Charts show a visible seam on the day of import.

**Prevention:**
- Decision: **skip the one-off import**. The standalone app has limited history and the value of historical continuity doesn't justify the risk. Document this choice in the milestone summary.
- If the decision is reversed and import is needed: the one-off script (in `backend/scripts/import_sqlite_readings.py`, run manually via `docker compose run --rm api python -m scripts.import_sqlite_readings`) MUST:
  1. Use `datetime.fromtimestamp(ts, tz=timezone.utc)` — never the naive form.
  2. Insert with `ON CONFLICT (sensor_id, recorded_at) DO NOTHING` — handles re-runs.
  3. Run in a transaction, emit a summary at the end: N new rows, M conflicts skipped.
  4. Be covered by a test against a fixture SQLite file.
- Script is not wired into Alembic; it's a one-shot CLI.

**Phase mapping:** **Phase 39 recommends SKIP import (documented decision). If reversed, Phase 44 adds the import script.**

**Confidence:** HIGH (Python `datetime` docs are explicit on this + Postgres timestamptz semantics).

---

## Minor Pitfalls

### N-1: `getCmd` vs `nextCmd` confusion for single-OID reads

**What goes wrong:** Reference impl correctly uses `getCmd` for single OID reads (`app.py:171`) and `nextCmd` for walks (`app.py:202`). A hurried port may flip these — `nextCmd` with a single OID returns the *next* OID in the tree, not the queried one, which looks "almost right" and only fails when the OID happens to be a leaf.

**Prevention:**
- Code comment at the `getCmd` call site: "# Single OID read — getCmd, NOT nextCmd. nextCmd walks past the queried OID."
- Service unit test with a mock that returns a known OID tree; assert `snmp_get('1.3.6.1.2.1.1.1.0')` returns the sysDescr value, not sysObjectID.

**Phase mapping:** Phase 38 service tests.

**Confidence:** HIGH (SNMP protocol fundamentals).

---

### N-2: Raw-int scale factor bugs (reference impl already handles this)

**What goes wrong:** Many temp/humidity sensors return `235` meaning 23.5°C — scaled by 10. The reference impl already has `temperature_scale: float` in config and divides by it (`app.py:238`). Pitfall: confusion about direction. If the sensor returns the raw value and the user enters `scale=10`, the code computes `raw / scale = 23.5`. If the user thinks "scale" means "multiplier" and enters `scale=0.1`, the code computes `235 / 0.1 = 2350`. Classic UI meaning trap.

**Prevention:**
- Label the admin config field "Divisor (raw value ÷ this = display value)" with a helper tooltip "e.g. 10 for a sensor reporting 235 as 23.5°C".
- Validate scale ∈ {0.01, 0.1, 1, 10, 100, 1000} via Pydantic `Literal`, OR freeform with a realistic-range assertion on computed output (e.g., reject if scaled temp < -50 or > 100°C).
- "Probe OID" admin endpoint (already in reference impl at `app.py:434`) shows the raw value — lets the admin dial in the scale by comparing raw to the sensor's displayed reading.

**Phase mapping:** Phase 41 (admin API) and Phase 42 (admin UI tooltip copy).

**Confidence:** HIGH (direct inspection of reference impl).

---

### N-3: UDP packet loss misdiagnosed as sensor offline

**What goes wrong:** SNMP over UDP can lose single packets silently (no TCP retransmit). A transient loss → `timeout=3, retries=1` (reference impl default, `app.py:175`) → one poll cycle reports None. A strict "1 failure = offline" rule turns transient network hiccups into false offline alerts.

**Prevention:**
- Use `retries=2` (3 total attempts) with `timeout=2` — total max wait 6 s still fits in a 60 s cycle.
- Offline threshold: **3 consecutive** failed polls before marking offline in the UI. Tracked in-memory on the poll service (or via `sensor_poll_log` M-4). This handles 99.9%+ of transient UDP loss.
- Do not alert-email on a single failure; only after N failures. No email alerting in scope for v1.15 anyway, so this is future-proofing guidance.

**Phase mapping:** Phase 38 (SNMP client default), Phase 41 (status endpoint threshold).

**Confidence:** HIGH (SNMP/UDP protocol + standard monitoring patterns).

---

### N-4: Concurrent polls of same host within one cycle

**What goes wrong:** A sensor with both `temperature_oid` and `humidity_oid` results in two sequential SNMP GETs in the reference impl (`app.py:235-242`). That's fine for N=1 sensor. But if `poll_all` uses `asyncio.gather` across *sensors*, and a single physical host owns two *configured* sensors (e.g. someone splits one AKCP device into two rows for readability), the host gets two simultaneous UDP GETs — a well-written SNMP agent handles this, but cheap ones drop one.

**Prevention:**
- Keep the "one sensor = one host" convention in the admin UI. Discourage splitting a host into multiple sensor rows in the admin guide.
- If multi-OID-per-host becomes common: introduce `getBulk` (pysnmp: `bulkCmd`) to fetch all OIDs in a single request — more efficient and no concurrency concern. Defer to a future milestone.

**Phase mapping:** Phase 43 (admin guide convention). Not a blocker for v1.15.

**Confidence:** MEDIUM (cheap-SNMP-agent behavior varies; many agents are fine with concurrent requests).

---

### N-5: APScheduler in-memory job store loses scheduled state on restart

**What goes wrong:** The existing Personio scheduler uses the default `MemoryJobStore` (evident from `scheduler.py` — no job store configured). Container restart = all scheduled jobs re-registered from DB config at startup. This is fine for interval jobs (the lifespan re-registers on boot) but means "I'll poll at 14:00 sharp" state is lost on any restart.

**Prevention:**
- We're using interval triggers, not `DateTrigger` / `CronTrigger` with specific times, so the impact is minor — worst case is a single skipped poll cycle around a container restart.
- Accept this as a known limitation matching the existing Personio pattern. Documented in Phase 40 plan.
- Do NOT introduce a SQLAlchemyJobStore just for this — it would require a separate sync engine against the same Postgres, complicating the async-only convention.

**Phase mapping:** Phase 40 — document in plan, no code change.

**Confidence:** HIGH (APScheduler docs + existing project pattern).

---

### N-6: Pydantic validation errors echoing secrets

**What goes wrong:** If `/api/sensor-config` receives an invalid payload, FastAPI's default `RequestValidationError` handler echoes the offending values in the 422 response body. If the community string was the invalid field (e.g., too long), it gets echoed back to the browser and possibly logged.

**Prevention:**
- Use Pydantic `SecretStr` for the `community` field — its `__repr__` is `"**********"` so validation error echoes are already redacted.
- FastAPI global exception handler for `RequestValidationError` that strips any field named `community`, `password`, `token`, `secret` from the error detail before returning. Already present in several FastAPI boilerplate projects; confirm presence or add in Phase 41.

**Phase mapping:** Phase 41 (API) — use SecretStr + optional global handler.

**Confidence:** HIGH (Pydantic + FastAPI docs).

---

### N-7: `SensorPayload.community` default `"public"` in the admin UI

**What goes wrong:** Reference impl ships with `community: str = "public"` as the admin form default (`app.py:334`). "public" is the industry-standard default community string — every scanner on the internet tries it first. If the sensor host is ever reachable from outside the LAN (now or future), this is a disclosure bug.

**Prevention:**
- No default on the admin form. Admin must type it. Pydantic: `community: SecretStr` with no default, `Field(..., min_length=1)`.
- Admin-guide warning: "Never leave the default 'public' community on a production device."

**Phase mapping:** Phase 41 (API schema) + Phase 43 (admin guide warning).

**Confidence:** HIGH (SNMP security guidance is universal on this).

---

## Phase-Specific Warnings Summary

| Phase | Topic | Pitfall IDs | Must-do |
|-------|-------|-------------|---------|
| **38** | SNMP client service | C-1, C-2, C-6, C-8, M-3, N-1, N-3 | Shared SnmpEngine; AsyncSessionLocal only; `snmpget` verification from container; v3arch.asyncio import; per-sensor exception boundary |
| **39** | Alembic schema + encryption | C-3, C-5, M-4, M-6, M-7, M-8 | Fernet-encrypted community; unique constraint (sensor_id, recorded_at); both sensor_readings + sensor_poll_log tables; idempotent up + full downgrade; per-table autovacuum knobs; document "no import" decision |
| **40** | APScheduler integration | C-4, C-7, M-7, N-5 | max_instances=1, coalesce=True, misfire_grace_time=30; outer asyncio.wait_for; --workers 1 comment; retention cleanup job; document in-memory jobstore limitation |
| **41** | API routes + admin config | M-1, M-2, M-4, N-2, N-6, N-7 | require_admin at router level + audit test; log interval transitions; /status endpoint; SecretStr community with no default; no "public" default |
| **42** | Frontend /sensors page | M-1 (verify), M-5 | Viewer cannot see tile; refetchInterval=15s, refetchIntervalInBackground=false, refetchOnWindowFocus=true, staleTime=5s |
| **43** | Admin guide article | C-3, C-6, M-2, N-3, N-4, N-7 | Community-as-secret; host-mode fallback; interval-gap note; "1 host = 1 sensor" convention; never-use-public warning |
| **44** (optional) | One-off SQLite import | M-8 | If enabled: UTC-aware fromtimestamp + ON CONFLICT DO NOTHING + fixture test |

---

## Cross-Cutting Prevention Patterns

Four patterns, if enforced consistently, prevent most pitfalls above. Phase plans should reference these:

1. **Shared pysnmp engine, per-engine MIB loading** — `app.state.snmp_engine`, initialized once. (addresses C-1, C-8)
2. **AsyncSessionLocal everywhere, grep-enforced no-sync-DB** — matches existing Personio pattern. (addresses C-2)
3. **Admin gate at router level, not per-endpoint** — matches existing Directus-integrated routers. (addresses M-1)
4. **Two-table polling schema** (`sensor_readings` + `sensor_poll_log`) — separates "data" from "liveness." (addresses C-5, M-4, N-3)

---

## Sources

### Context7 / Official Documentation (HIGH confidence)
- [PySNMP 7.1 Documentation — Asynchronous SNMP (v3arch)](https://docs.lextudio.com/pysnmp/v7.1/examples/hlapi/v3arch/asyncio/index.html)
- [PySNMP 7.1 GET Operation reference](https://docs.lextudio.com/pysnmp/v7.1/docs/hlapi/v3arch/asyncio/manager/cmdgen/getcmd)
- [PySNMP 7.1 Changelog — dispatcher resource leak fix](https://docs.lextudio.com/pysnmp/v7.1/changelog)
- [APScheduler 3.x User Guide — misfire_grace_time, coalesce, max_instances](https://apscheduler.readthedocs.io/en/3.x/userguide.html)
- [APScheduler 3.x FAQ — multi-worker duplicate execution](https://apscheduler.readthedocs.io/en/3.x/faq.html)
- [PostgreSQL Wiki — Don't Do This (use timestamptz not timestamp)](https://wiki.postgresql.org/wiki/Don't_Do_This)
- [PostgreSQL 18 Date/Time Types documentation](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [Docker Engine Networking reference](https://docs.docker.com/engine/network/)

### Verified community sources (MEDIUM confidence)
- [pganalyze — tuning VACUUM and autovacuum](https://pganalyze.com/blog/5mins-postgres-tuning-vacuum-autovacuum)
- [Percona — Tuning Autovacuum in PostgreSQL](https://www.percona.com/blog/tuning-autovacuum-in-postgresql-and-autovacuum-internals/)
- [Common mistakes with APScheduler in Python/Django apps](https://sepgh.medium.com/common-mistakes-with-using-apscheduler-in-your-python-and-django-applications-100b289b812c)
- [Efficient Asynchronous SNMP Exploration — engine reuse pattern](https://medium.com/@dheeraj.mickey/efficient-asynchronous-snmp-exploration-in-python-unleashing-the-power-of-asyncio-and-pysnmp-fa233015d61d)

### Direct code inspection (HIGH confidence for reference-impl-specific pitfalls)
- `/Users/johannbechtold/Documents/snmp-monitor/app.py` — reference implementation
- `/Users/johannbechtold/Documents/kpi-dashboard/backend/app/scheduler.py` — existing APScheduler pattern
- `/Users/johannbechtold/Documents/kpi-dashboard/docker-compose.yml` — container network topology

### Deferred / not verified (LOW confidence, flagged)
- Exact Postgres autovacuum behavior for pure-insert time-series workloads — recommendations are conservative; actual tuning may need field measurement after Phase 40 lands. Revisit in a post-v1.15 operational review if the readings table grows faster than projected.
