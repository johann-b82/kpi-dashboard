# Phase 46: Admin UI - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a bilingual (DE/EN, informal "du") admin surface inside the existing Vite SPA that lets an admin manage signage media, playlists, devices, and tags — plus preview a playlist before publishing — entirely through `/signage/*` routes wrapped in `<AdminOnly>`, reusing the v1.11 `apiClient` and v1.15 `UnsavedGuard` patterns. Scope includes the launcher tile, Media/Playlists/Devices sub-pages, a full-width playlist editor with drag-reorder, the `/signage/pair` claim page, a shared `<PlayerRenderer>` (format handlers) used by the admin preview panel AND reused by Phase 47, and full `signage.admin.*` i18n parity. Out of scope: Phase 47 Pi player shell (token pairing, SSE watchdog, offline cache), Phase 48 provisioning/docs.

</domain>

<decisions>
## Implementation Decisions

### Media upload
- **D-01:** **Non-PPTX upload uses Directus `/files` then register-in-backend.** Frontend uploads the file via `@directus/sdk` `uploadFiles` (admin JWT), receives the Directus file UUID, then calls `POST /api/signage/media` with `{kind, title, directus_file_id, tags, metadata}`. Resolves Phase 43 D-21 and matches SGN-ADM-04's literal wording. Backend reads the file via the RO `directus_uploads` mount set up in SGN-INF-02.
- **D-02:** **PPTX uses the same dropzone, routed by extension.** One drop target on the Media tab. If `file.name.endsWith('.pptx')` the frontend posts multipart to `POST /api/signage/media/pptx` (Phase 44 endpoint) instead of going through Directus. Status pill (`pending / processing / done / failed` with `conversion_error`) surfaces inline on the media row, auto-refreshed via TanStack Query until terminal state.
- **D-03:** URL and HTML "media" (kind=`url` / kind=`html`) skip the dropzone entirely — use a "Register URL / HTML" button opening a small form → direct `POST /api/signage/media`.

### Routing / navigation
- **D-04:** **URL-routed sub-pages** for tabs: `/signage/media`, `/signage/playlists`, `/signage/devices`. `/signage` redirects to `/signage/media`. Mirrors the `SettingsPage.tsx` shell — a single `SignagePage.tsx` renders the tab bar (shadcn-style button group, NOT in-page `<Tabs>`) + `<Outlet />`. Each sub-page owns its own `useUnsavedGuard` scope.
- **D-05:** `/signage/pair` is a **top-level route** (NOT nested under `/devices`). Reachable from a "Pair new device" CTA on the Devices tab. Matches ROADMAP wording and makes the URL bookmarkable during rollout.
- **D-06:** Route registration lives in `frontend/src/App.tsx`, wrapped in `<AdminOnly>` (SGN-ADM-01). Viewer JWT hitting any `/signage/*` route falls through the existing `AdminOnly` redirect path.

### Playlist editor
- **D-07:** **Separate full-width route** `/signage/playlists/:id` for the editor. List page (`/signage/playlists`) shows a table with Edit / Duplicate / Delete actions. Isolated dirty-guard scope per playlist edit session.
- **D-08:** **Preview dock**: responsive split layout — item list on the left, live `<PlayerRenderer>` preview on the right on wide screens (≥lg breakpoint); stacks vertically on narrower viewports. No collapse toggle; preview is always present so admins see timing/transition edits in real time.

### WYSIWYG preview (SGN-DIFF-02)
- **D-09:** **Build a shared `<PlayerRenderer>` in this phase** at `frontend/src/signage/player/`. Houses ImagePlayer (fade), VideoPlayer (`<video muted autoplay playsinline>`), PdfPlayer (`react-pdf`), IframePlayer (sandboxed), HtmlPlayer (nh3-sanitized — sanitization on the backend already, frontend renders in sandboxed `<iframe srcdoc>`), PptxPlayer (image-sequence from `slide_paths`). Phase 47 imports and wraps this component with pairing, SSE watchdog, heartbeat, and offline cache. Zero renderer duplication between admin preview and Pi player.
- **D-10:** Admin preview does NOT implement the 45s SSE watchdog, 60s heartbeat, or the service-worker offline cache — those are Phase 47 wrappers, not `<PlayerRenderer>` concerns. Admin preview is a pure in-memory playlist loop.
- **D-11:** **PDF preview uses `react-pdf`** (new dep, wraps `pdfjs-dist`). Phase 47's Pi `PdfPlayer` will reuse the same `react-pdf` component so there is one PDF stack across admin and player. pdfjs-dist version pinned per Phase 47 PLAN (roadmap cites `5.6.205`); confirm lock at planning time. pdf.js worker configured via `?url` import (per SGN-PLY-10 — the player phase will revisit; admin side can use the default react-pdf worker config).

### Playlist item reorder
- **D-12:** **Drag-reorder uses `@dnd-kit`** (new dep: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`). Required for SGN-ADM-05. Keyboard + touch a11y out of the box. On drop, the editor marks the form dirty; save issues a bulk reorder (`PUT /api/signage/playlists/{id}/items/reorder` or equivalent — exact endpoint confirmed against Phase 43 `signage_admin/playlist_items.py`).

### Data freshness
- **D-13:** **Admin UI does NOT subscribe to the Phase 45 SSE `/stream`**. Data freshness is TanStack Query:
  - Mutation-invalidation on every successful admin write (`queryClient.invalidateQueries` on the affected resource).
  - `refetchOnWindowFocus: true` (default) on all signage queries.
  - Devices tab adds a 30s `refetchInterval` so status chips update while the tab is visible.
  The `/stream` endpoint is device-token-scoped anyway; adding an admin-JWT variant is out of scope for this phase.

### Device status chips (SGN-ADM-06)
- **D-14:** **Thresholds from `last_seen_at`:** green `< 2min`, amber `2–5min`, red `> 5min`. Red aligns with the Phase 43 D-14 heartbeat sweeper's 5-min offline flip. Paired-but-never-seen devices render a neutral grey "unseen" chip, not red. Computed client-side from `last_seen_at` + `Date.now()` so chips update live without a server round-trip.

### Tag picker (SGN-ADM-08)
- **D-15:** **Token-chip input** — single reusable `<TagPicker>` component used by both the playlist editor and the device edit form. Behaviour:
  - Typing filters an autocomplete dropdown of existing tags (fetched once per session, TanStack Query).
  - `Enter` or `,` commits the current input — existing tag → add as chip; unknown text → "create on submit" (POST to tags endpoint on form save, not on Enter).
  - `Backspace` on empty input removes the last chip.
  - Chips are removable with an `×` button.
  - "du" tone for DE placeholder / empty states.

### i18n (SGN-ADM-10)
- **D-16:** All new keys go under `signage.admin.*` in both `frontend/src/locales/en.json` and `de.json`, informal "du" in German. Launcher tile key: `launcher.tiles.signage` (EN/DE both "Digital Signage"). CI parity check (existing missing-key gate) must stay green. No key lands in code without both locales populated.

### Dirty-guard (SGN-ADM-09)
- **D-17:** Reuse existing `useUnsavedGuard` from `frontend/src/hooks/useUnsavedGuard.ts`. Scopes: playlist editor, device edit form, tag picker in-progress edits. Per-sub-page scope means switching tabs is fine as long as the current sub-page is clean.

### apiClient
- **D-18:** **Every signage admin API call goes through the shared `apiClient<T>()`** from `frontend/src/lib/apiClient.ts` (v1.11 pattern). The ONE exception is the Directus upload in D-01, which uses `@directus/sdk`. Grep guard: `grep -rn "fetch(" frontend/src/signage` must return zero (add to CI per v1.16 invariants).

### Claude's Discretion
- File/folder layout under `frontend/src/signage/` — pages vs components split, whether `<PlayerRenderer>` lives in `signage/player/` vs `signage/shared/player/`. Planner picks per existing frontend conventions.
- Exact endpoint URL for bulk playlist-item reorder — confirm against Phase 43 router code at planning time.
- Whether the launcher tile lives in `LauncherPage.tsx` inline or a new `SignageLauncherTile.tsx` — mirror how existing tiles are structured.
- Shape of the in-use-by-N-playlists confirm dialog — reuse `DeleteConfirmDialog.tsx` or extend it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §SGN-ADM-01..10 — 10 admin-frontend requirements this phase closes
- `.planning/REQUIREMENTS.md` §SGN-DIFF-02 — WYSIWYG admin preview (react-pdf)
- `.planning/ROADMAP.md` §"Phase 46: Admin UI" — phase goal + 5 success criteria are the verification checklist
- `.planning/ROADMAP.md` §Invariant "No direct `fetch()` in admin frontend — apiClient only"
- `.planning/ROADMAP.md` §Invariant "Router-level admin gate" (Phase 43 enforced backend-side; this phase mirrors on frontend via `<AdminOnly>`)

### Prior phase context (consumed, not modified)
- `.planning/phases/41-signage-schema-models/41-CONTEXT.md` — `signage_media` / `signage_playlists` / `signage_devices` schema, tag tables, FK semantics (ON DELETE RESTRICT drives D-02's in-use dialog)
- `.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md` — pairing session lifecycle; the `/signage/pair` claim endpoint contract
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` §D-21 — upload-shape open question, resolved here in D-01/D-02
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` §D-14 — 5-min offline sweeper cadence (threshold for D-14 here)
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` §D-16 — media hard-delete + RESTRICT 409 surface (drives SGN-ADM-04 in-use dialog)
- `.planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md` §D-07..D-14 — PPTX state machine + `POST /api/signage/media/pptx` contract + `conversion_error` taxonomy surfaced in D-02's status pill
- `.planning/phases/45-sse-broadcast/45-CONTEXT.md` — `/stream` contract (NOT consumed by admin per D-13, but referenced for context)

### Existing frontend patterns to mirror
- `frontend/src/pages/SettingsPage.tsx` — sub-page shell pattern (drives D-04 tab model)
- `frontend/src/pages/SensorsPage.tsx` — SPA data page w/ TanStack Query (drives D-13)
- `frontend/src/pages/LauncherPage.tsx` — tile composition (drives SGN-ADM-02)
- `frontend/src/auth/AdminOnly.tsx` — admin route wrapper (SGN-ADM-01)
- `frontend/src/hooks/useUnsavedGuard.ts` — dirty-guard pattern (SGN-ADM-09, D-17)
- `frontend/src/lib/apiClient.ts` — bearer-attach + 401-refresh-retry (D-18)
- `frontend/src/lib/directusClient.ts` — existing `@directus/sdk` bootstrap (used by D-01 uploads)
- `frontend/src/components/DeleteConfirmDialog.tsx` — reusable destructive-action dialog (extended for SGN-ADM-04 "in use by N playlists")
- `frontend/src/components/DropZone.tsx` — existing dropzone wrapper around `react-dropzone` (reused in D-02 media dropzone)

### Cross-cutting hazards + pitfalls
- `.planning/research/PITFALLS.md` §15 — Directus file storage path vs URL mismatch (drives D-01 field on register payload — file UUID, not path)
- `.planning/research/PITFALLS.md` §18 — PWA / HTTPS constraint (Phase 47 concern; NOT triggered by admin — noted for completeness)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<AdminOnly>` wrapper — wraps every `/signage/*` route (SGN-ADM-01).
- `apiClient<T>()` — every signage admin call (D-18).
- `@directus/sdk` via `directusClient.ts` — Directus file upload path (D-01).
- `useUnsavedGuard` — dirty-guard on editors (D-17).
- `DropZone.tsx` (react-dropzone wrapper) — Media tab upload UI.
- `DeleteConfirmDialog.tsx` — extended for "in use by N playlists" variant.
- shadcn primitives already installed: card, dialog, form, input, button, table, badge, checkbox, popover, label, separator, calendar, segmented-control.
- `react-hook-form` + `zod` + `@hookform/resolvers` — all forms (media edit, playlist edit, device edit, pair).
- `sonner` — toast notifications for mutation outcomes.
- `lucide-react` — icons incl. `MonitorPlay` for launcher tile (SGN-ADM-02).
- `date-fns` — `last_seen_at` deltas for device status chip (D-14).

### New dependencies this phase introduces
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — playlist drag-reorder (D-12).
- `react-pdf` — admin + player PDF rendering (D-11). Phase 47 reuses.

### Missing shadcn components to add
- `shadcn-ui add tabs` — if planner decides to use `<Tabs>` *within* a sub-page (not for top-level nav per D-04). Not strictly required.

### Established Patterns
- Sub-page shell: `SettingsPage.tsx` renders tab/nav bar + `<Outlet />`; each sub-page is a sibling route.
- Data fetching: `useQuery` + `useMutation` with `queryClient.invalidateQueries` on success; toasts via `sonner`.
- Error surfaces: 401 → automatic refresh-retry in apiClient; 4xx → toast + inline form error; 409 (RESTRICT) → confirm dialog with server-provided detail count.
- i18n: `useTranslation()` + nested key access; DE uses informal "du" (established v1.15 convention).

### Integration Points
- `App.tsx` — new routes under `<AdminOnly>`: `/signage`, `/signage/media`, `/signage/playlists`, `/signage/playlists/:id`, `/signage/devices`, `/signage/pair`.
- `LauncherPage.tsx` — new `MonitorPlay` tile, admin-only, i18n key `launcher.tiles.signage` (SGN-ADM-02).
- `en.json` / `de.json` — new `signage.admin.*` namespace + `launcher.tiles.signage` key.
- `lib/apiClient.ts` — no change needed; signage uses existing entry.
- `lib/directusClient.ts` — extend only if needed for file upload helpers (D-01).

</code_context>

<specifics>
## Specific Ideas

- Admin preview must update live as the admin edits item duration / transition — `<PlayerRenderer>` takes the in-memory form state, not persisted state, so edits reflect without saving first.
- Drag-reorder must work with keyboard (a11y). `@dnd-kit` keyboard sensor is required — not just pointer.
- Status chip must not flicker during a network blip — derive from `last_seen_at` server-side timestamp, not a client-side WebSocket; 30s `refetchInterval` is enough to keep thresholds current.
- Tag picker's "create on submit" means the tag is only persisted when the parent form saves — avoids orphaned tags from abandoned edits.
- `/signage/pair` mirrors the operator-facing flow: admin reads 6-digit code off the Pi screen, types it + device name + tags, submits. Success → toast + redirect to `/signage/devices` with the new row highlighted.
- German "du" tone: "Lösche dieses Medium?" (not "Möchten Sie dieses Medium löschen?").

</specifics>

<deferred>
## Deferred Ideas

- **Admin-JWT SSE stream** — Phase 45 `/stream` is device-token-scoped. An admin-facing real-time stream would be nice but is deferred (Phase 45 polling + TanStack Query refetches are sufficient for v1.16).
- **Playlist preview export / share link** — no ability to share a preview URL with a colleague; could be a future enhancement.
- **Bulk tag operations** (rename, merge) — out of scope; tag picker creates on save, no admin CRUD for tags themselves beyond what pops out of playlist/device edits.
- **Media library bulk actions** (multi-select delete, bulk tag) — SGN-ADM-04 covers single-item operations; bulk is deferred.
- **Dayparting / scheduled playlists** — already in REQUIREMENTS.md as SGN-FUTURE-01.
- **Keyboard shortcuts for playlist editor** (e.g. ⌘↑/⌘↓ to reorder without dragging) — nice-to-have; `@dnd-kit` keyboard sensor covers baseline a11y.

</deferred>

---

*Phase: 46-admin-ui*
*Context gathered: 2026-04-19*
