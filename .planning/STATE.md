---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Outline Wiki + Shared Auth (Dex)
status: executing
stopped_at: Completed 27-02-PLAN.md
last_updated: "2026-04-14T22:16:02.474Z"
last_activity: 2026-04-14
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
  percent: 0
---

# Project State: KPI Light

**Last updated:** 2026-04-14
**Session:** v1.11 Outline Wiki + Shared Auth (Dex) — milestone started, defining requirements

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-14 after v1.11 milestone started)

**Core value:** Upload a data file and immediately see sales/revenue KPIs visualized on a dashboard — zero friction from raw data to insight.

**Current focus:** Phase 27 — dex-idp-setup

---

## Current Position

Phase: 27 (dex-idp-setup) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-04-14

Progress: [          ] 0%

---

## Performance Metrics

**Velocity (v1.3–v1.6):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 18 P01 | SegmentedControl component | 1min | 1 | 1 |
| 18 P02 | SegmentedControl consumers | 4min | 2 | 5 |
| 19 P01 | Array migration + API | 3min | 2 | 4 |
| 19 P02 | KPI aggregation | 2min | 1 | 1 |
| 20 P01 | CheckboxList component | 3min | 2 | 6 |
| 20 P02 | PersonioCard + i18n | 5min | 2 | 4 |

*Updated after each plan completion*

---
| Phase 21 P01 | 5min | 1 tasks | 1 files |
| Phase 21 P03 | 4min | 2 tasks | 5 files |
| Phase 21 P04 | 0 | 1 tasks | 0 files |
| Phase 22-dark-mode-toggle-preference P01 | 2min | 2 tasks | 3 files |
| Phase 22-dark-mode-toggle-preference P02 | 1min | 2 tasks | 2 files |
| Phase 22-dark-mode-toggle-preference P03 | 3min | 2 tasks | 0 files |
| Phase 23-contrast-audit-fix P02 | 2min | 1 tasks | 1 files |
| Phase 23-contrast-audit-fix P01 | 40s | 3 tasks | 2 files |
| Phase 24-delta-label-unification P01 | 3h | 9 tasks | 5 files |
| Phase 25-page-layout-parity P02 | 2min | 1 tasks | 1 files |
| Phase 25-page-layout-parity P01 | 1min | 1 tasks | 1 files |
| Phase 25-page-layout-parity P03 | 30min | 1 tasks | 7 files |
| Phase 26-npm-hostnames P01 | 15min | 2 tasks | 4 files |
| Phase 26-npm-hostnames P02 | 10min | 2 tasks | 2 files |
| Phase 26-npm-hostnames P03 | 2min | 2 tasks | 2 files |
| Phase 27-dex-idp-setup P01 | 3min | 2 tasks | 2 files |
| Phase 27-dex-idp-setup P02 | 4min | 4 tasks | 3 files |

## Accumulated Context

### Decisions

- **v1.9 scope:** Frontend-only milestone — no backend changes needed
- **v1.9 design:** 3 phases — Phase 21 (theme tokens + component adaptation), Phase 22 (toggle + preference persistence), Phase 23 (contrast audit)
- **Phase 21 scope:** DM-01, DM-02, DM-03, DM-04 — theme infrastructure must land before toggle is useful
- **Phase 22 scope:** DM-05, DM-06, DM-07, DM-08 — reuse SegmentedControl; mirror localStorage pattern from language preference
- **Phase 23 scope:** DM-09, DM-10 — WCAG AA audit after both modes are functional
- **Tailwind v4:** Use class strategy for dark mode (add/remove `dark` class on `<html>`) — CSS-first config, no tailwind.config.js
- **ThemeProvider:** Existing provider already injects CSS variables; extend it to also manage dark class toggle and localStorage key
- [Phase 21]: Surface tokens removed as inline styles in dark mode so .dark CSS block wins; accent tokens always applied inline per DM-04
- [Phase 21]: MutationObserver on document.documentElement class attribute chosen for external .dark class detection
- [Phase 21]: chartDefaults.ts uses var(--color-*) form to match existing chart code convention
- [Phase 21]: axisProps spread with tick override pattern preserves per-component font sizes
- [Phase 21]: SalesTable.tsx build errors are pre-existing (out of scope for plan 03) — deferred to future plan
- [Phase 21]: UAT confirmed: all UI surfaces render correctly in dark mode; DM-04 and D-09 invariance checks passed; audit greps clean — Phase 21 complete
- [Phase 22-dark-mode-toggle-preference]: Pre-hydration inline IIFE in <head> before <style> eliminates FOUT; try/catch handles sandboxed localStorage
- [Phase 22-dark-mode-toggle-preference]: ThemeToggle self-manages state (no context); matchMedia listener gated by localStorage presence so localStorage wins permanently after first click (D-07); toggle mutates only .dark class, ThemeProvider MutationObserver (Phase 21) handles token re-application unchanged (D-13)
- [Phase 22-dark-mode-toggle-preference]: UAT approved: ThemeToggle redesigned from SegmentedControl to single Moon/Sun icon button during UAT (commit 40dc4ab); LanguageToggle bundled as UX follow-up (commits 517ac26, 5f8d4a6); DM-05 functional intent preserved though literal 'highlighted segment' sub-check retired
- [Phase 23-contrast-audit-fix]: Extend existing IIFE (not add a new one) to set --splash-bg and --splash-dot on documentElement before splash <style> is parsed — single source of truth for theme resolution
- [Phase 23-contrast-audit-fix]: --color-success token darkened to #15803d (green-700) — same hue, one shade darker, mode-invariant, white-on-color 5.02:1 PASS
- [Phase 23-contrast-audit-fix]: EmployeeTable active badge: text-foreground per D-06 (same-color-on-tinted-self cannot pass 4.5:1 at any shade)
- [Phase 23-contrast-audit-fix P03]: axe DevTools run skipped by operator on 2026-04-14 — recorded waiver in 23-AUDIT.md; D-12 automated-tool criterion deferred to Plan 23-05 re-run or final waiver; Plan 23-04 is now primary DM-10 evidence
- [Phase 23-contrast-audit-fix P04]: Both WebAIM manual verification (Task 1) and residual-fix pass (Task 2) waived by operator on 2026-04-14 — D-12 acceptance rests on deterministic fixes (Plans 23-01/02) + operator trust; phase proceeds to Plan 23-05 (code-cleanliness gate)
- [Phase 23-contrast-audit-fix P05]: Grep-clean gate passed (0 unexpected hex literals); Phase Pass section appended to 23-AUDIT.md with D-12 waiver — two criteria PASS (grep clean, splash IIFE), two WAIVED (axe, WebAIM); Phase 23 and v1.9 milestone closed
- [Phase 24-delta-label-unification]: Scope expansion: concrete prior-period labels (vsMonth/vsQuarter/vsYear templates) replace generic vs. prev. year on bottom row; thisYear collapsed to single top-slot YTD row; both approved during UAT
- [Phase 25-page-layout-parity]: Error-state fallback uses pb-8 not pb-32: no sticky ActionBar present in error state so 32-unit clearance is unnecessary
- [Phase 25-page-layout-parity]: Pre-existing HrKpiCharts.tsx + SalesTable.tsx build errors confirmed out-of-scope for plan 25-01; tsc --noEmit passes; build failures deferred to separate plan
- [Phase 25-page-layout-parity]: UAT approved UC-10: all four pages pass container parity, delta label survival DE/EN, no dashboard regressions
- [Phase 25-page-layout-parity]: embedded prop pattern established: PersonioCard and HrTargetsCard accept embedded=true to render as section subsections instead of standalone Card components
- [Phase 25-page-layout-parity]: sessionStorage lastDashboard tracking in NavBar: back button navigates to known last dashboard with contextual label (Back to Sales / Back to HR)
- [Phase 26-npm-hostnames]: Plan 26-01: NPM pinned to jc21/nginx-proxy-manager:2.11.3; single SAN mkcert cert for all *.internal hostnames; frontend healthcheck uses busybox wget --spider (alpine has no curl); depends_on.frontend.service_healthy gates NPM to close the 502 window on cold boot; certs/ gitignored, npm_data+npm_letsencrypt named volumes for persistence
- [Phase 26-npm-hostnames]: Plan 26-02: Vite HMR-over-WSS requires clientPort=443 + protocol='wss' + host=kpi.internal together in server.hmr; all three needed to reconnect through NPM. allowedHosts kept as explicit array (not true) to preserve Vite SSRF protection.
- [Phase 26-npm-hostnames]: Plan 26-02: host port bindings for frontend/api commented (not deleted) in docker-compose.yml — preserves zero-NPM debug hatch with inline why. NPM is now sole edge; dev matches prod (D-07).
- [Phase 26-npm-hostnames]: Plan 26-02: placeholder wiki.internal/auth.internal proxy hosts forward to api:8000 over http — yields working TLS padlock plus reachable 404, proves end-to-end DNS+TLS+docker-DNS, makes Phases 27/29 a one-field repoint.
- [Phase 26-npm-hostnames]: Plan 26-02 deviation: busybox wget in alpine resolves 'localhost' to ::1 first; frontend healthcheck switched to 127.0.0.1 (fix eab26c7 scoped to 26-01 where it originated). Loopback-healthcheck rule codified for future alpine-based services.
- [Phase 26-npm-hostnames]: Plan 26-03: docs/setup.md runbook + README Quickstart landed; preserved existing README content, updated stale :5173/:8000 Quick Start to NPM-edge reality (classed as Rule 2 correctness fix). All 5 INF requirements (01-05) have documented verification paths.
- [Phase 27-dex-idp-setup]: Plan 27-01: Issuer comment moved above the issuer line (not trailing) to satisfy exact-match verification regex; placeholders for bcrypt hashes, UUIDs, and client secrets intentionally left for plan 27-02 to substitute.
- [Phase 27-dex-idp-setup]: Plan 27-02: Dex v2.43.0 removed the hash-password subcommand — canonical bcrypt workflow is now python:3.12-alpine + bcrypt library (cost 10, $2b$10$ prefix); plan 27-03 runbook must inherit this
- [Phase 27-dex-idp-setup]: Plan 27-02: Dex service runs as user: root to work around UID 1001 vs root-owned named-volume mismatch for /data/dex.db; chown init sidecar deferred as optional hardening
- [Phase 27-dex-idp-setup]: Plan 27-02: NPM Advanced block (proxy_set_header X-Forwarded-Proto https + Host/X-Forwarded-For/X-Real-IP) is REQUIRED for Dex to emit https:// URLs in OIDC discovery behind NPM; operator-pasted via admin UI (Phase 26 D-09)

### Pending Todos

None.

### Open Blockers

None.

### Carry-forward Tech Debt (from v1.0/v1.2)

- Phase 2 human-UAT: 5 visual items (drag-drop spinner, toast, inline error list) — non-blocking
- DASH-02 monthly-only: granularity toggle removed by user request; backend still supports daily/weekly/monthly

---

## Session Continuity

**Last session:** 2026-04-14T22:15:11.682Z
**Stopped at:** Completed 27-02-PLAN.md
**Resume file:** None
