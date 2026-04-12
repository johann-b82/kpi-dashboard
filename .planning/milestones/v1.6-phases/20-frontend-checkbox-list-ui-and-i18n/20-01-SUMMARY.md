---
phase: 20-frontend-checkbox-list-ui-and-i18n
plan: "01"
subsystem: backend-schema, frontend-types, i18n
tags: [personio, arrays, type-migration, i18n]
dependency_graph:
  requires: [phase-19-backend-array-migration]
  provides: [array-typed-personio-interfaces, skill-attributes-endpoint, checkbox-i18n-keys]
  affects: [frontend-settings-ui, plan-20-02-checkbox-list-ui]
tech_stack:
  added: []
  patterns: [JSON.stringify-array-equality, ?? []-null-normalization]
key_files:
  created: []
  modified:
    - backend/app/schemas.py
    - backend/app/routers/settings.py
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useSettingsDraft.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "skill_attributes extracted from employee raw_json attributes filtering keys where at least one employee has non-null, non-empty value"
  - "draftToPutPayload sends arrays directly without ?? undefined guard — empty [] is valid 'clear' signal"
  - "shallowEqualDraft uses JSON.stringify for array equality — scalar === breaks for reference comparison of arrays"
metrics:
  duration: 3min
  completed: "2026-04-12"
  tasks: 2
  files: 6
requirements:
  - UI-02
  - UI-03
---

# Phase 20 Plan 01: Data Contract — Backend Skill Attributes + Frontend Array Type Migration Summary

**One-liner:** Migrated 3 Personio config fields from scalar to array types across backend schema, frontend TS interfaces, draft state hook, and added 4 i18n keys for checkbox list labels.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Backend — add skill_attributes to personio-options endpoint | 27308f7 | backend/app/schemas.py, backend/app/routers/settings.py |
| 2 | Frontend — migrate interfaces, draft state, and i18n to arrays | 13f5787 | frontend/src/lib/api.ts, frontend/src/hooks/useSettingsDraft.ts, frontend/src/locales/en.json, frontend/src/locales/de.json |

## What Was Built

### Backend (Task 1)
- Added `skill_attributes: list[str] = []` to `PersonioOptions` schema in `backend/app/schemas.py`
- Added skill attribute key extraction loop in `get_personio_options()` in `backend/app/routers/settings.py` — iterates employee `raw_json.attributes`, collects keys where at least one employee has a non-null, non-empty value, returns sorted
- Updated all 3 `PersonioOptions(...)` return statements to include `skill_attributes=` (success path passes extracted list, error/no-credentials paths pass `[]`)

### Frontend Types (Task 2)
- `Settings` interface: 3 Personio config fields changed from scalar/null to arrays (`number[]`, `string[]`, `string[]`)
- `SettingsUpdatePayload` interface: same 3 fields changed to optional arrays (`number[]?`, `string[]?`, `string[]?`)
- `PersonioOptions` interface: added `skill_attributes: string[]`

### Draft State (Task 2)
- `DraftFields` interface: 3 Personio fields changed to array types
- `settingsToDraft()`: null coalescing changed from `?? null` to `?? []` for array fields
- `draftToPutPayload()`: removed `?? undefined` guard — arrays sent directly (empty `[]` means "clear all")
- `shallowEqualDraft()`: scalar `===` replaced with `JSON.stringify()` equality for the 3 array fields

### i18n (Task 2)
- `en.json`: updated 3 placeholder strings to "No X selected" pattern; added `settings.personio.no_options` and `settings.personio.loading`; updated `skill_attr_key.label` to plural "Skill attribute keys"
- `de.json`: same updates in German

## Verification

- Backend: `PersonioOptions` schema changes verified by file inspection (Python 3.9 on host cannot run Python 3.10+ union syntax; Docker runs 3.12)
- Frontend: `npx tsc --noEmit` exits 0 — no TypeScript errors
- i18n: Both `en.json` and `de.json` contain `settings.personio.no_options` and `settings.personio.loading` keys

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- backend/app/schemas.py: FOUND (contains `skill_attributes: list[str]`)
- backend/app/routers/settings.py: FOUND (contains `attr_keys: set[str]` and `skill_attributes=skill_attributes`)
- frontend/src/lib/api.ts: FOUND (contains `personio_sick_leave_type_id: number[]` and `skill_attributes: string[]`)
- frontend/src/hooks/useSettingsDraft.ts: FOUND (contains `JSON.stringify(a.personio_sick_leave_type_id)` and `?? []`)
- frontend/src/locales/en.json: FOUND (contains `settings.personio.no_options`)
- frontend/src/locales/de.json: FOUND (contains `settings.personio.no_options`)

Commits verified:
- 27308f7: FOUND
- 13f5787: FOUND
