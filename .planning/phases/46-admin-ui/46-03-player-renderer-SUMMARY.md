---
phase: 46-admin-ui
plan: 03
subsystem: signage-player
tags: [signage, player, react-pdf, frontend]
requires:
  - frontend/src/signage/ directory (created lazily by this plan; 46-01 also creates it)
  - react-pdf@10.4.1 (installed by this plan; matches 46-01 pin)
provides:
  - "<PlayerRenderer items={...} /> presentational module for admin preview + Phase 47 reuse"
  - "PlayerItem TypeScript interface (player-local, distinct from backend SignagePlaylistItem)"
  - "6 format handlers: ImagePlayer/VideoPlayer/PdfPlayer/IframePlayer/HtmlPlayer/PptxPlayer"
affects:
  - 46-05 playlist-editor (will import PlayerRenderer for live preview pane)
  - Phase 47 player bundle (will wrap PlayerRenderer with SSE/heartbeat/offline cache)
tech-stack:
  added:
    - react-pdf@10.4.1 (also pinned independently by 46-01)
  patterns:
    - "Switch-on-kind format dispatch keyed by PlayerItem.kind"
    - "key={current.id} on outer div forces React unmount/remount on item swap"
    - "Reset effect ([items] dep) zeroes currentIndex on prop reference change"
    - "react-pdf default worker config — no GlobalWorkerOptions override (Phase 47 owns pin)"
key-files:
  created:
    - frontend/src/signage/player/types.ts
    - frontend/src/signage/player/ImagePlayer.tsx
    - frontend/src/signage/player/VideoPlayer.tsx
    - frontend/src/signage/player/PdfPlayer.tsx
    - frontend/src/signage/player/IframePlayer.tsx
    - frontend/src/signage/player/HtmlPlayer.tsx
    - frontend/src/signage/player/PptxPlayer.tsx
    - frontend/src/signage/player/PlayerRenderer.tsx
  modified:
    - frontend/package.json (react-pdf@10.4.1)
    - frontend/package-lock.json
decisions:
  - "Installed react-pdf@10.4.1 inside this plan (Rule 3 unblock) — version matches 46-01's pin so wave-1 parallel race is content-identical"
  - "Used setTimeout (not setInterval) for advance so transition gap is deterministic per item"
  - "fadeOut depends on NEXT item's transition (cut → no fade-out) so 'cut' is honored at the swap boundary"
metrics:
  duration_seconds: 152
  tasks_completed: 2
  files_created: 8
  files_modified: 2
  completed_date: "2026-04-19"
---

# Phase 46 Plan 03: Player Renderer Summary

Built the shared `<PlayerRenderer>` plus six format handlers (Image / Video / Pdf / Iframe / Html / Pptx) under `frontend/src/signage/player/` — a pure presentational module that takes in-memory playlist items and auto-advances through them, ready to be reused by the 46-05 admin preview pane and wrapped by the Phase 47 Pi player.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define types.ts and build 6 format handlers | `0141488` | 7 created + react-pdf install |
| 2 | Build PlayerRenderer with auto-advance + format dispatch + fade transition | `c06e5b0` | 1 created |

## What Was Built

- **`types.ts`** — `PlayerItem`, `PlayerItemKind`, `PlayerTransition`. Player-local (NOT backend `SignagePlaylistItem`); 46-05 must join item rows with media records before passing in.
- **`ImagePlayer`** — `<img>` with `object-contain`.
- **`VideoPlayer`** — `<video muted autoPlay playsInline loop>` (loop is admin-preview specific; Phase 47 wrapper disables).
- **`PdfPlayer`** — `react-pdf` `<Document>`/`<Page>` with `renderTextLayer={false}` + `renderAnnotationLayer={false}`. ResizeObserver tracks container width. Auto-flips pages every `autoFlipSeconds` (≥ 1000ms guard). **No `GlobalWorkerOptions` override** — D-11 / Phase 47 owns the worker pin.
- **`IframePlayer`** — `<iframe sandbox="allow-scripts allow-same-origin">` for external URLs.
- **`HtmlPlayer`** — `<iframe srcDoc={html} sandbox="allow-scripts">` (no `allow-same-origin` — server-sanitized content runs in isolated origin).
- **`PptxPlayer`** — Cycles `slide_paths` images, slot = `durationS * 1000 / numSlides` (≥ 1000ms guard), wraps with modulo.
- **`PlayerRenderer`** — `useState(currentIndex)` + `setTimeout` per item. `useEffect([items])` resets index to 0 on prop reference change. Fade derived from NEXT item's `transition` (cut → immediate swap). `key={current.id}` on the outer `div` forces unmount/remount (iframe + react-pdf state reset). Empty-items renders an em-dash placeholder.

## Verification

| Gate | Result |
|------|--------|
| `grep -c "from \"react-pdf\"" PdfPlayer.tsx` == 1 | Pass |
| `grep -c "GlobalWorkerOptions" PdfPlayer.tsx` == 0 | Pass |
| `grep -c renderTextLayer={false} renderAnnotationLayer={false}` PdfPlayer.tsx | Pass (1 each) |
| Video flags `muted/autoPlay/playsInline` present | Pass (3) |
| `Iframe sandbox="allow-scripts allow-same-origin"` | Pass (1) |
| `Html sandbox="allow-scripts"` (no `allow-same-origin`) | Pass (1 / 0) |
| `srcDoc` in HtmlPlayer | Pass |
| `switch (item.kind)` dispatch in PlayerRenderer | Pass |
| Reset-on-items-change effect (`useEffect([items])`) | Pass |
| `transition-opacity duration-300` Tailwind classes | Pass |
| Loop wraparound `% items.length` | Pass (3 occurrences) |
| `clearTimeout` cleanup | Pass |
| No `EventSource / localStorage / serviceWorker / caches.` leak | Pass (0) |
| No `dark:` variants in `signage/player/` | Pass (0) |
| No `fetch(` calls in `signage/player/` | Pass (0) |
| Targeted `tsc --noEmit` on the 8 new files | Clean (only ignorable side-effect CSS-import warnings) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Installed `react-pdf@10.4.1` inside this plan**

- **Found during:** Task 1 setup
- **Issue:** `react-pdf` is owned by Plan 46-01 (foundation) but 46-01 has not yet executed; this plan is wave-1 parallel. Without `react-pdf`, `PdfPlayer.tsx` cannot resolve imports and verification grep / typecheck both fail.
- **Fix:** `npm install --save react-pdf@10.4.1` — same version pin as 46-01.
- **Impact:** `package.json` and `package-lock.json` modified inside this plan. If 46-01's executor commits the same dep, git will see a no-op for the line; lockfile sections may need a merge resolution at integration time but content is identical.
- **Files modified:** `frontend/package.json`, `frontend/package-lock.json`
- **Commit:** `0141488`

### Out-of-Scope Deferrals (Logged, Not Fixed)

`cd frontend && npm run build` exits non-zero due to **pre-existing TypeScript errors in unrelated files**:
- `src/components/dashboard/HrKpiCharts.tsx` — Recharts tooltip prop type drift
- `src/components/dashboard/SalesTable.tsx` — generic data table type
- `src/hooks/useSensorDraft.ts` — `erasableSyntaxOnly` syntax + duplicate keys
- `src/lib/defaults.ts` — missing `sensor_*` fields on Settings

None originate from `signage/player/`. Per scope-boundary rule, these are logged in `.planning/phases/46-admin-ui/deferred-items.md` and NOT touched. Targeted `tsc --noEmit` over only the 8 new files is clean.

The plan's verification step `cd frontend && npm run build` therefore cannot be satisfied as a project-wide gate today; satisfied for this plan's surface via targeted typecheck. Project-wide build hygiene is out of v1.16 Phase 46 scope.

## Authentication Gates

None.

## Phase 47 Hand-off

Phase 47 wrapper can:
```ts
import { PlayerRenderer, type PlayerItem } from "@/signage/player/PlayerRenderer";
```
…and graft on:
- SSE subscription that swaps the `items` prop (currentIndex auto-resets)
- Heartbeat
- Offline cache (Service Worker or Pi sidecar — Decision 3 is open)
- Phase 47 owns the `pdfjs-dist` worker pin and may set `GlobalWorkerOptions.workerSrc` itself if needed.

## Self-Check: PASSED

Files exist:
- FOUND: frontend/src/signage/player/types.ts
- FOUND: frontend/src/signage/player/ImagePlayer.tsx
- FOUND: frontend/src/signage/player/VideoPlayer.tsx
- FOUND: frontend/src/signage/player/PdfPlayer.tsx
- FOUND: frontend/src/signage/player/IframePlayer.tsx
- FOUND: frontend/src/signage/player/HtmlPlayer.tsx
- FOUND: frontend/src/signage/player/PptxPlayer.tsx
- FOUND: frontend/src/signage/player/PlayerRenderer.tsx

Commits exist:
- FOUND: 0141488 feat(46-03): define PlayerItem types and 6 format handlers
- FOUND: c06e5b0 feat(46-03): add PlayerRenderer with auto-advance + format dispatch
