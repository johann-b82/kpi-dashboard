# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Branding & Settings** — Phases 4–7 (shipped 2026-04-11) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Period-over-Period Deltas** — Phases 8–11 (shipped 2026-04-12) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 HR KPI Dashboard & Personio-Integration** — Phases 12–16 (shipped 2026-04-12) — [archive](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 Navbar & Layout Polish** — Phase 17 (shipped 2026-04-12) — [archive](milestones/v1.4-ROADMAP.md)
- ✅ **v1.5 Segmented Controls** — Phase 18 (shipped 2026-04-12) — [archive](milestones/v1.5-ROADMAP.md)
- 🔄 **v1.6 Multi-Select HR Criteria** — Phases 19–20 (active)

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
- [x] Phase 10: Frontend — Chart Prior-Period Overlay (2/2 plans) — completed 2026-04-12
- [x] Phase 11: i18n, Contextual Labels, and Polish (2/2 plans) — completed 2026-04-12

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
Requirements: [milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.3 HR KPI Dashboard & Personio-Integration (Phases 12–16) — SHIPPED 2026-04-12</summary>

- [x] Phase 12: HR Schema & Personio Client (2/2 plans) — completed 2026-04-12
- [x] Phase 13: Sync Service & Settings Extension (3/3 plans) — completed 2026-04-12
- [x] Phase 14: Navigation & HR Tab Shell (2/2 plans) — completed 2026-04-12
- [x] Phase 15: HR KPI Cards & Dashboard (2/2 plans) — completed 2026-04-12
- [x] Phase 16: i18n & Polish (1/1 plan) — completed 2026-04-12

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
Requirements: [milestones/v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)
Audit: [milestones/v1.3-MILESTONE-AUDIT.md](milestones/v1.3-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.4 Navbar & Layout Polish (Phase 17) — SHIPPED 2026-04-12</summary>

- [x] Phase 17: Navbar & Layout Polish (2/2 plans) — completed 2026-04-12

Full details: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)
Requirements: [milestones/v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.5 Segmented Controls (Phase 18) — SHIPPED 2026-04-12</summary>

- [x] Phase 18: Segmented Controls (2/2 plans) — completed 2026-04-12

Full details: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)
Requirements: [milestones/v1.5-REQUIREMENTS.md](milestones/v1.5-REQUIREMENTS.md)

</details>

### v1.6 Multi-Select HR Criteria (Phases 19–20)

- [ ] **Phase 19: Backend — Array Migration, API, and KPI Aggregation** - Migrate DB columns to JSON arrays, update Settings API to accept/return arrays, update HR KPI aggregation to filter with IN clauses
- [ ] **Phase 20: Frontend — Checkbox List UI and i18n** - Replace PersonioCard dropdowns with checkbox lists, wire array state to API, add i18n keys for all new labels

## Phase Details

### Phase 19: Backend — Array Migration, API, and KPI Aggregation
**Goal**: The backend fully supports arrays for all 3 Personio config fields — stored as JSON arrays, exchanged as arrays over the API, and applied as IN-filter queries in HR KPI aggregation
**Depends on**: Phase 18 (prior milestone complete)
**Requirements**: MIG-01, API-01, API-02, KPI-01, KPI-02, KPI-03, KPI-04
**Success Criteria** (what must be TRUE):
  1. Existing single-value config rows are automatically migrated to single-element JSON arrays on `docker compose up` — no manual data fix needed
  2. `GET /api/settings` returns arrays for `sick_leave_type_id`, `production_dept`, and `skill_attr_key`
  3. `PUT /api/settings` accepts arrays for those 3 fields and persists them correctly
  4. `GET /api/personio/options` continues to return all available absence types, departments, and skill attributes unchanged
  5. An HR KPI returns `is_configured=false` only when its array field is empty or null; a single-element array produces a KPI value
**Plans**: 2 plans
Plans:
- [x] 19-01-PLAN.md — Alembic migration + model + schema + router (arrays)
- [ ] 19-02-PLAN.md — KPI aggregation IN/OR filters

### Phase 20: Frontend — Checkbox List UI and i18n
**Goal**: Users can select multiple values for all 3 Personio config fields via checkbox lists in PersonioCard, with correct bilingual labels and round-trip persistence
**Depends on**: Phase 19
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. PersonioCard shows a scrollable checkbox list (not a dropdown) for each of the 3 Personio config fields, with one checkbox per available option
  2. Selecting multiple checkboxes and saving results in all selected values stored and re-checked on the next page load
  3. Deselecting all checkboxes for a field saves an empty array (not null or a stale single value)
  4. All checkbox list labels render correctly in both DE and EN without missing keys or fallback strings
**Plans**: 2 plans
Plans:
- [ ] 19-01-PLAN.md — Alembic migration + model + schema + router (arrays)
- [ ] 19-02-PLAN.md — KPI aggregation IN/OR filters
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–3 | v1.0 | 10/10 | Complete | 2026-04-11 |
| 4–7 | v1.1 | 19/19 | Complete | 2026-04-11 |
| 8–11 | v1.2 | 10/10 | Complete | 2026-04-12 |
| 12–16 | v1.3 | 10/10 | Complete | 2026-04-12 |
| 17 | v1.4 | 2/2 | Complete | 2026-04-12 |
| 18 | v1.5 | 2/2 | Complete | 2026-04-12 |
| 19 | v1.6 | 1/2 | In Progress|  |
| 20 | v1.6 | 0/TBD | Not started | - |
