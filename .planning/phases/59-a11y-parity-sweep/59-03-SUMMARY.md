---
phase: 59-a11y-parity-sweep
plan: 3
subsystem: frontend-ci-guards
tags: [a11y, ci-guard, color-literal, aria-label, A11Y-02, A11Y-03]
requirements: [A11Y-02, A11Y-03]
dependency_graph:
  requires:
    - 59-01-locale-parity-tooling (check:phase-59 umbrella script entrypoint)
  provides:
    - CI lock-in for A11Y-02 (icon-only Button aria-label)
    - CI lock-in for A11Y-03 (no color literals in className/style in .tsx/.jsx)
  affects:
    - frontend/scripts/check-phase-59-guards.mts (NEW)
    - frontend/package.json (check:phase-59 chain)
    - frontend/src/components/ui/dialog.tsx (Rule-2 a11y fix)
    - frontend/src/components/ui/calendar.tsx (Rule-2 a11y fix)
tech-stack:
  added: []
  patterns:
    - Node fs walker (Phase 57 template) for CI grep-style guards
    - Brace/quote-aware JSX opening-tag extractor for accurate attribute presence checks
key-files:
  created:
    - frontend/scripts/check-phase-59-guards.mts
  modified:
    - frontend/package.json
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/calendar.tsx
decisions:
  - Multi-line JSX tag handling uses a dedicated brace/quote-aware extractor (not a single-line regex) to avoid false negatives when icon Buttons span lines. Initial single-line `BUTTON_ICON` regex surfaced 2 real findings (dialog Close, calendar Day) that a line-local match would have missed; the extractor formalizes that coverage.
  - Dialog Close `aria-label="Close"` is literal (not i18n-keyed) because `ui/dialog.tsx` is a shadcn primitive with no `useTranslation` import and no neighbouring translated strings; introducing i18n here is out-of-scope for a CI-guards plan. Future i18n work may upgrade to a `nav.close`-style key.
  - Calendar Day cell `aria-label={day.date.toLocaleDateString(locale?.code)}` reuses the existing `data-day` locale-formatted value — one formatting path, consistent with the locale prop the component already threads.
metrics:
  duration_seconds: 60
  tasks: 2
  files: 4
  completed: "2026-04-22"
---

# Phase 59 Plan 3: CI Guards — Color + ARIA Summary

CI grep guards now lock in A11Y-02 (icon-only Button accessible names) and A11Y-03 (no hex/rgb/hsl/oklch/oklab color literals inside `className=` or `style={{…}}` in `.tsx/.jsx`) via a single `frontend/scripts/check-phase-59-guards.mts` walker wired into the `check:phase-59` umbrella. The A11Y-02 guard surfaced two real shadcn primitive findings (`dialog.tsx` Close, `calendar.tsx` Day cell) which were fixed inline as a Rule-2 deviation before committing the guard.

## Objective Achieved

Two static-analysis gates are now CI-enforceable via `npm run check:phase-59`:
1. Hex or CSS-color-function literals co-located with `className=` or inline `style={{…}}` in `.tsx/.jsx` fail the build (ColorPicker.tsx allowlisted per D-05).
2. `<Button size="icon" | "icon-xs" | "icon-sm" | "icon-lg">` without `aria-label` on the same element fails the build.

Both guards co-exist with the Plan 01 parity + du-tone scripts; the umbrella `check:phase-59` now chains parity → du-tone → phase-59-guards.

## Tasks Completed

| Task | Name                                                   | Commit   | Files                                                      |
| ---- | ------------------------------------------------------ | -------- | ---------------------------------------------------------- |
| Pre  | Fix dialog Close + calendar Day aria-label (Rule 2)    | fea9bd9  | frontend/src/components/ui/dialog.tsx, calendar.tsx         |
| 1    | Create check-phase-59-guards.mts walker                | b306f90  | frontend/scripts/check-phase-59-guards.mts                  |
| 2    | Chain check:phase-59-guards into check:phase-59 script | fa8cb1c  | frontend/package.json                                       |

## Verification Results

- `cd frontend && npm run check:phase-59-guards` → exit 0, prints `PHASE-59 GUARDS OK`.
- `cd frontend && npm run check:phase-59` → exit 0, prints in order `PARITY OK: 498 keys in both en.json and de.json`, `DU_TONE OK: no non-allowlisted formal-German hits in de.json`, `PHASE-59 GUARDS OK`.
- `cd frontend && npm run check:phase-57` → exit 0 (unbroken).
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` → valid JSON.
- Plan success criteria 3 (hljs hex literals in `index.css` NOT flagged) holds by construction: `SCAN_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/` excludes `.css`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical A11y] Added aria-label to Dialog Close Button**

- **Found during:** Task 1 verify — initial run of the guard surfaced `frontend/src/components/ui/dialog.tsx:64` (Close Button with `size="icon-sm"` lacking aria-label). The sr-only span provides an accessible name when the Button's children render, but the Button is `render={…}`-projected onto `DialogPrimitive.Close`, making the sr-only slot a render-detail, not a guaranteed accessible name. Axe/JAWS expect `aria-label` on the Button element itself.
- **Fix:** Added `aria-label="Close"` to the Button inside `DialogContent`. Literal English chosen because the file is a shadcn primitive with no `useTranslation` wiring; i18n upgrade is a future concern.
- **Files modified:** `frontend/src/components/ui/dialog.tsx`
- **Commit:** `fea9bd9`

**2. [Rule 2 — Missing Critical A11y] Added aria-label to Calendar Day cell Button**

- **Found during:** Task 1 verify — same guard run flagged `frontend/src/components/ui/calendar.tsx:198`. Day cells are icon-only Buttons whose child is a number — screen readers without the date context cannot tell which day is focused.
- **Fix:** Added `aria-label={day.date.toLocaleDateString(locale?.code)}`, reusing the same locale-formatted string already present in the `data-day` attribute — no new formatting path, honors the locale prop the component threads.
- **Files modified:** `frontend/src/components/ui/calendar.tsx`
- **Commit:** `fea9bd9`

**3. [Rule 2 — Implementation Hardening] Brace/quote-aware JSX tag extractor for icon-Button guard**

- **Found during:** Task 1 drafting — the plan's skeleton `BUTTON_ICON` regex is single-line (matches only between `<Button` and the first `>`). Real JSX icon Buttons span multiple lines with attributes like `onClick={(e) => …}` whose braces and arrows break the naive match. A line-local regex would silently miss the two findings that motivated the above fixes.
- **Fix:** Replaced the single-line regex with a dedicated `extractOpeningTag(src, start)` helper that walks forward from `<Button` respecting JSX expression brace nesting and string/template quote regions until the terminating `>`, then matches `size="icon*"` and absence-of-`aria-label` on the extracted tag text. This is strictly more accurate than the plan's skeleton and matches the spirit of "cover `<Button size='icon*'>` patterns without aria-label" (must_haves.truth #3 + Pitfall 8).
- **Files modified:** `frontend/scripts/check-phase-59-guards.mts` (vs. plan skeleton)
- **Commit:** `b306f90`

### Authentication Gates

None.

### Decision Checkpoint Resolution

Mid-execution the prior agent paused at a `checkpoint:decision` when the new guard surfaced the 2 real findings (per plan `<action>` instructions: "DO NOT silence by adding to the allowlist"). User selected Option 2 (fix findings inline, Rule 2), which is the path followed here.

## Self-Check

- `frontend/scripts/check-phase-59-guards.mts` — FOUND
- `frontend/package.json` contains `check:phase-59-guards` and chains into `check:phase-59` — FOUND (2× `check-phase-59-guards.mts` references confirmed by test runs)
- `frontend/src/components/ui/dialog.tsx` contains `aria-label="Close"` — FOUND
- `frontend/src/components/ui/calendar.tsx` contains `aria-label={day.date.toLocaleDateString(locale?.code)}` — FOUND
- Commits `fea9bd9`, `b306f90`, `fa8cb1c` present on `main` — FOUND
- `npm run check:phase-59` exits 0 with all three OK banners in sequence — CONFIRMED
- `npm run check:phase-57` still exits 0 — CONFIRMED

## Self-Check: PASSED
