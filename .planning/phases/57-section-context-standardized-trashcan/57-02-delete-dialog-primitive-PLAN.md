---
phase: 57-section-context-standardized-trashcan
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/ui/delete-dialog.tsx
  - frontend/src/components/ui/__tests__/delete-dialog.test.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-04]

must_haves:
  truths:
    - "DeleteDialog primitive exists under components/ui/ and wraps components/ui/dialog.tsx stack"
    - "Cancel button has autoFocus (D-05 safety default)"
    - "Confirm button uses variant='destructive' (D-06)"
    - "Dialog renders DialogTitle with font-medium leading-none override"
    - "Zero dark: variants introduced; zero hardcoded colors"
  artifacts:
    - path: "frontend/src/components/ui/delete-dialog.tsx"
      provides: "DeleteDialog component (open, onOpenChange, title?, body, cancelLabel?, confirmLabel?, onConfirm, confirmDisabled?)"
      contains: "export function DeleteDialog"
    - path: "frontend/src/components/ui/__tests__/delete-dialog.test.tsx"
      provides: "unit tests — autoFocus on Cancel, destructive on Confirm, onConfirm dispatch, Esc cancels"
      contains: "describe(\"DeleteDialog\""
  key_links:
    - from: "frontend/src/components/ui/delete-dialog.tsx"
      to: "frontend/src/components/ui/dialog.tsx"
      via: "imports Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter"
      pattern: "@/components/ui/dialog"
    - from: "frontend/src/components/ui/delete-dialog.tsx"
      to: "frontend/src/components/ui/button.tsx"
      via: "Button variant=destructive + variant=outline"
      pattern: "@/components/ui/button"
---

<objective>
Promote `frontend/src/components/DeleteConfirmDialog.tsx` to a canonical
kebab-case primitive at `frontend/src/components/ui/delete-dialog.tsx`
(per D-01). Generic props (title/body/cancelLabel/confirmLabel), Cancel
autoFocus (D-05), destructive Confirm variant (D-06). The legacy
`DeleteConfirmDialog.tsx` file is NOT deleted here — that happens in
Wave C when its sole consumer (UploadHistory) migrates.

Purpose: Satisfy SECTION-04 — one canonical confirm dialog primitive.
Output: One new primitive + test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-CONTEXT.md
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/components/DeleteConfirmDialog.tsx
@frontend/src/components/ui/dialog.tsx
@frontend/src/components/ui/button.tsx

<interfaces>
<!-- dialog.tsx exports (from RESEARCH Q3) -->
```ts
// From @/components/ui/dialog
export { Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogOverlay, DialogPortal,
  DialogTitle, DialogTrigger }
// DialogTitle ships font-medium already (dialog.tsx:123) — NO override needed per RESEARCH Pitfall 5
```

<!-- Primitive contract (per UI-SPEC §Interaction Contract) -->
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
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for DeleteDialog</name>
  <files>frontend/src/components/ui/__tests__/delete-dialog.test.tsx</files>
  <behavior>
    - Test 1: when open=true, renders DialogTitle with default t("ui.delete.title") when no title prop
    - Test 2: renders provided body ReactNode
    - Test 3: Cancel button has autoFocus (assert document.activeElement is Cancel on open)
    - Test 4: Cancel button variant is 'outline' (assert class fragment or data-variant)
    - Test 5: Confirm button variant is 'destructive' (assert class fragment)
    - Test 6: clicking Confirm calls onConfirm
    - Test 7: clicking Cancel calls onOpenChange(false) and does NOT call onConfirm
    - Test 8: confirmDisabled=true disables Confirm button
  </behavior>
  <action>
    Create the test file using vitest + @testing-library/react + userEvent.

    Mirror existing primitive tests (e.g., Phase 55 `__tests__` patterns).
    Use i18next test provider with `ui.delete.title='Delete'`, `ui.delete.cancel='Cancel'`,
    `ui.delete.confirm='Delete'` preloaded in test resources.

    Known jsdom pitfall (see Phase 55 notes): base-ui Dialog may not fully drive
    pointer events. For Test 3 (autoFocus), prefer asserting on Cancel element's
    `autoFocus` prop / `document.activeElement` after open. If backdrop-dismiss
    is blocked in jsdom, skip that assertion with a TODO comment — not required
    by behavior list.

    Run `npm --prefix frontend test -- delete-dialog` → MUST fail (no module).

    Commit: `test(57-02): add failing tests for DeleteDialog primitive`.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- delete-dialog 2>&1 | grep -E "FAIL|Cannot find"</automated>
  </verify>
  <done>Test file exists; tests fail because primitive is not yet implemented.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement DeleteDialog primitive (GREEN)</name>
  <files>frontend/src/components/ui/delete-dialog.tsx</files>
  <action>
    Create `frontend/src/components/ui/delete-dialog.tsx`. Source-of-shape is
    `frontend/src/components/DeleteConfirmDialog.tsx` — read it line-by-line
    and promote to the generic signature.

    Structure (per D-01, D-05, D-06, UI-SPEC §DeleteDialog):

    ```tsx
    import type { ReactNode } from "react";
    import { useTranslation } from "react-i18next";
    import {
      Dialog, DialogContent, DialogDescription,
      DialogFooter, DialogHeader, DialogTitle,
    } from "@/components/ui/dialog";
    import { Button } from "@/components/ui/button";

    export interface DeleteDialogProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      title?: string;
      body: ReactNode;
      cancelLabel?: string;
      confirmLabel?: string;
      onConfirm: () => void | Promise<void>;
      confirmDisabled?: boolean;
    }

    export function DeleteDialog({
      open, onOpenChange, title, body,
      cancelLabel, confirmLabel,
      onConfirm, confirmDisabled,
    }: DeleteDialogProps) {
      const { t } = useTranslation();
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title ?? t("ui.delete.title")}</DialogTitle>
              <DialogDescription asChild>
                <div>{body}</div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" autoFocus onClick={() => onOpenChange(false)}>
                {cancelLabel ?? t("ui.delete.cancel")}
              </Button>
              <Button variant="destructive" disabled={confirmDisabled} onClick={() => void onConfirm()}>
                {confirmLabel ?? t("ui.delete.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    ```

    Implementation notes:
    - Do NOT override DialogTitle className — dialog.tsx:123 already ships
      `font-heading text-base leading-none font-medium` (per RESEARCH Pitfall 5,
      UI-SPEC's override note is stale). Verify with `rg "font-medium"
      frontend/src/components/ui/dialog.tsx` before coding.
    - `body` is wrapped in `<DialogDescription asChild><div>{body}</div></DialogDescription>`
      so caller can pass inline React (with <strong> for itemLabel) without
      nesting block elements inside a `<p>`. If `asChild` is not supported by
      the existing DialogDescription, render `<DialogDescription>` as wrapper
      and accept that block-in-p warning is suppressed by wrapping `body` in
      a span; or pass `body` outside of DialogDescription with custom spacing.
      Check dialog.tsx to confirm the best insertion point.
    - `autoFocus` on Cancel (D-05). Note: base-ui Dialog also has initialFocus —
      autoFocus on the button element should work; if not, use Dialog's
      initialFocus prop.
    - Zero `dark:` variants. Zero new hardcoded colors. All via Button/Dialog tokens.

    i18n keys `ui.delete.*` will be added in Plan 57-04; tests preload them.

    Run `npm --prefix frontend test -- delete-dialog` → GREEN.

    Commit: `feat(57-02): implement DeleteDialog primitive`.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- delete-dialog</automated>
  </verify>
  <done>
    - All tests pass
    - `rg "dark:" frontend/src/components/ui/delete-dialog.tsx` → 0
    - `rg "font-semibold" frontend/src/components/ui/delete-dialog.tsx` → 0
    - Exports match signature in <interfaces>
  </done>
</task>

</tasks>

<verification>
- DeleteDialog consumable from `@/components/ui/delete-dialog`
- Cancel is autoFocused; Confirm is destructive variant
- Tests green; no dark: variants
</verification>

<success_criteria>
1. `frontend/src/components/ui/delete-dialog.tsx` exists, exports `DeleteDialog` + `DeleteDialogProps`
2. `npm --prefix frontend test -- delete-dialog` passes
3. Zero dark: matches, zero font-semibold matches
4. Does NOT delete or modify `frontend/src/components/DeleteConfirmDialog.tsx` (left for Wave C)
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-02-SUMMARY.md`
</output>
