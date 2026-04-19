---
phase: 45-sse-broadcast
plan: 02
type: execute
wave: 2
depends_on:
  - 45-01
files_modified:
  - backend/app/routers/signage_player.py
  - backend/app/routers/signage_admin/playlists.py
  - backend/app/routers/signage_admin/playlist_items.py
  - backend/app/routers/signage_admin/media.py
  - backend/app/routers/signage_admin/devices.py
  - backend/app/services/signage_pptx.py
  - backend/tests/test_signage_broadcast_integration.py
autonomous: true
requirements:
  - SGN-BE-05
  - SGN-DIFF-01

must_haves:
  truths:
    - "GET /api/signage/player/stream returns an EventSourceResponse with 15s server pings"
    - "Admin PUT /api/signage/admin/playlists/{id} triggers notify_device for every tag-overlapping device within 1s"
    - "Playlist-item mutations (add/remove/reorder/duration/transition) trigger notify_device for affected devices"
    - "Media mutations that affect the resolved playlist (metadata, delete, PPTX reconvert-done) trigger notify_device"
    - "Device tag changes (PUT /admin/devices/{id} with different tags) trigger notify_device for that device"
    - "On client disconnect, the SSE generator's finally block removes the device's entry from _device_queues (no stale entries)"
    - "asyncio.CancelledError is re-raised in the SSE generator (no zombie coroutine)"
    - "All notify_device calls fire AFTER await db.commit() — never before"
  artifacts:
    - path: backend/app/routers/signage_player.py
      provides: "GET /stream endpoint returning EventSourceResponse(generator(), ping=15)"
      contains: "EventSourceResponse"
    - path: backend/app/routers/signage_admin/playlists.py
      provides: "notify_device hooks in POST / PATCH / DELETE handlers"
      contains: "notify_device"
    - path: backend/app/routers/signage_admin/playlist_items.py
      provides: "notify_device hooks on bulk-replace and item mutations"
      contains: "notify_device"
    - path: backend/app/routers/signage_admin/media.py
      provides: "notify_device hook on media mutations that affect resolved playlists"
      contains: "notify_device"
    - path: backend/app/routers/signage_admin/devices.py
      provides: "notify_device hook when device.tags changes"
      contains: "notify_device"
    - path: backend/app/services/signage_pptx.py
      provides: "notify_device call on reconvert-done state transition"
      contains: "notify_device"
    - path: backend/tests/test_signage_broadcast_integration.py
      provides: "End-to-end tests: mutation → SSE event delivery; disconnect → _device_queues cleanup"
  key_links:
    - from: backend/app/routers/signage_player.py
      to: backend/app/services/signage_broadcast.py
      via: "signage_broadcast.subscribe(device.id) in /stream generator, signage_broadcast._device_queues.pop(device.id, None) in finally"
      pattern: "signage_broadcast"
    - from: backend/app/routers/signage_admin/playlists.py
      to: backend/app/services/signage_broadcast.py
      via: "notify_device(device_id, {...}) after await db.commit()"
      pattern: "notify_device"
    - from: backend/app/routers/signage_admin/playlists.py
      to: backend/app/services/signage_resolver.py
      via: "await devices_affected_by_playlist(db, playlist_id) to fan out"
      pattern: "devices_affected_by_playlist"
    - from: backend/app/services/signage_pptx.py
      to: backend/app/services/signage_broadcast.py
      via: "notify_device call after state transition to 'done' commits"
      pattern: "notify_device"
---

<objective>
Wire the SSE endpoint and all admin-mutation notify hooks specified by CONTEXT D-02, so that an admin save propagates to affected player SSE connections within 1–2s while the generator's finally block guarantees no queue leaks on disconnect.

Purpose: Covers SGN-BE-05 (player /stream endpoint + fanout hooks) and SGN-DIFF-01 (real-time SSE push end-to-end). Without Plan 02 the broadcast service from Plan 01 is dead code.

Output: Working `GET /api/signage/player/stream` with 15s pings, notify_device calls in every D-02 mutation path, and integration tests covering the full mutation → event delivery loop plus disconnect cleanup.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/45-sse-broadcast/45-CONTEXT.md
@.planning/phases/45-sse-broadcast/45-RESEARCH.md
@.planning/phases/45-sse-broadcast/45-01-broadcast-service-SUMMARY.md
@backend/app/routers/signage_player.py
@backend/app/routers/signage_admin/playlists.py
@backend/app/routers/signage_admin/playlist_items.py
@backend/app/routers/signage_admin/media.py
@backend/app/routers/signage_admin/devices.py
@backend/app/services/signage_pptx.py
@backend/app/services/signage_resolver.py
@backend/app/services/signage_broadcast.py

<interfaces>
From backend/app/services/signage_broadcast.py (Plan 01 output — USE these directly, do not re-implement):
```python
def subscribe(device_id: int) -> asyncio.Queue  # creates/replaces queue, maxsize=32
def notify_device(device_id: int, payload: dict) -> None  # drop-oldest overflow, warn-once
_device_queues: dict[int, asyncio.Queue]  # direct pop in /stream finally block
```

From backend/app/services/signage_resolver.py (Plan 01 output):
```python
async def devices_affected_by_playlist(db: AsyncSession, playlist_id: int) -> list[int]
async def devices_affected_by_device_update(db: AsyncSession, device_id: int) -> list[int]
async def resolve_playlist_for_device(db: AsyncSession, device_id: int) -> PlaylistEnvelope  # existing
def compute_playlist_etag(envelope: PlaylistEnvelope) -> str  # existing
```

From backend/app/routers/signage_player.py (existing — ADD /stream here, keep existing /playlist + /heartbeat):
Router is mounted with `APIRouter(prefix="/api/signage/player", dependencies=[Depends(get_current_device)])` — `/stream` inherits the device-token dep automatically (Pitfall 6).

SSE payload shape (D-01, locked):
```json
{"event": "playlist-changed", "playlist_id": <int>, "etag": "<weak-etag>"}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GET /stream endpoint to signage_player.py</name>
  <read_first>
    - backend/app/routers/signage_player.py (existing router shape, get_current_device dep)
    - backend/app/services/signage_broadcast.py (Plan 01 — subscribe, _device_queues)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Pattern 2, §Pattern 3, §Pitfall 1, §Pitfall 2, §Pitfall 6
    - .planning/phases/45-sse-broadcast/45-CONTEXT.md (D-01 payload, D-03 last-writer-wins)
  </read_first>
  <files>backend/app/routers/signage_player.py</files>
  <action>
    Add a new `@router.get("/stream")` endpoint to the EXISTING `backend/app/routers/signage_player.py` (do NOT create a new router). Must follow 45-RESEARCH.md §Pattern 2 exactly:

    ```python
    import asyncio
    import json
    from sse_starlette.sse import EventSourceResponse

    from app.services import signage_broadcast

    @router.get("/stream")
    async def stream_events(
        device: SignageDevice = Depends(get_current_device),
    ) -> EventSourceResponse:
        """SSE: streams playlist-changed events to connected players (SGN-BE-05, SGN-DIFF-01)."""
        queue = signage_broadcast.subscribe(device.id)

        async def event_generator():
            try:
                while True:
                    payload = await queue.get()
                    yield {"data": json.dumps(payload)}
            except asyncio.CancelledError:
                raise  # MUST re-raise — per Pitfall 2
            finally:
                # D-03 last-writer-wins: pop with None default so the OLD generator's
                # finally does not delete a NEW connection's freshly-subscribed queue
                # (per 45-RESEARCH.md §Pattern 3 + §Pitfall 1).
                signage_broadcast._device_queues.pop(device.id, None)

        return EventSourceResponse(event_generator(), ping=15)
    ```

    Reuse the existing `get_current_device` dep (already imported by the router; device-token auth). Do NOT add a second `Depends(...)`. `get_current_device` at the router level already gates `/stream` (Pitfall 6 — dep-audit test `>= 2` stays green as it becomes `>= 3`).

    Use `ping=15` (integer seconds) — this is the sse-starlette parameter name per RESEARCH.md §Pattern 2.

    Do NOT catch + swallow `CancelledError` (Pitfall 2) — the explicit `raise` is mandatory.
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_player_router.py backend/tests/test_signage_router_deps.py -x -v &amp;&amp; docker compose run --rm api python -c "from app.routers.signage_player import router; paths = [r.path for r in router.routes]; assert '/stream' in paths, paths; print('OK: /stream registered')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "@router.get(\"/stream\")" backend/app/routers/signage_player.py` returns `1`
    - `grep -c "EventSourceResponse" backend/app/routers/signage_player.py` >= 2 (import + return)
    - `grep -c "ping=15" backend/app/routers/signage_player.py` returns `1`
    - `grep -c "signage_broadcast.subscribe" backend/app/routers/signage_player.py` returns `1`
    - `grep -c "_device_queues.pop(device.id, None)" backend/app/routers/signage_player.py` returns `1`
    - `grep -E "except asyncio\.CancelledError:\s*$" backend/app/routers/signage_player.py` finds the handler; next non-empty line contains `raise` (no `pass`)
    - `test_signage_router_deps.py` still passes (dep-audit threshold remains `>=`, /stream inherits router-level `get_current_device`)
    - `test_signage_player_router.py` still passes (no regressions to /playlist or /heartbeat)
  </acceptance_criteria>
  <done>`/api/signage/player/stream` is registered with EventSourceResponse(ping=15), subscribes via signage_broadcast, cleans up in finally, and re-raises CancelledError.</done>
</task>

<task type="auto">
  <name>Task 2: Insert notify_device hooks in all D-02 admin mutation routes</name>
  <read_first>
    - backend/app/routers/signage_admin/playlists.py (full file — understand every POST/PATCH/DELETE handler's commit point)
    - backend/app/routers/signage_admin/playlist_items.py (full file — bulk-replace, add/remove/reorder)
    - backend/app/routers/signage_admin/media.py (full file — identify which mutations affect resolved playlists)
    - backend/app/routers/signage_admin/devices.py (full file — PATCH handler where tags may change)
    - backend/app/services/signage_pptx.py (convert_pptx — find state transition to `done` after DB commit)
    - backend/app/services/signage_broadcast.py (Plan 01)
    - backend/app/services/signage_resolver.py (Plan 01 helpers + existing resolve/compute_etag)
    - .planning/phases/45-sse-broadcast/45-CONTEXT.md §D-02 (trigger scope — read carefully)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Pattern 4, §Pitfall 3, §Pitfall 4
  </read_first>
  <files>backend/app/routers/signage_admin/playlists.py, backend/app/routers/signage_admin/playlist_items.py, backend/app/routers/signage_admin/media.py, backend/app/routers/signage_admin/devices.py, backend/app/services/signage_pptx.py</files>
  <action>
    Shared helper — add once per file, near the top (or reuse if already present):
    ```python
    from app.services import signage_broadcast
    from app.services.signage_resolver import (
        devices_affected_by_playlist,
        devices_affected_by_device_update,
        resolve_playlist_for_device,
        compute_playlist_etag,
    )
    ```

    Build a small module-local async helper (duplicate the tiny helper in each file — do not create a new shared module; keeps blast radius minimal):
    ```python
    async def _notify_playlist_changed(db, playlist_id: int) -> None:
        """Notify all devices whose resolved playlist could have been affected by this playlist."""
        affected = await devices_affected_by_playlist(db, playlist_id)
        for device_id in affected:
            envelope = await resolve_playlist_for_device(db, device_id)
            payload = {
                "event": "playlist-changed",
                "playlist_id": playlist_id,
                "etag": compute_playlist_etag(envelope),
            }
            signage_broadcast.notify_device(device_id, payload)
    ```

    And for device-scoped changes:
    ```python
    async def _notify_device_self(db, device_id: int) -> None:
        envelope = await resolve_playlist_for_device(db, device_id)
        pid = envelope.playlist_id if envelope.playlist_id is not None else 0
        payload = {
            "event": "playlist-changed",
            "playlist_id": pid,
            "etag": compute_playlist_etag(envelope),
        }
        signage_broadcast.notify_device(device_id, payload)
    ```

    (playlist_id=0 is the sentinel for "no playlist currently resolves" — players treat it like any other change and refetch /playlist, which will also return the sha256('empty') sentinel per compute_playlist_etag.)

    **Insertion rules (Pitfall 3):** Every `notify_device` / `_notify_*` call MUST be AFTER `await db.commit()` AND (if applicable) `await db.refresh(row)`, and BEFORE `return`. If a handler uses `try / except` around the commit and rolls back on error, the notify call must be inside the success path only — never in a `finally`.

    **Per-file insertions (cover ALL D-02 cases):**

    1. `backend/app/routers/signage_admin/playlists.py`:
       - POST (create playlist): call `await _notify_playlist_changed(db, created.id)` after commit+refresh.
       - PATCH `/{playlist_id}` (update): call `await _notify_playlist_changed(db, playlist_id)` after commit+refresh.
       - DELETE `/{playlist_id}`: call `await _notify_playlist_changed(db, playlist_id)` BEFORE delete commit if possible (affected set needs the tag map); if the delete cascades the tag map first, capture affected device ids pre-delete: `affected = await devices_affected_by_playlist(db, playlist_id); await db.delete(...); await db.commit(); for did in affected: signage_broadcast.notify_device(did, {"event": "playlist-changed", "playlist_id": playlist_id, "etag": "deleted"})`. Document inline why the pre-delete capture is necessary.

    2. `backend/app/routers/signage_admin/playlist_items.py`:
       - All mutation routes (add, remove, reorder, update duration/transition, bulk-replace) — call `await _notify_playlist_changed(db, playlist_id)` after every commit. The `playlist_id` is either a path param or the parent of the item being mutated — derive consistently with how the router already does it.

    3. `backend/app/routers/signage_admin/media.py`:
       - For mutations that affect the resolved playlist (metadata change that is surfaced, delete): after commit, compute all playlists that reference this media via `signage_playlist_items`, then call `await _notify_playlist_changed(db, pl_id)` for each. Query: `SELECT DISTINCT playlist_id FROM signage_playlist_items WHERE media_id = :mid`. Skip this notify on cosmetic-only fields per CONTEXT D-02. Name the helper `_notify_media_referenced_playlists(db, media_id)` locally in media.py to centralize the playlist-id lookup.
       - Do NOT notify on upload-time `pending → processing` transitions (players would refetch and see nothing useful). Reconvert-done (`processing → done`) is handled in signage_pptx.py (rule 5 below).

    4. `backend/app/routers/signage_admin/devices.py`:
       - PATCH `/{device_id}` — detect whether the `tags` field was touched by comparing the incoming payload's tags (if present) to the committed device's tags BEFORE the write, OR unconditionally call `_notify_device_self(db, device_id)` after any PATCH commit (simpler; safe because a device's resolved playlist can change for tag edits only, and a spurious notify costs only one SSE frame). CONTEXT §D-02 says "when tags field changes" — match that rule but the simpler unconditional-on-tags-present check is acceptable: `if request_body.tags is not None: ... notify`. Choose ONE rule and document inline.

    5. `backend/app/services/signage_pptx.py`:
       - In `convert_pptx()`, locate the `processing → done` state transition (after writing `slide_paths` and committing). Immediately after the successful commit to `done`, call `await _notify_media_referenced_playlists(db, media_id)` (duplicate the helper from media.py here — it is two lines). Wrap in try/except Exception: log at WARN and continue; a notify failure must NOT roll back the media state. Failure path (`processing → failed`) does NOT notify.

    **Universal constraints:**
    - MUST use `signage_broadcast.notify_device(...)` — NOT `await queue.put()`; the function is synchronous by design (Pitfall 4).
    - MUST NOT hold the DB session while awaiting the SSE generator — `notify_device` is synchronous and non-blocking, so this is automatic, but do not reorder to await anything long-running inside the fanout loop.
    - MUST NOT fire notifies before `await db.commit()` (Pitfall 3).
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_admin_router.py backend/tests/test_signage_player_router.py backend/tests/test_signage_pptx_pipeline_integration.py backend/tests/test_signage_pptx_service.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "signage_broadcast" backend/app/routers/signage_admin/ | wc -l` >= 4 (at least one import + one notify per admin file covering playlists, playlist_items, media, devices)
    - `grep -c "notify_device\|_notify_playlist_changed\|_notify_device_self\|_notify_media_referenced_playlists" backend/app/routers/signage_admin/playlists.py` >= 3 (covers create/update/delete)
    - `grep -c "notify_device\|_notify_playlist_changed" backend/app/routers/signage_admin/playlist_items.py` >= 1
    - `grep -c "notify_device\|_notify_media_referenced_playlists" backend/app/routers/signage_admin/media.py` >= 1
    - `grep -c "notify_device\|_notify_device_self" backend/app/routers/signage_admin/devices.py` >= 1
    - `grep -c "notify_device\|_notify_media_referenced_playlists" backend/app/services/signage_pptx.py` >= 1
    - For each mutation file, the notify helper call appears AFTER the corresponding `await db.commit()` line (manual grep order check — Pitfall 3). `grep -nB1 "notify_device\|_notify_" file | grep -E "commit|notify"` shows commit lines preceding notify lines.
    - `grep -c "await queue.put(" backend/app/routers/signage_admin/ -r` returns 0 (must use put_nowait via notify_device wrapper)
    - All existing admin router and pptx tests pass (no regressions)
  </acceptance_criteria>
  <done>Every D-02 mutation path — playlist CRUD, playlist-item mutations, media mutations (including PPTX reconvert-done), device tag changes — calls notify_device AFTER db.commit; all existing tests still pass.</done>
</task>

<task type="auto">
  <name>Task 3: Integration tests — mutation → SSE delivery + disconnect cleanup</name>
  <read_first>
    - backend/tests/test_signage_player_router.py (harness patterns: test client, device token, AsyncSessionLocal seeding)
    - backend/tests/test_signage_admin_router.py (admin JWT fixture patterns)
    - backend/app/services/signage_broadcast.py (_device_queues for cleanup assertion)
    - .planning/phases/45-sse-broadcast/45-CONTEXT.md §Specifics (finally cleanup test must actually connect + disconnect, not mock)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Pattern 2, §Pitfall 1
  </read_first>
  <files>backend/tests/test_signage_broadcast_integration.py</files>
  <action>
    Create `backend/tests/test_signage_broadcast_integration.py` with pytest-asyncio tests that use the existing FastAPI test harness (same fixtures as `test_signage_player_router.py`). Tests MUST actually connect to the /stream endpoint via httpx AsyncClient streaming, not mock the SSE layer.

    Required tests:

    1. **`test_stream_delivers_playlist_changed_on_admin_update`**:
       - Seed: admin user + JWT; device with tag "lobby" + device token; playlist targeting "lobby".
       - Open SSE connection to `/api/signage/player/stream` with the device token (use `httpx.AsyncClient.stream("GET", url, headers={"Authorization": f"Bearer {device_token}"})`). Use `asyncio.wait_for(..., timeout=5.0)` around the initial subscribe.
       - In a separate task, call `PATCH /api/signage/admin/playlists/{id}` with admin JWT to change the playlist (e.g., rename).
       - Read SSE frames from the stream; assert within 2s a `data:` line is received parsing to `{"event": "playlist-changed", "playlist_id": <int>, "etag": "<non-empty string>"}`.
       - Close the stream; cancel the read task cleanly.

    2. **`test_stream_does_not_deliver_to_unaffected_device`**:
       - Two devices: one tagged "lobby", one tagged "kitchen"; playlist targets "lobby".
       - Both subscribe to /stream.
       - PATCH the playlist.
       - Assert the "lobby" device receives a frame within 2s; assert the "kitchen" device receives NO frame within 2s (use `asyncio.wait_for` with timeout + assert `TimeoutError` is raised).

    3. **`test_stream_disconnect_cleans_up_device_queue`** (success-criterion #4, explicit requirement from CONTEXT):
       - Open SSE connection for device_id X.
       - Assert `X in signage_broadcast._device_queues` while connected.
       - Close the httpx stream (break out of `async with` context).
       - Give the event loop a moment to run the finally (`await asyncio.sleep(0.1)` suffices).
       - Assert `X not in signage_broadcast._device_queues`.

    4. **`test_stream_last_writer_wins_on_reconnect`** (D-03):
       - Open SSE connection A for device X. Record `q_a = signage_broadcast._device_queues[X]`.
       - Open SSE connection B for the same device X (same token). Record `q_b = signage_broadcast._device_queues[X]`.
       - Assert `q_a is not q_b`.
       - Close connection B. `await asyncio.sleep(0.1)`.
       - Assert `X not in signage_broadcast._device_queues` (B's finally popped it).
       - Note: connection A's finally later also pops with `None` default (no KeyError — Pitfall 1 regression guard).

    5. **`test_stream_sends_ping_within_15s_plus_slack`** (optional but recommended):
       - Open connection; read bytes for 17 seconds (ping=15 + slack); assert at least one `: ` (SSE comment prefix for ping/keepalive) line observed. Mark with `@pytest.mark.slow` if the harness supports it; skip by default if CI timing is flaky — prefer a shorter variant where `EventSourceResponse` is constructed with `ping=1` inside a test fixture override. Planner's discretion.

    6. **`test_pptx_reconvert_done_notifies_referenced_playlists`**:
       - Seed: device tagged "lobby"; playlist targeting "lobby"; media in the playlist; media state `processing`.
       - Open SSE on /stream.
       - Directly call (or trigger via existing reconvert integration test harness) the `convert_pptx` path that flips state to `done` and commits.
       - Assert the device receives a `playlist-changed` frame within 2s.

    Reset `signage_broadcast._device_queues.clear()` in an autouse fixture to isolate tests.

    Make this file self-contained — import fixtures from the existing conftest per project conventions. Do NOT create new conftest fixtures unless strictly necessary.
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_broadcast_integration.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/tests/test_signage_broadcast_integration.py` exists
    - At least 4 of the 6 listed tests are implemented and pass (tests 1–4 and 6 are required; test 5 may be marked `@pytest.mark.slow` or skipped with a recorded reason)
    - `grep -c "signage_broadcast._device_queues" backend/tests/test_signage_broadcast_integration.py` >= 2 (cleanup assertion + last-writer-wins assertion)
    - `grep -c "httpx.AsyncClient" backend/tests/test_signage_broadcast_integration.py` >= 1 OR equivalent streaming client (e.g., `AsyncClient` from conftest) — must not be a pure mock
    - `pytest backend/tests/test_signage_broadcast_integration.py -x` exits 0
    - `_device_queues.clear()` appears in an autouse fixture (inter-test isolation)
  </acceptance_criteria>
  <done>Integration tests prove: mutation-to-SSE delivery <2s, tag-mismatched devices not notified, disconnect cleans up _device_queues, last-writer-wins on reconnect, PPTX reconvert-done triggers notify.</done>
</task>

</tasks>

<verification>
```bash
docker compose run --rm api pytest \
  backend/tests/test_signage_broadcast.py \
  backend/tests/test_signage_broadcast_integration.py \
  backend/tests/test_signage_admin_router.py \
  backend/tests/test_signage_player_router.py \
  backend/tests/test_signage_router_deps.py \
  backend/tests/test_signage_pptx_service.py \
  backend/tests/test_signage_pptx_pipeline_integration.py \
  -x -v
```
</verification>

<success_criteria>
- GET /api/signage/player/stream returns EventSourceResponse with 15s pings (sse-starlette)
- Admin mutation (playlists/playlist_items/media/devices) → notify_device fires AFTER db.commit → affected SSE clients receive frame in <2s
- PPTX reconvert-done → affected devices receive frame in <2s
- Disconnecting a client removes the entry from _device_queues (no stale keys)
- Reconnecting the same device does not leave both queues in _device_queues (last-writer-wins)
- asyncio.CancelledError is re-raised by the generator (no zombie coroutines)
- All existing signage tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/phases/45-sse-broadcast/45-02-stream-endpoint-and-notify-hooks-SUMMARY.md` documenting:
- The exact endpoint shape added to signage_player.py
- Per-file list of notify_device insertion points (file: handler: placement)
- Any deviations (e.g., simpler unconditional device-notify vs. tags-changed diff) and why
- How disconnect cleanup is verified (test name + pattern)
</output>
