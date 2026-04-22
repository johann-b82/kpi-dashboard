---
phase: 57-section-context-standardized-trashcan
plan: 09
type: execute
wave: 2
depends_on: [01, 02, 04]
files_modified:
  - frontend/src/pages/SensorsSettingsPage.tsx
  - frontend/src/components/settings/sensors/SensorAdminHeader.tsx
  - frontend/src/components/settings/sensors/SensorRowForm.tsx
  - frontend/src/components/settings/sensors/SensorRemoveDialog.tsx
autonomous: true
gap_closure: false
requirements: [SECTION-01, SECTION-04]

must_haves:
  truths:
    - "SensorsSettingsPage renders SectionHeader instead of SensorAdminHeader"
    - "SensorAdminHeader.tsx retired (deleted)"
    - "SensorRowForm migrates to DeleteDialog directly (NOT DeleteButton) — preserving the text+label ghost button trigger per Pitfall 3"
    - "SensorRemoveDialog.tsx deleted"
    - "Two stale window.confirm comment references cleaned up"
  artifacts:
    - path: "frontend/src/pages/SensorsSettingsPage.tsx"
      provides: "SectionHeader adoption; no SensorAdminHeader"
      contains: "<SectionHeader"
    - path: "frontend/src/components/settings/sensors/SensorRowForm.tsx"
      provides: "text+label ghost trigger opens DeleteDialog directly"
      contains: "DeleteDialog"
  key_links:
    - from: "frontend/src/pages/SensorsSettingsPage.tsx"
      to: "frontend/src/components/ui/section-header.tsx"
      via: "imports SectionHeader; removes SensorAdminHeader"
      pattern: "@/components/ui/section-header"
    - from: "frontend/src/components/settings/sensors/SensorRowForm.tsx"
      to: "frontend/src/components/ui/delete-dialog.tsx"
      via: "imports DeleteDialog (bypasses DeleteButton per Pitfall 3)"
      pattern: "@/components/ui/delete-dialog"
---

<objective>
Migrate Sensors admin: collapse SensorAdminHeader → SectionHeader; migrate
SensorRowForm's text+label Remove button to open the canonical DeleteDialog
directly (Pitfall 3: icon-only DeleteButton would regress the visual);
retire SensorRemoveDialog.tsx.

Purpose: SECTION-01 + SECTION-04 for `/settings/sensors`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/57-section-context-standardized-trashcan/57-UI-SPEC.md
@.planning/phases/57-section-context-standardized-trashcan/57-RESEARCH.md
@frontend/src/pages/SensorsSettingsPage.tsx
@frontend/src/components/settings/sensors/SensorAdminHeader.tsx
@frontend/src/components/settings/sensors/SensorRowForm.tsx
@frontend/src/components/settings/sensors/SensorRemoveDialog.tsx
@frontend/src/components/ui/section-header.tsx
@frontend/src/components/ui/delete-dialog.tsx

<interfaces>
<!-- DeleteDialog signature (from 57-02) -->
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
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap SensorAdminHeader for SectionHeader in SensorsSettingsPage</name>
  <files>frontend/src/pages/SensorsSettingsPage.tsx, frontend/src/components/settings/sensors/SensorAdminHeader.tsx</files>
  <action>
    1. In SensorsSettingsPage.tsx around `:138`, replace `<SensorAdminHeader />` with:
       ```tsx
       <SectionHeader
         title={t("section.settings.sensors.title")}
         description={t("section.settings.sensors.description")}
         className="mt-8"
       />
       ```

    2. Remove `import { SensorAdminHeader } from ...` and add SectionHeader import.

    3. Delete `frontend/src/components/settings/sensors/SensorAdminHeader.tsx`.

    4. Verify no other consumers: `rg "SensorAdminHeader" frontend/src/` → 0 matches.

    Note on H1-vs-H2 hierarchy (RESEARCH Pitfall 7): the previous header used
    `<h1 class="text-3xl font-semibold">` for the page. Phase 56 breadcrumbs
    own the page H1 now; demoting to `<h2>` via SectionHeader is correct.
    Verify visually in the Settings shell that a chrome-level H1 is present
    (breadcrumb trail or SubHeader title) before committing.

    Commit: `refactor(57-09): collapse SensorAdminHeader into SectionHeader`.
  </action>
  <verify>
    <automated>rg "SensorAdminHeader" frontend/src/ ; test ! -f frontend/src/components/settings/sensors/SensorAdminHeader.tsx</automated>
  </verify>
  <done>
    - SensorAdminHeader.tsx deleted
    - No remaining references
    - SectionHeader renders on /settings/sensors
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate SensorRowForm — DeleteDialog-direct, retire SensorRemoveDialog</name>
  <files>frontend/src/components/settings/sensors/SensorRowForm.tsx, frontend/src/components/settings/sensors/SensorRemoveDialog.tsx</files>
  <action>
    1. Read SensorRowForm.tsx lines around `:213-230` — current shape:
       - text+label ghost Button (`variant="ghost" className="text-destructive"`)
         with visible label "Remove sensor" (`+ <Trash2 .../> + t("…")`)
       - opens SensorRemoveDialog

    2. KEEP the existing ghost+label trigger shape (Pitfall 3 — icon-only
       DeleteButton would regress this visual). Replace only the dialog:

       ```tsx
       // State: const [confirmOpen, setConfirmOpen] = useState(false);
       // Trigger button unchanged — onClick={() => setConfirmOpen(true)}
       // Below the button:
       <DeleteDialog
         open={confirmOpen}
         onOpenChange={setConfirmOpen}
         title={t("sensors.admin.remove_confirm.title")}
         body={
           <Trans
             i18nKey="sensors.admin.remove_confirm.body"
             values={{ itemLabel: sensor.name }}
             components={{ 1: <strong className="text-foreground font-medium" /> }}
           />
         }
         cancelLabel={t("sensors.admin.remove_confirm.cancel")}
         confirmLabel={t("sensors.admin.remove_confirm.confirm")}
         onConfirm={handleConfirmRemove /* existing handler */}
       />
       ```

       NOTE: If the existing `sensors.admin.remove_confirm.body` i18n string
       uses plain text (no markup), either:
       - Update the EN/DE strings to include `<1>{{itemLabel}}</1>` markers
         (parity check must pass) — preferred per UI-SPEC item-label highlight
         pattern; OR
       - Pass a plain React node like `<p>{t("…body", { itemLabel: sensor.name })}</p>`
         without the strong highlight — acceptable simpler path for this call-site.

       Choose the simpler path if the string currently has no markers: pass
       a plain body ReactNode with the existing key. Plan 57-11 parity check
       is forgiving because no new keys are being added here.

    3. Handle new-row (id=null) case: existing code drops the row directly
       without dialog. Preserve this — DeleteDialog only opens for persisted
       rows. Do NOT remove that fast-path.

    4. Clean up: remove the stale `// (Plan 40-02 SensorRemoveDialog) replacing
       the old window.confirm().` comment at `:36`. It's historical.

    5. Remove `import SensorRemoveDialog` from SensorRowForm.tsx.

    6. Delete `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx`
       (also drops the second `window.confirm()` comment reference at `:14`).

    7. Verify: `rg "SensorRemoveDialog" frontend/src/` → 0 matches;
       `rg "window.confirm" frontend/src/` → 0 matches.

    Commit: `refactor(57-09): migrate SensorRowForm to DeleteDialog; retire SensorRemoveDialog`.
  </action>
  <verify>
    <automated>rg "SensorRemoveDialog" frontend/src/ ; rg "window\.confirm" frontend/src/ ; test ! -f frontend/src/components/settings/sensors/SensorRemoveDialog.tsx ; node --experimental-strip-types frontend/scripts/check-locale-parity.mts ; npm --prefix frontend run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - SensorRemoveDialog.tsx deleted
    - `rg "SensorRemoveDialog" frontend/src/` → 0 matches
    - `rg "window.confirm" frontend/src/` → 0 matches
    - SensorRowForm uses DeleteDialog directly (keeps ghost+label trigger)
    - Build green
  </done>
</task>

</tasks>

<verification>
- SensorAdminHeader retired
- SensorRemoveDialog retired
- SensorRowForm keeps its ghost-label button shape (visual parity)
- Zero window.confirm, zero SensorRemoveDialog, zero SensorAdminHeader references
</verification>

<success_criteria>
1. Both component files deleted
2. `rg "SensorAdminHeader|SensorRemoveDialog|window\.confirm" frontend/src/` = 0
3. `rg "SectionHeader" frontend/src/pages/SensorsSettingsPage.tsx` ≥ 1
4. Build green
</success_criteria>

<output>
After completion, create `.planning/phases/57-section-context-standardized-trashcan/57-09-SUMMARY.md`
</output>
