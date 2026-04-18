# Phase 1: Infrastructure and Schema - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a running Docker Compose stack (FastAPI backend + PostgreSQL) with Alembic-managed schema migrations, a health check endpoint, and a developer-ready project structure. No frontend, no file upload logic, no dashboard — just the foundation.

</domain>

<decisions>
## Implementation Decisions

### Database Schema
- **D-01:** Use placeholder columns for `sales_records` table — actual column names deferred until user provides a sample data file before Phase 2. Design the migration to be easy to revise.
- **D-02:** `upload_batches` table tracks: filename, uploaded_at (TIMESTAMPTZ), row_count, status (success/failed/partial). No file size or user columns in v1.
- **D-03:** UNIQUE constraint on `sales_records` natural business key deferred to Phase 2 — depends on actual data columns from sample file.

### Docker Compose Topology
- **D-04:** Phase 1 has two containers only: backend (FastAPI/Uvicorn) and db (PostgreSQL 17-alpine). Frontend container added in Phase 2 or 3.
- **D-05:** Alembic migrations run via a separate short-lived migration service container that exits after completion. Backend container depends on migration service.
- **D-06:** Database credentials stored in `.env` file, referenced via `env_file` in Compose. Commit `.env.example` with placeholder values; `.env` is gitignored.

### Project Structure
- **D-07:** Top-level split: `backend/` and `frontend/` at repo root. `backend/` contains `app/`, `alembic/`, `alembic.ini`, `requirements.txt`, `Dockerfile`. `docker-compose.yml` and `.env.example` at repo root.
- **D-08:** Python dependencies managed via `requirements.txt` — simple, Docker-native.

### Dev Workflow
- **D-09:** All-in-Docker development — `docker compose up` runs everything. Backend container uses volume mount for live code changes with Uvicorn `--reload` in development.
- **D-10:** Include a `GET /health` endpoint that confirms DB connectivity. Used for Docker healthcheck on the API container and end-to-end stack verification.
- **D-11:** Set up Ruff for Python linting and formatting in Phase 1. Add to a `requirements-dev.txt` or equivalent.

### Claude's Discretion
- Placeholder column names and types for `sales_records` (will be revised in Phase 2)
- Exact Ruff configuration rules
- Docker healthcheck intervals and retry settings
- Uvicorn worker count and reload configuration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in:

### Project Documentation
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — INFR-01 (Docker Compose), INFR-02 (schema via migrations)
- `.planning/ROADMAP.md` — Phase 1 success criteria (4 criteria)
- `CLAUDE.md` — Technology stack with exact versions, Docker Compose patterns, Alembic best practices

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code.

### Established Patterns
- None — Phase 1 establishes the patterns all future phases will follow.

### Integration Points
- Schema must support Phase 2's file ingestion (upload_batches + sales_records relationship)
- API structure must support Phase 2's upload endpoint and Phase 3's KPI query endpoints
- Docker Compose must be extensible for frontend container in Phase 2/3

</code_context>

<specifics>
## Specific Ideas

- Sample data file will be provided before Phase 2 to finalize the sales_records schema
- Migration service container pattern chosen over entrypoint script for cleaner separation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-and-schema*
*Context gathered: 2026-04-10*
