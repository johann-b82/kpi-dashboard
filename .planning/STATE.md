---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Sensor Monitor
status: Defining requirements
stopped_at: Completed 39-01-PLAN.md
last_updated: "2026-04-17T22:42:13.021Z"
last_activity: 2026-04-17 — Milestone v1.15 started
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 5
  completed_plans: 4
  percent: 0
---

# Project State: KPI Dashboard

**Last updated:** 2026-04-17
**Session:** v1.15 Sensor Monitor — milestone started

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-17)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** v1.15 Sensor Monitor — requirements to be defined

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-17 — Milestone v1.15 started

Progress: [ ] 0%

---

## Performance Metrics

**Velocity (v1.12):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| Phase 31 P01 | 300s | 1 task | 3 files |
| Phase 31 P02 | 111s | 2 tasks | 2 files |
| Phase 32 P01 | — | — | — |
| Phase 32 P02 | — | — | — |

*Updated after each plan completion*

---
| Phase 33-rendering-foundation P01 | 8min | 2 tasks | 11 files |
| Phase 33-rendering-foundation P01 | 600 | 2 tasks | 11 files |
| Phase 34-navigation-shell P01 | 600 | 2 tasks | 8 files |
| Phase 34-navigation-shell P02 | 360 | 2 tasks | 3 files |
| Phase 35 P02 | 600 | 2 tasks | 7 files |
| Phase 36 P02 | 138 | 2 tasks | 7 files |
| Phase 37-launcher-shell-auth-wiring P01 | 900 | 3 tasks | 5 files |
| Phase quick P260417-dzd | 75 | 2 tasks | 3 files |
| Phase quick P260417-e45 | 65 | 2 tasks | 6 files |
| Phase quick P260417-eb8 | 93 | 2 tasks | 6 files |
| Phase 38-backend-schema-scheduler P01 | 228 | 2 tasks | 6 files |
| Phase 38-backend-schema-scheduler P02 | 374 | 2 tasks | 6 files |
| Phase 38 P03 | 4m 17s | 4 tasks | 4 files |
| Phase 39 P01 | 3 min | 3 tasks | 12 files |

## Accumulated Context

### Decisions

- **v1.14 scope:** 1 phase (37), pure frontend — no backend routes, no new Docker services
- **Phase 37 (App Launcher):** iOS-style `/home` grid with role-aware tiles, login redirect update, PrivateRoute guard for `/home`, full DE/EN i18n, dark-mode via existing Tailwind token system, app name from Settings context
- **Coverage:** 10/10 REQs mapped to Phase 37, no orphans, no duplicates
- [Phase 37-launcher-shell-auth-wiring]: Active tile navigates to / (not /sales) — /sales route does not exist; Sales Dashboard served at root per App.tsx D-10
- [Phase 37-launcher-shell-auth-wiring]: LauncherPage uses <button> for active tile for keyboard accessibility; coming-soon tiles are aria-hidden divs
- [Phase quick]: Quick 260417-dzd: /home launcher hides NavBar center + docs/upload/settings links + SubHeader; main padding collapses to pt-16. Component-local chrome suppression pattern (isLauncher guard per component) preferred over App.tsx route-matching.
- [Phase quick]: Quick 260417-eb8: Launcher moved /home → /. Brand slot now a wouter Link → /. Settings gear always visible; docs + upload + segmented-control gated on !isLauncher. Tiles restructured to icon-only 120x120 + external centered label (iOS style).
- [Phase 38-backend-schema-scheduler]: Community strings Fernet-encrypted as BYTEA; reuse FERNET_KEY (no second key); SensorRead omits community entirely (write-only secret)
- [Phase 38-backend-schema-scheduler]: Two-table sensor schema: sensor_readings (successful polls only) + sensor_poll_log (every attempt) — separates data from liveness per PITFALLS M-4
- [Phase 38-backend-schema-scheduler]: pysnmp>=7.1.23,<8.0 (not pysnmp-lextudio which is deprecated); v3arch.asyncio import path
- [Phase 38-backend-schema-scheduler]: Router-level admin gate (APIRouter dependencies=) over per-endpoint, enforced by dep-audit test that walks dependant tree (SEN-BE-13)
- [Phase 38-backend-schema-scheduler]: poll_all(session, engine, *, manual=False) -> PollAllResult is the stable signature the scheduler will call in 38-03; poll_sensor is per-sensor exception boundary for PITFALLS M-3
- [Phase 38-backend-schema-scheduler]: POST /poll-now and /snmp-walk both wrapped in asyncio.wait_for(timeout=30); 504 on timeout; /poll-now mirrors Personio POST /api/sync blocking pattern
- [Phase 38-backend-schema-scheduler]: request.app.state.snmp_engine is the contract hand-off to 38-03 — router reads (503 if missing); lifespan populates
- [Phase 38]: Scheduler: module-level _engine ref over APScheduler kwargs — SnmpEngine may not pickle cleanly under MemoryJobStore; module-level ref matches existing singleton pattern and gives the scheduled job direct access without round-tripping through app.state
- [Phase 38]: reschedule_sensor_poll(0) removes the job entirely (Personio D-07 parity); >0 with missing job uses add_job with full guardrail kwargs; >0 with existing job uses reschedule_job; all wrapped in try/except with log.exception so a broken PUT /api/settings cannot leak scheduler internals
- [Phase 38]: docker-compose.yml api.command: --workers 1 literal kept alongside --reload (redundant in reload mode but load-bearing as CI grep guard and for production deploys that drop --reload)

### Pending Todos

- Plan Phase 37 via `/gsd:plan-phase 37`

### Open Blockers

None.

### Carry-forward Tech Debt

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request

---

## Session Continuity

**Last session:** 2026-04-17T22:42:13.018Z
**Stopped at:** Completed 39-01-PLAN.md
**Resume file:** None
