# Phase 45: SSE Broadcast - Research

**Researched:** 2026-04-19
**Domain:** Server-Sent Events, asyncio.Queue fanout, FastAPI/sse-starlette, single-process invariant
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Event Payload**
SSE `data:` is a compact JSON object: `{"event": "playlist-changed", "playlist_id": <int>, "etag": "<weak-etag>"}`. Symmetrical with Phase 43 ETag contract. Players skip the `/playlist` refetch on etag match.

**D-02: Broadcast Trigger Scope**
Fire `playlist-changed` on any mutation that can change `resolve_playlist_for_device()` output:
- Playlist CRUD: `POST/PUT/DELETE /api/signage/admin/playlists[/{id}]`
- Playlist-item mutations: add/remove/reorder items, per-item duration/transition changes
- Media mutations that change what gets served: metadata edits, reconvert-done transition (`pptx status: processing → done`)
- Device tag changes: `PUT /api/signage/admin/devices/{id}` when `tags` field changes
- NOT fired on: cosmetic-only fields that don't affect the resolved playlist
- Polling (30s, Phase 43) remains the safety net for anything missed

**D-03: Multi-Connection Policy**
Last-writer-wins on duplicate `device_id` SSE connections. When a second stream opens for the same `device_id`, the old queue is replaced in `_device_queues: dict[int, asyncio.Queue]` and the old generator's blocked `await queue.get()` is cancelled, triggering its `finally` cleanup.

**D-04: Queue-Full Drop Policy**
On `QueueFull`: drop the **oldest** queued event (`queue.get_nowait()` to discard, then `queue.put_nowait(new)`), NOT the newest. Log at WARN on the first drop per connection (per-queue flag); subsequent drops are silent until reconnect. Log must include `device_id` and queue depth at drop time.

### Claude's Discretion

- Internal queue naming (`_device_queues` is ROADMAP-mandated; sub-names like `notify_device(...)` / `subscribe(device_id)` are implementation detail).
- Exact ping string (`": ping\n\n"` vs `": keepalive\n\n"` — any SSE comment works).
- Test-suite structure (unit tests for queue policies + one integration test for the full mutation → event round-trip; plan can split however is cleanest).
- Whether `notify_device` is a sync/async helper or a module-level function vs class method — planner decides.
- Exact inline-comment wording for the `--workers 1` invariant block.

### Deferred Ideas (OUT OF SCOPE)

- Multi-worker SSE fanout (Redis pub/sub or similar) — permanently out of scope per `--workers 1` invariant.
- Admin-side dashboard of currently-connected SSE devices — Phase 46 concern.
- Server-Sent Event types beyond `playlist-changed` — future phase.
- Client-side reconnect/backoff behavior — Phase 47 (Player Bundle) concern.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-BE-05 | `backend/app/services/signage_broadcast.py` — in-process `asyncio.Queue` per device with `QueueFull` drop + reconnect (compatible with `max_instances=1`/`--workers 1` invariant) | Standard Python asyncio pattern; `sse-starlette==3.2.0` `EventSourceResponse` generator; per-device `dict[int, asyncio.Queue]` fanout |
| SGN-DIFF-01 | Real-time SSE push (covered by SGN-BE-02 + SGN-PLY-06; reserved ID for audit / ticket tracing) | `EventSourceResponse` from `sse-starlette`; 15s ping param; `GET /api/signage/player/stream` endpoint in existing player router |
| SGN-INF-03 | `--workers 1` invariant preserved and documented inline — comment block in `signage_broadcast.py` mirroring `docker-compose.yml` and `scheduler.py` | Pattern already established in `scheduler.py` (see Architecture Patterns); broadcast module's in-process Queue only works single-process |
</phase_requirements>

---

## Summary

Phase 45 adds server-side real-time push to the existing polling-only signage loop. The core mechanism is a per-device `asyncio.Queue(maxsize=32)` dictionary (`_device_queues`) managed by a new singleton service module `backend/app/services/signage_broadcast.py`. When an admin mutation fires, the broadcast service resolves affected devices via tag-overlap logic and enqueues a compact JSON event. The existing `sse-starlette==3.2.0` `EventSourceResponse` library (already in the project's requirements per SGN-BE-02) wraps an async generator that `await`s on the device's queue and yields SSE data frames; the server sends a 15s `: ping` keepalive automatically via the `ping` parameter.

The architecture is deliberately constrained to single-process in-memory queues because the project has a hard `--workers 1` uvicorn invariant. This invariant is shared by APScheduler and the PPTX `asyncio.Semaphore(1)`; `signage_broadcast.py` must carry the same inline comment block explaining the constraint. Polling (Phase 43, 30s cadence) remains the safety net — the SSE path is an acceleration, not a replacement.

All upstream dependencies are complete: Phase 43 delivered `resolve_playlist_for_device()`, `compute_playlist_etag()`, the admin mutation routers, the player router, and the device-token auth dependency. Phase 44 delivered the PPTX reconvert-done state transition that is a D-02 trigger. Phase 45 needs only to wire a `finally`-block queue cleanup, add `notify_device` hooks to every D-02 admin mutation endpoint, and extend the CI grep guards.

**Primary recommendation:** Build `signage_broadcast.py` as a module-level dict + two public functions (`subscribe(device_id)` → `asyncio.Queue` and `notify_device(device_id, payload)`) with drop-oldest overflow handling; expose `GET /api/signage/player/stream` in the existing `signage_player.py` router; hook `notify_device` calls into admin mutators after DB commit.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sse-starlette | 3.2.0 (pinned in SGN-BE-02) | `EventSourceResponse` wrapping an async generator; 15s ping | Already in the project via Phase 43 SGN-BE-02; purpose-built for FastAPI SSE |
| asyncio (stdlib) | Python 3.11 (container) | `asyncio.Queue`, `asyncio.QueueFull`, `asyncio.CancelledError` | No additional dependency; all needed primitives are in stdlib |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastapi | 0.135.3 (locked) | Route registration, `Depends(get_current_device)` | Existing router; SSE endpoint added to `signage_player.py` |
| logging (stdlib) | — | Structured WARN log on first queue drop per connection | Already enforced by project pattern: `logging.getLogger(__name__)`, no f-strings in format arg |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process `asyncio.Queue` | Redis pub/sub | Redis pub/sub works across workers but violates `--workers 1` invariant; permanently deferred per CONTEXT |
| Module-level dict | Class-based manager | Class adds no value at `--workers 1`; module-level dict is simpler and matches `signage_pptx.py` / `signage_resolver.py` pattern |
| `sse-starlette` | Raw Starlette `StreamingResponse` | `sse-starlette` handles ping, disconnect detection, and SSE framing automatically; already a dep |

**Installation:** `sse-starlette==3.2.0` is already in `requirements.txt` (added in Phase 43 per SGN-BE-02). No new packages needed.

---

## Architecture Patterns

### Recommended File Layout

```
backend/app/
├── services/
│   ├── signage_broadcast.py    # NEW — per-device queue dict, notify_device(), subscribe()
│   ├── signage_resolver.py     # EXISTING — resolve_playlist_for_device(), compute_playlist_etag()
│   └── signage_pptx.py         # EXISTING — convert_pptx() (trigger source for D-02 media reconvert)
├── routers/
│   ├── signage_player.py       # EXISTING — add GET /stream endpoint here
│   └── signage_admin/
│       ├── playlists.py        # EXISTING — add notify hooks after commit
│       ├── playlist_items.py   # EXISTING — add notify hooks after commit
│       ├── media.py            # EXISTING — add notify hooks after commit on reconvert-done
│       └── devices.py          # EXISTING — add notify hooks after tag change commit
backend/tests/
├── test_signage_broadcast.py   # NEW — queue policies + lifecycle tests
└── test_signage_ci_guards.py   # EXISTING — extend with signage_broadcast.py assertions
```

### Pattern 1: signage_broadcast.py Service Module Shape

**What:** Module-level dict of per-device queues, two public functions. Matches singleton pattern of `signage_pptx.py` (`_CONVERSION_SEMAPHORE`, `SLIDES_ROOT`) and `signage_resolver.py`.

**When to use:** Always — this is the only implementation shape for `--workers 1`.

```python
# Source: project pattern (signage_pptx.py, scheduler.py) + asyncio stdlib
import asyncio
import logging

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# INVARIANT: --workers 1 required
#
# This module uses an in-process asyncio.Queue per device. With N>1 uvicorn
# workers each process gets its own _device_queues dict. A notify_device()
# call in process A will NOT reach SSE generators in process B.
#
# The same constraint applies to:
#   - APScheduler (in-memory jobstore, max_instances=1, scheduler.py)
#   - PPTX semaphore (asyncio.Semaphore(1), signage_pptx.py)
#   - docker-compose.yml: command: uvicorn ... --workers 1
#
# If horizontal scaling is ever needed, extract SSE fanout to a Redis
# pub/sub channel first (see DEFERRED in 45-CONTEXT.md).
# ---------------------------------------------------------------------------

_device_queues: dict[int, asyncio.Queue] = {}


def subscribe(device_id: int) -> asyncio.Queue:
    """Create (or replace) the per-device queue and return it (D-03 last-writer-wins)."""
    q: asyncio.Queue = asyncio.Queue(maxsize=32)
    _device_queues[device_id] = q
    return q


def notify_device(device_id: int, payload: dict) -> None:
    """Put payload onto device queue; drop oldest on QueueFull (D-04)."""
    q = _device_queues.get(device_id)
    if q is None:
        return
    try:
        q.put_nowait(payload)
    except asyncio.QueueFull:
        if not getattr(q, "_warned_full", False):
            log.warning(
                "signage broadcast queue full for device %s (depth=%s) — dropping oldest",
                device_id,
                q.qsize(),
            )
            q._warned_full = True  # noqa: SLF001
        try:
            q.get_nowait()          # discard oldest
        except asyncio.QueueEmpty:
            pass
        q.put_nowait(payload)       # guaranteed to fit now
```

**Key details:**
- `q._warned_full` attribute tracks first-drop-per-connection; cleared implicitly when queue is replaced on reconnect (D-03).
- `notify_device` is synchronous — it uses `put_nowait` (non-blocking). It is safe to call from async mutation handlers without `await`.
- Log call uses `%s` format args (not f-string) — matches CI grep guard established in Phase 43 (no f-strings in the format string).

### Pattern 2: SSE Generator with finally Cleanup

**What:** The `GET /api/signage/player/stream` endpoint returns `EventSourceResponse(generator())`. The generator blocks on `await queue.get()` and yields JSON events. On client disconnect, `sse-starlette` cancels the generator (raises `asyncio.CancelledError`). The `finally` block removes the device's entry from `_device_queues`.

```python
# Source: sse-starlette docs + project patterns (signage_player.py router shape)
from sse_starlette.sse import EventSourceResponse
import json

from app.services import signage_broadcast

@router.get("/stream")
async def stream_events(
    device: SignageDevice = Depends(get_current_device),
) -> EventSourceResponse:
    """SSE: streams playlist-changed events to connected players (SGN-BE-05)."""
    queue = signage_broadcast.subscribe(device.id)

    async def generator():
        try:
            while True:
                payload = await queue.get()
                yield {"data": json.dumps(payload)}
        except asyncio.CancelledError:
            raise   # MUST re-raise — swallowing prevents task cancellation
        finally:
            # D-03: clean up queue on disconnect (verified by test)
            signage_broadcast._device_queues.pop(device.id, None)

    return EventSourceResponse(generator(), ping=15)
```

**Key detail:** `ping=15` sets a 15-second `: ping\n\n` SSE comment via `sse-starlette`'s built-in keepalive. This satisfies success criterion #1 without any custom implementation.

**Key detail:** `asyncio.CancelledError` MUST be re-raised after cleanup. The `sse-starlette` docs explicitly warn that swallowing it prevents proper task cancellation and causes resource leaks.

### Pattern 3: D-03 Last-Writer-Wins on Reconnect

**What:** When a second SSE connection arrives for the same `device_id`, `subscribe(device_id)` replaces `_device_queues[device_id]` with a fresh `asyncio.Queue`. The old generator's `await queue.get()` is eventually cancelled (by the disconnect path for the old connection). The `finally` block calls `_device_queues.pop(device.id, None)` — the `None` default prevents a `KeyError` when the new connection has already replaced the entry.

**Why `None` default matters:** Without the default, the `finally` in the old generator would delete the NEW queue (registered by the new connection), leaving `_device_queues` empty for that device.

### Pattern 4: Admin Mutation Notify Hooks

**What:** After each successful DB commit in a D-02 mutation handler, call `notify_device(device_id, {...})` for every affected device. The "affected devices" lookup requires a `devices_affected_by_mutation(...)` helper (to be added to `signage_resolver.py` or `signage_broadcast.py`) that is the inverse of `resolve_playlist_for_device()`: given a playlist_id or tag change, return device IDs whose resolved playlist *could* have changed.

**Insertion point:** After `await db.commit()`, before `return row` — this is the cleanest pattern, already established in the admin routers.

```python
# After commit in playlists.py PUT handler:
await db.commit()
await db.refresh(row)
# SSE notify all devices whose resolved playlist might have changed
affected = await devices_affected_by_playlist(db, playlist_id=row.id)
for device_id in affected:
    signage_broadcast.notify_device(device_id, {
        "event": "playlist-changed",
        "playlist_id": str(row.id),
        "etag": compute_playlist_etag_for_device(device_id),  # or re-resolve
    })
return row
```

**Note on payload etag:** D-01 specifies the etag in the event payload. The simplest correct approach is to re-run `resolve_playlist_for_device()` + `compute_playlist_etag()` per affected device. At ≤5 devices this is trivially fast. Alternatively, compute a playlist-level hash and let the player ignore it if it happens to match. The planner should decide which approach avoids an extra DB round-trip per device.

### Anti-Patterns to Avoid

- **Swallowing `asyncio.CancelledError`:** Prevents generator cancellation; causes the SSE generator coroutine to keep running after disconnect.
- **`await queue.get()` outside try/finally:** If the finally block is missing or conditional, disconnect won't clean up `_device_queues`, causing a memory leak that grows with reconnects.
- **Deleting `_device_queues[device.id]` without `.pop(..., None)`:** In the D-03 last-writer-wins case, the finally of the old generator would delete the new connection's queue.
- **Calling `notify_device` before `await db.commit()`:** Events would fire for changes that might roll back; players would refetch and get stale data.
- **Using `await queue.put(payload)` (blocking put) in notify_device:** Would block the async mutation handler's event loop if the queue is full — use `put_nowait` with explicit overflow handling instead.
- **f-strings in log format args:** Violates Phase 43 CI grep guard pattern; use `%s` style.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE framing, ping/keepalive | Custom `StreamingResponse` with manual `data: ...\n\n` formatting | `sse-starlette` `EventSourceResponse(generator(), ping=15)` | Already a dependency (SGN-BE-02); handles ping, disconnect detection, SSE comment framing |
| Client disconnect detection | Manual `request.is_disconnected()` polling loop | `sse-starlette`'s built-in `_listen_for_disconnect` task + `CancelledError` propagation | Library handles ASGI `http.disconnect` detection automatically |
| Multi-device broadcast | Custom pub/sub layer | Module-level `dict[int, asyncio.Queue]` | Simpler; sufficient for ≤5 devices; Redis would violate `--workers 1` invariant |

---

## Common Pitfalls

### Pitfall 1: `finally` Deletes the Wrong Queue on Reconnect
**What goes wrong:** A device reconnects (new SSE connection), creating a new queue entry in `_device_queues`. The old generator's `finally` block runs and deletes the entry — but it now deletes the NEW connection's queue.
**Why it happens:** `_device_queues.pop(device.id)` without a default raises `KeyError` if already gone, OR with `del` unconditionally removes whatever is currently registered.
**How to avoid:** Use `_device_queues.pop(device.id, None)` — the `None` default is the entire fix.
**Warning signs:** Test that connects, reconnects, and asserts `_device_queues` has exactly one entry will fail.

### Pitfall 2: Swallowing `asyncio.CancelledError`
**What goes wrong:** Generator catches `CancelledError` but doesn't re-raise it. The generator loop continues running, consuming queue items, leaking memory.
**Why it happens:** Treating `CancelledError` like any other exception; forgetting it is the cooperative cancellation signal.
**How to avoid:** Always `raise` after cleanup in the `except asyncio.CancelledError` block, or rely only on `finally` without catching it.
**Warning signs:** Disconnect test shows `_device_queues` cleaned up but resource leak still present; generator task not appearing as done.

### Pitfall 3: Notify Hook Fires Before DB Commit
**What goes wrong:** Player receives `playlist-changed`, fetches `/player/playlist`, gets stale (pre-commit) data.
**Why it happens:** Placing the notify call before `await db.commit()`.
**How to avoid:** All notify calls must come strictly after a successful `await db.commit()`.

### Pitfall 4: `notify_device` with Blocking `await queue.put()`
**What goes wrong:** If a player's queue is full and `await queue.put()` is used, the admin mutation handler blocks until the player drains its queue. Under `--workers 1` this blocks the entire event loop.
**Why it happens:** Using the blocking put instead of `put_nowait`.
**How to avoid:** Always use `queue.put_nowait()` in `notify_device` with explicit `QueueFull` handling (drop-oldest per D-04).

### Pitfall 5: CI Guard Failure — `signage_broadcast.py` Triggers Grep Guards
**What goes wrong:** `test_scanner_actually_finds_signage_files` expects `len(signage_modules) >= 3`; the new file adds to this set automatically (passes). However, the Phase 44 extended guard `test_phase44_pptx_service_uses_async_subprocess_only` only checks `signage_pptx.py` specifically. The planner must add a Phase 45 guard asserting `signage_broadcast.py` does not contain `subprocess.run` (it won't, but pinning it is the pattern).
**How to avoid:** Extend `test_signage_ci_guards.py` with a Phase 45 block that asserts `signage_broadcast.py` exists and contains `asyncio.Queue` + `_device_queues`.

### Pitfall 6: dep-audit test Fails for `/stream`
**What goes wrong:** `test_signage_player_routes_have_get_current_device` asserts `len(found) >= 2`. Adding `/stream` raises this to 3. The test uses `>=` so it stays green. However, `test_signage_admin_routes_have_require_admin` will fail if `/stream` is accidentally registered under the admin router prefix instead of the player router.
**How to avoid:** Register `GET /stream` in `signage_player.py` (the existing player router under `/api/signage/player`), not in a new router. Dep-audit test verifies `get_current_device` is in the tree.

### Pitfall 7: `_warned_full` Flag Not Reset on Reconnect
**What goes wrong:** `_warned_full` attribute set on old queue object. Since `subscribe()` creates a fresh `asyncio.Queue()`, the new queue has no `_warned_full` attribute — `getattr(q, "_warned_full", False)` returns `False` for the new queue. This is the correct behavior; no action needed. But if the developer copies the queue object instead of creating a new one, the flag persists.
**How to avoid:** Always `asyncio.Queue(maxsize=32)` in `subscribe()` — never copy or reuse the old queue object.

---

## Code Examples

Verified patterns from existing project code and official sources:

### Existing `compute_playlist_etag` (reuse for D-01 payload)
```python
# Source: backend/app/services/signage_resolver.py (Phase 43, verified)
def compute_playlist_etag(envelope: PlaylistEnvelope) -> str:
    if envelope.playlist_id is None:
        return hashlib.sha256(b"empty").hexdigest()
    parts: list[str] = [str(envelope.playlist_id)]
    for it in sorted(envelope.items, key=lambda i: i.position):
        parts.append(f"{it.media_id}:{it.position}:{it.duration_ms}:{it.transition}")
    return hashlib.sha256(json.dumps(parts, sort_keys=True).encode("utf-8")).hexdigest()
```

### `--workers 1` invariant comment block (existing pattern to mirror)
```python
# Source: backend/app/scheduler.py (Phase 43 confirmed)
# APScheduler runs in-process with an in-memory jobstore — `--workers 1`
# is mandatory. N workers would run every scheduled job N times...
# docker-compose.yml enforces this with `command: uvicorn ... --workers 1`
```

### `asyncio.QueueFull` drop-oldest pattern
```python
# Source: asyncio stdlib semantics + D-04 decision
try:
    q.put_nowait(payload)
except asyncio.QueueFull:
    if not getattr(q, "_warned_full", False):
        log.warning("queue full for device %s (depth=%s)", device_id, q.qsize())
        q._warned_full = True
    try:
        q.get_nowait()   # discard oldest
    except asyncio.QueueEmpty:
        pass
    q.put_nowait(payload)  # now fits (queue was full, we removed one)
```

### Phase 43 admin router pattern (notify hook insertion point)
```python
# Source: backend/app/routers/signage_admin/playlists.py (verified)
@router.patch("/{playlist_id}", response_model=SignagePlaylistRead)
async def update_playlist(...) -> SignagePlaylist:
    ...
    await db.commit()
    await db.refresh(row)
    return row
    # Phase 45 adds: notify affected devices HERE, between refresh and return
```

### `finally` cleanup — verified pattern
```python
# Source: sse-starlette docs + asyncio stdlib
async def generator():
    try:
        while True:
            payload = await queue.get()
            yield {"data": json.dumps(payload)}
    except asyncio.CancelledError:
        raise   # MUST re-raise
    finally:
        _device_queues.pop(device.id, None)   # None default = D-03 safety
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `StreamingResponse` with manual SSE framing | `sse-starlette` `EventSourceResponse` | Ping, disconnect, framing handled automatically |
| Queue blocking `await put()` in fanout | `put_nowait()` with explicit `QueueFull` catch | Event loop never blocked by slow clients |
| `except asyncio.CancelledError: pass` | Always re-raise `CancelledError` | Prevents generator zombie after disconnect |

---

## Upstream Code Inventory

Key existing files the planner must account for:

| File | Status | Phase 45 Action |
|------|--------|-----------------|
| `backend/app/services/signage_resolver.py` | EXISTS — `resolve_playlist_for_device()`, `compute_playlist_etag()` | Add sibling `devices_affected_by_playlist(db, playlist_id)` helper |
| `backend/app/routers/signage_player.py` | EXISTS — `/playlist`, `/heartbeat` with router-level `Depends(get_current_device)` | Add `GET /stream` endpoint here |
| `backend/app/routers/signage_admin/playlists.py` | EXISTS — PATCH/DELETE endpoints | Add `notify_device` calls after each commit |
| `backend/app/routers/signage_admin/playlist_items.py` | EXISTS — bulk-replace items | Add `notify_device` calls after commit |
| `backend/app/routers/signage_admin/media.py` | EXISTS — media CRUD | Add `notify_device` on reconvert-done state transition |
| `backend/app/routers/signage_admin/devices.py` | EXISTS — device PATCH + tag replace | Add `notify_device` when `tags` field changes |
| `backend/app/scheduler.py` | EXISTS — has `--workers 1` invariant comment (3 points) | No change; `signage_broadcast.py` mirrors same comment |
| `backend/tests/test_signage_ci_guards.py` | EXISTS — Phase 44 extension pattern | Extend with Phase 45 assertions for `signage_broadcast.py` |
| `backend/tests/test_signage_router_deps.py` | EXISTS — checks `len(found) >= 2` player routes | `/stream` addition raises count to 3; test stays green (`>=` threshold) |
| `backend/requirements.txt` | EXISTS — no `sse-starlette` yet | ADD `sse-starlette==3.2.0` (currently missing — see below) |

**IMPORTANT: `sse-starlette` is NOT in `requirements.txt`.**
Reviewing `backend/requirements.txt`, the file does not contain `sse-starlette`. While SGN-BE-02 specified `sse-starlette==3.2.0`, it was apparently not added during Phase 43 execution. The **first task of Phase 45 must add `sse-starlette==3.2.0` to `requirements.txt`** and rebuild the Docker image. Without it, `from sse_starlette.sse import EventSourceResponse` will fail at import.

---

## Open Questions

1. **`devices_affected_by_playlist(db, playlist_id)` — where does it live?**
   - What we know: Needed by admin mutation hooks to find which devices to notify. Inverse of `resolve_playlist_for_device()`.
   - What's unclear: Should it live in `signage_resolver.py` (alongside the forward resolver) or in `signage_broadcast.py`?
   - Recommendation: Put it in `signage_resolver.py` to keep all tag-overlap logic co-located; import it into the admin routers alongside `compute_playlist_etag`.

2. **D-01 etag field in the SSE payload — how to compute it per device?**
   - What we know: D-01 requires `{"event": "playlist-changed", "playlist_id": ..., "etag": "..."}`. The etag is device-specific (depends on tag-overlap resolution).
   - Options: (a) Re-run `resolve_playlist_for_device()` + `compute_playlist_etag()` per affected device (1 extra DB round-trip per device); (b) compute a playlist-level hash (simpler, slightly less precise — players may do an unnecessary refetch if the etag doesn't match their cached value).
   - Recommendation: Option (a) at ≤5 devices is trivially cheap and matches D-01 exactly. The planner should confirm this is the intent.

3. **Concurrency test for success criterion #1 (5 clients, p95 < 100ms)**
   - What we know: CONTEXT.md §Specific Ideas says "planner must include a lightweight benchmark or concurrency test, not just unit tests."
   - What's unclear: Whether this is a standalone `httpx` async test or requires `pytest-anyio` / `asyncio.gather` setup.
   - Recommendation: Use `asyncio.gather` with 5 concurrent `httpx.AsyncClient.get("/api/health")` calls inside a single pytest-asyncio test; measure wall-clock time. This is lightweight and matches the existing test harness patterns (asyncpg for seeding, AsyncSessionLocal for ORM).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `sse-starlette==3.2.0` | `GET /api/signage/player/stream` | NOT IN requirements.txt | — | No fallback — must add before implementation |
| Docker (api container) | All backend tests | Assumed (project constraint) | latest engine | — |
| PostgreSQL 17-alpine | Integration tests | Assumed via Docker Compose | 17-alpine | — |

**Missing dependencies with no fallback:**
- `sse-starlette==3.2.0` — not present in `backend/requirements.txt`. Wave 0 task must add it.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 45 |
|-----------|---------------------|
| FastAPI 0.135.3, Uvicorn 0.44.0 | Yes — no version changes |
| `--workers 1` (Docker Compose) | Yes — core invariant; comment block required |
| No `import subprocess` / sync `subprocess.run` in signage services | Yes — `signage_broadcast.py` must be free of sync subprocess |
| No `import sqlite3` / no `import psycopg2` | Yes — applies to all `backend/app/` |
| Structured logging via `logging.getLogger(__name__)`, no f-strings in format string | Yes — `notify_device` WARN log |
| No `require_admin` per-route (router-level gate only) | Yes — `/stream` reuses router-level `Depends(get_current_device)` |
| No GSD workflow bypass | Workflow enforcement only |

---

## Sources

### Primary (HIGH confidence)
- `backend/app/services/signage_resolver.py` — verified existing code; exact function signatures confirmed
- `backend/app/routers/signage_player.py` — verified existing router shape, router-level dep pattern
- `backend/app/routers/signage_admin/playlists.py` — verified mutation handler pattern (after-commit insertion point)
- `backend/app/scheduler.py` — verified existing `--workers 1` invariant comment block structure
- `backend/tests/test_signage_ci_guards.py` — verified Phase 44 extension pattern; Phase 45 must follow same shape
- `backend/requirements.txt` — confirmed `sse-starlette` is NOT present (blocking dependency gap)
- Python stdlib `asyncio` docs — `asyncio.Queue`, `asyncio.QueueFull`, `asyncio.QueueEmpty`, `asyncio.CancelledError`
- [sse-starlette client disconnection docs](https://deepwiki.com/sysid/sse-starlette/3.5-client-disconnection-detection) — `CancelledError` must be re-raised; `finally` block pattern

### Secondary (MEDIUM confidence)
- [sse-starlette PyPI](https://pypi.org/project/sse-starlette/) — version 3.3.4 is latest as of 2026-03-29; project pins 3.2.0 per SGN-BE-02
- [sse-starlette GitHub README](https://github.com/sysid/sse-starlette/blob/main/README.md) — `ping` parameter, `EventSourceResponse` usage, `request.is_disconnected()` pattern
- asyncio.Queue QueueFull drop-oldest pattern — standard Python pattern; confirmed via asyncio stdlib semantics

---

## Metadata

**Confidence breakdown:**
- `sse-starlette` API (EventSourceResponse, ping param, CancelledError): HIGH — official docs + existing project requirement
- Per-device queue dict pattern: HIGH — standard asyncio, confirmed against stdlib
- Drop-oldest QueueFull handling: HIGH — stdlib semantics (QueueFull + get_nowait + put_nowait)
- Admin mutation hook insertion points: HIGH — verified from actual source files
- Missing `sse-starlette` in requirements.txt: HIGH — directly read from `backend/requirements.txt`
- `devices_affected_by_playlist` helper: MEDIUM — implied by D-02 scope but exact SQL not designed yet

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack; sse-starlette and asyncio APIs are not fast-moving)
