---
phase: 50-pi-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/player/PlayerRenderer.tsx
  - frontend/scripts/check-player-bundle-size.mjs
autonomous: true
requirements:
  - SGN-POL-05
must_haves:
  truths:
    - "Player entry chunk (dist/player/assets/*.js) totals <200 KB gz after npm run build"
    - "Playlists with no PDF items do NOT fetch react-pdf / PdfPlayer at initial page load"
    - "First PDF item renders correctly (lazy chunk loads, fades in within ~1 s on LAN)"
    - "Admin playlist-editor preview still renders PDF items without regression"
  artifacts:
    - path: "frontend/src/signage/player/PlayerRenderer.tsx"
      provides: "Lazy-loaded PdfPlayer via React.lazy + Suspense"
      contains: "lazy(() => import"
    - path: "frontend/scripts/check-player-bundle-size.mjs"
      provides: "200_000 byte gz limit enforced"
      contains: "LIMIT = 200_000"
  key_links:
    - from: "frontend/src/signage/player/PlayerRenderer.tsx"
      to: "frontend/src/signage/player/PdfPlayer.tsx"
      via: "dynamic import() inside React.lazy, wrapped in <Suspense fallback={...}>"
      pattern: "lazy\\(\\(\\) => import\\(\"\\./PdfPlayer\"\\)"
    - from: "frontend/scripts/check-player-bundle-size.mjs"
      to: "dist/player/assets/*.js"
      via: "gzipSync measurement of concatenated .js files against LIMIT=200_000"
      pattern: "LIMIT = 200_000"
---

<objective>
Dynamic-import `PdfPlayer` (and therefore the `react-pdf` + pdfjs-dist glue it pulls in) in the signage player so the initial player bundle drops back under 200 KB gz. Reset `check-player-bundle-size.mjs` `LIMIT` from `210_000` to `200_000` and prove the guard passes on a fresh build.

Purpose: Close SGN-POL-05 — v1.17 carry-forward from Phase 47 Plan 47-05 UAT. PDF-heavy pdfjs glue should only be fetched by devices that actually encounter a `pdf`-kind playlist item. This shrinks the hot path for image/video/url/html/pptx-only playlists (the common case in v1.16 deployments).

Output:
- `PlayerRenderer.tsx` uses `React.lazy` + `<Suspense>` for the `case "pdf":` branch.
- `check-player-bundle-size.mjs` has `LIMIT = 200_000` with an updated comment block explaining the Phase 48 → Phase 50 history.
- `npm --prefix frontend run build` succeeds for BOTH bundles (player AND admin — PlayerRenderer is shared).
- `node frontend/scripts/check-player-bundle-size.mjs` exits 0 post-build.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/50-pi-polish/50-RESEARCH.md
@frontend/src/signage/player/PlayerRenderer.tsx
@frontend/src/signage/player/PdfPlayer.tsx
@frontend/scripts/check-player-bundle-size.mjs
@frontend/src/player/main.tsx
@frontend/src/player/lib/pdfWorker.ts

<interfaces>
<!-- Extracted from frontend/src/signage/player/PlayerRenderer.tsx (top of file, current state) -->

Current static imports (to change):
```tsx
import { useEffect, useState } from "react";
import type { PlayerItem } from "./types";
import { ImagePlayer } from "./ImagePlayer";
import { VideoPlayer } from "./VideoPlayer";
import { PdfPlayer } from "./PdfPlayer";       // <-- REMOVE this static import
import { IframePlayer } from "./IframePlayer";
import { HtmlPlayer } from "./HtmlPlayer";
import { PptxPlayer } from "./PptxPlayer";
```

`PdfPlayer` is a NAMED export in `PdfPlayer.tsx` (NOT a default export) — the `React.lazy` call MUST use the adapter form `.then((m) => ({ default: m.PdfPlayer }))` (Pitfall 1 in 50-RESEARCH.md).

The `case "pdf":` branch of `renderItem` currently returns:
```tsx
case "pdf":
  return <PdfPlayer uri={item.uri} autoFlipSeconds={item.duration_s} />;
```

Must be wrapped in `<Suspense fallback={<div className="w-full h-full bg-black" />}>` — black fallback matches the surrounding `PlaybackShell` `bg-black` and is invisible-to-operator in the kiosk (Pitfall 4).

**DO NOT touch** `frontend/src/player/main.tsx` or `frontend/src/player/lib/pdfWorker.ts`. The `?url` import of `pdfjs-dist/build/pdf.worker.min.mjs` must stay in the eager path at module-init time (Pitfall 3 in 50-RESEARCH.md) — moving it into `PdfPlayer.tsx` breaks worker resolution on first PDF render.

`check-player-bundle-size.mjs` current constant line (approx line 21):
```js
const LIMIT = 210_000;
```
Must become:
```js
const LIMIT = 200_000;
```
And the multi-line comment block at the top must be updated to reflect Phase 50's reset.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Measure baseline bundle size on fresh build</name>
  <files>(none modified — measurement only)</files>
  <read_first>
    - frontend/scripts/check-player-bundle-size.mjs (confirm LIMIT is still 210_000 and .js-only filter)
    - frontend/vite.config.ts (confirm no manualChunks entry would reabsorb a lazy chunk)
    - .planning/phases/50-pi-polish/50-RESEARCH.md §"Bundle Composition — current state" and §OQ1
  </read_first>
  <action>
    Capture the current (pre-change) bundle baseline so the SUMMARY can record before/after.

    Run, from repo root:

    ```bash
    rm -rf frontend/dist/player
    npm --prefix frontend run build:player
    node frontend/scripts/check-player-bundle-size.mjs || true   # tolerate exit 1 if already over — we want the number
    ```

    Record in your scratchpad (for the SUMMARY):
    - Exact gz totals printed by `check-player-bundle-size.mjs`.
    - Per-file breakdown (the script prints per-file gz sizes).
    - Specifically the `player-*.js` and `vendor-react-*.js` gz sizes.

    Do NOT commit any changes in this task. This is a read/measure step.
  </action>
  <verify>
    <automated>test -d frontend/dist/player/assets &amp;&amp; ls frontend/dist/player/assets/player-*.js &gt;/dev/null</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/dist/player/assets/` exists after task completes
    - At least one file matching `player-*.js` exists in that directory
    - Baseline gz total is captured as a number in the task output (for SUMMARY)
    - No source files modified by this task (git diff --stat shows no frontend/src/** changes)
  </acceptance_criteria>
  <done>Baseline player bundle gz total recorded (for use in SUMMARY before/after table). Build artifact present in dist/player/assets.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Dynamic-import PdfPlayer in PlayerRenderer.tsx + reset LIMIT to 200_000</name>
  <files>frontend/src/signage/player/PlayerRenderer.tsx, frontend/scripts/check-player-bundle-size.mjs</files>
  <read_first>
    - frontend/src/signage/player/PlayerRenderer.tsx (FULL file — see current static import at line 5 and the `case "pdf":` branch in renderItem)
    - frontend/src/signage/player/PdfPlayer.tsx (confirm it uses a NAMED export `export function PdfPlayer` / `export const PdfPlayer` — NOT default)
    - frontend/scripts/check-player-bundle-size.mjs (confirm LIMIT line and the header comment block format)
    - .planning/phases/50-pi-polish/50-RESEARCH.md §"Architecture Patterns — Recommended edit", §"Size-guard edit", §Pitfall 1, §Pitfall 3, §Pitfall 4
  </read_first>
  <action>
    Make TWO file edits. Apply both before verification.

    **Edit A — `frontend/src/signage/player/PlayerRenderer.tsx`:**

    1. Remove the static import line `import { PdfPlayer } from "./PdfPlayer";` (currently line 5).
    2. Change the existing `import { useEffect, useState } from "react";` to also import `Suspense` and `lazy`:
       ```tsx
       import { Suspense, lazy, useEffect, useState } from "react";
       ```
    3. Immediately after the other player-component imports (and BEFORE the `export interface PlayerRendererProps` block), add:
       ```tsx
       // SGN-POL-05 (Phase 50): lazy-loaded so react-pdf + pdfjs-dist glue ship in
       // a separate chunk, fetched only when a playlist item with kind='pdf' actually renders.
       // Named-export adapter per 50-RESEARCH.md Pitfall 1.
       const PdfPlayer = lazy(() =>
         import("./PdfPlayer").then((m) => ({ default: m.PdfPlayer }))
       );
       ```
    4. In `renderItem`, replace the `case "pdf":` branch:
       ```tsx
       case "pdf":
         return (
           <Suspense fallback={<div className="w-full h-full bg-black" />}>
             <PdfPlayer uri={item.uri} autoFlipSeconds={item.duration_s} />
           </Suspense>
         );
       ```
       (Preserve the exact prop names / values the current branch uses — read the existing branch carefully and keep parity. If the existing branch passes extra props, carry them over verbatim inside the `<Suspense>`.)

    **Edit B — `frontend/scripts/check-player-bundle-size.mjs`:**

    1. Change `const LIMIT = 210_000;` to `const LIMIT = 200_000;`.
    2. Update the top-of-file comment block. Replace the existing Phase 48 amendment paragraph with:
       ```
       // Phase 48 Plan 48-05 amendment (2026-04-20): LIMIT raised from 200_000 → 210_000
       // to accommodate the Tailwind CSS layer added by Phase 47 DEFECT-1.
       // Phase 50 SGN-POL-05 (2026-04-21): reset to 200_000 after dynamic-importing
       // PdfPlayer + react-pdf in PlayerRenderer.tsx. Any future raise is an
       // orchestrator decision — do NOT grow silently.
       ```

    **Do NOT:**
    - Touch `frontend/src/player/main.tsx` or `frontend/src/player/lib/pdfWorker.ts` (Pitfall 3 — keeping the worker pin eager is intentional).
    - Add `PdfPlayer` to any `manualChunks` entry in `frontend/vite.config.ts` (would defeat auto-splitting — Don't Hand-Roll).
    - Change `PdfPlayer.tsx` itself (keep named export; adapter handles it).
    - Lazy-load the other five handlers — only `PdfPlayer` is in scope (per user decision SGN-POL-05 wording).
  </action>
  <verify>
    <automated>grep -q "lazy(() => import(\"./PdfPlayer\")" frontend/src/signage/player/PlayerRenderer.tsx &amp;&amp; grep -q "Suspense" frontend/src/signage/player/PlayerRenderer.tsx &amp;&amp; ! grep -E "^import \{ PdfPlayer \} from" frontend/src/signage/player/PlayerRenderer.tsx &amp;&amp; grep -q "LIMIT = 200_000" frontend/scripts/check-player-bundle-size.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `frontend/src/signage/player/PlayerRenderer.tsx` contains `lazy(() => import("./PdfPlayer")`
    - `frontend/src/signage/player/PlayerRenderer.tsx` contains `<Suspense`
    - `frontend/src/signage/player/PlayerRenderer.tsx` contains `fallback={<div className="w-full h-full bg-black" />}`
    - `frontend/src/signage/player/PlayerRenderer.tsx` contains `.then((m) => ({ default: m.PdfPlayer }))`
    - `frontend/src/signage/player/PlayerRenderer.tsx` does NOT contain a line matching `^import \{ PdfPlayer \} from "\./PdfPlayer"` (static named import removed)
    - `frontend/src/signage/player/PlayerRenderer.tsx` contains `import { Suspense, lazy` (or equivalent listing lazy + Suspense from "react")
    - `frontend/scripts/check-player-bundle-size.mjs` contains the exact string `LIMIT = 200_000`
    - `frontend/scripts/check-player-bundle-size.mjs` does NOT contain `LIMIT = 210_000`
    - `frontend/scripts/check-player-bundle-size.mjs` comment block mentions "Phase 50" and "reset to 200_000"
    - `frontend/src/player/main.tsx` is UNCHANGED from pre-task state (git diff shows no modification)
    - `frontend/src/player/lib/pdfWorker.ts` is UNCHANGED from pre-task state
    - `frontend/src/signage/player/PdfPlayer.tsx` is UNCHANGED from pre-task state
  </acceptance_criteria>
  <done>PlayerRenderer.tsx uses lazy/Suspense for PDF; bundle-size guard reset to 200_000; worker pin untouched in main.tsx/pdfWorker.ts; PdfPlayer.tsx unchanged.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build both bundles, run bundle-size guard, record after-size</name>
  <files>(none modified — verification only)</files>
  <read_first>
    - frontend/package.json (confirm `build` and `build:player` scripts)
    - .planning/phases/50-pi-polish/50-RESEARCH.md §Pitfall 2 (PlayerRenderer is shared with admin — must build BOTH bundles)
  </read_first>
  <action>
    Run the full build matrix from repo root:

    ```bash
    rm -rf frontend/dist
    npm --prefix frontend run build
    node frontend/scripts/check-player-bundle-size.mjs
    ```

    Both commands must exit 0. The second command prints per-file gz sizes and the total.

    Inspect the output:
    - Confirm a new `PdfPlayer-*.js` chunk exists in `frontend/dist/player/assets/` (evidence of successful code-split).
    - Confirm `player-*.js` gz dropped materially vs. Task 1 baseline.
    - Record new gz total (for SUMMARY before/after).

    Also spot-check the admin bundle built: `ls frontend/dist/assets/` should exist and contain JS chunks. Check that `react-pdf` related code appears to be lazy on the admin side too (a `PdfPlayer-*.js` or similar chunk in `frontend/dist/assets/`). Do not fail the task on admin-chunk naming details — the critical gate is the two exit-0 commands above.

    If the `check-player-bundle-size.mjs` exit code is non-zero (still over 200_000), STOP. Do not widen the limit. Report the exact over-limit number and stop the plan so the orchestrator can escalate (per REQUIREMENTS.md SGN-POL-05 literal wording: "LIMIT reset from 210 000 back to 200 000. Build passes.").
  </action>
  <verify>
    <automated>npm --prefix frontend run build &amp;&amp; node frontend/scripts/check-player-bundle-size.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `npm --prefix frontend run build` exits 0
    - `node frontend/scripts/check-player-bundle-size.mjs` exits 0 (i.e. gz total &lt;= 200_000)
    - `frontend/dist/player/assets/` contains a file matching `PdfPlayer-*.js` (new lazy chunk created by the split)
    - `frontend/dist/assets/` exists (admin bundle also built successfully)
    - New post-change player gz total recorded and &lt; baseline from Task 1
  </acceptance_criteria>
  <done>Both admin AND player bundles build cleanly; check-player-bundle-size.mjs exits 0 at LIMIT=200_000; new PdfPlayer lazy chunk observed in dist.</done>
</task>

</tasks>

<verification>
Phase-level checks:
- `grep -n "lazy(" frontend/src/signage/player/PlayerRenderer.tsx` shows the lazy adapter line.
- `grep -n "LIMIT = 200_000" frontend/scripts/check-player-bundle-size.mjs` shows exactly one match.
- `grep -rn "LIMIT = 210" frontend/scripts/` returns no results.
- `ls frontend/dist/player/assets/PdfPlayer-*.js` returns a file (proves split happened).
- `ls frontend/dist/player/assets/pdf.worker.min-*.mjs` returns a file (worker still emitted — pin in main.tsx preserved).
- `node frontend/scripts/check-player-bundle-size.mjs` exits 0.
- `git diff --stat` shows ONLY two files changed: `frontend/src/signage/player/PlayerRenderer.tsx` and `frontend/scripts/check-player-bundle-size.mjs`.
</verification>

<success_criteria>
- [ ] Player entry bundle (`dist/player/assets/*.js` gz total) &lt; 200 000 bytes (hard requirement from SGN-POL-05).
- [ ] `PdfPlayer` + `react-pdf` glue live in a separate lazy chunk, fetched only on first PDF render.
- [ ] pdfjs-dist worker (`pdf.worker.min-*.mjs`) continues to be emitted and remains OUTSIDE the guarded total (`.js`-only filter).
- [ ] Admin bundle still builds without regressions.
- [ ] `main.tsx` / `pdfWorker.ts` / `PdfPlayer.tsx` / `vite.config.ts` unmodified.
- [ ] Exactly two files changed: `PlayerRenderer.tsx` and `check-player-bundle-size.mjs`.
</success_criteria>

<output>
After completion, create `.planning/phases/50-pi-polish/50-01-SUMMARY.md` with:
- Before/after gz totals (from Task 1 vs. Task 3).
- Confirmation of PdfPlayer-*.js lazy chunk creation.
- Any adjustments made (e.g., if prop shape on the PDF case had extra fields).
- Note that SGN-POL-05 is CLOSED.
</output>
