"""Phase 43 SGN-BE-06: tag-to-playlist resolver.

Per CONTEXT.md D-06/D-07/D-08/D-10:

  * D-06: Return an empty envelope (``playlist_id=None``, ``items=[]``) when
    the device has no tags or when no enabled playlist targets any of the
    device's tags. Uniform response shape for the kiosk loop.
  * D-07: On a successful match, items are ordered ``position ASC`` and carry
    ``media_id``, ``kind``, ``uri``, ``duration_ms``, ``transition``,
    ``position`` — pulled from the joined ``SignageMedia`` row.
  * D-08: Pick the best enabled playlist — ``priority DESC``, tie-broken by
    ``updated_at DESC`` — ``LIMIT 1``.
  * D-10: Pure read. The resolver does NOT update the device presence
    timestamp; that's ``/heartbeat``'s job.

Also hosts ``compute_playlist_etag`` (D-09) — the SHA256 helper the player
router will use for ``If-None-Match`` short-circuits in Plan 43-04.

Schema-side note: the ORM stores item duration as ``duration_s`` (seconds),
but the wire envelope exposes ``duration_ms`` per D-07. This module is the
single conversion point (``seconds * 1000``) so the wire format stays stable
even if we later migrate the column to milliseconds.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.signage import (
    SignageDevice,
    SignageDeviceTagMap,
    SignagePlaylist,
    SignagePlaylistItem,
    SignagePlaylistTagMap,
)
from app.schemas.signage import PlaylistEnvelope, PlaylistEnvelopeItem


def _empty_envelope() -> PlaylistEnvelope:
    """Construct an empty envelope (D-06)."""
    return PlaylistEnvelope(
        playlist_id=None,
        name=None,
        items=[],
        resolved_at=datetime.now(timezone.utc),
    )


async def resolve_playlist_for_device(
    db: AsyncSession, device: SignageDevice
) -> PlaylistEnvelope:
    """Resolve the single best-matching playlist for a device (D-08).

    Returns the empty envelope when no tags / no match / match is disabled.
    Does NOT mutate the device row (D-10).
    """
    # Step 1: device tag ids.
    tag_rows = await db.execute(
        select(SignageDeviceTagMap.tag_id).where(
            SignageDeviceTagMap.device_id == device.id
        )
    )
    tag_ids = [row[0] for row in tag_rows.fetchall()]
    if not tag_ids:
        return _empty_envelope()

    # Step 2: best enabled matching playlist.
    playlist_stmt = (
        select(SignagePlaylist)
        .join(
            SignagePlaylistTagMap,
            SignagePlaylistTagMap.playlist_id == SignagePlaylist.id,
        )
        .where(
            SignagePlaylist.enabled.is_(True),
            SignagePlaylistTagMap.tag_id.in_(tag_ids),
        )
        .order_by(
            SignagePlaylist.priority.desc(),
            SignagePlaylist.updated_at.desc(),
        )
        .limit(1)
        .options(
            selectinload(SignagePlaylist.items).selectinload(
                SignagePlaylistItem.media
            )
        )
    )
    playlist = (await db.execute(playlist_stmt)).scalar_one_or_none()
    if playlist is None:
        return _empty_envelope()

    # Step 3: build envelope. ORM relationship is already ordered by
    # ``SignagePlaylistItem.position`` (see models.signage), but we sort again
    # defensively — items come via selectinload and a future relationship
    # edit shouldn't silently break envelope ordering.
    items_sorted = sorted(playlist.items, key=lambda it: it.position)
    envelope_items: list[PlaylistEnvelopeItem] = []
    for it in items_sorted:
        media = it.media
        envelope_items.append(
            PlaylistEnvelopeItem(
                media_id=it.media_id,
                kind=(media.kind if media is not None else ""),
                uri=(media.uri if (media is not None and media.uri) else ""),
                # duration_s → duration_ms (schema D-07 contract).
                duration_ms=int(it.duration_s) * 1000,
                transition=(it.transition or ""),
                position=it.position,
                # DEFECT-10: propagate html_content + slide_paths so the player
                # can render HTML and PPTX items.
                html=(media.html_content if media is not None else None),
                slide_paths=(media.slide_paths if media is not None else None),
            )
        )

    return PlaylistEnvelope(
        playlist_id=playlist.id,
        name=playlist.name,
        items=envelope_items,
        resolved_at=datetime.now(timezone.utc),
    )


async def devices_affected_by_playlist(
    db: AsyncSession, playlist_id
) -> list:
    """Return device IDs whose resolved playlist could be affected by changes to the given playlist.

    A device is affected iff its tag set overlaps the playlist's target tag set
    (via signage_playlist_tag_map + signage_device_tag_map). Exact semantics mirror
    the reverse direction of resolve_playlist_for_device() — any device that could
    have this playlist chosen by the resolver is returned, regardless of priority
    (a higher-priority rival playlist may still win; the broadcast policy is "notify
    all candidates and let the player re-resolve via /playlist ETag").

    Revoked devices (``revoked_at IS NOT NULL``) are excluded — consistent with
    the other player paths; a revoked Pi has no valid SSE session anyway.

    Output sorted for deterministic test behavior.
    """
    stmt = (
        select(SignageDeviceTagMap.device_id)
        .join(
            SignagePlaylistTagMap,
            SignagePlaylistTagMap.tag_id == SignageDeviceTagMap.tag_id,
        )
        .join(
            SignageDevice,
            SignageDevice.id == SignageDeviceTagMap.device_id,
        )
        .where(
            SignagePlaylistTagMap.playlist_id == playlist_id,
            SignageDevice.revoked_at.is_(None),
        )
        .distinct()
    )
    rows = (await db.execute(stmt)).fetchall()
    return sorted({row[0] for row in rows})


async def devices_affected_by_device_update(
    db: AsyncSession, device_id
) -> list:
    """Return ``[device_id]`` — a device's own resolved playlist changes when its tags change.

    Trivial wrapper; exists so the admin ``devices.py`` notify hook
    (Plan 45-02) has a single consistent call shape across all mutation
    types (playlist-level vs. device-level changes).
    """
    return [device_id]


def compute_playlist_etag(envelope: PlaylistEnvelope) -> str:
    """SHA256 over a deterministic tuple (D-09). Used by Plan 43-04's router.

    Returns a stable hex-digest string so ``If-None-Match`` short-circuits
    only when ``(playlist_id, item positions/durations/transitions)`` is
    unchanged. The empty envelope has its own constant etag so every
    unmatched poll still validates.
    """
    if envelope.playlist_id is None:
        return hashlib.sha256(b"empty").hexdigest()
    parts: list[str] = [str(envelope.playlist_id)]
    for it in sorted(envelope.items, key=lambda i: i.position):
        parts.append(
            f"{it.media_id}:{it.position}:{it.duration_ms}:{it.transition}"
        )
    return hashlib.sha256(
        json.dumps(parts, sort_keys=True).encode("utf-8")
    ).hexdigest()
