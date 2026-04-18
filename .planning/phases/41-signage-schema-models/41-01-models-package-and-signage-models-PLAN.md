---
phase: 41-signage-schema-models
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/models/__init__.py
  - backend/app/models/_base.py
  - backend/app/models/signage.py
autonomous: true
requirements:
  - SGN-DB-01
must_haves:
  truths:
    - "`from app.models import Base` still works (env.py import path unchanged)"
    - "All existing model classes (AppSettings, SalesRecord, Sensor, etc.) remain importable as `from app.models import Foo`"
    - "Eight signage ORM classes (SignageMedia, SignagePlaylist, SignagePlaylistItem, SignageDevice, SignageDeviceTag, SignageDeviceTagMap, SignagePlaylistTagMap, SignagePairingSession) are registered with Base.metadata"
  artifacts:
    - path: backend/app/models/__init__.py
      provides: "Package entry point re-exporting Base + all legacy classes + all signage classes"
      contains: "from app.models.signage import"
    - path: backend/app/models/_base.py
      provides: "Legacy model classes (moved verbatim from old models.py)"
      contains: "class AppSettings"
    - path: backend/app/models/signage.py
      provides: "Eight signage ORM classes with Mapped[...] SQLAlchemy 2.0 style"
      contains: "class SignageMedia"
  key_links:
    - from: backend/app/models/__init__.py
      to: backend/app/models/_base.py
      via: "wildcard or explicit re-export"
      pattern: "from app.models._base import"
    - from: backend/app/models/__init__.py
      to: backend/app/models/signage.py
      via: "explicit re-export of 8 signage classes"
      pattern: "from app.models.signage import"
    - from: backend/alembic/env.py
      to: backend/app/models/__init__.py
      via: "`from app.models import Base`"
      pattern: "from app.models import Base"
---

<objective>
Convert `backend/app/models.py` into a package `backend/app/models/`, preserving all existing import paths, and add eight new signage ORM classes under `backend/app/models/signage.py`. All signage classes are registered with `Base.metadata` so the Alembic migration in Plan 03 can rely on them.

Purpose: Foundation for the signage schema. Alembic's `target_metadata = Base.metadata` (in `env.py`) requires every model class to be imported before migration runs; the package `__init__.py` is the registration point.

Output: Three Python files; zero behavior change for non-signage code; eight new ORM classes visible in `Base.metadata.tables`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-signage-schema-models/41-CONTEXT.md
@.planning/phases/41-signage-schema-models/41-RESEARCH.md
@backend/app/models.py
@backend/app/database.py
@backend/alembic/env.py

<interfaces>
Existing conventions (from backend/app/models.py):
- `from sqlalchemy.orm import Mapped, mapped_column, relationship`
- `from sqlalchemy.sql import func`
- `from app.database import Base`
- Columns use `Mapped[type] = mapped_column(SAType, nullable=..., server_default=func.now())`
- Timestamps use `DateTime(timezone=True)` with `server_default=func.now()` and `onupdate=func.now()` on updated_at
- All existing class names MUST be preserved: AppSettings, UploadBatch, SalesRecord, PersonioEmployee, PersonioAttendance, PersonioAbsence, PersonioSyncMeta, Sensor, SensorReading, SensorPollLog (plus any HR-KPI targets classes found in models.py)

`Base` is defined in backend/app/database.py and imported by models.py today.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert models.py into a package; preserve every existing import path</name>
  <files>backend/app/models/__init__.py, backend/app/models/_base.py (new — holds legacy content), backend/app/models.py (deleted)</files>
  <read_first>
    - backend/app/models.py (full current content — must be moved verbatim)
    - backend/app/database.py (confirm `Base` is exported from here)
    - backend/alembic/env.py (confirm `from app.models import Base` is the import line that must keep working)
  </read_first>
  <action>
    1. Read the full current `backend/app/models.py` and enumerate every top-level class defined there (expected from CONTEXT.md: `AppSettings`, `UploadBatch`, `SalesRecord`, `PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`, `PersonioSyncMeta`, `Sensor`, `SensorReading`, `SensorPollLog`, plus any HR KPI target classes actually present — do NOT guess; enumerate from the file).
    2. Create directory `backend/app/models/`.
    3. Move the entire current content of `backend/app/models.py` verbatim into a new file `backend/app/models/_base.py`. Do NOT rename, reorder, or alter any class, column, relationship, or import. The only acceptable change is module-level docstring if absent. Keep `from app.database import Base` exactly as written.
    4. Create `backend/app/models/__init__.py` with this exact content pattern (replace `CLASSES_ENUMERATED_FROM_STEP_1` with the real list):
```
"""Models package — re-exports Base and every ORM class.

Keeping `from app.models import X` stable for all existing callers
while allowing new modules (like `app.models.signage`) to be added
alongside `_base.py`.

Every class must be imported here so SQLAlchemy registers it with
Base.metadata before Alembic reads `target_metadata` in env.py.
"""
from app.database import Base  # noqa: F401 — re-exported for env.py

from app.models._base import (  # noqa: F401
    # FILL IN WITH ACTUAL CLASSES FROM _base.py
    AppSettings,
    UploadBatch,
    SalesRecord,
    PersonioEmployee,
    PersonioAttendance,
    PersonioAbsence,
    PersonioSyncMeta,
    Sensor,
    SensorReading,
    SensorPollLog,
)

# Signage models (added in Task 2 of this plan)
from app.models.signage import (  # noqa: F401
    SignageMedia,
    SignagePlaylist,
    SignagePlaylistItem,
    SignageDevice,
    SignageDeviceTag,
    SignageDeviceTagMap,
    SignagePlaylistTagMap,
    SignagePairingSession,
)

__all__ = [
    "Base",
    # Legacy
    "AppSettings", "UploadBatch", "SalesRecord",
    "PersonioEmployee", "PersonioAttendance", "PersonioAbsence", "PersonioSyncMeta",
    "Sensor", "SensorReading", "SensorPollLog",
    # Signage
    "SignageMedia", "SignagePlaylist", "SignagePlaylistItem",
    "SignageDevice", "SignageDeviceTag", "SignageDeviceTagMap",
    "SignagePlaylistTagMap", "SignagePairingSession",
]
```
    5. Delete the original `backend/app/models.py` file (use `git rm` equivalent — plain `rm` is fine since Write tool can't delete; use Bash `rm backend/app/models.py`).
    6. If the HR KPI target class(es) exist in `_base.py` (grep for class names), add them to both the import block and `__all__` in `__init__.py`. DO NOT invent class names.

    This implements decisions D-09, D-11 (additive; no class renames).
  </action>
  <verify>
    <automated>cd backend && python -c "from app.models import Base; from app.models import AppSettings, SalesRecord, Sensor; print('legacy ok'); from app.models.signage import SignageMedia; print('structure ok')" 2>&amp;1 | tee /tmp/41-01-t1.log &amp;&amp; grep -q "legacy ok" /tmp/41-01-t1.log</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/app/models.py` no longer exists: `test ! -f backend/app/models.py`
    - Directory `backend/app/models/` exists with `__init__.py` and `_base.py`: `test -f backend/app/models/__init__.py && test -f backend/app/models/_base.py`
    - `__init__.py` imports Base: `grep -q "from app.database import Base" backend/app/models/__init__.py`
    - `__init__.py` re-exports from _base: `grep -q "from app.models._base import" backend/app/models/__init__.py`
    - `__init__.py` imports all 8 signage classes: `grep -c "Signage" backend/app/models/__init__.py` returns at least 16 (8 classes listed twice: import + __all__)
    - `_base.py` contains the legacy class definitions: `grep -q "class AppSettings" backend/app/models/_base.py && grep -q "class SalesRecord" backend/app/models/_base.py && grep -q "class Sensor" backend/app/models/_base.py`
    - Python can still import Base by the old path: `cd backend && python -c "from app.models import Base"` exits 0
  </acceptance_criteria>
  <done>`from app.models import Base` and `from app.models import <any existing class>` continue to work from anywhere in the backend; the package structure is in place for signage models to be added.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create eight signage ORM models in backend/app/models/signage.py</name>
  <files>backend/app/models/signage.py</files>
  <behavior>
    - Importing `from app.models.signage import SignageMedia` succeeds
    - `Base.metadata.tables` contains all 8 signage_* table names after importing the module
    - `SignagePairingSession.__table_args__` contains the partial-unique Index with `postgresql_where`
    - `SignagePlaylistItem.media_id` FK is declared with `ondelete="RESTRICT"`
    - All signage tables carry `created_at` and `updated_at` TIMESTAMPTZ NOT NULL columns
  </behavior>
  <read_first>
    - backend/app/models/_base.py (mirror existing Mapped[...] conventions, especially `Sensor` / `SensorReading` for timestamp style and UUID patterns)
    - .planning/phases/41-signage-schema-models/41-CONTEXT.md (decisions D-06, D-07, D-08, D-12, D-15, D-16)
    - .planning/phases/41-signage-schema-models/41-RESEARCH.md (sections "SQLAlchemy 2.0 Async Model Scaffold", "FK ondelete Strategy Per Table Pair", "Composite PK vs. Surrogate ID on Join Tables", "SQLAlchemy Model for Partial Index")
  </read_first>
  <action>
    Create `backend/app/models/signage.py` defining the eight ORM classes below. Follow existing `_base.py` style exactly: `Mapped[...]`, `mapped_column(...)`, `DateTime(timezone=True)`, `server_default=func.now()`, `onupdate=func.now()`.

    Top of file imports:
```
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey,
    Index, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
```

    **Class 1: `SignageMedia`** — `__tablename__ = "signage_media"` (per D-06, D-07, D-08, D-12)
    - `id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())`
    - `kind: Mapped[str] = mapped_column(String(16), nullable=False)`
    - `title: Mapped[str] = mapped_column(String(255), nullable=False)`
    - `mime_type: Mapped[str | None] = mapped_column(String(127), nullable=True)`
    - `size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)`
    - `uri: Mapped[str | None] = mapped_column(Text, nullable=True)`
    - `duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)`
    - `conversion_status: Mapped[str | None] = mapped_column(String(16), nullable=True)`
    - `slide_paths: Mapped[list | None] = mapped_column(JSONB, nullable=True)`
    - `conversion_error: Mapped[str | None] = mapped_column(Text, nullable=True)`
    - `conversion_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`
    - `html_content: Mapped[str | None] = mapped_column(Text, nullable=True)`
    - `created_at`, `updated_at` per D-12.
    - `__table_args__ = (CheckConstraint("kind IN ('image','video','pdf','pptx','url','html')", name="ck_signage_media_kind"), CheckConstraint("conversion_status IS NULL OR conversion_status IN ('pending','processing','done','failed')", name="ck_signage_media_conversion_status"),)`
    - `playlist_items: Mapped[list["SignagePlaylistItem"]] = relationship("SignagePlaylistItem", back_populates="media")` (no cascade — RESTRICT per D-16)

    **Class 2: `SignagePlaylist`** — `__tablename__ = "signage_playlists"`
    - `id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())`
    - `name: Mapped[str] = mapped_column(String(128), nullable=False)`
    - `description: Mapped[str | None] = mapped_column(Text, nullable=True)`
    - `priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))` (Research open-q 6)
    - `enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))` (Research open-q 7)
    - `created_at`, `updated_at` per D-12.
    - `items: Mapped[list["SignagePlaylistItem"]] = relationship("SignagePlaylistItem", back_populates="playlist", cascade="all, delete-orphan", order_by="SignagePlaylistItem.position")`

    **Class 3: `SignagePlaylistItem`** — `__tablename__ = "signage_playlist_items"` (per D-16, FK RESTRICT on media_id)
    - `id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())`
    - `playlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signage_playlists.id", ondelete="CASCADE"), nullable=False)`
    - `media_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signage_media.id", ondelete="RESTRICT"), nullable=False)`
    - `position: Mapped[int] = mapped_column(Integer, nullable=False)`
    - `duration_s: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("10"))`
    - `transition: Mapped[str | None] = mapped_column(String(32), nullable=True)`
    - `created_at`, `updated_at` per D-12.
    - Relationships: `playlist = relationship("SignagePlaylist", back_populates="items")`; `media = relationship("SignageMedia", back_populates="playlist_items")`

    **Class 4: `SignageDevice`** — `__tablename__ = "signage_devices"` (Research open-q 1, 2, 3 — include forward columns to avoid narrow migrations in 42/43)
    - `id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())`
    - `name: Mapped[str] = mapped_column(String(128), nullable=False)`
    - `device_token_hash: Mapped[str | None] = mapped_column(Text, nullable=True)` (Phase 42 populates; allowing Text accommodates both opaque-sha256 and JWT)
    - `last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`
    - `revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`
    - `current_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)` (no FK — item may be deleted while device still cached it)
    - `status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'offline'"))`
    - `created_at`, `updated_at` per D-12.
    - `__table_args__ = (CheckConstraint("status IN ('online','offline','pending')", name="ck_signage_devices_status"),)`

    **Class 5: `SignageDeviceTag`** — `__tablename__ = "signage_device_tags"`
    - `id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)`
    - `name: Mapped[str] = mapped_column(String(64), nullable=False)`
    - `created_at`, `updated_at` per D-12.
    - `__table_args__ = (Index("uq_signage_device_tags_name", "name", unique=True),)` (use a named unique index rather than UniqueConstraint to match existing _base.py naming convention)

    **Class 6: `SignageDeviceTagMap`** — `__tablename__ = "signage_device_tag_map"` (composite PK per D-17 discretion, research recommendation "Composite PK")
    - `device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signage_devices.id", ondelete="CASCADE"), primary_key=True)`
    - `tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("signage_device_tags.id", ondelete="CASCADE"), primary_key=True)`
    - `created_at`, `updated_at` per D-12.

    **Class 7: `SignagePlaylistTagMap`** — `__tablename__ = "signage_playlist_tag_map"` (composite PK; plays role of many-to-many between playlists and device tags — the tag-based routing model)
    - `playlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signage_playlists.id", ondelete="CASCADE"), primary_key=True)`
    - `tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("signage_device_tags.id", ondelete="CASCADE"), primary_key=True)`
    - `created_at`, `updated_at` per D-12.

    **Class 8: `SignagePairingSession`** — `__tablename__ = "signage_pairing_sessions"` (per D-15 partial unique index; FK SET NULL on device_id)
    - `id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())`
    - `code: Mapped[str] = mapped_column(String(6), nullable=False)`
    - `device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("signage_devices.id", ondelete="SET NULL"), nullable=True)`
    - `expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)`
    - `claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`
    - `created_at`, `updated_at` per D-12.
    - `__table_args__ = (Index("uix_signage_pairing_sessions_code_active", "code", unique=True, postgresql_where=text("expires_at > now() AND claimed_at IS NULL")),)`

    Common pattern for `created_at`/`updated_at` on every class (copy verbatim):
```
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        server_default=func.now(), onupdate=func.now()
    )
```

    This implements decisions D-06, D-07, D-08, D-12, D-15, D-16, plus research open-questions 1, 2, 3, 6, 7.
  </action>
  <verify>
    <automated>cd backend && python -c "
from app.models import Base
from app.models.signage import (
    SignageMedia, SignagePlaylist, SignagePlaylistItem, SignageDevice,
    SignageDeviceTag, SignageDeviceTagMap, SignagePlaylistTagMap, SignagePairingSession
)
t = set(Base.metadata.tables.keys())
expected = {'signage_media','signage_playlists','signage_playlist_items','signage_devices','signage_device_tags','signage_device_tag_map','signage_playlist_tag_map','signage_pairing_sessions'}
missing = expected - t
assert not missing, f'missing tables: {missing}'
# Verify partial unique index
ps = Base.metadata.tables['signage_pairing_sessions']
idx = [i for i in ps.indexes if i.name == 'uix_signage_pairing_sessions_code_active']
assert idx and idx[0].unique, 'partial unique index missing'
assert idx[0].dialect_options.get('postgresql',{}).get('where') is not None, 'postgresql_where not set'
# Verify RESTRICT FK on media_id
pi = Base.metadata.tables['signage_playlist_items']
fks = [fk for c in pi.columns for fk in c.foreign_keys if c.name == 'media_id']
assert fks and fks[0].ondelete == 'RESTRICT', f'media_id ondelete wrong: {fks[0].ondelete if fks else None}'
print('OK')
" 2>&amp;1 | tee /tmp/41-01-t2.log &amp;&amp; grep -q "^OK$" /tmp/41-01-t2.log</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/app/models/signage.py` exists with all 8 classes: `for c in SignageMedia SignagePlaylist SignagePlaylistItem SignageDevice SignageDeviceTag SignageDeviceTagMap SignagePlaylistTagMap SignagePairingSession; do grep -q "^class $c(" backend/app/models/signage.py || exit 1; done`
    - Partial unique index present in source: `grep -q 'uix_signage_pairing_sessions_code_active' backend/app/models/signage.py && grep -q 'postgresql_where=text(' backend/app/models/signage.py && grep -q 'expires_at > now() AND claimed_at IS NULL' backend/app/models/signage.py`
    - RESTRICT FK present: `grep -q 'ondelete="RESTRICT"' backend/app/models/signage.py` (exactly one occurrence, on media_id line)
    - CHECK constraints present for kind: `grep -q "ck_signage_media_kind" backend/app/models/signage.py && grep -q "image','video','pdf','pptx','url','html" backend/app/models/signage.py`
    - CHECK constraints present for conversion_status: `grep -q "ck_signage_media_conversion_status" backend/app/models/signage.py && grep -q "pending','processing','done','failed" backend/app/models/signage.py`
    - Every class has created_at AND updated_at: `grep -c "created_at: Mapped" backend/app/models/signage.py` >= 8, `grep -c "updated_at: Mapped" backend/app/models/signage.py` >= 8
    - JSONB import used for slide_paths: `grep -q "slide_paths: Mapped\[list | None\] = mapped_column(JSONB" backend/app/models/signage.py`
    - Python import test passes (the automated verify command above outputs `OK`)
  </acceptance_criteria>
  <done>All 8 signage tables registered in `Base.metadata`, partial unique index declared on `signage_pairing_sessions`, RESTRICT FK on `signage_playlist_items.media_id`, CHECK constraints on `signage_media.kind` and `conversion_status`, timestamps on every table.</done>
</task>

</tasks>

<verification>
From repo root:
```
cd backend && python -c "
from app.models import Base
tables = set(Base.metadata.tables.keys())
print('signage tables:', sorted(t for t in tables if t.startswith('signage_')))
assert len([t for t in tables if t.startswith('signage_')]) == 8, 'expected 8 signage tables'
print('legacy still registered:', 'sensors' in tables and 'app_settings' in tables)
"
```
Expected output: 8 signage tables listed, legacy still registered = True.

Also confirm that `alembic --help` still works from `backend/` (no import-time failure in `env.py`):
```
cd backend && alembic current --verbose 2>&1 | head -5
```
</verification>

<success_criteria>
- `backend/app/models/` is a package (directory with `__init__.py`)
- `backend/app/models.py` no longer exists as a file
- `from app.models import Base` works
- All legacy model classes still importable as `from app.models import X`
- 8 signage classes defined in `backend/app/models/signage.py` and re-exported in `__init__.py`
- `Base.metadata.tables` includes all 8 `signage_*` tables after importing the package
- Partial unique index and RESTRICT FK are declared in the ORM
</success_criteria>

<output>
After completion, create `.planning/phases/41-signage-schema-models/41-01-SUMMARY.md` capturing: files touched, exact class list produced, any deviations from the plan (e.g., extra legacy classes discovered in models.py beyond the enumeration), and the `Base.metadata.tables` verification output.
</output>
