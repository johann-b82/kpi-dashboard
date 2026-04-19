---
phase: 44-pptx-conversion-pipeline
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/scheduler.py
autonomous: true
requirements:
  - SGN-SCH-03

must_haves:
  truths:
    - "On scheduler startup, any SignageMedia row with conversion_status='processing' AND conversion_started_at < now()-5min is flipped to conversion_status='failed' with conversion_error='abandoned_on_restart'"
    - "The reset runs ONCE at startup (not on an interval)"
    - "The reset runs BEFORE scheduler.start() so the normal cron/interval jobs are not racing it"
    - "Running the reset on a clean DB (zero stuck rows) is a no-op and logs at DEBUG"
    - "Non-zero resets log at INFO with the affected row count"
    - "Reset is a single SQL UPDATE inside AsyncSessionLocal — no Python-side loop"
  artifacts:
    - path: "backend/app/scheduler.py"
      provides: "_run_pptx_stuck_reset() called once from inside lifespan() before scheduler.start()"
      contains: "_run_pptx_stuck_reset"
  key_links:
    - from: "lifespan() in scheduler.py"
      to: "_run_pptx_stuck_reset()"
      via: "await call before scheduler.start()"
      pattern: "await _run_pptx_stuck_reset\\("
    - from: "_run_pptx_stuck_reset"
      to: "SignageMedia (UPDATE)"
      via: "update(SignageMedia).where(processing AND conversion_started_at < cutoff)"
      pattern: "update\\(SignageMedia\\)"
---

<objective>
Add a one-shot startup hook to `backend/app/scheduler.py` that resets any PPTX conversion rows stuck in `processing` for more than 5 minutes into a terminal `failed / abandoned_on_restart` state. This is the only clean-up mechanism for rows that were mid-conversion when the api container was killed (crash, deploy, OOM).

Purpose: implements SGN-SCH-03 per CONTEXT D-09, D-18. Fail-forward only — no retry counter, no re-queue. Admin must invoke `/reconvert` (plan 44-03) explicitly to try again.

Output: extended `backend/app/scheduler.py` with a new `_run_pptx_stuck_reset()` coroutine wired into the existing `lifespan()` function just before `scheduler.start()`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md
@backend/app/scheduler.py
@backend/app/models/signage.py
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add _run_pptx_stuck_reset() and wire into lifespan() before scheduler.start()</name>
  <read_first>
    - backend/app/scheduler.py (full file — the hook mirrors the shape of `_run_signage_pairing_cleanup` and `_run_signage_heartbeat_sweeper`)
    - backend/app/models/signage.py (SignageMedia columns: conversion_status, conversion_started_at, conversion_error)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-09, D-18
  </read_first>
  <files>backend/app/scheduler.py, backend/tests/test_signage_pptx_stuck_reset.py</files>
  <behavior>
    - A row with conversion_status='processing' and conversion_started_at = now() - 10 minutes is flipped to conversion_status='failed', conversion_error='abandoned_on_restart'.
    - A row with conversion_status='processing' and conversion_started_at = now() - 2 minutes is NOT flipped.
    - A row with conversion_status='pending' is NOT flipped regardless of conversion_started_at.
    - A row with conversion_status='done' is NOT flipped.
    - A non-PPTX row (conversion_status IS NULL, kind='image') is NOT flipped.
    - Calling `_run_pptx_stuck_reset` on a table with zero candidates is a no-op and does not raise.
    - The function is `async def` and uses `AsyncSessionLocal`.
  </behavior>
  <action>
Edit `backend/app/scheduler.py` in two places.

1. Add imports at the top (extend the existing `from app.models import ...` line — SignageMedia is probably NOT yet imported here):

```python
from app.models import (
    AppSettings,
    SensorPollLog,
    SensorReading,
    SignageMedia,
    SignagePairingSession,
)
```

Also extend the `PPTX_STUCK_AGE_MINUTES` module constant near the other `*_GRACE_*` constants:

```python
# SGN-SCH-03 / D-09: rows older than this in 'processing' at startup are abandoned.
PPTX_STUCK_AGE_MINUTES = 5
```

2. Add the new coroutine alongside `_run_signage_heartbeat_sweeper` (before the `reschedule_sensor_poll` helper, before `lifespan`):

```python
async def _run_pptx_stuck_reset() -> None:
    """SGN-SCH-03 / D-09 + D-18: one-shot startup reset of stuck PPTX rows.

    Flips any signage_media row that was 'processing' more than 5 minutes
    ago (by conversion_started_at) into a terminal 'failed' state with
    conversion_error='abandoned_on_restart'. Fail-forward — admin must
    call POST /api/signage/media/{id}/reconvert explicitly to retry.

    Runs ONCE at scheduler init, before the cron/interval jobs are
    registered. Idempotent — a clean DB is a no-op (DEBUG log). Non-zero
    resets are logged at INFO.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=PPTX_STUCK_AGE_MINUTES)
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                update(SignageMedia)
                .where(
                    SignageMedia.conversion_status == "processing",
                    SignageMedia.conversion_started_at < cutoff,
                )
                .values(
                    conversion_status="failed",
                    conversion_error="abandoned_on_restart",
                )
            )
            await session.commit()
            reset_count = result.rowcount or 0
            if reset_count > 0:
                log.info(
                    "pptx_stuck_reset: flipped rows=%d cutoff=%s",
                    reset_count,
                    cutoff.isoformat(),
                )
            else:
                log.debug(
                    "pptx_stuck_reset: no stuck rows (cutoff=%s)",
                    cutoff.isoformat(),
                )
        except Exception:
            log.exception("pptx_stuck_reset failed")
            await session.rollback()
```

3. Wire into `lifespan()` — just before `scheduler.start()`:

```python
    # --- PPTX stuck-row reset (one-shot at startup — v1.16 Phase 44) ---
    # SGN-SCH-03 / D-09 + D-18: flips 'processing' rows older than 5 min to
    # 'failed / abandoned_on_restart'. Runs BEFORE scheduler.start() so the
    # reset happens exactly once and does not race interval jobs. Not a
    # scheduled job — not registered with add_job.
    await _run_pptx_stuck_reset()
    log.info("pptx_stuck_reset hook executed")

    scheduler.start()
```

Write tests in `backend/tests/test_signage_pptx_stuck_reset.py` (mirror the fixture pattern used by `backend/tests/test_signage_heartbeat_sweeper.py`):
- Seed three rows:
  1. PPTX, conversion_status='processing', conversion_started_at = now - 10min  → should be flipped.
  2. PPTX, conversion_status='processing', conversion_started_at = now - 2min   → should NOT be flipped.
  3. PPTX, conversion_status='pending', conversion_started_at = NULL            → should NOT be flipped.
  4. image, conversion_status=NULL                                              → should NOT be flipped.
  5. PPTX, conversion_status='done', slide_paths=['x']                          → should NOT be flipped.
- Call `await _run_pptx_stuck_reset()`.
- Assert row #1 has `conversion_status='failed'`, `conversion_error='abandoned_on_restart'`.
- Assert rows #2, #3, #4, #5 are unchanged.
- Second call: assert idempotent (row #1 stays 'failed/abandoned_on_restart'; no new flips).

Do NOT:
- Add `_run_pptx_stuck_reset` to `scheduler.add_job(...)` — it is explicitly one-shot per D-18.
- Loop over rows in Python — it MUST be a single UPDATE statement.
- Use `conversion_started_at.is_(None)` predicate — a processing row without a started_at is a data bug; this reset targets only rows WITH a timestamp older than the cutoff (D-09 wording). `None < cutoff` is false in SQL, so they're naturally excluded by the `<` comparison.
- Re-queue to `pending` — D-09 locks fail-forward only.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/test_signage_pptx_stuck_reset.py -x -q</automated>
  </verify>
  <done>
    - `grep -c "async def _run_pptx_stuck_reset" backend/app/scheduler.py` returns 1.
    - `grep -c "await _run_pptx_stuck_reset()" backend/app/scheduler.py` returns 1.
    - `grep -c 'conversion_error="abandoned_on_restart"' backend/app/scheduler.py` returns 1.
    - `cd backend && python -m pytest tests/test_signage_pptx_stuck_reset.py -x -q` exits 0.
    - Existing scheduler tests still pass: `cd backend && python -m pytest tests/test_sensor_scheduler.py tests/test_signage_heartbeat_sweeper.py tests/test_signage_pairing_cleanup.py -x -q` exits 0.
  </done>
  <acceptance_criteria>
    - `grep -c "async def _run_pptx_stuck_reset" backend/app/scheduler.py` returns 1.
    - `grep -c "PPTX_STUCK_AGE_MINUTES" backend/app/scheduler.py` returns ≥2  (constant def + use in cutoff).
    - `grep -c 'SignageMedia.conversion_status == "processing"' backend/app/scheduler.py` returns 1.
    - `grep -c 'SignageMedia.conversion_started_at < cutoff' backend/app/scheduler.py` returns 1.
    - `grep -c 'conversion_status="failed"' backend/app/scheduler.py` returns ≥1.
    - `grep -c 'conversion_error="abandoned_on_restart"' backend/app/scheduler.py` returns 1.
    - `grep -c "await _run_pptx_stuck_reset()" backend/app/scheduler.py` returns 1.
    - `grep -c "SignageMedia" backend/app/scheduler.py` returns ≥2 (import + use).
    - File backend/tests/test_signage_pptx_stuck_reset.py exists.
    - `cd backend && python -m pytest tests/test_signage_pptx_stuck_reset.py -x -q` exits 0.
    - `cd backend && python -m pytest tests/test_signage_heartbeat_sweeper.py tests/test_signage_pairing_cleanup.py -x -q` exits 0.
    - `grep -cE 'scheduler\.add_job\([^)]*_run_pptx_stuck_reset' backend/app/scheduler.py` returns 0  (not scheduled; one-shot only per D-18).
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd backend && python -m pytest tests/test_signage_pptx_stuck_reset.py tests/test_sensor_scheduler.py tests/test_signage_heartbeat_sweeper.py tests/test_signage_pairing_cleanup.py -x -q` exits 0.
- `grep -c "add_job.*_run_pptx_stuck_reset" backend/app/scheduler.py` returns 0 (not scheduled — one-shot only).
</verification>

<success_criteria>
- `_run_pptx_stuck_reset()` exists and is invoked exactly once per container startup from inside `lifespan()`.
- Stuck rows are flipped via a single UPDATE statement with the D-14 error code `abandoned_on_restart`.
- Non-stuck rows, non-PPTX rows, and zero-row states are all correctly untouched.
- No regression in existing scheduler jobs.
</success_criteria>

<output>
After completion, create `.planning/phases/44-pptx-conversion-pipeline/44-04-SUMMARY.md` capturing: exact predicate used, exact values written, where the hook is called inside lifespan, and how tests were seeded.
</output>
