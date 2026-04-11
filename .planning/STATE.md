---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Branding & Settings
status: executing
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-04-11T11:30:34.265Z"
last_activity: 2026-04-11
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 78
---

# Project State: KPI Light

**Last updated:** 2026-04-11
**Session:** v1.1 Branding & Settings — roadmap created

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-11 after v1.0 milestone shipped)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 05 — frontend-plumbing-themeprovider-and-navbar

---

## Current Position

Phase: 05 (frontend-plumbing-themeprovider-and-navbar) — EXECUTING
Plan: 3 of 3
**Milestone:** v1.1 Branding & Settings
**Phase:** 5 of 7 (frontend plumbing — themeprovider and navbar)
**Plan:** 05-03 (NavBar logo + brand) — next
**Status:** Executing Phase 05
**Last activity:** 2026-04-11

Progress: [█████████░] 89% (8/9 plans)

---

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
- Average duration: — (no plans yet)
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

---
| Phase 04-backend-schema-api-and-security P01 | 3min | 2 tasks | 5 files |
| Phase 04-backend-schema-api-and-security P02 | 3min | 2 tasks | 3 files |
| Phase 04-backend-schema-api-and-security P03 | 5min | 2 tasks | 2 files |
| Phase 04-backend-schema-api-and-security P05 | 4min | 2 tasks | 4 files |
| Phase 04-backend-schema-api-and-security P06 | 10min | 2 tasks | 2 files |
| Phase 05-frontend-plumbing-themeprovider-and-navbar P01 | 5min | 2 tasks | 5 files |
| Phase 05-frontend-plumbing-themeprovider-and-navbar P02 | 2min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- **v1.1 scoping:** Logo stored as bytea in Postgres (not filesystem) — avoids Docker volume complexity; self-contained with pg_dump backup
- **v1.1 scoping:** Hex input in ColorPicker; culori converts hex→oklch before API submission; backend stores as TEXT
- **v1.1 scoping:** `nh3==0.3.3` chosen for SVG sanitization (Rust-backed, pre-built wheels, no compiler in Docker)
- **v1.1 scoping:** No `i18next-browser-languageDetector` — server setting is the single source of truth; `changeLanguage()` called before first render
- [Phase 04-backend-schema-api-and-security]: Plan 04-01: nh3 upgraded to 0.3.4 (from STATE.md's 0.3.3); test harness uses lazy-import guard so collection survives partial tree across Wave 1 plans
- [Phase 04-backend-schema-api-and-security]: Plan 04-02: AppSettings singleton via CheckConstraint(id=1); migration duplicates defaults literally (no import of app.defaults) per D-18
- [Phase 04-backend-schema-api-and-security]: Plan 04-03: Pydantic belt-and-braces validator (blacklist before regex) for BRAND-09; local reset_settings override in test_color_validator.py isolates pure unit tests from parallel Wave 2 DB work
- [Phase 04-backend-schema-api-and-security]: Plan 04-05: /api/settings/* router wired (GET/PUT + logo POST/GET with weak ETag/304); engine.dispose() per-test fixture override unblocks shared asyncpg pool across test event loops
- [Phase 04-backend-schema-api-and-security]: Plan 04-06: Phase 4 smoke script + docker rebuild runbook landed; human verification approved (PASSED 16 / FAILED 0, rebuild SHAs matched). Runbook SVG bug fixed during verification: self-closing `<circle/>` is rewritten by nh3 html5ever and hits reject-on-mutation; explicit close-tag form required.
- [Phase 05-frontend-plumbing-themeprovider-and-navbar]: Plan 05-01: Settings type, fetcher, defaults, and useSettings hook plumbed; queryKey literal ['settings'] + staleTime Infinity per D-13; defaults duplicated verbatim from backend (D-16)
- [Phase 05-frontend-plumbing-themeprovider-and-navbar]: Plan 05-02: ThemeProvider gates children during isLoading with text-free skeleton (D-02); applyTheme iterates THEME_TOKEN_MAP to write 6 oklch CSS vars + document.title; Toaster kept outside provider per D-03; tsconfig.app.json gained ignoreDeprecations to unblock tsc -b on pre-existing baseUrl directive

### Security Gates (Phase 4 must-haves)

- SVG XSS: `nh3` sanitization required before any logo is persistable
- CSS injection: Pydantic `@field_validator` with strict regex (reject `;`, `}`, `{`, `url(`, `expression(`, quotes)
- Both are **non-negotiable** — cannot be retrofitted after the feature ships on a zero-auth app

### Open Blockers

None.

### Carry-forward Tech Debt (from v1.0)

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — tracked in archived `02-HUMAN-UAT.md`. Non-blocking.
- DASH-02 monthly-only: granularity toggle removed by user request; backend still supports daily/weekly/monthly.

---

## Session Continuity

**Last session:** 2026-04-11T11:30:34.262Z
**Stopped at:** Completed 05-02-PLAN.md
**Resume file:** None
