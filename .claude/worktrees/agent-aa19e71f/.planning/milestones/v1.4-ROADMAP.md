# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Branding & Settings** — Phases 4–7 (shipped 2026-04-11) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Period-over-Period Deltas** — Phases 8–11 (shipped 2026-04-12) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 HR KPI Dashboard & Personio-Integration** — Phases 12–16 (shipped 2026-04-12) — [archive](milestones/v1.3-ROADMAP.md)
- 🚧 **v1.4 Navbar & Layout Polish** — Phase 17 (in progress)

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

### v1.4 Navbar & Layout Polish (In Progress)

**Milestone Goal:** Refine navbar appearance and layout — smaller logo, underline-style tabs, upload icon in action area, reorganized sub-header with presets and freshness indicator.

- [x] **Phase 17: Navbar & Layout Polish** — Navbar visual overhaul, tab style, upload icon, sub-header reorganization, and i18n parity (completed 2026-04-12)

## Phase Details

### Phase 17: Navbar & Layout Polish
**Goal**: Users see a visually refined navbar with underline-style tab indicator, upload accessible via icon, and a reorganized sub-header that horizontally aligns date range presets with the freshness timestamp
**Depends on**: Phase 16
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, LAY-01, LAY-02, I18N-01
**Success Criteria** (what must be TRUE):
  1. Navbar logo is visibly smaller than before — does not dominate the navbar height
  2. Active tab is indicated by a blue underline; inactive tabs show as plain text with no background highlight or pill shape
  3. Upload tab is absent from tab navigation; upload is reachable via an icon in the navbar action area, positioned between the DE/EN toggle and the gear icon
  4. A horizontal separator line appears below the tab bar, and a sub-header row below it shows date range preset buttons left-aligned and the freshness timestamp right-aligned in the same horizontal row
  5. All new and modified navbar/layout UI strings are present in both DE and EN locale files with no missing keys
**Plans**: 2 plans
Plans:
- [x] 17-01-PLAN.md — DateRangeContext, NavBar updates (logo, tabs, upload icon)
- [x] 17-02-PLAN.md — SubHeader component, App.tsx layout wiring
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Navbar & Layout Polish | 2/2 | Complete    | 2026-04-12 |
