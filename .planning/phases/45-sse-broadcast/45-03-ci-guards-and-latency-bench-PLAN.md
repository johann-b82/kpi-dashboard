---
phase: 45-sse-broadcast
plan: 03
type: execute
wave: 3
depends_on:
  - 45-01
  - 45-02
files_modified:
  - backend/tests/test_signage_ci_guards.py
  - backend/tests/test_signage_sse_latency.py
autonomous: true
requirements:
  - SGN-INF-03

must_haves:
  truths:
    - "CI grep guards fail the build if signage_broadcast.py grows a sync subprocess / sqlite3 / psycopg2 import, or if the --workers 1 invariant comment block is removed"
    - "With 5 concurrent SSE clients connected, GET /api/health p95 response latency stays under 100ms"
    - "signage_broadcast.py is present in the set scanned by CI guard tests (len(signage_modules) >= 4)"
  artifacts:
    - path: backend/tests/test_signage_ci_guards.py
      provides: "Phase 45 block asserting broadcast module hygiene + invariant-comment presence"
      contains: "signage_broadcast"
    - path: backend/tests/test_signage_sse_latency.py
      provides: "5-client concurrency benchmark verifying /api/health p95 <100ms under SSE load"
  key_links:
    - from: backend/tests/test_signage_ci_guards.py
      to: backend/app/services/signage_broadcast.py
      via: "File scan asserting no sync subprocess, presence of asyncio.Queue + _device_queues + workers-1 comment"
      pattern: "signage_broadcast"
---

<objective>
Lock Phase 45 hygiene: extend the existing CI grep-guard suite to cover `signage_broadcast.py` (no sync subprocess, no sqlite3/psycopg2, invariant comment block present, `_device_queues` symbol present), and add a concurrency benchmark that proves success-criterion #1 from the phase goal (5 concurrent SSE clients keep `/api/health` p95 under 100ms).

Purpose: Satisfies SGN-INF-03 (invariant documented and *enforced* by CI) and closes success-criterion #1 from the phase goal that Plan 02's integration tests do not cover (concurrency/latency is explicitly out of scope for Plan 02's correctness tests).

Output: Extended `test_signage_ci_guards.py` with a Phase 45 block; new `test_signage_sse_latency.py` standalone benchmark.
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
@.planning/phases/45-sse-broadcast/45-02-stream-endpoint-and-notify-hooks-SUMMARY.md
@backend/tests/test_signage_ci_guards.py
@backend/app/services/signage_broadcast.py
@backend/app/routers/signage_player.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend CI grep guards for signage_broadcast.py</name>
  <read_first>
    - backend/tests/test_signage_ci_guards.py (existing Phase 43 + Phase 44 guard blocks — mirror the extension pattern)
    - backend/app/services/signage_broadcast.py (Plan 01 — confirm what must be asserted)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Pitfall 5 (pins the pattern: add a Phase 45 guard asserting broadcast module stays hygienic)
  </read_first>
  <files>backend/tests/test_signage_ci_guards.py</files>
  <action>
    Extend `backend/tests/test_signage_ci_guards.py` with a new Phase 45 block following the Phase 44 extension pattern already in the file. Add the following tests (each a separate function, each with a descriptive name):

    1. **`test_signage_broadcast_file_exists`**: Assert `backend/app/services/signage_broadcast.py` exists on disk via `pathlib.Path(__file__).resolve().parents[1] / "app" / "services" / "signage_broadcast.py"` (match the path-resolution style already used in the file).

    2. **`test_signage_broadcast_no_sync_subprocess`**: Read the file; assert none of these substrings appear anywhere: `subprocess.run(`, `subprocess.Popen(`, `subprocess.call(`, `subprocess.check_call(`, `subprocess.check_output(`, `from subprocess import`, `import subprocess`.

    3. **`test_signage_broadcast_no_blocking_sql_drivers`**: Assert neither `import sqlite3` nor `import psycopg2` nor `from psycopg2` appears in the file (project-wide hard constraint mirrored per-file).

    4. **`test_signage_broadcast_contains_workers_1_invariant_block`**: Assert all three of these substrings are present in the file (anywhere, case-sensitive): `workers 1`, `docker-compose.yml`, `scheduler.py`. This enforces SGN-INF-03's explicit requirement that the comment block mirrors the other two invariant sites.

    5. **`test_signage_broadcast_uses_asyncio_queue`**: Assert `_device_queues` and `asyncio.Queue` and `QueueFull` all appear in the file (protects against a regression that rewrites the module on a different primitive).

    6. **`test_signage_broadcast_uses_percent_style_log_format`**: Assert no f-string is used in log format args. Heuristic: grep for the regex `log\.(warning|info|error|debug|exception)\(\s*f['\"]`. Must return no matches. Implement by reading the file and using Python's `re.search` against the source (not a subprocess grep).

    7. **`test_phase45_sse_endpoint_registered`**: Import `from app.routers.signage_player import router` and assert `/stream` appears in `{r.path for r in router.routes if hasattr(r, "path")}`. Guards against a future refactor that accidentally moves or deletes the SSE route.

    8. **`test_signage_modules_count_includes_broadcast`**: If the existing `signage_modules` scanner (from Phase 44 test `test_scanner_actually_finds_signage_files`) glob-walks `backend/app/services/signage_*.py`, confirm the resulting set now has `len(...) >= 4` (was `>= 3` at end of Phase 44) — adjust the threshold from 3 to 4 if needed. If the existing scanner uses `>=` semantics broad enough that the bump is automatic, add a new explicit assertion that `"signage_broadcast"` is in the discovered module-name set.

    Do NOT remove or weaken any existing assertions. Each new test is additive.
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_ci_guards.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - Each of the 8 new tests exists as a top-level function in `test_signage_ci_guards.py` (verify via `grep -c "^def test_signage_broadcast\|^def test_phase45_\|^def test_signage_modules_count_includes_broadcast" backend/tests/test_signage_ci_guards.py` >= 8)
    - `pytest backend/tests/test_signage_ci_guards.py -x -v` exits 0 with all guards passing (new + pre-existing Phase 43/44 guards)
    - Sanity negative check (run locally, do not leave broken): temporarily add `import subprocess` to `signage_broadcast.py` → `test_signage_broadcast_no_sync_subprocess` must fail. Revert afterwards. (Document this quick sanity run in the SUMMARY; do not commit the temp change.)
    - `test_signage_broadcast_contains_workers_1_invariant_block` assertion checks all 3 substrings (`workers 1`, `docker-compose.yml`, `scheduler.py`) simultaneously
  </acceptance_criteria>
  <done>Phase 45 CI grep guards lock hygiene invariants; removing the invariant comment block or adding a sync subprocess import to signage_broadcast.py fails CI.</done>
</task>

<task type="auto">
  <name>Task 2: 5-client SSE concurrency benchmark</name>
  <read_first>
    - backend/tests/test_signage_broadcast_integration.py (Plan 02 — reuse SSE connection fixtures / auth patterns)
    - backend/app/main.py (locate `/api/health` route shape; confirm it exists or use `/` or root healthcheck)
    - .planning/phases/45-sse-broadcast/45-CONTEXT.md §Specifics (5 clients + p95 <100ms is explicitly called out)
    - .planning/phases/45-sse-broadcast/45-RESEARCH.md §Open Questions Q3 (asyncio.gather approach)
  </read_first>
  <files>backend/tests/test_signage_sse_latency.py</files>
  <action>
    Create `backend/tests/test_signage_sse_latency.py` as a standalone pytest-asyncio test file. Target: prove that with 5 concurrent SSE clients connected, the application's health endpoint's p95 latency stays under 100ms.

    Shape:

    ```python
    import asyncio
    import statistics
    import time
    import pytest
    # Reuse AsyncClient fixture pattern from existing integration tests.

    @pytest.mark.asyncio
    async def test_health_p95_latency_under_100ms_with_5_sse_clients(
        async_client, db_session, admin_jwt,  # use whatever fixtures existing tests use
    ):
        """SGN-INF-03 / success-criterion #1: 5 SSE clients + /api/health p95 <100ms."""
        # 1. Seed 5 devices + 5 device tokens.
        device_tokens = [...]  # shape per existing test helpers

        # 2. Open 5 concurrent SSE connections to /api/signage/player/stream.
        #    Use a task per connection that opens the stream and awaits indefinitely.
        sse_tasks = []
        for token in device_tokens:
            task = asyncio.create_task(_hold_open_sse(token))
            sse_tasks.append(task)
        await asyncio.sleep(0.5)  # let streams establish

        # 3. Measure /api/health latency: send N=50 sequential GETs,
        #    record wall-clock per-request time, compute p95.
        latencies_ms: list[float] = []
        for _ in range(50):
            t0 = time.perf_counter()
            r = await async_client.get("/api/health")
            t1 = time.perf_counter()
            assert r.status_code == 200
            latencies_ms.append((t1 - t0) * 1000)

        # 4. Compute p95 (use statistics.quantiles(..., n=20)[18] or numpy-free equivalent).
        latencies_ms.sort()
        p95 = latencies_ms[int(len(latencies_ms) * 0.95) - 1]

        assert p95 < 100.0, (
            f"/api/health p95 under 5 SSE clients was {p95:.1f}ms (threshold 100ms); "
            f"min={latencies_ms[0]:.1f} median={latencies_ms[len(latencies_ms)//2]:.1f} "
            f"max={latencies_ms[-1]:.1f}"
        )

        # 5. Cleanup: cancel all SSE tasks, await their finally blocks, verify _device_queues emptied.
        for task in sse_tasks:
            task.cancel()
        await asyncio.gather(*sse_tasks, return_exceptions=True)
        await asyncio.sleep(0.2)
    ```

    The helper `_hold_open_sse(token)` opens an `httpx.AsyncClient.stream(...)` (or equivalent) and awaits `async for line in response.aiter_lines(): pass` — just keeps the connection warm.

    **If `/api/health` does not exist in `backend/app/main.py`:** use `/api/settings` or another existing cheap GET that is already covered by tests. Pick the cheapest existing route. Document the choice inline.

    Tag with `@pytest.mark.slow` (or the project's equivalent) if the project has a slow-test marker. If CI runs all tests unconditionally, leave it unmarked.

    **Expected outcome on dev hardware:** p95 should be well under 20ms because all 5 SSE connections are blocked on `await queue.get()` and do not compete for the event loop. If the test is flaky (occasionally crosses 100ms), the threshold is loose enough that the failure itself indicates a regression worth investigating — do NOT raise the threshold without a paper trail.
  </action>
  <verify>
    <automated>docker compose run --rm api pytest backend/tests/test_signage_sse_latency.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File `backend/tests/test_signage_sse_latency.py` exists
    - `grep -c "5" backend/tests/test_signage_sse_latency.py` >= 1 AND `grep -c "100" backend/tests/test_signage_sse_latency.py` >= 1 (5 clients, 100ms threshold visible in source)
    - `grep -c "p95\|percentile\|quantiles" backend/tests/test_signage_sse_latency.py` >= 1 (explicit p95 computation, not just a max check)
    - `grep -c "assert.*< 100" backend/tests/test_signage_sse_latency.py` >= 1 (threshold assertion with `<` literal 100)
    - `pytest backend/tests/test_signage_sse_latency.py -x -v` exits 0 (p95 well under 100ms expected on dev hardware)
    - Cleanup code cancels SSE tasks and waits for their finally blocks (task.cancel + gather with return_exceptions=True)
  </acceptance_criteria>
  <done>Concurrency benchmark passes with 5 SSE clients held open while /api/health p95 stays under 100ms; failure mode surfaces event-loop regression.</done>
</task>

</tasks>

<verification>
Full phase regression:
```bash
docker compose run --rm api pytest \
  backend/tests/test_signage_broadcast.py \
  backend/tests/test_signage_broadcast_integration.py \
  backend/tests/test_signage_ci_guards.py \
  backend/tests/test_signage_sse_latency.py \
  backend/tests/test_signage_router_deps.py \
  backend/tests/test_signage_admin_router.py \
  backend/tests/test_signage_player_router.py \
  backend/tests/test_signage_resolver.py \
  backend/tests/test_signage_pptx_pipeline_integration.py \
  -x -v
```
</verification>

<success_criteria>
- CI grep guards enforce: no sync subprocess / no sqlite3 / no psycopg2 / invariant comment present / _device_queues + asyncio.Queue + QueueFull symbols present in signage_broadcast.py
- /api/signage/player/stream is registered in the player router (route-presence guard)
- 5-client SSE concurrency benchmark passes with /api/health p95 <100ms
- All Phase 45 and upstream phase tests remain green
</success_criteria>

<output>
After completion, create `.planning/phases/45-sse-broadcast/45-03-ci-guards-and-latency-bench-SUMMARY.md` documenting:
- Each new CI guard and the regression it prevents
- The exact p95 observed on dev hardware at run time
- Which endpoint was used for latency measurement (if not /api/health) and why
</output>
