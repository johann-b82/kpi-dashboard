"""Signage media CRUD (D-16 hard delete with 409 on RESTRICT, D-21 option b).

All endpoints inherit the admin gate from the parent router. Do NOT add
the admin-role check or current-user dep here (see __init__.py).
"""
from __future__ import annotations

import logging
import shutil
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignageMedia, SignagePlaylistItem
from app.schemas.signage import SignageMediaCreate, SignageMediaRead

log = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["signage-admin-media"])


class SignageMediaAdminCreate(SignageMediaCreate):
    """Extends base create schema with optional directus_file_id (D-21 opt b).

    The directus_file_id is stored into the `uri` field as-is when `uri` is
    not provided explicitly — keeps the ORM model stable (no new column) while
    honoring D-21 registration-by-UUID.
    """

    directus_file_id: str | None = None


class SignageMediaUpdate(BaseModel):
    kind: Literal["image", "video", "pdf", "pptx", "url", "html"] | None = None
    title: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=127)
    uri: str | None = None
    duration_ms: int | None = None
    html_content: str | None = None


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post("", response_model=SignageMediaRead, status_code=201)
async def create_media(
    payload: SignageMediaAdminCreate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageMedia:
    data = payload.model_dump(exclude={"directus_file_id"})
    # D-21 option (b): if uri is not provided and directus_file_id is, use it as uri.
    if not data.get("uri") and payload.directus_file_id:
        data["uri"] = payload.directus_file_id
    row = SignageMedia(**data)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("", response_model=list[SignageMediaRead])
async def list_media(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignageMedia]:
    result = await db.execute(select(SignageMedia).order_by(SignageMedia.created_at))
    return list(result.scalars().all())


@router.get("/{media_id}", response_model=SignageMediaRead)
async def get_media(
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageMedia:
    row = (
        await db.execute(select(SignageMedia).where(SignageMedia.id == media_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "media not found")
    return row


@router.patch("/{media_id}", response_model=SignageMediaRead)
async def update_media(
    media_id: uuid.UUID,
    payload: SignageMediaUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageMedia:
    row = (
        await db.execute(select(SignageMedia).where(SignageMedia.id == media_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "media not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{media_id}", status_code=204)
async def delete_media(
    media_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
):
    """Hard delete. Returns 409 JSONResponse if playlist_items reference this media.

    Pitfall 6: use JSONResponse (not HTTPException) for the 409 body so the
    response shape is flat `{detail, playlist_ids}` rather than FastAPI's
    nested `{detail: {...}}` structure.
    """
    exists = (
        await db.execute(select(SignageMedia.id).where(SignageMedia.id == media_id))
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "media not found")

    try:
        await db.execute(delete(SignageMedia).where(SignageMedia.id == media_id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        ref_result = await db.execute(
            select(SignagePlaylistItem.playlist_id)
            .where(SignagePlaylistItem.media_id == media_id)
            .distinct()
        )
        playlist_ids = [str(pid) for pid in ref_result.scalars().all()]
        return JSONResponse(
            status_code=409,
            content={
                "detail": "media in use by playlists",
                "playlist_ids": playlist_ids,
            },
        )

    # Post-commit slide cleanup (best-effort; never rolls back the response).
    try:
        shutil.rmtree(f"/app/media/slides/{media_id}", ignore_errors=True)
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("media slide dir cleanup failed for %s: %s", media_id, exc)

    # 204 No Content
    return None
