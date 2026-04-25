---
phase: 70-mig-sign-devices
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/lib/signageApi.ts
autonomous: true
requirements: [MIG-SIGN-04]
must_haves:
  truths:
    - "signageApi.listDevices reads from Directus signage_devices (no /api/signage/devices fetch)"
    - "signageApi.getDevice reads from Directus by id"
    - "signageApi.updateDevice's name PATCH fires updateItem('signage_devices', ...)"
    - "signageApi.replaceDeviceTags performs FE-driven diff against signage_device_tag_map"
    - "signageApi.deleteDevice (NEW) calls deleteItem('signage_devices', id)"
    - "signageApi.getResolvedForDevice (NEW) calls /api/signage/resolved/{id}"
    - "signageApi.revokeDevice STAYS UNCHANGED — pair-router POST (not deleteItem)"
    - "signageApi.updateDeviceCalibration STAYS UNCHANGED"
    - "signageApi.listDeviceAnalytics STAYS UNCHANGED"
    - "Public function signatures unchanged (D-00g)"
  artifacts:
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "Device functions swapped to Directus SDK; new getResolvedForDevice + deleteDevice"
      contains: "readItems(\"signage_devices\""
  key_links:
    - from: "frontend/src/signage/lib/signageApi.ts"
      to: "Directus signage_devices collection"
      via: "directus.request(readItems('signage_devices', ...))"
      pattern: "signage_devices"
    - from: "frontend/src/signage/lib/signageApi.ts"
      to: "FastAPI /api/signage/resolved/{id}"
      via: "apiClient<...>('/api/signage/resolved/${id}')"
      pattern: "/api/signage/resolved/"
---

<objective>
Inline-swap device-row functions in `signageApi.ts` from FastAPI to Directus SDK while preserving public signatures (D-00g pattern from Phases 67/68/69). Add two NEW functions: `getResolvedForDevice(id)` (calls Plan 70-01's new endpoint) and `deleteDevice(id)` (Directus deleteItem). `revokeDevice` STAYS UNCHANGED — research confirmed it is a pair-router JWT-revocation flag, NOT a row deletion.

Purpose: Implements MIG-SIGN-04 frontend writer swap. `replaceDeviceTags` follows the Phase 69 D-02 `replacePlaylistTags` shape verbatim (D-03d) so Phase 71 FE-01 can extract a shared `replaceTagMap` util mechanically.

Output: `signageApi.ts` device functions move to Directus SDK; new resolved + delete functions added; revoke + calibration + analytics untouched.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/70-mig-sign-devices/70-CONTEXT.md
@.planning/phases/70-mig-sign-devices/70-RESEARCH.md
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/lib/signageTypes.ts
@backend/app/routers/signage_pair.py

<interfaces>
<!-- Public signatures (MUST NOT change — D-00g) -->
listDevices(): Promise<SignageDevice[]>
updateDevice(id: string, body: { name?: string; tag_ids?: number[] }): Promise<SignageDevice>
replaceDeviceTags(id: string, tag_ids: number[]): Promise<{ tag_ids: number[] }>
revokeDevice(id: string): Promise<null>          // UNCHANGED — POST /api/signage/pair/devices/{id}/revoke
updateDeviceCalibration(id, body): Promise<SignageDevice>  // UNCHANGED
listDeviceAnalytics(): Promise<SignageDeviceAnalytics[]>    // UNCHANGED

<!-- New public signatures -->
getDevice(id: string): Promise<SignageDevice>                              // NEW (was implicit via list)
getResolvedForDevice(id: string): Promise<{ current_playlist_id: string|null; current_playlist_name: string|null; tag_ids: number[]|null }>  // NEW
deleteDevice(id: string): Promise<null>          // NEW — Directus deleteItem (separate from revoke; UI only calls revoke today)

<!-- Phase 69 reference template (REUSE STRUCTURE — D-03d) -->
From frontend/src/signage/lib/signageApi.ts:241-276 (replacePlaylistTags):
```typescript
replacePlaylistTags: async (id: string, tag_ids: number[]) => {
  const existing = (await directus.request(
    readItems("signage_playlist_tag_map", {
      filter: { playlist_id: { _eq: id } },
      fields: ["tag_id"],
      limit: -1,
    }),
  )) as { tag_id: number }[];
  const existingTagIds = new Set(existing.map((r) => r.tag_id));
  const desiredTagIds = new Set(tag_ids);
  const toAdd = [...desiredTagIds].filter((t) => !existingTagIds.has(t));
  const toRemove = [...existingTagIds].filter((t) => !desiredTagIds.has(t));
  await Promise.all([
    toRemove.length > 0
      ? directus.request(deleteItems("signage_playlist_tag_map", {
          filter: { _and: [{ playlist_id: { _eq: id } }, { tag_id: { _in: toRemove } }] },
        }))
      : Promise.resolve(),
    toAdd.length > 0
      ? directus.request(createItems("signage_playlist_tag_map",
          toAdd.map((tagId) => ({ playlist_id: id, tag_id: tagId })),
        ))
      : Promise.resolve(),
  ]);
  return { tag_ids } as { tag_ids: number[] };
},
```

<!-- revokeDevice — DO NOT CHANGE -->
backend/app/routers/signage_pair.py:246-276 — POST /api/signage/pair/devices/{id}/revoke
This sets signage_devices.revoked_at = now() (idempotent JWT revocation flag), it does NOT delete the row. UI-SPEC's claim that revoke maps to deleteItem is WRONG — research Open Question 1 confirmed: revoke STAYS on FastAPI pair router. The new `deleteDevice` is a SEPARATE function (currently unused by any UI surface; provided for completeness/parity with Phase 68/69 swaps).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Swap device functions to Directus SDK + add resolved/delete</name>
  <files>frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (full file — 374 lines)
    - frontend/src/signage/lib/signageTypes.ts (SignageDevice shape — verify current_playlist_id/name/tag_ids fields exist)
    - .planning/phases/70-mig-sign-devices/70-CONTEXT.md (D-00g, D-03, D-03d, D-04, D-04a)
    - .planning/phases/70-mig-sign-devices/70-RESEARCH.md (Pattern 3 — REUSE Phase 69 verbatim shape; Pitfall 5 — composite-PK deleteItems filter form; Open Question 1 — revoke stays)
    - backend/app/routers/signage_pair.py (revoke_device — confirm it's a flag-flip, not a row-delete, so revokeDevice MUST stay unchanged)
  </read_first>
  <action>
    Edit `frontend/src/signage/lib/signageApi.ts`:

    **1. Add a `DEVICE_FIELDS` constant near the top of the file**, after the existing `PLAYLIST_FIELDS` block (~line 109):

    ```typescript
    // Phase 70-03: mirrors SignageDeviceRead minus computed fields
    // (current_playlist_id, current_playlist_name, tag_ids are populated
    // client-side via getResolvedForDevice — see DevicesPage useQueries merge).
    const DEVICE_FIELDS = [
      "id",
      "name",
      "created_at",
      "updated_at",
      "last_seen_at",
      "revoked_at",
      "rotation",
      "hdmi_mode",
      "audio_enabled",
    ] as const;
    ```

    Verify the `last_seen_at` field name matches signageTypes.ts `SignageDevice` exactly. If `SignageDevice` uses `last_heartbeat_at` instead, use that name. (Read signageTypes.ts to confirm before writing.)

    **2. REPLACE the existing `listDevices` line (~line 299):**

    From:
    ```typescript
    listDevices: () => apiClient<SignageDevice[]>("/api/signage/devices"),
    ```

    To:
    ```typescript
    // Phase 70-03 (D-00g, D-04): listDevices reads from Directus signage_devices.
    // current_playlist_id / current_playlist_name / tag_ids are populated
    // client-side by DevicesPage's useQueries merge against
    // getResolvedForDevice — they are computed fields with no Directus column
    // (D-04 / D-04a — no rename to resolved_*).
    listDevices: () =>
      directus.request(
        readItems("signage_devices", {
          fields: [...DEVICE_FIELDS],
          sort: ["created_at"],
          limit: -1,
        }),
      ) as Promise<SignageDevice[]>,
    ```

    **3. ADD `getDevice` immediately after `listDevices`:**

    ```typescript
    // Phase 70-03: per-device row read (matches old GET /api/signage/devices/{id}).
    getDevice: async (id: string) => {
      const rows = (await directus.request(
        readItems("signage_devices", {
          filter: { id: { _eq: id } },
          fields: [...DEVICE_FIELDS],
          limit: 1,
        }),
      )) as SignageDevice[];
      if (!rows.length) throw new Error(`Device ${id} not found`);
      return rows[0];
    },
    ```

    **4. ADD `getResolvedForDevice` immediately after `getDevice`:**

    ```typescript
    // Phase 70-03 (D-01, D-02): per-device resolved playlist + tag_ids from
    // FastAPI compute endpoint. Used by DevicesPage useQueries to merge with
    // Directus row data; field names align with SignageDevice extras so the
    // merge is `{...row, ...resolved}` with zero rename.
    getResolvedForDevice: (id: string) =>
      apiClient<{
        current_playlist_id: string | null;
        current_playlist_name: string | null;
        tag_ids: number[] | null;
      }>(`/api/signage/resolved/${id}`),
    ```

    **5. REPLACE the existing `updateDevice` block (~lines 305-314):**

    From the existing apiClient PATCH (which forwards `body.name` only and the consumer DeviceEditDialog calls replaceDeviceTags separately):

    To:
    ```typescript
    // Phase 70-03 (D-00g): updateDevice's name PATCH swaps to Directus
    // updateItem. Public signature unchanged: still accepts {name, tag_ids}
    // for ergonomic call sites (DeviceEditDialog), but only forwards `name`
    // here — the caller sequences this with replaceDeviceTags(id, tag_ids)
    // (research Open Question 2: keep PATCH-then-PUT sequenced).
    updateDevice: (id: string, body: { name?: string; tag_ids?: number[] }) =>
      directus.request(
        updateItem(
          "signage_devices",
          id,
          { name: body.name },
          { fields: [...DEVICE_FIELDS] },
        ),
      ) as Promise<SignageDevice>,
    ```

    **6. REPLACE the existing `replaceDeviceTags` block (~lines 315-319):**

    From the existing apiClient PUT to `/api/signage/devices/{id}/tags`:

    To (verbatim shape of `replacePlaylistTags` per D-03d, with collection + parent FK swapped):

    ```typescript
    // Phase 70-03 (D-03, D-03d): FE-driven diff against signage_device_tag_map.
    // IDENTICAL shape to replacePlaylistTags so Phase 71 FE-01 can extract a
    // shared replaceTagMap util mechanically. Composite PK (device_id, tag_id)
    // — deleteItems uses the query/filter form (Pitfall 5).
    // SSE: each map-row insert/delete fires `device-changed` per Phase 65
    // listener mapping (signage_pg_listen.py:86-88 — NOT playlist-changed,
    // research Pitfall 1 corrects CONTEXT D-03b). Multi-event tolerance
    // (D-03b — assert at-least-once, not exactly-once).
    replaceDeviceTags: async (id: string, tag_ids: number[]) => {
      const existing = (await directus.request(
        readItems("signage_device_tag_map", {
          filter: { device_id: { _eq: id } },
          fields: ["tag_id"],
          limit: -1,
        }),
      )) as { tag_id: number }[];
      const existingTagIds = new Set(existing.map((r) => r.tag_id));
      const desiredTagIds = new Set(tag_ids);
      const toAdd = [...desiredTagIds].filter((t) => !existingTagIds.has(t));
      const toRemove = [...existingTagIds].filter((t) => !desiredTagIds.has(t));
      await Promise.all([
        toRemove.length > 0
          ? directus.request(
              deleteItems("signage_device_tag_map", {
                filter: {
                  _and: [
                    { device_id: { _eq: id } },
                    { tag_id: { _in: toRemove } },
                  ],
                },
              }),
            )
          : Promise.resolve(),
        toAdd.length > 0
          ? directus.request(
              createItems(
                "signage_device_tag_map",
                toAdd.map((tagId) => ({ device_id: id, tag_id: tagId })),
              ),
            )
          : Promise.resolve(),
      ]);
      return { tag_ids } as { tag_ids: number[] };
    },
    ```

    **7. ADD `deleteDevice` immediately after `replaceDeviceTags`:**

    ```typescript
    // Phase 70-03: Directus DELETE on signage_devices. Currently no UI
    // consumer (the visible "Revoke" CTA flips revoked_at via the pair
    // router — see revokeDevice below). Provided for parity with the
    // migrated route surface and for any future hard-delete UI.
    deleteDevice: (id: string) =>
      directus.request(deleteItem("signage_devices", id)) as Promise<null>,
    ```

    **8. LEAVE UNCHANGED (do NOT modify):**
    - `updateDeviceCalibration` (~lines 325-336) — D-00j surviving FastAPI route
    - `listDeviceAnalytics` (~lines 303-304) — separate v1.22 lock
    - `revokeDevice` (~lines 339-342) — research Open Question 1: pair-router endpoint flips `revoked_at = now()` (idempotent JWT revocation), NOT a row deletion. The UI-SPEC's tentative remap to `deleteItem` is INCORRECT for behavior. revokeDevice STAYS as `apiClient<null>("/api/signage/pair/devices/${id}/revoke", { method: "POST" })`.
    - `claimPairingCode` (~lines 343-351) — pair-flow, untouched
  </action>
  <acceptance_criteria>
    - `grep -c "readItems(\"signage_devices\"" frontend/src/signage/lib/signageApi.ts` returns at least 2 (listDevices + getDevice)
    - `grep -c "updateItem(\"signage_devices\"" frontend/src/signage/lib/signageApi.ts` returns at least 1 (updateDevice)
    - `grep -c "deleteItem(\"signage_devices\"" frontend/src/signage/lib/signageApi.ts` returns 1 (deleteDevice)
    - `grep -c "readItems(\"signage_device_tag_map\"" frontend/src/signage/lib/signageApi.ts` returns 1 (replaceDeviceTags read-existing)
    - `grep -c "deleteItems(\"signage_device_tag_map\"" frontend/src/signage/lib/signageApi.ts` returns 1
    - `grep -c "createItems(\"signage_device_tag_map\"" frontend/src/signage/lib/signageApi.ts` returns 1
    - `grep -c "/api/signage/resolved/" frontend/src/signage/lib/signageApi.ts` returns 1 (getResolvedForDevice)
    - `grep -c "/api/signage/pair/devices/" frontend/src/signage/lib/signageApi.ts` returns 1 (revokeDevice — UNCHANGED, research Open Question 1)
    - `grep -c "/api/signage/devices/.*tags" frontend/src/signage/lib/signageApi.ts` returns 0 (PUT /tags route migrated)
    - `grep -c "apiClient.*api/signage/devices.*PATCH" frontend/src/signage/lib/signageApi.ts` returns 0 (name PATCH migrated; calibration PATCH lives in updateDeviceCalibration with `/{id}/calibration` suffix and is NOT matched by this regex)
    - `grep -c "/api/signage/devices/\\${id}/calibration" frontend/src/signage/lib/signageApi.ts` returns 1 (calibration UNCHANGED)
    - `grep -c "DEVICE_FIELDS" frontend/src/signage/lib/signageApi.ts` returns at least 4 (constant declaration + 3 usages: listDevices, getDevice, updateDevice)
    - `cd frontend && npx tsc --noEmit` exits 0
    - `cd frontend && npx vitest run src/signage/lib/signageApi` (if tests exist for this module — otherwise run full vitest with `--changed` flag) passes
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>Device row + tag-map functions migrated to Directus SDK; new getResolvedForDevice + getDevice + deleteDevice added; revokeDevice + updateDeviceCalibration + listDeviceAnalytics unchanged; TypeScript compiles cleanly</done>
</task>

</tasks>

<verification>
- All public signatures of swapped functions match v1.21 (consumers compile unchanged)
- replaceDeviceTags is structurally identical to replacePlaylistTags (Phase 71 mechanical extraction)
- revokeDevice unchanged (research Open Question 1)
</verification>

<success_criteria>
- `npx tsc --noEmit` passes
- vitest unit suite passes (no behavioral regression in signageApi callers)
- DeviceEditDialog (existing consumer) compiles without changes (D-00g signature stability)
</success_criteria>

<output>
After completion, create `.planning/phases/70-mig-sign-devices/70-03-frontend-signageapi-swap-SUMMARY.md`
</output>
