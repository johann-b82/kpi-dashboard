---
phase: 70-mig-sign-devices
plan: 04
type: execute
wave: 2
depends_on: ["70-03"]
files_modified:
  - frontend/src/signage/pages/DevicesPage.tsx
  - frontend/src/signage/lib/useAdminSignageEvents.ts
autonomous: false
requirements: [MIG-SIGN-04]
must_haves:
  truths:
    - "DevicesPage renders the same 8-column table as v1.21 (visual parity per UI-SPEC)"
    - "Device list is fetched via useQuery against Directus signage_devices"
    - "Per-device resolved playlist is fetched via useQueries against /api/signage/resolved/{id}"
    - "useMemo merges Directus row + per-device resolved data preserving current_playlist_* + tag_ids field names"
    - "Loading state for resolved cell renders em-dash (no skeleton/spinner per UI-SPEC)"
    - "Error state for resolved cell renders em-dash silently (no per-row toast)"
    - "SSE device-changed invalidates both ['directus','signage_devices'] and ['fastapi','resolved',deviceId]"
    - "SSE playlist-changed invalidates ['fastapi','resolved',deviceId] for affected devices"
  artifacts:
    - path: "frontend/src/signage/pages/DevicesPage.tsx"
      provides: "useQueries-based merge of Directus rows + FastAPI resolved data"
      contains: "useQueries"
    - path: "frontend/src/signage/lib/useAdminSignageEvents.ts"
      provides: "SSE handler with namespaced cache-key invalidation per D-05a"
      contains: "[\"directus\", \"signage_devices\"]"
  key_links:
    - from: "frontend/src/signage/pages/DevicesPage.tsx"
      to: "signageApi.listDevices + signageApi.getResolvedForDevice"
      via: "useQuery + useQueries"
      pattern: "useQueries"
    - from: "frontend/src/signage/lib/useAdminSignageEvents.ts"
      to: "['fastapi', 'resolved', deviceId] cache key"
      via: "queryClient.invalidateQueries"
      pattern: "fastapi.*resolved"
---

<objective>
Refactor `DevicesPage.tsx` to use the project's first cross-source `useQueries` merge: a single `useQuery` fetches Directus device rows, then `useQueries` fans out one parallel query per device against the new `/api/signage/resolved/{id}` endpoint. A `useMemo` merges them preserving the v1.21 `current_playlist_*` + `tag_ids` field names.

Update `useAdminSignageEvents.ts` to invalidate the new namespaced cache keys (`['directus', 'signage_devices']` and `['fastapi', 'resolved', deviceId]`) per D-05a.

Purpose: Implements MIG-SIGN-04 hybrid list rendering (ROADMAP success criterion #3). Visual parity locked by UI-SPEC §"Visual Parity Lock"; pixel diff against v1.21 must be zero except for per-cell async load order.

Output: DevicesPage renders identically to v1.21 with new data flow; SSE invalidation aligned with new cache keys.

This plan is NON-AUTONOMOUS — Task 2 is a `checkpoint:human-verify` for visual parity.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/70-mig-sign-devices/70-CONTEXT.md
@.planning/phases/70-mig-sign-devices/70-RESEARCH.md
@.planning/phases/70-mig-sign-devices/70-UI-SPEC.md
@frontend/src/signage/pages/DevicesPage.tsx
@frontend/src/signage/pages/DevicesPage.test.tsx
@frontend/src/signage/lib/useAdminSignageEvents.ts
@frontend/src/signage/components/DeviceEditDialog.tsx
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/lib/queryKeys.ts

<interfaces>
<!-- New cache key namespaces (D-05) -->
['directus', 'signage_devices']                — Directus row list (replaces signageKeys.devices())
['directus', 'signage_devices', deviceId]      — single-device row (when needed)
['fastapi', 'resolved', deviceId]              — per-device resolved playlist + tag_ids
signageKeys.deviceAnalytics()                  — UNCHANGED (separate FastAPI surface)
signageKeys.tags()                             — UNCHANGED (Directus, separate Phase 68 surface)

<!-- Merge contract -->
type SignageDevice = (Directus row fields) & {
  current_playlist_id: string | null;        // computed via /api/signage/resolved/{id}
  current_playlist_name: string | null;      // computed
  tag_ids: number[] | null;                  // computed
};

merged = directusRow + (resolvedQuery.data ?? { current_playlist_id: null, current_playlist_name: null, tag_ids: null })
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refactor DevicesPage.tsx + update SSE invalidation</name>
  <files>frontend/src/signage/pages/DevicesPage.tsx, frontend/src/signage/lib/useAdminSignageEvents.ts</files>
  <read_first>
    - frontend/src/signage/pages/DevicesPage.tsx (full current file — 278 lines)
    - frontend/src/signage/pages/DevicesPage.test.tsx (existing tests — confirm what they assert about the rendered table; tests may need updates to mock the new useQueries pattern)
    - frontend/src/signage/lib/useAdminSignageEvents.ts (full file — 93 lines; SSE invalidation logic)
    - frontend/src/lib/queryKeys.ts (signageKeys helpers)
    - frontend/src/signage/components/DeviceEditDialog.tsx (consumer of updateDevice + replaceDeviceTags — verify it sequences PATCH-then-PUT per research Open Question 2; update its onSuccess invalidation to use the new namespaced keys if needed)
    - .planning/phases/70-mig-sign-devices/70-UI-SPEC.md ("Interaction Contract — Per-Device Resolved Playlist Cell" — em-dash for pending/error, no skeleton)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pattern 2 useQueries merge)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-02, D-02a, D-02b, D-02c, D-04, D-05, D-05a)
  </read_first>
  <behavior>
    - Initial render with no devices: empty state visible (h2 + body + Pair-device CTA)
    - Initial render with N devices: table renders N rows; resolved cell shows em-dash for any row whose useQueries entry is `isPending`
    - After resolved-query success: cell shows `current_playlist_name ?? current_playlist_id ?? "—"` (matches v1.21 line 185)
    - After resolved-query error for one row: that row's cell shows em-dash; no toast fires (D-02b)
    - DeviceStatusChip / UptimeBadge / Tags column / Last seen column / Edit + Revoke buttons render IDENTICALLY to v1.21 (UI-SPEC visual parity)
    - SSE `device-changed` invalidates `['directus', 'signage_devices']` (full list) AND `['fastapi', 'resolved', deviceId]` if event payload contains a device_id, otherwise invalidates `['fastapi', 'resolved']` (partial-key prefix)
    - SSE `playlist-changed` invalidates `['fastapi', 'resolved']` (any device's resolved cache may have flipped) — NOT signageKeys.playlists() unless other consumers need it (preserve existing playlist invalidation if other admin pages depend on it)
    - SSE `calibration-changed` does NOT invalidate the device list (D-05a — calibration is per-device player concern)
  </behavior>
  <action>
    **Step A — Refactor DevicesPage.tsx:**

    1. Add `useQueries` to the existing import: `import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";`

    2. REPLACE the existing `useQuery` for devices (lines 53-57):

       From:
       ```typescript
       const { data: devices = [], isLoading } = useQuery({
         queryKey: signageKeys.devices(),
         queryFn: signageApi.listDevices,
         refetchInterval: 30_000,
       });
       ```

       To:
       ```typescript
       // Phase 70-04 (D-02, D-05): Directus row list. Resolved playlist + tag_ids
       // are fetched per-device via useQueries below and merged client-side.
       const { data: deviceRows = [], isLoading } = useQuery({
         queryKey: ["directus", "signage_devices"] as const,
         queryFn: signageApi.listDevices,
         refetchInterval: 30_000,
       });

       // Phase 70-04 (D-02, D-02a): per-device resolved playlist via FastAPI
       // /api/signage/resolved/{id}. Cache key per device aligns with SSE bridge
       // (D-02c, D-05a) — playlist-changed / device-changed events for device X
       // invalidate exactly that key. N parallel HTTP/2 requests acceptable for
       // typical device counts <20 (D-02b).
       const resolvedQueries = useQueries({
         queries: deviceRows.map((d) => ({
           queryKey: ["fastapi", "resolved", d.id] as const,
           queryFn: () => signageApi.getResolvedForDevice(d.id),
           staleTime: 30_000,
         })),
       });

       // Phase 70-04 (D-02, D-04): merge Directus row + resolved response.
       // Field names align with SignageDevice extras so the spread is loss-free
       // — current_playlist_id / current_playlist_name / tag_ids land directly
       // on the SignageDevice shape (D-04 / D-04a — no rename to resolved_*).
       const devices: SignageDevice[] = useMemo(
         () =>
           deviceRows.map((row, i) => ({
             ...row,
             ...(resolvedQueries[i]?.data ?? {
               current_playlist_id: null,
               current_playlist_name: null,
               tag_ids: null,
             }),
           })) as SignageDevice[],
         [deviceRows, resolvedQueries],
       );
       ```

    3. The rest of the component (empty state, table render, edit/revoke dialogs) is UNCHANGED. The `devices` variable now derives from the merge instead of a single fetch — visible JSX is byte-identical.

    4. Update the `revokeMutation.onSuccess` invalidation key to use the new namespace:

       From:
       ```typescript
       queryClient.invalidateQueries({ queryKey: signageKeys.devices() });
       ```

       To:
       ```typescript
       queryClient.invalidateQueries({ queryKey: ["directus", "signage_devices"] });
       queryClient.invalidateQueries({ queryKey: ["fastapi", "resolved"] });
       ```

       (Revoke flips `revoked_at` server-side; the device row mutation in Postgres will fire via the LISTEN bridge anyway, but mutation-side invalidation keeps the UI snappy.)

    5. Verify DeviceEditDialog's onSuccess invalidations also use the new keys. If DeviceEditDialog still uses `signageKeys.devices()` for its post-save invalidation, update it to invalidate `["directus", "signage_devices"]` AND `["fastapi", "resolved", id]` (since name PATCH and tag-map mutations both can flip the resolved cell). Apply the SAME edit pattern there:

       ```typescript
       // In DeviceEditDialog.tsx onSuccess (or wherever the mutation succeeds):
       queryClient.invalidateQueries({ queryKey: ["directus", "signage_devices"] });
       queryClient.invalidateQueries({ queryKey: ["directus", "signage_devices", id] });
       queryClient.invalidateQueries({ queryKey: ["fastapi", "resolved", id] });
       ```

    **Step B — Update useAdminSignageEvents.ts:**

    1. Replace the `device-changed` and `playlist-changed` cases (lines 56-72) with namespaced invalidation per D-05a:

       From:
       ```typescript
       case "schedule-changed":
         queryClient.invalidateQueries({ queryKey: signageKeys.schedules() });
         break;
       case "playlist-changed":
         queryClient.invalidateQueries({ queryKey: signageKeys.playlists() });
         break;
       case "device-changed":
         queryClient.invalidateQueries({ queryKey: signageKeys.devices() });
         break;
       ```

       To:
       ```typescript
       case "schedule-changed":
         queryClient.invalidateQueries({ queryKey: signageKeys.schedules() });
         // Phase 68-04: schedules are now Directus-served too.
         queryClient.invalidateQueries({ queryKey: ["directus", "signage_schedules"] });
         break;
       case "playlist-changed":
         queryClient.invalidateQueries({ queryKey: signageKeys.playlists() });
         // Phase 69-03: playlists are Directus-served.
         queryClient.invalidateQueries({ queryKey: ["directus", "signage_playlists"] });
         // Phase 70-04 (D-05a, Pitfall 1): tag-map mutations on
         // signage_device_tag_map ALSO fire device-changed (not playlist-changed)
         // per signage_pg_listen.py:86-88, but a true playlist-changed event
         // (item reorder, metadata) may flip the resolver output for any device
         // whose tags match. Invalidate the entire ['fastapi', 'resolved']
         // prefix so all per-device caches refresh.
         queryClient.invalidateQueries({ queryKey: ["fastapi", "resolved"] });
         break;
       case "device-changed":
         // Phase 70-04 (D-05a): namespaced device list + resolved prefix.
         queryClient.invalidateQueries({ queryKey: signageKeys.devices() });
         queryClient.invalidateQueries({ queryKey: ["directus", "signage_devices"] });
         queryClient.invalidateQueries({ queryKey: ["fastapi", "resolved"] });
         break;
       ```

       Keep `signageKeys.devices()` invalidation alongside the new key for backward compatibility — Phase 71 FE-03 will purge the legacy keys with a one-shot `removeQueries`.

    **Step C — Update DevicesPage.test.tsx:**

    Update the test setup to mock both `signageApi.listDevices` AND `signageApi.getResolvedForDevice`. Each mocked device's resolved data should match the existing test fixture's `current_playlist_id` / `current_playlist_name` / `tag_ids` values so test assertions about rendered cells continue to pass.

    Specifically: where the test today returns `[{ id, name, current_playlist_name, tag_ids, ... }]` from `listDevices`, split it into:
    - `listDevices` returns `[{ id, name, ... (no resolved fields) }]`
    - `getResolvedForDevice` (called per device id) returns `{ current_playlist_id, current_playlist_name, tag_ids }`

    Use vitest's `vi.mock` or whichever pattern the existing test file uses. Read the test file before editing to match its style.
  </action>
  <acceptance_criteria>
    - `grep -c "useQueries" frontend/src/signage/pages/DevicesPage.tsx` returns at least 1
    - `grep -c "\\['fastapi', 'resolved'" frontend/src/signage/pages/DevicesPage.tsx` returns at least 1
    - `grep -c "\\[\"directus\", \"signage_devices\"\\]" frontend/src/signage/pages/DevicesPage.tsx` returns at least 2 (useQuery + revokeMutation invalidation)
    - `grep -c "useMemo" frontend/src/signage/pages/DevicesPage.tsx` returns at least 1 (merge memoization)
    - `grep -c "current_playlist_name ?? d.current_playlist_id" frontend/src/signage/pages/DevicesPage.tsx` returns 1 (cell render preserved verbatim from v1.21 line 185)
    - `grep -c "fastapi.*resolved" frontend/src/signage/lib/useAdminSignageEvents.ts` returns at least 2 (playlist-changed + device-changed cases)
    - `grep -c "directus.*signage_devices" frontend/src/signage/lib/useAdminSignageEvents.ts` returns at least 1 (device-changed case)
    - `cd frontend && npx tsc --noEmit` exits 0
    - `cd frontend && npx vitest run src/signage/pages/DevicesPage` exits 0 (test file updates mock both queries)
    - `cd frontend && npx vitest run src/signage/components/DeviceEditDialog` exits 0 if test exists
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit && npx vitest run src/signage/pages/DevicesPage src/signage/components/DeviceEditDialog 2>&1 | tail -30</automated>
  </verify>
  <done>DevicesPage renders via useQuery + useQueries merge; SSE handler invalidates new namespaced keys; tests updated to mock the split data flow; tsc + vitest green</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Visual parity check for /signage/devices</name>
  <files>frontend/src/signage/pages/DevicesPage.tsx</files>
  <what-built>DevicesPage now fetches Directus rows + per-device resolved playlist via useQueries, then merges client-side. SSE handler invalidates the new namespaced cache keys. UI-SPEC §"Visual Parity Lock" requires byte-for-byte visual match with v1.21.</what-built>
  <action>
    Pause execution and present the how-to-verify checklist below to the user. Resume only on explicit approval signal. The executor MUST NOT proceed to Plan 70-05 / 70-06 dependencies until this checkpoint clears (this plan's wave-2 successors do not block on it, but the phase-level success criteria do).
  </action>
  <how-to-verify>
    1. Start the stack: `docker compose up -d` (or your usual dev workflow)
    2. Navigate to `https://localhost/signage/devices` (or local equivalent)
    3. With at least one paired device present:
       a. Confirm the 8-column table renders: Name | Status | Uptime 24h | Missed 24h | Tags | Playlist | Last seen | Actions
       b. Confirm device-name cell uses `font-semibold`
       c. Confirm DeviceStatusChip renders (green/amber/red dot)
       d. Confirm UptimeBadge + Missed badge render
       e. Confirm tag badges render with `variant="secondary"` and `text-xs`
       f. Confirm Playlist cell briefly shows `—` (em-dash) on first paint, then the resolved playlist name within ~500ms (no skeleton, no spinner, no layout shift)
       g. Confirm "Last seen" relative time renders muted
       h. Confirm Pencil + ShieldOff (red) icon buttons right-aligned
       i. Confirm "Pair new device" button right-aligned below table
    4. With ZERO devices: confirm empty state — bordered card, `p-12`, h2 "No devices yet", body "Pair a device to start displaying playlists.", primary "Pair device" button
    5. Click Pencil → DeviceEditDialog opens; rename device + change tags; save. Confirm:
       a. The list refreshes
       b. The Playlist cell updates if the new tags route to a different playlist
       c. No console errors about cache key mismatches
    6. Click ShieldOff → Revoke dialog opens; confirm. Confirm device row updates (status chip flips, or row removed if revoke triggers row removal — depends on existing behavior; should match v1.21)
    7. Open DevTools → Network tab. Confirm:
       a. ONE GET request to `/directus/items/signage_devices` (Directus list)
       b. N GET requests to `/api/signage/resolved/{id}` (one per device)
       c. ZERO requests to `/api/signage/devices` or `/api/signage/devices/{id}` (those routes are removed in Plan 70-02)
    8. Open another browser tab on /signage/playlists; rename a playlist used by a device. Within ~500ms, confirm the Devices tab's Playlist cell updates (SSE playlist-changed fan-out invalidates ['fastapi', 'resolved', ...])
  </how-to-verify>
  <verify>Manual UAT — user confirms all 8 checks pass</verify>
  <done>User types "approved"; visual parity confirmed against v1.21 with new data flow underneath</done>
  <resume-signal>Type "approved" if visual parity holds and all 8 checks pass; otherwise describe the regression (e.g. "tags column missing tag names" or "layout shift on resolved cell").</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- `vitest` passes for DevicesPage + DeviceEditDialog
- Manual UAT confirms visual parity with v1.21 (Task 2 checkpoint)
- DevTools Network tab shows only Directus + /resolved/* traffic (no migrated FastAPI device routes hit)
</verification>

<success_criteria>
- DevicesPage uses useQuery + useQueries + useMemo merge per D-02
- Cache keys namespaced per D-05; SSE handler invalidates them per D-05a
- v1.21 visual parity preserved (UI-SPEC §"Visual Parity Lock")
- Loading state for resolved cell is em-dash (no skeleton/spinner — UI-SPEC contract)
</success_criteria>

<output>
After completion, create `.planning/phases/70-mig-sign-devices/70-04-frontend-devices-page-merge-SUMMARY.md`
</output>
