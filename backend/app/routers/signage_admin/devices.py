"""Signage device admin endpoints (list/get/patch/delete + bulk-replace tags).

Device *creation* happens via the pairing flow (Phase 42), not here.
Device *revocation* lives on the pair router (Phase 42 Plan 03); do NOT
duplicate it here.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignageDevice, SignageDeviceTagMap
from app.schemas.signage import SignageCalibrationUpdate, SignageDeviceRead
from app.services import signage_broadcast
from app.services.signage_resolver import (
    compute_playlist_etag,
    resolve_playlist_for_device,
)

router = APIRouter(prefix="/devices", tags=["signage-admin-devices"])


async def _notify_device_self(db: AsyncSession, device_id) -> None:
    """Phase 45 D-02: tell the device to refetch its own playlist.

    Used when a device's tag set changes (tag map bulk-replace) — the
    resolved playlist may flip to a different one (or none). If the resolved
    envelope has no match, we still send the sentinel so the player refetches
    /playlist and observes the empty envelope.
    """
    row = (
        await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
    ).scalar_one_or_none()
    if row is None:
        return
    envelope = await resolve_playlist_for_device(db, row)
    pid = str(envelope.playlist_id) if envelope.playlist_id is not None else ""
    signage_broadcast.notify_device(
        device_id,
        {
            "event": "playlist-changed",
            "playlist_id": pid,
            "etag": compute_playlist_etag(envelope),
        },
    )


class SignageDeviceAdminUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)


class TagAssignmentRequest(BaseModel):
    tag_ids: list[int]


async def _attach_resolved_playlist(
    db: AsyncSession, device: SignageDevice
) -> SignageDeviceRead:
    envelope = await resolve_playlist_for_device(db, device)
    out = SignageDeviceRead.model_validate(device)
    out.current_playlist_id = envelope.playlist_id
    out.current_playlist_name = envelope.name
    # Mirror the playlist tag_ids pattern from commit 877c695
    # (backend/app/routers/signage_admin/playlists.py::get_playlist) so the
    # admin Devices tab can render tag Badges by name.
    tag_rows = await db.execute(
        select(SignageDeviceTagMap.tag_id).where(
            SignageDeviceTagMap.device_id == device.id
        )
    )
    tag_ids = [tid for (tid,) in tag_rows.fetchall()]
    out.tag_ids = tag_ids or None
    return out


@router.get("", response_model=list[SignageDeviceRead])
async def list_devices(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignageDeviceRead]:
    result = await db.execute(select(SignageDevice).order_by(SignageDevice.created_at))
    devices = list(result.scalars().all())
    return [await _attach_resolved_playlist(db, d) for d in devices]


@router.get("/{device_id}", response_model=SignageDeviceRead)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDeviceRead:
    row = (
        await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "device not found")
    return await _attach_resolved_playlist(db, row)


@router.patch("/{device_id}", response_model=SignageDeviceRead)
async def update_device(
    device_id: uuid.UUID,
    payload: SignageDeviceAdminUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDevice:
    row = (
        await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "device not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{device_id}/calibration", response_model=SignageDeviceRead)
async def update_device_calibration(
    device_id: uuid.UUID,
    payload: SignageCalibrationUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDeviceRead:
    """Phase 62-01 CAL-BE-03 — admin partial-update of calibration fields.

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
    return await _attach_resolved_playlist(db, row)


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> None:
    result = await db.execute(delete(SignageDevice).where(SignageDevice.id == device_id))
    if result.rowcount == 0:
        raise HTTPException(404, "device not found")
    await db.commit()


@router.put("/{device_id}/tags")
async def replace_device_tags(
    device_id: uuid.UUID,
    payload: TagAssignmentRequest,
    db: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
    exists = (
        await db.execute(select(SignageDevice.id).where(SignageDevice.id == device_id))
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "device not found")

    await db.execute(
        delete(SignageDeviceTagMap).where(SignageDeviceTagMap.device_id == device_id)
    )
    if payload.tag_ids:
        await db.execute(
            insert(SignageDeviceTagMap),
            [
                {"device_id": device_id, "tag_id": tid}
                for tid in payload.tag_ids
            ],
        )
    await db.commit()
    # Phase 45 D-02: device tags drive resolver output — notify the device
    # itself so it refetches /playlist and picks up the new routing.
    await _notify_device_self(db, device_id)
    return {"tag_ids": list(payload.tag_ids)}
