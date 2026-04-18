---
phase: 04-backend-schema-api-and-security
verified: 2026-04-11T12:30:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 04: Backend Schema, API, and Security — Verification Report

**Phase Goal:** A curl-testable settings API exists with security enforced at the persistence boundary — no logo or color value can be stored without passing sanitization and validation.

**Verified:** 2026-04-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | GET /api/settings returns JSON with all fields including logo_updated_at and logo_url | VERIFIED | `backend/app/routers/settings.py:68-71` defines GET handler. `_build_read()` (lines 41-57) populates all 6 colors, app_name, default_language, logo_url (cache-busted with `?v={ts}`), logo_updated_at. SettingsRead schema (`schemas.py:102-116`) declares all fields. |
| 2 | PUT /api/settings with color value containing `;` or `url(` returns HTTP 422 | VERIFIED | `schemas.py:68` `_FORBIDDEN_CHARS` includes `;`; `_FORBIDDEN_TOKENS` (line 69) includes `url(`. `_validate_oklch()` raises `ValueError` BEFORE the regex check (lines 76-80). Pydantic surfaces ValueError as 422. Verified by `test_color_validator.py:54-57` (forbidden chars including `;`) and `test_color_validator.py:65-68` (forbidden tokens including `url(`). Smoke script verifies end-to-end at lines 36-50. |
| 3 | POST /api/settings/logo with malicious `<script>` SVG stores a sanitized version (no script in retrieved bytes) | VERIFIED (with stronger guarantee) | `sanitize_svg()` in `logo_validation.py:83-108` uses **reject-on-mutation** strategy (D-13): if nh3.clean() mutates the input, the upload is rejected outright with 422 — script SVGs are NEVER persisted. Router `routers/settings.py:128-133` catches `SvgRejected` → 422. Test `test_logo_validation.py:84` exercises `<script>alert(1)</script>` SVG. Smoke script lines 53-67 verifies 422 + `logo_url=null` after attempt. Note: criterion text says "stores a sanitized version" but implementation enforces the stricter "reject and store nothing" — which satisfies the underlying intent (no script in retrieved bytes). |
| 4 | PUT /api/settings with default values resets the singleton row and returns canonical defaults from defaults.py | VERIFIED | `routers/settings.py:93-96` compares `payload.model_dump() == DEFAULT_SETTINGS` and on match wipes `logo_data`, `logo_mime`, `logo_updated_at`. Imports `DEFAULT_SETTINGS` from `app.defaults` (line 16). `defaults.py` is the single source of truth (8 fields). Smoke script verifies at lines 73-86. |
| 5 | Logo survives `docker compose up --build` (stored as bytea in Postgres, not container filesystem) | VERIFIED | Model `app/models.py:134` declares `logo_data: BYTEA, nullable=True`. Router `settings.py:137` writes `row.logo_data = raw` (bytes go to DB column, never to disk). Migration `b2c3d4e5f6a7_v1_1_app_settings.py:47` creates the BYTEA column. Manual rebuild test confirmed by user (per phase context: SHA before/after matched). Runbook documented at `04-DOCKER-VERIFY.md`. Bug in runbook SVG fixed in commit `39ba093`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/requirements.txt` | nh3==0.3.4 declared | VERIFIED | Contains `nh3==0.3.4` plus all FastAPI/SQLAlchemy/asyncpg/alembic/pandas pins. |
| `backend/requirements-dev.txt` | pytest stack | VERIFIED | pytest==9.0.3, pytest-asyncio==1.3.0, httpx==0.28.1, asgi-lifespan==2.1.0. |
| `backend/pytest.ini` | asyncio mode auto | VERIFIED | `asyncio_mode = auto`, `testpaths = tests`. |
| `backend/tests/conftest.py` | async client + reset fixture | VERIFIED | 80 lines. Provides `client` (ASGITransport + LifespanManager) and autouse `reset_settings` fixture. Imports `from app.main import app`. |
| `backend/app/models.py` | AppSettings ORM + singleton CHECK | VERIFIED | Class `AppSettings` (lines 105-138) with 6 color cols, app_name, default_language, logo_data BYTEA, logo_mime, logo_updated_at. `CheckConstraint("id = 1", name="ck_app_settings_singleton")`. |
| `backend/app/defaults.py` | DEFAULT_SETTINGS dict | VERIFIED | 23 lines. `DEFAULT_SETTINGS: Final[dict[str, str]]` with 8 fields matching the migration seed exactly. |
| `backend/alembic/versions/b2c3d4e5f6a7_v1_1_app_settings.py` | create_table + bulk_insert seed | VERIFIED | `op.create_table("app_settings", ...)` with all columns and `CheckConstraint("id = 1")`. `op.bulk_insert(settings, [_DEFAULT_ROW])` seeds id=1. Revision chain valid: `a1b2c3d4e5f6` (phase3) → `b2c3d4e5f6a7`. |
| `backend/app/schemas.py` | OklchColor + SettingsRead/SettingsUpdate | VERIFIED | 116 lines. `OklchColor = Annotated[str, AfterValidator(_validate_oklch)]` (line 86). Belt-and-braces blacklist + regex. SettingsUpdate has 6 colors + Literal['DE','EN'] + app_name 1-100. SettingsRead exposes logo_url and logo_updated_at as nullable. |
| `backend/tests/test_color_validator.py` | forbidden char + token coverage | VERIFIED | 111 lines. Parametrized tests cover all 9 forbidden chars `[";", "{", "}", '"', "'", "\`", "\\", "<", ">"]` and all 4 forbidden tokens `["url(", "expression(", "/*", "*/"]`. |
| `backend/app/security/__init__.py` | package marker | VERIFIED | exists |
| `backend/app/security/logo_validation.py` | sanitize_svg, validate_png, sniff_mime | VERIFIED | 129 lines. Exports PNG_SIGNATURE, SVG_ALLOWED_TAGS (16 tags), SVG_ALLOWED_ATTRIBUTES, SVG_ALLOWED_URL_SCHEMES={"https"}, SvgRejected, validate_png, sanitize_svg, sniff_mime. Uses `nh3.clean()` with reject-on-mutation. |
| `backend/tests/test_logo_validation.py` | malicious SVG + PNG magic byte coverage | VERIFIED | 107 lines. Tests legitimate SVG, `<script>` SVG, `javascript:` href SVG, PNG magic bytes, non-PNG bytes, UTF-8 decode failure. |
| `backend/app/routers/settings.py` | APIRouter with 4 handlers | VERIFIED | 166 lines. APIRouter(prefix="/api/settings"). GET, PUT, POST /logo, GET /logo. ETag W/"<timestamp>" via `_etag_for()` helper (Pitfall 4). 304 on If-None-Match. 1 MB cap via read(MAX+1). |
| `backend/app/main.py` | settings router included | VERIFIED | Line 7: `from app.routers.settings import router as settings_router`. Line 13: `app.include_router(settings_router)`. |
| `backend/tests/test_settings_api.py` | integration tests for criteria 1-4 | VERIFIED | 182 lines. |
| `scripts/verify-phase-04.sh` | curl smoke script for criteria 1-4 | VERIFIED | 101 lines. Executable. Tests GET shape (10 keys), `;` and `url(` 422s, malicious SVG 422 + null logo_url, defaults reset clears logo. Exits non-zero on failure. |
| `.planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md` | manual rebuild runbook | VERIFIED | 62 lines. Documents SHA-compare runbook for criterion 5. |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `backend/tests/conftest.py` | `backend/app/main.py` | `from app.main import app` | WIRED (line 13) |
| `backend/alembic/versions/b2c3d4e5f6a7_v1_1_app_settings.py` | app_settings table | `op.create_table` + `op.bulk_insert` | WIRED (lines 36, 52) |
| `backend/app/models.py` | app_settings table | `__tablename__ = "app_settings"` | WIRED (line 110) |
| `backend/app/schemas.py` | Pydantic AfterValidator | `Annotated[str, AfterValidator(_validate_oklch)]` | WIRED (line 86) |
| `backend/app/security/logo_validation.py` | nh3 | `nh3.clean(text, tags=..., attributes=..., url_schemes=..., strip_comments=True)` | WIRED (lines 96-102) |
| `backend/app/routers/settings.py` | `backend/app/security/logo_validation.py` | `from app.security.logo_validation import SvgRejected, sanitize_svg, sniff_mime` | WIRED (line 19) |
| `backend/app/routers/settings.py` | `backend/app/defaults.py` | `from app.defaults import DEFAULT_SETTINGS` | WIRED (line 16) |
| `backend/app/main.py` | `backend/app/routers/settings.py` | `from app.routers.settings import router as settings_router` | WIRED (line 7) |
| `backend/app/routers/settings.py` | AppSettings singleton | `select(AppSettings).where(AppSettings.id == 1)` | WIRED (line 30) |
| `scripts/verify-phase-04.sh` | /api/settings endpoints | `curl -sS .../api/settings` | WIRED (lines 24, 39, 54, 80) |

**All 10 key links verified.**

### Data-Flow Trace (Level 4)

Phase produces a backend API. Data flow traced from HTTP request → Pydantic validator → ORM → Postgres column → ORM read → SettingsRead → JSON response. All paths confirmed wired:

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| GET /api/settings | `row` | `SELECT * FROM app_settings WHERE id=1` (real DB read) | Yes — seeded by migration `bulk_insert` | FLOWING |
| PUT /api/settings | `payload` | Pydantic SettingsUpdate (real validation, not stub) | Yes — writes 8 fields back to row | FLOWING |
| POST /api/settings/logo | `raw` | `await file.read(MAX+1)` (real upload bytes) | Yes — written to `row.logo_data` BYTEA column | FLOWING |
| GET /api/settings/logo | `row.logo_data` | Real DB BYTEA column | Yes — Response(content=row.logo_data, media_type=row.logo_mime) | FLOWING |

No hardcoded stubs, no static returns, no hollow props.

### Behavioral Spot-Checks

Per phase context, the following were already executed and confirmed by the user prior to verification:

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 65 backend tests pass | `pytest` (in container) | All pass | PASS (pre-recorded) |
| Smoke script criteria 1-4 | `scripts/verify-phase-04.sh` | PASSED:16 FAILED:0 | PASS (pre-recorded) |
| Logo survives rebuild | manual SHA compare per `04-DOCKER-VERIFY.md` | matched | PASS (human-approved) |

Per instructions, this verifier did not re-run tests. Static evidence corroborates: route handlers exist, security gates exist, persistence is BYTEA, runbook is documented.

### Requirements Coverage

Phase requirement IDs: SET-02, SET-03, SET-04, BRAND-01, BRAND-02, BRAND-04, BRAND-09.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SET-02 | 04-02 | `app_settings` singleton table via Alembic migration | SATISFIED | Migration `b2c3d4e5f6a7` creates table with `CheckConstraint("id = 1")` and seeds 1 row. Model in `models.py:105-138`. |
| SET-03 | 04-03, 04-05 | GET/PUT /api/settings with Pydantic validation (color/lang/size/type) | SATISFIED | `routers/settings.py:68,74` define handlers; `schemas.py` SettingsUpdate validates colors via OklchColor + Literal['DE','EN'] + app_name length. |
| SET-04 | 04-02, 04-05 | Reset to canonical defaults from `defaults.py` | SATISFIED | `defaults.py` defines DEFAULT_SETTINGS; `routers/settings.py:93-96` detects exact match and clears logo trio. |
| BRAND-01 | 04-04, 04-05 | Logo upload PNG/SVG only, max 1 MB | SATISFIED | `ALLOWED_LOGO_EXTENSIONS = {".png",".svg"}`; `MAX_LOGO_BYTES = 1*1024*1024`; ext check + read(MAX+1) + 422 on overflow (`settings.py:108-120`). |
| BRAND-02 | 04-04, 04-05 | nh3 SVG sanitization, no scripts/handlers, strict allowlist | SATISFIED | `sanitize_svg()` with explicit SVG_ALLOWED_TAGS/ATTRIBUTES/URL_SCHEMES (https only); reject-on-mutation per D-13. |
| BRAND-04 | 04-02, 04-05, 04-06 | logo_updated_at column + ETag + cache-busting URL | SATISFIED | `logo_updated_at` column; `_build_read` produces `?v={ts}`; `_etag_for` produces `W/"<timestamp>"`; 304 on If-None-Match (`settings.py:154-156`). |
| BRAND-09 | 04-03 | Pydantic strict color regex blocking `;{}`, `url(`, `expression(`, quotes | SATISFIED | `_FORBIDDEN_CHARS` and `_FORBIDDEN_TOKENS` enforced before `_OKLCH_RE`. Tested in `test_color_validator.py:54,65`. |

**All 7 phase requirements satisfied.** No orphaned requirements (REQUIREMENTS.md traceability table maps exactly these 7 to Phase 4).

### Anti-Patterns Found

Spot-scan of router/security/schemas/models/migration: no TODO/FIXME/HACK/PLACEHOLDER markers. No `return null` stubs. No console-log-only handlers (Python). No hardcoded empty data flowing to render. No static fallback returns in API routes. The `defaults.py` duplication of values into the migration is intentional and documented (migrations must not import live app code) — not an anti-pattern.

One minor finding: criterion 3's literal text says "stores a sanitized version" but the implementation enforces the stricter "reject-on-mutation" strategy (per D-13) — script SVGs are blocked entirely with 422 rather than partially cleaned and stored. This is **stronger** than the criterion and satisfies the underlying intent ("no script in retrieved bytes"). Documented here for traceability; not a gap.

### Human Verification Required

None outstanding. The only criterion that required human action (criterion 5: docker rebuild persistence) was already executed and approved per phase context. Runbook bug found during that pass was fixed in commit `39ba093`.

### Gaps Summary

No gaps. All 5 success criteria are backed by code that exists, is substantive, is wired into the FastAPI app, and produces real data through real DB I/O. All 7 phase requirements are satisfied. All 10 key links are wired. All artifacts meet line-count and content expectations.

**Recommendation:** Phase 04 is complete. Proceed to Phase 05.

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_
