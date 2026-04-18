---
phase: 28-kpi-light-oidc-integration
plan: 05
subsystem: docs
tags: [docs, runbook, oidc, dex, auth]
requires: [28-01, 28-02, 28-03, 28-04]
provides: [operator-runbook-phase-28]
affects: [docs/setup.md]
tech-stack:
  added: []
  patterns: [runbook-append-only, phase-section-per-milestone]
key-files:
  created: []
  modified:
    - docs/setup.md
decisions:
  - "Appended Phase 28 section verbatim from plan draft; no UAT-driven deviations from Plan 04 (NavBar labels unchanged)"
metrics:
  duration: 3min
  completed: 2026-04-15
requirements: [E2E-02, E2E-06]
---

# Phase 28 Plan 05: Operator Runbook — Phase 28 Auth Walkthrough Summary

Appended a self-contained Phase 28 section to `docs/setup.md` so an operator can reproduce E2E-02 (login→refresh→logout) and E2E-06 (DISABLE_AUTH dev flow) without touching `.planning/`.

## What Changed

- `docs/setup.md` grew by 92 lines at the tail — no edits to Phase 26/27 sections.
- New section covers: SESSION_SECRET generation, one-time Dex client secret confirmation, first-login walkthrough, Dex SSO ~1h logout limitation (D-08/D-09), DISABLE_AUTH=true dev bypass (including the expected WARNING log line and 503 on /api/auth/login), guarded routes reference (six routers + /health + /api/auth/* exceptions), and a troubleshooting table.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Append Phase 28 section to docs/setup.md | e7cd2a1 | docs/setup.md |

## Verification

- `grep -q "Phase 28 — KPI Light login via Dex" docs/setup.md` — PASS
- `grep -q "openssl rand -hex 32" docs/setup.md` — PASS
- `grep -q "DISABLE_AUTH=true" docs/setup.md` — PASS (3 occurrences)
- `grep -q "DO NOT use in production" docs/setup.md` — PASS
- `grep -q "end_session_endpoint" docs/setup.md` — PASS
- `grep -q "/api/auth/callback" docs/setup.md` — PASS
- `grep -c "^## Phase 28" docs/setup.md` == 1 — PASS
- All six guarded router prefixes listed — PASS
- Phase 26/27 sections untouched (append-only diff) — PASS

## Deviations from Plan

None — plan executed exactly as drafted. No UAT surfacing (from Plan 28-04) mandated content changes to NavBar label phrasing or endpoint paths.

## Decisions Made

- Append-only edit: preserved every byte of the pre-existing setup.md; the new Phase 28 section starts after the Known limitations block with a `---` separator, matching the Phase 27 section style.

## Self-Check: PASSED

- docs/setup.md — FOUND
- Commit e7cd2a1 — FOUND
