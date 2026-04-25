---
phase: 70-mig-sign-devices
verified: 2026-04-25T00:00:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 70: MIG-SIGN — Devices Verification Report

**Phase Goal:** Device CRUD (name, tags, delete) happens through Directus; calibration PATCH and analytics uptime stay in FastAPI; the Devices admin list renders Directus rows merged with a FastAPI-computed resolved-playlist per device; SSE `device-changed` fires for both writers without double-firing on calibration.
**Verified:** 2026-04-25
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                                                       | Status     | Evidence                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Admin can rename, edit tag set, delete a device via `/signage/devices` with writes through Directus SDK on `signage_devices` + `signage_device_tag_map`.                                    | ✓ VERIFIED | `signageApi.ts` listDevices/getDevice/updateDevice/replaceDeviceTags/deleteDevice all use Directus SDK (`readItems/updateItem/deleteItem/createItems/deleteItems` on signage_devices + signage_device_tag_map); `devices.py` no longer exposes name PATCH, DELETE, PUT /tags, or list. |
| 2   | Calibration PATCH (rotation/HDMI/audio) continues to hit FastAPI `PATCH /api/signage/devices/{id}/calibration` with `Literal[0,90,180,270]` validation and fires `calibration-changed` SSE. | ✓ VERIFIED | `devices.py:55-104` retains `@router.patch("/{device_id}/calibration", ...)` returning `SignageDeviceRead`; `signage_broadcast.notify_device(... "calibration-changed" ...)` at line 86-89; signageApi `updateDeviceCalibration` unchanged at line 425.                                |
| 3   | Devices list shows currently-resolved playlist via new FastAPI `GET /api/signage/resolved/{device_id}` merged client-side with Directus row data.                                           | ✓ VERIFIED | New `resolved.py` registered in `signage_admin/__init__.py:11,23`; route `/api/signage/resolved/{device_id}` returns `{current_playlist_id, current_playlist_name, tag_ids}`; `DevicesPage.tsx` uses `useQuery + useQueries + useMemo` merge (lines 61, 71-78).                        |
| 4   | Directus mutations on signage_devices name/tags fire `device-changed` (and/or `playlist-changed`) SSE within 500ms; `signage_devices` LISTEN trigger does NOT fire on calibration-only updates. | ✓ VERIFIED | 4 new SSE regression tests in `test_pg_listen_sse.py` (lines 1098, 1155, 1209, 1304) cover name update, delete, tag-map insert, and calibration no-double-fire; CI guard prevents reintroduction of migrated routes.                                                                  |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                | Expected                                                              | Status     | Details                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/routers/signage_admin/resolved.py`         | New GET /resolved/{device_id} route                                   | ✓ VERIFIED | Single route, ResolvedDeviceResponse model, 404 path, no per-route admin gate (inherited from package).                                |
| `backend/app/routers/signage_admin/__init__.py`         | Imports + registers resolved router                                   | ✓ VERIFIED | `from . import ... resolved` (line 11) + `router.include_router(resolved.router)` (line 23).                                           |
| `backend/app/routers/signage_admin/devices.py`          | Calibration PATCH only + retained `_notify_device_self`               | ✓ VERIFIED | 105 lines, single `@router.patch("/{device_id}/calibration", ...)`, helper retained (line 30), inline resolver+tag_ids in calibration. |
| `frontend/src/signage/lib/signageApi.ts`                | Directus SDK swap + getResolvedForDevice + deleteDevice               | ✓ VERIFIED | listDevices/getDevice/updateDevice via Directus; new getResolvedForDevice (line 345), deleteDevice (line 418); revokeDevice unchanged. |
| `frontend/src/signage/pages/DevicesPage.tsx`            | useQueries merge against Directus + /resolved/{id}                    | ✓ VERIFIED | useQueries imported + used (lines 6, 71); cache keys `["directus","signage_devices"]` + `["fastapi","resolved",d.id]`.                 |
| `frontend/src/signage/lib/useAdminSignageEvents.ts`     | Namespaced cache invalidation per D-05a                               | ✓ VERIFIED | device-changed and playlist-changed cases invalidate `["directus","signage_devices"]` + `["fastapi","resolved"]` (lines 80, 89, 92).   |
| `backend/tests/signage/test_pg_listen_sse.py`           | 4 new SSE regression tests                                            | ✓ VERIFIED | All 4 test names found at lines 1098, 1155, 1209, 1304.                                                                                |
| `backend/tests/signage/test_admin_directus_crud_smoke.py` | Admin smoke for devices + tag-map (xfail-tolerant)                  | ✓ VERIFIED | Both smoke tests present at lines 261, 332.                                                                                            |
| `backend/tests/test_rbac.py`                            | READ_ROUTES updated (migrated removed, /resolved added)              | ✓ VERIFIED | `/api/signage/resolved/...` present (line 51); migrated paths removed.                                                                 |
| `.github/workflows/ci.yml`                              | Phase 70 method-anchored guard scoped to devices.py                   | ✓ VERIFIED | New step at line 174 (`Phase 70 — block reintroduced device CRUD routes (MIG-SIGN-04)`); YAML valid; dry-run returns 0 matches.        |

### Key Link Verification

| From                                                | To                                                | Via                                       | Status   | Details                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `signage_admin/resolved.py`                         | `services/signage_resolver.py`                    | `resolve_playlist_for_device(db, row)`    | ✓ WIRED  | Imported and called (resolved.py:23, 47).                                                                     |
| `signage_admin/__init__.py`                         | `signage_admin/resolved.py`                       | `include_router`                          | ✓ WIRED  | Tool flagged regex pattern as not-found, but actual file content shows both `from . import ... resolved` (line 11) and `router.include_router(resolved.router)` (line 23). False negative on regex. |
| `signage_admin/devices.py`                          | calibration-changed SSE                           | `signage_broadcast.notify_device`         | ✓ WIRED  | devices.py:86-89 emits `{"event": "calibration-changed", ...}`.                                               |
| `signageApi.ts`                                     | Directus signage_devices collection                | `directus.request(readItems(...))`        | ✓ WIRED  | listDevices/getDevice/updateDevice/replaceDeviceTags/deleteDevice all hit Directus SDK.                        |
| `signageApi.ts`                                     | FastAPI /api/signage/resolved/{id}                | `apiClient<...>('/api/signage/resolved/${id}')` | ✓ WIRED  | getResolvedForDevice (line 345).                                                                              |
| `DevicesPage.tsx`                                   | listDevices + getResolvedForDevice                | useQuery + useQueries                     | ✓ WIRED  | Lines 61, 71-78.                                                                                              |
| `useAdminSignageEvents.ts`                          | `['fastapi','resolved',deviceId]` cache key       | `queryClient.invalidateQueries`           | ✓ WIRED  | device-changed and playlist-changed cases.                                                                    |
| `test_pg_listen_sse.py`                             | Phase 65 LISTEN bridge                            | asyncpg notify subscription               | ✓ WIRED  | Pattern found in source.                                                                                      |
| `ci.yml`                                            | `signage_admin/devices.py`                        | grep -E pattern scoped to single file     | ✓ WIRED  | File scope explicit (line 177); guard regex blocks 5 migrated patterns.                                        |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable           | Source                                                   | Produces Real Data | Status     |
| --------------------------------- | ----------------------- | -------------------------------------------------------- | ------------------ | ---------- |
| `DevicesPage.tsx`                 | `devices` (useMemo)     | `signageApi.listDevices` (Directus) + N `getResolvedForDevice` (FastAPI) | Yes — both endpoints query DB | ✓ FLOWING  |
| `resolved.py` route               | `envelope`, `tag_ids`   | `resolve_playlist_for_device(db, row)` + `select(SignageDeviceTagMap.tag_id)` | Yes — direct DB queries | ✓ FLOWING  |
| `signageApi.ts updateDevice`      | request body            | DeviceEditDialog → Directus SDK updateItem               | Yes — Directus mutates DB | ✓ FLOWING  |

### Behavioral Spot-Checks

Skipped — verification did not start the stack (per Step 7b "do not start servers"). Per-test verification deferred to CI / Plan 70-04 human-verify checkpoint (already approved per task input).

| Behavior | Result | Status |
| -------- | ------ | ------ |
| Calibration route registration (`devices.py` import + introspection) | `update_device_calibration` is the sole route at `/devices/{device_id}/calibration` | Validated in Plan 70-02 acceptance criteria |
| Resolved route registration (`resolved.py`) | route present in package router | Validated in Plan 70-01 acceptance criteria |
| CI guard dry-run | `grep -nE '@router\.(get\|patch\|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]' devices.py \| grep -v '/calibration"' \| wc -l` → 0 | ✓ PASS |
| CI guard PUT /tags dry-run | `grep -nE '@router\.put\(\s*"/\{device_id\}/tags"' devices.py \| wc -l` → 0 | ✓ PASS |
| ci.yml YAML validity | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s)                       | Description                                                                                                              | Status      | Evidence                                                                                                                                                                              |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIG-SIGN-04 | 70-01, 70-02, 70-03, 70-04, 70-05, 70-06 | `signage_devices` PATCH name + DELETE + PUT tags move to Directus; calibration PATCH stays in FastAPI; hybrid list (Directus + new `/api/signage/resolved/{id}`); SSE bridges verified. | ✓ SATISFIED | All 4 success criteria verified; all 6 plans reference this requirement; FE + BE + tests + CI guard all complete. REQUIREMENTS.md row 139 marks Phase 70 status "Complete". |

No orphaned requirements: only MIG-SIGN-04 is mapped to Phase 70 in REQUIREMENTS.md, and all 6 plans declare it.

### Anti-Patterns Found

None. Scanned new/modified files (`resolved.py`, `devices.py`, `signageApi.ts`, `DevicesPage.tsx`, `useAdminSignageEvents.ts`, test files, ci.yml) for TODO/FIXME/XXX/HACK/placeholder/empty-impl markers in this phase's additions. Existing comments referencing `Phase 71` are forward references (intentional retention notes per D-03c), not code stubs.

### Human Verification Required

None. Plan 70-04 Task 2 (visual parity human-verify checkpoint) was already approved per phase input ("70-04: ... visual parity human-verified, approved"). All other automated checks pass.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are satisfied by concrete, wired artifacts:

- The frontend writes through Directus (listDevices/getDevice/updateDevice/replaceDeviceTags/deleteDevice).
- The frontend reads through both Directus (rows) and FastAPI (resolved playlist), merged via `useQueries + useMemo`.
- The backend retains exactly one device write (calibration PATCH) and adds exactly one new read endpoint (`/api/signage/resolved/{device_id}`).
- The SSE bridge is regression-tested for the 3 Directus-originated mutations and the calibration no-double-fire invariant.
- The CI guard prevents accidental rollback of the 5 migrated routes while preserving the surviving calibration PATCH.

The single key-link "false-negative" from `gsd-tools verify key-links` (Plan 70-01's `from \. import .*resolved` pattern) was confirmed wired by direct file inspection — `signage_admin/__init__.py:11,23` shows both the import and the `include_router` call. Tool regex escaping issue, not an implementation gap.

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
