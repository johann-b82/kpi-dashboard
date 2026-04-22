---
phase: 57-section-context-standardized-trashcan
plan: 03
type: execute
wave: 1
depends_on: [02]
files_modified:
  - frontend/src/components/ui/delete-button.tsx
  - frontend/src/components/ui/__tests__/delete-button.test.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-03]

must_haves:
  truths:
    - "DeleteButton primitive exists under components/ui/ and composes DeleteDialog internally"
    - "Trigger is a destructive icon-Button with Trash2 glyph"
    - "aria-label is required (explicit, not inferred) — satisfies Phase 59 accessible-name audit"
    - "Dialog open state is internalized by the primitive (consumer passes onConfirm only)"
    - "onConfirm is awaited; dialog closes after it settles (success or error)"
    - "TrashIcon is re-exported from lucide Trash2 for rare raw-glyph needs"
  artifacts:
    - path: "frontend/src/components/ui/delete-button.tsx"
      provides: "DeleteButton composed control + TrashIcon re-export"
      contains: "export function DeleteButton"
    - path: "frontend/src/components/ui/__tests__/delete-button.test.tsx"
      provides: "unit tests — click opens dialog, onConfirm called, closes on settle, aria-label honored"
      contains: "describe(\"DeleteButton\""
  key_links:
    - from: "frontend/src/components/ui/delete-button.tsx"
      to: "frontend/src/components/ui/delete-dialog.tsx"
      via: "imports DeleteDialog primitive"
      pattern: "@/components/ui/delete-dialog"
    - from: "frontend/src/components/ui/delete-button.tsx"
      to: "lucide-react Trash2"
      via: "default icon + TrashIcon re-export"
      pattern: "lucide-react"
---

<objective>
Ship the composed `<DeleteButton>` control that replaces the duplicated
`<Button variant=ghost size=sm><Trash2 /></Button> + feature-specific dialog`
boilerplate across 5 admin call-sites.

Wires icon trigger + DeleteDialog internally. Mutation-agnostic (consumer
passes `onConfirm`, keeps its own useMutation). Exports `TrashIcon` as a
re-export of lucide `Trash2` for the rare non-row raw-glyph case.

Purpose: Satisfy SECTION-03 — the single delete affordance for all admin rows.
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
@frontend/src/components/ui/button.tsx

<interfaces>
<!-- DeleteDialog signature from 57-02 (already shipped before this plan) -->
```ts
interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  body: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  confirmDisabled?: boolean;
}
```

<!-- DeleteButton contract (per UI-SPEC §Interaction Contract) -->
```ts
interface DeleteButtonProps {
  itemLabel: string;               // interpolated into fallback body + <1>itemLabel</1> highlight
  onConfirm: () => void | Promise<void>;
  dialogTitle?: string;
  dialogBody?: ReactNode;          // default uses <Trans i18nKey="ui.delete.bodyFallback" components={{1: <strong ... />}} values={{itemLabel}} />
  cancelLabel?: string;
  confirmLabel?: string;
  "aria-label": string;            // REQUIRED
  disabled?: boolean;
}
```

<!-- Trans component-index pattern (RESEARCH Pitfall 8) -->
<!-- i18n string MUST contain <1>{{itemLabel}}</1> markers — Plan 57-04 owns the key copy -->
<!-- Markdown-style **itemLabel** is NOT parsed by react-i18next natively. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for DeleteButton</name>
  <files>frontend/src/components/ui/__tests__/delete-button.test.tsx</files>
  <behavior>
    - Test 1: renders a button with the consumer-provided aria-label
    - Test 2: renders a Trash2 icon (assert aria-hidden svg presence)
    - Test 3: clicking trigger opens the dialog (DialogTitle visible)
    - Test 4: itemLabel appears inside dialog body (strong element)
    - Test 5: clicking Confirm calls onConfirm handler
    - Test 6: onConfirm returning a resolved promise closes the dialog after settle
    - Test 7: onConfirm throwing / rejecting still closes the dialog (caller handles error)
    - Test 8: disabled prop disables the trigger button
    - Test 9: TrashIcon export equals lucide Trash2 (structural check)
  </behavior>
  <action>
    Create test file. Use vitest + @testing-library/react + userEvent.
    Preload i18n test resources with:
    - ui.delete.title = 'Delete'
    - ui.delete.cancel = 'Cancel'
    - ui.delete.confirm = 'Delete'
    - ui.delete.bodyFallback = 'Are you sure you want to delete <1>{{itemLabel}}</1>?'

    For Test 6/7, pass `onConfirm={() => Promise.resolve()}` and
    `onConfirm={() => Promise.reject(new Error('x'))}`; await microtask flush
    before asserting dialog is closed. Use `act(...)` wrappers as needed.

    Run test → MUST fail (no module).

    Commit: `test(57-03): add failing tests for DeleteButton primitive`.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- delete-button 2>&1 | grep -E "FAIL|Cannot find"</automated>
  </verify>
  <done>Test file exists; tests fail because primitive not implemented.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement DeleteButton primitive (GREEN)</name>
  <files>frontend/src/components/ui/delete-button.tsx</files>
  <action>
    Create `frontend/src/components/ui/delete-button.tsx` per UI-SPEC
    §DeleteButton + D-02:

    ```tsx
    import { useState, type ReactNode } from "react";
    import { Trans, useTranslation } from "react-i18next";
    import { Trash2 } from "lucide-react";
    import { Button } from "@/components/ui/button";
    import { DeleteDialog } from "@/components/ui/delete-dialog";

    export const TrashIcon = Trash2;

    export interface DeleteButtonProps {
      itemLabel: string;
      onConfirm: () => void | Promise<void>;
      dialogTitle?: string;
      dialogBody?: ReactNode;
      cancelLabel?: string;
      confirmLabel?: string;
      "aria-label": string;
      disabled?: boolean;
    }

    export function DeleteButton({
      itemLabel, onConfirm,
      dialogTitle, dialogBody, cancelLabel, confirmLabel,
      "aria-label": ariaLabel, disabled,
    }: DeleteButtonProps) {
      const [open, setOpen] = useState(false);
      const [busy, setBusy] = useState(false);
      const { t } = useTranslation();

      const body = dialogBody ?? (
        <Trans
          i18nKey="ui.delete.bodyFallback"
          values={{ itemLabel }}
          components={{ 1: <strong className="text-foreground font-medium" /> }}
        />
      );

      const handleConfirm = async () => {
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setOpen(false);
        }
      };

      return (
        <>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
          <DeleteDialog
            open={open}
            onOpenChange={setOpen}
            title={dialogTitle ?? t("ui.delete.title")}
            body={body}
            cancelLabel={cancelLabel}
            confirmLabel={confirmLabel}
            onConfirm={handleConfirm}
            confirmDisabled={busy}
          />
        </>
      );
    }
    ```

    Implementation notes (per D-02, D-06, RESEARCH Pitfalls 2/8):
    - Trigger is `variant="destructive" size="icon"` (red affordance + 32px square).
    - `Trash2` svg size comes from button's `[&_svg]:size-4` (inherited).
    - `<Trans components={{ 1: <strong /> }}>` requires bodyFallback translation
      string to contain `<1>{{itemLabel}}</1>` (NOT markdown `**{{itemLabel}}**`).
      Plan 57-04 owns the key copy — use `<1>…</1>` there.
    - `finally` closes the dialog regardless of onConfirm outcome (caller toasts on error).
    - `busy` disables Confirm during async work to prevent double-fire.
    - Zero `dark:` variants.

    Confirm `@/components/ui/delete-dialog` import resolves (57-02 must be
    merged first per depends_on).

    Run tests → GREEN.

    Commit: `feat(57-03): implement DeleteButton composed control`.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- delete-button</automated>
  </verify>
  <done>
    - All tests pass
    - `rg "dark:" frontend/src/components/ui/delete-button.tsx` → 0 matches
    - Exports: DeleteButton, DeleteButtonProps, TrashIcon
  </done>
</task>

</tasks>

<verification>
- DeleteButton renders destructive icon trigger + internalized DeleteDialog
- aria-label is required by type signature (consumer must pass)
- onConfirm awaited; dialog closes on settle
- TrashIcon re-exported
</verification>

<success_criteria>
1. `frontend/src/components/ui/delete-button.tsx` exports DeleteButton + TrashIcon
2. `npm --prefix frontend test -- delete-button` passes
3. Zero dark: matches in source
4. Typescript compile: aria-label is a required string prop
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-03-SUMMARY.md`
</output>
