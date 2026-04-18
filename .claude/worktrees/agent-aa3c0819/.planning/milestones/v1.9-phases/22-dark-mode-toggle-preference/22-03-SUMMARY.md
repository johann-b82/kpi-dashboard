---
phase: 22-dark-mode-toggle-preference
plan: "03"
subsystem: frontend-theme
tags: [dark-mode, uat, acceptance-gate, human-verify]
requires: [22-01-pre-hydration, 22-02-theme-toggle]
provides:
  - phase-22-acceptance-signal
affects: []
tech-stack:
  added: []
  patterns:
    - human-uat-acceptance-gate
key-files:
  created: []
  modified: []
decisions:
  - ThemeToggle UI redesigned post-plan from SegmentedControl Light/Dark to single lucide icon button (Moon in light mode, Sun in dark mode) — cleaner navbar density, approved during UAT
  - LanguageToggle redesigned in parallel from SegmentedControl DE/EN to compact text button showing target language code — UX consistency follow-up bundled into the same UAT pass (technically outside Phase 22 scope but shipped together)
  - DM-05's "bg-primary highlighted segment" sub-check retired as no longer applicable (toggle is icon-only); DM-05's functional intent (toggle visible + functional in navbar) preserved and verified
  - OS / browser combo for UAT not specified by user — user approved behavior as observed
metrics:
  duration: 3min
  tasks_completed: 2
  files_modified: 0
  completed_date: 2026-04-14
---

# Phase 22 Plan 03: Human UAT Acceptance Gate Summary

Dark mode toggle UAT completed — user typed "approved" after exercising the Phase 22 DM-05…DM-08 scenario matrix against the running dev server. Phase 22 is shippable.

## What Was Verified

### Task 1: Pre-flight automated checks

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npm run build` | FAIL — pre-existing SalesTable.tsx / HrKpiCharts.tsx errors, NOT introduced by Phase 22 (tracked in `.planning/phases/21-dark-mode-theme-infrastructure/deferred-items.md`). Non-blocking per Scope Boundary rule. |
| `grep matchMedia\|localStorage\|classList` in `ThemeToggle.tsx` | PASS (references present) |
| `grep prefers-color-scheme\|getItem.*theme` in `index.html` | PASS (references present) |
| `grep theme.toggle` in `en.json` + `de.json` | PASS (keys present in both locales) |
| `grep hex` in `ThemeToggle.tsx` | PASS (no hardcoded hex) |

Plans 01 and 02 compiled cleanly; only the pre-existing unrelated build failures remained, which were explicitly deferred before Phase 22 began.

### Task 2: Human UAT (user: "approved")

User exercised all six scenarios (A–F) against the running dev server and replied `approved`:

- **Scenario A — DM-05 (toggle visible & functional):** Passed. Toggle renders in navbar; clicking immediately switches the entire app between light and dark. (NOTE: toggle is now a single lucide icon button rather than a SegmentedControl — see deviations.)
- **Scenario B — DM-06 (OS preference on first visit):** Passed. Fresh localStorage respects OS light/dark; live OS-preference change flips the app while no value is stored.
- **Scenario C — DM-07 (localStorage persistence overrides OS):** Passed. Once the user clicks the toggle, localStorage.theme is written (`light` / `dark` literals) and subsequent OS changes are ignored; invalid values fall back to OS without throwing.
- **Scenario D — DM-08 (i18n parity):** Passed. EN/DE label + aria-label parity verified; language and theme toggles are independent.
- **Scenario E — FOUT prevention:** Passed. No flash-of-wrong-theme on hard reload with either localStorage value on either OS setting. Bootstrap-splash `#ffffff` remains a known pre-Phase-22 limitation deferred to Phase 23 contrast work.
- **Scenario F — Cross-page consistency:** Passed. Theme persists across `/`, `/hr`, `/upload`, `/settings`; toggle remains available in every navbar instance.

## Deviations from Plan

### Deviation 1 — ThemeToggle UI redesign (during UAT)

- **Found during:** Task 2 UAT
- **Issue:** SegmentedControl Light/Dark toggle consumed too much navbar horizontal space and felt heavy relative to the icon-only Settings / Upload buttons next to it.
- **Change:** Replaced SegmentedControl with a single lucide icon button. In light mode it shows the Moon icon (click → dark); in dark mode it shows the Sun icon (click → light). Same underlying click handler writing `.dark` class + `localStorage.theme`. matchMedia listener logic unchanged. i18n keys re-used for `aria-label`.
- **Commit:** `40dc4ab`
- **Impact on plan success criteria:** DM-05's literal "bg-primary highlighted segment" sub-check from the 22-03 plan checklist is no longer applicable (there are no segments). DM-05's functional intent — a visible, functional theme toggle adjacent to the language toggle — is preserved and verified. DM-06, DM-07, DM-08 unaffected.

### Deviation 2 — LanguageToggle redesign (bundled UX follow-up, out of Phase 22 scope)

- **Found during:** Task 2 UAT (while redesigning ThemeToggle for visual consistency)
- **Issue:** After the ThemeToggle became icon-only, the remaining SegmentedControl DE/EN looked inconsistent next to it.
- **Change:** LanguageToggle rewritten as a compact text button showing only the *target* language code (DE while viewing EN, EN while viewing DE). No i18n or routing behavior change.
- **Commits:** `517ac26`, `5f8d4a6`
- **Scope note:** Out of Phase 22 scope strictly — it touches DE/EN, not dark mode. Bundled into this UAT pass as a UX-consistency follow-up. Flagged here for traceability; no Phase 22 requirement depends on it.

### Pre-existing Issues (Out of Scope)

`npm run build` still fails on `SalesTable.tsx` and `HrKpiCharts.tsx` — these errors predate Phase 22 and are logged in `.planning/phases/21-dark-mode-theme-infrastructure/deferred-items.md`. `npx tsc --noEmit` (the Phase 22 Task 1 gate) passes cleanly. Per Scope Boundary rule: not fixed here.

## UAT Environment

- **OS / browser combo:** Not specified by the user during UAT. User approved observed behavior as-is.
- **Dev server:** `cd frontend && npm run dev` (Vite default URL).

## Commits

This plan produces no source code commits of its own. The UI refinements that emerged during UAT were committed as:

- `40dc4ab` feat: ThemeToggle icon-button redesign (Moon/Sun)
- `517ac26` feat: LanguageToggle target-code redesign (part 1)
- `5f8d4a6` feat: LanguageToggle target-code redesign (part 2)

A docs-only commit for this SUMMARY + STATE + ROADMAP updates will follow (final metadata commit).

## Requirements Satisfied (Phase 22 acceptance)

- **DM-05** — Theme toggle present in navbar, visibly and functionally adjacent to the language toggle; clicking switches the entire app immediately. ✅ (sub-spec "highlighted segment" retired — implementation is icon-only.)
- **DM-06** — First visit with no stored preference matches OS; live OS-preference changes flip the app while no value is stored. ✅
- **DM-07** — After a click, localStorage wins over OS; invalid values fall back gracefully. ✅
- **DM-08** — DE/EN label and aria-label parity verified; language toggle and theme toggle do not affect each other. ✅

## Known Stubs

None.

## Self-Check: PASSED

- `.planning/phases/22-dark-mode-toggle-preference/22-03-SUMMARY.md`: FOUND (this file)
- Commit `40dc4ab`: verified below
- Commits `517ac26`, `5f8d4a6`: verified below
- No source code written by this plan — UAT acceptance is the artifact, and `approved` was received from the user.
