# Phase 46: Admin UI - Research

**Researched:** 2026-04-19
**Domain:** React 19 + Vite 8 + Tailwind v4 + shadcn/ui admin SPA — bilingual signage management surface
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Non-PPTX upload uses Directus `/files` then register-in-backend. Frontend uploads via `@directus/sdk` `uploadFiles` (admin JWT), receives Directus file UUID, then calls `POST /api/signage/media` with `{kind, title, directus_file_id, tags, metadata}`. Backend stores `directus_file_id` as `uri`.
- **D-02:** PPTX uses the same dropzone, routed by extension. One drop target on Media tab. `file.name.endsWith('.pptx')` routes to `POST /api/signage/media/pptx`. Status pill (`pending / processing / done / failed` with `conversion_error`) surfaces inline, auto-refreshed via TanStack Query until terminal state.
- **D-03:** URL and HTML "media" (kind=`url` / kind=`html`) skip the dropzone — use a "Register URL / HTML" button opening a small form → direct `POST /api/signage/media`.
- **D-04:** URL-routed sub-pages: `/signage/media`, `/signage/playlists`, `/signage/devices`. `/signage` redirects to `/signage/media`. Single `SignagePage.tsx` renders the tab bar (shadcn-style button group, NOT in-page `<Tabs>`) + renders the active sub-page. Each sub-page owns its own `useUnsavedGuard` scope.
- **D-05:** `/signage/pair` is a top-level route (NOT nested under `/devices`). Reachable from a "Pair new device" CTA on the Devices tab.
- **D-06:** Route registration in `frontend/src/App.tsx`, wrapped in `<AdminOnly>`.
- **D-07:** Separate full-width route `/signage/playlists/:id` for the editor. List page (`/signage/playlists`) shows a table with Edit / Duplicate / Delete actions. Isolated dirty-guard scope per playlist edit session.
- **D-08:** Preview dock: responsive split layout — item list on left, live `<PlayerRenderer>` preview on right on `≥lg` breakpoint; stacks vertically on narrower viewports. Preview always present.
- **D-09:** Build a shared `<PlayerRenderer>` in this phase at `frontend/src/signage/player/`. Houses ImagePlayer, VideoPlayer, PdfPlayer (`react-pdf`), IframePlayer (sandboxed), HtmlPlayer (sandboxed `<iframe srcdoc>`), PptxPlayer (image-sequence from `slide_paths`). Phase 47 imports and wraps this component.
- **D-10:** Admin preview does NOT implement the 45s SSE watchdog, 60s heartbeat, or service-worker offline cache — those are Phase 47 wrappers.
- **D-11:** PDF preview uses `react-pdf` (new dep, wraps `pdfjs-dist`). Phase 47's Pi PdfPlayer will reuse the same `react-pdf` component. pdfjs-dist version pinned per roadmap (`5.6.205`); confirm lock at planning time. Admin side can use the default react-pdf worker config.
- **D-12:** Drag-reorder uses `@dnd-kit` (new deps: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`). Keyboard + touch a11y. On drop, editor marks form dirty; save issues a bulk replace via `PUT /api/signage/playlists/{id}/items`.
- **D-13:** Admin UI does NOT subscribe to Phase 45 SSE `/stream`. Data freshness via TanStack Query: mutation-invalidation on every successful write + `refetchOnWindowFocus: true` + 30s `refetchInterval` on Devices tab.
- **D-14:** Device status thresholds from `last_seen_at`: green `< 2min`, amber `2–5min`, red `> 5min`. Paired-but-never-seen devices render neutral grey "unseen" chip. Computed client-side.
- **D-15:** Token-chip `<TagPicker>` shared across playlist editor and device edit form. Typing filters autocomplete of existing tags (TanStack Query). Enter/comma commits input. Unknown text → "create on submit". Backspace on empty removes last chip. Chips have `×` button.
- **D-16:** All new keys under `signage.admin.*` in both `en.json` and `de.json`, informal "du" tone. Launcher tile key: `launcher.tiles.signage` (EN/DE both "Digital Signage"). CI parity check must stay green.
- **D-17:** Reuse existing `useUnsavedGuard` from `frontend/src/hooks/useUnsavedGuard.ts`. Scopes: playlist editor, device edit form, tag picker in-progress edits.
- **D-18:** Every signage admin API call goes through shared `apiClient<T>()`. ONE exception: Directus upload in D-01 uses `@directus/sdk`. CI grep guard: `grep -rn "fetch(" frontend/src/signage` must return zero.

### Claude's Discretion

- File/folder layout under `frontend/src/signage/` — pages vs components split, whether `<PlayerRenderer>` lives in `signage/player/` vs `signage/shared/player/`.
- Exact endpoint URL for bulk playlist-item reorder — confirmed: `PUT /api/signage/playlists/{id}/items` (atomic bulk-replace per Phase 43 plan).
- Whether the launcher tile lives in `LauncherPage.tsx` inline or a new `SignageLauncherTile.tsx`.
- Shape of the in-use-by-N-playlists confirm dialog — reuse `DeleteConfirmDialog.tsx` or extend it.

### Deferred Ideas (OUT OF SCOPE)

- Admin-JWT SSE stream.
- Playlist preview export / share link.
- Bulk tag operations (rename, merge).
- Media library bulk actions (multi-select delete, bulk tag).
- Dayparting / scheduled playlists (SGN-FUTURE-01).
- Keyboard shortcuts for playlist editor beyond dnd-kit keyboard sensor.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-ADM-01 | `/signage` route registered in `App.tsx`, wrapped in `<AdminOnly>` | Wouter flat-route pattern confirmed; `<AdminOnly>` reads `useRole()` |
| SGN-ADM-02 | Admin-only launcher tile using `MonitorPlay` icon; i18n key `launcher.tiles.signage` | `LauncherPage.tsx` inline tile pattern confirmed; `lucide-react` exports `MonitorPlay` |
| SGN-ADM-03 | `SignagePage.tsx` with tabs (Media / Playlists / Devices) mirroring `SensorsPage.tsx` shell | URL-routed tabs via wouter `<Switch>` inside `SignagePage.tsx` per D-04 |
| SGN-ADM-04 | Media library — upload, list, delete with in-use-by-N confirm | `POST /api/signage/media` and `/pptx` endpoints confirmed; 409 RESTRICT pattern confirmed |
| SGN-ADM-05 | Playlist editor — name, tags, drag-reorder, per-item `duration_s` + transition + media picker | `PUT /api/signage/playlists/{id}/items` bulk-replace endpoint confirmed; `@dnd-kit/sortable` pattern documented |
| SGN-ADM-06 | Device table — name, tags, status chip from `last_seen_at`, current playlist, edit/revoke | `date-fns` differenceInMinutes pattern; thresholds D-14; `PATCH /api/signage/devices/{id}`, revoke via pair router |
| SGN-ADM-07 | `/signage/pair` page — admin enters 6-digit code + device name + tags → `POST /api/signage/pair/claim` | `SignagePairingClaimRequest` schema: `{code, device_name, tags[]}` confirmed from backend |
| SGN-ADM-08 | Tag picker shared across playlists + devices (autocomplete + create-on-submit) | `<TagPicker>` design documented; uses `GET /api/signage/tags` |
| SGN-ADM-09 | Dirty-guard + unsaved-changes dialog via `useUnsavedGuard` | Hook confirmed; requires `scopePath` param per path; `UnsavedChangesDialog` reuse |
| SGN-ADM-10 | Full DE/EN i18n parity for `signage.admin.*` keys, "du" tone, CI gate | Existing parity check described in ROADMAP; no script found in repo — Wave 0 gap |
| SGN-DIFF-02 | WYSIWYG admin preview panel — embeds `<PlayerRenderer>` in admin UI; `react-pdf` for PDF | `react-pdf@10.4.1` (ships pdfjs-dist 5.4.296); pdfjs-dist version mismatch with Phase 47 pin — documented below |
</phase_requirements>

---

## Summary

Phase 46 is a frontend-only phase (no new backend code) that wires the `/signage/*` admin surface into the existing Vite/React SPA. All backend API endpoints, auth, and business logic were delivered in Phases 41–45. The phase introduces two new npm dependencies (`@dnd-kit/*` and `react-pdf`) and registers multiple wouter routes under `<AdminOnly>`.

The existing project patterns are well-established and directly applicable: `SettingsPage.tsx` / `SensorsSettingsPage.tsx` provide the page-shell model; `useUnsavedGuard` provides dirty-guard with per-path scoping; `apiClient<T>()` + `directusClient` cover all API calls; the `DropZone.tsx`, `DeleteConfirmDialog.tsx`, and all shadcn primitives (card, dialog, form, input, button, table, badge, popover, label) are already installed.

The primary research risks are: (1) the `react-pdf` / `pdfjs-dist` version mismatch between the admin install and the Phase 47 pin (`5.6.205`), requiring a package-level override strategy; (2) the `@dnd-kit/sortable` keyboard sensor setup which requires explicit `KeyboardSensor` + `sortableKeyboardCoordinates` configuration; (3) the wouter routing model — no nested `<Router>` is used; all signage routes must be registered as flat siblings in `App.tsx`'s `<Switch>`, which means `/signage/playlists/:id` MUST appear before `/signage/playlists` and `/signage` must appear last.

**Primary recommendation:** Register all signage routes as flat sibling entries in `App.tsx` `<Switch>`, in specificity order (`/signage/playlists/:id` before `/signage/playlists` before `/signage/media` etc.), each wrapped in `<AdminOnly>`. Build `<PlayerRenderer>` as a pure presentational component in `frontend/src/signage/player/` that accepts a playlist array + current-index prop.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | 19.2.4 | UI framework | Already installed |
| TypeScript | 6.0.2 | Type safety | Already installed |
| Vite | 8.0.4 | Build + dev | Already installed |
| Tailwind CSS | 4.2.2 | Styling | Token-only, no `dark:` variants allowed |
| shadcn/ui | copy-paste | Component primitives | card, dialog, form, input, button, table, badge, popover, label, separator all confirmed installed |
| @tanstack/react-query | 5.97.0 | Server state | Already installed |
| wouter | 3.9.0 | Routing | Already installed — flat `<Switch>` model, NO nested `<Outlet />` |
| react-hook-form | 7.72.1 | Forms | Already installed |
| zod | 4.3.6 | Validation schemas | Already installed |
| @hookform/resolvers | 5.2.2 | RHF/Zod bridge | Already installed |
| sonner | 2.0.7 | Toasts | Already installed |
| lucide-react | 1.8.0 | Icons (includes `MonitorPlay`) | Already installed |
| date-fns | 4.1.0 | `differenceInMinutes` for device status | Already installed |
| react-dropzone | 15.0.0 | File drop (via `DropZone.tsx` wrapper) | Already installed |
| @directus/sdk | 21.2.2 | `uploadFiles()` for non-PPTX media | Already installed |
| react-i18next | 17.0.2 | i18n hooks | Already installed |

### New Dependencies This Phase
| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| @dnd-kit/core | 6.3.1 | DnD primitives | `npm install @dnd-kit/core` |
| @dnd-kit/sortable | 10.0.0 | Sortable list abstraction | `npm install @dnd-kit/sortable` |
| @dnd-kit/utilities | 3.2.2 | CSS transform helpers | `npm install @dnd-kit/utilities` |
| react-pdf | 10.4.1 | PDF rendering (wraps pdfjs-dist 5.4.296) | `npm install react-pdf` |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-pdf
```

**Version verification (confirmed 2026-04-19):**
- `@dnd-kit/core@6.3.1` — confirmed current from npm registry
- `@dnd-kit/sortable@10.0.0` — confirmed current from npm registry
- `@dnd-kit/utilities@3.2.2` — confirmed current from npm registry
- `react-pdf@10.4.1` — confirmed current (latest) from npm registry; bundles `pdfjs-dist@5.4.296`
- `pdfjs-dist@5.6.205` — exists in npm registry; Phase 47 will pin this version

### pdfjs-dist Version Mismatch (CRITICAL for planning)

`react-pdf@10.4.1` ships `pdfjs-dist@5.4.296` as a bundled dependency. The ROADMAP pins `pdfjs-dist@5.6.205` for Phase 47 (required because Phase 47 uses the `?url` worker import pattern tied to exact version match).

**Resolution strategy for Phase 46:** Install `react-pdf@10.4.1` normally. For the admin PdfPlayer, use `react-pdf`'s built-in default worker configuration (no manual `GlobalWorkerOptions.workerSrc` override needed — `react-pdf` configures the worker for you). This is correct for admin use.

**For Phase 47:** Phase 47 will add `pdfjs-dist@5.6.205` as a direct dependency and use `npm overrides` to force the resolution. Phase 46 does not set the override — that is Phase 47's concern.

**Do not** try to pin `pdfjs-dist@5.6.205` in Phase 46. It would break `react-pdf`'s internal worker setup.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/signage/
├── pages/
│   ├── SignagePage.tsx           # Tab shell — renders nav + <Switch> for sub-pages
│   ├── MediaPage.tsx             # /signage/media — list + upload
│   ├── PlaylistsPage.tsx         # /signage/playlists — list table
│   ├── PlaylistEditorPage.tsx    # /signage/playlists/:id — full editor + preview dock
│   ├── DevicesPage.tsx           # /signage/devices — table + 30s refetchInterval
│   └── PairPage.tsx              # /signage/pair — claim form (top-level route)
├── components/
│   ├── MediaUploadDropZone.tsx   # DropZone.tsx wrapper for signage (routes PPTX vs non-PPTX)
│   ├── MediaStatusPill.tsx       # conversion_status badge with polling logic
│   ├── PlaylistItemList.tsx      # @dnd-kit/sortable sortable list
│   ├── DeviceStatusChip.tsx      # green/amber/red/grey derived from last_seen_at
│   ├── TagPicker.tsx             # token-chip autocomplete, shared across pages
│   └── MediaDeleteDialog.tsx     # Extends DeleteConfirmDialog for "in use by N playlists"
└── player/
    ├── PlayerRenderer.tsx        # Root: accepts playlist[] + currentIndex, auto-advances
    ├── ImagePlayer.tsx           # <img> with fade transition
    ├── VideoPlayer.tsx           # <video muted autoplay playsinline>
    ├── PdfPlayer.tsx             # react-pdf <Document>/<Page> with page-flip
    ├── IframePlayer.tsx          # <iframe sandbox> for URL kind
    ├── HtmlPlayer.tsx            # <iframe srcdoc> for html kind
    └── PptxPlayer.tsx            # <img> sequence cycling through slide_paths
```

### Pattern 1: Wouter Flat Routes (No Nested Router)

Wouter 3.9.0 has no `<Outlet />` equivalent for nested routing. All signage routes must be declared as flat siblings in `App.tsx`. Order matters — more specific paths MUST precede less specific ones.

```tsx
// In App.tsx <Switch> — ordering is critical
<Route path="/signage/playlists/:id">
  <AdminOnly><PlaylistEditorPage /></AdminOnly>
</Route>
<Route path="/signage/playlists">
  <AdminOnly><SignagePage tab="playlists" /></AdminOnly>
</Route>
<Route path="/signage/devices">
  <AdminOnly><SignagePage tab="devices" /></AdminOnly>
</Route>
<Route path="/signage/media">
  <AdminOnly><SignagePage tab="media" /></AdminOnly>
</Route>
<Route path="/signage/pair">
  <AdminOnly><PairPage /></AdminOnly>
</Route>
<Route path="/signage">
  {/* redirect to /signage/media */}
  <AdminOnly><SignageRedirect /></AdminOnly>
</Route>
```

`SignagePage.tsx` receives the active tab as a prop (or reads `useLocation()`) and renders the correct sub-page component. No sub-router needed.

### Pattern 2: useUnsavedGuard with scopePath

The existing `useUnsavedGuard` hook (confirmed in source) accepts an optional `scopePath` parameter that defaults to `"/settings"`. For signage, pass the active route path:

```tsx
// In PlaylistEditorPage.tsx
useUnsavedGuard(isDirty, handleShowUnsavedDialog, "/signage/playlists/" + playlistId);

// In DevicesPage.tsx (device edit form)
useUnsavedGuard(isDirty, handleShowUnsavedDialog, "/signage/devices");
```

Each sub-page wraps the dialog with its own `useState` for the pending nav target, matching the `SettingsPage.tsx` pattern exactly.

### Pattern 3: @dnd-kit Sortable List

```tsx
// Source: @dnd-kit/sortable official docs
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function PlaylistItemList({ items, onChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      onChange(arrayMove(items, oldIndex, newIndex));
      // mark form dirty — parent updates position fields before save
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map(item => (
          <SortablePlaylistItem key={item.id} item={item} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortablePlaylistItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* item content */}
    </div>
  );
}
```

**Key points:**
- Both `PointerSensor` and `KeyboardSensor` are required for a11y (D-12 explicitly requires keyboard support).
- `sortableKeyboardCoordinates` must be passed to `KeyboardSensor` — omitting it disables keyboard reorder.
- `arrayMove` from `@dnd-kit/sortable` reorders the in-memory array; `position` values are derived from array index on save.
- The `id` field passed to `SortableContext` must match what `useSortable({ id })` receives.

### Pattern 4: Bulk Reorder Save (Confirmed Backend Shape)

**Confirmed from Phase 43 implementation:** The endpoint is `PUT /api/signage/playlists/{id}/items`. It accepts:
```json
{
  "items": [
    {"media_id": "<uuid>", "position": 0, "duration_s": 10, "transition": "fade"},
    {"media_id": "<uuid>", "position": 1, "duration_s": 15, "transition": "cut"}
  ]
}
```
This is an atomic bulk-replace (DELETE all + INSERT all in one transaction). The frontend sends the complete ordered list on every save — not a delta or reorder-only endpoint. Reorder is just a save with re-ordered positions.

### Pattern 5: Directus File Upload (D-01)

```tsx
// Using @directus/sdk uploadFiles
import { uploadFiles } from "@directus/sdk";
import { directus } from "@/lib/directusClient";

async function uploadMediaFile(file: File, kind: string, title: string, tags: string[]) {
  const formData = new FormData();
  formData.append("file", file);
  // Optional metadata Directus understands:
  formData.append("title", title);

  // Step 1: Upload to Directus /files
  const result = await directus.request(uploadFiles(formData));
  const directusFileId = result.id; // UUID

  // Step 2: Register in backend
  await apiClient<SignageMediaRead>("/api/signage/media", {
    method: "POST",
    body: JSON.stringify({
      kind,
      title,
      directus_file_id: directusFileId,
      tags,
    }),
  });
}
```

**Confirmed:** `uploadFiles` function exists in `@directus/sdk@21.2.2` (verified from installed package). It posts multipart to `/files` and returns the created file object with `id` field.

**Important:** `directus.request(uploadFiles(formData))` requires the admin JWT to be active in the directus singleton. The directus singleton uses cookie-mode auth — the admin's session cookie is sent automatically. No need to manually set token in the FormData call.

### Pattern 6: react-pdf PdfPlayer

```tsx
// Source: react-pdf@10.4.1 official usage
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// react-pdf configures its own worker internally — no GlobalWorkerOptions needed for admin.
// Phase 47 will override this for the pinned pdfjs-dist@5.6.205 player bundle.

function PdfPlayer({ uri, autoFlipSeconds = 8 }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    if (numPages === 0) return;
    const timer = setInterval(() => {
      setPageNumber(p => p < numPages ? p + 1 : 1);
    }, autoFlipSeconds * 1000);
    return () => clearInterval(timer);
  }, [numPages, autoFlipSeconds]);

  return (
    <Document
      file={uri}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      <Page pageNumber={pageNumber} width={/* container width */} />
    </Document>
  );
}
```

**Note:** `react-pdf` requires importing its CSS files for annotations and text layers. For admin preview, both are optional — can suppress text/annotation layers with `renderTextLayer={false}` and `renderAnnotationLayer={false}` to keep the preview lightweight.

### Pattern 7: Device Status Chip Computation

```tsx
import { differenceInMinutes } from "date-fns";

function computeDeviceStatus(lastSeenAt: string | null): "online" | "warning" | "offline" | "unseen" {
  if (lastSeenAt === null) return "unseen";
  const minutes = differenceInMinutes(new Date(), new Date(lastSeenAt));
  if (minutes < 2) return "online";
  if (minutes < 5) return "warning";
  return "offline";
}

const statusConfig = {
  online: { label: "Online", className: "bg-green-100 text-green-800" },
  warning: { label: "Zuletzt gesehen", className: "bg-amber-100 text-amber-800" },
  offline: { label: "Offline", className: "bg-red-100 text-red-800" },
  unseen: { label: "Noch nicht gesehen", className: "bg-muted text-muted-foreground" },
} as const;
```

**Note:** Use CSS token classes where possible (`bg-muted`, `text-muted-foreground`) to comply with the no-`dark:` invariant. For colored status chips (green/amber/red), use the `bg-{color}` Tailwind classes which do not require dark variants — they are purely decorative status indicators.

**Alternative (token-only):** The badge component from shadcn can be styled with `variant="outline"` and custom border-color via inline style, avoiding hardcoded color classes. Planner decides approach — but green/amber/red are standard status conventions and do not need dark variants.

### Pattern 8: TanStack Query with refetchInterval

```tsx
// Devices tab — 30s live update per D-13
const { data: devices } = useQuery({
  queryKey: ["signage", "devices"],
  queryFn: () => apiClient<SignageDevice[]>("/api/signage/devices"),
  refetchInterval: 30_000, // ms
});

// Standard mutation-invalidation pattern
const updateDevice = useMutation({
  mutationFn: (payload) => apiClient("/api/signage/devices/" + payload.id, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["signage", "devices"] });
    toast.success(t("signage.admin.device.saved"));
  },
});
```

### Pattern 9: PPTX Status Pill Polling

```tsx
// Poll until conversion reaches terminal state
const { data: media } = useQuery({
  queryKey: ["signage", "media", mediaId],
  queryFn: () => apiClient<SignageMedia>("/api/signage/media/" + mediaId),
  refetchInterval: (query) => {
    const status = query.state.data?.conversion_status;
    // Stop polling on terminal states
    if (status === "done" || status === "failed") return false;
    return 3_000; // poll every 3s while pending/processing
  },
  enabled: !!mediaId,
});
```

### Pattern 10: TagPicker Component Design

The `<TagPicker>` is a controlled component that manages an array of tag strings:

```tsx
interface TagPickerProps {
  value: string[];          // current chips
  onChange: (tags: string[]) => void;
  placeholder?: string;     // i18n key resolved by caller
}
```

Internal state: `inputValue` (the text being typed), `isOpen` (dropdown visibility).

Autocomplete dropdown: `useQuery` for `GET /api/signage/tags` (fetched once per session, stale time = `Infinity` unless invalidated by a create). Filter client-side by `inputValue`.

"Create on submit" semantic: if input text doesn't match an existing tag, add it to the `value` array as-is. The parent form's `onSubmit` handler is responsible for creating the tag via `POST /api/signage/tags` before saving the parent entity.

The `<TagPicker>` does not call the API itself — it only manages the string array. Tag creation is a parent-form concern.

### Anti-Patterns to Avoid

- **Using `<Tabs>` from shadcn for top-level signage navigation** — D-04 specifies a shadcn-style button group + URL routing, not in-page `<Tabs>`. Tabs can be used within a sub-page for secondary organization if needed.
- **Using `dark:` Tailwind variants** — Cross-cutting invariant 3. All theming via CSS tokens (`bg-background`, `text-foreground`, `bg-muted`, etc.).
- **Direct `fetch()` calls in signage components** — Cross-cutting invariant 2. All calls via `apiClient<T>()` except the Directus upload.
- **Nested `<Router>` / `<Switch>` for signage tabs** — Wouter 3.9.0 does not support nested routers without a base-path provider. Keep all routes flat in App.tsx.
- **Using `react-hook-form`'s `register()` for the TagPicker** — The TagPicker is a controlled array; use `useController` or `setValue/watch` to bridge it into the parent form.
- **Fetching tags on every keystroke** — Fetch once with long `staleTime`; filter client-side.
- **Implementing `position` as a displayed field** — `position` is derived from array index on save; it should not be user-editable directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-reorder with keyboard a11y | Custom mouse-event DnD | `@dnd-kit/sortable` | Touch/keyboard/pointer sensors; a11y announcements; transform math |
| PDF rendering in browser | Canvas-based PDF parser | `react-pdf` (wraps pdf.js) | pdf.js handles the complex decode; canvas management; page navigation |
| Token-chip input from scratch | `<input>` + manual chip logic | shadcn `<Badge>` chips + `<Popover>` for autocomplete | Use existing primitives; keyboard nav is non-trivial |
| Dirty-guard on navigation | Custom beforeunload + click intercept | `useUnsavedGuard` (already exists) | Already handles beforeunload, click capture, popstate all three |
| File type routing in dropzone | Custom file-input change handler | `react-dropzone` via existing `DropZone.tsx` | `accept` prop; rejection callbacks; `onDrop` receives typed files |
| Toast notifications | `setState` toast queue | `sonner` (already wired) | Already mounted at root; consistent position/style |
| Directus file upload with auth | Raw `fetch` to `/files` | `@directus/sdk` `uploadFiles` | Cookie auth automatic; token management already handled |

---

## Common Pitfalls

### Pitfall 1: Wouter route-order collision

**What goes wrong:** `/signage/playlists/:id` route is declared after `/signage/playlists` in `<Switch>`. Wouter's first-match wins. Every edit URL matches the list route with `id` interpreted as the path not matching, or vice versa.

**Why it happens:** Wouter 3.9.0 does not sort routes by specificity — order in JSX is order of matching.

**How to avoid:** Declare all `:id` param routes BEFORE their parent base routes. See Pattern 1 route order above.

**Warning signs:** Navigating to `/signage/playlists/some-uuid` renders the playlist list instead of the editor.

### Pitfall 2: useUnsavedGuard scopePath mismatch

**What goes wrong:** `useUnsavedGuard(isDirty, handler)` uses default `scopePath="/settings"`. On `/signage/playlists/abc`, clicks within the editor fire the unsaved-changes dialog because `window.location.pathname !== "/settings"` is always true.

**Why it happens:** The hook's click handler checks `if (window.location.pathname !== scopePath) return` — if scopePath is wrong, every click intercept fires.

**How to avoid:** Always pass the exact current path as `scopePath`. For the playlist editor: `useUnsavedGuard(isDirty, handler, "/signage/playlists/" + id)`.

### Pitfall 3: react-pdf worker "fake worker" warning

**What goes wrong:** `react-pdf@10.4.1` is installed but no worker configuration is done. Console shows `Setting up fake worker` warning; PDF rendering works but falls back to main-thread processing.

**Why it happens:** `react-pdf` auto-configures a CDN worker URL fallback but may warn in strict environments.

**How to avoid:** For admin use, `react-pdf` v10 handles worker configuration internally. Import the CSS files (`react-pdf/dist/Page/AnnotationLayer.css` and `TextLayer.css`) and use `<Document>` + `<Page>` directly. If the warning appears, configure:
```ts
import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
```
Do NOT hardcode `5.6.205` in this import — use `pdfjs.version` so it matches the bundled react-pdf version (`5.4.296`). Phase 47 will set its own override.

### Pitfall 4: @dnd-kit missing KeyboardSensor

**What goes wrong:** Only `PointerSensor` is configured. Drag-reorder works with mouse/touch but fails keyboard. D-12 explicitly requires keyboard a11y.

**Why it happens:** `PointerSensor` is the obvious first sensor; `KeyboardSensor` requires the additional `coordinateGetter` import.

**How to avoid:** Always configure both sensors. `sortableKeyboardCoordinates` is the standard `coordinateGetter` for vertical lists. See Pattern 3 above.

### Pitfall 5: dnd-kit drag handle vs full-row drag conflict

**What goes wrong:** If the playlist item row has buttons (duration input, delete button), pointer events on those buttons trigger drag instead of their own handlers.

**Why it happens:** `...listeners` spread on the full row container captures all pointer events.

**How to avoid:** Use a dedicated drag-handle element. Spread `...listeners` and `...attributes` only on the handle icon (e.g., `GripVertical` icon from `lucide-react`), not on the full row. This isolates drag activation to the handle.

### Pitfall 6: 409 in-use-by-N media delete — response shape

**What goes wrong:** Frontend handles delete 409 as a generic error toast, losing the playlist count and blocking the confirm dialog.

**Why it happens:** The backend returns a `JSONResponse` (not a FastAPI `HTTPException`) for the RESTRICT case, with a `playlist_ids` array in the body. The `apiClient` throws on non-ok, stringifying the `detail` field.

**How to avoid:** The backend sends `{"detail": "...", "playlist_ids": ["<uuid>", ...]}`. The `apiClient` throws `new Error(body.detail)`. To get the count for the dialog, the caller must catch the error AND re-fetch the media item to get playlist associations — OR the backend must include the count in `detail` as a string (e.g. "in use by 3 playlists"). Confirm the exact backend response shape from `backend/app/routers/signage_admin/media.py` during plan writing and surface the count from the `detail` string.

### Pitfall 7: i18n missing DE keys visible at runtime

**What goes wrong:** Admin uses the UI in German, sees `signage.admin.media.upload_title` literal on screen instead of translated text.

**Why it happens:** v1.15 lesson (PITFALLS.md §20). Developer adds keys to `en.json` during development, forgets `de.json`. No CI script exists in the repo scripts directory (only in ROADMAP as intent — `scripts/check-i18n-parity.mjs` does not exist yet).

**How to avoid:** Wave 0 of the plan must create `scripts/check-i18n-parity.mjs` and add both locale files to every PR's change checklist. Every key added to `en.json` must be simultaneously added to `de.json`.

**Warning signs:** `i18next::translator: missingKey de translation signage.*` in browser console.

### Pitfall 8: Directus uploadFiles returns different shapes for single vs multiple files

**What goes wrong:** `directus.request(uploadFiles(formData))` — when uploading a single file, the SDK may return the file object directly or wrapped in an array depending on SDK version and server response.

**How to avoid:** Always treat the result defensively:
```ts
const result = await directus.request(uploadFiles(formData));
const fileId = Array.isArray(result) ? result[0].id : result.id;
```
Verify during plan implementation with a real test upload to the running Directus instance.

### Pitfall 9: PlayerRenderer live preview — form state vs server state

**What goes wrong:** Admin edits `duration_s` on a playlist item. `<PlayerRenderer>` is fed persisted server state instead of the in-memory form state. Edits do not reflect in preview.

**Why it happens:** `useQuery` data and `react-hook-form` form state are separate.

**How to avoid:** `<PlayerRenderer>` must receive the current form state array directly (via `useWatch` or `watch()`), not the server query data. Per D-09: "Admin preview takes the in-memory form state, not persisted state." The `useQuery` data is only the initial value for `useForm`'s `defaultValues`.

---

## Code Examples

### signage query keys (recommended)
```ts
// frontend/src/lib/queryKeys.ts extension
export const signageKeys = {
  all: ["signage"] as const,
  media: () => [...signageKeys.all, "media"] as const,
  mediaItem: (id: string) => [...signageKeys.media(), id] as const,
  playlists: () => [...signageKeys.all, "playlists"] as const,
  playlistItem: (id: string) => [...signageKeys.playlists(), id] as const,
  devices: () => [...signageKeys.all, "devices"] as const,
  tags: () => [...signageKeys.all, "tags"] as const,
};
```

### LauncherPage tile (inline pattern from existing code)
```tsx
// In LauncherPage.tsx — add inside the grid, inside <AdminOnly>
<AdminOnly>
  <div className="flex flex-col items-center gap-2">
    <button
      type="button"
      onClick={() => setLocation("/signage")}
      aria-label={t("launcher.tiles.signage")}
      className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                 flex items-center justify-center p-4
                 cursor-pointer hover:bg-accent/10 transition-colors
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MonitorPlay className="w-10 h-10 text-foreground" aria-hidden="true" />
    </button>
    <span className="text-xs text-muted-foreground text-center">
      {t("launcher.tiles.signage")}
    </span>
  </div>
</AdminOnly>
```

Note: Existing launcher uses `launcher.tile.sensors` (singular `tile`). D-16 specifies `launcher.tiles.signage` (plural `tiles`). The planner must decide whether to follow the existing key convention or the CONTEXT.md spec. Recommend following CONTEXT.md spec (`launcher.tiles.signage`) as the locked decision.

### Claim form — PairPage.tsx
The backend `SignagePairingClaimRequest` schema (confirmed):
```python
class SignagePairingClaimRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=7)
    device_name: str = Field(..., max_length=128)
    # tags field — confirm from backend: list[str] or list[uuid]
```
The `tags` field needs confirmation from `backend/app/routers/signage_pair.py` at plan time — the claim endpoint may accept tag names or tag UUIDs.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind `dark:` variants | CSS token variables (`bg-background`, etc.) | v1.9 (Phase 21) | All new components must use tokens; verified by invariant 3 |
| Direct `fetch()` | `apiClient<T>()` | v1.11 (Phase 27) | Grep guard enforced in CI per invariant 2 |
| `window.history.pushState` dirty-guard | `useUnsavedGuard` with scopePath | v1.15 (Phase 40) | Reuse hook with correct scopePath |
| Inline tiles in LauncherPage | Same pattern maintained | v1.14 (Phase 37) | No tile-component abstraction exists; stay inline |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Frontend install | ✓ | Present (project running) | — |
| @dnd-kit/core | SGN-ADM-05 drag-reorder | ✗ (not yet installed) | 6.3.1 (registry) | None — required |
| @dnd-kit/sortable | SGN-ADM-05 drag-reorder | ✗ (not yet installed) | 10.0.0 (registry) | None — required |
| @dnd-kit/utilities | SGN-ADM-05 drag-reorder | ✗ (not yet installed) | 3.2.2 (registry) | None — required |
| react-pdf | SGN-DIFF-02 PDF preview | ✗ (not yet installed) | 10.4.1 (registry) | None — required |
| shadcn/ui tabs | Optional sub-page tabs | ✗ (not installed) | copy-paste | Not needed per D-04; button-group nav instead |
| date-fns | Device status chip | ✓ | 4.1.0 | — |
| @directus/sdk | D-01 file upload | ✓ | 21.2.2 | — |

**Missing dependencies (blocking, no fallback):**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — required for SGN-ADM-05
- `react-pdf` — required for SGN-DIFF-02

**Wave 0 install step:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-pdf`

---

## Open Questions

1. **`launcher.tiles.signage` key name vs existing `launcher.tile.*` convention**
   - What we know: Existing keys use singular `launcher.tile.kpi_dashboard`, `launcher.tile.sensors`. D-16 specifies `launcher.tiles.signage` (plural).
   - What's unclear: Whether to fix the convention mismatch or follow D-16 verbatim.
   - Recommendation: Follow D-16 exactly (`launcher.tiles.signage`). Rename existing keys would break things; the new key can use plural without renaming others.

2. **PairPage `/claim` tags field type**
   - What we know: `SignagePairingClaimRequest` has `code` and `device_name` confirmed. Tags field exists per D-15/D-07.
   - What's unclear: Whether the claim endpoint accepts `tags: string[]` (tag names) or `tags: uuid[]`. Check `backend/app/routers/signage_pair.py` claim handler at plan time.
   - Recommendation: Tag names are more ergonomic (no pre-lookup needed); verify schema from source.

3. **MediaDeleteDialog — exact 409 body shape**
   - What we know: The backend issues a `JSONResponse` with `detail` string + `playlist_ids` list for RESTRICT violations.
   - What's unclear: Is the count in the `detail` string, or must the frontend derive it from `playlist_ids.length`?
   - Recommendation: Read `backend/app/routers/signage_admin/media.py` delete handler at plan time. The frontend should extract `playlist_ids.length` from the response body if available.

4. **react-pdf CSS import path in Vite**
   - What we know: `react-pdf@10.4.1` provides `dist/Page/AnnotationLayer.css` and `dist/Page/TextLayer.css`.
   - What's unclear: Whether these imports work without additional Vite config for CSS in node_modules.
   - Recommendation: Standard Vite handles CSS imports from `node_modules` without config. Both layers can be disabled with props (`renderTextLayer={false}`) to avoid the import if needed.

---

## Project Constraints (from CLAUDE.md)

- **Containerization:** No bare-metal deps. Frontend `npm` commands run locally; Docker only for `api` + `db` + `directus`.
- **No `dark:` Tailwind variants** — use `bg-background`, `text-foreground`, `bg-muted`, `border-border` tokens only.
- **No direct `fetch()` in admin frontend** — `apiClient<T>()` only. Exception: `@directus/sdk` for D-01 upload.
- **React 19.2.5 + Vite 8.0.8 + TypeScript + Tailwind 4.2.2 + shadcn/ui + Recharts + TanStack Query 5.97.0** — exact stack from CLAUDE.md.
- **`docker compose` (v2, no hyphen)** — not relevant for Phase 46 frontend-only work.
- **GSD Workflow Enforcement** — use `/gsd:execute-phase` for work, not direct edits.

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/hooks/useUnsavedGuard.ts` — read directly; `scopePath` param confirmed
- `frontend/src/lib/apiClient.ts` — read directly; `apiClient<T>()` shape confirmed
- `frontend/src/lib/directusClient.ts` — read directly; singleton with cookie auth confirmed
- `frontend/src/App.tsx` — read directly; wouter flat `<Switch>` routing model confirmed
- `frontend/src/pages/LauncherPage.tsx` — read directly; inline tile pattern confirmed
- `frontend/src/components/DropZone.tsx` — read directly; react-dropzone wrapper pattern confirmed
- `frontend/src/components/DeleteConfirmDialog.tsx` — read directly; dialog shape confirmed
- `frontend/package.json` — read directly; all dependency versions confirmed
- `backend/app/routers/signage_admin/playlist_items.py` — read directly; `PUT /playlists/{id}/items` bulk-replace endpoint confirmed
- `backend/app/routers/signage_admin/media.py` — read directly; `POST /media` and `POST /media/pptx` endpoints confirmed
- `backend/app/schemas/signage.py` — read directly; `SignagePairingClaimRequest`, `SignageMediaRead` schemas confirmed
- npm registry: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`, `react-pdf@10.4.1`, `pdfjs-dist@5.6.205` — all verified current versions

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — project-specific pitfall research from Phase 41-45 context
- `@directus/sdk` installed package introspection — `uploadFiles` confirmed exported; signature inferred from source

### Tertiary (LOW confidence)
- `react-pdf` worker configuration for Vite — inferred from Pitfalls §5 and react-pdf v10 changelog; actual behavior should be verified in Wave 0 with a quick smoke test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from installed `package.json` and npm registry
- Architecture: HIGH — all patterns derived from reading existing source files directly
- API endpoints: HIGH — confirmed from Phase 43/44 backend source
- Pitfalls: HIGH — derived from existing project source + documented PITFALLS.md
- react-pdf/pdfjs-dist version interaction: MEDIUM — version numbers confirmed; exact worker behavior in Vite verified at import level but not runtime-tested

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days; stable stack)
