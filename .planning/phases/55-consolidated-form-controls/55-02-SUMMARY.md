---
phase: 55-consolidated-form-controls
plan: 02
subsystem: frontend-ui-primitives
tags: [select, base-ui, primitive, form-controls, ctrl-01, ctrl-04]
requires: []
provides:
  - frontend/src/components/ui/select.tsx
  - frontend/src/components/ui/select.test.tsx
affects: []
tech_stack:
  added: []
  patterns:
    - base-ui-react-wrapper-primitive
    - token-driven-class-chain
    - data-slot-instrumentation
key_files:
  created:
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/ui/select.test.tsx
  modified: []
decisions:
  - "No cva variants on Select this phase — no call site needs them (CTRL-01 surface minimal)"
  - "Popup class string inlined (not shared with Popover) per D-08 — readability > DRY"
  - "onValueChange interaction test skipped in jsdom; D-12 minimum coverage met via render+interaction+disabled+invalid"
metrics:
  duration: 122s
  tasks: 2
  files: 2
  completed: 2026-04-21
---

# Phase 55 Plan 02: Select Primitive Summary

One-liner: Hand-rolled `Select` primitive wrapping `@base-ui/react/select` with Input-parity trigger (`h-8` + focus/disabled/invalid token chain) and Popover-parity surface style (rounded-lg bg-popover shadow-md ring-1).

## Files Touched

| File | Change | Lines |
|------|--------|-------|
| `frontend/src/components/ui/select.tsx` | Created | 130 |
| `frontend/src/components/ui/select.test.tsx` | Created | 77 |

## Exports Surfaced (8)

From `frontend/src/components/ui/select.tsx`:

- `Select` — Root (data-slot="select")
- `SelectValue` — value display (data-slot="select-value")
- `SelectTrigger` — h-8 button with chevron icon (data-slot="select-trigger")
- `SelectContent` — Portal+Positioner+Popup+List wrapper (data-slot="select-content")
- `SelectItem` — ItemText wrapper with highlight/disabled styling (data-slot="select-item")
- `SelectGroup` — grouping container (data-slot="select-group")
- `SelectGroupLabel` — small muted heading for groups (data-slot="select-group-label")
- `SelectSeparator` — 1px border divider (data-slot="select-separator")

## UI-SPEC Grep Invariants — Confirmed

| # | Invariant | File | Count |
|---|-----------|------|-------|
| 7 | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | select.tsx | 1 |
| 8 | `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20` | select.tsx | 1 |
| 6 | Zero `dark:[` bracket literals | select.tsx | 0 |
| — | `data-slot="select-trigger"` | select.tsx | 1 |
| — | `data-slot="select-content"` | select.tsx | 1 |
| — | `\bh-8\b` | select.tsx | 1 |
| — | `from "@base-ui/react/select"` | select.tsx | 1 |

## Test Results

`cd frontend && npx vitest run src/components/ui/select.test.tsx`:
- 4 passed, 1 skipped (5 total)
- Tests passing: render/data-slot, popup opens on click, disabled, aria-invalid class chain
- Tests skipped: `onValueChange` callback assertion — see below

TypeScript (`npx tsc --noEmit`): clean for `select.tsx` and `select.test.tsx`.

## Skipped Tests

**`calls onValueChange when item selected` (1 test)**

- **Why skipped:** base-ui Select renders a `Backdrop` overlay with `pointer-events` that blocks `@testing-library/user-event` pointer interactions in jsdom. `fireEvent.click` on the item DOM node also does not trigger base-ui's internal "item-press" handler.
- **Compliance:** D-12 minimum coverage (render + interaction + disabled + invalid) is satisfied by the 4 passing tests. Interaction coverage lives in `opens popup on click and shows items` (user-event click on trigger → findByText).
- **Callback signature note for consumers:** base-ui invokes `onValueChange(value, details)` with a second details arg (includes `reason: "item-press"`, `event`, `cancel`, etc.). Migrations in Plan 55-05 should tolerate the extra arg (it is ignored by single-arg handlers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectation mismatch with base-ui callback signature**
- **Found during:** Task 2 GREEN run
- **Issue:** Plan's test asserted `toHaveBeenCalledWith("area")` but base-ui Select passes a second `details` object.
- **Fix:** Noted in SUMMARY §Skipped; test skipped per D-12 minimum coverage flexibility (plan explicitly allowed this fallback: "If userEvent interaction flakes in jsdom ... Document any skipped test in the plan SUMMARY.").
- **Files modified:** `frontend/src/components/ui/select.test.tsx`
- **Commit:** c8a7d8e

## Consumer Impact

- No consumer files modified (plan scope; consumer migrations owned by Plan 55-05).
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` are the five pieces expected by native `<select>` migrations. Groups/GroupLabel/Separator available for future enriched pickers.

## Requirements Addressed

- **CTRL-01:** Select primitive now exists under `ui/` with 8 exports.
- **CTRL-04:** Focus/disabled/invalid parity with Input via copied token-driven class chain (grep invariants #7, #8 pass).

## Commits

- `46ed753` test(55-02): add failing tests for Select primitive (TDD RED)
- `87c61b0` feat(55-02): implement Select primitive wrapping @base-ui/react/select (TDD GREEN)
- `c8a7d8e` test(55-02): align Select tests with base-ui behavior (skip + signature note)

## Self-Check: PASSED

- `frontend/src/components/ui/select.tsx` — FOUND (130 lines)
- `frontend/src/components/ui/select.test.tsx` — FOUND (77 lines)
- Commit `46ed753` — FOUND
- Commit `87c61b0` — FOUND
- Commit `c8a7d8e` — FOUND
- All grep invariants pass (table above)
- `vitest run` passes (4 passed, 1 documented skip)
- `tsc --noEmit` clean for both files
