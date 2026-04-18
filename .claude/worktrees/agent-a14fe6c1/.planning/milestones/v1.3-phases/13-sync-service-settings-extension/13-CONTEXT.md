# Phase 13: Sync Service & Settings Extension - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend sync service that fetches Personio data (employees, attendances, absences) into PostgreSQL via upsert, APScheduler-based auto-sync with configurable interval, and Settings page Personio section with auto-discovered dropdowns and credential test button. No HR tab UI — that's Phase 14.

</domain>

<decisions>
## Implementation Decisions

### Sync Execution Model
- **D-01:** Manual sync is a blocking POST /api/sync — request blocks until all entities are fetched and stored, returns summary counts
- **D-02:** Response payload: `{employees_synced: N, attendance_synced: N, absences_synced: N, status: "ok"|"error", error_message?}` — counts only, no change details
- **D-03:** Upsert by Personio ID — `INSERT ... ON CONFLICT (id) DO UPDATE` for each entity type. No full replace, no soft-delete
- **D-04:** Sync results are persisted to `personio_sync_meta` singleton (already created in Phase 12)

### APScheduler Integration
- **D-05:** APScheduler runs in-process under FastAPI lifespan — in-memory job store, no persistent store (per Out of Scope)
- **D-06:** Interval change takes effect immediately — when PUT /api/settings changes sync interval, reschedule the APScheduler job without requiring restart
- **D-07:** "manual-only" interval option disables automatic syncing (removes scheduled job)

### Auto-Discovery
- **D-08:** Absence types and departments are fetched live from Personio on each Settings page load — GET /api/settings/personio-options endpoint
- **D-09:** No caching layer — always fresh from Personio API. Adds ~1s latency to Settings load when credentials are configured
- **D-10:** When credentials are not configured or API call fails: dropdowns are disabled/greyed out with hint text ("Personio-Zugangsdaten konfigurieren" or inline error message)

### Settings Page Layout
- **D-11:** Separate "Personio" section below existing branding section with its own heading — visually distinct grouping
- **D-12:** Section is always visible (not collapsible) — Settings page is not long enough to warrant accordion
- **D-13:** Single shared "Speichern" button for the whole form — consistent with existing single-form UX pattern
- **D-14:** Personio section includes: credentials (client_id, client_secret as masked inputs), sync interval selector, sick-leave absence type dropdown, production department dropdown, skill custom attribute key field

### Phase Boundary
- **D-15:** Phase 13 is backend-only + Settings page UI. No HR tab, no sync button on HR tab. The "Daten aktualisieren" button lives on the HR tab built in Phase 14
- **D-16:** Phase 13 is testable via API calls (POST /api/sync, GET /api/settings/personio-options) and Settings page Personio section
- **D-17:** Settings page includes a "Verbindung testen" button — calls POST /api/sync/test which authenticates with Personio without syncing data. Immediate feedback on credential validity

### Claude's Discretion
- Exact APScheduler setup pattern within FastAPI lifespan (startup/shutdown hooks)
- PersonioClient method additions for fetching employees, attendances, absences (extend existing client from Phase 12)
- Sync service internal structure (single function vs service class)
- Personio API pagination handling (if API returns paginated results)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 Artifacts (Foundation)
- `.planning/phases/12-hr-schema-personio-client/12-CONTEXT.md` — Phase 12 decisions (D-01 through D-14) on credential storage, HR table design, exception hierarchy, token lifecycle
- `.planning/phases/12-hr-schema-personio-client/12-01-SUMMARY.md` — What was built: models, Fernet helpers, migration, Settings API credential support
- `.planning/phases/12-hr-schema-personio-client/12-02-SUMMARY.md` — What was built: PersonioClient with authenticate(), exception hierarchy

### Existing Codebase
- `backend/app/services/personio_client.py` — PersonioClient class to extend with data-fetching methods
- `backend/app/models.py` — HR models (PersonioEmployee, PersonioAttendance, PersonioAbsence, PersonioSyncMeta) + AppSettings
- `backend/app/routers/settings.py` — Settings API to extend with personio-options endpoint and sync test
- `backend/app/schemas.py` — Pydantic schemas to extend with new Settings fields and sync response
- `backend/app/main.py` — FastAPI app to add lifespan for APScheduler
- `backend/app/security/fernet.py` — decrypt_credential needed to read stored credentials for sync

### Requirements
- `.planning/REQUIREMENTS.md` §Personio Integration — PERS-02, PERS-03, PERS-04, PERS-05, PERS-06
- `.planning/REQUIREMENTS.md` §Settings Extension — SET-01, SET-02, SET-03, SET-04

### Project Research
- `.planning/research/ARCHITECTURE.md` — System architecture with scheduler design
- `.planning/research/PITFALLS.md` — Known pitfalls for Personio integration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PersonioClient` (personio_client.py) — has authenticate() and _get_valid_token(); needs new methods for fetching employees/attendances/absences
- `AppSettings` singleton with `personio_client_id_enc`, `personio_client_secret_enc`, `personio_sync_interval_h` columns (Phase 12)
- `encrypt_credential` / `decrypt_credential` in security/fernet.py — needed to read stored credentials
- `_get_singleton()` helper in settings router — reusable for reading credentials
- `get_async_db_session` dependency — reuse for all sync data access
- HR models with raw_json JSONB columns — store full API response per D-07

### Established Patterns
- SQLAlchemy 2.0 `Mapped[]` + `mapped_column()` async sessions
- Pydantic v2 schemas with `model_config = {"from_attributes": True}`
- Router modules in `app/routers/` with `APIRouter(prefix="/api/...")`
- Service modules in `app/services/` for business logic
- Single shared PUT /api/settings for all settings changes (Optional fields, null = don't change)

### Integration Points
- `backend/app/main.py` — add FastAPI lifespan context manager for APScheduler startup/shutdown
- `backend/app/routers/` — new sync router (POST /api/sync, POST /api/sync/test)
- `backend/app/routers/settings.py` — new GET /api/settings/personio-options endpoint
- `backend/app/schemas.py` — add SyncResult, PersonioOptions, new Settings fields
- `backend/requirements.txt` — APScheduler already added in Phase 12
- Frontend Settings page — add Personio section with dropdowns, test button, interval selector

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for APScheduler integration and Personio API data fetching patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-sync-service-settings-extension*
*Context gathered: 2026-04-12*
