"""SSE fanout substrate for signage devices (SGN-BE-05, SGN-INF-03).

Per-device in-process ``asyncio.Queue`` fanout. Admin mutation hooks
(Plan 45-02) call ``notify_device(device_id, payload)``; the SSE
``GET /api/signage/player/stream`` endpoint (Plan 45-02) calls
``subscribe(device_id)`` to receive a queue it can ``await`` on. Drop-
oldest overflow (D-04) and last-writer-wins on duplicate subscribers
(D-03) match Phase 45 CONTEXT.

-----------------------------------------------------------------------
--workers 1 INVARIANT (cross-cutting hazard #4)
-----------------------------------------------------------------------

1. Single-process only. This module owns a process-local
   ``_device_queues`` dict. Running uvicorn with ``--workers N`` for any
   N > 1 gives each worker its own disjoint dict; an admin mutation
   handled in worker A will call ``notify_device`` on worker A's dict,
   but the SSE generator for a given device may be pinned to worker B
   (round-robin) — that subscriber will never see the event.

2. Why the constraint exists. SSE fanout here intentionally uses an
   in-memory per-device queue instead of Redis / pub-sub precisely so
   the small-fleet (≤5 devices) signage loop stays zero-infra. The
   trade-off is correctness requires single-process. This matches the
   existing APScheduler in-memory jobstore constraint in
   ``backend/app/scheduler.py`` and the deployment-level pin in
   ``docker-compose.yml`` (``uvicorn ... --workers 1``).

3. What breaks under multi-worker. Roughly ``(N-1)/N`` of SSE clients
   silently miss events (no error, no log — the notify side has no
   visibility into which worker owns each subscriber). The 30s polling
   loop in Plan 43 would still catch up eventually, but the SSE value
   proposition (instant playlist updates) is destroyed. Any future
   horizontal-scaling plan MUST extract the broadcast path into a
   separate container with a shared bus before bumping ``--workers``.

See ``docker-compose.yml`` (``--workers 1`` uvicorn command) and
``backend/app/scheduler.py`` (PITFALLS C-7) for the paired invariants.
"""
from __future__ import annotations

import asyncio
import logging

log = logging.getLogger(__name__)

# ROADMAP-mandated name (CONTEXT.md §D-03, ROADMAP line 256) — do NOT rename.
# Key is logically ``device_id``; runtime is whatever callers pass (Plan 02
# may use UUIDs). Type annotation follows the plan spec.
_device_queues: dict[int, asyncio.Queue] = {}


def subscribe(device_id: int) -> asyncio.Queue:
    """Register a fresh fanout queue for ``device_id`` and return it.

    D-03 (last-writer-wins): unconditionally replaces any prior queue for
    the same ``device_id``. The old generator's ``await queue.get()`` is
    cancelled by the disconnect path in the SSE endpoint (Plan 45-02);
    its ``finally`` uses ``_device_queues.pop(device_id, None)`` so it
    does NOT clobber the new registration (Pitfall 1).
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=32)
    _device_queues[device_id] = q
    return q


def notify_device(device_id: int, payload: dict) -> None:
    """Enqueue ``payload`` for ``device_id``'s subscriber. No-op if none.

    Synchronous — uses ``put_nowait`` so admin mutation handlers in
    Plan 02 can call this inside a BackgroundTasks hook without await.

    D-04 (drop-oldest + WARN-once): on ``asyncio.QueueFull`` we drop the
    FIFO-head event, emit a WARN log exactly once per connection (flag
    stashed on the queue instance), then enqueue the new payload. A new
    subscriber (via ``subscribe``) gets a fresh Queue without the flag,
    so the next connection can warn again — Pitfall 7.

    Log format uses ``%s``-style args (NOT f-strings) to satisfy the
    Phase 43 CI grep guard that forbids f-strings inside log format
    arguments.
    """
    q = _device_queues.get(device_id)
    if q is None:
        return
    try:
        q.put_nowait(payload)
    except asyncio.QueueFull:
        if not getattr(q, "_warned_full", False):
            log.warning(
                "signage broadcast queue full for device %s (depth=%s) —"
                " dropping oldest",
                device_id,
                q.qsize(),
            )
            q._warned_full = True  # type: ignore[attr-defined]
        try:
            q.get_nowait()
        except asyncio.QueueEmpty:
            pass
        q.put_nowait(payload)
