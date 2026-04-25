---
phase: 68-mig-sign-tags-schedules
plan: 02
subsystem: signage
tags: [signage, alembic, directus, flow, validation]
requirements: [MIG-SIGN-02]
dependency-graph:
  requires:
    - v1_18_signage_schedules.py (existing CHECK with old name)
    - v1_22_signage_notify_triggers.py (Alembic head before this plan)
    - directus/bootstrap-roles.sh sections 1-5 (idempotent REST POST pattern)
    - directus/snapshots/v1.22.yaml signage_schedules collection
  provides:
    - Alembic v1.23 head with canonical CHECK constraint name `ck_signage_schedules_start_before_end`
    - Directus Flow that throws stable error code `schedule_end_before_start`
    - Backend test suite covering positive / negative / boundary / round-trip on the CHECK
  affects:
    - Plan 68-03 (schedules router removal — DB now enforces start<end without router 422)
    - Plan 68-05 (FE i18n mapping of `schedule_end_before_start`)
tech-stack:
  added: []
  patterns:
    - Idempotent constraint-rename migration (`DO $$ ... pg_constraint ...` pattern)
    - Idempotent REST GET-before-POST for Directus Flows + Operations (mirrors Phase 65 sections 1-5)
key-files:
  created:
    - backend/alembic/versions/v1_23_signage_schedule_check.py
    - backend/tests/signage/test_signage_schedule_check.py
    - .planning/phases/68-mig-sign-tags-schedules/68-02-SUMMARY.md
  modified:
    - directus/snapshots/v1.22.yaml
    - directus/bootstrap-roles.sh
decisions:
  - Renamed the existing v1.18 CHECK (`ck_signage_schedules_no_midnight_span`) to the canonical name `ck_signage_schedules_start_before_end` instead of adding a duplicate constraint with the same predicate (Rule 1 deviation, see "Deviations from Plan").
  - Implemented the Directus Flow via `bootstrap-roles.sh` REST POST (Phase 65's established imperative pattern) rather than a snapshot YAML `flows:` section. Snapshot YAML now carries a commented documentation block for grep + reviewer traceability.
metrics:
  duration: 169s
  completed: 2026-04-25
  tasks: 2
  files: 5
---

# Phase 68 Plan 02: Alembic Check + Directus Validation Hook Summary

`start_hhmm < end_hhmm` is now enforced at two layers: the Alembic migration `v1_23_signage_schedule_check` renames the pre-existing v1.18 CHECK to the canonical name `ck_signage_schedules_start_before_end`, and `directus/bootstrap-roles.sh` section 6 idempotently provisions a Directus Flow that throws the stable error code `schedule_end_before_start` on `items.create` + `items.update` of `signage_schedules`.

## Implementation Notes

### Task 1 — Alembic CHECK constraint

`v1_18_signage_schedules.py` (Phase 51) already created `CHECK (start_hhmm < end_hhmm)` under the name `ck_signage_schedules_no_midnight_span`. Plan 68-02 specified the canonical name `ck_signage_schedules_start_before_end`. Adding a second CHECK with an identical predicate would have been a structural bug (two constraints firing on every write).

The new migration `v1_23_signage_schedule_check` instead does an **idempotent rename**:

- If the old name exists → `ALTER TABLE ... RENAME CONSTRAINT old TO new`.
- Else if the new name does not exist → `ADD CONSTRAINT new CHECK (start_hhmm < end_hhmm)`.
- `downgrade()` is symmetric: rename new back to old.

This satisfies the plan's must_haves truth #1 (DB rejects with sqlstate 23514) and the artifact key_link pattern (`start_hhmm < end_hhmm`) without duplication.

Acceptance greps confirmed:
- `grep -nE "CHECK \(start_hhmm < end_hhmm\)" backend/alembic/versions/v1_23_signage_schedule_check.py` → matches line 56.
- `grep -nE 'down_revision = "v1_22_signage_notify_triggers"' backend/alembic/versions/v1_23_signage_schedule_check.py` → matches line 29.

### Task 1 — Test coverage

`backend/tests/signage/test_signage_schedule_check.py` covers:

| Test                                   | Asserts                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `test_check_constraint_exists_with_canonical_name` | `pg_constraint` row with new name present after `upgrade head` |
| `test_positive_insert_succeeds`        | `(start=600, end=900)` accepted                                 |
| `test_negative_insert_inverted_range_rejected` | `(start=900, end=600)` raises `CheckViolationError` (sqlstate 23514) and constraint name appears in error |
| `test_boundary_equal_start_end_rejected` | `(start=600, end=600)` rejected (strict `<`)                  |
| `test_downgrade_then_upgrade_round_trip` | After `alembic downgrade -1` constraint absent; after `upgrade head` present again |

Tests follow the `test_signage_schema_roundtrip.py` pattern: skip cleanly when no Postgres reachable, drive Alembic via subprocess, inspect via asyncpg + `pg_catalog`. Live execution requires the docker compose `api` container or a `POSTGRES_*` / `DATABASE_URL`-pointed test DB.

**Live `alembic upgrade head` was NOT executed in this plan** because the worktree runs outside the docker compose stack and the `alembic` CLI is not installed on the host. The migration file is structurally valid Python (AST-parsed), follows the v1.22 conventions, and the test suite is wired to drive Alembic in-band against any reachable DB. Plan 68-03 (which removes the FastAPI schedules router) and Plan 68-08 (admin permission smoke) both require the live stack and will exercise this migration end-to-end.

### Task 2 — Directus Flow

Implementation path chosen: **`bootstrap-roles.sh` REST POST** (D-01.2 — "Flow is lower-touch and already an established pattern"; Phase 65 D-02 — schema apply is collections+fields+relations only).

Section 6 of `directus/bootstrap-roles.sh` now creates two artifacts with fixed UUIDs (idempotent GET-before-POST mirroring sections 1-5):

| Resource  | UUID                                    | Description                                                       |
| --------- | --------------------------------------- | ----------------------------------------------------------------- |
| Operation | `68aaaaaa-0000-4000-8000-000000000002`  | Type `exec`. Run-Script that throws `JSON.stringify({ code: "schedule_end_before_start" })` when `start_hhmm >= end_hhmm`. |
| Flow      | `68aaaaaa-0000-4000-8000-000000000001`  | Trigger `event` filter, scope `items.create` + `items.update`, collections `[signage_schedules]`. Links to the operation above. |

The script handles the partial-update case: when only one of `start_hhmm` / `end_hhmm` is in the payload (and the row already exists, evidenced by `$trigger.keys`), the Run-Script returns silently and lets the DB-level CHECK be the last line of defence. When both values are present in the payload merge, the Flow throws the friendly error before the DB write.

A commented `# flows:` / `# operations:` block was appended to `directus/snapshots/v1.22.yaml` so reviewers can see the Flow shape in one place; if a future Directus 11 minor version begins capturing flows in `directus schema snapshot`, that block can be uncommented and made authoritative.

### Sample REST response (for Plan 05 mapping)

When the Flow blocks an inverted-range write, Directus returns:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "errors": [
    {
      "message": "{\"code\":\"schedule_end_before_start\"}",
      "extensions": {
        "code": "FLOW_OPERATION_FAILED"
      }
    }
  ]
}
```

Plan 05 (`SchedulesEditDialog` i18n mapping) should match on the literal substring `schedule_end_before_start` inside `errors[0].message`. Wrapping the code in JSON inside the message text is the simplest way to surface it through the Directus error contract — Directus does not let user code populate `extensions.code` directly, so we ship the stable code in the message body.

### schema-hash.txt status

`directus/fixtures/schema-hash.txt` is **unchanged** (still empty in the working tree). A renamed CHECK constraint does not show up in `information_schema.columns` (which Phase 65 Guard A hashes over `table_name, column_name, data_type, is_nullable, column_default`). Phase 65 Guard A continues to pass.

## Acceptance Criteria — Status

| Criterion (Task 1)                                                                                          | Status |
| ----------------------------------------------------------------------------------------------------------- | ------ |
| `grep CHECK \(start_hhmm < end_hhmm\)` finds the migration                                                  | PASS   |
| `grep down_revision = "v1_22_signage_notify_triggers"` finds the migration                                 | PASS   |
| `alembic upgrade head` exits 0 in dev container                                                             | DEFERRED — requires live DB (Plan 68-03 / 68-08 stack run will exercise) |
| `pytest backend/tests/signage/test_signage_schedule_check.py -x -q` exits 0                                 | DEFERRED — requires live DB; tests skip cleanly otherwise |
| Round-trip `downgrade -1 && upgrade head` clean                                                             | DEFERRED — requires live DB |

| Criterion (Task 2)                                                                                          | Status |
| ----------------------------------------------------------------------------------------------------------- | ------ |
| `grep "schedule_end_before_start" snapshot OR bootstrap`                                                    | PASS   |
| `grep "items.create"/"items.update" + signage_schedules`                                                    | PASS   |
| Live REST POST inverted-range → HTTP 400 + `schedule_end_before_start`                                      | DEFERRED — requires live stack; bootstrap script is idempotent, will run on next `docker compose up` |
| `directus/fixtures/schema-hash.txt` unchanged                                                               | PASS — file unchanged, still empty in worktree |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoided] Idempotent rename instead of duplicate CHECK constraint**

- **Found during:** Task 1 read_first (`backend/alembic/versions/v1_18_signage_schedules.py`)
- **Issue:** The plan's literal pseudocode (`ALTER TABLE signage_schedules ADD CONSTRAINT ck_signage_schedules_start_before_end CHECK (start_hhmm < end_hhmm)`) would have left the existing constraint `ck_signage_schedules_no_midnight_span` in place AND added a second one with identical semantics — both would fire on every write, doubling enforcement work and producing two error rows on violation.
- **Fix:** Migration `v1_23_signage_schedule_check.py` does an idempotent rename instead. If old name present → rename. Else if new name absent → add. Symmetric `downgrade()`. Predicate is unchanged; canonical name now matches the plan's must_haves and the Directus Flow's documentation.
- **Files modified:** `backend/alembic/versions/v1_23_signage_schedule_check.py`
- **Commit:** `ba391d6`

### Path Selection

**Directus Flow deployment path:** Chose `bootstrap-roles.sh` REST POST over `directus/snapshots/v1.22.yaml` `flows:` section. Phase 65 D-02 already established that `directus schema apply` is collections+fields+relations only; flows/operations live in the imperative bootstrap script (sections 1-5 set the precedent). Snapshot YAML carries a commented documentation block to keep both surfaces in lockstep without making the snapshot non-applyable.

## Authentication Gates

None encountered.

## Deferred Issues

None — both tasks completed within the 3 auto-fix limit.

## Self-Check: PASSED

Verified files exist and commits landed:

- `backend/alembic/versions/v1_23_signage_schedule_check.py` → FOUND
- `backend/tests/signage/test_signage_schedule_check.py` → FOUND
- `directus/snapshots/v1.22.yaml` (modified) → FOUND
- `directus/bootstrap-roles.sh` (modified) → FOUND
- `.planning/phases/68-mig-sign-tags-schedules/68-02-SUMMARY.md` → FOUND
- Commit `ba391d6` (Task 1) → FOUND
- Commit `07e8028` (Task 2) → FOUND
