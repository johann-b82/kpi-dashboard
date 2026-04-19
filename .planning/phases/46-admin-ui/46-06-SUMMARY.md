---
phase: 46-admin-ui
plan: 06
subsystem: ui
tags: [signage, devices, pairing, react, react-hook-form, zod, dirty-guard]

requires:
  - phase: 46-admin-ui
    provides: signageKeys (46-01), signage.admin.* i18n keys (46-01), DeviceStatusChip + TagPicker + signageApi (46-02)
provides:
  - signageApi.updateDevice / replaceDeviceTags / revokeDevice / claimPairingCode
  - DeviceEditDialog (dirty-guarded edit modal — name + tags)
  - DevicesPage (live 30s table — status chip + edit + revoke + pair-new CTA)
  - PairPage (XXX-XXX auto-format claim form with create-on-submit tags + 404 error mapping)
  - /signage/pair admin route
  - signage-local UnsavedChangesDialog (overwritten by parallel 46-05 with dual-API shape — kept compatible via onStay/onDiscardAndLeave fallback)
affects: [46-01, 46-02, 46-05]

tech-stack:
  added: []
  patterns:
    - "Sequenced PATCH-name + PUT-tags for device edits (backend SignageDeviceAdminUpdate is name-only; tag replacement lives on PUT /devices/{id}/tags)"
    - "Substring-match on backend's collapsed 404 detail to surface specific inline messages (invalid/expired vs. claimed) — backend does not distinguish them per status code"
    - "Form dirty-guard via intercepted onOpenChange: dirty close → UnsavedChangesDialog overlay; Stay cancels, Discard resets + closes parent"

key-files:
  created:
    - frontend/src/signage/pages/PairPage.tsx
    - frontend/src/signage/components/DeviceEditDialog.tsx
    - frontend/src/signage/components/UnsavedChangesDialog.tsx (overwritten by parallel 46-05)
  modified:
    - frontend/src/App.tsx
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/signage/pages/DevicesPage.tsx

key-decisions:
  - "Device PATCH body is name-only (matches backend SignageDeviceAdminUpdate); tag updates flow through a separate PUT /devices/{id}/tags call — sequenced from DeviceEditDialog. Caller-friendly: signageApi.updateDevice() still accepts {name, tag_ids} for ergonomics, internally only forwards {name}."
  - "Revoke endpoint path is /api/signage/pair/devices/{id}/revoke (not /api/signage/devices/{id}/revoke) — verified against backend/app/routers/signage_pair.py. Phase 42 placed revoke on the pair router and Phase 43 deliberately did not move it (avoids preempting CRUD)."
  - "Backend collapses pairing claim failures (invalid/expired/already-claimed) into one 404 with detail 'pairing code invalid, expired, or already claimed'. Substring matching used for inline UX; if the backend ever splits the codes we revisit. Documented in plan as acceptable for v1.16 per 46-RESEARCH Q3."
  - "PairPage was created in Task 1 (rather than deferred to Task 3) so that the App.tsx route registration in Task 1 would compile cleanly. Task 3 is therefore a no-op commit-wise — the file landed with all Task 3 content already (verified against all Task 3 acceptance criteria)."
  - "UnsavedChangesDialog created locally in signage/components/. Parallel 46-05 (Wave 2) overwrote it with a richer dual-API shape (onConfirm OR onStay+onDiscardAndLeave). My DeviceEditDialog uses the legacy {onStay, onDiscardAndLeave} pair which 46-05 explicitly preserved — interop verified by 46-04's check-signage-invariants script (23 files OK)."

patterns-established:
  - "Pattern: useForm's intercepted onOpenChange — `if (!next && form.formState.isDirty) setUnsavedOpen(true); else onOpenChange(next)`"
  - "Pattern: code auto-format via controlled rawCode state + form.setValue('code', formatted, { shouldValidate: true, shouldDirty: true })"

requirements-completed:
  - SGN-ADM-06
  - SGN-ADM-07
  - SGN-ADM-08
  - SGN-ADM-09

metrics:
  duration: ~4min
  completed_date: 2026-04-19
  tasks: 3
  files_created: 3
  files_modified: 3
---

# Phase 46-admin-ui Plan 06: Devices & Pair Summary

**Closes the Phase 46 admin device lifecycle — `/signage/devices` ships with a live 30 s status table, dirty-guarded edit dialog, and revoke confirm; `/signage/pair` ships with a centered XXX-XXX auto-format claim form that creates unknown tags on submit and maps the backend's collapsed 404 to inline error messages.**

## Performance

- **Duration:** ~4 min (parallel Wave 2 with 46-04 and 46-05)
- **Started:** 2026-04-19T21:00:22Z
- **Completed:** 2026-04-19T21:04:06Z
- **Tasks:** 3 / 3
- **Files created:** 3 (1 page, 2 components)
- **Files modified:** 3 (App.tsx, signageApi.ts, DevicesPage.tsx)

## Accomplishments

- Devices admin lifecycle (pair + edit + revoke + live status) shipped end-to-end against the Phase 42/43 backend
- All 4 plan requirements (SGN-ADM-06, 07, 08, 09) satisfied
- Phase 46 is now feature-complete: 6 of 6 plans landed across both waves
- Zero `dark:` variants and zero direct `fetch(` outside `signage/lib/` — invariants honored
- All CI grep guards (signage invariants + locale parity) green

## Task Commits

1. **Task 1: Extend signageApi, register /signage/pair route, build DeviceEditDialog** — `5780c41` (feat)
2. **Task 2: DevicesPage with 30 s refetch + edit + revoke + pair CTA** — `8c3e72c` (feat)
3. **Task 3: PairPage with XXX-XXX auto-format and error mapping** — folded into Task 1 commit `5780c41` (PairPage was created early to satisfy App.tsx import; all Task 3 acceptance criteria verified post-hoc against the existing file).

## Files Created

- `frontend/src/signage/pages/PairPage.tsx` — claim form: rawCode controlled state with auto-format regex `replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)` + hyphen insertion after position 3, react-hook-form + zod validation (`/^[A-Z0-9]{3}-[A-Z0-9]{3}$/`), TagPicker with create-on-submit, signageApi.claimPairingCode, success → toast + invalidate devices/tags + setLocation('/signage/devices'), error → substring-match for inline code-field error.
- `frontend/src/signage/components/DeviceEditDialog.tsx` — controlled dialog with `{open, onOpenChange, device}` props; useEffect resets form when device prop changes; sequenced PATCH-name then PUT-tags save (with create-on-submit tag resolution); dirty-guard via intercepted onOpenChange + UnsavedChangesDialog overlay.
- `frontend/src/signage/components/UnsavedChangesDialog.tsx` — signage-local stub created early; parallel 46-05 immediately overwrote with richer dual-API shape (onConfirm OR onStay+onDiscardAndLeave). My DeviceEditDialog uses the latter pair, which 46-05 explicitly preserved.

## Files Modified

- `frontend/src/App.tsx` — added PairPage import + `<Route path="/signage/pair">` wrapped in AdminOnly, positioned after /signage/media and before the /signage redirect.
- `frontend/src/signage/lib/signageApi.ts` — appended `updateDevice`, `replaceDeviceTags`, `revokeDevice`, `claimPairingCode`. Inline comments document the backend shape (PATCH name-only + separate PUT tags + revoke on pair router).
- `frontend/src/signage/pages/DevicesPage.tsx` — replaced 46-01 stub with full table implementation: `useQuery({queryKey: signageKeys.devices(), refetchInterval: 30_000})`, shadcn Table (Name | Status (DeviceStatusChip) | Tags | Current playlist | Last seen (date-fns) | Actions), Pair-new CTA top-right, edit/revoke per row, empty-state CTA, revoke-confirm dialog using destructive variant.

## Verification Results

| Check | Result |
| --- | --- |
| `grep updateDevice src/signage/lib/signageApi.ts` | 1 match |
| `grep revokeDevice src/signage/lib/signageApi.ts` | 1 match |
| `grep claimPairingCode src/signage/lib/signageApi.ts` | 1 match |
| `grep 'path="/signage/pair"' src/App.tsx` | 1 match |
| `grep '<PairPage' src/App.tsx` | 1 match |
| `test -f src/signage/components/DeviceEditDialog.tsx` | OK |
| `grep '30_000' src/signage/pages/DevicesPage.tsx` | 1 match |
| `grep '<DeviceStatusChip' src/signage/pages/DevicesPage.tsx` | 1 match |
| `grep '<DeviceEditDialog' src/signage/pages/DevicesPage.tsx` | 1 match |
| PairPage acceptance grep checks | All 17 pass (see Task 3 verify run) |
| `node scripts/check-signage-invariants.mjs` | `SIGNAGE INVARIANTS OK: 23 files scanned` |
| `node --experimental-strip-types scripts/check-locale-parity.mts` | `PARITY OK: 407 keys` |
| `npx eslint` on signage/pages + components + lib | 0 errors / 0 warnings |
| `npm run build` (signage scope) | Clean — only pre-existing errors in dashboard files (out of scope) and an in-flight error in `signage/pages/PlaylistsPage.tsx` from parallel 46-05 (their plan — not mine) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Backend device PATCH body is name-only, not `{name, tag_ids}`**
- **Found during:** Task 1 (reading `backend/app/routers/signage_admin/devices.py`)
- **Issue:** Plan suggested `signageApi.updateDevice(id, {name, tag_ids})` against `PATCH /devices/{id}`. Backend `SignageDeviceAdminUpdate` schema only accepts `name`; tags live on a separate `PUT /devices/{id}/tags` endpoint.
- **Fix:** Added `replaceDeviceTags(id, tag_ids)` to signageApi and rewired DeviceEditDialog to sequence PATCH name then PUT tags. Kept `updateDevice` accepting `{name, tag_ids}` for caller ergonomics — internally only forwards `{name}`. Documented in inline comments.
- **Files modified:** `frontend/src/signage/lib/signageApi.ts`, `frontend/src/signage/components/DeviceEditDialog.tsx`
- **Commit:** `5780c41`

**2. [Rule 1 — Bug] Revoke endpoint path is `/pair/devices/{id}/revoke`, not `/pair/{id}/revoke`**
- **Found during:** Task 1 (reading backend/app/routers/signage_pair.py line 247)
- **Issue:** Plan suggested `POST /api/signage/pair/{id}/revoke`. Backend mounts revoke at `POST /api/signage/pair/devices/{device_id}/revoke` (Phase 42 Plan 03 left it there to avoid preempting Phase 43 CRUD).
- **Fix:** Used the correct path in `signageApi.revokeDevice`.
- **Commit:** `5780c41`

### Coordination Notes

- **PairPage created in Task 1 (front-loaded):** App.tsx route registration in Task 1 imports `PairPage`. Without the file, the build breaks. Created the full PairPage in Task 1 rather than a placeholder; Task 3's content was therefore already present when Task 3 ran. All Task 3 acceptance criteria verified post-hoc against the existing file. No separate Task 3 commit needed (no diff).
- **UnsavedChangesDialog race with parallel 46-05:** I created a minimal signage-local one in Task 1; 46-05 overwrote it within seconds with a dual-API shape (`onConfirm` for their PlaylistEditorPage + legacy `onStay/onDiscardAndLeave` for my DeviceEditDialog). 46-05 explicitly preserved the legacy pair "for 46-06 (DeviceEditDialog) compatibility" per their inline comment. Confirmed compatible — DeviceEditDialog continues to work unchanged.
- **`check-signage-invariants.mjs` was provided by parallel 46-04** (commit `df5a936`). Plan referenced it as if it existed; 46-04 created it. No action needed from this plan.
- **App.tsx merged cleanly:** parallel 46-05 inserted its `/signage/playlists/:id` route + PlaylistEditorPage import alongside my PairPage import + /signage/pair route. No conflicts.

### Out-of-scope discoveries

- Pre-existing TypeScript errors in `HrKpiCharts.tsx`, `SalesTable.tsx`, `useSensorDraft.ts`, `defaults.ts` — predate Phase 46, already filed in 46-01 deferred list. Not re-filed.
- `signage/pages/PlaylistsPage.tsx` `description` field error — parallel 46-05's plan to fix; not mine.
- `signage/pages/PlaylistEditorPage` missing import in App.tsx — parallel 46-05's plan to land; not mine.

## Authentication Gates

None.

## Known Stubs

None — all routes wire to live backend endpoints; all forms either submit or hold a dirty-guard.

## Self-Check: PASSED

- `frontend/src/signage/pages/PairPage.tsx` — FOUND
- `frontend/src/signage/components/DeviceEditDialog.tsx` — FOUND
- `frontend/src/signage/components/UnsavedChangesDialog.tsx` — FOUND (richer 46-05 version)
- `frontend/src/signage/pages/DevicesPage.tsx` — FOUND (replaced stub)
- Commit `5780c41` (Task 1 + Task 3 content) — FOUND
- Commit `8c3e72c` (Task 2 DevicesPage) — FOUND
- `signageApi.updateDevice` / `replaceDeviceTags` / `revokeDevice` / `claimPairingCode` — all present
- `path="/signage/pair"` in App.tsx — present
- `refetchInterval: 30_000` in DevicesPage — present
- `replace(/[^A-Za-z0-9]/g` auto-format in PairPage — present
- `node scripts/check-signage-invariants.mjs` — `SIGNAGE INVARIANTS OK`
- `node --experimental-strip-types scripts/check-locale-parity.mts` — `PARITY OK: 407 keys`
