---
phase: 46-admin-ui
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/signage/player/PlayerRenderer.tsx
  - frontend/src/signage/player/ImagePlayer.tsx
  - frontend/src/signage/player/VideoPlayer.tsx
  - frontend/src/signage/player/PdfPlayer.tsx
  - frontend/src/signage/player/IframePlayer.tsx
  - frontend/src/signage/player/HtmlPlayer.tsx
  - frontend/src/signage/player/PptxPlayer.tsx
  - frontend/src/signage/player/types.ts
autonomous: true
requirements:
  - SGN-DIFF-02
must_haves:
  truths:
    - "PlayerRenderer accepts items[] + auto-advances through them using each item.duration_s"
    - "PlayerRenderer loops back to item 0 after last item"
    - "Format dispatch routes kind=image/video/pdf/url/html/pptx to the matching *Player component"
    - "PdfPlayer renders a PDF via react-pdf and auto-flips pages every autoFlipSeconds"
    - "PlayerRenderer resets currentIndex to 0 when items prop reference changes (playlist save)"
  artifacts:
    - path: frontend/src/signage/player/PlayerRenderer.tsx
      provides: "Root player with format dispatch + auto-advance"
      contains: "currentIndex"
    - path: frontend/src/signage/player/PdfPlayer.tsx
      provides: "react-pdf Document/Page auto-flip"
      contains: "from \"react-pdf\""
    - path: frontend/src/signage/player/types.ts
      provides: "PlayerRenderer item interface shared with consumers"
  key_links:
    - from: frontend/src/signage/player/PlayerRenderer.tsx
      to: frontend/src/signage/player/ImagePlayer.tsx
      via: "switch on item.kind"
      pattern: "item.kind"
    - from: frontend/src/signage/player/PdfPlayer.tsx
      to: react-pdf
      via: "Document + Page imports"
      pattern: "react-pdf"
---

<objective>
Build the shared `<PlayerRenderer>` + 6 format handlers (Image/Video/Pdf/Iframe/Html/Pptx) that will be reused by (a) the admin playlist-editor preview pane in 46-05 and (b) the Phase 47 Pi player. This phase delivers ONLY the rendering component — no SSE, no heartbeat, no offline cache (those are Phase 47 wrappers per D-10).

Purpose: Solve SGN-DIFF-02's "WYSIWYG preview" requirement with a pure-presentational player that takes in-memory playlist state. Establishing this in Phase 46 means Phase 47 imports and wraps instead of reimplementing.

Output: Self-contained `/signage/player/` module that renders a playlist loop given `{ items, className }`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-admin-ui/46-CONTEXT.md
@.planning/phases/46-admin-ui/46-RESEARCH.md
@.planning/phases/46-admin-ui/46-UI-SPEC.md

<interfaces>
Playlist item shape (from backend schemas; used by PlayerRenderer):
```ts
interface PlayerItem {
  media_id: string;
  kind: "image" | "video" | "pdf" | "pptx" | "url" | "html";
  uri: string | null;          // for image/video/pdf/url — resolved Directus URL or stored URL
  html: string | null;         // for kind="html" — server-sanitized nh3 content
  slide_paths: string[] | null;// for kind="pptx" — array of image URLs
  duration_s: number;
  transition: "fade" | "cut" | null;
}
```
Note: The backend `SignagePlaylistItem` schema only carries `media_id`, `position`, `duration_s`, `transition`. The Player needs `kind` + `uri`/`html`/`slide_paths`. 46-05 is responsible for joining item rows with their media records before passing to PlayerRenderer. The player module defines its OWN `PlayerItem` type (distinct from backend `SignagePlaylistItem`).

react-pdf@10.4.1 imports:
```ts
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";   // optional — can skip if renderAnnotationLayer={false}
import "react-pdf/dist/Page/TextLayer.css";          // optional
```
React-pdf v10 auto-configures its worker. Do NOT override `GlobalWorkerOptions.workerSrc` in Phase 46 (D-11 / Research Pitfall 3 / 46-RESEARCH "pdfjs-dist Version Mismatch").

From 46-UI-SPEC §"9. PlayerRenderer":
- Auto-advance timer via `useEffect` + `setInterval`.
- `transition="fade"`: CSS opacity transition 300ms between swaps.
- `transition="cut"`: immediate swap.
- `currentIndex` resets to 0 when `items` prop reference changes.
- Admin preview has NO pause/resume (D-10).

From 46-UI-SPEC §"9. Format handler specs" — exact element shapes:
- ImagePlayer: `<img src={uri} className="w-full h-full object-contain" alt="">`
- VideoPlayer: `<video src={uri} muted autoPlay playsInline loop className="w-full h-full object-contain">`
- PdfPlayer: react-pdf `<Document>` + `<Page>` with `renderTextLayer={false} renderAnnotationLayer={false}`; auto-flip via `setInterval(autoFlipSeconds * 1000)`
- IframePlayer: `<iframe src={uri} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0">`
- HtmlPlayer: `<iframe srcDoc={html} sandbox="allow-scripts" className="w-full h-full border-0">`
- PptxPlayer: `<img>` cycle through `slide_paths`; advance every `duration_s / numSlides` seconds
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Define types.ts and build 6 format handlers</name>
  <read_first>
    - 46-UI-SPEC.md §"9. PlayerRenderer" (full section, esp. Format handler specs table)
    - 46-RESEARCH.md §"Pattern 6: react-pdf PdfPlayer"
    - 46-RESEARCH.md §"Pitfall 3: react-pdf worker 'fake worker' warning" (confirms NO override in Phase 46)
    - frontend/node_modules/react-pdf/package.json (optional — confirm installed version after 46-01)
  </read_first>
  <files>
    - frontend/src/signage/player/types.ts (CREATE)
    - frontend/src/signage/player/ImagePlayer.tsx (CREATE)
    - frontend/src/signage/player/VideoPlayer.tsx (CREATE)
    - frontend/src/signage/player/PdfPlayer.tsx (CREATE)
    - frontend/src/signage/player/IframePlayer.tsx (CREATE)
    - frontend/src/signage/player/HtmlPlayer.tsx (CREATE)
    - frontend/src/signage/player/PptxPlayer.tsx (CREATE)
  </files>
  <action>
    **1a. `types.ts`:**
    ```ts
    export type PlayerItemKind = "image" | "video" | "pdf" | "pptx" | "url" | "html";
    export type PlayerTransition = "fade" | "cut" | null;

    export interface PlayerItem {
      id: string;                       // stable key for React reconciliation (media_id is fine)
      kind: PlayerItemKind;
      uri: string | null;               // for image/video/pdf/url — absolute or app-relative URL
      html: string | null;              // for html
      slide_paths: string[] | null;     // for pptx — array of image URLs, in order
      duration_s: number;               // >= 1
      transition: PlayerTransition;
    }
    ```

    **1b. `ImagePlayer.tsx`:**
    ```tsx
    export interface ImagePlayerProps { uri: string | null; }
    export function ImagePlayer({ uri }: ImagePlayerProps) {
      if (!uri) return null;
      return <img src={uri} alt="" className="w-full h-full object-contain" />;
    }
    ```

    **1c. `VideoPlayer.tsx`:**
    ```tsx
    export interface VideoPlayerProps { uri: string | null; }
    export function VideoPlayer({ uri }: VideoPlayerProps) {
      if (!uri) return null;
      return (
        <video
          src={uri}
          muted
          autoPlay
          playsInline
          loop                                        /* admin preview loops; Phase 47 wrapper disables */
          className="w-full h-full object-contain"
        />
      );
    }
    ```

    **1d. `PdfPlayer.tsx`:** Uses react-pdf defaults — DO NOT set `pdfjs.GlobalWorkerOptions.workerSrc`.
    ```tsx
    import { useEffect, useState, useRef } from "react";
    import { Document, Page } from "react-pdf";
    import "react-pdf/dist/Page/AnnotationLayer.css";
    import "react-pdf/dist/Page/TextLayer.css";

    export interface PdfPlayerProps { uri: string | null; autoFlipSeconds?: number; }

    export function PdfPlayer({ uri, autoFlipSeconds = 8 }: PdfPlayerProps) {
      const [numPages, setNumPages] = useState(0);
      const [pageNumber, setPageNumber] = useState(1);
      const containerRef = useRef<HTMLDivElement>(null);
      const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

      useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) setContainerWidth(entry.contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
      }, []);

      useEffect(() => {
        if (numPages <= 1) return;
        const id = setInterval(() => {
          setPageNumber((p) => (p < numPages ? p + 1 : 1));
        }, Math.max(1000, autoFlipSeconds * 1000));
        return () => clearInterval(id);
      }, [numPages, autoFlipSeconds]);

      // Reset page when uri changes.
      useEffect(() => { setPageNumber(1); }, [uri]);

      if (!uri) return null;
      return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center">
          <Document file={uri} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
            <Page
              pageNumber={pageNumber}
              width={containerWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>
      );
    }
    ```

    **1e. `IframePlayer.tsx`:**
    ```tsx
    export interface IframePlayerProps { uri: string | null; }
    export function IframePlayer({ uri }: IframePlayerProps) {
      if (!uri) return null;
      return (
        <iframe
          src={uri}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0"
          title="External content"
        />
      );
    }
    ```

    **1f. `HtmlPlayer.tsx`:**
    ```tsx
    export interface HtmlPlayerProps { html: string | null; }
    export function HtmlPlayer({ html }: HtmlPlayerProps) {
      if (!html) return null;
      return (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          className="w-full h-full border-0"
          title="HTML content"
        />
      );
    }
    ```

    **1g. `PptxPlayer.tsx`:** Cycle slides evenly within `durationS` total.
    ```tsx
    import { useEffect, useState } from "react";

    export interface PptxPlayerProps {
      slidePaths: string[] | null;
      durationS: number;   // total item duration
    }

    export function PptxPlayer({ slidePaths, durationS }: PptxPlayerProps) {
      const [index, setIndex] = useState(0);
      const paths = slidePaths ?? [];
      useEffect(() => {
        setIndex(0);
        if (paths.length <= 1) return;
        const perSlide = Math.max(1000, (durationS * 1000) / paths.length);
        const id = setInterval(() => setIndex((i) => (i + 1) % paths.length), perSlide);
        return () => clearInterval(id);
      }, [paths, durationS]);
      if (paths.length === 0) return null;
      return <img src={paths[index]} alt="" className="w-full h-full object-contain" />;
    }
    ```
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | tail -20 && test -f src/signage/player/types.ts && for f in ImagePlayer VideoPlayer PdfPlayer IframePlayer HtmlPlayer PptxPlayer; do test -f "src/signage/player/$f.tsx" || exit 1; done && grep -c "from \"react-pdf\"" src/signage/player/PdfPlayer.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - `test -f frontend/src/signage/player/types.ts` succeeds
    - 6 format handler files exist: `ls frontend/src/signage/player/{Image,Video,Pdf,Iframe,Html,Pptx}Player.tsx` returns all 6
    - `grep -c "export interface PlayerItem\\b" frontend/src/signage/player/types.ts` returns exactly 1
    - `grep -c "from \"react-pdf\"" frontend/src/signage/player/PdfPlayer.tsx` returns exactly 1
    - `grep -c "renderTextLayer={false}" frontend/src/signage/player/PdfPlayer.tsx` returns exactly 1
    - `grep -c "renderAnnotationLayer={false}" frontend/src/signage/player/PdfPlayer.tsx` returns exactly 1
    - `grep -c "GlobalWorkerOptions" frontend/src/signage/player/PdfPlayer.tsx` returns 0 (Phase 47 owns worker pin per D-11)
    - `grep -c "muted\\|autoPlay\\|playsInline" frontend/src/signage/player/VideoPlayer.tsx` returns ≥3
    - `grep -c "sandbox=\"allow-scripts allow-same-origin\"" frontend/src/signage/player/IframePlayer.tsx` returns exactly 1
    - `grep -c "sandbox=\"allow-scripts\"" frontend/src/signage/player/HtmlPlayer.tsx` returns exactly 1
    - `grep -c "allow-same-origin" frontend/src/signage/player/HtmlPlayer.tsx` returns 0 (HTML sandboxed without same-origin)
    - `grep -c "srcDoc" frontend/src/signage/player/HtmlPlayer.tsx` returns ≥1
    - `grep -rn "dark:" frontend/src/signage/player/` returns no matches
    - `grep -rn "fetch(" frontend/src/signage/player/` returns no matches
  </acceptance_criteria>
  <done>All six format handlers typecheck and render correctly in isolation; no worker override leaked.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Build PlayerRenderer with auto-advance + format dispatch + fade transition</name>
  <read_first>
    - frontend/src/signage/player/types.ts (just created in Task 1)
    - 46-UI-SPEC.md §"9. PlayerRenderer" — props interface, transition spec, loop behavior
    - 46-RESEARCH.md §"Pitfall 9: PlayerRenderer live preview — form state vs server state"
  </read_first>
  <files>
    - frontend/src/signage/player/PlayerRenderer.tsx (CREATE)
  </files>
  <action>
    ```tsx
    import { useEffect, useState } from "react";
    import type { PlayerItem } from "./types";
    import { ImagePlayer } from "./ImagePlayer";
    import { VideoPlayer } from "./VideoPlayer";
    import { PdfPlayer } from "./PdfPlayer";
    import { IframePlayer } from "./IframePlayer";
    import { HtmlPlayer } from "./HtmlPlayer";
    import { PptxPlayer } from "./PptxPlayer";

    export interface PlayerRendererProps {
      items: PlayerItem[];
      className?: string;
    }

    function renderItem(item: PlayerItem) {
      switch (item.kind) {
        case "image": return <ImagePlayer uri={item.uri} />;
        case "video": return <VideoPlayer uri={item.uri} />;
        case "pdf":   return <PdfPlayer uri={item.uri} autoFlipSeconds={item.duration_s} />;
        case "url":   return <IframePlayer uri={item.uri} />;
        case "html":  return <HtmlPlayer html={item.html} />;
        case "pptx":  return <PptxPlayer slidePaths={item.slide_paths} durationS={item.duration_s} />;
        default: return null;
      }
    }

    /**
     * Admin-preview PlayerRenderer (SGN-DIFF-02 / D-09, D-10).
     *
     * Accepts in-memory items (form state or server state) and auto-advances
     * through them using each item.duration_s. Loops back to 0 after last.
     * Resets currentIndex to 0 when the items prop reference changes
     * (playlist save, item add/remove).
     *
     * No SSE, no heartbeat, no offline cache — those are Phase 47 wrappers.
     *
     * Transition handling:
     *  - "fade" (default): 300ms CSS opacity transition between swaps
     *  - "cut": immediate swap (no transition)
     */
    export function PlayerRenderer({ items, className }: PlayerRendererProps) {
      const [currentIndex, setCurrentIndex] = useState(0);
      const [fading, setFading] = useState(false);

      // Reset on items reference change — mitigates stale-index after add/remove.
      useEffect(() => {
        setCurrentIndex(0);
      }, [items]);

      useEffect(() => {
        if (items.length === 0) return;
        const item = items[currentIndex] ?? items[0];
        const durationMs = Math.max(1000, item.duration_s * 1000);

        const next = items[(currentIndex + 1) % items.length];
        const useFade = next?.transition !== "cut";
        const fadeOutMs = useFade ? 300 : 0;

        const advanceTimer = setTimeout(() => {
          if (useFade) {
            setFading(true);
            setTimeout(() => {
              setCurrentIndex((i) => (i + 1) % items.length);
              setFading(false);
            }, fadeOutMs);
          } else {
            setCurrentIndex((i) => (i + 1) % items.length);
          }
        }, durationMs);

        return () => clearTimeout(advanceTimer);
      }, [items, currentIndex]);

      if (items.length === 0) {
        return (
          <div className={`w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm ${className ?? ""}`}>
            —
          </div>
        );
      }

      const current = items[currentIndex] ?? items[0];
      return (
        <div
          className={`w-full h-full relative overflow-hidden bg-background transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"} ${className ?? ""}`}
          // Stable key per item forces unmount/remount — critical for iframes (HTML preview) and to
          // reset react-pdf internal state between items.
          key={current.id}
        >
          {renderItem(current)}
        </div>
      );
    }
    ```

    Do NOT export a Phase-47 device-scoped wrapper from this file. Keep this component STRICTLY presentational.
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | tail -15 && grep -c "export function PlayerRenderer" src/signage/player/PlayerRenderer.tsx && grep -c "setCurrentIndex" src/signage/player/PlayerRenderer.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `cd frontend && npm run build` exits 0
    - `grep -c "export function PlayerRenderer" frontend/src/signage/player/PlayerRenderer.tsx` returns exactly 1
    - `grep -c "ImagePlayer\\|VideoPlayer\\|PdfPlayer\\|IframePlayer\\|HtmlPlayer\\|PptxPlayer" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥6 (imports + dispatch)
    - `grep -c "switch (item.kind)\\|case \"image\"" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥1
    - `grep -c "useEffect" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥2 (reset + advance)
    - `grep -c "items\\]" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥1 (reset-on-items-change effect)
    - `grep -c "transition-opacity\\|duration-300" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥1
    - `grep -Ec "(i \\+ 1) % items\\.length|% items\\.length" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥1 (loop wraparound)
    - `grep -c "clearTimeout\\|clearInterval" frontend/src/signage/player/PlayerRenderer.tsx` returns ≥1 (cleanup)
    - `grep -rn "EventSource\\|localStorage\\|serviceWorker\\|caches\\." frontend/src/signage/player/PlayerRenderer.tsx` returns no matches (Phase 47 concerns)
    - `grep -rn "dark:" frontend/src/signage/player/` returns no matches
  </acceptance_criteria>
  <done>PlayerRenderer compiles, auto-advances with fade transitions, loops, resets on items change, no Phase 47 wrapper concerns leaked.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` exits 0.
2. `cd frontend && npm run lint` exits 0.
3. `grep -rn "dark:" frontend/src/signage/player/` returns no matches.
4. `grep -rn "fetch(\\|EventSource\\|serviceWorker" frontend/src/signage/player/` returns no matches.
5. `grep -rn "GlobalWorkerOptions\\|pdfjs-dist" frontend/src/signage/player/` returns no matches (Phase 47 owns worker pin).
6. Manual (when 46-05 wires it in): editor preview shows slides advancing via duration_s timing.
</verification>

<success_criteria>
- `<PlayerRenderer>` is pure presentational — accepts items, renders them, loops.
- All 6 format handlers render the exact element shapes from UI-SPEC.
- react-pdf uses its built-in worker config (no override); admin preview works on http:// without HTTPS gymnastics.
- Iframe sandbox flags match UI-SPEC exactly (url: allow-scripts + allow-same-origin; html: allow-scripts only).
- Auto-advance timer cleans up on unmount and on items change.
- Phase 47 can `import { PlayerRenderer, type PlayerItem } from "@/signage/player"` and wrap with SSE/heartbeat/cache.
</success_criteria>

<output>
After completion, create `.planning/phases/46-admin-ui/46-03-SUMMARY.md`.
</output>
