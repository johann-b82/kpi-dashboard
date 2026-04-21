# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)

**Status:** PENDING — awaiting real Pi hardware walkthrough by operator.

**Date:** _YYYY-MM-DD_
**Hardware:** Raspberry Pi _[model]_ — _[RAM]_
**Pi OS version:** _[cat /etc/os-release VERSION_ID]_ (must be Bookworm Lite 64-bit)
**Chromium version:** _[chromium-browser --version]_
**Sidecar version:** _[git rev-parse --short HEAD of /opt/signage]_
**Backend version:** _[git rev-parse --short HEAD of deployed backend]_
**Network:** _[Wi-Fi SSID, approx distance from AP, 2.4 or 5 GHz]_

## Preconditions

- [ ] Pi provisioned via `scripts/provision-pi.sh` on fresh Bookworm Lite 64-bit (no `.img.xz` path).
- [ ] All three services active: `labwc`, `signage-sidecar`, `signage-player`.
- [ ] Device paired and playing a **test playlist** with ≥ 3 items, each `duration_s = 5`. (Short durations so PlayerRenderer advance-tick doesn't dominate Scenario 4 timing.)
- [ ] At least one loop completed so all media is cached in `/var/lib/signage/media/`.
- [ ] Baseline `curl http://localhost:8080/health` returns `{"ready":true,"online":true,"cached_items":N≥3}`.
- [ ] Operator has SSH access, admin browser window open to `/signage/playlists/<id>`, and stopwatch / wall clock synchronized.

## Scenario 4: Reconnect → Admin Change Arrives ≤ 30 s

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 4.1 `sudo nmcli device disconnect wlan0` on Pi | Succeeds; playlist keeps playing from cache | | | T_disconnect: ___ |
| 4.2 Wait 40 s; verify sidecar log shows `online=false` after ~30 s | Sidecar transitions offline | | | T_offline_confirmed: ___ |
| 4.3 `sudo nmcli device connect wlan0` on Pi | Succeeds; sidecar log shows `online=true` within 15 s | | | T_reconnect: ___, T_online_confirmed: ___ |
| 4.4 Admin performs playlist mutation (swap items 1↔2 OR delete item 1) | HTTP 200 in admin Network tab | | | T0: ___ |
| 4.5 Updated playlist visible on Pi display | New item plays within the 30 s budget | | | T1: ___ |
| 4.6 Compute T1 − T0 | ≤ 30.0 s | | | **T1 − T0: ___ s** |

**Pass criterion:** row 4.6 ≤ 30.0 s AND no black screen AND no error banner.

**Notes / anomalies:**
_(free text — SSE reconnect observed? Polling fallback fired? Any unexpected journal lines?)_

## Scenario 5: Sidecar Restart → Playback Continuity

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 5.1 `systemctl --user restart signage-sidecar` | Issued cleanly | | | T0: ___ |
| 5.2 Observer watches display continuously for 30 s | **No black frame, no broken-image icon, no error overlay** | | | — |
| 5.3 `curl localhost:8080/health` polled every 1 s until `ready:true` | Returns ready within 15 s | | | T1: ___ (T1 − T0: ___ s) |
| 5.4 Sidecar log shows `Loaded persisted device token from disk.` | Yes | | | — |
| 5.5 Next 60 s of playback | No visible interruption; items continue to advance on schedule | | | items observed: ___ |
| 5.6 SSE still working (optional: make an admin mutation now and watch) | New mutation renders on Pi ≤ 10 s | | | — |

**Pass criterion:** 5.2 PASS (zero visible interruption) AND 5.3 ≤ 15 s.

**Notes / anomalies:**

## Pass/Fail Summary

| Scenario | Result | Critical metric | Notes |
|----------|--------|-----------------|-------|
| 4: Reconnect → admin-mutation | | T1 − T0 = ___ s (≤ 30 target) | |
| 5: Sidecar restart | | Visual continuity: PASS/FAIL; cold-start: ___ s | |

## Operator sign-off

- [ ] Scenario 4 PASS with numerical T1 − T0 recorded.
- [ ] Scenario 5 PASS with visual-continuity assertion + cold-start time recorded.
- [ ] No regressions observed against Phase 48 Scenarios 1–3 baseline.

Reviewer: _________________________  Date: ______________
