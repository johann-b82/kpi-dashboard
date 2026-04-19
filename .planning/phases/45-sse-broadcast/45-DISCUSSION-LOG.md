# Phase 45: SSE Broadcast - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 45-sse-broadcast
**Areas discussed:** Event Payload Shape, Broadcast Trigger Scope, Multi-Connection Policy, Queue-Full Drop Policy

---

## Event Payload Shape

| Option | Description | Selected |
|--------|-------------|----------|
| A. Minimal | `{"event": "playlist-changed"}` — player always re-polls | |
| B. With ID + ETag | `{"event": "playlist-changed", "playlist_id": N, "etag": "..."}` — player can short-circuit on etag match | ✓ |
| C. Full payload | Embed full PlaylistEnvelope in event | |

**User's choice:** B
**Notes:** Symmetrical with the existing Phase 43 polling + ETag contract. Keeps event small enough to fit in 32-slot queue. Leaves room for future event types via `event` discriminator.

---

## Broadcast Trigger Scope

| Option | Description | Selected |
|--------|-------------|----------|
| A. Playlist-only | Playlist CRUD + items only | |
| B. Resolved-impact set | Any mutation that can change `resolve_playlist_for_device()` output — playlist CRUD/items + media metadata/reconvert-done + device tag changes | ✓ |
| C. Everything | All signage admin mutations | |

**User's choice:** B
**Notes:** Matches SGN-DIFF-01 real-time-push promise without noisy events that change nothing for players. Media reconvert-done is the other big UX trigger (PPTX finishes → slides appear). Polling covers the rest as safety net.

---

## Multi-Connection Policy

| Option | Description | Selected |
|--------|-------------|----------|
| A. Allow both (fan-out) | `dict[int, list[Queue]]` — both receive events | |
| B. Replace (last-writer-wins) | New connection evicts old queue; old generator's `finally` cleans up | ✓ |
| C. Reject second | Return 409 on duplicate device_id | |

**User's choice:** B
**Notes:** Simplest state shape matching the ROADMAP's `_device_queues` (dict keyed by device_id to a single Queue). Handles Pi-reboot case where old socket is already dead but hasn't been TCP-reset yet.

---

## Queue-Full Drop Policy

| Option | Description | Selected |
|--------|-------------|----------|
| A. Drop newest | `put_nowait` fails → swallow, discard newest | |
| B. Drop oldest | Pop one from queue, enqueue new event; WARN on first drop per connection | ✓ |
| C. Coalesce to sentinel | Drop everything, enqueue one "resync" sentinel | |

**User's choice:** B
**Notes:** With payload D-01 (ID + ETag), newer events strictly dominate older ones for the same playlist. Freshness > completeness. WARN log on first drop per connection for ops visibility; silent thereafter to avoid spam.

---

## Claude's Discretion

- Internal naming of helper functions inside `signage_broadcast.py`
- Exact SSE ping string (any SSE comment line works)
- Test suite split (unit + integration structure)
- Exact wording of `--workers 1` invariant comment block, as long as the three invariant points from `docker-compose.yml` + `scheduler.py` are mirrored

## Deferred Ideas

- Multi-worker SSE fanout (Redis pub/sub) — permanently out of scope per invariant
- Admin dashboard of connected SSE devices — Phase 46 if desired
- Additional event types beyond `playlist-changed` — deferred until needed
- Client-side reconnect/backoff — Phase 47 (Player Bundle) concern
