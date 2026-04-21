---
phase: 51-schedule-schema-resolver
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/requirements.txt
  - backend/alembic/versions/v1_18_signage_schedules.py
  - backend/app/services/_hhmm.py
  - backend/app/models/signage.py
  - backend/app/models/_base.py
  - backend/app/schemas/signage.py
  - backend/app/services/signage_resolver.py
  - backend/tests/test_signage_schedule_resolver.py
  - backend/tests/test_signage_schema_roundtrip.py
autonomous: true
requirements:
  - SGN-TIME-01
  - SGN-TIME-02
  - SGN-TIME-03

must_haves:
  truths:
    - "alembic upgrade head creates signage_schedules with all CHECK constraints; alembic downgrade -1 cleanly removes it (round-trip)"
    - "alembic upgrade head adds app_settings.timezone column with default 'Europe/Berlin'; existing singleton row backfilled by server default"
    - "zoneinfo.ZoneInfo('Europe/Berlin') succeeds inside the python:3.11-slim Docker container (tzdata pip pkg present)"
    - "resolve_schedule_for_device returns the highest (priority DESC, updated_at DESC) schedule whose weekday_mask matches now.weekday(), start_hhmm <= now.hhmm < end_hhmm, enabled=true, and playlist tags overlap device tags — else None"
    - "resolve_playlist_for_device calls resolve_schedule_for_device first; falls through to existing tag-based resolver only when None is returned (8+ existing callsites unchanged)"
    - "All 7 SGN-TIME-03 resolver test cases pass: schedule-match (single), priority tiebreak, weekday-miss, time-miss, disabled-schedule-skip, tag-mismatch-skip, empty-schedules-falls-back-to-tag-resolver"
  artifacts:
    - path: "backend/alembic/versions/v1_18_signage_schedules.py"
      provides: "Migration creating signage_schedules + adding app_settings.timezone"
      contains: "v1_18_signage_schedules"
    - path: "backend/app/services/_hhmm.py"
      provides: "HHMM integer helpers and now_hhmm_in_tz"
      exports: ["hhmm_to_time", "time_to_hhmm", "now_hhmm_in_tz"]
    - path: "backend/app/models/signage.py"
      provides: "SignageSchedule SQLAlchemy model"
      contains: "class SignageSchedule"
    - path: "backend/app/services/signage_resolver.py"
      provides: "resolve_schedule_for_device + composed resolve_playlist_for_device"
      contains: "async def resolve_schedule_for_device"
    - path: "backend/tests/test_signage_schedule_resolver.py"
      provides: "7 SGN-TIME-03 integration test cases"
      min_lines: 200
    - path: "backend/requirements.txt"
      provides: "tzdata pip dependency"
      contains: "tzdata"
  key_links:
    - from: "backend/app/services/signage_resolver.py::resolve_playlist_for_device"
      to: "backend/app/services/signage_resolver.py::resolve_schedule_for_device"
      via: "scheduled = await resolve_schedule_for_device(db, device); if scheduled is not None: return scheduled"
      pattern: "scheduled.*await resolve_schedule_for_device"
    - from: "backend/app/services/signage_resolver.py::resolve_schedule_for_device"
      to: "backend/app/services/_hhmm.py::now_hhmm_in_tz"
      via: "weekday, hhmm = now_hhmm_in_tz(app_settings.timezone)"
      pattern: "now_hhmm_in_tz"
    - from: "backend/app/services/signage_resolver.py::resolve_schedule_for_device"
      to: "app_settings.timezone column"
      via: "select(AppSettings) → settings.timezone"
      pattern: "AppSettings.*timezone|settings\\.timezone"
---

<objective>
Lay the schema + resolver foundation for time-aware playlist resolution. Single Alembic migration creates `signage_schedules` and adds `app_settings.timezone`. Adds `tzdata` pip dependency (required for `zoneinfo` in `python:3.11-slim`). Introduces `_hhmm.py` integer-time helpers, `SignageSchedule` model + Pydantic schemas, and the new `resolve_schedule_for_device` service composed into the existing `resolve_playlist_for_device`. All 7 SGN-TIME-03 resolver test cases land in a new test module.

Purpose: SGN-TIME-01 (migration), SGN-TIME-02 (resolver behaviour), SGN-TIME-03 (test coverage). Phase 51 backbone.
Output: Migration applied; resolver returns scheduled playlist envelope when matched, falls back to tag resolver otherwise; all 8+ existing callsites untouched.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/51-schedule-schema-resolver/51-CONTEXT.md
@.planning/phases/51-schedule-schema-resolver/51-RESEARCH.md

# Resolver + model + broadcast prior art (must read before editing)
@backend/app/services/signage_resolver.py
@backend/app/services/signage_broadcast.py
@backend/app/models/signage.py
@backend/app/models/_base.py
@backend/app/schemas/signage.py
@backend/tests/test_signage_resolver.py
@backend/alembic/versions/v1_16_signage_schema.py
@backend/alembic/versions/v1_16_signage_devices_etag.py
@backend/requirements.txt
@backend/Dockerfile

<interfaces>
<!-- Existing contracts the new resolver must honor (extracted from codebase) -->

From backend/app/services/signage_resolver.py (Phase 43 SGN-BE-06):
```python
# Pure-read (D-10). Existing signature MUST stay intact — 8+ callsites depend on it.
async def resolve_playlist_for_device(
    db: AsyncSession,
    device: SignageDevice,
) -> PlaylistEnvelope: ...

def compute_playlist_etag(envelope: PlaylistEnvelope) -> str: ...

async def devices_affected_by_playlist(
    db: AsyncSession,
    playlist_id: uuid.UUID,
) -> list[uuid.UUID]: ...

# PlaylistEnvelope is the stable shape returned by both schedule-matched and tag-matched paths.
```

From backend/app/models/_base.py:
```python
class AppSettings(Base):
    __tablename__ = "app_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    # ... existing columns ...
    # NEW (this plan): timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default="Europe/Berlin")
```

From backend/app/models/signage.py (SignagePlaylist mirror pattern):
```python
class SignagePlaylist(Base):
    __tablename__ = "signage_playlists"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                          server_default=func.gen_random_uuid())
    # ... etc ...
```

Migration head (down_revision target for new migration):
- Latest signage migration: `v1_16_signage_devices_etag` (confirmed via `ls backend/alembic/versions/`)
- New migration: `v1_18_signage_schedules` with `down_revision = "v1_16_signage_devices_etag"`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: tzdata dep + Alembic migration + AppSettings timezone column</name>
  <files>backend/requirements.txt, backend/alembic/versions/v1_18_signage_schedules.py, backend/app/models/_base.py, backend/tests/test_signage_schema_roundtrip.py</files>
  <read_first>
    - backend/requirements.txt (confirm tzdata is absent)
    - backend/Dockerfile (confirm python:3.11-slim with no apt tzdata install)
    - backend/alembic/versions/v1_16_signage_schema.py (table-create pattern + down_revision chain)
    - backend/alembic/versions/v1_16_signage_devices_etag.py (column-add pattern + revision id format)
    - backend/app/models/_base.py (AppSettings singleton; existing column style)
    - backend/tests/test_signage_schema_roundtrip.py (round-trip test pattern from Phase 41-05)
    - .planning/phases/51-schedule-schema-resolver/51-RESEARCH.md (Pitfall 1 tzdata; Pitfall 6 NOT NULL DEFAULT)
  </read_first>
  <behavior>
    - tzdata pip pkg present in requirements → `python -c "import zoneinfo; zoneinfo.ZoneInfo('Europe/Berlin')"` succeeds in container
    - `alembic upgrade head` creates `signage_schedules` with all 4 CHECK constraints (weekday_mask 0..127, start_hhmm 0..2359, end_hhmm 0..2359, start_hhmm < end_hhmm) and partial index `ix_signage_schedules_enabled_weekday`
    - `alembic upgrade head` adds `app_settings.timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'`; existing singleton row auto-backfilled by server default
    - `alembic downgrade -1` cleanly drops the index, table, and column (round-trip clean)
    - Round-trip test extends test_signage_schema_roundtrip.py to insert a SignageSchedule row, read it back, assert all fields match (mirrors Plan 41-05 pattern)
    - CHECK violation: inserting `start_hhmm=2400` is rejected by Postgres (errcode 23514)
    - CHECK violation: inserting `start_hhmm=1100, end_hhmm=1100` is rejected (no zero-width windows)
    - Inserting `start_hhmm=2200, end_hhmm=200` is rejected (no midnight-spanning per D-07)
  </behavior>
  <action>
    1. **Add tzdata to requirements.txt** — append a single line `tzdata>=2024.1` (per RESEARCH §Standard Stack: `python:3.11-slim` lacks system tzdata; without this `zoneinfo.ZoneInfo("Europe/Berlin")` raises `ZoneInfoNotFoundError` in the container — Pitfall 1).

    2. **Add `timezone` column to `AppSettings` model** in `backend/app/models/_base.py`:
    ```python
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default="Europe/Berlin")
    ```
    Add `String` to the existing `from sqlalchemy import ...` line if not already present.

    3. **Create migration** `backend/alembic/versions/v1_18_signage_schedules.py`:
    ```python
    """v1_18 signage_schedules + app_settings.timezone

    Revision ID: v1_18_signage_schedules
    Revises: v1_16_signage_devices_etag
    Create Date: 2026-04-21
    """
    from __future__ import annotations
    import sqlalchemy as sa
    from alembic import op
    from sqlalchemy.dialects import postgresql

    revision: str = "v1_18_signage_schedules"
    down_revision: str | None = "v1_16_signage_devices_etag"
    branch_labels = None
    depends_on = None

    def upgrade() -> None:
        # 1. Add timezone column to app_settings (server default backfills singleton row — Pitfall 6)
        op.add_column(
            "app_settings",
            sa.Column("timezone", sa.String(64), nullable=False, server_default="Europe/Berlin"),
        )

        # 2. Create signage_schedules table
        op.create_table(
            "signage_schedules",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column("playlist_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("signage_playlists.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("weekday_mask", sa.SmallInteger, nullable=False),
            sa.Column("start_hhmm", sa.Integer, nullable=False),
            sa.Column("end_hhmm", sa.Integer, nullable=False),
            sa.Column("priority", sa.Integer, nullable=False, server_default=sa.text("0")),
            sa.Column("enabled", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.CheckConstraint("weekday_mask BETWEEN 0 AND 127", name="ck_signage_schedules_weekday_mask"),
            sa.CheckConstraint("start_hhmm >= 0 AND start_hhmm <= 2359", name="ck_signage_schedules_start_hhmm"),
            sa.CheckConstraint("end_hhmm >= 0 AND end_hhmm <= 2359", name="ck_signage_schedules_end_hhmm"),
            sa.CheckConstraint("start_hhmm < end_hhmm", name="ck_signage_schedules_no_midnight_span"),
        )
        # 3. Partial index on hot-path filter (enabled=true)
        op.create_index(
            "ix_signage_schedules_enabled_weekday",
            "signage_schedules",
            ["weekday_mask"],
            postgresql_where=sa.text("enabled = true"),
        )

    def downgrade() -> None:
        op.drop_index("ix_signage_schedules_enabled_weekday", table_name="signage_schedules")
        op.drop_table("signage_schedules")
        op.drop_column("app_settings", "timezone")
    ```

    4. **Extend round-trip test** in `backend/tests/test_signage_schema_roundtrip.py` — add a new function `test_signage_schedules_roundtrip(dsn)` that:
       - Inserts a playlist row (use existing helper or inline asyncpg INSERT)
       - Inserts a `signage_schedules` row with weekday_mask=31, start_hhmm=700, end_hhmm=1100, priority=10, enabled=true
       - Reads it back; asserts all 8 columns match
       - Asserts FK violation when playlist_id doesn't exist
       - Asserts CHECK violation for start_hhmm=2400 (errcode 23514)
       - Asserts CHECK violation for start_hhmm=1100, end_hhmm=1100 (zero-width)
       - Asserts CHECK violation for start_hhmm=2200, end_hhmm=200 (midnight-span)

    5. Rebuild backend container so tzdata is installed: the executor MUST run `docker compose build --no-cache backend` before any resolver test that uses zoneinfo (otherwise pre-existing image has no tzdata).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; docker compose run --rm migrate alembic upgrade head &amp;&amp; docker compose run --rm migrate alembic downgrade -1 &amp;&amp; docker compose run --rm migrate alembic upgrade head &amp;&amp; docker compose run --rm api pytest tests/test_signage_schema_roundtrip.py -x</automated>
  </verify>
  <done>
    - `grep -c "^tzdata" backend/requirements.txt` returns 1
    - `grep -c "timezone:.*String(64)" backend/app/models/_base.py` returns 1
    - `grep -c "v1_18_signage_schedules" backend/alembic/versions/v1_18_signage_schedules.py` returns ≥ 1
    - `grep -c "ck_signage_schedules_no_midnight_span" backend/alembic/versions/v1_18_signage_schedules.py` returns 1
    - `alembic upgrade head` then `alembic downgrade -1` then `alembic upgrade head` all exit 0
    - `pytest backend/tests/test_signage_schema_roundtrip.py -x` passes including new schedule round-trip case
    - `python -c "import zoneinfo; zoneinfo.ZoneInfo('Europe/Berlin')"` exits 0 inside the rebuilt backend container
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: _hhmm.py helpers + SignageSchedule model + Pydantic schemas</name>
  <files>backend/app/services/_hhmm.py, backend/app/models/signage.py, backend/app/schemas/signage.py</files>
  <read_first>
    - backend/app/models/signage.py (SignagePlaylist class style; existing imports — confirm SmallInteger is NOT yet imported per RESEARCH Pitfall 7)
    - backend/app/schemas/signage.py (existing PlaylistRead/Create/Update Pydantic v2 style; field validators)
    - .planning/phases/51-schedule-schema-resolver/51-CONTEXT.md (D-04 helper signatures; D-05 weekday bit ordering)
    - .planning/phases/51-schedule-schema-resolver/51-RESEARCH.md (Pattern 1 SignageSchedule code; Pattern 2 _hhmm.py code; Pitfall 2 weekday(); Pitfall 3 hhmm validation; Pitfall 7 SmallInteger import)
  </read_first>
  <behavior>
    - `hhmm_to_time(730) == datetime.time(7, 30)` and `hhmm_to_time(1430) == datetime.time(14, 30)` and `hhmm_to_time(0) == datetime.time(0, 0)`
    - `time_to_hhmm(datetime.time(14, 30)) == 1430` and `time_to_hhmm(datetime.time(0, 0)) == 0`
    - `hhmm_to_time(1299)` raises `ValueError` (minute > 59) — guards against in-range CHECK that lets through invalid times (Pitfall 3)
    - `now_hhmm_in_tz('Europe/Berlin')` returns `(int, int)` tuple where weekday is in `range(0, 7)` (0=Mon per D-05) and hhmm is in `range(0, 2360)`
    - `SignageSchedule` SQLAlchemy model importable; `SignageSchedule.__tablename__ == "signage_schedules"`
    - `ScheduleCreate(playlist_id=uuid4(), weekday_mask=31, start_hhmm=700, end_hhmm=1100)` validates; `weekday_mask=128` rejected; `start_hhmm=1100, end_hhmm=1100` rejected; `start_hhmm=1299` rejected via hhmm_to_time round-trip
    - `ScheduleRead.model_validate(orm_schedule)` returns shape `{id, playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled, created_at, updated_at}`
  </behavior>
  <action>
    1. **Create `backend/app/services/_hhmm.py`** verbatim per RESEARCH Pattern 2 (use `date.weekday()` per D-05/Pitfall 2):
    ```python
    """HHMM packed-integer helpers and timezone-aware now extraction.

    Centralizes all timezone handling (D-04). Resolver core stays integer-only.
    Bit ordering: 0=Mon..6=Sun (D-05). Uses date.weekday() (returns 0..6 Mon..Sun)
    NOT date.isoweekday() (1..7) — Pitfall 2.
    """
    from __future__ import annotations
    import datetime
    import zoneinfo

    def hhmm_to_time(i: int) -> datetime.time:
        """Convert packed HHMM int (e.g., 730 → 07:30) to datetime.time. Raises ValueError on minute > 59."""
        return datetime.time(hour=i // 100, minute=i % 100)

    def time_to_hhmm(t: datetime.time) -> int:
        return t.hour * 100 + t.minute

    def now_hhmm_in_tz(tz_name: str) -> tuple[int, int]:
        """Return (weekday, hhmm). weekday: 0=Mon..6=Sun. Called once per resolve."""
        now = datetime.datetime.now(zoneinfo.ZoneInfo(tz_name))
        return now.weekday(), time_to_hhmm(now.time())
    ```

    2. **Add `SignageSchedule` to `backend/app/models/signage.py`** — append after the last existing model, mirroring `SignagePlaylist` style:
    ```python
    # NOTE: per RESEARCH Pitfall 7, add SmallInteger to the existing
    # `from sqlalchemy import ...` import line at the top of the file.

    class SignageSchedule(Base):
        __tablename__ = "signage_schedules"
        __table_args__ = (
            CheckConstraint("weekday_mask BETWEEN 0 AND 127", name="ck_signage_schedules_weekday_mask"),
            CheckConstraint("start_hhmm >= 0 AND start_hhmm <= 2359", name="ck_signage_schedules_start_hhmm"),
            CheckConstraint("end_hhmm >= 0 AND end_hhmm <= 2359", name="ck_signage_schedules_end_hhmm"),
            CheckConstraint("start_hhmm < end_hhmm", name="ck_signage_schedules_no_midnight_span"),
        )

        id: Mapped[uuid.UUID] = mapped_column(
            UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
        )
        playlist_id: Mapped[uuid.UUID] = mapped_column(
            UUID(as_uuid=True),
            ForeignKey("signage_playlists.id", ondelete="RESTRICT"),
            nullable=False,
        )
        weekday_mask: Mapped[int] = mapped_column(SmallInteger, nullable=False)
        start_hhmm: Mapped[int] = mapped_column(Integer, nullable=False)
        end_hhmm: Mapped[int] = mapped_column(Integer, nullable=False)
        priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
        enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False, server_default=func.now()
        )
        updated_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
        )
    ```

    3. **Add Pydantic v2 schemas to `backend/app/schemas/signage.py`** — three classes mirroring the existing Playlist trio:
    ```python
    from app.services._hhmm import hhmm_to_time  # for validator round-trip

    class ScheduleBase(BaseModel):
        playlist_id: uuid.UUID
        weekday_mask: int = Field(..., ge=0, le=127)
        start_hhmm: int = Field(..., ge=0, le=2359)
        end_hhmm: int = Field(..., ge=0, le=2359)
        priority: int = 0
        enabled: bool = True

        @field_validator("start_hhmm", "end_hhmm")
        @classmethod
        def _validate_hhmm(cls, v: int) -> int:
            # Catches in-range-but-invalid values like 1299 (minute > 59) — Pitfall 3
            hhmm_to_time(v)
            return v

        @model_validator(mode="after")
        def _start_lt_end(self):
            if self.start_hhmm >= self.end_hhmm:
                raise ValueError("start_hhmm must be less than end_hhmm (no midnight-spanning rows in v1.18)")
            return self

    class ScheduleCreate(ScheduleBase): pass

    class ScheduleUpdate(BaseModel):
        playlist_id: uuid.UUID | None = None
        weekday_mask: int | None = Field(None, ge=0, le=127)
        start_hhmm: int | None = Field(None, ge=0, le=2359)
        end_hhmm: int | None = Field(None, ge=0, le=2359)
        priority: int | None = None
        enabled: bool | None = None
        # Note: cross-field start<end validation lives in router (only when both fields present after merge)

    class ScheduleRead(ScheduleBase):
        id: uuid.UUID
        created_at: datetime
        updated_at: datetime
        model_config = ConfigDict(from_attributes=True)
    ```

    Add a small unit test file `backend/tests/test_signage_hhmm.py` (or append to an existing schema test) that asserts the 6 behaviors above. Use plain pytest (no DB) — these are pure-Python helpers.
  </action>
  <verify>
    <automated>cd backend &amp;&amp; pytest tests/test_signage_hhmm.py -x &amp;&amp; python -c "from app.services._hhmm import hhmm_to_time, time_to_hhmm, now_hhmm_in_tz; assert hhmm_to_time(730).hour==7; assert time_to_hhmm(__import__('datetime').time(14,30))==1430; w,h=now_hhmm_in_tz('Europe/Berlin'); assert 0&lt;=w&lt;=6 and 0&lt;=h&lt;=2359" &amp;&amp; python -c "from app.models.signage import SignageSchedule; assert SignageSchedule.__tablename__=='signage_schedules'" &amp;&amp; python -c "from app.schemas.signage import ScheduleCreate, ScheduleRead, ScheduleUpdate; import uuid; ScheduleCreate(playlist_id=uuid.uuid4(), weekday_mask=31, start_hhmm=700, end_hhmm=1100)"</automated>
  </verify>
  <done>
    - `grep -c "def hhmm_to_time\|def time_to_hhmm\|def now_hhmm_in_tz" backend/app/services/_hhmm.py` returns 3
    - `grep -c "class SignageSchedule" backend/app/models/signage.py` returns 1
    - `grep -c "SmallInteger" backend/app/models/signage.py` returns ≥ 1 (import + usage)
    - `grep -c "class ScheduleCreate\|class ScheduleRead\|class ScheduleUpdate" backend/app/schemas/signage.py` returns 3
    - `grep -c "ck_signage_schedules_no_midnight_span" backend/app/models/signage.py` returns 1
    - `pytest backend/tests/test_signage_hhmm.py -x` passes
    - All Python imports above succeed
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: resolve_schedule_for_device + composition wrapper + 7 SGN-TIME-03 integration tests</name>
  <files>backend/app/services/signage_resolver.py, backend/tests/test_signage_schedule_resolver.py</files>
  <read_first>
    - backend/app/services/signage_resolver.py (resolve_playlist_for_device implementation; envelope build; selectinload usage; D-06/D-07/D-08/D-09/D-10 invariants)
    - backend/tests/test_signage_resolver.py (asyncpg seeding helpers _insert_playlist, _insert_tag, _tag_playlist, _tag_device, _insert_device, _load_device, AsyncSessionLocal usage)
    - backend/app/services/_hhmm.py (helpers from Task 2)
    - backend/app/models/signage.py (SignageSchedule from Task 2; SignagePlaylistTagMap, SignageDeviceTagMap)
    - backend/app/models/_base.py (AppSettings.timezone column from Task 1)
    - .planning/phases/51-schedule-schema-resolver/51-RESEARCH.md (Pattern 3 resolver composition; Code Examples §SGN-TIME-03 worked example; Pitfall 5 explicit `now=`)
    - .planning/phases/51-schedule-schema-resolver/51-CONTEXT.md (D-03 composition; D-05 weekday mask check `(weekday_mask >> weekday) &amp; 1`)
  </read_first>
  <behavior>
    - **TC1 schedule-match (single):** One enabled schedule Mo-Fr 07:00-11:00 priority 5 → playlist X tagged "lobby"; device tagged "lobby"; `now=Wed 08:30 Europe/Berlin` → returns envelope with `playlist_id == X.id`
    - **TC2 priority tiebreak:** Two overlapping enabled schedules at Wed 12:00 — playlist Y priority 10 vs playlist Z priority 5 → returns Y (priority DESC). If priorities equal, more-recently-updated wins (updated_at DESC).
    - **TC3 weekday-miss:** Schedule Mo-Fr (mask=31); `now=Sat 09:00` → returns None
    - **TC4 time-miss:** Schedule 07:00-11:00; `now=Wed 06:59` → None; `now=Wed 11:00` → None (end is exclusive); `now=Wed 07:00` → matches (start is inclusive)
    - **TC5 disabled-schedule-skip:** Schedule with `enabled=false` covering now → returns None
    - **TC6 tag-mismatch-skip:** Schedule's playlist tagged "kitchen"; device tagged only "lobby" → returns None
    - **TC7 empty-schedules-falls-back-to-tag-resolver:** No schedules at all OR no matches → `resolve_playlist_for_device` (the wrapper) returns the tag-based envelope, identical to pre-Phase-51 behaviour
    - **Worked-example end-to-end:** REQUIREMENTS #3 — Mo-Fr 07-11 X (pri 10), Mo-So 11-14 Y (pri 5); device tagged for both: Wed 08:30 → X, Wed 12:00 → Y, Wed 15:00 → tag-fallback envelope (None from `resolve_schedule_for_device`)
    - **Resolver remains pure-read (D-10):** No writes to device or schedule rows during resolve
    - **All 8+ existing callsites unchanged:** `grep -c "resolve_playlist_for_device" backend/app/` returns same count as before this plan plus the new internal call
  </behavior>
  <action>
    1. **Add `resolve_schedule_for_device` to `backend/app/services/signage_resolver.py`** — new top-level async function:
    ```python
    from datetime import datetime
    from sqlalchemy import select, and_, or_
    from app.services._hhmm import now_hhmm_in_tz, time_to_hhmm
    from app.models._base import AppSettings
    from app.models.signage import SignageSchedule, SignagePlaylist, SignagePlaylistTagMap, SignageDeviceTagMap

    async def resolve_schedule_for_device(
        db: AsyncSession,
        device: SignageDevice,
        *,
        now: datetime | None = None,
    ) -> PlaylistEnvelope | None:
        """Return best-matching schedule envelope, or None if no schedule matches.

        Pure-read (D-10). Tests pass explicit now= for determinism (Pitfall 5).
        Composition: caller (`resolve_playlist_for_device`) falls back to tag-based
        resolution when this returns None (D-03).
        """
        # 1. Load app_settings.timezone (singleton row id=1)
        settings = (await db.execute(select(AppSettings).where(AppSettings.id == 1))).scalar_one()
        tz_name = settings.timezone

        # 2. Compute (weekday, hhmm) once — all timezone handling centralized here
        if now is None:
            weekday, hhmm = now_hhmm_in_tz(tz_name)
        else:
            # Convert provided now to the configured tz, then extract weekday/hhmm
            import zoneinfo
            now_in_tz = now.astimezone(zoneinfo.ZoneInfo(tz_name))
            weekday, hhmm = now_in_tz.weekday(), time_to_hhmm(now_in_tz.time())

        # 3. Load device tag_ids (reuse existing pattern from tag-based branch)
        device_tag_rows = (await db.execute(
            select(SignageDeviceTagMap.tag_id).where(SignageDeviceTagMap.device_id == device.id)
        )).scalars().all()
        if not device_tag_rows:
            return None  # device has no tags → no schedule can match
        device_tag_ids = list(device_tag_rows)

        # 4. Single SQL query: schedules + playlist + playlist_tag_map; weekday + window + tag overlap
        # Bit-test: (weekday_mask >> :weekday) &amp; 1 = 1
        stmt = (
            select(SignageSchedule)
            .join(SignagePlaylist, SignagePlaylist.id == SignageSchedule.playlist_id)
            .join(SignagePlaylistTagMap, SignagePlaylistTagMap.playlist_id == SignagePlaylist.id)
            .where(SignageSchedule.enabled.is_(True))
            .where(text(f"(weekday_mask >> {weekday}) &amp; 1 = 1"))
            .where(SignageSchedule.start_hhmm <= hhmm)
            .where(SignageSchedule.end_hhmm > hhmm)
            .where(SignagePlaylistTagMap.tag_id.in_(device_tag_ids))
            .order_by(SignageSchedule.priority.desc(), SignageSchedule.updated_at.desc())
            .limit(1)
        )
        # Use bindparam for safety on weekday (small int 0..6, but still parameterize)
        # NOTE: rewrite the text() above to use SQLAlchemy bind: e.g., bindparams
        # See implementation guide; do not concatenate user-controlled values.

        result = (await db.execute(stmt)).scalar_one_or_none()
        if result is None:
            return None

        # 5. Build envelope identical to tag-resolver path — REUSE existing helper
        # The existing tag-based branch builds an envelope from a SignagePlaylist; extract that
        # builder into a private `_build_envelope_for_playlist(db, playlist_id)` helper if not
        # already factored out, and call it here so both paths produce identical shapes.
        return await _build_envelope_for_playlist(db, result.playlist_id)
    ```

    Refactor the existing `resolve_playlist_for_device` to extract the envelope-building portion into a private `_build_envelope_for_playlist(db, playlist_id) -> PlaylistEnvelope` helper, then call it from BOTH paths so envelope shape is byte-identical (preserves D-08 etag invariant).

    2. **Modify `resolve_playlist_for_device`** (D-03 composition — surgical 3-line addition at the top):
    ```python
    async def resolve_playlist_for_device(
        db: AsyncSession, device: SignageDevice
    ) -> PlaylistEnvelope:
        # NEW (Phase 51 D-03): time-aware schedule takes precedence
        scheduled = await resolve_schedule_for_device(db, device)
        if scheduled is not None:
            return scheduled
        # EXISTING tag-based branch below — unchanged
        ...
    ```

    3. **Create `backend/tests/test_signage_schedule_resolver.py`** with 7+1 test cases. Mirror the asyncpg seeding pattern from `test_signage_resolver.py`. Add `_insert_schedule(dsn, *, playlist_id, weekday_mask, start_hhmm, end_hhmm, priority=0, enabled=True)` helper per RESEARCH Code Examples §Integration test seeding helper.

    Required test functions (each `@pytest.mark.asyncio`):
    - `test_schedule_single_match` — TC1
    - `test_schedule_priority_tiebreak` — TC2 (also include updated_at-tiebreak sub-case)
    - `test_schedule_weekday_miss` — TC3
    - `test_schedule_time_miss` — TC4 (test 06:59, 07:00, 11:00 boundary)
    - `test_schedule_disabled_skip` — TC5
    - `test_schedule_tag_mismatch_skip` — TC6
    - `test_empty_schedules_fallback_to_tag_resolver` — TC7 (calls `resolve_playlist_for_device`, NOT `resolve_schedule_for_device`)
    - `test_schedule_worked_example_REQ3` — REQUIREMENTS.md §3 north-star (Wed 08:30→X, 12:00→Y, 15:00→tag fallback)

    Each test passes explicit `now=datetime(2026, 4, 22, H, M, tzinfo=zoneinfo.ZoneInfo("Europe/Berlin"))` (2026-04-22 is a Wednesday). Pitfall 5: never rely on the real clock.

    Pure-read assertion: each test re-loads the device row after the resolve call and asserts no fields changed (D-10).
  </action>
  <verify>
    <automated>cd backend &amp;&amp; pytest tests/test_signage_schedule_resolver.py -x -v &amp;&amp; pytest tests/test_signage_resolver.py -x</automated>
  </verify>
  <done>
    - `grep -c "async def resolve_schedule_for_device" backend/app/services/signage_resolver.py` returns 1
    - `grep -c "scheduled = await resolve_schedule_for_device" backend/app/services/signage_resolver.py` returns 1
    - `grep -c "(weekday_mask >> " backend/app/services/signage_resolver.py` returns ≥ 1
    - SQL parameterization enforced (no f-string in text()): `grep -c 'f"(weekday_mask' backend/app/services/signage_resolver.py` returns 0 (use SQLAlchemy bindparams instead — Task 3 action step 1 NOTE)
    - `grep -cE "def test_schedule_(single_match|priority_tiebreak|weekday_miss|time_miss|disabled_skip|tag_mismatch_skip)|def test_empty_schedules_fallback_to_tag_resolver|def test_schedule_worked_example_REQ3" backend/tests/test_signage_schedule_resolver.py` returns 8
    - `pytest backend/tests/test_signage_schedule_resolver.py -x` passes all 8 tests
    - `pytest backend/tests/test_signage_resolver.py -x` still passes (no regression on tag-based path)
    - `pytest backend/tests/ -k signage -x` all green
    - No `import sqlite3` or `import psycopg2` introduced (CI grep guard)
  </done>
</task>

</tasks>

<verification>
- Migration round-trip: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` exits 0
- tzdata available in container: `docker compose run --rm api python -c "import zoneinfo; zoneinfo.ZoneInfo('Europe/Berlin')"` exits 0
- Resolver tests: `pytest backend/tests/test_signage_schedule_resolver.py -x` passes 8 cases
- Schema round-trip test: `pytest backend/tests/test_signage_schema_roundtrip.py -x` passes
- Existing resolver test: `pytest backend/tests/test_signage_resolver.py -x` still passes (tag-based fallback intact)
- Full signage test suite: `pytest backend/tests/ -k signage -x` green
- Pure-read invariant (D-10): grep `backend/app/services/signage_resolver.py` for `db.commit\|db.add\|db.delete` returns 0
- All 8+ callsites of `resolve_playlist_for_device` unchanged: signature `(db: AsyncSession, device: SignageDevice) -> PlaylistEnvelope` preserved
</verification>

<success_criteria>
- SGN-TIME-01 ✅: Migration creates `signage_schedules` with all CHECK constraints; `app_settings.timezone` added; round-trip clean
- SGN-TIME-02 ✅: `resolve_schedule_for_device` matches on weekday + window + enabled + tag overlap; sorts by `priority DESC, updated_at DESC LIMIT 1`; falls through to tag resolver via `resolve_playlist_for_device` wrapper
- SGN-TIME-03 ✅: All 7 named test cases plus the REQUIREMENTS.md §3 worked-example green
- tzdata pip dep present: container can call `zoneinfo.ZoneInfo('Europe/Berlin')` without `ZoneInfoNotFoundError`
</success_criteria>

<output>
After completion, create `.planning/phases/51-schedule-schema-resolver/51-01-SUMMARY.md` documenting:
- Migration revision id
- Index strategy chosen (partial on enabled=true confirmed)
- Whether envelope-builder helper was extracted (yes/no + rationale)
- Any deviations from RESEARCH.md (e.g., chose multi-query over single-JOIN)
- Open follow-ups for Plan 51-02 (admin router will fan out SSE; playlist DELETE 409 handler)
</output>
