# Phase 41: Signage Schema & Models - Research

**Researched:** 2026-04-18
**Domain:** SQLAlchemy 2.0 / Alembic / Postgres 17 — schema-only foundational phase
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Directus file storage is the primary media store for user uploads. The existing `directus_uploads:/directus/uploads:ro` RO mount into the `api` container (SGN-INF-02) is how FastAPI reads media.
- **D-02:** PPTX-derived slide PNGs are backend-owned artifacts, not Directus files. Path convention: `/app/media/slides/<media_uuid>/slide-NNN.png`. Referenced from `signage_media.slide_paths` (JSONB array of relative paths). Two storage roots is intentional.
- **D-03:** `signage_media.uri` stores the Directus asset UUID for Directus-sourced media, or the external URL for `kind=url`, or the inline HTML reference for `kind=html`.
- **D-04:** 6-character Crockford-style base32 alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`. Displayed as `XXX-XXX`. Column width: `CHAR(6)` or `VARCHAR(6)`.
- **D-05:** Code generation rejects ambiguous characters. Alphabet constant in `backend/app/security/` (Phase 42 uses it; Phase 41 only defines column width).
- **D-06:** `signage_media` columns: `id UUID PK DEFAULT gen_random_uuid()`, `kind VARCHAR(16) CHECK`, `title VARCHAR(255) NOT NULL`, `mime_type VARCHAR(127)` nullable, `size_bytes BIGINT` nullable, `uri TEXT` nullable, `duration_ms INTEGER` nullable, `created_at`/`updated_at TIMESTAMPTZ`.
- **D-07:** PPTX columns: `conversion_status` (CHECK: `pending|processing|done|failed`), `slide_paths JSONB` nullable, `conversion_error TEXT` nullable, `conversion_started_at TIMESTAMPTZ` nullable.
- **D-08:** HTML: `html_content TEXT` nullable — stored inline in DB.
- **D-09:** Split signage models into `backend/app/models/signage.py`; convert `models.py` to package `models/__init__.py` re-exporting all existing classes.
- **D-10:** Same split for Pydantic: `backend/app/schemas/signage.py` + `backend/app/schemas/__init__.py`.
- **D-11:** Conversion is additive; no changes to existing class names or field names.
- **D-12:** Every signage table (including join tables) gets `created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- **D-13:** `signage_playlists.updated_at` feeds resolver `ORDER BY priority DESC, updated_at DESC` (SGN-BE-06). Flag if index needed.
- **D-14:** Single Alembic revision file `v1_16_signage_schema.py`. All 8 tables + partial-unique index + CHECK constraints + FK constraints in one migration.
- **D-15:** Partial-unique index on `signage_pairing_sessions(code) WHERE expires_at > now() AND claimed_at IS NULL` (SGN-DB-02). Use `postgresql_where=` in migration.
- **D-16:** `ON DELETE RESTRICT` on `signage_playlist_items.media_id → signage_media.id` (SGN-DB-03). All other FKs default to sensible choice per relationship.
- **D-17:** `DB_EXCLUDE_TABLES` adds `signage_devices`, `signage_pairing_sessions`. The 4 non-sensitive tables exposed. Join tables default to exposed unless planner has concrete reason to hide.
- **D-18:** `migrate → directus` ordering via `depends_on.migrate.condition: service_completed_successfully`. Verify clause is present on `directus` service; add if missing (already present — see docker-compose.yml).

### Claude's Discretion

- Postgres ENUM vs. `CHECK` constraint for `kind` and `conversion_status` — pick whichever round-trips cleanly (SGN-DB-05 constraint).
- Exact column widths for `title`, tag `name`, device `name`, playlist `name` — defaults like 255, 64, 128, 128 acceptable. Planner picks.
- Whether join tables get synthetic `id` PKs or composite `(parent_a, parent_b)` PKs — composite matches existing precedent.
- `gen_random_uuid()` requires `pgcrypto` — if not already enabled, migration adds `CREATE EXTENSION IF NOT EXISTS pgcrypto`.

### Deferred Ideas (OUT OF SCOPE)

- PPTX worker location (Decision 1) — Phase 44.
- Device token format (Decision 4) — Phase 42.
- Player offline cache mechanism (Decision 3) — Phase 47.
- Any runtime behavior (pairing, heartbeat, SSE, admin UI, player rendering) — their respective phases.
- Index tuning on `signage_playlists.updated_at` — defer to Phase 43.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-DB-01 | Alembic migration creates all 8 signage tables | D-14 + Alembic env.py async pattern section |
| SGN-DB-02 | Partial-unique index on `signage_pairing_sessions.code WHERE expires_at > now() AND claimed_at IS NULL` | Partial-unique index section + concrete op.create_index syntax |
| SGN-DB-03 | `ON DELETE RESTRICT` on `signage_playlist_items.media_id` | FK semantics section |
| SGN-DB-04 | `DB_EXCLUDE_TABLES` excludes `signage_devices` + `signage_pairing_sessions` | Directus exclusion section — `DB_EXCLUDE_TABLES` is the confirmed mechanism |
| SGN-DB-05 | Migration round-trips cleanly: `upgrade → downgrade → upgrade` | Round-trip testing section + ENUM vs. CHECK recommendation |
| SGN-INF-02 | `directus_uploads` RO mount into `api`; `migrate → directus` startup ordering | Docker Compose section — both already in place per docker-compose.yml review |
</phase_requirements>

---

## Summary

Phase 41 is purely additive schema work: one Alembic migration, one models file, one schemas file, and three minor edits (`models.py` → package, `schemas.py` → package, `docker-compose.yml` `DB_EXCLUDE_TABLES`). No new Python packages are required — the project already has SQLAlchemy 2.0 async, Alembic, asyncpg, Pydantic v2, and Postgres 17 in place.

The two most technically precise areas are (1) the Postgres partial-unique index for active pairing codes and (2) the round-trip guarantee for `downgrade()`. The existing `env.py` already uses the async engine pattern correctly via `asyncio.run(run_async_migrations())`. The `directus` service already depends on `migrate` via `condition: service_completed_successfully`. The `directus_uploads` volume is already defined but the `:ro` mount into `api` is NOT yet present — that is the one SGN-INF-02 infrastructure edit needed.

**Primary recommendation:** Use `VARCHAR(16) CHECK` for `kind` and `conversion_status` (not Postgres ENUMs). This eliminates the `downgrade()` ENUM drop problem entirely, round-trips cleanly, and matches project convention (existing `String(20)` CHECK pattern in `UploadBatch.status`).

---

## Standard Stack

No new packages required for Phase 41. All dependencies are already declared.

### Confirmed Versions (from CLAUDE.md + existing codebase)

| Library | Version | Purpose |
|---------|---------|---------|
| SQLAlchemy | 2.0.49 | ORM, async models with `Mapped[...]` |
| asyncpg | 0.31.0 | Async Postgres driver (existing) |
| Alembic | 1.18.4 | Schema migrations (existing) |
| Pydantic v2 | >=2.9.0 | DTO schemas with `model_config = {"from_attributes": True}` |
| PostgreSQL | 17-alpine | `gen_random_uuid()` built-in (no pgcrypto needed in PG 13+) |

### Critical Finding: pgcrypto Not Required for gen_random_uuid()

**Confidence: HIGH** — In PostgreSQL 13+, `gen_random_uuid()` is a built-in function in the `pg_catalog` schema and does NOT require the `pgcrypto` extension. The project uses Postgres 17. A grep of all existing migration files confirms `pgcrypto` has never been installed. The migration must NOT run `CREATE EXTENSION pgcrypto` for this function — it would succeed but is unnecessary noise that could confuse the `downgrade()`.

If the planner chooses to use `gen_random_uuid()` as a server-side default, the migration simply uses `server_default=sa.text("gen_random_uuid()")` with no extension step.

---

## Architecture Patterns

### Alembic Configuration for Async-FastAPI Apps

The existing `backend/alembic/env.py` already implements the correct async pattern:

```python
# Source: backend/alembic/env.py (confirmed working)
async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # critical: no connection pooling in migration context
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())
```

Key facts verified from `env.py`:
- `target_metadata = Base.metadata` — imports `Base` from `app.models`; after the package split, `app/models/__init__.py` must still export `Base` (it comes from `app.database`) and register all model classes via import.
- `alembic.ini` `sqlalchemy.url` is a sync URL (`postgresql://...`), but `env.py` overrides it at runtime with the asyncpg URL. This is correct — the ini URL is never actually used at runtime; it only matters for `alembic revision --autogenerate` when run locally without the override.
- Offline mode raises `NotImplementedError` — consistent with Docker-only deployment.

**After the models package split**, `env.py` import must become:
```python
from app.models import Base  # noqa: F401 -- stays the same; __init__.py re-exports Base
```
No change needed to `env.py` itself.

### Naming Conventions in Alembic

The existing migrations use manual explicit constraint names (e.g., `uq_sensor_readings_sensor_recorded_at`, `ck_app_settings_singleton`). No `naming_convention` dict is configured in `env.py`. The v1.16 migration must follow this manual naming pattern for consistency.

Recommended naming scheme for Phase 41 objects:
- Unique constraints: `uq_<table>_<col(s)>`
- Check constraints: `ck_<table>_<col>_<purpose>`
- Foreign keys: `fk_<table>_<col>` (or rely on Postgres auto-naming; manual is safer)
- Partial unique index: `uix_signage_pairing_sessions_code_active` (descriptive)
- Regular indexes: `ix_<table>_<col(s)>`

### Partial-Unique Index in Alembic

**Confidence: HIGH** — Verified against Alembic docs and SQLAlchemy Index documentation.

The correct `op.create_index` syntax for a partial unique index:

```python
# In upgrade():
op.create_index(
    "uix_signage_pairing_sessions_code_active",
    "signage_pairing_sessions",
    ["code"],
    unique=True,
    postgresql_where=sa.text("expires_at > now() AND claimed_at IS NULL"),
)

# In downgrade():
op.drop_index(
    "uix_signage_pairing_sessions_code_active",
    table_name="signage_pairing_sessions",
)
```

**Critical autogenerate limitation:** Alembic autogenerate does NOT reliably detect partial indexes. The `postgresql_where` clause is dialect-specific metadata that autogenerate cannot compare against the live database state. This is a well-known limitation. The solution is to write the partial index manually in the migration (not auto-generated) — which is exactly the pattern this phase uses.

**Why partial, not full unique:** Active pairing codes must be unique to prevent collision. Expired/claimed codes may repeat (e.g., after a year, the code space `32^6 ≈ 1B` is practically inexhaustible but the partial predicate makes the logic explicit and keeps the index small). The predicate `expires_at > now()` is evaluated at index-build time per Postgres semantics — it is a volatile predicate, and Postgres handles this correctly for partial unique indexes.

**Postgres 17 gotcha — none identified:** No known regressions in PG17 for partial unique index creation with `> now()`. The `now()` function in a partial index predicate is evaluated at INSERT/UPDATE time (not index creation time), which is the desired behavior.

### SQLAlchemy Model for Partial Index

In the `SignagePairingSession` model class, declare the partial index in `__table_args__`:

```python
# Source: SQLAlchemy 2.0 Index docs
from sqlalchemy import Index, text

class SignagePairingSession(Base):
    __tablename__ = "signage_pairing_sessions"
    __table_args__ = (
        Index(
            "uix_signage_pairing_sessions_code_active",
            "code",
            unique=True,
            postgresql_where=text("expires_at > now() AND claimed_at IS NULL"),
        ),
    )
```

Note: The SQLAlchemy `Index` object mirrors what the migration creates but is present in the model for documentation/IDE purposes. The migration is still the authoritative source.

### FK ondelete Strategy Per Table Pair

| Parent Table | Child Table | Column | ondelete | Justification |
|-------------|-------------|--------|----------|---------------|
| `signage_media` | `signage_playlist_items` | `media_id` | **RESTRICT** | D-16 / SGN-DB-03: prevents accidental deletion of media in use. Admin must remove from all playlists first. |
| `signage_playlists` | `signage_playlist_items` | `playlist_id` | **CASCADE** | Deleting a playlist should clean up its items atomically. No orphan items. |
| `signage_devices` | `signage_device_tag_map` | `device_id` | **CASCADE** | Device deletion should clean up its tag associations. Tag rows survive. |
| `signage_device_tags` | `signage_device_tag_map` | `tag_id` | **CASCADE** | Tag deletion cleans up all device-tag associations (tag is gone, mapping is moot). |
| `signage_playlists` | `signage_playlist_tag_map` | `playlist_id` | **CASCADE** | Playlist deletion cleans its tag mappings. |
| `signage_device_tags` | `signage_playlist_tag_map` | `tag_id` | **CASCADE** | Tag deletion cleans playlist tag mappings. |
| `signage_devices` | `signage_pairing_sessions` | `device_id` | **SET NULL** | Pairing sessions may outlive device deletion for audit. `device_id` is nullable. |

**RESTRICT vs NO ACTION:** In Postgres, both reject the delete when dependent rows exist, but RESTRICT is checked immediately while NO ACTION is deferred to end-of-transaction. For `media_id → media`, immediate rejection (RESTRICT) is correct — the error should surface at the moment the admin attempts deletion.

### ENUM vs. CHECK Constraint Recommendation

**Recommendation: Use `VARCHAR(16) CHECK` (not Postgres ENUM).**

Rationale:
1. **Round-trip simplicity (SGN-DB-05):** Dropping a Postgres ENUM in `downgrade()` requires `ALTER TABLE ... ALTER COLUMN ... TYPE text USING ...` before `DROP TYPE`, or a direct `CAST`. With `CHECK` constraints, `downgrade()` simply drops the table — the check constraint goes with it. Much less error-prone.
2. **Alembic autogenerate limitations:** Alembic's autogenerate has known inconsistencies around Postgres ENUM types — it sometimes generates spurious migrations that re-create ENUMs. With CHECK constraints there is no ENUM type to track.
3. **Project precedent:** `UploadBatch.status` uses `String(20)` with an implicit CHECK. `AppSettings` uses `String` columns with application-level validation. No existing table uses a Postgres ENUM type.
4. **Directus compatibility:** Directus introspects CHECK constraints and renders them as dropdown options in the UI — this is actually better UX than ENUMs for the Directus admin.

Implementation:
```python
# In migration upgrade():
sa.Column("kind", sa.String(16), nullable=False),
sa.CheckConstraint(
    "kind IN ('image','video','pdf','pptx','url','html')",
    name="ck_signage_media_kind",
),
sa.Column("conversion_status", sa.String(16), nullable=True),
sa.CheckConstraint(
    "conversion_status IN ('pending','processing','done','failed')",
    name="ck_signage_media_conversion_status",
),
```

### Directus Introspection Exclusion

**Decision: `DB_EXCLUDE_TABLES` (already used, confirmed correct mechanism)**

**Confidence: HIGH** — Confirmed from `docker-compose.yml` where the existing `DB_EXCLUDE_TABLES` variable already excludes 11 app tables.

```yaml
# docker-compose.yml — existing pattern, additive change
DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,...,sensors,sensor_readings,sensor_poll_log,signage_devices,signage_pairing_sessions
```

Alternative options evaluated and rejected:
- **Separate Postgres schema + `DB_SEARCH_PATH`:** Would require a separate schema (`signage_private`) and would break SQLAlchemy if models don't specify `schema=`. Too invasive for what is purely a CMS visibility decision.
- **Per-role Postgres grants:** Would require creating a dedicated `directus_reader` role with selective table grants. Significant complexity; Directus's role handling adds friction. Overkill for ≤5 tables.
- **Directus "system" flag / collection hide via API:** Collections hidden via Directus API are hidden in the UI but Directus still introspects them at startup. This does not satisfy the requirement to hide pairing session data from Directus data model.

`DB_EXCLUDE_TABLES` is the clean, supported mechanism. The two join tables (`signage_device_tag_map`, `signage_playlist_tag_map`) should be exposed (consistent with D-17: "default to exposed unless concrete reason to hide") — they are needed for Directus relational editing in the admin UI.

### Docker Compose Migrate-Service Pattern

**Current state (confirmed from `docker-compose.yml`):**
- `migrate` service: `build: ./backend`, `command: alembic upgrade head`, `depends_on: db: condition: service_healthy` — already present and correct.
- `api` service: `depends_on: migrate: condition: service_completed_successfully` — already present.
- `directus` service: `depends_on: db: condition: service_healthy` AND `migrate: condition: service_completed_successfully` — **already present**.

**SGN-INF-02 state:**
- `directus_uploads:/directus/uploads` volume mount on the `directus` service — **already present**.
- `directus_uploads:/directus/uploads:ro` mount on the `api` service — **NOT yet present**. This is the one change needed.

The `migrate` service uses the same `build: ./backend` image as `api` (no separate image). It exits 0 on success, non-0 on failure. Idempotency: `alembic upgrade head` is always idempotent — if already at head, it's a no-op.

No changes to `migrate` service configuration needed. Only `api` volumes and `DB_EXCLUDE_TABLES` in `directus` environment need edits.

### Media Storage (Decision 2 — RESOLVED as D-01 through D-03)

Decision 2 was resolved in CONTEXT.md before this research phase. Summary for planner clarity:

**Resolved design:**
- **User uploads** (image, video, PDF, PPTX source files): Stored in Directus via its `/files` upload endpoint. Directus owns the `directus_uploads` Docker volume. FastAPI reads from the RO mount at `/directus/uploads` (SGN-INF-02).
- **Derived artifacts** (PPTX-converted slide PNGs): Backend-owned at `/app/media/slides/<media_uuid>/slide-NNN.png`. This directory is NOT a Directus volume.
- **Schema implications for Phase 41:**
  - `signage_media.uri` = Directus asset UUID (string, TEXT) for Directus-sourced files, or external URL for `kind=url`.
  - `signage_media.slide_paths` = JSONB array of relative paths (e.g., `["slides/abc-uuid/slide-001.png", ...]`), populated by Phase 44.
  - No `file_path` column pointing to the local filesystem for source files — Directus UUID is sufficient.
- **Phase 43/44 binding:** Phase 43 admin API uses Directus `/files` for upload (not a FastAPI upload endpoint). Phase 44 PPTX converter writes to `/app/media/slides/` and updates `slide_paths`. The Phase 41 schema must support both paths.

### SQLAlchemy 2.0 Async Model Scaffold

The project uses `Mapped[...]` typed columns with `mapped_column(...)`. No `Annotated` type aliases are used in the existing codebase — stay with the explicit `mapped_column(Type, ...)` style.

```python
# backend/app/models/signage.py — style follows existing models.py conventions
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey,
    Index, Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class SignageMedia(Base):
    __tablename__ = "signage_media"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('image','video','pdf','pptx','url','html')",
            name="ck_signage_media_kind",
        ),
        CheckConstraint(
            "conversion_status IS NULL OR conversion_status IN ('pending','processing','done','failed')",
            name="ck_signage_media_conversion_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # PPTX conversion
    conversion_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    slide_paths: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    conversion_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    conversion_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # HTML inline storage
    html_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        server_default=func.now(), onupdate=func.now()
    )

    playlist_items: Mapped[list["SignagePlaylistItem"]] = relationship(
        "SignagePlaylistItem",
        back_populates="media",
        # NOTE: no cascade — media deletion is RESTRICT; items must be removed first
    )
```

**UUID primary key pattern** — `UUID(as_uuid=True)` with `server_default=func.gen_random_uuid()`. Python-side `uuid.uuid4()` is also valid for the `default=` parameter, but `server_default` ensures the DB generates it (consistent with Directus asset UUIDs). SQLAlchemy's `UUID(as_uuid=True)` maps to Python `uuid.UUID`.

**onupdate pattern** — `onupdate=func.now()` in `mapped_column` triggers SQLAlchemy to issue `UPDATE ... SET updated_at = now()` on ORM update. This is correct for async sessions; it does not add a Postgres trigger.

### Pydantic v2 Schema Scaffold

```python
# backend/app/schemas/signage.py — follows existing schemas.py conventions
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SignageMediaBase(BaseModel):
    kind: Literal["image", "video", "pdf", "pptx", "url", "html"]
    title: str = Field(..., max_length=255)
    mime_type: str | None = None
    size_bytes: int | None = None
    uri: str | None = None
    duration_ms: int | None = None
    html_content: str | None = None


class SignageMediaRead(SignageMediaBase):
    id: uuid.UUID
    conversion_status: str | None = None
    slide_paths: list[str] | None = None
    conversion_error: str | None = None
    conversion_started_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SignageMediaCreate(SignageMediaBase):
    pass
```

`Literal["image", ...]` on the Pydantic side enforces the same values as the DB CHECK constraint — two layers of validation. The `model_config = {"from_attributes": True}` is the Pydantic v2 replacement for `orm_mode = True` and is required for `SignageMediaRead.model_validate(orm_object)` to work. All existing schemas use this pattern.

### Models/Schemas Package Split Pattern (D-09, D-10)

The existing `models.py` is ~380 lines. Converting to a package:

```
backend/app/models/
├── __init__.py          # re-exports Base + all existing classes + signage classes
├── _base.py             # OR: keep existing content in models/_legacy.py (planner picks name)
└── signage.py           # new signage models
```

`__init__.py` content:
```python
from app.database import Base  # noqa: F401 — registers metadata
from app.models._base import (  # re-export all existing classes
    AppSettings, PersonioAbsence, PersonioAttendance, PersonioEmployee,
    PersonioSyncMeta, SalesRecord, Sensor, SensorPollLog, SensorReading,
    UploadBatch,
)
from app.models.signage import (  # new
    SignageDevice, SignageDeviceTag, SignageDeviceTagMap,
    SignageMedia, SignagePairingSession, SignagePlaylist,
    SignagePlaylistItem, SignagePlaylistTagMap,
)

__all__ = [
    "Base",
    "AppSettings", "PersonioAbsence", "PersonioAttendance", "PersonioEmployee",
    "PersonioSyncMeta", "SalesRecord", "Sensor", "SensorPollLog", "SensorReading",
    "UploadBatch",
    "SignageDevice", "SignageDeviceTag", "SignageDeviceTagMap",
    "SignageMedia", "SignagePairingSession", "SignagePlaylist",
    "SignagePlaylistItem", "SignagePlaylistTagMap",
]
```

**Critical:** `env.py` imports `from app.models import Base` — this import must continue to work after the split. The `__init__.py` re-export of `Base` satisfies this. All signage model classes must be imported in `__init__.py` so SQLAlchemy registers them with `Base.metadata` before Alembic calls `target_metadata`.

The schemas split follows the identical pattern.

### Composite PK vs. Surrogate ID on Join Tables (Claude's Discretion)

**Recommendation: Composite PK `(parent_a_id, parent_b_id)`.**

Rationale:
- The project has no join tables yet; v1.15 sensor models use integer surrogate PKs on leaf tables, not many-to-many joins.
- Composite PK is semantically correct for pure join tables — uniqueness is already enforced, no need for a synthetic surrogate.
- D-12 adds `created_at`/`updated_at` to join tables — this is compatible with composite PKs.
- Alembic handles composite PKs cleanly.

```python
class SignageDeviceTagMap(Base):
    __tablename__ = "signage_device_tag_map"
    __table_args__ = (
        # PrimaryKeyConstraint defined via mapped_column(primary_key=True) on both cols
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signage_devices.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("signage_device_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        server_default=func.now(), onupdate=func.now()
    )
```

Note: Join table PKs here use `uuid.UUID` for `device_id` (since `signage_devices.id` is UUID) and `Integer` for `tag_id` (since `signage_device_tags.id` is an integer surrogate). This asymmetry is correct — tags are a small lookup table (integer autoincrement is fine), while devices need UUID identity to match Directus asset UUID conventions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom UUID generator | `server_default=func.gen_random_uuid()` | Postgres 17 built-in; no pgcrypto needed |
| ENUM validation | Postgres ENUM type | `VARCHAR(16) CHECK (col IN (...))` | Easier round-trip, no ENUM type to manage |
| Partial index syntax | Raw SQL `op.execute("CREATE UNIQUE INDEX ...")` | `op.create_index(..., unique=True, postgresql_where=...)` | Tracked in Alembic's op stream; cleaner downgrade |
| Timestamp auto-update | Postgres triggers | `onupdate=func.now()` on ORM column | SQLAlchemy handles it; no trigger DDL in migration |
| Directus table filtering | Postgres schemas / row-level security | `DB_EXCLUDE_TABLES` env var | Already working pattern in this project |

**Key insight:** Every problem in this schema phase has an established project-level solution. The risk is inventing something new when the existing pattern already works.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Import Signage Models in `__init__.py`

**What goes wrong:** SQLAlchemy's `Base.metadata` only knows about model classes that have been imported before Alembic runs `target_metadata`. If `SignageMedia` etc. are defined in `models/signage.py` but not imported in `models/__init__.py`, autogenerate will not see them — and more critically, Alembic's `context.configure(target_metadata=...)` in `env.py` will produce a metadata object missing the signage tables.

**How to avoid:** Every model class in `signage.py` must be explicitly imported in `models/__init__.py`. This is the same requirement as the existing `from app.models import Base` pattern in `env.py`.

### Pitfall 2: `downgrade()` Drop Order Violates FK Constraints

**What goes wrong:** Dropping tables in creation order (instead of reverse dependency order) causes `cannot drop table X because other objects depend on it` errors.

**How to avoid:** Drop in reverse FK dependency order:
1. `signage_pairing_sessions` (references `signage_devices`)
2. `signage_device_tag_map` (references `signage_devices` + `signage_device_tags`)
3. `signage_playlist_tag_map` (references `signage_playlists` + `signage_device_tags`)
4. `signage_playlist_items` (references `signage_playlists` + `signage_media`)
5. `signage_devices`
6. `signage_playlists`
7. `signage_device_tags`
8. `signage_media`

The v1.15 migration demonstrates this pattern correctly — `app_settings` columns dropped first, then child tables, then `sensors`.

### Pitfall 3: Partial Index Not Dropped in downgrade()

**What goes wrong:** `op.drop_table("signage_pairing_sessions")` drops the table AND its indexes. But if the partial index is created on a table that's dropped in `downgrade()`, the `op.drop_index` must come BEFORE `op.drop_table`. If they're in the wrong order, Postgres raises an error because the table no longer exists.

**How to avoid:** In `downgrade()`, explicitly drop the partial index before dropping the table:
```python
def downgrade() -> None:
    op.drop_index(
        "uix_signage_pairing_sessions_code_active",
        table_name="signage_pairing_sessions",
    )
    op.drop_table("signage_pairing_sessions")
    # ... rest of tables in reverse order
```

### Pitfall 4: `UUID(as_uuid=True)` in Migration vs. Model Mismatch

**What goes wrong:** The migration uses `sa.String(36)` for a UUID column but the model uses `UUID(as_uuid=True)`. Or vice versa. Queries that filter by UUID fail with type mismatch errors.

**How to avoid:** Use `sa.dialects.postgresql.UUID(as_uuid=True)` in both the migration `sa.Column(...)` definition and the SQLAlchemy model. Also applies to `__table_args__` Index entries — the type must match what's actually in the DB.

### Pitfall 5: `onupdate=func.now()` Does Not Create a DB Trigger

**What goes wrong:** Developer assumes `onupdate=func.now()` installs a Postgres trigger, then is surprised when a direct SQL `UPDATE` (outside SQLAlchemy ORM) doesn't update the `updated_at` column.

**How to avoid:** Document in model docstring that `updated_at` is ORM-managed, not trigger-managed. For Phase 41 (schema-only), this is just a documentation note. Future phases that use raw SQL updates (e.g., scheduler queries) must explicitly set `updated_at = now()` in the SQL.

### Pitfall 6: `DB_EXCLUDE_TABLES` Syntax — No Spaces After Commas

**What goes wrong:** `DB_EXCLUDE_TABLES: upload_batches, sales_records` (with spaces) silently fails — Directus does not trim whitespace. Tables with leading spaces in their "name" are not found, so they are introspected.

**How to avoid:** Always use comma-separated values with no spaces, matching the existing line in `docker-compose.yml`.

---

## Code Examples

### Complete Partial-Unique Index in Migration

```python
# Source: Alembic docs + SQLAlchemy dialect extension documentation
import sqlalchemy as sa
from alembic import op

def upgrade() -> None:
    op.create_table(
        "signage_pairing_sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column("device_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("signage_devices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index(
        "uix_signage_pairing_sessions_code_active",
        "signage_pairing_sessions",
        ["code"],
        unique=True,
        postgresql_where=sa.text("expires_at > now() AND claimed_at IS NULL"),
    )

def downgrade() -> None:
    op.drop_index(
        "uix_signage_pairing_sessions_code_active",
        table_name="signage_pairing_sessions",
    )
    op.drop_table("signage_pairing_sessions")
```

### RESTRICT FK in Migration

```python
# Source: existing v1.15 sensor migration pattern (ondelete="CASCADE") — adapted
sa.Column(
    "media_id",
    sa.dialects.postgresql.UUID(as_uuid=True),
    sa.ForeignKey("signage_media.id", ondelete="RESTRICT"),
    nullable=False,
),
```

### models/__init__.py After Package Split

```python
# backend/app/models/__init__.py
# Re-exports all model classes so that:
#   1. `from app.models import Foo` continues to work for all existing callers
#   2. All classes are registered with Base.metadata before Alembic runs
#   3. `from app.models import Base` in env.py continues to work
from app.database import Base  # noqa: F401
from app.models._base import (
    AppSettings, PersonioAbsence, PersonioAttendance, PersonioEmployee,
    PersonioSyncMeta, SalesRecord, Sensor, SensorPollLog, SensorReading,
    UploadBatch,
)
from app.models.signage import (
    SignageDevice, SignageDeviceTag, SignageDeviceTagMap,
    SignageMedia, SignagePairingSession, SignagePlaylist,
    SignagePlaylistItem, SignagePlaylistTagMap,
)

__all__ = [...]  # list all for IDE tooling
```

### Pydantic v2 with from_attributes — Project Convention

```python
# All read schemas in the project use this pattern (confirmed from schemas.py)
class SignageSomeRead(BaseModel):
    id: uuid.UUID
    # ... fields ...
    model_config = {"from_attributes": True}
```

---

## Round-Trip Migration Testing

**SGN-DB-05 success criterion:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` completes with zero errors on a fresh database.

### Local Test Command Sequence

```bash
# From backend/ directory inside the running api container or locally with env vars set:
alembic upgrade head
alembic downgrade -1
alembic upgrade head

# Verification after final upgrade:
# psql -c "\dt signage_*" should list exactly 8 tables
# psql -c "\d signage_pairing_sessions" should show the partial unique index
```

### Docker Compose Test Sequence

```bash
# Full fresh-DB round-trip:
docker compose down -v          # destroy volumes (fresh DB)
docker compose up migrate       # runs upgrade head (should succeed)
docker compose run --rm migrate alembic downgrade -1    # downgrade
docker compose run --rm migrate alembic upgrade head    # re-upgrade
```

### What to Verify After Round-Trip

1. `\dt signage_*` lists exactly 8 tables.
2. `\d signage_pairing_sessions` shows the partial unique index `uix_signage_pairing_sessions_code_active`.
3. `\d signage_playlist_items` shows `FOREIGN KEY (media_id) ... ON DELETE RESTRICT`.
4. `SELECT * FROM alembic_version` shows `v1_16_signage`.
5. After `downgrade -1`, `\dt signage_*` returns 0 rows (all signage tables dropped, no residual indexes).
6. After second `upgrade head`, the state is identical to step 1-4.

### Known Autogenerate Limitations to Account For

- Partial indexes (`postgresql_where`) are written manually — autogenerate will not detect them.
- CHECK constraints may or may not be detected by autogenerate depending on Alembic version; write them manually in the migration rather than relying on autogenerate.
- UUID server defaults (`gen_random_uuid()`) may appear as "changes" in subsequent autogenerate runs because Alembic cannot compare function expressions reliably. After Phase 41, if running `alembic revision --autogenerate` in future phases, suppress false positives by reviewing diffs carefully.

---

## Environment Availability

Phase 41 is a schema + code-only phase. External dependencies are the running Postgres 17 container (already in docker-compose.yml) and Python packages already in `requirements.txt`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Alembic migration | ✓ | 17-alpine | — |
| SQLAlchemy async | Model definitions | ✓ | 2.0.49 | — |
| Alembic | Migration | ✓ | 1.18.4 | — |
| Pydantic v2 | Schema definitions | ✓ | >=2.9.0 | — |
| `gen_random_uuid()` | UUID PKs | ✓ | Built-in PG13+ | — |

No missing dependencies for this phase.

---

## Open Questions / Risks

1. **`signage_devices.revoked_at` column shape** — CONTEXT.md references `signage_devices.revoked_at` (Phase 42 success criterion: "Admin 'Revoke device' flips `signage_devices.revoked_at`"). Phase 41 must include this column in the `signage_devices` table to avoid a Phase 42 migration that adds a column to an already-migrated table. **Recommendation:** Include `revoked_at TIMESTAMPTZ NULL` in `signage_devices` in Phase 41 — it's a non-nullable-nullable timestamp with no default, costs nothing, and avoids a narrow migration in Phase 42.

2. **`signage_devices.last_seen_at` column** — Phase 43 heartbeat sweeper reads `last_seen_at`. Same reasoning: include it in Phase 41 schema rather than requiring a Phase 43 add-column migration. This column will be `NULL` until a device first heartbeats.

3. **`signage_devices.device_token_hash` column** — Phase 42 device auth hashes/stores the token. If this column is not defined in Phase 41, Phase 42 needs a new migration for a schema change. **Recommendation:** Either add `device_token_hash TEXT NULL` (or `BYTEA`) to `signage_devices` in Phase 41, or accept that Phase 42 will have a narrow add-column migration. Flag for planner decision.

4. **`signage_pairing_sessions` → `signage_devices` FK direction** — A pairing session may reference a device (assigned after claim), but the device row is created AT claim time. So at `INSERT INTO signage_pairing_sessions` (the initial request), no `device_id` exists yet. The FK is nullable, and `SET NULL` on device delete is correct. This matches the recommended approach above.

5. **Join table visibility in Directus** — CONTEXT.md D-17 says "planner decides" for join tables. Based on the Directus admin UX: having `signage_device_tag_map` and `signage_playlist_tag_map` exposed in Directus is valuable because Directus uses them to render many-to-many relationship widgets. If they are excluded, the Directus admin UI cannot show which tags are associated with devices/playlists. **Recommendation: expose both join tables** (do NOT add them to `DB_EXCLUDE_TABLES`).

6. **`signage_playlists.priority` column** — Phase 43 resolver uses `ORDER BY priority DESC`. Phase 41 must include this column. **Confirm:** `priority INTEGER NOT NULL DEFAULT 0` on `signage_playlists`.

7. **`signage_playlists.enabled` column** — Admin may want to disable a playlist without deleting it. The resolver in Phase 43 should filter `WHERE enabled = TRUE`. **Recommendation:** Include `enabled BOOLEAN NOT NULL DEFAULT TRUE` in Phase 41.

---

## Sources

### Primary (HIGH confidence)
- `backend/alembic/env.py` — Async Alembic pattern (already implemented in project)
- `backend/alembic/versions/v1_15_sensor_schema.py` — Migration naming convention, downgrade order, index creation pattern
- `backend/app/models.py` — `Mapped[...]`, `mapped_column(...)`, `DateTime(timezone=True)` conventions
- `backend/app/schemas.py` — `model_config = {"from_attributes": True}` Pydantic v2 pattern
- `docker-compose.yml` — `DB_EXCLUDE_TABLES`, `depends_on.migrate.condition: service_completed_successfully`, `directus_uploads` volume
- `backend/alembic.ini` — `sqlalchemy.url` sync URL pattern (overridden in env.py)
- PostgreSQL 17 docs — `gen_random_uuid()` built-in (PG13+, no pgcrypto required)
- SQLAlchemy 2.0 docs — `op.create_index(..., postgresql_where=...)` for partial indexes

### Secondary (MEDIUM confidence)
- Alembic docs — Partial index autogenerate limitation (well-known, not unique to this version)
- Directus docs — `DB_EXCLUDE_TABLES` is a documented configuration option

### Tertiary (LOW confidence)
- None — all critical claims backed by project codebase inspection or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing
- Architecture: HIGH — all patterns verified directly from codebase
- Alembic async pattern: HIGH — verified from env.py (already implemented)
- Partial-unique index syntax: HIGH — verified from SQLAlchemy dialect docs + v1.15 index pattern
- ENUM vs. CHECK recommendation: HIGH — project precedent + known Alembic limitation
- Directus exclusion mechanism: HIGH — verified from docker-compose.yml
- pgcrypto not needed: HIGH — PostgreSQL 13+ documented behavior

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable stack — SQLAlchemy/Alembic APIs change slowly)

---

## RESEARCH COMPLETE
