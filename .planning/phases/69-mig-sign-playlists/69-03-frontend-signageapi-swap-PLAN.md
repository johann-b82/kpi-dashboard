---
phase: 69-mig-sign-playlists
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/lib/signageApi.ts
autonomous: true
requirements: [MIG-SIGN-03]

must_haves:
  truths:
    - "signageApi.listPlaylists / getPlaylist / createPlaylist / updatePlaylist / replacePlaylistTags / listPlaylistItems route through Directus SDK directus.request(...) — no apiClient call against /api/signage/playlists* paths"
    - "Public function signatures of all 6 functions are unchanged — consumer files compile and run unchanged (D-00g)"
    - "deletePlaylist (apiClientWithBody) and bulkReplaceItems (apiClient) STILL call FastAPI — surviving routes preserved"
    - "replacePlaylistTags performs FE-driven diff against signage_playlist_tag_map (read existing → diff → parallel deleteItems + createItems) per D-02"
  artifacts:
    - path: "frontend/src/signage/lib/signageApi.ts"
      provides: "Inline-swapped playlist metadata + tags + items GET via Directus SDK"
      contains: "directus.request(readItems(\"signage_playlists\""
  key_links:
    - from: "signageApi.ts playlist functions"
      to: "Directus collections signage_playlists / signage_playlist_items / signage_playlist_tag_map"
      via: "directus.request(readItems/createItem/updateItem(...)) and FE-driven diff for tags"
      pattern: "directus\\.request\\((read|create|update|delete)Item"
---

<objective>
Inline-swap the playlist functions in `frontend/src/signage/lib/signageApi.ts` from `apiClient(...)` calls to Directus SDK `directus.request(...)` calls (D-07 / Phase 68 Plan 04 pattern). Public function signatures stay identical (D-00g) — consumers (PlaylistsPage, PlaylistEditDialog, etc.) do not change. Keep `deletePlaylist` and `bulkReplaceItems` pointing at FastAPI per D-00 architectural lock.

Purpose: MIG-SIGN-03 frontend leg. Implements D-01 (items GET fields allowlist), D-02 (tags PUT FE-driven diff), D-03 (namespaced React Query keys consumed downstream by callers — invalidation rules documented in CONTEXT but landed in consumer files in Phase 71 if not already in place).

Output: Single-file edit of `signageApi.ts`. No new modules, no consumer changes, no type changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/69-mig-sign-playlists/69-CONTEXT.md
@.planning/phases/68-mig-sign-tags-schedules/68-04-frontend-signageapi-swap-PLAN.md
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/lib/signageTypes.ts

<interfaces>
Canonical Directus client import path (D-00i, verified by Read on signageApi.ts:2):
```ts
import { directus } from "@/lib/directusClient";
import { readItems, createItem, updateItem, deleteItem } from "@directus/sdk";
```
(`createItems` and `deleteItems` plural variants are also needed for the tags diff — verify they are exported from `@directus/sdk` before importing; the SDK provides both `createItem` singular and `createItems` plural.)

Functions to SWAP (verified at signageApi.ts:113-170):
- `listPlaylists: () => apiClient<SignagePlaylist[]>("/api/signage/playlists")`
- `getPlaylist: (id) => apiClient<SignagePlaylist>(\`/api/signage/playlists/${id}\`)`
- `createPlaylist: (body) => apiClient<SignagePlaylist>("/api/signage/playlists", { POST })`
- `updatePlaylist: (id, body) => apiClient<SignagePlaylist>(\`/api/signage/playlists/${id}\`, { PATCH })`
- `replacePlaylistTags: (id, tag_ids) => apiClient<{tag_ids}>(\`/api/signage/playlists/${id}/tags\`, { PUT })`
- `listPlaylistItems: (id) => apiClient<SignagePlaylistItem[]>(\`/api/signage/playlists/${id}/items\`)`

Functions to PRESERVE unchanged (surviving FastAPI surface — D-00 lock):
- `deletePlaylist` — keeps `apiClientWithBody` for the structured 409 `{detail, schedule_ids}` shape consumed by `PlaylistDeleteDialog`.
- `bulkReplaceItems` — keeps `apiClient` PUT to `/api/signage/playlists/{id}/items`.

D-01 SignagePlaylistItem fields allowlist (mirrors backend `SignagePlaylistItemRead` at backend/app/schemas/signage.py:93 — VERIFY by reading; expected list per CONTEXT):
```ts
const PLAYLIST_ITEM_FIELDS = [
  "id", "playlist_id", "media_id", "position",
  "duration_s", "transition", "created_at", "updated_at",
] as const;
```
D-01a: Sort `signage_playlist_items` by `position` ascending — DO NOT drop the sort.

SignagePlaylist row type (signageTypes.ts:72) has fields: `id, name, description, enabled, priority, tag_ids, tags?, created_at, updated_at`. The `tag_ids` field is NOT a column on `signage_playlists`; it has historically been derived by the FastAPI route from `signage_playlist_tag_map`. Directus collection `signage_playlists` therefore will NOT return `tag_ids`. PLANNER NOTE for executor: if existing consumers depend on `playlist.tag_ids` being populated, the executor must either (a) fetch `signage_playlist_tag_map` separately and merge, or (b) confirm via consumer grep that `tag_ids` is no longer required after this swap. Action step below makes this concrete.

PLAYLIST_FIELDS allowlist for create/update/get/list (mirrors `SignagePlaylistRead` minus `tag_ids`):
```ts
const PLAYLIST_FIELDS = [
  "id", "name", "description", "priority", "enabled",
  "created_at", "updated_at",
] as const;
```

D-02 tags PUT diff strategy (FE-driven):
1. `readItems('signage_playlist_tag_map', { filter: { playlist_id: { _eq: playlistId } }, fields: ['id', 'tag_id'] })`.
2. Compute `toAdd = newTagIds - existingTagIds`, `toRemove = mapRowIds where tag_id in (existingTagIds - newTagIds)`.
3. Fire `deleteItems('signage_playlist_tag_map', toRemoveMapRowIds)` and `createItems('signage_playlist_tag_map', toAdd.map(tagId => ({ playlist_id, tag_id })))` in parallel via `Promise.all`.
4. Per D-00g, keep return type as `{ tag_ids: number[] }` (the new full set after diff).

D-02a: Concurrent (Promise.all) is recommended for latency. If Admin permission policy needs strict ordering (delete-first), fall back to sequential — verify by running the existing E2E or by inspecting Phase 65 bootstrap-roles.sh. CONTEXT recommends concurrent.

D-02b: Each map-row insert/delete fires a separate `playlist-changed` SSE event via Phase 65 trigger. Multi-row replace produces multiple events; FE already deduplicates via the existing player handler — no consumer change needed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Swap listPlaylists / getPlaylist / createPlaylist / updatePlaylist + listPlaylistItems to Directus SDK</name>
  <files>frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (lines 1-200, focus on lines 113-170)
    - frontend/src/signage/lib/signageTypes.ts (SignagePlaylist + SignagePlaylistItem interfaces)
    - backend/app/schemas/signage.py lines 53-99 (SignagePlaylistRead + SignagePlaylistItemRead — confirm field list)
    - .planning/phases/68-mig-sign-tags-schedules/68-04-frontend-signageapi-swap-PLAN.md (precedent: SCHEDULE_FIELDS allowlist + inline-swap pattern)
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-00g, D-00h, D-00i, D-01, D-01a)
  </read_first>
  <behavior>
    - listPlaylists() returns SignagePlaylist[] via Directus, sorted stably (default by id or name — match what existing FastAPI returned, default `name` ASC).
    - getPlaylist(id) returns single SignagePlaylist via Directus.
    - createPlaylist(body) returns SignagePlaylist via Directus; body shape unchanged ({name, description?, priority?, enabled?}).
    - updatePlaylist(id, body) PATCHes via Directus; body shape unchanged.
    - listPlaylistItems(id) returns SignagePlaylistItem[] sorted by `position` ASC, with the 8-field allowlist from D-01.
    - tag_ids handling: confirm by grep whether consumers read `playlist.tag_ids`. If yes, fetch tag-map alongside list/get and merge. If no, keep `tag_ids: null` in the returned shape (TS `SignagePlaylist.tag_ids: number[] | null` already permits null).
  </behavior>
  <action>
    1. At the top of `signageApi.ts`, ensure imports include `createItems` and `deleteItems` from `@directus/sdk` (currently only the singular forms are imported per Read of lines 1-8). Add them:
       ```ts
       import {
         readItems, createItem, updateItem, deleteItem,
         createItems, deleteItems,
       } from "@directus/sdk";
       ```
       Verify via `grep -n 'export.*createItems\|export.*deleteItems' node_modules/@directus/sdk/dist/index.d.ts` if any uncertainty (the SDK does export both).
    2. Add field allowlist constants near the existing SCHEDULE_FIELDS block (line 70 area):
       ```ts
       // Phase 69-03 (D-01): mirrors SignagePlaylistItemRead 8 fields.
       const PLAYLIST_ITEM_FIELDS = [
         "id", "playlist_id", "media_id", "position",
         "duration_s", "transition", "created_at", "updated_at",
       ] as const;

       // Phase 69-03: mirrors SignagePlaylistRead minus derived tag_ids.
       const PLAYLIST_FIELDS = [
         "id", "name", "description", "priority", "enabled",
         "created_at", "updated_at",
       ] as const;
       ```
    3. Determine tag_ids merge requirement: run `grep -rn "\.tag_ids" frontend/src/signage/` — for each consumer that reads `playlist.tag_ids` from a list/get response, decide:
       - Option A (preserve): inline-merge via a separate `readItems('signage_playlist_tag_map', ...)` call inside `listPlaylists` / `getPlaylist`.
       - Option B (drop): set `tag_ids: null` and rely on consumers calling `listPlaylistTagMap` separately (if such a function exists or needs adding).
       Prefer Option A for stability with current consumers (D-00g: signatures stable). Document the choice in SUMMARY.
    4. Replace `listPlaylists` (line 113):
       ```ts
       listPlaylists: async () => {
         const rows = (await directus.request(
           readItems("signage_playlists", {
             fields: [...PLAYLIST_FIELDS],
             sort: ["name"],
             limit: -1,
           }),
         )) as Omit<SignagePlaylist, "tag_ids" | "tags">[];
         // Option A: hydrate tag_ids per playlist via a single tag_map read.
         const map = (await directus.request(
           readItems("signage_playlist_tag_map", {
             fields: ["playlist_id", "tag_id"],
             limit: -1,
           }),
         )) as { playlist_id: string; tag_id: number }[];
         const byPid = new Map<string, number[]>();
         for (const m of map) {
           const arr = byPid.get(m.playlist_id) ?? [];
           arr.push(m.tag_id);
           byPid.set(m.playlist_id, arr);
         }
         return rows.map(r => ({ ...r, tag_ids: byPid.get(r.id) ?? [] })) as SignagePlaylist[];
       },
       ```
       (If Step 3 chose Option B, drop the second readItems call and return rows with `tag_ids: null`.)
    5. Replace `getPlaylist`:
       ```ts
       getPlaylist: async (id: string) => {
         const [row, tagRows] = await Promise.all([
           directus.request(
             // readItem singular — import if needed; or use readItems with filter+limit:1
             readItems("signage_playlists", {
               filter: { id: { _eq: id } },
               fields: [...PLAYLIST_FIELDS],
               limit: 1,
             }),
           ) as Promise<Omit<SignagePlaylist, "tag_ids" | "tags">[]>,
           directus.request(
             readItems("signage_playlist_tag_map", {
               filter: { playlist_id: { _eq: id } },
               fields: ["tag_id"],
               limit: -1,
             }),
           ) as Promise<{ tag_id: number }[]>,
         ]);
         if (!row.length) throw new Error(`Playlist ${id} not found`);
         return { ...row[0], tag_ids: tagRows.map(t => t.tag_id) } as SignagePlaylist;
       },
       ```
    6. Replace `createPlaylist`:
       ```ts
       createPlaylist: (body: {
         name: string;
         description?: string | null;
         priority?: number;
         enabled?: boolean;
       }) =>
         directus.request(
           createItem("signage_playlists", body, { fields: [...PLAYLIST_FIELDS] }),
         ) as Promise<SignagePlaylist>,
       ```
    7. Replace `updatePlaylist`:
       ```ts
       updatePlaylist: (
         id: string,
         body: { name?: string; description?: string | null; priority?: number; enabled?: boolean },
       ) =>
         directus.request(
           updateItem("signage_playlists", id, body, { fields: [...PLAYLIST_FIELDS] }),
         ) as Promise<SignagePlaylist>,
       ```
    8. Replace `listPlaylistItems` (D-01 + D-01a):
       ```ts
       listPlaylistItems: (id: string) =>
         directus.request(
           readItems("signage_playlist_items", {
             filter: { playlist_id: { _eq: id } },
             fields: [...PLAYLIST_ITEM_FIELDS],
             sort: ["position"],
             limit: -1,
           }),
         ) as Promise<SignagePlaylistItem[]>,
       ```
    9. PRESERVE `deletePlaylist` and `bulkReplaceItems` exactly — those are surviving FastAPI calls (D-00 architectural lock).
    10. Run `cd frontend && npx tsc --noEmit` — must exit 0.
    11. Run `cd frontend && npm test -- --run signage` — existing playlist-related tests must still pass (consumers mock `signageApi`; signatures are stable).
  </action>
  <verify>
    <automated>cd frontend && grep -nE "apiClient.*\"/api/signage/playlists\"" src/signage/lib/signageApi.ts && exit 1 || true; grep -nE "apiClient.*\`/api/signage/playlists/\\$\\{" src/signage/lib/signageApi.ts | grep -v "items\|tags" && exit 1 || true; grep -n "readItems(\"signage_playlists\"" src/signage/lib/signageApi.ts && grep -n "readItems(\"signage_playlist_items\"" src/signage/lib/signageApi.ts && grep -n "createItem(\"signage_playlists\"" src/signage/lib/signageApi.ts && grep -n "updateItem(\"signage_playlists\"" src/signage/lib/signageApi.ts && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "apiClient<.*>\\(\"/api/signage/playlists\"" frontend/src/signage/lib/signageApi.ts` returns 0 matches (listPlaylists swapped).
    - `grep -nE "apiClient.*\\\`/api/signage/playlists/\\$\\{id\\}\\\`" frontend/src/signage/lib/signageApi.ts` returns at most 1 match — that one being inside `deletePlaylist` (`apiClientWithBody`, NOT plain `apiClient`).
    - `grep -n "readItems(\"signage_playlists\"" frontend/src/signage/lib/signageApi.ts` returns at least 2 matches (listPlaylists + getPlaylist).
    - `grep -n "readItems(\"signage_playlist_items\"" frontend/src/signage/lib/signageApi.ts` returns 1 match (listPlaylistItems).
    - `grep -n "readItems(\"signage_playlist_tag_map\"" frontend/src/signage/lib/signageApi.ts` returns at least 1 match (Option A merge or Step 9 below).
    - `grep -n "createItem(\"signage_playlists\"" frontend/src/signage/lib/signageApi.ts` returns 1 match.
    - `grep -n "updateItem(\"signage_playlists\"" frontend/src/signage/lib/signageApi.ts` returns 1 match.
    - `grep -n "apiClientWithBody.*/api/signage/playlists" frontend/src/signage/lib/signageApi.ts` returns at least 1 match (deletePlaylist preserved).
    - `grep -nE "apiClient<.*>\\(\\\`/api/signage/playlists/\\$\\{id\\}/items\\\`" frontend/src/signage/lib/signageApi.ts` returns 1 match (bulkReplaceItems PUT preserved — this is the only surviving plain-apiClient playlist call).
    - `cd frontend && npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <done>5 metadata + items-GET functions swapped to Directus SDK; deletePlaylist + bulkReplaceItems preserved; types compile; consumer tests still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Swap replacePlaylistTags to FE-driven diff against signage_playlist_tag_map (D-02)</name>
  <files>frontend/src/signage/lib/signageApi.ts</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (Task 1 result)
    - .planning/phases/69-mig-sign-playlists/69-CONTEXT.md (D-02, D-02a, D-02b)
    - directus/snapshots/v1.22.yaml (signage_playlist_tag_map collection definition; verify column names `playlist_id` + `tag_id`)
  </read_first>
  <behavior>
    - replacePlaylistTags(id, tag_ids) reads existing rows from signage_playlist_tag_map, computes diff, fires parallel deleteItems + createItems via Promise.all, returns `{ tag_ids: number[] }` matching the new desired set.
    - Concurrent (Promise.all) execution; sequential fallback ONLY if a 4xx surfaces in smoke testing (document in SUMMARY).
    - Each map-row mutation fires a `playlist-changed` SSE via Phase 65 trigger; FE deduplicates downstream (no consumer change needed).
  </behavior>
  <action>
    1. Replace `replacePlaylistTags` (line 162 area) with:
       ```ts
       replacePlaylistTags: async (id: string, tag_ids: number[]) => {
         // 1) Read existing map rows for this playlist.
         const existing = (await directus.request(
           readItems("signage_playlist_tag_map", {
             filter: { playlist_id: { _eq: id } },
             fields: ["id", "tag_id"],
             limit: -1,
           }),
         )) as { id: number | string; tag_id: number }[];
         const existingTagIds = new Set(existing.map(r => r.tag_id));
         const desiredTagIds = new Set(tag_ids);
         // 2) Compute diff.
         const toAdd = [...desiredTagIds].filter(t => !existingTagIds.has(t));
         const toRemoveRowIds = existing
           .filter(r => !desiredTagIds.has(r.tag_id))
           .map(r => r.id);
         // 3) Parallel fire (D-02a: concurrent for latency).
         await Promise.all([
           toRemoveRowIds.length > 0
             ? directus.request(deleteItems("signage_playlist_tag_map", toRemoveRowIds))
             : Promise.resolve(),
           toAdd.length > 0
             ? directus.request(
                 createItems(
                   "signage_playlist_tag_map",
                   toAdd.map(tagId => ({ playlist_id: id, tag_id: tagId })),
                 ),
               )
             : Promise.resolve(),
         ]);
         // 4) Return shape unchanged (D-00g): the new full set.
         return { tag_ids } as { tag_ids: number[] };
       },
       ```
    2. NOTE for executor: this implementation is structured so the body can be lifted to a shared `replaceTagMap(collection, parentColumn, parentId, tagIds)` util in Phase 71 (per CONTEXT specifics — same shape will be reused for `replaceDeviceTags` in Phase 70). Do NOT extract the helper now; keep it inline in this phase.
    3. Run `cd frontend && npx tsc --noEmit` and `cd frontend && npm test -- --run signage` (must still pass).
  </action>
  <verify>
    <automated>cd frontend && grep -nE "apiClient.*\\\`/api/signage/playlists/\\$\\{id\\}/tags\\\`" src/signage/lib/signageApi.ts && exit 1 || true; grep -n "deleteItems(\"signage_playlist_tag_map\"" src/signage/lib/signageApi.ts && grep -n "createItems(\"signage_playlist_tag_map\"" src/signage/lib/signageApi.ts && grep -n "Promise.all" src/signage/lib/signageApi.ts && npx tsc --noEmit && npm test -- --run signage</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "apiClient.*\\\`/api/signage/playlists/\\$\\{[^}]+\\}/tags\\\`" frontend/src/signage/lib/signageApi.ts` returns 0 matches (FastAPI tags PUT path gone).
    - `grep -n "deleteItems(\"signage_playlist_tag_map\"" frontend/src/signage/lib/signageApi.ts` returns 1 match.
    - `grep -n "createItems(\"signage_playlist_tag_map\"" frontend/src/signage/lib/signageApi.ts` returns 1 match.
    - `grep -n "Promise.all" frontend/src/signage/lib/signageApi.ts` returns at least 1 match (concurrent diff fire per D-02a).
    - `cd frontend && npx tsc --noEmit` exits 0.
    - `cd frontend && npm test -- --run signage` exits 0.
  </acceptance_criteria>
  <done>Tags PUT replaced by FE-driven diff via Directus SDK; concurrent fire; signature preserved.</done>
</task>

</tasks>

<verification>
- `grep -nE "apiClient<.*>\\(\"/api/signage/playlists\"" frontend/src/signage/lib/signageApi.ts` exits 1 (no matches).
- `grep -nE "apiClient.*\\\`/api/signage/playlists/\\$\\{id\\}/tags\\\`" frontend/src/signage/lib/signageApi.ts` exits 1 (no matches).
- `cd frontend && npx tsc --noEmit` exits 0.
- `cd frontend && npm test -- --run signage` exits 0.
- `deletePlaylist` (apiClientWithBody) and `bulkReplaceItems` (apiClient PUT) still present in the file (surviving FastAPI surface).
</verification>

<success_criteria>
6 public functions (listPlaylists, getPlaylist, createPlaylist, updatePlaylist, replacePlaylistTags, listPlaylistItems) routed through Directus SDK with stable signatures. Consumer code unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/69-mig-sign-playlists/69-03-SUMMARY.md` listing: which functions were swapped, tag_ids merge approach (Option A or B), diff strategy outcome (concurrent vs sequential), consumer test results.
</output>
