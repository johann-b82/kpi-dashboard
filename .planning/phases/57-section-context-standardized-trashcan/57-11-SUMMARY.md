---
phase: 57-section-context-standardized-trashcan
plan: 11
subsystem: testing
tags: [ci, grep-guards, invariants, dark-mode, typography, i18n-parity, node-fs]

requires:
  - phase: 57-section-context-standardized-trashcan
    provides: SectionHeader / DeleteDialog / DeleteButton primitives + window.confirm eradication across Media, Playlists, Schedules, Devices, Sensors, UploadHistory pages
provides:
  - frontend/scripts/check-phase-57-guards.mts — single CI script enforcing the four Phase 57 eradication invariants
  - npm run check:phase-57 — wired entry point on frontend package
  - Belt-and-suspenders locale parity invocation as part of the guard suite
affects: [phase-58-sensors-parity, phase-59-a11y-sweep, future-phases-touching-primitives]

tech-stack:
  added: []
  patterns:
    - "Phase-scoped grep guard script as a Node fs walk (no system rg dependency) — matches check-signage-invariants.mjs style"
    - "Strip // line-comments before pattern matching so primitives can self-document banned patterns without tripping the guard"

key-files:
  created:
    - frontend/scripts/check-phase-57-guards.mts
  modified:
    - frontend/package.json

key-decisions:
  - "Implemented guards via Node fs walk (not rg child_process): no system ripgrep binary in this environment; rg is only the Claude Code shell function. Matches check-signage-invariants.mjs precedent."
  - "Wired npm script on frontend/package.json (not root) — repo has no root package.json; check:phase-57 mirrors existing check:signage / check:player-* convention."
  - "Comment-stripping in the scanner so SectionHeader's documentation lines referencing 'no dark:' and 'replaces ad-hoc font-semibold' don't self-trip the guard."

patterns-established:
  - "Phase 57 guard suite as the canonical CI gate for SectionHeader/DeleteDialog/DeleteButton primitive purity (no dark:, no font-semibold) and for the four eradication invariants of this phase."

requirements-completed: [SECTION-03, SECTION-04]

duration: ~2min
completed: 2026-04-22
---

# Phase 57 Plan 11: CI Guards & Verification Summary

**Phase 57 eradication invariants locked in via a single Node-fs guard script (window.confirm in src, retired feature-variant dialog imports, dark: variants in primitives, font-semibold in primitives) plus belt-and-suspenders locale parity, wired as `npm run check:phase-57`.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-22T08:45:22Z
- **Completed:** 2026-04-22T08:47:19Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `frontend/scripts/check-phase-57-guards.mts` enforces 4 zero-match invariants and re-runs the locale parity gate.
- `npm run check:phase-57` wired on `frontend/package.json` (mirrors existing `check:*` convention; no root `package.json` in this repo).
- Negative-tested: injecting `window.confirm` into `frontend/src/__guard_test__.tsx` produces `WINDOW_CONFIRM: frontend/src/__guard_test__.tsx:1: …` and exits 1.
- Positive run on clean tree: `PHASE-57 GUARDS OK: scanned 179 src file(s) + 3 primitive(s); locale parity OK.` exits 0.

## Task Commits

1. **Task 1: Write CI grep guard script** — `2107a78` (feat)
2. **Task 2: Wire guard into npm scripts** — `0c946d5` (chore)

## Files Created/Modified

- `frontend/scripts/check-phase-57-guards.mts` — Node-fs guard script enforcing the four phase-57 invariants + locale parity invocation (162 lines)
- `frontend/package.json` — adds `"check:phase-57": "node --experimental-strip-types scripts/check-phase-57-guards.mts"`

## Decisions Made

- **Node fs walk over `rg`/`execFileSync('rg', …)`:** the dev shell ships only the Claude Code `rg` shell function — no system `rg` binary exists. Matches `check-signage-invariants.mjs` precedent. Plan-described semantics (zero-match grep over the same path/pattern set) are preserved verbatim.
- **Wire script on `frontend/package.json`:** no root `package.json` exists; the project's check-suite convention (`check:signage`, `check:player-isolation`, `check:player-size`, `check:player-strings`) lives entirely on the frontend package.
- **Comment-stripping in the scanner:** `section-header.tsx` documents (`// Token-driven colors only — zero \`dark:\``) and (`// to font-medium per UI-SPEC §Typography (replaces ad-hoc font-semibold`) — these would self-trip the guard. The scanner strips trailing `// …` before matching, mirroring `check-signage-invariants.mjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No system `rg` binary available — implemented guards via Node fs walk**
- **Found during:** Task 1 (initial test run)
- **Issue:** Plan instructs `execFileSync('rg', [...])`. `which rg` resolves to the Claude Code shell function only; there is no `/opt/homebrew/bin/rg`, `/usr/local/bin/rg`, or `/usr/bin/rg` on this host. CI would inherit the same gap.
- **Fix:** Implemented identical zero-match semantics with `readFileSync` + recursive `readdirSync` over `frontend/src` and over the explicit primitive list. Same scan surface, same fail/pass behavior, no system tool dependency. Mirrors the project's existing `frontend/scripts/check-signage-invariants.mjs` style.
- **Files modified:** `frontend/scripts/check-phase-57-guards.mts`
- **Verification:** Negative test passes (`WINDOW_CONFIRM: frontend/src/__guard_test__.tsx:1: export const X = () => window.confirm("test");`); positive test passes (`PHASE-57 GUARDS OK`).
- **Committed in:** `2107a78` (Task 1)

**2. [Rule 2 - Missing Critical] Comment-stripping before pattern match**
- **Found during:** Task 1 (first positive run)
- **Issue:** First clean run of the script reported two false positives — `DARK_VARIANT` and `FONT_SEMIBOLD` against the *documentation comments* in `section-header.tsx` itself, which intentionally name the banned patterns to explain why they're banned. Without comment-stripping, every primitive that documents its own discipline trips its own guard.
- **Fix:** Stripped trailing `// …` from each line before regex match (same approach used in `check-signage-invariants.mjs`).
- **Files modified:** `frontend/scripts/check-phase-57-guards.mts`
- **Verification:** Re-run produced `PHASE-57 GUARDS OK`. Negative test (injected `window.confirm`) still trips correctly.
- **Committed in:** `2107a78` (Task 1, same commit)

**3. [Rule 3 - Blocking] Plan said "Edit `package.json`" — repo has only `frontend/package.json`**
- **Found during:** Task 2 (locating wiring target)
- **Issue:** Plan's `files_modified` lists `package.json` (root). This repo has no root `package.json`; all npm scripts live on `frontend/package.json`. Sibling check scripts (`check:signage`, `check:player-*`) are wired there.
- **Fix:** Added `check:phase-57` to `frontend/package.json` per the existing convention.
- **Files modified:** `frontend/package.json`
- **Verification:** `npm --prefix frontend run check:phase-57` → `PHASE-57 GUARDS OK`, exit 0.
- **Committed in:** `0c946d5` (Task 2)

---

**Total deviations:** 3 auto-fixed (2 blocking environment gaps, 1 missing-critical false-positive guard)
**Impact on plan:** All deviations preserve the plan's stated semantics exactly. No scope creep; same invariants, same scan surface, same pass/fail contract.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — pure CI tooling addition.

## Verification (final phase-wide checks from plan)

- `node --experimental-strip-types frontend/scripts/check-phase-57-guards.mts` → exit 0, prints `PHASE-57 GUARDS OK: scanned 179 src file(s) + 3 primitive(s); locale parity OK.`
- `npm --prefix frontend run check:phase-57` → exit 0, same output.
- Window.confirm in `frontend/src/`: 0 matches.
- Retired dialog imports (Media/Schedule/Sensor/SensorAdminHeader/DeleteConfirmDialog) in `frontend/src/`: 0 matches.
- `dark:` in `section-header.tsx`/`delete-dialog.tsx`/`delete-button.tsx`: 0 matches outside line comments (the one hit in `section-header.tsx:5` is a `//` doc comment about banning the pattern).
- `font-semibold` in the three primitives: 0 matches.
- Locale parity: 498 keys in both `en.json` and `de.json`.

## Next Phase Readiness

Wave 3 of Phase 57 closes with this plan. The guard suite is now part of the frontend `check:*` family and ready to run in CI alongside `check:signage`, `check:player-isolation`, `check:player-size`, and `check:player-strings`. Phase 58 (Sensors layout parity) and Phase 59 (A11y sweep) will inherit a hard CI gate against any silent reintroduction of `window.confirm`, retired feature-variant dialogs, `dark:` in the new primitives, or `font-semibold` in the new primitives.

## Self-Check: PASSED

- FOUND: frontend/scripts/check-phase-57-guards.mts
- FOUND: frontend/package.json (modified — `check:phase-57` script present)
- FOUND commit: 2107a78 (Task 1)
- FOUND commit: 0c946d5 (Task 2)

---
*Phase: 57-section-context-standardized-trashcan*
*Completed: 2026-04-22*
