"""Schedules admin CRUD — Phase 51 Plan 02 (SGN-TIME-04).

Inherits router-level admin gate from the parent signage_admin router (D-01).
Do NOT add a router-level admin dependency here — the parent router already
supplies ``get_current_user`` + ``require_admin``.

Post-commit SSE fanout via ``devices_affected_by_playlist`` + ``notify_device``
with event kind ``schedule-changed`` (D-02). The event kind is distinct from
``playlist-changed`` so the player/sidecar can log/trace schedule-driven
re-resolves separately even though the handler logic is identical (re-GET
/playlist and compare ETag).

Fanout invariants (Phase 45 Plan 02):
  - Every ``notify_device`` call fires AFTER ``await db.commit()``.
  - Broadcast exceptions NEVER propagate — a failed notify must not roll back
    a successful DB mutation.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SignageSchedule
from app.schemas.signage import ScheduleCreate, ScheduleRead, ScheduleUpdate
from app.services.signage_broadcast import notify_device
from app.services.signage_resolver import devices_affected_by_playlist

log = logging.getLogger(__name__)

# NO ``dependencies=`` kwarg — parent router supplies the admin gate (D-01).
router = APIRouter(prefix="/schedules", tags=["signage-admin-schedules"])

SCHEDULE_CHANGED_EVENT = "schedule-changed"


async def _fanout_schedule_changed(
    db: AsyncSession,
    *,
    schedule_id: uuid.UUID,
    playlist_ids: set[uuid.UUID],
) -> None:
    """Post-commit fanout. Broadcast failures MUST NOT propagate.

    Emits one SSE event per ``(affected_device, playlist_id)`` pair so the
    player can correlate the re-resolve to a specific playlist. When a PATCH
    changes ``playlist_id`` from A to B, callers pass ``{A, B}`` and each
    device in ``devices_affected_by_playlist(A) ∪ devices_affected_by_playlist(B)``
    receives two events (one per playlist) — the player dedupes via ETag.
    """
    try:
        for pid in playlist_ids:
            try:
                affected = await devices_affected_by_playlist(db, pid)
            except Exception:
                log.warning(
                    "devices_affected_by_playlist failed for playlist %s",
                    pid,
                    exc_info=True,
                )
                continue
            for did in affected:
                try:
                    notify_device(
                        did,
                        {
                            "event": SCHEDULE_CHANGED_EVENT,
                            "schedule_id": str(schedule_id),
                            "playlist_id": str(pid),
                        },
                    )
                except Exception:  # broadcast errors never roll back state
                    log.warning(
                        "notify_device failed for device %s", did, exc_info=True
                    )
    except Exception:
        log.warning(
            "schedule fanout failed for schedule %s", schedule_id, exc_info=True
        )


@router.post("", response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageSchedule:
    sched = SignageSchedule(
        playlist_id=body.playlist_id,
        weekday_mask=body.weekday_mask,
        start_hhmm=body.start_hhmm,
        end_hhmm=body.end_hhmm,
        priority=body.priority,
        enabled=body.enabled,
    )
    db.add(sched)
    await db.commit()
    await db.refresh(sched)
    await _fanout_schedule_changed(
        db, schedule_id=sched.id, playlist_ids={sched.playlist_id}
    )
    return sched


@router.get("", response_model=list[ScheduleRead])
async def list_schedules(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SignageSchedule]:
    stmt = select(SignageSchedule).order_by(
        SignageSchedule.priority.desc(), SignageSchedule.updated_at.desc()
    )
    return list((await db.execute(stmt)).scalars().all())


@router.get("/{schedule_id}", response_model=ScheduleRead)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageSchedule:
    sched = await db.get(SignageSchedule, schedule_id)
    if sched is None:
        raise HTTPException(404, "schedule not found")
    return sched


@router.patch("/{schedule_id}", response_model=ScheduleRead)
async def update_schedule(
    schedule_id: uuid.UUID,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_async_db_session),
) -> SignageSchedule:
    sched = await db.get(SignageSchedule, schedule_id)
    if sched is None:
        raise HTTPException(404, "schedule not found")
    old_playlist_id = sched.playlist_id
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(sched, k, v)
    # Validate merged state — DB CHECK (start_hhmm < end_hhmm) is the second
    # line of defense; we raise 422 explicitly so clients get a stable error
    # rather than a 500 / IntegrityError from the DB.
    if sched.start_hhmm >= sched.end_hhmm:
        raise HTTPException(422, "start_hhmm must be less than end_hhmm")
    await db.commit()
    await db.refresh(sched)
    playlist_ids: set[uuid.UUID] = {old_playlist_id, sched.playlist_id}
    await _fanout_schedule_changed(
        db, schedule_id=sched.id, playlist_ids=playlist_ids
    )
    return sched


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db_session),
) -> None:
    sched = await db.get(SignageSchedule, schedule_id)
    if sched is None:
        raise HTTPException(404, "schedule not found")
    playlist_id = sched.playlist_id  # capture pre-commit
    await db.delete(sched)
    await db.commit()
    await _fanout_schedule_changed(
        db, schedule_id=schedule_id, playlist_ids={playlist_id}
    )
    return None
