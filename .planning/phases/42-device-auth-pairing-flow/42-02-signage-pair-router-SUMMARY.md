---
phase: 42-device-auth-pairing-flow
plan: 02
subsystem: backend-api
tags: [signage, pairing, router, sgn-be-03]
requires:
  - Phase 41 ORM (SignagePairingSession, SignageDevice, SignageDeviceTagMap)
  - Phase 41 schemas (SignagePairing{Request,Status,Claim}*)
  - Plan 42-01 (rate_limit_pair_request, generate_pairing_code, mint_device_jwt, format_for_display)
  - FastAPI, SQLAlchemy 2.0 async, PyJWT 2.10.x
provides:
  - app.routers.signage_pair (APIRouter, prefix=/api/signage/pair)
  - "POST /api/signage/pair/request (201, rate-limited, public)"
  - "GET  /api/signage/pair/status (200, delete-on-deliver JWT)"
  - "POST /api/signage/pair/claim  (204, admin-gated, atomic UPDATE...RETURNING)"
affects:
  - backend/app/main.py
tech_stack_added: []
patterns:
  - Atomic claim via single UPDATE...WHERE claimed_at IS NULL AND expires_at > now() RETURNING id (PITFALLS §13)
  - Delete-on-deliver exactly-once JWT handoff inside status endpoint (D-08, RESEARCH Pitfall 2)
  - Per-endpoint admin gate (INTENTIONAL EXCEPTION to cross-cutting hazard #5)
  - Unknown pairing_session_id degrades to 200 {status:"expired"} — avoids timing oracle (RESEARCH Q1)
  - Dash-tolerant claim input ("ABC-DEF" and "ABCDEF" both accepted; stripped before SQL)
  - Code-gen retry loop + partial-unique index as defense in depth
key_files:
  created:
    - backend/app/routers/signage_pair.py
    - backend/tests/test_signage_pair_router.py
  modified:
    - backend/app/main.py
decisions:
  - "Open Question Q1 realized: unknown/expired/consumed pairing_session_id returns 200 {status:\"expired\"} (NOT 404) — wire shape agreed for Plan 03 and for Phase 43"
  - "D-08 realized: delete-on-deliver executed inside the same transaction as JWT mint; row is gone by the time the response is committed"
  - "Router-level admin-gate hazard: INTENTIONAL exception documented inline; Phase 43 dep-audit (SGN-BE-09) MUST permit this"
  - "SGN-DB-02 amendment respected: expires_at predicate lives in the UPDATE WHERE clause, not in the partial-unique index"
  - "Mount style: main.py direct `from app.routers.<mod> import router as <name>_router`; routers/__init__.py kept empty (matches existing convention for every other router in this repo)"
metrics:
  duration: ~3 min
  completed: 2026-04-18T16:06:50Z
  tasks: 1
  commits: 2
  tests_added: 13
---

# Phase 42 Plan 02: /api/signage/pair Router Summary

Shipped the three pairing endpoints (`POST /request`, `GET /status`,
`POST /claim`) and mounted the router in `main.py`. SGN-BE-03 is now
test-covered end-to-end against a live Postgres container, including the
race-free atomic-claim path and the exactly-once delete-on-deliver JWT
handoff.

## What Was Built

- **`backend/app/routers/signage_pair.py`** — single-file APIRouter with
  all three endpoints. No state. No background tasks. Composes Plan 01's
  foundations verbatim (`rate_limit_pair_request`, `generate_pairing_code`,
  `format_for_display`, `mint_device_jwt`) plus the existing Directus
  admin gate (`get_current_user`, `require_admin`).

- **`POST /request`** (public, `dependencies=[Depends(rate_limit_pair_request)]`):
  - `status_code=201`, `response_model=SignagePairingRequestResponse`
  - Retry loop up to `CODE_GEN_RETRIES=5`; on `IntegrityError` from the
    partial-unique index `uix_signage_pairing_sessions_code_active`, rollback
    and retry with a fresh code. Five losses in a row → 503 + Retry-After: 60
    (RESEARCH Pitfall 6 — shed load, don't loop forever).
  - Returns `{pairing_code: "XXX-XXX", pairing_session_id: <uuid4>, expires_in: 600}`.

- **`GET /status`** (public, query param `pairing_session_id`):
  - Unparseable UUID → 200 `{status: "expired"}` (intentional — no 422 leak
    that tells an attacker "this looks like a real session id we've seen").
  - Unknown id → 200 `{status: "expired"}`.
  - Pending in-window → 200 `{status: "pending"}`.
  - Pending TTL-elapsed → 200 `{status: "expired"}` (cron will sweep in Plan 03).
  - Claimed → mint JWT via `mint_device_jwt(device_id)`, `DELETE FROM
    signage_pairing_sessions WHERE id = :id` in the same transaction,
    commit, return `{status: "claimed", device_token: <jwt>}`. Second
    poll sees the row gone and returns `{status: "expired"}` — exactly-once
    delivery.

- **`POST /claim`** (per-endpoint admin gate,
  `dependencies=[Depends(get_current_user), Depends(require_admin)]`):
  - Dash-tolerant: `payload.code.replace("-", "").upper()` before SQL.
  - Inserts `SignageDevice(name=payload.device_name, status="pending")` and
    flushes to populate `device.id` without committing.
  - Atomic claim:
    `UPDATE signage_pairing_sessions SET claimed_at=now(), device_id=:device_id WHERE code=:code AND claimed_at IS NULL AND expires_at > now() RETURNING id`.
  - No match → `await db.rollback()` (discards the half-created device row)
    + 404 `"pairing code invalid, expired, or already claimed"`.
  - Optional `tag_ids` bulk-inserted into `signage_device_tag_map`.
  - Returns `204` (no body).

- **`backend/app/main.py`** — added
  `from app.routers.signage_pair import router as signage_pair_router`
  and `app.include_router(signage_pair_router)` next to the other router
  includes.

## SGN-BE-03 Acceptance Evidence

| Behavior (from PLAN must_haves.truths)                                   | Test                                                | Result |
| ------------------------------------------------------------------------ | --------------------------------------------------- | ------ |
| POST /request no-auth → 201, valid code shape, expires_in=600            | `test_request_returns_201_with_pairing_code`        | PASS   |
| POST /request creates a pending DB row with ~600s TTL                    | `test_request_returns_201_with_pairing_code`        | PASS   |
| 6th POST /request in 60s → 429 + Retry-After                             | `test_request_rate_limit_429_on_sixth`              | PASS   |
| GET /status pending → 200 `{status: "pending"}`                          | `test_status_pending_returns_pending`               | PASS   |
| GET /status unknown UUID → 200 `{status: "expired"}` (NOT 404)           | `test_status_unknown_id_returns_expired`            | PASS   |
| GET /status TTL-elapsed pending → 200 `{status: "expired"}`              | `test_status_expired_ttl_returns_expired`           | PASS   |
| First /status after claim → 200 `{status:"claimed", device_token:<jwt>}` | `test_status_after_claim_delivers_jwt_once`         | PASS   |
| Second /status after claim → 200 `{status:"expired"}` (delete-on-deliver) | `test_status_after_claim_delivers_jwt_once`         | PASS   |
| POST /claim no auth → 401                                                | `test_claim_no_auth_returns_401`                    | PASS   |
| POST /claim viewer JWT → 403                                             | `test_claim_viewer_returns_403`                     | PASS   |
| POST /claim admin + valid pending → 204, device row + bound session      | `test_claim_admin_valid_pending_returns_204`        | PASS   |
| POST /claim already-claimed code → 404                                   | `test_claim_already_claimed_returns_404`            | PASS   |
| POST /claim expired code → 404, no device row leaked                     | `test_claim_expired_returns_404`                    | PASS   |
| POST /claim accepts dashed and undashed codes                            | `test_claim_accepts_dashed_and_undashed`            | PASS   |
| Concurrent /claim → exactly one 204, one 404; only one device row        | `test_claim_concurrent_exactly_one_wins`            | PASS   |

13 test functions, 15 behavior cases covered (first test verifies both
the HTTP contract and the DB side-effect in one body). Live-Postgres
fixture via `docker compose exec api pytest` — all green.

**Manual smoke test (captured):**

```
$ curl -sS -X POST http://localhost:8000/api/signage/pair/request -w "\nHTTP %{http_code}\n"
{"pairing_code":"ZXW-YZP","pairing_session_id":"13acbfcc-6d61-4983-a58a-271fa14d15f6","expires_in":600}
HTTP 201
```

## Cross-cutting Hazard Notes for Plan 03 & Phase 43

- **Router-level admin gate exception:** The Phase 43 dep-audit test
  (SGN-BE-09) is going to walk every `/api/signage/*` route and assert
  `require_admin` is in the dep chain. That test MUST permit
  `/api/signage/pair/request` and `/api/signage/pair/status` as
  exceptions. The inline `INTENTIONAL EXCEPTION` comment block in
  `signage_pair.py` is the designated pin; the dep-audit test can
  match on it or on an allowlist.

- **Delete-on-deliver cleanup semantic:** After a successful claim +
  first status poll, the pairing-session row is already gone. Plan 03's
  cron only needs to sweep rows that never got claimed or never got
  polled — it should treat "claimed but not yet delivered" rows as
  expired after some grace window, OR rely on the fact that the kiosk
  will poll every few seconds so stale-claimed rows are pathological.
  Recommendation: sweep on `expires_at < now() - <grace>` regardless of
  claimed_at state; no separate "claimed but undelivered" rule needed.

- **Unknown-id 200 vs 404 semantic:** all "not-present" cases (unknown id,
  unparseable UUID, claimed-then-drained, TTL-elapsed) collapse to
  `{status: "expired"}`. This is the wire shape Plan 03 and Phase 43
  should assume. Do not introduce a 404 branch later; clients rely on
  the 200-is-terminal-state invariant.

## Deviations from Plan

None. Plan executed exactly as written. Small consolidation: the plan
listed 14 test cases; the implementation ships 13 `test_*` functions
covering 15 behavior assertions (Tests 1 and 2 in the plan — "201 with
body shape" and "DB row created" — are combined into a single test body
because they share setup and exercise the same endpoint contract, and
splitting them into two separate async tests would double the fixture
setup cost for no additional coverage).

The `routers/__init__.py` file is intentionally left empty — every
existing router in this repo is mounted by direct
`from app.routers.<mod> import router as <name>_router` in `main.py`.
Adding anything to `routers/__init__.py` would deviate from the existing
project convention.

No authentication gates were required during execution.

## Commits

- `11f8e9c` — test(42-02): add failing tests for /api/signage/pair router
- `c50ab4b` — feat(42-02): implement /api/signage/pair router (SGN-BE-03)

## Self-Check: PASSED

- backend/app/routers/signage_pair.py — FOUND
- backend/tests/test_signage_pair_router.py — FOUND
- backend/app/main.py (modified, imports + mounts signage_pair_router) — FOUND
- Commit 11f8e9c — FOUND
- Commit c50ab4b — FOUND
- All 13 router tests PASS (`docker compose exec api pytest tests/test_signage_pair_router.py`)
- No regression in tests/test_signage_pairing_service.py, test_device_auth.py, test_rate_limit.py, test_sensors_admin_gate.py, test_require_admin.py (27/27 pass)
- All 13 acceptance-criteria grep checks pass (prefix, rate_limit_pair_request, require_admin, get_current_user, mint_device_jwt, generate_pairing_code, INTENTIONAL EXCEPTION, claimed_at.is_(None), returning(, delete(SignagePairingSession), signage_pair in main.py, include_router signage_pair, no device_token_hash in router)
- Manual smoke: `curl -X POST http://localhost:8000/api/signage/pair/request` returns 201 with correctly-formatted pairing code
