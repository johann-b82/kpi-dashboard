---
phase: 46-admin-ui
plan: 05
type: execute
wave: 2
depends_on:
  - "46-01"
  - "46-02"
  - "46-03"
files_modified:
  - frontend/src/App.tsx
  - frontend/src/signage/pages/PlaylistsPage.tsx
  - frontend/src/signage/pages/PlaylistEditorPage.tsx
  - frontend/src/signage/components/PlaylistItemList.tsx
  - frontend/src/signage/components/PlaylistNewDialog.tsx
  - frontend/src/signage/components/MediaPickerDialog.tsx
  - frontend/src/signage/components/UnsavedChangesDialog.tsx
  - frontend/src/signage/lib/signageApi.ts
autonomous: true
requirements:
  - SGN-ADM-05
  - SGN-ADM-09
  - SGN-DIFF-02
must_haves:
  truths:
    - "Admin lands on /signage/playlists and sees a table with existing playlists, each with Edit / Duplicate / Delete actions"
    - "Clicking Edit opens /signage/playlists/:id — a two-pane editor with item list on left and PlayerRenderer preview on right"
    - "Admin drags an item with mouse OR uses keyboard (Tab to handle, Space to pick up, Arrow keys to move, Space to drop) and reorder persists after Save"
    - "Admin edits duration_s or transition of an item and the PlayerRenderer preview updates live from the in-memory form state"
    - "Clicking Save issues PUT /api/signage/playlists/{id}/items with the full ordered items array and PUT /api/signage/playlists/{id} with name/tags"
    - "Navigating away from a dirty editor triggers the UnsavedChangesDialog; Discard proceeds, Stay cancels"
  artifacts:
    - path: frontend/src/signage/pages/PlaylistEditorPage.tsx
      provides: "Full playlist editor with preview dock + dirty guard"
    - path: frontend/src/signage/components/PlaylistItemList.tsx
      provides: "@dnd-kit/sortable list with keyboard + pointer sensors"
    - path: frontend/src/signage/pages/PlaylistsPage.tsx
      provides: "List table with Edit/Duplicate/Delete"
    - path: frontend/src/App.tsx
      contains: "/signage/playlists/:id"
  key_links:
    - from: frontend/src/signage/pages/PlaylistEditorPage.tsx
      to: frontend/src/signage/player/PlayerRenderer.tsx
      via: "useWatch form state passed as items prop"
      pattern: "PlayerRenderer"
    - from: frontend/src/signage/components/PlaylistItemList.tsx
      to: "@dnd-kit/core + @dnd-kit/sortable"
      via: "DndContext + SortableContext + useSortable + KeyboardSensor + sortableKeyboardCoordinates"
      pattern: "sortableKeyboardCoordinates"
    - from: frontend/src/signage/pages/PlaylistEditorPage.tsx
      to: "/api/signage/playlists/{id}/items"
      via: "PUT bulk replace on save"
      pattern: "/items"
---

<objective>
Deliver SGN-ADM-05 + SGN-DIFF-02 + SGN-ADM-09 (dirty guard for the editor): the playlists list table, the full-width split-layout editor with drag-reorder and live WYSIWYG preview via PlayerRenderer, and the unsaved-changes guard on navigation away from a dirty editor.

Purpose: This is the highest-value phase in 46 (full playlist management UX). Completes the core admin workflow: create playlist → add media → reorder/tune → preview → save.

Output: `/signage/playlists` list + `/signage/playlists/:id` editor both functional. `@dnd-kit` wired with mouse AND keyboard sensors. Preview pane live-updates from form state (Pitfall 9 avoided).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-admin-ui/46-CONTEXT.md
@.planning/phases/46-admin-ui/46-RESEARCH.md
@.planning/phases/46-admin-ui/46-UI-SPEC.md
@.planning/phases/46-admin-ui/46-01-SUMMARY.md
@.planning/phases/46-admin-ui/46-02-SUMMARY.md
@.planning/phases/46-admin-ui/46-03-SUMMARY.md

<interfaces>
From 46-02 (dependency):
- `signageApi.listPlaylists()`, `signageApi.getPlaylist(id)` — list + per-id GET
- `signageApi` via `apiClient<T>()` for mutations
- `<TagPicker value onChange placeholder />`

From 46-03 (dependency):
- `<PlayerRenderer items className />` where items is `PlayerItem[]`
- `PlayerItem` has kind/uri/html/slide_paths/duration_s/transition + a stable `id`

From backend (verified):
- `GET /api/signage/playlists` — list of SignagePlaylistRead
- `GET /api/signage/playlists/{id}` — playlist + nested items (verify exact response shape; if items come separately via `GET /api/signage/playlists/{id}/items`, fetch both in parallel inside getPlaylist). Read backend/app/routers/signage_admin/playlists.py to confirm.
- `POST /api/signage/playlists` — create, body `{name, enabled, priority, tag_ids?}`
- `PUT /api/signage/playlists/{id}` — update metadata (name, enabled, priority, tag_ids)
- `DELETE /api/signage/playlists/{id}` — delete
- `PUT /api/signage/playlists/{id}/items` — bulk replace, body `{items: [{media_id, position, duration_s, transition}]}` (BulkReplaceItemsRequest from router source)
- `GET /api/signage/playlists/{id}/items` — list items

Join for PlayerRenderer: on editor mount, fetch playlist + items + all media (`signageApi.listMedia()`) so each item can be augmented with its media's `kind`, `directus_file_id → URL`, `slide_paths`, etc. Cache separately; the editor form state only holds the item core fields (media_id, duration_s, transition, position) plus a client-only ordering index, then DERIVE PlayerItem[] for the preview by joining form state with the media cache.

From react-hook-form:
```
const form = useForm({ defaultValues: { name, enabled, priority, tags, items: [...] } });
const items = useWatch({ control: form.control, name: "items" });
const { isDirty } = form.formState;
```

From wouter: `import { useParams } from "wouter"; const { id } = useParams<{ id: string }>()`.

From @dnd-kit (installed by 46-01 at pinned versions):
```
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Pitfalls to respect:
- Pitfall 1: Route order — `/signage/playlists/:id` MUST precede `/signage/playlists`.
- Pitfall 2: useUnsavedGuard scopePath — pass exact `"/signage/playlists/" + id`.
- Pitfall 4: KeyboardSensor with sortableKeyboardCoordinates required for D-12 keyboard a11y.
- Pitfall 5: Apply `{...listeners}` only to a dedicated drag handle (`<GripVertical>`), not the full row.
- Pitfall 9: PlayerRenderer receives form state via `useWatch`, NOT server data.

From existing `useUnsavedGuard`:
```
useUnsavedGuard(isDirty: boolean, onShowDialog: (to: string) => void, scopePath?: string);
```
Pattern from SettingsPage.tsx: local `pendingNav` state + dialog component + `navigate(pendingNav)` after user confirms discard.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend signageApi, register /:id route in App.tsx, build PlaylistsPage list + PlaylistNewDialog + UnsavedChangesDialog</name>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (extend)
    - frontend/src/App.tsx (route insertion point)
    - frontend/src/components/DeleteConfirmDialog.tsx
    - backend/app/routers/signage_admin/playlists.py (verify POST/PUT/DELETE shapes)
    - 46-UI-SPEC.md sections "Routing Contract", "4. Playlist List Page"
  </read_first>
  <files>
    - frontend/src/signage/lib/signageApi.ts (EXTEND)
    - frontend/src/App.tsx
    - frontend/src/signage/pages/PlaylistsPage.tsx (REPLACE stub)
    - frontend/src/signage/components/PlaylistNewDialog.tsx (CREATE)
    - frontend/src/signage/components/UnsavedChangesDialog.tsx (CREATE)
  </files>
  <action>
    1a. Extend `frontend/src/signage/lib/signageApi.ts` — add:
    ```
    createPlaylist: (body: { name: string; priority?: number; tag_ids?: number[] }) =>
      apiClient<SignagePlaylist>("/api/signage/playlists", { method: "POST", body: JSON.stringify(body) }),
    updatePlaylist: (id: string, body: { name?: string; enabled?: boolean; priority?: number; tag_ids?: number[] }) =>
      apiClient<SignagePlaylist>(`/api/signage/playlists/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    deletePlaylist: (id: string) =>
      apiClient<null>(`/api/signage/playlists/${id}`, { method: "DELETE" }),
    bulkReplaceItems: (id: string, items: Array<{ media_id: string; position: number; duration_s: number; transition: string | null }>) =>
      apiClient<{ items: SignagePlaylistItem[] }>(`/api/signage/playlists/${id}/items`, { method: "PUT", body: JSON.stringify({ items }) }),
    listPlaylistItems: (id: string) =>
      apiClient<SignagePlaylistItem[]>(`/api/signage/playlists/${id}/items`),
    ```
    Verify each endpoint path and request shape against backend router source before final write. Update `getPlaylist` if needed to NOT expect nested items (if endpoint only returns metadata, have the editor fetch items separately via `listPlaylistItems`).

    1b. `App.tsx` — INSERT a new route ABOVE the existing `<Route path="/signage/playlists">` added by 46-01:
    ```
    <Route path="/signage/playlists/:id">
      <AdminOnly><PlaylistEditorPage /></AdminOnly>
    </Route>
    ```
    Add import: `import { PlaylistEditorPage } from "@/signage/pages/PlaylistEditorPage";`. Order is CRITICAL: `/:id` MUST come before the non-parameterized `/signage/playlists` (Pitfall 1).

    1c. `UnsavedChangesDialog.tsx` — small reusable dialog for the dirty-guard flow.
    ```
    export interface UnsavedChangesDialogProps { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; }
    export function UnsavedChangesDialog(props) {
      // <Dialog> with title signage.admin.unsaved.title, body signage.admin.unsaved.body,
      // footer: outline button signage.admin.unsaved.cancel (closes dialog), destructive button
      // signage.admin.unsaved.confirm (calls onConfirm then closes).
    }
    ```

    1d. `PlaylistNewDialog.tsx` — create-new form (react-hook-form + zod).
    Fields: name (required, min 1), tags (TagPicker, string[] — but backend expects `tag_ids: int[]`; see Task-2 note about tag name→id resolution; for create, start with `tag_ids: []` and add tags via edit later, OR do the same create-on-submit dance).
    On submit: `signageApi.createPlaylist({ name, tag_ids: [] })` → invalidate `signageKeys.playlists()` → navigate to `/signage/playlists/${created.id}` → close dialog.

    1e. `PlaylistsPage.tsx` — replace 46-01 stub:
    - `useQuery({ queryKey: signageKeys.playlists(), queryFn: signageApi.listPlaylists })`
    - Header: left-aligned page title optional (SignagePage already provides h1), right-aligned `<Button>{t("signage.admin.playlists.new_button")}</Button>` that opens PlaylistNewDialog.
    - shadcn `<Table>` with columns per UI-SPEC §4: Name, Target tags (Badge chips), Items (count — fetch from a `_count` field if the endpoint provides it; otherwise skip this column or lazy-fetch per row via listPlaylistItems count — prefer a single list endpoint extension; if not available, omit the column and add a note to log as tech debt), Created (format via date-fns), Actions.
    - Actions column: Edit button navigates to `/signage/playlists/${p.id}` via wouter `useLocation`. Duplicate button calls `signageApi.createPlaylist({ name: p.name + " (copy)", tag_ids: p.tags.map(t => t.id) })` + bulk-replaces items from source — or, for simplicity, only duplicates name+tags and starts with empty items; DOCUMENT this choice inline. Delete button opens a standard confirm dialog that calls `signageApi.deletePlaylist`.
    - Empty state: centered card with `signage.admin.playlists.empty_title` + `empty_body` + `empty_cta` button.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "bulkReplaceItems" src/signage/lib/signageApi.ts &amp;&amp; grep -q "/signage/playlists/:id" src/App.tsx &amp;&amp; test -f src/signage/components/UnsavedChangesDialog.tsx &amp;&amp; test -f src/signage/components/PlaylistNewDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `bulkReplaceItems` in `frontend/src/signage/lib/signageApi.ts` is at least 2 (definition + export)
    - grep count of `createPlaylist` in signageApi.ts is at least 1
    - grep count of `updatePlaylist` in signageApi.ts is at least 1
    - grep count of `deletePlaylist` in signageApi.ts is at least 1
    - grep count of `path="/signage/playlists/:id"` in `frontend/src/App.tsx` is exactly 1
    - Route specificity check: `awk '/path="\/signage\/playlists\/:id"/{a=NR} /path="\/signage\/playlists"/&&!/\/:id/{b=NR} END{exit !(a<b)}' frontend/src/App.tsx` exits 0 (`:id` route appears BEFORE non-param route)
    - `test -f frontend/src/signage/components/UnsavedChangesDialog.tsx` succeeds
    - grep count of `signage.admin.unsaved.title` in `UnsavedChangesDialog.tsx` is at least 1
    - grep count of `signage.admin.unsaved.confirm` in `UnsavedChangesDialog.tsx` is at least 1
    - grep count of `signage.admin.unsaved.body` in `UnsavedChangesDialog.tsx` is at least 1
    - `test -f frontend/src/signage/components/PlaylistNewDialog.tsx` succeeds
    - grep count of `signageApi.createPlaylist` in `PlaylistNewDialog.tsx` is at least 1
    - grep count of `signage.admin.playlists.new_button` in `PlaylistsPage.tsx` is at least 1
    - grep count of `signageApi.listPlaylists` in `PlaylistsPage.tsx` is at least 1
    - grep count of `signageApi.deletePlaylist` in `PlaylistsPage.tsx` is at least 1
    - grep count of `dark:` in changed files is 0
    - grep count of `fetch(` in changed files (excluding lib/) is 0
  </acceptance_criteria>
  <done>Route registered, API wrapper extended, list page + new dialog + unsaved dialog built.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build PlaylistItemList with @dnd-kit (keyboard + pointer sensors, drag handle)</name>
  <read_first>
    - 46-RESEARCH.md section "Pattern 3: @dnd-kit Sortable List" (full code example)
    - 46-RESEARCH.md section "Pitfall 4: @dnd-kit missing KeyboardSensor"
    - 46-RESEARCH.md section "Pitfall 5: dnd-kit drag handle vs full-row drag conflict"
    - 46-UI-SPEC.md section "5. Playlist Editor" item list description + drag handle spec
    - frontend/src/signage/lib/signageTypes.ts (SignagePlaylistItem, SignageMedia)
  </read_first>
  <files>
    - frontend/src/signage/components/PlaylistItemList.tsx (CREATE)
    - frontend/src/signage/components/MediaPickerDialog.tsx (CREATE)
  </files>
  <action>
    2a. `PlaylistItemList.tsx` — presentational sortable list controlled by parent.

    Props:
    ```
    interface PlaylistItemFormState {
      // client-side stable key for dnd; generate from crypto.randomUUID() on row create
      key: string;
      media_id: string;
      duration_s: number;
      transition: "fade" | "cut" | null;
    }

    export interface PlaylistItemListProps {
      items: PlaylistItemFormState[];
      mediaLookup: Map<string, SignageMedia>;  // for thumbnail + title lookup
      onChange: (items: PlaylistItemFormState[]) => void;
      onRemove: (key: string) => void;
    }
    ```

    DndContext setup:
    ```
    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragEnd({ active, over }) {
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex(i => i.key === active.id);
      const newIndex = items.findIndex(i => i.key === over.id);
      onChange(arrayMove(items, oldIndex, newIndex));
    }

    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.key)} strategy={verticalListSortingStrategy}>
        {items.map(item => <SortablePlaylistItemRow key={item.key} item={item} media={mediaLookup.get(item.media_id)} onChangeOne={...} onRemove={() => onRemove(item.key)} />)}
      </SortableContext>
    </DndContext>
    ```

    `SortablePlaylistItemRow` (internal component):
    - `const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.key });`
    - `const style = { transform: CSS.Transform.toString(transform), transition };`
    - Layout: `<div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 border border-border rounded-md bg-card">`
      - Drag handle: `<button type="button" {...attributes} {...listeners} aria-label="Drag to reorder {title}" aria-roledescription="drag handle" className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-1"><GripVertical className="w-5 h-5" /></button>` — listeners ONLY on the handle (Pitfall 5).
      - Thumbnail (40×40): rendered from media lookup similarly to MediaPage card.
      - Title (truncated, flex-1): `<span className="text-sm truncate">{media?.title ?? "(missing)"}</span>`
      - Duration input: `<Input type="number" min={1} max={3600} value={item.duration_s} onChange={(e) => onChangeOne({ ...item, duration_s: Number(e.target.value) })} className="w-20" aria-label={t("signage.admin.editor.duration_label")} />`
      - Transition select: a simple `<select>` with options `fade` / `cut`, styled with shadcn input classes (`w-28 text-sm border border-input rounded-md h-9 px-2 bg-background`). i18n: `signage.admin.editor.transition_fade` / `transition_cut`.
      - Remove button: `<Button variant="ghost" size="sm" onClick={() => onRemove(item.key)} aria-label="Remove"><X className="w-4 h-4" /></Button>`

    2b. `MediaPickerDialog.tsx` — grid picker used by editor to pick media.

    Props:
    ```
    interface MediaPickerDialogProps { open: boolean; onOpenChange: (o: boolean) => void; onPick: (media: SignageMedia) => void; }
    ```

    Fetch media via `useQuery(signageKeys.media(), signageApi.listMedia)`. Add a search `<Input>` at top that filters by title (client-side). Grid (`grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto`) of clickable cards. Clicking a card calls `onPick(media)` then `onOpenChange(false)`.

    i18n: reuse existing `signage.admin.editor.add_item` (dialog title can use the same), and a picker placeholder. If new keys needed, they MUST land in both locale files — re-run parity script.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "KeyboardSensor" src/signage/components/PlaylistItemList.tsx &amp;&amp; grep -q "sortableKeyboardCoordinates" src/signage/components/PlaylistItemList.tsx &amp;&amp; grep -q "GripVertical" src/signage/components/PlaylistItemList.tsx &amp;&amp; test -f src/signage/components/MediaPickerDialog.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `@dnd-kit/core` in `frontend/src/signage/components/PlaylistItemList.tsx` is at least 1
    - grep count of `@dnd-kit/sortable` in that file is at least 1
    - grep count of `@dnd-kit/utilities` in that file is at least 1
    - grep count of `KeyboardSensor` in `PlaylistItemList.tsx` is at least 2 (import + useSensor)
    - grep count of `PointerSensor` in that file is at least 2
    - grep count of `sortableKeyboardCoordinates` in that file is at least 2 (import + coordinateGetter arg)
    - grep count of `DndContext` in that file is at least 1
    - grep count of `SortableContext` in that file is at least 1
    - grep count of `arrayMove` in that file is at least 2 (import + usage)
    - grep count of `verticalListSortingStrategy` in that file is at least 1
    - grep count of `useSortable` in that file is at least 1
    - grep count of `GripVertical` in that file is at least 1 (drag handle)
    - grep count of `aria-roledescription="drag handle"` in that file is at least 1
    - grep count of `\.\.\.listeners` in that file is exactly 1 (applied only on the handle, not full row — Pitfall 5 guard). Verify via `grep -c "\.\.\.listeners\|{\\.\\.\\.listeners}" frontend/src/signage/components/PlaylistItemList.tsx` returns exactly 1.
    - `test -f frontend/src/signage/components/MediaPickerDialog.tsx` succeeds
    - grep count of `signageApi.listMedia` in `MediaPickerDialog.tsx` is at least 1
    - grep count of `dark:` in both files is 0
    - grep count of `fetch(` in both files is 0
  </acceptance_criteria>
  <done>Sortable list with mouse AND keyboard reorder; handle-scoped listeners; media picker functional.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build PlaylistEditorPage with react-hook-form, preview dock, dirty-guard, bulk-save</name>
  <read_first>
    - frontend/src/pages/SettingsPage.tsx (dirty-guard pattern — pendingNav state + useUnsavedGuard + dialog)
    - frontend/src/hooks/useUnsavedGuard.ts (scopePath param)
    - frontend/src/signage/components/PlaylistItemList.tsx (Task 2 result)
    - frontend/src/signage/player/PlayerRenderer.tsx (props + PlayerItem type)
    - 46-UI-SPEC.md section "5. Playlist Editor" (split layout, preview dock spec, save/discard buttons)
    - 46-RESEARCH.md Pitfall 9 (form state vs server state for preview)
  </read_first>
  <files>
    - frontend/src/signage/pages/PlaylistEditorPage.tsx (CREATE)
  </files>
  <action>
    Overall flow:
    1. `const { id } = useParams<{id: string}>()` from wouter.
    2. Fetch playlist metadata and items in parallel: `useQuery(signageKeys.playlistItem(id), () => Promise.all([signageApi.getPlaylist(id), signageApi.listPlaylistItems(id), signageApi.listMedia()]))` — returns `{playlist, items, media}`.
    3. Build a `mediaLookup: Map<string, SignageMedia>` from `media`.
    4. Initialize react-hook-form with defaultValues `{ name, tags: playlist.tags.map(t => t.name), items: items.map(it => ({ key: crypto.randomUUID(), media_id: it.media_id, duration_s: it.duration_s, transition: (it.transition as "fade"|"cut"|null) ?? "fade" })) }` — reset via `form.reset(defaultValues)` inside a `useEffect(() => { ... }, [data])` so the form populates AFTER data arrives.
    5. `const items = useWatch({ control: form.control, name: "items" })` — drives the preview (Pitfall 9).
    6. Derive `PlayerItem[]` for preview: map `items` through `mediaLookup` to produce `{ id: m.key, kind: media.kind, uri: resolveMediaUri(media), html: media.metadata?.html ?? null, slide_paths: media.slide_paths, duration_s: m.duration_s, transition: m.transition }`. Skip items whose media_id is missing from lookup.
    7. URL resolution for image/video/pdf: same helper as MediaPage — `${VITE_DIRECTUS_URL}/assets/${media.directus_file_id}`.

    Layout:
    - Page container: `<div className="px-6 pt-4 pb-16">`. No max-w constraint — full-width split.
    - Header: `<input>` for playlist name using form.register (styled: `text-2xl font-semibold bg-transparent border-0 border-b border-border focus:border-primary w-full max-w-2xl`), `<TagPicker>` for tags, Save / Discard buttons aligned right.
    - Split: `<div className="grid lg:grid-cols-5 gap-6 mt-4">`. Left pane: `<div className="lg:col-span-2 space-y-3">` with PlaylistItemList + "Add item" button. Right pane: `<div className="lg:col-span-3">` with `<div className="rounded-lg border border-border overflow-hidden aspect-video bg-background"><PlayerRenderer items={previewItems} /></div>` + preview label below (`signage.admin.preview.label`).

    Item add/remove (parent-owned state, passed to PlaylistItemList):
    - Open MediaPickerDialog via an `onAdd` button. On pick, `form.setValue("items", [...items, { key: crypto.randomUUID(), media_id: media.id, duration_s: 10, transition: "fade" }], { shouldDirty: true })`.
    - Remove: `form.setValue("items", items.filter(i => i.key !== key), { shouldDirty: true })`.
    - Reorder: `form.setValue("items", reorderedItems, { shouldDirty: true })`.
    - Duration/transition edit inline: `form.setValue("items", items.map(i => i.key === key ? newItem : i), { shouldDirty: true })`.

    Save mutation:
    ```
    const saveMutation = useMutation({
      mutationFn: async (values) => {
        // Resolve tag names to IDs — for any name not in existing tags, create first
        const existingTags = await signageApi.listTags();
        const nameToId = new Map(existingTags.map(t => [t.name, t.id]));
        const tagIds: number[] = [];
        for (const name of values.tags) {
          let id = nameToId.get(name);
          if (id === undefined) {
            const created = await signageApi.createTag(name);
            id = created.id;
          }
          tagIds.push(id);
        }
        // Update metadata
        await signageApi.updatePlaylist(id, { name: values.name, tag_ids: tagIds });
        // Bulk-replace items
        await signageApi.bulkReplaceItems(id, values.items.map((it, idx) => ({ media_id: it.media_id, position: idx, duration_s: it.duration_s, transition: it.transition })));
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: signageKeys.playlists() });
        queryClient.invalidateQueries({ queryKey: signageKeys.playlistItem(id) });
        queryClient.invalidateQueries({ queryKey: signageKeys.tags() });
        toast.success(t("signage.admin.editor.saved"));
        form.reset(form.getValues());  // clear dirty after save
      },
      onError: (err) => toast.error(t("signage.admin.editor.save_error", { detail: (err as Error).message })),
    });
    ```

    Dirty guard (Pitfall 2):
    ```
    const [pendingNav, setPendingNav] = useState<string | null>(null);
    const [unsavedOpen, setUnsavedOpen] = useState(false);
    const handleShowUnsavedDialog = useCallback((to: string) => { setPendingNav(to); setUnsavedOpen(true); }, []);
    useUnsavedGuard(form.formState.isDirty, handleShowUnsavedDialog, `/signage/playlists/${id}`);

    function onConfirmDiscard() {
      form.reset();
      setUnsavedOpen(false);
      if (pendingNav === "__back__") { window.history.back(); window.history.back(); }
      else if (pendingNav) { navigate(pendingNav); }
      setPendingNav(null);
    }
    ```
    Render `<UnsavedChangesDialog open={unsavedOpen} onOpenChange={setUnsavedOpen} onConfirm={onConfirmDiscard} />`.

    Discard button in the header: `form.reset()` to revert to loaded defaults (dirty → clean). Save button: `form.handleSubmit((values) => saveMutation.mutate(values))()`.

    Loading state: centered spinner until `data` is available. Error: error card.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; npm run build 2&gt;&amp;1 | tail -15 &amp;&amp; grep -q "useUnsavedGuard" src/signage/pages/PlaylistEditorPage.tsx &amp;&amp; grep -q "useWatch" src/signage/pages/PlaylistEditorPage.tsx &amp;&amp; grep -q "bulkReplaceItems" src/signage/pages/PlaylistEditorPage.tsx &amp;&amp; grep -q "PlayerRenderer" src/signage/pages/PlaylistEditorPage.tsx &amp;&amp; cd frontend &amp;&amp; node scripts/check-signage-invariants.mjs &amp;&amp; node --experimental-strip-types scripts/check-locale-parity.mts</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - grep count of `useUnsavedGuard` in `frontend/src/signage/pages/PlaylistEditorPage.tsx` is at least 1
    - The useUnsavedGuard call passes a scopePath containing `/signage/playlists/` — grep for `useUnsavedGuard\(.*\/signage\/playlists\/` (allowing template literal or concat) with `grep -E "useUnsavedGuard.*\\$\\{id\\}|/signage/playlists/.*\\$" frontend/src/signage/pages/PlaylistEditorPage.tsx` returns at least 1 match
    - grep count of `useWatch` in PlaylistEditorPage.tsx is at least 1 (Pitfall 9)
    - grep count of `<PlayerRenderer` in that file is exactly 1
    - grep count of `PlaylistItemList` in that file is at least 1 (import + usage)
    - grep count of `signageApi.bulkReplaceItems` in that file is at least 1
    - grep count of `signageApi.updatePlaylist` in that file is at least 1
    - grep count of `signageApi.createTag` in that file is at least 1 (create-on-submit per D-15)
    - grep count of `signage.admin.editor.saved` in that file is at least 1
    - grep count of `signage.admin.editor.save_error` in that file is at least 1
    - grep count of `signage.admin.preview.label` in that file is at least 1
    - grep count of `useParams` in that file is at least 1
    - grep count of `UnsavedChangesDialog` in that file is at least 1 (import + render)
    - grep count of `isDirty` in that file is at least 1
    - grep count of `lg:col-span` in that file is at least 2 (split layout)
    - `cd frontend && node scripts/check-signage-invariants.mjs` exits 0
    - `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` exits 0
  </acceptance_criteria>
  <done>Editor loads playlist, drag-reorder + duration/transition inline edit work, preview live-updates from form state, save persists metadata + items, dirty guard intercepts navigation away.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` exits 0.
2. `cd frontend && npm run lint` exits 0.
3. `cd frontend && node scripts/check-signage-invariants.mjs` prints SIGNAGE INVARIANTS OK.
4. `cd frontend && node --experimental-strip-types scripts/check-locale-parity.mts` prints PARITY OK.
5. Manual: /signage/playlists shows table; click New → dialog → create → redirect to editor; add media → drag with mouse + keyboard (Tab to handle, Space, ArrowUp/Down, Space) → edit duration → preview updates live; click another link while dirty → unsaved dialog → Discard proceeds.
</verification>

<success_criteria>
- SGN-ADM-05: create + list + edit + delete playlists; drag-reorder via mouse AND keyboard; bulk-replace on save.
- SGN-DIFF-02: WYSIWYG preview driven by in-memory form state; fade/cut transitions honored.
- SGN-ADM-09 (for editor scope): dirty-guard intercepts navigation; Discard proceeds, Stay cancels.
- Tag create-on-submit works: unknown tag names resolve via POST /api/signage/tags before PUT /playlists.
- Route specificity preserved in App.tsx.
- No invariant violations.
</success_criteria>

<output>
After completion, create `.planning/phases/46-admin-ui/46-05-SUMMARY.md`.
</output>
