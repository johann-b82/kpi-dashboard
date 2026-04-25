"""Phase 69 MIG-SIGN-03: surviving bulk PUT /{id}/items only (atomic DELETE+INSERT). GET moved to Directus collection `signage_playlist_items`."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignagePlaylist, SignagePlaylistItem
from app.schemas.signage import SignagePlaylistItemCreate, SignagePlaylistItemRead
from app.services import signage_broadcast
from app.services.signage_resolver import (
    compute_playlist_etag,
    devices_affected_by_playlist,
    resolve_playlist_for_device,
)

router = APIRouter(prefix="/playlists", tags=["signage-admin-playlist-items"])


async def _notify_playlist_changed(db: AsyncSession, playlist_id) -> None:
    """Phase 45 D-02: fan out playlist-changed to every overlapping device."""
    affected = await devices_affected_by_playlist(db, playlist_id)
    for device_id in affected:
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


class BulkReplaceItemsRequest(BaseModel):
    items: list[SignagePlaylistItemCreate]


@router.put("/{playlist_id}/items", response_model=list[SignagePlaylistItemRead])
async def bulk_replace_playlist_items(
    playlist_id: uuid.UUID,
    payload: BulkReplaceItemsRequest,
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignagePlaylistItem]:
    """Atomic replace: DELETE all existing items, INSERT new items, single commit.

    Pitfall 3: one transaction end-to-end so a partial failure does not leave
    the playlist half-empty.
    """
    exists = (
        await db.execute(select(SignagePlaylist.id).where(SignagePlaylist.id == playlist_id))
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(404, "playlist not found")

    await db.execute(
        delete(SignagePlaylistItem).where(
            SignagePlaylistItem.playlist_id == playlist_id
        )
    )
    new_rows: list[SignagePlaylistItem] = []
    for item in payload.items:
        row = SignagePlaylistItem(
            playlist_id=playlist_id,
            media_id=item.media_id,
            position=item.position,
            duration_s=item.duration_s,
            transition=item.transition,
        )
        db.add(row)
        new_rows.append(row)

    await db.commit()
    for row in new_rows:
        await db.refresh(row)
    new_rows.sort(key=lambda r: r.position)
    # Phase 45 D-02: item set changed -> notify affected devices AFTER commit.
    await _notify_playlist_changed(db, playlist_id)
    return new_rows
