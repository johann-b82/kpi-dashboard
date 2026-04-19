---
phase: 46-admin-ui
plan: 05
subsystem: ui
tags: [signage, playlists, dnd-kit, react-hook-form, dirty-guard, wysiwyg]
requires:
  - phase: 46-admin-ui
    provides: signageKeys, signage.admin.* i18n keys, AdminOnly route wrapping
  - phase: 46-admin-ui (46-02)
    provides: signageApi, ApiErrorWithBody, TagPicker, signageTypes
  - phase: 46-admin-ui (46-03)
    provides: PlayerRenderer, PlayerItem types
  - phase: 46-admin-ui (46-06 — parallel wave 2)
    provides: UnsavedChangesDialog (signage-local; this plan evolved it to use signage.admin.unsaved.* keys while preserving 46-06 onStay/onDiscardAndLeave API)
provides:
  - Full /signage/playlists list table (Edit/Duplicate/Delete + new CTA + empty state)
  - Full /signage/playlists/:id editor (split pane, drag-reorder, live preview, dirty guard)
  - Reusable PlaylistItemList (@dnd-kit sortable with PointerSensor + KeyboardSensor)
  - Reusable MediaPickerDialog (filtered grid)
  - PlaylistNewDialog (name-only create → editor redirect)
  - signageApi.{createPlaylist,updatePlaylist,deletePlaylist,replacePlaylistTags,listPlaylistItems,bulkReplaceItems}
affects:
  - frontend/src/signage/lib/signageApi.ts (extended with playlist mutations)
  - frontend/src/signage/lib/signageTypes.ts (added description + tag_ids fields)
  - frontend/src/App.tsx (registered /signage/playlists/:id route ABOVE /signage/playlists — Pitfall 1)
  - frontend/src/signage/components/UnsavedChangesDialog.tsx (now uses signage.admin.unsaved.*; dual API)
tech-stack:
  added: []
  patterns:
    - "useWatch + useMemo to derive PlayerItem[] from form state (Pitfall 9 — preview NEVER reads server state)"
    - "Drag listeners spread ONLY on dedicated <GripVertical> button (Pitfall 5)"
    - "useUnsavedGuard scopePath = exact editor path (Pitfall 2); '__back__' sentinel + history.go(-2) on confirm"
    - "Sequenced save: PATCH name → PUT tags → PUT bulk-replace items (single mutation; create-on-submit for unknown tags)"
key-files:
  created:
    - frontend/src/signage/components/PlaylistNewDialog.tsx
    - frontend/src/signage/components/PlaylistItemList.tsx
    - frontend/src/signage/components/MediaPickerDialog.tsx
    - frontend/src/signage/pages/PlaylistEditorPage.tsx
  modified:
    - frontend/src/signage/lib/signageApi.ts
    - frontend/src/signage/lib/signageTypes.ts
    - frontend/src/signage/pages/PlaylistsPage.tsx (replaced stub)
    - frontend/src/signage/components/UnsavedChangesDialog.tsx
    - frontend/src/App.tsx (via 46-06 commit; see below)
decisions:
  - "Backend uses PATCH (not PUT) for /playlists/{id} and the request schema accepts only {name,description,priority,enabled} — tag_ids are routed via the separate PUT /playlists/{id}/tags endpoint. The plan said PUT for both; reality is PATCH+separate-tags. signageApi documents this in a header comment so future callers don't get bitten."
  - "createPlaylist body excludes tag_ids server-side (router does payload.model_dump(exclude={\"tag_ids\"})), so PlaylistNewDialog only collects name; tag assignment happens in the editor (consistent with the spec but worth noting)."
  - "GET /playlists/{id} returns SignagePlaylistRead — does NOT embed items. listPlaylistItems is the authoritative source; the editor fetches both in parallel inside one useQuery."
  - "GET /playlists list response does NOT include tag objects or item counts. PlaylistsPage shows Name/Created/Actions only — items count column omitted (logged as future enhancement to add a `_count` field on the list endpoint)."
  - "Duplicate clones name+description+priority+enabled but NOT items (plan documents this simplification; the admin opens the duplicate in the editor and can paste items there). This matches D-15 'simplicity over feature creep' for v1.16."
  - "UnsavedChangesDialog evolved to use signage.admin.unsaved.* keys (per acceptance criteria). The 46-06 onStay/onDiscardAndLeave API is preserved alongside the new onConfirm shape so DeviceEditDialog still compiles."
  - "Preview uses VITE_DIRECTUS_URL/assets/{directus_file_id} for image/video; html pulled from media.metadata.html when present; pptx uses media.slide_paths verbatim. Items whose media_id is missing from the media lookup are silently skipped from the preview (e.g. mid-edit before refetch)."
metrics:
  duration_seconds: 516
  duration: ~9m
  tasks_completed: 3
  files_created: 4
  files_modified: 4
  completed_date: "2026-04-19"
requirements_completed: [SGN-ADM-05, SGN-ADM-09, SGN-DIFF-02]
---

# Phase 46 Plan 46-05: Playlist Editor Summary

**One-liner:** Full /signage/playlists list table + full-width split-pane editor at /signage/playlists/:id with @dnd-kit drag-reorder (mouse + keyboard), live WYSIWYG preview via PlayerRenderer reading form state, sequenced save (PATCH name + PUT tags + PUT bulk-replace items) with create-on-submit tag resolution, and useUnsavedGuard-backed dirty intercept on navigate-away.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | signageApi extensions, /:id route, PlaylistsPage, dialogs | `d69cead` (and `5780c41` for App.tsx/signageApi.ts via parallel coalesce — see below) | 4 changed in this commit, 3 more landed in the parallel 46-06 commit |
| 2 | PlaylistItemList (@dnd-kit) + MediaPickerDialog | `38cd026` | 2 created |
| 3 | PlaylistEditorPage (split pane + dirty guard + bulk save) | `d3b5fde` | 1 (placeholder→full) |

### Parallel-execution note on Task 1

This plan ran in parallel with 46-06 in wave 2. Both plans needed to extend `signageApi.ts`, edit `App.tsx`, and create `signage/components/UnsavedChangesDialog.tsx`. 46-06's executor committed first (commit `5780c41` at 23:02:42); when this plan's `git add` ran one minute later, the working-tree edits to App.tsx + signageApi.ts + UnsavedChangesDialog had been swept into 46-06's commit retroactively (file content matches HEAD, so `git status` showed clean). Net effect: every required line is in `git log` — just attributed across two commits instead of one. Verified via `git show 5780c41:frontend/src/App.tsx` (PlaylistEditorPage import + /:id route present) and the live signageApi.ts on disk (createPlaylist/bulkReplaceItems/etc. all present and committed).

## What Was Built

### Task 1 — Foundations
- **signageApi extensions** (documented contract differences vs. plan):
  - `createPlaylist(body)` POST; tag_ids ignored server-side (must use replacePlaylistTags after).
  - `updatePlaylist(id, body)` **PATCH** (NOT PUT); accepts {name, description, priority, enabled}.
  - `deletePlaylist(id)` DELETE.
  - `replacePlaylistTags(id, tag_ids)` PUT /playlists/{id}/tags — atomic bulk replace.
  - `listPlaylistItems(id)` GET /playlists/{id}/items — authoritative for editor hydration.
  - `bulkReplaceItems(id, items)` PUT /playlists/{id}/items.
- **App.tsx route**: `/signage/playlists/:id` inserted ABOVE `/signage/playlists` (Pitfall 1 verified by ordering in source).
- **PlaylistsPage**: Table with Name/Created/Actions (Edit→navigate, Duplicate→createPlaylist clone, Delete→confirm dialog→deletePlaylist). Empty state with CTA.
- **PlaylistNewDialog**: Single name field; submits createPlaylist then redirects to `/signage/playlists/{created.id}`.
- **UnsavedChangesDialog**: Updated to use signage.admin.unsaved.* keys; preserves DeviceEditDialog's onStay/onDiscardAndLeave shape via dual API.
- **signageTypes**: Added `description: string | null` and `tag_ids: number[] | null` to SignagePlaylist.

### Task 2 — Sortable list + media picker
- **PlaylistItemList**: DndContext + SortableContext + verticalListSortingStrategy with **PointerSensor + KeyboardSensor + sortableKeyboardCoordinates** (Pitfall 4 keyboard a11y). Each row: drag handle (GripVertical, only place with `{...listeners}` — Pitfall 5), 40x40 thumbnail (image/video preview from /assets/{directus_file_id}, kind label otherwise), truncated title, duration_s number input (1–3600), transition `<select>` (fade/cut), remove button. arrayMove on dragEnd.
- **MediaPickerDialog**: Reuses cached signageKeys.media() so re-opens are instant. Client-side title filter. Grid `grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto` of clickable cards. onPick fires + closes.

### Task 3 — Editor page
- **PlaylistEditorPage**: useParams from wouter, parallel fetch of {playlist, items, media, tags} via single useQuery on signageKeys.playlistItem(id).
- Form state via react-hook-form; `useWatch({ name: "items" })` drives `previewItems` derivation (Pitfall 9 honored — preview reads form state, NEVER server state).
- `previewItems = items.map(joinWithMediaLookup)` → array of `PlayerItem[]` for `<PlayerRenderer>`. Items missing from the lookup are silently skipped.
- Layout: header with name `<input>` + TagPicker + Discard/Save; split `grid lg:grid-cols-5 gap-6`: left pane `lg:col-span-2` (item list + Add CTA), right pane `lg:col-span-3` (aspect-video preview + label).
- Save: sequenced PATCH name → PUT tags (create-on-submit for unknown names via signageApi.createTag) → PUT bulk-replace items (positions reassigned by index). On success: invalidate playlists + playlistItem + tags query keys; toast saved; `form.reset(form.getValues())` to clear dirty without losing values.
- Dirty guard: `useUnsavedGuard(isDirty, handler, '/signage/playlists/${id}')`. pendingNav state captures the intended destination; `UnsavedChangesDialog` confirms; on confirm, `'__back__'` sentinel triggers `history.go(-2)` to undo the guard's pushState before replaying.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit -p tsconfig.app.json` (signage scope) | Clean (0 errors in src/signage/**) |
| `node --experimental-strip-types scripts/check-locale-parity.mts` | `PARITY OK: 407 keys` |
| `node scripts/check-signage-invariants.mjs` | `SIGNAGE INVARIANTS OK: 25 files scanned` |
| Route order: `/signage/playlists/:id` BEFORE `/signage/playlists` | Verified in App.tsx (lines 52 and 56 respectively) |
| `grep -c bulkReplaceItems signageApi.ts` | 2 (definition + body path) |
| `grep -c createPlaylist signageApi.ts` | 1 |
| `grep -c updatePlaylist signageApi.ts` | 1 |
| `grep -c deletePlaylist signageApi.ts` | 1 |
| `grep -c "path=\"/signage/playlists/:id\"" App.tsx` | 1 |
| `grep -c signage.admin.unsaved.title UnsavedChangesDialog.tsx` | 1 |
| `grep -c signage.admin.unsaved.confirm UnsavedChangesDialog.tsx` | 1 |
| `grep -c signage.admin.unsaved.body UnsavedChangesDialog.tsx` | 1 |
| `grep -c signageApi.createPlaylist PlaylistNewDialog.tsx` | 1 |
| `grep -c signageApi.listPlaylists PlaylistsPage.tsx` | 1 |
| `grep -c signageApi.deletePlaylist PlaylistsPage.tsx` | 1 |
| `grep -c KeyboardSensor PlaylistItemList.tsx` | 2 (import + useSensor) |
| `grep -c PointerSensor PlaylistItemList.tsx` | 2 |
| `grep -c sortableKeyboardCoordinates PlaylistItemList.tsx` | 2 |
| `grep -c arrayMove PlaylistItemList.tsx` | 2 (import + usage) |
| `grep -c GripVertical PlaylistItemList.tsx` | 2 (import + render) |
| `grep -c "aria-roledescription=\"drag handle\"" PlaylistItemList.tsx` | 1 |
| `{...listeners}` count in PlaylistItemList.tsx | 1 (only on the GripVertical handle button — Pitfall 5) |
| `grep -c useUnsavedGuard PlaylistEditorPage.tsx` | 2 (import + call) |
| `grep -c useWatch PlaylistEditorPage.tsx` | 2 (import + call) — Pitfall 9 honored |
| `grep -c "<PlayerRenderer" PlaylistEditorPage.tsx` | 1 |
| `grep -c PlaylistItemList PlaylistEditorPage.tsx` | 2 (import + render) |
| `grep -c signageApi.bulkReplaceItems PlaylistEditorPage.tsx` | 1 |
| `grep -c signageApi.updatePlaylist PlaylistEditorPage.tsx` | 1 |
| `grep -c signageApi.createTag PlaylistEditorPage.tsx` | 1 (create-on-submit per D-15) |
| `grep -c lg:col-span PlaylistEditorPage.tsx` | 2 (split layout) |
| `dark:` variants in created/modified files | 0 |
| Direct `fetch(` in created files | 0 (all I/O via signageApi) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Backend contract mismatch: PATCH not PUT for updatePlaylist**

- **Found during:** Task 1 read of `backend/app/routers/signage_admin/playlists.py`
- **Issue:** Plan specified PUT for /playlists/{id}; backend exposes PATCH. Plan also said body accepts tag_ids; backend's SignagePlaylistUpdate schema does NOT include tag_ids — they go through the separate PUT /playlists/{id}/tags endpoint.
- **Fix:** signageApi.updatePlaylist uses PATCH; tags routed through new signageApi.replacePlaylistTags (PUT /tags). PlaylistEditorPage save sequences PATCH-name → PUT-tags → PUT-items.
- **Files:** `frontend/src/signage/lib/signageApi.ts`, `frontend/src/signage/pages/PlaylistEditorPage.tsx`
- **Commits:** `d69cead` (signageApi via parallel coalesce in 5780c41), `d3b5fde` (editor)

**2. [Rule 3 — Blocking] createPlaylist ignores tag_ids server-side**

- **Found during:** Task 1 read of router source — `payload.model_dump(exclude={"tag_ids"})`
- **Issue:** Plan suggested PlaylistNewDialog could pass tag_ids on create.
- **Fix:** PlaylistNewDialog collects only name; redirect-to-editor flow handles tags via the separate PUT /tags endpoint after the first save.
- **Files:** `frontend/src/signage/components/PlaylistNewDialog.tsx`
- **Commit:** `d69cead`

**3. [Rule 2 — Critical functionality] SignagePlaylist type missing description + tag_ids fields**

- **Found during:** Task 1 typecheck
- **Issue:** Duplicate flow needed `source.description`; `SignagePlaylist` interface only had `tags: SignageTag[]` (which the backend doesn't actually return on list/get).
- **Fix:** Added `description: string | null` and `tag_ids: number[] | null` to SignagePlaylist; kept `tags?: SignageTag[]` as forward-compat optional.
- **Files:** `frontend/src/signage/lib/signageTypes.ts`
- **Commit:** `d69cead`

**4. [Rule 2 — Critical functionality] UnsavedChangesDialog locale keys mismatched**

- **Found during:** Task 1 acceptance-criteria check
- **Issue:** 46-06 (parallel wave 2) created the file using `settings.unsaved_dialog.*` keys; this plan's acceptance criteria require `signage.admin.unsaved.*` keys (added by 46-01).
- **Fix:** Rewrote the file to use the signage keys per acceptance, with a dual-API shape (`onConfirm` for 46-05's call site, `onStay`+`onDiscardAndLeave` preserved for 46-06's DeviceEditDialog).
- **Files:** `frontend/src/signage/components/UnsavedChangesDialog.tsx`
- **Commit:** `d69cead`

### Out-of-Scope Deferrals (Logged, Not Fixed)

`cd frontend && npm run build` continues to exit non-zero due to **pre-existing TypeScript errors in unrelated files** (HrKpiCharts.tsx, SalesTable.tsx, useSensorDraft.ts, lib/defaults.ts) — same set documented by 46-01/02/03. None originate from this plan's surface; targeted `tsc --noEmit -p tsconfig.app.json` filtered to `signage/` is clean (0 errors).

The plan's Task 3 verification step `cd frontend && npm run build` cannot be satisfied as a project-wide gate today; satisfied for this plan's scope via targeted typecheck. Project-wide build hygiene remains out of v1.16 Phase 46 scope (already filed in `.planning/phases/46-admin-ui/deferred-items.md` by 46-01).

### Coordination Notes

- 46-06 ran in parallel (wave 2) and committed at 23:02:42 — one minute before this plan's first commit at 23:03:42. Three of this plan's intended Task 1 file edits (App.tsx, signageApi.ts, UnsavedChangesDialog.tsx) were physically present in 46-06's commit because git captured the working-tree state at that moment. Net effect: every line is in `git log`; the attribution is split across two commits. The Task 1 commit (`d69cead`) only mentions the 4 files that were still pending after 46-06 absorbed the parallel-shared edits.
- All `signage.admin.*` i18n keys consumed by this plan (`unsaved.*`, `editor.*`, `playlists.*`, `preview.label`, `tag_picker.*`, `pair.tags_*`, `error.*`) were already added by 46-01 — zero locale edits required by 46-05.

## Authentication Gates

None.

## Known Stubs

None — every UI surface is fully wired:
- PlaylistsPage table: live signageApi.listPlaylists; Edit/Duplicate/Delete all hit real endpoints.
- PlaylistEditorPage: live data hydration, live save mutation against real backend routes, live preview from form state.
- MediaPickerDialog: live signageApi.listMedia.
- PlaylistNewDialog: live signageApi.createPlaylist + redirect.

## Phase 47 Hand-off

Phase 47 (player bundle) consumes the same `<PlayerRenderer>` 46-03 built — this plan's editor exercises that exact contract from the form-state side, validating the items prop shape end-to-end. No new contract surface introduced for 47.

## Self-Check: PASSED

Files exist:
- FOUND: frontend/src/signage/components/PlaylistNewDialog.tsx
- FOUND: frontend/src/signage/components/PlaylistItemList.tsx
- FOUND: frontend/src/signage/components/MediaPickerDialog.tsx
- FOUND: frontend/src/signage/components/UnsavedChangesDialog.tsx
- FOUND: frontend/src/signage/pages/PlaylistsPage.tsx
- FOUND: frontend/src/signage/pages/PlaylistEditorPage.tsx

Commits exist:
- FOUND: d69cead feat(46-05): add playlist CRUD API + list page + new/unsaved dialogs
- FOUND: 38cd026 feat(46-05): add PlaylistItemList (@dnd-kit + keyboard) and MediaPickerDialog
- FOUND: d3b5fde feat(46-05): build PlaylistEditorPage with live preview + dirty guard
- FOUND: 5780c41 feat(46-06): … (carries the parallel-coalesced App.tsx + signageApi.ts + UnsavedChangesDialog edits this plan made; line content verified via `git show 5780c41:` paths)
