"""Signage playlist CRUD + bulk-replace tags (D-18).

All endpoints inherit admin gate from parent router.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignagePlaylist, SignagePlaylistTagMap
from app.schemas.signage import SignagePlaylistCreate, SignagePlaylistRead

router = APIRouter(prefix="/playlists", tags=["signage-admin-playlists"])


class SignagePlaylistUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    description: str | None = None
    priority: int | None = None
    enabled: bool | None = None


class TagAssignmentRequest(BaseModel):
    tag_ids: list[int]


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post("", response_model=SignagePlaylistRead, status_code=201)
async def create_playlist(
    payload: SignagePlaylistCreate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignagePlaylist:
    data = payload.model_dump(exclude={"tag_ids"})
    row = SignagePlaylist(**data)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("", response_model=list[SignagePlaylistRead])
async def list_playlists(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignagePlaylist]:
    result = await db.execute(select(SignagePlaylist).order_by(SignagePlaylist.created_at))
    return list(result.scalars().all())


@router.get("/{playlist_id}", response_model=SignagePlaylistRead)
async def get_playlist(
    playlist_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignagePlaylist:
    row = (
        await db.execute(select(SignagePlaylist).where(SignagePlaylist.id == playlist_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "playlist not found")
    return row


@router.patch("/{playlist_id}", response_model=SignagePlaylistRead)
async def update_playlist(
    playlist_id: uuid.UUID,
    payload: SignagePlaylistUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignagePlaylist:
    row = (
        await db.execute(select(SignagePlaylist).where(SignagePlaylist.id == playlist_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "playlist not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{playlist_id}", status_code=204)
async def delete_playlist(
    playlist_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> None:
    result = await db.execute(
        delete(SignagePlaylist).where(SignagePlaylist.id == playlist_id)
    )
    if result.rowcount == 0:
        raise HTTPException(404, "playlist not found")
    await db.commit()


# ---------------------------------------------------------------------------
# D-18: bulk-replace tag assignments in single transaction (Pitfall 3)
# ---------------------------------------------------------------------------


@router.put("/{playlist_id}/tags")
async def replace_playlist_tags(
    playlist_id: uuid.UUID,
    payload: TagAssignmentRequest,
    db: AsyncSession = Depends(get_async_db_session),
) -> dict[str, Any]:
    exists = (
        await db.execute(select(SignagePlaylist.id).where(SignagePlaylist.id == playlist_id))
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "playlist not found")

    # Single transaction: delete existing maps, insert new ones, commit once.
    await db.execute(
        delete(SignagePlaylistTagMap).where(
            SignagePlaylistTagMap.playlist_id == playlist_id
        )
    )
    if payload.tag_ids:
        await db.execute(
            insert(SignagePlaylistTagMap),
            [
                {"playlist_id": playlist_id, "tag_id": tid}
                for tid in payload.tag_ids
            ],
        )
    await db.commit()
    return {"tag_ids": list(payload.tag_ids)}
