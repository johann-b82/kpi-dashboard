---
phase: 04-backend-schema-api-and-security
plan: 03
subsystem: backend/schemas
tags: [backend, pydantic, validation, security, brand-09]
dependency_graph:
  requires:
    - "Plan 04-01 test harness (pytest, conftest reset_settings lazy-import guard)"
  provides:
    - "SettingsUpdate/SettingsRead Pydantic v2 schemas for Plan 04-05 router"
    - "OklchColor reusable type alias (Annotated[str, AfterValidator(_validate_oklch)])"
    - "_validate_oklch belt-and-braces CSS-injection blacklist (BRAND-09)"
  affects:
    - "Plan 04-05 (settings router consumes SettingsUpdate/SettingsRead)"
    - "Plan 04-06 (integration tests assert on 422 from these validators)"
tech_stack:
  added: []
  patterns:
    - "Pydantic v2 Annotated type + AfterValidator for reusable field validation"
    - "Belt-and-braces security: character blacklist runs BEFORE regex"
    - "Literal['DE','EN'] for closed-set enum fields"
key_files:
  created:
    - backend/tests/test_color_validator.py
  modified:
    - backend/app/schemas.py
decisions:
  - "Blacklist BEFORE regex: even if regex has a subtle flaw, forbidden chars/tokens can never reach it"
  - "Alpha channel (oklch(L C H / alpha)) rejected — culori emits plain form, per RESEARCH Open Q §3"
  - "app_name bounds enforced via Annotated[str, Field(min_length=1, max_length=100)] (not Field(...) with default) to keep it a hard constraint"
  - "Local reset_settings override in test_color_validator.py short-circuits the conftest autouse fixture — these are pure unit tests, no DB touch needed"
metrics:
  duration: "~5 min"
  completed: "2026-04-11"
  tasks: 2
  files: 2
---

# Phase 4 Plan 3: Pydantic Color Validator & Settings Schemas Summary

**One-liner:** Added `OklchColor` Pydantic v2 validator with belt-and-braces CSS-injection blacklist plus `SettingsRead`/`SettingsUpdate` schemas, locked down by 32 parametrized unit tests covering BRAND-09's full forbidden charset.

## What Was Built

### `backend/app/schemas.py` (modified)

Appended Phase-4 Settings schemas at the end of the file without touching the existing v1.0 schemas:

1. **`_OKLCH_RE`** — strict regex matching `oklch(L C H)` where:
   - `L` is `0`, `1`, `0?.XXX` decimal, or a `0..100%` percentage
   - `C` is any non-negative decimal
   - `H` is a signed decimal with optional `deg` suffix
   - Alpha (`/ alpha`) is rejected

2. **`_FORBIDDEN_CHARS = frozenset(";{}\"'`\\<>")`** — the full D-10 character blacklist.

3. **`_FORBIDDEN_TOKENS = ("url(", "expression(", "/*", "*/")`** — injection-function blacklist.

4. **`_validate_oklch(value)`** — runs in this order:
   1. Type check (must be `str`)
   2. Forbidden character scan
   3. Forbidden token scan (lowercased)
   4. Regex match
   Each step raises `ValueError` with a distinct message so the test suite can differentiate.

5. **`OklchColor = Annotated[str, AfterValidator(_validate_oklch)]`** — reusable across all 6 semantic color fields per D-11.

6. **`SettingsUpdate`** — request body for `PUT /api/settings`. Has 6 `OklchColor` fields, `app_name` (1–100 chars), `default_language: Literal["DE", "EN"]`. Does NOT include logo bytes per D-05.

7. **`SettingsRead`** — response body for `GET`/`PUT /api/settings`. Same fields as Update plus `logo_url: str | None` and `logo_updated_at: datetime | None` per D-03. `model_config = {"from_attributes": True}` to hydrate from the ORM row.

### `backend/tests/test_color_validator.py` (created)

111 lines, 32 passing tests:

- **6** parametrized happy-path cases (decimal L, `deg` suffix, percent L, integer forms, zero chroma, negative hue)
- **9** parametrized forbidden-character cases (`;`, `{`, `}`, `"`, `'`, backtick, `\`, `<`, `>`)
- **4** parametrized forbidden-token cases (`url(`, `expression(`, `/*`, `*/`)
- **7** parametrized regex-fallthrough cases (empty, `rgb(...)`, hex, `oklch`, `oklch()`, `oklch(a b c)`, `not-a-color`)
- **6** `SettingsUpdate` integration cases (canonical payload, semicolon in color, `url(` in color, unknown language, empty app_name, 101-char app_name)

Total: **32 passed in 0.02s**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Local `reset_settings` override in test module**

- **Found during:** Task 2 verification
- **Issue:** The conftest autouse fixture `reset_settings` uses a lazy-import guard that was designed for "AppSettings doesn't exist yet". However, Plan 04-02 (running in parallel Wave 2) already created `app/models.py` (with `AppSettings`) and `app/defaults.py` (with `DEFAULT_SETTINGS`), so the `try: from app.models import AppSettings` no longer raises `ImportError`. The fixture then attempts `UPDATE app_settings ... WHERE id = 1`, but the Alembic migration for the table hasn't been applied to the running test database yet — and the failure surfaced as an asyncpg `"another operation is in progress"` InterfaceError. All 32 tests errored during fixture setup.
- **Fix:** Added a module-local `@pytest_asyncio.fixture(autouse=True) async def reset_settings(): yield` at the top of `test_color_validator.py`. Same name → overrides the conftest fixture for this file only. These are pure unit tests (no DB, no HTTP client) so they don't need the DB reset at all. Other test files still inherit the conftest autouse behavior.
- **Files modified:** `backend/tests/test_color_validator.py`
- **Commit:** `b3a54fd`

This is a pure Wave-2 coordination artifact, not a bug in either plan's design — both plans were written assuming they'd land independently. The override is the minimal scoped fix.

## Verification

```
$ docker exec acm-kpi-light-api-1 python -m pytest tests/test_color_validator.py -q --tb=short
................................                                         [100%]
32 passed in 0.02s
```

Smoke test from CLI:
```python
>>> from app.schemas import SettingsUpdate, SettingsRead, OklchColor, _validate_oklch
>>> _validate_oklch("oklch(0.55 0.15 250)")
'oklch(0.55 0.15 250)'
>>> _validate_oklch("oklch(0.5 0.15 url(evil))")
ValueError: color contains forbidden token
```

All plan acceptance criteria met:

- `OklchColor = Annotated[str, AfterValidator(...)]` present
- `SettingsUpdate` and `SettingsRead` classes present
- `_FORBIDDEN_CHARS` referenced twice (definition + usage)
- `Literal["DE", "EN"]` appears in both schemas
- `url(` / `expression(` literals both present
- Import succeeds, tests pass

## Known Stubs

None. Both schemas are complete; only their consumer (Plan 04-05 router) is a downstream dependency.

## Self-Check: PASSED

- `backend/app/schemas.py` — FOUND, contains `OklchColor`, `SettingsUpdate`, `SettingsRead`
- `backend/tests/test_color_validator.py` — FOUND (111 lines)
- Commit `49923ab` — FOUND (`feat(04-03): add OklchColor validator and Settings schemas`)
- Commit `b3a54fd` — FOUND (`test(04-03): add unit tests for OklchColor validator and SettingsUpdate`)
- `pytest tests/test_color_validator.py` → 32 passed
