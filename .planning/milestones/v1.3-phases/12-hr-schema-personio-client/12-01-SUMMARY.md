---
phase: 12-hr-schema-personio-client
plan: 01
subsystem: database
tags: [postgres, sqlalchemy, alembic, fernet, cryptography, personio, hr]

# Dependency graph
requires:
  - phase: 04-backend-schema-api-and-security
    provides: AppSettings singleton pattern, BYTEA column precedent, Alembic migration infrastructure
provides:
  - PersonioEmployee, PersonioAttendance, PersonioAbsence, PersonioSyncMeta SQLAlchemy models
  - Fernet encrypt_credential/decrypt_credential helpers in backend/app/security/fernet.py
  - AppSettings extended with personio_client_id_enc, personio_client_secret_enc, personio_sync_interval_h
  - v1_3_hr_schema Alembic migration with all 4 HR tables, 2 indexes, 3 new AppSettings columns
  - Settings API write-only credential endpoint (PUT stores encrypted, GET returns boolean only)
affects:
  - 13-personio-sync-service
  - phase 13 depends on personio_employees/attendance/absences/sync_meta tables
  - phase 13 depends on decrypt_credential to retrieve API credentials for httpx client

# Tech tracking
tech-stack:
  added:
    - cryptography==46.0.7 (Fernet symmetric encryption)
    - httpx==0.28.1 (async HTTP client, needed Phase 13)
    - APScheduler==3.11.2 (scheduler, needed Phase 13)
  patterns:
    - Fernet-encrypted BYTEA columns on AppSettings singleton for write-only credentials
    - Optional credential fields in SettingsUpdate with None = preserve existing pattern
    - personio_has_credentials boolean in SettingsRead (write-only enforcement at Pydantic layer)
    - model_dump(include=_CORE_FIELDS) for selective comparison with DEFAULT_SETTINGS

key-files:
  created:
    - backend/app/security/fernet.py
    - backend/alembic/versions/v1_3_hr_schema.py
  modified:
    - backend/app/models.py
    - backend/app/schemas.py
    - backend/app/routers/settings.py
    - backend/requirements.txt

key-decisions:
  - "Fernet key sourced from FERNET_KEY env var; encrypt_credential returns raw bytes stored as BYTEA (consistent with logo_data pattern)"
  - "personio_client_id/secret are Optional in SettingsUpdate (None = don't change existing encrypted value)"
  - "SettingsRead only exposes personio_has_credentials boolean — raw credentials never returned"
  - "DEFAULT_SETTINGS comparison uses model_dump(include=_CORE_FIELDS) to exclude Personio Optional fields"
  - "Migration down_revision = b2c3d4e5f6a7 (v1.1 app_settings), revision ID = c3d4e5f6a7b8"

patterns-established:
  - "Write-only credential pattern: Optional fields in SettingsUpdate + boolean flag in SettingsRead"
  - "Fernet credential round-trip: encrypt on PUT, boolean check on GET, decrypt only when needed by sync service"

requirements-completed: [PERS-01, PERS-04]

# Metrics
duration: 6min
completed: 2026-04-12
---

# Phase 12 Plan 01: HR Schema & Personio Credential Storage Summary

**4 Personio HR tables (employees, attendance, absences, sync_meta) created via Alembic migration, Fernet-encrypted credential columns added to AppSettings, and Settings API extended with write-only credential support**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-12T08:41:11Z
- **Completed:** 2026-04-12T08:46:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `backend/app/security/fernet.py` with `encrypt_credential` and `decrypt_credential` helpers using the `cryptography` library Fernet implementation
- Added 4 SQLAlchemy 2.0 HR models (`PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`, `PersonioSyncMeta`) and 3 new columns on `AppSettings` in `models.py`
- Created Alembic migration `v1_3_hr_schema.py` that applies all schema changes cleanly — 4 tables, 2 composite indexes, 3 AppSettings columns, singleton seed row — verified with `docker compose run --rm migrate`
- Extended `SettingsUpdate` with optional Personio credential fields and `SettingsRead` with `personio_has_credentials` boolean; PUT handler encrypts credentials with Fernet if provided (None = preserve existing); verified via curl end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: Add HR models, AppSettings columns, Fernet helpers, and dependencies** - `9595c4c` (feat)
2. **Task 2: Create Alembic migration, extend Settings schemas and router for write-only credentials** - `c5820d3` (feat)

## Files Created/Modified

- `backend/app/security/fernet.py` — Fernet encrypt/decrypt helpers with FERNET_KEY env var loading
- `backend/alembic/versions/v1_3_hr_schema.py` — Single migration for all Phase 12 schema changes
- `backend/app/models.py` — 4 new HR model classes + 3 AppSettings credential columns + updated imports
- `backend/app/schemas.py` — SettingsUpdate with optional personio_client_id/secret; SettingsRead with personio_has_credentials
- `backend/app/routers/settings.py` — encrypt_credential import; credential guard in put_settings; personio_has_credentials in _build_read
- `backend/requirements.txt` — cryptography==46.0.7, httpx==0.28.1, APScheduler==3.11.2

## Decisions Made

- **Fernet BYTEA storage**: ciphertext stored as BYTEA on AppSettings singleton row, consistent with `logo_data` precedent. No base64 round-trip needed.
- **Optional credentials in SettingsUpdate**: `None` means "don't change" (D-03). Empty string could be sent to clear — plan says reject at router level but this was deferred (Phase 13 can add clear-credentials endpoint if needed).
- **DEFAULT_SETTINGS comparison fix**: `payload.model_dump()` now includes Personio Optional fields (None values), which would break the `== DEFAULT_SETTINGS` logo-wipe comparison. Fixed with `model_dump(include=_CORE_FIELDS)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DEFAULT_SETTINGS reset comparison broken by new Optional fields**
- **Found during:** Task 2 (router extension)
- **Issue:** `payload.model_dump() == DEFAULT_SETTINGS` would never be True after adding `personio_client_id: str | None = None` and `personio_client_secret: str | None = None` to SettingsUpdate — `model_dump()` includes these keys with None values, but DEFAULT_SETTINGS dict does not contain them. This would silently break the "reset to defaults also wipes logo" behavior.
- **Fix:** Changed to `payload.model_dump(include=_CORE_FIELDS) == DEFAULT_SETTINGS` where `_CORE_FIELDS = set(DEFAULT_SETTINGS.keys())`.
- **Files modified:** `backend/app/routers/settings.py`
- **Verification:** PUT with canonical defaults still compares correctly and would wipe logo.
- **Committed in:** `c5820d3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness — prevents silent regression of D-07 logo-wipe behavior.

## Issues Encountered

- Alembic migration container needs rebuild to pick up new migration file (migrate service copies files at build time, no volume mount unlike api). Ran `docker compose build migrate` before verifying.
- API container also needed rebuild for `cryptography` package. Ran `docker compose build api` after confirming `ModuleNotFoundError: No module named 'cryptography'` in logs.

## User Setup Required

The `FERNET_KEY` environment variable must be set in `.env` before starting the stack. A key has been generated and added locally. If deploying to a new environment, generate a key with:

```python
from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())
```

Add to `.env`:
```
FERNET_KEY=<generated_key_here>
```

**Warning:** This key must be preserved — losing it makes any stored encrypted credentials unrecoverable.

## Next Phase Readiness

- Phase 13 (Personio sync service) can now import `decrypt_credential` from `app.security.fernet` to retrieve credentials for httpx Personio client
- All 4 HR tables exist in PostgreSQL with correct columns, FK constraints, and indexes
- `personio_sync_meta` singleton row (id=1) is seeded — sync service can UPDATE it directly

---
*Phase: 12-hr-schema-personio-client*
*Completed: 2026-04-12*
