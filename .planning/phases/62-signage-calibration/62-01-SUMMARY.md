---
phase: 62-signage-calibration
plan: 01
subsystem: signage/backend
tags: [signage, calibration, alembic, sse, device-auth]
requires:
  - Phase 41 signage_devices table
  - Phase 42 mint_device_jwt / get_current_device
  - Phase 43 signage_admin package router (admin gate SSOT)
  - Phase 43 signage_player router-level device-auth dep
  - Phase 45 signage_broadcast.notify_device substrate
provides:
  - alembic revision v1_21_signage_calibration (rotation/hdmi_mode/audio_enabled columns)
  - SignageCalibrationRead / SignageCalibrationUpdate pydantic schemas
  - PATCH /api/signage/devices/{id}/calibration (admin)
  - GET /api/signage/player/calibration (device-auth)
  - calibration-changed SSE event ({event, device_id})
affects:
  - signage_devices table schema
  - SignageDeviceRead shape (+3 fields — admin GET list/single)
tech-stack:
  added: []
  patterns:
    - "Literal[0,90,180,270] on rotation → FastAPI auto-422 (D-10)"
    - "server_default on ALTER TABLE atomically backfills existing rows (D-07)"
    - "Reuse Phase 45 signage_broadcast.notify_device — no new substrate (D-04)"
    - "SSE payload is device_id only; sidecar refetches full state via player GET (D-08)"
key-files:
  created:
    - backend/alembic/versions/v1_21_signage_calibration.py
    - backend/tests/test_signage_calibration.py
  modified:
    - backend/app/models/signage.py
    - backend/app/schemas/signage.py
    - backend/app/routers/signage_admin/devices.py
    - backend/app/routers/signage_player.py
decisions:
  - "SSE event payload = {event, device_id} only per D-08 — sidecar fetches full state via GET /player/calibration"
  - "No new SSE event enum member; generic dict payload matches existing broadcast contract"
  - "hdmi_mode nullable VARCHAR(64) — NULL means 'use current' per D-02/D-07"
  - "Column-per-field over JSONB (CONTEXT discretion): type-safe, admin-UI-friendly, out-of-scope items locked"
metrics:
  duration: 221s (~3m 41s)
  completed: 2026-04-22
  tasks: 2
  files: 6
  tests_added: 12
---

# Phase 62 Plan 01: Backend Calibration Summary

Backend foundation for Phase 62 signage calibration — added rotation/hdmi_mode/audio_enabled columns to `signage_devices`, admin PATCH + device-auth player GET endpoints, and `calibration-changed` SSE emit via the Phase 45 broadcast substrate. All five CAL-BE-0N requirements are covered by 12 passing pytests.

## What Shipped

### 1. Alembic migration — `v1_21_signage_calibration`

- **Revision:** `v1_21_signage_calibration`
- **Down revision:** `v1_19_personio_weekly_default`
- **Upgrade:** adds three columns to `signage_devices`:
  - `rotation INTEGER NOT NULL DEFAULT 0` + `CHECK (rotation IN (0, 90, 180, 270))` named `ck_signage_devices_rotation`
  - `hdmi_mode VARCHAR(64) NULL` (no default — NULL = "use current" per D-02)
  - `audio_enabled BOOLEAN NOT NULL DEFAULT false`
- **Downgrade:** drops CHECK + all three columns (reverse order)
- **Backfill (D-07):** `server_default` on ALTER TABLE atomically seeds all existing rows with `rotation=0, hdmi_mode=NULL, audio_enabled=false`. No `op.execute(UPDATE)` needed. Deployed devices do not flicker.
- **Round-trip verified:** `alembic downgrade -1 && alembic upgrade head` clean.

### 2. ORM model (`backend/app/models/signage.py`)

`SignageDevice` gains three `Mapped[...]` columns after `current_playlist_etag`, plus a matching `CheckConstraint("rotation IN (0, 90, 180, 270)", name="ck_signage_devices_rotation")` in `__table_args__`.

### 3. Pydantic schemas (`backend/app/schemas/signage.py`)

```python
class SignageCalibrationRead(BaseModel):
    rotation: Literal[0, 90, 180, 270]
    hdmi_mode: str | None = None
    audio_enabled: bool
    model_config = ConfigDict(from_attributes=True)

class SignageCalibrationUpdate(BaseModel):
    rotation: Literal[0, 90, 180, 270] | None = None
    hdmi_mode: str | None = Field(default=None, max_length=64)
    audio_enabled: bool | None = None
```

`SignageDeviceRead` extended with `rotation: Literal[...] = 0`, `hdmi_mode: str | None = None`, `audio_enabled: bool = False` → CAL-BE-02 satisfied (admin GET list/single auto-include the three fields via `from_attributes=True`).

### 4. Admin PATCH — `PATCH /api/signage/devices/{id}/calibration`

- Admin gate inherited from `signage_admin` package router (single SSOT — no duplicate `require_admin`).
- Body: `SignageCalibrationUpdate` (all optional).
- Invalid rotation → 422 automatically via `Literal[0, 90, 180, 270]` (D-10 — no hand-rolled validation).
- 404 on unknown device.
- Unchanged fields preserved (partial update via `exclude_unset=True`).
- After `db.commit()`: emits `signage_broadcast.notify_device(device_id, {"event": "calibration-changed", "device_id": str(device_id)})`.
- Returns the updated `SignageDeviceRead` (with resolved playlist + tags attached, mirroring the existing `update_device` shape).

### 5. Player GET — `GET /api/signage/player/calibration`

- Device-auth via router-level `Depends(get_current_device)` on `signage_player` (D-02 / D-10).
- Returns `SignageCalibrationRead` scoped to the caller's device.
- User JWT rejected with 401 (device-auth-only router).

### 6. SSE event shape (for 62-03 sidecar consumer)

```json
{"event": "calibration-changed", "device_id": "<uuid-str>"}
```

Per D-08: device_id only. Sidecar will refetch full state via `GET /api/signage/player/calibration` on event receipt.

## Pytest Coverage (12 tests, all passing)

```
tests/test_signage_calibration.py::test_cal_be_01_migration_columns_exist_with_defaults PASSED
tests/test_signage_calibration.py::test_cal_be_01_rotation_check_constraint_rejects_45 PASSED
tests/test_signage_calibration.py::test_cal_be_02_admin_get_list_includes_calibration PASSED
tests/test_signage_calibration.py::test_cal_be_02_admin_get_single_includes_calibration PASSED
tests/test_signage_calibration.py::test_cal_be_03_patch_partial_updates_only_provided_fields PASSED
tests/test_signage_calibration.py::test_cal_be_03_patch_rejects_invalid_rotation PASSED
tests/test_signage_calibration.py::test_cal_be_03_patch_requires_admin PASSED
tests/test_signage_calibration.py::test_cal_be_03_patch_404_on_unknown_device PASSED
tests/test_signage_calibration.py::test_cal_be_04_patch_emits_calibration_changed_sse PASSED
tests/test_signage_calibration.py::test_cal_be_05_player_get_calibration_returns_caller_state PASSED
tests/test_signage_calibration.py::test_cal_be_05_player_get_calibration_scoped_to_caller PASSED
tests/test_signage_calibration.py::test_cal_be_05_player_get_calibration_requires_device_auth PASSED
============================== 12 passed in 2.27s ==============================
```

Adjacent signage tests (router-deps, player-router, admin-router, ci-guards) — 47 passed total after cleanup of pre-existing DB litter.

## Requirements Traceability

| Req ID    | Covered by                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------- |
| CAL-BE-01 | Migration v1_21_signage_calibration + `test_cal_be_01_migration_columns_exist_with_defaults` + `..._rotation_check_constraint_rejects_45` |
| CAL-BE-02 | `SignageDeviceRead` extension + `test_cal_be_02_admin_get_list_includes_calibration` + `..._single_...` |
| CAL-BE-03 | PATCH endpoint + 4 tests (partial / 422 / admin-gate / 404)                                            |
| CAL-BE-04 | `notify_device` call in PATCH handler + `test_cal_be_04_patch_emits_calibration_changed_sse`           |
| CAL-BE-05 | GET endpoint + 3 tests (returns caller state / scoped to caller / requires device auth)                 |

## Deviations from Plan

**Auto-fixed (Rule 3 — blocking):** Pre-existing DB test-data litter (orphan `signage_schedules` referencing old playlists) caused 9 errors in `test_signage_player_router.py` on fresh runs. Cleaned via a one-shot DELETE across signage tables inside the API container. Not caused by our changes; logged here for visibility. No code fix needed — just unblocked the test environment.

No plan-level deviations. Executed exactly as written (both tasks in TDD order, migration → model → schemas → endpoints → SSE).

## Downstream Hand-off

- **62-02 (admin UI):** PATCH shape and 422 semantics are stable; admin GET already carries the three fields.
- **62-03 (Pi sidecar):** SSE event shape locked per D-08; sidecar subscribes to `/api/signage/player/stream` and refetches `/api/signage/player/calibration` on `event == "calibration-changed"`.
- **62-04 (player + E2E):** Player also listens on the same stream (D-05) to flip `<video muted>`.

## Self-Check: PASSED

- FOUND: backend/alembic/versions/v1_21_signage_calibration.py
- FOUND: backend/tests/test_signage_calibration.py
- FOUND: commit 4ec0d50 (Task 1: migration + schemas)
- FOUND: commit 9a91fc9 (Task 2: endpoints + SSE)
- FOUND: 12/12 pytests passing
- FOUND: alembic upgrade/downgrade round-trip green
