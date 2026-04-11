---
phase: 04-backend-schema-api-and-security
plan: 06
subsystem: backend/verification
tags: [phase-4, verification, docker, smoke-test, runbook, brand-04]
requirements: [BRAND-04]
dependency_graph:
  requires:
    - "Plan 04-05 — /api/settings + /api/settings/logo endpoints live on a running stack"
  provides:
    - "scripts/verify-phase-04.sh — curl-based smoke script covering Phase 4 success criteria 1–4"
    - "04-DOCKER-VERIFY.md — runbook for manual docker rebuild logo-persistence test (criterion 5)"
    - "Human verification sign-off that all five Phase 4 success criteria pass against a live stack"
  affects:
    - "Phase 4 completion gate"
    - "Phase 5 frontend (confirmed backend contract is stable)"
tech_stack:
  added: []
  patterns:
    - "Curl-based smoke test as a bash script with pass/fail tally + non-zero exit on any failure"
    - "Manual runbook for rebuild-persistence assertions that cannot be exercised from pytest"
    - "SHA256 comparison of GET /api/settings/logo bytes before and after docker compose up --build"
key_files:
  created:
    - scripts/verify-phase-04.sh
    - .planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md
  modified: []
key_decisions:
  - "Criterion 5 (rebuild persistence) stays a human runbook rather than a CI job — it requires a real docker daemon and a full image rebuild, which is out of scope for pytest."
  - "Smoke script uses the explicit close-tag <circle ...></circle> form for the legitimate upload to match the nh3 reject-on-mutation guard — same fix applied to the runbook during verification."
patterns_established:
  - "Phase-level verify script sitting in scripts/ so it can be re-run any time the stack changes"
  - "Human checkpoints document the exact resume signal and the copy-pasteable commands that produce it"
requirements_completed: [BRAND-04]
duration: 10min
completed: 2026-04-11
---

# Phase 4 Plan 6: Integration Verification and Phase-4 Human Checkpoint Summary

**Added a curl-based smoke script and a docker-rebuild runbook that together prove all five Phase 4 success criteria against a live docker compose stack, and landed human sign-off after fixing a runbook SVG bug discovered during verification.**

## Performance

- **Duration:** ~10 min (wall clock across 2 tasks + human verification pause)
- **Tasks:** 2 of 2
- **Files created:** 2
- **Files modified:** 1 (runbook bug fix)

## Accomplishments

- `scripts/verify-phase-04.sh` exercises Phase 4 success criteria 1–4 end-to-end via curl, with a pass/fail tally and non-zero exit on any failure. Human run result: **PASSED: 16, FAILED: 0**.
- `04-DOCKER-VERIFY.md` documents the exact docker-compose rebuild dance plus SHA comparison for success criterion 5 (bytea-in-Postgres persistence across `docker compose up --build`).
- Human operator ran both the automated smoke test AND the manual rebuild runbook; the logo SHA matched before and after rebuild (approved).
- Runbook SVG bug discovered during manual verification was fixed and committed (see Deviations).

## Task Commits

1. **Task 1: Create curl smoke script + docker rebuild runbook** — `fc0955d` (feat)
2. **Task 2: Human-verified docker rebuild persistence test** — human checkpoint, no code commit. Approved after the user ran `./scripts/verify-phase-04.sh` (exit 0) and the runbook rebuild test (matching SHAs).

**Supporting commits:**

- `ef14ec7` — chore: mark STATE awaiting human verification for rebuild test (paused checkpoint state)
- `39ba093` — fix(04-06): correct runbook SVG to match sanitize_svg mutation rules (deviation, see below)
- Final docs commit: SUMMARY + STATE + ROADMAP updates (this commit)

## Files Created/Modified

- `scripts/verify-phase-04.sh` (created) — curl smoke script. Executable, `bash -n` clean. Covers criterion 1 (GET shape), criterion 2 (CSS injection returns 422), criterion 3 (malicious SVG returns 422 and is not persisted), criterion 4 (PUT defaults clears logo_url).
- `.planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md` (created, then fixed) — runbook for criterion 5. Upload a known SVG, capture SHA, `docker compose down && docker compose up -d --build`, fetch bytes again, compare hashes. Explicit warning not to use `down -v`.

## Decisions Made

- **Manual runbook for criterion 5 rather than CI:** A real image rebuild cannot be driven from pytest and Docker-in-Docker is out of scope for v1.1. Keeping it as a once-per-phase human runbook documents the exact commands and keeps the gate enforceable.
- **Smoke script exit code is load-bearing:** The script tallies pass/fail and `exit 1` on any failure so it can be wired into higher-level phase-completion checks later without modification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Runbook SVG was rejected by sanitize_svg**
- **Found during:** Task 2 (human verification checkpoint)
- **Issue:** The runbook's step-1 heredoc used a self-closing `<circle cx="5" cy="5" r="4"/>` tag. nh3's html5ever parser normalizes self-closing tags to the explicit close-tag form (`<circle ...></circle>`), which the reject-on-mutation guard in `sanitize_svg` correctly treats as an attempted mutation and 422s the upload. The runbook as originally written never worked — the user had to swap to the close-tag form to complete the verification.
- **Fix:** Switched the runbook to `printf '%s' '...'` (no trailing newline, no heredoc) with the explicit close-tag form, matching `MINIMAL_SVG` in `backend/tests/test_logo_validation.py`. Added an inline comment explaining the constraint so future runbook readers do not hit the same trap.
- **Files modified:** `.planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md`
- **Verification:** Human re-ran the runbook with the corrected SVG during the checkpoint and confirmed matching SHAs pre- and post-rebuild.
- **Committed in:** `39ba093`

## Requirements Completed

- **BRAND-04** — Logo persists across container rebuild (bytea storage verified via SHA256 comparison before/after `docker compose up -d --build`).

## Phase 4 Success Criteria — Final Status

| # | Criterion | How Verified | Result |
|---|-----------|--------------|--------|
| 1 | GET /api/settings returns full shape | `verify-phase-04.sh` step [1/4] | PASS |
| 2 | CSS injection in color fields blocked (422) | `verify-phase-04.sh` step [2/4] | PASS |
| 3 | Malicious SVG rejected and not persisted | `verify-phase-04.sh` step [3/4] | PASS |
| 4 | PUT defaults clears logo_url | `verify-phase-04.sh` step [4/4] | PASS |
| 5 | Logo bytes survive `docker compose up --build` | `04-DOCKER-VERIFY.md` manual runbook | PASS (approved) |

Automated script tally: **PASSED: 16, FAILED: 0**.

## Self-Check

- `scripts/verify-phase-04.sh` — created, executable, bash-syntax clean (committed in `fc0955d`)
- `.planning/phases/04-backend-schema-api-and-security/04-DOCKER-VERIFY.md` — created (`fc0955d`) and corrected (`39ba093`)
- Commit `fc0955d` — present in `git log`
- Commit `ef14ec7` — present in `git log`
- Commit `39ba093` — present in `git log`
- Human verification received ("approved") — recorded above

**Self-Check: PASSED**
