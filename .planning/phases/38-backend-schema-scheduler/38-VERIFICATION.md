# Phase 38 — Verification Evidence

This file accumulates evidence for the two gating checkpoints in Plan 38-03
(SEN-OPS-01 Docker→SNMP pre-flight, Plan 38-03 End-to-End stack verification).

The executor embeds the exact commands and expected outputs here; the human
operator runs the commands on the deployment host and pastes the resulting
stdout into the appropriate section.

---

## SEN-OPS-01 Pre-flight

**Requirement:** SEN-OPS-01 — Docker→SNMP reachability from inside the `api`
container to the production sensor at `192.9.201.27` over UDP/161 using the
`public` community.

**Runs on:** the deployment host (Linux production box or a Linux staging box
that routes the `192.9.201.0/24` subnet). macOS Docker Desktop is NOT an
acceptable verification environment for this checkpoint (PITFALLS C-6 —
Docker Desktop's VM-layer routing interferes with LAN access).

**Why gating:** the entire Phase 38 pipeline depends on the `api` container
being able to reach the sensor. If this smoke test fails, shipping the
scheduler job would silently time out every 60 seconds against an unreachable
target.

### Commands to run

```bash
# 1. Bring up the stack with the current code (Plan 38-03 merged is fine —
#    the poll loop is a no-op against an unreachable target, so this is safe
#    to run after 38-03 deployment as long as the retention/poll jobs are
#    idempotent, which they are).
docker compose up -d
docker compose ps   # confirm api is healthy

# 2. Install net-snmp-tools inside the api container (ephemeral — not
#    committed to the Dockerfile; one-shot for this checkpoint).
docker compose exec api sh -c 'apk add --no-cache net-snmp-tools'

# 3. Temperature OID (Produktion sensor — seed row #1 from Plan 38-01).
docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.2

# 4. Humidity OID.
docker compose exec api snmpget -v2c -c public 192.9.201.27 1.3.6.1.4.1.21796.4.9.3.1.5.1
```

### Expected output (shape — exact integer value will vary)

```
SNMPv2-SMI::enterprises.21796.4.9.3.1.5.2 = INTEGER: 235
SNMPv2-SMI::enterprises.21796.4.9.3.1.5.1 = INTEGER: 412
```

- A numeric `INTEGER` (e.g. `235` for 23.5°C; scale=10 divisor applied at
  the application layer in `snmp_poller.py`) → **PASS**.
- `Timeout: No Response from 192.9.201.27` or `No such object available on
  this agent at this OID` → **FAIL** (stop the phase, flag a blocker in
  STATE.md, evaluate host-mode fallback per Phase 40 admin guide).

### Result (to be filled in by operator)

```
(paste snmpget stdout here — include the timestamp of the run)
```

**Status:** _pending-operator-run-on-deployment-host_

_If the dev host cannot reach 192.9.201.0/24 (e.g. macOS laptop with Docker
Desktop), mark this section `deferred-to-Linux-staging` and record the
reason and the staging plan here. Do not force-ship without a successful run
on the production network._

---

## Plan 38-03 End-to-End Verification

**Requirement:** phase-closing gate for Phase 38 — after Tasks 2 + 3 land
(scheduler integration + `--workers 1` invariant), the live system must
show readings accumulating every ~60s, no duplicate rows, both new
APScheduler jobs registered, shared `SnmpEngine` wired, Admin can poll-now,
Viewer is 403.

**Runs on:** the same deployment host / Linux staging box that passed the
SEN-OPS-01 pre-flight above.

### Pre-flight — tokens

The operator needs two JWTs forged against `DIRECTUS_SECRET` per the
`backend/tests/test_directus_auth.py` `_mint` helper pattern:

```bash
# Example minting (run on deployment host, or copy from the CI fixture that
# test_sensors_admin_gate.py already uses):
export ADMIN_TOKEN=$(docker compose exec -T api python3 -c "
from tests.test_directus_auth import _mint, ADMIN_UUID
print(_mint(ADMIN_UUID))
")
export VIEWER_TOKEN=$(docker compose exec -T api python3 -c "
from tests.test_directus_auth import _mint, VIEWER_UUID
print(_mint(VIEWER_UUID))
")
```

### Commands to run

```bash
# 1. Rebuild + up with all 38-01/38-02/38-03 code merged.
docker compose up -d --build
docker compose ps

# 2. Confirm Alembic head.
docker compose exec api alembic current
# Expected: ...v1_15_sensor (head)

# 3. Confirm seed row with Fernet ciphertext community.
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT id, name, host, port,
          octet_length(community) AS community_ct_bytes,
          encode(substring(community from 1 for 6), 'base64') AS ct_prefix_b64
   FROM sensors;"

# 4. Wait ~3 minutes for ≥3 scheduled polls, then count readings + check
#    for duplicates.
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT sensor_id, COUNT(*) AS rows, MIN(recorded_at) AS first,
          MAX(recorded_at) AS last
   FROM sensor_readings GROUP BY sensor_id;"

docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT sensor_id, recorded_at, COUNT(*) FROM sensor_readings
   GROUP BY sensor_id, recorded_at HAVING COUNT(*) > 1;"

# 5. Confirm scheduler job list from inside the container.
docker compose exec api python3 -c "
from app.scheduler import scheduler, SENSOR_POLL_JOB_ID, SENSOR_RETENTION_JOB_ID, SYNC_JOB_ID
for jid in (SYNC_JOB_ID, SENSOR_POLL_JOB_ID, SENSOR_RETENTION_JOB_ID):
    j = scheduler.get_job(jid)
    print(jid, '->', 'MISSING' if j is None else f'next={j.next_run_time} trigger={j.trigger}')
"

# 6. Confirm shared SnmpEngine is populated (live route exercise).
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/api/sensors/status | jq
# A 200 + non-null status fields ⇒ engine wired (routes would 503 otherwise).

# 7. Poll-now manual.
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/sensors/poll-now | jq
# Expected: { "sensors_polled": 1, "errors": [] } (or errors listing specific issues).

# 8. Viewer denial (regression guard).
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  http://localhost:8000/api/sensors/poll-now
# Expected: 403
```

### Expected outcomes

| Step | Expected |
|------|----------|
| 3 | 1 row, `name=Produktion`, `host=192.9.201.27`, `community_ct_bytes > 50`, `ct_prefix_b64` starts with `gAAAAAAB...` (Fernet prefix) |
| 4a (count) | `rows >= 2` for sensor_id=1 after ~3 minutes |
| 4b (dupe check) | zero rows returned (UNIQUE + ON CONFLICT DO NOTHING working) |
| 5 | `sensor_poll` and `sensor_retention_cleanup` both present with `next_run_time` set |
| 6 | HTTP 200 with JSON status list |
| 7 | HTTP 200, JSON `{"sensors_polled": 1, "errors": [...]}` |
| 8 | HTTP 403 |

### Result (to be filled in by operator)

```
(paste outputs of steps 3, 4, 5, 7, 8 here — one fenced block per step)
```

**Status:** _pending-operator-run-on-deployment-host_

### Failure modes to flag

- Duplicates found in step 4 → `ON CONFLICT DO NOTHING` is broken; STOP, debug.
- `rows == 0` after 3 minutes → scheduler not ticking; check `docker compose
  logs api | grep sensor_poll` for exceptions and the `SnmpEngine` init line.
- Viewer token returns 200 in step 8 → admin-gate regression; re-check
  `require_admin` is in the router dependencies and the dep-audit test
  passed.
- Routes return 503 with `"SNMP engine not initialized"` → lifespan did not
  populate the engine; verify `app.state.snmp_engine = _engine` landed in
  scheduler.py lifespan (Plan 38-03 Task 2).

---

## Notes

This file is load-bearing for the Phase 38 retrospective and for v1.15
milestone acceptance. Keep appending; do not delete historical entries.
