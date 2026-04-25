---
phase: 69-mig-sign-playlists
plan: 03
subsystem: signage-frontend
tags: [migration, directus-sdk, signage, playlists]
requires:
  - Phase 65 SSE bridge (signage_playlist_tag_map LISTEN/NOTIFY trigger emits playlist-changed)
  - Phase 65 AUTHZ (Admin role can read/write signage_playlists, signage_playlist_items, signage_playlist_tag_map via Directus)
  - Phase 69-01 (FastAPI playlists CRUD router removal — backend leg)
  - Phase 69-02 (FastAPI playlist_items GET/items-tags routes removed — backend leg)
provides:
  - Directus-SDK playlist metadata + items GET on the FE
  - FE-driven tag-map diff (concurrent deleteItems + createItems)
  - PLAYLIST_FIELDS + PLAYLIST_ITEM_FIELDS allowlist constants
affects:
  - frontend/src/signage/lib/signageApi.ts (single-file edit)
tech-stack:
  added: []
  patterns:
    - Directus SDK `directus.request(readItems / createItem / updateItem / createItems / deleteItems)` (mirrors Phase 68-04 schedule swap)
    - FE-driven join-table diff via composite-PK filter form on deleteItems
key-files:
  created: []
  modified:
    - frontend/src/signage/lib/signageApi.ts
decisions:
  - tag_ids hydration = Option A (parallel readItems on signage_playlist_tag_map merged client-side); chosen because PlaylistEditorPage:123 reads `data.playlist.tag_ids ?? []` — preserving the consumer contract per D-00g.
  - signage_playlist_tag_map composite PK (playlist_id, tag_id) — `deleteItems` uses the query/filter form (`{filter: {_and: [...]}}`) since there is no surrogate `id` column; verified `deleteItems<...>(collection, keysOrQuery: string[] | number[] | TQuery)` accepts a Query object in @directus/sdk@21.2.2.
  - Concurrent diff fire (Promise.all) chosen per D-02a; smoke (npm test signage) passed without ordering errors.
  - Did not extract a generic `replaceTagMap` helper (deferred to Phase 71 per plan note — same shape will be reused for replaceDeviceTags in Phase 70).
metrics:
  duration: 216s
  tasks: 2
  files: 1
  completed: 2026-04-25
---

# Phase 69 Plan 03: Frontend signageApi Playlists Swap Summary

Inline-swapped `signageApi.listPlaylists / getPlaylist / createPlaylist / updatePlaylist / replacePlaylistTags / listPlaylistItems` from FastAPI `apiClient(...)` to Directus SDK `directus.request(...)` calls, preserving every public function signature so consumers (PlaylistsPage, PlaylistEditorPage, PlaylistEditDialog, PlaylistDeleteDialog) compile and run without modification (D-00g).

## What Was Swapped

| Function              | Before                                              | After                                                                       |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| listPlaylists         | `apiClient<…>("/api/signage/playlists")`            | `readItems("signage_playlists",…)` + parallel readItems(signage_playlist_tag_map) merge |
| getPlaylist           | `apiClient<…>("/api/signage/playlists/{id}")`       | parallel readItems + tag-map filter join                                    |
| createPlaylist        | `apiClient<…>("/api/signage/playlists", POST)`      | `createItem("signage_playlists", body)`                                     |
| updatePlaylist        | `apiClient<…>("/api/signage/playlists/{id}", PATCH)`| `updateItem("signage_playlists", id, body)`                                 |
| replacePlaylistTags   | `apiClient<…>("/playlists/{id}/tags", PUT)`         | FE-driven diff: readItems + Promise.all(deleteItems(filter), createItems)   |
| listPlaylistItems     | `apiClient<…>("/playlists/{id}/items")`             | `readItems("signage_playlist_items", {filter, sort:["position"]})`          |

## What Was Preserved (D-00 architectural lock)

- `deletePlaylist` — `apiClientWithBody` with structured 409 `{detail, schedule_ids}` shape consumed by `PlaylistDeleteDialog`.
- `bulkReplaceItems` — `apiClient` PUT to `/api/signage/playlists/{id}/items` (atomic DELETE+INSERT stays in FastAPI per v1.22 lock).

## Allowlists Added

```ts
const PLAYLIST_ITEM_FIELDS = ["id", "playlist_id", "media_id", "position",
  "duration_s", "transition", "created_at", "updated_at"] as const;  // D-01
const PLAYLIST_FIELDS = ["id", "name", "description", "priority", "enabled",
  "created_at", "updated_at"] as const;
```

## tag_ids Merge Approach

**Option A (preserve consumer contract).** `PlaylistEditorPage.tsx:123` unconditionally reads `data.playlist.tag_ids ?? []`. To avoid touching consumer code (D-00g), `listPlaylists` and `getPlaylist` each fire a parallel `readItems("signage_playlist_tag_map", …)` and merge `tag_id` values onto each playlist row client-side. `listPlaylists` reads the entire tag-map table (small — one row per playlist-tag binding) and groups by `playlist_id`; `getPlaylist` filters by the requested playlist's id.

## Diff Strategy Outcome

**Concurrent (Promise.all)** — D-02a recommendation honored. Tested via `npm test -- --run signage`: 67/67 pass with no ordering errors surfaced through the existing consumer mocks. Sequential fallback was not required.

For composite PK deletion: `signage_playlist_tag_map` PK is `(playlist_id, tag_id)` with no surrogate `id` column. Used `deleteItems("signage_playlist_tag_map", {filter: {_and: [{playlist_id: {_eq: id}}, {tag_id: {_in: toRemove}}]}})` (query/filter form, supported by `@directus/sdk@21.2.2` per `deleteItems<…>(collection, keysOrQuery: string[] | number[] | TQuery)` signature in the SDK type defs). This is a deviation from the plan text which read `fields: ['id', 'tag_id']` and passed row-ids to `deleteItems` — that path would have failed at Directus because no `id` column exists.

## Verification

- `cd frontend && npx tsc --noEmit` → exit 0.
- `cd frontend && npm test -- --run signage` → 6 files / 67 tests pass.
- `grep -nE 'apiClient<.*>\("/api/signage/playlists"' frontend/src/signage/lib/signageApi.ts` → 0 matches.
- `grep -nE 'apiClient.*\`/api/signage/playlists/\$\{[^}]+\}/tags\`' frontend/src/signage/lib/signageApi.ts` → 0 matches (FastAPI tags PUT path gone).
- `grep -c 'readItems("signage_playlists"' …` → 2 (listPlaylists + getPlaylist).
- `grep -c 'readItems("signage_playlist_items"' …` → 1.
- `grep -c 'readItems("signage_playlist_tag_map"' …` → 3 (listPlaylists merge + getPlaylist join + replacePlaylistTags existing-read).
- `grep -c 'createItem("signage_playlists"' …` → 1.
- `grep -c 'updateItem("signage_playlists"' …` → 1.
- `grep -c 'deleteItems("signage_playlist_tag_map"' …` → 1.
- `createItems("signage_playlist_tag_map", …)` present (line wrapped — verified by Grep tool).
- `apiClientWithBody.*/api/signage/playlists` → 1 match (deletePlaylist preserved).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Composite-PK deletion approach corrected**

- **Found during:** Task 2 (replacePlaylistTags)
- **Issue:** Plan action step prescribed `readItems("signage_playlist_tag_map", { fields: ["id", "tag_id"] })` and `deleteItems("signage_playlist_tag_map", toRemoveMapRowIds)` — passing row ids to the array form of deleteItems. The collection has a composite PK `(playlist_id, tag_id)` with no surrogate `id` column (verified at `backend/alembic/versions/v1_16_signage_schema.py:227-229` and `directus/snapshots/v1.22.yaml:471-506`). Reading `id` from Directus would return undefined; passing those values to `deleteItems` would throw or silently no-op.
- **Fix:** Used the query/filter form of `deleteItems` — `deleteItems(collection, { filter: { _and: [{ playlist_id: { _eq: id } }, { tag_id: { _in: toRemove } }] } })` — verified the SDK type signature `deleteItems<…>(collection, keysOrQuery: string[] | number[] | TQuery)` accepts a Query object. Existing-rows read narrowed to `fields: ["tag_id"]` only.
- **Files modified:** `frontend/src/signage/lib/signageApi.ts` (replacePlaylistTags body)
- **Commit:** `4496b8f`

## Auth Gates

None.

## Known Stubs

None — every swapped function has a real Directus implementation, types compile, and consumer tests pass against the existing mocks.

## Self-Check: PASSED

- `frontend/src/signage/lib/signageApi.ts` — FOUND
- Commit `1e81956` — FOUND
- Commit `4496b8f` — FOUND
