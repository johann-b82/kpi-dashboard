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
from app.services import signage_broadcast
from app.services.signage_resolver import (
    compute_playlist_etag,
    devices_affected_by_playlist,
    resolve_playlist_for_device,
)

router = APIRouter(prefix="/playlists", tags=["signage-admin-playlists"])


# ---------------------------------------------------------------------------
# Phase 45 SGN-BE-05: broadcast fanout helpers (Plan 45-02).
#
# Pitfall 3: every notify call MUST fire AFTER ``await db.commit()``. The
# helper itself just resolves the affected devices and pushes a frame per
# device; it does NOT commit on its own.
# ---------------------------------------------------------------------------


async def _notify_playlist_changed(db: AsyncSession, playlist_id) -> None:
    """Notify all devices whose resolved playlist could be affected by this playlist.

    The device-id list is derived from tag-overlap with this playlist; we
    then resolve each device's CURRENT envelope and stamp its etag into
    the payload so the player can short-circuit if its cached etag already
    matches (e.g. a cosmetic admin save with no effective change).
    """
    affected = await devices_affected_by_playlist(db, playlist_id)
    for device_id in affected:
        # Need a SignageDevice ORM row for the resolver — load it inline.
        from app.models import SignageDevice as _Dev

        dev = (
            await db.execute(select(_Dev).where(_Dev.id == device_id))
        ).scalar_one_or_none()
        if dev is None:  # defensive; revoked devices are excluded already
            continue
        envelope = await resolve_playlist_for_device(db, dev)
        payload = {
            "event": "playlist-changed",
            "playlist_id": str(playlist_id),
            "etag": compute_playlist_etag(envelope),
        }
        signage_broadcast.notify_device(device_id, payload)


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
    # Phase 45 D-02: notify any devices that could be affected.
    await _notify_playlist_changed(db, row.id)
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
    # Phase 45 D-02: playlist mutated — fan out to all overlapping devices.
    await _notify_playlist_changed(db, playlist_id)
    return row


@router.delete("/{playlist_id}", status_code=204)
async def delete_playlist(
    playlist_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> None:
    # Phase 45 D-02: capture affected devices BEFORE the delete commits — the
    # playlist-tag-map rows cascade on delete, which would make the tag-overlap
    # query return an empty list after commit. The notify fan-out happens
    # AFTER commit (Pitfall 3) using this pre-delete snapshot.
    affected = await devices_affected_by_playlist(db, playlist_id)
    result = await db.execute(
        delete(SignagePlaylist).where(SignagePlaylist.id == playlist_id)
    )
    if result.rowcount == 0:
        raise HTTPException(404, "playlist not found")
    await db.commit()
    for device_id in affected:
        signage_broadcast.notify_device(
            device_id,
            {
                "event": "playlist-changed",
                "playlist_id": str(playlist_id),
                "etag": "deleted",
            },
        )


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
    # Capture previously-affected device set BEFORE the tag map changes —
    # otherwise devices that lose this playlist after the tag swap would
    # never learn to refetch (their tag no longer overlaps).
    prev_affected = await devices_affected_by_playlist(db, playlist_id)

    if payload.tag_ids:
        await db.execute(
            insert(SignagePlaylistTagMap),
            [
                {"playlist_id": playlist_id, "tag_id": tid}
                for tid in payload.tag_ids
            ],
        )
    await db.commit()

    # Phase 45 D-02: notify both the old overlap (so dropped devices refetch
    # and see a different resolved playlist) and the new overlap.
    new_affected = await devices_affected_by_playlist(db, playlist_id)
    union = set(prev_affected) | set(new_affected)
    for device_id in union:
        from app.models import SignageDevice as _Dev

        dev = (
            await db.execute(select(_Dev).where(_Dev.id == device_id))
        ).scalar_one_or_none()
        if dev is None:
            continue
        envelope = await resolve_playlist_for_device(db, dev)
        signage_broadcast.notify_device(
            device_id,
            {
                "event": "playlist-changed",
                "playlist_id": str(playlist_id),
                "etag": compute_playlist_etag(envelope),
            },
        )

    return {"tag_ids": list(payload.tag_ids)}
