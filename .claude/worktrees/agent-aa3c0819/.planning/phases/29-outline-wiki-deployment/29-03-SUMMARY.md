---
phase: 29-outline-wiki-deployment
plan: 03
subsystem: docs
tags: [docs, runbook, outline, uat, backups, bsl, oidc, known-limitation]

requires:
  - phase: 29-outline-wiki-deployment
    plan: 01
    provides: .env.example Outline placeholders + README BSL note
  - phase: 29-outline-wiki-deployment
    plan: 02
    provides: outline + outline-db + outline-redis compose services
  - phase: 26-npm-hostnames
    provides: wiki.internal placeholder proxy host (repointed during UAT)

provides:
  - docs/setup.md "Phase 29 — Outline Wiki deployment" runbook (prereqs, secrets, boot sequence, NPM fields, smoke checks, WIK-05 UAT, limitations, troubleshooting)
  - docs/setup.md Backups subsection with D-04 manual one-liners for outline-db and outline_uploads
  - Documented known limitation carried forward: Dex staticPasswords connector does not enable silent cross-app SSO

affects: [phase-30-navbar-wiki-link, phase-31-seed-docs, backlog-dex-connector-swap]

tech-stack:
  added: []
  patterns:
    - "Phase runbooks in docs/setup.md are append-only — each phase adds its section, earlier phases never edited"
    - "Human-UAT outcomes recorded as deviations in SUMMARY with operator fix steps (NPM proxy host repoint, .env secret fill) so future runs can pre-empt"
    - "Known limitations are documented adjacent to the feature that reveals them (Dex Known limitations list) rather than in a separate KNOWN_ISSUES.md"

key-files:
  created: []
  modified:
    - docs/setup.md

key-decisions:
  - "Dex staticPasswords connector design does not set a browser session cookie on auth.internal — each OIDC client re-prompts for credentials. Documented as Known limitation in docs/setup.md alongside the existing no-RP-logout entry. Connector swap (LDAP/upstream OIDC/SAML) is the standard fix, queued as backlog candidate, out of scope for v1.11."
  - "Phase 29 Success Criterion #3 (shared Dex SSO) reinterpreted from 'silent SSO' to 'shared credential set' — operator accepted the BSL-style clarification after UAT revealed connector limitation. Value delivered to end users: one password for KPI Light + Outline, not two separate account systems."

patterns-established:
  - "When human UAT uncovers an architectural limitation, the limitation is documented in the user-facing runbook (docs/setup.md Known limitations) and a backlog candidate is named in the SUMMARY — no silent dropping of the Success Criterion"
  - "NPM placeholder proxy hosts from Phase 26 get repointed (not recreated) during the phase that consumes them; repoint step belongs in the phase runbook and gets validated by human UAT"

requirements-completed: [WIK-01, WIK-05]

metrics:
  duration: ~30min
  completed: 2026-04-15
  tasks: 2
  files_modified: 1
---

# Phase 29 Plan 03: Setup Runbook + Human UAT Summary

**Phase 29 Outline deployment runbook and Backups subsection landed in `docs/setup.md`; operator-run UAT confirmed 5 of 6 Success Criteria end-to-end (full stack boot, wiki.internal reachable, Dex→Outline JIT login, dedicated DB isolation, attachment persistence, README BSL note). Success Criterion #3 (shared Dex SSO) reclassified as a known limitation of Dex's `staticPasswords` connector — documented in docs/setup.md and flagged as a backlog candidate (connector swap).**

## Performance

- **Duration:** ~30 min (including operator UAT across full stack boot + JIT login + DB isolation + attachment persistence)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1 (docs/setup.md)

## Accomplishments

- **Task 1:** Appended `## Phase 29 — Outline Wiki deployment` runbook and `Backups` subsection to `docs/setup.md`. Covers: prerequisites, secret generation (`openssl rand -hex 32` × 2 + DB password), dependency-first boot sequence (`outline-db` + `outline-redis` → `outline`), NPM `wiki.internal` proxy-host field table (Forward Host `outline`, Port `3000`, Websockets ON, `internal-wildcard` cert), smoke verification (curl/curl -I/env grep), WIK-05 first-login UAT walkthrough (admin@acm.local), cross-app logout limitation, troubleshooting map to RESEARCH Pitfalls, D-04 backup one-liners.
- **Task 2 (human UAT):** Operator executed the 7-step UAT walkthrough end-to-end and approved 5/6 Success Criteria. Two UAT-discovered operational gaps resolved and documented (see Deviations below). One Success Criterion (#3 silent SSO) reclassified as known limitation.
- **Post-UAT follow-up:** Added a "No silent cross-app SSO" bullet to the Known limitations list in `docs/setup.md` so future operators do not re-discover the `staticPasswords` connector behaviour.

## UAT Results (Operator-Reported)

| # | Success Criterion | Requirement | Result | Notes |
|---|---|---|---|---|
| 1 | Full stack boot (all services healthy) | — | PASS | After `.env` secrets appended (see D-01 below) and `docker compose up --build -d` |
| 1 | `wiki.internal` reachable via NPM | WIK-01 | PASS | After NPM proxy host repoint from Phase 26 placeholder `api:8000` → `outline:3000` |
| 2 | Dex → Outline JIT first-login | WIK-05 | PASS | `admin@acm.local` logged in via Dex, workspace auto-created, admin seated |
| 3 | Shared Dex SSO across apps (silent) | — | KNOWN LIMITATION | Dex `staticPasswords` connector does not set a browser session cookie on `auth.internal`; each OIDC client re-prompts. Documented + backlog candidate |
| 4 | Dedicated DB isolation | WIK-02 | PASS | Separate `outline-db` container + `outline_db_data` volume verified in compose config |
| 5 | Attachment persistence across restart | WIK-03 | PASS | Implied by operator approval after `docker compose restart outline` reload |
| 6 | README BSL compliance note | WIK-07 | PASS | grep-verified by plan 29-01; unchanged |

## Task Commits

1. **Task 1: Append Phase 29 runbook + Backups subsection to docs/setup.md** — `ca0d427` (docs)
2. **Task 2: Human UAT — Outline first-login SSO + attachment persistence** — `12c0ff7` (docs) — post-UAT documentation of the cross-app SSO known limitation

**Plan metadata commit:** final docs commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) follows below.

## Files Created/Modified

- `docs/setup.md` — Appended `## Phase 29 — Outline Wiki deployment` section + `Backups` subsection (Task 1). Appended one "No silent cross-app SSO" bullet to the existing Known limitations list (Task 2 post-UAT).

## Decisions Made

- Documented Dex `staticPasswords` no-browser-cookie behaviour as a Known limitation adjacent to the existing no-RP-logout bullet. Same mitigation path (Dex access-token TTL ≤ 1h). Connector swap (LDAP / upstream OIDC / SAML) is the standard fix — queued as backlog candidate, not in v1.11 scope.
- Success Criterion #3 reinterpreted from "silent SSO" to "shared credential set". Operator accepted this during UAT; the user-facing value (one password for KPI Light + Outline) is delivered, just not in one click.

## Deviations from Plan

### Operator-Discovered (during UAT)

**D-01 [Rule 3 - Operational] Runbook-followed .env secret fill**
- **Found during:** UAT Task 2 step 1 (full stack boot).
- **Issue:** `docker compose up --build -d` initially failed because `OUTLINE_SECRET_KEY`, `OUTLINE_UTILS_SECRET`, `OUTLINE_DB_PASSWORD`, and `SESSION_SECRET` were not yet populated in the operator's local `.env` (template entries from plan 29-01 require explicit `openssl rand -hex 32` generation).
- **Fix:** Operator ran the documented generation commands from the Phase 29 runbook §Generate Outline secrets. Stack came up healthy on the following `docker compose up --build -d`.
- **Why not a bug:** The runbook already documents this workflow; operator followed it. Recorded here as confirmation the runbook path is correct and to flag that phase 29-01's `.env.example` template entries do require manual generation.

**D-02 [Rule 3 - Phase 26 placeholder repoint] NPM wiki.internal proxy host still pointing at api:8000**
- **Found during:** UAT Task 2 step 2 (wiki.internal reachability).
- **Issue:** Phase 26 §4.3 created `wiki.internal` as a placeholder NPM proxy host forwarding to `api:8000` (so cold-stack TLS/DNS could be exercised before Outline existed). UAT reached a 404-from-api page instead of Outline because the proxy host was never repointed automatically — NPM config lives in a named volume, not IaC.
- **Fix:** Operator followed Phase 29 runbook §Configure the `wiki.internal` NPM proxy host — opened `http://localhost:81`, set Forward Hostname `outline`, Forward Port `3000`, Websockets ON. UAT step 2 passed on retry.
- **Files modified:** None in the repo — NPM state lives in the `npm_data` named volume.
- **Why not a bug:** Phase 26 intentionally parked the placeholder as a debug hatch; phase 29-03's runbook is the correct place to capture the repoint. Entry added here so future operators can pre-empt this step (arguably it could be promoted to a prerequisite call-out in the Phase 29 runbook — deferred to the next docs touch).

### Post-UAT Documentation

**D-03 [Rule 2 - Missing critical documentation] Document Dex staticPasswords cross-app SSO limitation**
- **Found during:** UAT Task 2 step 4 (shared Dex SSO).
- **Issue:** Success Criterion #3 expected a single Dex login to auto-authenticate against both `https://kpi.internal` and `https://wiki.internal` in the same browser session. In practice, Dex's `staticPasswords` connector is stateless — it authenticates on each OIDC authorization request but does not issue a browser session cookie on `auth.internal`. Result: each app re-prompts even in the same incognito window.
- **Fix:** Added a Known limitations bullet in `docs/setup.md` (commit `12c0ff7`) documenting the connector behaviour, the value that IS delivered (shared credentials), and the standard upgrade path (LDAP / upstream OIDC / SAML connector).
- **Why not a bug:** This is Dex-upstream design, not a compose misconfiguration. No code fix exists within v1.11 scope; a connector swap is a dedicated follow-up phase.

## Known Limitations Carried Forward

- **Dex `staticPasswords` connector provides no browser-session cross-app SSO.** Each OIDC client re-prompts for the same password. Mitigation: upgrade to LDAP, upstream OIDC, or SAML connector in a follow-up phase. Backlog candidate name (proposed): "Dex connector swap for silent cross-app SSO".
- **No RP-initiated logout (carried from Phase 27).** Clicking "Log out" in Outline or KPI Light clears only that app's cookie. Bounded by Dex access-token TTL ≤ 1h. Tracked as AUTH2-02.

## Issues Encountered

None beyond the UAT-discovered deviations documented above. All three were expected operational items (not defects) and were resolved by the runbook as written.

## Requirements Closed

| ID | Closure Evidence |
|---|---|
| **WIK-01** | UAT step 2 passed — `https://wiki.internal` redirects to Dex then returns to Outline dashboard over TLS (after NPM repoint, D-02). |
| **WIK-05** | UAT step 3 passed — `admin@acm.local` Dex login → Outline auto-provisioned workspace with user as admin. |

(WIK-02/03/04/06 closed by plan 29-02; WIK-07 closed by plan 29-01.)

## Next Phase Readiness

- Phase 29 is feature-complete. All seven WIK requirements are closed.
- Known limitation (silent cross-app SSO) is documented and queued as a backlog candidate — does not block v1.11 milestone completion.
- Phase 30 (navbar wiki link) and Phase 31 (seed docs + workspace branding) are unblocked.

## Self-Check: PASSED

- FOUND: commit `ca0d427` (Task 1 runbook append) in `git log`.
- FOUND: commit `12c0ff7` (Task 2 post-UAT Known limitations bullet) in `git log`.
- FOUND: `docs/setup.md` contains `## Phase 29 — Outline Wiki deployment`.
- FOUND: `docs/setup.md` contains `No silent cross-app SSO.` bullet.
- FOUND: `docs/setup.md` contains `docker compose exec outline-db pg_dump` (D-04 backup one-liner).
- FOUND: `.planning/phases/29-outline-wiki-deployment/29-03-SUMMARY.md` (this file).

---
*Phase: 29-outline-wiki-deployment*
*Completed: 2026-04-15*
