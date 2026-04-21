# Phase 49 — E2E Walkthrough Results

**Status:** PARTIAL — Scenarios 1, 2, 3 passed on real Pi hardware. Scenario 4 and 5 not run (shipped as v1.17 carry-forward).

**Date:** 2026-04-21
**Hardware:** Raspberry Pi 4 (assumed, details to fill in)
**Pi OS version:** Raspberry Pi OS Bookworm Lite 64-bit
**Chromium version:** 147.0.7727.101
**Sidecar version:** FastAPI 0.115.12 + uvicorn 0.34.0
**Backend version:** v1.16 shipped (commit `095bbb8`) + v1.17 Phase 49 fixes
**Network:** Mac admin host at `192.168.1.106:8000`, Pi at `192.168.1.118`

## Provisioning path used

**Option C — `scripts/provision-pi.sh` on vanilla Raspberry Pi OS Bookworm Lite 64-bit.** The baked `.img` path (pi-gen via 49-01 + 49-03 release workflow) was NOT used for this walkthrough because the minisign key ceremony and self-hosted arm64 runner registration are still pending operator actions (see Phase 49 carry-forwards below). The runtime path shares `scripts/lib/signage-install.sh` with the image-build path (49-01 SGN-IMG-03), so defects found here apply to both.

## Scenario results

| # | Scenario | Result | Notes |
|---|---|---|---|
| 1 | Flash → Boot → Pair | **PASS** (with 3 defects fixed in-flight) | RPi OS Bookworm Lite 64-bit → run `scripts/provision-pi.sh SIGNAGE_API_URL=<mac>:8000` → reboot → pairing code on HDMI within ~30 s |
| 2 | Admin Claim → Playlist Renders | **PASS** | Admin UI at `http://<mac>:5173/signage/pair` → code entered → device bound → playlist rendering within a few seconds |
| 3 | Wi-Fi Drop → Offline Loop | **PASS** | `nmcli device disconnect wlan0` held for 5 minutes; Pi's HDMI kept looping cached content continuously; sidecar `/health` correctly reported `online=false, cached_items > 0` |
| 4 | Reconnect → Admin Change Arrives | **NOT RUN** — carry-forward | SSE reconnect path already unit-tested in Phase 45; operator can complete on next session using scaffold |
| 5 | Sidecar Restart Resilience | **NOT RUN** — carry-forward | Low-priority — sidecar is a systemd managed unit; Restart=on-failure is proven pattern |

## Security checks (SGN-OPS-03 success criterion 4)

| Check | Command | Result |
|-------|---------|--------|
| Chromium NOT `--no-sandbox` | `ps -u signage -f \| grep chromium` | **PASS** — flag absent in process listing |
| Chromium NOT running as root | `ps -u signage -f \| grep chromium` | **PASS** — kiosk running as `signage` user |
| "Running as root" warning absent | `journalctl _UID=$(id -u signage) --user-unit=signage-player \| grep -i "running as root"` | **PASS** — no matches |
| Sidecar binds `127.0.0.1:8080` only | Service source + `ss -ltnp` inside image | **PASS** (code-verified; `sidecar.py` explicitly passes `host="127.0.0.1"` to uvicorn) |

## Defects found and fixed during walkthrough

These cut across the systemd units shipped in Phase 48 and consumed by Phase 49's image-build path. All three landed in `scripts/systemd/*.service` — so the pi-gen image build and any future `provision-pi.sh` run both inherit the fixes automatically.

| # | Defect | Fix commit |
|---|---|---|
| 49-D1 | `signage-player.service` was `WantedBy=graphical-session.target` but labwc (standalone, no display manager) never emits that target. Player stayed in `graphical-session.target.wants/` but systemd never tried to start it at boot. | `0957500` |
| 49-D2 | Template hard-coded `WAYLAND_DISPLAY=wayland-1` but labwc standalone creates `wayland-0`. ExecStartPre's wait-loop polled the wrong socket path and timed out. | `bd39366` |
| 49-D3 | `labwc.service` had both `After=default.target` and `WantedBy=default.target` — circular dependency. default.target waited for labwc (WantedBy), labwc waited for default.target (After). Neither fired at boot. Manual `systemctl --user start labwc` bypassed the ordering, masking the issue during manual provisioning. | `56ff441` |

After `56ff441` + reboot, all three services reached `● active (running)` within 7 s of the sidecar coming up, with zero manual intervention.

## Timing buckets

| Metric | Target | Actual | Result |
|--------|--------|--------|--------|
| Boot-to-pairing-code | ≤ 30 s | ~30 s (post-all-fixes) | PASS |
| Claim-to-first-play | ≤ 5 s | ~few s | PASS |
| Wi-Fi offline duration | ≥ 5 min continuous | 5 min, loop held | PASS |
| Admin change to display (post-reconnect) | ≤ 30 s | NOT MEASURED — Scenario 4 carry-forward | — |

## Operator sign-off

- [x] Scenarios 1, 2, 3 PASS
- [ ] Scenarios 4, 5 deferred as carry-forward (see `49-VERIFICATION.md §Outstanding`)
- [x] No `--no-sandbox` or root warnings in journal
- [x] 3 of 4 timing buckets PASS; Scenario 4 timing not measured
- [x] `56ff441`, `bd39366`, `0957500` — systemd unit fixes verified on real hardware

Reviewer: Johann Bechtold        Date: 2026-04-21

## Carry-forward into v1.18 or operator polish

1. **Scenario 4 hardware measurement** — reconnect + admin mutation propagation ≤ 30 s. SSE reconnect behavior is already unit-tested (Phase 45); this gates the real-hardware timing number only.
2. **Scenario 5 hardware measurement** — sidecar systemd restart resilience. Low-priority; `Restart=on-failure` is a stock systemd pattern.
3. **pi-gen baked image build + release** — 49-03's CI workflow is committed but requires (a) operator minisign key ceremony (`pi-image/minisign.pub` commit), (b) self-hosted arm64 runner registration (Hetzner CAX21 or Lima VM on Mac), (c) first `v1.17.0` tag to trigger the workflow. Not a blocker for v1.17 milestone closure because the runtime path (provision-pi.sh) is proven; the image is distribution polish.
4. **Supersede Phase 48 hardware walkthrough** — `48-VERIFICATION.md §"Outstanding items"` previously marked the E2E walkthrough as operator-deferred. This `49-E2E-RESULTS.md` supersedes it for Scenarios 1–3; Phase 48 scenarios 4–5 inherit the same carry-forward state.
