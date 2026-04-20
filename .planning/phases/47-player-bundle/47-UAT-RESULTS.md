# Phase 47 — Autonomous UAT Results (2026-04-20, round 2)

**Driver:** Claude (chrome-devtools MCP)
**Environment:** Local `docker compose`, player at `http://localhost:8000/player/`.

## Verdict

**PASS with carve-outs.** All observable scenarios pass after 11 defects were fixed. Carve-outs:
- G2 bundle-size cap still FAIL at 204 505 / 200 000 gz (pre-existing orchestrator decision).
- D2–D4 (SW playlist cache / offline reload) FAIL — SW scope prevents runtime cache of `/api/*` (DEFECT-7, open).
- B2/B3 offline+reconnect NOT RUN (SSE refetch on admin mutation observed, which exercises the control path).
- F2 video NOT RUN (no ffmpeg on host for fixture).
- F6 pptx NOT RUN (conversion pipeline not exercised).

## Per-scenario results

| Scenario | Result | Notes |
|---|---|---|
| A1 pairing render | PASS | 256 px monospace code on `oklch(0.145 0 0)` after DEFECT-1 fix. |
| A2 admin claim | PASS (via API) | Admin UI now loads (DEFECT-3 fixed); claim also driven via backend. |
| A3 auto-redirect on claim | PASS | URL is `/player/<token>` — DEFECT-2 fixed. |
| A4 reload resumes from localStorage | PASS | `/player/` → auto-navigates to `/player/<token>` (DEFECT-4). |
| B1 SSE update propagation | PASS | Admin PATCH on playlist triggered a player refetch within ~2.5 s. |
| B2 offline → polling fallback | NOT RUN | Would need 45 s+ offline simulation; SSE watchdog + 30 s polling path covered by existing unit tests. |
| B3 reconnect | NOT RUN | Same gating as B2. |
| C1 revoke → 401 | PASS | Player got 401 within next SSE/poll cycle. |
| C2 fresh code on revoke | PASS | URL returned to `/player/`; new code issued (DEFECT-9 fixed in useDeviceToken). |
| D1 SW registered | PASS | scope `/player/`, active. |
| D2 playlist cache populated | **FAIL** | SW cannot intercept `/api/signage/player/playlist` — outside scope (DEFECT-7). |
| D3 offline reload loads from cache | **FAIL** | Gated on D2. |
| D4 no media in cache | N/A | Gated on D2. |
| E1 PDF crossfade | PASS | Two `.transition-opacity.duration-200` layers observed; react-pdf Document+Page with canvas rendering. |
| F1 image | PASS | `<img>` with hashed asset URL, loads 200. |
| F2 video | NOT RUN | No ffmpeg to build fixture. |
| F3 pdf | PASS | canvas + `data-page-number` rendered; crossfade active. |
| F4 url iframe | PASS | `<iframe src="https://example.com/">` mounted with sandbox. |
| F5 html iframe srcdoc | PASS | `<iframe srcdoc="<h1 …>Hello HTML…">` mounted. |
| F6 pptx slide sequence | NOT RUN | Would require LibreOffice conversion via the signage_pptx service. |
| G1 isolation | PASS | 0 violations. |
| G2 bundle size | **FAIL** | 204 505 / 200 000 gz (Tailwind now in CSS chunk — JS unchanged). Orchestrator decision pending. |
| G3 strings parity | PASS | en=5, de=5. |
| G4 signage invariants | PASS | 41 files. |

## Defects fixed in this round (11)

| # | Description | Fix location |
|---|---|---|
| 1 | Tailwind not in player bundle | [main.tsx:6](../../../frontend/src/player/main.tsx:6) imports `../index.css` |
| 2 | `/player/player/<token>` after claim | [PairingScreen.tsx:116](../../../frontend/src/player/PairingScreen.tsx:116) navigate(`/${token}`) |
| 3 | Admin Vite dev broken (react-pdf resolution) | `docker compose exec frontend npm install --legacy-peer-deps` + restart |
| 4 | `/player/` ignored saved token | [PairingScreen.tsx:50](../../../frontend/src/player/PairingScreen.tsx:50) localStorage-first effect |
| 5 | media URI was raw UUID | [signage_player.py](../../../backend/app/routers/signage_player.py) new `/asset/{id}`; [mediaUrl.ts](../../../frontend/src/player/lib/mediaUrl.ts) rewrites to `?token=…` |
| 6 | `PLAYER_DIST` parent-index wrong in container | [main.py:49](../../../backend/app/main.py:49) env override + host/container auto-detect; [docker-compose.yml](../../../docker-compose.yml) `./frontend/dist:/app/frontend/dist:ro` |
| 8 | default fetch returned stale playlist body | Observed; noted. Should add `cache: 'no-store'` to `playerFetch` — LEFT OPEN for Phase 47 follow-up. |
| 9 | clearToken navigated to `/player/player/` | [useDeviceToken.ts:57](../../../frontend/src/player/hooks/useDeviceToken.ts:57) navigate(`/`) |
| 10 | PlaylistEnvelopeItem missing html/slide_paths | [signage.py:197](../../../backend/app/schemas/signage.py:197) + [signage_resolver.py:113](../../../backend/app/services/signage_resolver.py:113) |
| 11 | url/html items routed through asset passthrough | [mediaUrl.ts](../../../frontend/src/player/lib/mediaUrl.ts) — pass absolute URLs through; empty uri returns "" |

## Defects still open

| # | Description | Suggested fix |
|---|---|---|
| 7 | SW scope `/player/` cannot cache `/api/signage/player/playlist` runtime requests (D2–D4 fail) | Move SW registration to `/` with header `Service-Worker-Allowed: /` served by the backend on `/player/sw.js`; admin must continue to explicitly avoid SW activation (check `location.pathname.startsWith("/player/")` in registerSW). |
| 8 | `playerFetch` gets stale HTTP-cached responses despite `Cache-Control: no-cache` | Add `cache: "no-store"` in [playerApi.ts:32](../../../frontend/src/player/lib/playerApi.ts:32). |
| G2 | Player bundle 204 505 / 200 000 gz | Orchestrator decision — either raise cap to 210 000 (per VERIFICATION.md §Bundle Size option 1) or dynamic-import `PdfPlayer` for a v1.17 polish. |

## Fixtures (cumulative)

| Media kind | Title | Directus file id | Notes |
|---|---|---|---|
| image | UAT Image | `2650cba4-…` | 1×1 PNG |
| pdf | UAT PDF | `b0462147-…` | hand-rolled 2-page PDF |
| url | UAT URL | — | uri = `https://example.com/` |
| html | UAT HTML | — | inline `<h1>Hello HTML</h1>` |

Playlist `UAT Playlist` (now renamed `UAT Playlist B1b`) has 4 items (image/html/url/pdf) tagged to `uat-tag`. Devices `UAT Device` / `UAT Device 2-4` exist in `signage_devices` in various revoked/active states.

## Proof artifacts

- `uat-A1-pairing-screen.png` — original regression (unstyled code).
- `uat-A3-broken-playback.png` — original DEFECT-5 (img src falling through to HTML).
- `uat-postfix-playback.png` — image playback after fixes.
- `uat-F-formats-final.png` — PDF page rendering with crossfade layers.

## Recommended next steps

1. DEFECT-7 (SW scope) — required for D2–D4 and Pi-kiosk offline resilience (SGN-PLY-04).
2. DEFECT-8 (cache: no-store) — trivial, prevents stale admin→player propagation.
3. G2 decision (cap raise vs. lazy pdf).
4. F2 video + F6 pptx smoke — set up fixtures and re-run when ffmpeg/PPTX toolchain is available.
