---
phase: 42-device-auth-pairing-flow
plan: 03
subsystem: backend-scheduler-api
tags: [signage, cron, apscheduler, revoke, sgn-sch-02, sc-5]
requires:
  - Plan 42-01 (get_current_device, mint_device_jwt, DEVICE_JWT_TTL_HOURS)
  - Plan 42-02 (signage_pair router, get_current_user + require_admin gate)
  - Phase 41 schema (SignagePairingSession, SignageDevice.revoked_at)
  - APScheduler 3.x (AsyncIOScheduler, CronTrigger)
provides:
  - app.scheduler.PAIRING_CLEANUP_JOB_ID = "signage_pairing_cleanup"
  - app.scheduler._run_signage_pairing_cleanup (deletes expires_at < now - 24h)
  - "POST /api/signage/pair/devices/{device_id}/revoke (admin-gated, 204, idempotent)"
affects:
  - backend/app/scheduler.py
  - backend/app/routers/signage_pair.py
tech_stack_added: []
patterns:
  - "Daily 03:00 UTC cron registered alongside v1.15 sensor_retention_cleanup (same slot)"
  - "asyncio.wait_for(30s) around DELETE ... WHERE expires_at < cutoff (mirrors PITFALLS C-4 pattern)"
  - "Idempotent revoke: no-op when already revoked (preserves audit timestamp)"
  - "Endpoint hosted on existing router to avoid pre-building Phase 43's CRUD surface"
key_files:
  created:
    - backend/tests/test_signage_pairing_cleanup.py
    - backend/tests/test_signage_device_revoke.py
    - .planning/phases/42-device-auth-pairing-flow/deferred-items.md
  modified:
    - backend/app/scheduler.py
    - backend/app/routers/signage_pair.py
decisions:
  - "D-13 realized: signage_pairing_cleanup cron is the carrier for SGN-DB-02's expiration invariant (partial-unique index predicate dropped the expires_at check because Postgres rejects now() in IMMUTABLE partial predicates, errcode 42P17) — documented inline in both scheduler.py and signage_pair.py"
  - "D-14 realized: revoke endpoint lives on /api/signage/pair/devices/{id}/revoke (not a new /api/signage/devices/* router). Rationale: Phase 42 success criteria need this operation to land, and opening a second router file here would preempt Phase 43's admin-CRUD consolidation"
  - "Idempotent revoke (204 no-op when already revoked, preserving original timestamp) — audit-friendly and matches user expectation that 'revoke' is terminal"
metrics:
  duration: 278s
  completed: 2026-04-18T16:13:42Z
  tasks: 2
  commits: 4
  tests_added: 12
---

# Phase 42 Plan 03: Pairing Cleanup Cron & Device Revoke Summary

Shipped the two remaining Phase 42 deliverables: the 03:00 UTC
`signage_pairing_cleanup` APScheduler cron (SGN-SCH-02) and the admin
`POST /api/signage/pair/devices/{id}/revoke` endpoint (D-14). ROADMAP Phase 42
success criteria #4 and #5 are both verified end-to-end — the latter via a
mock protected route that depends on `get_current_device` and is proven to
flip from 200 → 401 once an admin revokes the device.

## What Was Built

### 1. `signage_pairing_cleanup` cron (SGN-SCH-02)

- **`PAIRING_CLEANUP_JOB_ID = "signage_pairing_cleanup"`** — exported constant.
- **`PAIRING_CLEANUP_GRACE_HOURS = 24`** — 24-hour grace cutoff (roomy vs. the
  10-minute pairing TTL; no risk of racing an active kiosk poll).
- **`_run_signage_pairing_cleanup()`** — async coroutine; wraps a single
  `DELETE FROM signage_pairing_sessions WHERE expires_at < (now - 24h)` inside
  `asyncio.wait_for(..., timeout=30)`. Swallows exceptions with
  `log.exception` so a bad run never crashes the scheduler loop; rolls back
  on failure.
- **Lifespan registration** — `scheduler.add_job(..., CronTrigger(hour=3,
  minute=0, tz=UTC), max_instances=1, coalesce=True, misfire_grace_time=300)`.
  Slot-shared with the v1.15 `sensor_retention_cleanup` job in the same
  03:00 UTC low-traffic window (parallels the nightly `pg_dump` sidecar).
- **D-13 inline documentation** — the docstring calls out why this cron is
  a *correctness* requirement, not cosmetics: Phase 41 dropped
  `expires_at > now()` from the partial-unique index predicate
  (`uix_signage_pairing_sessions_code_active`) because Postgres rejects
  non-IMMUTABLE functions in partial-index predicates (errcode 42P17), so
  without this cron expired-but-unclaimed codes would accumulate in the
  unique index indefinitely and `/pair/request` would eventually trip its
  5-retry saturation path.

### 2. `POST /api/signage/pair/devices/{device_id}/revoke` (D-14 / SC #5)

Appended to the existing `signage_pair` router (no new router file —
intentional; see Decisions).

- `dependencies=[Depends(get_current_user), Depends(require_admin)]` —
  admin-gated per-endpoint.
- SELECT → exists? → UPDATE `revoked_at = now()` → commit. 204 No Content.
- **Idempotent:** if `revoked_at IS NOT NULL` already, the handler is a
  no-op. The original timestamp is preserved — "when was this revoked?"
  stays stable across repeat admin clicks.
- 404 when device id unknown.
- Never writes to `signage_devices.device_token_hash` (that column is
  reserved for the opaque-token variant we did not pick — documented
  inline).

## Acceptance Evidence

### SGN-SCH-02 cron

| Behavior                                                                           | Test                                             | Result |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ | ------ |
| `PAIRING_CLEANUP_JOB_ID == "signage_pairing_cleanup"`                              | `test_pairing_cleanup_job_id_constant`           | PASS   |
| Stale unclaimed row (`expires_at = now - 25h`) is deleted                          | `test_stale_unclaimed_row_is_deleted`            | PASS   |
| Fresh unclaimed row (`expires_at = now - 23h`) survives (inside 24h grace)         | `test_fresh_unclaimed_row_within_grace_survives` | PASS   |
| Active unclaimed row (`expires_at = now + 10m`) survives                           | `test_active_unclaimed_row_survives`             | PASS   |
| Stale claimed row also deleted (predicate is `expires_at` only, claim-state moot)  | `test_stale_claimed_row_is_also_deleted`         | PASS   |
| After lifespan startup, cron registered with `CronTrigger(hour=3, minute=0)` UTC   | `test_lifespan_registers_cron_at_0300_utc`       | PASS   |

### ROADMAP SC #5 (revoke)

| Behavior                                                                 | Test                                            | Result |
| ------------------------------------------------------------------------ | ----------------------------------------------- | ------ |
| No auth → 401                                                            | `test_revoke_no_auth_returns_401`               | PASS   |
| Viewer JWT → 403                                                         | `test_revoke_viewer_returns_403`                | PASS   |
| Admin + unknown device id → 404                                          | `test_revoke_unknown_device_returns_404`        | PASS   |
| Admin + valid id → 204 + `revoked_at IS NOT NULL`                        | `test_revoke_admin_valid_returns_204`           | PASS   |
| Already-revoked device → 204, original `revoked_at` preserved            | `test_revoke_already_revoked_is_idempotent`     | PASS   |
| **SC #5 E2E** — device JWT: 200 pre-revoke → 401 post-revoke, WWW-Auth   | `test_device_jwt_rejected_after_revoke`         | PASS   |

12/12 new tests pass; no regressions in existing signage tests
(`test_signage_pair_router.py`, `test_device_auth.py`, `test_rate_limit.py`,
`test_signage_pairing_service.py` — 38/38 still green, 44/44 total across
all signage-flow tests).

## Phase 42 — All 5 ROADMAP Success Criteria

| # | Criterion                                                     | Landed in     |
| - | ------------------------------------------------------------- | ------------- |
| 1 | Kiosk can request pairing code and poll status; claim exactly once | Plan 42-02    |
| 2 | Player 401 without device token                               | Plan 42-01 foundation (Phase 43 closes endpoint-level loop) |
| 3 | Admin gate + per-IP rate limit on /request                    | Plan 42-01 + 42-02 |
| 4 | Cron deletes sessions expired > 24h                           | **Plan 42-03** Task 1 |
| 5 | Revoked device → 401 on protected player endpoint             | **Plan 42-03** Task 2 (proven E2E) |

## Deviations from Plan

None. Plan executed exactly as written. Both tasks followed TDD
(RED → GREEN) with no refactor pass needed.

No authentication gates were required.

## Deferred Tech Debt / Open Items Carried Forward

- **Rate-limit `_buckets` dict unbounded growth (Plan 42-01 open followup).**
  Acceptable for the ~5-device fleet ceiling (D-09 scope). Could be swept by
  the new pairing-cleanup cron but isn't today — the cron's DELETE is
  strictly on pairing-session rows. Revisit if/when the device fleet grows.
- **Pre-existing unrelated test failures** — `tests/test_color_validator.py`
  (ImportError on `_validate_oklch`) and 28 failures in
  `tests/test_settings_api.py` (Directus auth fixture drift). Both verified
  pre-existing via `git stash` reproduction; logged to
  `.planning/phases/42-device-auth-pairing-flow/deferred-items.md`. Out of
  scope for Phase 42 per executor scope boundary.

## Cross-cutting hazard notes (for Phase 43)

- **Router-level admin-gate exception still holds** — revoke IS admin-gated
  per-endpoint (same as `/claim`). The INTENTIONAL EXCEPTION comment block
  at the top of `signage_pair.py` still applies; Phase 43's dep-audit test
  (SGN-BE-09) must permit all four endpoints on this router as exceptions,
  not just the three from Plan 42-02.
- **`/api/signage/pair/devices/{id}/revoke` path** — Phase 43 may consolidate
  this under `/api/signage/devices/{id}` as part of the admin CRUD router.
  If it does, add a redirect or keep the pair-router path as a deprecated
  alias for at least one release to avoid breaking any admin UI Phase 46
  might already be calling.
- **Delete-on-deliver vs. cron interaction** — claimed+undelivered rows
  (kiosk polled /claim then never came back for /status) will now be swept
  by this cron after 24h. Matches Plan 42-02's recommendation to sweep
  regardless of `claimed_at` state.

## Commits

- `10456dc` — test(42-03): add failing tests for signage_pairing_cleanup cron
- `a8baada` — feat(42-03): add signage_pairing_cleanup 03:00 UTC cron (SGN-SCH-02)
- `831872b` — test(42-03): add failing tests for admin device revoke endpoint
- `c684825` — feat(42-03): add admin revoke-device endpoint (D-14, ROADMAP SC #5)

## Self-Check: PASSED

- backend/app/scheduler.py (modified, PAIRING_CLEANUP_JOB_ID + coroutine + cron registration) — FOUND
- backend/app/routers/signage_pair.py (modified, revoke endpoint appended) — FOUND
- backend/tests/test_signage_pairing_cleanup.py — FOUND (6 tests, all pass)
- backend/tests/test_signage_device_revoke.py — FOUND (6 tests, all pass)
- .planning/phases/42-device-auth-pairing-flow/deferred-items.md — FOUND
- Commit 10456dc — FOUND
- Commit a8baada — FOUND
- Commit 831872b — FOUND
- Commit c684825 — FOUND
- Acceptance grep: `PAIRING_CLEANUP_JOB_ID = "signage_pairing_cleanup"` in scheduler.py — FOUND
- Acceptance grep: `async def _run_signage_pairing_cleanup` in scheduler.py — FOUND
- Acceptance grep: `CronTrigger(hour=3, minute=0` in scheduler.py — FOUND
- Acceptance grep: `SGN-DB-02` in scheduler.py — FOUND
- Acceptance grep: `asyncio.wait_for` in scheduler.py — FOUND (retention + pairing jobs both use it)
- Acceptance grep: `timedelta(hours=24)` predicate in scheduler.py — FOUND (via PAIRING_CLEANUP_GRACE_HOURS)
- Acceptance grep: `max_instances=1` / `coalesce=True` / `misfire_grace_time=300` — FOUND
- Acceptance grep: `/devices/{device_id}/revoke` in signage_pair.py — FOUND
- Acceptance grep: `async def revoke_device` in signage_pair.py — FOUND
- Acceptance grep: `values(revoked_at=func.now())` in signage_pair.py — FOUND
- Acceptance grep: `require_admin` in signage_pair.py — FOUND (three endpoints now)
- Acceptance grep: `get_current_device` in test_signage_device_revoke.py — FOUND
- Acceptance grep: `mint_device_jwt` in test_signage_device_revoke.py — FOUND
- Acceptance grep: no `device_token_hash` writes in signage_pair.py — CONFIRMED NONE
- `ls backend/app/routers/` shows no new signage-pair-adjacent files — CONFIRMED (only signage_pair.py)
- All 12 new tests PASS; all 38 existing signage tests PASS (44/44 total signage)
