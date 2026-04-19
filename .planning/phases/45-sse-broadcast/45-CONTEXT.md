# Phase 45: SSE Broadcast - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver server-side real-time push for signage: a `sse-starlette` endpoint that streams
`playlist-changed` events to connected player devices within 2s of any admin mutation
that could change the device's resolved playlist, while preserving the `--workers 1` +
APScheduler singleton + PPTX semaphore invariants that require single-process ownership.
Polling (Phase 43) remains as the safety-net fallback.

In scope: `backend/app/services/signage_broadcast.py` (in-process `asyncio.Queue` fanout
per device, QueueFull drop-policy, `--workers 1` invariant comment block), the
`GET /api/signage/player/stream` endpoint with 15s `: ping` keepalive, admin-mutation
notify hooks, generator `finally` cleanup verified by test.

Out of scope: client-side SSE consumer (Phase 47 Player Bundle), admin UI surfacing
connection status (Phase 46), multi-worker support (permanently deferred — invariant).
</domain>

<decisions>
## Implementation Decisions

### Event Payload
- **D-01:** SSE `data:` is a compact JSON object with shape
  `{"event": "playlist-changed", "playlist_id": <int>, "etag": "<weak-etag>"}`.
  Symmetrical with the Phase 43 polling endpoint's ETag contract — players compare
  `etag` against their last cached value and skip the `/playlist` refetch on match.
  Keeps event small (fits easily in a 32-slot queue) and allows future event types
  via the `event` discriminator without breaking the wire format.

### Broadcast Trigger Scope
- **D-02:** Fire `playlist-changed` on any admin mutation that can change the output
  of `resolve_playlist_for_device()`:
  - Playlist CRUD: `POST/PUT/DELETE /api/signage/admin/playlists[/{id}]`
  - Playlist-item mutations: add/remove/reorder items, per-item duration/transition changes
  - Media mutations that change what gets served: metadata edits, reconvert-done
    transition (PPTX `status: processing → done` in Phase 44), media delete
  - Device tag changes: `PUT /api/signage/admin/devices/{id}` when `tags` field changes
  - NOT fired on: cosmetic-only fields that don't affect the resolved playlist
    (e.g., admin notes, display name on device where tags unchanged)
  - Polling (30s, Phase 43) remains the safety net for anything missed

### Multi-Connection Policy
- **D-03:** Last-writer-wins on duplicate `device_id` SSE connections. When a second
  stream opens for the same `device_id`, the old queue is replaced in
  `_device_queues: dict[int, asyncio.Queue]` and the old generator's blocked
  `await queue.get()` is cancelled, triggering its `finally` cleanup. Matches the
  single-row shape already used by `last_seen_at` and the ROADMAP's explicit
  `_device_queues` singular-keyed map. Covers the real-world case where a Pi reboots
  before TCP reset reaches the server.

### Queue-Full Drop Policy
- **D-04:** On `QueueFull`: drop the **oldest** queued event
  (`queue.get_nowait()` to discard, then `queue.put_nowait(new)`), NOT the newest.
  With payload D-01, newer events for the same playlist strictly dominate older ones
  (the etag already subsumes earlier state), so freshness > completeness. Log at
  WARN level on the first drop per connection (use a per-queue flag to avoid log
  spam on persistently slow clients); subsequent drops are silent until reconnect.

### Claude's Discretion
- Internal queue naming (`_device_queues` is ROADMAP-mandated; sub-names like
  `notify_device(...)` / `subscribe(device_id)` are implementation detail).
- Exact ping string (`": ping\n\n"` vs `": keepalive\n\n"` — any SSE comment works).
- Test-suite structure (unit tests for queue policies + one integration test for
  the full mutation → event round-trip; plan can split however is cleanest).
- Whether `notify_device` is a sync/async helper or a module-level function vs
  class method — planner decides.
- Exact inline-comment wording for the `--workers 1` invariant block, as long as
  it mirrors the same three points as `docker-compose.yml` and `scheduler.py`
  (single-process-only, why, what breaks if multi-worker).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROADMAP & Requirements
- `.planning/ROADMAP.md` §Phase 45: SSE Broadcast (lines 248–257) — goal,
  dependencies, success criteria (5 clients + p95 <100ms, 1s event delivery,
  QueueFull drop, finally-block cleanup), `--workers 1` invariant (line 304).
- `.planning/REQUIREMENTS.md` SGN-BE-05, SGN-DIFF-01, SGN-INF-03 (lines 29, 70, 84).

### Phase 43 — Polling + Admin API (upstream dependency)
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-SUMMARY.md` —
  admin mutation routes that need notify hooks; `resolve_playlist_for_device()`
  resolver and its tag-overlap logic; ETag contract on `GET /player/playlist`.
- `backend/app/routers/signage_admin/*.py` — admin mutation routes where
  `notify_device(...)` calls will be inserted.
- `backend/app/services/signage_resolver.py` (or equivalent per Phase 43 SUMMARY)
  — tag-overlap logic that broadcast must match when deciding which devices to
  notify for a given mutation.

### Phase 44 — PPTX Pipeline (trigger source for media reconvert-done)
- `.planning/phases/44-pptx-conversion-pipeline/44-02-pptx-conversion-service-SUMMARY.md`
  — `convert_pptx()` state-machine transition to `status: done` is a notify
  trigger per D-02.

### Invariant Enforcement (existing pattern to mirror)
- `docker-compose.yml` — `command: uvicorn ... --workers 1` with inline comment
  block explaining invariant.
- `backend/app/scheduler.py` — APScheduler `max_instances=1` + `coalesce=True`
  with same invariant comment block. `signage_broadcast.py` must carry a
  matching comment.

### Auth (player stream gate)
- `backend/app/routers/signage_player/` (Phase 42) — device-token auth dependency
  used by polling endpoints; the SSE endpoint reuses the same dependency.

### Library Docs
- `sse-starlette` — Python package docs for `EventSourceResponse`, ping/keepalive
  config, and generator cleanup semantics. Use Context7 MCP at research time if
  available.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolve_playlist_for_device(device_id, db) → PlaylistEnvelope` (Phase 43) —
  already computes tag-overlap → playlist. Broadcast uses the inverse:
  given a mutation's affected tags/playlist/media, list all devices whose
  resolver output *could* have changed. Expect planner to add a
  sibling `devices_affected_by_mutation(...)` helper in the same module.
- Device-token FastAPI dependency (Phase 42) — attach to SSE endpoint.
- Phase 43 ETag generator for playlist envelope — reuse to populate D-01 payload.

### Established Patterns
- Singleton service modules live in `backend/app/services/signage_*.py`
  (`signage_pptx.py`, `signage_resolver.py`). `signage_broadcast.py` follows
  the same shape.
- `--workers 1` invariant comment block: three points, inline, near top of file.
- Structured logging via `logging.getLogger(__name__)` with no f-strings in the
  format string (Phase 43 CI grep guard).
- No `import subprocess` / no sync HTTP / no `require_admin` per-route when
  parent router already gates (Phase 43+44 CI grep guards — planner must keep
  these green in `signage_broadcast.py`).

### Integration Points
- Admin mutation routes in `backend/app/routers/signage_admin/` — a single
  `notify_device(...)` call at the end of each successful mutation (after DB
  commit, before return) is the cleanest insertion point.
- New FastAPI route: `GET /api/signage/player/stream` in the player router
  (Phase 42 location).
- `backend/tests/test_signage_broadcast.py` (new) — queue policies + lifecycle.
- CI grep guards file `backend/tests/test_signage_ci_guards.py` (Phase 44) —
  extend with `signage_broadcast.py` assertions.

</code_context>

<specifics>
## Specific Ideas

- Success-criteria #1 (5 clients + `/api/health` p95 <100ms) implies planner must
  include a lightweight benchmark or concurrency test, not just unit tests.
- Success-criteria #4 (finally-block cleanup verified) — the test must actually
  connect, disconnect, and assert `_device_queues` has no stale entry. Not a
  mock-only test.
- Payload uses the existing Phase 43 weak-ETag format verbatim — do not invent a
  new hash.
- WARN log on first queue drop per connection should include `device_id` and the
  queue depth at drop time, for ops debugging.

</specifics>

<deferred>
## Deferred Ideas

- Multi-worker SSE fanout (Redis pub/sub or similar) — permanently out of scope
  per `--workers 1` invariant.
- Admin-side dashboard of currently-connected SSE devices — belongs in Phase 46
  (Admin UI) if desired.
- Server-Sent Event types beyond `playlist-changed` (device-paired, media-
  uploaded, etc.) — the `event` discriminator in D-01 leaves room, but other
  event types are explicitly deferred until a future phase needs them.
- Client-side reconnect/backoff behavior — Phase 47 (Player Bundle) concern.

</deferred>

---

*Phase: 45-sse-broadcast*
*Context gathered: 2026-04-19*
