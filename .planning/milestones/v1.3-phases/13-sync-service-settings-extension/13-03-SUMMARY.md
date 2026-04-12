---
phase: 13-sync-service-settings-extension
plan: "03"
subsystem: frontend-settings
tags: [personio, settings, typescript, react, ui]
dependency_graph:
  requires: [13-01]
  provides: [PersonioCard-UI, personio-settings-types, personio-draft-hook]
  affects: [SettingsPage, useSettingsDraft, api.ts]
tech_stack:
  added: []
  patterns: [useQuery-for-remote-options, write-only-credential-draft, native-select-fallback]
key_files:
  created:
    - frontend/src/components/settings/PersonioCard.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useSettingsDraft.ts
    - frontend/src/pages/SettingsPage.tsx
decisions:
  - "Used native <select> elements with Tailwind styling as Select fallback (no shadcn Select in project)"
  - "Credentials always start empty in draft (write-only — not returned by GET /api/settings)"
  - "testPersonioConnection uses local component state, not the draft, to avoid marking settings dirty"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-12"
  tasks: 2
  files: 4
requirements: [SET-01, SET-02, SET-03, SET-04, PERS-05, PERS-06]
---

# Phase 13 Plan 03: Frontend Settings Extension (PersonioCard) Summary

**One-liner:** Personio settings UI with masked credential inputs, live option dropdowns from Personio API, connection test button, and sync interval selector — all wired through the existing single-save draft flow.

## What Was Built

Extended the frontend Settings page with a Personio configuration section covering all fields required to operate the Personio sync service (SET-01 through SET-04, PERS-05, PERS-06).

### Task 1: Extend TypeScript types and draft hook

- `frontend/src/lib/api.ts`: Extended `Settings` interface with 5 Personio fields (`personio_has_credentials`, `personio_sync_interval_h`, `personio_sick_leave_type_id`, `personio_production_dept`, `personio_skill_attr_key`). Extended `SettingsUpdatePayload` with 6 optional Personio fields. Added `AbsenceTypeOption`, `PersonioOptions`, and `SyncTestResult` interfaces. Added `fetchPersonioOptions()` and `testPersonioConnection()` API functions.
- `frontend/src/hooks/useSettingsDraft.ts`: Extended `DraftFields` with 6 Personio fields. Updated `settingsToDraft` (credentials always empty), `draftToPutPayload` (conditional credential sending), `draftToCacheSettings` (Personio fields synced), and `shallowEqualDraft` (full comparison coverage).

### Task 2: Create PersonioCard and integrate into SettingsPage

- `frontend/src/components/settings/PersonioCard.tsx`: New component (170+ lines) with:
  - Two masked password inputs for client_id and client_secret with "Gespeichert" helper text when credentials exist
  - "Verbindung testen" button with local state for test result (green/red inline feedback)
  - Native `<select>` for sync interval (0/1/6/24h options)
  - Native `<select>` for absence type, populated from `fetchPersonioOptions` via `useQuery` (staleTime: 0, enabled: hasCredentials)
  - Native `<select>` for department, same pattern
  - Text input for skill attribute key
  - Dropdowns disabled with hint text when credentials not configured (D-10)
- `frontend/src/pages/SettingsPage.tsx`: Imported and rendered `<PersonioCard>` between PreferencesCard and ActionBar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Removed unused import from PersonioCard.tsx**
- **Found during:** Task 2 creation
- **Issue:** Initially imported `DraftFields as _DraftFields` from `@/lib/api` alongside the correct import from `@/hooks/useSettingsDraft` — the api.ts re-export doesn't exist
- **Fix:** Removed the erroneous redundant import before committing
- **Files modified:** frontend/src/components/settings/PersonioCard.tsx

**2. [Rule 3 - Blocking] No shadcn Select component in project**
- **Found during:** Task 2 implementation
- **Issue:** The plan mentions using shadcn/ui Select component, but the project's `frontend/src/components/ui/` only has: badge, button, calendar, card, dialog, input, label, popover, separator, table — no Select
- **Fix:** Used native `<select>` elements with Tailwind styling as specified by the plan's fallback instruction ("do NOT install new packages")
- **Files modified:** frontend/src/components/settings/PersonioCard.tsx

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | d27c94c | feat(13-03): extend TypeScript types and draft hook with Personio fields |
| 2 | 06d1432 | feat(13-03): add PersonioCard component and integrate into SettingsPage |

## Known Stubs

None. All form fields are wired to live draft state via `setField`. The dropdowns (`absence_types`, `departments`) are populated from the live `fetchPersonioOptions` API call — they render empty when credentials are absent (intentional, documented in D-10 per plan).

## Self-Check: PASSED
