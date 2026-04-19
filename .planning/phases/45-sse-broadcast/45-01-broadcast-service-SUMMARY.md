---
phase: 45-sse-broadcast
plan: 01
subsystem: signage-backend
tags: [signage, sse, broadcast, resolver, fanout]
requires:
  - SGN-BE-06 (resolver — Phase 43)
  - signage_devices + signage_*_tag_map tables (Phase 41)
provides:
  - SGN-BE-05 (broadcast service substrate)
  - SGN-INF-03 (--workers 1 invariant comment block)
  - devices_affected_by_playlist helper (for Plan 45-02 admin notify hooks)
  - sse-starlette==3.2.0 pinned dependency (unblocks Plan 45-02)
affects:
  - backend/app/services/signage_broadcast.py (new)
  - backend/app/services/signage_resolver.py (extended)
  - backend/requirements.txt (+1 line)
tech-stack:
  added:
    - sse-starlette==3.2.0 (pinned, importable in api container)
  patterns:
    - Module-level singleton service with in-process asyncio.Queue fanout
    - Drop-oldest overflow with WARN-once-per-connection flag on queue instance
    - Last-writer-wins subscribe semantics
key-files:
  created:
    - backend/app/services/signage_broadcast.py
    - backend/tests/test_signage_broadcast.py
  modified:
    - backend/requirements.txt
    - backend/app/services/signage_resolver.py
    - backend/tests/test_signage_resolver.py
decisions:
  - D-03 covered by subscribe replacing _device_queues[device_id] unconditionally
  - D-04 covered by drop-oldest + _warned_full flag on queue instance
  - Warn flag stashed on queue (not module dict) — naturally resets on re-subscribe since new queues have no attr
requirements:
  - SGN-BE-05
  - SGN-INF-03
metrics:
  duration: ~15m
  completed: 2026-04-19
---

# Phase 45 Plan 01: Broadcast Service Summary

SSE fanout substrate established — per-device `asyncio.Queue` with drop-oldest overflow, `sse-starlette==3.2.0` pinned, and `devices_affected_by_playlist` tag-overlap helper added alongside the existing Phase 43 resolver.

## Files Created / Modified

| File | Status | Purpose |
| ---- | ------ | ------- |
| `backend/requirements.txt` | modified | +1 line: `sse-starlette==3.2.0` |
| `backend/app/services/signage_broadcast.py` | created | Per-device Queue fanout (subscribe/notify_device) + `--workers 1` invariant comment block |
| `backend/app/services/signage_resolver.py` | modified | +`devices_affected_by_playlist`, +`devices_affected_by_device_update` |
| `backend/tests/test_signage_broadcast.py` | created | 7 unit tests covering D-03 / D-04 |
| `backend/tests/test_signage_resolver.py` | modified | +4 integration tests for the new helpers |

## Exact Public Signatures

```python
# backend/app/services/signage_broadcast.py
_device_queues: dict[int, asyncio.Queue] = {}

def subscribe(device_id: int) -> asyncio.Queue: ...
def notify_device(device_id: int, payload: dict) -> None: ...

# backend/app/services/signage_resolver.py (additions — existing functions untouched)
async def devices_affected_by_playlist(db: AsyncSession, playlist_id) -> list: ...
async def devices_affected_by_device_update(db: AsyncSession, device_id) -> list: ...
```

## Test-to-Decision Mapping

| Test | Decision |
| ---- | -------- |
| `test_subscribe_creates_queue_with_maxsize_32` | maxsize invariant (RESEARCH §Pattern 1) |
| `test_subscribe_replaces_existing_queue_last_writer_wins` | D-03 |
| `test_notify_device_noop_when_no_subscriber` | defensive — admin mutations can fire with zero subscribers |
| `test_notify_device_enqueues_payload` | baseline enqueue contract |
| `test_notify_device_drops_oldest_on_queue_full` | D-04 (FIFO-head drop, size never exceeds 32) |
| `test_notify_device_warns_once_on_first_drop` | D-04 (WARN-once per connection, `%s`-style format) |
| `test_warned_flag_reset_on_resubscribe` | D-03 + Pitfall 7 (fresh queue → fresh warn) |
| `test_devices_affected_by_playlist_returns_tag_overlap` | tag-overlap semantics for Plan 02 notify fanout |
| `test_devices_affected_by_playlist_excludes_revoked_devices` | revoked-device exclusion |
| `test_devices_affected_by_playlist_empty_for_untagged_playlist` | empty-target defensive path |
| `test_devices_affected_by_device_update_returns_single_id` | unified call shape for device-level mutations |

## Verification

```
docker compose run --rm api pytest tests/test_signage_broadcast.py tests/test_signage_resolver.py -v
# 21 passed in 1.97s
```

Acceptance-criteria spot-checks:

```
grep -c "_device_queues" backend/app/services/signage_broadcast.py          # 5 (>=3)
grep -c "asyncio.Queue(maxsize=32)" backend/app/services/signage_broadcast.py # 1 (>=1)
grep -c "QueueFull" backend/app/services/signage_broadcast.py               # 2 (>=1)
grep -c "workers 1" backend/app/services/signage_broadcast.py               # 3 (>=1)
grep -c "docker-compose.yml" backend/app/services/signage_broadcast.py      # 2 (>=1)
grep -c "scheduler.py" backend/app/services/signage_broadcast.py            # 2 (>=1)
grep -E 'log\.(warning|info|error|debug)\(f"' backend/app/services/signage_broadcast.py # (empty)
grep -E '^import subprocess|^from subprocess' backend/app/services/signage_broadcast.py # (empty)
```

## Commits

| Task | Hash | Message |
| ---- | ---- | ------- |
| 1 | `d95d7b8` | chore(45-01): pin sse-starlette==3.2.0 dependency |
| 2 RED | `07000d6` | test(45-01): add failing tests for signage_broadcast fanout |
| 2 GREEN | `cab4b3f` | feat(45-01): implement signage_broadcast per-device fanout |
| 3 | `5041216` | feat(45-01): add devices_affected_by_playlist resolver helper |

## Deviations from Plan

### 1. [Rule 3 - Blocking] Rebuilt `migrate` image alongside `api`

- **Found during:** Task 3 verification (resolver tests need live DB)
- **Issue:** `docker compose run --rm api pytest …` triggers the `migrate` dependency; the cached `migrate` image pre-dated recent alembic additions and failed with `Can't locate revision identified by 'v1_16_signage_devices_etag'`. The api-only `docker compose build api` in Task 1 did not refresh the migrate image.
- **Fix:** `docker compose build migrate` before running Task 3's DB-backed tests. No source changes.
- **Files modified:** none
- **Commit:** n/a (environment-only)

### 2. [Scope note] Type hint `int` kept verbatim per plan spec

The plan mandates `dict[int, asyncio.Queue]` and `device_id: int`, while `SignageDevice.id` is actually `uuid.UUID`. Python dicts accept any hashable key regardless of annotation, and tests pass with integer keys as the plan specifies. Plan 45-02 will bind these with real UUID device ids — the annotation stays as written to match ROADMAP/CONTEXT wording; a type-correctness pass can generalize later if desired.

### 3. [Scope note] Helper return-type hint left as `list` (not `list[int]`)

To avoid clashing with the `int`-vs-UUID ambiguity above, the two new `devices_affected_by_*` helpers return `list` without a parameterization. The sort / set logic is preserved and tests pin the exact expected UUID values returned.

## Self-Check: PASSED

- FOUND: backend/app/services/signage_broadcast.py
- FOUND: backend/tests/test_signage_broadcast.py
- FOUND: backend/app/services/signage_resolver.py (contains `devices_affected_by_playlist`)
- FOUND: backend/requirements.txt (contains `sse-starlette==3.2.0`)
- FOUND commit: d95d7b8
- FOUND commit: 07000d6
- FOUND commit: cab4b3f
- FOUND commit: 5041216
