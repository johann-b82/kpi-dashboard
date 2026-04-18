"""Signage tag CRUD (SignageDeviceTag). FK-RESTRICT 409 shape mirrors media delete."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignageDeviceTag
from app.schemas.signage import SignageDeviceTagCreate, SignageDeviceTagRead

router = APIRouter(prefix="/tags", tags=["signage-admin-tags"])


class SignageDeviceTagUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=64)


@router.post("", response_model=SignageDeviceTagRead, status_code=201)
async def create_tag(
    payload: SignageDeviceTagCreate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDeviceTag:
    row = SignageDeviceTag(name=payload.name)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "tag name already exists") from exc
    await db.refresh(row)
    return row


@router.get("", response_model=list[SignageDeviceTagRead])
async def list_tags(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignageDeviceTag]:
    result = await db.execute(select(SignageDeviceTag).order_by(SignageDeviceTag.id))
    return list(result.scalars().all())


@router.patch("/{tag_id}", response_model=SignageDeviceTagRead)
async def update_tag(
    tag_id: int,
    payload: SignageDeviceTagUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageDeviceTag:
    row = (
        await db.execute(select(SignageDeviceTag).where(SignageDeviceTag.id == tag_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "tag not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "tag name already exists") from exc
    await db.refresh(row)
    return row


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_async_db_session),
):
    exists = (
        await db.execute(select(SignageDeviceTag.id).where(SignageDeviceTag.id == tag_id))
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "tag not found")
    try:
        await db.execute(delete(SignageDeviceTag).where(SignageDeviceTag.id == tag_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return JSONResponse(
            status_code=409,
            content={"detail": "tag in use"},
        )
    return None
