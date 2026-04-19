---
phase: 47-player-bundle
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/vite.config.ts
  - frontend/package.json
  - frontend/player.html
  - frontend/src/player/main.tsx
  - frontend/src/player/lib/durationDefaults.ts
  - frontend/src/player/lib/strings.ts
  - frontend/src/player/lib/locale.ts
  - frontend/src/player/lib/mediaUrl.ts
  - frontend/src/player/lib/playerApi.ts
  - frontend/src/player/lib/queryKeys.ts
  - frontend/src/player/lib/pdfWorker.ts
autonomous: true
requirements: [SGN-PLY-01, SGN-PLY-10]
must_haves:
  truths:
    - "frontend/player.html exists as a second Vite entry HTML"
    - "vite.config.ts branches on `mode === 'player'` to set base, outDir, rollupOptions.input, manualChunks vendor-react, and conditionally registers vite-plugin-pwa"
    - "package.json contains vite-plugin-pwa@1.2.0 + workbox-window@7.4.0 in devDependencies and overrides.pdfjs-dist === '5.6.205'"
    - "All player /lib/ helpers (durationDefaults, strings, locale, mediaUrl, playerApi, queryKeys, pdfWorker) exist and export their stated APIs"
  artifacts:
    - path: frontend/vite.config.ts
      provides: "multi-entry config with player mode branch + manualChunks + PWA plugin"
      contains: "mode === \"player\""
    - path: frontend/package.json
      provides: "deps + pdfjs-dist override"
      contains: "vite-plugin-pwa"
    - path: frontend/player.html
      provides: "player entry HTML"
      contains: "/src/player/main.tsx"
    - path: frontend/src/player/lib/durationDefaults.ts
      provides: "per-format default duration constants (D-6)"
      exports: ["IMAGE_DEFAULT_DURATION_S", "PDF_PER_PAGE_DURATION_S", "VIDEO_DURATION_NATURAL", "IFRAME_DEFAULT_DURATION_S", "HTML_DEFAULT_DURATION_S", "PPTX_PER_SLIDE_DURATION_S", "applyDurationDefaults"]
    - path: frontend/src/player/lib/strings.ts
      provides: "5 hard-coded EN+DE strings + t() helper (Path B per OQ1)"
      exports: ["t", "STRINGS"]
    - path: frontend/src/player/lib/playerApi.ts
      provides: "device-JWT fetch adapter (apiClient exception)"
      exports: ["playerFetch"]
  key_links:
    - from: frontend/vite.config.ts
      to: frontend/player.html
      via: "rollupOptions.input when mode === 'player'"
      pattern: "player\\.html"
    - from: frontend/package.json
      to: pdfjs-dist@5.6.205
      via: "overrides field"
      pattern: "\"pdfjs-dist\":\\s*\"5\\.6\\.205\""
---

<objective>
Land the foundation for the Phase 47 player bundle: a second Vite entry, the dependency manifest (with the `vite-plugin-pwa` Vite-8 peer-dep workaround and the `pdfjs-dist` override pin), and all pure-utility modules that downstream plans (47-02..05) will import. This plan touches NO React components — only build config + standalone helper modules + the entry stub. Resolves OQ1 (i18n) by going Path B (hard-coded strings) per RESEARCH.md Pitfall P9 to protect the <200KB budget; resolves OQ4 (`/stream?token=`) via a curl probe documented in Task 0.

Purpose: Strip foundational risk before any UI code is written. Build config is fragile (Pitfall P3 outDir order, P2 SW scope, P5 worker pin). Get it right once.
Output: A buildable second Vite entry that emits an empty `dist/player/index.html` shell, plus all `frontend/src/player/lib/*.ts` modules ready to import.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/47-player-bundle/47-CONTEXT.md
@.planning/phases/47-player-bundle/47-RESEARCH.md
@.planning/phases/47-player-bundle/47-UI-SPEC.md
@frontend/vite.config.ts
@frontend/package.json
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/lib/queryKeys.ts

<interfaces>
<!-- Phase 46-03 PlayerRenderer types (frontend/src/signage/player/types.ts) — downstream plans use these -->
type PlayerItemKind = "image" | "video" | "pdf" | "iframe" | "html" | "pptx";
type PlayerTransition = "fade" | "cut";
interface PlayerItem {
  id: string;
  kind: PlayerItemKind;
  uri: string;
  duration_s?: number;
  transition?: PlayerTransition;
  // pdf: pageCount?, pptx: slide_paths?, html: html_content?
  [key: string]: unknown;
}

<!-- Phase 43 envelope — what /api/signage/player/playlist returns -->
interface SignagePlaylistEnvelope {
  playlist_id: string | null;
  name: string | null;
  items: Array<{
    media_id: string;
    kind: PlayerItemKind;
    uri: string;
    duration_ms: number;  // NOTE: ms on the wire; player converts to seconds via duration_s = ms/1000
    transition: PlayerTransition;
    position: number;
  }>;
  resolved_at: string;
}

<!-- Phase 45 SSE event payload (45-CONTEXT D-01) -->
interface SsePlaylistChangedEvent {
  event: "playlist-changed";
  playlist_id: string;  // serialized as str(uuid)
  etag: string;
}

<!-- Phase 42 pairing contracts -->
// POST /api/signage/pair/request → { pairing_code: "XXX-XXX", pairing_session_id: "<uuid>", expires_in: 600 }
// GET  /api/signage/pair/status?pairing_session_id=<uuid> → { status: "pending" } | { status: "claimed", device_token: "<jwt>" } | { status: "claimed_consumed" } | { status: "expired" }
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Verify /stream?token= accepts query auth (OQ4 resolution)</name>
  <files>.planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md</files>
  <read_first>
    - backend/app/routers/signage_player.py (or backend/app/routers/signage_player/__init__.py — find the /stream route handler)
    - backend/app/security/device_auth.py (`get_current_device` — see if it reads from `request.query_params` or only from the Authorization header)
    - .planning/phases/45-sse-broadcast/45-02-stream-endpoint-and-notify-hooks-SUMMARY.md (if exists; otherwise grep `45-*-SUMMARY.md` for `?token=` or `query_params`)
  </read_first>
  <action>
    Inspect the existing `/api/signage/player/stream` route handler and `get_current_device` dep. Determine whether the dep extracts the device JWT from `request.query_params['token']` as a fallback when the `Authorization` header is missing (required for browser EventSource which cannot set custom headers per RESEARCH §"Open Questions" OQ4 + Pitfall P7).

    Three possible outcomes — write the resolution into `47-OQ4-RESOLUTION.md`:

    1. **PASS — dep already supports `?token=`:** Document the exact code location (file:line) where `request.query_params['token']` is consulted. No further action; the player bundle uses `new EventSource('/api/signage/player/stream?token=' + deviceToken)` directly.

    2. **PASS — separate /stream uses a custom token-query dep:** If `/stream` is wired with a different dep (e.g., `get_current_device_from_query`), document the dep name + file:line. Player uses the same query-string URL.

    3. **FAIL — neither header nor query supports token-from-query:** Write a `<scope_change>` block in the resolution file recording that 47-04 (or a new prerequisite plan) MUST add a small backend tweak to `get_current_device` to read `request.query_params.get('token')` as a fallback when `Authorization` header is absent. Flag in the file as a BLOCKER for 47-03 (the SSE hook plan).

    Write the file with format:
    ```
    # OQ4 Resolution: /stream ?token= query-string device JWT auth
    Date: <today>
    Outcome: PASS | FAIL
    Evidence: <file:line(s) of the code that reads/doesn't read query_params[token]>
    Action required: <none | which plan owns the backend tweak>
    ```

    Do NOT modify any backend code in this plan; only document the finding.
  </action>
  <verify>
    <automated>test -f .planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md && grep -E "^Outcome: (PASS|FAIL)" .planning/phases/47-player-bundle/47-OQ4-RESOLUTION.md</automated>
  </verify>
  <done>
    `47-OQ4-RESOLUTION.md` exists with explicit `Outcome: PASS` or `Outcome: FAIL` line and concrete file:line evidence. If FAIL, the file flags 47-03 as blocked pending a backend dep tweak.
  </done>
</task>

<task type="auto">
  <name>Task 1: Install deps + pdfjs-dist override + add player build scripts</name>
  <files>frontend/package.json, frontend/package-lock.json</files>
  <read_first>
    - frontend/package.json (current scripts + deps)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§"Standard Stack" + §"Common Pitfalls" P1 — vite-plugin-pwa peer-dep workaround)
  </read_first>
  <action>
    From the `frontend/` directory, run:
    ```bash
    cd frontend && npm install --save-dev vite-plugin-pwa@1.2.0 workbox-window@7.4.0 --legacy-peer-deps
    ```

    Then edit `frontend/package.json`:

    1. Add an `overrides` block at the top level (sibling of `dependencies`/`devDependencies`):
    ```json
    "overrides": {
      "pdfjs-dist": "5.6.205"
    }
    ```

    2. Update the `scripts` block:
    ```json
    "scripts": {
      "dev": "vite",
      "dev:player": "vite --mode player",
      "build": "tsc -b && vite build && vite build --mode player",
      "build:admin": "vite build",
      "build:player": "vite build --mode player",
      "lint": "eslint .",
      "preview": "vite preview",
      "test": "vitest",
      "check:signage": "node scripts/check-signage-invariants.mjs",
      "check:player-isolation": "node scripts/check-player-isolation.mjs",
      "check:player-size": "node scripts/check-player-bundle-size.mjs"
    }
    ```

    Note: `check:player-isolation` and `check:player-size` scripts are added by Plan 47-05; the `package.json` script entries land here so the script names are stable.

    3. After editing, re-run `cd frontend && npm install --legacy-peer-deps` to refresh the lockfile against the override.

    4. Verify the override worked:
    ```bash
    cd frontend && npm ls pdfjs-dist
    ```
    Should show pdfjs-dist@5.6.205 (single version, no duplicates).

    DO NOT add `vite-plugin-pwa` import to `vite.config.ts` yet — that lands in Task 2.

    The `--legacy-peer-deps` flag is required because vite-plugin-pwa@1.2.0's peer-dep declaration tops out at `vite ^7.0.0` and we are on Vite 8 (per RESEARCH Pitfall P1 — verified 2026-04-19; PR #918 not yet released). Add an inline comment in `package.json` near the override block:
    ```json
    "//pdfjs-dist": "Pinned 5.6.205 to defeat react-pdf's transitive bump; matches Phase 46-03 SUMMARY hand-off and SGN-PLY-10. Drop override when react-pdf 11.x ships with matching pin.",
    "//vite-plugin-pwa": "Installed with --legacy-peer-deps because plugin's peer-dep stops at vite ^7. Drop workaround when vite-plugin-pwa publishes a release with vite ^8.0.0 (track issue #918)."
    ```
    (Comment-prefixed JSON keys with `//` are valid JSON and will be ignored by tooling but visible in source.)
  </action>
  <verify>
    <automated>cd frontend && grep -q "vite-plugin-pwa" package.json && grep -q "workbox-window" package.json && grep -q '"pdfjs-dist": "5.6.205"' package.json && npm ls pdfjs-dist 2>&1 | grep -q "pdfjs-dist@5.6.205" && grep -q '"build:player"' package.json && grep -q '"build:admin"' package.json</automated>
  </verify>
  <done>
    `vite-plugin-pwa@1.2.0` and `workbox-window@7.4.0` appear in `frontend/package.json` `devDependencies`. `overrides.pdfjs-dist === "5.6.205"`. `npm ls pdfjs-dist` reports a single resolved version of 5.6.205. New scripts `build:admin`, `build:player`, `check:player-isolation`, `check:player-size` are present. Inline `//*` comments documenting the workarounds exist.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite vite.config.ts — multi-entry + manualChunks + PWA branch</name>
  <files>frontend/vite.config.ts, frontend/player.html</files>
  <read_first>
    - frontend/vite.config.ts (current single-entry config)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§"Architecture Patterns" Pat4 — full reference config; §"Common Pitfalls" P2, P3, P4)
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (D-1, D-13 — PWA manifest details)
  </read_first>
  <action>
    Create `frontend/player.html` with this exact content:
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

    Replace `frontend/vite.config.ts` entirely with:
    ```ts
    import { defineConfig } from "vite";
    import react from "@vitejs/plugin-react";
    import tailwindcss from "@tailwindcss/vite";
    import { VitePWA } from "vite-plugin-pwa";
    import path from "path";

    // Phase 47: two entries (admin + player). Build order matters per Pitfall P3:
    //   `npm run build` runs `vite build` (admin) FIRST, then `vite build --mode player`.
    //   Player outDir is dist/player — nested under admin's dist/ — but each build wipes ONLY its own outDir.
    //   Run admin first so its dist/ wipe doesn't blow away dist/player/.
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
              manualChunks(id: string) {
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
                return undefined;
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
                    icons: [
                      { src: "/player/icon-192.png", sizes: "192x192", type: "image/png" },
                    ],
                  },
                  workbox: {
                    navigateFallback: "/player/index.html",
                    // Cache name is versioned: bump to v2 when the /playlist envelope shape changes (Pitfall P8).
                    runtimeCaching: [
                      {
                        urlPattern: /\/api\/signage\/player\/playlist/,
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
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
        server: {
          host: "0.0.0.0",
          proxy: {
            "/api": {
              target: process.env.VITE_API_TARGET || "http://api:8000",
              changeOrigin: true,
            },
          },
        },
      };
    });
    ```

    Critical points encoded above (do NOT deviate):
    - `base` branches on mode: `/` for admin, `/player/` for player (Pitfall P2).
    - `outDir` branches: `dist` vs `dist/player` (Pitfall P3).
    - `rollupOptions.input` is a single HTML per build (NOT both at once — Vite's global `base` constraint per RESEARCH §1).
    - `manualChunks` function form (RESEARCH §1, Pat4) extracts react/react-dom/scheduler/@tanstack-react-query into `vendor-react`. Document in a comment that two physical copies of `vendor-react` will exist (one per outDir) — this is accepted per OQ2 resolution (RESEARCH §"Open Questions" Q2).
    - `VitePWA` is registered ONLY when `isPlayer` (RESEARCH §"Anti-Patterns" — never give admin a SW).
    - `urlPattern` uses `/api/signage/player/playlist` (the player polling endpoint per Phase 43 D-02), NOT just `/api/signage/playlist`.
    - PWA `scope` AND `base` both set to `/player/` (Pitfall P2 — without both, SW registers at wrong scope).

    Add this comment block immediately above `export default`:
    ```ts
    // Phase 47 build invariants:
    //  1. admin build MUST run before player build (Pitfall P3 — admin wipes dist/ which would also wipe dist/player/).
    //  2. base + scope MUST both be '/player/' for the player bundle (Pitfall P2 — SW won't register otherwise).
    //  3. VitePWA is conditionally registered ONLY for the player mode — admin must never get a Service Worker.
    //  4. manualChunks emits TWO physical copies of vendor-react (one per outDir). This is intentional per OQ2 resolution.
    //  5. cacheName 'signage-playlist-v1' — BUMP to v2 when /playlist envelope shape changes (Pitfall P8).
    ```
  </action>
  <verify>
    <automated>test -f frontend/player.html && grep -q "/src/player/main.tsx" frontend/player.html && grep -q "VitePWA" frontend/vite.config.ts && grep -q 'mode === "player"' frontend/vite.config.ts && grep -q "manualChunks" frontend/vite.config.ts && grep -q "vendor-react" frontend/vite.config.ts && grep -q "signage-playlist-v1" frontend/vite.config.ts && grep -q 'scope: "/player/"' frontend/vite.config.ts && grep -q '/api/signage/player/playlist' frontend/vite.config.ts</automated>
  </verify>
  <done>
    `frontend/player.html` exists and references `/src/player/main.tsx`. `frontend/vite.config.ts` branches on `mode === "player"` for `base`, `outDir`, `rollupOptions.input`, and `VitePWA` plugin registration. `manualChunks` extracts `vendor-react`. PWA scope and base are both `/player/`. The Workbox runtime caching rule targets `/api/signage/player/playlist` with cache name `signage-playlist-v1`. The 5-point invariant comment block exists.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create player /lib helpers + skeleton main.tsx</name>
  <files>
    frontend/src/player/main.tsx,
    frontend/src/player/lib/durationDefaults.ts,
    frontend/src/player/lib/strings.ts,
    frontend/src/player/lib/locale.ts,
    frontend/src/player/lib/mediaUrl.ts,
    frontend/src/player/lib/playerApi.ts,
    frontend/src/player/lib/queryKeys.ts,
    frontend/src/player/lib/pdfWorker.ts
  </files>
  <read_first>
    - .planning/phases/47-player-bundle/47-CONTEXT.md (D-1, D-2, D-6, D-11 — sidecar URL, token storage, durations, pdfjs pin)
    - .planning/phases/47-player-bundle/47-RESEARCH.md (§"Architecture Patterns" Pat6 — playerApi shape; §"Code Examples" Ex4, Ex5)
    - .planning/phases/47-player-bundle/47-UI-SPEC.md (§Copywriting — exact 5 strings; §"Data Fetching Contract" — playerKeys shape)
    - frontend/src/lib/queryKeys.ts (existing pattern — extend, don't replace)
    - frontend/src/signage/lib/signageTypes.ts (SignageMedia shape for mediaUrl)
  </read_first>
  <action>
    Create the following files exactly as specified.

    **File 1: `frontend/src/player/lib/durationDefaults.ts`** (D-6)
    ```ts
    // Phase 47 D-6: per-format default duration_s when item omits it.
    // SINGLE SOURCE OF TRUTH — change here only.

    import type { PlayerItem } from "@/signage/player/types";

    export const IMAGE_DEFAULT_DURATION_S = 10;
    export const PDF_PER_PAGE_DURATION_S = 6;
    export const IFRAME_DEFAULT_DURATION_S = 30;
    export const HTML_DEFAULT_DURATION_S = 30;
    export const PPTX_PER_SLIDE_DURATION_S = 8;
    /** Sentinel meaning "let the video element's onended advance the playlist" (D-6). */
    export const VIDEO_DURATION_NATURAL = 0;

    /**
     * Fill in `duration_s` on items that omit it, per the per-format defaults.
     * Pure: returns a new array; does not mutate inputs.
     */
    export function applyDurationDefaults(items: PlayerItem[]): PlayerItem[] {
      return items.map((item) => {
        if (typeof item.duration_s === "number" && item.duration_s > 0) return item;
        switch (item.kind) {
          case "image":
            return { ...item, duration_s: IMAGE_DEFAULT_DURATION_S };
          case "video":
            return { ...item, duration_s: VIDEO_DURATION_NATURAL };
          case "pdf": {
            const pageCount = typeof item.pageCount === "number" ? item.pageCount : 1;
            return { ...item, duration_s: pageCount * PDF_PER_PAGE_DURATION_S };
          }
          case "iframe":
            return { ...item, duration_s: IFRAME_DEFAULT_DURATION_S };
          case "html":
            return { ...item, duration_s: HTML_DEFAULT_DURATION_S };
          case "pptx": {
            const slidePaths = Array.isArray(item.slide_paths) ? item.slide_paths : [];
            const n = slidePaths.length || 1;
            return { ...item, duration_s: n * PPTX_PER_SLIDE_DURATION_S };
          }
          default:
            return item;
        }
      });
    }
    ```

    **File 2: `frontend/src/player/lib/locale.ts`** (D-3 + Pitfall P9 Path B)
    ```ts
    // Phase 47 D-3: navigator.language → 'de' | 'en' picker.
    // Detected once at module load — no re-render flicker.

    export type PlayerLang = "de" | "en";

    export const playerLang: PlayerLang =
      typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de")
        ? "de"
        : "en";
    ```

    **File 3: `frontend/src/player/lib/strings.ts`** (Pitfall P9 Path B — hard-coded to defend the <200KB budget)
    ```ts
    // Phase 47 — i18n Path B (Pitfall P9 resolution): hard-coded EN+DE for the 5 player strings.
    // Bundle-size discipline: i18next costs ~25KB for ~150 bytes of text. Path B saves the budget.
    // CI parity: see frontend/scripts/check-player-isolation.mjs (Plan 47-05 adds a strings-parity test).
    // Source-of-truth pairs MUST stay byte-for-byte identical with what UI-SPEC §Copywriting documents.

    import { playerLang, type PlayerLang } from "./locale";

    type Key =
      | "pair.headline"
      | "pair.hint"
      | "pair.code_placeholder"
      | "offline.label"
      | "offline.aria_label";

    const STRINGS: Record<PlayerLang, Record<Key, string>> = {
      en: {
        "pair.headline": "Pair this device",
        "pair.hint": "Enter this code in the admin panel under Signage → Devices → Pair new device",
        "pair.code_placeholder": "—",
        "offline.label": "Offline",
        "offline.aria_label": "Player is offline; cached content is playing",
      },
      de: {
        "pair.headline": "Verbinde dieses Gerät",
        "pair.hint": "Gib diesen Code im Admin-Panel unter Signage → Geräte → Neues Gerät koppeln ein",
        "pair.code_placeholder": "—",
        "offline.label": "Offline",
        "offline.aria_label": "Wiedergabe läuft offline; Inhalte werden aus dem Cache gespielt",
      },
    };

    export function t(key: Key): string {
      return STRINGS[playerLang][key];
    }

    // Exported so the parity test (Plan 47-05) can introspect.
    export { STRINGS };
    ```

    **File 4: `frontend/src/player/lib/mediaUrl.ts`** (D-1 + Pitfall P10)
    ```ts
    // Phase 47 D-1: rewrite media URLs to localhost:8080 when the Phase 48 sidecar is online.
    // Phase 47 ships the detector; Phase 48 ships the sidecar.

    declare global {
      interface Window {
        signageSidecarReady?: boolean;
      }
    }

    export interface MediaForUrl {
      id: string;
      uri: string;
    }

    /**
     * Synchronous resolver. Reads window.signageSidecarReady at call time.
     * For the more robust hybrid detector (window flag + 200ms localhost probe), see useSidecarStatus
     * (added in Plan 47-03 per Pitfall P10).
     */
    export function resolveMediaUrl(media: MediaForUrl): string {
      if (typeof window !== "undefined" && window.signageSidecarReady === true) {
        return `http://localhost:8080/media/${media.id}`;
      }
      return media.uri;
    }

    export {};
    ```

    **File 5: `frontend/src/player/lib/playerApi.ts`** (RESEARCH Pat6 — apiClient exception, ROADMAP cross-cutting hazard #2)
    ```ts
    // Phase 47: device-JWT fetch adapter. THIS IS THE ONE PERMITTED RAW fetch() CALLSITE
    // in frontend/src/player/**. The CI guard (Plan 47-05 check-player-isolation.mjs) exempts this file.
    // Documented exception per ROADMAP "v1.16 Cross-Cutting Hazards" #2:
    //   "Phase 47 player uses its own minimal fetch with device-token bearer, documented exception."

    export class PlayerApiError extends Error {
      constructor(public status: number, public bodyText: string, public url: string) {
        super(`PlayerApi ${status} on ${url}: ${bodyText.slice(0, 200)}`);
        this.name = "PlayerApiError";
      }
    }

    export interface PlayerFetchOpts extends Omit<RequestInit, "headers"> {
      token: string;
      headers?: Record<string, string>;
      /** Called exactly once when the server returns 401 (device revoked). */
      on401?: () => void;
    }

    export async function playerFetch<T>(url: string, opts: PlayerFetchOpts): Promise<T> {
      const { token, on401, headers, ...rest } = opts;
      const r = await fetch(url, {
        ...rest,
        headers: {
          Accept: "application/json",
          ...headers,
          Authorization: `Bearer ${token}`,
        },
      });
      if (r.status === 401) {
        on401?.();
        throw new PlayerApiError(401, await r.text().catch(() => ""), url);
      }
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new PlayerApiError(r.status, body, url);
      }
      // 204 No Content path (heartbeat-shaped responses) — caller asks for void.
      if (r.status === 204) return undefined as T;
      return (await r.json()) as T;
    }
    ```

    **File 6: `frontend/src/player/lib/queryKeys.ts`** (UI-SPEC §"Data Fetching Contract")
    ```ts
    // Phase 47: TanStack Query key factory for the player bundle.
    // Mirrors frontend/src/lib/queryKeys.ts factory style; lives in the player tree
    // so the admin bundle never imports player keys.

    export const playerKeys = {
      all: ["player"] as const,
      playlist: () => [...playerKeys.all, "playlist"] as const,
      pairStatus: (sessionId: string | null) =>
        [...playerKeys.all, "pair-status", sessionId] as const,
    };
    ```

    **File 7: `frontend/src/player/lib/pdfWorker.ts`** (D-11, RESEARCH Ex4, SGN-PLY-10)
    ```ts
    // Phase 47 SGN-PLY-10 / D-11: pin pdf.js worker to pdfjs-dist@5.6.205 via Vite ?url import.
    // Phase 46-03 PdfPlayer intentionally omits the GlobalWorkerOptions override (per 46-03 SUMMARY);
    // Phase 47 owns the pin. main.tsx imports this module BEFORE rendering so all PdfPlayer instances
    // inherit the worker URL.

    import { GlobalWorkerOptions } from "pdfjs-dist";
    import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

    GlobalWorkerOptions.workerSrc = workerUrl;

    export {};
    ```

    **File 8: `frontend/src/player/main.tsx`** (skeleton — App component lands in Plan 47-04)
    ```tsx
    // Phase 47 player entry. App component + router added in Plan 47-04.
    // pdfWorker MUST be imported before any PdfPlayer instance is rendered.

    import "./lib/pdfWorker";
    import { createRoot } from "react-dom/client";
    import { StrictMode } from "react";

    const rootEl = document.getElementById("player-root");
    if (!rootEl) {
      throw new Error("Phase 47: #player-root element missing from player.html");
    }

    function PlayerBootstrap() {
      return (
        <div className="w-screen h-screen bg-neutral-950 text-neutral-50 grid place-items-center">
          {/* Plan 47-04 replaces this with the wouter <App /> */}
          <p className="text-2xl font-semibold">Signage Player — bootstrapping…</p>
        </div>
      );
    }

    createRoot(rootEl).render(
      <StrictMode>
        <PlayerBootstrap />
      </StrictMode>,
    );
    ```

    All files use UTF-8, LF line endings, double quotes, 2-space indent (matches existing frontend style).
  </action>
  <verify>
    <automated>for f in frontend/src/player/main.tsx frontend/src/player/lib/durationDefaults.ts frontend/src/player/lib/strings.ts frontend/src/player/lib/locale.ts frontend/src/player/lib/mediaUrl.ts frontend/src/player/lib/playerApi.ts frontend/src/player/lib/queryKeys.ts frontend/src/player/lib/pdfWorker.ts; do test -f "$f" || { echo "MISSING $f"; exit 1; }; done && grep -q "applyDurationDefaults" frontend/src/player/lib/durationDefaults.ts && grep -q "playerFetch" frontend/src/player/lib/playerApi.ts && grep -q "playerKeys" frontend/src/player/lib/queryKeys.ts && grep -q "GlobalWorkerOptions.workerSrc = workerUrl" frontend/src/player/lib/pdfWorker.ts && grep -q "pair.headline" frontend/src/player/lib/strings.ts && grep -q "Verbinde dieses Gerät" frontend/src/player/lib/strings.ts && grep -q "signageSidecarReady" frontend/src/player/lib/mediaUrl.ts && grep -q "import \"./lib/pdfWorker\"" frontend/src/player/main.tsx</automated>
  </verify>
  <done>
    All 8 files exist with the specified exports. `applyDurationDefaults`, `playerFetch`, `playerKeys`, `resolveMediaUrl`, `t`, `playerLang`, and the pdfWorker side-effect import are all wired. The skeleton main.tsx renders a placeholder; full router + App lands in Plan 47-04. No React UI components exist yet outside main.tsx (those are Plan 47-02/03/04).
  </done>
</task>

<task type="auto">
  <name>Task 4: Build smoke test — admin AND player builds emit their HTML</name>
  <files>(no files written; verification only)</files>
  <read_first>
    - frontend/vite.config.ts (just written)
    - frontend/package.json (just written)
  </read_first>
  <action>
    Run the full build to confirm both entries emit cleanly:
    ```bash
    cd frontend && rm -rf dist && npm run build
    ```

    Expected outcomes:
    1. `dist/index.html` exists (admin build).
    2. `dist/player/index.html` exists (player build).
    3. `dist/player/manifest.webmanifest` exists (vite-plugin-pwa output).
    4. `dist/player/sw.js` exists (Service Worker emitted by Workbox).
    5. `dist/player/assets/*.js` contains at least one chunk with `vendor-react` in its name.
    6. `dist/assets/*.js` also contains a `vendor-react` chunk (the second physical copy per OQ2 resolution).

    KNOWN ACCEPTABLE FAILURE PATH: `tsc -b` may fail with **pre-existing** type errors in unrelated admin files (per Plan 46-03 SUMMARY's "Out-of-Scope Deferrals" — `HrKpiCharts.tsx`, `SalesTable.tsx`, `useSensorDraft.ts`, `defaults.ts`). If `tsc -b` fails, work around for this verification ONLY by running:
    ```bash
    cd frontend && rm -rf dist && npx vite build && npx vite build --mode player
    ```
    (skip tsc to isolate the Vite output question). DO NOT fix unrelated type errors in this plan — they are out of Phase 47 scope. Document any tsc failures in the plan SUMMARY's deviations section so the next plan inherits the context.

    Also confirm Pitfall P3 didn't bite — if you see `dist/player/` exists but `dist/index.html` is missing, the build order in `package.json` is wrong (player ran first and admin's wipe removed the player output, OR admin ran first and admin's wipe removed everything — check carefully).

    No file edits in this task; this is a smoke test gate. If anything fails, return to Task 2 and re-inspect the vite config before proceeding to Plan 47-02.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; (npm run build || (rm -rf dist &amp;&amp; npx vite build &amp;&amp; npx vite build --mode player)) &amp;&amp; test -f dist/index.html &amp;&amp; test -f dist/player/index.html &amp;&amp; test -f dist/player/manifest.webmanifest &amp;&amp; test -f dist/player/sw.js &amp;&amp; ls dist/player/assets/*.js | head -1 &amp;&amp; ls dist/assets/*.js | head -1</automated>
  </verify>
  <done>
    `cd frontend && ls dist/index.html dist/player/index.html dist/player/manifest.webmanifest dist/player/sw.js` all return successfully. Build completed (with or without the tsc workaround). Any tsc failures from pre-existing type debt are documented in the plan SUMMARY but do not block this plan.
  </done>
</task>

</tasks>

<verification>
- All 8 lib + entry files exist under `frontend/src/player/`.
- `frontend/player.html` exists.
- `frontend/vite.config.ts` branches on `mode === "player"` for base/outDir/input/PWA.
- `frontend/package.json` has the deps + override + new scripts.
- `dist/index.html` AND `dist/player/index.html` AND `dist/player/sw.js` AND `dist/player/manifest.webmanifest` all exist after `npm run build` (or the tsc-skip workaround).
- `47-OQ4-RESOLUTION.md` documents the `/stream?token=` outcome.
</verification>

<success_criteria>
- Foundation is in place for Plans 47-02 / 03 / 04 / 05 to import from `@/player/lib/*` without further setup.
- Vite multi-entry build emits both admin and player HTML cleanly.
- Service Worker file is generated under `/player/` scope.
- pdfjs-dist resolves to single version 5.6.205 across the dep tree.
- OQ4 (`/stream?token=` query auth) is resolved and documented.
- OQ1 (i18n) is resolved by going Path B (hard-coded strings) — encoded in `strings.ts`.
</success_criteria>

<output>
After completion, create `.planning/phases/47-player-bundle/47-01-SUMMARY.md` with:
- Files created list
- Build smoke test result (pass/fail per the Task 4 expected outcomes)
- OQ4 outcome (PASS/FAIL — link to 47-OQ4-RESOLUTION.md)
- OQ1 outcome (Path B locked in via strings.ts)
- Any tsc failures encountered (carry-forward note for Plan 47-04)
- Hand-off notes for Plans 47-02 (pairing) and 47-03 (playback) — confirm the lib helpers they should import
</output>
