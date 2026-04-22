---
phase: 59-a11y-parity-sweep
plan: 1
subsystem: infra
tags: [i18n, ci, lint, de-locale, parity, a11y]

requires:
  - phase: 46-signage-admin
    provides: "flat-dotted i18n key contract + en.json/de.json parity baseline"
  - phase: 57-section-context-standardized-trashcan
    provides: "check-phase-57-guards.mts pattern (node --experimental-strip-types runner)"
provides:
  - "check:i18n-parity npm script (persistent CI entrypoint, D-02)"
  - "check:i18n-du-tone npm script flagging formal-German tokens in de.json (D-03)"
  - "check:phase-59 union script chaining both gates"
  - "Allowlist convention for pre-v1.19 du-tone hits keyed by dotted JSON path"
affects: [phase-59-02, phase-59-03, phase-59-04, future-i18n-work]

tech-stack:
  added: []
  patterns:
    - "Dotted-path recursion over nested JSON objects for key-path auditing"
    - "Allowlist-by-key-path (not string-match) to keep lint stable across translation edits"

key-files:
  created:
    - frontend/scripts/check-de-du-tone.mts
  modified:
    - frontend/package.json

key-decisions:
  - "Allowlist holds BOTH verified path 'docs.empty.body' and plan's original guess 'empty.body' — keeps script tolerant to future restructuring"
  - "Case-sensitive regex on Sie/Ihnen/Ihre/Ihrer/Ihres — lowercase 'ihr' is legitimate possessive (Pitfall 7)"
  - "readFileSync + JSON.parse mirrors sibling check-locale-parity.mts to dodge --experimental-strip-types JSON-import inconsistencies"

patterns-established:
  - "Pattern 1: npm script naming check:phase-NN for phase-scoped CI gate chains (follows 57 precedent)"
  - "Pattern 2: Dotted JSON key path as allowlist token for i18n-value linters"

requirements-completed: [A11Y-01]

duration: 5min
completed: 2026-04-22
---

# Phase 59 Plan 1: Locale Parity Tooling Summary

**DE/EN i18n parity gate + du-tone lint wired as persistent npm scripts under a new check:phase-59 umbrella, locking A11Y-01 at CI time.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T10:21:00Z (approx)
- **Completed:** 2026-04-22T10:26:27Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments
- New `check-de-du-tone.mts` recursively scans `de.json` for formal-German tokens and exits 0/1 with grep-friendly `DU_TONE_HIT: <path> | <value>` diagnostics.
- `check:i18n-parity`, `check:i18n-du-tone`, and unioning `check:phase-59` scripts wired into `frontend/package.json`; existing `check:phase-57` and all `check:player-*` scripts untouched.
- Pre-v1.19 du-tone hit at `docs.empty.body` (commit 6bc6c275, 2026-04-16) allowlisted by dotted path — script exits 0 on current repo state.
- `npm run check:phase-59` now returns `PARITY OK: 498 keys` and `DU_TONE OK` in one command.

## Task Commits

1. **Task 1: Add check-de-du-tone.mts lint script** - `339e262` (feat)
2. **Task 2: Wire check:i18n-parity/du-tone/phase-59 into package.json** - `214e8b7` (chore)

## Files Created/Modified
- `frontend/scripts/check-de-du-tone.mts` (NEW, 60 lines) — du-tone lint with case-sensitive formal-German regex and dotted-path allowlist.
- `frontend/package.json` — 3 new scripts appended after `check:phase-57`.

## Decisions Made
- **Allowlist holds two paths** (`docs.empty.body` AND `empty.body`) rather than just the verified one. Cheap future-proofing: if a later phase renames/flattens the docs group, the allowlist still covers the legacy path without re-triggering a CI failure on an unrelated structural edit.
- **Case-sensitive regex** — lowercase `ihr` (possessive "her/their/your-informal") appears legitimately in informal German, so folding case would produce false positives.
- **readFileSync over ESM JSON import** — copied verbatim from `check-locale-parity.mts` to match the sibling script's Node-version-portability stance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected allowlist key path from `empty.body` to `docs.empty.body`**
- **Found during:** Task 1 (before writing the script — verified by recursive walk over de.json)
- **Issue:** The plan's <context> block (line 87) and the `<action>` code block both declared the allowlist entry as `"empty.body"`. Actual nested path in de.json is `docs.empty.body` (the `empty` group lives under `docs`, which hosts the in-app documentation viewer copy). With the plan's literal value, the script would have printed `DU_TONE_HIT: docs.empty.body | ...` and exited 1 on a clean repo, breaking the D-02/D-03 gate on its first invocation.
- **Fix:** Allowlist now contains both paths — the verified `docs.empty.body` (what actually matches) plus the plan's original `empty.body` (kept for documentation/future-proofing; costs nothing since it just never matches).
- **Verification:** Pre-walk script (inline Node one-liner) confirmed exactly one formal-German hit at `docs.empty.body`. Post-write: `node --experimental-strip-types frontend/scripts/check-de-du-tone.mts` exits 0 with `DU_TONE OK`.
- **Committed in:** `339e262` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect literal in plan)
**Impact on plan:** Zero scope creep. Plan's acceptance criteria satisfied verbatim; only the allowlist constant's value corrected.

## Issues Encountered
- Plan <context> claimed 527 top-level keys in each locale file; actual current count is 498 (scripts report correctly). Not an issue — the parity gate is count-agnostic (it does a set-diff on keys, not a count compare). Noted here for STATE hygiene only.

## User Setup Required
None - pure CI tooling; no external services, env vars, or runtime state changes.

## Next Phase Readiness
- Phase 59-02 (focus-ring-convergence) and 59-03 (ci-guards-color-aria) can chain from `check:phase-59` or add sibling scripts under the same umbrella.
- Any future DE copy edit that uses `Sie/Ihnen/Ihre*` in a v1.19 key will fail `npm run check:i18n-du-tone` immediately — regression guard active.
- Any future key added to only one of en.json / de.json will fail `npm run check:i18n-parity` — drift guard active.

## Self-Check: PASSED

- FOUND: frontend/scripts/check-de-du-tone.mts
- FOUND: commit 339e262 (Task 1)
- FOUND: commit 214e8b7 (Task 2)
- Verified: `cd frontend && npm run check:phase-59` exits 0

---
*Phase: 59-a11y-parity-sweep*
*Completed: 2026-04-22*
