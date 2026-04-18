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
from app.schemas.signage import SignageDeviceRead

router = APIRouter(prefix="/devices", tags=["signage-admin-devices"])


class SignageDeviceAdminUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)


class TagAssignmentRequest(BaseModel):
    tag_ids: list[int]


@router.get("", response_model=list[SignageDeviceRead])
async def list_devices(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignageDevice]:
    result = await db.execute(select(SignageDevice).order_by(SignageDevice.created_at))
    return list(result.scalars().all())


@router.get("/{device_id}", response_model=SignageDeviceRead)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDevice:
    row = (
        await db.execute(select(SignageDevice).where(SignageDevice.id == device_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "device not found")
    return row


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
    return {"tag_ids": list(payload.tag_ids)}
