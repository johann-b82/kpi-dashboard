"""Phase 43 SGN-BE-02 + Phase 45 SGN-BE-05/SGN-DIFF-01: device-facing endpoints.

Per CONTEXT D-02: router-level ``get_current_device`` gate applies to every
endpoint in this module. ``/playlist`` and ``/heartbeat`` landed in Phase 43;
``/stream`` (SSE) was added in Phase 45 Plan 02.

Decisions enforced here:
  - D-09: GET /playlist serves an ETag derived from the tag-resolved playlist
    envelope. When the kiosk sends ``If-None-Match`` matching the server's
    current ETag, we return 304 with an empty body.
  - D-10: GET /playlist is pure-read. It does NOT update
    ``signage_devices.last_seen_at``; heartbeat owns presence.
  - D-11 / D-12: POST /heartbeat updates ``last_seen_at``, ``current_item_id``,
    and ``current_playlist_etag``, and flips ``status`` from ``offline`` to
    ``online`` on the first heartbeat after an offline window. Returns 204.
  - Phase 45 D-01 / D-03: GET /stream pushes ``{event,playlist_id,etag}`` SSE
    frames with 15s server pings, uses last-writer-wins semantics on
    reconnect, and re-raises ``asyncio.CancelledError`` in the generator's
    finally so the per-device queue is always cleaned up.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_async_db_session
from app.models.signage import SignageDevice
from app.schemas.signage import HeartbeatRequest, PlaylistEnvelope
from app.security.device_auth import get_current_device
from app.services import signage_broadcast
from app.services.signage_resolver import (
    compute_playlist_etag,
    resolve_playlist_for_device,
)

# Router-level device-token gate (D-02). No user-auth symbols may appear in
# this module — the Phase 43 dep-audit test (Plan 05) asserts only
# ``get_current_device`` appears in the auth surface of these routes.
router = APIRouter(
    prefix="/api/signage/player",
    tags=["signage-player"],
    dependencies=[Depends(get_current_device)],
)


@router.get("/playlist", response_model=None)
async def get_device_playlist(
    request: Request,
    response: Response,
    device: SignageDevice = Depends(get_current_device),
    db: AsyncSession = Depends(get_async_db_session),
):
    """D-06 / D-07 / D-09 / D-10: tag-resolved playlist with ETag/304.

    Does NOT update ``signage_devices.last_seen_at`` (D-10). Heartbeat owns
    presence. A matching ``If-None-Match`` header short-circuits to 304 with
    an empty body.
    """
    envelope = await resolve_playlist_for_device(db, device)
    etag = compute_playlist_etag(envelope)
    quoted = f'"{etag}"'
    client_etag = request.headers.get("If-None-Match", "").strip()
    if client_etag and client_etag.strip('"') == etag:
        return Response(
            status_code=304,
            headers={"ETag": quoted, "Cache-Control": "no-cache"},
        )
    response.headers["ETag"] = quoted
    response.headers["Cache-Control"] = "no-cache"
    return envelope


@router.post("/heartbeat", status_code=204)
async def post_heartbeat(
    payload: HeartbeatRequest,
    device: SignageDevice = Depends(get_current_device),
    db: AsyncSession = Depends(get_async_db_session),
) -> Response:
    """D-11 / D-12: update presence; 204 No Content.

    Writes ``last_seen_at`` / ``current_item_id`` / ``current_playlist_etag``,
    and flips ``status`` to ``online`` if the device was previously offline.
    """
    now = datetime.now(timezone.utc)
    values: dict = {
        "last_seen_at": now,
        "current_item_id": payload.current_item_id,
        "current_playlist_etag": payload.playlist_etag,
    }
    if device.status == "offline":
        values["status"] = "online"
    await db.execute(
        update(SignageDevice)
        .where(SignageDevice.id == device.id)
        .values(**values)
    )
    await db.commit()
    return Response(status_code=204)


@router.get("/stream")
async def stream_events(
    device: SignageDevice = Depends(get_current_device),
) -> EventSourceResponse:
    """SSE: streams playlist-changed events to connected players.

    Phase 45 SGN-BE-05 / SGN-DIFF-01. Payload shape per CONTEXT D-01:
    ``{"event": "playlist-changed", "playlist_id": <int>, "etag": "<weak-etag>"}``.

    - ``signage_broadcast.subscribe`` replaces any prior queue for this
      device (D-03 last-writer-wins).
    - The ``finally`` block pops with ``None`` default so the OLD generator
      tearing down AFTER a newer connection replaced its queue does NOT
      clobber the fresh registration (RESEARCH §Pitfall 1).
    - ``asyncio.CancelledError`` MUST be re-raised — swallowing it leaves a
      zombie coroutine (RESEARCH §Pitfall 2).
    - ``ping=15`` tells sse-starlette to emit a comment-line keepalive every
      15 seconds, keeping idle intermediaries from closing the connection.
    """
    queue = signage_broadcast.subscribe(device.id)

    async def event_generator():
        try:
            while True:
                payload = await queue.get()
                yield {"data": json.dumps(payload)}
        except asyncio.CancelledError:
            raise  # MUST re-raise — per Pitfall 2
        finally:
            # D-03 last-writer-wins: pop with None default so the OLD
            # generator's finally does not delete a NEW connection's
            # freshly-subscribed queue (per 45-RESEARCH §Pattern 3 +
            # §Pitfall 1).
            signage_broadcast._device_queues.pop(device.id, None)

    return EventSourceResponse(event_generator(), ping=15)
