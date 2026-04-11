---
phase: 04-backend-schema-api-and-security
plan: 01
subsystem: backend/test-harness
tags: [backend, tests, dependencies, scaffold]
dependency_graph:
  requires: []
  provides:
    - "nh3 runtime dep (enables SVG sanitization in Plan 04-04)"
    - "Async test harness (pytest + pytest-asyncio + httpx + asgi-lifespan)"
    - "backend/tests/ scaffold with async client fixture"
    - "autouse reset_settings fixture with lazy-import guard"
  affects:
    - "All Wave 1 plans (04-02, 04-03, 04-04) — they write tests against this harness"
tech_stack:
  added:
    - "nh3==0.3.4 (runtime)"
    - "pytest==9.0.3 (dev)"
    - "pytest-asyncio==1.3.0 (dev)"
    - "httpx==0.28.1 (dev)"
    - "asgi-lifespan==2.1.0 (dev)"
  patterns:
    - "ASGITransport + LifespanManager for async integration tests"
    - "Lazy-import guard in autouse fixtures so collection survives partial trees"
key_files:
  created:
    - backend/tests/__init__.py
    - backend/tests/conftest.py
    - backend/pytest.ini
  modified:
    - backend/requirements.txt
    - backend/requirements-dev.txt
decisions:
  - "nh3==0.3.4 (not 0.3.3 per STATE.md) — research confirmed 0.3.4 is current"
  - "Lazy ImportError guard in reset_settings so Plans 02/03 can land independently"
  - "pytest-asyncio asyncio_mode=auto — no @pytest.mark.asyncio boilerplate needed"
metrics:
  duration: "~3 min"
  completed: "2026-04-11"
  tasks: 2
  files_touched: 5
---

# Phase 04 Plan 01: Backend Test Harness & nh3 Dep Summary

## One-liner

Wave-0 foundation for Phase 4: adds nh3 runtime dependency and scaffolds `backend/tests/` with an async httpx client fixture (ASGITransport + asgi-lifespan) plus an autouse `reset_settings` fixture guarded by lazy imports so downstream plans can write integration tests immediately.

## What Was Built

**Runtime dependency:**
- `nh3==0.3.4` appended to `backend/requirements.txt` — Rust-backed HTML/SVG sanitizer used in Plan 04-04 to strip dangerous SVG content before persisting logo uploads.

**Dev dependencies (replaces ruff-only `requirements-dev.txt`):**
- `pytest==9.0.3`
- `pytest-asyncio==1.3.0`
- `httpx==0.28.1`
- `asgi-lifespan==2.1.0`
- (existing) `ruff==0.15.10`

**Test scaffold:**
- `backend/tests/__init__.py` — empty package marker.
- `backend/pytest.ini` — sets `asyncio_mode = auto` and `testpaths = tests`.
- `backend/tests/conftest.py` — defines:
  - `client`: async httpx client bound to the FastAPI ASGI app via `ASGITransport`, wrapped in `LifespanManager` so startup/shutdown hooks fire.
  - `reset_settings` (autouse): resets the `app_settings` singleton row to `DEFAULT_SETTINGS` before each test. Guarded by a try/except `ImportError` so `pytest --collect-only` still works before `app.models.AppSettings` and `app.defaults.DEFAULT_SETTINGS` land in Plans 04-02 / 04-03.

## Tasks Completed

| Task | Name                                                    | Commit    | Files                                                                 |
| ---- | ------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| 1    | Add nh3 runtime dep + test stack dev deps               | `c2e3b34` | backend/requirements.txt, backend/requirements-dev.txt                |
| 2    | Create backend/tests/ scaffold with async client fixture | `ef00417` | backend/tests/__init__.py, backend/tests/conftest.py, backend/pytest.ini |

## Verification

All acceptance criteria from plan met:
- `grep -c '^nh3==0.3.4$' backend/requirements.txt` → 1
- `grep -c '^fastapi==0.135.3$' backend/requirements.txt` → 1 (existing pin preserved)
- `grep -c '^pytest==9.0.3$' backend/requirements-dev.txt` → 1
- `grep -c '^pytest-asyncio==1.3.0$' backend/requirements-dev.txt` → 1
- `grep -c '^httpx==0.28.1$' backend/requirements-dev.txt` → 1
- `grep -c '^asgi-lifespan==2.1.0$' backend/requirements-dev.txt` → 1
- `grep -c '^ruff==0.15.10$' backend/requirements-dev.txt` → 1
- `test -f backend/tests/__init__.py` → OK
- `test -f backend/tests/conftest.py` → OK
- `test -f backend/pytest.ini` → OK
- `grep -c 'asyncio_mode = auto' backend/pytest.ini` → 1
- `grep -c 'from app.main import app' backend/tests/conftest.py` → 1
- `grep -c 'LifespanManager' backend/tests/conftest.py` → 1
- `grep -c 'ASGITransport' backend/tests/conftest.py` → 1
- `grep -c 'autouse=True' backend/tests/conftest.py` → 1
- `grep -c 'ImportError' backend/tests/conftest.py` → 1

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The `reset_settings` fixture is intentionally a no-op until Plans 02/03 introduce `AppSettings` / `DEFAULT_SETTINGS`; this is documented in the fixture docstring and is part of the plan's explicit design.

## Handoff Notes for Downstream Plans (04-02 … 04-06)

- Import the `client` fixture by name in any async test: `async def test_x(client): ...`
- `asyncio_mode = auto` means you do NOT need `@pytest.mark.asyncio` on async tests.
- Once `app.models.AppSettings` and `app.defaults.DEFAULT_SETTINGS` exist, the `reset_settings` fixture auto-activates — no conftest edits needed.
- All integration tests should hit the real ASGI app via `client.get("/…")` / `client.post("/…", …)`. Avoid unit-mocking the FastAPI app.

## Self-Check: PASSED

- FOUND: backend/requirements.txt (nh3==0.3.4 line present)
- FOUND: backend/requirements-dev.txt (pytest/httpx/asgi-lifespan pins present)
- FOUND: backend/tests/__init__.py
- FOUND: backend/tests/conftest.py
- FOUND: backend/pytest.ini
- FOUND: commit c2e3b34
- FOUND: commit ef00417
