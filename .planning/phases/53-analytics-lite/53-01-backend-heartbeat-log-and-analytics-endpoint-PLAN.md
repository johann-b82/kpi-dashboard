---
phase: 53-analytics-lite
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - backend/alembic/versions/v1_18_signage_heartbeat_event.py
  - backend/app/models/signage.py
  - backend/app/schemas/signage.py
  - backend/app/routers/signage_player.py
  - backend/app/routers/signage_admin/__init__.py
  - backend/app/routers/signage_admin/analytics.py
  - backend/app/scheduler.py
  - backend/tests/test_signage_heartbeat_event_insert.py
  - backend/tests/test_signage_heartbeat_sweeper.py
  - backend/tests/test_signage_analytics_router.py
autonomous: true
requirements:
  - SGN-ANA-01
must_haves:
  truths:
    - "alembic upgrade head creates signage_heartbeat_event with composite PK (device_id, ts) and FK → signage_devices.id ON DELETE CASCADE; round-trip (upgrade/downgrade/upgrade) clean."
    - "POST /api/signage/player/heartbeat inserts exactly one signage_heartbeat_event row per call, idempotent via ON CONFLICT (device_id, ts) DO NOTHING, and still updates signage_devices.last_seen_at in the same transaction."
    - "_run_signage_heartbeat_sweeper deletes all signage_heartbeat_event rows with ts < now() - interval '25 hours' on every 60 s tick."
    - "GET /api/signage/analytics/devices requires admin JWT (inherited from signage_admin router) and returns one row per non-revoked device with {device_id, uptime_24h_pct (float|null), missed_windows_24h (int), window_minutes (int)}."
    - "uptime_24h_pct is computed as count of distinct date_trunc('minute', ts) buckets in the last 24 h divided by min(1440, minutes_since_device_first_retained_heartbeat), rounded to 1 decimal; returns null only when the device has zero heartbeats in the retention window (denominator 0)."
    - "All 6 D-20 integration-test scenarios pass: all-healthy (100%, 0 missed), half-uptime (50%, 720 missed), partial-history (100% over 30-min denominator), zero-heartbeat (null/neutral), revoked-device (excluded from response), same-minute-duplicate (counted once)."
    - "ROADMAP.md Phase 53 goal no longer claims 'no new schema' / 'computed from existing heartbeat data'; REQUIREMENTS.md SGN-ANA-01 line reflects the signage_heartbeat_event log table (D-01 amendment)."
  artifacts:
    - path: "backend/alembic/versions/v1_18_signage_heartbeat_event.py"
      provides: "Alembic migration creating signage_heartbeat_event, down_revision='v1_18_signage_schedules'"
      contains: "v1_18_signage_heartbeat_event"
    - path: "backend/app/models/signage.py"
      provides: "SignageHeartbeatEvent ORM model (composite PK device_id+ts)"
      contains: "class SignageHeartbeatEvent"
    - path: "backend/app/schemas/signage.py"
      provides: "DeviceAnalyticsRead Pydantic schema"
      contains: "DeviceAnalyticsRead"
    - path: "backend/app/routers/signage_admin/analytics.py"
      provides: "GET /api/signage/analytics/devices endpoint (new file)"
      contains: "list_device_analytics"
      min_lines: 40
    - path: "backend/app/routers/signage_admin/__init__.py"
      provides: "analytics router mounted under signage_admin package"
      contains: "analytics"
    - path: "backend/app/routers/signage_player.py"
      provides: "post_heartbeat extended with signage_heartbeat_event insert (ON CONFLICT DO NOTHING)"
      contains: "SignageHeartbeatEvent"
    - path: "backend/app/scheduler.py"
      provides: "_run_signage_heartbeat_sweeper extended with 25h prune DELETE"
      contains: "interval '25 hours'"
    - path: "backend/tests/test_signage_analytics_router.py"
      provides: "6 D-20 integration tests covering all scenarios"
      min_lines: 250
    - path: "backend/tests/test_signage_heartbeat_event_insert.py"
      provides: "Integration tests proving POST /heartbeat inserts a row and is idempotent"
      min_lines: 60
    - path: ".planning/ROADMAP.md"
      provides: "Phase 53 goal + SGN-ANA-01 coverage reflects new log table"
      contains: "signage_heartbeat_event"
    - path: ".planning/REQUIREMENTS.md"
      provides: "SGN-ANA-01 reflects append-only log table (D-01 amendment)"
      contains: "signage_heartbeat_event"
  key_links:
    - from: "POST /api/signage/player/heartbeat (post_heartbeat)"
      to: "signage_heartbeat_event row insert"
      via: "sqlalchemy.dialects.postgresql.insert(SignageHeartbeatEvent).on_conflict_do_nothing(index_elements=['device_id','ts'])"
      pattern: "pg_insert\\(SignageHeartbeatEvent\\)"
    - from: "_run_signage_heartbeat_sweeper"
      to: "signage_heartbeat_event prune"
      via: "DELETE FROM signage_heartbeat_event WHERE ts < now() - interval '25 hours'"
      pattern: "interval '25 hours'"
    - from: "GET /api/signage/analytics/devices"
      to: "signage_heartbeat_event bucketed aggregate + signage_devices LEFT JOIN"
      via: "COUNT(DISTINCT date_trunc('minute', ts)) per device, filter d.revoked_at IS NULL"
      pattern: "COUNT\\(DISTINCT date_trunc\\('minute'"
    - from: "signage_admin router package"
      to: "analytics.py router"
      via: "router.include_router(analytics.router) in signage_admin/__init__.py — inherits admin gate"
      pattern: "analytics\\.router"
---

<objective>
Ship the backend side of Phase 53 Analytics-lite: append-only `signage_heartbeat_event` log table + idempotent heartbeat insert + 25 h sweeper prune + read-only `GET /api/signage/analytics/devices` endpoint computing per-device `uptime_24h_pct`, `missed_windows_24h`, `window_minutes`. Also amend ROADMAP.md + REQUIREMENTS.md per D-01 to correct the stale "no new schema" claim.

Purpose: Deliver the server foundation that Plan 02's DevicesPage columns depend on. Splitting backend into its own atomic wave keeps the frontend plan pure-UI and lets Plan 02 pin its `interfaces` block against a committed backend contract.

Output: One new Alembic migration, one new ORM model, one new Pydantic schema, one new analytics router file (mounted via `signage_admin/__init__.py`), two backend edits (`signage_player.py` heartbeat insert + `scheduler.py` prune), two new test files + one extension to the existing sweeper test file, and the ROADMAP/REQUIREMENTS amendment commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/53-analytics-lite/53-CONTEXT.md
@.planning/phases/53-analytics-lite/53-RESEARCH.md
@.planning/REQUIREMENTS.md
@backend/app/models/signage.py
@backend/app/schemas/signage.py
@backend/app/routers/signage_player.py
@backend/app/routers/signage_admin/__init__.py
@backend/app/routers/signage_admin/schedules.py
@backend/app/scheduler.py
@backend/alembic/versions/v1_18_signage_schedules.py
@backend/tests/test_signage_heartbeat_sweeper.py
@backend/tests/conftest.py

<interfaces>
<!-- Existing contracts downstream tasks MUST mirror. Extracted from codebase. -->

From backend/app/routers/signage_admin/__init__.py (Phase 52 state):
```python
# One router-level admin gate on the package. Sub-routers MUST NOT add their own.
router = APIRouter(
    prefix="/api/signage",
    tags=["signage-admin"],
    dependencies=[Depends(get_current_user), Depends(require_admin)],
)
# mounted: media, playlists, playlist_items, schedules, devices, tags
```

From backend/app/models/signage.py (SignageDevice relevant columns):
```python
class SignageDevice(Base):
    __tablename__ = "signage_devices"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, ...)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), ...)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), ...)
```

From backend/app/routers/signage_player.py (post_heartbeat extension point — around l.82):
```python
# Existing shape: fetches device by JWT, updates last_seen_at + status, commits.
# Insert the new event row in the SAME transaction BEFORE the existing commit.
```

From backend/alembic/versions/v1_18_signage_schedules.py:
```python
revision: str = "v1_18_signage_schedules"
# This is the current Alembic HEAD. New migration's down_revision MUST be this string.
```

Target new endpoint path (D-08, per research Pattern 5):
- `GET /api/signage/analytics/devices` → `list[DeviceAnalyticsRead]`
- Mount via `router = APIRouter(prefix="/analytics/devices", tags=["signage-admin-analytics"])`
  and endpoint path `""` inside signage_admin package (parent prefix "/api/signage").

DeviceAnalyticsRead response shape (Pydantic v2):
```python
class DeviceAnalyticsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    device_id: uuid.UUID
    uptime_24h_pct: float | None       # null ⇔ denominator == 0 (no heartbeats ever)
    missed_windows_24h: int            # 0 when denominator == 0
    window_minutes: int                # 0..1440 — drives D-06 "over last Xh" tooltip
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: ROADMAP + REQUIREMENTS amendment (D-01) + Alembic migration + SignageHeartbeatEvent model + DeviceAnalyticsRead schema</name>
  <files>.planning/ROADMAP.md, .planning/REQUIREMENTS.md, backend/alembic/versions/v1_18_signage_heartbeat_event.py, backend/app/models/signage.py, backend/app/schemas/signage.py</files>
  <read_first>
    - .planning/ROADMAP.md lines 228–236 (Phase 53 goal + Success Criteria) — amend the "no new schema" clause
    - .planning/REQUIREMENTS.md SGN-ANA-01 line (line 43) and the trailing "No new database tables." clause
    - backend/alembic/versions/v1_18_signage_schedules.py — template for migration scaffolding; confirm revision id string
    - backend/app/models/signage.py — locate SignageDevice (~l.160) + SignageSchedule (~l.330); pick insertion point after SignageSchedule
    - backend/app/schemas/signage.py — locate ScheduleRead (~l.289) for insertion point + existing Pydantic v2 conventions (ConfigDict(from_attributes=True))
    - backend/alembic/env.py — confirm `target_metadata = Base.metadata` includes the new model on import
  </read_first>
  <behavior>
    - ROADMAP.md Phase 53 goal is amended to acknowledge the new `signage_heartbeat_event` append-only log table; the "no new schema" phrase is removed or corrected. Success Criteria #1 wording aligns with the real endpoint path (`/api/signage/analytics/devices`).
    - REQUIREMENTS.md SGN-ANA-01 line is amended: removes "No new database tables."; replaces with "Adds a lightweight append-only `signage_heartbeat_event` log table with 25 h retention, pruned by the existing heartbeat sweeper."
    - New migration file `v1_18_signage_heartbeat_event.py` creates table with columns `(device_id UUID NOT NULL FK signage_devices.id ONDELETE CASCADE, ts TIMESTAMPTZ NOT NULL DEFAULT now())`, composite PK `(device_id, ts)`. NO secondary index (PK covers both hot queries). `down_revision = "v1_18_signage_schedules"`. Upgrade + downgrade both idempotent.
    - `SignageHeartbeatEvent` class added to `backend/app/models/signage.py`; imported wherever `Base.metadata` is collected (inspect `backend/app/models/__init__.py` or wherever existing signage models are re-exported and mirror the pattern).
    - `DeviceAnalyticsRead` Pydantic class added to `backend/app/schemas/signage.py` with `device_id: uuid.UUID`, `uptime_24h_pct: float | None`, `missed_windows_24h: int`, `window_minutes: int`. `model_config = ConfigDict(from_attributes=True)`.
  </behavior>
  <action>
    **Step A — Docs amendment (D-01):**
    1. In `.planning/ROADMAP.md` §"Phase 53: Analytics-lite" block:
       - Replace the **Goal** line's "(no new schema)" with "(adds a lightweight `signage_heartbeat_event` append-only log; 25 h retention)". Keep the rest of the Goal intact.
       - Under **Success Criteria** item 1, change "New read-only endpoint returns ..." to "New read-only endpoint `GET /api/signage/analytics/devices` returns `{device_id, uptime_24h_pct, missed_windows_24h, window_minutes}` per non-revoked device in one call."
    2. In `.planning/REQUIREMENTS.md` SGN-ANA-01 line (line 43):
       - Remove the trailing "No new database tables." sentence.
       - Append: "Adds an append-only `signage_heartbeat_event` log table (composite PK `(device_id, ts)`, 25 h retention pruned by the existing 60 s heartbeat sweeper) so the 60-second-window uptime metric is measurable. Amendment 2026-04-21 per Phase 53 CONTEXT D-01."
    3. Do NOT rewrite surrounding unrelated content.

    **Step B — Alembic migration:**
    Create `backend/alembic/versions/v1_18_signage_heartbeat_event.py` verbatim per RESEARCH §"Alembic Migration" code example:

    ```python
    """v1.18 Phase 53 signage_heartbeat_event — SGN-ANA-01.

    Creates the per-heartbeat append-only event log consumed by the
    Analytics-lite endpoint. Composite PK (device_id, ts) — see
    .planning/phases/53-analytics-lite/53-RESEARCH.md Pattern 2.

    Revision ID: v1_18_signage_heartbeat_event
    Revises: v1_18_signage_schedules
    Create Date: 2026-04-21
    """
    from __future__ import annotations

    import sqlalchemy as sa
    from alembic import op
    from sqlalchemy.dialects import postgresql

    revision: str = "v1_18_signage_heartbeat_event"
    down_revision: str | None = "v1_18_signage_schedules"
    branch_labels = None
    depends_on = None


    def upgrade() -> None:
        op.create_table(
            "signage_heartbeat_event",
            sa.Column(
                "device_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(
                    "signage_devices.id",
                    ondelete="CASCADE",
                    name="fk_signage_heartbeat_event_device_id",
                ),
                nullable=False,
            ),
            sa.Column(
                "ts",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint(
                "device_id", "ts", name="pk_signage_heartbeat_event"
            ),
        )
        # No secondary index — composite PK covers:
        #   (a) WHERE ts >= cutoff GROUP BY device_id  (analytics)
        #   (b) WHERE ts <  cutoff                     (sweeper prune)


    def downgrade() -> None:
        op.drop_table("signage_heartbeat_event")
    ```

    **Step C — ORM model:**
    In `backend/app/models/signage.py`, append AFTER the last existing model class (SignageSchedule ~l.330) — NOT inside it. Import `uuid` / `datetime` / `func` / `DateTime` / `ForeignKey` / `Mapped` / `mapped_column` / `UUID` as already imported in that file; add any missing imports at the top.

    ```python
    class SignageHeartbeatEvent(Base):
        """Phase 53 SGN-ANA-01 — per-heartbeat append-only log.

        One row per successful POST /api/signage/player/heartbeat. Retention 25 h,
        pruned by the existing heartbeat sweeper in app/scheduler.py.

        Composite PK (device_id, ts) — no surrogate id (see 53-RESEARCH Pattern 2):
          - Insert rate ~1/min/device → natural uniqueness is free.
          - Prune (WHERE ts < cutoff) → PK-ordered scan, no secondary lookup.
          - Analytics (WHERE ts >= cutoff GROUP BY device_id) → PK covers filter+group.

        Idempotency on heartbeat insert is achieved at call-site via
        `sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_nothing(
            index_elements=["device_id", "ts"])`.
        """

        __tablename__ = "signage_heartbeat_event"

        device_id: Mapped[uuid.UUID] = mapped_column(
            UUID(as_uuid=True),
            ForeignKey("signage_devices.id", ondelete="CASCADE"),
            primary_key=True,
        )
        ts: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            primary_key=True,
            server_default=func.now(),
        )
    ```

    If `backend/app/models/__init__.py` re-exports signage models, add `SignageHeartbeatEvent` there; otherwise ensure Alembic's `env.py` picks it up via the existing `Base.metadata` auto-discovery (mirror whatever SignageSchedule did in Phase 51's migration).

    **Step D — Pydantic schema:**
    In `backend/app/schemas/signage.py`, AFTER `ScheduleRead` (~l.289), append:

    ```python
    class DeviceAnalyticsRead(BaseModel):
        """Phase 53 SGN-ANA-01 — per-device analytics row.

        uptime_24h_pct is null ⇔ device has zero retained heartbeats (denominator 0);
        clients render a neutral '—' badge in that case (D-16).
        window_minutes is 0..1440 and drives the D-06 "over last Xh" tooltip.
        """
        model_config = ConfigDict(from_attributes=True)

        device_id: uuid.UUID
        uptime_24h_pct: float | None
        missed_windows_24h: int
        window_minutes: int
    ```

    Ensure `BaseModel`, `ConfigDict`, and `uuid` are already imported at the top of the file (they are — used by ScheduleRead).
  </action>
  <verify>
    <automated>cd backend && docker compose exec -T app alembic upgrade head 2>&1 | tail -10 && docker compose exec -T app alembic downgrade -1 2>&1 | tail -5 && docker compose exec -T app alembic upgrade head 2>&1 | tail -5 && docker compose exec -T app python -c "from app.models.signage import SignageHeartbeatEvent; from app.schemas.signage import DeviceAnalyticsRead; print(SignageHeartbeatEvent.__tablename__, DeviceAnalyticsRead.model_fields.keys())" && grep -q "signage_heartbeat_event" .planning/REQUIREMENTS.md && grep -q "signage_heartbeat_event" .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "down_revision.*v1_18_signage_schedules" backend/alembic/versions/v1_18_signage_heartbeat_event.py` succeeds
    - `grep -q "revision.*=.*\"v1_18_signage_heartbeat_event\"" backend/alembic/versions/v1_18_signage_heartbeat_event.py` succeeds
    - `grep -q "ondelete=\"CASCADE\"" backend/alembic/versions/v1_18_signage_heartbeat_event.py` succeeds
    - `grep -q "PrimaryKeyConstraint" backend/alembic/versions/v1_18_signage_heartbeat_event.py` succeeds (composite PK)
    - `grep -q "class SignageHeartbeatEvent" backend/app/models/signage.py` succeeds
    - `grep -q "__tablename__ = \"signage_heartbeat_event\"" backend/app/models/signage.py` succeeds
    - `grep -qE "primary_key=True" backend/app/models/signage.py` appears ≥2 more times than before (both device_id AND ts marked primary_key)
    - `grep -q "class DeviceAnalyticsRead" backend/app/schemas/signage.py` succeeds
    - `grep -q "uptime_24h_pct: float | None" backend/app/schemas/signage.py` succeeds
    - `grep -q "window_minutes: int" backend/app/schemas/signage.py` succeeds
    - `grep -q "signage_heartbeat_event" .planning/REQUIREMENTS.md` succeeds AND "No new database tables." does NOT appear in the SGN-ANA-01 line anymore
    - `grep -q "signage_heartbeat_event" .planning/ROADMAP.md` succeeds AND the stale "(no new schema)" phrase is gone from the Phase 53 Goal line
    - `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` round-trip exits 0 each step
    - Python import smoke test succeeds: `python -c "from app.models.signage import SignageHeartbeatEvent; from app.schemas.signage import DeviceAnalyticsRead"` exits 0 inside the app container
  </acceptance_criteria>
  <done>Migration, ORM model, and Pydantic schema are in place; the round-trip upgrade/downgrade is clean; ROADMAP + REQUIREMENTS no longer contradict D-01.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: post_heartbeat inserts event row (idempotent) + sweeper 25 h prune — with tests</name>
  <files>backend/app/routers/signage_player.py, backend/app/scheduler.py, backend/tests/test_signage_heartbeat_event_insert.py, backend/tests/test_signage_heartbeat_sweeper.py</files>
  <read_first>
    - backend/app/routers/signage_player.py l.70–120 (existing `post_heartbeat` function — find the last DB statement before commit)
    - backend/app/scheduler.py l.190–250 (`_run_signage_heartbeat_sweeper`, `HEARTBEAT_SWEEPER_JOB_ID`) — find the insert point inside the existing try block, before commit
    - backend/tests/test_signage_heartbeat_sweeper.py (full file) — time-control pattern uses explicit datetime-stamped INSERTs via asyncpg; copy that fixture/helper style
    - backend/tests/conftest.py (l.28–41) — `client` fixture with LifespanManager; how to make authenticated player requests (player JWT pairing flow)
    - backend/tests/test_signage_heartbeat_router.py or similar if present — how existing tests invoke `POST /api/signage/player/heartbeat` with a paired-device JWT
  </read_first>
  <behavior>
    **signage_player.py `post_heartbeat`:**
    - After the existing `update(SignageDevice)...` statement and its `await db.execute(...)`, BEFORE the `await db.commit()`, insert one row into `signage_heartbeat_event` via `sqlalchemy.dialects.postgresql.insert(SignageHeartbeatEvent).values(device_id=device.id, ts=<same timestamp used for last_seen_at>).on_conflict_do_nothing(index_elements=["device_id", "ts"])`.
    - The timestamp MUST be the exact same value used to update `last_seen_at` (so the two writes are consistent — pass a pre-computed `now` variable into both). If the current code uses `func.now()` directly inside the UPDATE, refactor to compute `now = datetime.now(timezone.utc)` once at the top of the handler and use that value in both the UPDATE and the INSERT.
    - One commit covers both statements. Do NOT add a separate commit for the INSERT.
    - No new error-handling branches. A duplicate `(device_id, ts)` from a microsecond-retry collides harmlessly on the ON CONFLICT; the existing success response is returned.

    **scheduler.py `_run_signage_heartbeat_sweeper`:**
    - Inside the existing try block, AFTER the existing `update(SignageDevice)...` statement (which flips stale devices), BEFORE the existing `await session.commit()`, add:
      ```python
      await asyncio.wait_for(
          session.execute(
              delete(SignageHeartbeatEvent).where(
                  SignageHeartbeatEvent.ts < func.now() - timedelta(hours=25)
              )
          ),
          timeout=20,
      )
      ```
    - Import `delete`, `timedelta`, `SignageHeartbeatEvent` at the top of the file if missing. Match existing import style.
    - The 25 h value (not 24 h) is intentional per D-03 / research Pitfall 4 — 1 h buffer against sweeper-vs-analytics race.

    **Tests — test_signage_heartbeat_event_insert.py (NEW):**
    - `test_heartbeat_post_inserts_event_row`: pair a device (reuse existing pair-flow fixture if present; otherwise insert device + token via asyncpg), POST `/api/signage/player/heartbeat`, assert the row count in `signage_heartbeat_event` for that device increments by exactly 1 AND `last_seen_at` is updated.
    - `test_heartbeat_post_is_idempotent_on_same_microsecond`: simulate two rapid POSTs whose inserts collide on the same `(device_id, ts)` — either by seeding a row with `ts = now()` via asyncpg then POSTing (the POST's INSERT will collide with the seeded row) OR by monkeypatching `datetime.now` inside the handler to return the same value twice. Assert NEITHER POST returns 5xx; exactly one row is present in the log table for that device at that timestamp.

    **Tests — test_signage_heartbeat_sweeper.py EXTENSION:**
    - Add `test_sweeper_prunes_old_heartbeat_events`: insert 3 event rows for a single device with ts = `now - 10min`, `now - 24h 30min`, `now - 26h`; drive one sweeper tick (call `_run_signage_heartbeat_sweeper` directly with the test session or trigger via existing test helper); assert the 10-minute and 24 h 30 min rows remain and the 26 h row is gone. Do NOT change existing sweeper tests.
  </behavior>
  <action>
    **File 1 — backend/app/routers/signage_player.py:**
    1. At the top of the file, ensure these imports are present (add if missing):
       ```python
       from datetime import datetime, timezone
       from sqlalchemy.dialects.postgresql import insert as pg_insert
       from app.models.signage import SignageHeartbeatEvent  # alongside SignageDevice
       ```
    2. Inside `post_heartbeat`, find the current `now = ...` assignment (if any) or the point where `last_seen_at` gets its value. Refactor so a single `now = datetime.now(timezone.utc)` is computed at the top of the handler and used in BOTH the existing UPDATE's `last_seen_at=now` AND the new INSERT's `ts=now`.
    3. After the existing `await db.execute(<update stmt>)`, BEFORE the commit, add:
       ```python
       # Phase 53 SGN-ANA-01 — log heartbeat event for Analytics-lite uptime metric.
       # Idempotent on (device_id, ts) microsecond collision (e.g. network retry).
       hb_stmt = (
           pg_insert(SignageHeartbeatEvent)
           .values(device_id=device.id, ts=now)
           .on_conflict_do_nothing(index_elements=["device_id", "ts"])
       )
       await db.execute(hb_stmt)
       ```
    4. Leave the existing `await db.commit()` as-is — it now covers both statements.

    **File 2 — backend/app/scheduler.py:**
    1. At the top of the file, ensure imports: `from datetime import timedelta`, `from sqlalchemy import delete` (or extend existing `sqlalchemy` import), `from app.models.signage import SignageHeartbeatEvent`. Match the existing import block style.
    2. Inside `_run_signage_heartbeat_sweeper`, within the existing `async with … session:` / try block, AFTER the current UPDATE execution but BEFORE the commit, insert the prune:
       ```python
       # Phase 53 SGN-ANA-01 (D-03): 25 h rolling retention — 1 h buffer past
       # the 24 h analytics horizon so rows near the boundary don't get pruned
       # out from under the /devices/analytics query. Single DELETE; one commit
       # covers both the device-status flip above and this prune.
       await asyncio.wait_for(
           session.execute(
               delete(SignageHeartbeatEvent).where(
                   SignageHeartbeatEvent.ts < func.now() - timedelta(hours=25)
               )
           ),
           timeout=20,
       )
       ```
    3. Do NOT change `HEARTBEAT_SWEEPER_JOB_ID`, the 60 s cadence, or the job registration. Adding a statement inside the coroutine body needs no re-registration (research §"Runtime State Inventory").

    **File 3 — backend/tests/test_signage_heartbeat_event_insert.py (NEW):**
    Mirror the harness from `test_signage_heartbeat_sweeper.py`:
    - Use the `client` fixture from `conftest.py` for the FastAPI app under LifespanManager.
    - Use asyncpg directly for seed/inspection.
    - Pair a device using whatever helper already exists in `backend/tests/` for obtaining a player JWT (grep for `pair_device` / `player_token` in `backend/tests/`). If no helper exists, insert a device + generate the token via the existing `app/security/signage_device_tokens.py` path in a small local fixture.

    Two tests per <behavior>:

    ```python
    async def test_heartbeat_post_inserts_event_row(client, dsn, paired_device):
        # Snapshot count for the device
        before = await _count_events(dsn, paired_device.id)
        resp = await client.post(
            "/api/signage/player/heartbeat",
            headers={"Authorization": f"Bearer {paired_device.token}"},
        )
        assert resp.status_code == 200
        after = await _count_events(dsn, paired_device.id)
        assert after == before + 1
        # last_seen_at also bumped (existing behavior preserved)
        assert await _last_seen_at(dsn, paired_device.id) is not None

    async def test_heartbeat_post_is_idempotent_on_same_microsecond(client, dsn, paired_device, monkeypatch):
        fixed = datetime(2026, 4, 21, 12, 0, 0, 0, tzinfo=timezone.utc)
        # Pre-seed a row at that exact ts → the handler's INSERT must not 5xx.
        await _insert_heartbeat(dsn, paired_device.id, fixed)
        monkeypatch.setattr(
            "app.routers.signage_player.datetime",
            types.SimpleNamespace(now=lambda tz=None: fixed, timezone=timezone),
        )
        resp = await client.post(
            "/api/signage/player/heartbeat",
            headers={"Authorization": f"Bearer {paired_device.token}"},
        )
        assert resp.status_code == 200
        # Still exactly one row at that ts — ON CONFLICT DO NOTHING did its job.
        count = await _count_events_at(dsn, paired_device.id, fixed)
        assert count == 1
    ```

    If monkeypatching `datetime` is awkward with the refactored `now = datetime.now(tz=...)` (module-level attribute), alternative: patch `datetime.datetime.now` via `unittest.mock.patch` on the module. Either is acceptable — just ensure the handler reads the patched value.

    **File 4 — backend/tests/test_signage_heartbeat_sweeper.py (EXTENSION):**
    Append a new test function (do NOT edit existing ones):
    ```python
    async def test_sweeper_prunes_old_heartbeat_events(dsn, paired_device):
        now = datetime.now(timezone.utc)
        await _insert_heartbeat(dsn, paired_device.id, now - timedelta(minutes=10))      # keep
        await _insert_heartbeat(dsn, paired_device.id, now - timedelta(hours=24, minutes=30))  # keep
        await _insert_heartbeat(dsn, paired_device.id, now - timedelta(hours=26))        # prune
        await _run_sweeper_once()  # existing helper in this file
        remaining = await _list_events_ts(dsn, paired_device.id)
        assert len(remaining) == 2
        # Oldest remaining is within the 25 h window
        assert min(remaining) >= now - timedelta(hours=25, minutes=1)
    ```
    Reuse whatever helper name/shape already exists in this test file for "run the sweeper once" and "insert heartbeat event row" — if the latter doesn't exist yet, add a small `_insert_heartbeat` helper at module scope that copies the asyncpg INSERT pattern from `test_signage_heartbeat_event_insert.py`.

    No `dark:`, no raw `fetch(`, no `sqlite3`/`psycopg2` imports (hard gate carried forward).
  </action>
  <verify>
    <automated>cd backend && docker compose exec -T app pytest tests/test_signage_heartbeat_event_insert.py tests/test_signage_heartbeat_sweeper.py --workers 1 -x 2>&1 | tail -30 && grep -q "pg_insert(SignageHeartbeatEvent)" app/routers/signage_player.py && grep -q "interval '25 hours'\|timedelta(hours=25)" app/scheduler.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "from sqlalchemy.dialects.postgresql import insert as pg_insert" backend/app/routers/signage_player.py` succeeds
    - `grep -q "pg_insert(SignageHeartbeatEvent)" backend/app/routers/signage_player.py` succeeds
    - `grep -q "on_conflict_do_nothing" backend/app/routers/signage_player.py` succeeds
    - `grep -q 'index_elements=\["device_id", "ts"\]' backend/app/routers/signage_player.py` succeeds
    - Single `now = datetime.now(timezone.utc)` reused for UPDATE + INSERT: `grep -c "datetime.now(timezone.utc)" backend/app/routers/signage_player.py` returns 1 inside post_heartbeat scope (one call, not two)
    - `grep -q "delete(SignageHeartbeatEvent)" backend/app/scheduler.py` succeeds
    - `grep -qE "timedelta\(hours=25\)" backend/app/scheduler.py` succeeds
    - `grep -q "HEARTBEAT_SWEEPER_JOB_ID" backend/app/scheduler.py` → value unchanged from pre-plan state (job id not renamed)
    - `grep -q "def test_heartbeat_post_inserts_event_row" backend/tests/test_signage_heartbeat_event_insert.py` succeeds
    - `grep -q "def test_heartbeat_post_is_idempotent_on_same_microsecond" backend/tests/test_signage_heartbeat_event_insert.py` succeeds
    - `grep -q "def test_sweeper_prunes_old_heartbeat_events" backend/tests/test_signage_heartbeat_sweeper.py` succeeds
    - `pytest tests/test_signage_heartbeat_event_insert.py tests/test_signage_heartbeat_sweeper.py --workers 1 -x` exits 0
    - No `import sqlite3` / `import psycopg2` added anywhere (hard gate): `grep -rE 'import (sqlite3|psycopg2)' backend/app/routers/signage_player.py backend/app/scheduler.py backend/tests/test_signage_heartbeat_event_insert.py` returns empty
  </acceptance_criteria>
  <done>Heartbeat POST inserts a log row atomically with last_seen_at update (idempotent on collision). Sweeper prunes rows older than 25 h on every tick. Both covered by passing integration tests.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: analytics.py router + signage_admin mount + 6 D-20 integration tests</name>
  <files>backend/app/routers/signage_admin/analytics.py, backend/app/routers/signage_admin/__init__.py, backend/tests/test_signage_analytics_router.py</files>
  <read_first>
    - backend/app/routers/signage_admin/schedules.py (clone the module scaffolding verbatim — router declaration, no `dependencies=` kwarg because parent supplies admin gate)
    - backend/app/routers/signage_admin/__init__.py (add analytics to the imports + include_router list)
    - backend/app/routers/signage_admin/devices.py (response_model list pattern for reference)
    - backend/app/schemas/signage.py — newly-added DeviceAnalyticsRead (Task 1)
    - backend/tests/test_signage_admin_router.py l.1–120 — admin-router integration test harness pattern
    - backend/tests/test_signage_heartbeat_event_insert.py (Task 2) — reuse `_insert_heartbeat(dsn, device_id, ts)` helper pattern
    - .planning/phases/53-analytics-lite/53-RESEARCH.md §Pattern 1 (SQL) and §Pattern 5 (router shape)
  </read_first>
  <behavior>
    **analytics.py (NEW):**
    - `router = APIRouter(prefix="/analytics/devices", tags=["signage-admin-analytics"])` — NO `dependencies=` kwarg. Parent signage_admin router supplies the admin gate.
    - Single endpoint `GET ""` → `response_model=list[DeviceAnalyticsRead]`, `async def list_device_analytics(db: AsyncSession = Depends(get_async_db_session))`.
    - Executes the bucketed SQL from research Pattern 1 (one query, LEFT JOIN from `signage_devices` to an aggregate CTE over `signage_heartbeat_event`; WHERE `d.revoked_at IS NULL` for D-07).
    - Post-processes rows:
      - `denominator = row["denominator"]` (int, 0..1440).
      - If `denominator == 0`: emit `uptime_24h_pct=None`, `missed_windows_24h=0`, `window_minutes=0`.
      - Else: `uptime_24h_pct = round((buckets_with_hb / denominator) * 100, 1)`, `missed_windows_24h = max(denominator - buckets_with_hb, 0)`, `window_minutes = denominator`.
    - Returns a list ordered by `device_id` (stable for tests) or unordered — acceptable either way; tests assert by dict lookup.

    **signage_admin/__init__.py:**
    - Add `analytics` to the package import line: `from . import devices, media, playlist_items, playlists, schedules, tags, analytics` (alphabetise to match existing style — the current line already lists them somewhat alphabetically; fit analytics at the top).
    - Add `router.include_router(analytics.router)` (order alongside existing includes — placement irrelevant for routing; group it with the admin routers alphabetically).

    **Endpoint path verification:** final mounted path = `/api/signage` (parent prefix) + `/analytics/devices` (sub-router prefix) + `""` (endpoint path) = `GET /api/signage/analytics/devices`. Matches D-08 (separate from `/admin/devices` device-CRUD router; no path collision with `devices.router`'s `/devices` prefix).

    **Tests — test_signage_analytics_router.py (NEW) — 6 scenarios from D-20:**

    1. `test_analytics_all_healthy_device_returns_100pct`: seed 1 non-revoked device + insert 1440 heartbeats (one per minute for the last 24 h). GET `/api/signage/analytics/devices` with admin JWT. Find the row matching device id. Assert `uptime_24h_pct == 100.0`, `missed_windows_24h == 0`, `window_minutes == 1440`.
    2. `test_analytics_half_uptime_720_heartbeats`: seed device + 720 heartbeats spread evenly (every 2 minutes) across the last 24 h. Assert `uptime_24h_pct == 50.0`, `missed_windows_24h == 720`, `window_minutes == 1440`.
    3. `test_analytics_partial_history_fresh_device_30_minutes`: seed device + 30 heartbeats, one per minute for the last 30 minutes (no older rows). Assert `uptime_24h_pct == 100.0`, `missed_windows_24h == 0`, `window_minutes == 30` (± 1 acceptable — tolerate minute-boundary rounding with a `range(29, 32)` check).
    4. `test_analytics_zero_heartbeat_device_null_state`: seed device + zero heartbeats. Assert the row is either present with `uptime_24h_pct is None` AND `missed_windows_24h == 0` AND `window_minutes == 0`, OR omitted entirely. Accept both per D-16 / research §"Pitfall 3" — document whichever the implementation chose.
    5. `test_analytics_revoked_device_excluded`: seed a revoked device (`revoked_at = now()`) with 1000 heartbeats. Assert the response does NOT contain that device id (D-07 server-side exclusion).
    6. `test_analytics_same_minute_duplicates_counted_once`: seed device + 2 heartbeats within the same minute (e.g. `ts=now-10min+0s` and `ts=now-10min+30s`) + 1438 heartbeats filling the other minutes. Assert `uptime_24h_pct == 100.0` (distinct-minute logic counts the duplicate minute ONCE, so 1440 distinct minutes / 1440 denominator). Also assert the raw row count in `signage_heartbeat_event` for that device is 1440 (both duplicates present in the log — the DEDUP happens in SQL via DISTINCT, not via insert rejection, because their timestamps differ).

    Each test uses the admin JWT fixture (mirror `test_signage_admin_router.py` auth setup — grep for `admin_token` / `admin_headers` / `client_as_admin` in existing tests and reuse).
  </behavior>
  <action>
    **File 1 — backend/app/routers/signage_admin/analytics.py (NEW):**

    ```python
    """Phase 53 SGN-ANA-01 — Analytics-lite devices endpoint.

    GET /api/signage/analytics/devices
      → list[DeviceAnalyticsRead]

    Computes per non-revoked device:
      - uptime_24h_pct: % of distinct minute-buckets with ≥1 heartbeat in the last 24 h
      - missed_windows_24h: denominator - buckets_with_heartbeat
      - window_minutes: min(1440, minutes since device's oldest retained heartbeat)

    Partial-history denominator (D-06) keeps fresh devices honest — a Pi
    provisioned 30 min ago shows 100 % over a 30-min window rather than a
    misleading 100 % over 24 h.

    Admin gate inherited from the parent signage_admin router (do NOT add a
    local `dependencies=` kwarg — that would double-apply and is a style
    violation per signage_admin/__init__.py docstring).
    """
    from __future__ import annotations

    from fastapi import APIRouter, Depends
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.database import get_async_db_session
    from app.schemas.signage import DeviceAnalyticsRead

    router = APIRouter(prefix="/analytics/devices", tags=["signage-admin-analytics"])

    # Bucketed uptime query — see .planning/phases/53-analytics-lite/53-RESEARCH.md
    # Pattern 1. Composite PK (device_id, ts) on signage_heartbeat_event makes
    # the WHERE ts >= cutoff + GROUP BY device_id a single PK range scan.
    _ANALYTICS_SQL = """
        WITH window_bounds AS (
            SELECT now() - interval '24 hours' AS cutoff_start,
                   now()                         AS cutoff_end
        ),
        per_device AS (
            SELECT
                he.device_id,
                COUNT(DISTINCT date_trunc('minute', he.ts)) AS buckets_with_hb,
                EXTRACT(EPOCH FROM (now() - MIN(he.ts))) / 60.0 AS first_hb_age_min
            FROM signage_heartbeat_event he, window_bounds wb
            WHERE he.ts >= wb.cutoff_start
              AND he.ts <  wb.cutoff_end
            GROUP BY he.device_id
        )
        SELECT
            d.id AS device_id,
            LEAST(1440, COALESCE(CEIL(p.first_hb_age_min)::int, 0)) AS denominator,
            COALESCE(p.buckets_with_hb, 0)::int AS buckets_with_hb
        FROM signage_devices d
        LEFT JOIN per_device p ON p.device_id = d.id
        WHERE d.revoked_at IS NULL
        ORDER BY d.id
    """


    @router.get("", response_model=list[DeviceAnalyticsRead])
    async def list_device_analytics(
        db: AsyncSession = Depends(get_async_db_session),
    ) -> list[DeviceAnalyticsRead]:
        rows = (await db.execute(text(_ANALYTICS_SQL))).mappings().all()
        out: list[DeviceAnalyticsRead] = []
        for r in rows:
            denom = int(r["denominator"])
            buckets = int(r["buckets_with_hb"])
            if denom == 0:
                out.append(
                    DeviceAnalyticsRead(
                        device_id=r["device_id"],
                        uptime_24h_pct=None,
                        missed_windows_24h=0,
                        window_minutes=0,
                    )
                )
                continue
            pct = round((buckets / denom) * 100, 1)
            missed = max(denom - buckets, 0)
            out.append(
                DeviceAnalyticsRead(
                    device_id=r["device_id"],
                    uptime_24h_pct=pct,
                    missed_windows_24h=missed,
                    window_minutes=denom,
                )
            )
        return out
    ```

    **File 2 — backend/app/routers/signage_admin/__init__.py:**
    Edit the imports line to add `analytics`, and add one `include_router` call. Minimal diff:
    ```python
    from . import analytics, devices, media, playlist_items, playlists, schedules, tags
    ...
    router.include_router(analytics.router)
    router.include_router(media.router)
    router.include_router(playlists.router)
    router.include_router(playlist_items.router)
    router.include_router(schedules.router)
    router.include_router(devices.router)
    router.include_router(tags.router)
    ```
    (Order of `include_router` calls is aesthetic — alphabetical works. Do NOT change the admin-gate dependencies on the parent router.)

    **File 3 — backend/tests/test_signage_analytics_router.py (NEW):**
    Build all 6 tests per <behavior>. Skeleton:

    ```python
    from __future__ import annotations
    import asyncio
    import uuid
    from datetime import datetime, timedelta, timezone

    import asyncpg
    import pytest

    pytestmark = pytest.mark.asyncio

    ANALYTICS_URL = "/api/signage/analytics/devices"


    async def _insert_device(dsn: str, *, revoked: bool = False) -> uuid.UUID:
        # Copy the minimal INSERT pattern from test_signage_heartbeat_sweeper.py
        # (name, pairing_status='paired', revoked_at).
        ...

    async def _insert_heartbeat(dsn: str, device_id: uuid.UUID, ts: datetime) -> None:
        ...

    async def _get_row_for(body: list[dict], device_id: uuid.UUID) -> dict | None:
        return next((r for r in body if r["device_id"] == str(device_id)), None)


    async def test_analytics_all_healthy_device_returns_100pct(client, dsn, admin_headers):
        device_id = await _insert_device(dsn)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        # Insert 1440 rows, one per minute across the last 24h (minus 1 sec to stay inside the window)
        coros = [
            _insert_heartbeat(dsn, device_id, now - timedelta(minutes=i, seconds=1))
            for i in range(1440)
        ]
        await asyncio.gather(*coros)
        resp = await client.get(ANALYTICS_URL, headers=admin_headers)
        assert resp.status_code == 200
        row = await _get_row_for(resp.json(), device_id)
        assert row is not None
        assert row["uptime_24h_pct"] == 100.0
        assert row["missed_windows_24h"] == 0
        assert row["window_minutes"] == 1440


    async def test_analytics_half_uptime_720_heartbeats(client, dsn, admin_headers):
        device_id = await _insert_device(dsn)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        # 720 rows, one per TWO minutes — 50% coverage
        coros = [
            _insert_heartbeat(dsn, device_id, now - timedelta(minutes=i*2, seconds=1))
            for i in range(720)
        ]
        await asyncio.gather(*coros)
        resp = await client.get(ANALYTICS_URL, headers=admin_headers)
        row = await _get_row_for(resp.json(), device_id)
        assert row is not None
        # Window is 24h since the oldest heartbeat is ~1438 min old → denom 1440
        assert row["window_minutes"] == 1440
        assert row["uptime_24h_pct"] == 50.0
        assert row["missed_windows_24h"] == 720


    async def test_analytics_partial_history_fresh_device_30_minutes(client, dsn, admin_headers):
        device_id = await _insert_device(dsn)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        coros = [
            _insert_heartbeat(dsn, device_id, now - timedelta(minutes=i, seconds=1))
            for i in range(30)
        ]
        await asyncio.gather(*coros)
        resp = await client.get(ANALYTICS_URL, headers=admin_headers)
        row = await _get_row_for(resp.json(), device_id)
        assert row is not None
        # Tolerate 29/30/31 due to minute-boundary rounding (CEIL on first_hb_age_min)
        assert row["window_minutes"] in range(29, 32)
        assert row["uptime_24h_pct"] == 100.0
        assert row["missed_windows_24h"] == 0


    async def test_analytics_zero_heartbeat_device_null_state(client, dsn, admin_headers):
        device_id = await _insert_device(dsn)  # no heartbeats inserted
        resp = await client.get(ANALYTICS_URL, headers=admin_headers)
        row = await _get_row_for(resp.json(), device_id)
        # D-16 allows either "omitted" or "neutral with null pct" — accept both
        if row is not None:
            assert row["uptime_24h_pct"] is None
            assert row["missed_windows_24h"] == 0
            assert row["window_minutes"] == 0


    async def test_analytics_revoked_device_excluded(client, dsn, admin_headers):
        device_id = await _insert_device(dsn, revoked=True)
        now = datetime.now(timezone.utc)
        # Even with plenty of heartbeats, the device must not appear (D-07)
        for i in range(100):
            await _insert_heartbeat(dsn, device_id, now - timedelta(minutes=i, seconds=1))
        resp = await client.get(ANALYTICS_URL, headers=admin_headers)
        assert all(r["device_id"] != str(device_id) for r in resp.json())


    async def test_analytics_same_minute_duplicates_counted_once(client, dsn, admin_headers):
        device_id = await _insert_device(dsn)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        # 1438 normal minutes
        coros = [
            _insert_heartbeat(dsn, device_id, now - timedelta(minutes=i, seconds=1))
            for i in range(1438)
        ]
        # 2 heartbeats inside the same minute bucket (different seconds → no PK collision)
        coros.append(_insert_heartbeat(dsn, device_id, now - timedelta(minutes=1438, seconds=1)))
        coros.append(_insert_heartbeat(dsn, device_id, now - timedelta(minutes=1438, seconds=30)))
        # One more to reach 1440 distinct minutes total
        coros.append(_insert_heartbeat(dsn, device_id, now - timedelta(minutes=1439, seconds=1)))
        await asyncio.gather(*coros)
        resp = await client.get(ANALYTICS_URL, headers=admin_headers)
        row = await _get_row_for(resp.json(), device_id)
        assert row is not None
        assert row["uptime_24h_pct"] == 100.0
        # Verify raw row count: both duplicates physically stored (distinct ts)
        conn = await asyncpg.connect(dsn=dsn)
        try:
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM signage_heartbeat_event WHERE device_id = $1",
                device_id,
            )
        finally:
            await conn.close()
        assert count == 1441   # 1438 + 2 (dup minute) + 1 = 1441 stored rows
    ```

    Reuse `dsn`, `client`, `admin_headers` fixtures from `backend/tests/conftest.py` — grep for their definitions and mirror the exact parameter names. If `admin_headers` isn't a fixture yet, fall back to whatever the existing `test_signage_admin_router.py` tests use to authenticate (copy verbatim).

    No `import sqlite3` / `import psycopg2` anywhere. No async-to-sync mixing.
  </action>
  <verify>
    <automated>cd backend && docker compose exec -T app pytest tests/test_signage_analytics_router.py --workers 1 -x 2>&1 | tail -40 && docker compose exec -T app python -c "from fastapi.testclient import TestClient; from app.main import app; c = TestClient(app); r = c.get('/openapi.json'); assert '/api/signage/analytics/devices' in r.json()['paths'], sorted(k for k in r.json()['paths'] if 'signage' in k); print('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `test -f backend/app/routers/signage_admin/analytics.py`
    - `grep -q 'prefix="/analytics/devices"' backend/app/routers/signage_admin/analytics.py` succeeds
    - `grep -qE "dependencies\s*=" backend/app/routers/signage_admin/analytics.py` returns EMPTY (admin gate must be inherited, not local)
    - `grep -q "COUNT(DISTINCT date_trunc('minute'" backend/app/routers/signage_admin/analytics.py` succeeds
    - `grep -q "LEAST(1440" backend/app/routers/signage_admin/analytics.py` succeeds (D-06 denominator cap)
    - `grep -q "d.revoked_at IS NULL" backend/app/routers/signage_admin/analytics.py` succeeds (D-07)
    - `grep -q "round((buckets / denom) \* 100, 1)" backend/app/routers/signage_admin/analytics.py` succeeds (1-decimal precision per RESEARCH §Precision)
    - `grep -q "analytics" backend/app/routers/signage_admin/__init__.py` succeeds AND `grep -q "router.include_router(analytics.router)" backend/app/routers/signage_admin/__init__.py` succeeds
    - OpenAPI advertises the new path: `/api/signage/analytics/devices` appears in `/openapi.json` `paths` keys
    - All 6 tests present (grep-verifiable): `grep -cE "^async def test_analytics_(all_healthy_device_returns_100pct|half_uptime_720_heartbeats|partial_history_fresh_device_30_minutes|zero_heartbeat_device_null_state|revoked_device_excluded|same_minute_duplicates_counted_once)" backend/tests/test_signage_analytics_router.py` returns 6
    - `pytest tests/test_signage_analytics_router.py --workers 1 -x` exits 0 with 6 passing
    - Full backend suite still green locally: `pytest --workers 1 -x` exits 0 (no regressions in other signage tests)
  </acceptance_criteria>
  <done>Analytics endpoint returns correct per-device analytics for all 6 D-20 scenarios; router is mounted under the admin gate; OpenAPI reflects the new path.</done>
</task>

</tasks>

<verification>
Run from repo root (all backend commands inside the `app` container):
- `docker compose exec -T app alembic upgrade head && docker compose exec -T app alembic downgrade -1 && docker compose exec -T app alembic upgrade head` → each step exits 0 (round-trip clean)
- `docker compose exec -T app pytest --workers 1 -x` → exits 0 (full backend suite; `--workers 1` hard gate)
- `docker compose exec -T app pytest tests/test_signage_analytics_router.py tests/test_signage_heartbeat_event_insert.py tests/test_signage_heartbeat_sweeper.py --workers 1 -v` → all pass
- `docker compose exec -T app python -c "from fastapi.testclient import TestClient; from app.main import app; c = TestClient(app); assert '/api/signage/analytics/devices' in c.get('/openapi.json').json()['paths']"` → exits 0
- Hard-gate checklist:
  - [ ] No `import sqlite3` / `import psycopg2` in any new/modified backend file
  - [ ] No sync `subprocess.run` in any new/modified signage service
  - [ ] Parent router `dependencies=[Depends(get_current_user), Depends(require_admin)]` unchanged; analytics sub-router has NO local `dependencies=`
  - [ ] `--workers 1` preserved in pytest invocation
- Manual smoke (optional but recommended before handing off to Plan 02): with the app running and an admin JWT in hand, `curl -H "Authorization: Bearer $ADMIN_JWT" http://localhost:8000/api/signage/analytics/devices` returns `200 [...]`.

Notes: Phase 53 was split into 2 plans (backend + frontend) despite the ROADMAP's "expect 1 plan" hint. Rationale: the backend surface (migration + model + schema + 2 route edits + 2 scheduler edits + 6 integration tests covering D-20 + docs amendment) is cohesive but meaty (~11 files modified, 3 new) and would burn >60% context in a single plan. Splitting keeps each wave at ~3 tasks and lets Plan 02's `interfaces` block pin against a committed backend contract instead of hypothesising.
</verification>

<success_criteria>
1. **SGN-ANA-01 (backend half):** `GET /api/signage/analytics/devices` returns per non-revoked-device `{device_id, uptime_24h_pct, missed_windows_24h, window_minutes}` in one bucketed SQL; admin-gated via inherited parent-router dependencies.
2. **D-01 docs amendment:** ROADMAP.md Phase 53 Goal + REQUIREMENTS.md SGN-ANA-01 both reflect the new `signage_heartbeat_event` log table; the stale "no new schema" claim is gone.
3. **D-02 / D-03 runtime behavior:** heartbeat POST inserts event row idempotently in the same txn as last_seen_at; sweeper prunes rows older than 25 h every 60 s tick.
4. **D-06 partial-history denominator:** `window_minutes` ∈ [0, 1440]; fresh-device test (30 min of heartbeats) returns `100.0%` over a 30-min window rather than 100% over 24h.
5. **D-07 revoked exclusion:** revoked-device test asserts the device id does NOT appear in the response body.
6. **D-20 six-scenario coverage:** all 6 integration tests pass under `--workers 1`.
7. **Hard gates carried forward:** no sqlite3/psycopg2 imports; no sync `subprocess.run`; single admin gate on parent router (no duplicate `dependencies=`); `--workers 1` invariant in tests.
</success_criteria>

<output>
After completion, create `.planning/phases/53-analytics-lite/53-01-SUMMARY.md` with:
- What shipped (migration head, model, schema, router path, sweeper prune, heartbeat-insert idempotency, ROADMAP + REQUIREMENTS amendments)
- Actual Alembic revision id string (verify it's `v1_18_signage_heartbeat_event`)
- Whether the zero-heartbeat device is OMITTED from the response or INCLUDED with null pct (Plan 02 needs to know which to render — this resolves the D-16 ambiguity in practice)
- Confirmation of endpoint path `/api/signage/analytics/devices` as advertised in OpenAPI
- Carry-forward for Plan 02:
  - Final `DeviceAnalyticsRead` TypeScript shape (mirror of Pydantic)
  - Whether zero-heartbeat devices need a client-side fallback render (neutral "—" badge when missing from the map)
  - Any SQL tweaks if the test data revealed precision/rounding edge cases
</output>
</content>
</invoke>