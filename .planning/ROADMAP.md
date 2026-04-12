# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Branding & Settings** — Phases 4–7 (shipped 2026-04-11) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Period-over-Period Deltas** — Phases 8–11 (shipped 2026-04-12) — [archive](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 HR KPI Dashboard & Personio-Integration** — Phases 12–16 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–3) — SHIPPED 2026-04-11</summary>

- [x] Phase 1: Infrastructure and Schema (2/2 plans) — completed 2026-04-10
- [x] Phase 2: File Ingestion Pipeline (4/4 plans) — completed 2026-04-10
- [x] Phase 3: Dashboard Frontend (4/4 plans) — completed 2026-04-11

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 Branding & Settings (Phases 4–7) — SHIPPED 2026-04-11</summary>

- [x] Phase 4: Backend — Schema, API, and Security (6/6 plans) — completed 2026-04-11
- [x] Phase 5: Frontend Plumbing — ThemeProvider and NavBar (3/3 plans) — completed 2026-04-11
- [x] Phase 6: Settings Page and Sub-components (4/4 plans) — completed 2026-04-11
- [x] Phase 7: i18n Integration and Polish (6/6 plans) — completed 2026-04-11

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
Requirements: [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.2 Period-over-Period Deltas (Phases 8–11) — SHIPPED 2026-04-12</summary>

- [x] Phase 8: Backend — Comparison Aggregation and Chart Overlay API (3/3 plans) — completed 2026-04-11
- [x] Phase 9: Frontend — KPI Card Dual Deltas (3/3 plans) — completed 2026-04-12
- [x] Phase 10: Frontend — Chart Prior-Period Overlay (2/2 plans) — completed 2026-04-11
- [x] Phase 11: i18n, Contextual Labels, and Polish (2/2 plans) — completed 2026-04-12

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
Requirements: [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

</details>

### 🚧 v1.3 HR KPI Dashboard & Personio-Integration (In Progress)

**Milestone Goal:** Extend the app from a Sales-only dashboard to a multi-domain KPI platform — 5 HR KPIs sourced from Personio, configurable auto-sync, and a new HR tab alongside the renamed Sales tab.

- [x] **Phase 12: HR Schema & Personio Client** — Alembic migration for HR tables, httpx Personio API client, write-only credential storage (completed 2026-04-12)
- [x] **Phase 13: Sync Service & Settings Extension** — APScheduler auto-sync, manual sync endpoint, raw data persistence, Settings fields for Personio config (completed 2026-04-12)
- [x] **Phase 14: Navigation & HR Tab Shell** — Rename Sales tab, add HR tab with sync freshness indicator (completed 2026-04-12)
- [ ] **Phase 15: HR KPI Cards & Dashboard** — All 5 KPI computations with delta badges, error state handling
- [ ] **Phase 16: i18n & Polish** — Full DE/EN parity for all v1.3 strings

## Phase Details

### Phase 12: HR Schema & Personio Client
**Goal**: The database has HR tables and the app can authenticate with Personio and store credentials securely
**Depends on**: Phase 11
**Requirements**: PERS-01, PERS-04
**Success Criteria** (what must be TRUE):
  1. Alembic migration creates HR tables (personio_employees, personio_attendances, personio_absences, personio_sync_meta) and the app starts cleanly against the migrated schema
  2. Personio client_id and client_secret can be saved in Settings — the values are masked on display and never returned in GET /api/settings responses
  3. The Personio httpx client can authenticate (fetch a bearer token) given valid credentials, and surfaces a clear error when credentials are invalid
**Plans:** 2/2 plans complete
Plans:
- [x] 12-01-PLAN.md — HR models, Alembic migration, Fernet encryption, Settings API credential support
- [x] 12-02-PLAN.md — Personio httpx client with token caching, exception hierarchy, and unit tests

### Phase 13: Sync Service & Settings Extension
**Goal**: Users can trigger a Personio data sync (manual or scheduled) and configure all sync parameters from Settings
**Depends on**: Phase 12
**Requirements**: PERS-02, PERS-03, PERS-04, PERS-05, PERS-06, SET-01, SET-02, SET-03, SET-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Daten aktualisieren" on the HR tab fetches employees, attendances, and absences from Personio and stores them in PostgreSQL, with success/error feedback visible to the user
  2. Auto-sync runs at the configured interval (1h / 6h / 24h) via APScheduler running in-process under FastAPI lifespan; selecting "manual-only" disables automatic syncing
  3. Settings page shows a sick-leave absence type dropdown populated from Personio absence types discovered via API
  4. Settings page shows a production department dropdown populated from employee department data
  5. Settings page includes a skill custom attribute key field (for KPI #4) and the auto-sync interval selector
**Plans:** 3/3 plans complete
Plans:
- [x] 13-01-PLAN.md — Models, schemas, migration, PersonioClient extensions, hr_sync.py service
- [x] 13-02-PLAN.md — APScheduler lifespan, sync router, settings router extensions, main.py wiring
- [x] 13-03-PLAN.md — Frontend PersonioCard, TypeScript types, draft hook extension

### Phase 14: Navigation & HR Tab Shell
**Goal**: Users can navigate between a renamed Sales tab and a new HR tab that shows sync freshness
**Depends on**: Phase 13
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. The existing "Dashboard" tab label is renamed to "Sales" in the NavBar
  2. A new "HR" tab appears in the NavBar and routes to the HR dashboard page
  3. The HR tab displays the timestamp of the last successful Personio sync as a freshness indicator
**Plans:** 2/2 plans complete
Plans:
- [x] 14-01-PLAN.md — Backend sync meta endpoint, frontend API plumbing, locale key updates
- [x] 14-02-PLAN.md — NavBar updates (Sales rename, HR link, conditional FreshnessIndicator) and HRPage component
**UI hint**: yes

### Phase 15: HR KPI Cards & Dashboard
**Goal**: The HR tab displays all 5 KPI cards with delta badges and handles error and edge cases correctly
**Depends on**: Phase 14
**Requirements**: HRKPI-01, HRKPI-02, HRKPI-03, HRKPI-04, HRKPI-05, HRKPI-06
**Success Criteria** (what must be TRUE):
  1. HR tab shows Overtime Ratio, Sick Leave Ratio, and Fluctuation KPI cards, each with dual delta badges (vs. Vorperiode + vs. Vorjahr)
  2. Skill Development KPI card displays correctly when a skill attribute key is configured; shows "nicht konfiguriert" fallback when no key is set
  3. Revenue per Production Employee KPI card shows the cross-source value (orders DB / Personio production employees); shows em-dash fallback when no ERP data is present
  4. All 5 KPI cards show an error state (not a crash) when Personio is unreachable or credentials are invalid
**Plans:** 2 plans
Plans:
- [ ] 15-01-PLAN.md — Backend: Pydantic schemas, HR KPI aggregation service, router, main.py wiring
- [ ] 15-02-PLAN.md — Frontend: API types, query keys, HrKpiCardGrid component, HRPage integration, locale strings
**UI hint**: yes

### Phase 16: i18n & Polish
**Goal**: All v1.3 UI strings are fully translated in both DE and EN with verified parity
**Depends on**: Phase 15
**Requirements**: I18N-01
**Success Criteria** (what must be TRUE):
  1. Every visible string on the HR tab (KPI labels, delta badges, sync feedback, error states, freshness indicator) renders correctly in both German and English
  2. Every Settings field added in v1.3 (Personio credentials, absence type, department, skill attribute key, sync interval) renders correctly in both languages
  3. Switching language via the NavBar toggle re-renders all v1.3 strings without a page refresh
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure and Schema | v1.0 | 2/2 | Complete | 2026-04-10 |
| 2. File Ingestion Pipeline | v1.0 | 4/4 | Complete | 2026-04-10 |
| 3. Dashboard Frontend | v1.0 | 4/4 | Complete | 2026-04-11 |
| 4. Backend — Schema, API, and Security | v1.1 | 6/6 | Complete | 2026-04-11 |
| 5. Frontend Plumbing — ThemeProvider and NavBar | v1.1 | 3/3 | Complete | 2026-04-11 |
| 6. Settings Page and Sub-components | v1.1 | 4/4 | Complete | 2026-04-11 |
| 7. i18n Integration and Polish | v1.1 | 6/6 | Complete | 2026-04-11 |
| 8. Backend — Comparison Aggregation and Chart Overlay API | v1.2 | 3/3 | Complete | 2026-04-11 |
| 9. Frontend — KPI Card Dual Deltas | v1.2 | 3/3 | Complete | 2026-04-12 |
| 10. Frontend — Chart Prior-Period Overlay | v1.2 | 2/2 | Complete | 2026-04-11 |
| 11. i18n, Contextual Labels, and Polish | v1.2 | 2/2 | Complete | 2026-04-12 |
| 12. HR Schema & Personio Client | v1.3 | 2/2 | Complete    | 2026-04-12 |
| 13. Sync Service & Settings Extension | v1.3 | 3/3 | Complete    | 2026-04-12 |
| 14. Navigation & HR Tab Shell | v1.3 | 2/2 | Complete    | 2026-04-12 |
| 15. HR KPI Cards & Dashboard | v1.3 | 0/2 | Not started | - |
| 16. i18n & Polish | v1.3 | 0/? | Not started | - |
