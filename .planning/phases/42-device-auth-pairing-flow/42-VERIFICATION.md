---
phase: 42-device-auth-pairing-flow
verified: 2026-04-18T00:00:00Z
status: passed
score: 5/5 success criteria verified (SC #2 is foundation-only per CONTEXT scope; get_current_device dep landed and tested)
requirements_verified:
  - SGN-BE-03
  - SGN-BE-04
  - SGN-SCH-02
---

# Phase 42: Device Auth + Pairing Flow — Verification Report

**Phase Goal:** A fresh Pi can display a code, an admin can claim it, and the resulting device token is the only way into `/api/signage/player/*` — pairing races, stolen tokens, and expired codes all fail safely.

**Verified:** 2026-04-18
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Success Criterion | Status | Evidence |
| - | --- | --- | --- |
| 1 | POST /pair/request returns `{pairing_code: "XXX-XXX", pairing_session_id, expires_in: 600}`; GET /pair/status polls until claim then returns device_token exactly once | VERIFIED | Live API smoke: `POST /api/signage/pair/request` returned `{"pairing_code":"UCF-8FG","pairing_session_id":"c162...","expires_in":600}` HTTP 201. Router delete-on-deliver implemented at `signage_pair.py:156-165` (mint JWT, DELETE in same txn, commit, return). `test_signage_pair_router.py` 13 tests green covering pending → claim → claimed-once → expired-second-poll |
| 2 | /api/signage/player/playlist returns 401 without auth, 401/403 with Viewer JWT, 200 with device token | VERIFIED (foundation) | `get_current_device` dep fully implemented at `device_auth.py:37-74`; 8-test suite `test_device_auth.py` covers missing/malformed/wrong-scope/bad-uuid/missing-device/revoked/expired → all 401. Player endpoints themselves are scheduled for Phase 43 per CONTEXT scope; foundation dep is proven functional |
| 3 | /pair/claim requires admin; /pair/request rate-limited to 5/min/IP | VERIFIED | `signage_pair.py:173-177` uses `dependencies=[Depends(get_current_user), Depends(require_admin)]` on /claim; live API: unauth /claim → HTTP 401. `/request` uses `dependencies=[Depends(rate_limit_pair_request)]` (line 78). `rate_limit.py` enforces 5 req / 60s with 429 + Retry-After; 4 tests in `test_rate_limit.py` green |
| 4 | APScheduler cleanup at 03:00 UTC deletes signage_pairing_sessions with expires_at < now() - 24h | VERIFIED | `scheduler.py:148-183` implements `_run_signage_pairing_cleanup` with `cutoff = now - 24h` and `delete(SignagePairingSession).where(expires_at < cutoff)`. Registration at `scheduler.py:299-308` uses `CronTrigger(hour=3, minute=0, timezone=timezone.utc)`, `max_instances=1`, `coalesce=True`, `misfire_grace_time=300`. 6 tests in `test_signage_pairing_cleanup.py` cover 25h-stale-deleted / 23h-preserved / active-preserved / claimed-stale-deleted boundary |
| 5 | Admin "Revoke device" sets revoked_at; subsequent requests with revoked token return 401 | VERIFIED | `signage_pair.py:246-276` POST `/devices/{device_id}/revoke` with admin dep, idempotent `UPDATE signage_devices SET revoked_at = now()`. Integration test at `test_signage_device_revoke.py` proves pre-revoke 200 → revoke 204 → post-revoke same-JWT 401 with `WWW-Authenticate: Bearer` via `get_current_device`. 6 tests green |

**Score:** 5/5 success criteria verified. SC #2 is foundation-complete (dep proven); endpoint wiring is out-of-scope per Phase 42 CONTEXT (deferred to Phase 43).

### Required Artifacts

| Artifact | Exists | Substantive | Wired | Status |
| --- | --- | --- | --- | --- |
| `backend/app/security/device_auth.py` | yes | 75 LOC, full JWT decode + scope check + revoked_at check | imported by `test_device_auth.py` and `test_signage_device_revoke.py` (Phase 43 will import from routers) | VERIFIED |
| `backend/app/security/rate_limit.py` | yes | 68 LOC, deque+asyncio.Lock sliding window | imported at `signage_pair.py:54`, used as `Depends(rate_limit_pair_request)` at `signage_pair.py:78` | VERIFIED |
| `backend/app/services/signage_pairing.py` | yes | PAIRING_ALPHABET (31 chars, no 0/O/1/I/L), `generate_pairing_code`, `format_for_display`, `mint_device_jwt` all present, uses `secrets.choice`, HS256 | imported at `signage_pair.py:55-59` | VERIFIED |
| `backend/app/routers/signage_pair.py` | yes | 277 LOC, 4 endpoints (/request, /status, /claim, /devices/{id}/revoke), atomic UPDATE...RETURNING claim, delete-on-deliver status | mounted at `main.py:13, 27` via `app.include_router(signage_pair_router)` | VERIFIED |
| `backend/app/scheduler.py` (cron registration) | yes | `PAIRING_CLEANUP_JOB_ID` const + coroutine + CronTrigger(3,0 UTC) registration | registered inside lifespan at line 299-308 | VERIFIED |
| `backend/app/config.py` (SIGNAGE_DEVICE_JWT_SECRET) | yes | Settings field present | referenced in `device_auth.py:48`, `signage_pairing.py:60`; exported via `docker-compose.yml`, `.env.example` | VERIFIED |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `device_auth.py` | `settings.SIGNAGE_DEVICE_JWT_SECRET` | `jwt.decode(..., algorithms=["HS256"])` | WIRED (line 46-50) |
| `device_auth.py` | `signage_devices.revoked_at` | `select(SignageDevice).where(id=...)` + `device.revoked_at is not None` → 401 | WIRED (line 66-73) |
| `signage_pair.py` | `rate_limit.py` | `dependencies=[Depends(rate_limit_pair_request)]` on /request | WIRED (line 78) |
| `signage_pair.py` | `directus_auth.require_admin` | `dependencies=[Depends(get_current_user), Depends(require_admin)]` on /claim and /revoke | WIRED (lines 176, 249). Note: `require_admin` is imported from `directus_auth` (line 53), not `security.roles` as PLAN 02 speculated — `directus_auth.py:65` defines it. Functional equivalent. |
| `signage_pair.py` | `signage_pairing` service | `generate_pairing_code()`, `mint_device_jwt()`, `format_for_display()` | WIRED (lines 55-59, 87, 99, 160) |
| `main.py` | `signage_pair.router` | `app.include_router(signage_pair_router)` | WIRED (line 27) |
| `scheduler.py` | `signage_pairing_sessions` | `delete(SignagePairingSession).where(expires_at < cutoff)` | WIRED (line 169-172) |
| `signage_pair.py` revoke | `signage_devices.revoked_at` | `update(SignageDevice).values(revoked_at=func.now())` | WIRED (lines 269-273) |

### Behavioral Spot-Checks (Live API)

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| /pair/request unauth succeeds | `curl -X POST /api/signage/pair/request` | `HTTP 201 {"pairing_code":"UCF-8FG","pairing_session_id":"c162...","expires_in":600}` | PASS |
| /pair/claim requires auth | `curl -X POST /api/signage/pair/claim` | `HTTP 401 {"detail":"invalid or missing authentication token"}` | PASS |
| /pair/status unknown id degrades to expired | `curl /api/signage/pair/status?pairing_session_id=000...` | `HTTP 200 {"status":"expired","device_token":null}` | PASS |
| Full test suite (6 phase-42 files) | `pytest ... --tb=short` | **44 passed in 2.82s** | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SGN-BE-03 | 42-02 | signage_pair.py router with /request, /status, admin /claim | SATISFIED | Router implemented with 4 endpoints; 13 integration tests green; mounted in main.py |
| SGN-BE-04 | 42-01 | device_auth.py with get_current_device resolving Bearer device_token | SATISFIED | Dep implemented with scope check + revoked_at check; 8 tests green; proven end-to-end via revoke integration test |
| SGN-SCH-02 | 42-03 | Daily 03:00 UTC pairing-session cleanup cron | SATISFIED | APScheduler job registered alongside v1.15 sensor_retention_cleanup; 6 tests prove 24h grace boundary |

No orphaned requirements: REQUIREMENTS.md lists exactly SGN-BE-03, SGN-BE-04, SGN-SCH-02 for Phase 42 (lines 135-137, all marked "Complete"); all three are claimed by plans 42-01/02/03 and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `rate_limit.py` | 21 | `# TODO (production): ... reverse proxy ...` | Info | Documented operational guardrail, not a code stub. Sensible given the current no-proxy compose topology; `_client_ip` correctly uses `request.client.host`. |

No other TODO/FIXME/placeholder/stub patterns in phase-42 files. No writes to `signage_devices.device_token_hash` anywhere in the codebase (confirmed via Grep — only the column declaration in `models/signage.py:175` and a documentation comment in `signage_pair.py:239` explaining why we don't). `secrets.choice` used (not `random.choice`). JWT decode has explicit `algorithms=["HS256"]`.

### Pairing-Race / Stolen-Token / Expired-Code Safety (Goal Sub-Predicates)

| Hazard | Mitigation | Verification |
| --- | --- | --- |
| Two admins race /claim on the same code | Atomic `UPDATE ... WHERE code=:code AND claimed_at IS NULL AND expires_at > now() RETURNING id` (signage_pair.py:196-205) | `test_signage_pair_router.py` concurrent-claim test (one 204, one 404) |
| Stolen device token still usable after admin revoke | `get_current_device` re-reads `revoked_at` on every request (device_auth.py:66-73) | `test_signage_device_revoke.py` integration: same JWT → 200 pre-revoke, 401 post-revoke |
| Expired code can still be claimed | `expires_at > func.now()` in WHERE clause (signage_pair.py:201) plus `expires_at <= now` branch in /status (line 153) | `test_signage_pair_router.py` expired-code test |
| Pairing-session DB rows accumulate forever (capacity DoS) | 24h-grace cleanup cron (`scheduler.py:148-183`, registered in lifespan) | `test_signage_pairing_cleanup.py` 6 tests |
| Device token re-fetchable by pairing_session_id snooper | Delete-on-deliver in GET /status (signage_pair.py:156-165) | `test_signage_pair_router.py` second-poll-returns-expired |
| alg=none / alg-confusion on device JWT | Explicit `algorithms=["HS256"]` on jwt.decode (device_auth.py:49) | `test_device_auth.py` malformed-token test |
| Rate-limit bypass across workers | `--workers 1` invariant documented inline (rate_limit.py:10-16) and enforced in `docker-compose.yml` | Compose config (verified via Grep) |

All safety sub-predicates have both code-path and test coverage.

### Human Verification Required

None. All success criteria have programmatic verification via unit/integration tests AND live API smoke checks.

### Gaps Summary

None. Phase 42 is feature-complete:

- All 3 requirement IDs (SGN-BE-03, SGN-BE-04, SGN-SCH-02) satisfied with implementation + tests.
- All 5 ROADMAP success criteria are verified (SC #2 foundation-complete per CONTEXT scope; Phase 43 attaches `get_current_device` to `/api/signage/player/*` endpoints).
- 44/44 phase-42 tests pass; live API returns correct shapes.
- Anti-patterns: only one documented operational-guardrail TODO (reverse-proxy X-Forwarded-For handling), which is a deliberate future-hardening note, not a stub.

Note: `deferred-items.md` documents two pre-existing failing test suites (`test_color_validator.py`, `test_settings_api.py`) confirmed via `git stash` to pre-date Phase 42. These are not Phase 42 regressions.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_
