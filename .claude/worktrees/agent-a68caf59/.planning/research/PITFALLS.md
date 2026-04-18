# Pitfalls Research

**Domain:** HR KPI Dashboard + Personio API Integration — KPI Light v1.3
**Project:** KPI Light
**Researched:** 2026-04-12
**Confidence:** HIGH (Personio: official developer docs + community threads; APScheduler: FastAPI GitHub + official docs; Docker: official docs; TanStack Query: official docs + GitHub issues)

---

## Critical Pitfalls

Mistakes that cause security vulnerabilities, data corruption, or rewrites if addressed late.

---

### Pitfall 1: Personio API Token Stored in Database as Plaintext — Exposed via API Response

**What goes wrong:**
The Settings page needs to let users enter their Personio API credentials (client_id and client_secret). The naive path: add two TEXT columns to the `app_settings` table, expose them via `GET /api/settings`, return them in the response JSON. The React frontend pre-fills the inputs with the values from the API response. The credentials are now visible in the browser network tab, accessible to anyone who can open DevTools, and included in any API response logging.

In a zero-auth app (v1.3 has no authentication), this means any user who can reach the UI can trivially extract the Personio credentials — which grant read access to your entire employee dataset.

**Why it happens:**
Storing all settings in one table/endpoint is the obvious pattern when the settings model is already established. Developers don't think of API credentials as different from other settings values until they realize the credentials are being echoed back in responses.

**How to avoid:**
Two separate concerns:

1. **Storage**: Store credentials in the `.env` file / Docker Compose environment variables passed to the API container — not in the database. The settings API receives the token from env vars at startup; the database only stores whether sync is configured (a boolean flag), not the credentials themselves. The `PERSONIO_CLIENT_ID` and `PERSONIO_CLIENT_SECRET` env vars live in `.env` (already gitignored by project convention) and are injected via `docker-compose.yml`.

2. **If the requirement is UI-configurable credentials** (so the user can enter them without redeploying): Store credentials in the database, but NEVER return the secret in API responses. The `GET /api/settings` endpoint returns `{"personio_configured": true, "personio_client_id": "visible-for-reference"}` — the client_secret is write-only from the API's perspective. Implement a dedicated `POST /api/settings/personio-credentials` endpoint that accepts credentials, validates them by making an auth call to Personio, and stores them. Never include the secret in any GET response.

Recommended for v1.3: env vars (no rebuild needed for credential rotation, simpler implementation). Defer UI-configurable credentials to a later milestone if auth is added first.

**Warning signs:**
- `GET /api/settings` response includes `personio_client_secret`
- Settings table has a `personio_client_secret TEXT` column returned in the default settings query
- Network tab shows credentials in plaintext

**Phase to address:**
Personio API integration setup (first phase of v1.3). The credential storage strategy must be decided before any other Personio work — it affects Docker Compose config, env var schema, and settings model design.

---

### Pitfall 2: APScheduler Duplicate Jobs with Multiple Uvicorn Workers

**What goes wrong:**
The auto-sync background job is registered in FastAPI's `lifespan` startup. In development with a single Uvicorn worker this works fine. In Docker with `uvicorn --workers 4` (or if the image ever switches to a Gunicorn process manager), each worker process initializes its own APScheduler instance. Result: the Personio sync job runs 4 times every interval, 4 simultaneous requests hit the Personio API, rate limits are exhausted, and 4 concurrent writes to the same PostgreSQL rows cause locking conflicts or duplicate data.

This is not theoretical — it is the documented primary failure mode for APScheduler in Docker multi-worker setups (confirmed in FastAPI GitHub discussion #9143 and uvicorn-gunicorn-fastapi-docker issue #227).

**Why it happens:**
Each Python process has its own memory space. `AsyncIOScheduler` state is not shared between processes. FastAPI's lifespan runs once per process. With 4 workers, lifespan runs 4 times.

**How to avoid:**
For v1.3 (single-container Docker Compose, Uvicorn without multi-worker flag): The project's `docker-compose.yml` runs Uvicorn with a single worker (no `--workers N` flag). This is safe — confirm the compose command does not add workers. Document this as a constraint: "Background sync requires single-worker Uvicorn. Do not add `--workers` to the API service command without adding a distributed job lock."

If multi-worker is ever added: Use APScheduler v4's data store + event broker pattern (SQLAlchemy data store pointing to the existing PostgreSQL, Redis event broker) to ensure only one worker executes the job. Alternatively, extract the scheduler into a separate `sync` service in Docker Compose that has no HTTP server — pure scheduler, single process, zero worker ambiguity.

For v1.3, the simplest safe pattern: single-worker Uvicorn + `AsyncIOScheduler` in lifespan. Add a `# SCHEDULER: single-worker only` comment in the compose file to prevent accidental scaling.

**Warning signs:**
- Personio sync logs show double or quadruple invocations per interval
- Rate limit (429) errors from Personio immediately after each scheduled sync
- Duplicate rows in `personio_attendances` or `personio_absences` tables

**Phase to address:**
Background sync implementation. Lock in single-worker constraint before the scheduler is written, not after.

---

### Pitfall 3: Personio API Rate Limits Are Underdocumented and Inconsistent

**What goes wrong:**
The Personio developer community documents a limit of approximately 60 requests per minute for most endpoints, with a specific limit of 150 requests per minute for the auth endpoint — but these limits are not published in official documentation as hard numbers. In practice, multiple developers report receiving 429 errors at rates below the informal limit, especially when:
- Fetching paginated attendance records for large date ranges (each page = 1 request, max 50 records per page)
- Running the initial full sync (which fetches employees + all historical attendance + all absences)
- Any parallel request pattern

A company with 50 employees and 2 years of attendance data can require 50+ API calls for the initial sync. If the scheduler retries immediately on 429, it triggers a penalty window (continued throttling for 60 seconds).

**Why it happens:**
Developers write a simple pagination loop with `while has_more: fetch_next_page()` with no delay and no 429 handling. This works for small datasets during development but fails in production with real data volumes.

**How to avoid:**
1. **Respect 429 with exponential backoff**: On any 429 response, wait `retry_after` seconds (read from the `Retry-After` header if present, else default 60s) before retrying. Do NOT retry immediately.

2. **Add inter-request delay**: Insert a `asyncio.sleep(1.0)` between paginated requests during the full sync. At 60 requests per minute, 1 second between calls keeps you under the limit. This is acceptable because sync runs in the background.

3. **Paginate correctly**: The Personio API uses `limit` (1–50, default 10) and `offset` parameters for v1 endpoints. Use `limit=50` (maximum) on all list endpoints to minimize the number of requests. Some v2 endpoints use cursor-based pagination — check the specific endpoint.

4. **Separate initial sync from incremental sync**: Initial sync (all history) runs once with rate-limit-aware pagination. Incremental sync (recent delta, e.g., last 7 days) runs on schedule and requires far fewer requests. Design both modes from the start.

**Warning signs:**
- Sync loop with no `asyncio.sleep` between pages
- No 429 handling (sync fails silently or crashes on rate limit)
- Initial sync and scheduled sync use identical code paths with no differentiation

**Phase to address:**
Personio API client implementation. Build rate limit handling and pagination before any KPI calculation logic — KPIs depend on complete data; incomplete fetches produce wrong numbers.

---

### Pitfall 4: Personio v1 vs v2 API Confusion — Wrong Endpoint for the Data You Need

**What goes wrong:**
Personio has two parallel API versions. v1 is the traditional REST API still used for most operations. v2 introduces significant breaking changes:

- **Attendance (time entries)**: v1 Attendances endpoint (`/company/attendances`) is deprecated. v2 Attendance API is now GA. If you build on v1, you will need to migrate before the July 31, 2026 deprecation deadline — which may fall during a future milestone.
- **Absences**: v1 absence endpoint has known pagination bugs (documented in community thread). The v2 absence periods endpoint (`/v2/absence-periods`) is GA and recommended.
- **Employees**: v2 splits `Person` and `Employment` into separate resources. Fetching employee data requires two endpoint calls (persons + employments) to assemble what v1 returns in one call. This matters for the "Fluktuation" KPI (headcount + terminations) and "Produktions-Mitarbeiterumsatz" (production employee count).
- **Custom attributes**: The `dynamic_` prefix on custom attribute IDs in v1 is not consistent with v2. Attribute IDs must be whitelisted in the Personio API settings UI before they appear in responses.

Building on v1 endpoints that are scheduled for deprecation means a forced migration mid-product lifecycle.

**How to avoid:**
Use v2 for Attendances and Absences (both GA). Use v1 for Employees (v2 employee split is more complex without clear benefit for this use case at this scale). Document which version each endpoint uses in the client module.

For the "Produktions-Mitarbeiter" segment: filtering by department is available but requires knowing the exact department name as stored in Personio (case-sensitive). Do not hardcode "Produktion" — fetch the department list via API and match, or make the department filter value configurable in settings.

**Warning signs:**
- All Personio calls going to v1 endpoints including attendance
- Department name hardcoded as a string literal in the application code
- No version-per-endpoint documentation in the client module

**Phase to address:**
Personio API client design (before implementation). Define which API version serves each data type. This is a design decision, not an implementation detail.

---

### Pitfall 5: Cross-Source KPI (Produktions-Mitarbeiterumsatz) — Temporal Mismatch Between Sales and HR Data

**What goes wrong:**
The "Produktions-Mitarbeiterumsatz" KPI divides ERP revenue (from the orders table) by the number of production employees (from Personio). These two data sources have independent update cycles:
- ERP data is uploaded manually (whenever a user uploads a file)
- Personio data is synced on a schedule (configurable interval, e.g., every 4 hours)

If the ERP upload contains Q1 data but Personio sync is stale (hasn't run since last week), the employee count reflects a different period than the revenue figure. The KPI is mathematically computed but semantically wrong. Worse: the dashboard shows no warning that the two data sources are from different time windows.

**Why it happens:**
Two independent data pipelines with no coordination mechanism. The KPI calculation query joins the two tables without checking whether the Personio data is fresh enough to be meaningful for the revenue period.

**How to avoid:**
1. **Store a `synced_at` timestamp** on Personio data (already implied by "Daten aktualisieren" button). Expose this to the frontend.

2. **Show data freshness separately for each source**: The HR dashboard should show two freshness indicators — "ERP-Daten: letzte Upload [timestamp]" and "Personio-Daten: letzte Sync [timestamp]". The existing `freshness_indicator` pattern from the Sales dashboard is the template.

3. **Flag stale cross-source KPIs**: If Personio data is older than N hours (configurable, default 24h), show a staleness warning on the Produktions-Mitarbeiterumsatz card specifically. Do not silently compute with stale data.

4. **Define "employee count for period"**: The KPI needs a clear definition — is it headcount at end of period? Average over period? Personio's employee list is a snapshot at sync time. If the sync runs weekly and someone was hired and fired within the week, they won't appear. Document the definition and its limitation in the UI (tooltip or footnote).

**Warning signs:**
- HR dashboard shows KPI cards with no freshness indicator
- `Produktions-Mitarbeiterumsatz` computed without checking `personio_last_synced_at`
- No warning when Personio data is older than 24h

**Phase to address:**
HR KPI calculation + dashboard display. The freshness indicator design must precede the KPI card implementation.

---

## Moderate Pitfalls

Mistakes that cause bugs, UX degradation, or meaningful tech debt but not rewrites.

---

### Pitfall 6: Personio Bearer Token Expiry — 24-Hour Token Cached Past Expiry

**What goes wrong:**
Personio's v2 auth API issues bearer tokens that are stable for 24 hours. The client fetches a token on startup and caches it in memory. If the API service container restarts partway through a token's lifetime, the token is re-fetched (no problem). But if the token is cached without an expiry check and the container runs for more than 24 hours without restart (normal in production), the next API call returns 401. The sync job fails silently or errors until the container is restarted or the token is manually refreshed.

**How to avoid:**
Cache the token with its expiry time (`issued_at + 24h - 5min buffer`). Before each Personio API call, check `if now() > token_expires_at: re-authenticate`. The auth endpoint rate limit is 150 req/min — re-fetching on expiry is safe. Store `token_expires_at` as a module-level variable in the Personio client class.

Do not store the bearer token in the database or settings — it is a derived credential (obtained from client_id + client_secret) and should be treated as ephemeral in-process state.

**Warning signs:**
- Personio client stores `self.token` without `self.token_expires_at`
- Sync job fails with 401 on containers that have been running more than 24 hours
- No token refresh logic in the client's request method

**Phase to address:**
Personio API client implementation. Token lifecycle management is part of the client class design, not a post-implementation fix.

---

### Pitfall 7: Alembic Migration Generates Conflicting Revision for Existing Tables

**What goes wrong:**
Running `alembic revision --autogenerate` for the new Personio tables (`personio_employees`, `personio_attendances`, `personio_absences`) against an existing database that already has `orders`, `uploads`, `app_settings` tables produces a migration that includes not just the new tables but also attempts to recreate existing tables if the SQLAlchemy models drift from the actual DB schema. If any column was added manually (e.g., during debugging) or if the autogenerate comparison misidentifies a type (common with custom types, JSONB, ENUM), the generated migration contains spurious changes that corrupt the existing schema when applied.

**Why it happens:**
Alembic autogenerate compares the `metadata` object (all declared models) against the database reflection. If an existing model has drifted from the DB (even by a comment or index name), autogenerate flags it. Developers run `alembic upgrade head` without reviewing the generated SQL.

**How to avoid:**
1. **Always review the generated migration file** before running it. Read the `upgrade()` function line-by-line. Confirm it only contains `CREATE TABLE` statements for the new Personio tables, not `ALTER TABLE` or `DROP TABLE` for existing tables.

2. **Run `alembic check`** first (Alembic 1.9+) to see what the autogenerate would produce without generating the file. If it flags existing tables, fix the model drift before generating the migration.

3. **Only import new models into `env.py`'s `target_metadata`** — all existing models must already be in `target_metadata`. Confirm `Base.metadata` includes all models.

4. **Test migrations on a fresh DB** (in CI or a throwaway container) to verify the full migration chain from scratch produces a valid schema.

**Warning signs:**
- Generated migration contains `op.alter_column` for columns you didn't change
- Migration contains `op.drop_table` for any existing table
- `alembic upgrade head` raises `Table already exists` errors

**Phase to address:**
Database schema migration for Personio tables (first development task). Run `alembic check` before `alembic revision`.

---

### Pitfall 8: Multi-Tab Dashboard — TanStack Query Cache Serves Stale HR Data After Manual Sync

**What goes wrong:**
The HR tab has a "Daten aktualisieren" (manual sync) button. When the user clicks it, the frontend calls `POST /api/personio/sync`, which triggers the Personio sync job. The sync completes and returns 200. But the KPI cards on the HR tab still show the old values because TanStack Query's cache for the HR KPI queries hasn't been invalidated.

The user sees a stale UI immediately after explicitly requesting a refresh. This breaks the mental model established by the Sales tab (where upload triggers cache invalidation automatically).

**Why it happens:**
The mutation for "trigger sync" and the queries for "fetch HR KPIs" are not connected through TanStack Query's invalidation mechanism. The sync endpoint returning 200 does not automatically invalidate the HR query cache.

**How to avoid:**
Use TanStack Query's `onSuccess` callback in the sync mutation to invalidate the HR KPI queries:

```typescript
const syncMutation = useMutation({
  mutationFn: () => fetch('/api/personio/sync', { method: 'POST' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['hr-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['personio-sync-status'] });
  },
});
```

This is identical to the existing Sales upload invalidation pattern (`kpiKeys.all` prefix invalidation). Extend the same `queryKeys` factory to cover HR KPI queries with a separate `hrKpiKeys` namespace.

Also: the sync endpoint should be async (fire the sync and return immediately with 202 Accepted) rather than blocking (waiting for the full Personio fetch to complete before returning). Fetching 2 years of attendance data can take 30–60 seconds. A blocking endpoint times out in browsers (30s default) and shows a frozen UI. Return 202 and poll a `/api/personio/sync-status` endpoint for completion.

**Warning signs:**
- `POST /api/personio/sync` takes more than 5 seconds (indicates it's doing the full sync synchronously)
- HR KPI cards do not refresh after clicking "Daten aktualisieren"
- No `invalidateQueries` call in the sync mutation's `onSuccess`

**Phase to address:**
HR dashboard frontend (sync button implementation). Design the async sync + polling pattern before implementing the button.

---

### Pitfall 9: Fluktuation KPI Requires Historical Headcount — Personio Snapshot Is Not Enough

**What goes wrong:**
The "Fluktuation" KPI is defined as (terminations / total employees). Calculating this correctly requires:
- Count of employees who left during the period (terminations)
- Total headcount *at the start of* or *during* the period (not just current headcount)

Personio's employee list endpoint returns the current state of employees. Terminated employees appear with a `termination_date` in the past and may have `status: inactive`. But the *headcount at a past point in time* requires reconstructing it from hire and termination dates.

If the sync stores only active employees, terminated employees are deleted from the local table on each sync — making historical Fluktuation calculations impossible.

**How to avoid:**
Store ALL employees from Personio — active and inactive — with their `hire_date` and `termination_date`. Never delete rows from `personio_employees` on sync; instead, use an UPSERT that updates existing rows and inserts new ones. The `status` column distinguishes active from inactive.

The Fluktuation calculation then becomes:
```sql
-- terminations in period
SELECT COUNT(*) FROM personio_employees 
WHERE termination_date BETWEEN period_start AND period_end

-- headcount at period start  
SELECT COUNT(*) FROM personio_employees
WHERE hire_date <= period_start 
  AND (termination_date IS NULL OR termination_date >= period_start)
```

This requires the `hire_date` and `termination_date` fields to be stored and indexed.

**Warning signs:**
- `personio_employees` sync uses `DELETE + INSERT` instead of UPSERT
- `personio_employees` table has no `termination_date` column
- Fluktuation calculation uses `COUNT(*) WHERE status = 'active'` for the denominator

**Phase to address:**
Personio data model (Alembic migration design) and sync logic. The UPSERT pattern and field selection must be decided before the first sync runs — retrofitting after requires a full re-sync.

---

### Pitfall 10: Overtime and Sick Leave Hours Need Work Schedule Context — Raw Attendance Hours Are Wrong

**What goes wrong:**
The "Überstunden im Vergleich Gesamtstunden" and "Krankheit im Vergleich Gesamtstunden" KPIs need total expected hours as the denominator. Developers assume "total hours" = `COUNT(workdays) × 8 hours`. This is wrong because:

- Personio employees have individual work schedules (part-time, 4-day week, etc.) stored in their employee record
- Personio's absence type configuration determines whether a sick absence reduces target hours (the "Reduce target hours" setting on the absence type affects whether approved time off counts as attendance)
- Overtime in Personio is calculated against the employee's schedule, not a flat 8h/day — the Personio overtime recalculation cutoff was set to November 1, 2025 for the current system

Computing `SUM(attendance_hours) / SUM(expected_hours_8h_per_workday)` produces a subtly wrong number that looks plausible but is off by 10–30% for organizations with part-time staff.

**How to avoid:**
Fetch `weekly_hours` per employee from the Personio employee record. Use `weekly_hours / 5` as the per-day expectation (adjusted for holidays). This is an approximation — it is acceptable for an internal KPI dashboard but must be documented as such in the UI (tooltip: "Basiert auf vertraglichen Wochenstunden aus Personio, nicht auf tatsächlichen Arbeitszeitplänen").

Do not attempt to replicate Personio's full overtime calculation engine in application code — it accounts for work schedule exceptions, public holidays per state, and conversion factors. Display the KPI as an approximate signal, not an auditable payroll figure.

Store `weekly_hours` in `personio_employees` and use it in the KPI calculation query.

**Warning signs:**
- KPI calculation uses a flat 8h/day expected hours assumption
- No `weekly_hours` column in `personio_employees`
- No disclaimer in the UI that overtime figures are approximate

**Phase to address:**
Personio data model (add `weekly_hours`) and KPI calculation SQL. Must be addressed in the initial implementation — the denominator definition affects all three hours-based KPIs.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store Personio credentials in DB, return in GET response | Simple unified settings API | Credential exposure in any API response log or DevTools; security regression | Never — write-only endpoint or env vars only |
| Use `DELETE + INSERT` on each Personio sync | Simple sync logic | Historical data lost; Fluktuation KPI impossible; forced full re-sync after any bug | Never — always UPSERT |
| Build on v1 Attendance endpoint (deprecated July 2026) | Faster initial implementation | Forced migration during a future milestone with breaking changes | Acceptable only if v1.3 explicitly flags this as known tech debt with migration issue filed |
| Blocking sync endpoint (waits for full Personio fetch) | Simple implementation | 30-60s UI freeze on manual sync; browser timeout on large orgs | Acceptable only in v1.3 MVP if org size is known to be small (<20 employees); must be async before public release |
| Flat 8h/day expected hours assumption | No need to fetch work schedules | Wrong KPI values for part-time employees; numbers look authoritative but are wrong | Acceptable with explicit UI disclaimer; not acceptable without the disclaimer |
| APScheduler in-process without worker constraint | Zero extra dependencies | Duplicate jobs on any multi-worker deploy; data corruption and rate limit exhaustion | Acceptable only with documented single-worker constraint in compose file |

---

## Integration Gotchas

Common mistakes when connecting to the Personio API.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Personio auth | Fetching a new token on every API call | Cache token with expiry check; re-fetch only when within 5 minutes of 24h expiry |
| Personio pagination | Using default `limit=10`, resulting in 10x more requests than necessary | Always set `limit=50` on list endpoints; use cursor pagination on v2 endpoints |
| Personio absence type | Treating all absence types as "sick" | Fetch absence types list first; filter by the specific type ID for Krankheit; do not hardcode absence type names |
| Personio attendance v1 | Mixing v1 and v2 auth tokens | v1 uses its own auth flow; v2 uses OAuth2 client credentials — use separate auth per API version or migrate fully to v2 |
| Personio department filter | Hardcoding "Produktion" as a string | Make department filter configurable in settings; fetch department list from API for validation |
| Personio employee attributes | Assuming attributes are always present | Custom attributes may be NULL if not filled in Personio; handle missing `weekly_hours` gracefully |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Initial Personio full sync in a single request loop | Sync takes 60+ seconds; browser timeout | Async background task; 202 Accepted + poll pattern | Any org with >20 employees and >3 months of attendance history |
| Re-fetching all Personio data on every scheduled sync | Rate limit exhaustion; slow sync | Incremental sync using `updated_since` filter on attendance endpoint | After first week of running in production |
| Computing cross-source KPI (revenue ÷ employees) in Python after fetching all rows | High memory use; slow response | Compute in SQL with a subquery; push aggregation to PostgreSQL | When orders table exceeds ~50k rows |
| No database index on `personio_attendances.employee_id` and `date` | KPI queries slow as attendance data grows | Add composite index in migration | After ~6 months of data (grows with org size × sync frequency) |
| Polling sync status at 1-second interval in frontend | Excessive API calls; Uvicorn CPU spike during sync | Poll at 3-5 second intervals with exponential backoff; stop polling after success/failure | Immediately, with any org size |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Personio client_secret in GET /api/settings response | Any user with DevTools access extracts API credentials | Write-only: accept via POST, never return in GET |
| Personio credentials in docker-compose.yml instead of .env | Credentials committed to git | Use `.env` file (gitignored); reference with `${VAR}` syntax in compose |
| Bearer token stored in localStorage or sessionStorage | XSS can steal the token | Keep token server-side only; never send to frontend |
| Logging full Personio API response bodies | Employee PII (names, salaries, sick days) in server logs | Log only status codes and response sizes; never log response bodies from Personio endpoints |
| No HTTPS between app containers and Personio API | Man-in-the-middle on internal network | `httpx` uses HTTPS by default; verify `ssl=True` is not disabled in client config |
| Personio employee data (absences, health data) stored without access control | All users see all employee health/absence data | Acceptable in v1.3 (zero-auth internal tool); must be addressed before any Authentik integration |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| HR tab shows "0" KPIs when Personio credentials are not configured | Looks like a bug | Show a "Personio nicht konfiguriert — bitte Zugangsdaten in den Einstellungen hinterlegen" empty state, not zero values |
| Manual sync button with no feedback for 30+ seconds | User thinks it crashed; clicks multiple times, triggering duplicate syncs | Show spinner immediately on click; disable button during sync; show last-synced timestamp on completion |
| Delta badges on HR KPIs with no prior-period data (first sync ever) | "—" badges look broken | Use same em-dash fallback pattern from v1.2; add tooltip "Kein Vergleichszeitraum verfügbar" |
| HR and Sales tabs share the same date filter | Personio data has no time filter (it's always all data); applying the Sales filter to HR is meaningless | HR tab does not show the date filter UI; document "HR KPIs zeigen immer aktuelle Gesamtwerte" |
| "Daten aktualisieren" succeeds but UI data doesn't change visibly | User doesn't know if it worked | Show a timestamp "Zuletzt aktualisiert: [time]" that visibly updates after each sync |

---

## "Looks Done But Isn't" Checklist

- [ ] **Personio credentials**: Does `GET /api/settings` omit `personio_client_secret` from the response? Verify with curl — the field must not appear.
- [ ] **Token expiry**: Let the API container run for 25 hours without restart. Does the next scheduled sync succeed (re-auth) or fail with 401?
- [ ] **Rate limit handling**: Does the sync client handle 429 responses with a wait, not an immediate retry? Test by mocking a 429 in the Personio client.
- [ ] **UPSERT on sync**: After syncing, manually insert a fake terminated employee row. Run sync again. Does the row survive (UPSERT) or disappear (DELETE + INSERT)?
- [ ] **Fluktuation denominator**: Hire a test employee in Personio with a past `hire_date`. Sync. Does the headcount-at-period-start SQL query count them correctly?
- [ ] **Multi-worker safety**: Add `--workers 2` to the Uvicorn command temporarily. Does the sync job run twice per interval? (It should — document why single-worker is required.)
- [ ] **Async sync endpoint**: Call `POST /api/personio/sync` for a large date range. Does it return within 2 seconds (202 Accepted)? Or does it block?
- [ ] **Manual sync invalidation**: Click "Daten aktualisieren". Do the KPI cards reload after sync completes (not just after clicking)? Check with DevTools Network tab.
- [ ] **Empty state**: Clear Personio credentials from settings. Does the HR tab show a meaningful "not configured" state instead of zeros or errors?
- [ ] **Attendance API version**: Confirm the codebase uses v2 attendance endpoints, not v1 (`/company/attendances`). Verify in the Personio client module.
- [ ] **Alembic migration**: Run `alembic check` — does it report zero unexpected changes to existing tables? Only new Personio tables should appear in the diff.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Credentials exposed in API response | HIGH | Rotate Personio API credentials immediately; audit API response logs; patch the GET endpoint; redeploy |
| Duplicate sync jobs from multi-worker | MEDIUM | Restart with single-worker; deduplicate rows in Personio tables (identify by `personio_id + date`); add worker constraint to compose |
| Personio data deleted by DELETE+INSERT sync | HIGH | Full re-sync from Personio (if data still available there); switch to UPSERT; no recovery if Personio data was also deleted |
| Rate limit exhaustion from sync | LOW | Wait 60 seconds; switch to incremental sync; add sleep between paginated requests |
| Stale Personio token causing 401 errors | LOW | Restart API container (forces token re-fetch); add token expiry check to client |
| Wrong overtime denominator (8h assumption) | LOW | Fix SQL query; add UI disclaimer; no historical data corruption |
| Alembic migration corrupted existing tables | HIGH | Restore from `pg_dump` backup; fix migration; re-run; always test migrations on throwaway DB first |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Token exposure in API response (P1) | Personio credentials + settings design | curl `GET /api/settings` — secret must not appear |
| Duplicate sync jobs (P2) | Background scheduler implementation | Run with `--workers 2`; confirm single execution per interval |
| Rate limit handling (P3) | Personio API client implementation | Mock 429; confirm exponential backoff fires |
| v1 vs v2 API confusion (P4) | Personio client design (pre-implementation) | Code review: attendance calls must use `/v2/attendances` |
| Cross-source temporal mismatch (P5) | HR dashboard KPI cards | UI shows two freshness timestamps; stale Personio shows warning |
| Bearer token expiry (P6) | Personio API client implementation | Run container 25h; confirm auto-re-auth |
| Alembic migration conflict (P7) | DB migration (Personio tables) | `alembic check` shows only new tables |
| Manual sync cache invalidation (P8) | HR dashboard sync button | Click sync; confirm KPI cards reload |
| Fluktuation historical headcount (P9) | Personio data model + sync logic | UPSERT test + SQL query validation |
| Overtime denominator definition (P10) | Personio data model + KPI SQL | Part-time employee test case |

---

## Sources

- [Personio API rate limits — community thread (60 req/min informal)](https://developer.personio.de/discuss/66a8d4dcd07c9e0052e12519)
- [Personio rate limit increased complaints (2025)](https://developer.personio.de/discuss/67ad33de7de5140018892fb0)
- [Personio rate limits — Attendance API v2 (2025)](https://developer.personio.de/discuss/67f4ed20cc8a900036bd6fad)
- [Personio API pagination broken — community report](https://developer.personio.de/discuss/61e47838f01e46005f025a6e)
- [Personio Absences and Attendances v2 GA announcement](https://developer.personio.de/changelog/absences-and-attendances-v2-apis-promotion-to-general-availability-ga)
- [Personio v1 Attendance deprecation (July 31, 2026) — API v2 issues discussion](https://developer.personio.de/discuss/67b6e06f8740e60031bb5803)
- [Personio bearer token stable 24h — auth changelog](https://developer.personio.de/changelog/authentication-api-improved-bearer-token)
- [Personio auth endpoint rate limit (150 req/min)](https://developer.personio.de/reference/post_v2-auth-token)
- [Personio v2 Person + Employment split — historization](https://developer.personio.de/discuss/683eb3716fae3a00219dd67e)
- [Personio overtime recalculation cutoff Nov 2025](https://support.personio.de/hc/en-us/articles/115000724605-Manage-overtime)
- [APScheduler duplicate jobs with Gunicorn/multiple workers — FastAPI discussion #9143](https://github.com/fastapi/fastapi/discussions/9143)
- [APScheduler logs in Docker — uvicorn-gunicorn-fastapi issue #227](https://github.com/tiangolo/uvicorn-gunicorn-fastapi-docker/issues/227)
- [FastAPI-APScheduler4 multi-node data store requirement](https://grelinfo.github.io/fastapi-apscheduler4/0.1/getting_started/)
- [TanStack Query invalidateQueries — official docs](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- [TanStack Query staleTime: 'static' vs Infinity behavior](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [Alembic autogenerate limitations — official docs](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)

---
*Pitfalls research for: HR KPI Dashboard + Personio API Integration (KPI Light v1.3)*
*Researched: 2026-04-12*
