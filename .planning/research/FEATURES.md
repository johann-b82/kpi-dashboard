# Feature Research

**Domain:** HR KPI Dashboard with Personio API Integration (v1.3 milestone)
**Milestone:** v1.3 HR KPI Dashboard & Personio-Integration
**Researched:** 2026-04-12
**Confidence:** HIGH for KPI formulas (industry-standard, multi-source verified); HIGH for Personio API endpoints (official developer docs + community sources); MEDIUM for Personio-specific overtime data (API returns raw attendance records, overtime calculation requires local logic using work-schedule target hours); LOW for skill/development KPI via Personio (no dedicated Personio API endpoint — relies on custom attributes)

---

## Context: What Already Exists

v1.2 shipped these components directly relevant to v1.3:

- **Sales dashboard** — 3 KPI cards (total revenue, avg order value, total orders) with dual delta badges (vs. Vorperiode + vs. Vorjahr), chart overlay, date range presets
- **Settings page** — stores Personio API token (new v1.3 requirement), configures auto-sync interval
- **TanStack Query** — `kpiKeys.all` prefix invalidation pattern, loading/error states, cache management
- **DE/EN i18n** — flat key convention, `keySeparator: false`, `i18n.changeLanguage()` pattern
- **Delta badges** — reusable component with locale-aware percent formatting and em-dash fallback
- **PostgreSQL + SQLAlchemy 2.0 async** — Alembic migrations, `AsyncSession` with `create_async_engine`
- **Docker Compose** — `condition: service_healthy`, environment-based config, `.env` secrets

**Critical constraint:** The HR dashboard KPI "Revenue per production employee" (KPI #5) is a cross-source metric — it joins ERP sales data (already in PostgreSQL from file upload) with Personio headcount data. This is the one metric that cannot be computed from Personio alone.

---

## Personio API Overview

**Auth:** POST `https://api.personio.de/v1/auth` with `client_id` + `client_secret` (passed in POST body as JSON or form-encoded). Returns a bearer token stable for **24 hours**. Token should be cached in memory and refreshed before expiry. Rate limit: 300 req/min, burst 15 req/sec; auth endpoint: 150 req/min.

**Scoping:** Access to specific attributes requires whitelisting in Personio's API credentials settings (Settings → Integrations → API credentials → Readable employee attributes). This is a Personio admin configuration step, not a code step.

**API versions:** v1 (stable, broad compatibility) and v2 (newer features). For this milestone, v1 endpoints cover all required data. Use v2 for absence periods where available (`GET /v2/absence-periods`).

### Endpoints Needed for v1.3

| Endpoint | Method | What It Returns | KPIs It Feeds |
|----------|--------|-----------------|---------------|
| `POST /v1/auth` | POST | Bearer token | All (auth) |
| `GET /v1/company/employees` | GET | All employees: id, first_name, last_name, department, position, hire_date, termination_date, status, weekly_working_hours, custom attributes | KPI #3 (fluctuation), KPI #4 (skills), KPI #5 (production headcount) |
| `GET /v1/company/attendances` | GET | Attendance records per employee: employee_id, date, start_time, end_time, break (minutes), comment. Filtered by `start_date`, `end_date`, `employees[]` | KPI #1 (overtime ratio), KPI #2 (sick leave hours — though absence endpoint preferred) |
| `GET /v2/absence-periods` | GET | Absence records: employee_id, start_date, end_date, absence_type (sick leave, vacation, etc.), half_day settings. Filter: `start_date`, `end_date`, `employees[]`, `absence_types[]` | KPI #2 (sick leave ratio) |
| `GET /v1/company/employees/attributes` | GET | List of all allowed employee attributes including custom ones | KPI #4 (discover skill custom attribute names) |

**No direct overtime endpoint:** Personio tracks attendance (actual hours worked) and work schedules (target hours), but does not expose a pre-computed overtime balance via API. Overtime must be calculated as: `actual_hours - target_hours` for a given period, where target hours come from the employee's work schedule (stored as `weekly_working_hours` on the employee record or via the work schedules endpoint). For v1.3, compute overtime from attendance records + weekly_working_hours from employee data.

**Skills/qualifications:** Personio does not have a dedicated skills API. Skills are stored as custom attributes (e.g., a multi-select or list custom attribute named "Fertigkeiten" or similar). The specific attribute name is customer-defined. For v1.3, the implementation must know the custom attribute key name — make it configurable in Settings.

---

## KPI Formulas

### KPI #1: Überstunden im Vergleich Gesamtstunden Belegschaft (Overtime Ratio)

**Business question:** What percentage of total workforce hours are overtime hours?

**Formula:**
```
Overtime Ratio (%) = (Total Overtime Hours / Total Regular Target Hours) × 100

where:
  Total Overtime Hours    = Σ max(0, actual_hours_i - target_hours_i)  for all employees i in period
  Total Regular Target    = Σ target_hours_i  for all employees i in period
  actual_hours_i          = Σ (end_time - start_time - break_minutes/60) for all attendance records of employee i
  target_hours_i          = employee.weekly_working_hours × (working_weeks in period)
```

**Personio data sources:**
- Attendance records: `GET /v1/company/attendances?start_date=&end_date=`
- Target hours: `employee.weekly_working_hours` from `GET /v1/company/employees`

**Complexity:** MEDIUM — requires joining two data sources, handling part-time employees correctly, and managing employees who joined/left mid-period.

**Edge cases:**
- Part-time employees: their `weekly_working_hours` is already proportional (e.g., 20h vs 40h FTE) — no FTE conversion needed for the ratio
- Employees with zero attendance records: treat actual hours as 0 (they may be on leave — absence records should be used to distinguish, but for pure overtime ratio this is acceptable)
- Negative overtime (employee worked less than target): exclude from overtime numerator (cap at 0), but include target hours in denominator

**Display:** Percentage with 1 decimal place. Delta badges vs. Vorperiode + vs. Vorjahr (same pattern as sales KPIs). No time filter control — always shows the full current sync period.

---

### KPI #2: Krankheit im Vergleich Gesamtstunden Belegschaft (Sick Leave Ratio / Krankenquote)

**Business question:** What percentage of total workforce capacity was lost to sick leave?

**Formula (hours-based — more precise than days-based):**
```
Sick Leave Ratio (%) = (Total Sick Leave Hours / Total Work Capacity Hours) × 100

where:
  Total Sick Leave Hours    = Σ sick_leave_days_i × daily_work_hours_i  for all employees
  Total Work Capacity Hours = Σ target_hours_i  for all employees in period
  sick_leave_days_i         = count of sick leave absence days for employee i in period
  daily_work_hours_i        = employee.weekly_working_hours / 5
```

**Alternative (days-based — simpler, widely used in Germany):**
```
Krankenquote (%) = (Total Sick Days / Total Working Days × Total Employees) × 100
```

**Recommendation:** Use days-based formula if absence API returns day counts; hours-based if API returns hours directly. The `GET /v2/absence-periods` endpoint returns start_date + end_date, so day count = end_date - start_date + 1 (for full days). Match the calculation method to what Personio actually exposes.

**Personio data sources:**
- Absence periods filtered by absence type = "Krankheit" (sick leave): `GET /v2/absence-periods?absence_types[]=<sick_leave_type_id>`
- The sick leave absence type ID must be looked up from the customer's Personio configuration — make it configurable or auto-discover from `GET /v1/company/time-off-types`

**German benchmark:** National average Krankenquote is ~4–5% (DAK 2023: 5.5% record high). Above 6% triggers immediate attention per HR best practice.

**Complexity:** MEDIUM — absence type filtering requires knowing the customer's sick leave type ID; half-day absences need special handling.

**Display:** Percentage with 1 decimal place. Delta badges. German benchmark annotation (optional, configurable).

---

### KPI #3: Fluktuation (MA-Abgänge vs. gesamt MA)

**Business question:** What percentage of the workforce left during the period?

**Formula (industry standard — average headcount denominator):**
```
Fluktuationsrate (%) = (Anzahl Abgänge / Durchschnittlicher Personalbestand) × 100

where:
  Anzahl Abgänge                = employees with termination_date within the reporting period
  Durchschnittlicher Bestand    = (headcount_at_period_start + headcount_at_period_end) / 2
  headcount_at_period_start     = employees with hire_date ≤ period_start AND (termination_date IS NULL OR termination_date > period_start)
  headcount_at_period_end       = employees with hire_date ≤ period_end AND (termination_date IS NULL OR termination_date > period_end)
```

**Personio data sources:**
- `GET /v1/company/employees` with fields: `hire_date`, `termination_date`, `status`
- Important: The employees endpoint by default may only return active employees. Pass `include_deleted=true` or filter by status to capture terminated employees. Verify the exact Personio API parameter — community sources indicate terminated employees are accessible but may require explicit inclusion.

**Complexity:** MEDIUM — requires careful handling of the `include_deleted` parameter and status field; headcount snapshot logic requires two date-based filter passes.

**Display:** Percentage with 1 decimal place. Delta badges. No time filter — fixed to current sync period (typically current month or current year).

**Decision required:** What is the "reporting period" for fluctuation? Month-to-date, quarter-to-date, or year-to-date? Industry standard is annual. For v1.3, display year-to-date (rolling 12 months from last sync date) as default — simpler and most meaningful for annual HR reporting.

---

### KPI #4: MA Entwicklung — Anzahl MA mit neuer Fertigkeit (Employee Skill Development)

**Business question:** How many employees gained a new skill/qualification in the period?

**Formula:**
```
MA mit neuer Fertigkeit = count of employees where |skills_current| > |skills_at_period_start|

OR (simpler alternative):
Total Mitarbeiter mit Fertigkeiten = count of employees with at least one skill recorded
```

**Critical caveat:** Personio does not have a first-class skills or competencies API. Skills are stored as **custom employee attributes** — the specific attribute key is defined per company by the Personio admin. There is no change-history/audit-log for custom attributes accessible via API.

**Practical consequence:** It is not possible to determine via API which employees gained a new skill during a specific period unless:
1. The custom attribute stores a date-stamped entry (e.g., a list attribute where each entry includes a date), or
2. The sync captures snapshots at each sync cycle and compares them (delta detection between syncs).

**Recommendation for v1.3:** Implement as a **configurable custom attribute count metric**. On each sync, store the current skill count per employee in PostgreSQL. Compare current snapshot vs. previous month's snapshot to count employees with an increased skill count. Display as "X MA haben neue Fertigkeiten (seit letzter Periode)" — count of employees where skill count increased since last sync.

**Required configuration:** The custom attribute name/key for skills must be configurable in Settings (e.g., `"dynamic_4739"` or whatever key Personio assigns to the custom attribute in this company's account).

**Complexity:** HIGH — requires custom attribute configuration, snapshot diffing logic, and Personio admin coordination to identify the correct attribute key. This is the most implementation-complex of the 5 KPIs.

**Fallback if not configurable:** Display as "Fertigkeitserfassung nicht konfiguriert" with a link to Settings.

---

### KPI #5: Produktions-Mitarbeiterumsatz (Revenue per Production Employee)

**Business question:** What is the sales revenue generated per production employee?

**Formula:**
```
Produktions-Mitarbeiterumsatz (€) = ERP-Umsatz / Anzahl Produktionsmitarbeiter

where:
  ERP-Umsatz                     = total revenue from sales orders in reporting period (from existing PostgreSQL sales table)
  Anzahl Produktionsmitarbeiter   = count of active employees in Personio with department = "Produktion" (or configured department name)
```

**Personio data sources:**
- `GET /v1/company/employees` filtered by department (or filter post-fetch in Python)
- The department name for "Produktion" must be configurable in Settings — do not hardcode

**Sales data source:** Existing `orders` table in PostgreSQL (already populated via ERP file upload). Query: `SELECT SUM(umsatz_column) WHERE date IN period` — same query as existing sales dashboard but scoped to the same period as the Personio sync.

**Cross-source dependency:** This KPI is the only one that joins ERP data (file upload → PostgreSQL) with Personio data (API sync → PostgreSQL). Both data sets must be present for this KPI to render. If no ERP data has been uploaded, display em-dash fallback (same pattern as existing no-baseline cases).

**Complexity:** MEDIUM — the revenue query is already solved; the new part is Personio headcount with department filter.

**Display:** Currency (€) with locale formatting. Delta badges vs. Vorperiode + vs. Vorjahr. The period for ERP revenue should match the Personio sync period — document this alignment clearly.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| HR tab in top nav alongside Sales tab | Navigation pattern established by v1.2 Sales tab; users expect multi-domain app to have tab-level navigation | LOW | Rename existing "Dashboard" → "Sales", add "HR" tab. Uses existing wouter routing pattern. |
| 5 HR KPI cards with values | The explicit milestone goal — the entire HR tab is a dashboard of these 5 KPIs | HIGH | Each KPI card reuses existing shadcn card component + delta badge component from v1.2 |
| Delta badges on all 5 HR KPI cards | v1.2 established this as the standard on Sales; absence on HR cards would feel inconsistent | MEDIUM | Reuse exact same DeltaBadge component. Requires storing prior-period + prior-year snapshots in PostgreSQL |
| Manual "Daten aktualisieren" sync button | Users need on-demand control over Personio data freshness | LOW | Button triggers `POST /api/hr/sync` endpoint; TanStack Query invalidation on success |
| Freshness indicator showing last sync timestamp | Established pattern from v1.0 Sales dashboard — users need to know how stale the data is | LOW | Reuse existing freshness indicator component or create equivalent |
| Personio API credentials in Settings | Without credentials, the HR tab cannot function; users expect to configure this in Settings | MEDIUM | New Settings fields: API client_id, client_secret (masked input), sick leave absence type ID, production department name, skill custom attribute key |
| Configurable auto-sync interval in Settings | Users want data refreshed without manual intervention | MEDIUM | Background scheduler (APScheduler or equivalent) in FastAPI; interval options: 1h, 6h, 24h, manual-only |
| Error state when Personio API unreachable | API credentials may be wrong, Personio may be down — must communicate this clearly | LOW | KPI cards show "Verbindungsfehler" + retry button rather than empty/stale values |
| DE/EN i18n parity for all HR strings | Established in v1.0 — all user-facing strings must have both translations | MEDIUM | ~40–60 new i18n keys expected; HR-specific terminology (Fluktuation, Krankenquote, Überstunden) |

### Differentiators (Nice-to-Have, Worth Scoping Discussion)

| Feature | Value Proposition | Complexity | Recommendation |
|---------|-------------------|------------|----------------|
| German benchmark annotation on sick leave card | Shows whether 4.5% Krankenquote is above/below national average — contextualizes the number immediately | LOW | Include in v1.3 as a subtle annotation below the card value. Static threshold (configurable in code, not UI). |
| Auto-discover Personio absence types | List available absence types from API instead of requiring manual ID entry in Settings | MEDIUM | Include in v1.3 — makes configuration significantly less error-prone. `GET /v1/company/time-off-types` → dropdown in Settings |
| Auto-discover Personio departments | List available departments from employee data instead of manual text entry | MEDIUM | Include in v1.3 for the same reason. Derives from distinct `department` values in the fetched employee list. |
| Personio sync history log | Shows last N sync attempts with status (success/error/partial) | MEDIUM | Defer to v1.4 — useful for debugging but not required for v1.3 validation |
| HR trend chart (historical KPI series) | Line chart showing how sick leave / overtime / fluctuation evolve month over month | HIGH | Defer to v1.4 — requires storing historical snapshots, not just current + one prior period |
| Employee count card | Simple total headcount as a standalone KPI card | LOW | Include in v1.3 as a 6th card — trivially computed from employee sync, provides context for all ratio KPIs |

### Anti-Features (Explicitly Excluded)

| Feature | Why Requested | Why Excluded | Alternative |
|---------|---------------|--------------|-------------|
| Real-time Personio data (webhook-driven) | Freshest possible data without polling | Personio webhooks require a publicly accessible endpoint (not available for internal Docker Compose deployments without reverse proxy setup); also webhook scope for HR data is complex | Polling-based sync with configurable interval is the correct pattern for an internal intranet tool |
| Write-back to Personio (create/update records) | Two-way sync | Out of scope for a read-only KPI dashboard; adds OAuth write scopes, data integrity risk, and significant testing burden | Read-only API access only |
| Per-employee drill-down (who is sick, who is overtime) | Individual transparency | Privacy concern in a pre-auth app — individual attendance data visible to any team member without access control is a data protection issue | Aggregate-only KPIs; individual data deferred to post-Authentik (v2) |
| Absences calendar view | Visualize who is absent when | Wrong interface for a KPI dashboard; adds significant frontend complexity | Personio's built-in UI already provides this |
| Full Personio employee directory | Show all employee profiles | Not a KPI feature; duplicates Personio's own interface | Link to Personio app from the HR tab footer if navigation is needed |
| Historical backdating of KPI snapshots | Load 12 months of historical Personio data on first sync | First sync could pull months of data, but computing accurate prior-period deltas requires careful snapshot storage design; risk of Personio rate limiting on large initial fetch | On first sync, compute current values only; delta badges show em-dash fallback for no-baseline cases (same pattern as v1.2 em-dash for `allTime` preset) |
| APScheduler persistent job store (database-backed) | Survive container restarts with exact last-run time | Overengineering for an interval-based sync — if the container restarts, the next sync fires at the configured interval from restart time, which is acceptable for non-critical HR data | In-memory APScheduler; on restart, first sync fires at interval from boot time |

---

## Feature Dependencies

```
HR Tab (navigation)
  └──requires──> wouter route /hr added to App.tsx
  └──requires──> NavBar tab link "HR" added
  └──requires──> Personio credentials stored in Settings (otherwise tab shows config-required state)

Personio Sync (backend)
  └──requires──> Personio API credentials in PostgreSQL settings table (client_id, client_secret)
  └──requires──> New PostgreSQL tables: personio_employees, personio_attendances, personio_absences, personio_hr_snapshots
  └──requires──> New Alembic migration for above tables
  └──requires──> POST /api/hr/sync FastAPI endpoint
  └──requires──> Bearer token caching (24h validity) to avoid re-auth on every sync

KPI #1 (Overtime Ratio)
  └──requires──> personio_attendances table (actual hours)
  └──requires──> personio_employees table (weekly_working_hours for target)
  └──requires──> Overtime calculation logic: actual - target, capped at 0

KPI #2 (Sick Leave Ratio)
  └──requires──> personio_absences table filtered by sick leave absence type
  └──requires──> Absence type ID configurable in Settings (or auto-discovered)
  └──requires──> personio_employees table (weekly_working_hours for capacity denominator)

KPI #3 (Fluctuation)
  └──requires──> personio_employees table with hire_date + termination_date
  └──requires──> Terminated employee inclusion in sync (verify API parameter)

KPI #4 (Skill Development)
  └──requires──> personio_employees table with custom attributes stored as JSONB
  └──requires──> Skill attribute key configurable in Settings
  └──requires──> personio_hr_snapshots table for delta detection between sync cycles

KPI #5 (Revenue per Production Employee)
  └──requires──> personio_employees table with department filter
  └──requires──> Production department name configurable in Settings
  └──requires──> Existing orders table (ERP data — already present from v1.x)
  └──requires──> Period alignment: ERP revenue period must match Personio sync period

Delta Badges on HR KPIs
  └──requires──> personio_hr_snapshots table storing (kpi_name, value, period_label, computed_at)
  └──requires──> Prior-period and prior-year snapshot lookup at render time
  └──note──> Same DeltaBadge component from v1.2 — no new component needed

Auto-sync Scheduler
  └──requires──> APScheduler (or equivalent) added to FastAPI startup
  └──requires──> Sync interval stored in Settings table (existing table, new column)
  └──requires──> Manual sync button calls same sync logic as scheduler

Settings: Personio credentials
  └──requires──> New Settings fields (extend existing settings table or add personio_config table)
  └──requires──> Masked display of client_secret (show as ******* after save)
  └──requires──> Test connection button (calls Personio auth endpoint, returns success/fail)
```

---

## MVP Definition

### v1.3 Launch With

- [ ] HR tab in NavBar alongside renamed Sales tab — without navigation, nothing else is reachable
- [ ] Personio API credentials (client_id, client_secret) in Settings with masked display — prerequisite for all HR features
- [ ] Sick leave absence type ID and production department name configurable in Settings — needed for KPI #2 and KPI #5
- [ ] Personio sync: fetch and store employees, attendances, absences into PostgreSQL — the data foundation
- [ ] Manual "Daten aktualisieren" button with success/error feedback — on-demand control
- [ ] Configurable auto-sync interval (1h / 6h / 24h / manual-only) — core milestone requirement
- [ ] KPI #1: Overtime Ratio card with value + delta badges — core milestone requirement
- [ ] KPI #2: Sick Leave Ratio card with value + delta badges — core milestone requirement
- [ ] KPI #3: Fluctuation card with value + delta badges — core milestone requirement
- [ ] KPI #4: Skill Development card with configurable attribute key — core milestone requirement; show "nicht konfiguriert" fallback if key not set
- [ ] KPI #5: Revenue per Production Employee card with value + delta badges + em-dash fallback if no ERP data — core milestone requirement
- [ ] Freshness indicator showing last Personio sync timestamp
- [ ] Error state cards when Personio is unreachable or credentials invalid
- [ ] Full DE/EN i18n for all HR strings

### Add After v1.3 Validation

- [ ] Auto-discover absence types dropdown in Settings — reduces config friction; trigger: user feedback on Settings UX
- [ ] Employee count card (6th KPI) — trigger: users find ratio KPIs hard to interpret without absolute headcount context
- [ ] Personio sync history/log — trigger: debugging requests

### Future / v2+

- [ ] Per-employee drill-down — requires Authentik auth (data protection)
- [ ] HR trend chart (12-month historical series) — requires historical snapshot storage design
- [ ] Personio webhook-driven sync — requires public endpoint (reverse proxy, domain) not available in Docker-internal v1
- [ ] Write-back to Personio — requires write OAuth scopes, data integrity design

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| HR tab navigation | HIGH | LOW | P1 |
| Personio credentials in Settings | HIGH | MEDIUM | P1 |
| Personio sync (employees + attendances + absences) | HIGH | HIGH | P1 |
| KPI #1: Overtime Ratio | HIGH | MEDIUM | P1 |
| KPI #2: Sick Leave Ratio | HIGH | MEDIUM | P1 |
| KPI #3: Fluctuation | HIGH | MEDIUM | P1 |
| KPI #4: Skill Development | MEDIUM | HIGH | P1 (required by milestone) |
| KPI #5: Revenue per Production Employee | HIGH | MEDIUM | P1 (required by milestone) |
| Delta badges on all HR KPIs | HIGH | MEDIUM | P1 |
| Auto-sync scheduler | MEDIUM | MEDIUM | P1 |
| Manual sync button | HIGH | LOW | P1 |
| Error state handling | HIGH | LOW | P1 |
| DE/EN i18n parity | HIGH | MEDIUM | P1 |
| Freshness indicator | MEDIUM | LOW | P1 |
| Auto-discover absence types | MEDIUM | LOW | P2 |
| Employee count card | MEDIUM | LOW | P2 |
| Sync history log | LOW | MEDIUM | P3 |
| HR trend chart | HIGH | HIGH | P3 (v2+) |

**Priority key:** P1 = v1.3 scope, P2 = add after v1.3 validation, P3 = v2+

---

## Implementation Notes by Feature Area

### 1. PostgreSQL Schema for Personio Data

Four new tables are required:

- `personio_employees` — one row per employee per sync: id, personio_id, first_name, last_name, department, position, status, hire_date, termination_date, weekly_working_hours, custom_attributes (JSONB), synced_at
- `personio_attendances` — one row per attendance record: id, personio_employee_id, date, start_time, end_time, break_minutes, actual_hours (computed on insert), synced_at
- `personio_absences` — one row per absence period: id, personio_employee_id, absence_type_id, absence_type_name, start_date, end_date, days_count, synced_at
- `personio_hr_snapshots` — computed KPI values: id, kpi_name, value, period_label, computed_at (used for delta badge lookups)

On each sync: truncate and re-insert (simpler than upsert for v1.3); retain snapshot history rows (never truncate snapshots).

### 2. Sync Architecture

The sync is triggered by: (a) manual button click → `POST /api/hr/sync`, (b) APScheduler job at configured interval.

Sync sequence:
1. Authenticate with Personio → cache bearer token (in-memory, TTL 23h to be safe)
2. `GET /v1/company/employees` → store to `personio_employees`
3. `GET /v2/absence-periods` for rolling 13 months → store to `personio_absences`
4. `GET /v1/company/attendances` for rolling 13 months → store to `personio_attendances`
5. Compute all 5 KPI values for current period + prior period + prior year → store to `personio_hr_snapshots`
6. Update `settings.last_hr_sync_at` timestamp
7. Return sync summary (employees synced, absences synced, attendances synced, errors if any)

Pulling 13 months of data on every sync is acceptable given the small team sizes this app targets (internal use, small group per PROJECT.md). For very large companies, add incremental sync using `updated_from` filter — but this is an edge case for v1.3.

### 3. Bearer Token Caching

Token is valid 24h. Cache in a module-level variable (or FastAPI app state) with an expiry timestamp. Before any Personio API call, check if token is present and not expired. Re-authenticate if expired. Do not store the token in PostgreSQL — in-memory is sufficient and avoids plaintext credential storage in the database.

### 4. APScheduler Integration

Use `APScheduler` (already widely used with FastAPI) with `AsyncIOScheduler`. Add to FastAPI `lifespan` context manager (startup/shutdown). Read interval from settings on each reschedule (allow dynamic interval changes from Settings without container restart).

```python
# Example — interval configurable from settings
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = await get_settings()
    if settings.hr_sync_interval_hours > 0:
        scheduler.add_job(sync_personio, 'interval', hours=settings.hr_sync_interval_hours)
    scheduler.start()
    yield
    scheduler.shutdown()
```

### 5. KPI #4 Custom Attribute Approach

The `custom_attributes` JSONB column on `personio_employees` stores the full custom attribute map from the Personio API response. The skill attribute key (e.g., `"dynamic_4739"`) is stored in Settings. On KPI computation:

1. Read all employees from `personio_employees` where synced_at = latest sync
2. For each employee, extract `custom_attributes[skill_key]` — this is a list (or null)
3. Count the list length as `current_skill_count`
4. Compare with `custom_attributes[skill_key]` from the previous snapshot in `personio_employees` where synced_at = prior sync
5. Count employees where `current_skill_count > prior_skill_count`

This approach works without Personio exposing a history API — the app creates its own history by preserving prior sync records.

### 6. Revenue per Production Employee Period Alignment

The ERP revenue is date-filtered (existing sales query infrastructure). The Personio production employee count is a point-in-time headcount (active employees with department = configured department, as of last sync date).

For v1.3, use: revenue for the current calendar year (or last 12 months) ÷ current production headcount. Document this as "Produktions-MA zum Stichtag der letzten Synchronisierung". The period alignment is inherently approximate — this is acceptable for an internal KPI dashboard. A more precise approach (average headcount over the revenue period) can be added in v2.

---

## Sources

- [Personio Developer Hub — Getting Started](https://developer.personio.de/docs/getting-started-with-the-personio-api)
- [Personio API — List Attendances](https://developer.personio.de/v1.0/reference/get_company-attendances)
- [Personio API — List Employees](https://developer.personio.de/v1.0/reference/get_company-employees)
- [Personio API — List Absence Periods v2](https://developer.personio.de/reference/get_v2-absence-periods)
- [Personio API — Authentication](https://developer.personio.de/reference/authentication)
- [Personio Changelog — Rate Limits on GET Employees (May 2024)](https://developer.personio.de/changelog/rate-limits-on-get-employees-endpoint-may-6-2024)
- [Personio API — Employee Custom Attribute Types](https://developer.personio.de/changelog/employee-api-custom-attribute-types)
- [Overtime Ratio KPI Definition — OKRify](https://okrify.com/overtime-ratio-percentage/)
- [Sick Leave / Absenteeism Rate — Geckoboard](https://www.geckoboard.com/best-practice/kpi-examples/absence-rate/)
- [Calculate Sickness Rate — Absentify](https://absentify.com/blog/calculate-sickness-rate)
- [German Sick Leave Context — DataPulse Research](https://www.datapulse.de/en/sick-leave-europe-comparison/)
- [Employee Turnover Rate Formula — Klipfolio](https://www.klipfolio.com/resources/kpi-examples/human-resources/employee-turnover-rate)
- [Employee Turnover KPIs — NetSuite](https://www.netsuite.com/portal/resource/articles/human-resources/employee-turnover-kpis-metrics.shtml)
- [Revenue per Employee — AIHR](https://www.aihr.com/blog/revenue-per-employee/)
- [Revenue per Employee — Personio HR Lexicon](https://www.personio.com/hr-lexicon/revenue-per-employee/)
- [HR KPIs Guide — AIHR](https://www.aihr.com/blog/human-resources-key-performance-indicators-hr-kpis/)
- [Learning & Development KPIs — AIHR](https://www.aihr.com/blog/learning-and-development-kpis/)
- [Personio API Integration Step-by-Step — Bindbee](https://bindbee.dev/blog/personio-api-guide)
- [HR Personnel Figures — ZEP](https://www.zep.de/en/blog/hr-numbers-figures)

---

*Feature research for: KPI Light v1.3 HR KPI Dashboard & Personio-Integration*
*Researched: 2026-04-12*
