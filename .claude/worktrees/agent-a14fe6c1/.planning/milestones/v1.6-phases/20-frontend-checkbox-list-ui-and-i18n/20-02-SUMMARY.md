---
phase: 20-frontend-checkbox-list-ui-and-i18n
plan: "02"
subsystem: frontend-ui, settings
tags: [checkbox, personio, multi-select, shadcn, i18n]
dependency_graph:
  requires: [plan-20-01-array-types]
  provides: [CheckboxList-component, Checkbox-primitive, PersonioCard-checkbox-ui]
  affects: [settings-page, personio-config-ux]
tech_stack:
  added: []
  patterns: [base-ui-checkbox-primitive, scrollable-checkbox-list, string-number-coercion]
key_files:
  created:
    - frontend/src/components/ui/checkbox.tsx
    - frontend/src/components/settings/CheckboxList.tsx
  modified:
    - frontend/src/components/settings/PersonioCard.tsx
    - frontend/src/lib/defaults.ts
decisions:
  - "Used @base-ui/react/checkbox instead of @radix-ui/react-checkbox — consistent with existing project pattern (button, input all use base-ui primitives)"
  - "defaults.ts Personio fields added with sensible defaults (false/1/[]/[]/[]) to fix TS error introduced in Plan 01"
metrics:
  duration: 5min
  completed: "2026-04-12"
  tasks: 2
  files: 4
requirements:
  - UI-01
  - UI-02
  - UI-03
---

# Phase 20 Plan 02: CheckboxList UI — Checkbox Primitive, CheckboxList Component, PersonioCard Rewire Summary

**One-liner:** Built shadcn Checkbox primitive on @base-ui/react/checkbox, created reusable scrollable CheckboxList component, and rewired PersonioCard to use 3 CheckboxList instances replacing select dropdowns and text input for Personio config fields.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add shadcn Checkbox and create CheckboxList component | 16f7f67 | frontend/src/components/ui/checkbox.tsx, frontend/src/components/settings/CheckboxList.tsx |
| 2 | Rewire PersonioCard to use CheckboxList for all 3 config fields | 51910d7 | frontend/src/components/settings/PersonioCard.tsx, frontend/src/lib/defaults.ts |

## What Was Built

### Checkbox Primitive (Task 1)

- Created `frontend/src/components/ui/checkbox.tsx` using `@base-ui/react/checkbox` (Root + Indicator)
- Follows the same forwardRef pattern as existing `button.tsx` and `input.tsx` in the project
- Applies `data-[checked]:bg-primary` data attribute from base-ui (alongside the shadcn `data-[state=checked]` pattern for compatibility)
- Exports `{ Checkbox }` as a named export matching shadcn convention

### CheckboxList Component (Task 1)

- Created `frontend/src/components/settings/CheckboxList.tsx` with `export function CheckboxList`
- Props: `id`, `label`, `options: CheckboxOption[]`, `selected: string[]`, `onChange: (selected: string[]) => void`, `disabled`, `loading`, `hint`
- Scrollable container: `max-h-[200px] overflow-y-auto` with `rounded-md border border-input bg-transparent shadow-xs` styling matching existing form inputs
- Loading state: shows `t("settings.personio.loading")` text inside container
- Empty state: shows `t("settings.personio.no_options")` text when options array is empty
- Disabled state: `opacity-50 cursor-not-allowed` on the container wrapper
- Toggle logic: `handleToggle` builds full new array (add or filter out value) and calls `onChange`

### PersonioCard Rewire (Task 2)

- Imported `CheckboxList` and `CheckboxOption` from `@/components/settings/CheckboxList`
- Sick leave type: `draft.personio_sick_leave_type_id.map(String)` → CheckboxList → `vals.map(Number)` on onChange (number[] coercion)
- Production dept: `draft.personio_production_dept` → CheckboxList → `vals` directly (string[])
- Skill attr key: `draft.personio_skill_attr_key` → CheckboxList → `vals` directly (string[]), options from `options?.skill_attributes`
- All 3 CheckboxLists use `loading={hasCredentials && optionsLoading}` and `hint={noCredentialsHint ?? optionsError}`
- Sync interval `<select>` unchanged (not a multi-select field)
- `Input` import retained (still used for client_id and client_secret password fields)

## Verification

- `npx tsc --noEmit` exits 0 — no TypeScript errors
- PersonioCard.tsx contains exactly 3 `<CheckboxList` instances
- No `<select` for sick leave or production dept (only sync interval `<select` remains)
- No `<Input` for skill attr key
- CheckboxList handles loading/empty/disabled with localized strings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing Personio fields in DEFAULT_SETTINGS**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `defaults.ts` used `Settings` type but lacked `personio_has_credentials`, `personio_sync_interval_h`, `personio_sick_leave_type_id`, `personio_production_dept`, `personio_skill_attr_key` fields — added in Plan 01 but not propagated to defaults
- **Fix:** Added 5 Personio fields to `DEFAULT_SETTINGS` with sensible defaults (`false`, `1`, `[]`, `[]`, `[]`)
- **Files modified:** `frontend/src/lib/defaults.ts`
- **Commit:** 51910d7

**2. [Pattern] Used @base-ui/react/checkbox instead of @radix-ui/react-checkbox**
- **Found during:** Task 1 — project uses @base-ui/react for all UI primitives (button, input)
- **Issue:** Plan specified `@radix-ui/react-checkbox` and `npm install @radix-ui/react-checkbox`, but the project already has `@base-ui/react` with a checkbox module
- **Fix:** Used `@base-ui/react/checkbox` (Root + Indicator) with the same forwardRef wrapper pattern — no new dependency needed, fully consistent with existing project primitives
- **Files modified:** `frontend/src/components/ui/checkbox.tsx`
- **Commit:** 16f7f67

## Known Stubs

None — all 3 CheckboxList instances are wired to live data from `options` (fetched from personio-options endpoint), array state from `draft`, and `setField` for updates.

## Self-Check: PASSED

Files verified:
- frontend/src/components/ui/checkbox.tsx: FOUND (contains `export { Checkbox }`)
- frontend/src/components/settings/CheckboxList.tsx: FOUND (contains `export function CheckboxList`)
- frontend/src/components/settings/PersonioCard.tsx: FOUND (contains 3 `<CheckboxList` instances)
- frontend/src/lib/defaults.ts: FOUND (contains `personio_sick_leave_type_id: []`)

Commits verified:
- 16f7f67: feat(20-02): add shadcn Checkbox primitive and CheckboxList component
- 51910d7: feat(20-02): rewire PersonioCard to use CheckboxList for all 3 config fields
