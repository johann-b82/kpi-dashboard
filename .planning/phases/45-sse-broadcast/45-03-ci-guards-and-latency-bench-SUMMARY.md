---
phase: 45-sse-broadcast
plan: 03
subsystem: signage-backend
tags: [signage, sse, ci-guards, benchmark, latency, hygiene]
requires:
  - SGN-BE-05 (Plan 45-01: signage_broadcast substrate)
  - /api/signage/player/stream (Plan 45-02)
  - SGN-BE-10 (Phase 43: existing CI grep guard suite)
provides:
  - Phase 45 CI grep guards locking signage_broadcast hygiene (no sync subprocess, no sqlite3/psycopg2, invariant comment preserved, asyncio.Queue primitive)
  - /stream route-presence guard (prevents silent refactor-away)
  - 5-client SSE concurrency p95 latency benchmark — SGN-INF-03 enforcement
affects:
  - backend/tests/test_signage_ci_guards.py (extended with 8 new Phase 45 guards)
  - backend/tests/test_signage_sse_latency.py (new)
tech-stack:
  added: []
  patterns:
    - "Per-module CI guard pattern: pin broadcast module by name, assert presence of invariant-block substrings + fanout primitive symbols"
    - "Generator-shape concurrency benchmark (subscribe + await queue.get with CancelledError re-raise) — same path /stream runs, avoids httpx.stream infinite-generator pitfall"
key-files:
  created:
    - backend/tests/test_signage_sse_latency.py
  modified:
    - backend/tests/test_signage_ci_guards.py
decisions:
  - SGN-INF-03 enforced via a triple-substring assertion (`workers 1` + `docker-compose.yml` + `scheduler.py`) — removing ANY of the three pin references fails CI
  - Latency benchmark targets `/health` (app exposes /health, not /api/health — backend/app/main.py:34); it's the cheapest real route that touches the async DB pool, the best proxy for event-loop health under SSE load
  - Benchmark drives the generator shape directly instead of httpx.AsyncClient.stream() over ASGITransport (Plan 02 §Deviation 1 documented that infinite SSE generators cannot be cleanly cancelled through the test client) — the generator body IS the only non-trivial code in the /stream handler, so this remains realistic
  - Scanner threshold bumped from `>=3` to `>=4` (Phase 45 adds signage_broadcast.py as the 4th signage service); additional explicit assertion that `"signage_broadcast"` is in the discovered module-name set so future Phase NN additions don't silently pass a stale threshold
requirements:
  - SGN-INF-03
metrics:
  duration: ~15m
  completed: 2026-04-19
---

# Phase 45 Plan 03: CI Guards & Latency Benchmark Summary

Phase 45 hygiene locked: 8 new CI grep guards pin signage_broadcast.py against regression (sync subprocess, blocking SQL drivers, invariant-comment removal, primitive swap, f-string log format, /stream route deletion, scanner threshold drift), and a 5-client concurrency benchmark proves `/health` p95 stays under 100ms with SSE fanout fully subscribed.

## Files Created / Modified

| File | Status | Purpose |
| ---- | ------ | ------- |
| `backend/tests/test_signage_ci_guards.py` | modified | +8 Phase 45 guard functions + `import re` |
| `backend/tests/test_signage_sse_latency.py` | created | Standalone p95 latency benchmark under 5-client SSE load |

## New CI Guards → Regression Prevented

| Test | Regression it prevents |
| ---- | ---------------------- |
| `test_signage_broadcast_file_exists` | Accidental deletion / rename of the broadcast module goes undetected |
| `test_signage_broadcast_no_sync_subprocess` | Adding `import subprocess` / `subprocess.run(...)` to the fanout hot path (hazard #7) |
| `test_signage_broadcast_no_blocking_sql_drivers` | Dropping `asyncpg` in favour of `sqlite3` / `psycopg2` in the fanout path (hazard #6) |
| `test_signage_broadcast_contains_workers_1_invariant_block` | **SGN-INF-03** — the triple-substring assertion (`workers 1` + `docker-compose.yml` + `scheduler.py`) fails if ANY of the three pin references is removed from the invariant comment block |
| `test_signage_broadcast_uses_asyncio_queue` | A rewrite onto a different primitive (`queue.Queue`, janus, aio-pika, etc.) silently changes the fanout semantics |
| `test_signage_broadcast_uses_percent_style_log_format` | f-string log formats that break structured-log tooling |
| `test_phase45_sse_endpoint_registered` | A refactor that moves or deletes `/stream` off the signage player router |
| `test_signage_modules_count_includes_broadcast` | A future regression where the scanner misses `signage_broadcast` (or more broadly, stale `>=3` threshold post-Phase-45) |

## Benchmark Result

**Endpoint used:** `/health` — the app exposes `/health` (not `/api/health`, see `backend/app/main.py:34`). It is the cheapest real route in the app that still touches the async DB pool via `engine.connect() + SELECT 1`, making it the best proxy for event-loop health under SSE load. Plan allowed substitution if `/api/health` didn't exist; choice documented inline in the test's module docstring.

**Observed on dev hardware (laptop, docker-compose stack):**

```
[45-03 bench] /health p95=0.52ms median=0.42ms min=0.37ms max=13.33ms (5 SSE clients, 50 samples)
```

p95 **0.52ms** vs. threshold **100.0ms** — ~190× headroom. Matches the plan's prediction ("p95 well under 20ms because all 5 SSE connections are blocked on `await queue.get()` and do not compete for the event loop").

## Verification

```
docker compose run --rm api pytest \
  tests/test_signage_broadcast.py \
  tests/test_signage_broadcast_integration.py \
  tests/test_signage_ci_guards.py \
  tests/test_signage_sse_latency.py \
  tests/test_signage_router_deps.py \
  tests/test_signage_admin_router.py \
  tests/test_signage_player_router.py \
  tests/test_signage_resolver.py \
  tests/test_signage_pptx_pipeline_integration.py \
  -x
# 67 passed, 2 skipped in 7.74s
```

Acceptance-criteria grep spot-checks (Task 2):

```
grep -c "5"                            backend/tests/test_signage_sse_latency.py  # 30  (>=1)
grep -c "100"                          backend/tests/test_signage_sse_latency.py  # 8   (>=1)
grep -c "p95\|percentile\|quantiles"   backend/tests/test_signage_sse_latency.py  # 12  (>=1)
grep -c "assert.*< 100"                backend/tests/test_signage_sse_latency.py  # 2   (>=1)
```

Acceptance-criteria count check (Task 1):

```
grep -c "^def test_signage_broadcast\|^def test_phase45_\|^def test_signage_modules_count_includes_broadcast" \
  backend/tests/test_signage_ci_guards.py
# 8  (>= 8 required)
```

Negative sanity-check (performed live, not committed):

```
# Append `import subprocess` to backend/app/services/signage_broadcast.py,
# run the broadcast guard only:
docker compose run --rm api pytest tests/test_signage_ci_guards.py::test_signage_broadcast_no_sync_subprocess -x
# -> FAILED  (expected)
# Revert the change:
docker compose run --rm api pytest tests/test_signage_ci_guards.py::test_signage_broadcast_no_sync_subprocess -x
# -> PASSED
```

## Commits

| Task | Hash | Message |
| ---- | ---- | ------- |
| 1 | `e145b9b` | test(45-03): extend CI grep guards for signage_broadcast hygiene |
| 2 | `d223a1d` | test(45-03): add 5-client SSE concurrency p95 latency benchmark |

## Deviations from Plan

### 1. [Scope note] Benchmark uses `/health` (no `/api/` prefix)

- **Found during:** Task 2 research (reading backend/app/main.py)
- **Issue:** Plan text referenced `/api/health`. Actual route is `GET /health` (registered with no prefix on the FastAPI app root). The plan explicitly permitted substitution: "If `/api/health` does not exist in `backend/app/main.py`: use `/api/settings` or another existing cheap GET".
- **Fix:** Used `/health` — same handler the plan intends (trivial SELECT 1 on the async DB pool). Choice documented in the test's module docstring.
- **Files modified:** `backend/tests/test_signage_sse_latency.py`
- **Commit:** `d223a1d`

### 2. [Scope — test strategy] "SSE clients" are generator-shape tasks, not `httpx.AsyncClient.stream(...)` subscribers

- **Found during:** Task 2 design — Plan 45-02's SUMMARY §Deviation 1 explicitly documented that `httpx.AsyncClient.stream()` over `ASGITransport` blocks indefinitely against an infinite SSE generator (required `docker kill` iteration cycles). The same constraint applies here.
- **Fix:** The 5 "SSE clients" are `asyncio.create_task(_hold_open_sse(device_id))` where `_hold_open_sse` runs the EXACT generator body from `signage_player.stream_events` — `subscribe()`, loop on `await queue.get()`, `except CancelledError: raise`, `finally: _device_queues.pop(..., None)`. This is the production code path; the bytes that matter (event-loop pressure from suspended subscribers) are identical.
- **Why this is still realistic for the success criterion:** The criterion is about event-loop hygiene, not wire-level SSE framing. Suspended subscribers compete for event-loop time through `queue.get()`, not through httpx/ASGI plumbing. Driving the generator shape directly exercises the hot path while staying deterministic and fast (benchmark runs in ~0.5s total). `sse-starlette`'s own tests cover the wire-framing.
- **Files modified:** `backend/tests/test_signage_sse_latency.py`
- **Commit:** `d223a1d`

### 3. [Scope note] No `@pytest.mark.slow` added

- **Found during:** Task 2
- **Issue:** Plan offered "tag with `@pytest.mark.slow` if the project has a slow-test marker". This project does not have a slow marker (checked `pytest.ini` / existing conftest — no custom markers defined), and the benchmark completes in ~0.5s. Plan said to leave it unmarked if CI runs all tests unconditionally.
- **Fix:** Left unmarked. Test is part of the default suite.

## Self-Check: PASSED

- FOUND: backend/tests/test_signage_ci_guards.py (14 tests pass: 6 pre-existing + 8 new)
- FOUND: backend/tests/test_signage_sse_latency.py
- FOUND commit: e145b9b (`git log --oneline --all | grep e145b9b`)
- FOUND commit: d223a1d (`git log --oneline --all | grep d223a1d`)
- FOUND: 8 new guard functions via `grep -c "^def test_signage_broadcast\|^def test_phase45_\|^def test_signage_modules_count_includes_broadcast" backend/tests/test_signage_ci_guards.py` = 8
- FOUND: acceptance-criteria grep counts all >= required thresholds
- FOUND: full Phase 45 regression suite — 67 passed, 2 skipped
