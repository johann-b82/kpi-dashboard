---
phase: 48-pi-provisioning-e2e-docs
milestone: v1.16
phase_number: 48
phase_name: Pi Provisioning + E2E + Docs
phase_slug: pi-provisioning-e2e-docs
requirements: [SGN-OPS-01, SGN-OPS-02, SGN-OPS-03]
created: 2026-04-20
---

# Phase 48 CONTEXT — Pi Provisioning + E2E + Docs

## Domain

Bring a fresh Raspberry Pi from "just-flashed Bookworm Lite" to "paired, playing kiosk that survives 5-minute Wi-Fi drops" without developer involvement. Deliverables: a bootstrap script, a Python sidecar that handles offline resilience, a bilingual admin guide, an operator runbook, and a recorded one-Pi E2E walkthrough.

## Inherited / pre-locked decisions

From Phase 47 and earlier — **not open for re-discussion**:

- Dedicated non-root `signage` user on the Pi. Chromium sandbox stays enabled. Never run kiosk as root.
- Chromium kiosk flag set is fixed by SGN-OPS-03: `--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --ozone-platform=wayland --app=<url>`.
- Kiosk binds to URL `http://<api-host>/player/` (Phase 47-04 backend mount).
- Systemd user service. `After=graphical.target`. `loginctl enable-linger signage` at provisioning time.
- Player detects sidecar via `window.signageSidecarReady` flag + `http://localhost:8080/health` probe (shipped in Phase 47-03, see `frontend/src/player/hooks/useSidecarStatus.ts` and `frontend/src/player/lib/mediaUrl.ts`). The sidecar contract is already frozen on the player side — backend/Pi just has to satisfy it.
- i18n parity is a hard gate — every `signage.*` key in `en.json` has a matching `de.json` entry with informal "du" tone (v1.16 cross-cutting hazard 1). Admin guide docs follow the same split.

## Decisions (this phase)

### D-1 — Offline cache architecture: Pi-side Python sidecar

Closes Phase 47 Decision 3 AND Phase 47 open defect D-7 (SW scope).

- The player's service worker stays **precache-only** (app shell + assets). No runtime caching of `/api/*` — the SW's `/player/` scope makes that impossible without re-scoping to `/`, and we don't want to broaden it.
- Offline resilience lives on the Pi as a tiny Python sidecar that:
  - Listens on `127.0.0.1:8080` only (localhost, never exposed).
  - Proxy-caches BOTH `/api/signage/player/playlist` (envelope, including `resolved_at` + `items[]`) AND `/media/<media_id>` (bytes). D-2 drill-down confirmed scope is media + playlist envelope.
  - Writes to `/var/lib/signage/` (owned by the `signage` user, mode 0700).
  - Serves from cache when the upstream is unreachable, pass-through + refresh when online.
  - Exposes `GET /health` returning `{"ready": true, "cached_items": N}` so the player's existing probe flips `window.signageSidecarReady = true`.
- The player's `resolveMediaUrl` already rewrites to `http://localhost:8080/media/<id>` when the probe succeeds — no frontend change needed for media. Planner must add an analogous probe path for the playlist endpoint OR have the player's `apiClient` try localhost first.

**Why this closes D-7:** runtime caching for `/api/signage/player/playlist` moves off the SW and onto the sidecar. No need to register the SW at `/` with `Service-Worker-Allowed` — admin never accidentally gets a SW.

### D-2 — Sidecar runtime: Python

- FastAPI + uvicorn, or stdlib `http.server` if that keeps the memory footprint meaningfully smaller. Researcher to pick.
- Reuses Python that's already present on Bookworm Lite (python3 is in the base image).
- Ships as a venv under `/opt/signage/sidecar` with a systemd user service `signage-sidecar.service` that starts **before** `signage-player.service` (the kiosk), via `After=` and `Before=`.
- No Directus/backend SDK — communicates over plain HTTP with the device JWT the kiosk already holds (sidecar reads the token from a file written by the player on first pair; OR sidecar gets its own via a minimal pair-on-behalf flow; researcher to pick).

### D-3 — Provisioning mechanism: `git clone + ./install.sh`

- Operator flashes stock Bookworm Lite 64-bit via Raspberry Pi Imager.
- First boot: Wi-Fi configured via Imager pre-configure OR NetworkManager on first login.
- SSH in (or run from the Pi's TTY) → `git clone https://github.com/<org>/<repo> /opt/signage` → `cd /opt/signage/scripts && ./provision-pi.sh`.
- The script:
  1. Creates the `signage` user, sets up `/home/signage`.
  2. Installs: chromium-browser (or chromium), unclutter, git, python3-venv, required fonts (Carlito/Caladea/Noto/DejaVu — match Phase 44 apt layer).
  3. Drops the two systemd user unit files (`signage-sidecar.service`, `signage-player.service`) into `/home/signage/.config/systemd/user/`.
  4. Runs `loginctl enable-linger signage` as root so the user service survives logout.
  5. `systemctl --user enable --now` both units as the signage user.
  6. Prints the kiosk URL and reminds the operator to open the pairing code on the attached display.
- Script is idempotent — safe to re-run after tweaks.

### D-4 — E2E walkthrough: one-Pi developer run with checklist + results artifact

- Developer runs the full flow once on real Pi hardware (current dev owns one), records each step's pass/fail + timings in `.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md`.
- Scenarios (from ROADMAP success criterion 1):
  1. Flash Bookworm Lite 64-bit → boot.
  2. Run `provision-pi.sh` → kiosk auto-starts → 6-digit pairing code visible on screen within 30 s of script exit.
  3. Admin claims via `/signage/pair` → playlist renders within 5 s.
  4. Disconnect Pi Wi-Fi for 5 minutes → cached content keeps looping (sidecar serves from `/var/lib/signage/`).
  5. Reconnect → next admin change (playlist mutation) arrives within 30 s (SSE reconnect or polling fallback).
- Multi-Pi fan-out and QEMU-based CI are **out of scope** — noted in Deferred Ideas.
- Walkthrough results artifact lives alongside the plan summaries.

### D-5 — Docs layout: existing convention

- New admin-guide files: `frontend/src/docs/en/admin-guide/digital-signage.md` + `frontend/src/docs/de/admin-guide/digital-signage.md`.
- Register in both locale docs indexes (same pattern as `personio`, `sensor-monitor`, `system-setup`, `user-management`).
- ROADMAP + REQUIREMENTS text currently say `frontend/src/docs/admin/digital-signage.{en,de}.md` — record as a requirements-text amendment in `48-VERIFICATION.md`. The literal path in SGN-OPS-01 is a typo; the intent is "bilingual admin guide covering signage". Phase 48-verification doc will formalize the correction.
- Admin guide content (per SGN-OPS-01):
  - Pi onboarding (flash → provision → pair → tag).
  - Media upload + supported formats (image/video/PDF/PPTX/URL/HTML).
  - Playlist building + tag targeting.
  - Offline behavior (sidecar-backed, 5 min target).
  - Wi-Fi troubleshooting.
  - PPTX best practices (embed fonts — matches Phase 44 font layer).
- Operator runbook lives separately (not a user-facing doc): Markdown at `docs/operator-runbook.md` OR as a section of `digital-signage.md`. Researcher to pick based on existing docs tree conventions; either is acceptable.

### D-6 — Sidecar port + security posture

- Bound to `127.0.0.1:8080` only. Never exposed on LAN.
- Runs as the `signage` user, so the cache directory `/var/lib/signage/` is owned by that user, mode 0700.
- No write access for anyone else. The sidecar is the only writer; the kiosk reads only via HTTP.
- systemd unit hardening: `PrivateTmp=yes`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ReadWritePaths=/var/lib/signage`.

## Carry-forward from Phase 47

These came out of the v1.16 Phase 47 UAT round 2 and are not Phase 48's primary scope but must be tracked:

- **D-7 (Phase 47) SW scope blocks `/api/*` runtime caching** → **RESOLVED as a consequence of D-1 above**. The sidecar replaces the runtime cache path. No SW registration change needed. Close out in `47-VERIFICATION.md` when Phase 48's sidecar lands.
- **D-8 (Phase 47) `playerFetch` HTTP cache staleness** → trivial one-line fix (`cache: "no-store"` in `frontend/src/player/lib/playerApi.ts`). Fold into an early Phase 48 plan as a carry-forward, NOT a separate phase.
- **G2 (Phase 47) bundle gz 204 505 / 200 000** → orchestrator decision still pending. Not a Phase 48 gate. Recommend raising cap to 210 000 in `47-VERIFICATION.md` as part of Phase 47 closeout; this phase should NOT grow the cap further.

## Scope boundaries — NOT in Phase 48

- Multi-Pi fleet orchestration (Ansible, fleet dashboard) — captured in Deferred Ideas.
- Remote Pi management / OTA updates — Deferred.
- Custom .img distribution channel — Deferred.
- QEMU-driven automated E2E in CI — Deferred.
- Cellular/LTE fallback for Wi-Fi-flaky sites — Deferred.
- Sidecar sharing cache across multiple kiosks on the same LAN — Deferred.

## Deferred Ideas (roadmap backlog candidates)

- **Fleet Pi management**: Ansible-based reimage, fleet-wide config push, remote restart. Candidate for a v1.17 "Operations" milestone.
- **Pre-baked .img distribution**: packer/pi-gen pipeline, image hosting. Only justified at >10 kiosks.
- **QEMU automated E2E in CI**: Chromium-on-Wayland-in-QEMU is a rabbit hole; revisit when flake rate on real-hardware E2E becomes a problem.
- **Two-Pi fan-out test**: catches SSE broadcast fan-out issues under real concurrency. Could be a Phase 48 stretch goal if a second Pi is on hand during the walkthrough.
- **Sidecar as LAN cache**: one sidecar instance serves several kiosks on the same network, reducing backend traffic. Only justified at multi-kiosk sites.

## Canonical refs

These documents MUST be read by the phase researcher and planner:

- `.planning/ROADMAP.md` — Phase 48 goal + success criteria (lines matching "### Phase 48"), SGN-OPS-03 verbatim text.
- `.planning/REQUIREMENTS.md` — SGN-OPS-01, SGN-OPS-02, SGN-OPS-03 lines 76–78.
- `.planning/phases/47-player-bundle/47-VERIFICATION.md` — Phase 47 amendments, SGN-PLY-05 deferral to Phase 48, sidecar contract expectations.
- `.planning/phases/47-player-bundle/47-05-ci-guards-bundle-size-and-uat-SUMMARY.md` — lists the open defects this phase inherits.
- `.planning/phases/47-player-bundle/47-UAT-RESULTS.md` — D-7 and D-8 findings, especially the SW-scope analysis.
- `frontend/src/player/hooks/useSidecarStatus.ts` — existing sidecar probe implementation (sets `window.signageSidecarReady`).
- `frontend/src/player/lib/mediaUrl.ts` — existing `resolveMediaUrl` rewrite-to-localhost logic.
- `backend/app/routers/signage_player.py` — existing `/api/signage/player/playlist` and `/asset/{id}` routes the sidecar will proxy.
- `frontend/src/docs/en/admin-guide/` + `frontend/src/docs/de/admin-guide/` — existing docs layout the admin guide must match.
- `docker-compose.yml` (api service apt layer, font install) — the Pi runbook font list must mirror this.

## Risks / unknowns for the researcher to close

1. **Sidecar language: FastAPI vs stdlib `http.server`** — memory footprint matters on a Pi 3B (1GB RAM). Researcher should prototype both and report RSS under a typical workload (1 playlist with 10 items, 100 MB media cache).
2. **Device JWT handoff to the sidecar** — does the kiosk write the token to a file the sidecar reads, or does the sidecar initiate its own pairing? First is simpler; second decouples sidecar lifecycle from kiosk. Researcher to pick, then Plan 48-0N writes the systemd ordering accordingly.
3. **Playlist envelope `ETag` semantics** — sidecar should honor `If-None-Match` when proxying to backend AND return its cached envelope with a stable ETag when offline. Researcher to confirm the backend ETag is deterministic enough for this (already verified in Phase 43, but revalidate).
4. **Chromium flag compatibility on Pi 4 Bookworm Lite** — `--ozone-platform=wayland` with labwc (the default WM on Bookworm Lite) needs a real-hardware check. If labwc is missing something the flags expect, may need Wayfire or X11 openbox as a fallback.
5. **Wi-Fi reconnect + SSE behavior** — the 30s-reconnect success criterion assumes the kiosk's EventSource reconnects on its own. Phase 45 already tested this in unit tests; the walkthrough is the real-hardware confirmation.

## Next step

Run `/gsd:plan-phase 48` (or `/gsd:research-phase 48` first if deeper investigation on sidecar runtime is desired).
