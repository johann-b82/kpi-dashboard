---
phase: 57-section-context-standardized-trashcan
plan: 02
subsystem: frontend/ui
tags: [primitive, dialog, delete, i18n, tdd]
requires:
  - frontend/src/components/ui/dialog.tsx
  - frontend/src/components/ui/button.tsx
provides:
  - DeleteDialog primitive at @/components/ui/delete-dialog
  - DeleteDialogProps type
affects:
  - downstream Wave B/C migrations (Plans 57-05..57-10) consume this primitive
tech-stack:
  added: []
  patterns:
    - "DialogDescription render={<div />} to avoid p>div nesting when body is ReactNode"
    - "Cancel autoFocus claims initial focus over Confirm (D-05 safety default)"
    - "Test-time i18n key injection via i18n.addResource for keys landing in 57-04"
key-files:
  created:
    - frontend/src/components/ui/delete-dialog.tsx
    - frontend/src/components/ui/delete-dialog.test.tsx
  modified: []
decisions:
  - "DialogTitle wrapper accepts default font-medium leading-none — no override needed (RESEARCH Pitfall 5 confirmed: dialog.tsx:123 already ships these classes)"
  - "DialogDescription uses render={<div />} prop (base-ui pattern) instead of asChild — keeps body ReactNode flexible without p>div nesting"
  - "Cancel autoFocus asserted via document.activeElement (50ms wait) — React strips the autofocus HTML attribute, base-ui Dialog manages focus, but autoFocus prop still wins initial focus"
  - "Title test asserts via getByRole('heading') instead of findByText('Delete') because the destructive Confirm button also reads 'Delete' (text collision with title default)"
metrics:
  duration: ~3m
  completed: 2026-04-22
  tasks_completed: 2
  files_changed: 2
  tests_added: 9
---

# Phase 57 Plan 02: DeleteDialog Primitive Summary

**One-liner:** Promoted legacy `DeleteConfirmDialog` to a kebab-case canonical primitive at `@/components/ui/delete-dialog` with generic props, autoFocused Cancel, destructive Confirm, and i18n-defaulted labels.

---

## Objective Recap

Satisfy SECTION-04 by introducing a single canonical confirm dialog primitive that downstream migrations (57-05..57-10) consume. Generic shape — `body: ReactNode` lets callers compose inline `<strong>{itemLabel}</strong>` markup. Legacy `frontend/src/components/DeleteConfirmDialog.tsx` left untouched — its sole consumer (UploadHistory) migrates in Wave C.

## What Was Built

### Files

- **`frontend/src/components/ui/delete-dialog.tsx`** — exports `DeleteDialog` + `DeleteDialogProps`. Wraps `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter` from `@/components/ui/dialog` and `Button` from `@/components/ui/button`. Defaults `title`, `cancelLabel`, `confirmLabel` to `t("ui.delete.*")` (i18n keys land in 57-04).
- **`frontend/src/components/ui/delete-dialog.test.tsx`** — 9 tests covering default title rendering, custom body, Cancel autoFocus (D-05), outline+destructive variants (D-06), `onConfirm` dispatch, `onOpenChange(false)` on Cancel, `confirmDisabled`, and label override props.

### Contract

```ts
interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;           // default: t("ui.delete.title")
  body: ReactNode;          // REQUIRED
  cancelLabel?: string;     // default: t("ui.delete.cancel")
  confirmLabel?: string;    // default: t("ui.delete.confirm")
  onConfirm: () => void | Promise<void>;
  confirmDisabled?: boolean;
}
```

## TDD Cycle

1. **RED** — wrote 9 tests; suite failed with "Failed to resolve import './delete-dialog'". Commit `6791889`.
2. **GREEN** — implemented primitive. Two tests failed initially:
   - Title `findByText("Delete")` matched both the title and the Confirm button. Switched to `getByRole("heading")`.
   - `cancel.toHaveAttribute("autofocus")` failed because React strips the HTML attribute. Switched to `document.activeElement` check after 50ms tick. Both adjustments preserve the behavioral intent. Commit `798140b`.
3. **REFACTOR** — none needed.

## Verification

- `npm --prefix frontend test -- delete-dialog --run` → **9 passed (9)** in 1.10s
- `grep -c "dark:" frontend/src/components/ui/delete-dialog.tsx` → 0
- `grep -c "font-semibold" frontend/src/components/ui/delete-dialog.tsx` → 0
- `frontend/src/components/DeleteConfirmDialog.tsx` untouched (`ls -la` confirms unchanged mtime)
- Exports match `<interfaces>` contract from PLAN

## Deviations from Plan

### Auto-fixed (Rule 1 — test bugs surfaced during GREEN)

**1. [Rule 1 - Test query collision] Title test used heading role instead of text match**

- **Found during:** Task 2 (GREEN run)
- **Issue:** `findByText("Delete")` matched two nodes (DialogTitle and Confirm button) because `ui.delete.title` and `ui.delete.confirm` both resolve to the literal "Delete".
- **Fix:** Query via `getByRole("heading")` and assert `toHaveTextContent("Delete")`.
- **Files modified:** `frontend/src/components/ui/delete-dialog.test.tsx`
- **Commit:** `798140b`

**2. [Rule 1 - jsdom focus realities] autoFocus assertion via activeElement**

- **Found during:** Task 2 (GREEN run)
- **Issue:** React does not render the `autofocus` HTML attribute (it calls `.focus()` on mount instead). Test using `toHaveAttribute("autofocus")` was wrong.
- **Fix:** Wait 50ms then assert `document.activeElement === cancelButton`. Same behavioral guarantee with the right mechanism.
- **Files modified:** `frontend/src/components/ui/delete-dialog.test.tsx`
- **Commit:** `798140b`

### Implementation choice — DialogDescription render prop

PLAN suggested `<DialogDescription asChild><div>{body}</div></DialogDescription>` to avoid `p > div` nesting warnings. The actual `DialogDescription` is a base-ui primitive that uses the `render` prop (not `asChild`). Substituted `<DialogDescription render={<div />}>{body}</DialogDescription>` — same effect, idiomatic base-ui.

## Authentication Gates

None.

## Known Stubs

None — all behavior wired. The `ui.delete.*` i18n keys are not yet present in `en.json`/`de.json` (Plan 57-04 owns them); tests preload them via `i18n.addResource`. Production callers will see English `t()` fallback strings ("ui.delete.title" etc.) until 57-04 lands. This is intentional and tracked in the wave dependency chain — DeleteDialog has zero in-tree consumers right now, and Wave B/C migrations explicitly run after 57-04.

## Self-Check: PASSED

- Files exist:
  - FOUND: frontend/src/components/ui/delete-dialog.tsx
  - FOUND: frontend/src/components/ui/delete-dialog.test.tsx
- Commits exist:
  - FOUND: 6791889 (test)
  - FOUND: 798140b (feat)
- Tests: 9/9 passing
- Legacy `DeleteConfirmDialog.tsx` untouched
