---
phase: 12-hr-schema-personio-client
plan: "02"
subsystem: backend
tags: [personio, http-client, token-caching, exception-hierarchy, tdd]
dependency_graph:
  requires: [12-01]
  provides: [PersonioClient, PersonioAPIError, PersonioAuthError, PersonioRateLimitError, PersonioNetworkError]
  affects: [Phase-13-sync-service]
tech_stack:
  added: []
  patterns: [httpx.AsyncClient, in-memory-token-caching, TDD-RED-GREEN]
key_files:
  created:
    - backend/app/services/personio_client.py
    - backend/tests/test_personio_client.py
  modified: []
key_decisions:
  - "Token cached in-memory (not DB) — lost on container restart, re-auth is one cheap HTTP call (D-12)"
  - "Proactive refresh at <60s buffer avoids mid-request token expiry (D-13)"
  - "pytestmark asyncio module-mark removed — pytest.ini asyncio_mode=auto handles all async tests without explicit marks"
metrics:
  duration: "8min"
  completed_date: "2026-04-12"
  tasks_completed: 1
  files_changed: 2
---

# Phase 12 Plan 02: Personio Client — Summary

**One-liner:** Async httpx-based Personio API client with 4-class exception hierarchy and TTL-based in-memory token caching, validated by 11 unit tests using mocked HTTP responses.

## What Was Built

`backend/app/services/personio_client.py` provides the single integration point with the Personio REST API:

- **`PersonioClient`** — wraps `httpx.AsyncClient(base_url=PERSONIO_BASE_URL, timeout=30.0)` with:
  - `authenticate()` — POSTs `/auth`, maps HTTP status codes to typed exceptions, caches token + expiry
  - `_get_valid_token()` — returns cached token or calls `authenticate()` if token is missing or <60s from expiry
  - `close()` — awaits `_http.aclose()` for clean shutdown

- **Exception hierarchy (D-09/D-10):**
  - `PersonioAPIError(Exception)` — base with `message` + `status_code` attributes
  - `PersonioAuthError(PersonioAPIError)` — HTTP 401, message "Invalid credentials"
  - `PersonioRateLimitError(PersonioAPIError)` — HTTP 429, adds `retry_after: int` attribute
  - `PersonioNetworkError(PersonioAPIError)` — `httpx.TimeoutException` / `httpx.RequestError`

- **Constants:** `PERSONIO_BASE_URL`, `TOKEN_TTL_SECONDS = 86400`, `TOKEN_REFRESH_BUFFER = 60`

`backend/tests/test_personio_client.py` — 11 pytest-asyncio tests, all mocked, no live Personio account needed.

## TDD Execution

| Phase | Commit | Result |
|-------|--------|--------|
| RED — failing tests | a7f190c | 0 collected (ImportError — expected) |
| GREEN — implementation | b6b0b7a | 11/11 passed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed pytestmark asyncio module-level mark**
- **Found during:** GREEN phase run — pytest emitted PytestWarning on `test_exception_hierarchy` (sync function marked with asyncio)
- **Issue:** `pytestmark = pytest.mark.asyncio` was applied to all tests including the sync `test_exception_hierarchy`; pytest warned about asyncio mark on a non-async function
- **Fix:** Removed `pytestmark` — `pytest.ini` already sets `asyncio_mode = auto` which handles async detection without explicit marks; consistent with all other test files in the project
- **Files modified:** `backend/tests/test_personio_client.py`
- **Commit:** b6b0b7a

## Verification Results

```
11 passed in 0.25s (no warnings)
imports OK
grep -c "class Personio" → 5 (4 exceptions + 1 client)
```

## Known Stubs

None — all behavior is fully implemented and tested.

## Self-Check: PASSED

- `backend/app/services/personio_client.py` — exists
- `backend/tests/test_personio_client.py` — exists
- Commit a7f190c (RED tests) — verified in git log
- Commit b6b0b7a (GREEN implementation) — verified in git log
