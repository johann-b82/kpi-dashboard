---
phase: 62-signage-calibration
plan: 04
type: execute
wave: 3
depends_on:
  - 62-signage-calibration-01
  - 62-signage-calibration-02
  - 62-signage-calibration-03
files_modified:
  - frontend/src/player/hooks/useSseWithPollingFallback.ts
  - frontend/src/player/PlaybackShell.tsx
  - frontend/src/player/lib/playerApi.ts
  - frontend/src/player/hooks/useSseWithPollingFallback.test.ts
autonomous: false
requirements:
  - CAL-PI-06
  - CAL-PI-07
must_haves:
  truths:
    - "Player SSE handler recognises calibration-changed events (in addition to playlist-changed)"
    - "On calibration-changed, player fetches GET /api/signage/player/calibration and toggles <video muted> to match audio_enabled"
    - "On real Pi hardware: admin rotates → wlr-randr transform applied ≤5s"
    - "On real Pi hardware: admin changes mode → monitor reports new mode ≤10s"
    - "On real Pi hardware: admin enables audio → currently-playing video unmutes ≤3s"
  artifacts:
    - path: "frontend/src/player/hooks/useSseWithPollingFallback.ts"
      provides: "Handler dispatches calibration-changed to a new onCalibrationChanged callback"
      contains: "calibration-changed"
    - path: "frontend/src/player/PlaybackShell.tsx"
      provides: "Maintains audio_enabled state and applies it to <video muted> via existing PlayerRenderer"
      contains: "audio_enabled"
    - path: "frontend/src/player/lib/playerApi.ts"
      provides: "fetchCalibration helper using playerFetch"
      contains: "/calibration"
  key_links:
    - from: "useSseWithPollingFallback onmessage"
      to: "onCalibrationChanged callback"
      via: "switch on data.event ∈ {playlist-changed, calibration-changed}"
      pattern: "calibration-changed"
    - from: "PlaybackShell.onCalibrationChanged"
      to: "fetchCalibration() → setAudioEnabled(calibration.audio_enabled)"
      via: "useState + prop drilled to PlayerRenderer which forwards to <video muted={!audio_enabled}>"
      pattern: "muted=\\{!audio_enabled"
    - from: "PlayerRenderer VideoPlayer"
      to: "HTMLMediaElement.muted attribute"
      via: "D-05 — wpctl handles system mute; <video muted> handles element-level mute"
      pattern: "muted"
---

<objective>
Complete Phase 62 by wiring the player app to the `calibration-changed` SSE event (per D-05 — wpctl alone is insufficient; the HTMLMediaElement `muted` attribute must also flip), then verify the full admin-to-Pi loop on real hardware against the three timing thresholds in CAL-PI-07.

Purpose: Close the loop. After 62-01..03 the backend + admin UI + sidecar are all live, but the player's `<video>` element still carries `muted` independently of `wpctl` — without this plan, enabling audio from the admin UI unmutes the sink but the playing `<video>` stays muted (no sound). This plan also proves the E2E on actual Pi hardware.

Output: Player SSE extension + real-Pi walkthrough with timing evidence.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/62-signage-calibration/62-CONTEXT.md
@.planning/phases/62-signage-calibration/62-01-SUMMARY.md
@.planning/phases/62-signage-calibration/62-02-SUMMARY.md
@.planning/phases/62-signage-calibration/62-03-SUMMARY.md

<interfaces>
From frontend/src/player/hooks/useSseWithPollingFallback.ts (lines 19-29, 103-114) — existing hook to extend:

```typescript
export interface UseSseWithPollingFallbackOpts {
  token: string | null;
  streamUrl: string;
  pollUrl: string;
  onPlaylistInvalidated: () => void;  // existing
  onUnauthorized: () => void;
  // ADD: onCalibrationChanged?: () => void;
}

// Handler body (line 103-114) already parses `data.event`:
if (data.event === "playlist-changed") {
  callbacksRef.current.onPlaylistInvalidated();
}
// EXTEND with:
// else if (data.event === "calibration-changed") {
//   callbacksRef.current.onCalibrationChanged?.();
// }
```

From frontend/src/player/PlaybackShell.tsx (lines 50-82) — shell wires the hook.

From frontend/src/signage/player/PlayerRenderer — VideoPlayer currently renders `<video muted playsInline autoPlay loop />`. We need a prop to override `muted` to `false` when `audio_enabled === true`. Spot-confirm the VideoPlayer component's current muted policy at implementation time.

Backend contract (delivered by 62-01):
- `GET /api/signage/player/calibration` → `{rotation, hdmi_mode, audio_enabled}` (device-auth, scoped to caller).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Player wires calibration-changed → toggle &lt;video muted&gt; (CAL-PI-06)</name>
  <files>frontend/src/player/hooks/useSseWithPollingFallback.ts, frontend/src/player/PlaybackShell.tsx, frontend/src/player/lib/playerApi.ts, frontend/src/player/hooks/useSseWithPollingFallback.test.ts</files>
  <behavior>
    - `UseSseWithPollingFallbackOpts` gains optional `onCalibrationChanged?: () => void`. `callbacksRef.current` carries it. The `onmessage` handler extended: on `data.event === "calibration-changed"` invoke `callbacksRef.current.onCalibrationChanged?.()`.
    - New `fetchCalibration(token)` in playerApi.ts that GETs `/api/signage/player/calibration` and returns `{rotation, hdmi_mode, audio_enabled}` (shape matches backend 62-01 response).
    - PlaybackShell gains local state `audioEnabled`. On initial mount (after token is present): fetch once via `fetchCalibration` and seed state. On `onCalibrationChanged`: re-fetch and update state.
    - PlayerRenderer receives a new prop `audioEnabled: boolean`. Forwards to its VideoPlayer child which binds `<video muted={!audioEnabled} ... />`. Default `audioEnabled = false` to preserve autoplay-muted behaviour until operator enables audio.
    - Unit test for the SSE hook: dispatch a mock `MessageEvent` with `data='{"event":"calibration-changed","device_id":"abc"}'`; assert `onCalibrationChanged` is invoked; `onPlaylistInvalidated` is NOT invoked.
  </behavior>
  <action>
    1. Edit frontend/src/player/hooks/useSseWithPollingFallback.ts:
       - Add `onCalibrationChanged?: () => void` to `UseSseWithPollingFallbackOpts`.
       - Store it on `callbacksRef.current` (line 40-41).
       - In the `onmessage` handler (after the existing `playlist-changed` branch, line 108), add:
         ```typescript
         } else if (data.event === "calibration-changed") {
           callbacksRef.current.onCalibrationChanged?.();
         }
         ```

    2. Edit frontend/src/player/lib/playerApi.ts — add:
       ```typescript
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

    3. Edit frontend/src/player/PlaybackShell.tsx:
       - Add `const [audioEnabled, setAudioEnabled] = useState(false);`
       - Add an effect: when `token` becomes non-null, call `fetchCalibration(token, clearToken).then(c => setAudioEnabled(c.audio_enabled))`.
       - Pass `onCalibrationChanged: async () => { const c = await fetchCalibration(token!, clearToken); setAudioEnabled(c.audio_enabled); }` to `useSseWithPollingFallback`.
       - Pass `audioEnabled` to `<PlayerRenderer items={items} audioEnabled={audioEnabled} />`.

    4. Minimal PlayerRenderer update: accept `audioEnabled?: boolean` and forward to VideoPlayer as `muted={!audioEnabled}`. Keep existing default (`audioEnabled=false` → `muted=true`) so autoplay compliance preserves.

    5. Add frontend/src/player/hooks/useSseWithPollingFallback.test.ts — use `vitest` + the `EventSource` mock pattern. Three tests:
       - `dispatches onCalibrationChanged when event is calibration-changed`
       - `does NOT dispatch onPlaylistInvalidated when event is calibration-changed`
       - existing `playlist-changed` path still dispatches correctly (regression guard).
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/player/hooks/useSseWithPollingFallback.test.ts && npm run tsc -- --noEmit && npm run build</automated>
  </verify>
  <done>Hook dispatches both event types correctly. `<video muted>` reflects `audioEnabled`. `fetchCalibration` typed. Build + tsc clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Real-Pi hardware E2E walkthrough (CAL-PI-07)</name>
  <files>.planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md</files>
  <action>
    Claude must AUTOMATE the pre-checkpoint setup before handing control to the user:

    1. Build and deploy: `docker compose up -d --build api frontend`.
    2. Verify the test Pi is paired with this backend instance and playing a video with an audio track. If not, instruct the user via a short checklist output.
    3. Open two SSH sessions to the Pi:
       - Session A: `systemctl --user status signage-sidecar signage-player labwc` — confirm all three `active (running)`. Report any that aren't.
       - Session B: `journalctl --user -u signage-sidecar -f` — stream logs to the user's terminal so they can watch calibration applies in real time.
    4. Create `.planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md` scaffold with 4 empty scenario sections (A/B/C/D) ready for the user to fill.
    5. Then present the verification steps (below) to the user and wait for the resume-signal.

    USER-EXECUTED VERIFICATION:

    **Scenario A — Rotation (threshold ≤5s):**
    1. On admin UI `/signage/devices`, click edit on the test device.
    2. Open Calibration section. Rotation currently 0°.
    3. Start stopwatch, click rotation dropdown → select 90° → click Save.
    4. Stop stopwatch when the Pi display physically rotates.
    5. From another SSH session run `wlr-randr` on the Pi and confirm the output's transform field reads `90`.
    6. PASS if observed rotation occurs ≤5 seconds after Save click AND `wlr-randr` reports transform=90.

    **Scenario B — HDMI mode change (threshold ≤10s):**
    1. Check the monitor's current mode via on-screen display (menu button on monitor).
    2. Identify an alternative supported mode from the monitor's EDID (e.g. 1280x720@60 — pick conservatively).
    3. Enter the mode string in the HDMI mode dropdown (D-02 — until sidecar reports modes via heartbeat, use curl directly if UI lacks free-form input; capture which in the SUMMARY).
    4. Start stopwatch, click Save.
    5. Stop stopwatch when monitor's OSD reports the new mode OR `wlr-randr` shows the new mode as current.
    6. PASS if transition completes ≤10 seconds.
    7. If it fails cleanly (monitor doesn't support): verify heartbeat payload surfaces `calibration_last_error` via `curl -H "Authorization: Bearer $DIRECTUS_JWT" http://localhost:8000/api/signage/devices/<id>` — confirming D-09 error surfacing.

    **Scenario C — Audio enable (threshold ≤3s):**
    1. Pi plays a video with audio track; speaker connected, audio currently OFF (audio_enabled=false).
    2. Start stopwatch, on admin UI flip Audio toggle to On → Save.
    3. Stop stopwatch when sound is heard from the speaker.
    4. PASS if sound occurs ≤3 seconds after Save.
    5. Flip back to Off, confirm audio mutes within 3s (regression direction).

    **Scenario D — Reboot survival (D-06, not timed):**
    1. With rotation=90°, audio_enabled=true, mode still set, SSH to Pi and run `sudo reboot`.
    2. Wait for full boot.
    3. Observe: display comes back in rotation=90° WITHOUT reconnecting to backend first.
    4. PASS if rotation is correct BEFORE wifi indicator shows connected. Alternatively verify via `journalctl --user -u signage-sidecar | grep -E "(replay|apply_calibration|connectivity)"` — replay+apply log lines MUST appear before first `connectivity_probe_loop` success.

    Record all four outcomes (PASS/FAIL + timing) in `62-04-E2E-RESULTS.md`.
  </action>
  <verify>
    <automated>test -f .planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md && grep -E "Scenario A.*PASS|Scenario A.*FAIL" .planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md && grep -E "Scenario B" .planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md && grep -E "Scenario C" .planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md && grep -E "Scenario D" .planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md</automated>
  </verify>
  <done>
    All four scenarios recorded in 62-04-E2E-RESULTS.md. Scenario A, C, D PASS. Scenario B either PASS (mode changed ≤10s) or PASS-with-caveat (mode unsupported → D-09 error surfaced correctly in heartbeat body). User has typed "approved" or described failures for triage.
  </done>
  <resume-signal>Type "approved" after all four scenarios complete. If any FAIL, describe which scenario + observed behavior so Claude can triage (likely a gap-closure plan; possibly a 62-03 patch).</resume-signal>
</task>

</tasks>

<verification>
- Task 1 green per its automated gate.
- Task 2 PASS recorded in 62-04-E2E-RESULTS.md for all 4 scenarios.
- Full suite still green:
  ```
  cd backend && pytest tests/test_signage_calibration.py -v
  cd pi-sidecar && python -m pytest -v
  cd frontend && npx vitest run && npm run build
  ```
</verification>

<success_criteria>
- CAL-PI-06: Player toggles `<video muted>` on `calibration-changed` (D-05 — both system-level `wpctl` mute and element-level `muted` flip in sync).
- CAL-PI-07: Real-Pi E2E — rotation ≤5s, mode ≤10s, audio ≤3s, reboot-survival verified.
- D-06 replay ordering verified empirically (display correct before network).
- D-09 error surfacing observed (or explicitly noted untriggered in a clean run).
- No regression in existing Scenarios 1–5 from Phase 48 (spot-check playlist + pairing still work).
</success_criteria>

<output>
After completion, create:
- `.planning/phases/62-signage-calibration/62-04-SUMMARY.md`
- `.planning/phases/62-signage-calibration/62-04-E2E-RESULTS.md` with scenario-by-scenario PASS/FAIL + timings.
</output>
