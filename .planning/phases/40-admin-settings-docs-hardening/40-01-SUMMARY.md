---
phase: 40-admin-settings-docs-hardening
plan: 01
subsystem: sensor-admin
tags: [v1.15, sensors, admin, settings, i18n, react, fastapi]
requires:
  - Phase 38-02 (sensor CRUD + SecretStr community)
  - Phase 38-03 (reschedule_sensor_poll helper)
  - Phase 39-02 (SettingsRead sensor_* surfaces, sensor dashboard)
provides:
  - /settings/sensors admin sub-page (route + shell + CRUD form)
  - SensorDraft multi-row draft hook + dirty-guard context
  - PUT /api/settings admin writes for sensor_poll_interval_s + 4 thresholds
  - scheduler.reschedule_sensor_poll wired into PUT handler (try/except)
  - 39 sensors.admin.* i18n keys (DE + EN parity, "du" tone)
affects:
  - frontend/src/components/settings/ActionBar.tsx (hideReset prop, backward-compat)
  - frontend/src/hooks/useUnsavedGuard.ts (scopePath param, default /settings)
tech-stack:
  added:
    - useSensorDraft hook (parallel to useSettingsDraft; multi-row semantics)
    - SensorDraftContext (parallel to SettingsDraftContext)
  patterns:
    - write-only community via communityDirty flag → PATCH body omits community when unchanged
    - "None means don't change" for Optional threshold writes (explicit Pydantic pattern)
    - separate query key ['sensors', 'admin'] isolates admin draft from /sensors 15s refetch
key-files:
  created:
    - frontend/src/pages/SensorsSettingsPage.tsx
    - frontend/src/contexts/SensorDraftContext.tsx
    - frontend/src/hooks/useSensorDraft.ts
    - frontend/src/hooks/useSensorDraft.test.ts
    - frontend/src/components/settings/sensors/SensorAdminHeader.tsx
    - frontend/src/components/settings/sensors/SensorRowForm.tsx
    - frontend/src/components/settings/sensors/SensorRowList.tsx
    - frontend/src/components/settings/sensors/PollIntervalCard.tsx
    - frontend/src/components/settings/sensors/ThresholdCard.tsx
    - backend/tests/test_settings_sensor_writes.py
  modified:
    - backend/app/schemas.py
    - backend/app/routers/settings.py
    - frontend/src/App.tsx
    - frontend/src/lib/api.ts
    - frontend/src/components/settings/ActionBar.tsx
    - frontend/src/hooks/useUnsavedGuard.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - PATCH body omits `community` when communityDirty=false (preserves stored ciphertext, PITFALLS C-3)
  - Separate ['sensors', 'admin'] query key from dashboard to avoid 15s refetch clobbering draft
  - Multi-row save is non-transactional by design — documented inline; /api/sensors/bulk deferred
  - Added scopePath param to useUnsavedGuard (default "/settings") rather than duplicating the hook
  - Added hideReset prop to ActionBar (default false) rather than forking a SensorActionBar
  - Blank threshold input = "don't change" (no clear-to-null sentinel in 40-01; carry-forward)
  - DeleteConfirmDialog left for 40-02 — SensorRowForm uses window.confirm() with clear TODO marker
metrics:
  duration: ~35min
  completed: 2026-04-17
  tasks: 3
  files_created: 10
  files_modified: 8
---

# Phase 40 Plan 01: Admin Settings Sub-Page Foundation Summary

Admin-only `/settings/sensors` sub-page: multi-row sensor CRUD form, polling-interval input (5–86400s), four global threshold inputs, sticky ActionBar, dirty-guard with UnsavedChangesDialog, and 39 bilingual `sensors.admin.*` i18n keys. Backend PUT /api/settings now accepts `sensor_poll_interval_s` + four `sensor_*_min/max` thresholds and live-reschedules the sensor poll job via `scheduler.reschedule_sensor_poll(...)` inside try/except.

## What Shipped

**Backend (Task 1):**
- `SettingsUpdate` extended with 5 optional sensor fields; `sensor_poll_interval_s: int | None = Field(ge=5, le=86400)`, four Decimal thresholds.
- `put_settings` handler persists new fields and calls `reschedule_sensor_poll(new_interval)` inside a defensive try/except after a local import (helper already logs + swallows internally; caller wrap enforces the "broken PUT cannot leak scheduler internals" contract from Phase 38).
- Three new tests in `test_settings_sensor_writes.py`: reschedule invoked with the admin's value, 422 at the 4 / 86401 bounds, threshold round-trip on PUT + GET. All green alongside pre-existing sensor test suites (13/13).

**Frontend data layer (Task 2):**
- `api.ts`: three new fetchers (`createSensor`, `updateSensor`, `deleteSensor`) + `SensorCreatePayload` / `SensorUpdatePayload`; `SettingsUpdatePayload` extended with the 5 optional sensor write fields (Decimals as strings).
- `SensorDraftContext.tsx`: lightweight `{ isDirty, setDirty }` provider mirroring SettingsDraftContext for NavBar parity.
- `useSensorDraft.ts`: multi-row draft hook with rows/globals state, `_localId` + server-id + `communityDirty` + `hasStoredCommunity` + `_markedForDelete` flags, plus `buildSensorUpdatePayload` (exported for unit test) that omits `community` from PATCH when `communityDirty=false`. Validation throws `SensorDraftValidationError` carrying i18n keys (toast callers route via `t(err.message)`).
- Save algorithm: deletes → creates → updates → globals → invalidate + refetch → re-snapshot. Non-transactional across rows by design; Phase 41 could add `/api/sensors/bulk` if atomicity becomes a requirement.
- 13 vitest cases green covering PATCH community omission, empty OID null sentinel, and validate() branches.

**Frontend UI (Task 3):**
- `/settings/sensors` route wired BEFORE `/settings` in App.tsx (wouter first-match).
- `SensorsSettingsPage.tsx`: admin-gated via `useRole()` (viewer sees `auth.admin_only.*` shell); loads draft, wires `useUnsavedGuard(..., "/settings/sensors")`, syncs into `SensorDraftContext`, renders header + sensor list + PollIntervalCard + ThresholdCard + ActionBar + UnsavedChangesDialog.
- `SensorRowForm.tsx`: 9 editable fields per row (name/host/port/community/temp OID/temp scale/humidity OID/humidity scale/enabled) with password-typed community input and "stored — leave blank to keep" placeholder when `hasStoredCommunity && !communityDirty`. Remove = `window.confirm()` with a `TODO(40-02)` pointing to the upgrade to `DeleteConfirmDialog`.
- `PollIntervalCard` + `ThresholdCard` as sibling Card components with inline help/error text.
- `ActionBar` gained a backward-compatible `hideReset?: boolean` prop so the sensor page hides the "Reset to defaults" button without forking the component.
- `useUnsavedGuard` gained an optional `scopePath` parameter (default `/settings`) to generalize the pathname checks without duplicating the hook. Existing SettingsPage behavior is unchanged.
- 39 `sensors.admin.*` keys landed in both `locales/en.json` and `locales/de.json` (parity script green — 39 keys, full DE coverage, "du" tone). `auth.admin_only.title/body` added to both files since they did not exist. Token-only Tailwind throughout the new files (no `dark:` or hex literals).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] `useUnsavedGuard` hardcoded `/settings`**
- **Found during:** Task 3.
- **Issue:** The existing hook's three pathname checks were hardcoded to `/settings`, so on `/settings/sensors` the click/popstate intercepts would no-op — the dirty-guard dialog would never fire.
- **Fix:** Added an optional `scopePath: string = "/settings"` parameter and threaded it through the three checks. Default preserves SettingsPage behavior 1:1; SensorsSettingsPage passes `"/settings/sensors"`.
- **Files modified:** `frontend/src/hooks/useUnsavedGuard.ts`.
- **Commit:** 75a4d0c.

**2. [Rule 3 — Blocker] `ActionBar` had no way to hide the Reset button**
- **Found during:** Task 3.
- **Issue:** `/settings/sensors` does not expose a reset-everything flow (the Reset dialog only resets brand settings), but the ActionBar always rendered a Reset button.
- **Fix:** Added `hideReset?: boolean` (default false). Existing `SettingsPage.tsx` callers are unchanged.
- **Files modified:** `frontend/src/components/settings/ActionBar.tsx`.
- **Commit:** 75a4d0c.

Both deviations were the "less churn" path the plan's Task 3 explicitly recommended (see Task 3 note: _"Recommended: add `hideReset?: boolean` prop to existing ActionBar — it's backward-compatible"_), and the guard scoping was implicit in the requirement that the dialog must fire on `/settings/sensors`.

### Intentional Carry-Forwards (not bugs)

- **Clear-to-null for thresholds:** A blank threshold input sends no field on PUT (Pydantic's `None = don't change` sentinel). Admin cannot clear a previously-set threshold by blanking the field — explicitly called out in `sensors.admin.thresholds.description` ("use admin guide to reset"). Recommended follow-up: add a per-field clear icon in a future plan, or a dedicated POST `/api/settings/sensor-thresholds/reset` endpoint.
- **Non-transactional multi-row save:** If a mid-stream sensor create/update fails, earlier requests stay committed; re-snapshot from refetch shows the partial state so the admin sees exactly what persisted. `/api/sensors/bulk` would be the atomic path — deferred to Phase 41 if operators request it.
- **Remove uses `window.confirm()`:** Plan 40-02 upgrades to the shared `DeleteConfirmDialog`; all `sensors.admin.remove_confirm.*` i18n keys are pre-landed in this plan so the swap in 40-02 is drop-in.
- **SettingsPage link to `/settings/sensors`:** Deferred to Plan 40-02 per the plan's `<objective>`.

## Success Criteria

- [x] SEN-ADM-01: `/settings/sensors` sub-page exists, admin-gated (useRole + router require_admin).
- [x] SEN-ADM-02: list + add + basic remove + edit flows functional.
- [x] SEN-ADM-03: all nine per-sensor fields editable; community write-only with stored-hint placeholder.
- [x] SEN-ADM-04: interval input 5..86400, save triggers `scheduler.reschedule_sensor_poll(...)` inside try/except.
- [x] SEN-ADM-05: four optional threshold inputs persist via PUT /api/settings.
- [x] SEN-ADM-08: dirty-guard prompt fires via `useUnsavedGuard` + UnsavedChangesDialog.
- [x] SEN-I18N-01 (admin subset): 39 `sensors.admin.*` keys in DE + EN with full parity, "du" tone.
- [x] All tests green: 13 backend, 13 frontend vitest, tsc clean.
- [x] No `dark:` variants or hex literals in new files.
- [x] No changes to `scheduler.py`, `models.py`, migrations, `DEFAULT_SETTINGS`, or existing `SettingsDraft` / `SettingsPage` behavior.

## Verification Evidence

- Backend: `docker exec kpi-dashboard-api-1 pytest tests/test_settings_sensor_writes.py tests/test_sensor_schemas.py tests/test_sensors_admin_gate.py -v` → **13 passed in 0.56s**.
- Frontend types: `cd frontend && npx tsc --noEmit` → **clean (0 errors)**.
- Frontend unit: `cd frontend && npx vitest run src/hooks/useSensorDraft` → **13 passed**.
- i18n parity script from plan's `<verify>`: **OK — 39 admin keys, DE parity**.
- Route order: `grep -n '/settings' frontend/src/App.tsx` confirms `/settings/sensors` declared on line 47, `/settings` on line 48.
- Style guardrails: `grep -rE 'dark:' src/pages/SensorsSettingsPage.tsx src/components/settings/sensors/` → only a comment mention in SensorAdminHeader (no actual usage); `grep -rE '#[0-9a-fA-F]{6}' ...` → zero hits.

## Commits

- 5c83ca4 `feat(40-01): extend SettingsUpdate with sensor interval + thresholds + live reschedule`
- e447e07 `feat(40-01): sensor admin data layer — CRUD fetchers + SensorDraft hook + context`
- 75a4d0c `feat(40-01): sensor admin sub-page UI + /settings/sensors route + DE/EN i18n`

## Known Stubs

None. All components are wired end-to-end: SensorRowForm reads from `useSensorDraft` state, writes back via `updateRow`/`markRowDeleted`; save path issues real CRUD requests; globals flow through `updateSettings`. No mock data, no hardcoded empty arrays flowing to UI, no "coming soon" placeholders.

## Follow-Up (40-02)

- Upgrade `window.confirm()` → shared `DeleteConfirmDialog` using already-landed `sensors.admin.remove_confirm.*` keys.
- Add SettingsPage admin link to `/settings/sensors`.
- Probe button + Walk UI (SEN-ADM-06 / SEN-ADM-07).

## Self-Check

Verified:
- `backend/app/schemas.py` (modified) — contains `sensor_poll_interval_s: int | None = Field(default=None, ge=5, le=86400)` at SettingsUpdate tail.
- `backend/app/routers/settings.py` (modified) — contains `from app.scheduler import reschedule_sensor_poll` + try/except call inside `put_settings`.
- `backend/tests/test_settings_sensor_writes.py` (created) — 3 tests, all passing.
- `frontend/src/pages/SensorsSettingsPage.tsx` (created) — 170+ lines, admin-gated, wires all Task 3 components.
- `frontend/src/hooks/useSensorDraft.ts` (created) — 350+ lines, exports `useSensorDraft` + `buildSensorUpdatePayload` + `validateSensorDraft`.
- `frontend/src/hooks/useSensorDraft.test.ts` (created) — 13 tests, all passing.
- `frontend/src/contexts/SensorDraftContext.tsx` (created) — mirrors SettingsDraftContext API.
- `frontend/src/components/settings/sensors/{SensorAdminHeader,SensorRowForm,SensorRowList,PollIntervalCard,ThresholdCard}.tsx` (created).
- `frontend/src/App.tsx` (modified) — `/settings/sensors` route before `/settings`, wrapped in SensorDraftProvider.
- `frontend/src/lib/api.ts` (modified) — 3 new fetchers + payload types + SettingsUpdatePayload extension.
- `frontend/src/locales/en.json` + `de.json` (modified) — 39 sensors.admin.* keys, DE parity verified.
- Commits 5c83ca4, e447e07, 75a4d0c — all present in `git log --oneline -5`.

## Self-Check: PASSED
