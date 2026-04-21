# Phase 51: Schedule Schema + Resolver — Research

**Researched:** 2026-04-21
**Domain:** PostgreSQL schema migration + SQLAlchemy async resolver + zoneinfo + SSE fanout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Timezone source — `app_settings.timezone` column**
Add `timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'` to `app_settings` in the same Alembic migration that creates `signage_schedules`. Resolver reads it via direct `select(AppSettings).where(AppSettings.id == 1)`. Pydantic layer validates the string via `zoneinfo.ZoneInfo(...)`. An unresolvable timezone is a hard 500.

**D-02: Schedule-mutation SSE fanout — broad via `devices_affected_by_playlist`**
On schedule create/update/delete, call `devices_affected_by_playlist(db, schedule.playlist_id)` and fire `notify_device(device_id, {"event": "schedule-changed", "schedule_id": ..., "playlist_id": ...})` for each affected device. New event kind `schedule-changed` (distinct from `playlist-changed`).

**D-03: Resolver composition — wrap inside `resolve_playlist_for_device`**
Add `resolve_schedule_for_device(db, device, *, now=None) -> Optional[PlaylistEnvelope]` as a new top-level service function. Modify `resolve_playlist_for_device` to call it first; if it returns non-`None`, return that; otherwise fall through to existing tag-based branch unchanged. All 8+ existing callsites of `resolve_playlist_for_device` remain untouched.

**D-04: Time representation — int canonical + `_hhmm.py` helpers**
Create `backend/app/services/_hhmm.py` with `hhmm_to_time`, `time_to_hhmm`, `now_hhmm_in_tz` helpers. DB columns stay `INTEGER`. Resolver time-window check is pure integer: `start_hhmm <= now_hhmm < end_hhmm`. Datetime objects only appear at the Pydantic boundary.

**D-05: Weekday mask bit ordering**
Bit 0 = Monday, bit 6 = Sunday. Check: `(weekday_mask >> weekday) & 1`. Use `date.weekday()` (0=Mon..6=Sun) on the Python side.

**D-06: Alembic migration scope**
Single migration file: creates `signage_schedules`, adds `timezone` to `app_settings`. Round-trip upgrade/downgrade clean.

**D-07: No midnight-spanning windows**
`CHECK (start_hhmm < end_hhmm)` enforced at DB level. No application-level handling.

### Claude's Discretion

- Exact index strategy on `signage_schedules` (composite vs single-column; partial index on `WHERE enabled = true`).
- Whether `resolve_schedule_for_device` uses a single SQL query or multiple round-trips — single query with `priority DESC, updated_at DESC LIMIT 1` is the natural fit.
- Test file organization — follow existing `tests/` flat layout (no `tests/services/signage/` subdirectory currently exists).
- Whether to backfill `app_settings.timezone` via `op.execute()` before adding NOT NULL constraint.

### Deferred Ideas (OUT OF SCOPE)

- Per-device timezone override
- Midnight-spanning single-row schedules
- iCal RRULE / date-specific overrides (holidays, one-off events)
- Schedule "preview" (resolve-as-of-time) admin endpoint
- Timezone column admin-UI surface (Phase 52 or later)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-TIME-01 | Alembic migration creates `signage_schedules` with `id UUID PK`, `playlist_id UUID FK RESTRICT`, `weekday_mask SMALLINT CHECK (0..127)`, `start_hhmm INTEGER CHECK (0..2359)`, `end_hhmm INTEGER CHECK (0..2359)`, `priority INTEGER DEFAULT 0`, `enabled BOOLEAN DEFAULT true`, `created_at`, `updated_at`; CHECK `start_hhmm < end_hhmm`; also adds `timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'` to `app_settings`; round-trip upgrade/downgrade clean | Alembic migration pattern confirmed from `v1_16_signage_devices_etag.py`; column-addition + table-creation in one revision works |
| SGN-TIME-02 | Resolver gains time-window awareness: match weekday_mask, start_hhmm ≤ now.hhmm < end_hhmm, enabled=true, playlist tag_ids overlap device tag set; pick highest `(priority DESC, updated_at DESC)`; fall back to existing tag-based resolution if no match; pure-read (D-10); timezone from `app_settings.timezone` | `resolve_playlist_for_device` source confirmed; composition pattern clear; `zoneinfo` stdlib confirmed; tzdata pip package REQUIRED (see Environment Availability) |
| SGN-TIME-03 | Resolver integration tests: 7 cases — schedule-match (single), priority tiebreak, weekday-miss, time-miss, disabled-schedule-skip, tag-mismatch-skip, empty-schedules-falls-back-to-tag-resolver | Test pattern confirmed from `test_signage_resolver.py`; same asyncpg seeding + AsyncSession pattern applies |
| SGN-TIME-04 | Schedule mutations fire `notify_device` SSE fanout; players re-resolve within ≤ 2 s | `notify_device` + `devices_affected_by_playlist` confirmed in `signage_broadcast.py` and `playlists.py`; `schedules.py` router follows same pattern |
</phase_requirements>

---

## Summary

Phase 51 is a backend-only extension across four distinct layers: (1) a single Alembic migration adding the `signage_schedules` table and `app_settings.timezone` column, (2) a `_hhmm.py` helper module for integer-packed time math, (3) a new `resolve_schedule_for_device` service function composed into the existing `resolve_playlist_for_device` via a non-breaking wrapper, and (4) a new `schedules.py` admin router that reuses the post-commit SSE fanout pattern already established in `playlists.py`.

The existing codebase is well-prepared for this extension. The resolver is pure-read, the broadcast substrate is in-process asyncio queues firing post-commit, and the tag-overlap fanout helper (`devices_affected_by_playlist`) already exists. The `AppSettings` singleton pattern for fetching a single config row is well-established across multiple service modules. Test patterns for resolver integration tests (asyncpg seeding + `AsyncSessionLocal`) are mature and reusable.

One critical environment issue was discovered: `python:3.11-slim` does NOT include system timezone data, and `zoneinfo` will raise `ZoneInfoNotFoundError` at runtime without it. The `tzdata` pip package must be added to `requirements.txt` before any `zoneinfo.ZoneInfo("Europe/Berlin")` call can succeed in the Docker container.

**Primary recommendation:** Decompose into two plans: (1) migration + `_hhmm.py` helpers + `SignageSchedule` model + Pydantic schemas + `resolve_schedule_for_device` + resolver composition + `tzdata` dep, (2) `schedules.py` admin router + integration tests covering all 7 SGN-TIME-03 cases.

---

## Standard Stack

### Core (all already in requirements.txt)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.49 | ORM model + async query | Existing pattern; `SignageSchedule` model mirrors `SignagePlaylist` style |
| asyncpg | 0.31.0 | Async PG driver | Required by existing async engine |
| Alembic | 1.18.4 | Migration | Existing migration chain |
| FastAPI | 0.135.3 | Admin router | Existing admin router pattern |

### New Dependency (must be added)

| Library | Version | Purpose | Why Required |
|---------|---------|---------|--------------|
| tzdata | >=2024.1 | IANA timezone database for `zoneinfo` | `python:3.11-slim` has no system tzdata; `zoneinfo.ZoneInfo("Europe/Berlin")` raises `ZoneInfoNotFoundError` at runtime without it |

**Installation:**
```bash
# Add to backend/requirements.txt
tzdata>=2024.1
```

**Confidence:** HIGH — this is a well-known slim-image pitfall. The `tzdata` pip package is the standard fix documented by the Python packaging authority. Confirmed: current `requirements.txt` does not include it; Dockerfile does not install system tzdata via apt.

---

## Architecture Patterns

### New Files

```
backend/app/services/_hhmm.py          # HHMM integer helpers (D-04)
backend/app/models/signage.py          # +SignageSchedule class (extend existing)
backend/app/schemas/signage.py         # +ScheduleCreate/Read/Update (extend existing)
backend/app/services/signage_resolver.py  # +resolve_schedule_for_device; wrap resolve_playlist_for_device
backend/app/routers/signage_admin/schedules.py  # new CRUD router
backend/app/routers/signage_admin/__init__.py   # register schedules router
backend/alembic/versions/v1_18_signage_schedules.py  # single migration
backend/tests/test_signage_schedule_resolver.py  # 7 resolver integration test cases
backend/tests/test_signage_schedule_router.py   # router + SSE fanout smoke tests
```

### Pattern 1: SQLAlchemy Model — `SignageSchedule`

Mirror `SignagePlaylist` style exactly. Use `SMALLINT` for `weekday_mask` (matches `CHECK (weekday_mask BETWEEN 0 AND 127)`). Use `INTEGER` for `start_hhmm`/`end_hhmm`. Use `text("0")` server defaults. Include `created_at`/`updated_at` with `server_default=func.now()`.

```python
# Source: backend/app/models/signage.py — SignagePlaylist pattern
class SignageSchedule(Base):
    __tablename__ = "signage_schedules"
    __table_args__ = (
        CheckConstraint("weekday_mask BETWEEN 0 AND 127", name="ck_signage_schedules_weekday_mask"),
        CheckConstraint("start_hhmm >= 0 AND start_hhmm <= 2359", name="ck_signage_schedules_start_hhmm"),
        CheckConstraint("end_hhmm >= 0 AND end_hhmm <= 2359", name="ck_signage_schedules_end_hhmm"),
        CheckConstraint("start_hhmm < end_hhmm", name="ck_signage_schedules_no_midnight_span"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    playlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signage_playlists.id", ondelete="RESTRICT"), nullable=False)
    weekday_mask: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_hhmm: Mapped[int] = mapped_column(Integer, nullable=False)
    end_hhmm: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

Note: SQLAlchemy's `SmallInteger` type maps to PostgreSQL `SMALLINT`. Import from `sqlalchemy`.

### Pattern 2: `_hhmm.py` helpers (D-04)

```python
# backend/app/services/_hhmm.py
from __future__ import annotations
import datetime
import zoneinfo

def hhmm_to_time(i: int) -> datetime.time:
    """Convert packed HHMM integer (e.g., 730 → 07:30, 1430 → 14:30) to datetime.time."""
    return datetime.time(hour=i // 100, minute=i % 100)

def time_to_hhmm(t: datetime.time) -> int:
    """Convert datetime.time to packed HHMM integer."""
    return t.hour * 100 + t.minute

def now_hhmm_in_tz(tz_name: str) -> tuple[int, int]:
    """Return (weekday, hhmm) where weekday is 0=Mon..6=Sun and hhmm is packed int.

    Called once per resolve; all timezone handling is centralized here.
    Uses date.weekday() which returns 0=Mon..6=Sun matching D-05 bit ordering.
    """
    now = datetime.datetime.now(zoneinfo.ZoneInfo(tz_name))
    return now.weekday(), time_to_hhmm(now.time())
```

### Pattern 3: Resolver composition (D-03)

```python
# In backend/app/services/signage_resolver.py

async def resolve_schedule_for_device(
    db: AsyncSession,
    device: SignageDevice,
    *,
    now: datetime | None = None,
) -> PlaylistEnvelope | None:
    """Return best-matching schedule envelope, or None if no schedule matches.

    Tests override `now=` for determinism. Pure-read (D-10).
    """
    # 1. load app_settings.timezone
    # 2. compute (weekday, hhmm) once via now_hhmm_in_tz
    # 3. load device tag_ids
    # 4. single SQL query: JOIN signage_schedules → signage_playlists → signage_playlist_tag_map
    #    WHERE enabled=true AND (weekday_mask >> weekday) & 1 = 1
    #    AND start_hhmm <= hhmm AND end_hhmm > hhmm
    #    AND playlist.tag_ids OVERLAP device.tag_ids
    #    ORDER BY priority DESC, updated_at DESC LIMIT 1
    # 5. if no row: return None
    # 6. load playlist items (selectinload) and build envelope identical to tag-resolver path


async def resolve_playlist_for_device(
    db: AsyncSession, device: SignageDevice
) -> PlaylistEnvelope:
    """Modified to call resolve_schedule_for_device first (D-03).

    Existing signature unchanged — all 8+ callsites untouched.
    """
    # NEW: schedule-first
    scheduled = await resolve_schedule_for_device(db, device)
    if scheduled is not None:
        return scheduled
    # EXISTING tag-based branch below (unchanged)
    ...
```

### Pattern 4: Admin router — `schedules.py`

Copy the structural pattern from `playlists.py` exactly:
- `APIRouter(prefix="/schedules", tags=["signage-admin-schedules"])`
- POST / GET / PATCH / DELETE CRUD
- Post-commit `_notify_schedule_changed(db, schedule.playlist_id)` calling `devices_affected_by_playlist` + `notify_device` with `{"event": "schedule-changed", "schedule_id": ..., "playlist_id": ...}`
- DELETE must capture affected device IDs pre-commit (playlist FK RESTRICT means the schedule row can be deleted; but we need device IDs before the cascade affects the tag maps — actually schedules don't cascade on playlist delete, the FK is RESTRICT, so devices_affected_by_playlist works fine post-delete too for schedule deletes)
- Register in `signage_admin/__init__.py`: `from . import schedules` + `router.include_router(schedules.router)`

### Anti-Patterns to Avoid

- **Calling `now_hhmm_in_tz` multiple times per resolve:** Call it once and pass the result through. All timezone handling is isolated to that single call.
- **Using `datetime.time` objects in the SQL WHERE clause:** Keep the comparison as pure integer arithmetic in Python (or a SQL expression). Do not convert to `TIME` columns.
- **Using `updated_at` for the `SignageSchedule` sort without an index:** The query scans enabled schedules filtered by weekday_mask + hhmm range; without an index on `(enabled, weekday_mask)` or a partial index on `WHERE enabled = true`, this degrades for large schedule tables. For current fleet size (≤ 5 devices) this is not a performance problem, but the index should land in the migration anyway.
- **Adding `require_admin` to the `schedules.py` router sub-router:** The parent router in `__init__.py` already carries `dependencies=[Depends(get_current_user), Depends(require_admin)]`. Sub-routers MUST NOT add their own gate (D-01 pattern).
- **Firing SSE notify inside the transaction:** Post-commit only. Pattern established in `playlists.py` — notify calls happen after `await db.commit()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IANA timezone data | Custom timezone table or env-var UTC-offset | `zoneinfo.ZoneInfo` + `tzdata` pip package | IANA DB is maintained, DST-aware, handles all edge cases |
| Weekday bit math | Custom bit manipulation utilities | `date.weekday()` (0=Mon..6=Sun) + `(mask >> weekday) & 1` | Standard Python; test-friendly |
| Broadcast fanout | New pub-sub mechanism | `signage_broadcast.notify_device` + `devices_affected_by_playlist` | Already exists, tested, correct |
| Async resolver sessions | New AsyncSession factory | `AsyncSessionLocal` from `app.database` | Existing pattern; engines shared |

---

## Runtime State Inventory

Not applicable — this is a greenfield table addition. No existing data refers to `signage_schedules`. The `app_settings.timezone` column is new and has a server default of `'Europe/Berlin'`. The migration backfill strategy (D-06 discretion) is: rely on the column `DEFAULT 'Europe/Berlin'` in the migration DDL — no explicit `op.execute()` UPDATE needed since the NOT NULL constraint is satisfied by the column default for the existing singleton row. However, if the migration runs as `ADD COLUMN ... NOT NULL DEFAULT 'Europe/Berlin'`, PostgreSQL will backfill the existing row automatically. Confirm with explicit migration test.

---

## Common Pitfalls

### Pitfall 1: `zoneinfo.ZoneInfoNotFoundError` in Docker container
**What goes wrong:** `python:3.11-slim` does not include system timezone data. Any call to `zoneinfo.ZoneInfo("Europe/Berlin")` raises `ZoneInfoNotFoundError` at runtime.
**Why it happens:** The `slim` Docker image strips non-essential packages including `tzdata`.
**How to avoid:** Add `tzdata>=2024.1` to `backend/requirements.txt`. The `tzdata` pip package ships the IANA timezone database and is automatically used by `zoneinfo` as a fallback.
**Warning signs:** Tests pass locally (host OS has tzdata) but container startup fails with `ZoneInfoNotFoundError`.

### Pitfall 2: Weekday mask bit ordering mismatch
**What goes wrong:** Using `isoweekday()` instead of `weekday()` — `isoweekday()` returns 1–7 (Monday=1), but the mask is 0-indexed (bit 0 = Monday). Off-by-one causes Monday schedules to match Tuesday, etc.
**How to avoid:** Always use `date.weekday()` (returns 0=Mon..6=Sun). Document this explicitly in `_hhmm.py`.
**Warning signs:** Integration tests for "weekday-miss" cases pass but Monday schedules fail in production.

### Pitfall 3: `start_hhmm < end_hhmm` CHECK passes invalid HH:MM values
**What goes wrong:** Values like `2400`, `1299`, `760` would pass `CHECK (start_hhmm < end_hhmm)` but are not valid times.
**How to avoid:** The `CHECK (start_hhmm >= 0 AND start_hhmm <= 2359)` constraint catches values above 2359. The `hhmm_to_time` helper will raise `ValueError` for invalid minute components (>59). Add validation in the Pydantic schema's validator or use `time_to_hhmm(hhmm_to_time(v))` round-trip check.
**Warning signs:** `hhmm_to_time(1299)` raises `ValueError: minute must be in 0..59`.

### Pitfall 4: FK on `playlist_id` is RESTRICT — delete order matters
**What goes wrong:** If a playlist is deleted while schedules reference it, the DELETE will fail with a FK RESTRICT violation.
**Why it happens:** D-06 uses RESTRICT (not CASCADE) on `signage_schedules.playlist_id → signage_playlists.id`. This is intentional — operators must remove schedules before deleting a playlist.
**How to avoid:** The `playlists.py` DELETE endpoint will need to handle `IntegrityError` gracefully (409 Conflict with schedule_ids in the error body), similar to the existing media FK RESTRICT pattern in Plan 43-03. Document this in the schedules router.
**Warning signs:** `DELETE /api/signage/playlists/{id}` returns 500 instead of 409 when schedules exist.

### Pitfall 5: `resolve_schedule_for_device` called with stale `now` in tests
**What goes wrong:** Integration tests that don't pass explicit `now=` will use the real clock, making weekday/time-window tests non-deterministic.
**How to avoid:** Every SGN-TIME-03 test case MUST pass explicit `now=datetime(...)` to `resolve_schedule_for_device`. The `now` parameter default only fires in production.

### Pitfall 6: Adding `timezone` column with NOT NULL to a table that has existing rows
**What goes wrong:** If the migration runs `ADD COLUMN timezone VARCHAR(64) NOT NULL` without a DEFAULT, PostgreSQL rejects it because existing rows have no value.
**How to avoid:** Always use `ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin'`. The default satisfies the NOT NULL constraint for the singleton row immediately.
**Warning signs:** `alembic upgrade head` fails with `column "timezone" of relation "app_settings" contains null values`.

### Pitfall 7: `SmallInteger` import from SQLAlchemy
**What goes wrong:** `SmallInteger` is not imported by default in signage.py — the existing models use `Integer`, `BigInteger` (imported via `sa.BigInteger` alias). Forgetting to add `SmallInteger` causes an `ImportError`.
**How to avoid:** Add `SmallInteger` to the import from `sqlalchemy` in `backend/app/models/signage.py`.

---

## Code Examples

### Alembic migration structure for `v1_18_signage_schedules`

```python
# Source: v1_16_signage_devices_etag.py (column-add pattern) + v1_16_signage.py (table-create pattern)
from __future__ import annotations
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v1_18_signage_schedules"
down_revision: str | None = "v1_16_signage_devices_etag"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Add timezone column to app_settings singleton
    op.add_column(
        "app_settings",
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Europe/Berlin"),
    )

    # 2. Create signage_schedules table
    op.create_table(
        "signage_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("playlist_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("signage_playlists.id", ondelete="RESTRICT"), nullable=False),
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
    # Partial index on enabled schedules (hot-path filter)
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

### Integration test seeding helper for `signage_schedules`

```python
# Pattern mirrors existing test_signage_resolver.py _insert_playlist / _tag_playlist helpers
async def _insert_schedule(
    dsn: str,
    *,
    playlist_id: uuid.UUID,
    weekday_mask: int,
    start_hhmm: int,
    end_hhmm: int,
    priority: int = 0,
    enabled: bool = True,
) -> uuid.UUID:
    sid = uuid.uuid4()
    conn = await asyncpg.connect(dsn=dsn)
    try:
        await conn.execute(
            "INSERT INTO signage_schedules"
            " (id, playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled)"
            " VALUES ($1, $2, $3, $4, $5, $6, $7)",
            sid, playlist_id, weekday_mask, start_hhmm, end_hhmm, priority, enabled,
        )
    finally:
        await conn.close()
    return sid
```

### SGN-TIME-03 test case: worked example north-star

```python
# Mo-Fr 07:00-11:00 = weekday_mask = 0b0011111 = 31 (bits 0-4 set)
# Mo-So 11:00-14:00 = weekday_mask = 0b1111111 = 127
# Wednesday weekday() = 2

@pytest.mark.asyncio
async def test_schedule_worked_example(dsn):
    """SGN-TIME-03 north-star: three time windows, deterministic now injection."""
    device_id = await _insert_device(dsn)
    tag = await _insert_tag(dsn, "lobby")
    await _tag_device(dsn, device_id, tag)

    playlist_x = await _insert_playlist(dsn, name="Playlist X", priority=10)
    playlist_y = await _insert_playlist(dsn, name="Playlist Y", priority=5)
    await _tag_playlist(dsn, playlist_x, tag)
    await _tag_playlist(dsn, playlist_y, tag)

    # Mo-Fr 07:00-11:00 priority 10
    await _insert_schedule(dsn, playlist_id=playlist_x, weekday_mask=31, start_hhmm=700, end_hhmm=1100, priority=10)
    # Mo-So 11:00-14:00 priority 5
    await _insert_schedule(dsn, playlist_id=playlist_y, weekday_mask=127, start_hhmm=1100, end_hhmm=1400, priority=5)

    # Wednesday = weekday() 2
    wed_0830 = datetime(2026, 4, 22, 8, 30, tzinfo=timezone.utc)  # any Wednesday
    wed_1200 = datetime(2026, 4, 22, 12, 0, tzinfo=timezone.utc)
    wed_1500 = datetime(2026, 4, 22, 15, 0, tzinfo=timezone.utc)

    async with AsyncSessionLocal() as db:
        device = await _load_device(db, device_id)
        env_830 = await resolve_schedule_for_device(db, device, now=wed_0830)
        env_1200 = await resolve_schedule_for_device(db, device, now=wed_1200)
        env_1500 = await resolve_schedule_for_device(db, device, now=wed_1500)

    assert env_830 is not None and env_830.playlist_id == playlist_x
    assert env_1200 is not None and env_1200.playlist_id == playlist_y
    assert env_1500 is None  # no schedule matches → tag-fallback
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pytz` for timezone handling | `zoneinfo` (stdlib Python 3.9+) | Python 3.9 (2020) | No third-party dep for TZ handling; `zoneinfo.ZoneInfo` is DST-aware |
| System tzdata only | `tzdata` pip package available | ~2021 | Slim Docker images work without OS-level timezone data |

---

## Open Questions

1. **`AppSettings` singleton `timezone` column — backfill vs. server default**
   - What we know: `ADD COLUMN ... NOT NULL DEFAULT 'Europe/Berlin'` will auto-populate the existing singleton row in PostgreSQL.
   - What's unclear: Does the migration need an explicit `op.execute("UPDATE app_settings SET timezone = 'Europe/Berlin' WHERE timezone IS NULL")` before removing the DEFAULT for a "no defaults in schema" discipline, or is the server default acceptable long-term?
   - Recommendation: Keep the server default in the column definition (consistent with all other `app_settings` columns that use server defaults). No explicit backfill needed. Planner discretion.

2. **FK violation on playlist delete with existing schedules**
   - What we know: `RESTRICT` FK on `signage_schedules.playlist_id` prevents playlist deletion when schedules exist.
   - What's unclear: CONTEXT.md does not document a 409 pattern for this case in Phase 51.
   - Recommendation: The `playlists.py` DELETE endpoint should catch `IntegrityError` and return 409 with a message listing blocking schedule IDs. This is the same pattern as the media FK RESTRICT (Plan 43-03). Planner should add this to the schedules plan or as a minor amendment to `playlists.py`.

3. **`now` parameter handling when `zoneinfo.ZoneInfo(tz_name)` fails**
   - What we know: D-01 says unresolvable timezone is a hard 500.
   - What's unclear: Should the resolver propagate the `ZoneInfoNotFoundError` as-is (Python 500), or wrap it in an explicit `HTTPException(500)`?
   - Recommendation: Let the exception propagate naturally — FastAPI's default 500 handler will catch it. A targeted `try/except ZoneInfoNotFoundError` in the resolver with `raise HTTPException(500, "invalid timezone in app_settings")` gives a cleaner error message. Planner discretion.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | All backend | ✓ (Docker image) | 3.11-slim | — |
| `zoneinfo` | Resolver timezone | ✓ (stdlib since 3.9) | stdlib | — |
| System tzdata | `zoneinfo.ZoneInfo("Europe/Berlin")` | ✗ (not in python:3.11-slim) | — | `tzdata` pip package |
| `tzdata` pip package | `zoneinfo` in container | ✗ (not in requirements.txt) | — | **BLOCKING** — must add to requirements.txt |
| asyncpg | DB queries | ✓ | 0.31.0 | — |
| PostgreSQL 17 | Migration target | ✓ (docker-compose) | 17-alpine | — |
| pytest-asyncio | Integration tests | ✓ (existing test suite) | current | — |

**Missing dependencies with no fallback:**
- `tzdata` pip package — must be added to `backend/requirements.txt` before any resolver test or production run in Docker. Without it, `zoneinfo.ZoneInfo("Europe/Berlin")` raises `ZoneInfoNotFoundError` in the container.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `backend/pytest.ini` or `pyproject.toml` (existing) |
| Quick run command | `pytest backend/tests/test_signage_schedule_resolver.py -x` |
| Full suite command | `pytest backend/tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SGN-TIME-01 | Migration upgrade/downgrade round-trip | integration (DB) | `alembic upgrade head && alembic downgrade -1` | ❌ Wave 0 (migration file) |
| SGN-TIME-02 | Schedule match (single case) | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_schedule_single_match -x` | ❌ Wave 0 |
| SGN-TIME-02 | Priority tiebreak | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_schedule_priority_tiebreak -x` | ❌ Wave 0 |
| SGN-TIME-02 | Weekday miss | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_schedule_weekday_miss -x` | ❌ Wave 0 |
| SGN-TIME-02 | Time miss (outside window) | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_schedule_time_miss -x` | ❌ Wave 0 |
| SGN-TIME-03 | Disabled schedule skip | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_schedule_disabled_skip -x` | ❌ Wave 0 |
| SGN-TIME-03 | Tag mismatch skip | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_schedule_tag_mismatch_skip -x` | ❌ Wave 0 |
| SGN-TIME-03 | Empty schedules falls back to tag resolver | integration | `pytest backend/tests/test_signage_schedule_resolver.py::test_empty_schedules_fallback -x` | ❌ Wave 0 |
| SGN-TIME-04 | Schedule mutation fires notify_device SSE | unit (mock) | `pytest backend/tests/test_signage_schedule_router.py -x` | ❌ Wave 0 |
| SGN-TIME-04 | SSE ≤ 2 s propagation | E2E (manual/operator) | operator observation | manual-only |

### Sampling Rate

- **Per task commit:** `pytest backend/tests/test_signage_schedule_resolver.py -x`
- **Per wave merge:** `pytest backend/tests/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/alembic/versions/v1_18_signage_schedules.py` — SGN-TIME-01 migration
- [ ] `backend/app/services/_hhmm.py` — D-04 helper module
- [ ] `backend/app/models/signage.py` — `SignageSchedule` class addition
- [ ] `backend/app/schemas/signage.py` — `ScheduleCreate/Read/Update` additions
- [ ] `backend/app/services/signage_resolver.py` — `resolve_schedule_for_device` + resolver composition
- [ ] `backend/app/routers/signage_admin/schedules.py` — CRUD router
- [ ] `backend/tests/test_signage_schedule_resolver.py` — 7 integration test cases
- [ ] `backend/tests/test_signage_schedule_router.py` — router + SSE fanout tests
- [ ] `backend/requirements.txt` — add `tzdata>=2024.1`

---

## Project Constraints (from CLAUDE.md)

All directives apply to this phase:

1. **Containerization:** Must run via Docker Compose — migration runs as startup command in `migrate` service.
2. **PostgreSQL 17:** Target database. `gen_random_uuid()` builtin (no pgcrypto). Use CHECK constraints not ENUMs.
3. **SQLAlchemy 2.0 async:** `AsyncSession` + `create_async_engine`. Do NOT use sync `Session`. Use `selectinload` for relationships (as existing resolver does).
4. **Alembic migrations:** Never call `Base.metadata.create_all()`. Always go through Alembic. `signage_schedules` lands in a named migration file.
5. **FastAPI admin router pattern:** New `schedules.py` inherits the router-level admin gate — do NOT add `require_admin` to the sub-router itself (D-01).
6. **`--workers 1` invariant:** SSE fanout uses in-process `asyncio.Queue`; this invariant is already documented in `signage_broadcast.py` and must not be violated.
7. **No `import sqlite3` / no `import psycopg2`:** CI grep guard covers all `backend/app/` files. `signage_schedules.py` must not introduce these.
8. **No sync `subprocess.run` in signage services:** CI grep guard covers all signage modules.
9. **Post-commit SSE fanout only:** `notify_device` calls MUST fire after `await db.commit()`, never inside the transaction.
10. **f-strings forbidden in log format args:** Use `%s`-style args in `log.warning(...)` etc. (existing CI guard).

---

## Sources

### Primary (HIGH confidence)

- `backend/app/services/signage_resolver.py` — full source read; resolver composition point confirmed
- `backend/app/services/signage_broadcast.py` — full source read; `notify_device` contract confirmed
- `backend/app/models/_base.py` — full source read; `AppSettings` singleton confirmed; no `timezone` column yet
- `backend/app/models/signage.py` — full source read; `SignagePlaylist` pattern for new model
- `backend/app/routers/signage_admin/playlists.py` — full source read; post-commit fanout template confirmed
- `backend/app/routers/signage_admin/__init__.py` — full source read; router registration pattern confirmed
- `backend/tests/test_signage_resolver.py` — full source read; asyncpg seeding + AsyncSession integration test pattern confirmed
- `backend/alembic/versions/v1_16_signage_devices_etag.py` — column-addition migration pattern confirmed
- `backend/requirements.txt` — confirmed `tzdata` is absent
- `backend/Dockerfile` — confirmed `python:3.11-slim`; no system tzdata installed
- Python 3.11 stdlib docs — `zoneinfo` module available since Python 3.9; requires `tzdata` pip package on slim images

### Secondary (MEDIUM confidence)

- Python packaging authority — `tzdata` pip package is the canonical fix for `zoneinfo` on slim images; widely documented in Docker Python guides

### Tertiary (LOW confidence)

None — all critical claims are verified from direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in requirements.txt; tzdata gap confirmed by Dockerfile inspection
- Architecture: HIGH — all patterns read directly from existing production code
- Pitfalls: HIGH — tzdata pitfall confirmed by Dockerfile + requirements.txt; others confirmed from SQLAlchemy/Alembic documentation patterns
- Test patterns: HIGH — read directly from existing test_signage_resolver.py

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack; only concern is if tzdata pip API changes, which is extremely unlikely)
