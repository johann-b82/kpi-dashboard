# Phase 1: Infrastructure and Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 01-infrastructure-and-schema
**Areas discussed:** Database schema design, Docker Compose topology, Project structure, Dev workflow

---

## Database Schema Design

### Column Definition

| Option | Description | Selected |
|--------|-------------|----------|
| I'll share columns now | Type out the column names and what they represent | |
| Typical sales data | Use reasonable defaults: order_date, order_id, product, quantity, unit_price, revenue | |
| I'll provide a sample file | Share an actual file before Phase 2 — use placeholder columns for now | ✓ |

**User's choice:** I'll provide a sample file
**Notes:** Schema will use placeholder columns in Phase 1; real columns locked when sample data is provided before Phase 2.

### Upload Batches Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Those three + status | filename, uploaded_at, row_count, status (success/failed/partial) | ✓ |
| Add file size + user | Also track original file size and optional user identifier | |
| You decide | Claude picks reasonable defaults | |

**User's choice:** Those three + status
**Notes:** Minimal metadata — filename, uploaded_at, row_count, status.

### UNIQUE Constraint

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to sample file | Natural key depends on actual columns — define in Phase 2 | ✓ |
| Date + product + amount | Combination like (order_date, product, revenue) | |
| Has a unique ID column | File contains an order_id or transaction_id | |

**User's choice:** Defer to sample file
**Notes:** UNIQUE constraint definition deferred to Phase 2 when real data is available.

---

## Docker Compose Topology

### Container Count

| Option | Description | Selected |
|--------|-------------|----------|
| Backend + DB only | Phase 1 has no frontend work — add frontend container later | ✓ |
| All three now | Set up backend, frontend, and DB containers upfront | |
| You decide | Claude picks the approach | |

**User's choice:** Backend + DB only (Recommended)
**Notes:** Keep Phase 1 lean — two containers only.

### Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Entrypoint script | Run alembic upgrade head in entrypoint before Uvicorn | |
| Separate migration service | Short-lived container runs migrations then exits | ✓ |
| You decide | Claude picks based on project size | |

**User's choice:** Separate migration service
**Notes:** Cleaner separation despite more Compose complexity.

### Environment Variables

| Option | Description | Selected |
|--------|-------------|----------|
| .env file | Single .env file with Postgres credentials, env_file in Compose | ✓ |
| Docker secrets | Use Compose secrets for passwords | |
| You decide | Claude picks simplest secure approach | |

**User's choice:** .env file (Recommended)
**Notes:** .env.example committed to repo, .env gitignored.

---

## Project Structure

### Directory Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level split | backend/ and frontend/ at repo root | ✓ |
| Flat backend | No backend/ folder — app/, alembic/ at repo root | |
| You decide | Claude picks scalable layout | |

**User's choice:** Top-level split (Recommended)
**Notes:** backend/ contains app/, alembic/, alembic.ini, requirements.txt, Dockerfile. docker-compose.yml at root.

### Dependency Management

| Option | Description | Selected |
|--------|-------------|----------|
| requirements.txt | Simple, Docker-native | ✓ |
| pyproject.toml + pip | Modern standard, supports optional groups | |
| Poetry / uv | Full resolver with lockfile | |

**User's choice:** requirements.txt (Recommended)
**Notes:** Simplest option, sufficient for project size.

---

## Dev Workflow

### Local Development

| Option | Description | Selected |
|--------|-------------|----------|
| All in Docker | docker compose up runs everything, volume mounts for live changes | ✓ |
| Postgres in Docker, backend native | Postgres containerized, FastAPI runs natively | |
| You decide | Claude picks Docker-first approach | |

**User's choice:** All in Docker (Recommended)
**Notes:** Consistent with production setup, Docker-first constraint.

### Health Check Endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, basic /health | Simple endpoint that pings DB, used for Docker healthcheck | ✓ |
| No, just container startup | Endpoints come in Phase 2 | |
| You decide | Claude picks verifiable approach | |

**User's choice:** Yes, basic /health (Recommended)
**Notes:** Confirms end-to-end stack works, usable as Docker healthcheck.

### Linting Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Ruff (lint + format) | Single tool for both, fast, modern | ✓ |
| Skip for Phase 1 | Add later when there's more code | |
| You decide | Claude picks based on stage | |

**User's choice:** Ruff (lint + format)
**Notes:** Set up from the start for consistent code quality.

---

## Claude's Discretion

- Placeholder column names and types for sales_records
- Exact Ruff configuration rules
- Docker healthcheck intervals and retry settings
- Uvicorn worker count and reload configuration

## Deferred Ideas

None — discussion stayed within phase scope.
