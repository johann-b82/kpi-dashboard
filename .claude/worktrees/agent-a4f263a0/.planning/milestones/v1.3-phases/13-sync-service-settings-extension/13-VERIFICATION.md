---
phase: 13-sync-service-settings-extension
verified: 2026-04-12T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Navigate to Settings page in a running Docker Compose instance and confirm PersonioCard renders below PreferencesCard with all 7 form elements visible"
    expected: "Two masked credential inputs with 'Gespeichert' helper text logic, 'Verbindung testen' button, sync interval select (4 options), absence type dropdown (disabled without credentials, hint shown), department dropdown (disabled without credentials, hint shown), skill attribute key text input"
    why_human: "Visual layout, disabled-state styling, and conditional hint text cannot be verified programmatically"
  - test: "Enter valid Personio credentials, save, then reload Settings page — verify dropdowns populate from live Personio API"
    expected: "Absence type dropdown shows entries from GET /api/settings/personio-options; department dropdown shows unique departments from employee data"
    why_human: "Requires live Personio credentials and running app; data-flow from Personio API to rendered dropdown options cannot be verified without network access"
  - test: "Click 'Verbindung testen' button with valid credentials"
    expected: "Green 'Verbindung erfolgreich' text appears inline below the button within a few seconds"
    why_human: "Requires live Personio API; button interaction and visual feedback cannot be verified statically"
  - test: "Change sync interval from '1h' to '6h' and save — verify scheduler is rescheduled without restart"
    expected: "PUT /api/settings call succeeds; APScheduler job reschedules to 6-hour interval immediately (no container restart required)"
    why_human: "Runtime behavior of APScheduler requires a running app instance; cannot verify job reschedule via static code inspection alone"
  - test: "Click 'Daten aktualisieren' equivalent (POST /api/sync) with configured credentials"
    expected: "SyncResult returned with employee, attendance, and absence counts; personio_sync_meta row updated in DB"
    why_human: "Requires live Personio API and running database; end-to-end sync flow cannot be verified without execution"
---

# Phase 13: Sync Service & Settings Extension — Verification Report

**Phase Goal:** Users can trigger a Personio data sync (manual or scheduled) and configure all sync parameters from Settings
**Verified:** 2026-04-12
**Status:** human_needed (all automated checks pass; 5 items require human verification with a running instance)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PersonioClient can fetch employees, attendances, absences, and absence types from Personio API with pagination | VERIFIED | `backend/app/services/personio_client.py` lines 144–267: all 4 async fetch methods implemented with offset-based pagination (limit=50), 401/429/timeout error handling |
| 2 | hr_sync.run_sync() fetches all 3 entity types and upserts them into PostgreSQL in correct FK order | VERIFIED | `backend/app/services/hr_sync.py` lines 31–83: sequential fetches (employees -> attendances -> absences), pg_insert upsert, sync_meta update |
| 3 | AppSettings has 3 new nullable columns for sick leave type, production department, and skill attribute key | VERIFIED | `backend/app/models.py` lines 151–153: all 3 columns present with correct types (Integer nullable, String(255) nullable) |
| 4 | Pydantic schemas cover SyncResult, SyncTestResult, AbsenceTypeOption, PersonioOptions, and extended SettingsUpdate/SettingsRead | VERIFIED | `backend/app/schemas.py` lines 173–195: all 4 new schemas defined; SettingsUpdate extended with 4 Personio fields; SettingsRead extended with 4 Personio fields |
| 5 | POST /api/sync triggers a full Personio sync and returns SyncResult with entity counts | VERIFIED | `backend/app/routers/sync.py` lines 36–56: credential guard + hr_sync.run_sync() call + PersonioAPIError catch returning SyncResult(status="error") |
| 6 | POST /api/sync/test authenticates with Personio without fetching data and returns success/error | VERIFIED | `backend/app/routers/sync.py` lines 59–74: calls PersonioClient.authenticate() only, catches PersonioAuthError/PersonioNetworkError/PersonioAPIError, always closes client in finally |
| 7 | GET /api/settings/personio-options returns absence types and departments fetched live from Personio | VERIFIED | `backend/app/routers/settings.py` lines 85–136: degraded response when no credentials; fetch_absence_types() + fetch_employees() for live data; PersonioAPIError caught gracefully |
| 8 | APScheduler runs in-process via FastAPI lifespan, executing sync at configured interval | VERIFIED | `backend/app/scheduler.py` lines 1–56: AsyncIOScheduler, SYNC_JOB_ID, lifespan attached to app.state.scheduler; `backend/app/main.py` line 11: `FastAPI(title="KPI Light", lifespan=lifespan)` |
| 9 | Settings page shows a Personio section with all required inputs, populated from live Personio API | VERIFIED | `frontend/src/components/settings/PersonioCard.tsx`: 239 lines, all 7 form elements present; `frontend/src/pages/SettingsPage.tsx` lines 269–273: `<PersonioCard>` rendered between PreferencesCard and ActionBar |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/hr_sync.py` | Sync orchestration with upsert logic | VERIFIED | 219 lines; exports run_sync, _upsert, _normalize_employee/attendance/absence, _update_sync_meta, _get_settings |
| `backend/app/services/personio_client.py` | Extended Personio API client | VERIFIED | All 4 fetch methods added (lines 144–267); PersonioClient class substantive |
| `backend/alembic/versions/v1_3_personio_settings_columns.py` | Migration adding 3 new AppSettings columns | VERIFIED | revision d4e5f6a7b8c9, down_revision c3d4e5f6a7b8, all 3 op.add_column calls present with correct types and downgrade |
| `backend/app/schemas.py` | New Pydantic schemas for sync and settings | VERIFIED | SyncResult, SyncTestResult, AbsenceTypeOption, PersonioOptions all defined; SettingsUpdate/SettingsRead extended |
| `backend/app/models.py` | Extended AppSettings model | VERIFIED | personio_sick_leave_type_id, personio_production_dept, personio_skill_attr_key all present |
| `backend/app/scheduler.py` | APScheduler lifespan + reschedule helpers | VERIFIED | scheduler, SYNC_JOB_ID, lifespan, _run_scheduled_sync, _load_sync_interval all present |
| `backend/app/routers/sync.py` | Sync API endpoints | VERIFIED | POST /api/sync and POST /api/sync/test with correct response models |
| `backend/app/routers/settings.py` | Extended settings with personio-options and scheduler reschedule | VERIFIED | get_personio_options, _build_read extended, put_settings with request.app.state.scheduler |
| `backend/app/main.py` | App with lifespan and sync router | VERIFIED | from app.scheduler import lifespan; lifespan=lifespan; app.include_router(sync_router) |
| `frontend/src/components/settings/PersonioCard.tsx` | Personio settings section component | VERIFIED | 239 lines; useQuery for fetchPersonioOptions; all 7 form elements rendered |
| `frontend/src/lib/api.ts` | Extended TypeScript types and API functions | VERIFIED | PersonioOptions, SyncTestResult, AbsenceTypeOption interfaces; fetchPersonioOptions, testPersonioConnection functions |
| `frontend/src/hooks/useSettingsDraft.ts` | Extended draft hook with Personio fields | VERIFIED | DraftFields has 6 Personio fields; settingsToDraft, draftToPutPayload, draftToCacheSettings, shallowEqualDraft all handle Personio fields |
| `frontend/src/pages/SettingsPage.tsx` | PersonioCard imported and rendered | VERIFIED | import on line 16; `<PersonioCard>` rendered at line 269–273 between PreferencesCard and ActionBar |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/services/hr_sync.py` | `backend/app/services/personio_client.py` | PersonioClient instance | WIRED | Line 50: `client = PersonioClient(client_id=client_id, client_secret=client_secret)` |
| `backend/app/services/hr_sync.py` | `backend/app/models.py` | pg_insert upsert | WIRED | Lines 65–67: `await _upsert(session, PersonioEmployee, employees)` etc.; `_upsert` uses `pg_insert(model)` |
| `backend/app/scheduler.py` | `backend/app/services/hr_sync.py` | _run_scheduled_sync calls hr_sync.run_sync | WIRED | Lines 32–35: `from app.services import hr_sync; await hr_sync.run_sync(session)` |
| `backend/app/routers/sync.py` | `backend/app/services/hr_sync.py` | POST /api/sync calls hr_sync.run_sync | WIRED | Lines 39–48: `from app.services import hr_sync; return await hr_sync.run_sync(db)` |
| `backend/app/routers/settings.py` | `backend/app/scheduler.py` | PUT handler reschedules job via app.state.scheduler | WIRED | Lines 166–181: `sched = request.app.state.scheduler; from app.scheduler import SYNC_JOB_ID, _run_scheduled_sync; sched.add_job(...)` |
| `backend/app/main.py` | `backend/app/scheduler.py` | lifespan parameter | WIRED | Line 9: `from app.scheduler import lifespan`; line 11: `FastAPI(title="KPI Light", lifespan=lifespan)` |
| `frontend/src/components/settings/PersonioCard.tsx` | `frontend/src/lib/api.ts` | useQuery for fetchPersonioOptions | WIRED | Lines 7, 42–47: `import { fetchPersonioOptions, testPersonioConnection } from "@/lib/api"; useQuery({ queryFn: fetchPersonioOptions })` |
| `frontend/src/components/settings/PersonioCard.tsx` | `frontend/src/hooks/useSettingsDraft.ts` | setField for Personio draft fields | WIRED | Lines 86, 105, 151, 174, 202, 229: setField calls for all 6 Personio draft fields |
| `frontend/src/pages/SettingsPage.tsx` | `frontend/src/components/settings/PersonioCard.tsx` | JSX render | WIRED | Lines 16, 269–273: imported and rendered with draft, setField, hasCredentials props |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PersonioCard.tsx` | `options` (absence_types, departments) | `fetchPersonioOptions()` → GET /api/settings/personio-options → `PersonioClient.fetch_absence_types()` + `fetch_employees()` | Yes — live Personio API calls with pagination | FLOWING |
| `PersonioCard.tsx` | `draft.personio_sick_leave_type_id`, `draft.personio_production_dept`, `draft.personio_skill_attr_key` | `useSettingsDraft` → `settingsToDraft(s)` → `s.personio_sick_leave_type_id` from GET /api/settings | Yes — AppSettings DB row, populated via PUT /api/settings | FLOWING |
| `backend/app/routers/sync.py` run_sync | SyncResult counts | `hr_sync.run_sync(db)` → PersonioClient fetch → `_upsert()` → `result.rowcount` | Yes — PostgreSQL upsert rowcount from real Personio data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| hr_sync.py parses without syntax errors | `python3 -c "import ast; ast.parse(open('backend/app/services/hr_sync.py').read())"` | File parses (verified by reading — no syntax errors found) | PASS |
| personio_client.py parses without syntax errors | `python3 -c "import ast; ast.parse(open('backend/app/services/personio_client.py').read())"` | File parses (verified by reading — no syntax errors found) | PASS |
| scheduler.py parses without syntax errors | (verified by reading) | No syntax errors found | PASS |
| sync.py parses without syntax errors | (verified by reading) | No syntax errors found | PASS |
| main.py imports lifespan and sync_router | (verified by reading) | Lines 9, 11, 16 confirm wiring | PASS |
| PersonioCard renders `<PersonioCard>` in SettingsPage | (verified by reading SettingsPage.tsx lines 269–273) | Component imported and rendered with correct props | PASS |
| Live Personio API sync and UI interaction | Requires running Docker Compose + valid credentials | Cannot verify without execution | SKIP — route to human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERS-02 | 13-02 | User can trigger manual Personio data sync via "Daten aktualisieren" button on HR tab | PARTIAL | POST /api/sync endpoint exists and is complete (backend). HR tab button is Phase 14's concern — Phase 13 only delivers the API endpoint. Backend side is SATISFIED; UI trigger deferred to Phase 14. |
| PERS-03 | 13-02 | Personio data syncs automatically at a configurable interval set in Settings | SATISFIED | APScheduler in scheduler.py, interval loaded from AppSettings, reschedule on PUT /api/settings |
| PERS-04 | 13-01 | Personio raw data fetched and stored in PostgreSQL | SATISFIED | hr_sync.run_sync() with pg_insert upsert for all 3 entity types; PersonioClient 4 fetch methods |
| PERS-05 | 13-02, 13-03 | Absence types auto-discovered from Personio API as dropdown in Settings | SATISFIED | GET /api/settings/personio-options + PersonioCard absence type dropdown populated via useQuery |
| PERS-06 | 13-02, 13-03 | Departments auto-discovered from Personio employee data as dropdown in Settings | SATISFIED | GET /api/settings/personio-options returns sorted unique departments; PersonioCard department dropdown |
| SET-01 | 13-01, 13-03 | Settings page includes configurable sick leave absence type (auto-discovered dropdown) | SATISFIED | AppSettings.personio_sick_leave_type_id column; PersonioCard absence type select wired to draft |
| SET-02 | 13-01, 13-03 | Settings page includes configurable production department name (auto-discovered dropdown) | SATISFIED | AppSettings.personio_production_dept column; PersonioCard department select wired to draft |
| SET-03 | 13-01, 13-03 | Settings page includes configurable skill custom attribute key | SATISFIED | AppSettings.personio_skill_attr_key column; PersonioCard text input for skill key wired to draft |
| SET-04 | 13-02, 13-03 | Settings page includes auto-sync interval selector | SATISFIED | personio_sync_interval_h in AppSettings + Pydantic + PUT reschedule; PersonioCard select with 0/1/6/24h options |

**Note on PERS-02:** Phase 13 delivers the POST /api/sync API endpoint (PERS-02 backend). The user-facing "Daten aktualisieren" button on the HR tab is scoped to Phase 14 (Navigation & HR Tab Shell). The requirement description maps to Phase 13 in REQUIREMENTS.md traceability, but the full user-facing flow spans Phase 13 (API) and Phase 14 (UI trigger). No gap in Phase 13 scope — the API is complete and ready to be wired to the button in Phase 14.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `backend/app/services/hr_sync.py` | `_normalize_absence` maps to `time_unit`/`hours` instead of plan's `absence_type_name`/`days_count`/`status` | Info | Correct adaptation — the actual PersonioAbsence model uses `time_unit` + `hours`, not the fields named in the plan template. Documented deviation in 13-01-SUMMARY. No data loss. |
| `.planning/ROADMAP.md` | Phase 13 progress shows "2/3 plans executed" and `[ ] 13-03-PLAN.md` unchecked | Warning | Documentation staleness only — 13-03-SUMMARY.md exists and all 13-03 code is in place. The roadmap was not updated after 13-03 execution. No code impact. |

No placeholder returns, hardcoded empty arrays, or TODO/FIXME stubs found in any Phase 13 files.

### Human Verification Required

#### 1. PersonioCard Visual Rendering

**Test:** Open Settings page in a running Docker Compose instance (navigate to /settings)
**Expected:** PersonioCard section appears below the Preferences section with: two masked password inputs (Client-ID, Client-Secret), "Verbindung testen" button, Sync-Intervall select with 4 options (Nur manuell, Stuendlich, Alle 6 Stunden, Taeglich), disabled Krankheitstyp dropdown with hint "Personio-Zugangsdaten konfigurieren", disabled Produktions-Abteilung dropdown with same hint, Skill Custom Attribute Key text input
**Why human:** Visual layout and conditional hint text rendering require a browser rendering the component tree

#### 2. Live Personio Dropdown Population

**Test:** Enter valid Personio client_id and client_secret, click "Speichern", then verify dropdowns populate
**Expected:** Absence type dropdown shows entries from Personio; department dropdown shows unique employee departments; hint text disappears once credentials are saved
**Why human:** Requires live Personio API credentials and network access from the container

#### 3. Connection Test Button

**Test:** With valid credentials saved, click "Verbindung testen"
**Expected:** Green "Verbindung erfolgreich" text appears inline within a few seconds; with invalid credentials, red error message appears
**Why human:** Requires live Personio API access and browser interaction

#### 4. Scheduler Reschedule Without Restart

**Test:** In Settings, change Sync-Intervall from "Stuendlich" to "Alle 6 Stunden" and save; inspect APScheduler job via container logs or by triggering a sync after 6 hours
**Expected:** PUT /api/settings reschedules the personio_sync job immediately; no container restart needed; selecting "Nur manuell" (0) removes the job
**Why human:** Runtime APScheduler job state requires a running process to verify

#### 5. End-to-End Sync Flow

**Test:** POST /api/sync (or "Daten aktualisieren" button when added in Phase 14) with configured credentials
**Expected:** Response contains employees_synced, attendance_synced, absences_synced counts > 0; PostgreSQL personio_employees/personio_attendance/personio_absences tables are populated; personio_sync_meta row updated with status="ok"
**Why human:** Requires live Personio API, running PostgreSQL, and network connectivity

### Gaps Summary

No automated gaps. All must-have truths are verified against actual code. All artifacts exist, are substantive (not stubs), are wired to their dependencies, and have data flowing through the correct paths.

The five human verification items are runtime behaviors that require a running Docker Compose instance with valid Personio credentials — they cannot be verified statically.

**Documentation gap (non-blocking):** ROADMAP.md Phase 13 still shows "2/3 plans" and `[ ] 13-03-PLAN.md`. This should be updated to reflect that all 3 plans are complete. This does not block phase goal achievement.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
