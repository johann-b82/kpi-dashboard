# Phase 46: Admin UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 46-admin-ui
**Areas discussed:** Media upload path, Tab navigation model, Playlist editor layout, WYSIWYG preview, Drag-reorder library, Admin data freshness, Device status thresholds, Tag picker UX

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Media upload path | Resolves Phase 43 D-21 | ✓ |
| Tab navigation model | In-page tabs vs URL-routed | ✓ |
| Playlist editor layout | Route vs inline vs modal | ✓ |
| WYSIWYG preview | Shared renderer vs simplified vs defer | ✓ |
| Drag-reorder library | dnd-kit vs native vs deprecated | ✓ |
| Admin data freshness | Query-only vs SSE | ✓ |
| Device status thresholds | Green/amber/red cutoffs | ✓ |
| Tag picker UX | Chip input vs combobox | ✓ |

**User's choice:** All 8 areas.

---

## Media upload path

| Option | Description | Selected |
|--------|-------------|----------|
| Directus /files then register | Frontend uploads via `@directus/sdk`, backend registers UUID | ✓ |
| Backend multipart proxy | Frontend → backend → directus_uploads volume | |
| URL/HTML direct-register only | No in-app upload, only URL registration | |

**User's choice:** Directus /files then register (Recommended) — D-01.

### PPTX sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Same dropzone, routed by extension | Sniff `.pptx`, post to PPTX endpoint | ✓ |
| Separate "Upload PPTX" button | Explicit PPTX-only CTA | |

**User's choice:** Same dropzone (Recommended) — D-02.

---

## Tab navigation model

| Option | Description | Selected |
|--------|-------------|----------|
| URL-routed sub-pages | `/signage/media|playlists|devices` | ✓ |
| In-page shadcn <Tabs> | Single `/signage` route, client tab state | |
| Hybrid with ?tab= query | One route, query-param tab | |

**User's choice:** URL-routed sub-pages (Recommended) — D-04.

### /signage/pair sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level /signage/pair | Direct bookmarkable route | ✓ |
| Nested /signage/devices/pair | Inside Devices tab | |

**User's choice:** Top-level (Recommended) — D-05.

---

## Playlist editor layout

| Option | Description | Selected |
|--------|-------------|----------|
| Separate route /signage/playlists/:id | Full-width editor route | ✓ |
| Inline expand on list page | Expandable row editor | |
| Modal/dialog editor | Full-screen modal | |

**User's choice:** Separate route (Recommended) — D-07.

### Preview dock sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Right side-by-side, stacks on narrow | Responsive split layout | ✓ |
| Collapsible panel | Hidden until toggled | |
| Separate /preview route | Navigate away to preview | |

**User's choice:** Responsive side-by-side (Recommended) — D-08.

---

## WYSIWYG preview

| Option | Description | Selected |
|--------|-------------|----------|
| Shared <PlayerRenderer>, Phase 47 wraps | Format handlers built here, player phase reuses | ✓ |
| Admin-only simplified preview | Thumbnails + timing chart only | |
| Stub + defer to Phase 47 | Skip SGN-DIFF-02 this phase | |

**User's choice:** Shared <PlayerRenderer> (Recommended) — D-09/D-10.

### PDF lib sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| react-pdf | Wraps pdfjs-dist; higher-level API | ✓ |
| pdfjs-dist directly | Lower-level; matches Phase 47 SGN-PLY-10 | |

**User's choice:** react-pdf (Recommended) — D-11.

---

## Drag-reorder library

| Option | Description | Selected |
|--------|-------------|----------|
| @dnd-kit | Modern, a11y, touch | ✓ |
| HTML5 native | No dep, more boilerplate | |
| react-beautiful-dnd | Deprecated | |

**User's choice:** @dnd-kit (Recommended) — D-12.

---

## Admin data freshness

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack Query only | refetchOnFocus + invalidation + 30s interval on Devices | ✓ |
| Add SSE subscription | Admin subscribes to /stream | |

**User's choice:** TanStack Query only (Recommended) — D-13.

---

## Device status thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Green <2min, amber 2–5min, red >5min | Aligns with sweeper offline cutoff | ✓ |
| Green <1min, amber 1–5min, red >5min | Tighter green | |
| Binary green/red at 5min | No amber | |

**User's choice:** 2min / 5min thresholds (Recommended) — D-14.

---

## Tag picker UX

| Option | Description | Selected |
|--------|-------------|----------|
| Token-chip input w/ autocomplete | Enter/comma commits, chips below, backspace removes | ✓ |
| Combobox with checkboxes + Create | Dropdown multi-select | |

**User's choice:** Token-chip input (Recommended) — D-15.

---

## Claude's Discretion

- Folder layout under `frontend/src/signage/`
- Exact bulk reorder endpoint URL (confirm against Phase 43 router code)
- Launcher tile: inline in `LauncherPage.tsx` vs new component
- DeleteConfirmDialog reuse vs extension for "in use by N playlists"

## Deferred Ideas

- Admin-JWT SSE stream
- Playlist preview share link
- Bulk tag operations (rename, merge)
- Bulk media actions (multi-select delete/tag)
- Dayparting (already SGN-FUTURE-01)
- Keyboard shortcut reorder (⌘↑/⌘↓)
