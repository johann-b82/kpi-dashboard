---
phase: 53-analytics-lite
plan: 01-backend-heartbeat-log-and-analytics-endpoint
subsystem: signage-analytics
tags: [backend, alembic, signage, analytics, phase-53]
requires:
  - phase-51 (v1_18_signage_schedules as down_revision anchor)
  - phase-43 (signage_player router + heartbeat sweeper coroutine)
provides:
  - GET /api/signage/analytics/devices
  - signage_heartbeat_event append-only log table
  - DeviceAnalyticsRead Pydantic schema
  - SignageHeartbeatEvent ORM model
affects:
  - backend/app/routers/signage_player.py (post_heartbeat now inserts event row in same txn)
  - backend/app/scheduler.py (_run_signage_heartbeat_sweeper now prunes 25h+ events per tick)
tech-stack:
  added: []
  patterns:
    - composite natural PK (device_id, ts) for append-only log tables
    - sqlalchemy.dialects.postgresql.insert + on_conflict_do_nothing for idempotent inserts
    - bucketed uptime via COUNT(DISTINCT date_trunc('minute', ts))
    - partial-history denominator via LEAST(1440, CEIL(first_hb_age_min))
key-files:
  created:
    - backend/alembic/versions/v1_18_signage_heartbeat_event.py
    - backend/app/routers/signage_admin/analytics.py
    - backend/tests/test_signage_heartbeat_event_insert.py
    - backend/tests/test_signage_analytics_router.py
  modified:
    - .planning/REQUIREMENTS.md
    - backend/app/models/signage.py
    - backend/app/models/__init__.py
    - backend/app/schemas/signage.py
    - backend/app/routers/signage_player.py
    - backend/app/routers/signage_admin/__init__.py
    - backend/app/scheduler.py
    - backend/tests/test_signage_heartbeat_sweeper.py
    - backend/tests/test_signage_schema_roundtrip.py
key-decisions:
  - Composite PK (device_id, ts) on signage_heartbeat_event — no surrogate id (research Pattern 2)
  - SQL: COUNT(DISTINCT date_trunc('minute', ts)) beats generate_series at this scale (research Pattern 1)
  - 1-decimal precision on uptime_24h_pct (matches badge-threshold fidelity)
  - Zero-heartbeat devices INCLUDED with uptime_24h_pct=null, missed=0, window_minutes=0 (D-16 option B)
  - 25 h retention (1 h buffer past 24 h horizon) prevents sweeper-vs-analytics race (D-03 / Pitfall 4)
  - Endpoint path /api/signage/analytics/devices (clean namespace; avoids /devices CRUD collision)
requirements-completed:
  - SGN-ANA-01 (backend half — frontend follow-up in 53-02)
duration: 7m 53s
completed: 2026-04-21
---

# Phase 53 Plan 01: Backend Heartbeat Log + Analytics Endpoint Summary

**One-liner:** Shipped the backend half of SGN-ANA-01 — append-only `signage_heartbeat_event` log with composite PK `(device_id, ts)`, idempotent heartbeat insert via `ON CONFLICT DO NOTHING`, 25 h sweeper prune, and a bucketed-SQL `GET /api/signage/analytics/devices` endpoint returning `{device_id, uptime_24h_pct|null, missed_windows_24h, window_minutes}` per non-revoked device; 6 D-20 integration tests all green.

**Duration:** 7m 53s
**Tasks:** 3/3 complete
**Files changed:** 13 (4 new, 9 modified)

## What Shipped

### Database
- **New migration `v1_18_signage_heartbeat_event`** (HEAD). Creates `signage_heartbeat_event(device_id UUID FK signage_devices.id ONDELETE CASCADE, ts TIMESTAMPTZ NOT NULL DEFAULT now())` with composite PK `(device_id, ts)`. `down_revision = "v1_18_signage_schedules"`. Round-trip upgrade → downgrade → upgrade clean.
- **No secondary index** — PK covers both hot queries (`WHERE ts >= cutoff GROUP BY device_id` for analytics, `WHERE ts < cutoff` for prune).

### ORM + Schema
- `SignageHeartbeatEvent` ORM model appended to `app/models/signage.py`; registered in `app/models/__init__.py` so Alembic autogenerate and `Base.metadata` both see it.
- `DeviceAnalyticsRead` Pydantic v2 schema with `device_id: UUID`, `uptime_24h_pct: float | None`, `missed_windows_24h: int`, `window_minutes: int`.

### Heartbeat handler
- `POST /api/signage/player/heartbeat` now inserts one row into `signage_heartbeat_event` in the **same transaction** as the existing `last_seen_at` update. Uses `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_nothing(index_elements=["device_id", "ts"])` so a microsecond-retry collision is swallowed silently.
- Single `now = datetime.now(timezone.utc)` computed once, used for both `last_seen_at` and `ts`.

### Sweeper
- `_run_signage_heartbeat_sweeper` now runs a single `DELETE FROM signage_heartbeat_event WHERE ts < now() - interval '25 hours'` per 60 s tick, wrapped in `asyncio.wait_for(..., timeout=20)`, inside the same transaction as the existing device-status flip. One commit, one tick.
- 25 h (not 24 h) retention leaves a clean 1-hour buffer against sweeper-vs-analytics race (D-03 / research Pitfall 4).

### Analytics endpoint
- `GET /api/signage/analytics/devices` → `list[DeviceAnalyticsRead]`.
- Mounted at `backend/app/routers/signage_admin/analytics.py` with `prefix="/analytics/devices"` and endpoint path `""`; final mount through `signage_admin/__init__.py` inherits the admin gate (no local `dependencies=` kwarg).
- Bucketed SQL: `COUNT(DISTINCT date_trunc('minute', ts)) GROUP BY device_id` joined from `signage_devices` LEFT JOIN aggregate CTE; `d.revoked_at IS NULL` excludes revoked devices server-side.
- Python post-processing: if `denominator == 0` → `uptime_24h_pct=None, missed_windows_24h=0, window_minutes=0`; else `round((buckets / denom) * 100, 1)` and `max(denom - buckets, 0)`.

### Docs amendment (D-01)
- `.planning/REQUIREMENTS.md` SGN-ANA-01 amended: removed "No new database tables." and appended the append-only-log clause with the 2026-04-21 amendment note.
- `.planning/ROADMAP.md` Phase 53 entry was already amended at planning time — no edit needed here (Goal mentions `signage_heartbeat_event`; Success Criteria #1 already references `GET /api/signage/analytics/devices` and `window_minutes`). Grep confirms `signage_heartbeat_event` appears in both files.

## Verification Output

### Alembic round-trip (clean):
```
Running upgrade v1_18_signage_schedules -> v1_18_signage_heartbeat_event
Running downgrade v1_18_signage_heartbeat_event -> v1_18_signage_schedules
Running upgrade v1_18_signage_schedules -> v1_18_signage_heartbeat_event
```

### Python import smoke:
```
signage_heartbeat_event ['device_id', 'uptime_24h_pct', 'missed_windows_24h', 'window_minutes']
```

### OpenAPI path registration:
```
OK: /api/signage/analytics/devices
```

### Signage test suite (174 passed, 2 skipped):
```
tests/test_signage_heartbeat_event_insert.py ..  (2 new tests)
tests/test_signage_heartbeat_sweeper.py .......   (6 existing + 1 new prune test)
tests/test_signage_analytics_router.py ......    (6 new D-20 tests)
...
=============== 174 passed, 2 skipped in 21.18s ================
```

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `2d884c3` | feat(53-01): add signage_heartbeat_event table + DeviceAnalyticsRead schema |
| 2 | `39c010b` | feat(53-01): heartbeat event insert + sweeper 25h prune |
| 3 | `9fa8118` | feat(53-01): GET /api/signage/analytics/devices + 6 D-20 tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `--workers 1` pytest flag not supported**
- **Found during:** Task 2 first verification run
- **Issue:** Plan prescribes `pytest --workers 1 -x` as a hard gate, but the project does not have `pytest-xdist` / `pytest-parallel` installed. `pytest: error: unrecognized arguments: --workers 1`.
- **Fix:** Dropped the `--workers 1` flag. Pytest runs single-worker by default without `pytest-xdist`, so the underlying invariant (no parallel test workers racing the shared DB) is preserved. The `--workers 1` hard gate in CLAUDE.md / project docs refers to the `uvicorn --workers 1` runtime invariant, not a pytest invocation style — that remains enforced in `docker-compose.yml`.
- **Files modified:** none (verification-only fix)
- **Verification:** `pytest tests/test_signage_heartbeat_event_insert.py tests/test_signage_heartbeat_sweeper.py tests/test_signage_analytics_router.py` → 17 passed.

**2. [Rule 1 - Bug] `test_signage_schema_roundtrip` hardcoded expected-tables list**
- **Found during:** Task 3 full-suite verification
- **Issue:** `tests/test_signage_schema_roundtrip.py` asserts `_signage_tables() == EXPECTED_TABLES` with a hardcoded 9-table set and `SIGNAGE_HEAD_REVISION = "v1_18_signage_schedules"` + `SIGNAGE_DOWNGRADE_STEPS = 3`. The new `signage_heartbeat_event` migration broke this assertion.
- **Fix:** Added `"signage_heartbeat_event"` to `EXPECTED_TABLES`; bumped `SIGNAGE_HEAD_REVISION` to `"v1_18_signage_heartbeat_event"` and `SIGNAGE_DOWNGRADE_STEPS` to `4`; updated the "8 expected" comment → "10 expected" and made the assert message size-agnostic (`len(EXPECTED_TABLES)`).
- **Files modified:** `backend/tests/test_signage_schema_roundtrip.py`
- **Verification:** `pytest tests/test_signage_schema_roundtrip.py` → 5 passed.
- **Commit:** `9fa8118` (bundled with Task 3).

**Total deviations:** 2 auto-fixed (1 Rule-3 blocking, 1 Rule-1 bug). **Impact:** No functional change; both are test-harness corrections strictly caused by the new migration + test-runner environment mismatch.

## Authentication Gates

None — Task 1 docs amendment and Task 2/3 used existing test fixtures (`mint_device_jwt`, `_mint(ADMIN_UUID)`). No manual auth steps required.

## Known Stubs

None. Every path exercised by the 6 D-20 scenarios returns real data from real SQL against real Postgres.

## Interface Contract for Plan 02

Plan 02 (frontend-devices-analytics-columns) MUST pin against:

### Endpoint
- **Path:** `GET /api/signage/analytics/devices`
- **Auth:** admin JWT in `Authorization: Bearer <jwt>` header (inherited from parent `signage_admin` router; viewer role returns 403; no auth returns 401)
- **Response:** `200 OK`, `application/json`, `list[DeviceAnalyticsRead]`

### Response item shape (TypeScript mirror)

```typescript
export interface DeviceAnalytics {
  device_id: string;           // UUID
  uptime_24h_pct: number | null;  // null when device has zero heartbeats ever
  missed_windows_24h: number;  // 0..1440; 0 when denominator==0
  window_minutes: number;      // 0..1440; drives "over last Xh" tooltip (D-06)
}
```

### Zero-heartbeat resolution (resolves D-16 ambiguity)
**Zero-heartbeat devices are INCLUDED** in the response with:
- `uptime_24h_pct: null`
- `missed_windows_24h: 0`
- `window_minutes: 0`

**Frontend rendering:** The neutral "—" badge should be triggered when `uptime_24h_pct === null`. Plan 02's `UptimeBadge` must handle the `null` case explicitly; no client-side "missing from map" fallback is needed because the server always includes the row for non-revoked devices.

### Revoked devices (D-07)
**Revoked devices are EXCLUDED server-side.** Frontend does not need to filter by `revoked_at` for the analytics column — just look up `device.id` in the analytics map and render the neutral badge if missing (edge case: race between device revoke and next 30 s poll).

### Field precision
- `uptime_24h_pct` is rounded server-side to **1 decimal** (e.g., `99.8`, `100.0`, `50.0`). Frontend should render `.toFixed(1)` or equivalent and use plain `===` comparison against thresholds (`>= 95`, `>= 80`) — no floating-point slop at 1-decimal precision.
- `missed_windows_24h` and `window_minutes` are integers.

## Self-Check: PASSED

**Created files verified on disk:**
- `backend/alembic/versions/v1_18_signage_heartbeat_event.py` — FOUND
- `backend/app/routers/signage_admin/analytics.py` — FOUND
- `backend/tests/test_signage_heartbeat_event_insert.py` — FOUND
- `backend/tests/test_signage_analytics_router.py` — FOUND
- `.planning/phases/53-analytics-lite/53-01-SUMMARY.md` — (this file)

**Commits verified via `git log --oneline`:**
- `2d884c3` — FOUND
- `39c010b` — FOUND
- `9fa8118` — FOUND

**Next step:** Ready for `53-02-frontend-devices-analytics-columns-PLAN.md`.
