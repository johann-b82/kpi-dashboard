# Deferred Items — Phase 17 navbar-layout-polish

## Out-of-Scope Issues Discovered

### Pre-existing Build Error: defaults.ts missing personio fields

**Discovered during:** Plan 17-02 Task 1 verification
**Error:** `src/lib/defaults.ts(3,14): error TS2739: Type ... is missing the following properties from type 'Settings': personio_has_credentials, personio_sync_interval_h, personio_sick_leave_type_id, personio_production_dept, personio_skill_attr_key`
**Root cause:** Phase 13 (sync-service-settings-extension) added personio fields to the `Settings` type in `api.ts` but did not update `DEFAULT_SETTINGS` in `defaults.ts`
**Impact:** `npm run build` fails in Vite due to tsc step; running tsc directly on worktree source passes when this file is excluded
**Fix:** Add personio defaults to `DEFAULT_SETTINGS` in `frontend/src/lib/defaults.ts`
**Status:** Deferred — out of scope for this plan (pre-existing, unrelated files)
