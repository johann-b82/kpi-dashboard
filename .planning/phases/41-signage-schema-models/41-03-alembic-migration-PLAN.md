---
phase: 41-signage-schema-models
plan: 03
type: execute
wave: 2
depends_on:
  - 41-01
files_modified:
  - backend/alembic/versions/v1_16_signage_schema.py
autonomous: true
requirements:
  - SGN-DB-01
  - SGN-DB-02
  - SGN-DB-03
  - SGN-DB-05
must_haves:
  truths:
    - "`alembic upgrade head` on a fresh DB creates all 8 signage_* tables"
    - "`\\d signage_pairing_sessions` shows a partial-unique index with `WHERE expires_at > now() AND claimed_at IS NULL`"
    - "`\\d signage_playlist_items` shows `FOREIGN KEY (media_id) ... ON DELETE RESTRICT`"
    - "`alembic downgrade -1` cleanly removes all 8 signage_* tables and the partial index"
    - "Re-running `alembic upgrade head` after downgrade restores the exact same schema (idempotent round-trip)"
  artifacts:
    - path: backend/alembic/versions/v1_16_signage_schema.py
      provides: "Single Alembic revision creating all 8 signage tables + partial unique index + CHECK constraints + FKs"
      contains: "revision: str = \"v1_16_signage\""
  key_links:
    - from: backend/alembic/versions/v1_16_signage_schema.py
      to: signage_pairing_sessions.code
      via: "op.create_index with unique=True + postgresql_where"
      pattern: "postgresql_where=sa.text"
    - from: backend/alembic/versions/v1_16_signage_schema.py
      to: signage_playlist_items.media_id
      via: "sa.ForeignKey ondelete=RESTRICT"
      pattern: "ondelete=.RESTRICT."
---

<objective>
Produce a single handwritten Alembic revision file `backend/alembic/versions/v1_16_signage_schema.py` that creates all 8 signage tables, the partial-unique index on `signage_pairing_sessions.code`, CHECK constraints on `signage_media.kind` and `signage_media.conversion_status`, and FKs with the ondelete semantics from RESEARCH.md. The migration must round-trip cleanly (upgrade → downgrade → upgrade) on a fresh database to satisfy SGN-DB-05.

Purpose: Alembic is the sole source of schema truth for this project. This revision closes SGN-DB-01 through SGN-DB-03 and SGN-DB-05.

Output: One migration file; upgrade/downgrade symmetric; no ENUM types to drop; written by hand (NOT autogenerate — partial-unique indexes are not reliably detected).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-signage-schema-models/41-CONTEXT.md
@.planning/phases/41-signage-schema-models/41-RESEARCH.md
@backend/alembic/versions/v1_15_sensor_schema.py
@backend/alembic/env.py
@backend/app/models/signage.py

<interfaces>
Migration filename convention (mirrors v1_15_sensor_schema.py):
- Filename: `v1_16_signage_schema.py`
- `revision: str = "v1_16_signage"`
- `down_revision`: determined by running `cd backend && alembic heads` BEFORE writing the migration.

Alembic ops available:
- `op.create_table(name, *columns_and_constraints)`
- `op.create_index(name, table, cols, unique=bool, postgresql_where=sa.text(...))`
- `op.drop_index(name, table_name=...)`
- `op.drop_table(name)`
- `sa.Column`, `sa.ForeignKey(..., ondelete=...)`, `sa.CheckConstraint`, `sa.PrimaryKeyConstraint`
- `sa.dialects.postgresql.UUID(as_uuid=True)`, `sa.dialects.postgresql.JSONB`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Determine Alembic head, scaffold revision file, write upgrade()</name>
  <files>backend/alembic/versions/v1_16_signage_schema.py</files>
  <read_first>
    - backend/alembic/versions/v1_15_sensor_schema.py (template — revision id format, down_revision, upgrade/downgrade structure)
    - backend/alembic/env.py (confirm target_metadata = Base.metadata pattern)
    - backend/app/models/signage.py (MUST match every column type, nullability, default — source of truth)
    - .planning/phases/41-signage-schema-models/41-RESEARCH.md (sections "FK ondelete Strategy", "Complete Partial-Unique Index in Migration", "ENUM vs. CHECK", "Common Pitfalls")
  </read_first>
  <action>
    **Step 1: Determine down_revision.**
    Run `cd backend && alembic heads` from the repo root. If Alembic cannot run locally (missing deps / DB), run `docker compose run --rm migrate alembic heads`. Capture the revision ID string. If multiple heads exist, STOP and report — this phase assumes linear history.

    **Step 2: Write preamble.**
```
"""v1.16 signage schema — 8 tables for digital signage (SGN-DB-01..05)

Creates signage_media, signage_playlists, signage_playlist_items,
signage_devices, signage_device_tags, signage_device_tag_map,
signage_playlist_tag_map, signage_pairing_sessions.

Partial-unique index on signage_pairing_sessions.code WHERE active (SGN-DB-02).
ON DELETE RESTRICT on signage_playlist_items.media_id (SGN-DB-03).
CHECK constraints on kind and conversion_status (no ENUMs, round-trip clean).

Revision ID: v1_16_signage
Revises: <HEAD_FROM_STEP_1>
Create Date: 2026-04-18
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v1_16_signage"
down_revision: str | None = "<HEAD_FROM_STEP_1>"
branch_labels = None
depends_on = None
```

    **Step 3: Write upgrade().**
    Use `postgresql.UUID(as_uuid=True)` for UUID columns (NOT `sa.String(36)` — PITFALLS Pitfall 4). Use `postgresql.JSONB` for `slide_paths`. Use `sa.text("gen_random_uuid()")` for UUID server defaults (PG17 built-in — do NOT add `CREATE EXTENSION pgcrypto`).

    Local helper for timestamps inside upgrade():
```
    ts_cols = lambda: [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    ]
```

    Create tables in this exact order:

    **1. signage_media** — no FK deps:
```
    op.create_table(
        "signage_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(127), nullable=True),
        sa.Column("size_bytes", sa.BigInteger, nullable=True),
        sa.Column("uri", sa.Text, nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("conversion_status", sa.String(16), nullable=True),
        sa.Column("slide_paths", postgresql.JSONB, nullable=True),
        sa.Column("conversion_error", sa.Text, nullable=True),
        sa.Column("conversion_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("html_content", sa.Text, nullable=True),
        *ts_cols(),
        sa.CheckConstraint(
            "kind IN ('image','video','pdf','pptx','url','html')",
            name="ck_signage_media_kind",
        ),
        sa.CheckConstraint(
            "conversion_status IS NULL OR conversion_status IN ('pending','processing','done','failed')",
            name="ck_signage_media_conversion_status",
        ),
    )
```

    **2. signage_playlists** — no FK deps:
```
    op.create_table(
        "signage_playlists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("priority", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
        *ts_cols(),
    )
```

    **3. signage_device_tags** — no FK deps:
```
    op.create_table(
        "signage_device_tags",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False),
        *ts_cols(),
    )
    op.create_index("uq_signage_device_tags_name", "signage_device_tags", ["name"], unique=True)
```

    **4. signage_devices** — no FK deps:
```
    op.create_table(
        "signage_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("device_token_hash", sa.Text, nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default=sa.text("'offline'")),
        *ts_cols(),
        sa.CheckConstraint(
            "status IN ('online','offline','pending')",
            name="ck_signage_devices_status",
        ),
    )
```

    **5. signage_playlist_items** — FK playlist CASCADE, FK media RESTRICT (SGN-DB-03):
```
    op.create_table(
        "signage_playlist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("playlist_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("signage_playlists.id", ondelete="CASCADE",
                                name="fk_signage_playlist_items_playlist_id"),
                  nullable=False),
        sa.Column("media_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("signage_media.id", ondelete="RESTRICT",
                                name="fk_signage_playlist_items_media_id"),
                  nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("duration_s", sa.Integer, nullable=False, server_default=sa.text("10")),
        sa.Column("transition", sa.String(32), nullable=True),
        *ts_cols(),
    )
    op.create_index("ix_signage_playlist_items_playlist_id", "signage_playlist_items", ["playlist_id"])
    op.create_index("ix_signage_playlist_items_media_id", "signage_playlist_items", ["media_id"])
```

    **6. signage_device_tag_map** — composite PK, FKs CASCADE:
```
    op.create_table(
        "signage_device_tag_map",
        sa.Column("device_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("signage_devices.id", ondelete="CASCADE",
                                name="fk_signage_device_tag_map_device_id"),
                  nullable=False),
        sa.Column("tag_id", sa.Integer,
                  sa.ForeignKey("signage_device_tags.id", ondelete="CASCADE",
                                name="fk_signage_device_tag_map_tag_id"),
                  nullable=False),
        *ts_cols(),
        sa.PrimaryKeyConstraint("device_id", "tag_id", name="pk_signage_device_tag_map"),
    )
```

    **7. signage_playlist_tag_map** — composite PK, FKs CASCADE:
```
    op.create_table(
        "signage_playlist_tag_map",
        sa.Column("playlist_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("signage_playlists.id", ondelete="CASCADE",
                                name="fk_signage_playlist_tag_map_playlist_id"),
                  nullable=False),
        sa.Column("tag_id", sa.Integer,
                  sa.ForeignKey("signage_device_tags.id", ondelete="CASCADE",
                                name="fk_signage_playlist_tag_map_tag_id"),
                  nullable=False),
        *ts_cols(),
        sa.PrimaryKeyConstraint("playlist_id", "tag_id", name="pk_signage_playlist_tag_map"),
    )
```

    **8. signage_pairing_sessions** — FK device SET NULL, partial-unique index (SGN-DB-02):
```
    op.create_table(
        "signage_pairing_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("signage_devices.id", ondelete="SET NULL",
                                name="fk_signage_pairing_sessions_device_id"),
                  nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        *ts_cols(),
    )
    op.create_index(
        "uix_signage_pairing_sessions_code_active",
        "signage_pairing_sessions",
        ["code"],
        unique=True,
        postgresql_where=sa.text("expires_at > now() AND claimed_at IS NULL"),
    )
```

    Do NOT add `CREATE EXTENSION pgcrypto`. Do NOT create Postgres ENUM types. Use the column shapes verbatim — they mirror the ORM in Plan 01.

    This implements SGN-DB-01, SGN-DB-02, SGN-DB-03 and decisions D-14, D-15, D-16.
  </action>
  <verify>
    <automated>grep -q 'revision: str = "v1_16_signage"' backend/alembic/versions/v1_16_signage_schema.py && ! grep -q 'HEAD_FROM_STEP_1' backend/alembic/versions/v1_16_signage_schema.py && grep -q 'ondelete="RESTRICT"' backend/alembic/versions/v1_16_signage_schema.py && grep -q 'postgresql_where=sa.text("expires_at > now() AND claimed_at IS NULL")' backend/alembic/versions/v1_16_signage_schema.py && ! grep -q 'pgcrypto' backend/alembic/versions/v1_16_signage_schema.py</automated>
  </verify>
  <acceptance_criteria>
    - File exists, revision ID set: `grep -q 'revision: str = "v1_16_signage"' backend/alembic/versions/v1_16_signage_schema.py`
    - down_revision placeholder replaced: `! grep -q 'HEAD_FROM_STEP_1' backend/alembic/versions/v1_16_signage_schema.py`
    - All 8 create_table calls present: `for t in signage_media signage_playlists signage_playlist_items signage_devices signage_device_tags signage_device_tag_map signage_playlist_tag_map signage_pairing_sessions; do grep -q "op.create_table(\s*\"$t\"" backend/alembic/versions/v1_16_signage_schema.py || exit 1; done`
    - RESTRICT on media_id: `grep -q 'ondelete="RESTRICT"' backend/alembic/versions/v1_16_signage_schema.py`
    - Partial unique index: `grep -q 'uix_signage_pairing_sessions_code_active' backend/alembic/versions/v1_16_signage_schema.py && grep -q 'postgresql_where=sa.text("expires_at > now() AND claimed_at IS NULL")' backend/alembic/versions/v1_16_signage_schema.py`
    - CHECK constraints: `grep -q 'ck_signage_media_kind' backend/alembic/versions/v1_16_signage_schema.py && grep -q 'ck_signage_media_conversion_status' backend/alembic/versions/v1_16_signage_schema.py && grep -q 'ck_signage_devices_status' backend/alembic/versions/v1_16_signage_schema.py`
    - Kind values exact: `grep -q "kind IN ('image','video','pdf','pptx','url','html')" backend/alembic/versions/v1_16_signage_schema.py`
    - No pgcrypto: `! grep -q 'pgcrypto' backend/alembic/versions/v1_16_signage_schema.py`
    - JSONB: `grep -q 'postgresql.JSONB' backend/alembic/versions/v1_16_signage_schema.py`
    - Composite PKs: `grep -c 'PrimaryKeyConstraint' backend/alembic/versions/v1_16_signage_schema.py` >= 2
    - gen_random_uuid defaults: `grep -c 'gen_random_uuid()' backend/alembic/versions/v1_16_signage_schema.py` >= 5
  </acceptance_criteria>
  <done>upgrade() complete: all 8 tables created, partial unique index on active pairing codes, CHECK constraints on kind/conversion_status/status, RESTRICT FK on media_id, composite PKs on join tables, no ENUM types, no pgcrypto.</done>
</task>

<task type="auto">
  <name>Task 2: Write downgrade() in reverse FK order; drop partial index before its table</name>
  <files>backend/alembic/versions/v1_16_signage_schema.py</files>
  <read_first>
    - backend/alembic/versions/v1_16_signage_schema.py (the upgrade just written in Task 1)
    - .planning/phases/41-signage-schema-models/41-RESEARCH.md ("Pitfall 2" drop order, "Pitfall 3" drop index before table)
    - backend/alembic/versions/v1_15_sensor_schema.py (downgrade pattern precedent)
  </read_first>
  <action>
    Fill `downgrade()` dropping objects in reverse dependency order. Partial index and named indexes drop BEFORE their parent table (Pitfall 3). CHECK and FK constraints drop implicitly with the table — no explicit `op.drop_constraint` needed.

    Exact downgrade() body:
```
def downgrade() -> None:
    # Drop partial unique index before its table (Pitfall 3)
    op.drop_index(
        "uix_signage_pairing_sessions_code_active",
        table_name="signage_pairing_sessions",
    )
    op.drop_table("signage_pairing_sessions")

    # Join tables (depend on devices, tags, playlists) — drop before parents
    op.drop_table("signage_playlist_tag_map")
    op.drop_table("signage_device_tag_map")

    # playlist_items depends on playlists + media — drop its indexes then table
    op.drop_index("ix_signage_playlist_items_media_id", table_name="signage_playlist_items")
    op.drop_index("ix_signage_playlist_items_playlist_id", table_name="signage_playlist_items")
    op.drop_table("signage_playlist_items")

    # Independent tables
    op.drop_table("signage_devices")
    op.drop_index("uq_signage_device_tags_name", table_name="signage_device_tags")
    op.drop_table("signage_device_tags")
    op.drop_table("signage_playlists")
    op.drop_table("signage_media")
```

    Note: every `op.create_index(...)` call in upgrade() must have a matching `op.drop_index(...)` in downgrade(). Indexes implicitly created by primary keys / CHECK constraints / FK constraints do NOT need explicit drops — they go with `op.drop_table`.

    DO NOT drop any Postgres ENUM types (none exist). DO NOT drop pgcrypto (not installed).
  </action>
  <verify>
    <automated>grep -q 'op.drop_index(\s*\n\s*"uix_signage_pairing_sessions_code_active"' backend/alembic/versions/v1_16_signage_schema.py || grep -q 'op.drop_index("uix_signage_pairing_sessions_code_active"' backend/alembic/versions/v1_16_signage_schema.py</automated>
  </verify>
  <acceptance_criteria>
    - downgrade() function present: `grep -q 'def downgrade() -> None:' backend/alembic/versions/v1_16_signage_schema.py`
    - All 8 op.drop_table calls present: `for t in signage_pairing_sessions signage_playlist_tag_map signage_device_tag_map signage_playlist_items signage_devices signage_device_tags signage_playlists signage_media; do grep -q "op.drop_table(\"$t\")" backend/alembic/versions/v1_16_signage_schema.py || exit 1; done`
    - Partial index dropped: `grep -q 'uix_signage_pairing_sessions_code_active' backend/alembic/versions/v1_16_signage_schema.py` (appears in upgrade create_index AND downgrade drop_index — count >= 2)
    - `grep -c 'uix_signage_pairing_sessions_code_active' backend/alembic/versions/v1_16_signage_schema.py` >= 2
    - Named indexes on playlist_items dropped: `grep -q 'op.drop_index("ix_signage_playlist_items_media_id"' backend/alembic/versions/v1_16_signage_schema.py && grep -q 'op.drop_index("ix_signage_playlist_items_playlist_id"' backend/alembic/versions/v1_16_signage_schema.py`
    - Unique index on device_tags.name dropped: `grep -q 'op.drop_index("uq_signage_device_tags_name"' backend/alembic/versions/v1_16_signage_schema.py`
    - Drop order correct (pairing_sessions before devices; join tables before their parents). Inspect visually via: `grep -n "op.drop_table\|op.drop_index" backend/alembic/versions/v1_16_signage_schema.py` — output lines must show pairing_sessions index/table first, then tag_maps, then playlist_items (with its indexes), then devices, then device_tags, then playlists, then media
    - File parses as Python: `python -c "import ast; ast.parse(open('backend/alembic/versions/v1_16_signage_schema.py').read())"` exits 0
  </acceptance_criteria>
  <done>downgrade() complete, all objects from upgrade() dropped in reverse dependency order, partial index and named indexes dropped before their tables, file parses as valid Python.</done>
</task>

</tasks>

<verification>
File-level static checks (actual DB round-trip verification lives in Plan 05):

```
# Valid Python syntax
cd backend && python -c "import ast; ast.parse(open('alembic/versions/v1_16_signage_schema.py').read()); print('parses')"

# Alembic recognizes the revision
cd backend && alembic history --verbose 2>&1 | grep -A1 "v1_16_signage"

# Revision is the new head (or docker compose run --rm migrate alembic heads if local fails)
cd backend && alembic heads
```
</verification>

<success_criteria>
- `backend/alembic/versions/v1_16_signage_schema.py` exists and parses as Python
- `revision = "v1_16_signage"`, `down_revision` set to the actual prior head
- upgrade() creates all 8 tables + partial unique index + named indexes + CHECK constraints + FKs per spec
- downgrade() reverses upgrade() in correct dependency order
- No `pgcrypto` extension, no Postgres ENUM types
- `alembic history` lists `v1_16_signage` as the current head
- Full DB round-trip (upgrade → downgrade → upgrade) is validated by Plan 05, not this plan
</success_criteria>

<output>
After completion, create `.planning/phases/41-signage-schema-models/41-03-SUMMARY.md` recording: down_revision value used, exact list of tables/indexes/CHECKs/FKs created, any deviations from the plan (e.g., additional named constraints), and `alembic heads` output proving the revision is registered.
</output>
