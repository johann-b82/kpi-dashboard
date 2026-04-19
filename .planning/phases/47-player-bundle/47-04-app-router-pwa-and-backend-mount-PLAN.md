---
phase: 47-player-bundle
plan: 04
type: execute
wave: 3
depends_on: [47-01, 47-02, 47-03]
files_modified:
  - frontend/src/player/App.tsx
  - frontend/src/player/main.tsx
  - backend/app/main.py
  - frontend/public/player/icon-192.png
autonomous: true
requirements: [SGN-PLY-01, SGN-PLY-08, SGN-PLY-09, SGN-PLY-10]
must_haves:
  truths:
    - "App.tsx wires wouter Switch with /player/:token → PlaybackShell, /player/ → PairingScreen, fallback → PairingScreen"
    - "main.tsx imports ./lib/pdfWorker (side-effect — pins GlobalWorkerOptions before any PdfPlayer mounts)"
    - "main.tsx wraps App in QueryClientProvider so TanStack Query works in both PairingScreen and PlaybackShell"
    - "Backend serves dist/player/index.html at GET /player/<anything> (SPA fallback) AND serves /player/sw.js + /player/manifest.webmanifest as their actual files (Pitfall P6)"
    - "Backend static-mount comes AFTER all /api/* router mounts (so /api/* wins on conflicting prefixes)"
    - "GET /player/ returns the player HTML; GET /player/<token> returns the same HTML (token parsed by wouter client-side)"
    - "GET /player/sw.js returns Service Worker JS with appropriate Content-Type (NOT text/html — Pitfall P6)"
    - "Service Worker registers (vite-plugin-pwa autoUpdate) and Workbox runtime cache hits /api/signage/player/playlist with StaleWhileRevalidate"
  artifacts:
    - path: frontend/src/player/App.tsx
      provides: "wouter router with two routes + fallback"
      exports: ["PlayerApp"]
    - path: backend/app/main.py
      provides: "static mount + SPA fallback for /player/*"
      contains: "PLAYER_DIST"
    - path: frontend/public/player/icon-192.png
      provides: "PWA manifest icon (192px placeholder)"
  key_links:
    - from: frontend/src/player/main.tsx
      to: frontend/src/player/App.tsx
      via: "createRoot render <PlayerApp />"
      pattern: "PlayerApp"
    - from: backend/app/main.py
      to: frontend/dist/player/index.html
      via: "FileResponse SPA fallback"
      pattern: "PLAYER_DIST.*index\\.html"
    - from: frontend/src/player/App.tsx
      to: PlaybackShell + PairingScreen
      via: "wouter Switch routes"
      pattern: "/player/:token"
---

<objective>
Wire it all together: replace the Plan 47-01 main.tsx skeleton with the real App, mount the PlaybackShell at `/player/:token` and PairingScreen at `/player/`, register the QueryClientProvider, and add the FastAPI static-mount + SPA fallback for `/player/*` (Pattern 5 from RESEARCH).

Purpose: After this plan, a Pi can navigate to `http://api/player/` and the entire flow works (pairing → claim → playback → SSE updates → polling fallback → offline chip). The Service Worker registers at the player scope and the Workbox runtime cache populates on first /playlist call.
Output: 3 modified files (App.tsx, main.tsx, backend main.py) + 1 new asset (icon placeholder).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/47-player-bundle/47-CONTEXT.md
@.planning/phases/47-player-bundle/47-RESEARCH.md
@.planning/phases/47-player-bundle/47-UI-SPEC.md
@frontend/src/player/main.tsx
@frontend/src/player/PairingScreen.tsx
@frontend/src/player/PlaybackShell.tsx
@frontend/src/player/lib/pdfWorker.ts
@backend/app/main.py

<interfaces>
<!-- wouter router (already in deps via admin) -->
import { Switch, Route, Router } from "wouter";

<!-- TanStack Query provider (already in deps) -->
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

<!-- FastAPI static + responses -->
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build App.tsx with wouter router + replace main.tsx skeleton</name>
  <files>frontend/src/player/App.tsx, frontend/src/player/main.tsx</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Routing Contract — exact wouter Switch shape)
    - frontend/src/player/main.tsx (Plan 47-01 skeleton — replace the bootstrap component)
    - frontend/src/player/PairingScreen.tsx (export check)
    - frontend/src/player/PlaybackShell.tsx (export check)
  </read_first>
  <action>
    Create `frontend/src/player/App.tsx`:

    ```tsx
    // Phase 47 UI-SPEC §Routing Contract: wouter Switch with two routes + fallback.
    // Backend serves dist/player/index.html for ANY /player/* path (Pattern 5 SPA fallback);
    // wouter parses :token client-side.

    import { Switch, Route, Router } from "wouter";
    import { PairingScreen } from "@/player/PairingScreen";
    import { PlaybackShell } from "@/player/PlaybackShell";

    export function PlayerApp() {
      return (
        // Vite base is /player/ for this entry; wouter routes are relative to that base.
        // Use Router base="/player" so paths inside the Switch are relative to /player/.
        <Router base="/player">
          <Switch>
            {/* "/" inside the /player base = full URL "/player/" → pairing surface */}
            <Route path="/" component={PairingScreen} />
            {/* "/:token" → "/player/<token>" → playback */}
            <Route path="/:token" component={PlaybackShell} />
            {/* Fallback for anything else under /player/* — render pairing surface (D-2 fallback) */}
            <Route component={PairingScreen} />
          </Switch>
        </Router>
      );
    }
    ```

    Then REPLACE `frontend/src/player/main.tsx` (the bootstrap skeleton from Plan 47-01) entirely with:

    ```tsx
    // Phase 47 player entry. Final wiring (replaces Plan 47-01 bootstrap skeleton).
    // pdfWorker import MUST come first — pins GlobalWorkerOptions before any PdfPlayer mounts.

    import "./lib/pdfWorker";
    import { createRoot } from "react-dom/client";
    import { StrictMode } from "react";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { PlayerApp } from "./App";

    const rootEl = document.getElementById("player-root");
    if (!rootEl) {
      throw new Error("Phase 47: #player-root element missing from player.html");
    }

    // Player query client: aggressive retain (offline cache-and-loop relies on never evicting
    // the last-known playlist while the page is mounted).
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          staleTime: 5 * 60_000,
          retry: 2,
          refetchOnWindowFocus: false, // kiosk never has window focus changes
        },
      },
    });

    createRoot(rootEl).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <PlayerApp />
        </QueryClientProvider>
      </StrictMode>,
    );
    ```

    Critical:
    - `Router base="/player"` is required because Vite's `base: '/player/'` means the bundle is loaded under `/player/` — wouter paths inside the Switch are relative to that base, and the `path="/:token"` matches `/player/<token>`.
    - `pdfWorker` import MUST be the first non-type import (executed for side effect; pins GlobalWorkerOptions globally for all PdfPlayer instances per SGN-PLY-10).
    - QueryClient defaults: `gcTime: Infinity` and `refetchOnWindowFocus: false` are kiosk-specific — they enable the cache-and-loop offline behavior and prevent spurious refetches on the rare focus events that Chromium kiosk fires.
    - StrictMode is preserved — the SSE hook (Plan 47-03) is StrictMode-safe per its cleanup contract.
  </action>
  <verify>
    <automated>test -f frontend/src/player/App.tsx && test -f frontend/src/player/main.tsx && grep -q "Router base=\"/player\"" frontend/src/player/App.tsx && grep -q 'path="/:token"' frontend/src/player/App.tsx && grep -q 'path="/"' frontend/src/player/App.tsx && grep -q "PairingScreen" frontend/src/player/App.tsx && grep -q "PlaybackShell" frontend/src/player/App.tsx && grep -q "QueryClientProvider" frontend/src/player/main.tsx && grep -q "PlayerApp" frontend/src/player/main.tsx && grep -q '^import "./lib/pdfWorker";' frontend/src/player/main.tsx && grep -q "gcTime: Infinity" frontend/src/player/main.tsx && grep -q "refetchOnWindowFocus: false" frontend/src/player/main.tsx</automated>
  </verify>
  <done>
    App.tsx has wouter Router base="/player" with three Switch routes (`/`, `/:token`, fallback). main.tsx imports pdfWorker first, creates QueryClient with `gcTime: Infinity` + `refetchOnWindowFocus: false`, and renders `<PlayerApp />` inside `<QueryClientProvider>`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add 192px PWA icon placeholder</name>
  <files>frontend/public/player/icon-192.png</files>
  <read_first>
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-13 — single 192px placeholder; design polish deferred)
  </read_first>
  <action>
    Create a placeholder 192×192 PNG at `frontend/public/player/icon-192.png`. Vite copies `public/` files verbatim into `dist/` per its standard contract; for the player build (`base: '/player/'`, `outDir: 'dist/player'`), files in `frontend/public/player/` land at `dist/player/`.

    Generate the placeholder using Python (which is available in the dev environment):

    ```bash
    cd frontend && mkdir -p public/player && python3 -c "
    from struct import pack
    import zlib
    # Minimal 192x192 solid neutral-950 (#0a0a0a) PNG
    width = height = 192
    raw = b''
    row = b'\x00' + b'\x0a\x0a\x0a' * width  # filter byte + RGB pixels
    for _ in range(height):
        raw += row
    def chunk(tag, data):
        return pack('>I', len(data)) + tag + data + pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    open('public/player/icon-192.png', 'wb').write(sig + ihdr + idat + iend)
    print('icon-192.png written:', __import__('os').path.getsize('public/player/icon-192.png'), 'bytes')
    "
    ```

    Verify the file is a valid PNG of the right dimensions:
    ```bash
    cd frontend && file public/player/icon-192.png
    # Expect: PNG image data, 192 x 192, 8-bit/color RGB, non-interlaced
    ```

    Polish (real branded icon) is explicitly deferred per CONTEXT D-13.
  </action>
  <verify>
    <automated>test -f frontend/public/player/icon-192.png && file frontend/public/player/icon-192.png | grep -q "PNG image data, 192 x 192"</automated>
  </verify>
  <done>
    `frontend/public/player/icon-192.png` exists; `file` confirms 192x192 PNG. After Vite player build, it lands at `dist/player/icon-192.png` (matching the manifest icon `src: "/player/icon-192.png"` from Plan 47-01 vite.config.ts).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add backend static-mount + SPA fallback for /player/* (Pattern 5)</name>
  <files>backend/app/main.py</files>
  <read_first>
    - backend/app/main.py (current router registration order — find the LAST router include, since the catch-all must come AFTER all /api/* routers)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§"Pattern 5" — full reference + Pitfall P6 — SPA fallback shadowing static assets)
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-12 — backend serves dist/player/index.html at /player/<token> and /player/)
  </read_first>
  <action>
    Read `backend/app/main.py` to find the position AFTER all `app.include_router(...)` calls and BEFORE the lifespan/end of file.

    Add these imports at the top (alongside existing imports):
    ```python
    from pathlib import Path
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    ```

    Add this block AFTER the last `app.include_router(...)` line:

    ```python
    # ---------------------------------------------------------------------------
    # Phase 47: Player bundle static-file serving.
    # Mount AFTER all /api/* routers so the catch-all never shadows API routes.
    # Mount only when the bundle has been built (guard makes pytest a no-op).
    #
    # Pitfall P6 (RESEARCH): The SPA-fallback route MUST check whether the
    # requested path resolves to a real file in dist/player/ FIRST and serve it
    # directly with the right Content-Type. Otherwise GET /player/sw.js returns
    # text/html, the browser refuses to register the SW, and the PWA breaks.
    # ---------------------------------------------------------------------------

    PLAYER_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "player"

    if PLAYER_DIST.exists():
        # /player/assets/* → static files (hashed JS/CSS chunks). StaticFiles serves
        # with correct MIME types based on file extension.
        app.mount(
            "/player/assets",
            StaticFiles(directory=PLAYER_DIST / "assets"),
            name="player-assets",
        )

        # SPA fallback for everything under /player/. ORDER MATTERS:
        # 1. If path is empty (/player/ or /player) → serve index.html
        # 2. Else if path resolves to a real file in dist/player/ root → serve it
        #    (covers /player/sw.js, /player/manifest.webmanifest, /player/icon-192.png,
        #    /player/registerSW.js)
        # 3. Else → serve index.html (wouter parses /:token client-side)
        @app.get("/player")
        @app.get("/player/")
        @app.get("/player/{path:path}")
        async def _player_spa_fallback(path: str = "") -> FileResponse:
            if path:
                # Defend against path traversal: resolve and confirm parent IS PLAYER_DIST.
                candidate = (PLAYER_DIST / path).resolve()
                if (
                    candidate.is_file()
                    and PLAYER_DIST.resolve() in candidate.parents
                    and candidate.parent == PLAYER_DIST.resolve()
                ):
                    return FileResponse(candidate)
            return FileResponse(PLAYER_DIST / "index.html")
    ```

    Critical (do not deviate):
    - The block MUST come AFTER all `app.include_router(...)` calls — FastAPI matches routes in registration order, and this catch-all under `/player/*` would otherwise be benign (it's scoped to `/player/*`, not `/api/*`) but route order is still the cleanest defense.
    - The `if PLAYER_DIST.exists():` guard makes pytest a no-op when no frontend build has run (existing tests must not start failing because of this addition).
    - The path-traversal check (`candidate.parent == PLAYER_DIST.resolve()`) restricts direct file serving to the dist/player/ root only — assets under dist/player/assets/ are served by the StaticFiles mount, not this fallback.
    - Only the dist/player/ root files (sw.js, manifest.webmanifest, icon-192.png, registerSW.js — emitted by vite-plugin-pwa) match the direct-serve branch. Other paths fall through to index.html.
    - Three GET decorators stack: `/player`, `/player/`, `/player/<path>` — covers trailing-slash variants.
    - The function is `async` to match the rest of the FastAPI handlers.
    - DO NOT change any /api/* routes or middleware. DO NOT change CORS config. DO NOT touch the lifespan.

    Then verify the additions are syntactically valid:
    ```bash
    cd backend && python -c "from app.main import app; print(len(app.routes))"
    ```
    Should print a route count > the previous count (since we added 3 GET routes).
  </action>
  <verify>
    <automated>grep -q "from pathlib import Path" backend/app/main.py && grep -q "from fastapi.staticfiles import StaticFiles" backend/app/main.py && grep -q "from fastapi.responses import FileResponse" backend/app/main.py && grep -q "PLAYER_DIST" backend/app/main.py && grep -q '"/player/assets"' backend/app/main.py && grep -q '@app.get("/player/{path:path}")' backend/app/main.py && grep -q "PLAYER_DIST / \"index.html\"" backend/app/main.py && grep -q "PLAYER_DIST.exists()" backend/app/main.py && cd backend && python -c "from app.main import app; print('routes:', len(app.routes))"</automated>
  </verify>
  <done>
    `backend/app/main.py` has the imports + the static mount + the SPA fallback. `python -c "from app.main import app"` imports cleanly. Routes are registered (the StaticFiles mount may or may not register depending on whether `dist/player/` exists in the build env — that's expected behavior).
  </done>
</task>

</tasks>

<verification>
- All 3 modified files exist and have the right additions.
- `from app.main import app` works.
- Manual end-to-end smoke: build the frontend (`cd frontend && npm run build`), then `curl http://localhost:8000/player/` returns the player index.html; `curl http://localhost:8000/player/sw.js` returns JS (NOT HTML, Content-Type: application/javascript); `curl http://localhost:8000/player/manifest.webmanifest` returns the manifest JSON.
- Wouter route smoke (in dev): visiting `http://localhost:5173/player/` shows pairing; visiting `http://localhost:5173/player/test-token-abc` shows playback shell (which immediately attempts to fetch /api/signage/player/playlist and may 401 — that's expected; the route resolves correctly).
</verification>

<success_criteria>
- SGN-PLY-01: `/player/<token>` is served by the backend; the bundle JS exists; the route table includes the catch-all.
- SGN-PLY-08: SW registers at `/player/` scope; Workbox runtime caching is wired (config in vite-plugin-pwa from Plan 47-01).
- SGN-PLY-09: Last-known playlist persists across reloads via the SW cache + TanStack Query `gcTime: Infinity` (architectural; full E2E offline test is Plan 47-05's UAT).
- SGN-PLY-10: pdfWorker import in main.tsx pins GlobalWorkerOptions before any PdfPlayer mounts.
</success_criteria>

<output>
After completion, create `.planning/phases/47-player-bundle/47-04-SUMMARY.md` with:
- Files modified (App.tsx, main.tsx, backend main.py) + 1 file created (icon-192.png)
- Confirmation that `cd backend && python -c "from app.main import app"` succeeds
- Confirmation that wouter routing pattern (`Router base="/player"`, `path="/:token"`) was used (matches Vite base config)
- Hand-off note: Plan 47-05 should run the full build + manual UAT script + add CI guards
- Note any pre-existing tsc errors that surfaced again (carry-forward from Plan 47-01 Task 4)
</output>
