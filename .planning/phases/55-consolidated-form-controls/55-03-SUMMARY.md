---
phase: 55-consolidated-form-controls
plan: 03
subsystem: frontend/ui-primitives
tags: [ui, primitive, dropdown, menu, base-ui, action-menu]
requirements: [CTRL-01, CTRL-04]
dependency_graph:
  requires:
    - "@base-ui/react/menu (already installed)"
    - "frontend/src/components/ui/button.tsx (for render-prop composition)"
    - "popover.tsx surface style (class-fragment parity)"
  provides:
    - "Dropdown primitive at frontend/src/components/ui/dropdown.tsx"
    - "DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator"
  affects:
    - "Future action-menu migrations (not done this plan — D-02: primitive only)"
tech_stack:
  added: []
  patterns:
    - "Base-ui render prop for unstyled trigger + caller-supplied Button (Pitfall 5)"
    - "Shared popup surface class fragment (rounded-lg bg-popover shadow-md ring-1 ring-foreground/10) — byte-identical to Popover + future Select"
    - "Token-driven item visuals via data-[highlighted] / data-[disabled]"
key_files:
  created:
    - frontend/src/components/ui/dropdown.tsx
    - frontend/src/components/ui/dropdown.test.tsx
  modified: []
decisions:
  - "Dropdown is action-menu semantics (Edit/Delete/Duplicate), distinct from Select — D-02"
  - "Included DropdownSeparator (+3 lines) per RESEARCH Open Question 2 — unblocks future admin-table row-action adoption without follow-up PR"
  - "NO DropdownSubmenu / CheckboxItem / RadioItem wrappers — D-02 scope is primitive-only"
  - "Trigger left unstyled — caller passes render={<Button />} via base-ui render prop"
  - "DropdownContent defaults: align=end, sideOffset=4 — row-action kebab trigger ergonomics"
metrics:
  duration: "~92s"
  completed: "2026-04-21T20:42:23Z"
  tasks: 2
  files: 2
  commits: 2
---

# Phase 55 Plan 03: Dropdown Primitive Summary

Ships the Dropdown primitive — a token-driven action menu wrapping `@base-ui/react/menu` with popup surface parity to Popover/Select and caller-supplied styled triggers via base-ui's render prop.

## What Landed

**`frontend/src/components/ui/dropdown.tsx`** — 5 named exports:

| Export              | Wraps                     | Responsibility                                                                             |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `Dropdown`          | `MenuPrimitive.Root`      | Root controller                                                                            |
| `DropdownTrigger`   | `MenuPrimitive.Trigger`   | Unstyled — caller supplies `render={<Button … />}` for styling (Pitfall 5)                 |
| `DropdownContent`   | `Portal+Positioner+Popup` | Popup surface, defaults `align="end"`, `sideOffset=4`; surface class matches Popover SSOT  |
| `DropdownItem`      | `MenuPrimitive.Item`      | Tokenized via `data-[highlighted]:bg-muted` + `data-[disabled]:opacity-50`                 |
| `DropdownSeparator` | `MenuPrimitive.Separator` | `-mx-1 my-1 h-px bg-border`                                                                |

**`frontend/src/components/ui/dropdown.test.tsx`** — 5/5 unit tests PASS:

1. trigger renders via render prop
2. popup opens on click, items visible
3. item onClick fires
4. destructive `className="text-destructive"` applied on Delete item
5. disabled item does not fire onClick

## Verification

- `cd frontend && npx vitest run src/components/ui/dropdown.test.tsx` → 5 passed (5)
- `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → no errors attributable to dropdown.tsx or dropdown.test.tsx (pre-existing errors in unrelated files remain; out-of-scope per Rule scope boundary)
- Acceptance grep invariants (all pass):
  - `rg 'from "@base-ui/react/menu"' dropdown.tsx` → 1
  - `rg 'data-slot="dropdown-content"' dropdown.tsx` → 1
  - `rg 'data-slot="dropdown-item"' dropdown.tsx` → 1
  - `rg 'rounded-lg bg-popover' dropdown.tsx` → 1
  - `rg 'data-\[highlighted\]:bg-muted' dropdown.tsx` → 1
  - `rg 'dark:\[' dropdown.tsx` → 0 (UI-SPEC invariant #6 clean)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Removed unused `import * as React from "react"`**

- **Found during:** Task 1 scoped tsc check
- **Issue:** TS6133 — `'React' is declared but its value is never read.` under the project's `noUnusedLocals`/`noUnusedParameters` compiler settings. The file uses JSX via automatic runtime (React 19) and has no explicit `React.*` references.
- **Fix:** Deleted the unused import line.
- **Files modified:** `frontend/src/components/ui/dropdown.tsx`
- **Commit:** included in Task 1 commit `52e97b8` (fix applied before commit, not a separate fix-up commit).

### Minor Type Shape Adjustment (within plan latitude)

The plan's sketch declared `type DropdownContentProps = MenuPrimitive.Popup.Props & { align?: "start" | "center" | "end"; sideOffset?: number }`. Per plan note ("If base-ui's `Positioner.Props` doesn't have a top-level `align` field … read the installed typings"), I inspected `MenuPositioner.d.ts`: `align` IS a top-level prop sourced from base-ui's shared `Align` union. To avoid narrowing (and potential TS2322 against a wider union), I used `Pick<MenuPrimitive.Positioner.Props, "align" | "sideOffset">` instead. Behaviorally identical default of `align="end"`, but the type is inherited from base-ui — no bespoke narrowing. This matches the same pattern used by `popover.tsx` (Pick over the Positioner props).

## Known Stubs

None. The primitive has no data dependencies and ships no placeholders.

## D-02 Scope Observed

- No existing action-menu call sites migrated (none exist yet; kebab/three-dot row actions are still to come).
- No `DropdownSubmenu` / `CheckboxItem` / `RadioItem` wrappers exported — incremental follow-ups if future phases need them.

## Wave 1 Invariant Check (ui/ file count)

Grep invariant #1 — "five ui/ files exist after Wave 1" — will pass once Plans 01 + 02 + 03 all land. As of this plan's completion:

- ✓ `dropdown.tsx` (this plan)
- Plan 01 (button-cleanup-textarea) — in flight (parallel wave 1)
- Plan 02 (select-primitive) — in flight (parallel wave 1); `select.test.tsx` already on disk referencing a not-yet-shipped `select.tsx` (expected pre-existing tsc error, NOT caused by this plan)

## Commits

| Commit    | Message                                                                   |
| --------- | ------------------------------------------------------------------------- |
| `52e97b8` | feat(55-03): add Dropdown primitive wrapping @base-ui/react/menu          |
| `82595ef` | test(55-03): unit tests for Dropdown primitive (5/5 pass)                 |

## Self-Check: PASSED

- `frontend/src/components/ui/dropdown.tsx` — exists
- `frontend/src/components/ui/dropdown.test.tsx` — exists
- Commit `52e97b8` — present in git log
- Commit `82595ef` — present in git log
- All 5 tests pass
- All 6 acceptance greps satisfy expected counts
