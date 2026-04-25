"""Phase 69 MIG-SIGN-03: surviving DELETE only.

POST/GET/PATCH/PUT-tags moved to Directus collections ``signage_playlists``
and ``signage_playlist_tag_map``. DELETE stays here to preserve the
structured ``409 {detail, schedule_ids}`` shape consumed by
``frontend/src/signage/components/PlaylistDeleteDialog.tsx`` (D-00
architectural lock). The ``_notify_playlist_changed`` helper is retained
per D-04b/D-05a — the surviving DELETE still fans out playlist-changed
events explicitly alongside the Phase 65 LISTEN/NOTIFY bridge.

All endpoints inherit the admin gate from the parent router.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignagePlaylist, SignageSchedule
from app.services import signage_broadcast
from app.services.signage_resolver import (
    compute_playlist_etag,
    devices_affected_by_playlist,
    resolve_playlist_for_device,
)

router = APIRouter(prefix="/playlists", tags=["signage-admin-playlists"])


# ---------------------------------------------------------------------------
# Phase 45 SGN-BE-05 broadcast fanout helper (Plan 45-02), retained per
# Phase 69 D-04b/D-05a — surviving DELETE still calls this explicitly.
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


# ---------------------------------------------------------------------------
# Surviving DELETE — preserves structured 409 ``{detail, schedule_ids}``
# (Phase 51 Plan 02 SGN-TIME-04 / RESEARCH Q2). Frontend
# PlaylistDeleteDialog consumes this exact shape.
# ---------------------------------------------------------------------------


@router.delete("/{playlist_id}", status_code=204)
async def delete_playlist(
    playlist_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
):
    """Hard delete. Returns 409 JSONResponse if signage_schedules reference the playlist.

    Phase 51 Plan 02 (SGN-TIME-04 / RESEARCH Q2): FK ``signage_schedules.playlist_id``
    is ``ON DELETE RESTRICT`` (same shape as the existing media→playlist_items FK).
    When a schedule blocks the delete, PostgreSQL raises an IntegrityError at
    commit time; we catch it and return a flat ``{detail, schedule_ids}`` body
    (mirrors the media DELETE 409 ``{detail, playlist_ids}`` convention,
    Pitfall 6 — use JSONResponse not HTTPException so the shape stays flat).
    """
    # Phase 45 D-02: capture affected devices BEFORE the delete commits — the
    # playlist-tag-map rows cascade on delete, which would make the tag-overlap
    # query return an empty list after commit. The notify fan-out happens
    # AFTER commit (Pitfall 3) using this pre-delete snapshot.
    affected = await devices_affected_by_playlist(db, playlist_id)
    try:
        result = await db.execute(
            delete(SignagePlaylist).where(SignagePlaylist.id == playlist_id)
        )
        if result.rowcount == 0:
            raise HTTPException(404, "playlist not found")
        await db.commit()
    except IntegrityError:
        await db.rollback()
        sched_rows = await db.execute(
            select(SignageSchedule.id).where(
                SignageSchedule.playlist_id == playlist_id
            )
        )
        schedule_ids = [str(sid) for sid in sched_rows.scalars().all()]
        return JSONResponse(
            status_code=409,
            content={
                "detail": "playlist has active schedules",
                "schedule_ids": schedule_ids,
            },
        )
    for device_id in affected:
        signage_broadcast.notify_device(
            device_id,
            {
                "event": "playlist-changed",
                "playlist_id": str(playlist_id),
                "etag": "deleted",
            },
        )
