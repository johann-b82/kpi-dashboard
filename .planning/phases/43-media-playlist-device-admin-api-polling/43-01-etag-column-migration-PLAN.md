---
phase: 43-media-playlist-device-admin-api-polling
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/alembic/versions/v1_16_signage_devices_etag.py
  - backend/app/models/signage.py
autonomous: true
requirements:
  - SGN-BE-02
must_haves:
  truths:
    - "signage_devices table has column current_playlist_etag TEXT NULL"
    - "SignageDevice ORM model exposes current_playlist_etag attribute"
    - "Migration up/down round-trips cleanly on a fresh DB"
  artifacts:
    - path: backend/alembic/versions/v1_16_signage_devices_etag.py
      provides: "Additive Alembic migration adding current_playlist_etag column"
      contains: "op.add_column"
    - path: backend/app/models/signage.py
      provides: "Updated SignageDevice ORM with current_playlist_etag"
      contains: "current_playlist_etag"
  key_links:
    - from: backend/app/models/signage.py
      to: signage_devices.current_playlist_etag
      via: "Mapped[str | None] column"
      pattern: "current_playlist_etag.*Mapped"
---

<objective>
Add the `current_playlist_etag` TEXT nullable column to `signage_devices` via an additive Alembic migration and update the SQLAlchemy ORM model so Phase 43 heartbeat (D-11) can persist the last-known playlist ETag.

Purpose: Phase 41 schema did not include this column. The heartbeat endpoint in Plan 04 needs to write `signage_devices.current_playlist_etag`. This plan lands the column in an isolated Wave-0-style migration so downstream plans can assume it exists.

Output: One new Alembic revision file, one modified ORM model file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md
@backend/alembic/versions/v1_16_signage_schema.py
@backend/app/models/signage.py

<interfaces>
Phase 41 landed `signage_devices` columns (verified by grep on backend/app/models/signage.py):
- id (UUID PK)
- last_seen_at (timestamp, nullable)
- revoked_at (timestamp, nullable)
- current_item_id (UUID, nullable, NO FK by Phase 41 D-02)
- status (String(16), CHECK IN ('online','offline','pending'))

Missing (to add this plan):
- current_playlist_etag (TEXT, nullable)

Existing Phase 41 revision: `v1_16_signage_schema` in backend/alembic/versions/v1_16_signage_schema.py
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create additive Alembic migration for current_playlist_etag</name>
  <files>backend/alembic/versions/v1_16_signage_devices_etag.py</files>
  <read_first>
    - backend/alembic/versions/v1_16_signage_schema.py (to copy revision-id naming and header style)
    - backend/alembic/versions/v1_15_sensor_schema.py (secondary style reference)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md §"Schema Gaps to Verify Before Planning"
  </read_first>
  <action>
    Create a new Alembic revision file `backend/alembic/versions/v1_16_signage_devices_etag.py` with:

    ```python
    """v1.16 signage: add current_playlist_etag to signage_devices

    Revision ID: v1_16_signage_devices_etag
    Revises: v1_16_signage_schema
    Create Date: 2026-04-18

    Adds signage_devices.current_playlist_etag (TEXT, nullable) so Phase 43
    heartbeat endpoint can persist the player's last-known playlist ETag
    (D-11 in 43-CONTEXT.md).
    """
    from alembic import op
    import sqlalchemy as sa

    revision = "v1_16_signage_devices_etag"
    down_revision = "v1_16_signage_schema"
    branch_labels = None
    depends_on = None


    def upgrade() -> None:
        op.add_column(
            "signage_devices",
            sa.Column("current_playlist_etag", sa.Text(), nullable=True),
        )


    def downgrade() -> None:
        op.drop_column("signage_devices", "current_playlist_etag")
    ```

    Use EXACT values — `revision = "v1_16_signage_devices_etag"`, `down_revision = "v1_16_signage_schema"`, column name `current_playlist_etag`, type `sa.Text()`, `nullable=True`.
  </action>
  <verify>
    <automated>cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head && psql "$DATABASE_URL" -c "\d signage_devices" | grep -q "current_playlist_etag"</automated>
  </verify>
  <acceptance_criteria>
    - File exists at backend/alembic/versions/v1_16_signage_devices_etag.py
    - grep -q "revision = \"v1_16_signage_devices_etag\"" in file → exit 0
    - grep -q "down_revision = \"v1_16_signage_schema\"" in file → exit 0
    - grep -q "op.add_column" in file → exit 0
    - grep -q "current_playlist_etag" in file → exit 0
    - `alembic upgrade head` succeeds with no error
    - After upgrade, `\d signage_devices` shows column `current_playlist_etag` of type `text`
    - `alembic downgrade -1 && alembic upgrade head` round-trip exits 0
  </acceptance_criteria>
  <done>Migration file exists, up/down round-trip clean, column present in DB.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add current_playlist_etag to SignageDevice ORM model</name>
  <files>backend/app/models/signage.py</files>
  <read_first>
    - backend/app/models/signage.py (full file; find the SignageDevice class around line 160-200)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions D-11
  </read_first>
  <action>
    In `backend/app/models/signage.py`, locate the `SignageDevice` class (near line 165 based on grep findings: `status IN ('online','offline','pending')` CHECK constraint). Add a new mapped column immediately after the existing `status` column definition:

    ```python
    current_playlist_etag: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    ```

    If `Text` is not already imported from sqlalchemy in this file, add it to the existing sqlalchemy import line (e.g., `from sqlalchemy import ..., Text, ...`).

    Do NOT change any other column. Do NOT touch other ORM classes. The column MUST be nullable (default None).
  </action>
  <verify>
    <automated>cd backend && python -c "from app.models.signage import SignageDevice; assert hasattr(SignageDevice, 'current_playlist_etag'), 'column missing on ORM'; print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - grep -n "current_playlist_etag" backend/app/models/signage.py returns at least 1 line
    - grep -n "Mapped\[str | None\]" backend/app/models/signage.py shows the new column
    - `python -c "from app.models.signage import SignageDevice; assert hasattr(SignageDevice, 'current_playlist_etag')"` exits 0
    - `pytest backend/tests/test_signage_schema_roundtrip.py -x` still passes (no regression on existing round-trip)
  </acceptance_criteria>
  <done>ORM attribute exists, model imports cleanly, existing round-trip test unchanged.</done>
</task>

</tasks>

<verification>
- `alembic upgrade head` applies both v1_16_signage_schema and v1_16_signage_devices_etag in order
- `\d signage_devices` shows `current_playlist_etag | text |` row in psql
- Round-trip: `alembic downgrade -1 && alembic upgrade head` succeeds
- ORM: `SignageDevice.current_playlist_etag` attribute resolves without error
- Existing tests still pass: `pytest backend/tests/test_signage_schema_roundtrip.py`
</verification>

<success_criteria>
1. New migration file present and follows v1_16_signage_schema naming convention.
2. Column `current_playlist_etag` (text, nullable) exists in `signage_devices` after `alembic upgrade head`.
3. ORM `SignageDevice.current_playlist_etag` is a Mapped[str | None] attribute.
4. Downgrade cleanly drops the column; upgrade re-adds it.
</success_criteria>

<output>
After completion, create `.planning/phases/43-media-playlist-device-admin-api-polling/43-01-SUMMARY.md`
</output>
