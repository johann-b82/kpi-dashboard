---
phase: 04-backend-schema-api-and-security
plan: 05
subsystem: backend/api
tags: [fastapi, router, settings, logo-upload, etag, brand-01, brand-02, brand-09]
requirements: [SET-03, SET-04, BRAND-01, BRAND-02, BRAND-04]
dependency_graph:
  requires:
    - "Plan 04-02 — AppSettings ORM model + DEFAULT_SETTINGS + Alembic migration"
    - "Plan 04-03 — SettingsRead / SettingsUpdate Pydantic schemas + OklchColor"
    - "Plan 04-04 — logo_validation module (sanitize_svg, sniff_mime, SvgRejected, PNG_SIGNATURE)"
  provides:
    - "GET/PUT /api/settings endpoints returning SettingsRead"
    - "POST /api/settings/logo with ext allowlist + size cap + MIME sniff + SVG sanitization"
    - "GET /api/settings/logo with weak ETag + Cache-Control and 304 on If-None-Match"
    - "app.include_router(settings_router) wired in backend/app/main.py"
  affects:
    - "Plan 04-06 (integration verification, docker-level success criterion 5)"
    - "Phase 05 frontend settings page (consumes these endpoints)"
tech_stack:
  added: []
  patterns:
    - "Singleton-row write-through: _get_singleton(db) → mutate → commit → refresh"
    - "Defense-in-depth logo pipeline: ext → size → sniff → sanitize → persist"
    - "Weak ETag derived from logo_updated_at int timestamp (shared helper so response + comparison can't drift)"
    - "Reset-to-defaults detection via payload.model_dump() == DEFAULT_SETTINGS (D-07)"
    - "Per-test engine.dispose() to work around module-level asyncpg pool + multi-loop fragility"
key_files:
  created:
    - backend/app/routers/settings.py
    - backend/tests/test_settings_api.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py
decisions:
  - "Weak ETag W/\"<int_timestamp>\" derived from logo_updated_at — single _etag_for helper prevents response/comparison drift (Pitfall 4)"
  - "Read MAX_LOGO_BYTES + 1 from UploadFile and reject if len > limit — never trust Content-Length header (D-16)"
  - "PUT payload equality against DEFAULT_SETTINGS triggers full reset including logo wipe; any non-default PUT preserves the logo (D-07)"
  - "engine.dispose() in conftest reset_settings + client fixtures — unblocks integration tests against the shared module-level async engine without changing production DATABASE_URL / pool config"
metrics:
  duration: "~4 min"
  completed: "2026-04-11"
  tasks: 2
  files: 4
---

# Phase 4 Plan 05: Settings Router & Integration Tests Summary

**One-liner:** Wired Plans 02–04 into a working `/api/settings/*` FastAPI router (GET/PUT settings, POST/GET logo with ETag/304), covered by 14 passing integration tests that exercise roadmap success criteria 1–4 end-to-end against the live ASGI app and Postgres.

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-11T10:04:39Z
- **Completed:** 2026-04-11T10:08:47Z
- **Tasks:** 2
- **Files:** 4 (2 created, 2 modified)

## What Was Built

### `backend/app/routers/settings.py` (new, 165 lines)

Four handlers under `APIRouter(prefix="/api/settings")`:

1. **`GET ""`** → `SettingsRead`. Loads the singleton row; synthesizes `logo_url = "/api/settings/logo?v=<ts>"` when a logo exists.
2. **`PUT ""`** → `SettingsRead`. Pydantic `SettingsUpdate` handles BRAND-09 validation (422 on `;`, `url(`, etc. — belt-and-braces from Plan 03). If `payload.model_dump() == DEFAULT_SETTINGS`, the logo trio (`logo_data / logo_mime / logo_updated_at`) is cleared (D-07).
3. **`POST "/logo"`** → `SettingsRead`. Five-stage pipeline:
   1. Extension allowlist (`{.png, .svg}`, case-insensitive).
   2. Size cap: read `MAX_LOGO_BYTES + 1` bytes and reject if over 1 MB (D-16 — never trust `Content-Length`).
   3. `sniff_mime(raw, ext)` — magic-byte check overrides client-declared Content-Type (D-17).
   4. `sanitize_svg(raw)` for `.svg` (nh3 reject-on-mutation) — skipped for `.png` per D-14.
   5. Persist to the singleton row with `logo_updated_at = now(UTC)`.
4. **`GET "/logo"`** → `Response`. Returns raw bytes with `media_type = row.logo_mime`, `ETag: W/"<int_timestamp>"`, and `Cache-Control: public, max-age=31536000`. If `If-None-Match` matches the current ETag, returns 304 with only the ETag header. 404 when no logo is set.

Shared helpers: `_get_singleton(db)`, `_build_read(row)`, `_etag_for(row)` (Pitfall 4 — one helper so response and comparison can't drift).

### `backend/app/main.py` (modified)

Added `from app.routers.settings import router as settings_router` and `app.include_router(settings_router)` below the existing uploads/kpis includes. `/health` handler and include order for prior routers unchanged.

### `backend/tests/test_settings_api.py` (new, 191 lines, 14 tests)

Integration tests against the live ASGI app via `httpx.AsyncClient` + `LifespanManager`. The autouse `reset_settings` fixture from conftest resets the singleton row to `DEFAULT_SETTINGS` before each test.

Roadmap success criterion coverage:

- **Criterion 1** — `test_get_settings_returns_shape`: all 10 keys present, `logo_url` null when unset.
- **Criterion 2** — `test_put_rejects_semicolon_in_color`, `test_put_rejects_url_function_in_color`: 422 on CSS injection attempts.
- **Criterion 3** — `test_logo_svg_with_script_rejected`: POST of `<svg><script>alert(1)</script></svg>` returns 422 and a follow-up GET shows `logo_url` still null.
- **Criterion 4** — `test_put_defaults_resets_logo`: upload SVG → PUT `DEFAULT_SETTINGS` → `logo_url` becomes null and all fields match defaults.

Additional coverage: `test_put_valid_payload_updates_row`, `test_post_logo_png_happy_path`, `test_post_logo_svg_happy_path`, `test_post_logo_wrong_extension_rejected`, `test_post_logo_oversize_rejected` (1 MB + signature), `test_post_logo_svg_extension_but_png_bytes_rejected`, `test_get_logo_404_when_unset`, `test_get_logo_returns_bytes_and_etag`, `test_get_logo_304_on_matching_if_none_match`.

### `backend/tests/conftest.py` (modified)

Added `await engine.dispose()` in both `reset_settings` (before the singleton UPDATE) and `client` (before and after the ASGI session). Details in Deviations below.

## Task Commits

1. **Task 1: Settings router + main.py registration** — `798461a` (feat)
2. **Task 2: Integration tests + conftest dispose fix** — `1352ebe` (test)

## Verification

Applied the outstanding Plan 02 migration in the running container before testing:

```
$ docker exec acm-kpi-light-api-1 alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade a1b2c3d4e5f6 -> b2c3d4e5f6a7, v1.1 app_settings singleton
```

Then:

```
$ docker exec acm-kpi-light-api-1 python -m pytest tests/test_settings_api.py -q
14 passed in 0.34s

$ docker exec acm-kpi-light-api-1 python -m pytest -q
65 passed in 0.59s
```

All backend tests (Plans 01, 03, 04, 05) pass together.

Plan acceptance criteria confirmed:

- `APIRouter(prefix="/api/settings")` — present
- `@router.get("")`, `@router.put("")`, `@router.post("/logo")`, `@router.get("/logo")` — all present
- `sanitize_svg` / `sniff_mime` / `DEFAULT_SETTINGS` / `MAX_LOGO_BYTES` references — all at or above required counts
- `file.read(MAX_LOGO_BYTES + 1)` — present
- `if-none-match` header handling — present
- `settings_router` imported and included in `main.py` (2 matches)
- 14 test functions (≥13 required); all success-criterion tests named exactly as specified

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] asyncpg "another operation in progress" across test event loops**

- **Found during:** Task 2 — first run of `test_settings_api.py` against the live ASGI app.
- **Issue:** With `asyncio_mode = auto` (pytest-asyncio 1.3), each test function gets its own event loop. The module-level `engine` in `backend/app/database.py` caches connections in an asyncpg pool bound to the loop that first used them. When a later test reuses the same pool from a new loop, asyncpg raises `InterfaceError: another operation is in progress` (identical fingerprint to the pattern flagged in 04-03 and 04-04 summaries). `test_settings_api.py` is the first test file in the repo to route DB writes through the `client` ASGI fixture, so it was the first to trip the bug: 8 failures in the suite run, but every test passed individually.
- **Fix:** Added `await engine.dispose()` calls to `conftest.py` in two places:
  - At the top of `reset_settings` (autouse), before the singleton UPDATE, so the new event loop gets a fresh pool.
  - At the top and bottom of the `client` fixture, wrapping the LifespanManager+AsyncClient context.
  This is the minimal scoped change. It leaves the production `DATABASE_URL` / pool configuration untouched and does not alter the two previously-applied unit-test isolation guards (ImportError + SQLAlchemyError/RuntimeError catch). Existing 51 tests from earlier plans remain passing; the new 14 tests now pass in suite.
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** `1352ebe`

No architectural deviations. No new dependencies. No schema changes. The plan's code blocks were executed byte-for-byte into `routers/settings.py` and `tests/test_settings_api.py`.

### Out-of-scope notes

- `alembic upgrade head` was run against the live `acm-kpi-light-api-1` container to materialize the Plan 02 migration (which Plan 02's summary deliberately deferred). This is the expected pattern described in Plan 02 — no deviation.

## Known Stubs

None. All four endpoints are fully wired to live dependencies; all 14 integration tests exercise real code paths. The only remaining Phase 4 deliverable is Plan 06's docker-level verification of success criterion 5 (persistence across `docker compose up --build`).

## Self-Check: PASSED

- FOUND: backend/app/routers/settings.py
- FOUND: backend/tests/test_settings_api.py
- FOUND commit: 798461a (Task 1 — feat(04-05))
- FOUND commit: 1352ebe (Task 2 — test(04-05))
- `grep -c 'APIRouter(prefix="/api/settings")' backend/app/routers/settings.py` → 1
- `grep -c 'app.include_router(settings_router)' backend/app/main.py` → 1
- `grep -c 'def test_' backend/tests/test_settings_api.py` → 14
- `pytest` (full backend suite) → 65 passed, 0 failed

## Next Phase Readiness

- All 5 roadmap success criteria for Phase 4 except #5 (docker persistence) are now pytest-green.
- Plan 04-06 can drive `docker compose down -v && docker compose up --build` + a curl round-trip to verify criterion 5.
- Frontend Phase 05 can start against a stable `/api/settings/*` contract.

---
*Phase: 04-backend-schema-api-and-security*
*Completed: 2026-04-11*
