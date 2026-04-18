# Phase 12: HR Schema & Personio Client - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Database has HR tables (personio_employees, personio_attendances, personio_absences, personio_sync_meta) via Alembic migration, the app can authenticate with Personio via httpx and store credentials securely using Fernet encryption.

</domain>

<decisions>
## Implementation Decisions

### Credential Storage
- **D-01:** Personio client_id and client_secret are encrypted at rest using Fernet symmetric encryption (`cryptography` library)
- **D-02:** Encryption key sourced from environment variable (e.g. `ENCRYPTION_KEY` or `FERNET_KEY`)
- **D-03:** Write-only enforced at the API layer — credentials never included in GET /api/settings responses (per PERS-01)
- **D-04:** Encrypted values stored as columns on the existing AppSettings singleton row

### HR Table Design
- **D-05:** All models remain in a single `models.py` file (no package split)
- **D-06:** Typed columns for all fields needed by KPI calculations (employee_id, department, hire_date, termination_date, hours, etc.)
- **D-07:** Additional `raw_json` JSONB column on each Personio table preserving the full API response for future use
- **D-08:** Tables: personio_employees, personio_attendances, personio_absences, personio_sync_meta (per research ARCHITECTURE.md)

### Personio Client Error Handling
- **D-09:** Custom exception hierarchy — `PersonioAuthError`, `PersonioRateLimitError`, `PersonioNetworkError`, `PersonioAPIError` (base)
- **D-10:** Specific, user-facing error messages — "Invalid credentials", "Rate limited, retry in Xs", "Personio unreachable (timeout)" — helps users self-diagnose
- **D-11:** Routers catch Personio exceptions and map to appropriate HTTP status codes

### Token Lifecycle
- **D-12:** Bearer token cached in-memory on the client instance (not persisted to DB)
- **D-13:** Proactive token refresh — check TTL before each request, re-authenticate if <60s remaining
- **D-14:** Token lost on container restart; re-authentication is a single cheap HTTP call

### Claude's Discretion
- Exact JSONB column naming and typed column selection for each HR table
- Exception class file location (inline in client module or separate exceptions module)
- Fernet key env var naming convention

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Codebase
- `backend/app/models.py` — Current model definitions (AppSettings singleton pattern, BYTEA usage for logo)
- `backend/app/routers/settings.py` — Settings API pattern (GET/PUT on singleton, write-only logo pattern)
- `backend/app/database.py` — Async engine setup, session factory, Base class
- `backend/app/schemas.py` — Pydantic response/request models pattern
- `backend/alembic/versions/` — Existing migration history (4 migrations so far)

### Project Research
- `.planning/research/ARCHITECTURE.md` — System architecture with HR tables, Personio client, and scheduler design
- `.planning/research/PITFALLS.md` — Known pitfalls for Personio integration
- `.planning/research/STACK.md` — Technology decisions and versions

### Requirements
- `.planning/REQUIREMENTS.md` §Personio Integration — PERS-01, PERS-04 (this phase's requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppSettings` singleton pattern (id=1, CHECK constraint) — extend with Personio credential columns
- `get_async_db_session` dependency — reuse for all HR data access
- Alembic migration infrastructure — already configured with async-compatible setup
- `BYTEA` column type already imported and used (logo_data) — precedent for binary storage

### Established Patterns
- SQLAlchemy 2.0 `Mapped[]` + `mapped_column()` style (no legacy patterns)
- Pydantic v2 schemas with `model_config = {"from_attributes": True}`
- Router modules in `app/routers/` with `APIRouter(prefix="/api/...")`
- Service modules in `app/services/` for business logic

### Integration Points
- `AppSettings` model — add personio_client_id_encrypted, personio_client_secret_encrypted columns
- `requirements.txt` — add `cryptography` and `httpx` dependencies
- `docker-compose.yml` — add `FERNET_KEY` environment variable
- Alembic migration — new migration file for HR tables + AppSettings columns

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Fernet implementation and httpx client design.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-hr-schema-personio-client*
*Context gathered: 2026-04-12*
