# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)

**Status:** PASS — both scenarios confirmed on v1.18 hardware walkthrough by operator (numerical timings not captured; thresholds verified as met by direct observation).

**Date:** 2026-04-21
**Hardware:** Raspberry Pi (v1.18 operator test unit) — _[model/RAM not recorded]_
**Pi OS version:** Raspberry Pi OS Bookworm Lite 64-bit (provisioned via `scripts/provision-pi.sh`)
**Chromium version:** _not recorded_
**Sidecar version:** v1.18 (HEAD at walkthrough time)
**Backend version:** v1.18 (HEAD at walkthrough time)
**Network:** _not recorded_

## Preconditions

- [x] Pi provisioned via `scripts/provision-pi.sh` on fresh Bookworm Lite 64-bit (no `.img.xz` path).
- [x] All three services active: `labwc`, `signage-sidecar`, `signage-player`.
- [x] Device paired and playing a **test playlist** with ≥ 3 items, each `duration_s = 5`. (Short durations so PlayerRenderer advance-tick doesn't dominate Scenario 4 timing.)
- [x] At least one loop completed so all media is cached in `/var/lib/signage/media/`.
- [x] Baseline `curl http://localhost:8080/health` returns `{"ready":true,"online":true,"cached_items":N≥3}`.
- [x] Operator has SSH access, admin browser window open to `/signage/playlists/<id>`, and stopwatch / wall clock synchronized.

## Scenario 4: Reconnect → Admin Change Arrives ≤ 30 s

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 4.1 `sudo nmcli device disconnect wlan0` on Pi | Succeeds; playlist keeps playing from cache | Confirmed — playlist continued from cache | PASS | T_disconnect: not recorded |
| 4.2 Wait 40 s; verify sidecar log shows `online=false` after ~30 s | Sidecar transitions offline | Confirmed offline transition observed | PASS | T_offline_confirmed: not recorded |
| 4.3 `sudo nmcli device connect wlan0` on Pi | Succeeds; sidecar log shows `online=true` within 15 s | Confirmed online within threshold | PASS | T_reconnect: not recorded, T_online_confirmed: not recorded |
| 4.4 Admin performs playlist mutation (swap items 1↔2 OR delete item 1) | HTTP 200 in admin Network tab | Confirmed 200 response | PASS | T0: not recorded |
| 4.5 Updated playlist visible on Pi display | New item plays within the 30 s budget | New item appeared within budget | PASS | T1: not recorded |
| 4.6 Compute T1 − T0 | ≤ 30.0 s | Operator confirmed threshold met by direct observation (exact delta not captured numerically) | PASS | **T1 − T0: not recorded (≤ 30 s verified)** |

**Pass criterion:** row 4.6 ≤ 30.0 s AND no black screen AND no error banner.

**Notes / anomalies:**
Operator ran the full disconnect/reconnect/admin-mutation sequence on the v1.18 Pi hardware. The ≤ 30 s reconnect→admin-mutation budget was verified as met by direct stopwatch observation; no black screen and no error banner seen. Exact `T1 − T0` value was not logged to the results doc at walkthrough time.

## Scenario 5: Sidecar Restart → Playback Continuity

| Step | Expected | Actual | Pass/Fail | Timing |
|------|----------|--------|-----------|--------|
| 5.1 `systemctl --user restart signage-sidecar` | Issued cleanly | Restart issued cleanly | PASS | T0: not recorded |
| 5.2 Observer watches display continuously for 30 s | **No black frame, no broken-image icon, no error overlay** | Zero visible interruption — display unaffected | PASS | — |
| 5.3 `curl localhost:8080/health` polled every 1 s until `ready:true` | Returns ready within 15 s | `ready:true` returned within threshold | PASS | T1: not recorded (T1 − T0: not recorded, ≤ 15 s verified) |
| 5.4 Sidecar log shows `Loaded persisted device token from disk.` | Yes | Confirmed in journal | PASS | — |
| 5.5 Next 60 s of playback | No visible interruption; items continue to advance on schedule | Items advanced normally | PASS | items observed: not recorded |
| 5.6 SSE still working (optional: make an admin mutation now and watch) | New mutation renders on Pi ≤ 10 s | Not exercised as part of this walkthrough | — | — |

**Pass criterion:** 5.2 PASS (zero visible interruption) AND 5.3 ≤ 15 s.

**Notes / anomalies:**
Operator verified zero visible playback interruption during sidecar restart and sub-15 s health-ready recovery by direct observation. Numerical cold-start time was not captured — the `/health` poll loop returned `ready:true` well within the 15 s budget but the exact delta was not logged.

## Pass/Fail Summary

| Scenario | Result | Critical metric | Notes |
|----------|--------|-----------------|-------|
| 4: Reconnect → admin-mutation | PASS | T1 − T0 ≤ 30 s verified (exact value not recorded) | Operator confirmed threshold met on v1.18 hardware. |
| 5: Sidecar restart | PASS | Visual continuity: PASS; cold-start ≤ 15 s verified (exact value not recorded) | Zero visible interruption; `/health` ready within budget. |

Operator confirmed both thresholds met on v1.18 hardware walkthrough; exact timings not captured numerically.

## Operator sign-off

- [x] Scenario 4 PASS — threshold (≤ 30 s) verified by direct observation; exact T1 − T0 not recorded numerically.
- [x] Scenario 5 PASS — visual-continuity confirmed (zero interruption); cold-start ≤ 15 s verified by observation; exact value not recorded.
- [x] No regressions observed against Phase 48 Scenarios 1–3 baseline.

Reviewer: Johann Bechtold (operator)  Date: 2026-04-21
