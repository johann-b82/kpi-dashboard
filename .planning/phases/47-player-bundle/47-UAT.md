# Phase 47 — Manual UAT Checklist

**Purpose:** Validate the full player bundle end-to-end in a desktop browser before Phase 48 ships the Pi/sidecar/systemd layer. Pi-hardware E2E is Phase 48 success criterion 1.

**Prerequisites:**
- Backend stack running (`docker compose up`).
- Frontend built (`cd frontend && npm run build`) so the backend serves `dist/player/`.
- At least one Directus admin user exists.
- At least one playlist with ≥1 enabled item exists, targeting tag X.

## Scenario A: First-boot pairing → claim → playback

| # | Action | Expected |
|---|--------|----------|
| A1 | Open Chrome DevTools → Application → clear `localStorage` for the API origin. Navigate to `http://<api-host>/player/`. | Pairing screen renders. Headline + 256px monospace `XXX-XXX` code + hint visible on `bg-neutral-950`. |
| A2 | Open a second tab; log in as admin; go to `/signage/pair`; enter the displayed code + a device name + tag X; submit. | Admin tab shows successful claim. |
| A3 | Wait ≤3s in the player tab. | Player tab transitions to `/player/<token>` and starts rendering the playlist (image, video, etc. depending on items). `localStorage.signage_device_token` is set. |
| A4 | Reload the player tab (no token in URL). | Player resumes playback at `/player/` (token recovered from localStorage). |

## Scenario B: SSE update propagation

| # | Action | Expected |
|---|--------|----------|
| B1 | While Scenario A is in playback, in admin tab edit the playlist (e.g., reorder items or change duration). Save. | Within ≤2s, the player tab's playlist updates without refresh. DevTools → Network → EventSource shows messages received. |
| B2 | DevTools → Network → throttle to "Offline". Wait 50s. | Within 45s of going offline, DevTools → Network shows EventSource closes. After ~50s, polling fetches to `/api/signage/player/playlist` start (and fail because offline). |
| B3 | Restore network to "Online". | Within 30s, a successful poll fires. SSE reconnects. Playback continues with any updates that happened during the outage. |

## Scenario C: 401 device-revoked recovery

| # | Action | Expected |
|---|--------|----------|
| C1 | While in playback, in the admin tab revoke the device. | Within ≤30s (next poll/SSE attempt), player returns 401. |
| C2 | Player auto-handles: localStorage token cleared; navigates to `/player/`; pairing screen renders with a fresh code. | Confirmed visually. |

## Scenario D: Service Worker + offline cache

| # | Action | Expected |
|---|--------|----------|
| D1 | DevTools → Application → Service Workers. | A SW for `/player/` scope is registered (via `vite-plugin-pwa`). |
| D2 | DevTools → Application → Cache Storage → `signage-playlist-v1`. | After at least one successful playlist fetch, an entry for `/api/signage/player/playlist` is present. |
| D3 | DevTools → Network → throttle to "Offline". Reload the player page. | Player loads (HTML/JS/CSS from SW precache); pairing or playback surface renders depending on token state. |
| D4 | Confirm: NO entry for media URLs in Cache Storage (intentional — media is sidecar's job per VERIFICATION.md). | Confirmed. |

## Scenario E: PDF crossfade (SGN-DIFF-03)

| # | Action | Expected |
|---|--------|----------|
| E1 | Configure a playlist with a multi-page PDF item with `duration_s` < `pageCount * 6`. | When PDF is reached, pages auto-flip with a visible 200ms opacity crossfade between consecutive pages (NOT a hard cut). |

## Scenario F: Format handler smoke

| # | Format | Action | Expected |
|---|--------|--------|----------|
| F1 | image | Add image item; play. | `<img>` with `object-contain`; advances after `duration_s` (default 10s). |
| F2 | video | Add video item; play. | `<video muted autoplay playsinline>` (NO `loop`); advances on natural end. |
| F3 | pdf | Add multi-page PDF; play. | Pages crossfade; total = `pageCount × 6s`. |
| F4 | iframe (URL) | Add URL item; play. | `<iframe sandbox="allow-scripts allow-same-origin">` mounted; 30s default duration. |
| F5 | html | Add HTML snippet; play. | `<iframe srcdoc=… sandbox="allow-scripts">` mounted; 30s default duration. |
| F6 | pptx | Upload PPTX (via admin); wait for conversion to complete; add to playlist; play. | Image sequence cycles; `slide_paths.length × 8s` total. |

## Scenario G: Bundle isolation invariants

| # | Action | Expected |
|---|--------|----------|
| G1 | `cd frontend && npm run check:player-isolation` | Exit 0; "0 violations". |
| G2 | `cd frontend && npm run check:player-size` | Exit 0; PASS (gz total < 200KB). **NOTE (2026-04-20):** current build reports 204,456 gz / 200,000 cap (2.2% over). Orchestrator-level decision pending at UAT checkpoint: either raise cap to 210_000 (recommended close-out per VERIFICATION.md §Bundle Size Status option 1), or dynamic-import PdfPlayer (v1.17 polish). |
| G3 | `cd frontend && npm run check:player-strings` (or `node scripts/check-player-strings-parity.mjs`) | Exit 0; "en=5 keys, de=5 keys; PASS". |
| G4 | `cd frontend && npm run check:signage` | Exit 0 (pre-existing signage invariants still pass after ROOTS extension). |

## Sign-off

- [ ] All scenarios A–G pass.
- [ ] No console errors in the player tab during any scenario.
- [ ] No CORS or cookie-related errors in DevTools.

Reviewer: __________________________  Date: ____________
