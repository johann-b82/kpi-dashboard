---
phase: 70-mig-sign-devices
plan: 03
subsystem: signage-frontend
tags: [signage, directus-sdk, mig-sign, devices, frontend]
requires:
  - 70-01 (FastAPI /api/signage/resolved/{id})
provides:
  - signageApi.listDevices via Directus readItems
  - signageApi.getDevice via Directus readItems (NEW)
  - signageApi.updateDevice via Directus updateItem
  - signageApi.replaceDeviceTags via FE-driven diff against signage_device_tag_map
  - signageApi.getResolvedForDevice via FastAPI /api/signage/resolved/{id} (NEW)
  - signageApi.deleteDevice via Directus deleteItem (NEW; no current consumer)
affects:
  - frontend/src/signage/lib/signageApi.ts
tech-stack:
  added: []
  patterns:
    - "FE-driven tag-map diff verbatim from replacePlaylistTags (D-03d)"
    - "Directus updateItem with field allowlist returns full row"
    - "Hybrid Directus row + FastAPI resolved compute split (D-01/D-02)"
key-files:
  created: []
  modified:
    - frontend/src/signage/lib/signageApi.ts
decisions:
  - "DEVICE_FIELDS excludes status (server-computed from heartbeat) and current_playlist_id/name/tag_ids/available_modes (computed via getResolvedForDevice or sidecar heartbeat)"
  - "revokeDevice STAYS unchanged on FastAPI pair router (research Open Question 1: pair-router endpoint flips revoked_at flag, NOT a row deletion)"
  - "replaceDeviceTags structurally identical to replacePlaylistTags so Phase 71 FE-01 can extract shared replaceTagMap util"
metrics:
  duration: "80s"
  completed: "2026-04-25"
  tasks: 1
  files: 1
---

# Phase 70 Plan 03: Frontend signageApi Devices Swap Summary

Inline-swapped `signageApi.ts` device-row functions from FastAPI to Directus SDK while preserving public signatures (D-00g). Added `getDevice`, `getResolvedForDevice`, and `deleteDevice`. `revokeDevice`, `updateDeviceCalibration`, and `listDeviceAnalytics` left unchanged.

## What Changed

- `listDevices`: `apiClient("/api/signage/devices")` → `directus.request(readItems("signage_devices", { fields: DEVICE_FIELDS, sort: ["created_at"], limit: -1 }))`
- `getDevice` (NEW): per-device row read via `readItems` with `filter: { id: { _eq: id } }`, throws on empty result
- `getResolvedForDevice` (NEW): `apiClient("/api/signage/resolved/${id}")` returning `{ current_playlist_id, current_playlist_name, tag_ids }`
- `updateDevice`: PATCH `/api/signage/devices/{id}` → `directus.request(updateItem("signage_devices", id, { name }, { fields: DEVICE_FIELDS }))`. Public signature still accepts `{name, tag_ids}`; only `name` is forwarded — caller (DeviceEditDialog) sequences with `replaceDeviceTags`
- `replaceDeviceTags`: PUT `/api/signage/devices/{id}/tags` → FE-driven diff against `signage_device_tag_map` (verbatim shape of `replacePlaylistTags` per D-03d), composite PK uses `deleteItems` query/filter form
- `deleteDevice` (NEW): `directus.request(deleteItem("signage_devices", id))` — provided for migration parity; no current UI consumer

## What Stayed the Same (D-00 Architectural Locks)

- `revokeDevice` → `POST /api/signage/pair/devices/{id}/revoke` — flips `revoked_at = now()` (idempotent JWT revocation flag, NOT row deletion)
- `updateDeviceCalibration` → `PATCH /api/signage/devices/{id}/calibration` (D-00j surviving FastAPI route)
- `listDeviceAnalytics` → `GET /api/signage/analytics/devices` (separate v1.22 lock)
- `claimPairingCode` → pair-flow, untouched

## DEVICE_FIELDS Allowlist

```ts
const DEVICE_FIELDS = [
  "id", "name", "created_at", "updated_at",
  "last_seen_at", "revoked_at",
  "rotation", "hdmi_mode", "audio_enabled",
] as const;
```

Excluded computed fields: `status` (derived from heartbeat), `current_playlist_id`, `current_playlist_name`, `tag_ids`, `available_modes` (filled via `getResolvedForDevice` merge or sidecar heartbeat).

## Verification

- `npx tsc --noEmit` exits 0
- All acceptance greps satisfy intent (multi-line `updateItem(\n  "signage_devices"...` and `createItems(\n  "signage_device_tag_map"...` are present at lines 363 and 405; single-line greps undercount but the structural call is verified)
- Public signatures unchanged: existing consumers (DeviceEditDialog, DevicesPage) compile without modification

## Acceptance Grep Results

| Pattern                                              | Required | Got |
| ---------------------------------------------------- | -------- | --- |
| `readItems("signage_devices"`                        | ≥2       | 2   |
| `updateItem("signage_devices"` (multiline call)      | ≥1       | 1*  |
| `deleteItem("signage_devices"`                       | 1        | 1   |
| `readItems("signage_device_tag_map"`                 | 1        | 1   |
| `deleteItems("signage_device_tag_map"`               | 1        | 1   |
| `createItems("signage_device_tag_map"` (multiline)   | 1        | 1*  |
| `/api/signage/resolved/`                             | 1        | 1   |
| `/api/signage/pair/devices/`                         | 1        | 1** |
| `/api/signage/devices/.*tags`                        | 0        | 0   |
| `DEVICE_FIELDS`                                      | ≥4       | 4   |

\* Multi-line invocation; line-grep counts the identifier on its own line.
\*\* Plus 1 doc-comment reference (acceptable; revokeDevice itself is unchanged).

## Deviations from Plan

None — plan executed as written. SDK call shapes split across lines for prettier formatting, but every required identifier and route literal is present.

## Commits

- `e78018e` — feat(70-03): swap signageApi device fns to Directus SDK

## Self-Check: PASSED

- File exists: `frontend/src/signage/lib/signageApi.ts` ✓
- Commit exists: `e78018e` ✓
- TypeScript compiles ✓
