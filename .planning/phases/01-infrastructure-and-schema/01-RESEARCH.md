# Phase 1: Infrastructure and Schema - Research

**Researched:** 2026-04-10
**Domain:** Docker Compose orchestration, FastAPI/SQLAlchemy async stack, Alembic migrations, PostgreSQL schema design
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use placeholder columns for `sales_records` table — actual column names deferred until user provides a sample data file before Phase 2. Design the migration to be easy to revise.
- **D-02:** `upload_batches` table tracks: filename, uploaded_at (TIMESTAMPTZ), row_count, status (success/failed/partial). No file size or user columns in v1.
- **D-03:** UNIQUE constraint on `sales_records` natural business key deferred to Phase 2 — depends on actual data columns from sample file.
- **D-04:** Phase 1 has two containers only: backend (FastAPI/Uvicorn) and db (PostgreSQL 17-alpine). Frontend container added in Phase 2 or 3.
- **D-05:** Alembic migrations run via a separate short-lived migration service container that exits after completion. Backend container depends on migration service.
- **D-06:** Database credentials stored in `.env` file, referenced via `env_file` in Compose. Commit `.env.example` with placeholder values; `.env` is gitignored.
- **D-07:** Top-level split: `backend/` and `frontend/` at repo root. `backend/` contains `app/`, `alembic/`, `alembic.ini`, `requirements.txt`, `Dockerfile`. `docker-compose.yml` and `.env.example` at repo root.
- **D-08:** Python dependencies managed via `requirements.txt` — simple, Docker-native.
- **D-09:** All-in-Docker development — `docker compose up` runs everything. Backend container uses volume mount for live code changes with Uvicorn `--reload` in development.
- **D-10:** Include a `GET /health` endpoint that confirms DB connectivity. Used for Docker healthcheck on the API container and end-to-end stack verification.
- **D-11:** Set up Ruff for Python linting and formatting in Phase 1. Add to a `requirements-dev.txt` or equivalent.

### Claude's Discretion

- Placeholder column names and types for `sales_records` (will be revised in Phase 2)
- Exact Ruff configuration rules
- Docker healthcheck intervals and retry settings
- Uvicorn worker count and reload configuration

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Application runs via Docker Compose (app container + PostgreSQL container) | Docker Compose v2 healthcheck and `depends_on` patterns documented; migration service container pattern confirmed |
| INFR-02 | Database schema managed via migrations | Alembic async env.py template pattern documented; TIMESTAMPTZ via `DateTime(timezone=True)` confirmed |
</phase_requirements>

---

## Summary

Phase 1 establishes the Docker Compose stack and Alembic-managed schema that every subsequent phase builds on. The core challenges are: (1) correct container startup ordering — the db must be healthy before migrations run, and migrations must complete before the API starts; (2) the Alembic/async SQLAlchemy integration, which requires a separate sync engine URL in `alembic.ini` alongside the async engine used by FastAPI; (3) a database schema that is deliberately forward-compatible — `upload_batches` fully defined, `sales_records` with placeholder columns designed to be replaced in Phase 2 via a new migration.

The selected stack (FastAPI + SQLAlchemy 2.0 async + asyncpg + Alembic + PostgreSQL 17-alpine) is fully defined in CLAUDE.md with pinned versions verified against PyPI and Docker Hub. No stack decisions remain open for this phase. The only discretion items are internal configuration details (Ruff rules, healthcheck timing, placeholder column names).

**Primary recommendation:** Follow the migration-service container pattern (`condition: service_completed_successfully`) — it gives the cleanest separation and avoids startup-race issues. Use Alembic's official `async` template for `env.py` to get the correct `run_async_migrations` / `NullPool` pattern.

---

## Standard Stack

### Core (all versions from CLAUDE.md — verified against PyPI and Docker Hub)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | REST API framework, `/health` endpoint | Native async, automatic OpenAPI, UploadFile built-in |
| Uvicorn | 0.44.0 | ASGI server | Standard FastAPI server; `--reload` for dev, `--workers` for prod |
| python-multipart | 0.0.26 | Multipart form parsing | Hard runtime requirement for FastAPI `UploadFile` |
| SQLAlchemy | 2.0.49 | ORM + async query builder | Industry standard; v2.0 `AsyncSession` stable |
| asyncpg | 0.31.0 | Async PostgreSQL driver | Required by `postgresql+asyncpg://` engine URL |
| Alembic | 1.18.4 | Schema migrations | Standard SQLAlchemy migration tool; never use `create_all()` |
| Pydantic v2 | >=2.9.0 (via FastAPI) | Config via `BaseSettings` | Bundled with FastAPI 0.135.x |
| PostgreSQL | 17-alpine | Database | Project constraint; alpine ~50% smaller than debian |

### Dev

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Ruff | 0.15.10 | Linting + formatting | All Python files in `backend/`; replaces flake8 + black + isort |

**Version verification:**
- `ruff 0.15.10` — verified via PyPI API (`pip3 index versions ruff` on 2026-04-10)
- All other backend versions from CLAUDE.md are pre-verified against PyPI (HIGH confidence, stated in CLAUDE.md)

**Installation (`backend/requirements.txt`):**
```
fastapi==0.135.3
uvicorn==0.44.0
python-multipart==0.0.26
sqlalchemy==2.0.49
asyncpg==0.31.0
alembic==1.18.4
```

**Installation (`backend/requirements-dev.txt`):**
```
ruff==0.15.10
```

---

## Architecture Patterns

### Recommended Project Structure

```
acm-kpi-light/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app, /health endpoint
│   │   ├── database.py      # async engine, AsyncSession, get_async_db_session
│   │   └── models.py        # SQLAlchemy ORM models (upload_batches, sales_records)
│   ├── alembic/
│   │   ├── env.py           # async migration runner
│   │   ├── script.py.mako
│   │   └── versions/        # generated migration files
│   ├── alembic.ini          # sync sqlalchemy.url for Alembic CLI
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/                # empty placeholder — populated in Phase 2/3
├── docker-compose.yml
├── .env                     # gitignored
└── .env.example             # committed, placeholder values
```

### Pattern 1: Docker Compose Three-Service Stack with Migration Container

**What:** Three Compose services — `db`, `migrate`, `api`. `migrate` is a short-lived container using the same image as `api` that runs `alembic upgrade head` and exits 0. `api` waits for `migrate` to complete successfully before starting.

**When to use:** Any time schema changes must be applied before the app processes requests. Avoids race condition where API starts before tables exist.

**Example:**
```yaml
# docker-compose.yml
services:
  db:
    image: postgres:17-alpine
    env_file: .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  migrate:
    build: ./backend
    command: alembic upgrade head
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

  api:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    env_file: .env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app   # live reload mount for dev
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s

volumes:
  postgres_data:
```

**Key notes:**
- `condition: service_healthy` on `db` — pg_isready is built into the postgres image, no extra tools needed
- `condition: service_completed_successfully` on `migrate` — introduced in Compose 1.29+; Docker Compose v2 plugin supports it
- Named volume `postgres_data` ensures data survives `docker compose down` (not `docker compose down -v`)
- `--reload` is for dev only; production uses `--workers N`

### Pattern 2: Alembic Async env.py

**What:** Alembic uses a sync execution model even in async apps. The official async template wraps migrations via `asyncio.run()` and `connection.run_sync()`. `NullPool` is required to prevent connection pool conflicts during migration.

**When to use:** Any FastAPI + SQLAlchemy async project using asyncpg.

**Example:**
```python
# backend/alembic/env.py  (generated from "alembic init --template async")
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Import your models so autogenerate detects them
from app.models import Base  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # required for migration context
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    # offline mode not needed for this project; leave as-is or raise NotImplementedError
    pass
else:
    run_migrations_online()
```

**Critical:** `alembic.ini` must use the SYNC URL (no `+asyncpg`):
```ini
# backend/alembic.ini
sqlalchemy.url = postgresql://%(POSTGRES_USER)s:%(POSTGRES_PASSWORD)s@db:5432/%(POSTGRES_DB)s
```
The async engine in `app/database.py` uses `postgresql+asyncpg://`. These are TWO separate URLs for two different purposes.

### Pattern 3: Async Database Engine and Session

**What:** FastAPI dependency that yields an `AsyncSession`. The engine is created once at module load with `create_async_engine`.

**When to use:** Every database-touching endpoint.

**Example:**
```python
# backend/app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

DATABASE_URL = (
    f"postgresql+asyncpg://{os.environ['POSTGRES_USER']}:"
    f"{os.environ['POSTGRES_PASSWORD']}@db:5432/{os.environ['POSTGRES_DB']}"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_async_db_session():
    async with AsyncSessionLocal() as session:
        yield session
```

### Pattern 4: GET /health Endpoint with DB Connectivity Check

**What:** Endpoint that executes `SELECT 1` over an actual async DB connection. Returns 200 if DB is reachable, 503 if not. Used by Docker healthcheck and manual stack verification.

**Example:**
```python
# backend/app/main.py
from fastapi import FastAPI
from sqlalchemy import text
from app.database import engine

app = FastAPI(title="ACM KPI Light")


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}")
```

### Pattern 5: SQLAlchemy Models with TIMESTAMPTZ

**What:** Use `DateTime(timezone=True)` in `mapped_column` to map to PostgreSQL TIMESTAMPTZ. Store and pass timezone-aware `datetime` objects (UTC).

**Example:**
```python
# backend/app/models.py
from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # "success" | "failed" | "partial"


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_batch_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # Placeholder columns — replaced in Phase 2 migration after sample file review
    col_a: Mapped[str | None] = mapped_column(String(255), nullable=True)
    col_b: Mapped[str | None] = mapped_column(String(255), nullable=True)
    col_c: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

**Key note:** `col_a`, `col_b`, `col_c` are intentional placeholders per D-01. They will be dropped and replaced with real columns in a Phase 2 migration. Using `nullable=True` makes the placeholder migration easy to evolve without data loss.

### Pattern 6: Ruff Configuration

**What:** Single `ruff.toml` (or section in `pyproject.toml`) covering both linting and formatting.

**Example (`backend/ruff.toml`):**
```toml
[tool.ruff]
target-version = "py311"
line-length = 88

[tool.ruff.lint]
# E/F = pycodestyle errors + pyflakes (default)
# I   = import sorting
# B   = bugbear (common pitfalls)
# UP  = pyupgrade (modern Python idioms)
# SIM = simplify
extend-select = ["I", "B", "UP", "SIM"]
ignore = ["ISC001"]  # conflicts with formatter

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

**Usage in dev container:**
```bash
ruff check .
ruff format .
```

### Anti-Patterns to Avoid

- **`create_all()` instead of Alembic:** Produces no migration history, cannot evolve schema safely. Never call `Base.metadata.create_all()` in production code.
- **Using `latest` postgres image tag:** Breaks silently on major version upgrades. Always pin `postgres:17-alpine`.
- **`depends_on: db` without condition:** Container starts before PostgreSQL accepts connections. Always use `condition: service_healthy`.
- **Sync engine with asyncpg driver:** Mixing `create_engine` (sync) with `postgresql+asyncpg://` will fail at runtime. Use `create_async_engine` for async URLs.
- **Same URL for Alembic and FastAPI:** Alembic CLI requires a sync URL (`postgresql://`); FastAPI requires an async URL (`postgresql+asyncpg://`). Configure both separately.
- **`--reload` in production Docker:** Only use Uvicorn `--reload` in the dev Docker config. The migrate/production variant must not use it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migrations | Custom SQL scripts | Alembic | Handles history, rollback, autogenerate; scripts don't |
| Container startup ordering | Custom wait-for-it.sh scripts | `condition: service_healthy` + `pg_isready` | pg_isready is built into postgres image; healthcheck is native Compose |
| Python linting/formatting | Manual style guides | Ruff | Replaces flake8 + black + isort in a single tool at 10-100x speed |
| Async DB session lifecycle | Manual `session.close()` | `async with AsyncSessionLocal() as session: yield session` | Context manager handles close/rollback on exception |

**Key insight:** Docker Compose v2 provides all the startup sequencing primitives needed. There is no reason to use `wait-for-it.sh` or `dockerize` in 2026.

---

## Common Pitfalls

### Pitfall 1: Migration Container Not Exiting Zero

**What goes wrong:** `alembic upgrade head` exits non-zero (DB error, import error, bad migration), but `api` starts anyway because Compose only checks `service_completed_successfully` on zero exit.
**Why it happens:** Python import errors in `env.py` or missing environment variables silently fail before Alembic even connects.
**How to avoid:** Test the migration container locally with `docker compose run migrate` before `docker compose up`. Verify all env vars are present in `.env`.
**Warning signs:** API starts but tables don't exist; `psql` shows empty schema.

### Pitfall 2: Alembic autogenerate Doesn't See Models

**What goes wrong:** `alembic revision --autogenerate` generates an empty migration despite model changes.
**Why it happens:** Models are not imported in `env.py` before `target_metadata = Base.metadata` is set. Python's lazy import means the ORM classes haven't registered with the Base.
**How to avoid:** Add explicit model imports at the top of `env.py`: `from app.models import UploadBatch, SalesRecord  # noqa: F401`.
**Warning signs:** Empty `op.create_table()` calls or no operations in generated migration.

### Pitfall 3: Naive Datetimes Inserted into TIMESTAMPTZ Columns

**What goes wrong:** `datetime.utcnow()` (naive, no tzinfo) inserted into a TIMESTAMPTZ column — PostgreSQL accepts it but interprets it as local server time, not UTC.
**Why it happens:** Python's `datetime.utcnow()` returns a naive datetime despite the name implying UTC.
**How to avoid:** Always use `datetime.now(tz=timezone.utc)` (Python 3.11+) or `datetime.now(UTC)`. Never use `datetime.utcnow()`.
**Warning signs:** Timestamps off by hours in query results.

### Pitfall 4: Named Volume Destroyed on `docker compose down -v`

**What goes wrong:** Developer runs `docker compose down -v` during testing, wiping the `postgres_data` volume.
**Why it happens:** The `-v` flag removes named volumes. This is appropriate during reset but catastrophic if done accidentally in a shared environment.
**How to avoid:** Document clearly in the project README: use `docker compose down` (no `-v`) to stop while preserving data; use `docker compose down -v` only for a full reset.
**Warning signs:** Database empty after restart; Alembic migration history also gone.

### Pitfall 5: `--reload` Live-Reload Mount Conflicts

**What goes wrong:** When using `volumes: ./backend:/app` for live reload, if the container working directory doesn't match the mount point, imports fail.
**Why it happens:** Dockerfile `WORKDIR /app` and the volume mount must agree. If Uvicorn runs from `/app` but the import `from app.main import app` expects a package structure, the path must be consistent.
**How to avoid:** Set `WORKDIR /app` in Dockerfile. Mount `./backend:/app`. Run uvicorn as `uvicorn app.main:app` (treating `app/` as a package inside `/app`).
**Warning signs:** `ModuleNotFoundError: No module named 'app'` on container start.

---

## Code Examples

### Complete `.env.example`
```bash
# Source: Docker Compose best practices — never hardcode credentials
POSTGRES_USER=acm_user
POSTGRES_PASSWORD=changeme
POSTGRES_DB=acm_kpi
```

### Alembic Init Command (from inside backend container)
```bash
# Run once to scaffold the alembic directory
alembic init --template async alembic
```
This generates the correct async `env.py` template. Edit to import models as shown in Pattern 2.

### Health Check Manual Test
```bash
curl -f http://localhost:8000/health
# Expected: {"status":"ok"}
```

### Verify Named Volume Persists
```bash
docker compose down          # stop, keep volume
docker compose up -d         # restart
curl http://localhost:8000/health  # db connectivity confirmed = data persisted
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `wait-for-it.sh` scripts | `condition: service_healthy` with pg_isready | Compose 1.29+ (2021) | No extra tooling needed |
| `docker-compose` v1 (Python CLI) | `docker compose` v2 (Go plugin) | 2022, v1 EOL | Syntax: no hyphen; `depends_on` conditions fully supported |
| SQLAlchemy 1.x sync Session | SQLAlchemy 2.0 `AsyncSession` + `Mapped[]` | 2023 (2.0 stable) | Type-safe, async-native; no legacy patterns |
| `Base.metadata.create_all()` | Alembic `upgrade head` | Best practice reinforced in 2022+ | Migration history, rollback, team consistency |
| `datetime.utcnow()` | `datetime.now(tz=timezone.utc)` | Python 3.12 deprecated utcnow() | Correct timezone-aware UTC |
| Separate flake8 + black + isort | Ruff (unified) | 2023-2024 ecosystem shift | Single tool, 10-100x faster, no conflicts |

**Deprecated/outdated:**
- `docker-compose` (v1 hyphenated): End of life; use `docker compose` (v2 plugin)
- `datetime.utcnow()`: Deprecated in Python 3.12; use `datetime.now(tz=timezone.utc)`
- SQLAlchemy `Session` (sync) in async FastAPI apps: Causes deadlocks; use `AsyncSession`

---

## Open Questions

1. **Uvicorn worker count for production**
   - What we know: `--reload` must be dev-only; `--workers` is for production
   - What's unclear: This is a dev-phase only project right now; production uvicorn config is out of scope for Phase 1
   - Recommendation: Use `--reload` in dev Dockerfile CMD. Add a comment noting production should use `--workers $(nproc)` when Phase 1 is promoted

2. **Placeholder column types for `sales_records`**
   - What we know: D-01 says use placeholder columns; D-03 defers UNIQUE constraint to Phase 2
   - What's unclear: The actual column names and types depend on the sample data file
   - Recommendation: Use 3 nullable `String(255)` columns named `col_a`, `col_b`, `col_c`. This makes the Phase 2 migration a straightforward `op.drop_column` + `op.add_column` sequence with no data loss concern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Desktop | Running containers, `docker compose up` | NOT INSTALLED | — | Must install Docker Desktop for macOS before Phase 1 can be executed |
| Python 3 | Ruff, local dev tools | Available (system) | 3.9.6 | — (only used for dev tooling outside Docker) |
| Node.js | npm (future frontend) | Available | 25.9.0 | — |
| pg_isready | Docker healthcheck (runs inside postgres container) | Available inside postgres:17-alpine | built-in | — |

**Missing dependencies with no fallback:**
- **Docker Desktop:** Not installed on this macOS machine. `docker compose up` will not work until Docker Desktop (or Docker Engine via Colima/OrbStack) is installed. The planner MUST include a Wave 0 task: "Install Docker Desktop for macOS".

**Missing dependencies with fallback:**
- None beyond Docker.

---

## Project Constraints (from CLAUDE.md)

These directives are mandatory. The planner must not recommend approaches that contradict them.

| Directive | Applies To |
|-----------|-----------|
| Must run via Docker Compose — no bare-metal dependencies | All tasks |
| Use `postgres:17-alpine` — never `latest` | docker-compose.yml |
| Use `docker compose` (v2, no hyphen) — `docker-compose` v1 is EOL | All CLI commands |
| Use SQLAlchemy 2.0 `AsyncSession` with `create_async_engine` — never 1.x sync patterns | database.py |
| Never call `Base.metadata.create_all()` — always use Alembic | models.py, startup code |
| Alembic uses a SEPARATE SYNC engine URL in `alembic.ini` | alembic.ini |
| Run Alembic migrations as a separate Docker Compose service (migration container pattern) | docker-compose.yml |
| Store credentials in `.env`; never hardcode in `docker-compose.yml` | docker-compose.yml, .env.example |
| Commit `.env.example`; `.env` is gitignored | git setup |
| Do NOT use `--reload` in production Docker container | Dockerfile CMD |
| `python-multipart` is a hard runtime dependency (not optional) | requirements.txt |
| `openpyxl` is a hard runtime dependency for pandas Excel support | requirements.txt (Phase 2) |

---

## Sources

### Primary (HIGH confidence)
- [CLAUDE.md](./CLAUDE.md) — Canonical stack versions, Docker Compose pattern, Alembic best practices — all pre-verified by project research phase
- [Alembic async env.py template — sqlalchemy/alembic GitHub](https://github.com/sqlalchemy/alembic/blob/main/alembic/templates/async/env.py) — Official async migration pattern
- [Docker Compose startup order — official docs](https://docs.docker.com/compose/how-tos/startup-order/) — `depends_on` conditions (`service_healthy`, `service_completed_successfully`)
- [Docker Compose healthcheck for PostgreSQL — eastondev.com](https://eastondev.com/blog/en/posts/dev/20251217-docker-compose-healthcheck/) — pg_isready pattern

### Secondary (MEDIUM confidence)
- [Setup FastAPI with Async SQLAlchemy 2, Alembic, PostgreSQL, Docker — berkkaraal.com](https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/) — Confirmed async migration pattern; community source verified against Alembic docs
- [Ruff configuration — official docs](https://docs.astral.sh/ruff/configuration/) — Rule sets and ruff.toml format
- [Recommended Ruff defaults — pydevtools.com](https://pydevtools.com/handbook/how-to/how-to-configure-recommended-ruff-defaults/) — extend-select recommendations

### Tertiary (LOW confidence)
- None — all critical claims verified against primary or secondary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions from CLAUDE.md, pre-verified against PyPI and Docker Hub
- Architecture: HIGH — Docker Compose patterns from official docs; Alembic async from official template
- Pitfalls: HIGH — verified against official SQLAlchemy 2.0 and Docker Compose docs
- Environment availability: HIGH — local machine probed directly

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable stack — 30 day window; Ruff moves fast, re-verify version before use)
