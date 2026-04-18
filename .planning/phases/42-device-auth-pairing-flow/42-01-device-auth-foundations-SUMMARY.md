---
phase: 42-device-auth-pairing-flow
plan: 01
subsystem: backend-security
tags: [signage, device-auth, jwt, rate-limit, sgn-be-04]
requires:
  - Phase 41 schema (signage_devices, SignageDevice ORM)
  - PyJWT 2.10.1, FastAPI, SQLAlchemy 2.0 async
provides:
  - app.security.device_auth.get_current_device (SGN-BE-04)
  - app.security.rate_limit.rate_limit_pair_request (D-09)
  - app.services.signage_pairing {generate_pairing_code, format_for_display, mint_device_jwt, PAIRING_ALPHABET, DEVICE_JWT_TTL_HOURS}
  - Settings.SIGNAGE_DEVICE_JWT_SECRET (D-04)
affects:
  - backend/app/config.py
  - docker-compose.yml
  - .env.example
  - backend/tests/conftest.py
tech_stack_added: []
patterns:
  - HS256 scoped device JWT (scope=device) — Pitfall 1 mitigated (algorithms=["HS256"] explicit)
  - HTTPBearer(auto_error=False) + explicit 401 raise (project convention)
  - In-process sliding-window rate limit (deque + asyncio.Lock) — viable only under --workers 1
  - Crockford-derived 31-char unambiguous alphabet for pairing codes
key_files:
  created:
    - backend/app/security/device_auth.py
    - backend/app/security/rate_limit.py
    - backend/app/services/signage_pairing.py
    - backend/tests/test_signage_pairing_service.py
    - backend/tests/test_device_auth.py
    - backend/tests/test_rate_limit.py
  modified:
    - backend/app/config.py
    - docker-compose.yml
    - .env.example
    - backend/tests/conftest.py
decisions:
  - "D-04 realized: SIGNAGE_DEVICE_JWT_SECRET is a required field with no default — app fails fast if unset"
  - "D-14 realized: revoked device → 401 not 403 (treat token as no-longer-valid for this server)"
  - "D-09 realized: rate limit is in-process; load-bearing --workers 1 invariant documented in-module"
metrics:
  duration: ~12 min
  completed: 2026-04-18T16:01:40Z
  tasks: 3
  commits: 3
  tests_added: 19
---

# Phase 42 Plan 01: Device Auth Foundations Summary

Shipped the scoped device-JWT dependency, per-IP sliding-window rate-limit
dependency, and pure-function pairing-code/JWT helpers that Wave 2's
`/api/signage/pair/*` router and Wave 3's pairing-cleanup cron both depend on.
SGN-BE-04 is now test-covered and import-ready for Plans 42-02 and 43.

## What Was Built

- **`Settings.SIGNAGE_DEVICE_JWT_SECRET`** (D-04): required `str` field,
  no default — pydantic-settings will refuse to instantiate `Settings` if the
  env var is missing. Wired through `docker-compose.yml` (`api` service
  environment block; migrate and directus deliberately excluded —
  different trust domains) and documented in `.env.example` with the
  `python -c "import secrets; print(secrets.token_urlsafe(64))"` generation
  hint. Conftest seeds a test-only default so pytest collection does not
  break on a clean checkout.

- **`app.services.signage_pairing`** — three pure exports:
  - `PAIRING_ALPHABET` (31 chars; `assert len(...) == 31` top-level; no
    `0/O/1/I/L` per D-05; `U` retained for entropy margin)
  - `generate_pairing_code()` → 6-char uppercase string via `secrets.choice`
    (stdlib; **never** `random`)
  - `format_for_display(code)` → `"XXX-XXX"` for the kiosk screen
  - `mint_device_jwt(device_id)` → HS256 JWT with payload
    `{sub: str(uuid), scope: "device", iat, exp}` and `DEVICE_JWT_TTL_HOURS = 24`
    (D-01)

- **`app.security.device_auth.get_current_device`** — FastAPI dependency
  mirroring `directus_auth.get_current_user`:
  - `HTTPBearer(auto_error=False)` + explicit 401 raise with
    `WWW-Authenticate: Bearer` header
  - `jwt.decode(..., algorithms=["HS256"])` — explicit (Pitfall 1 defense)
  - Catches base `jwt.PyJWTError` → 401 (covers expired / bad signature /
    malformed payload uniformly; never 400)
  - Enforces `payload["scope"] == "device"` → else 401
  - Parses `sub` as UUID; on failure → 401
  - Loads the `SignageDevice` row; returns 401 when missing OR
    `revoked_at IS NOT NULL` (D-14 — revoked devices get 401, not 403)

- **`app.security.rate_limit.rate_limit_pair_request`** — in-process
  sliding window:
  - `{ip: deque[float monotonic-timestamps], maxlen=6}` + `asyncio.Lock`
  - 5 req / 60s per client IP; 6th hit → `HTTPException(429)` with
    `Retry-After: 60`
  - Uses `request.client.host` (D-10); explicit inline TODO for future
    reverse-proxy parsing
  - Load-bearing `--workers 1` invariant documented in a prominent
    comment block at the top of the module
  - Test-only `_reset_for_tests()` helper for fixture isolation

## SGN-BE-04 Acceptance Evidence

| Requirement                                                                     | Test                                                    | Result |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| Forged / unsigned bearer → 401                                                  | `test_malformed_token_returns_401`                      | PASS   |
| Missing Authorization → 401 + WWW-Authenticate                                  | `test_missing_authorization_returns_401`                | PASS   |
| Wrong scope → 401                                                               | `test_wrong_scope_returns_401`                          | PASS   |
| Non-UUID sub → 401                                                              | `test_sub_not_uuid_returns_401`                         | PASS   |
| Expired token → 401                                                             | `test_expired_token_returns_401`                        | PASS   |
| Unknown device → 401                                                            | `test_unknown_device_returns_401`                       | PASS   |
| Valid device → SignageDevice row                                                | `test_valid_device_returns_row`                         | PASS   |
| `revoked_at IS NOT NULL` → 401 (NOT 403)                                        | `test_revoked_device_returns_401_not_403`               | PASS   |
| Rate-limit: 5 under limit                                                       | `test_five_calls_allowed`                               | PASS   |
| Rate-limit: 6th returns 429 + Retry-After: 60                                   | `test_sixth_call_returns_429_with_retry_after`          | PASS   |
| Rate-limit: per-IP isolation                                                    | `test_different_ips_dont_share_window`                  | PASS   |
| Rate-limit: window resets after elapse                                          | `test_window_resets_after_elapse`                       | PASS   |
| Pairing alphabet is the 31-char D-05 set                                        | `test_pairing_alphabet_shape`                           | PASS   |
| Code shape regex                                                                | `test_generate_pairing_code_shape`                      | PASS   |
| Display formatter                                                               | `test_format_for_display`                               | PASS   |
| JWT roundtrip (sub / scope / iat / exp; exp = iat + 24h)                        | `test_mint_device_jwt_roundtrip`                        | PASS   |
| Wrong-secret rejection                                                          | `test_mint_device_jwt_rejects_wrong_secret`             | PASS   |

19/19 unit tests pass inside the `api` container (`docker compose exec api
python -m pytest tests/test_signage_pairing_service.py tests/test_device_auth.py
tests/test_rate_limit.py -v`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `pysnmp` missing from running api container**
- **Found during:** Task 2 (first test run)
- **Issue:** `docker compose exec api pytest` failed at conftest import —
  `ModuleNotFoundError: No module named 'pysnmp'`. Container image was built
  before `pysnmp` was added to `requirements.txt` (v1.15), and nobody
  rebuilt the image. Out-of-scope for Plan 42-01 but blocking.
- **Fix:** `pip install pysnmp` inside the running container (image rebuild
  is the durable fix; tracked as tech debt below).
- **Files modified:** none (runtime-only install)
- **Commit:** not committed (runtime-only)

**2. [Rule 1 — Bug] `asyncio.run` inside pytest-asyncio test body**
- **Found during:** Task 3 (first full test run)
- **Issue:** `_require_db()` used `asyncio.run(...)` for its probe, which
  raises inside an already-running event loop. The 3 DB-backed tests were
  silently skipped as "Postgres not reachable" instead of running.
- **Fix:** Converted `_require_db` to an `async def` helper awaited from the
  test body; no `asyncio.run` anywhere in the test module.
- **Files modified:** `backend/tests/test_device_auth.py`
- **Commit:** folded into Task 3 commit `c3a0cd5`

**3. [Rule 2 — Critical] Conftest needed `SIGNAGE_DEVICE_JWT_SECRET` default**
- **Found during:** Task 1 acceptance design
- **Issue:** Making the Settings field required means every test that
  imports `app.config` fails at collection without the env var set. The
  existing `os.environ.setdefault("DIRECTUS_SECRET", ...)` conftest pattern
  is the project-standard solution.
- **Fix:** Added `os.environ.setdefault("SIGNAGE_DEVICE_JWT_SECRET", "test-signage-device-jwt-secret-phase-42")`
  alongside the existing defaults in `backend/tests/conftest.py`.
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** included in Task 1 commit `8c8aaea`

No authentication gates were required.

## Deferred Tech Debt

- **Container image drift:** the live `api` container image was built before
  `pysnmp` was added to `requirements.txt` (v1.15). A workaround
  (`pip install` into the live container) was applied so test execution
  could proceed. The durable fix is a `docker compose build api` rebuild,
  which is out-of-scope for Plan 42-01 and unrelated to signage auth.
  Recommended before Plan 42-02 lands.
- **`_buckets` unbounded-growth GC:** documented in
  `app/security/rate_limit.py`. Mitigation lives in Plan 42-03 (pairing
  cleanup cron will also sweep empty buckets). Acceptable for the ~5-device
  fleet ceiling (D-09 scope).

## Commits

- `8c8aaea` — feat(42-01): add SIGNAGE_DEVICE_JWT_SECRET config (D-04)
- `3c6beac` — feat(42-01): add signage_pairing service (SGN-BE-04)
- `c3a0cd5` — feat(42-01): add get_current_device + rate_limit_pair_request deps (SGN-BE-04, D-09)

## Self-Check: PASSED

- backend/app/security/device_auth.py — FOUND
- backend/app/security/rate_limit.py — FOUND
- backend/app/services/signage_pairing.py — FOUND
- backend/tests/test_signage_pairing_service.py — FOUND
- backend/tests/test_device_auth.py — FOUND
- backend/tests/test_rate_limit.py — FOUND
- Commit 8c8aaea — FOUND
- Commit 3c6beac — FOUND
- Commit c3a0cd5 — FOUND
- All 19 new tests PASS (pytest -v inside api container)
- `grep SIGNAGE_DEVICE_JWT_SECRET` in config.py / docker-compose.yml / .env.example — FOUND
- `grep -r device_token_hash backend/app/security/ backend/app/services/signage_pairing.py` — NONE (anti-pattern honored)
- `grep -E '^import random|random\.choice' backend/app/services/signage_pairing.py` — NONE (secrets-only)
