---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Navbar & Layout Polish
status: planning
stopped_at: Phase 17 context gathered
last_updated: "2026-04-12T16:24:13.430Z"
last_activity: 2026-04-12 — Roadmap created (1 phase, 7 requirements)
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: KPI Light

**Last updated:** 2026-04-12
**Session:** v1.4 Navbar & Layout Polish — roadmap created

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-12 after v1.4 milestone started)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 17 — Navbar & Layout Polish

---

## Current Position

Phase: 17 (not started)
Plan: —
**Milestone:** v1.4 Navbar & Layout Polish
**Status:** Roadmap created — ready to plan Phase 17
**Last activity:** 2026-04-12 — Roadmap created (1 phase, 7 requirements)

Progress: [░░░░░░░░░░] 0%

---

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.4)
- Average duration: — (no plans yet)
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

---
| Phase 12-hr-schema-personio-client P01 | 6min | 2 tasks | 6 files |
| Phase 12-hr-schema-personio-client P02 | 8min | 1 tasks | 2 files |
| Phase 13-sync-service-settings-extension P01 | 2m 22s | 2 tasks | 5 files |
| Phase 13-sync-service-settings-extension P02 | 2min | 2 tasks | 4 files |
| Phase 13-sync-service-settings-extension P03 | 8m | 2 tasks | 4 files |
| Phase 14-navigation-hr-tab-shell P01 | 5min | 2 tasks | 6 files |
| Phase 14-navigation-hr-tab-shell P02 | 10min | 2 tasks | 3 files |
| Phase 15 P01 | 3min | 2 tasks | 4 files |
| Phase 15 P02 | 3min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- **v1.4 scope:** Frontend-only milestone — no backend API changes required
- **v1.4 design:** Single phase (Phase 17) covering all 7 requirements; coarse granularity compression applied to tightly coupled navbar/layout changes
- **v1.3 constraint:** APScheduler runs in-process via FastAPI lifespan — single Uvicorn worker required (no `--workers > 1`); scheduler state is in-memory only
- **v1.3 constraint:** Personio credentials (client_id, client_secret) are write-only — never returned in GET /api/settings; masked display in Settings UI
- **v1.3 constraint:** No time filter on HR tab — user decision; HR tab shows current period only
- **v1.3 design:** Phase ordering: Schema → Sync Service → Nav Shell → KPI Cards → i18n; matches v1.1/v1.2 pattern
- [Phase 14-navigation-hr-tab-shell]: nav.dashboard renamed to nav.sales in both locale files (EN: Sales, DE: Vertrieb) — NAV-01 satisfied in Plan 01 (data layer) before NavBar component update in Plan 02
- [Phase 14-navigation-hr-tab-shell]: FreshnessIndicator gated on location === '/' || location === '/upload' — hidden on /hr and /settings
- [Phase 15]: Static delta labels for HR KPIs (vs. Vormonat / vs. Vorjahr) since HR tab has no time filter
- [Phase 16]: INTERVAL_OPTIONS inside component body — must be inside function body so `t()` re-evaluates on language change

### Pending Todos

None yet.

### Open Blockers

None.

### Carry-forward Tech Debt (from v1.0/v1.2)

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request; backend still supports daily/weekly/monthly

---

## Session Continuity

**Last session:** 2026-04-12T16:24:13.427Z
**Stopped at:** Phase 17 context gathered
**Resume file:** .planning/phases/17-navbar-layout-polish/17-CONTEXT.md
