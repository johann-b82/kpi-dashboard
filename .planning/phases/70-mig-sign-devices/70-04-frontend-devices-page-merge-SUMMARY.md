---
phase: 70-mig-sign-devices
plan: 04
subsystem: signage-frontend
tags: [signage, react-query, mig-sign, devices, frontend, sse]
requires:
  - 70-01 (FastAPI /api/signage/resolved/{id})
  - 70-03 (signageApi.getResolvedForDevice + Directus listDevices)
provides:
  - DevicesPage hybrid render via useQuery + useQueries + useMemo merge (D-02)
  - SSE namespaced cache-key invalidation (D-05a) for device-changed/playlist-changed
  - DeviceEditDialog post-save invalidation aligned with D-05 namespaces
affects:
  - frontend/src/signage/pages/DevicesPage.tsx
  - frontend/src/signage/pages/DevicesPage.test.tsx
  - frontend/src/signage/lib/useAdminSignageEvents.ts
  - frontend/src/signage/components/DeviceEditDialog.tsx
tech-stack:
  added: []
  patterns:
    - "Cross-source useQueries fan-out (Directus row + per-row FastAPI compute) merged via useMemo (Pattern 2)"
    - "Namespaced cache keys: ['directus','signage_devices'] + ['fastapi','resolved',deviceId] (D-05)"
    - "Em-dash placeholder for pending/error resolved cells (no skeleton/spinner per UI-SPEC)"
key-files:
  created: []
  modified:
    - frontend/src/signage/pages/DevicesPage.tsx
    - frontend/src/signage/pages/DevicesPage.test.tsx
    - frontend/src/signage/lib/useAdminSignageEvents.ts
    - frontend/src/signage/components/DeviceEditDialog.tsx
decisions:
  - "Legacy signageKeys.devices() / signageKeys.playlists() invalidation kept alongside new namespaced keys for backward compat — Phase 71 FE-03 will purge with one-shot removeQueries"
  - "Visual parity with v1.21 confirmed via human-verify checkpoint (Task 2 approved by user 2026-04-25); DevTools traffic + 8-column table render identical"
  - "useQueries fan-out acceptable for typical device counts <20 (D-02b); HTTP/2 multiplexing keeps the N parallel /resolved/{id} requests cheap"
requirements: [MIG-SIGN-04]
metrics:
  duration: "~7m (incl. UAT checkpoint wait)"
  completed: "2026-04-25"
  tasks: 2
  files: 4
---

# Phase 70 Plan 04: Frontend Devices Page Merge Summary

DevicesPage now renders the v1.21 8-column table from a hybrid data flow: a single `useQuery` fetches Directus device rows, `useQueries` fans out one parallel `/api/signage/resolved/{id}` request per device, and a `useMemo` merges them client-side preserving the v1.21 `current_playlist_*` + `tag_ids` field names. SSE invalidation aligns with the new namespaced cache keys per D-05a.

## What Changed

### `frontend/src/signage/pages/DevicesPage.tsx`

- Added `useQueries` import alongside existing `useMutation`/`useQuery`/`useQueryClient`.
- Replaced single-fetch `useQuery({ queryKey: signageKeys.devices() })` with:
  1. `useQuery({ queryKey: ["directus", "signage_devices"] as const, queryFn: signageApi.listDevices })` — Directus row list (D-05).
  2. `useQueries({ queries: deviceRows.map(d => ({ queryKey: ["fastapi", "resolved", d.id] as const, queryFn: () => signageApi.getResolvedForDevice(d.id), staleTime: 30_000 })) })` — per-device resolved fan-out (D-02a).
  3. `useMemo` spread merge: `{ ...row, ...(resolvedQueries[i]?.data ?? { current_playlist_id: null, current_playlist_name: null, tag_ids: null }) }` (D-02 / D-04 — no rename layer needed).
- `revokeMutation.onSuccess` now invalidates both `["directus", "signage_devices"]` and `["fastapi", "resolved"]` (prefix invalidation flushes all per-device caches).
- All visible JSX (empty state, table columns, edit/revoke buttons, badges) byte-identical to v1.21.

### `frontend/src/signage/lib/useAdminSignageEvents.ts`

- `device-changed`: invalidates legacy `signageKeys.devices()` + new `["directus", "signage_devices"]` + `["fastapi", "resolved"]` prefix.
- `playlist-changed`: invalidates legacy `signageKeys.playlists()` + new `["directus", "signage_playlists"]` + `["fastapi", "resolved"]` prefix (per D-05a Pitfall 1 — tag-map mutations on `signage_device_tag_map` fire device-changed, but a true playlist-changed event may flip the resolver output for any device whose tags match).
- `schedule-changed`: also invalidates `["directus", "signage_schedules"]` for Phase 68-04 parity.
- `calibration-changed`: unchanged — does NOT invalidate the device list (D-05a; calibration is per-device player concern with its own SSE).

### `frontend/src/signage/components/DeviceEditDialog.tsx`

- onSuccess invalidations augmented to include `["directus", "signage_devices"]`, `["directus", "signage_devices", id]`, and `["fastapi", "resolved", id]` so name PATCH and tag-map mutations both flip the resolved cell immediately.

### `frontend/src/signage/pages/DevicesPage.test.tsx`

- Test setup mocks both `signageApi.listDevices` (Directus row shape, no resolved fields) and `signageApi.getResolvedForDevice` (returns `{ current_playlist_id, current_playlist_name, tag_ids }` per device id) so existing assertions about rendered cells pass under the new fan-out pattern.

## Cache Key Namespace Map (post Plan 70-04)

| Key                                          | Source                              | Used by                          |
| -------------------------------------------- | ----------------------------------- | -------------------------------- |
| `["directus", "signage_devices"]`            | Directus REST                       | DevicesPage list, revoke, edit   |
| `["directus", "signage_devices", deviceId]`  | Directus REST                       | DeviceEditDialog (when needed)   |
| `["fastapi", "resolved", deviceId]`          | FastAPI `/api/signage/resolved/{id}`| Per-row resolved cell + tag_ids  |
| `signageKeys.deviceAnalytics()`              | FastAPI analytics                   | Unchanged (separate surface)     |
| `signageKeys.tags()`                         | Directus (Phase 68)                 | Unchanged                        |

## Verification

- Task 1 automated: `npx tsc --noEmit` + `npx vitest run src/signage/pages/DevicesPage src/signage/components/DeviceEditDialog` — green at commit time.
- Task 2 manual UAT (human-verify checkpoint): user typed "approved" 2026-04-25 confirming all 8 visual-parity checks pass:
  - 8-column table renders identically to v1.21
  - Em-dash flashes briefly on first paint then resolves to playlist name (no skeleton, no layout shift)
  - DevTools shows ONE `/directus/items/signage_devices` + N `/api/signage/resolved/{id}` requests; ZERO hits on the removed `/api/signage/devices` route family
  - Edit/revoke flows update the list; SSE playlist rename in another tab fans out to the resolved cell within ~500ms

## Deviations from Plan

None — plan executed as written. Both tasks completed; the human-verify checkpoint cleared on first attempt with no regressions reported.

## Commits

- `f39bd8c` — feat(70-04): merge Directus device rows + FastAPI resolved via useQueries

## Self-Check: PASSED

- File exists: `frontend/src/signage/pages/DevicesPage.tsx` — FOUND
- File exists: `frontend/src/signage/pages/DevicesPage.test.tsx` — FOUND
- File exists: `frontend/src/signage/lib/useAdminSignageEvents.ts` — FOUND
- File exists: `frontend/src/signage/components/DeviceEditDialog.tsx` — FOUND
- Commit exists: `f39bd8c` — FOUND
- SUMMARY.md created at `.planning/phases/70-mig-sign-devices/70-04-frontend-devices-page-merge-SUMMARY.md`
