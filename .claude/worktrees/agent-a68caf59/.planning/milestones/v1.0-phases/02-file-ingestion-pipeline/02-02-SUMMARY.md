---
phase: 02-file-ingestion-pipeline
plan: "02"
subsystem: api
tags: [fastapi, sqlalchemy, alembic, postgresql, pandas]

# Dependency graph
requires:
  - phase: 02-01
    provides: ERP parser (parse_erp_file), models (UploadBatch, SalesRecord), schemas (UploadResponse, UploadBatchSummary), database session (get_async_db_session)
provides:
  - POST /api/upload endpoint with parse+store+error reporting and 422 for unsupported file types
  - GET /api/uploads endpoint returning batch history ordered by most recent first
  - DELETE /api/uploads/{id} endpoint with cascade delete of associated sales records
  - Alembic migration for full 38-column sales schema with UNIQUE order_number and ForeignKey with ON DELETE CASCADE
  - Docker stack running with full schema applied and all endpoints verified
affects: [03-frontend, phase-3-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FastAPI APIRouter with /api prefix wired via app.include_router
    - SQLAlchemy pg_insert ON CONFLICT DO NOTHING for idempotent re-uploads
    - AsyncSession.flush() to get auto-incremented ID before commit
    - Alembic autogenerate migration run via docker compose run --rm with volume mount

key-files:
  created:
    - backend/app/routers/__init__.py
    - backend/app/routers/uploads.py
    - backend/alembic/versions/d7547428d885_phase2_full_sales_schema.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Router file extension validation uses case-insensitive suffix check to handle uppercase .CSV etc."
  - "batch.row_count updated to result.rowcount after pg_insert to reflect actual inserts vs skipped duplicates"
  - "AsyncSession.flush() + commit pattern used instead of refresh to avoid N+1 query"

patterns-established:
  - "Router pattern: APIRouter(prefix='/api') wired into app via app.include_router in main.py"
  - "Idempotent insert: pg_insert(...).on_conflict_do_nothing(index_elements=['order_number'])"
  - "File type validation: reject non-.csv/.txt with 422 + human-readable error naming the format"

requirements-completed: [UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, MGMT-01]

# Metrics
duration: 6min
completed: 2026-04-10
---

# Phase 2 Plan 02: Upload API Router and Schema Migration Summary

**FastAPI upload router (POST /api/upload, GET /api/uploads, DELETE /api/uploads/{id}) wired into app with Alembic migration to full 38-column PostgreSQL schema including UNIQUE order_number and cascade delete**

## Performance

- **Duration:** 6 min (~339s)
- **Started:** 2026-04-10T19:48:32Z
- **Completed:** 2026-04-10T19:54:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Three REST endpoints created and verified: POST upload (parse+store+422 for bad types), GET history (empty list), DELETE with cascade
- Alembic migration generated and applied, transitioning from 3-column placeholder to full 38-column sales schema
- Docker stack fully verified: health, migration applied, API endpoints responsive, file type rejection working

## Task Commits

Each task was committed atomically:

1. **Task 1: Create upload router with POST, GET, DELETE endpoints** - `1a3a4d9` (feat)
2. **Task 2: Generate Alembic migration and verify Docker stack** - `64fe20c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/routers/__init__.py` - Empty init for routers package
- `backend/app/routers/uploads.py` - Upload API router with all three endpoints
- `backend/app/main.py` - Added router import and app.include_router
- `backend/alembic/versions/d7547428d885_phase2_full_sales_schema.py` - Full 38-column schema migration

## Decisions Made
- `batch.row_count` updated to `result.rowcount` after `pg_insert` so the response reflects actual rows inserted (skips counts for ON CONFLICT deduplicated rows)
- File extension validation is case-insensitive (`.CSV` and `.csv` both accepted) for robustness
- Used `AsyncSession.flush()` to obtain the `batch.id` before bulk-inserting sales records, avoiding a separate SELECT round-trip

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Docker Compose volume mount (`./backend:/app`) points to the main project directory, not the worktree. After creating router files in the worktree, copied them to the main project so the live-reloading API container picked them up. This is expected behavior for worktree-based execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Upload API fully functional: file upload, parse, store, error reporting
- GET /api/uploads ready for frontend to poll
- DELETE endpoint ready for upload management UI
- Full 38-column schema in place; Phase 3 (dashboard frontend) can bind to all columns for KPI visualization
- No blockers

---
*Phase: 02-file-ingestion-pipeline*
*Completed: 2026-04-10*
