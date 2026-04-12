# Architecture Research

**Domain:** HR KPI Dashboard with Personio API integration — extension to existing Sales KPI app
**Researched:** 2026-04-12
**Confidence:** HIGH (existing codebase inspected directly; Personio API verified via official docs + community sources)

---

## Standard Architecture

### System Overview

```
Browser (React 19 + Vite 8)
  NavBar (MODIFIED — add HR tab, rename Dashboard nav label to "Sales")
  Router (wouter)
    /        → SalesPage (DashboardPage — nav label renamed, file unchanged)
    /hr      → HrPage (NEW)
    /upload  → UploadPage (unchanged)
    /settings → SettingsPage (MODIFIED — add Personio credential fields)
  TanStack Query cache (hrKeys namespace NEW, kpiKeys namespace unchanged)
       |
       | fetch /api/*
       v
FastAPI (uvicorn, async)
  routers/kpis.py        (unchanged)
  routers/uploads.py     (unchanged)
  routers/settings.py    (MODIFIED — personio fields + scheduler reschedule)
  routers/hr.py          (NEW — /api/hr/kpis, /api/hr/sync)
       |
  services/
    kpi_aggregation.py   (unchanged)
    personio_client.py   (NEW — httpx AsyncClient, token cache)
    hr_sync.py           (NEW — fetch -> normalize -> upsert)
    hr_kpi.py            (NEW — SQL aggregations over HR tables)
       |
  scheduler.py           (NEW — APScheduler AsyncIOScheduler via lifespan)
       |
       | asyncpg / SQLAlchemy 2.0 async
       v
PostgreSQL 17
  upload_batches         (unchanged)
  sales_records          (unchanged)
  app_settings           (MODIFIED — +personio_client_id, +personio_client_secret,
                                     +personio_sync_interval_h, +personio_last_synced_at)
  personio_employees     (NEW)
  personio_attendance    (NEW)
  personio_absences      (NEW)
       ^
       | httpx HTTPS outbound from api container
Personio API v1 (external)
  POST /v1/auth
  GET  /v1/company/employees
  GET  /v1/company/attendances
  GET  /v1/company/absence-periods
```

---

## Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `routers/kpis.py` | Sales KPI aggregation endpoints | Unchanged |
| `routers/uploads.py` | File ingestion endpoints | Unchanged |
| `routers/settings.py` | App settings CRUD | Modified (+personio fields, +scheduler reschedule call) |
| `routers/hr.py` | HR KPI endpoints + manual sync trigger | New |
| `services/personio_client.py` | Personio auth + paginated data fetch via httpx | New |
| `services/hr_sync.py` | Orchestrates fetch -> normalize -> upsert cycle | New |
| `services/hr_kpi.py` | SQL aggregations for the 5 HR KPIs | New |
| `scheduler.py` | APScheduler AsyncIOScheduler, lifespan integration | New |
| `models.py` | SQLAlchemy ORM models | Modified (3 new table classes, AppSettings +4 cols) |
| `schemas.py` | Pydantic request/response models | Modified (HR types, SettingsUpdate/Read +personio fields) |
| `main.py` | FastAPI application entry | Modified (lifespan, include hr router) |
| `HrPage.tsx` | HR tab page: KPI cards + sync button | New |
| `HrKpiCard.tsx` | Simplified KPI card (no date-range filter) | New |
| `HrKpiCardGrid.tsx` | Lays out 5 HR KPI cards | New |
| `hrKeys.ts` | TanStack Query key factory for HR endpoints | New |
| `NavBar.tsx` | Navigation tabs | Modified (add HR tab, rename Dashboard->Sales) |
| `SettingsPage.tsx` | Settings form | Modified (Personio token + sync interval fields) |

---

## Recommended Project Structure

### Backend additions

```
backend/app/
├── routers/
│   ├── kpis.py              # unchanged
│   ├── uploads.py           # unchanged
│   ├── settings.py          # MODIFIED: personio fields + scheduler.reschedule_job
│   └── hr.py                # NEW: GET /api/hr/kpis, POST /api/hr/sync
├── services/
│   ├── kpi_aggregation.py   # unchanged
│   ├── personio_client.py   # NEW: auth + paginated fetch
│   ├── hr_sync.py           # NEW: full sync orchestration
│   └── hr_kpi.py            # NEW: SQL aggregations for 5 HR KPIs
├── models.py                # MODIFIED: 3 new table classes + AppSettings +4 cols
├── schemas.py               # MODIFIED: HR schemas + settings update
├── scheduler.py             # NEW: APScheduler setup + lifespan context manager
├── main.py                  # MODIFIED: lifespan, include hr router
└── database.py              # unchanged
alembic/versions/
└── XXXX_v1_3_hr_schema.py  # NEW migration (single file for all v1.3 schema changes)
```

### Frontend additions

```
frontend/src/
├── pages/
│   ├── DashboardPage.tsx    # file unchanged; NavBar label changes to "Sales"
│   └── HrPage.tsx           # NEW
├── components/
│   └── hr/
│       ├── HrKpiCard.tsx    # NEW
│       └── HrKpiCardGrid.tsx # NEW
├── lib/
│   ├── api.ts               # MODIFIED: add HR fetch functions
│   └── hrKeys.ts            # NEW: TanStack Query keys for /api/hr
└── locales/ (or i18n JSON files)
    ├── de.json              # MODIFIED: HR KPI labels + settings Personio fields
    └── en.json              # MODIFIED: same
```

---

## Personio API Integration

### Authentication Pattern

Personio v1 uses 2-step auth: POST `client_id` + `client_secret` to `https://api.personio.de/v1/auth`, receive a bearer token. The token is stable for 24 hours — it does not rotate on each call. Tokens begin with a `papi-` prefix.

**Recommended:** Cache token in-process with an `expires_at` timestamp. On each sync run, check whether token expires within the next 5 minutes; re-authenticate only then. Do NOT store the token in PostgreSQL — an in-process module-level dict on `app.state` is sufficient for a single-process Docker container.

```python
# services/personio_client.py — token cache pattern
import time, httpx

_token_cache: dict = {}

async def get_token(client_id: str, client_secret: str) -> str:
    now = time.monotonic()
    if _token_cache.get("token") and _token_cache.get("expires_at", 0) > now + 300:
        return _token_cache["token"]
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.personio.de/v1/auth",
            json={"client_id": client_id, "client_secret": client_secret},
        )
        r.raise_for_status()
        token = r.json()["data"]["token"]
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + 86400  # 24 h
    return token
```

### Personio Data Endpoints (v1)

| Endpoint | Key Fields | KPI Purpose |
|----------|-----------|-------------|
| `GET /v1/company/employees` | `id`, `first_name`, `last_name`, `status`, `department`, `position`, `hire_date`, `termination_date`, `weekly_working_hours` | Employee count, turnover, Produktions-MA filter |
| `GET /v1/company/attendances` | `employee_id`, `date`, `start_time`, `end_time`, `break` (minutes), `is_holiday` | Total hours, overtime |
| `GET /v1/company/absence-periods` | `employee_id`, `start_date`, `end_date`, `absence_type_id`, `time_unit`, `hours`/`days` | Sick leave hours |

All three endpoints are paginated via `offset` + `limit`. Attendance and absence endpoints accept `start_date`/`end_date` query params for scoped fetches. Employee fields must be whitelisted in the Personio API credential wizard.

### Personio Rate Limits

Rate limits are not publicly documented but are enforced. Strategy: process endpoints sequentially (employees → attendances → absences) with no parallelism. The sync job runs infrequently (default 1 h), so throughput is not a concern at internal scale.

---

## Data Models (New Tables)

### `personio_employees`

```
id                   INTEGER PK  -- Personio native ID; no autoincrement
first_name           VARCHAR(255)
last_name            VARCHAR(255)
status               VARCHAR(50)       -- "active" | "inactive"
department           VARCHAR(255) NULLABLE
position             VARCHAR(255) NULLABLE
hire_date            DATE NULLABLE
termination_date     DATE NULLABLE
weekly_working_hours NUMERIC(5,2) NULLABLE
synced_at            TIMESTAMPTZ NOT NULL
```

Use Personio's native `id` as PK (no surrogate). This makes upsert trivial: `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`.

### `personio_attendance`

```
id             INTEGER PK  -- Personio attendance record ID
employee_id    INTEGER NOT NULL REFERENCES personio_employees(id)
date           DATE NOT NULL
start_time     TIME NOT NULL
end_time       TIME NOT NULL
break_minutes  INTEGER NOT NULL DEFAULT 0
is_holiday     BOOLEAN NOT NULL DEFAULT false
synced_at      TIMESTAMPTZ NOT NULL

INDEX: (employee_id, date)
```

### `personio_absences`

```
id              INTEGER PK  -- Personio absence period ID
employee_id     INTEGER NOT NULL REFERENCES personio_employees(id)
absence_type_id INTEGER NOT NULL
start_date      DATE NOT NULL
end_date        DATE NOT NULL
time_unit       VARCHAR(10) NOT NULL  -- "hours" | "days"
hours           NUMERIC(8,2) NULLABLE
synced_at       TIMESTAMPTZ NOT NULL

INDEX: (employee_id, start_date, absence_type_id)
```

### `app_settings` additions (existing table)

```
personio_client_id        VARCHAR(255) NULLABLE
personio_client_secret    VARCHAR(255) NULLABLE
personio_sync_interval_h  INTEGER NOT NULL DEFAULT 1  -- 1 to 168 (1 week)
personio_last_synced_at   TIMESTAMPTZ NULLABLE
```

**Why extend `app_settings` instead of a new table:** The singleton pattern is established and tested. A second Personio settings table would require a second singleton CHECK constraint and a second API endpoint with no benefit.

**Security posture:** `personio_client_secret` stored as plaintext in PostgreSQL — same posture as an env var, acceptable for internal-only v1.3. Add a TODO for v2 to move secrets to Authentik/Vault.

---

## HR KPI Calculation Architecture

All 5 KPIs computed in SQL via `services/hr_kpi.py`, following the same isolation pattern as `kpi_aggregation.py`:

| KPI | Tables | Calculation |
|-----|--------|-------------|
| Überstunden vs. Gesamtstunden | `personio_attendance`, `personio_employees` | `SUM(end_time - start_time - break_minutes)` vs. `weekly_working_hours x weeks_in_period` |
| Krankheit vs. Gesamtstunden | `personio_absences` (sick type), `personio_attendance` | Sick absence hours / total worked hours |
| Fluktuation | `personio_employees` | Employees with `termination_date` in period / total active employees |
| MA-Entwicklung | `personio_employees` custom attribute | Count with new skill — requires specific custom field whitelisted in Personio; flag as config-dependent |
| Produktions-Mitarbeiterumsatz | `personio_employees` + `sales_records` | `SUM(sales_records.total_value)` / `COUNT(personio_employees WHERE department='Produktion')` |

The Produktions-Mitarbeiterumsatz KPI crosses the two data pipelines (upload-driven sales data + sync-driven HR data). No foreign key between `sales_records` and `personio_employees`. The join happens only in the aggregation SQL — no schema coupling between the two pipelines.

---

## Architectural Patterns

### Pattern 1: Upsert-Based Sync (No Soft Delete)

**What:** On each sync run, fetch data from Personio for a rolling window and `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`. Do not hard-delete records that disappear from Personio — track termination via `termination_date`.

**When to use:** Personio is append-heavy; hard deletes are rare. Upsert is idempotent and safe for partial syncs.

**Trade-off:** Stale records from truly deleted Personio entries accumulate over time. Acceptable for v1.3 — KPI queries already filter on `status = 'active'` and date ranges.

```python
# hr_sync.py — upsert pattern
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(PersonioEmployee).values(rows)
stmt = stmt.on_conflict_do_update(
    index_elements=["id"],
    set_={col: stmt.excluded[col] for col in update_cols},
)
await session.execute(stmt)
await session.commit()
```

### Pattern 2: APScheduler AsyncIOScheduler via FastAPI Lifespan

**What:** APScheduler 3.x `AsyncIOScheduler` runs in the same asyncio event loop as FastAPI. The scheduler instance is attached to `app.state` so routes can call `reschedule_job`.

**When to use:** Single-process Docker container; no external job queue needed at this scale.

```python
# scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
from fastapi import FastAPI

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.scheduler = scheduler
    interval_h = await _load_sync_interval()
    scheduler.add_job(
        hr_sync.run_sync,
        trigger="interval",
        hours=interval_h,
        id="personio_sync",
        replace_existing=True,
        max_instances=1,  # prevent overlap if sync runs long
    )
    scheduler.start()
    yield
    scheduler.shutdown()
```

```python
# main.py — modified
from app.scheduler import lifespan
app = FastAPI(title="KPI Light", lifespan=lifespan)
```

**Trade-off:** Scheduler resets on container restart (next run in `interval_h` hours). Acceptable for single internal host with low uptime requirements.

### Pattern 3: Manual Sync via Synchronous FastAPI Endpoint

**What:** `POST /api/hr/sync` calls `hr_sync.run_sync(db)` in the request body — no background task deferral.

**When to use:** "Daten aktualisieren" button. At internal scale (~20-50 employees), sync takes <10 s and completing before responding gives the user immediate feedback.

**Constraint:** If employee count grows, switch to `BackgroundTasks` + a `GET /api/hr/sync-status` polling endpoint. For v1.3, synchronous is correct.

```python
# routers/hr.py
@router.post("/sync", response_model=HrSyncResult)
async def trigger_sync(
    request: Request,
    db: AsyncSession = Depends(get_async_db_session),
):
    settings = await _get_settings(db)
    if not settings.personio_client_id:
        raise HTTPException(422, "Personio credentials not configured")
    result = await hr_sync.run_sync(db, settings)
    return result
```

### Pattern 4: Scheduler Reschedule on Settings Change

**What:** When the user saves a new `personio_sync_interval_h`, the settings PUT endpoint calls `request.app.state.scheduler.reschedule_job("personio_sync", trigger="interval", hours=new_interval)`.

**Why:** The interval must take effect immediately without a container restart.

```python
# routers/settings.py — modified PUT handler
@router.put("", response_model=SettingsRead)
async def put_settings(
    payload: SettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_async_db_session),
) -> SettingsRead:
    row = await _get_singleton(db)
    # ... update existing fields ...
    row.personio_sync_interval_h = payload.personio_sync_interval_h
    await db.commit()
    # Reschedule live
    scheduler = request.app.state.scheduler
    if scheduler.get_job("personio_sync"):
        scheduler.reschedule_job(
            "personio_sync",
            trigger="interval",
            hours=payload.personio_sync_interval_h,
        )
    return _build_read(row)
```

---

## Data Flow

### Scheduled / Manual Sync Flow

```
Scheduler trigger (interval) OR POST /api/hr/sync
    |
    v
hr_sync.run_sync(db)
    |
    v
Read personio_client_id + personio_client_secret from app_settings
    |
    v
personio_client.get_token(client_id, secret)  [24 h in-process cache]
    |
    v
personio_client.fetch_employees()         -> list[dict]
personio_client.fetch_attendances(...)    -> list[dict]  (rolling window)
personio_client.fetch_absences(...)       -> list[dict]  (rolling window)
    |
    v
Normalize dicts -> SQLAlchemy model value dicts
    |
    v
pg_insert().on_conflict_do_update()  x 3 tables  (sequential, same session)
    |
    v
UPDATE app_settings SET personio_last_synced_at = now()
    |
    v
Return HrSyncResult { employees_upserted, attendance_upserted, absences_upserted, synced_at }
```

### HR KPI Read Flow

```
GET /api/hr/kpis
    |
    v
hr_kpi.aggregate_hr_kpis(db)
    |
    v
SQL queries over personio_employees, personio_attendance, personio_absences
(Produktions-Mitarbeiterumsatz also joins sales_records)
    |
    v
HrKpiSummary { 5 KPI values, previous_period deltas }
    |
    v
TanStack Query (hrKeys.kpis) caches response
    |
    v
HrPage -> HrKpiCardGrid -> HrKpiCard x 5
```

### Settings Save Flow (with Personio fields)

```
User edits personio_client_id / personio_client_secret / personio_sync_interval_h
    |
    v
PUT /api/settings (extended payload)
    |
    v
SettingsUpdate validates: client_id (non-empty string or null),
  client_secret (non-empty string or null),
  personio_sync_interval_h (int, 1-168)
    |
    v
Update app_settings singleton row
    |
    v
request.app.state.scheduler.reschedule_job("personio_sync", hours=new_interval)
    |
    v
Return updated SettingsRead (client_secret masked — return boolean has_secret, not the value)
```

**Security note on client_secret response:** The `SettingsRead` schema should return `personio_has_secret: bool` (not the secret value) so the frontend can show "configured" vs "not configured" without exposing the credential.

---

## Integration Points: New vs. Modified vs. Unchanged

| Component | New | Modified | Unchanged |
|-----------|-----|----------|-----------|
| `models.py` | `PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence` classes | `AppSettings` (+4 cols) | `SalesRecord`, `UploadBatch` |
| `schemas.py` | `HrSyncResult`, `HrKpiSummary`, `HrKpiValue` | `SettingsUpdate`, `SettingsRead` (+personio fields) | All sales/upload schemas |
| `routers/hr.py` | Entire file | — | — |
| `routers/settings.py` | — | personio fields + scheduler reschedule | Logo, color, app_name logic |
| `routers/kpis.py` | — | — | Unchanged |
| `routers/uploads.py` | — | — | Unchanged |
| `services/personio_client.py` | Entire file | — | — |
| `services/hr_sync.py` | Entire file | — | — |
| `services/hr_kpi.py` | Entire file | — | — |
| `services/kpi_aggregation.py` | — | — | Unchanged |
| `scheduler.py` | Entire file | — | — |
| `main.py` | — | lifespan + include hr router | Health endpoint |
| `database.py` | — | — | Unchanged |
| Alembic migrations | 1 new migration file | — | 4 existing migrations |
| `NavBar.tsx` | — | Add HR tab; rename Dashboard -> Sales | Logo, settings, language |
| `App.tsx` | — | Add `/hr` route | Existing routes |
| `HrPage.tsx` | Entire file | — | — |
| `HrKpiCard.tsx` | Entire file | — | — |
| `HrKpiCardGrid.tsx` | Entire file | — | — |
| `api.ts` | — | Add HR fetch functions + Personio settings types | All existing functions |
| `hrKeys.ts` | Entire file | — | — |
| `SettingsPage.tsx` | — | Add Personio credential + sync interval fields | Color, logo, preferences |
| `de.json` / `en.json` | — | HR KPI labels + Personio settings labels | All existing keys |

---

## Build Order

Dependencies drive the order. Each step unblocks the next.

**Phase 1 — Database schema + migration (unblocks everything backend)**
Create the 3 new SQLAlchemy model classes (`PersonioEmployee`, `PersonioAttendance`, `PersonioAbsence`) and extend `AppSettings` with 4 personio columns. Write one Alembic migration that adds all 6 schema changes (3 tables + 4 columns). Run it.

Rationale: All other backend components depend on these tables. Schema first means API can be curl-tested before any frontend work begins. If schema needs adjustment it is cheap to add another migration.

**Phase 2 — Personio client service (unblocks sync and manual trigger)**
Implement `services/personio_client.py`: auth with 24 h in-process token cache, paginated fetch for all 3 endpoints. Write unit tests with mocked httpx responses (no real Personio account needed to test fetch logic).

Rationale: Pure I/O module with no FastAPI coupling — easiest to test in isolation. All other sync logic depends on this.

**Phase 3 — Sync service and upsert logic (unblocks scheduler and API endpoint)**
Implement `services/hr_sync.py`: call the client, normalize response dicts, run `pg_insert().on_conflict_do_update()` for all 3 tables, update `personio_last_synced_at`. Sequential awaits (not `asyncio.gather`) on the same AsyncSession.

Rationale: Requires Phase 1 schema and Phase 2 client. Can be integration-tested by running against a real DB with fixture data.

**Phase 4 — Scheduler integration (unblocks auto-sync)**
Implement `scheduler.py` with `AsyncIOScheduler`. Modify `main.py` to use the lifespan context manager, attach `scheduler` to `app.state`, register the interval job.

Rationale: Needs Phase 3 sync service. Can be verified by inspecting `scheduler.get_jobs()` without running real Personio calls.

**Phase 5 — HR KPI aggregation service (unblocks HR API endpoints)**
Implement `services/hr_kpi.py`: SQL aggregations for all 5 KPIs. Include the cross-source Produktions-Mitarbeiterumsatz query (joins `sales_records`).

Rationale: Requires Phase 1 schema. Independent of Phase 2-4. Can be developed in parallel with Phase 3-4.

**Phase 6 — HR API router + Settings extension (unblocks frontend)**
Implement `routers/hr.py`: `GET /api/hr/kpis`, `POST /api/hr/sync`. Extend `routers/settings.py` and schemas with personio fields. Hook `scheduler.reschedule_job` into the settings PUT handler. Mask `personio_client_secret` in responses.

Rationale: Requires all backend services (Phases 2-5). After this phase the full API surface is curl-testable.

**Phase 7 — Frontend HR tab (depends on Phase 6 API)**
Add `HrPage.tsx`, `HrKpiCard.tsx`, `HrKpiCardGrid.tsx`, `hrKeys.ts`. Extend `api.ts` with HR fetch functions. Add `/hr` route to `App.tsx`. Add HR tab to `NavBar.tsx` and rename the Dashboard tab label to "Sales". Add i18n keys for all 5 KPI labels.

Rationale: Frontend cannot be built meaningfully without the API endpoints. The NavBar rename is a 2-line change and can be done first in this phase.

**Phase 8 — Settings UI extension (can overlap with Phase 7)**
Add Personio credential fields and sync interval input to `SettingsPage.tsx`. Show "has_secret" indicator instead of the secret value. Add "Daten aktualisieren" button to `HrPage.tsx` that calls `POST /api/hr/sync` and invalidates `hrKeys.kpis`.

Rationale: Independent of Phase 7 once Phase 6 API is complete.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Concurrent `asyncio.gather` on a Single AsyncSession

**What people do:** Run employee, attendance, and absence fetches or DB writes concurrently with `asyncio.gather` sharing one `AsyncSession`.

**Why it's wrong:** SQLAlchemy `AsyncSession` is not safe for concurrent `execute()` calls on one connection. Causes `InvalidRequestError` intermittently. This project already learned this lesson in v1.2 Phase 8 (documented in `routers/kpis.py` comment).

**Do this instead:** Sequential awaits. If speed becomes important, open separate `AsyncSession` instances per fetch — each Personio request is logically independent.

### Anti-Pattern 2: Storing Personio Bearer Token in PostgreSQL

**What people do:** `UPDATE app_settings SET personio_token = '...'` after each auth call.

**Why it's wrong:** Adds a DB write on every sync init; stale 24 h tokens cause failures if not refreshed; unnecessary round-trip.

**Do this instead:** In-process module-level dict with `expires_at` timestamp. Refresh automatically when `expires_at - now() < 300 s`.

### Anti-Pattern 3: Full Historical Fetch on Every Sync

**What people do:** Fetch all Personio attendance/absence records with no date filter, truncate and reload the table.

**Why it's wrong:** Expensive pagination for large orgs; full replace creates data gaps if sync fails mid-way; no idempotency guarantee.

**Do this instead:** Fetch a rolling window (current year + previous year) using `start_date`/`end_date` params. Upsert on conflict — partial syncs are safe and idempotent.

### Anti-Pattern 4: Using `Depends(get_async_db_session)` in Scheduler Jobs

**What people do:** Inject a FastAPI request-scoped session into the scheduled background job.

**Why it's wrong:** The scheduler runs outside the HTTP request lifecycle — FastAPI's `Depends` system is unavailable.

**Do this instead:** The scheduled job opens its own session explicitly:
```python
async def run_sync():
    async with AsyncSessionLocal() as session:
        await _do_sync(session)
```

### Anti-Pattern 5: Creating a Separate `personio_settings` Table

**What people do:** Create a new singleton table just for Personio credentials, mirroring `app_settings`.

**Why it's wrong:** Duplicates the singleton pattern, requires a second CHECK constraint migration, and splits settings UI across two API endpoints.

**Do this instead:** Add 4 nullable columns to the existing `app_settings` table (already singleton, already tested, already has a Settings UI).

### Anti-Pattern 6: Exposing `personio_client_secret` in API Responses

**What people do:** Return the raw secret string in `GET /api/settings` responses.

**Why it's wrong:** The secret leaks into browser DevTools, TanStack Query cache, and React state. Any future XSS vulnerability can exfiltrate it.

**Do this instead:** Return `personio_has_secret: bool` in `SettingsRead`. The frontend shows "configured" or "not configured" without the value. On `PUT /api/settings`, if `personio_client_secret` is omitted or null, preserve the existing value (don't overwrite with null on every save).

---

## Scaling Considerations

| Concern | Current (~20 employees, internal) | At 200 employees | At 1000+ employees |
|---------|-----------------------------------|-----------------|-------------------|
| Sync duration | <5 s per run | 15-30 s per run | >60 s; move to BackgroundTasks + status polling |
| HR KPI query latency | <100 ms | <200 ms | Add indexes on date cols (already planned) |
| Scheduler persistence | In-process (resets on restart) | In-process | SQLAlchemyJobStore for persistence |
| Token cache | Module-level dict | Module-level dict | Module-level dict (single process) |

For v1.3 at internal scale, current-process APScheduler + synchronous sync endpoint is the correct choice.

---

## Sources

- Personio API v1 auth: [developer.personio.de/reference/authentication](https://developer.personio.de/reference/authentication)
- Personio getting started: [developer.personio.de/docs/getting-started-with-the-personio-api](https://developer.personio.de/docs/getting-started-with-the-personio-api)
- Personio employees endpoint: [developer.personio.de/v1.0/reference/get_company-employees](https://developer.personio.de/v1.0/reference/get_company-employees)
- Personio attendance fields: [developer.personio.de/v1.0/reference/patch_company-attendances-id](https://developer.personio.de/v1.0/reference/patch_company-attendances-id)
- Personio absence API changes: [developer.personio.de/changelog/absence-api-absence-type-configuration](https://developer.personio.de/changelog/absence-api-absence-type-configuration)
- Personio OpenAPI spec: [github.com/personio/api-docs/blob/master/personio-personnel-data-api-oa3.yaml](https://github.com/personio/api-docs/blob/master/personio-personnel-data-api-oa3.yaml)
- APScheduler 3.x AsyncIOScheduler: [apscheduler.readthedocs.io/en/3.x/userguide.html](https://apscheduler.readthedocs.io/en/3.x/userguide.html)
- httpx async client: [python-httpx.org/async](https://www.python-httpx.org/async/)
- SQLAlchemy AsyncSession single-connection constraint: documented in existing `backend/app/routers/kpis.py` (v1.2 Phase 8 comment, HIGH confidence)
- PostgreSQL `INSERT ... ON CONFLICT DO UPDATE`: PostgreSQL 17 docs (HIGH confidence, standard SQL feature)

---
*Architecture research for: HR KPI Dashboard & Personio Integration (v1.3)*
*Researched: 2026-04-12*
