# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Branding & Settings** — Phases 4–7 (shipped 2026-04-11) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Period-over-Period Deltas** — Phases 8–11 (shipped 2026-04-12) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 HR KPI Dashboard & Personio-Integration** — Phases 12–16 (shipped 2026-04-12) — [archive](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 Navbar & Layout Polish** — Phase 17 (shipped 2026-04-12) — [archive](milestones/v1.4-ROADMAP.md)
- 🚧 **v1.5 Segmented Controls** — Phase 18 (in progress)

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

### 🚧 v1.5 Segmented Controls (In Progress)

**Milestone Goal:** Unify all toggle/tab controls into a consistent pill-shaped segmented control style.

- [ ] **Phase 18: Segmented Controls** — Reusable SegmentedControl component applied to all 4 toggle/tab controls with i18n parity

## Phase Details

### Phase 18: Segmented Controls
**Goal**: Users see a visually consistent pill-shaped segmented control for every toggle and tab in the application
**Depends on**: Phase 17
**Requirements**: SEG-01, SEG-02, SEG-03, SEG-04, SEG-05, SEG-06
**Success Criteria** (what must be TRUE):
  1. A reusable SegmentedControl component renders a pill-shaped container with rounded ends, dark fill on the active segment, and light background on inactive segments
  2. Sales/HR tab navigation in the navbar uses the segmented control instead of the previous tab/underline style
  3. Date range presets in the SubHeader use the segmented control instead of individual buttons
  4. Balken/Linie chart type toggle and DE/EN language toggle both use the segmented control
  5. All segmented control labels display correctly in both DE and EN with no missing or broken translation keys
**Plans**: 2 plans
Plans:
- [ ] 18-01-PLAN.md — Create reusable SegmentedControl component
- [ ] 18-02-PLAN.md — Integrate SegmentedControl into all 5 consumers
**UI hint**: yes

## Progress

**Execution Order:**
Phase 18 is the sole phase in v1.5.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–3 | v1.0 | 10/10 | Complete | 2026-04-11 |
| 4–7 | v1.1 | 19/19 | Complete | 2026-04-11 |
| 8–11 | v1.2 | 10/10 | Complete | 2026-04-12 |
| 12–16 | v1.3 | 10/10 | Complete | 2026-04-12 |
| 17 | v1.4 | 2/2 | Complete | 2026-04-12 |
| 18 | v1.5 | 0/? | Not started | - |
