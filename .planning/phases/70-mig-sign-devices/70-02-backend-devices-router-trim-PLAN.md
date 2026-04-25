---
phase: 70-mig-sign-devices
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/routers/signage_admin/devices.py
autonomous: true
requirements: [MIG-SIGN-04]
must_haves:
  truths:
    - "GET /api/signage/devices is removed (404 on hit)"
    - "GET /api/signage/devices/{id} is removed (404 on hit)"
    - "PATCH /api/signage/devices/{id} (name) is removed (405/404 on hit)"
    - "DELETE /api/signage/devices/{id} is removed (405/404 on hit)"
    - "PUT /api/signage/devices/{id}/tags is removed (405/404 on hit)"
    - "PATCH /api/signage/devices/{id}/calibration STAYS and works as before"
    - "_notify_device_self helper is preserved (still defined in devices.py for surviving consumers)"
  artifacts:
    - path: "backend/app/routers/signage_admin/devices.py"
      provides: "calibration PATCH only + _notify_device_self helper + (now-unused) _attach_resolved_playlist removed"
      contains: "update_device_calibration"
  key_links:
    - from: "backend/app/routers/signage_admin/devices.py"
      to: "calibration-changed SSE"
      via: "signage_broadcast.notify_device"
      pattern: "calibration-changed"
---

<objective>
Trim `backend/app/routers/signage_admin/devices.py` so it carries ONLY the surviving `PATCH /{device_id}/calibration` route plus the `_notify_device_self` helper (retained for D-00d / D-03c). The five migrated routes (list, by-id, name PATCH, DELETE, PUT tags) are deleted; their behavior moves to Directus + the new `/api/signage/resolved/{id}` route from Plan 70-01.

Purpose: Implements MIG-SIGN-04 server-side removal — every write that the frontend now drives via Directus SDK loses its FastAPI counterpart. Calibration PATCH (D-00j) stays exactly as v1.21 ships.

Output: `devices.py` shrinks to ~80 lines (one route + one helper + Pydantic glue), matching v1.22's "Directus = shape, FastAPI = compute" boundary.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/70-mig-sign-devices/70-CONTEXT.md
@.planning/phases/70-mig-sign-devices/70-RESEARCH.md
@backend/app/routers/signage_admin/devices.py
@backend/app/services/signage_resolver.py
@backend/app/schemas/signage.py

<interfaces>
<!-- Surviving route signature (MUST be preserved verbatim) -->
From backend/app/routers/signage_admin/devices.py:122-153:
```python
@router.patch("/{device_id}/calibration", response_model=SignageDeviceRead)
async def update_device_calibration(
    device_id: uuid.UUID,
    payload: SignageCalibrationUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDeviceRead:
    # ... fetch row, update fields, commit, refresh
    # signage_broadcast.notify_device(device_id, {"event": "calibration-changed", "device_id": str(device_id)})
    # return await _attach_resolved_playlist(db, row)
```

NOTE: `update_device_calibration` returns `await _attach_resolved_playlist(db, row)` today. Since `_attach_resolved_playlist` is removed in this plan, the return MUST be reshaped. The frontend `updateDeviceCalibration` consumer (signageApi.ts:325-336) uses `apiClient<SignageDevice>(...)` and the consumer (DeviceCalibrationDialog or equivalent) reads back `current_playlist_id/name` and `tag_ids` from the response.

Decision (per D-00j "calibration PATCH unchanged"): preserve the response shape by INLINING the resolver+tag_ids logic into the calibration handler so behavior is byte-identical to v1.21. Do NOT remove fields the FE consumes.

<!-- Helper retained per D-00d / D-03c -->
From backend/app/routers/signage_admin/devices.py:29-51:
```python
async def _notify_device_self(db: AsyncSession, device_id) -> None:
    # Used by the OLD PUT /tags handler. After this plan no caller exists in
    # devices.py, but the helper is RETAINED per D-03c — Phase 71 CLEAN may
    # consolidate it with _notify_playlist_changed into a shared service.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rewrite devices.py — calibration-only + retained helper</name>
  <files>backend/app/routers/signage_admin/devices.py</files>
  <read_first>
    - backend/app/routers/signage_admin/devices.py (full current file — 195 lines)
    - backend/app/schemas/signage.py (SignageDeviceRead + SignageCalibrationUpdate definitions; verify which fields the FE consumer expects post-calibration)
    - backend/app/services/signage_resolver.py (resolve_playlist_for_device + compute_playlist_etag — STILL imported because calibration response includes resolved fields)
    - frontend/src/signage/lib/signageApi.ts (lines 320-336: updateDeviceCalibration consumer — confirms it expects SignageDevice back)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-00d, D-00j, D-03c — what to preserve)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pitfall 3 — CI guard scope)
  </read_first>
  <action>
    Rewrite `backend/app/routers/signage_admin/devices.py` to contain ONLY:

    1. Module docstring updated to reflect new scope: "Phase 70 (v1.22 MIG-SIGN-04): list/get/patch-name/delete/put-tags migrated to Directus. Only the calibration PATCH survives here. Device row CRUD lives at signage_devices Directus collection. Per-device resolved playlist lives at /api/signage/resolved/{device_id} (resolved.py)."

    2. Imports — keep ONLY what the surviving code uses:
       - `from __future__ import annotations`
       - `import uuid`
       - `from fastapi import APIRouter, Depends, HTTPException`
       - `from sqlalchemy import select`
       - `from sqlalchemy.ext.asyncio import AsyncSession`
       - `from app.database import get_async_db_session`
       - `from app.models import SignageDevice, SignageDeviceTagMap`
       - `from app.schemas.signage import SignageCalibrationUpdate, SignageDeviceRead`
       - `from app.services import signage_broadcast`
       - `from app.services.signage_resolver import resolve_playlist_for_device`

       REMOVE: `from sqlalchemy import delete, insert` (no longer used), `compute_playlist_etag` (used only by `_notify_device_self`; see Task acceptance for its retention), `BaseModel`, `Field` (Pydantic models inside this file are gone), `from typing import Any` (no return-Any).

       Actually, KEEP `compute_playlist_etag` because `_notify_device_self` still uses it (D-00d retention).

    3. `router = APIRouter(prefix="/devices", tags=["signage-admin-devices"])` — UNCHANGED.

    4. Retain `_notify_device_self(db, device_id)` exactly as today (lines 29-51) — D-00d / D-03c.

    5. DELETE these definitions entirely:
       - `SignageDeviceAdminUpdate` Pydantic class (lines 54-55)
       - `TagAssignmentRequest` Pydantic class (lines 58-59)
       - `_attach_resolved_playlist` function (lines 62-79) — its logic moves into `update_device_calibration` inline so the calibration response shape is preserved
       - `list_devices` route (lines 82-88)
       - `get_device` route (lines 91-101)
       - `update_device` route (lines 104-119) — name PATCH
       - `delete_device` route (lines 156-164)
       - `replace_device_tags` route (lines 167-194)

    6. KEEP `update_device_calibration` route, but INLINE the resolved-playlist + tag_ids logic so the response shape is unchanged:

       ```python
       @router.patch("/{device_id}/calibration", response_model=SignageDeviceRead)
       async def update_device_calibration(
           device_id: uuid.UUID,
           payload: SignageCalibrationUpdate,
           db: AsyncSession = Depends(get_async_db_session),
       ) -> SignageDeviceRead:
           """Phase 62-01 CAL-BE-03 — admin partial-update of calibration fields.

           Phase 70 D-00j: this is the ONLY device write that stays in FastAPI.
           List/get/patch-name/delete/put-tags moved to Directus; per-device
           resolved playlist moved to /api/signage/resolved/{device_id}.

           Admin gate is inherited from the package router (one source of truth per
           admin-package invariant — do NOT add a second gate). Pydantic's
           ``Literal[0, 90, 180, 270]`` on rotation rejects invalid values with
           HTTP 422 automatically (D-10 — no hand-rolled validation).

           On commit, emits a ``calibration-changed`` SSE event targeted at the
           affected device (CAL-BE-04 / D-04 / D-08). Payload is device_id only;
           full state is fetched via GET /api/signage/player/calibration.
           """
           row = (
               await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
           ).scalar_one_or_none()
           if row is None:
               raise HTTPException(404, "device not found")
           for k, v in payload.model_dump(exclude_unset=True).items():
               setattr(row, k, v)
           await db.commit()
           await db.refresh(row)
           # CAL-BE-04 / D-08: payload is device_id only (sidecar refetches).
           signage_broadcast.notify_device(
               device_id,
               {"event": "calibration-changed", "device_id": str(device_id)},
           )
           # Inline the resolved-playlist + tag_ids attachment that
           # _attach_resolved_playlist used to provide. Calibration response
           # shape is preserved verbatim from v1.21 (D-00j).
           envelope = await resolve_playlist_for_device(db, row)
           out = SignageDeviceRead.model_validate(row)
           out.current_playlist_id = envelope.playlist_id
           out.current_playlist_name = envelope.name
           tag_rows = await db.execute(
               select(SignageDeviceTagMap.tag_id).where(
                   SignageDeviceTagMap.device_id == row.id
               )
           )
           tag_ids = [tid for (tid,) in tag_rows.fetchall()]
           out.tag_ids = tag_ids or None
           return out
       ```

    The resulting file is approximately 80 lines.

    Do NOT remove `_notify_device_self` even though no in-file caller remains — it is intentionally retained per D-00d / D-03c for Phase 71 CLEAN to consolidate. Add a comment above its definition: `# Retained per Phase 70 D-03c — Phase 71 CLEAN may consolidate with _notify_playlist_changed.`
  </action>
  <acceptance_criteria>
    - `grep -c "@router.get" backend/app/routers/signage_admin/devices.py` returns 0 (list + by-id removed)
    - `grep -c "@router.patch" backend/app/routers/signage_admin/devices.py` returns 1 (calibration only)
    - `grep -c "@router.delete" backend/app/routers/signage_admin/devices.py` returns 0
    - `grep -c "@router.put" backend/app/routers/signage_admin/devices.py` returns 0
    - `grep -c "/{device_id}/calibration" backend/app/routers/signage_admin/devices.py` returns 1
    - `grep -c "_attach_resolved_playlist" backend/app/routers/signage_admin/devices.py` returns 0 (function removed; logic inlined)
    - `grep -c "_notify_device_self" backend/app/routers/signage_admin/devices.py` returns at least 1 (helper retained per D-03c)
    - `grep -c "class SignageDeviceAdminUpdate" backend/app/routers/signage_admin/devices.py` returns 0
    - `grep -c "class TagAssignmentRequest" backend/app/routers/signage_admin/devices.py` returns 0
    - `grep -c "calibration-changed" backend/app/routers/signage_admin/devices.py` returns 1
    - File line count is between 60 and 110 lines (was 195)
    - `cd backend && python -c "from app.routers.signage_admin import devices; paths = [r.path for r in devices.router.routes if hasattr(r, 'path')]; assert paths == ['/devices/{device_id}/calibration'], f'unexpected: {paths}'; print('OK')"` exits 0
    - `cd backend && python -m pytest tests/signage/ -k 'calibration' -x` passes (calibration tests still green)
  </acceptance_criteria>
  <verify>
    <automated>cd backend && python -c "from app.routers.signage_admin import devices; paths = [r.path for r in devices.router.routes if hasattr(r, 'path')]; assert paths == ['/devices/{device_id}/calibration'], f'unexpected: {paths}'; assert hasattr(devices, '_notify_device_self'), 'helper removed'; print('OK')"</automated>
  </verify>
  <done>devices.py contains exactly one route (calibration PATCH) with v1.21-equivalent response shape; _notify_device_self helper retained; all other routes + Pydantic models + helper removed; calibration tests still pass</done>
</task>

</tasks>

<verification>
- Calibration PATCH still returns SignageDeviceRead with current_playlist_id/name + tag_ids (response shape preserved per D-00j)
- All five migrated routes return 404/405 (not registered)
- _notify_device_self helper retained (Phase 71 will decide whether to consolidate)
</verification>

<success_criteria>
- File reduced to ~80 lines, single route, single retained helper
- Existing calibration test suite passes unchanged
- No regression in calibration-changed SSE behavior (Plan 70-05 will assert this)
</success_criteria>

<output>
After completion, create `.planning/phases/70-mig-sign-devices/70-02-backend-devices-router-trim-SUMMARY.md`
</output>
