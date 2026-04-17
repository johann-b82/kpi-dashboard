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
