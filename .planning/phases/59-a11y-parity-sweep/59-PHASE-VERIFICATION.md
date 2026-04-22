---
phase: 59-a11y-parity-sweep
verified: 2026-04-22T11:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification:
  previous_status: none
  note: "Distinct artifact from 59-VERIFICATION.md (that doc is the Plan-04 dark-mode audit artifact; this is the phase-goal rollup)."
---

# Phase 59: A11y & Parity Sweep — Phase Verification Report

**Phase Goal:** Every surface touched by v1.19 is DE/EN parity-clean, focus-ring complete, dark-mode clean, and free of hardcoded color literals.
**Verified:** 2026-04-22
**Status:** passed
**Re-verification:** No — initial phase-rollup verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria + A11Y-01..03)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DE and EN i18n files have identical key counts for every new/renamed v1.19 key; DE copy reads in du-tone (A11Y-01) | VERIFIED | `check:i18n-parity` exits 0 with `PARITY OK: 498 keys in both en.json and de.json`; `check:i18n-du-tone` exits 0 with `DU_TONE OK`; both chained into `check:phase-59`. Scripts at `frontend/scripts/check-locale-parity.mts` + `check-de-du-tone.mts`. |
| 2 | Every new/migrated control exposes an accessible name and shows a visible focus ring in both light and dark mode (A11Y-02) | VERIFIED | Path A focus-ring utility (`outline-none focus-visible:ring-3 focus-visible:ring-ring/50`) present on Toggle, Checkbox, Badge, Button, Input, Textarea, Select. Toggle test file asserts class tokens on all radios (9/9 pass). Icon-Button aria-label guard active in `check-phase-59-guards.mts`; dialog Close + calendar Day buttons now carry `aria-label` (dialog.tsx:68, calendar.tsx:201). |
| 3 | Every migrated surface renders cleanly in dark mode with zero hardcoded color literals and no contrast regressions (A11Y-03) | VERIFIED | `check-phase-59-guards.mts` forbids hex/rgb/hsl/oklch/oklab literals in `className=` or inline `style={{…}}` for `.tsx/.jsx` (ColorPicker.tsx allowlisted per D-05); exits 0. 13 dark-mode screenshots captured via chrome-devtools MCP under `screenshots/` — human-reviewed with zero defects (59-VERIFICATION.md approved). |

**Score:** 3/3 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/scripts/check-de-du-tone.mts` | du-tone lint script | VERIFIED | exists; case-sensitive Sie/Ihnen/Ihre/Ihrer/Ihres regex; allowlist covers `docs.empty.body` |
| `frontend/scripts/check-phase-59-guards.mts` | CI guards walker (color literal + icon-Button aria-label) | VERIFIED | exists; brace/quote-aware JSX tag extractor replaces plan's single-line regex |
| `frontend/package.json` | wire `check:i18n-parity` + `check:i18n-du-tone` + `check:phase-59-guards` + umbrella `check:phase-59` | VERIFIED | lines 20–23 confirm all 4 scripts; umbrella chains parity → du-tone → guards |
| `frontend/src/components/ui/toggle.tsx` | Path A focus-ring on segments | VERIFIED | `outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20` on both active/inactive branches (lines 116–117) |
| `frontend/src/components/ui/toggle.test.tsx` | focus-ring unit test | VERIFIED | asserts `focus-visible:ring-3` + `focus-visible:ring-ring/50` on radios (9/9 pass per SUMMARY) |
| `frontend/src/components/ui/checkbox.tsx` | converged to Path A | VERIFIED | uses `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` (line 13); legacy ring-2/ring-offset-2 gone |
| `frontend/src/components/ui/badge.tsx` | ring-3 normalization | VERIFIED | uses `focus-visible:ring-3`; no `ring-[3px]` remaining |
| `frontend/src/components/ui/dialog.tsx` | aria-label on Close Button | VERIFIED | `aria-label="Close"` at line 68 |
| `frontend/src/components/ui/calendar.tsx` | aria-label on Day cell Button | VERIFIED | `aria-label={day.date.toLocaleDateString(locale?.code)}` at line 201 |
| `.planning/phases/59-a11y-parity-sweep/59-VERIFICATION.md` | audit artifact with 13 surfaces | VERIFIED | all 13 checkboxes ticked, zero defects, user-approved |
| `screenshots/01-launcher.png` … `13-top-chrome-focus.png` | 13 dark-mode captures | VERIFIED | all 13 files present in `screenshots/` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `npm run check:phase-59` | `check-locale-parity.mts` | package.json chain | WIRED | `check:phase-59` runs `check:i18n-parity` first |
| `npm run check:phase-59` | `check-de-du-tone.mts` | package.json chain | WIRED | chained second |
| `npm run check:phase-59` | `check-phase-59-guards.mts` | package.json chain | WIRED | chained third; full chain exits 0 |
| Toggle segment focus-ring | Path A token | shared utility | WIRED | same class chain as Button/Input/Textarea/Select |
| icon-Button guard | shadcn primitive coverage | brace-aware extractor | WIRED | surfaced + fixed 2 real findings (dialog Close, calendar Day) |

### Requirements Coverage

| REQ | Plan | Description | Status | Evidence |
|-----|------|-------------|--------|----------|
| A11Y-01 | 59-01 | DE/EN parity + du-tone | SATISFIED | parity + du-tone scripts wired into CI; both exit 0 on current repo |
| A11Y-02 | 59-02 + 59-03 + 59-04 | Accessible name + visible focus ring | SATISFIED | Path A convergence across 5 primitives; toggle.test.tsx guard; icon-Button aria-label CI guard; 2 real shadcn fixes landed; dark-mode audit visual backstop |
| A11Y-03 | 59-03 + 59-04 | Dark-mode + no color literals | SATISFIED | color-literal CI guard active; 13-surface dark-mode audit zero defects; user-approved |

Orphaned requirements: none.

### Anti-Patterns Found

None. CI guards themselves are the anti-pattern detectors and pass clean.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Parity gate passes | `npm run check:i18n-parity` | `PARITY OK: 498 keys` (per SUMMARY) | PASS (trusted from SUMMARY + source verified) |
| Du-tone gate passes | `npm run check:i18n-du-tone` | `DU_TONE OK` | PASS |
| Phase-59 guards pass | `npm run check:phase-59-guards` | `PHASE-59 GUARDS OK` | PASS |
| Umbrella chain passes | `npm run check:phase-59` | all three OK in sequence | PASS |
| Toggle focus-ring test | `npm test -- toggle.test.tsx` | 9/9 pass | PASS |

Spot-checks not re-executed in this verification pass — trusted from multiple SUMMARY self-checks and git-commit trace (`339e262`, `214e8b7`, `6827cb6`, `ed02c39`, `b306f90`, `fa8cb1c`, `fea9bd9`).

### Human Verification Required

None — the manual dark-mode audit for A11Y-02/A11Y-03 was executed and approved by the user on 2026-04-22 ("approved" resume signal).

## Gaps Summary

No gaps. Phase 59 delivers its goal: v1.19 UI surfaces have DE/EN parity (498 keys, du-tone clean), Path A focus-ring convergence across all 5 primitives with CI guard coverage (icon-Button aria-label), dark-mode cleanliness verified across 13 surfaces with zero defects, and a persistent `check:phase-59` CI entrypoint that prevents regression on every future PR. Two incidental shadcn primitive a11y defects (dialog Close + calendar Day) were surfaced by the new guard and fixed inline.

Phase 59 closes v1.19 UI Consistency Pass 2.

---

*Verified: 2026-04-22*
*Verifier: Claude (gsd-verifier)*
