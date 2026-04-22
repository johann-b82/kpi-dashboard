# Requirements: v1.21 Signage Calibration + Build Hygiene

**Milestone:** v1.21
**Status:** Roadmapped — 2 phases + 1 quick task
**Created:** 2026-04-22

**Core Value:** Operators calibrate each signage Pi from the admin UI — rotation, HDMI mode, audio-on/off — without SSH-ing to the device or reprovisioning. Also: `docker compose build frontend` works again. Also: strip the stale Authentik references now that Directus is the committed identity layer.

**Locked scope (2026-04-22):**

- Runtime-editable per-device rotation (0/90/180/270) via labwc + `wlr-randr`.
- Runtime-editable per-device HDMI mode via `wlr-randr`.
- Runtime-editable per-device audio on/off (unmute/mute videos) via WirePlumber/PulseAudio controls and a player `<video>` `muted` toggle.
- Changes propagate live from admin UI → SSE → sidecar within 10 s.
- Sidecar persists last-applied calibration to `/var/lib/signage/calibration.json` so reboots restore state.
- Default values on existing devices: `rotation=0`, `hdmi_mode=current/preferred`, `audio_enabled=false`.

**Out of scope:**

- Brightness (no reliable HDMI-over-DDC/CI or Pi-side brightness chip for our typical displays).
- Per-display colour calibration / gamma.
- Reboot-only rotation via `/boot/firmware/config.txt`.
- CSS-transform fallback rotation — we commit to labwc as the single source of truth.
- Per-media audio-volume overrides.

## Requirements

### Signage calibration — backend (CAL-BE-*)

- [ ] **CAL-BE-01**: `signage_devices` table gains `rotation` (`INTEGER`, CHECK IN (0, 90, 180, 270), NOT NULL DEFAULT 0), `hdmi_mode` (`VARCHAR(64)`, nullable), `audio_enabled` (`BOOLEAN`, NOT NULL DEFAULT false) via Alembic migration. Backfill default values on existing rows.
- [ ] **CAL-BE-02**: `GET /api/signage/devices` + `GET /api/signage/devices/{id}` admin responses include the three calibration fields.
- [ ] **CAL-BE-03**: `PATCH /api/signage/devices/{id}/calibration` admin-only endpoint accepts partial updates; rejects invalid rotation values with HTTP 422.
- [ ] **CAL-BE-04**: Calibration mutations emit a `calibration-changed` SSE event targeted at the affected device's EventSource queue.
- [ ] **CAL-BE-05**: `GET /api/signage/player/calibration` (device-auth) returns the caller's current calibration JSON.

### Signage calibration — admin UI (CAL-UI-*)

- [ ] **CAL-UI-01**: Device edit dialog on `/signage/devices` gains a `Calibration` section with rotation dropdown (0/90/180/270), HDMI mode dropdown, audio on/off toggle.
- [ ] **CAL-UI-02**: HDMI mode dropdown options come from a device-reported mode list (populated once the device first reports available modes — until then, a placeholder "auto" entry).
- [ ] **CAL-UI-03**: Saving calls `PATCH /api/signage/devices/{id}/calibration`, invalidates the devices TanStack query, and shows a toast.
- [ ] **CAL-UI-04**: All copy i18n-localised (DE/EN parity; du-tone).

### Signage calibration — Pi sidecar + player (CAL-PI-*)

- [ ] **CAL-PI-01**: Sidecar listens on the existing SSE stream for `calibration-changed`; on receipt, fetches `GET /api/signage/player/calibration`.
- [ ] **CAL-PI-02**: Sidecar applies rotation via `wlr-randr --output <name> --transform <0|90|180|270>`.
- [ ] **CAL-PI-03**: Sidecar applies HDMI mode via `wlr-randr --output <name> --mode <WIDTHxHEIGHT@REFRESH>`; errors surface to the backend via the heartbeat (or a new `/api/signage/player/calibration-result` POST).
- [ ] **CAL-PI-04**: Sidecar applies audio via `wpctl set-mute @DEFAULT_AUDIO_SINK@ 0|1`; if WirePlumber unavailable, fallback to `pactl set-sink-mute`.
- [ ] **CAL-PI-05**: Sidecar persists the last-applied calibration to `/var/lib/signage/calibration.json`; on boot, replays that state before hitting the network.
- [ ] **CAL-PI-06**: Player app responds to `calibration-changed` by toggling `<video>` `muted` attribute to match `audio_enabled`.
- [ ] **CAL-PI-07**: End-to-end (on real Pi hardware): admin rotates → wlr-randr reports new transform within 5 s; admin changes mode → monitor reports new mode within 10 s; admin enables audio → current playing video unmutes within 3 s.

### Frontend build fix (BUILD-*)

- [ ] **BUILD-01**: `docker compose build frontend` succeeds from a clean state (`docker compose build --no-cache frontend`) without manual workarounds.
- [ ] **BUILD-02**: Chosen resolution path documented in SUMMARY with rationale (upgrade vs `--legacy-peer-deps` vs pin).
- [ ] **BUILD-03**: `npm run dev` + `npm run build` continue to work on host (no regression in dev workflow).

### Authentik cleanup (CLEAN-*) — quick task

- [x] **CLEAN-01**: Remove Authentik references from CLAUDE.md (`Identity (future): Authentik` constraint), PROJECT.md (any mentions), ROADMAP.md (if any), and README.md. Replace with "Identity: Directus 11 (shipped v1.11-directus)" where context requires a statement. **(Done inline during new-milestone 2026-04-22 — CLAUDE.md lines 6 + 14 + PROJECT.md line 5 updated.)**

## Traceability

| Requirement | Phase | Commit | Status |
|---|---|---|---|
| CAL-BE-01 | Phase 62 | TBD | Pending |
| CAL-BE-02 | Phase 62 | TBD | Pending |
| CAL-BE-03 | Phase 62 | TBD | Pending |
| CAL-BE-04 | Phase 62 | TBD | Pending |
| CAL-BE-05 | Phase 62 | TBD | Pending |
| CAL-UI-01 | Phase 62 | TBD | Pending |
| CAL-UI-02 | Phase 62 | TBD | Pending |
| CAL-UI-03 | Phase 62 | TBD | Pending |
| CAL-UI-04 | Phase 62 | TBD | Pending |
| CAL-PI-01 | Phase 62 | TBD | Pending |
| CAL-PI-02 | Phase 62 | TBD | Pending |
| CAL-PI-03 | Phase 62 | TBD | Pending |
| CAL-PI-04 | Phase 62 | TBD | Pending |
| CAL-PI-05 | Phase 62 | TBD | Pending |
| CAL-PI-06 | Phase 62 | TBD | Pending |
| CAL-PI-07 | Phase 62 | TBD | Pending |
| BUILD-01 | Phase 63 | TBD | Pending |
| BUILD-02 | Phase 63 | TBD | Pending |
| BUILD-03 | Phase 63 | TBD | Pending |
| CLEAN-01 | quick | (inline) | Satisfied |
