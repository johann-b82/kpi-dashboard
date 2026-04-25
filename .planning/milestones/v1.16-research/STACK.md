# Stack Research — v1.16 Digital Signage

**Domain:** Digital signage CMS + Chromium-kiosk player on Raspberry Pi (small fleet, ≤5 devices) added to existing KPI Dashboard monorepo
**Researched:** 2026-04-18
**Confidence:** HIGH for library versions (verified against PyPI / npm); MEDIUM-HIGH for Pi/Chromium integration (cross-verified against 2025-2026 community guides and official Pi docs)

## Scope

This document covers **only stack additions** for v1.16. The existing platform stack (FastAPI 0.135, SQLAlchemy 2.0 async, asyncpg, Alembic, Directus 11, React 19, Vite 8, Tailwind v4, shadcn/ui, TanStack Query 5, Recharts 3, react-i18next, APScheduler in-process, Fernet, `@directus/sdk`) is already validated — do NOT re-pick those. Integration points to that stack are called out inline.

## Recommended Additions

### Backend — PPTX Conversion Pipeline

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| LibreOffice (headless) | 24.x (Debian `bookworm` package `libreoffice-impress`) | PPTX/PPT → PDF (step 1 of conversion) | The only mature FOSS renderer that faithfully reproduces real PowerPoint layouts, master themes, embedded fonts, and WordArt. No pure-Python library (`python-pptx`, community Aspose mirrors) matches visual fidelity. Invoked as `soffice --headless --convert-to pdf --outdir <dir> <file.pptx>`. Install directly in the API container — no separate service. |
| `poppler-utils` | Debian bookworm package | System dependency for `pdf2image` (`pdftoppm`) | Single apt package; no config. |
| `pdf2image` | 1.17.0 | Python wrapper over `pdftoppm` — PDF → PIL images (step 2) | `convert_from_path(pdf, dpi=150)` → list of PIL images; the tightest Python binding to poppler. One-call API from LibreOffice output to per-slide PNGs. |
| `Pillow` | ≥10.x (transitive via pdf2image/pandas) | Image I/O + cap dimensions before upload | Needed by pdf2image; also use to downscale to 1920×1080 max to keep Directus file storage sane. |
| Fonts: `fonts-crosextra-carlito`, `fonts-crosextra-caladea`, `fonts-noto-core`, `fonts-dejavu` | Debian stable | Metric-compatible Calibri/Cambria + broad coverage for LibreOffice rendering | **Critical** — without Carlito/Caladea, LibreOffice substitutes Liberation fonts and output drifts from what the uploader sees in PowerPoint. Install in Dockerfile alongside libreoffice-impress. |

**Pipeline:** `POST /api/signage/media` (PPTX) → FastAPI `BackgroundTasks` → `soffice --convert-to pdf` (tempdir) → `pdf2image.convert_from_path(dpi=150)` → iterate PIL images, downsize, upload each to **Directus file storage** via Files API using the existing service-account token → write slide asset IDs as ordered JSONB array on `signage_media.slides`. Status column (`pending`|`converting`|`ready`|`failed`) is the single source of truth; on container restart a startup hook resets any stuck `converting` → `failed`.

### Backend — Server-Sent Events

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `sse-starlette` | 3.2.0 (released Mar 29 2026) | `EventSourceResponse` for FastAPI/Starlette with heartbeats + graceful disconnect | FastAPI's built-in `StreamingResponse` *can* do SSE, but `sse-starlette` adds the keep-alive ping loop, `retry:` hints, and client-disconnect handling you'd otherwise hand-roll. Tiny, pure-Python, no extras. Battle-tested in the FastAPI ecosystem. |

**Integration:** one route `GET /api/signage/devices/{id}/events` returning `EventSourceResponse`. Invalidation: when admin saves a playlist, publish to an in-process `asyncio.Queue` keyed by device ID; SSE handler drains the queue. **No Redis pub/sub** — fleet is ≤5 devices, single API container (`--workers 1` invariant already set by APScheduler). Fleet ≥ ~20 devices or multi-worker → swap to Redis pub/sub (see "Stack Patterns by Variant").

**Reverse-proxy warning (record in ARCHITECTURE.md):** any Nginx/Caddy in front of FastAPI must set `proxy_buffering off` and `proxy_read_timeout` ≥ heartbeat interval or SSE streams get buffered/cut.

### Backend — Async Job Execution

**Recommendation: FastAPI `BackgroundTasks`. Do NOT add Celery / ARQ / RQ.**

| Approach | Verdict | Reason |
|----------|---------|--------|
| `BackgroundTasks` (FastAPI built-in) | ✓ Use this | PPTX conversions run 5-30s for typical decks; acceptable as a background task on `--workers 1`. Task runs in-process and completes before container shutdown (FastAPI awaits background tasks during response flush). |
| `arq` 0.28.0 (Redis-backed async queue) | ✗ Defer | Adds a Redis container. Unjustified for ≤5 devices with sporadic PPTX uploads. Reconsider if a future milestone adds bulk import or video transcoding. |
| Celery 5.x | ✗ Don't use | Sync-first, heavy broker requirement (RabbitMQ/Redis). Massively over-engineered. |
| RQ | ✗ Don't use | Needs Redis; sync model mismatches FastAPI async. |

### Frontend — PDF Page-Flip Playback

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `pdfjs-dist` | 5.6.205 (latest) | Raw PDF.js ESM build — render PDF page to `<canvas>` | Lower-level than `react-pdf` but gives exact control over page-flip timing, transitions, and offline-cached byte iteration. For a player that cycles pages every N seconds, raw pdfjs-dist in a small React hook (`usePdfPage(url, pageNum)`) is simpler than `react-pdf`'s `<Document>/<Page>` abstraction. |
| `react-pdf` | 10.4.1 | React wrapper around pdfjs-dist (admin UI only) | Use only in admin media-library PDF *preview* (drop-in `<Document><Page/></Document>`). Keeps player bundle small by using raw pdfjs there. |

**Vite 8 integration:** load the worker via `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` and assign to `GlobalWorkerOptions.workerSrc`. Vite handles chunk naming and emits the worker to `dist/`.

### Frontend — Video Playback

**Recommendation: native `<video>` element. Do NOT add `react-player` / `video.js` / Plyr.**

| Option | Verdict | Reason |
|--------|---------|--------|
| Native `<video autoplay muted loop playsinline>` | ✓ Use this | Chromium on Pi 4/5 plays MP4 (H.264/AAC) and WebM (VP9) natively with hardware acceleration where available. Muted autoplay allowed with kiosk flag. Zero dependencies, ~20 lines of React. |
| `react-player` 3.4.0 | ✗ Don't use | ~30 KB for features we don't need (YouTube/Vimeo/Twitch, HLS). Our media is self-hosted MP4/WebM. |
| `video.js` / Plyr | ✗ Don't use | Custom controls + plugins; signage has no UI chrome. |

**Codec note:** Pi 4 has HW H.264 decode; Pi 5 dropped the HW decoder but CPU-decodes 1080p@30fps fine. Prefer H.264 MP4. VP9/WebM works but is CPU-heavier on Pi 5.

### Frontend — Image Transitions / Carousel

**Recommendation: hand-rolled CSS fade in a small React state machine. Do NOT add a carousel or motion library.**

| Option | Verdict | Reason |
|--------|---------|--------|
| Hand-rolled `setTimeout` + Tailwind `transition-opacity duration-700` | ✓ Use this | Signage is single-item-at-a-time, not user-swipeable. ~30 LOC `<PlaylistPlayer>` is simpler and more debuggable than any library, and lean on Pi CPU. |
| `embla-carousel-react` 8.6.0 (shadcn Carousel primitive) | ✗ Not here | Built for swipeable carousels with drag + snap — signage doesn't need that. |
| `framer-motion` / `motion` v12 | ✗ Don't add | Single-property cross-fade; no spring physics / layout animation required. |

**Transitions supported in v1.16:** `fade` (default), `cut` (instant). Defer slide/zoom/pan — they add Pi CPU + complexity without product value for small-fleet internal use.

### Frontend — Directus SDK

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@directus/sdk` | 21.2.2 (latest) | Type-safe CRUD client for Directus collections | Already in `package.json` from v1.11-directus (used for `/login` + cookie-refresh). **Verify current pin vs 21.2.2** in Phase 1; if behind, bump as a single clean migration before signage work begins — don't mix SDK upgrade with feature work. SDK v21 targets Directus server 11.x (our current version). |

**Integration boundary (decide in ARCHITECTURE.md):** default recommendation is to keep all signage tables Alembic-managed and hidden from the Directus Data Model UI (same pattern as `sensors`, Personio, sales). Admin UI talks to **FastAPI** for signage CRUD (gives us validation, background task triggers, pairing flow, SSE wiring in one layer). Directus SDK remains responsible for auth/login and user-management UIs. This keeps v1.16 consistent with the v1.11 convention and avoids two ORM layers on the same table.

### Player Host — Raspberry Pi

| Component | Version / Choice | Purpose | Notes |
|-----------|------------------|---------|-------|
| Raspberry Pi OS | Bookworm 64-bit (2024-07+), **Lite** edition | Pi OS | Default since late 2023, mature in 2026. Lite + auto-login to TTY + a minimal Wayland compositor gives the cleanest kiosk; Desktop edition works but ships extra packages not needed. |
| Chromium | 136+ (shipped via Pi OS apt, `chromium-browser`) | Kiosk browser | Supports all required `--kiosk` flags. Auto-updates with `apt` upgrade cycle. |
| Display server | Wayland (Bookworm default on Pi 4/5) | Display session | Bookworm switched from X11 to Wayland/Wayfire as default. Chromium on Wayland works with `--ozone-platform=wayland`. **Fallback:** X11 via `sudo raspi-config` → Advanced → Wayland → X11 if rendering glitches appear. **Recommendation:** start on Wayland; document X11 fallback in admin guide. |
| Service manager | **systemd user service** | Auto-start on boot | More reliable than `/etc/xdg/autostart` `.desktop` entries on Bookworm (the old `LXDE-pi/autostart` path is gone). Unit: `~/.config/systemd/user/signage-player.service`. Enable with `systemctl --user enable signage-player && sudo loginctl enable-linger pi` so it starts without login. Logs via `journalctl --user -u signage-player`. |
| `unclutter` | Debian bookworm package | Hide mouse cursor | One-line install; runs in kiosk startup script. |

**Recommended Chromium kiosk flag set:**

```
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --autoplay-policy=no-user-gesture-required \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --check-for-update-interval=31536000 \
  --ozone-platform=wayland \
  --app=https://<host>/signage/player?device=<id>
```

- `--autoplay-policy=no-user-gesture-required` is **mandatory** for signage — without it, even muted videos fail to autoplay without a user gesture.
- `--app=<url>` combined with `--kiosk` gives true fullscreen chromeless mode.
- `--check-for-update-interval=31536000` suppresses the update nag banner.

**Offline cache strategy (player PWA):**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vite-plugin-pwa` | 1.x (latest) | Service-worker generation scoped to `/signage/player` route | Standard Vite choice, wraps Workbox with sensible defaults. Cache: player HTML/JS/CSS + latest playlist JSON + referenced media URLs. On network loss the service worker serves cached responses so the player keeps looping. Scope via `workbox.navigateFallbackAllowlist` so admin UI is unaffected. |

## Installation Summary

### Backend — `pyproject.toml` / `requirements.txt` additions

```
pdf2image==1.17.0
sse-starlette==3.2.0
# Pillow already transitive via pdf2image; pin if not yet
```

### Backend — Dockerfile apt layer

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-impress libreoffice-core \
      poppler-utils \
      fonts-crosextra-carlito fonts-crosextra-caladea \
      fonts-noto-core fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*
```

### Frontend — npm

```bash
npm install pdfjs-dist@5.6.205 react-pdf@10.4.1
npm install -D vite-plugin-pwa
# @directus/sdk: verify pin >=21.2.2, bump if below
```

### Raspberry Pi provisioning (shipped as `docs/pi-setup.md` / admin guide article)

```bash
sudo apt update && sudo apt install -y chromium-browser unclutter
mkdir -p ~/.config/systemd/user/
# copy signage-player.service + kiosk-start.sh into place
systemctl --user daemon-reload
systemctl --user enable --now signage-player
sudo loginctl enable-linger pi
```

## Alternatives Considered

| Recommended | Alternative | When Alternative Would Be Better |
|-------------|-------------|----------------------------------|
| LibreOffice + pdf2image | `python-pptx` | Never for this job — python-pptx is for *generating* pptx, not rendering. |
| LibreOffice + pdf2image | Aspose.Slides | Commercial license required; unnecessary. |
| LibreOffice + pdf2image | `unoconv` | Deprecated / unmaintained; `soffice --convert-to pdf` is the supported path. |
| LibreOffice + pdf2image | Pandoc | Structure only — doesn't render PowerPoint visuals. |
| `sse-starlette` | `fastapi.WebSocket` | If the player ever sends data back (touch signage, interactive kiosks). For one-way push + polling fallback, SSE is simpler and proxies better. |
| `sse-starlette` | Long-polling | Higher server load, worse latency. |
| `BackgroundTasks` | `arq` 0.28.0 | Future milestone adds bulk import / video transcoding (100+ jobs, retry semantics needed). |
| Native `<video>` | `react-player` 3.4.0 | Media type ever includes YouTube/Vimeo embeds (not planned). |
| Hand-rolled CSS fade | `framer-motion` / `motion` v12 | Transitions grow to include spring physics / layout animation. |
| Raw `pdfjs-dist` in player | `react-pdf` in player | Never — use react-pdf in admin preview only. |
| Wayland on Pi | X11 | If Chromium Wayland rendering glitches surface on Pi 5 — fallback documented, not default. |
| systemd user service | `.desktop` autostart | Bookworm dropped the LXDE autostart path; systemd is the modern recommendation. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Celery | Broker + worker containers; sync model clashes with FastAPI async | `BackgroundTasks` (now); ARQ (if ever needed) |
| Redis as a new service in v1.16 | ≤5 devices don't need pub/sub; adds a container | In-process `asyncio.Queue` for SSE fanout |
| Microservices / separate PPTX worker container | Adds network hop, Compose complexity, debugging surface | Single FastAPI container with LibreOffice apt-installed |
| Kubernetes | Scope is one VM + ≤5 Pis | Docker Compose (already in use) |
| `unoconv` | Deprecated, unstable in 2026 | `soffice --headless --convert-to pdf` |
| `react-pdf` in the player loop | Per-page render overhead; want direct canvas control | `pdfjs-dist` raw in player; `react-pdf` only in admin preview |
| `framer-motion` (legacy name) | Package renamed to `motion` in 2025 — if it ever gets added in future work, pick `motion` v12. Doesn't matter here — we don't need it. | Native CSS transitions |
| Hardcoded Chromium in a server-side Docker container for the player | Player runs on Pi hardware, not on the server | Native Chromium via apt on Pi OS |
| `tailwind.config.js` additions | Project is Tailwind v4 CSS-first — no JS config file | Extend tokens in `:root`/`.dark` blocks (existing pattern) |

## Stack Patterns by Variant

**If fleet grows beyond ~20 devices or multi-worker deployment:**
- Replace in-process `asyncio.Queue` with Redis pub/sub for SSE fanout.
- Add `arq` 0.28.0 for conversion queue (retry + visibility).
- Consider CDN in front of Directus assets to offload Pi-origin fetches.

**If video becomes the dominant content type:**
- Add server-side `ffmpeg` transcoding to normalize to H.264/AAC MP4 (Pi 4 HW decode).
- Move from `BackgroundTasks` to `arq` for long-running jobs with retries.

**If Chromium Wayland proves unstable on Pi 5:**
- Switch Pi to X11 via `raspi-config`; drop `--ozone-platform=wayland` from the flag set. Document in admin guide as a known runbook step.

**If PPTX decks are heavy (>50 slides) or upload volume spikes:**
- Bump `--convert-to pdf` concurrency by running `soffice` in a subprocess with its own user profile dir (`-env:UserInstallation=file:///tmp/LO_<uuid>`) so parallel conversions don't stomp each other.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `pdfjs-dist@5.6.205` | React 19, Vite 8 | Worker via `?url` import; types ship in-package (no `@types/pdfjs-dist` needed since v4). |
| `react-pdf@10.4.1` | `pdfjs-dist@5.x`, React ≥16.8 | Admin UI only; verify peer-dep match on install. |
| `sse-starlette@3.2.0` | Starlette (bundled with FastAPI 0.135), Python 3.11+ | No APScheduler conflict — SSE is request-scoped, scheduler is app-scoped. |
| `pdf2image@1.17.0` | `poppler-utils` ≥21 (bookworm ships 22+) | Raises `PDFInfoNotInstalledError` if poppler missing — catch in conversion service, mark media `failed` with actionable message. |
| LibreOffice 24.x + `pdf2image` | Python 3.11+ | Pipeline: `tempfile.TemporaryDirectory` → `subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", td, src])` → `pdf2image.convert_from_path(td/"*.pdf", dpi=150)` → upload each PIL image. |
| `@directus/sdk@21.2.2` | Directus server 11.x | SDK v21 targets Directus 11; v20 and below target Directus 10 — confirm before bumping client. |
| Chromium 136+ on Pi OS Bookworm | Wayland or X11 | `--autoplay-policy=no-user-gesture-required` + `muted` on `<video>` autoplays reliably in 2026 builds. |
| `vite-plugin-pwa@1.x` | Vite 8 | Scope PWA behavior to `/signage/player` via `workbox.navigateFallbackAllowlist` so admin UI isn't affected. |

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| `sse-starlette` 3.2.0 | HIGH | PyPI release listing (Mar 29 2026) |
| `pdf2image` 1.17.0 | HIGH | PyPI + readthedocs |
| `arq` 0.28.0 (for "do not use now") | HIGH | PyPI + GitHub release Apr 16 2026 |
| `pdfjs-dist` 5.6.205 | HIGH | npm registry + Mozilla releases |
| `react-pdf` 10.4.1 | HIGH | npm registry |
| `@directus/sdk` 21.2.2 | HIGH | npm registry |
| `react-player` 3.4.0 (for "do not use") | HIGH | npm registry |
| `embla-carousel-react` 8.6.0 (context) | HIGH | npm registry |
| LibreOffice headless as the PPTX path | HIGH | Multiple 2025-2026 implementation guides + no viable pure-Python alternative |
| Pi OS Bookworm + Wayland + systemd user service | MEDIUM-HIGH | Official Raspberry Pi tutorials + multiple 2025-2026 forum threads converge on this pattern |
| Chromium kiosk flag set | HIGH | Cross-verified across 4 independent kiosk setup guides; `--autoplay-policy=no-user-gesture-required` is the critical one for autoplay |
| Native `<video>` over react-player | HIGH | react-player's value is multi-platform URL support (YouTube etc.); self-hosted MP4/WebM is native-video territory |
| `BackgroundTasks` over ARQ/Celery for v1.16 | HIGH | Sync semantics + small fleet + manual-upload cadence → heavier options are objectively wrong-sized |
| `vite-plugin-pwa` for offline cache | MEDIUM | Standard choice; config depth (manifest + navigateFallback scoping) needs a small Phase 1 spike under sub-path deploys |

## Sources

- [sse-starlette on PyPI](https://pypi.org/project/sse-starlette/) — 3.2.0
- [sse-starlette GitHub](https://github.com/sysid/sse-starlette) — `EventSourceResponse` docs
- [pdf2image on PyPI](https://pypi.org/project/pdf2image/) — 1.17.0
- [pdf2image readthedocs](https://pdf2image.readthedocs.io/en/latest/installation.html) — poppler dependency
- [arq on PyPI](https://pypi.org/project/arq/) — 0.28.0 (context)
- [pdfjs-dist on npm](https://www.npmjs.com/package/pdfjs-dist) — 5.6.205
- [react-pdf on npm](https://www.npmjs.com/package/react-pdf) — 10.4.1
- [React-PDF homepage](https://react-pdf.org/)
- [@directus/sdk on npm](https://www.npmjs.com/package/@directus/sdk) — 21.2.2
- [Directus JavaScript SDK docs](https://docs.directus.io/guides/sdk/getting-started.html)
- [react-player on npm](https://www.npmjs.com/package/react-player) — 3.4.0 (context)
- [embla-carousel-react on npm](https://www.npmjs.com/package/embla-carousel-react) — 8.6.0 (context)
- [Motion (framer-motion rename) on npm](https://www.npmjs.com/package/motion)
- [Raspberry Pi official kiosk-mode tutorial](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)
- [Kiosk mode on RPi 5 with Bookworm Lite (2025, verified) — Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=389880)
- [Scalzotto — Chromium kiosk on Raspberry Pi](https://www.scalzotto.nl/posts/raspberry-pi-kiosk/)
- [portalZINE — Pi kiosk for TV displays](https://portalzine.de/setting-up-a-raspberry-pi-as-a-web-client-kiosk-for-tv-display/)
- [OneUptime — LibreOffice in Docker for document conversion (Feb 2026)](https://oneuptime.com/blog/post/2026-02-08-how-to-run-libreoffice-in-docker-for-document-conversion/view)
- [LibreOffice DOCX→PDF Docker guide — Medium](https://medium.com/@jha.aaryan/convert-docx-to-pdf-for-free-a-docker-libreoffice-implementation-guide-cca493831391)

---
*Stack research for: v1.16 Digital Signage — additions to existing FastAPI + Directus + React monorepo*
*Researched: 2026-04-18*
