---
phase: 54-toggle-primitive-migrations
plan: 01
subsystem: ui
tags: [react, tailwind, a11y, radiogroup, reduced-motion, toggle, primitive, vitest]

requires:
  - phase: 17-segmented-control (v1.5)
    provides: SegmentedControl API shape + ARIA radiogroup pattern mirrored by Toggle
provides:
  - Toggle primitive at frontend/src/components/ui/toggle.tsx (pill + animated indicator)
  - Type-level 2-tuple constraint + runtime 2-segment assertion
  - prefers-reduced-motion fallback via matchMedia with runtime change listener
  - Keyboard navigation (ArrowLeft/Right/Up/Down wrap, Enter/Space reactivate)
  - Unit-test suite covering render/aria/click/keyboard/reduced-motion/assert/icon
affects: [54-02-navbar-sales-hr-migration, 54-03-chart-type-migrations, 54-04-theme-toggle-migration, 54-05-language-toggle-migration]

tech-stack:
  added: []
  patterns:
    - "Pill-toggle with absolutely-positioned bg-primary indicator using translateX(0|100%) + 180ms ease-out"
    - "usePrefersReducedMotion hook with matchMedia('(prefers-reduced-motion: reduce)') + addEventListener('change')"
    - "Roving-tabindex radiogroup (tabIndex 0 on active, -1 on inactive; focus follows selection on arrow nav)"
    - "Type-level 2-tuple enforcement via `readonly [ToggleSegment<T>, ToggleSegment<T>]` paired with runtime throw"

key-files:
  created:
    - frontend/src/components/ui/toggle.tsx
    - frontend/src/components/ui/toggle.test.tsx
  modified: []

key-decisions:
  - "Independent primitive (not a SegmentedControl 2-option specialization) — Phase 54 open Decision 1 resolved in favor of separate component so the 2-option contract is static-typed and the animated indicator is not a conditional branch inside SegmentedControl."
  - "Icon-or-label required per segment (throws if both are undefined) — prevents silent empty-button rendering."
  - "Reduced-motion detection memoized in a local hook + SSR-safe guard on window.matchMedia existence."

patterns-established:
  - "Toggle ARIA shape: role=radiogroup container + role=radio buttons with aria-checked + roving tabIndex."
  - "Indicator element is aria-hidden=true and absolutely positioned with inline transform/transition styles so reduced-motion is truly instant (no CSS transition class)."
  - "Runtime assertion paired with type-level 2-tuple constraint so downstream callers get both static + dynamic safety."

requirements-completed: [TOGGLE-01, TOGGLE-05]

duration: 87s
completed: 2026-04-21
---

# Phase 54 Plan 01: Toggle Primitive Summary

**Pill-shape Toggle primitive with animated sliding indicator, ARIA radiogroup semantics, full keyboard navigation, prefers-reduced-motion fallback, and exactly-2-segment enforcement — shipped as the single primitive that all downstream v1.19 toggle migrations (54-02/03/04/05) will consume.**

## Performance

- **Duration:** 87s (1m 27s)
- **Started:** 2026-04-21T19:57:05Z
- **Completed:** 2026-04-21T19:58:32Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments

- `Toggle<T>` primitive at `frontend/src/components/ui/toggle.tsx` — pill container with a `bg-primary` indicator that translates under the active label, `role=radiogroup` + two `role=radio` buttons with `aria-checked`, token-only styling (`bg-primary`/`bg-background`/`border-primary`/`text-primary-foreground`/`text-muted-foreground`/`text-foreground`).
- `prefers-reduced-motion: reduce` instantly swaps the indicator (transition set to `none` inline) and re-evaluates on OS preference change via `matchMedia.addEventListener('change', …)`.
- Keyboard nav mirrors SegmentedControl + extends: ArrowLeft/ArrowUp → previous (wrap 0→1), ArrowRight/ArrowDown → next (wrap 1→0), Enter/Space → reactivate. `preventDefault()` on arrows. Focus follows selection.
- Exactly-2-segment constraint enforced both at type (`readonly [ToggleSegment<T>, ToggleSegment<T>]`) and runtime (`throw` with "exactly 2 segments" message) — downstream misuse fails loudly.
- 8 vitest unit tests passing: radiogroup render + aria-checked, click, ArrowRight, ArrowLeft wrap, Enter, reduced-motion transition=none, 2-segment runtime throw, icon render.

## Task Commits

1. **Task 1: Create Toggle primitive** — `291b2b9` (feat)
2. **Task 2: Unit tests** — `dd2fd2b` (test)

_Plan metadata commit follows this SUMMARY write._

## Files Created/Modified

- `frontend/src/components/ui/toggle.tsx` (CREATED, 125 lines) — Toggle primitive with usePrefersReducedMotion hook, roving-tabindex keyboard handler, animated indicator, 2-segment runtime assertion.
- `frontend/src/components/ui/toggle.test.tsx` (CREATED, 100 lines) — 8 vitest tests using @testing-library/react + jsdom (vitest.config already wires jsdom env from Phase 52).

## Decisions Made

- **Independent primitive, not SegmentedControl extension** (resolves Phase 54 open Decision 1): the 2-option contract is statically typed as a readonly 2-tuple; the sliding-indicator mechanic is not a conditional branch inside SegmentedControl. SegmentedControl stays unchanged.
- **Require `icon` or `label` per segment** (throws if both missing): the plan's behavior block said "both missing → throw at runtime"; implemented as a render-time throw inside the segment map.
- **SSR-safe matchMedia guard:** `usePrefersReducedMotion` checks `typeof window !== "undefined" && typeof window.matchMedia === "function"` before touching it — keeps the primitive safe for future SSR without breaking current CSR use.

## Deviations from Plan

None of substance. Two tiny implementation notes that stay within the plan's letter:

- The plan's sample test code had a typo (`@ ts-expect-error` outside the JSX) — in the final test I placed `@ts-expect-error` on the `segments={[segs[0]]}` line so the deliberate bad input type-checks cleanly. Behaviorally identical.
- Added an SSR guard around `window.matchMedia` inside `usePrefersReducedMotion` (not required by the plan, but defensive — no behavior change in the jsdom test env or the live app). Tracked as [Rule 2 - Missing Critical, micro].

**Total deviations:** 1 defensive micro-fix (Rule 2).
**Impact on plan:** None — all acceptance criteria + verification commands pass.

## Issues Encountered

None. `npx tsc --noEmit` clean, 8/8 vitest tests pass on first run.

## User Setup Required

None — pure frontend primitive, no env vars, no service config.

## Next Phase Readiness

- Plan 54-02 (navbar Sales/HR migration), 54-03 (chart-type toggles), 54-04 (theme toggle), 54-05 (LanguageToggle) can now `import { Toggle } from "@/components/ui/toggle"` and pass a 2-tuple `segments` array with optional per-segment `icon`.
- TOGGLE-01 (pill + animated indicator) and TOGGLE-05 (reduced-motion + keyboard + radiogroup) fully close here. TOGGLE-02/03/04 partially close at creation and fully close as each migration plan lands in this phase.
- No blockers for the remaining 4 plans in this phase. No hazard flags triggered (no `dark:` variants, no hex literals, no apiClient violations, no backend edits).

## Self-Check: PASSED

- `frontend/src/components/ui/toggle.tsx` — FOUND
- `frontend/src/components/ui/toggle.test.tsx` — FOUND
- Commit `291b2b9` — FOUND
- Commit `dd2fd2b` — FOUND

---
*Phase: 54-toggle-primitive-migrations*
*Completed: 2026-04-21*
