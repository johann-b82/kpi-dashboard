# Phase 47: Player Bundle - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a standalone, single-purpose Vite bundle (`/player/<device_token>`) that runs full-screen on a Raspberry Pi in Chromium kiosk and reliably plays the current playlist. The bundle wraps the shared `<PlayerRenderer>` (built in Phase 46) with: pairing screen + token persistence, SSE EventSource subscription with 45s client watchdog, 30s polling fallback when SSE is silent, and an offline strategy that survives Pi reboots and Wi-Fi drops. In scope: separate `rollupOptions.input.player` Vite entry served at `/player/<device_token>`, pairing UI for un-tokenized boots, SSE+watchdog+polling lifecycle, format handler timing defaults, hybrid offline cache (SW for playlist JSON + Pi sidecar for media files), CI guard preventing admin-tree imports from player tree. Out of scope: the Pi systemd unit + provisioning + sidecar implementation itself (Phase 48), admin-side UI changes (closed in Phase 46), backend API changes (closed in Phases 42/43/45).

</domain>

<decisions>
## Implementation Decisions

### Offline cache strategy (D-1) — CRITICAL, binds Phase 48
- **D-1:** **Hybrid offline cache: Service Worker for playlist JSON, Pi-side sidecar for media files.**
  - **Service Worker (`vite-plugin-pwa`)** registers on the player bundle and stale-while-revalidates `/api/signage/playlist` (the only same-origin JSON endpoint the player needs). Tiny payload (a few KB per playlist), tolerates Chromium quota eviction because the next successful poll repopulates it. SW only ever talks to same-origin HTTP — no HTTPS-on-LAN headache because admin and player share an origin behind the existing reverse proxy.
  - **Pi-side sidecar** (a small daemon, scope of Phase 48) writes downloaded media to `/var/lib/signage/media/` and serves it on `http://localhost:8080/media/<id>`. Player rewrites media URLs to `localhost:8080` when sidecar advertises `online=true/false` via a status file. Sidecar is the one and only reliable persistence layer for big files — it survives Chromium quota eviction and nightly reboots.
  - **Why hybrid (not SW-only):** PITFALLS Pitfall 18 explicitly bars SW for media — Chromium evicts the cache on memory pressure, Pis reboot nightly, cache is empty → black screen. The sidecar resolves that. Playlist JSON is small enough that SW-quota eviction is acceptable risk (always re-pulled).
  - **Why hybrid (not sidecar-only):** Honors ROADMAP §47 success criterion 5 ("Service Worker via `vite-plugin-pwa` caches media Cache-API, stale-while-revalidate for playlist metadata") — re-scoped here so SW handles only the metadata half. The "media Cache-API" portion of the success criterion is amended to the sidecar path; this amendment is documented in this CONTEXT file and will be reflected in 47-VERIFICATION.md.
  - **Phase 47 ships:** SW registration + manifest + stale-while-revalidate route for `/api/signage/playlist`, plus a media-URL rewrite hook that prefers `http://localhost:8080/media/<id>` when a `window.signageSidecarReady === true` flag is present (set by sidecar via injected `<script>` or feature-detect). When the flag is absent (e.g., dev server, browser preview, sidecar not yet shipped), the player falls back to direct media URLs from the API.
  - **Phase 47 does NOT ship:** the sidecar daemon itself, the systemd unit, or the `/var/lib/signage/` provisioning. Those are Phase 48 deliverables.

### Token persistence + recovery (D-2)
- **D-2:** **URL is canonical; `localStorage.signage_device_token` is the fallback.**
  - On boot, the player reads the token in this order: (1) URL path segment `/player/:token`; (2) `localStorage.getItem('signage_device_token')`; (3) if neither present → render pairing screen.
  - On successful URL boot, the player writes the token to `localStorage` so a subsequent reload of `/player/` (no path segment) still recovers identity. This matches ROADMAP §47 success criterion 1 literal wording ("readable from the URL path AND stored in `localStorage`").
  - On `401 device revoked` from any API call, the player wipes `localStorage.signage_device_token`, navigates to `/player/`, and renders the pairing screen.

### Pairing screen (D-3)
- **D-3:** **Minimal pairing screen.** Centered on a black or theme-neutral backdrop:
  - Headline (DE/EN, "du" tone): "Pair this device" / "Verbinde dieses Gerät".
  - The `XXX-XXX` code rendered very large (≥ 12rem, monospace, bright on dark) so an operator across a room can read it.
  - One-line hint underneath: "Enter this code in the admin panel under Signage → Devices → Pair new device" (and DE equivalent).
  - Auto-poll `/api/signage/pair/status` every 3s (matches ROADMAP success criterion 2).
  - **No QR code, no logo, no language toggle, no diag text** at v1.16. (Field-debug diag info noted as a deferred idea.)
  - Browser language (`navigator.language`) picks DE vs EN at first paint; no toggle UI needed for an unattended kiosk.

### Polling fallback discipline (D-4)
- **D-4:** **Polling is a strict fallback, not a parallel channel.** SSE EventSource is the primary push mechanism. A 45s client-side watchdog (resettable on every event including the 15s server pings from Phase 45) detects silence; on watchdog fire the player closes the EventSource and starts a 30s polling loop against `GET /api/signage/playlist`. When polling reveals a successful response, the player attempts to re-establish the EventSource; if reconnect succeeds (first event received within 5s), polling stops.
  - Belt-and-braces parallel polling was rejected — doubles request load on every device for marginal benefit; SSE + watchdog is already two-layered.

### Bundle split (D-5)
- **D-5:** **Shared vendor chunk + strict import boundary.**
  - Vite `rollupOptions.input` adds a second entry `player` pointing at `frontend/src/player/main.tsx`. Output: `dist/player/index.html`. The existing admin entry (`index.html`) is unchanged.
  - `rollupOptions.output.manualChunks` extracts `react`, `react-dom`, `@tanstack/react-query` into a shared `vendor-react` chunk that both `/index.html` and `/player/index.html` reference, so a Pi that has visited admin once already has React cached for the player (and vice-versa).
  - **CI guard** (`frontend/scripts/check-player-isolation.mjs`) greps `frontend/src/player/**/*.{ts,tsx}` for any import path matching `^@/signage/(pages|components/Media|components/Playlist|components/Device)` or `^@/components/admin/`. Zero matches required. The player MAY import from `@/signage/player/*` (PlayerRenderer + format handlers, built in 46-03), `@/signage/lib/signageTypes` (shared types), and any pure-utility shared lib (`@/lib/apiClient`, `@/lib/queryKeys`).
  - Gzipped player bundle target: < 200KB (ROADMAP success criterion 1). Measured at build time and asserted by the CI guard script.

### Format handler timing defaults (D-6)
- **D-6:** **Per-format default `duration_s` when item omits it.** PlayerRenderer (Phase 46) already advances on `duration_s`; the player layer fills in defaults before passing items down:
  - **Image:** 10 seconds.
  - **PDF:** 6 seconds per page (PDF spans `pageCount × 6s` total).
  - **Video:** play to natural end (`onended` advances). `<video muted autoplay playsinline>` (locked by ROADMAP success criterion 3). No loop, no audio, single play-through.
  - **Iframe / HTML:** 30 seconds default if `duration_s` missing. (Operator should set this explicitly — surfaced as "consider setting a duration" in admin UI later, out of scope for 47.)
  - **PPTX:** 8 seconds per slide (PPTX spans `slide_paths.length × 8s` total).
  - All defaults expressed as constants in `frontend/src/player/lib/durationDefaults.ts` so they are change-controlled in one place.

### SSE / watchdog lifecycle (locked by ROADMAP)
- **D-7:** EventSource opens against `/api/signage/stream?token=<device_token>` (Phase 45 contract). On every received event (including the 15s server ping per Phase 45 D-02), the watchdog resets to a 45-second timer. On watchdog fire: close EventSource → start polling. On `EventSource.onerror`: same path. On reconnect-success-via-polling: open new EventSource; if first event arrives within 5s, kill the polling loop.
- **D-8:** Heartbeat is **out of scope for the player browser bundle** — heartbeat is sent by the Phase 48 Pi sidecar (or by the systemd unit's healthcheck), not by JavaScript inside the kiosk page. The player bundle only consumes SSE; it does not POST `/heartbeat`.

### Iframe + HTML rendering (locked by Phase 46 + ROADMAP)
- **D-9:** Iframe URLs are pre-flighted with `HEAD` before render to filter out 4xx/5xx targets. Sandbox attributes mandatory: `sandbox="allow-scripts allow-same-origin"` (no `allow-top-navigation`, no `allow-forms`).
- **D-10:** HTML media renders as `<iframe srcdoc={sanitized_html} sandbox="allow-scripts">`. Sanitization is upstream (backend `nh3` per Phase 43); player does not re-sanitize.

### pdf.js worker (locked by Phase 46 D-11 + ROADMAP)
- **D-11:** `pdfjs-dist@5.6.205` pinned in `frontend/package.json` (overrides any transitive bumps). `pdf.worker.min.mjs` loaded via `?url` import: `import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; GlobalWorkerOptions.workerSrc = pdfWorker;`. This pin lives in the player bundle (Phase 46 admin used react-pdf default config per Phase 46 D-11; Phase 47 takes ownership of the explicit pin).

### Routing / serving (locked by ROADMAP success criterion 1)
- **D-12:** Backend serves `dist/player/index.html` at `GET /player/<device_token>` and `GET /player/`. SPA fallback: any `/player/*` path returns the same HTML; React-Router-DOM in the bundle parses `:token`. Static assets (`/player/assets/*`, `/player/manifest.webmanifest`, `/player/sw.js`) are served from the same `dist/player/` tree under `/player/assets/...` etc. — the Vite config sets `base: '/player/'` for the player entry build only.

### PWA manifest (D-1 supporting infrastructure)
- **D-13:** `vite-plugin-pwa` generates `dist/player/manifest.webmanifest` with `display: 'fullscreen'`, `start_url: '/player/'`, `name: 'Signage Player'`, `short_name: 'Signage'`, single icon (192px placeholder; design polish deferred). Service Worker scope: `/player/`. Workbox runtime caching rule: `/api/signage/playlist` → `StaleWhileRevalidate`. No precaching of media (intentional — sidecar handles that).

### Claude's Discretion
- File/folder layout under `frontend/src/player/` — Claude picks per existing frontend conventions and the Phase 46 `signage/` precedent.
- Exact constants module shape (`durationDefaults.ts` vs frontmatter on each handler).
- Whether the pairing screen polls via TanStack Query or a hand-rolled `setInterval`.
- Whether the SSE/watchdog lifecycle lives in a custom hook or a small XState machine — recommend a custom hook unless complexity grows.
- Backend route handler (FastAPI) for `/player/<token>` — likely `StaticFiles` mount or a small route returning the file; Claude confirms against existing static-serve patterns.
- CI guard implementation language — recommend reusing the `check-signage-invariants.mjs` script style established in Phase 46-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §SGN-PLY-01..10 — 10 player requirements this phase closes
- `.planning/REQUIREMENTS.md` §SGN-DIFF-03 — second-Vite-entry separate-bundle requirement
- `.planning/ROADMAP.md` §"Phase 47: Player Bundle" — phase goal + 5 success criteria; success criterion 5 is amended in this CONTEXT (see D-1) to scope the SW to playlist metadata only, with media handed to the Phase 48 sidecar

### Cross-cutting hazards + pitfalls
- `.planning/research/PITFALLS.md` §18 — Browser cache unreliable on Pi kiosks (drives D-1 hybrid, mandates sidecar for media)
- `.planning/research/PITFALLS.md` §13 — pairing-code collision (drives `XXX-XXX` formatting + admin-side TTL, already enforced by Phase 42)
- `.planning/research/PITFALLS.md` §21 — device token over-scoped (player uses device JWT only on `/api/signage/{playlist,heartbeat,stream}`; admin endpoints are explicitly out of scope)

### Prior phase context (consumed, not modified)
- `.planning/phases/42-device-auth-pairing-flow/42-CONTEXT.md` — pairing session lifecycle; `POST /api/signage/pair/request` + `GET /api/signage/pair/status` contracts the player consumes (D-3)
- `.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md` — `GET /api/signage/playlist` envelope shape, ETag semantics, `duration_ms` boundary; player consumes for D-4 polling fallback
- `.planning/phases/45-sse-broadcast/45-CONTEXT.md` — `/api/signage/stream` contract: 15s server pings (drives 45s watchdog reset cadence in D-7), per-device queue, reconnect semantics
- `.planning/phases/46-admin-ui/46-CONTEXT.md` §D-09..D-11 — `<PlayerRenderer>` shape + format handler interfaces this phase wraps
- `.planning/phases/46-admin-ui/46-03-player-renderer-SUMMARY.md` — exact module paths and props of `<PlayerRenderer>` and the 6 handlers (Image/Video/Pdf/Iframe/Html/Pptx)

### Existing frontend assets to reuse
- `frontend/src/signage/player/PlayerRenderer.tsx` — built in 46-03; player bundle wraps this
- `frontend/src/signage/player/{Image,Video,Pdf,Iframe,Html,Pptx}Player.tsx` — format handlers built in 46-03
- `frontend/src/signage/player/types.ts` — `PlayerItem` and related types
- `frontend/src/signage/lib/signageTypes.ts` — shared API types (Phase 46-02)
- `frontend/src/lib/apiClient.ts` — shared bearer-attach + 401-refresh; player uses with the device JWT instead of admin JWT
- `frontend/src/lib/queryKeys.ts` — extend with `playerKeys` for the new TanStack Query scope (admin keys: `signageKeys` from Phase 46)
- `frontend/src/locales/{en,de}.json` — extend with `signage.player.*` namespace; CI parity check (Phase 46-04 script) gates locale completeness

### Build / infra references
- `frontend/vite.config.ts` — current admin Vite config; this phase adds `rollupOptions.input.player` and `manualChunks` (D-5) and registers `vite-plugin-pwa` for the player entry only (D-1, D-13)
- `frontend/package.json` — adds `vite-plugin-pwa`, `workbox-window` (peer of `vite-plugin-pwa`); pins `pdfjs-dist@5.6.205` via `overrides` if not already pinned
- `frontend/scripts/check-signage-invariants.mjs` — Phase 46-04 script, pattern reused by D-5 CI guard

### Backend integration touch points (read-only — no backend changes in this phase)
- `backend/app/api/signage_player.py` (or equivalent) — confirm `/playlist`, `/heartbeat`, `/stream` exist and accept device JWT; **no changes** to backend in this phase
- `backend/app/main.py` — confirm static-file mount strategy for `/player/*`; if a new mount is needed, this phase adds it as a single small change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<PlayerRenderer>` + 6 format handlers (Phase 46-03) — the entire visual rendering layer is already built and unit-clean. This phase is a wrapper, not a renderer.
- `signageTypes.ts` — shared API types; player uses the device-facing subset.
- `apiClient` — works with any bearer; just attach the device JWT.
- `queryKeys.ts` — already a centralized factory; extend with a `playerKeys` namespace.
- `frontend/scripts/check-signage-invariants.mjs` — pattern for adding the new D-5 isolation guard.

### Established Patterns
- Vite + React + TanStack Query + Tailwind + shadcn (CLAUDE.md) — player follows these.
- Locale parity CI gate (Phase 46-04) — extend with `signage.player.*` keys.
- No `dark:` Tailwind variants in signage code (Phase 46 invariant) — extends to player bundle.

### Integration Points
- `frontend/vite.config.ts` — second entry, `manualChunks`, `vite-plugin-pwa`
- `frontend/src/player/main.tsx` (NEW) — player entry
- `frontend/src/player/App.tsx` (NEW) — router with two routes: `/player/` (pairing) and `/player/:token` (playback)
- Backend static-file serving at `/player/*` — small route addition in `backend/app/main.py` if not already wildcard-mounted

</code_context>

<specifics>
## Specific Ideas

- Use a custom React hook `useSseWithPollingFallback({ url, watchdogMs: 45000, pollingMs: 30000 })` as the SSE/watchdog/polling state machine — keeps the lifecycle in one testable surface.
- Pairing screen: the `XXX-XXX` code is the only thing on screen (besides the one-line hint and the headline). Resist the urge to add chrome.
- The Service Worker should NOT precache anything except the bundle's own JS/CSS/HTML — explicitly do not put media in the SW. Workbox runtime config:
  ```js
  runtimeCaching: [{
    urlPattern: /\/api\/signage\/playlist/,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'signage-playlist-v1', expiration: { maxEntries: 5, maxAgeSeconds: 86400 } }
  }]
  ```
- Media URL rewrite hook lives at `frontend/src/player/lib/mediaUrl.ts`:
  ```ts
  export function resolveMediaUrl(media: SignageMedia): string {
    if (typeof window !== 'undefined' && (window as any).signageSidecarReady) {
      return `http://localhost:8080/media/${media.id}`;
    }
    return media.uri;  // backend Read shape from Phase 43
  }
  ```
- Bundle size measurement: add a small post-build assertion script that reads `dist/player/assets/*.js`, gzips, and asserts `< 200_000`. Fails CI loudly.

</specifics>

<deferred>
## Deferred Ideas

- **Pairing-screen field-debug overlay** — bottom-right small text showing device IP, hostname, kernel version, and "press F2 to copy diagnostics to clipboard". Useful when a Pi won't pair due to network. Not v1.16. Park for v1.17 ops backlog.
- **Pairing-screen QR code** — for mobile-side pairing. Premature; admin pairing from a laptop is the established workflow. Park.
- **Pairing-screen language toggle** — auto-detect via `navigator.language` is enough at MVP. Park.
- **PWA install prompt UX** — relevant if operators ever install the player on tablets, not in scope for the Pi-kiosk target. Park.
- **SSE-with-parallel-polling (belt-and-braces)** — explicitly rejected in D-4 for v1.16; revisit if push reliability becomes a measured pain point.
- **Sidecar implementation language and process supervision** — Phase 48 territory.
- **Player error reporting / Sentry** — relevant once we have multiple Pis in production; pre-mature now. Park.
- **Audio playback for video media** — explicitly muted at v1.16 per ROADMAP success criterion 3. Park as future opt-in admin toggle.

</deferred>

---

*Phase: 47-player-bundle*
*Context gathered: 2026-04-19*
