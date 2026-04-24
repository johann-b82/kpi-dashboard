# Phase 62: Signage Calibration — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** Derived from `REQUIREMENTS.md` (CAL-BE-01..05, CAL-UI-01..04, CAL-PI-01..07) + new-milestone locked decisions.

## Goal

Operators calibrate each signage Pi from `/signage/devices` — rotation, HDMI mode, audio on/off — without SSH or re-provisioning. Changes propagate live via SSE → Pi sidecar within 10 s (5 s for rotation, 3 s for audio unmute). Sidecar persists last-applied state to `/var/lib/signage/calibration.json` so reboots restore it before network is available.

## Locked decisions

### D-01: Rotation via `wlr-randr`, not `config.txt`

Pi runs labwc wayland compositor (shipped v1.16+). Rotation is a runtime property: `wlr-randr --output <name> --transform <0|90|180|270>`. **No** `/boot/firmware/config.txt` edits. **No** reboot required. **No** CSS-transform fallback — labwc is the single source of truth.

### D-02: HDMI mode via `wlr-randr --mode`

Same mechanism: `wlr-randr --output <name> --mode <WIDTHxHEIGHT@REFRESH>`. Modes come from `wlr-randr --json` output — sidecar reports the discovered mode list to the backend via heartbeat so the admin UI dropdown can show only supported modes.

### D-03: Audio via WirePlumber with PulseAudio fallback

Primary: `wpctl set-mute @DEFAULT_AUDIO_SINK@ 0|1`. Fallback (if WirePlumber not running): `pactl set-sink-mute @DEFAULT_SINK@ 0|1`. Sidecar probes which is available at startup and pins the choice.

### D-04: Live control via SSE → sidecar

Admin `PATCH /api/signage/devices/{id}/calibration` triggers a `calibration-changed` event on the target device's SSE queue. **The sidecar becomes an SSE subscriber** in this phase — currently only the player listens (`useSseWithPollingFallback.ts`). Sidecar reuses the existing device JWT and subscribes to `/api/signage/player/stream`. On event, fetches `GET /api/signage/player/calibration` for the full state and applies it.

### D-05: Player reacts too — for the `<video>` `muted` attr

The player app (`frontend/src/player/*`) also listens on the same SSE stream. On `calibration-changed`, the player refetches calibration (or reads the event payload) and toggles its `<video>` element's `muted` attribute. Reason: `wpctl` affects system-level mute, but HTMLMediaElement also carries a boolean `muted` attribute; flipping only the system mute while `muted` is still `true` on the element is a no-op.

### D-06: Reboot survival via `/var/lib/signage/calibration.json`

Sidecar writes the last-applied calibration to disk after every successful apply. On boot, reads this file **before** the network is up and re-applies via `wlr-randr` + `wpctl` so the display comes up correctly even on offline boot. On reconnect, backend is the source of truth and overwrites local if they diverge.

### D-07: Defaults on existing rows

Alembic migration backfills existing `signage_devices` rows with `rotation=0`, `hdmi_mode=NULL` (sidecar interprets NULL as "use current", i.e. no mode change), `audio_enabled=false`. Existing in-production devices do not flicker or change behaviour.

### D-08: SSE event payload

`calibration-changed` event payload is the device_id only (consistent with other signage SSE events that trigger a refetch). Full state is fetched via `GET /api/signage/player/calibration`.

### D-09: Error reporting to backend

When `wlr-randr` / `wpctl` command fails (e.g., invalid mode, mute command errors), sidecar reports via the heartbeat body (`calibration_last_error`, `calibration_last_applied_at`). Admin UI surfaces a warning badge on the device row. Do **not** retry the failed command automatically — wait for the next `calibration-changed` event.

### D-10: API auth split

- `PATCH /api/signage/devices/{id}/calibration` → **admin-only** (uses Directus JWT, existing pattern)
- `GET /api/signage/player/calibration` → **device-auth** (uses signed device JWT, existing pattern; scopes to the caller's device)

### D-11: Atomic commits, per-plan scope

- 62-01 backend-only (migration + endpoints + SSE emitter)
- 62-02 frontend admin UI only (no backend changes)
- 62-03 pi-sidecar only (no backend, no frontend)
- 62-04 player + real-Pi E2E

Wave structure: 62-01 must land first. 62-02 and 62-03 can run in parallel after 62-01. 62-04 after all three.

## Claude's discretion

- Exact `SELECT`/`UPDATE` SQL pattern for `SignageDevice.calibration` — column-per-field vs JSONB. **Guidance:** column-per-field is more type-safe and admin-UI-friendly; JSONB would only help if calibration grows to many fields (it won't — out-of-scope items are locked out).
- Whether the existing `SSE_EVENTS` enum / event-type constant gets a new member or whether calibration uses the generic `device-config-changed` pattern already in use for other device updates (if any).
- Sidecar daemon-vs-thread model for the new SSE listener — whether to reuse the existing asyncio loop in sidecar.py or spawn a dedicated thread. The current sidecar is `async def`-heavy; extending the existing loop is the natural choice.
- Which systemd user service (if any) needs updating to grant sidecar access to `wlr-randr` + `wpctl` (may need `XDG_RUNTIME_DIR`/`WAYLAND_DISPLAY` passthrough).
- How to surface calibration errors in `DevicesPage` — a small badge next to heartbeat is fine; don't over-engineer.

## Non-goals (explicit)

- **No brightness.** Most HDMI displays have no software brightness; Pi has no chip.
- **No per-display colour calibration / gamma.** Out of scope.
- **No reboot-only rotation via `config.txt`.** Locked to labwc runtime.
- **No CSS-transform fallback.** labwc is single source of truth.
- **No per-media audio-volume overrides.** Audio is a single device-level on/off toggle.
- **No new admin permission/role** — reuses existing Directus Admin role.

## Dependencies

- **Upstream:** Phase 48 (sidecar module structure), Phase 52 (`/signage/devices` admin page + `PATCH /api/signage/devices/{id}`), Phase 45 (SSE broadcast + per-device queue), Phase 53 (heartbeat body → backend path for error reporting).
- **Downstream:** None (but real-hardware E2E in 62-04 should re-verify that nothing else regressed — Phase 48 Scenarios 1–5 should still pass).

## Canonical refs (for the planner)

- `backend/app/models/signage.py` — `SignageDevice` model (419 LOC, lines TBD during spot-read)
- `backend/app/routers/signage_*.py` — existing admin + player routers pattern
- `backend/alembic/versions/v1_*_signage_*.py` — past signage migration style
- `frontend/src/signage/pages/DevicesPage.tsx` — admin devices list + edit dialog
- `frontend/src/player/hooks/useSseWithPollingFallback.ts` — player SSE listener pattern to mirror on the sidecar
- `frontend/src/player/PlaybackShell.tsx` — where `<video>` `muted` attr lives
- `pi-sidecar/sidecar.py` — current FastAPI sidecar (475 LOC); its asyncio loop is where the new SSE listener attaches
- `scripts/lib/signage-install.sh` — shared installer library; need to confirm `wlr-randr` + `wireplumber` + `pulseaudio-utils` are installed on the Pi (if not, Phase 62-03 adds them)
- `frontend/src/signage/*.test.tsx` — test patterns for admin UI unit + integration coverage

## Requirements traceability

| Req ID | Plan |
|---|---|
| CAL-BE-01 (migration + columns) | 62-01 |
| CAL-BE-02 (device GET includes calibration) | 62-01 |
| CAL-BE-03 (PATCH endpoint) | 62-01 |
| CAL-BE-04 (SSE fanout) | 62-01 |
| CAL-BE-05 (device-auth player GET) | 62-01 |
| CAL-UI-01 (calibration section) | 62-02 |
| CAL-UI-02 (HDMI mode dropdown) | 62-02 |
| CAL-UI-03 (save + invalidate) | 62-02 |
| CAL-UI-04 (i18n DE/EN) | 62-02 |
| CAL-PI-01 (sidecar SSE listen) | 62-03 |
| CAL-PI-02 (wlr-randr transform) | 62-03 |
| CAL-PI-03 (wlr-randr mode) | 62-03 |
| CAL-PI-04 (wpctl/pactl mute) | 62-03 |
| CAL-PI-05 (persist + replay) | 62-03 |
| CAL-PI-06 (player video muted) | 62-04 |
| CAL-PI-07 (real-Pi E2E) | 62-04 |
