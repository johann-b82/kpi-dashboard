# Deferred Items — Phase 42 (out-of-scope discoveries)

## Pre-existing test failures (NOT caused by Phase 42 changes)

### 1. `tests/test_color_validator.py` — ImportError
- Fails at collection: `ImportError: cannot import name '_validate_oklch' from 'app.schemas'`
- Verified pre-existing: reproduces on `git stash` (no Phase 42 changes applied).
- Unrelated to signage pairing / device auth.

### 2. `tests/test_settings_api.py` — 28 failing tests (auth 401 leaks)
- All 28 failures present before Phase 42-03 started (verified via `git stash`).
- Looks like a Directus auth fixture drift; outside this plan's scope.

These should be addressed in a dedicated plan (v1.15 tech-debt sweep or similar).
Phase 42-03 does not modify `tests/test_settings_api.py`, `tests/test_color_validator.py`,
or any of the surfaces they exercise.
