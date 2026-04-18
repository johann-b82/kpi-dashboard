---
phase: 43-media-playlist-device-admin-api-polling
plan: 04
subsystem: backend/signage
tags: [signage, player, heartbeat, scheduler, etag]
requires:
  - 43-01 (current_playlist_etag column)
  - 43-02 (resolver + schemas + PlaylistEnvelope + HeartbeatRequest)
provides:
  - "GET /api/signage/player/playlist (ETag/304, D-10 pure-read)"
  - "POST /api/signage/player/heartbeat (204, D-11/D-12 presence update)"
  - "signage_heartbeat_sweeper APScheduler job (SGN-SCH-01, 1-min interval)"
affects:
  - backend/app/main.py (router include)
  - backend/app/scheduler.py (new job + imports)
tech-stack:
  added: []
  patterns:
    - "Router-level device-token dep via APIRouter(dependencies=[Depends(get_current_device)])"
    - "ETag/304 via fastapi.Response(status_code=304) + If-None-Match header"
    - "Heartbeat sweeper mirrors v1.15 sensor_poll cadence + guardrails"
key-files:
  created:
    - backend/app/routers/signage_player.py
    - backend/tests/test_signage_player_router.py
    - backend/tests/test_signage_heartbeat_sweeper.py
  modified:
    - backend/app/main.py
    - backend/app/scheduler.py
decisions:
  - "Stripped surrounding quotes from If-None-Match before comparison so kiosks sending either quoted or unquoted forms both match."
  - "Sweeper SQL carries three predicates (last_seen_at < now-5min, status != offline, revoked_at IS NULL) so rowcount represents real state transitions, not idempotent rewrites."
  - "Kept existing SignageDevice.updated_at in .values() (model has the column) so updated_at reflects the sweep event."
metrics:
  duration: "~8m"
  completed: 2026-04-18
  tasks: 3
  files_touched: 5
---

# Phase 43 Plan 04: Player Router & Heartbeat Sweeper Summary

## One-liner

Device-facing polling endpoints (`GET /playlist` with ETag/304, `POST /heartbeat` returning 204) plus the 1-minute `signage_heartbeat_sweeper` APScheduler job that flips stale online devices to offline — closing the polling-only feedback loop for v1.16 Digital Signage.

## What shipped

- **`backend/app/routers/signage_player.py`** — new router under `/api/signage/player` with a router-level `Depends(get_current_device)` gate (D-02).
  - `GET /playlist` resolves the tag-best playlist via `resolve_playlist_for_device`, computes an ETag via `compute_playlist_etag`, and short-circuits to `304` with empty body when the client's `If-None-Match` matches (D-09). The handler does **not** touch `signage_devices.last_seen_at` — heartbeat owns presence (D-10).
  - `POST /heartbeat` writes `last_seen_at` / `current_item_id` / `current_playlist_etag`, flips `status` from `offline` to `online` on the transition, and returns `204` with no body (D-11, D-12).
- **`backend/app/scheduler.py`** — registered `signage_heartbeat_sweeper` (SGN-SCH-01, D-15):
  - New `HEARTBEAT_SWEEPER_JOB_ID` module constant.
  - `_run_signage_heartbeat_sweeper()`: single `UPDATE` flipping devices with `last_seen_at < now() - interval '5 min'` AND `status != 'offline'` AND `revoked_at IS NULL` to `status='offline'`. Wrapped in `asyncio.wait_for(timeout=20)` and always rolls back on exception; never raises out.
  - `add_job(..., trigger="interval", minutes=1, max_instances=1, coalesce=True, misfire_grace_time=30)` added inside `lifespan()` alongside the 03:00 UTC `signage_pairing_cleanup`.
- **`backend/app/main.py`** — wired `signage_player_router` (merged cleanly alongside the parallel Wave-2 plan 43-03's `signage_admin_router` addition).
- **Tests** — 15 new tests, all green:
  - `test_signage_player_router.py`: device-token gate (401), user-JWT rejection (401 — wrong scope), envelope shape + headers, ETag round-trip ending in `304` with empty body, D-10 `last_seen_at` non-mutation, `204` heartbeat with DB side-effects, `offline→online` flip, null-payload acceptance.
  - `test_signage_heartbeat_sweeper.py`: `HEARTBEAT_SWEEPER_JOB_ID` constant export, stale flip, fresh device untouched, revoked device excluded, already-offline idempotency, lifespan smoke test asserting 1-minute interval.

## Verification

```text
docker exec kpi-dashboard-api-1 pytest tests/test_signage_player_router.py \
  tests/test_signage_heartbeat_sweeper.py tests/test_signage_resolver.py \
  tests/test_signage_pair_router.py tests/test_signage_pairing_cleanup.py -x
=> 44 passed in 4.76s
```

App-level import check:

```text
docker exec kpi-dashboard-api-1 python -c "from app.main import app; ..."
=> ['/api/signage/player/heartbeat', '/api/signage/player/playlist']
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Strip quotes from `If-None-Match` before comparison | Some HTTP clients send the ETag quoted, some don't; comparing on the raw hex digest absorbs both without breaking RFC 7232 compliance on the server output. |
| Keep `updated_at=func.now()` in sweeper UPDATE | `SignageDevice.updated_at` exists in the ORM model (inspected in Task 2 read_first); letting the sweep advance it makes "when did this device last change state" explicit. |
| Device-JWT gate on router constructor (not per-route) | Matches cross-cutting hazard #5 (router-level admin gate) adapted for device scope; Phase 43 Plan 05's dep-audit test will grep-assert this shape. |
| No resolver re-invocation inside `/heartbeat` | The kiosk sends us its `playlist_etag`; we persist it for observability but don't re-compute. Heartbeat is a write path, not an ETag negotiator. |

## Deviations from Plan

**None for Rules 1-3.** Plan executed as written; no auto-fixes required.

Coordination note: the parallel Wave-2 plan 43-03 added `signage_admin_router` to `backend/app/main.py` concurrently. Git applied both insertions without conflict because they landed on adjacent lines; the final `main.py` now includes `signage_player_router` (this plan) and `signage_admin_router` (Plan 43-03) side-by-side.

## Dependency Graph Update

```
43-01 (ETag column) ──┐
                      ├─► 43-04 (this plan) ──► 43-05 (dep-audit + grep guards)
43-02 (resolver)   ──┘
```

Plan 43-04 unblocks 43-05 (which now has the real player router surface to grep-audit against) and closes the SGN-BE-02 / SGN-SCH-01 requirements.

## Self-Check: PASSED

- FOUND: backend/app/routers/signage_player.py
- FOUND: backend/app/scheduler.py (modified — HEARTBEAT_SWEEPER_JOB_ID + sweeper)
- FOUND: backend/app/main.py (modified — signage_player_router include)
- FOUND: backend/tests/test_signage_player_router.py
- FOUND: backend/tests/test_signage_heartbeat_sweeper.py
- FOUND commit: af30953 (router + main)
- FOUND commit: 97c5b54 (sweeper)
- FOUND commit: 9967a75 (tests)
