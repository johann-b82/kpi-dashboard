---
phase: 59-a11y-parity-sweep
plan: 2
subsystem: ui
tags: [a11y, focus-ring, tailwind, toggle, checkbox, badge]

requires:
  - phase: 54-toggle-primitive
    provides: Toggle primitive with 2-tuple segments
  - phase: 55-consolidated-form-controls
    provides: Button/Input/Textarea/Select primitives shipped with Path A focus-ring
provides:
  - Toggle segment buttons now render visible focus-ring (A11Y-02 gap closed)
  - Checkbox converged from Path B (ring-2 + ring-offset-2) to Path A
  - Badge normalized from arbitrary-value ring-[3px] to ring-3
  - All components/ui/ primitives share single canonical focus-ring utility
affects: [59-03-ci-guards-color-aria, 59-04-dark-mode-manual-audit]

tech-stack:
  added: []
  patterns:
    - "Path A canonical focus-ring: outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    - "Toggle segment variant: outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20 (container owns border)"

key-files:
  created: []
  modified:
    - frontend/src/components/ui/toggle.tsx
    - frontend/src/components/ui/toggle.test.tsx
    - frontend/src/components/ui/checkbox.tsx
    - frontend/src/components/ui/badge.tsx

key-decisions:
  - "Path A selected over CONTEXT.md D-04 Path B — matches 4 shipped primitives already; lower-churn convergence"
  - "Toggle segments use focus-visible:z-20 to keep ring above animated bg-primary indicator"
  - "Border swap (focus-visible:border-ring) omitted on Toggle segments because parent container owns the border"

patterns-established:
  - "Path A canonical fragment: all focusable primitives in components/ui/ use outline-none + focus-visible:ring-3 + focus-visible:ring-ring/50"
  - "Where a primitive has a parent-owned border, segments drop the focus-visible:border-ring token but keep the rest of Path A"

requirements-completed: [A11Y-02]

duration: 76s
completed: 2026-04-22
---

# Phase 59 Plan 2: Focus Ring Convergence Summary

**Closed A11Y-02 focus-ring gap: Toggle segments now render visible ring; Checkbox + Badge converged from Path B/drift onto the canonical Path A utility shared by Button/Input/Textarea/Select.**

> Path A selected over CONTEXT.md D-04 Path B — rationale in plan objective; user may override by filing a follow-up to retrofit all 5 primitives.

## Performance

- **Duration:** 76s
- **Started:** 2026-04-22T10:25:20Z
- **Completed:** 2026-04-22T10:26:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Toggle segment `<button role="radio">` now carries `outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-20` on both active/inactive branches
- New unit test asserts focus-ring utility present on all Toggle segments (9 tests pass, was 8)
- Checkbox migrated off `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` onto Path A
- Badge `focus-visible:ring-[3px]` normalized to `focus-visible:ring-3`
- `grep -rE 'focus-visible:ring-(offset-)?2\b' frontend/src/components/ui/` returns zero matches — two-spec drift fully retired

## Task Commits

1. **Task 1 RED: failing focus-ring test** — `d02f960` (test)
2. **Task 1 GREEN: add focus-visible ring to Toggle** — `6827cb6` (feat)
3. **Task 2: converge Checkbox + Badge to Path A** — `ed02c39` (refactor)

## Files Created/Modified
- `frontend/src/components/ui/toggle.tsx` — Path A utility on both segment branches + rationale comment
- `frontend/src/components/ui/toggle.test.tsx` — new test A11Y-02 asserting focus-visible class tokens on every radio
- `frontend/src/components/ui/checkbox.tsx` — Path B chain replaced with Path A fragment
- `frontend/src/components/ui/badge.tsx` — `ring-[3px]` → `ring-3`

## Decisions Made
- Selected Path A (shipped by Button/Input/Textarea/Select) over CONTEXT.md D-04 Path B to minimize churn; honors D-04 spirit (visible focus ring via `--ring` token in both themes) while converging to the majority pattern. Rationale recorded in plan objective per Pitfall 2.
- For Toggle segments, dropped the `focus-visible:border-ring` token (parent `<div>` owns the border) and added `focus-visible:z-20` so the ring renders above the animated `bg-primary` indicator.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TDD RED confirmed missing ring, GREEN confirmed 9/9 toggle tests + 48/49 ui primitive tests pass (1 pre-existing skip from 55-02 jsdom Select backdrop).

## User Setup Required
None — pure-frontend change, no external service configuration.

## Next Phase Readiness
- Plan 59-03 (CI guards color/aria) can now add a grep guard enforcing "no `ring-[3px]`, no `ring-2 + ring-offset-2` in components/ui/" knowing the invariant holds today.
- Plan 59-04 (manual dark-mode audit) will visually confirm Toggle focus ring in dev preview — this plan's unit test only asserts classList presence.

## Self-Check: PASSED
- FOUND: frontend/src/components/ui/toggle.tsx (modified)
- FOUND: frontend/src/components/ui/toggle.test.tsx (modified)
- FOUND: frontend/src/components/ui/checkbox.tsx (modified)
- FOUND: frontend/src/components/ui/badge.tsx (modified)
- FOUND commit: d02f960 (test RED)
- FOUND commit: 6827cb6 (feat GREEN)
- FOUND commit: ed02c39 (refactor convergence)

---
*Phase: 59-a11y-parity-sweep*
*Completed: 2026-04-22*
