---
phase: 44-pptx-conversion-pipeline
plan: 04
subsystem: backend/scheduler
tags: [signage, scheduler, pptx, startup-hook, apscheduler]
requires:
  - SignageMedia model (backend/app/models/signage.py) with conversion_status, conversion_started_at, conversion_error columns
  - AsyncSessionLocal (backend/app/database.py)
  - Existing APScheduler lifespan() in backend/app/scheduler.py
provides:
  - backend/app/scheduler.py::_run_pptx_stuck_reset() — async coroutine invoked once from lifespan() before scheduler.start()
  - PPTX_STUCK_AGE_MINUTES constant (= 5)
affects:
  - backend/app/scheduler.py (new coroutine + lifespan hook + SignageMedia import + new constant)
tech-stack:
  added: []
  patterns: [one-shot-lifespan-hook, single-update-statement, fail-forward]
key-files:
  created:
    - backend/tests/test_signage_pptx_stuck_reset.py
  modified:
    - backend/app/scheduler.py
decisions:
  - D-09 (fail-forward only): flipped rows go directly to 'failed/abandoned_on_restart'; no retry counter, no re-queue, no pending state
  - D-18 (one-shot): coroutine is NOT registered with scheduler.add_job — it is awaited inline from lifespan() before scheduler.start()
  - NULL-safety (plan-driven): conversion_started_at IS NULL is naturally excluded by the strict-less-than comparison in SQL (None < cutoff => false); no explicit IS NOT NULL predicate needed
metrics:
  duration: "~1 min"
  completed: 2026-04-19
---

# Phase 44 Plan 04: Scheduler Stuck-Row Reset Summary

PPTX `processing` rows stuck past 5 minutes are flipped to `failed / abandoned_on_restart` exactly once at container startup via a new `_run_pptx_stuck_reset()` coroutine awaited inside `lifespan()` before `scheduler.start()`.

## What Shipped

### `_run_pptx_stuck_reset()` (`backend/app/scheduler.py`)

Async coroutine. Opens its own `AsyncSessionLocal()` and issues a single `UPDATE` statement — no Python-side loop, no row iteration, no intermediate SELECT. Swallows exceptions (logs via `log.exception`) and rolls back so a broken startup never blocks the rest of `lifespan()`.

**Exact predicate used:**

```python
update(SignageMedia)
.where(
    SignageMedia.conversion_status == "processing",
    SignageMedia.conversion_started_at < cutoff,
)
```

where `cutoff = datetime.now(timezone.utc) - timedelta(minutes=PPTX_STUCK_AGE_MINUTES)` and `PPTX_STUCK_AGE_MINUTES = 5`.

**Exact values written:**

```python
.values(
    conversion_status="failed",
    conversion_error="abandoned_on_restart",
)
```

Logging:

- `reset_count > 0` → `log.info("pptx_stuck_reset: flipped rows=%d cutoff=%s", ...)`
- `reset_count == 0` → `log.debug("pptx_stuck_reset: no stuck rows (cutoff=%s)", ...)`

### Lifespan hook location (`lifespan()` in `backend/app/scheduler.py`)

The `await _run_pptx_stuck_reset()` call sits as the **last step before `scheduler.start()`**, immediately after the `signage_heartbeat_sweeper` registration and before the scheduler's `.start()`:

```python
    log.info("registered signage_heartbeat_sweeper (1-min interval)")

    # --- PPTX stuck-row reset (one-shot at startup — v1.16 Phase 44) ---
    # SGN-SCH-03 / D-09 + D-18: flips 'processing' rows older than 5 min to
    # 'failed / abandoned_on_restart'. Runs BEFORE scheduler.start() so the
    # reset happens exactly once and does not race interval jobs. Not a
    # scheduled job — not registered with add_job.
    await _run_pptx_stuck_reset()
    log.info("pptx_stuck_reset hook executed")

    scheduler.start()
```

This placement guarantees:

1. The reset completes before any interval/cron job can fire.
2. The coroutine runs exactly once per container lifetime (not on an interval).
3. If the reset raises, the scheduler still starts — the reset is defensive cleanup, not a gating precondition.

### SignageMedia import

Extended the existing `from app.models import (...)` block (tuple import) to include `SignageMedia`. The previous import list was `AppSettings, SensorPollLog, SensorReading, SignagePairingSession`; `SignageMedia` slots in alphabetically between `SensorReading` and `SignagePairingSession`.

### Module constant

```python
# SGN-SCH-03 / D-09: PPTX rows older than this in 'processing' at startup are
# abandoned (flipped to 'failed / abandoned_on_restart'). Fail-forward only —
# admin must POST /reconvert explicitly to retry.
PPTX_STUCK_AGE_MINUTES = 5
```

Placed next to the existing `PAIRING_CLEANUP_GRACE_HOURS` constant.

## Tests (`backend/tests/test_signage_pptx_stuck_reset.py`)

8 tests; all pass. Seeds `signage_media` rows directly via asyncpg (matches the fixture style of `test_signage_heartbeat_sweeper.py`), then calls `_run_pptx_stuck_reset()` and asserts final state.

| Test                                             | Row seeded                                                                 | Expected outcome                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `test_reset_flips_stale_processing_row`          | kind=pptx, status='processing', conversion_started_at=now-10m              | status → 'failed', conversion_error → 'abandoned_on_restart'                                                |
| `test_reset_skips_young_processing_row`          | kind=pptx, status='processing', conversion_started_at=now-2m               | unchanged (status='processing', error=NULL)                                                                 |
| `test_reset_skips_pending_row_with_null_started_at` | kind=pptx, status='pending', conversion_started_at=NULL                  | unchanged (status='pending')                                                                                |
| `test_reset_skips_non_pptx_row`                  | kind=image, status=NULL                                                    | unchanged (status=NULL)                                                                                     |
| `test_reset_skips_done_row`                      | kind=pptx, status='done', slide_paths=['slide-1.png'], started_at=now-30m  | unchanged (status='done')                                                                                   |
| `test_reset_is_noop_on_clean_table`              | (none)                                                                     | no exception raised                                                                                         |
| `test_reset_is_idempotent`                       | kind=pptx, status='processing', started_at=now-10m                         | first call flips to 'failed/abandoned_on_restart'; second call leaves the row unchanged                     |
| `test_reset_is_not_registered_as_apscheduler_job` | (reads live scheduler)                                                     | no job id containing 'pptx_stuck_reset' in scheduler.get_jobs() (D-18 guard)                                |

Teardown fixture (`_purge`) wipes `signage_playlist_items` + `signage_media` before and after each test.

## Verification

All plan success criteria met:

- `grep -c "async def _run_pptx_stuck_reset" backend/app/scheduler.py` → 1
- `grep -c "await _run_pptx_stuck_reset()" backend/app/scheduler.py` → 1
- `grep -c 'conversion_error="abandoned_on_restart"' backend/app/scheduler.py` → 1
- `grep -c "PPTX_STUCK_AGE_MINUTES" backend/app/scheduler.py` → 2 (constant def + cutoff use)
- `grep -c "SignageMedia" backend/app/scheduler.py` → 4 (import + 3 usages)
- `grep -cE 'scheduler\.add_job\([^)]*_run_pptx_stuck_reset' backend/app/scheduler.py` → 0 (D-18)
- `pytest tests/test_signage_pptx_stuck_reset.py tests/test_sensor_scheduler.py tests/test_signage_heartbeat_sweeper.py tests/test_signage_pairing_cleanup.py -x -q` → **28 passed**

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `9f3d093` test(44-04): add failing tests for PPTX stuck-row reset (RED)
- `7acd5fd` feat(44-04): add PPTX stuck-row reset startup hook (GREEN)

## Self-Check: PASSED

- `backend/app/scheduler.py` modified — FOUND
- `backend/tests/test_signage_pptx_stuck_reset.py` created — FOUND
- Commit `9f3d093` in git log — FOUND
- Commit `7acd5fd` in git log — FOUND
