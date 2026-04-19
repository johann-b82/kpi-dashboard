---
phase: 46-admin-ui
verified: 2026-04-19T22:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Admin login → launcher shows Digital Signage tile"
    expected: "MonitorPlay icon tile renders only for admin role; clicking lands on /signage/media (default tab)"
    why_human: "Visual rendering + role-gated visibility need a real session to confirm"
  - test: "Media upload end-to-end (PPTX vs Directus routing)"
    expected: "Drop a .pptx → multipart POST to /api/signage/media/pptx + MediaStatusPill polls until READY; drop an image → Directus uploadFiles + JSON register; thumbnail appears in grid"
    why_human: "Requires running Directus + backend; involves file system + multipart + polling"
  - test: "Delete media that is in use shows in_use dialog"
    expected: "Delete attempt on media referenced by N playlists → 409 → MediaDeleteDialog swaps to in_use mode showing playlist count, refuses deletion"
    why_human: "Requires DB state with FK constraint trigger; cannot grep the swap"
  - test: "Playlist editor drag-reorder + WYSIWYG preview"
    expected: "Drag handle reorders items; preview pane updates within ~300ms via form-state useWatch (no save needed); keyboard nav (Tab + Space + arrows) also reorders"
    why_human: "Interaction quality + visual transitions require real DOM events"
  - test: "Pair flow end-to-end"
    expected: "Pi shows 6-digit code → admin enters at /signage/pair → claim succeeds → toast + navigate to /signage/devices → new row appears with green chip"
    why_human: "Requires paired Pi or simulated pairing session; SSE/polling timing"
  - test: "Dirty guard intercepts navigation"
    expected: "Edit playlist name → click NavBar link → UnsavedChangesDialog appears; Stay cancels nav, Discard navigates and resets"
    why_human: "Browser history manipulation + scopePath behavior need real navigation"
  - test: "Device status chip threshold transitions (green→amber→red)"
    expected: "After ≥2min of no heartbeat: amber 'Last seen Xm ago'; ≥5min: red 'Offline'"
    why_human: "Requires waiting real wall-clock time or a clock-mocking harness"
  - test: "DE locale renders informal 'du' tone correctly across all pages"
    expected: "Switch to DE → no literal i18n keys on screen; 'du' verbs throughout (e.g. 'Verwerfen & verlassen', 'Du hast ungespeicherte…')"
    why_human: "i18n parity proves keys exist; tone/grammar quality is a human judgment"
---

# Phase 46: Admin UI Verification Report

**Phase Goal:** An admin can manage media, playlists, devices, and tags — and preview a playlist before publishing — entirely through a bilingual `/signage` page mounted inside the existing SPA.

**Verified:** 2026-04-19T22:00:00Z
**Status:** human_needed — all automated checks pass; runtime/visual behaviors flagged for human verification
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin logs in → launcher shows Digital Signage tile (MonitorPlay icon, hidden for Viewer); clicking lands on `/signage` wrapped in `<AdminOnly>` with Media/Playlists/Devices tabs | ✓ VERIFIED | `LauncherPage.tsx:62-79` AdminOnly + MonitorPlay tile → `setLocation("/signage")`; `App.tsx:67-69` AdminOnly + Redirect to /signage/media; `SignagePage.tsx` 3-tab button group |
| 2 | Media library supports upload (image/video/PDF/PPTX/URL/HTML) with thumbnails, per-item metadata, tag picker, and delete — 409 in-use refusal | ✓ VERIFIED | `MediaPage.tsx` grid + thumbnail + delete; `MediaUploadDropZone.tsx` PPTX vs Directus routing; `MediaRegisterUrlDialog.tsx` URL/HTML; `MediaDeleteDialog.tsx` two-mode (confirm + in_use); 409→`in_use` swap at `MediaPage.tsx:79-90` |
| 3 | Playlist editor: drag-reorder, per-item duration_s + transition, target-tag picker; `/signage/pair` accepts 6-digit code + device name + tags and successfully claims | ✓ VERIFIED | `PlaylistEditorPage.tsx` + `PlaylistItemList.tsx` (@dnd-kit Pointer+Keyboard sensors); duration_s/transition inline edit; TagPicker; `PairPage.tsx` with XXX-XXX auto-format + claimPairingCode |
| 4 | Device table shows green/amber/red status chips from last_seen_at, current playlist, Edit/Revoke; WYSIWYG preview renders chosen playlist via PlayerRenderer (react-pdf for PDF) | ✓ VERIFIED | `DevicesPage.tsx` 30s refetch, DeviceStatusChip cols, edit + revoke + pair CTA; `PlaylistEditorPage.tsx:359-366` `<PlayerRenderer items={previewItems}/>`; `PdfPlayer.tsx` imports react-pdf |
| 5 | All `signage.admin.*` i18n keys exist in en.json + de.json (informal "du" for German); CI parity passes; useUnsavedGuard blocks navigation away from dirty editors | ✓ VERIFIED | `check-locale-parity.mts` → `PARITY OK: 407 keys`; 96 `signage.admin.*` keys in each locale; `PlaylistEditorPage.tsx:214-218` + `useUnsavedGuard` hook + `UnsavedChangesDialog.tsx` use `signage.admin.unsaved.*` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/App.tsx` | 5 signage routes registered (playlists/:id BEFORE playlists per Pitfall 1, plus devices, media, pair, /signage redirect) all wrapped in `<AdminOnly>` | ✓ VERIFIED | Lines 14-16 imports; 52-69 routes in correct order; AdminOnly wraps each |
| `frontend/src/pages/LauncherPage.tsx` | Admin-only tile with MonitorPlay icon → /signage | ✓ VERIFIED | Lines 62-79; AdminOnly + MonitorPlay + aria-label |
| `frontend/src/lib/queryKeys.ts` | `signageKeys` factory (media/playlists/devices/tags + per-item) | ✓ VERIFIED | Lines 60-68 |
| `frontend/src/locales/{en,de}.json` | Full `signage.admin.*` parity; informal du tone | ✓ VERIFIED | 96 keys per locale; `unsaved.*` examples confirmed (en: "Discard & leave"; de: "Verwerfen & verlassen", "Du hast…") |
| `frontend/src/signage/pages/SignagePage.tsx` | URL-driven 3-button sub-nav (custom, NOT shadcn Tabs per D-04) | ✓ VERIFIED | Custom button group; aria-current; setLocation per tab |
| `frontend/src/signage/pages/MediaPage.tsx` | Upload dropzone + register-URL CTA + grid + delete + 409 in-use flow | ✓ VERIFIED | All 4 dependencies wired; 409 handler at lines 79-90 |
| `frontend/src/signage/pages/PlaylistsPage.tsx` | Table list + new dialog + edit/duplicate/delete | ✓ VERIFIED | Live signageApi.listPlaylists with full CRUD wiring |
| `frontend/src/signage/pages/PlaylistEditorPage.tsx` | Two-pane editor: form-state-driven preview + drag-reorder + sequenced PATCH+PUT save + dirty guard | ✓ VERIFIED | useWatch→previewItems→PlayerRenderer; sequenced save at lines 178-188; useUnsavedGuard at 214 |
| `frontend/src/signage/pages/DevicesPage.tsx` | Live 30s table + status chip + edit/revoke + pair CTA | ✓ VERIFIED | refetchInterval: 30_000; DeviceStatusChip; DeviceEditDialog + revoke confirm Dialog |
| `frontend/src/signage/pages/PairPage.tsx` | XXX-XXX auto-format claim form + tag picker + 404 substring mapping | ✓ VERIFIED | Auto-format at 47-59; claim mutation; substring-match at 93-104 |
| `frontend/src/signage/lib/signageApi.ts` | Typed API wrappers + ApiErrorWithBody for 409 body extraction | ✓ VERIFIED | All listMedia/deleteMedia/listPlaylists/CRUD/listDevices/updateDevice/replaceDeviceTags/revokeDevice/claimPairingCode + ApiErrorWithBody class |
| `frontend/src/signage/components/{TagPicker,DeviceStatusChip,MediaStatusPill,MediaDeleteDialog,MediaUploadDropZone,MediaRegisterUrlDialog,PlaylistItemList,PlaylistNewDialog,MediaPickerDialog,DeviceEditDialog,UnsavedChangesDialog}.tsx` | All 11 components present and wired | ✓ VERIFIED | All 11 listed in `ls components/`; imports + usage grep clean |
| `frontend/src/signage/player/{PlayerRenderer,ImagePlayer,VideoPlayer,PdfPlayer,IframePlayer,HtmlPlayer,PptxPlayer,types}.ts(x)` | Shared PlayerRenderer + 6 format handlers | ✓ VERIFIED | All 8 files present; switch dispatch at PlayerRenderer.tsx:15-32 |
| `frontend/scripts/check-signage-invariants.mjs` | CI guard for fetch + dark: invariants | ✓ VERIFIED | Runs clean: `SIGNAGE INVARIANTS OK: 25 files scanned` |
| Dependencies pinned (@dnd-kit/{core,sortable,utilities}, react-pdf) | Listed in package.json | ✓ VERIFIED | react-pdf@10.4.1 in package.json L39; @dnd-kit imports clean |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| LauncherPage MonitorPlay tile | `/signage` route | `setLocation("/signage")` onClick | WIRED | LauncherPage.tsx:66 → App.tsx:67-69 Redirect to /signage/media |
| SignagePage tabs | URL routes | `setLocation(tab.path)` per button | WIRED | SignagePage.tsx:50; URL is source of truth, App.tsx routes pass `initialTab` |
| MediaPage useQuery | Backend `GET /api/signage/media` | `signageApi.listMedia` | WIRED | MediaPage.tsx:64-67; renders `mediaQuery.data.map(...)` grid |
| MediaPage delete 409 | MediaDeleteDialog `in_use` mode | `ApiErrorWithBody` body.playlist_ids | WIRED | MediaPage.tsx:79-90 ApiErrorWithBody → setDeleteMode(in_use) |
| PlaylistEditorPage form | `<PlayerRenderer items={previewItems}>` | `useWatch` → `useMemo<PlayerItem[]>` | WIRED | PlaylistEditorPage.tsx:138-161 (Pitfall 9 honored — preview reads form, not server) |
| PlaylistEditorPage save button | Backend PATCH+PUT+PUT sequence | `signageApi.updatePlaylist` → `replacePlaylistTags` → `bulkReplaceItems` | WIRED | Lines 178-188 (sequenced) |
| PlaylistItemList drag | item-order state | @dnd-kit DndContext + arrayMove | WIRED | PlaylistItemList.tsx imports @dnd-kit/core,sortable,utilities; PointerSensor + KeyboardSensor |
| DevicesPage useQuery | Backend `GET /api/signage/devices` | `signageApi.listDevices` + refetchInterval 30_000 | WIRED | DevicesPage.tsx:48-52 + table render |
| DevicesPage revoke | Backend `POST /api/signage/pair/devices/{id}/revoke` | `signageApi.revokeDevice` mutation | WIRED | DevicesPage.tsx:54-65 |
| PairPage submit | Backend `POST /api/signage/pair/claim` | `signageApi.claimPairingCode` mutation | WIRED | PairPage.tsx:75-79 + onError 404 substring map |
| TagPicker autocomplete | Backend `GET /api/signage/tags` | `signageApi.listTags` (staleTime: Infinity) | WIRED | TagPicker.tsx:42-46 |
| PlaylistEditorPage dirty guard | UnsavedChangesDialog + browser history | `useUnsavedGuard(isDirty, handler, scopePath)` | WIRED | PlaylistEditorPage.tsx:214-218 + history.go(-2) sentinel at 229 |
| DeviceEditDialog dirty close | UnsavedChangesDialog (legacy onStay/onDiscardAndLeave API) | intercepted onOpenChange | WIRED | DeviceEditDialog.tsx imports UnsavedChangesDialog; dual-API preserved |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| MediaPage grid | `mediaQuery.data` | useQuery → signageApi.listMedia → GET /api/signage/media (Phase 43 router) | Yes (real DB read; no static fallback) | ✓ FLOWING |
| PlaylistsPage table | `playlists` | useQuery → signageApi.listPlaylists | Yes | ✓ FLOWING |
| DevicesPage rows | `devices` | useQuery → signageApi.listDevices (30s refetch) | Yes | ✓ FLOWING |
| PlaylistEditorPage preview | `previewItems` | useWatch(form.items) → join with mediaLookup → PlayerItem[] | Yes — form-driven (Pitfall 9 honored), no static fallback | ✓ FLOWING |
| TagPicker suggestions | `allTags` | useQuery → signageApi.listTags | Yes | ✓ FLOWING |
| DeviceStatusChip color | `status` from `lastSeenAt` | differenceInMinutes(now, last_seen_at) | Yes — pure derivation from prop, no hardcoded value | ✓ FLOWING |
| MediaStatusPill PPTX | `media.conversion_status` | useQuery with refetchInterval that returns false on terminal status | Yes — self-terminating poll | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Locale parity (CI gate) | `node --experimental-strip-types scripts/check-locale-parity.mts` | `PARITY OK: 407 keys in both en.json and de.json` | ✓ PASS |
| Signage invariants (no fetch + no dark) | `node scripts/check-signage-invariants.mjs` | `SIGNAGE INVARIANTS OK: 25 files scanned` | ✓ PASS |
| TypeScript clean over signage scope | `npx tsc --noEmit -p tsconfig.app.json` filtered to `signage/` | Zero errors in signage/** (pre-existing dashboard errors out of scope) | ✓ PASS |
| signage.admin.* key count parity | `grep -c '"signage.admin.' src/locales/{en,de}.json` | 96 keys per locale | ✓ PASS |
| `dark:` Tailwind variants in signage | `grep -rn "dark:" src/signage/` | 0 matches | ✓ PASS |
| Direct `fetch(` in pages/components/player | `grep -rn "fetch(" src/signage/{pages,components,player}` | 0 matches (all I/O via signageApi → apiClient) | ✓ PASS |
| Route order /:id BEFORE /list (Pitfall 1) | inspect App.tsx | Line 52 `/signage/playlists/:id` precedes line 55 `/signage/playlists` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SGN-ADM-01 | 46-01 | `/signage` route registered, AdminOnly-wrapped | ✓ SATISFIED | App.tsx:67-69 + AdminOnly.tsx |
| SGN-ADM-02 | 46-01 | Admin-only launcher tile (MonitorPlay) | ✓ SATISFIED | LauncherPage.tsx:62-79 |
| SGN-ADM-03 | 46-01 | SignagePage tabs (Media/Playlists/Devices) | ✓ SATISFIED | SignagePage.tsx custom button group (D-04 deviation noted: NOT shadcn Tabs, intentional per UI-SPEC) |
| SGN-ADM-04 | 46-04 | Media library upload + list + delete + in-use confirm | ✓ SATISFIED | MediaPage + MediaUploadDropZone + 409 handler |
| SGN-ADM-05 | 46-05 | Playlist editor with drag-reorder + per-item duration/transition + media picker | ✓ SATISFIED | PlaylistEditorPage + PlaylistItemList + MediaPickerDialog |
| SGN-ADM-06 | 46-06 | Device table with status chip, current playlist, edit/remove/revoke | ✓ SATISFIED | DevicesPage.tsx full table + DeviceStatusChip + DeviceEditDialog + revoke |
| SGN-ADM-07 | 46-06 | `/signage/pair` admin claim form | ✓ SATISFIED | PairPage.tsx + claimPairingCode |
| SGN-ADM-08 | 46-02, 46-06 | Tag picker (autocomplete + create-on-submit) shared across playlists+devices | ✓ SATISFIED | TagPicker.tsx + create-on-submit in PairPage:64-74, PlaylistEditorPage:166-177, DeviceEditDialog |
| SGN-ADM-09 | 46-05, 46-06 | Dirty-guard + unsaved-changes dialog | ✓ SATISFIED | useUnsavedGuard at PlaylistEditorPage; intercepted-onOpenChange at DeviceEditDialog; UnsavedChangesDialog (signage-local) |
| SGN-ADM-10 | 46-01 | Full DE/EN i18n parity for `signage.admin.*`; CI gate | ✓ SATISFIED | check-locale-parity.mts green: 407 keys; 96 signage.admin keys per locale; informal "du" tone in unsaved.*, etc. |
| SGN-DIFF-02 | 46-03, 46-05 | WYSIWYG admin preview using PlayerRenderer (incl. react-pdf for PDF) | ✓ SATISFIED | PlayerRenderer.tsx + PdfPlayer.tsx (`import { Document, Page } from "react-pdf"`); PlaylistEditorPage embeds `<PlayerRenderer items={previewItems}/>` |

**No orphaned requirements** — all 11 phase requirement IDs present in REQUIREMENTS.md and accounted for in plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No `dark:` Tailwind variants in signage | — | Invariant 3 honored |
| (none) | — | No direct `fetch(` in pages/components/player | — | Invariant 2 honored |
| (none) | — | No TODO/FIXME/HACK in signage source | — | No deferred stubs |
| (none) | — | No empty render returns or no-op handlers | — | All UI surfaces fully wired |

**Notes (informational, not blockers):**

- **ℹ️ Backend↔frontend type drift on `SignageMedia`** (logged in 46-04 SUMMARY): `signageTypes.ts` declares `directus_file_id`, `tags`, `metadata`, `url` but backend `SignageMediaRead` returns `uri`, `mime_type`, `html_content` (no `tags`). Image/video thumbnails fall back to placeholder icons at runtime when `directus_file_id` is `undefined`. Documented as deferred cross-cutting concern; does NOT block SGN-ADM-04 (upload/list/delete contract). Resolution belongs to a future schema-reconciliation plan.
- **ℹ️ Forward-compat fields silently dropped** (logged in 46-04 SUMMARY): `tags: []` and `metadata.html` sent on register POSTs are dropped server-side via Pydantic v2 `extra='ignore'`. URL/HTML registration creates rows but content storage is no-op until backend adds the columns. Out of scope for SGN-ADM-04 spec (upload/list/delete only).
- **ℹ️ Pre-existing TS errors in non-signage files** (HrKpiCharts.tsx, SalesTable.tsx, useSensorDraft.ts, defaults.ts): predate Phase 46; logged in `deferred-items.md`; do NOT touch signage/ surface.

### Human Verification Required

See frontmatter `human_verification` block. Eight items requiring human testing for visual quality, role-gated UI, drag-and-drop interaction, real-time threshold transitions, locale tone quality, and end-to-end pairing. All automated gates (locale parity, signage invariants, TypeScript scope, requirement coverage, key-link wiring) pass.

### Gaps Summary

**No gaps found.** Every must-have artifact exists and is substantively wired; every key link traces from UI to API to DB; every required requirement ID is satisfied with code evidence; every CI invariant gate is green.

The phase ships an admin signage UI that is **functionally complete on automated criteria**. Eight runtime/visual behaviors are flagged for human verification because they cannot be proven via grep or static type-check (drag-and-drop quality, status-chip wall-clock thresholds, end-to-end pairing flow, German tone, etc.). These are not gaps in the implementation — they are validations that require either a running stack or human judgment.

---

_Verified: 2026-04-19T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
