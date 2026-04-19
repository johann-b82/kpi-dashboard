# Phase 47: Player Bundle - Research

**Researched:** 2026-04-19
**Domain:** Standalone Vite-bundled Pi-kiosk signage player (PWA + SSE + offline)
**Confidence:** HIGH on most areas; MEDIUM on vite-plugin-pwa multi-entry edge cases (one known constraint requires a chosen workaround)

## Summary

Phase 47 wraps the already-built `<PlayerRenderer>` (Phase 46-03) in a separate Vite entry that ships as a sub-200 KB gzipped PWA at `/player/<device_token>`. The phase is heavily pre-decided in CONTEXT (D-1 through D-13) and UI-SPEC; research's job is to surface implementation details, version pins, and traps for the planner.

**Key load-bearing findings:**

1. **vite-plugin-pwa 1.2.0 is functionally compatible with Vite 8 but its peer-dep declaration only lists `vite: ^3 || ^4 || ^5 || ^6 || ^7`.** A PR to add `^8.0.0` was opened on April 8, 2026 (issue #918, PR linked). Today is April 19, 2026 — still not in a published release. Plan must install with `--legacy-peer-deps` (or pin via `overrides`/`resolutions`) and add a CI note to drop the workaround when 1.2.1+ ships.
2. **vite-plugin-pwa generates one Service Worker rooted at the project's `outDir`/`base`, not per-entry.** The plugin ignores entry-aware scoping (issue #263, closed without a fix). This is OK for this project: the player's SW is the only SW, and we set `scope: '/player/'` + `base: '/player/'` so SW assets and scope land under `/player/` only. Admin index.html does not register an SW.
3. **Vite has one global `base`.** There is no "per-entry base." The proven idiom is to drive `base` from a build mode/env var: the player build runs as a second `vite build --mode player` with `base: '/player/'`; the admin build keeps `base: '/'`. Two outputs, two `vite build` invocations from `npm run build`.
4. **`manualChunks` as a function is the correct shape for shared `vendor-react` across two entries.** Function form lets you target node_modules paths regardless of which entry pulled them in; both entries' graphs converge on the same chunk hash.
5. **pdf.js worker via `?url` is one line and Vite's standard pattern**, but the `pdfjs-dist@5.6.205` worker file lives at `pdfjs-dist/build/pdf.worker.min.mjs`. The worker emits to `dist/player/assets/` automatically because Vite treats `?url` imports as build-pipeline assets.
6. **Backend currently has no static file mount.** `backend/app/main.py` only registers API routers + `/health`. Phase 47 must add a `StaticFiles` mount for `/player` plus a SPA-fallback route returning `dist/player/index.html` for any `/player/<token>` path. Reverse proxy / static-serving by an external nginx is NOT in play for this dev stack.
7. **EventSource `?token=` query auth is the only practical option.** Browsers cannot set headers on EventSource. Phase 45 already accepts the device JWT via query string per the existing `/stream` contract. The trade-off (token in URL → web-server access logs) is documented and accepted.

**Primary recommendation:** Treat this phase as a wrapper, not a rebuild. The renderer + handlers exist. The work is: second Vite entry + PWA plugin config + a single SSE/polling hook + a media-URL rewrite shim + a backend static mount + a CI bundle-size guard. Six small, sequenced surfaces.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-1: Hybrid offline cache (SW for playlist JSON, Pi sidecar for media files).**
- Service Worker (`vite-plugin-pwa`) registers on the player bundle and stale-while-revalidates `/api/signage/playlist` only.
- Pi-side sidecar (Phase 48 scope) writes media to `/var/lib/signage/media/` and serves at `http://localhost:8080/media/<id>`. Player rewrites media URLs to localhost when sidecar is online via `window.signageSidecarReady` flag.
- Phase 47 ships: SW registration + manifest + SWR route for `/api/signage/playlist`, plus media-URL rewrite hook. Phase 47 does NOT ship the sidecar.

**D-2: URL is canonical; `localStorage.signage_device_token` is the fallback.** Boot order: URL path → localStorage → pairing screen. Successful URL boot writes to localStorage. 401 wipes localStorage and navigates to `/player/`.

**D-3: Minimal pairing screen.** Centered, large `XXX-XXX` code (≥ 12rem, monospace), one-line hint, DE/EN via `navigator.language`, auto-poll `/api/signage/pair/status` every 3s. No QR, no logo, no language toggle.

**D-4: Polling is strict fallback (not parallel).** SSE primary; 45s watchdog (resettable on every event including 15s server pings); on watchdog fire close EventSource → 30s polling against `/api/signage/playlist`. On successful poll, attempt SSE reconnect; if first event arrives within 5s, kill polling.

**D-5: Shared vendor chunk + strict import boundary.**
- Second Vite entry `player` → `frontend/src/player/main.tsx`. Output: `dist/player/index.html`.
- `manualChunks` extracts `react`, `react-dom`, `@tanstack/react-query` into a shared `vendor-react` chunk both entries reference.
- CI guard `frontend/scripts/check-player-isolation.mjs` greps `frontend/src/player/**` for forbidden imports (`@/signage/pages`, `@/signage/components/Media`, `@/signage/components/Playlist`, `@/signage/components/Device`, `@/components/admin/`). MAY import: `@/signage/player/*`, `@/signage/lib/signageTypes`, `@/lib/apiClient`, `@/lib/queryKeys`.
- Gzipped player JS < 200 KB asserted at build time.

**D-6: Per-format default `duration_s` constants in `frontend/src/player/lib/durationDefaults.ts`.** Image=10s; Video=natural-end; PDF=6s/page; Iframe=30s; HTML=30s; PPTX=8s/slide.

**D-7: SSE/watchdog lifecycle.** Open `EventSource('/api/signage/stream?token=...')`. Reset 45s watchdog on every event (including 15s server pings). On fire/error → close + 30s polling. On poll-success → SSE reconnect; first-event-within-5s kills polling.

**D-8: No JS heartbeat from the player bundle.** Heartbeat is the Phase 48 sidecar's job. Player only consumes SSE.

**D-9 / D-10: Iframe + HTML rendering inherits Phase 46 contract.** Iframe HEAD pre-flight + `sandbox="allow-scripts allow-same-origin"`. HTML via `<iframe srcdoc sandbox="allow-scripts">`; sanitization upstream.

**D-11: pdfjs-dist@5.6.205 pinned in player bundle.** Worker via `?url` import; player owns the pin (Phase 46 admin used react-pdf default).

**D-12: Backend serves `dist/player/index.html` at `/player/<token>` and `/player/`.** SPA fallback any `/player/*` returns same HTML. Static assets at `/player/assets/...`. Vite `base: '/player/'` for player entry only.

**D-13: PWA manifest config.** `display: 'fullscreen'`, `start_url: '/player/'`, `name: 'Signage Player'`, `short_name: 'Signage'`, single 192px icon. SW scope `/player/`. Workbox runtime: `/api/signage/playlist` → `StaleWhileRevalidate`, `cacheName: 'signage-playlist-v1'`, `maxEntries: 5`, `maxAgeSeconds: 86400`. No media precaching.

### Claude's Discretion
- File/folder layout under `frontend/src/player/`.
- Constants module shape (`durationDefaults.ts` vs frontmatter on each handler).
- Pairing screen polling: TanStack Query `refetchInterval` vs hand-rolled `setInterval`.
- SSE/watchdog lifecycle: custom hook vs XState machine — recommend custom hook.
- Backend route handler for `/player/<token>` — `StaticFiles` mount or small route returning the file.
- CI guard implementation language — reuse `check-signage-invariants.mjs` style.

### Deferred Ideas (OUT OF SCOPE)
- Pairing-screen field-debug overlay
- Pairing-screen QR code
- Pairing-screen language toggle UI
- PWA install prompt UX
- SSE-with-parallel-polling
- Sidecar daemon implementation (Phase 48)
- Sentry / player error reporting
- Audio playback for video
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-PLY-01 | Separate Vite entry; served at `GET /player/:device_token`; <200KB gzipped | §"Standard Stack" (Vite multi-entry config), §"Don't Hand-Roll" (bundle-size script via `gzip-size` or `zlib`), §"Common Pitfalls" P1 (peer-dep), §"Code Examples" Ex1 + Ex5 |
| SGN-PLY-02 | URL path token + localStorage; `Authorization: Bearer <token>` | §"Architecture Patterns" Pat1 (`useDeviceToken` hook), §"Code Examples" Ex2; recommend bypassing existing `apiClient` (Directus-coupled) and using a `playerFetch` adapter |
| SGN-PLY-03 | Pairing screen calls `POST /pair/request`, displays `XXX-XXX`, polls `/pair/status` every 3s | §"Architecture Patterns" Pat2; existing Phase 42 contracts unchanged |
| SGN-PLY-04 | `GET /playlist` on boot + on SSE event; 30s polling fallback when SSE disconnected | §"Architecture Patterns" Pat3 (`useSseWithPollingFallback`), §"Code Examples" Ex3 |
| SGN-PLY-05 | Heartbeat every 60s with `current_item_id` | **OUT OF SCOPE per CONTEXT D-8** — heartbeat is Phase 48 sidecar's responsibility, not the JS bundle. Plan must explicitly omit this and document the deferral. Requirement is satisfied at the system level by Phase 48. |
| SGN-PLY-06 | SSE with 45s client watchdog | §"Architecture Patterns" Pat3, §"Code Examples" Ex3 |
| SGN-PLY-07 | Format handlers (image/video/pdf/iframe/html/pptx) | **Already shipped Phase 46-03**; player wraps `<PlayerRenderer>` and only adds duration defaults (D-6) and disables `loop` on `<VideoPlayer>` (Phase 46-03 SUMMARY hand-off note) |
| SGN-PLY-08 | Service Worker + Cache API for media; SWR for playlist metadata; localStorage for manifest | **Amended by CONTEXT D-1**: SW handles only `/api/signage/playlist` (SWR); media is sidecar's job. localStorage holds the device token, NOT the playlist manifest (TanStack Query in-memory cache + SW are the cache layer). Plan documents this scope amendment in 47-VERIFICATION.md per CONTEXT. |
| SGN-PLY-09 | Offline cache-and-loop; SW serves cached media | Same amendment as SGN-PLY-08. The cache-and-loop behavior is achieved by: (a) TanStack Query keeps last-known playlist in memory, (b) SW serves last-known `/playlist` JSON via SWR, (c) sidecar (Phase 48) serves media. Without sidecar (dev/preview), the player gracefully falls back to direct media URLs and inherits browser HTTP cache only. |
| SGN-PLY-10 | pdf.js worker via `?url` import, version-matched to `pdfjs-dist@5.6.205` | §"Code Examples" Ex4; pinned via `package.json` `overrides` to defeat react-pdf's transitive bump |
| SGN-DIFF-03 | PDF crossfade transition between pages, 200ms default, admin-configurable per playlist | **Partially shipped Phase 46-03** (`PdfPlayer` already auto-flips pages with `react-pdf`). Crossfade between consecutive pages is NEW work in this phase. Implementation: render two `<Page>` layers, animate `opacity` over 200ms on page change. Admin-configurable per-playlist piece is OUT OF SCOPE per CONTEXT (no admin UI changes); fixed 200ms default is acceptable for Phase 47 closure. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Phase 47 Compliance Path |
|-----------|--------|--------------------------|
| Containerization via Docker Compose | CLAUDE.md "Constraints" | No new containers; player bundle is built into `frontend` and served by existing `api` service |
| React 19.2.5, Vite 8.0.x, TS 5.x, Tailwind 4.2.2 | CLAUDE.md "Recommended Stack" | Player uses same versions (Vite 8.0.4 currently installed); see Pitfall P1 for vite-plugin-pwa peer-dep mismatch |
| TanStack Query 5.97.0 for server state | CLAUDE.md | Player extends `queryKeys` factory with `playerKeys` namespace |
| shadcn/ui copy-paste pattern | CLAUDE.md | Player intentionally consumes ZERO shadcn primitives (UI-SPEC) to keep <200KB |
| **No `import sqlite3` / `import psycopg2` in backend** | CLAUDE.md cross-cutting | Phase 47 backend touch is a single static-file mount in `main.py` — neither import involved |
| **No sync `subprocess.run` in signage services** | CLAUDE.md | Not applicable; no backend service work in this phase |
| Use `docker compose` (v2) syntax | CLAUDE.md | Not applicable; no docker-compose changes |

## Cross-cutting Hazards (from ROADMAP §"v1.16 Cross-Cutting Hazards")

| Hazard | Phase 47 Compliance |
|--------|---------------------|
| **DE/EN i18n parity** | UI-SPEC defines exactly 5 keys under `signage.player.*`. Existing `scripts/check-i18n-parity.mjs` (Phase 46) auto-covers them. |
| **No direct `fetch()` in admin frontend — apiClient only** | Phase 47 player has a **documented exception** (ROADMAP §"v1.16 Cross-Cutting Hazards" #2: "Phase 47 player uses its own minimal fetch with device-token bearer, documented exception"). The player's CI guard (`check-signage-invariants.mjs`) currently scans `signage/player/*` and would flag `fetch(`. Plan must update the guard to allow `fetch(` in `frontend/src/player/**` OR have the player use a thin `playerApi` adapter that wraps fetch but is itself excluded from the guard. **Recommended:** thin `playerApi` adapter at `frontend/src/player/lib/playerApi.ts` that the guard explicitly exempts (analogous to the Phase 46 `signage/lib/` exemption already in the guard). |
| **No `dark:` Tailwind variants** | UI-SPEC commits to static neutral classes (`bg-neutral-950`); existing guard already covers `signage/player/*` and Plan extends the same guard root list to `frontend/src/player/**`. |
| **`--workers 1` invariant** | Not applicable (frontend-only phase). |
| **Router-level admin gate** | Not applicable (no backend admin routes added). |

## Standard Stack

### Core (NEW additions in this phase)
| Library | Version (verified npm 2026-04-19) | Purpose | Why Standard |
|---------|-----------------------------------|---------|--------------|
| `vite-plugin-pwa` | **1.2.0** (published 2025-11-27) | Service Worker generation + manifest emission + Workbox runtime caching wiring | Zero-config PWA for Vite; the canonical PWA plugin in the Vite ecosystem |
| `workbox-window` | **7.4.0** | Runtime SW lifecycle helpers (registration, update prompts) — peer of vite-plugin-pwa | Required peer; same minor as vite-plugin-pwa's bundled Workbox |
| `pdfjs-dist` (override) | **5.6.205** | Pin for the PDF.js worker file imported by `PdfPlayer.tsx` | Already transitively present via react-pdf 10.4.1; `overrides` field enforces the exact version Phase 46-03 SUMMARY hand-off requires |

### Already installed (consumed unchanged)
| Library | Version | Purpose |
|---------|---------|---------|
| `react` | 19.2.4 | Core; goes into shared `vendor-react` chunk |
| `react-dom` | 19.2.4 | Core; shared chunk |
| `@tanstack/react-query` | 5.97.0 | Pairing-status polling + playlist polling fallback; shared chunk |
| `wouter` | 3.9.0 | Player router (matches admin choice — same chunk benefit) |
| `react-pdf` | 10.4.1 | Underlying PDF render (PdfPlayer already built); 10.4.1 itself stays bundled with player chunk, but its `pdfjs-dist` worker is pinned via override |
| `i18next` + `react-i18next` | 26.0.4 / 17.0.2 | DE/EN locale dispatch — but this is a 5-string surface; **see Pitfall P9** for the alternative of skipping i18next inside the player to save bundle bytes |
| `lucide-react` | 1.8.0 | Single icon (`WifiOff`) — tree-shakes to ~1KB |
| `tailwindcss` + `@tailwindcss/vite` | 4.2.2 | Player CSS uses Tailwind utility classes only |

### NOT used (intentional bundle-size discipline)
| Library | Why Excluded |
|---------|--------------|
| shadcn/ui primitives | UI-SPEC: zero primitives in player (no `<Card>`, `<Dialog>`, `<Tabs>`) — saves ~30 KB |
| `@directus/sdk` | Player has no Directus dependency; runs on device JWT via plain fetch |
| `@dnd-kit/*` | No drag-drop in player |
| `react-hook-form` | No forms in player (pairing screen has no input) |
| `zod` | Type validation handled by TS at compile-time only |
| `sonner` | No toasts in player (UI-SPEC: zero operator-facing error UI) |
| `recharts` | No charts in player |

### Installation
```bash
cd frontend
# Vite-8 peer-dep mismatch workaround — see Pitfall P1
npm install --save-dev vite-plugin-pwa@1.2.0 workbox-window@7.4.0 --legacy-peer-deps
```

Add to `package.json`:
```json
{
  "overrides": {
    "pdfjs-dist": "5.6.205"
  }
}
```

**Version verification (run npm view at install time to confirm currency):**
- `npm view vite-plugin-pwa version` → 1.2.0 (verified 2026-04-19)
- `npm view workbox-window version` → 7.4.0 (verified 2026-04-19)
- `npm view pdfjs-dist version` → 5.6.205 (verified 2026-04-19; matches Phase 46-03 SUMMARY hand-off pin)

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── index.html                    # admin entry (existing, unchanged)
├── player.html                   # NEW player entry HTML
├── vite.config.ts                # MODIFIED: rollupOptions.input + manualChunks + PWA
├── scripts/
│   ├── check-signage-invariants.mjs   # MODIFIED: extend ROOTS to include player/
│   ├── check-player-isolation.mjs     # NEW: D-5 import-boundary guard
│   └── check-player-bundle-size.mjs   # NEW: post-build <200 KB gz assertion
└── src/
    ├── App.tsx                   # admin app (existing)
    ├── main.tsx                  # admin entry (existing)
    └── player/                   # NEW — entire player bundle source
        ├── main.tsx              # entry: createRoot + <PlayerApp />
        ├── App.tsx               # Wouter router: /player/ + /player/:token
        ├── PairingScreen.tsx
        ├── PlaybackShell.tsx     # wraps <PlayerRenderer> + SSE/polling lifecycle
        ├── components/
        │   ├── PairingCode.tsx
        │   └── OfflineChip.tsx
        ├── hooks/
        │   ├── useDeviceToken.ts
        │   ├── useSseWithPollingFallback.ts
        │   └── useSidecarStatus.ts
        └── lib/
            ├── durationDefaults.ts
            ├── mediaUrl.ts            # sidecar URL rewrite
            ├── playerApi.ts           # device-token fetch wrapper (apiClient exception)
            ├── locale.ts              # navigator.language → 'de' | 'en' picker
            └── strings.ts             # 5 hard-coded EN+DE strings (see Pitfall P9 alt to i18next)
```

### Pattern 1: Token resolution + persistence
Custom hook `useDeviceToken()` reads URL → localStorage → null in priority order, persists URL token to localStorage on first paint, exposes `clearToken()` for the 401-revoked path.

```tsx
// frontend/src/player/hooks/useDeviceToken.ts
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";

const STORAGE_KEY = "signage_device_token";

export function useDeviceToken() {
  const params = useParams<{ token?: string }>();
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(() => {
    return params.token ?? localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (params.token && params.token !== localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, params.token);
    }
  }, [params.token]);

  const clearToken = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    navigate("/player/");
  };

  return { token, clearToken };
}
```

### Pattern 2: Pairing screen polling
TanStack Query with `refetchInterval: 3000` is the right tool — handles loading/error/cleanup automatically and gives `gcTime: 0` for clean unmount. Hand-rolled `setInterval` is also acceptable per CONTEXT discretion; recommend Query because Phase 46 admin polling already follows this pattern.

```tsx
// Pattern shape:
const { data } = useQuery({
  queryKey: playerKeys.pairStatus(sessionId),
  queryFn: () => playerApi.getPairStatus(sessionId),
  refetchInterval: 3000,
  enabled: !!sessionId,
  gcTime: 0,
});
useEffect(() => {
  if (data?.status === "claimed") {
    localStorage.setItem("signage_device_token", data.device_token);
    navigate(`/player/${data.device_token}`);
  }
}, [data]);
```

### Pattern 3: SSE + watchdog + polling fallback
Single hook owns the entire lifecycle. State machine: `connecting → live → silent (watchdog) → polling → reconnecting → live`. React StrictMode safety: cleanup function MUST close EventSource and clear all timers.

```tsx
// frontend/src/player/hooks/useSseWithPollingFallback.ts (sketch)
export function useSseWithPollingFallback({
  url,             // e.g. `/api/signage/stream?token=${token}`
  pollUrl,         // e.g. `/api/signage/playlist`
  watchdogMs = 45_000,
  pollingMs = 30_000,
  onPlaylistChanged,   // (etag: string) => void  — called on SSE event or successful poll
  onUnauthorized,      // () => void              — called on 401 → clearToken
}: Args) {
  useEffect(() => {
    let es: EventSource | null = null;
    let watchdog: number | undefined;
    let poller: number | undefined;
    let killed = false;

    const resetWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = window.setTimeout(onWatchdogFire, watchdogMs);
    };

    const openSse = () => {
      es = new EventSource(url);
      es.onopen = resetWatchdog;
      es.onmessage = (e) => {
        resetWatchdog();
        // parse + dispatch
      };
      es.onerror = onSseError;
    };

    const onWatchdogFire = () => {
      es?.close();
      es = null;
      startPolling();
    };

    const startPolling = () => {
      const poll = async () => {
        try {
          const r = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` }});
          if (r.status === 401) return onUnauthorized();
          // … parse, dispatch, then attempt SSE reconnect
        } catch {/* swallow, keep polling */}
      };
      poll();
      poller = window.setInterval(poll, pollingMs);
    };

    openSse();
    return () => {
      killed = true;
      es?.close();
      if (watchdog) clearTimeout(watchdog);
      if (poller) clearInterval(poller);
    };
  }, [url, pollUrl, token]);
}
```

### Pattern 4: Vite multi-entry build with shared vendor chunk
```ts
// frontend/vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const isPlayer = mode === "player";
  return {
    base: isPlayer ? "/player/" : "/",
    build: {
      outDir: isPlayer ? "dist/player" : "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: isPlayer
          ? path.resolve(__dirname, "player.html")
          : path.resolve(__dirname, "index.html"),
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (
                id.includes("/react/") ||
                id.includes("/react-dom/") ||
                id.includes("/scheduler/") ||
                id.includes("/@tanstack/react-query/")
              ) {
                return "vendor-react";
              }
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(isPlayer
        ? [
            VitePWA({
              registerType: "autoUpdate",
              scope: "/player/",
              base: "/player/",
              manifest: {
                name: "Signage Player",
                short_name: "Signage",
                start_url: "/player/",
                display: "fullscreen",
                background_color: "#0a0a0a",
                theme_color: "#0a0a0a",
                icons: [{ src: "/player/icon-192.png", sizes: "192x192", type: "image/png" }],
              },
              workbox: {
                navigateFallback: "/player/index.html",
                runtimeCaching: [
                  {
                    urlPattern: /\/api\/signage\/playlist/,
                    handler: "StaleWhileRevalidate",
                    options: {
                      cacheName: "signage-playlist-v1",
                      expiration: { maxEntries: 5, maxAgeSeconds: 86400 },
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                ],
              },
            }),
          ]
        : []),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": { target: process.env.VITE_API_TARGET || "http://api:8000", changeOrigin: true },
      },
    },
  };
});
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc -b && vite build && vite build --mode player",
    "build:admin": "vite build",
    "build:player": "vite build --mode player"
  }
}
```

### Pattern 5: Backend static-file serving for `/player/*`

Currently `backend/app/main.py` only mounts API routers. Phase 47 adds:

```python
# backend/app/main.py — additions
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

PLAYER_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "player"

# Static asset mount (CSS, JS, fonts, sw.js, manifest)
if PLAYER_DIST.exists():
    app.mount("/player/assets", StaticFiles(directory=PLAYER_DIST / "assets"), name="player-assets")

    # SPA fallback: /player/, /player/<token>, /player/anything → index.html
    @app.get("/player/{path:path}")
    @app.get("/player")
    async def player_spa_fallback(path: str = ""):
        # Static files at root of /player/ (manifest.webmanifest, sw.js, registerSW.js, icon-192.png)
        if path:
            candidate = PLAYER_DIST / path
            if candidate.is_file() and candidate.parent == PLAYER_DIST:
                return FileResponse(candidate)
        return FileResponse(PLAYER_DIST / "index.html")
```

Important: this must come AFTER all `/api/*` router mounts so the catch-all doesn't shadow APIs. `/api/*` routes already have priority because FastAPI matches in registration order. The `/player` catch-all only matches paths starting with `/player`.

In dev (Vite dev server), the `/player/` URL works directly via Vite — backend mount is for production-built assets only. The `if PLAYER_DIST.exists()` guard makes the mount no-op when the bundle hasn't been built (e.g. during `pytest`).

### Pattern 6: Player API adapter (apiClient exception)
The shared `apiClient.ts` is tied to Directus auth (uses `directus.refresh()`, module-singleton Directus access token). The player runs on a device JWT and has zero Directus context. Recommended path: a small `playerApi.ts` that does the token attach + 401 dispatch but is independent of `apiClient.ts`. This is the documented "Phase 47 exception" from ROADMAP cross-cutting hazard #2.

```ts
// frontend/src/player/lib/playerApi.ts
type Opts = RequestInit & { token: string; on401?: () => void };

export async function playerFetch<T>(url: string, opts: Opts): Promise<T> {
  const r = await fetch(url, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${opts.token}` },
  });
  if (r.status === 401) {
    opts.on401?.();
    throw new Error("device-revoked");
  }
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
```

Update `check-signage-invariants.mjs` (or the new `check-player-isolation.mjs`) to allow `fetch(` only inside `frontend/src/player/lib/playerApi.ts`. Mirrors the existing `signage/lib/` exemption for `ApiErrorWithBody`.

### Anti-Patterns to Avoid
- **Adding a SW to the admin bundle.** Only the player needs offline. Admin should NOT register an SW. Confine `VitePWA(...)` to `mode === 'player'` (shown in Pattern 4).
- **Putting media URLs in Workbox precache.** PITFALLS Pitfall 18: browser cache evicts under memory pressure; nightly Pi reboots wipe in-memory cache; result is black screen. Sidecar (Phase 48) is the canonical media-cache layer.
- **Building both entries from a single `vite build` invocation with a single config.** Vite has only one global `base`. Forcing both into one call creates `dist/index.html` referencing `/assets/` which would not work for the player at `/player/`. The two-pass build (`vite build && vite build --mode player`) is the simplest, least-magical fix.
- **Reusing the existing `apiClient.ts`.** It's Directus-coupled (`directus.refresh()`, etc.). The player has no Directus context. Use a dedicated `playerApi.ts` (Pattern 6).
- **Setting `EventSource` headers via a polyfill.** Don't pull in event-source-polyfill (~10 KB) just to set a Bearer header. Phase 45 already accepts the token via `?token=` query string.
- **Letting React StrictMode double-mount the EventSource hook without cleanup.** EventSource leak per re-mount → server queue overflow under D-04 last-writer-wins policy → cleanup churn. The hook's effect MUST close on cleanup (Pattern 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service Worker registration + lifecycle | Hand-rolled `navigator.serviceWorker.register()` glue | `vite-plugin-pwa` + auto-injected register script | Plugin handles cache-busting (file hash), update detection, scope edge cases |
| Workbox runtime caching rules | Custom `caches.open()` + `fetch()` interception | Workbox's `StaleWhileRevalidate` strategy via vite-plugin-pwa config | Workbox handles concurrent-fetch dedup, expiration eviction, response-status filtering, cache-storage quota awareness |
| Multi-entry Vite manual config gymnastics | Custom `rollupOptions` plus a pre-build step rewriting paths | Two `vite build` invocations differentiated by `mode`, one config file branching on `mode` (Pattern 4) | Standard Vite idiom; no third-party plugin needed |
| pdf.js worker loader | Manually copying the worker file to `dist/` and hand-coding `workerSrc` to a hardcoded path | `import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"` (Vite handles cache-busting + emit) | One line; survives version bumps; emits with content hash |
| Locale auto-detect | i18next initialization with HTTP backend, language detector plugin | A 10-line `locale.ts` returning `'de' \| 'en'` from `navigator.language.startsWith('de') ? 'de' : 'en'`, plus a hard-coded EN/DE string map (Pitfall P9) | i18next + react-i18next + the HTTP detector is ~30KB; player has 5 strings — overhead exceeds payload by 100× |
| Bundle-size assertion | A bash script piping `wc -c` through `gzip` | A small Node script using `zlib.gzipSync` + `fs.readdirSync` over `dist/player/assets/*.js` | Cross-platform (Pi-CI vs Mac dev); Node is already in the toolchain |
| Pairing-status polling | Custom `setInterval` + ref tracking | TanStack Query `refetchInterval` with `gcTime: 0` | Already loaded for the project; handles loading/error/cleanup |
| EventSource + watchdog state machine | XState or Redux-saga | A custom `useSseWithPollingFallback` hook (~80 LOC) | XState is ~15KB; the state machine has 5 states and 7 transitions — fits cleanly in a hook |

**Key insight:** This phase's gravitational pull toward "let's build a tiny custom thing" needs to be resisted only at the SW + Workbox layer. Workbox's edge-case handling (cache eviction, cacheable-response filtering, concurrent fetch coalescing) is exactly the kind of detail that, if hand-rolled, will silently fail on a Pi at 3 AM during a Wi-Fi flap. Everywhere else, the project already has the right tool installed.

## Common Pitfalls

### Pitfall P1: vite-plugin-pwa peer-dep mismatch with Vite 8
**What goes wrong:** `npm install vite-plugin-pwa` (without `--legacy-peer-deps`) on a Vite-8 project errors with `ERESOLVE could not resolve peerDependency vite@^7.0.0` because vite-plugin-pwa 1.2.0's peer-dep range stops at `^7.0.0` (verified via `npm view vite-plugin-pwa peerDependencies` on 2026-04-19).
**Why it happens:** Vite 8 was released after vite-plugin-pwa 1.2.0; the peer-dep wasn't bumped. PR for `^8.0.0` opened in vite-plugin-pwa issue #918 / #923 on 2026-04-08 — not yet in a published release as of 2026-04-19.
**How to avoid:** Install with `npm install --save-dev vite-plugin-pwa@1.2.0 workbox-window@7.4.0 --legacy-peer-deps`. Add a `package.json` `overrides` block for any sub-deps the plugin pulls in. Document in the plan that this workaround should be removed once vite-plugin-pwa publishes a release with `vite ^8.0.0` in peer-deps. Verified: the plugin works correctly with Vite 8 functionally (per maintainer comments in #918) — only the peer-dep declaration is stale.
**Warning signs:** `npm install` fails with ERESOLVE at the plan's first task; CI fails on `npm ci` if the workaround is left out.

### Pitfall P2: Service Worker scope without `base` matching
**What goes wrong:** SW registers but never activates for the player routes; or activates with scope `/` and starts intercepting admin requests.
**Why it happens:** The SW's effective scope is upper-bounded by the directory of its registering script. If `sw.js` is emitted to `dist/player/sw.js` but Vite's `base: '/player/'` is not set, the registration script may try to register from `/sw.js` (root), which is a 404, or the scope mismatch silently registers with a wrong root.
**How to avoid:** Both `base: '/player/'` AND `VitePWA({ scope: '/player/', base: '/player/' })` must be set. Verify post-build by inspecting `dist/player/index.html` — the auto-injected register script should reference `/player/sw.js` and `scope: '/player/'`. Also: backend must serve `/player/sw.js` with `Service-Worker-Allowed: /player/` header (or just `Service-Worker-Allowed: /` if you ever need broader scope, but we don't).
**Warning signs:** DevTools → Application → Service Workers shows scope `/` (wrong) or fails to register; the runtime cache for `/api/signage/playlist` never populates.

### Pitfall P3: Two-pass `vite build` wipes `dist/` between passes
**What goes wrong:** `npm run build` outputs only the player; `dist/index.html` (admin) is gone after the second invocation.
**Why it happens:** Vite's default `build.emptyOutDir: true` wipes the configured `outDir` at the start of each build. With two builds and overlapping `outDir`s, the second wipes the first.
**How to avoid:** Use distinct `outDir`s per mode. The pattern in §"Architecture Patterns" Pat4 already does this: admin → `dist/`, player → `dist/player/`. Set `emptyOutDir: true` for both (each only wipes its own). Player output is cleanly nested inside admin's `dist/` because Vite's empty-out-dir only wipes the configured path, not subdirectories that match... actually, it wipes the entire `outDir` including subdirectories. Run player build FIRST so admin (which wipes `dist/` then writes its files alongside the player subdir) — wait, that's the problem too. **Correct fix:** run admin build first (wipes `dist/`), THEN player build (wipes `dist/player/` only, leaves `dist/index.html` and `dist/assets/` intact). Order matters.
**Warning signs:** After `npm run build`, only one of the two HTML entries exists in `dist/`.

### Pitfall P4: `manualChunks` causing chunk-load failures across entries
**What goes wrong:** Both entries reference `vendor-react.[hash].js`. Player loads it from `/player/assets/vendor-react.[hash].js`; admin from `/assets/vendor-react.[hash].js`. Build emits TWO copies (one per outDir) — that's correct. But if a user visits admin and the browser caches `/assets/vendor-react.[hash].js`, then visits the player, the player loads `/player/assets/vendor-react.[hash].js` (different URL, different cache key) — **no cross-route cache reuse**. CONTEXT D-5 promised "a Pi that has visited admin once already has React cached for the player" — that promise needs adjustment.
**Why it happens:** HTTP cache is keyed by URL, not by content hash. Two URLs with the same content = two cache entries.
**How to avoid:** Either accept the limitation (the chunk is still small — React 19 + react-dom + react-query gzipped ≈ 50–60 KB; download once per route domain) OR move the vendor chunk to a single canonical URL like `/shared/vendor-react.[hash].js` via Rollup's `output.assetFileNames` + a backend mount serving `/shared/*` from a deduplicated location. **Recommendation: accept the limitation.** Pis visit only the player; admins visit only admin. Cross-route cache reuse only matters if a Pi browser is also used for admin, which doesn't happen in this kiosk workflow. Document this honestly in the plan; do not over-engineer for a benefit no real user gets.
**Warning signs:** None at runtime — works correctly. The "issue" is only a deviation from CONTEXT D-5's stated benefit.

### Pitfall P5: pdf.js worker version mismatch throws at runtime
**What goes wrong:** `UnknownErrorException: The API version "X.Y.Z" does not match the Worker version "A.B.C"` on first PDF render; PDFs never display.
**Why it happens:** react-pdf 10.4.1 transitively pulls a `pdfjs-dist` version; the `?url` worker import grabs whatever's in `node_modules/pdfjs-dist/`. If that version drifts from what react-pdf was tested against, the API/worker mismatch throws.
**How to avoid:** The `package.json` `overrides: { "pdfjs-dist": "5.6.205" }` block forces the entire dep tree to resolve `pdfjs-dist` to exactly 5.6.205. Then the `?url` import grabs the matching worker. Verify post-install with `npm ls pdfjs-dist` — should show only one version.
**Warning signs:** Console error on first PDF load referencing API/Worker version mismatch.

### Pitfall P6: SPA fallback shadows static assets
**What goes wrong:** `/player/sw.js` returns `index.html` instead of the actual SW. Browser tries to register HTML as a Service Worker → fails. Same for `/player/manifest.webmanifest`, `/player/icon-192.png`.
**Why it happens:** The catch-all route `/player/{path:path}` matches everything, including direct asset requests at `/player/sw.js` (not under `/player/assets/`).
**How to avoid:** The fallback route must check whether the requested path resolves to an actual file in `dist/player/` and serve it directly if so; only return `index.html` when the path doesn't exist on disk. Pattern 5 above does this correctly. Mount `/player/assets` as `StaticFiles` first so files under `/assets/` are served by the mount (not the catch-all).
**Warning signs:** SW registration fails with "MIME type 'text/html' is not a valid SW MIME type"; manifest.webmanifest HEAD returns text/html.

### Pitfall P7: EventSource `?token=` ends up in access logs
**What goes wrong:** Device JWT visible in nginx/uvicorn access logs forever; an ops engineer with log access can replay the token. Token leak.
**Why it happens:** Browsers cannot set custom headers on EventSource (per spec), so the only way to authenticate is via cookie OR query string. Phase 45 chose query string per Phase 42 D-03 (Bearer in headers, query for SSE).
**How to avoid:** This is an **accepted trade-off** documented at the system level — Phase 42 chose query-string auth for SSE explicitly. Mitigations the player can apply:
1. Configure access-log filtering on the backend's reverse proxy (out of scope for Phase 47, but flag in plan).
2. Token TTL is 24h (Phase 42 D-01) so leaked tokens have bounded lifetime.
3. Admin "Revoke device" endpoint (Phase 42 D-14) provides immediate kill if leak detected.
4. Tokens are scoped to `/api/signage/player/*` only (Pitfall 21).

The plan should NOT attempt to "fix" this in Phase 47 — it would require either cookie-based SSE auth (Phase 42 rejected) or an EventSource polyfill that can set headers (rejected for bundle size). Just document the trade-off in the plan's risks section.
**Warning signs:** None at runtime — informational only.

### Pitfall P8: Service Worker cached the OLD playlist endpoint shape after backend migration
**What goes wrong:** Backend evolves `/api/signage/playlist` envelope shape (e.g., adds a field, changes ETag generation); SW serves the old cached response from before the upgrade; player breaks.
**Why it happens:** SWR returns cached value first, then refetches in background. If the new shape is incompatible, the player crashes BEFORE the background refresh completes.
**How to avoid:** Bump `cacheName` ("signage-playlist-v1" → "signage-playlist-v2") whenever the envelope shape changes. CONTEXT D-13 already pins it as `signage-playlist-v1`. Document the rule in `vite.config.ts` as a comment near the cache config.
**Warning signs:** After deploying a backend change to `/playlist` shape, devices show black screen or partial render until the SW unregisters.

### Pitfall P9: i18next blowing the 200 KB budget for 5 strings
**What goes wrong:** Player imports `i18next` + `react-i18next` to handle 5 locale strings; gzipped that's ~25 KB → 12% of the entire 200 KB budget for ~150 bytes of actual translatable text.
**Why it happens:** Reflexive reuse of the admin's i18n stack.
**How to avoid:** Hard-code the 5 strings in a tiny module:
```ts
// frontend/src/player/lib/strings.ts
const STRINGS = {
  en: {
    pairHeadline: "Pair this device",
    pairHint: "Enter this code in the admin panel under Signage → Devices → Pair new device",
    offlineLabel: "Offline",
    offlineAria: "Player is offline; cached content is playing",
  },
  de: {
    pairHeadline: "Verbinde dieses Gerät",
    pairHint: "Gib diesen Code im Admin-Panel unter Signage → Geräte → Neues Gerät koppeln ein",
    offlineLabel: "Offline",
    offlineAria: "Wiedergabe läuft offline; Inhalte werden aus dem Cache gespielt",
  },
} as const;
const lang: "en" | "de" = navigator.language.startsWith("de") ? "de" : "en";
export const t = (key: keyof typeof STRINGS["en"]) => STRINGS[lang][key];
```

**Tension with the cross-cutting hazard #1 (DE/EN i18n parity).** The CI parity script (`scripts/check-i18n-parity.mjs`) scans `frontend/src/locales/{en,de}.json` — it doesn't see the player's hard-coded strings. UI-SPEC actually asserts the player's 5 keys go into `signage.player.*` namespace in `en.json` and `de.json`. Two paths:

- **Path A (UI-SPEC literal):** add 5 keys to `en.json` and `de.json`, import i18next in the player. Pay the ~25 KB. Honors UI-SPEC + parity gate as written.
- **Path B (bundle-size-driven):** hard-code in `strings.ts`, write a custom CI test that asserts the file declares both EN and DE for every key, and add a comment in the locale files noting "player namespace lives in code (Phase 47 bundle-size discretion); see frontend/src/player/lib/strings.ts."

**Recommendation: Path B**, because the 200 KB budget is a hard ROADMAP gate (success criterion 1) and 25 KB is 12% of it. The DE/EN parity *intent* (every operator-facing string must be DE+EN) is preserved; only the *enforcement mechanism* changes. Plan must include the small custom strings-parity test. This is a deliberate documented divergence from UI-SPEC; flag it for human approval at the planner check stage.

### Pitfall P10: Sidecar feature-detection via window flag is unreliable on first paint
**What goes wrong:** CONTEXT D-1 specifies `window.signageSidecarReady === true` set by the sidecar via injected `<script>`. If the player's `mediaUrl.ts` is called BEFORE the sidecar's injected script runs (race), it returns the direct URL even when the sidecar IS available. First image loads from network; subsequent loads from sidecar. Inconsistency.
**Why it happens:** Script injection order via Chromium kiosk's `--user-data-dir` extension or a sidecar-served HTML wrapper is timing-dependent.
**How to avoid:** Use a `useSidecarStatus()` hook that re-evaluates on mount (after first paint) and on a `signage:sidecar-ready` custom-event listener. Sidecar dispatches that event after setting the flag. Alternative: feature-detect via `fetch('http://localhost:8080/health', { signal: AbortSignal.timeout(200) })` — 200 ms timeout, treat error as "no sidecar." This works without sidecar cooperation but adds 200 ms boot latency. **Recommendation: hybrid** — read the window flag synchronously on mount, then for safety fall back to the fetch probe with a 200ms timeout. Cache the result for the session. The exact handshake protocol with the sidecar is Phase 48's responsibility; Phase 47 ships a robust detector that works with whichever the sidecar implements.
**Warning signs:** Inconsistent first-image-source on Pis where sidecar starts after Chromium.

### Pitfall P11: Bundle-size script using a flaky gzip implementation
**What goes wrong:** Different gzip implementations (system `gzip`, Node `zlib`, gzip-size npm) give different byte counts; CI passes locally but fails on a different host or vice versa.
**Why it happens:** gzip compression level defaults differ; some implementations include filename + timestamp metadata.
**How to avoid:** Use Node's built-in `zlib.gzipSync(buffer, { level: 9 })` (matches gzip's default `-9`); skip the system `gzip` binary entirely. Sum sizes of all `.js` files in `dist/player/assets/`. Assert against 200_000 bytes. Single deterministic implementation.
```js
// frontend/scripts/check-player-bundle-size.mjs (sketch)
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const ASSETS = "frontend/dist/player/assets";
const LIMIT = 200_000;
const total = readdirSync(ASSETS)
  .filter((f) => f.endsWith(".js"))
  .reduce((sum, f) => sum + gzipSync(readFileSync(join(ASSETS, f)), { level: 9 }).length, 0);
console.log(`Player JS gzipped total: ${total} bytes (limit ${LIMIT})`);
process.exit(total <= LIMIT ? 0 : 1);
```

### Pitfall P12: Disabling Video `loop` requires PlayerRenderer prop change
**What goes wrong:** Phase 46-03 SUMMARY notes the admin-preview `<VideoPlayer>` uses `loop`; Phase 47 needs `loop=false` so video plays once and onended advances. Phase 47 plan modifies `<VideoPlayer>` directly → admin preview breaks.
**Why it happens:** Single component shared by two consumers with different needs.
**How to avoid:** Add a `loop?: boolean` prop to `<VideoPlayer>` defaulting to `true` (admin-preview backward-compat). Player wrapper passes `loop={false}`. The change is purely additive; no admin call sites need updating. PlayerRenderer also needs to plumb the prop through if it owns the dispatch — likely a small interface widening on `PlayerItem` or a wrapper-level prop. Verify the Phase 46-03 contract surface; if PlayerRenderer's API doesn't expose per-handler config, the player wraps each `VideoPlayer` itself rather than relying on PlayerRenderer's switch dispatch.
**Warning signs:** Admin preview video stops looping after Phase 47 ships (regression).

## Runtime State Inventory

Not applicable — Phase 47 is a greenfield bundle build. No rename, refactor, or migration of existing runtime state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (frontend build toolchain) | npm install / vite build | ✓ | (project standard, v22+) | — |
| npm registry | install vite-plugin-pwa, workbox-window | ✓ | — | — |
| Vite 8.0.4 | second build entry | ✓ (already installed in `frontend/`) | 8.0.4 | — |
| react-pdf 10.4.1 | PdfPlayer (already shipped Phase 46-03) | ✓ | 10.4.1 | — |
| pdfjs-dist 5.6.205 | worker file for PDF rendering | ✓ (transitively via react-pdf; pinned by `overrides`) | 5.6.205 | — |
| Phase 42 backend `/api/signage/pair/*` endpoints | Pairing screen | ✓ | shipped Phase 42 | — |
| Phase 43 backend `/api/signage/playlist` endpoint | Playlist polling fallback + SW cache | ✓ | shipped Phase 43 | — |
| Phase 45 backend `/api/signage/stream` endpoint | EventSource | ✓ | shipped Phase 45 | — |
| Phase 48 sidecar daemon | Media-URL rewrite, offline media, heartbeat | ✗ (Phase 48 — not yet shipped) | — | Player gracefully degrades: `window.signageSidecarReady === undefined` → fall through to direct media URLs from API; no offline media; no heartbeat; offline chip stays hidden. UI-SPEC Surface 3 already specifies this behavior. |
| Pi hardware for E2E test of <200KB target | Bundle-size verification | ✗ (build runs on dev machine) | — | Build script runs on any host; size assertion is deterministic via Node `zlib`. Pi-side test belongs to Phase 48. |
| Chromium kiosk on Pi | Visual smoke test of player | ✗ (Phase 48) | — | Dev verification via Chrome on Mac is sufficient for Phase 47 closure; Pi-side E2E is Phase 48 success criterion 1. |

**Missing dependencies with no fallback:** None blocking Phase 47.

**Missing dependencies with fallback:** Phase 48 sidecar — player degrades gracefully and ships fully functional in dev/preview without it.

## Code Examples

### Example 1: `player.html` entry HTML (NEW file)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/player/manifest.webmanifest" />
    <meta name="theme-color" content="#0a0a0a" />
    <title>Signage Player</title>
  </head>
  <body class="bg-neutral-950">
    <div id="player-root"></div>
    <script type="module" src="/src/player/main.tsx"></script>
  </body>
</html>
```

### Example 2: `useDeviceToken` hook
*(See Pattern 1 above)*

### Example 3: `useSseWithPollingFallback` hook
*(See Pattern 3 above; full implementation deferred to plan task)*

### Example 4: pdf.js worker pin
```ts
// frontend/src/player/lib/pdfWorker.ts
// Source: vite-plugin-pwa docs + Vite "?url" import pattern + pdf.js v5 docs
import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;
```
Import this once at the top of `frontend/src/player/main.tsx` BEFORE rendering. Phase 46-03 `PdfPlayer.tsx` does NOT set `GlobalWorkerOptions` itself (per Phase 46-03 SUMMARY decision: "Phase 47 owns the pdfjs-dist worker pin"); Phase 47's player entry sets it once globally so all PdfPlayer instances inherit.

### Example 5: Media-URL rewrite hook
```ts
// frontend/src/player/lib/mediaUrl.ts
// Source: CONTEXT D-1, "Specific Ideas" snippet
import type { SignageMedia } from "@/signage/lib/signageTypes";

declare global {
  interface Window {
    signageSidecarReady?: boolean;
  }
}

export function resolveMediaUrl(media: { id: string; uri: string }): string {
  if (typeof window !== "undefined" && window.signageSidecarReady === true) {
    return `http://localhost:8080/media/${media.id}`;
  }
  return media.uri;
}
```

### Example 6: Player isolation CI guard (D-5)
```js
// frontend/scripts/check-player-isolation.mjs
// Source: mirrors check-signage-invariants.mjs style (Phase 46)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const PLAYER_ROOT = resolve(repoRoot, "frontend/src/player");
const FORBIDDEN = [
  /from\s+["']@\/signage\/pages\//,
  /from\s+["']@\/signage\/components\/Media/,
  /from\s+["']@\/signage\/components\/Playlist/,
  /from\s+["']@\/signage\/components\/Device/,
  /from\s+["']@\/components\/admin\//,
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

let violations = 0;
for (const f of walk(PLAYER_ROOT)) {
  const src = readFileSync(f, "utf8");
  src.split("\n").forEach((line, i) => {
    for (const re of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`PLAYER_ISOLATION_VIOLATION: ${f}:${i + 1}: ${line.trim()}`);
        violations++;
      }
    }
  });
}
process.exit(violations > 0 ? 1 : 0);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Webpack + workbox-webpack-plugin | Vite + vite-plugin-pwa | Vite reached parity ~2022; vite-plugin-pwa 1.0 GA in March 2025 | Standard for new Vite projects; integrates Workbox without bundler-specific config |
| pdf.js worker via CDN URL | `import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"` | Vite-native pattern stable since Vite 4 | Self-hosted, version-locked, cache-busted |
| react-pdf legacy worker setup (`pdfjs-dist/legacy/build/pdf.worker.min.js`) | ESM build via `pdf.worker.min.mjs` | pdfjs-dist v4+ shipped ESM worker | Smaller, modern; required for pdfjs-dist 5.x |
| EventSource + custom polyfill for header auth | EventSource + `?token=` query | Chrome/Firefox EventSource spec stable; polyfill abandoned | Smaller bundle; trade-off documented in Pitfall P7 |
| Manual Service Worker file with hand-coded `caches.open()` | Workbox runtime caching strategies declared in vite-plugin-pwa config | Workbox 7 stable since 2023 | Less code, fewer edge-case bugs |

**Deprecated/outdated:**
- pdfjs-dist `legacy/` build path — superseded by ESM `build/` for v4+; Phase 47 uses the modern path.
- `vite-plugin-pwa` < 1.0 (2024 and earlier) — config field names changed at 1.0; references to `manifestPath` etc. in old blog posts are outdated.

## Open Questions

1. **Path A vs Path B for player i18n (i18next vs hard-coded strings)?**
   - What we know: UI-SPEC says `signage.player.*` namespace in JSON locale files (Path A). 200 KB bundle gate is a hard ROADMAP gate. i18next costs ~25 KB.
   - What's unclear: whether the 25 KB pushes total over budget once all other code is in. The bundle-budget calculation can only be made empirically after first build.
   - Recommendation: **Plan Wave 0 measures the bundle with i18next included; if total < 175 KB go Path A; else go Path B** with the custom strings-parity test. Document the chosen path in 47-VERIFICATION.md.

2. **Should `vendor-react` chunk be served from a single shared URL?**
   - What we know: Pattern 4 emits two copies (one per outDir). HTTP cache won't deduplicate.
   - What's unclear: whether any real user actually visits both surfaces from the same browser (no — admins don't kiosk, kiosks don't admin).
   - Recommendation: **accept the two-copy outcome**; document in plan that CONTEXT D-5's "shared cache benefit" is theoretical for this deployment shape and the chunk extraction's real benefit is the per-route bundle-size discipline.

3. **Sidecar handshake protocol — exactly how does the sidecar set `window.signageSidecarReady`?**
   - What we know: CONTEXT D-1 says "via injected `<script>` or feature-detect."
   - What's unclear: whether the sidecar serves a wrapper HTML that injects `<script>window.signageSidecarReady=true</script>` before loading the player, or writes a Chromium extension, or relies on the player to fetch-probe localhost:8080.
   - Recommendation: **Phase 47 ships the hybrid detector** (Pitfall P10 — read flag synchronously, fall back to 200ms localhost fetch probe). This makes Phase 47 robust regardless of the eventual Phase 48 implementation choice.

4. **Does the existing Phase 45 `/stream` endpoint accept `?token=<jwt>` query string today?**
   - What we know: Phase 45 plan summaries reference token-via-query but this researcher did not directly inspect the route handler.
   - What's unclear: whether the dep is `Depends(get_current_device)` parsing only the `Authorization` header (which would fail for EventSource) or a custom dep that also reads `request.query_params['token']`.
   - Recommendation: **Plan Wave 0 verifies by curling `GET /api/signage/stream?token=<test_jwt>`**. If 401, a backend tweak to `signage_player.py` is needed (small, in scope as a phase 47 prerequisite). If 200, no backend change needed.

## Sources

### Primary (HIGH confidence)
- **CONTEXT.md** for Phase 47 — locked decisions D-1 through D-13
- **UI-SPEC.md** for Phase 47 — all visual + interaction contracts
- **Phase 46-03 SUMMARY** — `<PlayerRenderer>` API + Phase 47 hand-off notes (loop disable, pdfjs pin)
- **Phase 45 CONTEXT** — `/stream` contract, 15s pings, per-device queue, last-writer-wins
- **Phase 43 CONTEXT** — `/playlist` envelope + ETag contract
- **Phase 42 CONTEXT** — pairing flow + device JWT format + `?token=` SSE auth choice
- **PITFALLS.md** — Pitfalls 13 (pairing collision), 18 (offline cache), 21 (token scope)
- **Vite 8 official docs** — multi-entry rollupOptions, manualChunks, build modes — https://vite.dev/guide/build, https://vite.dev/config/build-options
- **vite-plugin-pwa 1.2.0 source + GitHub issues** — https://github.com/vite-pwa/vite-plugin-pwa
- **vite-plugin-pwa Vite 8 peer-dep tracking** — https://github.com/vite-pwa/vite-plugin-pwa/issues/918, /issues/923
- **vite-plugin-pwa multi-entry SW limitation** — https://github.com/vite-pwa/vite-plugin-pwa/issues/263
- **Workbox StaleWhileRevalidate docs** — https://vite-pwa-org.netlify.app/workbox/generate-sw
- **`npm view`** verifications run 2026-04-19: vite-plugin-pwa 1.2.0, workbox-window 7.4.0, pdfjs-dist 5.6.205

### Secondary (MEDIUM confidence)
- **Workbox runtime caching tutorials** (CSS-Tricks, dev.to) — confirmed config shape against official Workbox docs
- **Vite manualChunks blog posts** (soledadpenades.com 2025, sambitsahoo.com) — function-form pattern verified against Vite official docs
- **React StrictMode + EventSource cleanup** (Mozilla bugzilla, React docs) — pattern verified across multiple sources

### Tertiary (LOW confidence)
- **Sidecar handshake protocol details** — CONTEXT D-1 is the only source; exact mechanism is Phase 48's call. Researcher recommends the hybrid detector path because no upstream documentation exists.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — every package version verified against npm registry on 2026-04-19
- Architecture (multi-entry Vite, manualChunks, vite-plugin-pwa): HIGH — patterns cross-verified against official docs + multiple community examples
- pdf.js worker pin: HIGH — well-documented Vite + pdfjs-dist pattern
- Backend static-file mount: HIGH — standard FastAPI StaticFiles + catch-all idiom; verified against current `main.py`
- vite-plugin-pwa Vite 8 peer-dep workaround: HIGH on the constraint (verified directly via `npm view`); MEDIUM on functional compatibility (relies on maintainer comments in issue #918)
- Pitfalls: HIGH — drawn from PITFALLS.md + ecosystem-known issues
- Sidecar handshake: LOW — Phase 48 territory; researcher recommends graceful-degradation pattern that works with any reasonable Phase 48 implementation
- i18n Path A vs Path B trade-off: MEDIUM — empirical bundle measurement needed to make the call

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days for stable areas; vite-plugin-pwa Vite-8 peer-dep status should be re-checked weekly until a release with `^8.0.0` ships).
