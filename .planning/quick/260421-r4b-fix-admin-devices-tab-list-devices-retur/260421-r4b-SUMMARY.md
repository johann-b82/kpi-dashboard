---
phase: 260421-r4b-fix-admin-devices-tab
plan: 01
subsystem: signage/admin
tags: [signage, admin, devices, tags, heartbeat, analytics]
requires:
  - backend/app/routers/signage_admin/devices.py (existing)
  - frontend/src/signage/pages/DevicesPage.tsx (existing)
  - SignageDeviceTagMap model (imported in devices.py:18)
  - signageApi.listTags (existing at signageApi.ts:66)
provides:
  - GET /api/signage/devices returns populated tag_ids[] on every row
  - GET /api/signage/devices/{id} returns populated tag_ids[]
  - Admin Devices tab renders tag Badges by name
  - Diagnostic evidence for Test-device offline/stale status
affects:
  - backend/app/routers/signage_admin/devices.py::_attach_resolved_playlist
  - frontend/src/signage/pages/DevicesPage.tsx Tags column
tech-stack:
  added: []
  patterns:
    - Mirrors playlist tag_ids fetch pattern from commit 877c695
    - TanStack useQuery with 60s staleTime for tag lookup table
key-files:
  created: []
  modified:
    - backend/app/routers/signage_admin/devices.py
    - frontend/src/signage/pages/DevicesPage.tsx
decisions:
  - Stay byte-for-byte consistent with playlists.py tag_ids fetch (N+1 acceptable for <20-device admin list)
  - DEFECT-12 comment removed; backend now authoritative for tag_ids
  - No fix for Test-device stale status — root cause is external (player tab not heartbeating)
metrics:
  duration: ~8 min
  completed: 2026-04-21
---

# 260421-r4b: Fix Admin Devices Tab — tag_ids + Test-device Diagnosis Summary

One-liner: Populated `SignageDeviceRead.tag_ids` in admin list/get and rewired DevicesPage to render Badges by name; diagnosed Test-device offline status as genuine (player not heartbeating).

## Changes

### Part 1 — Backend `tag_ids` wiring (Task 1)

Extended `_attach_resolved_playlist(db, device)` in `backend/app/routers/signage_admin/devices.py` to query `SignageDeviceTagMap` for the device and assign `out.tag_ids = tag_ids or None`. Mirrors the playlist pattern landed in commit 877c695 (playlists.py lines 115-122). Both `list_devices` and `get_device` benefit automatically since they share the helper.

Commit: `c291629`

### Part 2 — Frontend Badge-by-name (Task 2)

Added `useQuery(signageKeys.tags(), signageApi.listTags)` with 60s `staleTime` and a `useMemo`-built `tagById` Map in `frontend/src/signage/pages/DevicesPage.tsx`. The Badge render block now iterates `d.tag_ids ?? []`, resolves each id through `tagById`, and renders `tag.name`. Removed the DEFECT-12 comment.

Commit: `d987150`

## Part 3 — Test-device Diagnostic

### Step A — Database truth

```sql
SELECT id, name, status, last_seen_at, revoked_at, now() - last_seen_at AS age
  FROM signage_devices WHERE name = 'Test';
```

Result (2026-04-21 17:35 UTC):
```
name | status  | last_seen_at                  | revoked_at | age
Test | offline | 2026-04-21 17:22:01.784289+00 | NULL       | 00:13:34
```

Heartbeat event count over last 25 h:
```
name | beats | latest                        | latest_age
Test |   1   | 2026-04-21 17:22:01.784289+00 | 00:13:37
```

**The device has emitted exactly ONE heartbeat in the last 25 hours**, and `last_seen_at` matches `MAX(signage_heartbeat_event.ts)` exactly. No backend writing regression.

`distinct_minutes_24h = 1`, so analytics `uptime_24h_pct` naturally computes to ~1 minute of activity out of the observed window — matches the "low Betriebszeit" symptom.

### Step B — Heartbeat path audit

- `backend/app/routers/signage_player.py:83-116` (POST /heartbeat) correctly updates `last_seen_at`, `current_item_id`, `current_playlist_etag`, flips status online if previously offline, AND inserts a `signage_heartbeat_event` row (ON CONFLICT DO NOTHING). Verified from code.
- `backend/app/scheduler.py::_run_signage_heartbeat_sweeper` (line 200) correctly flips `status='offline'` for devices with `last_seen_at < now() - 5min`, excluding already-offline and revoked devices. Runs every minute.
- `frontend/src/player/PlaybackShell.tsx:110-130` (commit 1bb6a05 browser-mode fallback) schedules `setInterval(tick, 60_000)` and calls `playerFetch('/api/signage/player/heartbeat', { method: 'POST', ... })`. HOWEVER, line 113 short-circuits with `if (document.visibilityState !== "visible") return;` — so the fallback skips when the tab is hidden/backgrounded.

### Step C — Live docker logs

`docker compose logs --tail=500 api | grep 'POST /api/signage/player/heartbeat' | wc -l` → **1**.

Meanwhile the same player is actively polling:
- `GET /api/signage/player/playlist` → 304 (dozens of hits)
- `GET /api/signage/player/stream?token=...` → 200 (SSE, reconnects)

So the player JS bundle IS loaded and the SSE/polling loop is alive. Only the heartbeat POST has stopped firing. This is consistent with the fallback interval being gated on `document.visibilityState === "visible"` when the browser tab is backgrounded (SSE/fetch keep running in background tabs via the JS event loop; `setInterval` also runs but the visibility check skips the POST).

### Step D — Root cause classification

**Not a backend bug.** The pipeline behaves correctly end-to-end:

1. Player heartbeat fallback WAS sent once at 17:22:01 → backend wrote `last_seen_at` + heartbeat event → sweeper correctly flipped to `offline` at ~17:27 (5 min after last seen).
2. Since 17:22, the player tab has either been backgrounded OR the Pi-sidecar is not present AND the operator tab is not visible (the fallback explicitly no-ops when `document.visibilityState !== "visible"` — line 113).
3. Low Betriebszeit (`uptime_24h_pct`) is the truthful consequence of only 1 distinct minute-bucket over the 24 h window.

### Outcome — No fix landed

Per plan §Step D decision tree: "If Step A shows no recent heartbeats at all → player never sends → record findings; if cause is external (network, power, tab hidden), document and close." The Test-device symptom is **expected behavior for a browser tab that has been backgrounded/closed**.

The admin UI is accurately reporting reality. Operator action: re-open the `/player/:token` tab and keep it visible, OR install the Pi sidecar (Phase 48) which owns production heartbeats independent of tab visibility.

### Follow-up todos (non-blocking)

- (UX polish, not a bug) Consider surfacing `window_minutes` from `/api/signage/analytics/devices` in a DevicesPage tooltip so operators understand that `uptime_24h_pct` is clamped to the observed window (a freshly-paired device will correctly show low Betriebszeit).
- (Optional) The browser-mode heartbeat fallback could additionally listen for `visibilitychange` and fire an immediate `tick()` on re-visible, to skip the up-to-60s wait. Trivial but out of scope for this quick.

## Deviations from Plan

None — plan executed as written. Task 3 outcome falls into Step D's documented "external cause" branch (no fix).

## Self-Check: PASSED

- FOUND: backend/app/routers/signage_admin/devices.py
- FOUND: frontend/src/signage/pages/DevicesPage.tsx
- FOUND: .planning/quick/260421-r4b-fix-admin-devices-tab-list-devices-retur/260421-r4b-SUMMARY.md
- FOUND commit c291629 (Task 1)
- FOUND commit d987150 (Task 2)
