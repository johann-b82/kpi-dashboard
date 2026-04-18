---
phase: 29-outline-wiki-deployment
plan: 01
subsystem: infra
tags: [env, secrets, bsl, outline, docs, license]

requires:
  - phase: 27-dex-idp-setup
    provides: DEX_OUTLINE_SECRET in .env.example (reused by Outline OIDC client)
  - phase: 26-npm-hostnames
    provides: wiki.internal placeholder proxy host + mkcert rootCA

provides:
  - Three Outline secret placeholders in .env.example (OUTLINE_SECRET_KEY, OUTLINE_UTILS_SECRET, OUTLINE_DB_PASSWORD)
  - openssl rand -hex 32 generation comment documenting secret workflow
  - README License Note — Outline Wiki section with accurate BSL 1.1 Additional Use Grant wording

affects: [29-02-compose-yaml, 29-03-docs-runbook, future-outline-upgrades]

tech-stack:
  added: []
  patterns:
    - "Outline secrets follow the same `.env.example` placeholder + openssl rand -hex 32 comment pattern established by SESSION_SECRET (Phase 28) and DEX_*_SECRET (Phase 27)"
    - "BSL compliance documented in README alongside the generic License section (separator ---) so the internal-distribution statement remains unambiguous"

key-files:
  created: []
  modified:
    - .env.example
    - README.md

key-decisions:
  - "BSL 1.1 Additional Use Grant wording corrected: the actual grant prohibits offering a 'Document Service' to third parties — there is no 50-person cap. CONTEXT D-07 reference was inaccurate; researcher correction applied verbatim."
  - "Outline block appended at end of .env.example (after DISABLE_AUTH) rather than inserted near the Dex block — preserves existing Phase 27/28 block order and keeps plan 29-02 additions localised."

patterns-established:
  - "Docs/config-only plans commit atomically per file type (chore for env, docs for README)"
  - "CONTEXT corrections discovered by research carry through planning and execution unchanged; the summary names the correction so future readers don't re-discover it"

requirements-completed: [WIK-07]

duration: 3min
completed: 2026-04-15
---

# Phase 29 Plan 01: Env Placeholders + BSL Compliance Note Summary

**Three Outline secret placeholders added to `.env.example` with openssl generation comment, and a BSL 1.1 Additional Use Grant compliance section landed in README.md with accurate "no Document Service" wording (not the inaccurate 50-person cap).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-15T06:58Z
- **Completed:** 2026-04-15T07:01:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `.env.example` now exposes the `.env` contract plan 29-02's compose YAML will substitute (`${OUTLINE_SECRET_KEY}`, `${OUTLINE_UTILS_SECRET}`, `${OUTLINE_DB_PASSWORD}`).
- README has a dedicated BSL 1.1 compliance paragraph — WIK-07 closed before the riskier compose/OIDC work, so licence obligations cannot block integration.
- Researcher correction applied: the CONTEXT.md reference to "≤50-person internal use" was wrong; the actual Additional Use Grant forbids operating a competing "Document Service". README now documents this correctly.

## Task Commits

1. **Task 1: Add Outline secret placeholders to .env.example (D-01)** — `f92b458` (chore)
2. **Task 2: Add BSL 1.1 Additional Use Grant compliance section to README.md (WIK-07)** — `a6b1d49` (docs)

**Plan metadata commit:** final docs commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) follows below.

## Files Created/Modified

- `.env.example` — Appended Outline block with 3 placeholders + generation comment + DEX_OUTLINE_SECRET reuse note.
- `README.md` — Inserted `## License Note — Outline Wiki` section immediately before the existing `## License` section (preserved unchanged).

## Decisions Made

- Applied researcher's BSL correction (no 50-person cap; "Document Service" restriction is the actual grant limit) in README wording.
- Chose to append the Outline env block at the end of `.env.example` rather than slot it next to the Dex block — minimises diff for plan 29-02 review and keeps blocks chronological by phase.

## Deviations from Plan

None — plan executed exactly as written. The planned-for correction of CONTEXT D-07's "≤50-person" reference was explicit in the plan's Task 2 instructions and is not itself a deviation; it's a deliberate course-correction landed via this plan.

## Issues Encountered

None.

## User Setup Required

None — all changes are docs/config templates. Operators will generate real values from the `.env.example` comments when plan 29-02 brings up the compose stack.

## Next Phase Readiness

- Plan 29-02 (compose YAML) can now substitute `${OUTLINE_SECRET_KEY}`, `${OUTLINE_UTILS_SECRET}`, `${OUTLINE_DB_PASSWORD}` without needing to touch `.env.example` again.
- WIK-07 is discharged — no licence-related work remains in Phase 29.
- No blockers.

## Self-Check: PASSED

- FOUND: `.env.example` contains `^OUTLINE_SECRET_KEY=$`, `^OUTLINE_UTILS_SECRET=$`, `^OUTLINE_DB_PASSWORD=$` (each once).
- FOUND: `.env.example` contains `openssl rand -hex 32`; no `^SMTP_` lines; `^DEX_OUTLINE_SECRET=` present exactly once (not duplicated).
- FOUND: `README.md` contains `## License Note — Outline Wiki`, `Business Source License 1.1`, `Additional Use Grant`, literal `competing "Document Service"`, and the four-years OSI conversion sentence.
- FOUND: existing `## License` section with `Internal tool — not currently licensed for external distribution.` preserved.
- FOUND: no `50-person`/`50 person` occurrences (researcher correction honoured).
- FOUND: commit `f92b458` (Task 1) and `a6b1d49` (Task 2) both in `git log`.

---
*Phase: 29-outline-wiki-deployment*
*Completed: 2026-04-15*
