---
phase: 50
plan: 01
subsystem: signage-player
tags: [bundle-size, code-split, react-lazy, pdf, signage]
requires:
  - Phase 47 SGN-PLY-01 bundle guard (check-player-bundle-size.mjs)
  - Phase 46 PlayerRenderer.tsx (admin-side preview)
provides:
  - Player entry bundle <200 KB gz with react-pdf split out
  - Guard script that distinguishes entry vs lazy chunks
affects:
  - frontend/src/signage/player/PlayerRenderer.tsx
  - frontend/scripts/check-player-bundle-size.mjs
tech-stack:
  added: []
  patterns:
    - React.lazy + Suspense with named-export adapter for on-demand component load
    - Rolldown auto code-split via dynamic import()
key-files:
  created: []
  modified:
    - frontend/src/signage/player/PlayerRenderer.tsx
    - frontend/scripts/check-player-bundle-size.mjs
decisions:
  - Measurement semantics fix — LAZY_PREFIXES allowlist keeps entry cap honest post-split
  - Kept pdf.worker.min pin eager in main.tsx (Pitfall 3) — worker resolution unaffected
metrics:
  duration: 4m
  completed: 2026-04-21
requirements:
  - SGN-POL-05
---

# Phase 50 Plan 01: Player Bundle — Dynamic-Import PdfPlayer Summary

Dynamic-imported `PdfPlayer` via `React.lazy` + `<Suspense>` in `PlayerRenderer.tsx` so `react-pdf` + `pdfjs-dist` glue code ships in a separate chunk fetched only when a playlist item with `kind='pdf'` actually renders. Player ENTRY bundle dropped from 204,666 B gz to 76,883 B gz — a 62% reduction of the initial fetch.

## What Shipped

- `frontend/src/signage/player/PlayerRenderer.tsx`
  - Removed static `import { PdfPlayer } from "./PdfPlayer"`.
  - Added `React.lazy(() => import("./PdfPlayer").then((m) => ({ default: m.PdfPlayer })))` — named-export adapter per 50-RESEARCH.md Pitfall 1.
  - Wrapped `case "pdf":` return value in `<Suspense fallback={<div className="w-full h-full bg-black" />}>` — black fallback matches kiosk `PlaybackShell` (invisible to operator).
- `frontend/scripts/check-player-bundle-size.mjs`
  - `LIMIT` reset from `210_000` → `200_000`.
  - Added `LAZY_PREFIXES = ["PdfPlayer-", "pdf-"]` allowlist so lazy chunks are printed but excluded from the entry-cap total.
  - Comment block updated with Phase 50 history + measurement-fix note.
- `main.tsx`, `pdfWorker.ts`, `PdfPlayer.tsx`, `vite.config.ts` — UNCHANGED (per plan Don't Touch list and Pitfall 3).

## Before / After — Player Bundle (gzipped)

Measured from a fresh `rm -rf frontend/dist && vite build --mode player`.

| Chunk (player entry)          | Before (v1.17) | After (Phase 50) |
|-------------------------------|---------------:|-----------------:|
| `player-*.js` (entry)         |      140.41 KB |         10.74 KB |
| `vendor-react-*.js`           |       66.68 KB |         66.68 KB |
| `rolldown-runtime-*.js`       |        0.41 KB |          0.41 KB |
| **Entry total (counted)**     | **207.50 KB**  |     **77.83 KB** |
| **Entry total (bytes)**       | **204,666 B**  |     **76,883 B** |

Post-split lazy chunks (NOT in entry cap — fetched on first PDF render):

| Lazy chunk             |    gz size |   raw size |
|------------------------|-----------:|-----------:|
| `pdf-CnN3goov.js`      |  116.93 KB |  396.87 KB |
| `PdfPlayer-KQHgi5mS.js`|    9.05 KB |   25.39 KB |

`dist/player/assets/pdf.worker.min-FHbmGBN0.mjs` (1,244.25 KB raw) continues to be emitted and is NOT counted against the guard (`.js`-only filter).

## Success Criteria

- [x] Player entry bundle gz < 200,000 B — achieved 76,883 B (38.4% of cap).
- [x] `react-pdf` + pdfjs glue live in separate lazy chunks (`pdf-*.js`, `PdfPlayer-*.js`).
- [x] pdfjs-dist worker (`pdf.worker.min-*.mjs`) still emitted, outside the guarded total.
- [x] Admin bundle still builds — `dist/assets/` contains its own `PdfPlayer-*.js` lazy chunk (129.70 KB gz), `index-*.js` entry unchanged in structure.
- [x] `main.tsx` / `pdfWorker.ts` / `PdfPlayer.tsx` / `vite.config.ts` unmodified (verified via `git diff --stat`).
- [x] Exactly two source files changed: `PlayerRenderer.tsx` and `check-player-bundle-size.mjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bundle-size guard to exclude lazy chunks**
- **Found during:** Task 3 (post-build size-guard run)
- **Issue:** The guard sums ALL `.js` files in `dist/player/assets/`. After dynamic-splitting, the new `pdf-*.js` (116.9 KB gz) and `PdfPlayer-*.js` (9.0 KB gz) chunks are still on disk — the naive total became 205,847 B (higher than pre-split 204,666 B, because code-splitting adds small bookkeeping overhead per chunk). The plan's TRUTH #1 says "Player entry chunk <200 KB gz" — the guard's measurement semantics were out of date for the post-split world.
- **Fix:** Added `LAZY_PREFIXES = ["PdfPlayer-", "pdf-"]` — files with these prefixes are reported as "LAZY chunks (NOT counted)" and excluded from the cap total. Any future lazy-splits must add their prefix here.
- **Files modified:** `frontend/scripts/check-player-bundle-size.mjs`
- **Commit:** `ad081d4`

**2. [Rule 3 - Blocking] Built admin bundle via vite-only (bypassed pre-existing tsc errors)**
- **Found during:** Task 3 (`npm --prefix frontend run build`)
- **Issue:** `npm run build` runs `tsc -b && vite build && vite build --mode player`. The `tsc -b` step surfaced 20+ pre-existing TypeScript errors in `SalesTable.tsx`, `HrKpiCharts.tsx`, `useSensorDraft.ts`, `defaults.ts`, `DeviceEditDialog.tsx` — none of which this plan touches. Verified pre-existing by stashing changes and re-running `tsc -b` on base (same errors).
- **Fix:** Ran `vite build` (admin) and `vite build --mode player` (player) directly. Both succeeded; both bundles emitted cleanly. Per SCOPE BOUNDARY: "pre-existing warnings in unrelated files are out of scope." Recorded to `deferred-items.md` conceptually — these errors are a standing tech-debt surface worth a dedicated polish plan.
- **Files modified:** (none — tooling workaround only)
- **Commit:** N/A

## Known Stubs

None — all data paths are wired end-to-end.

## Commits

- `e770a59` — feat(50-01): dynamic-import PdfPlayer + reset bundle LIMIT to 200_000
- `ad081d4` — fix(50-01): exclude lazy chunks from player entry cap measurement

## SGN-POL-05 Status

CLOSED. Player entry bundle back under 200 KB gz cap (76,883 B / 200,000 B = 38.4%). v1.17 carry-forward resolved.

## Self-Check: PASSED

- frontend/src/signage/player/PlayerRenderer.tsx: FOUND
- frontend/scripts/check-player-bundle-size.mjs: FOUND
- Commit e770a59: FOUND
- Commit ad081d4: FOUND
- `ls dist/player/assets/PdfPlayer-*.js`: FOUND (KQHgi5mS)
- `ls dist/player/assets/pdf.worker.min-*.mjs`: FOUND (FHbmGBN0)
- `node check-player-bundle-size.mjs` exit: 0
