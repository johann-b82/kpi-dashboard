---
phase: 62-signage-calibration
plan: 04
subsystem: signage/player
tags: [signage, calibration, player, sse, video-muted, partial]
status: task-1-complete-task-2-awaiting-human-verify
requires:
  - Phase 47 signage player bundle + SSE hook
  - Phase 62-01 backend GET /player/calibration + calibration-changed event
  - Phase 62-02 admin UI (trigger for calibration-changed)
  - Phase 62-03 Pi sidecar (system-level wpctl mute, parallel layer to <video muted>)
provides:
  - useSseWithPollingFallback onCalibrationChanged callback (calibration-changed dispatch)
  - PlayerCalibration type + fetchCalibration helper in player/lib/playerApi.ts
  - PlaybackShell local audioEnabled state (seeded on mount, refreshed on SSE event)
  - PlayerRenderer audioEnabled prop threaded through to VideoPlayer muted
affects:
  - VideoPlayer muted prop (backward-compat default true — admin preview unchanged)
  - PlayerRenderer prop surface (+audioEnabled?: boolean)
  - PlaybackShell memory (+audioEnabled useState + refreshCalibration useCallback)
tech-stack:
  added: []
  patterns:
    - "useRef extended with optional callback — identity-stable across renders so the SSE useEffect does not churn EventSource on every parent render (same pattern as existing onPlaylistInvalidated/onUnauthorized)"
    - "Default audioEnabled=false preserves Phase 47 autoplay-muted invariant (HTMLMediaElement muted=true required for browser autoplay without user gesture)"
    - "Element-level <video muted> flip is NOT redundant with sidecar wpctl — D-05 locks in that both layers must flip together or audio stays silent"
key-files:
  created:
    - frontend/src/player/hooks/useSseWithPollingFallback.test.ts
  modified:
    - frontend/src/player/hooks/useSseWithPollingFallback.ts
    - frontend/src/player/lib/playerApi.ts
    - frontend/src/player/PlaybackShell.tsx
    - frontend/src/signage/player/PlayerRenderer.tsx
    - frontend/src/signage/player/VideoPlayer.tsx
decisions:
  - "onCalibrationChanged typed as optional (?) so admin-preview / other PlayerRenderer consumers don't need to pass it; PlaybackShell is the only wiring site"
  - "fetchCalibration catches errors silently in PlaybackShell.refreshCalibration — last-known audioEnabled stays in place; sidecar wpctl remains authoritative and the next SSE event will retry"
  - "useCallback on refreshCalibration + useEffect [refreshCalibration] — initial mount seeds calibration once per token identity (not on every render)"
  - "VideoPlayer gains muted prop (default true) rather than flipping the hardcoded attribute — admin preview rendering (unmuted audio never wanted there either) inherits the safe default without code change"
metrics:
  duration: ~6m
  completed_task_1: 2026-04-22
  completed_task_2: PENDING-HUMAN-VERIFY
  tasks: 1 of 2 complete
  files: 6
  tests_added: 3
---

# Phase 62 Plan 04: Player + Real-Pi E2E Summary (PARTIAL — Task 1 complete, Task 2 awaiting human verification)

Task 1 (CAL-PI-06) landed: the kiosk player app now subscribes to `calibration-changed` on its existing SSE stream, refetches `GET /api/signage/player/calibration`, and toggles the HTMLMediaElement `muted` attribute on the active video to match `audio_enabled`. This closes the D-05 gap — without the element-level flip, the sidecar's `wpctl set-mute @DEFAULT_AUDIO_SINK@ 0` is a no-op because the `<video>` element keeps browser-level mute.

Task 2 (CAL-PI-07 real-Pi hardware E2E walkthrough) is a `checkpoint:human-verify` gate. It has NOT been executed. The four scenarios (rotation ≤5s, HDMI mode ≤10s, audio ≤3s, reboot-replay-before-connectivity) require physical access to the test Pi + monitor + admin UI and must be run by the human operator. Plan 62-04 is therefore intentionally NOT marked fully complete — CAL-PI-07 remains open in REQUIREMENTS.md.

## What Shipped (Task 1 only)

### 1. SSE hook extension — `useSseWithPollingFallback`

`UseSseWithPollingFallbackOpts` gains optional `onCalibrationChanged?: () => void`. The ref that keeps callback identity stable across renders now also carries this callback alongside `onPlaylistInvalidated` + `onUnauthorized`. The `onmessage` handler's existing `data.event === "playlist-changed"` branch is extended with an `else if` for `"calibration-changed"` that invokes `callbacksRef.current.onCalibrationChanged?.()`. Payload shape (from 62-01) is `{event, device_id}` only — the handler does not read device_id because the player already knows which device it is (it's holding the JWT), and the full calibration state is fetched via the dedicated GET per D-08.

### 2. `fetchCalibration` helper — `player/lib/playerApi.ts`

```ts
export interface PlayerCalibration {
  rotation: 0 | 90 | 180 | 270;
  hdmi_mode: string | null;
  audio_enabled: boolean;
}

export function fetchCalibration(
  token: string,
  onUnauthorized?: () => void,
): Promise<PlayerCalibration> {
  return playerFetch<PlayerCalibration>("/api/signage/player/calibration", {
    token,
    on401: onUnauthorized,
  });
}
```

Shape matches the backend `SignageCalibrationRead` Pydantic model from 62-01. Reuses the existing `playerFetch` adapter (the one permitted `fetch()` callsite in `frontend/src/player/**` — Phase 47 CI-guard exception preserved, no new guard changes needed).

### 3. `PlaybackShell` wiring

- Local `const [audioEnabled, setAudioEnabled] = useState(false)` — `false` default preserves the Phase 47 autoplay-muted invariant (`<video muted>` is required for programmatic autoplay without a user gesture).
- `refreshCalibration` is a `useCallback` that awaits `fetchCalibration(token, clearToken)` and sets state. Errors are silently swallowed — last-known value stays in place, the Pi sidecar's `wpctl` remains authoritative, and the next `calibration-changed` event will retry.
- `useEffect([refreshCalibration])` seeds calibration once per token identity (mount after pairing) — not every render.
- `useSseWithPollingFallback` now receives `onCalibrationChanged: () => { void refreshCalibration(); }` alongside the existing `onPlaylistInvalidated` + `onUnauthorized` callbacks.
- `<PlayerRenderer items={items} audioEnabled={audioEnabled} />`.

### 4. PlayerRenderer + VideoPlayer props

- `PlayerRenderer` gains `audioEnabled?: boolean` (default `false`) and threads it into `renderItem(item, audioEnabled)`. The `video` case renders `<VideoPlayer uri={item.uri} muted={!audioEnabled} />`.
- `VideoPlayer` gains `muted?: boolean` (default `true`) — admin preview inherits the safe default (muted=true matches prior hard-coded behaviour), the Phase 47 player wrapper path is the only caller that flips it to `false` when operator enables audio.

### 5. Unit tests — `useSseWithPollingFallback.test.ts` (3 passing)

```
✓ dispatches onCalibrationChanged when SSE event is calibration-changed
✓ does NOT dispatch onPlaylistInvalidated on calibration-changed event
✓ still dispatches onPlaylistInvalidated on playlist-changed (regression guard)
```

Stubs global `EventSource` (jsdom does not ship one), opens the hook via `renderHook`, and drives `.onmessage(...)` directly — exercises the branch logic without a real SSE server.

## Verification (Task 1)

```
$ cd frontend && npx vitest run src/player/hooks/useSseWithPollingFallback.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ npx tsc -b --noEmit
(clean — 0 errors)

$ npm run build
✓ built in 203ms (both admin + player entries green, PWA precache 11 entries)
```

## Requirements Traceability

| Req ID    | Status                        | Covered by                                                                                                                          |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| CAL-PI-06 | ✅ CLOSED (Task 1)            | `useSseWithPollingFallback` calibration-changed dispatch + `PlaybackShell` audioEnabled state + `PlayerRenderer`/`VideoPlayer` muted prop chain + 3 passing unit tests |
| CAL-PI-07 | ⏸ OPEN (Task 2 not executed) | Requires physical Pi + monitor walkthrough; real-Pi E2E results file `62-04-E2E-RESULTS.md` not yet written                          |

## Task 2 — Awaiting Human Verification (DO NOT mark complete)

Task 2 is `checkpoint:human-verify` and is **blocking** for closure of CAL-PI-07. It comprises four scenarios against a paired test Pi:

1. **Scenario A — Rotation ≤5s:** Admin UI flips rotation 0°→90°; verify display rotates physically and `wlr-randr` reports `transform=90` within 5s of Save click.
2. **Scenario B — HDMI mode ≤10s:** Admin selects alternative mode; verify monitor OSD / `wlr-randr` reports new mode within 10s. If monitor rejects the mode, verify `calibration_last_error` surfaces via heartbeat body per D-09.
3. **Scenario C — Audio ≤3s:** Admin toggles Audio=On while a video with audio track is playing; verify speaker emits sound within 3s. Then toggle back Off — confirm mute within 3s.
4. **Scenario D — Reboot replay before connectivity (D-06):** With rotation=90°, audio=on, mode set, reboot Pi; verify display comes up rotated BEFORE wifi reconnects. Alternatively inspect `journalctl --user -u signage-sidecar` for `apply_calibration` log line preceding the first `connectivity_probe_loop` success.

The plan file `62-04-player-e2e-PLAN.md` contains the full pre-checkpoint setup (build/deploy, SSH sessions, scaffold of `62-04-E2E-RESULTS.md`). The operator should type `"approved"` after filling results, or describe failures for triage (likely a 62-03 sidecar patch).

## Deviations from Plan

### Task 1 — Executed as written, one shape refinement

**VideoPlayer `muted` prop defaults to `true` (not passed through from admin preview)** — the plan called for `PlayerRenderer` to receive `audioEnabled` and forward to VideoPlayer. To keep the admin preview's existing behaviour byte-for-byte (the `VideoPlayer` hard-coded `muted` attribute was already the behaviour), the prop defaults to `true` and only the player wrapper flips it. Zero call-site changes needed in admin code paths — this is a Rule 3 style non-deviation, documented for clarity.

No Rule 1/2/3 auto-fixes needed. No Rule 4 architectural checkpoints raised.

### Task 2 — Not executed (intentional)

Task 2 is a `checkpoint:human-verify` gate and by design requires the human operator. Per the orchestrator prompt: "Do NOT execute Task 2 — stop at the checkpoint, leave it for the user."

## Downstream Hand-off

Once Task 2 passes, Phase 62 is closed end-to-end. Only known follow-up is backend persistence of the heartbeat-reported `calibration_last_error` / `calibration_last_applied_at` fields into admin-UI-visible state — flagged in 62-03 SUMMARY as a "future-plan concern, not in scope here." No urgent follow-up from 62-04 itself.

## Self-Check: PASSED (Task 1 scope)

- FOUND: frontend/src/player/hooks/useSseWithPollingFallback.ts (modified — onCalibrationChanged)
- FOUND: frontend/src/player/hooks/useSseWithPollingFallback.test.ts (created — 3 tests)
- FOUND: frontend/src/player/lib/playerApi.ts (modified — PlayerCalibration + fetchCalibration)
- FOUND: frontend/src/player/PlaybackShell.tsx (modified — audioEnabled state + refresh)
- FOUND: frontend/src/signage/player/PlayerRenderer.tsx (modified — audioEnabled prop)
- FOUND: frontend/src/signage/player/VideoPlayer.tsx (modified — muted prop)
- FOUND: commit 0f41c17 (RED — 3 failing tests for calibration-changed dispatch)
- FOUND: commit cd38bae (GREEN — hook extension + shell wiring + prop chain)
- PASS: 3/3 unit tests passing
- PASS: tsc -b --noEmit (0 errors)
- PASS: npm run build (both entries, PWA precache clean)
- NOT-FOUND-BY-DESIGN: 62-04-E2E-RESULTS.md (Task 2 gated on human verification)
