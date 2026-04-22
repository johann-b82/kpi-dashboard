---
phase: 62-signage-calibration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/alembic/versions/v1_21_signage_calibration.py
  - backend/app/models/signage.py
  - backend/app/schemas/signage.py
  - backend/app/routers/signage_admin/devices.py
  - backend/app/routers/signage_player.py
  - backend/tests/test_signage_calibration.py
autonomous: true
requirements:
  - CAL-BE-01
  - CAL-BE-02
  - CAL-BE-03
  - CAL-BE-04
  - CAL-BE-05
must_haves:
  truths:
    - "signage_devices table gains three calibration columns with correct defaults on existing rows"
    - "Admin GET /api/signage/devices and /api/signage/devices/{id} return rotation/hdmi_mode/audio_enabled"
    - "Admin PATCH /api/signage/devices/{id}/calibration accepts partial updates and rejects invalid rotation with 422"
    - "Calibration mutations emit a calibration-changed SSE event targeted at the affected device"
    - "Device-auth GET /api/signage/player/calibration returns the caller's current calibration JSON"
  artifacts:
    - path: "backend/alembic/versions/v1_21_signage_calibration.py"
      provides: "Migration adding rotation (INT CHECK IN (0,90,180,270) DEFAULT 0 NOT NULL), hdmi_mode (VARCHAR(64) NULL), audio_enabled (BOOLEAN DEFAULT false NOT NULL)"
    - path: "backend/app/models/signage.py"
      provides: "SignageDevice gains three mapped columns"
      contains: "rotation"
    - path: "backend/app/schemas/signage.py"
      provides: "SignageDeviceRead carries calibration fields; SignageCalibrationUpdate + SignageCalibrationRead pydantic schemas"
      contains: "class SignageCalibrationUpdate"
    - path: "backend/app/routers/signage_admin/devices.py"
      provides: "PATCH /{device_id}/calibration endpoint with 422 on bad rotation + SSE notify"
      contains: "calibration-changed"
    - path: "backend/app/routers/signage_player.py"
      provides: "GET /calibration device-auth endpoint"
      contains: "/calibration"
    - path: "backend/tests/test_signage_calibration.py"
      provides: "Pytest covering CAL-BE-01..05"
  key_links:
    - from: "signage_admin/devices.py PATCH /calibration"
      to: "signage_broadcast.notify_device"
      via: "after db.commit(), emit {event: 'calibration-changed', device_id: <uuid>}"
      pattern: "notify_device.*calibration-changed"
    - from: "signage_player.py GET /calibration"
      to: "get_current_device router-level dep"
      via: "inherits router.dependencies=[Depends(get_current_device)]"
      pattern: "router.get.\"/calibration\""
    - from: "SignageDeviceRead"
      to: "rotation/hdmi_mode/audio_enabled columns"
      via: "model_config from_attributes=True auto-serialises"
      pattern: "rotation.*hdmi_mode.*audio_enabled"
---

<objective>
Backend foundation for Phase 62 signage calibration. Add three columns to `signage_devices` via Alembic, expose them on admin GET/PATCH endpoints and on a new device-auth player GET, and emit `calibration-changed` SSE events on mutation via the existing Phase 45 broadcast substrate.

Purpose: Give the admin UI (62-02) and Pi sidecar (62-03) a real API to read/write against before they're built.

Output: Migration + model + schemas + two endpoints + one event type + pytest coverage for all 5 CAL-BE requirements.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/62-signage-calibration/62-CONTEXT.md

<interfaces>
From backend/app/models/signage.py (lines 160-202) — SignageDevice current shape:

```python
class SignageDevice(Base):
    __tablename__ = "signage_devices"
    __table_args__ = (
        CheckConstraint("status IN ('online','offline','pending')",
                        name="ck_signage_devices_status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, ...)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    device_token_hash: Mapped[str | None] = ...
    last_seen_at: Mapped[datetime | None] = ...
    revoked_at: Mapped[datetime | None] = ...
    current_item_id: Mapped[uuid.UUID | None] = ...
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'offline'"))
    current_playlist_etag: Mapped[str | None] = ...
    created_at / updated_at: standard TIMESTAMPTZ
```

From backend/app/schemas/signage.py (lines 106-128) — current SignageDeviceRead:

```python
class SignageDeviceRead(SignageDeviceBase):
    id: uuid.UUID
    last_seen_at: datetime | None = None
    revoked_at: datetime | None = None
    current_item_id: uuid.UUID | None = None
    current_playlist_id: uuid.UUID | None = None
    current_playlist_name: str | None = None
    status: Literal["online", "offline", "pending"]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

From backend/app/services/signage_broadcast.py (Phase 45 — REUSE, do NOT reinvent per D-04):
```python
def notify_device(device_id: int, payload: dict) -> None:
    # drop-oldest overflow; synchronous put_nowait; no-op if no subscriber
```

From backend/app/routers/signage_player.py (lines 49-53) — router-level device-auth gate:
```python
router = APIRouter(
    prefix="/api/signage/player",
    tags=["signage-player"],
    dependencies=[Depends(get_current_device)],
)
```

From backend/app/routers/signage_admin/devices.py (lines 104-119) — existing PATCH pattern to mirror:
```python
@router.patch("/{device_id}", response_model=SignageDeviceRead)
async def update_device(device_id, payload: SignageDeviceAdminUpdate, db): ...
    row = (await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))).scalar_one_or_none()
    if row is None: raise HTTPException(404, "device not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row
```

From backend/alembic/versions/v1_18_signage_heartbeat_event.py — recent migration style (revision strings, op.create_table, postgresql.UUID, etc.).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Alembic migration + ORM columns + pydantic schemas</name>
  <files>backend/alembic/versions/v1_21_signage_calibration.py, backend/app/models/signage.py, backend/app/schemas/signage.py</files>
  <behavior>
    - Migration upgrade() adds three columns to signage_devices:
      - rotation INTEGER NOT NULL DEFAULT 0 with CHECK (rotation IN (0, 90, 180, 270)) — per D-01, D-07
      - hdmi_mode VARCHAR(64) NULL (no default; NULL means "use current" per D-02, D-07)
      - audio_enabled BOOLEAN NOT NULL DEFAULT false — per D-03, D-07
    - Migration downgrade() drops all three columns (reverse order) and the CHECK constraint.
    - Existing rows backfilled via column server_default — no manual op.execute() UPDATE needed. Deployed devices MUST NOT flicker (D-07).
    - SignageDevice model gains three Mapped[...] columns matching the migration exactly.
    - New pydantic schemas in schemas/signage.py:
      - `SignageCalibrationRead` — {rotation: Literal[0, 90, 180, 270], hdmi_mode: str | None, audio_enabled: bool}
      - `SignageCalibrationUpdate` — all three fields optional (partial update per CAL-BE-03); rotation typed as `Literal[0, 90, 180, 270]` so FastAPI/Pydantic rejects invalid values with 422 automatically.
    - `SignageDeviceRead` gains the three calibration fields (so CAL-BE-02 is satisfied — admin GET list/single include calibration).
  </behavior>
  <action>
    1. Create backend/alembic/versions/v1_21_signage_calibration.py following the style of v1_18_signage_heartbeat_event.py (revision, down_revision pointing at whatever `alembic heads` currently returns — run `alembic heads` in backend container to confirm; most likely `v1_19_personio_weekly_default` or successor). Use `op.add_column` x3, `op.create_check_constraint("ck_signage_devices_rotation", "signage_devices", "rotation IN (0, 90, 180, 270)")`. Per D-07 the `server_default=sa.text("0")` / `sa.text("false")` backfills existing rows atomically at ALTER TABLE time — verify deployed devices keep current behaviour.

    2. Extend `class SignageDevice` in backend/app/models/signage.py by appending three Mapped columns after `current_playlist_etag` (line 191). Add a new `CheckConstraint("rotation IN (0, 90, 180, 270)", name="ck_signage_devices_rotation")` to `__table_args__`.

    3. In backend/app/schemas/signage.py after `SignageDeviceRead` (line 128): add `SignageCalibrationRead` and `SignageCalibrationUpdate`. Update `SignageDeviceRead` to include `rotation: Literal[0, 90, 180, 270]`, `hdmi_mode: str | None = None`, `audio_enabled: bool`. Use `Literal` import if not already present.

    4. Tests in backend/tests/test_signage_calibration.py: write `test_cal_be_01_migration_columns_exist_with_defaults` first (RED) — asserts column existence via `await db.execute(text("SELECT rotation, hdmi_mode, audio_enabled FROM signage_devices LIMIT 1"))` on an existing row, with defaults (0, None, False). Then implement migration + model to GREEN.
  </action>
  <verify>
    <automated>cd backend && alembic upgrade head && pytest tests/test_signage_calibration.py::test_cal_be_01_migration_columns_exist_with_defaults -x</automated>
  </verify>
  <done>Alembic migration applies cleanly on a DB cloned from prod; `SELECT rotation, hdmi_mode, audio_enabled FROM signage_devices` returns defaults (0, NULL, false) on existing rows; SignageDeviceRead serialises the three fields.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Admin PATCH /calibration endpoint + device-auth GET /calibration + SSE emitter</name>
  <files>backend/app/routers/signage_admin/devices.py, backend/app/routers/signage_player.py, backend/tests/test_signage_calibration.py</files>
  <behavior>
    - CAL-BE-03: `PATCH /api/signage/devices/{device_id}/calibration` — admin-only (inherited from signage_admin package router-level `require_admin` gate, do NOT add a second gate per admin package invariant). Body: `SignageCalibrationUpdate` (all fields optional). Validation: Pydantic's `Literal[0, 90, 180, 270]` rejects invalid rotation with HTTP 422 automatically (per D-10, no hand-rolled validation needed). Response: the updated SignageDeviceRead (mirrors existing `update_device` pattern, lines 104-119).
    - CAL-BE-04: After `db.commit()`, emit `signage_broadcast.notify_device(device_id, {"event": "calibration-changed", "device_id": str(device_id)})` — per D-08, payload is device_id only; full state fetched via GET /calibration. Reuse the Phase 45 substrate (do NOT invent a new event enum; generic dict payload matches current broadcast contract).
    - CAL-BE-05: `GET /api/signage/player/calibration` — device-auth via existing router-level `Depends(get_current_device)` (line 52). Returns `SignageCalibrationRead` for the calling device. Per D-10 this MUST live on `signage_player.py` (device-auth split from admin).
    - Partial PATCH tested: PATCH with only `rotation=90` leaves `hdmi_mode` and `audio_enabled` unchanged.
    - Invalid rotation tested: PATCH with `rotation=45` returns 422.
    - SSE emission tested: PATCH triggers exactly one `notify_device` call with `event=calibration-changed` and `device_id=<uuid as str>`.
    - Auth split tested: admin PATCH requires Directus JWT (401 without, 403 for Viewer); player GET requires device JWT.
  </behavior>
  <action>
    1. In backend/app/routers/signage_admin/devices.py, after `update_device` (line ~119) add `update_device_calibration`:
       ```python
       @router.patch("/{device_id}/calibration", response_model=SignageDeviceRead)
       async def update_device_calibration(
           device_id: uuid.UUID,
           payload: SignageCalibrationUpdate,
           db: AsyncSession = Depends(get_async_db_session),
       ) -> SignageDeviceRead:
           row = (await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))).scalar_one_or_none()
           if row is None:
               raise HTTPException(404, "device not found")
           for k, v in payload.model_dump(exclude_unset=True).items():
               setattr(row, k, v)
           await db.commit()
           await db.refresh(row)
           # CAL-BE-04 / D-04 / D-08: payload is device_id only per D-08.
           signage_broadcast.notify_device(
               device_id,
               {"event": "calibration-changed", "device_id": str(device_id)},
           )
           return await _attach_resolved_playlist(db, row)
       ```
       Import `SignageCalibrationUpdate` from app.schemas.signage at top of file.

    2. In backend/app/routers/signage_player.py, after `get_media_asset` (line ~186) add:
       ```python
       @router.get("/calibration", response_model=SignageCalibrationRead)
       async def get_device_calibration(
           device: SignageDevice = Depends(get_current_device),
       ) -> SignageCalibrationRead:
           # CAL-BE-05 / D-10 device-auth split — router-level dep scopes to caller's device.
           return SignageCalibrationRead(
               rotation=device.rotation,
               hdmi_mode=device.hdmi_mode,
               audio_enabled=device.audio_enabled,
           )
       ```
       Import `SignageCalibrationRead` from app.schemas.signage.

    3. Extend backend/tests/test_signage_calibration.py with RED-first tests for CAL-BE-02/03/04/05:
       - `test_cal_be_02_admin_get_returns_calibration_fields` — list + single GET both include the three fields.
       - `test_cal_be_03_patch_partial_update` — PATCH {rotation: 90} updates only rotation.
       - `test_cal_be_03_patch_rejects_invalid_rotation` — PATCH {rotation: 45} → 422.
       - `test_cal_be_03_patch_requires_admin` — Viewer JWT → 403 (reuses existing admin-auth test helper).
       - `test_cal_be_04_patch_emits_sse_event` — monkeypatch `signage_broadcast.notify_device` to a spy; assert called exactly once with `{"event": "calibration-changed", "device_id": str(device.id)}`.
       - `test_cal_be_05_player_get_calibration_scoped_to_caller` — device A's JWT returns device A's calibration; device B's JWT returns B's.
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_signage_calibration.py -x -v</automated>
  </verify>
  <done>All 6+ tests (one per CAL-BE req plus 422 + auth split) green. `signage_broadcast.notify_device` fires exactly once per PATCH with the D-08-shaped payload. Viewer JWT blocked. Device JWT scoped to caller.</done>
</task>

</tasks>

<verification>
Full pytest suite for calibration must be green:
```
cd backend && pytest tests/test_signage_calibration.py -v
```
Expected: 1 (Task 1) + 6 (Task 2) = 7 passing tests, one per CAL-BE-0N requirement ID at minimum.

Alembic upgrade/downgrade round-trip:
```
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
```
No errors; existing rows keep default values.

Manual smoke (not blocking, just helpful):
```
curl -X PATCH http://localhost:8000/api/signage/devices/{id}/calibration \
  -H "Authorization: Bearer $DIRECTUS_JWT" \
  -H "Content-Type: application/json" \
  -d '{"rotation": 90}'
```
Returns 200 with updated device JSON including `rotation: 90`. A connected SSE subscriber on `/api/signage/player/stream` (using that device's JWT) receives `{"event": "calibration-changed", "device_id": "..."}`.
</verification>

<success_criteria>
- Migration v1_21_signage_calibration applied; three columns present with correct constraints/defaults (D-01, D-02, D-03, D-07).
- CAL-BE-01..05 each covered by a named pytest assertion.
- PATCH validates rotation via `Literal` typing → 422 on 45/-1/360 without handwritten if-checks.
- SSE event shape is `{"event": "calibration-changed", "device_id": "<uuid-str>"}` (D-08).
- Admin PATCH lives under `/api/signage/devices/{id}/calibration` (admin JWT gate from package router — D-10).
- Player GET lives under `/api/signage/player/calibration` (device JWT gate from router-level dep — D-10).
- `signage_broadcast.notify_device` reused (D-04); no new broadcast substrate introduced.
</success_criteria>

<output>
After completion, create `.planning/phases/62-signage-calibration/62-01-SUMMARY.md` documenting:
- Migration revision ID and down_revision target
- Exact pydantic schema signatures
- SSE payload shape (for 62-03 sidecar consumer)
- Pytest run output (N passed)
</output>
