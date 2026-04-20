# Phase 48 — E2E Walkthrough Results

**Status:** PENDING — awaiting real Pi hardware walkthrough by operator.

**Date:** _YYYY-MM-DD_
**Hardware:** Raspberry Pi _[model]_ — _[RAM]_
**Pi OS version:** _[cat /etc/os-release VERSION_ID]_
**Chromium version:** _[chromium-browser --version]_
**Sidecar version:** _[pip show fastapi | grep Version]_
**Backend version:** _[git rev-parse --short HEAD of deployed backend]_
**Network:** _[Wi-Fi SSID, approx distance from AP]_

## Pre-conditions

- [ ] Fresh Bookworm Lite 64-bit image flashed (sha256 verified)
- [ ] Wi-Fi SSID + password configured via Raspberry Pi Imager pre-configure
- [ ] SSH enabled via Imager (or local keyboard)
- [ ] API host reachable from Pi: `curl http://<api-host>/api/health`
- [ ] At least one playlist with ≥1 enabled item exists in the admin backend, tagged for this device

## Scenario 1: Flash → Boot → Pair (SGN-OPS-03)

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 1.1 Flash Bookworm Lite 64-bit and boot | Pi reaches login prompt | | | |
| 1.2 SSH in, clone repo to `/opt/signage`, run `scripts/provision-pi.sh` | Script exits 0, no errors | | | script duration: ___ s |
| 1.3 Reboot | labwc starts, Chromium launches | | | |
| 1.4 Pairing code visible | 6-digit code displayed within 30 s of script exit / first boot | | | boot-to-code: ___ s |

## Scenario 2: Admin Claim → Playlist Renders

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 2.1 Admin opens `/signage/pair` in browser | Pair form renders | | | |
| 2.2 Enter 6-digit code + device name + tag | Form submits successfully (204) | | | |
| 2.3 Playlist renders on Pi screen | First item plays within 5 s of claim | | | claim-to-play: ___ s |
| 2.4 Verify sidecar token accepted | `curl http://localhost:8080/health` returns `ready=true` on the Pi | | | |

## Scenario 3: Wi-Fi Drop → Offline Loop

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 3.1 Disable Pi Wi-Fi: `nmcli device disconnect wlan0` | Succeeds | | | |
| 3.2 Observe playback for 5 minutes | Playlist keeps looping (no black screen, no error banner) | | | continuous: ___ min |
| 3.3 Check sidecar health | `curl localhost:8080/health` returns `{"ready":true,"online":false,"cached_items":N}` | | | |
| 3.4 Check logs | No crash loops in `journalctl --user -u signage-player` | | | |

## Scenario 4: Reconnect → Admin Change Arrives

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 4.1 Re-enable Pi Wi-Fi: `nmcli device connect wlan0` | Succeeds | | | reconnect: ___ s |
| 4.2 Make admin change (reorder playlist or swap item) | Change saved in admin UI | | | |
| 4.3 Change appears on Pi screen | New/updated item plays within 30 s | | | change-to-display: ___ s |

## Scenario 5: Sidecar Restart Resilience

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 5.1 Restart sidecar: `sudo -u signage systemctl --user restart signage-sidecar` | Sidecar restarts cleanly | | | |
| 5.2 Player re-posts token via `useSidecarStatus` re-probe | `/health` returns `ready=true` within 60 s | | | ready-again: ___ s |
| 5.3 Playback continues uninterrupted | No black screen during the restart window | | | |

## Pass/Fail Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| 1: Flash → Pair | | |
| 2: Claim → Playlist | | |
| 3: Wi-Fi drop | | |
| 4: Reconnect | | |
| 5: Sidecar restart | | |

## Security checks (SGN-OPS-03 success criterion 4)

| Check | Command | Expected | Result |
|-------|---------|----------|--------|
| Chromium NOT `--no-sandbox` | `pgrep -af chromium` | flag absent | |
| Chromium NOT running as root | `ps -o user= -p $(pgrep -f "chromium-browser --kiosk" \| head -1)` | `signage` | |
| "Running as root" warning absent | `journalctl --user -u signage-player --no-pager \| grep -i "running as root"` | no matches | |
| Sidecar binds 127.0.0.1 only | `ss -ltnp \| grep 8080` | `127.0.0.1:8080` (never `0.0.0.0` or `:::8080`) | |

## Defects Found

| # | Description | Severity | Suggested fix |
|---|-------------|----------|---------------|
| | | | |

## Timing Buckets

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Boot-to-pairing-code | ≤ 30 s | | |
| Claim-to-first-play | ≤ 5 s | | |
| Wi-Fi offline duration | ≥ 5 min continuous | | |
| Admin change to display (post-reconnect) | ≤ 30 s | | |

## Operator sign-off

- [ ] All five scenarios PASS.
- [ ] No `--no-sandbox` or root warnings in journalctl.
- [ ] All four timing buckets meet targets.

Reviewer: _________________________  Date: ______________
