---
phase: 57-section-context-standardized-trashcan
plan: 09
subsystem: frontend/sensors-admin
tags: [section-header, delete-dialog, sensors, refactor]
requires:
  - 57-01-SUMMARY.md
  - 57-02-SUMMARY.md
  - 57-04-SUMMARY.md
provides:
  - SensorsSettingsPage adopts SectionHeader (SECTION-01)
  - SensorRowForm adopts canonical DeleteDialog (SECTION-04)
affects:
  - frontend/src/pages/SensorsSettingsPage.tsx
  - frontend/src/components/settings/sensors/SensorRowForm.tsx
tech-stack:
  added: []
  patterns: ["Pitfall 3 honoured — text+label ghost trigger preserved on row remove (DeleteDialog used directly, not DeleteButton)"]
key-files:
  created: []
  modified:
    - frontend/src/pages/SensorsSettingsPage.tsx
    - frontend/src/components/settings/sensors/SensorRowForm.tsx
  deleted:
    - frontend/src/components/settings/sensors/SensorAdminHeader.tsx
    - frontend/src/components/settings/sensors/SensorRemoveDialog.tsx
decisions:
  - "Used existing `sensors.admin.remove_confirm.body` key with {{name}} interpolation (plain string body) — chosen per plan's simpler-path guidance over adding <1>{{itemLabel}}</1> markers since no new keys are required."
  - "Removed the two stale `(Plan 40-02 SensorRemoveDialog) replacing the old window.confirm()` historical comments per plan task 2 step 4 + dialog-file deletion."
metrics:
  duration: 107s
  tasks: 2
  files: 4
  completed: 2026-04-22
---

# Phase 57 Plan 09: Sensors Migration Summary

Migrated `/settings/sensors` admin to the canonical SectionHeader + DeleteDialog primitives — collapsing the bespoke `SensorAdminHeader` page header and the bespoke `SensorRemoveDialog` confirm modal while preserving the row-level text+label ghost Remove button (Pitfall 3: a switch to icon-only `DeleteButton` would regress visual parity).

## What Shipped

- **Page header:** `<SensorAdminHeader />` swapped for `<SectionHeader title=... description=... className="mt-8" />` driven by the existing `section.settings.sensors.{title,description}` i18n keys (added in Wave 1).
- **Row Remove dialog:** `<SensorRemoveDialog />` swapped for `<DeleteDialog />` directly, reusing the four existing `sensors.admin.remove_confirm.{title,body,cancel,confirm}` keys (no new keys needed). The trigger button — ghost variant with `Trash2` icon + visible label — is unchanged per Pitfall 3.
- **New-row fast-path preserved:** unsaved rows (`row.id === null`) still drop without the dialog.
- **Dead components removed:** `SensorAdminHeader.tsx` and `SensorRemoveDialog.tsx` deleted; both `// (Plan 40-02 SensorRemoveDialog) replacing the old window.confirm().` historical references gone.

## Verification

- `rg "SensorAdminHeader" frontend/src/` → 0 matches
- `rg "SensorRemoveDialog" frontend/src/` → 0 matches
- `rg "window\.confirm" frontend/src/` → 0 matches
- `rg "SectionHeader" frontend/src/pages/SensorsSettingsPage.tsx` → 2 matches (import + usage)
- `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` → PARITY OK (498 keys both sides)
- Modified files compile cleanly under `tsc -b` (build surfaces only the documented pre-existing tech-debt errors in `useSensorDraft.ts`, `defaults.ts`, and `signage/pages/Schedules*` — see `deferred-items.md`).

## Deviations from Plan

None — plan executed exactly as written. The plan's "simpler path" guidance for the body string was taken (plain text body via existing `{{name}}`), avoiding new i18n keys.

## Deferred Issues

Pre-existing, unrelated TS errors observed during `npm run build` were appended to `deferred-items.md` under "Plan 57-09 — Out-of-Scope Build Errors". They originate in parallel sensor/schedules work and were already logged for 57-06 / 57-08.

## Commits

- `d222439` — refactor(57-09): collapse SensorAdminHeader into SectionHeader
- `0eb40fa` — refactor(57-09): migrate SensorRowForm to DeleteDialog; retire SensorRemoveDialog

## Self-Check: PASSED

- Modified files exist:
  - FOUND: `frontend/src/pages/SensorsSettingsPage.tsx`
  - FOUND: `frontend/src/components/settings/sensors/SensorRowForm.tsx`
- Deleted files absent:
  - GONE: `frontend/src/components/settings/sensors/SensorAdminHeader.tsx`
  - GONE: `frontend/src/components/settings/sensors/SensorRemoveDialog.tsx`
- Commits present in `git log`: d222439, 0eb40fa
