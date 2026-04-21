---
phase: 55-consolidated-form-controls
plan: 01
subsystem: frontend/ui-primitives
tags: [ui, primitives, textarea, button, ctrl-01, ctrl-03, ctrl-04]
requires: []
provides:
  - Textarea primitive (CTRL-01)
  - Button size-scale JSDoc (CTRL-03)
  - Shared invalid/focus/disabled class chain parity (CTRL-04)
affects:
  - frontend/src/components/ui/button.tsx
  - frontend/src/components/ui/textarea.tsx (new)
  - frontend/src/components/ui/textarea.test.tsx (new)
tech-stack:
  added: []
  patterns:
    - Plain <textarea> wrapper (no base-ui subpath available)
    - Class-chain SSOT shared with Input
key-files:
  created:
    - frontend/src/components/ui/textarea.tsx
    - frontend/src/components/ui/textarea.test.tsx
  modified:
    - frontend/src/components/ui/button.tsx
decisions:
  - D-04/D-05 executed: button lg + icon-lg variants removed
  - D-06 executed: Textarea is plain <textarea> (base-ui has no subpath)
  - D-07 executed: no error?: string prop; caller-driven aria-invalid
  - D-08 executed: focus/disabled/invalid class chain byte-identical fragments to Input
metrics:
  duration: 83s
  tasks: 2
  files: 3
  completed: 2026-04-21
---

# Phase 55 Plan 01: Button Cleanup + Textarea Primitive Summary

Close out button size-scale cleanup (D-04/D-05) and ship the Textarea primitive with class-chain parity to Input (D-06/D-07/D-08).

## What Shipped

### Task 1: Button variants cleanup (CTRL-03)
- Removed `lg: "h-9 ..."` and `"icon-lg": "size-9"` from `buttonVariants.size`.
- Remaining sizes: `default`, `xs`, `sm`, `icon`, `icon-xs`, `icon-sm`.
- Added CTRL-03 size-scale JSDoc block above `const buttonVariants`.
- Zero call sites affected (pre-verified via research; grep `size=['"](lg|icon-lg)['"]` → 0 matches).
- Commit: 5be0308

### Task 2: Textarea primitive + unit tests (CTRL-01, CTRL-04)
- `frontend/src/components/ui/textarea.tsx`: plain `<textarea>` wrapper with `data-slot="textarea"`, `rows={3}` default, `min-h-16`, `resize-y`.
- Class chain uses byte-identical fragments to Input for:
  - `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`
  - `disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50`
  - `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20`
- `textarea.test.tsx`: 6 tests — render/data-slot, default rows, explicit rows, disabled chain, invalid chain, caller className merge.
- RED commit: e9b1f24; GREEN commit: 7ce38a3.

## UI-SPEC Grep Invariants

- Invariant #1 (Textarea primitive exists): PASS — `frontend/src/components/ui/textarea.tsx` ships with `data-slot="textarea"`.
- Invariant #2 (no `lg`/`icon-lg` in button): PASS — both deletions verified via grep (0 matches).

## Verification

- `cd frontend && npx vitest run src/components/ui/textarea.test.tsx` → 6/6 pass.
- `npx tsc --noEmit --project tsconfig.app.json` → no new errors in touched files (button.tsx, textarea.tsx, textarea.test.tsx).
- `rg "size=['\"](lg|icon-lg)['\"]" frontend/src` → 0 matches.
- `rg 'lg: "h-9' frontend/src/components/ui/button.tsx` → 0 matches.
- `rg '"icon-lg": "size-9"' frontend/src/components/ui/button.tsx` → 0 matches.

## Deviations from Plan

None — plan executed exactly as written. Class chain matches Input SSOT verbatim; no consumer files modified.

## Decisions Made

- D-04/D-05/D-06/D-07/D-08 already locked at plan time; executed as specified.

## Commits

- 5be0308: refactor(55-01): remove lg/icon-lg button sizes and add size-scale JSDoc
- e9b1f24: test(55-01): add failing Textarea tests (RED)
- 7ce38a3: feat(55-01): ship Textarea primitive (GREEN)

## Known Stubs

None. Textarea primitive is fully wired; no placeholder data or TODOs introduced.

## Self-Check: PASSED

- FOUND: frontend/src/components/ui/button.tsx (modified; commit 5be0308)
- FOUND: frontend/src/components/ui/textarea.tsx (commit 7ce38a3)
- FOUND: frontend/src/components/ui/textarea.test.tsx (commit e9b1f24)
- FOUND commit: 5be0308
- FOUND commit: e9b1f24
- FOUND commit: 7ce38a3
