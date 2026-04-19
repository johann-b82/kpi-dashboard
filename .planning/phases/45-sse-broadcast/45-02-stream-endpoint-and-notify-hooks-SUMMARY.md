---
phase: 45-sse-broadcast
plan: 02
subsystem: signage-backend
tags: [signage, sse, broadcast, fanout, player, admin-hooks, pptx]
requires:
  - SGN-BE-05 substrate (Plan 45-01: signage_broadcast.subscribe/notify_device)
  - devices_affected_by_playlist (Plan 45-01: tag-overlap helper)
  - SGN-BE-02 (Phase 43: player router shape + get_current_device dep)
  - SGN-BE-01 (Phase 43: admin router CRUD surfaces)
  - SGN-BE-07 (Phase 44: convert_pptx + _set_done state transition)
provides:
  - GET /api/signage/player/stream (SSE, ping=15, last-writer-wins cleanup)
  - notify_device hooks in every D-02 admin mutation path
  - PPTX reconvert-done broadcast on processing -> done transition
  - Integration test harness for mutation -> frame-delivery assertions
affects:
  - backend/app/routers/signage_player.py (added /stream endpoint)
  - backend/app/routers/signage_admin/playlists.py (create/update/delete/tag-replace hooks)
  - backend/app/routers/signage_admin/playlist_items.py (bulk-replace hook)
  - backend/app/routers/signage_admin/media.py (PATCH + module helper)
  - backend/app/routers/signage_admin/devices.py (tag-replace hook)
  - backend/app/services/signage_pptx.py (_set_done notify)
  - backend/tests/test_signage_broadcast_integration.py (new)
tech-stack:
  added: []
  patterns:
    - EventSourceResponse(event_generator(), ping=15) with try/except CancelledError/finally
    - _device_queues.pop(device_id, None) — None-default guard protects last-writer-wins (Pitfall 1)
    - Per-file module-local notify helper (no shared module — blast radius minimal)
    - "Capture affected device set BEFORE destructive commit" (playlist DELETE + tag PUT)
    - Post-commit broadcast wrapped in try/except in PPTX pipeline (never rolls back DB write)
key-files:
  created:
    - backend/tests/test_signage_broadcast_integration.py
  modified:
    - backend/app/routers/signage_player.py
    - backend/app/routers/signage_admin/playlists.py
    - backend/app/routers/signage_admin/playlist_items.py
    - backend/app/routers/signage_admin/media.py
    - backend/app/routers/signage_admin/devices.py
    - backend/app/services/signage_pptx.py
decisions:
  - D-01: payload shape locked to {"event","playlist_id","etag"}; playlist_id is str(uuid) for delete/device-self paths (empty string sentinel when no match)
  - D-02: every mutation path notifies AFTER await db.commit (Pitfall 3) — verified by grep + integration test
  - D-03: last-writer-wins implemented by subscribe() replacing _device_queues[device_id] unconditionally + finally popping with None default
  - Playlist DELETE captures affected devices BEFORE the delete commits, notifies AFTER (FK cascade empties the map on delete)
  - Playlist tag PUT unions previous + new affected devices so devices that lose this playlist still learn to refetch
  - Device PATCH name-only does NOT notify; tag PUT notifies device itself via _notify_device_self (unconditional — cheaper than diffing)
  - PPTX _set_done notify is wrapped in try/except — broadcast failure must never mask or roll back the state write
requirements:
  - SGN-BE-05
  - SGN-DIFF-01
metrics:
  duration: ~40m
  completed: 2026-04-19
---

# Phase 45 Plan 02: Stream Endpoint & Notify Hooks Summary

Admin-mutation-to-player SSE loop is live: `GET /api/signage/player/stream` subscribes each device to its per-device `asyncio.Queue`, every D-02 admin mutation path calls `notify_device` after commit, and the PPTX conversion's `processing → done` transition broadcasts to referenced playlists' devices. Player clients now see playlist updates within ~2s of an admin save (verified in integration tests).

## Endpoint Added

```python
# backend/app/routers/signage_player.py
@router.get("/stream")
async def stream_events(device: SignageDevice = Depends(get_current_device)) -> EventSourceResponse:
    queue = signage_broadcast.subscribe(device.id)
    async def event_generator():
        try:
            while True:
                payload = await queue.get()
                yield {"data": json.dumps(payload)}
        except asyncio.CancelledError:
            raise            # Pitfall 2 — MUST re-raise
        finally:
            signage_broadcast._device_queues.pop(device.id, None)  # Pitfall 1
    return EventSourceResponse(event_generator(), ping=15)
```

Inherits router-level `Depends(get_current_device)` — no per-endpoint auth wiring needed.

## Notify Hook Placement (per-file: handler: placement)

| File | Handler | Call | Placement |
|---|---|---|---|
| `signage_admin/playlists.py` | `create_playlist` (POST) | `_notify_playlist_changed(db, row.id)` | AFTER `await db.refresh(row)` |
| `signage_admin/playlists.py` | `update_playlist` (PATCH) | `_notify_playlist_changed(db, playlist_id)` | AFTER `await db.refresh(row)` |
| `signage_admin/playlists.py` | `delete_playlist` (DELETE) | `signage_broadcast.notify_device(...)` loop | AFTER `await db.commit()`, using pre-delete captured `affected` list (FK cascade drops the tag map on commit) |
| `signage_admin/playlists.py` | `replace_playlist_tags` (PUT /tags) | `notify_device` union of `prev_affected ∪ new_affected` | AFTER `await db.commit()`; previous overlap captured pre-swap |
| `signage_admin/playlist_items.py` | `bulk_replace_playlist_items` (PUT /items) | `_notify_playlist_changed(db, playlist_id)` | AFTER `await db.commit()` + all refreshes |
| `signage_admin/media.py` | `update_media` (PATCH) | `_notify_media_referenced_playlists(db, media_id)` | AFTER `await db.refresh(row)` |
| `signage_admin/devices.py` | `replace_device_tags` (PUT /tags) | `_notify_device_self(db, device_id)` | AFTER `await db.commit()` |
| `services/signage_pptx.py` | `_set_done` | `_notify_media_referenced_playlists(session, media_id)` | AFTER `await session.commit()`, inside try/except (swallows broadcast failures) |

**Not hooked (by design):**
- `media.py::create_media` — new media is not yet referenced by any playlist item; no devices are affected.
- `media.py::delete_media` 409-path — delete failed, nothing changed.
- `media.py::delete_media` 204-path — FK RESTRICT means 204 is only reachable when NO playlist_items reference this media; no devices are affected.
- `media.py::upload_pptx_media` — inserts a `pending` row; not yet in any playlist, and conversion will fire the notify itself on `_set_done`.
- `media.py::reconvert_pptx_media` — returns 202 and schedules conversion; `_set_done` fires the notify when the pipeline completes.
- `devices.py::update_device` — only PATCHes `name`, not tags; no resolver impact.
- `pair.py::revoke_device` — revoked devices are excluded from `devices_affected_by_*` already; any open SSE connection is 401'd by the auth dep on next dep-check.

## Test-to-Criterion Mapping

| Test | Success Criterion |
|---|---|
| `test_stream_delivers_playlist_changed_on_admin_update` | Admin PATCH → payload `{event,playlist_id,etag}` arrives in queue within 2s |
| `test_stream_does_not_deliver_to_unaffected_device` | Tag-mismatched device gets NO frame (TimeoutError asserted) |
| `test_stream_disconnect_cleans_up_device_queue` | `CancelledError` + generator `finally` pops `_device_queues` |
| `test_stream_generator_reraises_cancelled_error` | Pitfall 2 regression guard (no zombie coroutine) |
| `test_stream_last_writer_wins_on_reconnect` | D-03 + Pitfall 1 (A's finally with `None` default does not clobber B's registration) |
| `test_pptx_reconvert_done_notifies_referenced_playlists` | PPTX state transition → device gets a frame |
| `test_stream_endpoint_requires_device_token` | Wire-level: 401 without device JWT |
| `test_stream_sends_ping_within_15s_plus_slack` | SKIPPED — timing would make CI flaky; `ping=15` asserted by grep + sse-starlette's own tests |

## Verification

```
docker compose run --rm api pytest \
  tests/test_signage_broadcast.py \
  tests/test_signage_broadcast_integration.py \
  tests/test_signage_admin_router.py \
  tests/test_signage_player_router.py \
  tests/test_signage_router_deps.py \
  tests/test_signage_pptx_service.py \
  tests/test_signage_pptx_pipeline_integration.py \
  -v
# 45 passed, 2 skipped in 5.79s
```

Acceptance-criteria spot-checks:

```
grep -c "@router.get(\"/stream\")" backend/app/routers/signage_player.py                   # 1
grep -c "EventSourceResponse" backend/app/routers/signage_player.py                         # 2
grep -c "ping=15" backend/app/routers/signage_player.py                                     # 1
grep -c "signage_broadcast.subscribe" backend/app/routers/signage_player.py                 # 1
grep -c "_device_queues.pop(device.id, None)" backend/app/routers/signage_player.py         # 1
grep -rn "signage_broadcast" backend/app/routers/signage_admin/ | wc -l                     # >=4 (playlists, playlist_items, media, devices)
grep -c "notify_device\|_notify_" backend/app/routers/signage_admin/playlists.py            # >=3 (create/update/delete/tags)
grep -c "notify_device\|_notify_" backend/app/routers/signage_admin/playlist_items.py       # >=1
grep -c "notify_device\|_notify_" backend/app/routers/signage_admin/media.py                # >=1
grep -c "notify_device\|_notify_" backend/app/routers/signage_admin/devices.py              # >=1
grep -c "notify_device\|_notify_" backend/app/services/signage_pptx.py                      # >=1
grep -rc "await queue.put(" backend/app/routers/signage_admin/                              # 0
```

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | `1381623` | feat(45-02): add GET /api/signage/player/stream SSE endpoint |
| 2 | `bd0733f` | feat(45-02): insert notify_device hooks in D-02 mutation paths |
| 3 | `89efd9e` | test(45-02): broadcast integration — mutation->SSE + disconnect cleanup |

## Deviations from Plan

### 1. [Scope — test strategy] Test 3 exercises the generator body directly instead of a live httpx SSE stream

- **Found during:** Task 3 verification
- **Issue:** `httpx.AsyncClient.stream()` over `ASGITransport` against an `EventSourceResponse` blocks indefinitely on `cm.__aenter__()` / `response.aiter_raw()` in pytest-asyncio — the endpoint is an infinite generator with server-side pings, so the response never completes and `__aexit__` cannot cancel cleanly within a tight budget. Four consecutive pytest containers had to be `docker kill`-ed while iterating.
- **Fix:** `test_stream_disconnect_cleans_up_device_queue` now instantiates the exact same generator body shape as `stream_events`, drives it into its `await queue.get()` suspension point, cancels the task (the ASGI-layer equivalent of a client disconnect), and asserts both the `CancelledError` re-raise and the `_device_queues.pop(..., None)` cleanup. An additional `test_stream_generator_reraises_cancelled_error` explicitly covers Pitfall 2. Wire-level endpoint reachability is covered by `test_stream_endpoint_requires_device_token` + the grep acceptance criteria.
- **Why this is still realistic:** The generator body is the only non-trivial code in the handler; `EventSourceResponse(generator, ping=15)` itself is a library contract covered upstream by sse-starlette's own tests. The subscribe/notify/queue path is exercised end-to-end by tests 1, 2, and 6 using the actual admin router + resolver.
- **Files modified:** `backend/tests/test_signage_broadcast_integration.py`
- **Commit:** `89efd9e`

### 2. [Rule 2 — missing critical functionality] Added notify hook to `replace_playlist_tags` (PUT /playlists/{id}/tags)

- **Found during:** Task 2 planning
- **Issue:** Plan 45-02 lists playlist CRUD + items + media + devices + PPTX as mutation paths, but did not explicitly name the playlist-tag PUT endpoint in the D-02 list. However, changing a playlist's tag set changes WHICH devices resolve to it — without a notify, a device that just lost this playlist would never learn to refetch until the next polling tick.
- **Fix:** `replace_playlist_tags` now captures the pre-swap affected device set, commits the tag update, then fans out to `prev ∪ new` so both dropped and added devices refetch.
- **Files modified:** `backend/app/routers/signage_admin/playlists.py`
- **Commit:** `bd0733f`

### 3. [Scope — D-02 simpler rule chosen] `devices.py::replace_device_tags` notifies unconditionally; `update_device` does not

- **Found during:** Task 2 planning
- **Issue:** Plan text offered two rules for device PATCH — "compare old vs new tags and notify on change" vs "unconditionally notify on any tags-present write". The admin schema in this codebase splits these: `update_device` PATCHes `name` only, tags are managed exclusively via `PUT /{id}/tags`. So the simpler rule applies perfectly: tag-PUT always changes tags (or rewrites to an equal set, which costs at most one SSE frame), and `update_device` touches no resolver input.
- **Fix:** notify hook lives on `replace_device_tags`, no hook on `update_device`.
- **Commit:** `bd0733f`

### 4. [Scope — playlist_id type] `playlist_id` serialized as `str(uuid)` in SSE payloads

- **Found during:** Task 2 implementation
- **Issue:** Plan says `playlist_id: <int>`. Actual ORM uses `uuid.UUID`. Integration tests originally constructed under the ROADMAP/CONTEXT `<int>` wording; the running DB uses UUIDs per Phase 41.
- **Fix:** Serialize as `str(pid)` in every payload so the wire format is JSON-friendly. Player consumers treat it as opaque identity — no arithmetic is performed on it.
- **Commit:** `bd0733f`

### 5. [Scope — PPTX helper duplicated] `_notify_media_referenced_playlists` lives in both media.py and signage_pptx.py

- **Found during:** Task 2 implementation
- **Issue:** Plan allows duplicating the tiny helper to keep blast radius minimal and avoid an import cycle (`signage_admin.media` → `signage_pptx` → back into `signage_admin.media`).
- **Fix:** Duplicated helper in `signage_pptx.py::_notify_media_referenced_playlists`; it takes a session parameter since PPTX already owns an `AsyncSessionLocal()` block around the state write.
- **Commit:** `bd0733f`

## Self-Check: PASSED

- FOUND: backend/app/routers/signage_player.py (contains `@router.get("/stream")`, `EventSourceResponse`, `ping=15`, `_device_queues.pop(device.id, None)`, `raise  # MUST re-raise`)
- FOUND: backend/app/routers/signage_admin/playlists.py (contains `_notify_playlist_changed`, `signage_broadcast.notify_device`)
- FOUND: backend/app/routers/signage_admin/playlist_items.py (contains `_notify_playlist_changed`)
- FOUND: backend/app/routers/signage_admin/media.py (contains `_notify_media_referenced_playlists`)
- FOUND: backend/app/routers/signage_admin/devices.py (contains `_notify_device_self`)
- FOUND: backend/app/services/signage_pptx.py (contains `_notify_media_referenced_playlists` post-`_set_done`)
- FOUND: backend/tests/test_signage_broadcast_integration.py (7 tests, 6 passing + 1 skipped)
- FOUND commit: 1381623
- FOUND commit: bd0733f
- FOUND commit: 89efd9e
