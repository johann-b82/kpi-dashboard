---
phase: 66-kill-me-py
plan: "03"
subsystem: infra
tags: [ci, github-actions, grep-guard, regression-prevention, mig-auth-03]

requires:
  - phase: 66-kill-me-py (plan 01)
    provides: AuthContext migrated to directus.request(readMe(...)) — no /api/me calls remain in frontend/src/

provides:
  - Pre-stack CI guard step that fails on any '"/api/me"' literal in frontend/src/
  - Fast-fail regression prevention for MIG-AUTH-03 in .github/workflows/ci.yml

affects:
  - Any future PR that touches frontend/src/ auth code
  - Phase 67+ endpoint migrations (pattern established for per-endpoint CI guards)

tech-stack:
  added: []
  patterns:
    - "Pre-stack CI grep guard: inline if/grep/exit step placed before docker compose up for <1s fast fail on literal-string regressions"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Inline run: block chosen over dedicated scripts/ci/no-api-me.sh — per 66-CONTEXT.md D-12 and deferred note; reusable script pattern deferred until third similar guard lands (Phase 67+)"
  - "Grep pattern '\"\/api\/me\"' (double-quoted JS literal) catches code call sites; prose comments referencing /api/me without quotes are tolerated intentionally"

patterns-established:
  - "Pre-stack fast-fail guard: if grep -rn '<pattern>' <dir>/; then echo ERROR && exit 1; fi — placed between Write test .env and Bring up stack"

requirements-completed: [MIG-AUTH-03]

duration: 36s
completed: "2026-04-24"
---

# Phase 66 Plan 03: CI Guard Summary

**Pre-stack grep guard in ci.yml fails the build in <1s if '"/api/me"' literal reappears in frontend/src/, locking the MIG-AUTH-03 migration permanently**

## Performance

- **Duration:** 36s
- **Started:** 2026-04-24T18:42:08Z
- **Completed:** 2026-04-24T18:42:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `Guard — no /api/me in frontend (MIG-AUTH-03)` step to ci.yml between Write test .env and Bring up stack
- Guard uses `if grep -rn '"/api/me"' frontend/src/; then exit 1; fi` — exits 0 on post-Phase-66 tree
- Verified synthetic regression is caught: injecting `const x = "/api/me";` into frontend/src/ causes grep to print the match

## Task Commits

1. **Task 1: Add /api/me grep guard step to ci.yml** - `7a69e72` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified

- `.github/workflows/ci.yml` - New pre-stack step `Guard — no /api/me in frontend (MIG-AUTH-03)` inserted before `Bring up stack`

## Decisions Made

- Inline `run:` block used (not a separate shell script) — per CONTEXT.md D-12 guidance; reusable script pattern deferred until third endpoint-guard lands
- Guard grep uses the full `if grep ...; then exit 1; fi` form rather than `grep && exit 1 || exit 0` to emit the descriptive ERROR message on match

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 66 fully complete: AuthContext migrated (Plan 01), me.py deleted (Plan 02), CI guard locking the migration (Plan 03)
- Phase 67 (data.py migration) can begin — same three-plan pattern (frontend migration, backend deletion, CI guard)

---
*Phase: 66-kill-me-py*
*Completed: 2026-04-24*
