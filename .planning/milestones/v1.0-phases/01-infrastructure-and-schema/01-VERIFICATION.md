---
phase: 01-infrastructure-and-schema
verified: 2026-04-10T18:00:00Z
status: passed
score: 4/4 success criteria verified
gaps: []
resolution_note: "UNIQUE constraint gap resolved by updating ROADMAP success criterion 3 to reflect D-03 deferral to Phase 2 (placeholder columns)"
---

# Phase 1: Infrastructure and Schema Verification Report

**Phase Goal:** The full Docker Compose stack runs reliably with a correct, future-proof database schema
**Verified:** 2026-04-10T18:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `docker compose up` starts both containers (db + api) without error, in the correct order | VERIFIED | `docker compose ps` shows db (healthy), migrate (exited 0), api (healthy). Dependency chain: db -> migrate -> api via `service_healthy` and `service_completed_successfully`. |
| 2 | The database is accessible from the API container and persists data across restarts | VERIFIED | `curl http://localhost:8000/health` returns `{"status":"ok"}` confirming DB connectivity via SELECT 1. Named volume `postgres_data` configured; Summary confirms data persistence tested across down/up cycles. |
| 3 | Alembic migrations run cleanly and produce upload_batches and sales_records with TIMESTAMPTZ and UNIQUE constraint on natural business key | PARTIAL | Tables exist with correct TIMESTAMPTZ (`timestamp with time zone` on `uploaded_at`). However, NO UNIQUE constraint exists on any natural business key. Only PK indexes present. D-03 explicitly defers this to Phase 2. |
| 4 | Stopping and restarting the stack does not destroy data (named volume confirmed working) | VERIFIED | Named volume `postgres_data` defined in docker-compose.yml. Alembic version `be7013446181` persists in database. Summary documents successful restart test. |

**Score:** 3/4 truths verified (1 partial)

### Required Artifacts (Plan 01)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docker-compose.yml` | Three-service stack (db, migrate, api) | VERIFIED | Contains `service_completed_successfully`, `service_healthy`, `postgres:17-alpine`, named volume, env_file |
| `backend/Dockerfile` | Python container image | VERIFIED | python:3.11-slim, WORKDIR /app, curl installed for healthcheck |
| `backend/app/database.py` | Async engine, AsyncSession, Base | VERIFIED | Exports engine, AsyncSessionLocal, Base, get_async_db_session. Uses `postgresql+asyncpg://` |
| `backend/app/models.py` | UploadBatch and SalesRecord ORM models | VERIFIED | Both models with correct table names, TIMESTAMPTZ on uploaded_at, placeholder columns as designed |
| `backend/app/main.py` | FastAPI app with /health | VERIFIED | GET /health with SELECT 1 DB check, proper error handling with `from exc` |
| `backend/alembic/env.py` | Async migration runner | VERIFIED | run_async_migrations, async_engine_from_config, NullPool, imports Base from app.models |
| `backend/alembic.ini` | Alembic config | VERIFIED | script_location = alembic, sync URL with ConfigParser interpolation |
| `.env.example` | Credential placeholders | VERIFIED | Contains POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB |
| `.gitignore` | Excludes .env | VERIFIED | .env listed, not tracked by git |
| `backend/requirements.txt` | Pinned dependencies | VERIFIED | fastapi, sqlalchemy, asyncpg, alembic, uvicorn, python-multipart at exact versions |
| `backend/requirements-dev.txt` | Dev dependencies | VERIFIED | ruff==0.15.10 |
| `backend/ruff.toml` | Linter config | VERIFIED | target-version py311, line-length 88 |
| `frontend/.gitkeep` | Placeholder | VERIFIED | Exists |
| `backend/app/__init__.py` | Package init | VERIFIED | Exists |
| `backend/alembic/script.py.mako` | Migration template | VERIFIED | Exists |
| `backend/alembic/versions/.gitkeep` | Versions dir placeholder | VERIFIED | Exists |

### Required Artifacts (Plan 02)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.env` | Runtime credentials | VERIFIED | Exists, gitignored, contains POSTGRES_USER=kpi_user |
| `backend/alembic/versions/be7013446181_initial_schema.py` | Initial migration | VERIFIED | Creates upload_batches and sales_records with correct columns |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/alembic/env.py` | `backend/app/models.py` | `from app.models import Base` | WIRED | Line 10: `from app.models import Base` |
| `backend/app/models.py` | `backend/app/database.py` | `from app.database import Base` | WIRED | Line 6: `from app.database import Base` |
| `backend/app/main.py` | `backend/app/database.py` | `from app.database import engine` | WIRED | Line 4: `from app.database import engine` |
| `docker-compose.yml` | `.env` | `env_file` directive | WIRED | All three services use `env_file: .env` |
| `docker-compose.yml migrate` | `alembic migration` | `alembic upgrade head` | WIRED | Migrate service command runs Alembic; migration file included in Docker image |
| `/health endpoint` | `PostgreSQL db` | `SELECT 1 over asyncpg` | WIRED | Live test returns `{"status":"ok"}` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API health endpoint returns OK | `curl -s http://localhost:8000/health` | `{"status":"ok"}` | PASS |
| Both containers running healthy | `docker compose ps` | db: healthy, api: healthy | PASS |
| Tables exist in PostgreSQL | `psql \dt` | alembic_version, upload_batches, sales_records | PASS |
| uploaded_at is TIMESTAMPTZ | `psql \d upload_batches` | `timestamp with time zone` | PASS |
| Alembic version tracked | `SELECT version_num FROM alembic_version` | `be7013446181` | PASS |
| sales_records has correct columns | `psql \d sales_records` | id, upload_batch_id, col_a, col_b, col_c | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFR-01 | 01-01, 01-02 | Application runs via Docker Compose (app container + PostgreSQL container) | SATISFIED | Both containers running healthy, dependency chain working |
| INFR-02 | 01-01, 01-02 | Database schema managed via migrations | SATISFIED | Alembic migration `be7013446181` creates both tables, tracked in `alembic_version` |

No orphaned requirements found. REQUIREMENTS.md maps only INFR-01 and INFR-02 to Phase 1, and both are claimed by the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/models.py` | 28-30 | col_a, col_b, col_c placeholder columns | Info | Intentional per D-01: real column names unknown until Phase 2 sample data review. Not a stub -- these are real nullable columns that will be replaced by a Phase 2 migration. |

No TODO/FIXME/HACK comments found. No `Base.metadata.create_all()`. No `datetime.utcnow()`. No empty return stubs.

### Human Verification Required

### 1. Data Persistence Across Restarts

**Test:** Run `docker compose exec db psql -U kpi_user -d kpi_db -c "INSERT INTO upload_batches (filename, uploaded_at, row_count, status) VALUES ('test.csv', NOW(), 10, 'success');"` then `docker compose down` then `docker compose up -d` then query `SELECT * FROM upload_batches;`
**Expected:** The inserted row survives the restart cycle.
**Why human:** Requires interactive Docker lifecycle operations that cannot be safely run during automated verification without side effects.

### Gaps Summary

One gap identified against ROADMAP success criteria:

**UNIQUE constraint on natural business key (Success Criterion 3):** The ROADMAP success criterion explicitly states "the UNIQUE constraint on the natural business key" should exist. No UNIQUE constraint is present in the models, migration, or database. The research decision D-03 explicitly defers this to Phase 2 because the actual column names are unknown (sales_records uses placeholder columns col_a/b/c). This is a documented, intentional deferral with sound reasoning -- the natural business key cannot be defined until real data columns are known.

**Recommendation:** This gap is LOW SEVERITY because:
1. The deferral is well-documented (D-03 in CONTEXT and RESEARCH)
2. The placeholder columns make it impossible to define the correct business key now
3. Phase 2 will replace the placeholder columns and should add the UNIQUE constraint at that time

The most appropriate resolution is to update the ROADMAP success criterion 3 to reflect the documented D-03 deferral, moving the UNIQUE constraint requirement to Phase 2 where the real columns will be defined.

---

_Verified: 2026-04-10T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
