# Stack Research

**Domain:** HR KPI Dashboard & Personio API Integration
**Milestone:** KPI Light v1.3
**Researched:** 2026-04-12
**Confidence:** HIGH (Personio API auth model verified, APScheduler version verified, httpx version verified)

---

## What This Document Covers

Milestone-scoped research for v1.3. Documents **only the additions** needed on top of the validated stack. The following are NOT re-researched and ship unchanged: FastAPI, asyncpg, SQLAlchemy 2.0 async, Alembic, React 19, Vite 8, Recharts, Tailwind v4, shadcn/ui, TanStack Query, react-i18next, wouter, Docker Compose + PostgreSQL 17-alpine, nh3.

---

## New Backend Dependencies

### 1. Async HTTP Client for Personio API

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| httpx | 0.28.1 | Async HTTP client for all Personio REST API calls | `AsyncClient` integrates cleanly into the existing async FastAPI stack — no thread pool, no blocking. The alternative (`personio-py`) is sync-only (uses `requests`), last released in 2022 (v0.2.3), and would block the uvicorn event loop when called from async route handlers. The Personio API surface needed for v1.3 is small (3 endpoints: `/employees`, `/attendances`, `/absences`); a thin httpx-based client is cleaner than a stale third-party wrapper. |

**Why NOT `personio-py`:**
- Uses `requests` (sync) — calling from `async def` requires `asyncio.run_in_executor`, adding unnecessary complexity
- Last release: v0.2.3 (approximately 2022, low maintenance signal)
- No async interface; no plans for one in any tracked release
- The Personio API is straightforward REST+JSON; a custom client is ~50 lines and zero risk of library drift

**Personio auth model (verified):**
- Bearer token obtained via `POST /auth` with `client_id` + `client_secret`
- Token valid for 24 hours, stable (same value reused for the 24h window)
- Token rotation: new token returned in response headers on each authenticated call — httpx response header inspection handles this transparently
- Rate limit on `/auth`: 150 req/min; for background sync this is irrelevant (one call per sync cycle)

```python
# Personio API client pattern — thin wrapper over httpx.AsyncClient
import httpx

class PersonioClient:
    BASE_URL = "https://api.personio.de/v1"

    def __init__(self, client_id: str, client_secret: str):
        self._client_id = client_id
        self._client_secret = client_secret
        self._token: str | None = None
        self._http = httpx.AsyncClient(base_url=self.BASE_URL, timeout=30.0)

    async def _ensure_auth(self) -> None:
        if self._token:
            return
        resp = await self._http.post("/auth", json={
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        })
        resp.raise_for_status()
        self._token = resp.json()["data"]["token"]

    async def get_employees(self) -> list[dict]:
        await self._ensure_auth()
        resp = await self._http.get("/company/employees",
                                     headers={"Authorization": f"Bearer {self._token}"})
        resp.raise_for_status()
        # Rotate token if present in response headers
        if new_token := resp.headers.get("X-Token"):
            self._token = new_token
        return resp.json()["data"]
```

### 2. Background Task Scheduler

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| APScheduler | 3.11.2 | Configurable interval-based Personio sync, triggered from within the FastAPI process | `AsyncIOScheduler` runs on the same asyncio event loop as FastAPI — no separate process or container needed. `reschedule_job()` allows runtime interval changes (required for "configurable auto-sync interval in Settings" without a server restart). Stable, battle-tested, well-documented. |

**Why NOT APScheduler 4.x:** Pre-release only (latest: 4.0.0a6 as of April 2025). API is not stable; the project explicitly states it is not production-ready. Stay on 3.11.2.

**Why NOT Celery/Redis:** A separate worker process + broker for a single background job is massively disproportionate. No external message broker to operate.

**Why NOT FastAPI `BackgroundTasks`:** `BackgroundTasks` runs after a response — it is not a scheduler and does not repeat. Not applicable here.

**Integration pattern — FastAPI lifespan:**

```python
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load personio_sync_interval_hours from app_settings at startup
    scheduler.add_job(
        sync_personio,
        trigger=IntervalTrigger(hours=personio_sync_interval_hours),
        id="personio_sync",
        replace_existing=True,
        max_instances=1,  # Prevent overlap if sync takes longer than interval
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

app = FastAPI(lifespan=lifespan)
```

**Runtime interval reconfiguration (Settings page "Save"):**

```python
# When user saves new sync interval in Settings
scheduler.reschedule_job(
    job_id="personio_sync",
    trigger=IntervalTrigger(hours=new_interval_hours),
)
```

`reschedule_job()` replaces the trigger and recalculates next run time immediately — no restart required.

---

## No New Frontend Dependencies

All v1.3 frontend features (HR tab, KPI cards with delta badges, manual sync button, Settings sync interval input, Settings API token input) are achievable with already-installed libraries:
- **Tab navigation:** existing wouter routes + shadcn/ui Tab components
- **KPI cards with delta badges:** reuse existing delta badge components from v1.2
- **Sync status feedback:** TanStack Query mutation + existing shadcn/ui toast or inline status text
- **Settings inputs:** existing shadcn/ui form components

---

## New Database Tables (No New Libraries)

SQLAlchemy 2.0 async + Alembic (both already installed) handle all new HR schema. Three new tables via new Alembic migration:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `personio_employees` | Raw employee list snapshot from Personio | `personio_id`, `first_name`, `last_name`, `department`, `position`, `hire_date`, `termination_date`, `status`, `synced_at` |
| `personio_attendances` | Raw time/attendance entries from Personio | `personio_id`, `employee_id` (FK), `date`, `start_time`, `end_time`, `break_duration`, `type` (regular/overtime), `synced_at` |
| `personio_absences` | Raw absence records from Personio | `personio_id`, `employee_id` (FK), `absence_type`, `start_date`, `end_date`, `duration_hours`, `status`, `synced_at` |

**Design principle:** Store Personio raw data as-is; compute KPIs at query time in SQL (same pattern as sales KPIs in v1.2). Do NOT pre-aggregate — raw data enables ad-hoc period filtering and delta calculations.

**`app_settings` additions** (extend existing table via new Alembic migration):
```
personio_client_id       VARCHAR(255) NULL
personio_client_secret   VARCHAR(255) NULL   -- stored as plaintext; Authentik auth is v2 scope
personio_sync_interval_hours  INTEGER NOT NULL DEFAULT 24
personio_last_synced_at  TIMESTAMPTZ NULL
```

Storing the API secret in PostgreSQL as plaintext is acceptable for v1.3: there is no authentication in front of this app yet (Authentik is v2 scope), and the threat model is internal-network-only. Flag this for the Authentik milestone — at v2, secrets should move to env vars or a secrets manager.

---

## Settings Page Additions

The existing Settings page (built in v1.1) gains two new sections:

1. **Personio API Credentials** — `client_id` (text input) + `client_secret` (password input, masked). Saved to `app_settings` via existing settings mutation endpoint.
2. **Auto-Sync Interval** — number input (hours, 1–168). On save, calls `scheduler.reschedule_job()` in the API handler. Manual "Daten aktualisieren" button on HR tab triggers an immediate ad-hoc sync via a dedicated `POST /api/hr/sync` endpoint.

---

## What NOT to Add

| Avoid | Why | What to Use Instead |
|-------|-----|---------------------|
| `personio-py` | Sync-only (uses `requests`); last release ~2022; blocks event loop in async FastAPI | `httpx.AsyncClient` with thin custom wrapper |
| APScheduler 4.x | Alpha-only (4.0.0a6); not production-ready; API not stable | APScheduler 3.11.2 |
| Celery + Redis | Full message broker for a single background job; disproportionate operational overhead | APScheduler 3.11.2 `AsyncIOScheduler` |
| FastAPI `BackgroundTasks` | Not a scheduler; runs once after response, does not repeat | APScheduler |
| `rq` (Redis Queue) | Requires Redis; same overkill argument as Celery | APScheduler |
| A separate `personio-sync` Docker service | Adds container lifecycle complexity; APScheduler runs in-process | In-process APScheduler via lifespan |
| `aiohttp` | Already have httpx; no need for a second async HTTP library | httpx 0.28.1 |
| Pre-aggregated HR KPI tables | Loses raw data flexibility; couples schema to current KPI definitions | Raw tables + SQL aggregation at query time |
| Secrets manager / Vault | v2 scope (Authentik milestone); overkill for internal-only v1.3 | Plaintext in `app_settings` with documented TODO |

---

## Installation

### Backend additions to `requirements.txt`

```
httpx==0.28.1
APScheduler==3.11.2
```

No other new backend packages needed.

### Frontend — no new packages

All v1.3 frontend work uses already-installed libraries.

---

## Version Compatibility Notes

| Package | Version | Compatibility Note |
|---------|---------|-------------------|
| httpx | 0.28.1 | Python >=3.8; fully async; works with FastAPI's asyncio event loop; no conflicts with existing stack |
| APScheduler | 3.11.2 | Python >=3.8; `AsyncIOScheduler` requires no separate thread; `max_instances=1` prevents sync job overlap; works with FastAPI lifespan context manager |
| Personio API | v1 (REST) | Bearer token auth; 24h token validity; endpoints: `/auth`, `/company/employees`, `/company/attendances`, `/company/time-off` (absences) |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| httpx 0.28.1 as Personio HTTP client | HIGH | PyPI confirmed latest stable (released Dec 2024); async pattern matches existing stack; official httpx docs + FastAPI async docs |
| APScheduler 3.11.2 stability | HIGH | Version confirmed via WebSearch + Repology; 3.x docs confirm `AsyncIOScheduler` + `reschedule_job()` API |
| APScheduler 4.x avoid | HIGH | Pre-release status confirmed (4.0.0a6); project README explicitly flags not production-ready |
| personio-py avoid (sync-only, stale) | HIGH | GitHub repo confirmed `requests`-only; last PyPI release v0.2.3 |
| Personio API auth model (24h token, client_id/secret) | HIGH | Verified against official Personio developer docs + changelog |
| Raw-data storage pattern (no pre-aggregation) | HIGH | Consistent with existing sales KPI pattern in codebase (v1.2 uses SQL-computed windows) |
| In-process scheduler (no separate container) | MEDIUM | Standard pattern for single-job APScheduler usage; acknowledged risk: sync job shares resources with API requests |
| Plaintext API secret in app_settings | MEDIUM | Accepted for v1.3 internal-only scope; flagged as tech debt for Authentik milestone |

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Personio API schema changes break raw data ingestion | Low | Store full raw JSON as JSONB alongside normalized columns — enables schema changes without data loss |
| Sync job overlaps (slow Personio API response) | Medium | `max_instances=1` on APScheduler job prevents concurrent sync runs |
| Personio API token expires during long sync | Low | Implement token refresh on 401 response in `PersonioClient._ensure_auth()` by clearing `self._token` and re-authenticating |
| In-process scheduler causes memory pressure during large syncs | Low | Personio employee/attendance datasets for SMB (target user) are <10k rows; negligible memory footprint |
| API secret visible in Settings page (plaintext) | Medium | Mask `client_secret` field in UI (password input); document Authentik milestone as the fix |

---

## Sources

- [Personio Developer Docs — Getting Started](https://developer.personio.de/docs/getting-started-with-the-personio-api)
- [Personio API Authentication reference](https://developer.personio.de/reference/authentication)
- [Personio Authentication API — improved bearer token changelog](https://developer.personio.de/changelog/authentication-api-improved-bearer-token)
- [httpx official docs — Async Support](https://www.python-httpx.org/async/)
- [httpx PyPI — version 0.28.1 (Dec 2024)](https://pypi.org/project/httpx/)
- [APScheduler 3.11.2 User Guide](https://apscheduler.readthedocs.io/en/3.x/userguide.html)
- [APScheduler AsyncIOScheduler docs](https://apscheduler.readthedocs.io/en/3.x/modules/schedulers/asyncio.html)
- [APScheduler IntervalTrigger docs](https://apscheduler.readthedocs.io/en/3.x/modules/triggers/interval.html)
- [APScheduler PyPI — 3.11.2 latest stable](https://pypi.org/project/APScheduler/)
- [Sentry — Schedule tasks with FastAPI (lifespan pattern)](https://sentry.io/answers/schedule-tasks-with-fastapi/)
- [personio-py GitHub (at-gmbh/personio-py)](https://github.com/at-gmbh/personio-py)

---

*Stack research for: KPI Light v1.3 HR KPI Dashboard & Personio-Integration*
*Researched: 2026-04-12*
