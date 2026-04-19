---
phase: 45-sse-broadcast
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/requirements.txt
  - backend/app/services/signage_broadcast.py
  - backend/app/services/signage_resolver.py
  - backend/tests/test_signage_broadcast.py
autonomous: true
requirements:
  - SGN-BE-05
  - SGN-INF-03

must_haves:
  truths:
    - "sse-starlette==3.2.0 is importable inside the api container"
    - "signage_broadcast.subscribe(device_id) returns a new asyncio.Queue(maxsize=32) and replaces any prior queue for that device_id"
    - "signage_broadcast.notify_device(device_id, payload) is a no-op when no queue is subscribed"
    - "On QueueFull, notify_device drops the oldest event and enqueues the new one; WARN-logs exactly once per connection"
    - "devices_affected_by_playlist(db, playlist_id) returns the set of device IDs whose tag-overlap would match the given playlist"
  artifacts:
    - path: backend/app/services/signage_broadcast.py
      provides: "Per-device asyncio.Queue fanout (subscribe + notify_device) with --workers 1 invariant comment block"
      contains: "_device_queues"
    - path: backend/app/services/signage_resolver.py
      provides: "devices_affected_by_playlist helper added alongside resolve_playlist_for_device"
      contains: "devices_affected_by_playlist"
    - path: backend/requirements.txt
      provides: "sse-starlette==3.2.0 pinned dependency"
      contains: "sse-starlette==3.2.0"
    - path: backend/tests/test_signage_broadcast.py
      provides: "Unit tests for subscribe/notify_device/drop-oldest/last-writer-wins"
  key_links:
    - from: backend/app/services/signage_broadcast.py
      to: asyncio.Queue
      via: "_device_queues: dict[int, asyncio.Queue]"
      pattern: "_device_queues"
    - from: backend/app/services/signage_broadcast.py
      to: logging
      via: "module-level log = logging.getLogger(__name__); %s-style format args (no f-strings in format string)"
      pattern: "logging.getLogger"
---

<objective>
Establish the SSE fanout substrate: add the missing `sse-starlette==3.2.0` dependency (blocking gap from RESEARCH), create the `signage_broadcast.py` service module with per-device asyncio.Queue fanout, and add the `devices_affected_by_playlist` resolver helper that admin mutation hooks will call in Plan 02.

Purpose: Unblock the SSE endpoint and admin notify hooks (Plan 02) by having the broadcast primitives + missing dependency in place first. Satisfies SGN-BE-05 (broadcast service) and SGN-INF-03 (invariant comment block).

Output: Updated `requirements.txt`, new `signage_broadcast.py`, extended `signage_resolver.py`, and passing unit tests that cover D-03 (last-writer-wins) + D-04 (drop-oldest).
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
@backend/app/services/signage_resolver.py
@backend/app/scheduler.py
@backend/requirements.txt

<interfaces>
From backend/app/services/signage_resolver.py (existing — DO NOT modify signatures, only add a new function):
```python
async def resolve_playlist_for_device(
    db: AsyncSession, device_id: int
) -> PlaylistEnvelope: ...

def compute_playlist_etag(envelope: PlaylistEnvelope) -> str: ...
```

Tag-overlap logic already exists inside resolve_playlist_for_device — the new helper inverts it: given a playlist_id, return device IDs whose tags overlap any of that playlist's target tags.

From backend/app/scheduler.py (existing — mirror this comment block shape):
The `--workers 1` invariant comment is a three-point block near top of file covering (1) single-process only, (2) why (in-memory jobstore / Queue / Semaphore), (3) what breaks under multi-worker. Match the same three points in signage_broadcast.py.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sse-starlette dependency and rebuild</name>
  <read_first>
    - backend/requirements.txt (current pinned versions)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md (§Upstream Code Inventory — confirms sse-starlette is missing)
  </read_first>
  <files>backend/requirements.txt</files>
  <action>
    Append `sse-starlette==3.2.0` as a new line to `backend/requirements.txt` (alphabetical-insensitive; place adjacent to the existing fastapi/uvicorn block is fine, but a bottom append is acceptable). Do NOT change any existing pinned version. Then rebuild the api image:

    ```bash
    docker compose build api
    ```

    Verify the import works inside the container:

    ```bash
    docker compose run --rm api python -c "from sse_starlette.sse import EventSourceResponse; print(EventSourceResponse)"
    ```

    This is the blocking gap called out in 45-RESEARCH.md §Upstream Code Inventory ("sse-starlette is NOT in requirements.txt"). Without this, Plan 02 cannot import `EventSourceResponse`.
  </action>
  <verify>
    <automated>grep -q "^sse-starlette==3.2.0$" backend/requirements.txt &amp;&amp; docker compose run --rm api python -c "from sse_starlette.sse import EventSourceResponse"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^sse-starlette==3.2.0$" backend/requirements.txt` returns `1`
    - `docker compose run --rm api python -c "from sse_starlette.sse import EventSourceResponse"` exits 0
    - No existing line in requirements.txt was modified (diff shows only one addition)
  </acceptance_criteria>
  <done>`sse-starlette==3.2.0` is pinned in requirements.txt and importable in the api container.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create signage_broadcast.py service module</name>
  <read_first>
    - backend/app/scheduler.py (mirror the `--workers 1` invariant comment — same three points)
    - backend/app/services/signage_pptx.py (singleton service-module shape: module-level log, module-level state, public functions)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Pattern 1, §Pattern 3, §Pitfall 1, §Pitfall 4, §Pitfall 7
    - .planning/phases/45-sse-broadcast/45-CONTEXT.md (D-03, D-04)
  </read_first>
  <files>backend/app/services/signage_broadcast.py, backend/tests/test_signage_broadcast.py</files>
  <behavior>
    Unit tests in `backend/tests/test_signage_broadcast.py` (pytest-asyncio) — write these FIRST and watch them fail before implementing:

    - Test A `test_subscribe_creates_queue_with_maxsize_32`: `q = subscribe(1)`; assert `isinstance(q, asyncio.Queue)`; assert `q.maxsize == 32`; assert `signage_broadcast._device_queues[1] is q`.
    - Test B `test_subscribe_replaces_existing_queue_last_writer_wins` (D-03): `q1 = subscribe(1); q2 = subscribe(1)`; assert `q1 is not q2`; assert `signage_broadcast._device_queues[1] is q2`.
    - Test C `test_notify_device_noop_when_no_subscriber`: call `notify_device(999, {"event": "playlist-changed"})`; assert no exception; assert `999 not in signage_broadcast._device_queues`.
    - Test D `test_notify_device_enqueues_payload`: `q = subscribe(1); notify_device(1, {"event": "playlist-changed", "playlist_id": 42, "etag": "abc"})`; assert `q.qsize() == 1`; assert `q.get_nowait() == {"event": "playlist-changed", "playlist_id": 42, "etag": "abc"}`.
    - Test E `test_notify_device_drops_oldest_on_queue_full` (D-04): `q = subscribe(1)`; fill queue to 32 with `{"n": i}` for i in range(32); call `notify_device(1, {"n": 999})`; drain queue — assert first item is `{"n": 1}` (NOT `{"n": 0}`, which was dropped) and last item is `{"n": 999}`; assert qsize is 32 throughout the overflow path (never exceeds maxsize).
    - Test F `test_notify_device_warns_once_on_first_drop` (D-04): use `caplog` fixture at WARNING level; fill queue; two overflow calls; assert exactly ONE WARNING log record emitted from `app.services.signage_broadcast`; assert record message includes device id (1) and queue depth (32) — use `%s`-style format, not f-strings (verify via `record.getMessage()` contents).
    - Test G `test_warned_flag_reset_on_resubscribe` (D-03 + Pitfall 7): fill queue, trigger overflow (warn fires), call `subscribe(1)` again (new queue), fill + overflow again; assert a SECOND warning was emitted (flag was not copied because new queue was created via `asyncio.Queue(...)`).

    Each test must reset `signage_broadcast._device_queues` in a fixture (autouse) to avoid inter-test leakage: `signage_broadcast._device_queues.clear()`.
  </behavior>
  <action>
    Create `backend/app/services/signage_broadcast.py` with this exact shape (per 45-RESEARCH.md §Pattern 1):

    1. **Top-of-file `--workers 1` invariant comment block** — three points, matching `scheduler.py`'s shape (do NOT copy verbatim — paraphrase for this module). Required points:
       - Single-process only (in-process `asyncio.Queue` per device; N workers = N disjoint `_device_queues` dicts)
       - Why (SSE fanout relies on in-memory per-device queue; a `notify_device` in process A does not reach generators in process B)
       - What breaks under multi-worker (silent missed events for roughly `(N-1)/N` of SSE clients; polling at 30s would still catch up but the SSE value prop is destroyed)
       Mirror the linked invariant to `docker-compose.yml` and `scheduler.py` explicitly in the comment.

    2. **Module-level state:**
       ```python
       import asyncio
       import logging

       log = logging.getLogger(__name__)

       _device_queues: dict[int, asyncio.Queue] = {}
       ```
       Name `_device_queues` is ROADMAP-mandated (per CONTEXT §D-03 and ROADMAP line 256) — do NOT rename.

    3. **`subscribe(device_id: int) -> asyncio.Queue`:** Creates a fresh `asyncio.Queue(maxsize=32)`, stores it in `_device_queues[device_id]` (unconditionally replacing any prior entry — D-03 last-writer-wins), returns the new queue. Type annotation: `asyncio.Queue` (no parameterization).

    4. **`notify_device(device_id: int, payload: dict) -> None`:** Synchronous (uses `put_nowait`, non-blocking). Steps:
       - `q = _device_queues.get(device_id)`; if `None`, return.
       - `try: q.put_nowait(payload) except asyncio.QueueFull: ...`
       - On QueueFull (D-04): if `getattr(q, "_warned_full", False)` is False, emit WARN log `log.warning("signage broadcast queue full for device %s (depth=%s) — dropping oldest", device_id, q.qsize())` (MUST use `%s` format args, NOT f-string, per the Phase 43 CI grep guard), then set `q._warned_full = True`. Then `try: q.get_nowait() except asyncio.QueueEmpty: pass`. Then `q.put_nowait(payload)` (guaranteed to fit now).
       - Do NOT reset `_warned_full` inside `notify_device` — a new queue (created by `subscribe`) has no such attr, so `getattr(..., False)` naturally returns False on the next connection (Pitfall 7).

    5. **MUST NOT contain:** `import subprocess`, `subprocess.run`, `subprocess.Popen`, `import sqlite3`, `import psycopg2`, `require_admin` references (not applicable — service module), f-strings inside log format args.

    Confirm all unit tests written in Task 2 (behavior block) pass:
    ```bash
    docker compose run --rm api pytest backend/tests/test_signage_broadcast.py -x -v
    ```
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_broadcast.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/app/services/signage_broadcast.py` exists
    - `grep -c "_device_queues" backend/app/services/signage_broadcast.py` >= 3 (declaration + subscribe + notify_device)
    - `grep -c "asyncio.Queue(maxsize=32)" backend/app/services/signage_broadcast.py` >= 1
    - `grep -c "QueueFull" backend/app/services/signage_broadcast.py` >= 1
    - `grep -c "workers 1" backend/app/services/signage_broadcast.py` >= 1 (invariant comment mentions literal string "workers 1")
    - `grep -c "docker-compose.yml" backend/app/services/signage_broadcast.py` >= 1 AND `grep -c "scheduler.py" backend/app/services/signage_broadcast.py` >= 1 (invariant comment cross-links)
    - `grep -E "log\.(warning|info|error|debug)\(f\"" backend/app/services/signage_broadcast.py` returns nothing (no f-string format args)
    - `grep -E "^import subprocess|^from subprocess" backend/app/services/signage_broadcast.py` returns nothing
    - `pytest backend/tests/test_signage_broadcast.py -x` exits 0 with all 7 tests passing (A through G)
  </acceptance_criteria>
  <done>`signage_broadcast.py` exists with subscribe/notify_device, invariant comment block references docker-compose.yml and scheduler.py, all 7 unit tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Add devices_affected_by_playlist helper to signage_resolver</name>
  <read_first>
    - backend/app/services/signage_resolver.py (existing `resolve_playlist_for_device` — understand tag-overlap query shape before inverting)
    - backend/app/models/ (signage_* ORM classes — need correct model names for the join)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Open Questions Q1 (recommendation: helper lives in signage_resolver.py)
  </read_first>
  <files>backend/app/services/signage_resolver.py, backend/tests/test_signage_resolver.py</files>
  <action>
    Add a new async helper to `backend/app/services/signage_resolver.py` (do NOT modify existing functions):

    ```python
    async def devices_affected_by_playlist(
        db: AsyncSession, playlist_id: int
    ) -> list[int]:
        """Return device IDs whose resolved playlist could be affected by changes to the given playlist.

        A device is affected iff its tag set overlaps the playlist's target tag set
        (via signage_playlist_tag_map + signage_device_tag_map). Exact semantics mirror
        the reverse direction of resolve_playlist_for_device() — any device that could
        have this playlist chosen by the resolver is returned, regardless of priority
        (a higher-priority rival playlist may still win; the broadcast policy is "notify
        all candidates and let the player re-resolve via /playlist ETag").
        """
    ```

    Implementation: single SQL query joining `signage_playlist_tag_map` (filter by playlist_id) → `signage_device_tag_map` (on tag_id) → distinct `device_id`. Use the same ORM classes `resolve_playlist_for_device` uses (discover via reading the existing function). Exclude devices with `revoked_at IS NOT NULL` (consistent with other player paths). Return `list[int]` sorted for determinism.

    Add an additional helper for device-tag-change case:

    ```python
    async def devices_affected_by_device_update(
        db: AsyncSession, device_id: int
    ) -> list[int]:
        """Return [device_id] — a device's own resolved playlist changes when its tags change."""
    ```

    This is a trivial wrapper returning `[device_id]`, but exists so the admin `devices.py` notify hook (Plan 02) has a single consistent call shape across all mutations.

    Add unit tests to `backend/tests/test_signage_resolver.py` (do NOT create a new test file — extend the existing one):
    - `test_devices_affected_by_playlist_returns_tag_overlap`: seed 3 devices with tags {"lobby"}, {"kitchen"}, {"lobby", "office"} and a playlist targeting {"lobby"}; assert result == sorted([device1_id, device3_id]).
    - `test_devices_affected_by_playlist_excludes_revoked_devices`: seed 2 devices tagged "lobby", revoke one; assert only the non-revoked one returned.
    - `test_devices_affected_by_playlist_empty_for_untagged_playlist`: playlist with no target-tag rows returns `[]`.
    - `test_devices_affected_by_device_update_returns_single_id`: assert returns `[device_id]`.
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_resolver.py::test_devices_affected_by_playlist_returns_tag_overlap backend/tests/test_signage_resolver.py::test_devices_affected_by_playlist_excludes_revoked_devices backend/tests/test_signage_resolver.py::test_devices_affected_by_playlist_empty_for_untagged_playlist backend/tests/test_signage_resolver.py::test_devices_affected_by_device_update_returns_single_id -x -v</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^async def devices_affected_by_playlist" backend/app/services/signage_resolver.py` returns `1`
    - `grep -c "^async def devices_affected_by_device_update" backend/app/services/signage_resolver.py` returns `1`
    - `grep -c "revoked_at" backend/app/services/signage_resolver.py` includes the new helper's filter (count increases from pre-edit baseline)
    - The 4 new tests in `test_signage_resolver.py` all pass (pytest exit 0)
    - Existing tests in `test_signage_resolver.py` still pass (no regressions)
  </acceptance_criteria>
  <done>Both helpers exist, exclude revoked devices, sort output, and all 4 new resolver tests pass alongside the existing suite.</done>
</task>

</tasks>

<verification>
After all tasks:
```bash
docker compose run --rm api pytest backend/tests/test_signage_broadcast.py backend/tests/test_signage_resolver.py -x -v
grep -q "^sse-starlette==3.2.0$" backend/requirements.txt
grep -q "workers 1" backend/app/services/signage_broadcast.py
```
</verification>

<success_criteria>
- sse-starlette==3.2.0 is pinned and importable in the api container
- signage_broadcast.py exists with subscribe + notify_device + --workers 1 invariant comment block referencing docker-compose.yml and scheduler.py
- D-03 last-writer-wins and D-04 drop-oldest-with-warn-once are covered by passing unit tests
- devices_affected_by_playlist + devices_affected_by_device_update exist in signage_resolver.py and handle tag-overlap + revoked-device exclusion
- No f-strings in log format args in signage_broadcast.py (Phase 43 CI guard compliance)
- No sync subprocess / no sqlite3 / no psycopg2 in signage_broadcast.py
</success_criteria>

<output>
After completion, create `.planning/phases/45-sse-broadcast/45-01-broadcast-service-SUMMARY.md` documenting:
- Files created / modified
- Exact subscribe + notify_device signatures
- Which D-decisions each test covers
- Any deviations from the plan and why
</output>
