---
phase: 57-section-context-standardized-trashcan
plan: 03
subsystem: frontend-ui-primitives
tags: [ui-primitive, delete, accessibility, i18n]
requirements: [SECTION-03]

dependency-graph:
  requires:
    - "frontend/src/components/ui/delete-dialog.tsx (Plan 57-02 — DeleteDialog primitive)"
    - "frontend/src/components/ui/button.tsx (variant=destructive, size=icon)"
    - "react-i18next Trans component-index pattern"
    - "lucide-react Trash2 icon"
  provides:
    - "frontend/src/components/ui/delete-button.tsx — DeleteButton composed control"
    - "TrashIcon re-export from delete-button.tsx (lucide Trash2)"
  affects:
    - "Wave 2 migration plans (57-05 media, 57-06 playlists, 57-07 schedules, 57-09 sensors, 57-10 upload-history) — 5 admin call-sites consume DeleteButton"

tech-stack:
  added: []
  patterns:
    - "Composed control: icon trigger + internalized dialog (consumer passes onConfirm only)"
    - "Trans i18n key with <1>{{itemLabel}}</1> component-index for inline emphasis"
    - "Async-confirm pattern with try/catch/finally — dialog closes on settle (success or rejection)"
    - "Required aria-label via TS index-signature 'aria-label': string (Phase 59 a11y audit prep)"

key-files:
  created:
    - "frontend/src/components/ui/delete-button.tsx"
    - "frontend/src/components/ui/__tests__/delete-button.test.tsx"
  modified: []

decisions:
  - "Swallow rejection inside DeleteButton.handleConfirm so the React event-handler boundary stays clean — caller is responsible for surfacing error UI (toast/inline) before throwing."
  - "Use heading role (not text) to assert dialog open in tests — trigger aria-label and confirm button text both contain 'Delete' which makes findByText('Delete') ambiguous."

metrics:
  duration: "116s"
  tasks: 2
  files: 2
  completed: "2026-04-22"
---

# Phase 57 Plan 03: DeleteButton Primitive Summary

DeleteButton composed control with internalized DeleteDialog, required aria-label, and async-confirm settle semantics — single delete affordance for all admin rows.

## What Shipped

- `frontend/src/components/ui/delete-button.tsx` — exports `DeleteButton`, `DeleteButtonProps`, `TrashIcon`
- `frontend/src/components/ui/__tests__/delete-button.test.tsx` — 9 unit tests, all GREEN

## Behavior

- Trigger: `<Button variant="destructive" size="icon">` with `<Trash2 aria-hidden="true" />` glyph; required `aria-label` prop
- Dialog open state internalized — consumer passes `onConfirm` only
- `onConfirm` awaited inside `try { } catch { } finally { setOpen(false) }` — dialog closes on settle (success or error)
- `confirmDisabled` toggled via `busy` state to prevent double-fire during async work
- Default body: `<Trans i18nKey="ui.delete.bodyFallback" values={{itemLabel}} components={{ 1: <strong className="text-foreground font-medium" /> }} />`
- All overrides optional: `dialogTitle`, `dialogBody`, `cancelLabel`, `confirmLabel`, `disabled`
- Zero `dark:` variants (Phase 59 dark-mode sweep prep)

## Test Coverage

| # | Test | Assertion |
|---|------|-----------|
| 1 | Trigger renders with consumer aria-label | `getByRole("button", { name: "Delete media-Foo" })` |
| 2 | Trash2 svg present + aria-hidden | `querySelector("svg")` + `toHaveAttribute("aria-hidden", "true")` |
| 3 | Click trigger opens dialog | `findByRole("heading", { name: "Delete" })` |
| 4 | itemLabel rendered inside `<strong>` | `findByText("summer-promo.mp4").tagName === "STRONG"` |
| 5 | Click Confirm calls onConfirm | `expect(onConfirm).toHaveBeenCalledTimes(1)` |
| 6 | Resolved promise closes dialog | `waitFor(() => queryByRole Cancel === null)` |
| 7 | Rejected promise still closes dialog | same waitFor; rejection swallowed |
| 8 | disabled prop disables trigger | `toBeDisabled()` |
| 9 | TrashIcon === lucide Trash2 | `expect(TrashIcon).toBe(Trash2)` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Swallow rejection inside handleConfirm**
- **Found during:** Task 2 — running tests
- **Issue:** Original implementation per plan was `try { await onConfirm() } finally { close }` with no `catch`. When `onConfirm` rejects, the awaited rejection re-throws inside `handleConfirm`, then `void handleConfirm()` (called from DeleteDialog's onClick) silently dropped the promise — surfacing as a global unhandled rejection in vitest ("Vitest caught 1 unhandled error").
- **Fix:** Added `catch { /* caller surfaces error UI */ }` between `try` and `finally`. The `finally` still runs, dialog still closes, and the rejection is swallowed at the React event-handler boundary. This matches the plan's stated intent: "caller handles error" (i.e., consumer's mutation toasts before throwing).
- **Files modified:** `frontend/src/components/ui/delete-button.tsx`
- **Commit:** `958344b`

**2. [Rule 1 - Bug] Disambiguate dialog-open assertion in test**
- **Found during:** Task 2 — running tests
- **Issue:** `findByText("Delete")` was ambiguous — Confirm button text and the trigger's aria-label both contain "Delete", so when the dialog opens there are multiple matches (DialogTitle h2 + Confirm button).
- **Fix:** Tightened test 3 to use `findByRole("heading", { name: "Delete" })` so it targets only the DialogTitle h2.
- **Files modified:** `frontend/src/components/ui/__tests__/delete-button.test.tsx`
- **Commit:** `958344b`

### Auth Gates

None.

## Verification

- [x] `npm --prefix frontend test -- delete-button` → 9/9 pass
- [x] `rg "dark:" frontend/src/components/ui/delete-button.tsx` → 0 matches
- [x] Exports: `DeleteButton`, `DeleteButtonProps`, `TrashIcon`
- [x] aria-label is required by TS signature (`"aria-label": string` — no `?`)

## Commits

- `92c1641` — test(57-03): add failing tests for DeleteButton primitive
- `958344b` — feat(57-03): implement DeleteButton composed control

## Self-Check: PASSED

- FOUND: frontend/src/components/ui/delete-button.tsx
- FOUND: frontend/src/components/ui/__tests__/delete-button.test.tsx
- FOUND: commit 92c1641
- FOUND: commit 958344b
