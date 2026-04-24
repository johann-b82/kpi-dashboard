---
phase: 65-foundation-schema-authz-sse-bridge
plan: 03
subsystem: database
tags: [postgres, alembic, plpgsql, listen-notify, sse, triggers, migrations]

# Dependency graph
requires:
  - phase: 65-02
    provides: v1_21_signage_calibration migration (current Alembic head before this plan)
provides:
  - Alembic migration v1_22_signage_notify_triggers creating shared signage_notify() PL/pgSQL function
  - 8 AFTER triggers on 6 signage tables emitting pg_notify('signage_change', {table, op, id})
  - Preflight assertion blocking upgrade if signage_devices.tags column appears
  - Clean downgrade dropping all 8 triggers and the function
affects: [65-04-pg-listen-service, 66-kill-me-py, 67-data-split, 68-mig-sign-tags-schedules]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PL/pgSQL shared trigger function dispatched from multiple CREATE TRIGGER statements"
    - "Alembic PREFLIGHT_SQL via op.execute() before DDL to validate schema invariants"
    - "TG_TABLE_NAME branching in trigger function for tables without scalar id column"

key-files:
  created:
    - backend/alembic/versions/v1_22_signage_notify_triggers.py
  modified: []

key-decisions:
  - "WHEN clause on signage_devices UPDATE reduced to name-only (no OR OLD.tags clause) because signage_devices has no denormalized tags column — tags live exclusively in signage_device_tag_map"
  - "Tag map tables (signage_device_tag_map, signage_playlist_tag_map) use composite PKs with no scalar id column; function branches on TG_TABLE_NAME to emit device_id/playlist_id as the notification id field so the listener can resolve affected devices"
  - "Preflight assertion added as op.execute(PREFLIGHT_SQL) before FUNCTION_SQL to convert the column-absence assumption into a loud upgrade-time failure if ever violated"

patterns-established:
  - "Pattern: Alembic migrations can include a PREFLIGHT_SQL block (DO $$ BEGIN IF EXISTS ... RAISE EXCEPTION END $$) to validate schema invariants before applying DDL"
  - "Pattern: PL/pgSQL trigger functions supporting tables with composite PKs must branch on TG_TABLE_NAME to select the correct column for the notification payload id field"

requirements-completed: [SSE-01, SSE-02]

# Metrics
duration: 2min
completed: 2026-04-24
---

# Phase 65 Plan 03: SSE Triggers Summary

**Alembic migration v1_22 shipping shared signage_notify() PL/pgSQL function + 8 AFTER triggers on 6 signage tables emitting pg_notify('signage_change', JSON) with preflight assertion and clean downgrade**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-24T17:33:14Z
- **Completed:** 2026-04-24T17:35:24Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Created single Alembic migration with PREFLIGHT_SQL + FUNCTION_SQL + TRIGGERS_SQL executed in order
- 8 triggers across 6 tables: 5 unguarded multi-op triggers + 3 on signage_devices (INSERT unguarded, DELETE unguarded, UPDATE WHEN-gated on name only)
- Preflight blocks upgrade if signage_devices.tags column ever appears, making the name-only WHEN clause assumption explicit and auditable
- Tag map tables handled correctly: function branches on TG_TABLE_NAME to emit device_id/playlist_id as id field (no scalar id on composite-PK tables)
- Downgrade drops all 8 triggers + function via DROP TRIGGER IF EXISTS on each table

## Task Commits

1. **Task 1: Create Alembic migration v1_22_signage_notify_triggers.py** - `6b13b3a` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/alembic/versions/v1_22_signage_notify_triggers.py` — Alembic migration with PREFLIGHT_SQL, FUNCTION_SQL, TRIGGERS_SQL, upgrade(), downgrade()

## Decisions Made

- WHEN clause reduced to `OLD.name IS DISTINCT FROM NEW.name` only. Context D-07 said `OR OLD.tags IS DISTINCT FROM NEW.tags` but v1_16_signage_schema.py confirms no tags column on signage_devices — tags are in signage_device_tag_map exclusively. Tag map has its own trigger.
- Tag map tables (signage_device_tag_map, signage_playlist_tag_map) have composite PKs with no scalar `id` column. The plan's template function used `NEW.id`/`OLD.id` unconditionally which would fail at runtime. Fixed by branching on `TG_TABLE_NAME` to emit device_id/playlist_id respectively.
- Preflight added as first op.execute() call to make the column-absence assumption auditable. If a future migration adds signage_devices.tags, upgrade fails with a clear error instead of silently creating an incomplete trigger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed trigger function for composite-PK tag map tables**
- **Found during:** Task 1 (reading v1_16_signage_schema.py)
- **Issue:** The plan's FUNCTION_SQL template accessed `NEW.id::text` / `OLD.id::text` unconditionally. signage_device_tag_map and signage_playlist_tag_map use composite PKs (device_id+tag_id, playlist_id+tag_id) with no scalar id column. Running `NEW.id` on these tables would raise a runtime PL/pgSQL error on every INSERT/UPDATE/DELETE.
- **Fix:** Added TG_TABLE_NAME branching in the function body: device_tag_map emits device_id, playlist_tag_map emits playlist_id. All other tables (including signage_playlists, signage_playlist_items, signage_schedules, signage_devices) use the id column as before.
- **Files modified:** backend/alembic/versions/v1_22_signage_notify_triggers.py
- **Verification:** Python ast.parse passes; grep confirms 8 CREATE TRIGGER statements; all key content assertions pass
- **Committed in:** 6b13b3a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correctness — without this fix every tag map mutation would crash the trigger. No scope creep.

## Issues Encountered

None beyond the composite-PK bug documented above.

## User Setup Required

None — no external service configuration required. Migration will run automatically via `docker compose run --rm migrate alembic upgrade head` on next deployment.

## Next Phase Readiness

- Migration v1_22 is on the Alembic chain at `down_revision = "v1_21_signage_calibration"`
- Plan 04 (signage_pg_listen.py listener service) can now implement asyncpg `add_listener('signage_change', ...)` against the channel this migration activates
- The listener handler for signage_device_tag_map must use the emitted value as `device_id` (not a generic row id) — this matches the Pattern 4 example in 65-RESEARCH.md which already calls `devices_affected_by_device_update(db, _uuid.UUID(row_id))`

---
*Phase: 65-foundation-schema-authz-sse-bridge*
*Completed: 2026-04-24*
