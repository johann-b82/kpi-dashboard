# Phase 38 — Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed in this phase.

## Pre-existing: `alembic downgrade base` fails on `7022a1dfd988`

**Found during:** 38-01 plan-level full-chain idempotency verification
**Observed:** `alembic downgrade base` errors with `NotNullViolationError: column "end_time" of relation "personio_attendance" contains null values` while reversing migration `7022a1dfd988_make_attendance_time_columns_nullable`.

**Scope:** NOT caused by Phase 38 changes. The downgrade path of that migration blindly sets `end_time NOT NULL` without back-filling values; any real Personio attendance data with NULL end_time (a legitimate state post-2026-04-12) blocks a full reverse.

**Impact:** Plan 38-01's own round-trip (upgrade head → downgrade -1 → upgrade head) is **unaffected** and passes — that is the binding contract for SEN-DB-08.

**Recommendation:** Fix in a dedicated maintenance plan (outside v1.15 scope). Options:
1. Patch `7022a1dfd988`'s `downgrade()` to `UPDATE personio_attendance SET end_time = start_time WHERE end_time IS NULL` before `ALTER COLUMN SET NOT NULL`.
2. Accept that the project is "forward-only past v1.3" and document the constraint in a RUNBOOK.

Leaving as-is because fixing it would modify historical migration files, which is out-of-scope for Phase 38 (DB foundation for sensors).

## Pre-existing: 29 unrelated tests fail with 401 Unauthorized

**Found during:** 38-03 post-GREEN regression sweep (`pytest tests/ -v`)
**Observed:** 29 tests across `test_settings_api.py`, `test_kpi_chart.py`,
`test_kpi_endpoints.py`, `test_rebuild_*.py`, `test_color_validator.py`,
and one logo-related test in `test_settings_api.py` fail with
`{"detail":"invalid or missing authentication token"}` (HTTP 401).

**Scope:** NOT caused by Phase 38-03 changes. Reproduced on the tip of
`main` with the pre-38-03 scheduler.py (`git stash` + run). These tests
were written before the project adopted the Directus JWT admin gate on
`/api/settings` and related endpoints; they call `await client.get(
"/api/settings")` without minting an admin JWT first, so the new
router-level auth returns 401.

**Impact:** No bearing on Phase 38 correctness. All 24 sensor-related tests
(8 new scheduler tests from 38-03 + 16 from 38-02) pass cleanly:
`pytest tests/test_sensor_scheduler.py tests/test_sensors_admin_gate.py
tests/test_snmp_poller_ci_guards.py tests/test_sensor_schemas.py` →
24 passed.

**Recommendation:** Fix in a dedicated test-harness plan — wire each of
the 29 tests to mint an admin token via the `_mint(ADMIN_UUID)` helper
from `tests/test_directus_auth.py` (same pattern already used by
`test_sensors_admin_gate.py`). Out of scope for Phase 38 (sensor-data
pipeline).
