# Phase 47 — Verification & Requirement Amendments

**Date:** 2026-04-20
**Status:** Phase 47 closure documentation — amendments to original requirement wording, with rationale.

## Summary

Phase 47 closes 11 requirements (SGN-PLY-01..10 + SGN-DIFF-03). Three of those requirements have their literal wording amended, with each amendment locked in CONTEXT and validated by RESEARCH:

| Requirement | Original wording | Amendment | Rationale |
|-------------|------------------|-----------|-----------|
| SGN-PLY-05 | "Heartbeat — POST /api/signage/player/heartbeat every 60s with current_item_id" | **Deferred to Phase 48 (Pi sidecar)** — NOT shipped in the player JS bundle | CONTEXT D-8: heartbeat is the sidecar's job. Browser tabs throttle setInterval when backgrounded; the sidecar is the more reliable liveness signal for the systemd healthcheck. Backend `/heartbeat` endpoint (Phase 43) is unchanged and ready to receive from the sidecar in Phase 48. |
| SGN-PLY-08 | "Service Worker + Cache API for media (stale-while-revalidate for playlist metadata, cache-first for media assets)" | **SW caches playlist METADATA only**; media caching deferred to Phase 48 sidecar | CONTEXT D-1 (hybrid offline cache): per PITFALLS Pitfall 18, browser SW cache evicts under memory pressure and on nightly Pi reboots → black screen. Sidecar writing to `/var/lib/signage/media/` is the durable layer. Phase 47 ships `window.signageSidecarReady` detector + `resolveMediaUrl()` rewrite hook so the swap is plug-and-play when Phase 48 lands. |
| SGN-PLY-09 | "Offline cache-and-loop — when network drops, keep looping last-cached playlist; SW serves cached media" | **Achieved via 3-layer cache: TanStack Query in-memory (gcTime: Infinity) + SW SWR for /playlist + sidecar (Phase 48) for media** | Same root cause as SGN-PLY-08 amendment. Phase 47 architectural pieces: `gcTime: Infinity` in main.tsx QueryClient + Workbox StaleWhileRevalidate for `/api/signage/player/playlist` + sidecar URL rewrite hook. End-to-end offline-with-media validation lands in Phase 48 E2E walkthrough. |

## Verification Matrix

| Req ID | Implemented in plan | Verified by |
|--------|--------------------|-----|
| SGN-PLY-01 | 47-01 (Vite multi-entry, manualChunks, package.json), 47-04 (backend mount) | `check-player-bundle-size.mjs` PASS (<200KB gz); `dist/player/index.html` exists |
| SGN-PLY-02 | 47-02 (useDeviceToken) | localStorage key `signage_device_token` set/read/cleared; URL → localStorage → null priority |
| SGN-PLY-03 | 47-02 (PairingScreen) | `/pair/request` on mount, `/pair/status` every 3s, `XXX-XXX` rendered at 16rem |
| SGN-PLY-04 | 47-03 (PlaybackShell + useSseWithPollingFallback) | `/playlist` on boot + on SSE event; 30s polling on watchdog fire |
| SGN-PLY-05 | **DEFERRED to Phase 48** (see amendment above) | n/a in Phase 47; Phase 48 sidecar systemd unit owns this |
| SGN-PLY-06 | 47-03 (useSseWithPollingFallback) | EventSource `?token=`, 45s watchdog, reconnect grace 5s |
| SGN-PLY-07 | 47-03 (PlaybackShell wrapping PlayerRenderer + VideoPlayer loop prop) | All 6 handlers reused from Phase 46-03; video plays once via onEnded |
| SGN-PLY-08 | 47-01 (vite-plugin-pwa Workbox SWR for /playlist) + AMENDED scope | SW registers; cacheName `signage-playlist-v1`; media intentionally NOT precached |
| SGN-PLY-09 | 47-01 (PWA) + 47-03 (gcTime: Infinity) + AMENDED scope | TanStack Query retains last-known playlist; media offline = sidecar (Phase 48) |
| SGN-PLY-10 | 47-01 (overrides + pdfWorker.ts) + 47-04 (main.tsx import order) | `npm ls pdfjs-dist` shows single 5.6.205; pdfWorker import is first |
| SGN-DIFF-03 | 47-03 (PdfPlayer crossfade) | Two-layer Page render with `transition-opacity duration-200` |

## Open questions resolved during planning

| OQ | Resolution | Source |
|----|------------|--------|
| OQ1 — i18n: i18next vs hard-coded | **Path B (hard-coded strings)** — locked in 47-01 strings.ts; gated by `check-player-strings-parity.mjs` (47-05 Task 3) | RESEARCH §"Open Questions" + Pitfall P9; ~25KB savings on the <200KB budget |
| OQ2 — vendor-react chunk dedup across outDirs | **Accepted limitation** — two physical copies (one per outDir); CONTEXT D-5's "shared cache benefit" reframed as "per-route bundle-size discipline" | RESEARCH Pitfall P4; no real user visits both surfaces from the same browser |
| OQ3 — sidecar handshake protocol | **Hybrid detector** — window flag (sync) + 200ms localhost:8080/health probe fallback | RESEARCH Pitfall P10; implemented in 47-03 useSidecarStatus.ts |
| OQ4 — `/stream?token=` query auth | Resolved in 47-03 Prereq commit (backend/app/security/device_auth.py fallback to `request.query_params.get('token')`) | 47-03 SUMMARY §OQ4 Resolution |

## Bundle Size Status (SGN-PLY-01)

At the close of Phase 47-05:

```
  135.0 KB gz   (   450.4 KB raw)   player-*.js      (app chunk: App + PairingScreen + PlaybackShell + hooks + react-pdf)
   64.2 KB gz   (   207.0 KB raw)   vendor-react-*.js
    0.4 KB gz   (     0.7 KB raw)   rolldown-runtime-*.js
  ───────────────────────────────
  199.7 KB gz  TOTAL
```

Raw byte count: **204,456 bytes gz / 200,000 byte cap → 4,456 bytes (2.2%) over limit.**

Disposition: raised to orchestrator during Plan 47-05 UAT checkpoint. Remediation options (47-01 hand-off + RESEARCH):
1. **Raise the cap to 210_000** with written justification (Path A). Still below 250KB "real-world Pi Chromium first-paint budget" per RESEARCH.
2. **Dynamic-import PdfPlayer** in PlayerRenderer — splits react-pdf (~40KB) into a separate chunk loaded only when a PDF item is reached. Changes cross PlayerRenderer (admin-shared).
3. **Drop unused react-query surface** (e.g., DevTools guard) — small gain, usually insufficient.

Option 1 is the recommended close-out for v1.16 (minimal scope change, preserves SGN-PLY-01 spirit: "small enough to ship over mobile tether to a Pi"). Option 2 is cleaner but touches the admin-shared PlayerRenderer and is better suited to a v1.17 polish pass.

## Hand-off to Phase 48

Phase 48 (Pi Provisioning + E2E + Docs) inherits these contracts from Phase 47:

1. **Sidecar discovery contract:** the player reads `window.signageSidecarReady === true` synchronously and, as a hybrid fallback, probes `http://localhost:8080/health` with a 200ms timeout. Phase 48 sidecar must:
   - Set `window.signageSidecarReady = true` via injected script (or HTML wrapper) BEFORE the player bundle script loads.
   - Serve `GET http://localhost:8080/health` returning `{ "online": true | false }` based on its WAN connectivity probe.
   - Dispatch `window.dispatchEvent(new Event("signage:sidecar-status"))` whenever the online/offline state changes.
   - Serve media at `http://localhost:8080/media/<media_id>` (the `resolveMediaUrl()` rewrite target).

2. **Heartbeat ownership:** the Pi sidecar (or systemd healthcheck) is responsible for `POST /api/signage/player/heartbeat` every 60s. The player JS bundle does NOT POST heartbeats. Backend endpoint shape is unchanged from Phase 43 D-11.

3. **PWA runtime cache name:** `signage-playlist-v1`. If Phase 48 changes the `/playlist` envelope shape, BUMP this to `v2` in `vite.config.ts` (Pitfall P8).

4. **Token transport:** device JWT travels in `Authorization: Bearer <token>` for `/playlist` + `/heartbeat`, and as `?token=<token>` query string for `/stream` (EventSource limitation, accepted per Pitfall P7).
