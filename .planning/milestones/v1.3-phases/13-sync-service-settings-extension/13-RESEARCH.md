# Phase 13: Sync Service & Settings Extension — Research

**Researched:** 2026-04-12
**Domain:** APScheduler 3.x + FastAPI lifespan, Personio API data-fetch extensions, PostgreSQL upsert, Settings UI extension
**Confidence:** HIGH (codebase inspected directly; APScheduler docs verified locally; Personio API patterns from prior ARCHITECTURE.md and PITFALLS.md research, HIGH confidence)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Manual sync is a blocking POST /api/sync — request blocks until all entities are fetched and stored, returns summary counts
- **D-02:** Response payload: `{employees_synced: N, attendance_synced: N, absences_synced: N, status: "ok"|"error", error_message?}` — counts only, no change details
- **D-03:** Upsert by Personio ID — `INSERT ... ON CONFLICT (id) DO UPDATE` for each entity type. No full replace, no soft-delete
- **D-04:** Sync results are persisted to `personio_sync_meta` singleton (already created in Phase 12)
- **D-05:** APScheduler runs in-process under FastAPI lifespan — in-memory job store, no persistent store
- **D-06:** Interval change takes effect immediately — when PUT /api/settings changes sync interval, reschedule the APScheduler job without requiring restart
- **D-07:** "manual-only" interval option disables automatic syncing (removes scheduled job)
- **D-08:** Absence types and departments are fetched live from Personio on each Settings page load — GET /api/settings/personio-options endpoint
- **D-09:** No caching layer — always fresh from Personio API. Adds ~1s latency to Settings load when credentials are configured
- **D-10:** When credentials are not configured or API call fails: dropdowns are disabled/greyed out with hint text
- **D-11:** Separate "Personio" section below existing branding section with its own heading — visually distinct grouping
- **D-12:** Section is always visible (not collapsible)
- **D-13:** Single shared "Speichern" button for the whole form — consistent with existing single-form UX pattern
- **D-14:** Personio section includes: credentials (client_id, client_secret as masked inputs), sync interval selector, sick-leave absence type dropdown, production department dropdown, skill custom attribute key field
- **D-15:** Phase 13 is backend-only + Settings page UI. No HR tab, no sync button on HR tab
- **D-16:** Phase 13 is testable via API calls (POST /api/sync, GET /api/settings/personio-options) and Settings page Personio section
- **D-17:** Settings page includes a "Verbindung testen" button — calls POST /api/sync/test which authenticates with Personio without syncing data

### Claude's Discretion

- Exact APScheduler setup pattern within FastAPI lifespan (startup/shutdown hooks)
- PersonioClient method additions for fetching employees, attendances, absences (extend existing client from Phase 12)
- Sync service internal structure (single function vs service class)
- Personio API pagination handling (if API returns paginated results)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-02 | User can trigger manual Personio data sync via "Daten aktualisieren" button on HR tab with success/error feedback | POST /api/sync blocking endpoint; D-01 locks this to synchronous; Phase 14 adds the button; Phase 13 provides the endpoint |
| PERS-03 | Personio data syncs automatically at a configurable interval (1h / 6h / 24h / manual-only) set in Settings | APScheduler AsyncIOScheduler via FastAPI lifespan; interval stored in `personio_sync_interval_h`; manual-only removes the job (D-07) |
| PERS-04 | Personio raw data (employees, attendances, absences) is fetched and stored in PostgreSQL | HR tables already exist from Phase 12; Phase 13 adds `hr_sync.py` with upsert logic; partially complete |
| PERS-05 | Absence types are auto-discovered from Personio API and presented as dropdown in Settings | GET /api/settings/personio-options fetches live from Personio; frontend renders disabled dropdown when creds missing |
| PERS-06 | Departments are auto-discovered from Personio employee data and presented as dropdown in Settings | Same endpoint as PERS-05; departments derived from employee list rather than a dedicated endpoint |
| SET-01 | Settings page includes configurable sick leave absence type (auto-discovered dropdown) | Frontend Settings Personio section; value stored in AppSettings (needs new column) |
| SET-02 | Settings page includes configurable production department name (auto-discovered dropdown) | Frontend Settings Personio section; value stored in AppSettings (needs new column) |
| SET-03 | Settings page includes configurable skill custom attribute key for KPI #4 | Plain text input field; stored in AppSettings (needs new column) |
| SET-04 | Settings page includes auto-sync interval selector (1h / 6h / 24h / manual-only) | `personio_sync_interval_h` already exists; frontend adds Select with 4 options; `0` or sentinel for manual-only |
</phase_requirements>

---

## Summary

Phase 13 is the largest backend phase of v1.3. It has three distinct subsystems that must be built in dependency order: (1) the sync service (`hr_sync.py`) that extends `PersonioClient` with data-fetching methods and performs upserts, (2) the APScheduler integration in `main.py` via lifespan that runs the sync on an interval, and (3) the Settings UI extension that adds the Personio section with credential inputs, live-discovered dropdowns, and the sync test button.

The codebase foundation is solid. Phase 12 delivered all four HR tables, the `personio_sync_meta` singleton, Fernet helpers, and `PersonioClient` with authentication. Phase 13 extends `PersonioClient` with three new methods (`fetch_employees`, `fetch_attendances`, `fetch_absences`), introduces `hr_sync.py` as the orchestration layer, creates `scheduler.py` with APScheduler setup, adds two new API routes (`/api/sync` router and `/api/settings/personio-options`), extends the AppSettings model with four new columns for user-configurable Personio fields, and extends the Settings page with a Personio card.

**Primary recommendation:** Build in this order — (1) new AppSettings columns + migration, (2) PersonioClient data-fetch methods, (3) hr_sync.py + upsert, (4) scheduler.py + lifespan wiring, (5) sync and settings-options API routers, (6) frontend Settings Personio section. Each step is independently verifiable before the next begins.

---

## Standard Stack

All dependencies are already installed. No new packages needed.

### Core (already in requirements.txt)

| Library | Version | Purpose | Why |
|---------|---------|---------|------|
| APScheduler | 3.11.2 | In-process interval job scheduling | Already installed in Phase 12; `AsyncIOScheduler` runs on FastAPI's event loop |
| httpx | 0.28.1 | Async HTTP client for Personio API | Already in `PersonioClient`; no additional setup |
| SQLAlchemy | 2.0.49 | Async ORM + PostgreSQL upsert | `insert().on_conflict_do_update()` from `sqlalchemy.dialects.postgresql` |
| cryptography | 46.0.7 | Fernet decrypt for stored credentials | `decrypt_credential()` in `app.security.fernet` — already built |
| FastAPI | 0.135.3 | Lifespan context manager, new routers | `@asynccontextmanager` lifespan pattern |

### No New Packages Required

All dependencies were pre-installed in Phase 12. Installation step is not needed.

---

## Architecture Patterns

### Recommended File Structure (Phase 13 additions)

```
backend/app/
├── routers/
│   ├── sync.py              # NEW: POST /api/sync, POST /api/sync/test
│   └── settings.py          # MODIFIED: + GET /api/settings/personio-options, + personio fields in PUT
├── services/
│   ├── personio_client.py   # MODIFIED: + fetch_employees(), fetch_attendances(), fetch_absences()
│   └── hr_sync.py           # NEW: orchestrates fetch -> normalize -> upsert cycle
├── scheduler.py             # NEW: AsyncIOScheduler + lifespan context manager
├── main.py                  # MODIFIED: lifespan, include sync router
├── models.py                # MODIFIED: AppSettings + 4 new columns
├── schemas.py               # MODIFIED: + SyncResult, PersonioOptions, new settings fields
alembic/versions/
└── XXXX_v1_3_personio_settings.py  # NEW: 4 new AppSettings columns
frontend/src/
├── pages/SettingsPage.tsx   # MODIFIED: + Personio section card
├── lib/api.ts               # MODIFIED: + PersonioOptions type, + fetchPersonioOptions(), + sync types
├── hooks/useSettingsDraft.ts # MODIFIED: + new fields in DraftFields
└── components/settings/
    └── PersonioCard.tsx     # NEW: Personio settings section card
```

### Pattern 1: APScheduler AsyncIOScheduler via FastAPI Lifespan

**What:** APScheduler 3.x `AsyncIOScheduler` starts on app startup and shuts down on app shutdown. The scheduler instance is attached to `app.state` so settings routes can call `reschedule_job`.

**Key constraint (from PITFALLS.md):** Single-worker Uvicorn only. The existing `docker-compose.yml` runs `uvicorn app.main:app` without `--workers N` — this is correct and must not be changed.

**Critical detail for manual-only mode (D-07):** When `personio_sync_interval_h` is 0 (or a sentinel value representing manual-only), do not add the job at startup. Use `scheduler.get_job("personio_sync")` to check and `scheduler.remove_job()` to remove.

```python
# backend/app/scheduler.py
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.scheduler = scheduler
    # Load interval from DB; skip job if manual-only (interval == 0)
    interval_h = await _load_sync_interval_from_db()
    if interval_h > 0:
        scheduler.add_job(
            _run_scheduled_sync,
            trigger="interval",
            hours=interval_h,
            id="personio_sync",
            replace_existing=True,
            max_instances=1,  # prevents overlap if sync runs long
        )
    scheduler.start()
    yield
    scheduler.shutdown()
```

**Scheduled job opens its own session (anti-pattern 4 from ARCHITECTURE.md):**

```python
# The job function — NOT using FastAPI Depends
async def _run_scheduled_sync():
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        await hr_sync.run_sync(session)
```

### Pattern 2: Settings Route — Reschedule on Interval Change (D-06)

**What:** PUT /api/settings now needs `Request` (to access `request.app.state.scheduler`). When `personio_sync_interval_h` changes, reschedule or remove the job immediately.

```python
@router.put("", response_model=SettingsRead)
async def put_settings(
    payload: SettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_async_db_session),
) -> SettingsRead:
    row = await _get_singleton(db)
    # ... existing logic ...

    # Interval change — reschedule APScheduler job immediately (D-06)
    if payload.personio_sync_interval_h is not None:
        row.personio_sync_interval_h = payload.personio_sync_interval_h
        scheduler = request.app.state.scheduler
        if payload.personio_sync_interval_h == 0:
            # manual-only: remove job (D-07)
            if scheduler.get_job("personio_sync"):
                scheduler.remove_job("personio_sync")
        else:
            scheduler.reschedule_job(
                "personio_sync",
                trigger="interval",
                hours=payload.personio_sync_interval_h,
            )
            # If job doesn't exist yet (first time enabling), add it
            # Use add_job with replace_existing=True to handle both cases

    await db.commit()
    await db.refresh(row)
    return _build_read(row)
```

**Note:** The current `put_settings` signature does not include `Request`. Adding it is required for scheduler access. Check existing tests — they use `client` fixture from conftest which runs through LifespanManager, so `app.state.scheduler` will be available.

### Pattern 3: PersonioClient Extension — Data Fetch Methods

**What:** Add three new async methods to `PersonioClient`. All use `_get_valid_token()` for auth, `limit=50` (max per Personio), and paginate via offset until the result count is less than `limit`.

**Personio API endpoints for Phase 13:**

| Entity | Endpoint | Version | Auth Header |
|--------|----------|---------|------------|
| Employees | `GET /v1/company/employees` | v1 | `Authorization: Bearer {token}` |
| Attendances | `GET /v1/company/attendances` | v1 (NOTE: v2 deprecated not until July 31, 2026 — use v1 for now per scope, flag for Phase 15) |
| Absence types | `GET /v1/company/absence-types` | v1 | Same |
| Absence periods | `GET /v1/company/absence-periods` | v1 | Same |

**Pagination pattern (all v1 list endpoints):**

```python
async def fetch_employees(self) -> list[dict]:
    token = await self._get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    offset = 0
    limit = 50
    while True:
        resp = await self._http.get(
            "/company/employees",
            headers=headers,
            params={"limit": limit, "offset": offset},
        )
        # handle 429 with retry_after, 401 with PersonioAuthError
        data = resp.json()["data"]
        results.extend(data)
        if len(data) < limit:
            break
        offset += limit
    return results
```

**For absence types (discovery, not paginated — typically < 20 types):**

```python
async def fetch_absence_types(self) -> list[dict]:
    token = await self._get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    resp = await self._http.get("/company/absence-types", headers=headers)
    resp.raise_for_status()
    return resp.json()["data"]
```

**Departments derived from employees — not a separate Personio endpoint.** Extract unique department values from the employee list:

```python
# In hr_sync.py or settings router:
employees = await client.fetch_employees()
departments = sorted({
    e["attributes"]["department"]["value"]
    for e in employees
    if e.get("attributes", {}).get("department", {}).get("value")
})
```

### Pattern 4: Upsert via `pg_insert().on_conflict_do_update()`

**What:** SQLAlchemy 2.0 PostgreSQL-specific insert with conflict resolution. Sequential upserts on the same `AsyncSession` — never concurrent (ARCHITECTURE.md anti-pattern 1).

```python
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models import PersonioEmployee

async def _upsert_employees(session: AsyncSession, rows: list[dict]) -> int:
    if not rows:
        return 0
    stmt = pg_insert(PersonioEmployee).values(rows)
    update_cols = {
        col: stmt.excluded[col]
        for col in ["first_name", "last_name", "status", "department",
                    "position", "hire_date", "termination_date",
                    "weekly_working_hours", "synced_at", "raw_json"]
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_=update_cols,
    )
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount  # rows affected (inserted + updated)
```

**Order matters:** Upsert employees FIRST, then attendances and absences (FK constraint on `employee_id`). If employees are not upserted first, attendance/absence records referencing new employee IDs will fail FK checks.

### Pattern 5: Sync Meta Persistence (D-04)

**What:** After each sync (scheduled or manual), UPDATE the `personio_sync_meta` singleton (id=1) with counts and status. The singleton row was seeded in Phase 12.

```python
from sqlalchemy import update
from app.models import PersonioSyncMeta
from datetime import datetime, timezone

stmt = (
    update(PersonioSyncMeta)
    .where(PersonioSyncMeta.id == 1)
    .values(
        last_synced_at=datetime.now(timezone.utc),
        last_sync_status="ok",
        last_sync_error=None,
        employees_synced=employees_count,
        attendance_synced=attendance_count,
        absences_synced=absences_count,
    )
)
await session.execute(stmt)
await session.commit()
```

### Pattern 6: New AppSettings Columns (Migration Required)

**What:** SET-01, SET-02, SET-03 require storing user-selected Personio configuration values. These four columns must be added to `AppSettings` via a new Alembic migration.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `personio_sick_leave_type_id` | `Integer` | Yes | SET-01: selected absence type ID |
| `personio_production_dept` | `String(255)` | Yes | SET-02: selected department name |
| `personio_skill_attr_key` | `String(255)` | Yes | SET-03: custom attribute key for skill KPI |

Note: `personio_sync_interval_h` already exists from Phase 12. No change needed there.

**The `manual-only` sentinel:** The existing `personio_sync_interval_h` is `INTEGER NOT NULL DEFAULT 1`. To represent manual-only, use `0` as the sentinel value. The scheduler treats `interval_h == 0` as "no job". Frontend sends 0 for "manual-only" option. Validate in Pydantic: `Literal[0, 1, 6, 24]` or `int` with constraint `>= 0`.

### Pattern 7: GET /api/settings/personio-options

**What:** Fetches absence types and departments live from Personio. Returns both in one response to minimize Settings page load latency (one network call instead of two).

**D-10:** Returns degraded response (not 500) when credentials missing or Personio unreachable:

```python
@router.get("/personio-options", response_model=PersonioOptions)
async def get_personio_options(
    db: AsyncSession = Depends(get_async_db_session),
) -> PersonioOptions:
    row = await _get_singleton(db)
    if not (row.personio_client_id_enc and row.personio_client_secret_enc):
        return PersonioOptions(
            absence_types=[],
            departments=[],
            error="Personio-Zugangsdaten nicht konfiguriert",
        )
    try:
        client_id = decrypt_credential(row.personio_client_id_enc)
        client_secret = decrypt_credential(row.personio_client_secret_enc)
        client = PersonioClient(client_id=client_id, client_secret=client_secret)
        absence_types = await client.fetch_absence_types()
        employees = await client.fetch_employees()
        await client.close()
        departments = _extract_departments(employees)
        return PersonioOptions(
            absence_types=[{"id": t["id"], "name": t["attributes"]["name"]} for t in absence_types],
            departments=departments,
            error=None,
        )
    except PersonioAPIError as exc:
        return PersonioOptions(
            absence_types=[],
            departments=[],
            error=str(exc),
        )
```

**Response schema:**

```python
class AbsenceTypeOption(BaseModel):
    id: int
    name: str

class PersonioOptions(BaseModel):
    absence_types: list[AbsenceTypeOption]
    departments: list[str]
    error: str | None = None
```

### Pattern 8: POST /api/sync/test (D-17)

**What:** Authenticates with Personio (calls `client.authenticate()`) but does not fetch any data. Returns success/error immediately.

```python
@router.post("/test", response_model=SyncTestResult)
async def test_sync(db: AsyncSession = Depends(get_async_db_session)) -> SyncTestResult:
    row = await _get_singleton(db)
    if not (row.personio_client_id_enc and row.personio_client_secret_enc):
        raise HTTPException(422, "Personio-Zugangsdaten nicht konfiguriert")
    try:
        client_id = decrypt_credential(row.personio_client_id_enc)
        client_secret = decrypt_credential(row.personio_client_secret_enc)
        client = PersonioClient(client_id=client_id, client_secret=client_secret)
        await client.authenticate()
        await client.close()
        return SyncTestResult(success=True, error=None)
    except PersonioAuthError:
        return SyncTestResult(success=False, error="Ungültige Zugangsdaten")
    except PersonioNetworkError as exc:
        return SyncTestResult(success=False, error=f"Personio nicht erreichbar: {exc}")

class SyncTestResult(BaseModel):
    success: bool
    error: str | None = None
```

### Pattern 9: Frontend Settings — Personio Card Extension

**What:** The Settings page adds a new `PersonioCard` below the existing `PreferencesCard`. It follows the same `Card > CardHeader > CardContent` pattern already used.

**Key integration points in `useSettingsDraft.ts`:**

The draft hook currently manages 8 fields (all colors + `app_name` + `default_language`). Extending it with Personio fields is straightforward but requires care:
- `personio_client_id` and `personio_client_secret` are write-only inputs — they are NOT returned in `Settings` from `GET /api/settings` (only `personio_has_credentials: bool` is returned). The draft fields for credentials are local-only; they are only sent when the user has typed something.
- `personio_sync_interval_h` (number: 0, 1, 6, 24) — included in draft and sent in PUT
- `personio_sick_leave_type_id` (number | null) — included in draft and sent in PUT
- `personio_production_dept` (string | null) — included in draft and sent in PUT
- `personio_skill_attr_key` (string | null) — included in draft and sent in PUT

**D-13 (single "Speichern" button):** The existing `handleSave` → `save()` → `updateSettings(payload)` flow covers Personio fields automatically as long as `SettingsUpdatePayload` in `api.ts` and `draftToPutPayload()` in `useSettingsDraft.ts` include the new fields.

**Personio-options loading:** Use a separate `useQuery` in `PersonioCard.tsx` (not in the draft hook) — the options are not draft state, they are server state:

```typescript
const { data: personioOptions, isLoading: optionsLoading } =
  useQuery({
    queryKey: ["personio-options"],
    queryFn: fetchPersonioOptions,
    staleTime: 0,  // always fresh per D-09
  });
```

### Anti-Patterns to Avoid

- **Concurrent asyncio.gather on one session:** Upserts for employees, attendances, and absences must be sequential awaits on the same session — not `asyncio.gather`. (ARCHITECTURE.md anti-pattern 1, confirmed in existing `routers/kpis.py` comment)
- **Depends(get_async_db_session) in scheduler job:** The scheduled function runs outside FastAPI request lifecycle. Open `AsyncSessionLocal()` directly (ARCHITECTURE.md anti-pattern 4)
- **Returning credentials in API response:** `SettingsRead` already enforces `personio_has_credentials: bool` — do not add `personio_client_id` or `personio_client_secret` to `SettingsRead` or any new response schema
- **DELETE + INSERT on sync:** Always upsert. Attendances FK to employees — upsert employees first
- **Hardcoding "Krankheit" or "Produktion":** These come from user-configured Settings values, not code literals
- **reschedule_job when job doesn't exist:** Use `add_job(replace_existing=True)` to handle both add and reschedule. Or check `get_job()` first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interval job scheduling | Custom asyncio loop with sleep | `APScheduler 3.x AsyncIOScheduler` | Already installed; handles misfire, max_instances, graceful shutdown |
| PostgreSQL upsert | SELECT + UPDATE/INSERT in Python | `pg_insert().on_conflict_do_update()` | Atomic; no race condition; idiomatic SQLAlchemy 2.0 |
| Credential decryption | Custom crypto | `decrypt_credential()` from `app.security.fernet` | Already built and tested in Phase 12 |
| Settings dropdown data | Personio mock data or hardcoded lists | Live fetch via `PersonioClient.fetch_absence_types()` + extract departments from employees | Stays in sync with actual Personio configuration |

---

## Common Pitfalls

### Pitfall 1: `reschedule_job` Raises `JobLookupError` When Job Doesn't Exist

**What goes wrong:** When the user changes the interval from "manual-only" back to a timed option, `scheduler.reschedule_job("personio_sync", ...)` raises `JobLookupError` because the job was previously removed (D-07).

**How to avoid:** Use `scheduler.add_job(..., replace_existing=True)` for both cases — it adds if missing, replaces if existing. Reserve `reschedule_job` only for updates to an existing job. Or explicitly check `scheduler.get_job("personio_sync")` before calling `reschedule_job`.

### Pitfall 2: PUT /api/settings Missing `Request` Dependency

**What goes wrong:** The current `put_settings` signature is `async def put_settings(payload: SettingsUpdate, db: AsyncSession = Depends(...))`. Adding scheduler reschedule requires `request: Request` as a parameter. Forgetting to add it means `request.app.state.scheduler` is inaccessible and the interval change does not take effect.

**How to avoid:** Add `request: Request` as a parameter (FastAPI auto-injects it without a `Depends` decorator). Existing tests use LifespanManager so `app.state.scheduler` will be populated.

### Pitfall 3: FK Violation on Attendance/Absence Upsert

**What goes wrong:** Personio may return attendance or absence records for employee IDs not yet in `personio_employees`. If `hr_sync.run_sync()` upserts attendances before employees, the FK constraint `employee_id → personio_employees.id` fails.

**How to avoid:** Always execute in this order: (1) upsert employees, commit, (2) upsert attendances, commit, (3) upsert absences, commit. Never reverse this order.

### Pitfall 4: Personio Employee Data Shape — Attributes Are Nested

**What goes wrong:** The Personio v1 employees endpoint returns data in a nested `attributes` shape, not flat:
```json
{"id": 123, "type": "Employee", "attributes": {"first_name": {"value": "Jane"}, "department": {"value": "Engineering"}}}
```
Trying to access `employee["first_name"]` instead of `employee["attributes"]["first_name"]["value"]` produces `KeyError`.

**How to avoid:** Write a `_normalize_employee(raw: dict) -> dict` function in `hr_sync.py` that extracts the flat fields needed for the ORM model. Store `raw_json = raw` (full response) in the JSONB column for future use.

### Pitfall 5: `personio_sync_interval_h` Column Exists but `manual-only` Sentinel Is Undefined

**What goes wrong:** The existing column is `INTEGER NOT NULL DEFAULT 1`. There is no DB-level constraint on what values are valid. If the frontend sends `0` for manual-only but the backend checks `if interval_h != 0` to schedule, and the DB has `1` as default, a first-time save with manual-only selected might not be handled correctly on restart.

**How to avoid:** Treat `0` as the canonical manual-only sentinel. Add a Pydantic validator on `SettingsUpdate` that accepts only `Literal[0, 1, 6, 24]` for `personio_sync_interval_h`. On app startup in the lifespan, read the DB value and only add the job if the value is `> 0`.

### Pitfall 6: The `Settings` TypeScript Interface Is Stale

**What goes wrong:** `api.ts` has `Settings` interface and `SettingsUpdatePayload` interface that currently do not include any Personio fields. The `useSettingsDraft.ts` `DraftFields` also has no Personio fields. Adding new fields without updating all three causes TypeScript compilation errors and silent data drops (fields not sent to backend).

**How to avoid:** Update TypeScript interfaces in order: `Settings` (server response shape), `SettingsUpdatePayload` (PUT request shape), `DraftFields` (local draft state), `settingsToDraft()`, `draftToPutPayload()`, `shallowEqualDraft()`. The Settings interface must add `personio_has_credentials: boolean` (already exists in backend `SettingsRead` but not in frontend `Settings`).

### Pitfall 7: Absence Type Response Shape Varies by Personio Plan

**What goes wrong:** The Personio v1 `/company/absence-types` response structure may differ between Personio plans. Some plans return all fields; others omit optional fields. Using `resp.json()["data"][i]["attributes"]["name"]` without null guards crashes if the shape differs.

**How to avoid:** Wrap absence type extraction in a try/except. Log unexpected shapes and filter out malformed entries rather than crashing the entire options endpoint. Return partial data with a logged warning rather than raising.

---

## Code Examples

### hr_sync.py Structure

```python
# backend/app/services/hr_sync.py
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import update, select

from app.models import (
    AppSettings, PersonioEmployee, PersonioAttendance,
    PersonioAbsence, PersonioSyncMeta,
)
from app.security.fernet import decrypt_credential
from app.services.personio_client import PersonioClient, PersonioAPIError


class SyncResult:
    employees_synced: int
    attendance_synced: int
    absences_synced: int
    status: str  # "ok" | "error"
    error_message: str | None


async def run_sync(session: AsyncSession) -> SyncResult:
    """Fetch all Personio data and upsert into PostgreSQL.

    Session management is the caller's responsibility. For scheduled jobs,
    the caller opens AsyncSessionLocal() directly (not via FastAPI Depends).
    """
    # 1. Read credentials
    settings = await _get_settings(session)
    client_id = decrypt_credential(settings.personio_client_id_enc)
    client_secret = decrypt_credential(settings.personio_client_secret_enc)

    client = PersonioClient(client_id=client_id, client_secret=client_secret)
    try:
        # 2. Fetch (sequential — single token, avoid rate limit)
        raw_employees = await client.fetch_employees()
        raw_attendances = await client.fetch_attendances()
        raw_absences = await client.fetch_absences()

        # 3. Normalize + upsert (employees first — FK dependency)
        emp_rows = [_normalize_employee(e) for e in raw_employees]
        emp_count = await _upsert(session, PersonioEmployee, emp_rows)

        att_rows = [_normalize_attendance(a) for a in raw_attendances]
        att_count = await _upsert(session, PersonioAttendance, att_rows)

        abs_rows = [_normalize_absence(a) for a in raw_absences]
        abs_count = await _upsert(session, PersonioAbsence, abs_rows)

        # 4. Update sync meta
        await _update_sync_meta(session, emp_count, att_count, abs_count, status="ok")
        return SyncResult(employees_synced=emp_count, attendance_synced=att_count,
                          absences_synced=abs_count, status="ok", error_message=None)

    except PersonioAPIError as exc:
        await _update_sync_meta(session, 0, 0, 0, status="error", error=str(exc))
        raise
    finally:
        await client.close()
```

### scheduler.py

```python
# backend/app/scheduler.py
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import AppSettings

scheduler = AsyncIOScheduler()

SYNC_JOB_ID = "personio_sync"

async def _load_sync_interval() -> int:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AppSettings.personio_sync_interval_h).where(AppSettings.id == 1)
        )
        return result.scalar_one_or_none() or 0

async def _run_scheduled_sync():
    from app.services import hr_sync
    async with AsyncSessionLocal() as session:
        try:
            await hr_sync.run_sync(session)
        except Exception:
            pass  # sync meta already updated with error status

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.scheduler = scheduler
    interval_h = await _load_sync_interval()
    if interval_h > 0:
        scheduler.add_job(
            _run_scheduled_sync,
            trigger="interval",
            hours=interval_h,
            id=SYNC_JOB_ID,
            replace_existing=True,
            max_instances=1,
        )
    scheduler.start()
    yield
    scheduler.shutdown()
```

### main.py change

```python
# backend/app/main.py — modified
from app.scheduler import lifespan
from app.routers.sync import router as sync_router

app = FastAPI(title="KPI Light", lifespan=lifespan)
app.include_router(sync_router)
# ... existing routers unchanged ...
```

### Pydantic schemas to add

```python
# schemas.py additions

class SyncResult(BaseModel):
    employees_synced: int
    attendance_synced: int
    absences_synced: int
    status: Literal["ok", "error"]
    error_message: str | None = None

class SyncTestResult(BaseModel):
    success: bool
    error: str | None = None

class AbsenceTypeOption(BaseModel):
    id: int
    name: str

class PersonioOptions(BaseModel):
    absence_types: list[AbsenceTypeOption]
    departments: list[str]
    error: str | None = None

# SettingsUpdate additions (new optional fields):
#   personio_sync_interval_h: Literal[0, 1, 6, 24] | None = None
#   personio_sick_leave_type_id: int | None = None
#   personio_production_dept: str | None = None
#   personio_skill_attr_key: str | None = None

# SettingsRead additions:
#   personio_sync_interval_h: int = 1
#   personio_sick_leave_type_id: int | None = None
#   personio_production_dept: str | None = None
#   personio_skill_attr_key: str | None = None
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| APScheduler v4 with data store for in-process | APScheduler 3.x `AsyncIOScheduler` in-process | v4 requires event broker for multi-node; v3 is correct for single-process Docker |
| `scheduler.reschedule_job()` for add+update | `scheduler.add_job(replace_existing=True)` | Handles both first-add and update in one call |

---

## Open Questions

1. **Attendance date range for initial/incremental sync**
   - What we know: The Personio v1 attendance endpoint accepts `start_date`/`end_date` query params
   - What's unclear: Claude's discretion — no decision made on rolling window size
   - Recommendation: Use current year + previous year (Jan 1 of last year to today) for both initial and incremental sync at this MVP stage. Rolling window avoids full-history pagination. Revisit if sync times become excessive.

2. **Manual-only sentinel value representation**
   - What we know: `personio_sync_interval_h` is `INTEGER NOT NULL DEFAULT 1`
   - What's unclear: Whether `0` is acceptable at DB level (no CHECK constraint currently)
   - Recommendation: Use `0` as sentinel. No migration needed — the column is already nullable-free and 0 is a valid integer. Add `CHECK (personio_sync_interval_h >= 0)` in the new migration for clarity.

3. **Error handling when Personio is unreachable during Settings options load**
   - What we know: D-10 requires degraded response (disabled dropdowns + hint), not 500
   - What's unclear: Whether the frontend should retry options fetch after user saves credentials
   - Recommendation: Use TanStack Query with `staleTime: 0` and `retry: 1` on the personio-options query. After credential save, invalidate `["personio-options"]` query key so it refetches automatically.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| APScheduler | Scheduler integration | Yes | 3.11.2 (requirements.txt) | None needed |
| httpx | PersonioClient | Yes | 0.28.1 (requirements.txt) | None needed |
| SQLAlchemy pg_insert | Upsert pattern | Yes | 2.0.49 (requirements.txt) | None needed |
| cryptography / Fernet | Credential decrypt | Yes | 46.0.7 (requirements.txt) | None needed |
| Docker stack | Integration testing | Yes | Running (verified) | None needed |
| Personio API | Live testing | Unknown | — | Use mocked httpx in unit tests |

**Missing dependencies:** None. All required packages are installed.

**Personio API live access:** Not verified (no credentials in this environment). All unit tests must use mocked httpx responses (established pattern from Phase 12 `test_personio_client.py`).

---

## Project Constraints (from CLAUDE.md)

- **Docker Compose only:** All services run via `docker compose` (v2 syntax, no hyphen)
- **Single Uvicorn worker:** APScheduler in-process requires no `--workers N` flag — confirmed current `docker-compose.yml` does not use multi-worker
- **SQLAlchemy 2.0 async patterns:** Use `AsyncSession`, `create_async_engine`, `mapped_column()` — no legacy 1.x patterns
- **Alembic migrations mandatory:** Never use `Base.metadata.create_all()`. New AppSettings columns must come via a new migration file
- **PostgreSQL upsert:** Use `sqlalchemy.dialects.postgresql.insert` — not raw SQL strings
- **Pydantic v2:** Use `model_config = {"from_attributes": True}` on ORM-backed schemas
- **No `--reload` in Docker:** Production containers use plain `uvicorn app.main:app`
- **APScheduler==3.11.2 (not v4):** Already pinned. Do not upgrade — v4 has a different API (`asyncio` scheduler module path changed)
- **asyncio_mode = auto:** No `pytestmark = pytest.mark.asyncio` needed — `pytest.ini` handles it

---

## Sources

### Primary (HIGH confidence)
- `backend/app/services/personio_client.py` — existing PersonioClient implementation inspected directly
- `backend/app/models.py` — HR models and AppSettings columns verified directly
- `backend/app/routers/settings.py` — existing settings router verified directly
- `backend/app/main.py` — no lifespan yet, confirmed
- `backend/requirements.txt` — APScheduler==3.11.2, httpx==0.28.1 confirmed
- `.planning/research/ARCHITECTURE.md` — APScheduler lifespan pattern, upsert pattern, anti-patterns
- `.planning/research/PITFALLS.md` — duplicate job pitfall, FK ordering, credential security
- `python3 -c "from apscheduler.schedulers.asyncio import AsyncIOScheduler"` — import verified locally

### Secondary (MEDIUM confidence)
- `.planning/phases/12-hr-schema-personio-client/12-01-SUMMARY.md` — Phase 12 DB schema confirmed
- `.planning/phases/12-hr-schema-personio-client/12-02-SUMMARY.md` — PersonioClient exception hierarchy confirmed
- APScheduler 3.x docs (apscheduler.readthedocs.io/en/3.x) — `AsyncIOScheduler`, `add_job`, `reschedule_job`, `max_instances=1`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in requirements.txt + local import test
- Architecture: HIGH — patterns from ARCHITECTURE.md cross-verified with direct codebase inspection
- Pitfalls: HIGH — sourced from existing PITFALLS.md research + direct code review
- Frontend integration: HIGH — SettingsPage.tsx and useSettingsDraft.ts read directly

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack; APScheduler 3.x API is stable)
