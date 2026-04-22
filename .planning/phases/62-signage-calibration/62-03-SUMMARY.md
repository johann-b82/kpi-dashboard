---
phase: 62-signage-calibration
plan: 03
subsystem: signage/pi-sidecar
tags: [signage, calibration, sidecar, sse, wlr-randr, wpctl, wayland]
requires:
  - Phase 48 sidecar module structure (asyncio lifespan + disk helpers)
  - Phase 45 signage_broadcast per-device SSE queue
  - Phase 62-01 backend calibration-changed emit + GET /player/calibration
provides:
  - pi-sidecar SSE subscriber on /api/signage/player/stream
  - _apply_calibration via asyncio.create_subprocess_exec (wlr-randr + wpctl/pactl)
  - _wait_for_wayland_socket(timeout=15.0) bounded poll (Flag 1 fix)
  - /var/lib/signage/calibration.json persistence + boot replay (D-06)
  - Heartbeat body extension (calibration_last_error, calibration_last_applied_at) per D-09
  - apt package list expansion — wlr-randr, wireplumber, pulseaudio-utils
  - systemd unit: After/Requires=labwc.service, XDG_RUNTIME_DIR + WAYLAND_DISPLAY env
affects:
  - pi-sidecar/sidecar.py module surface (+4 new async helpers, +1 task)
  - Heartbeat body shape (additive, non-breaking — fields only present when non-null)
  - Boot ordering (calibration replay now happens before connectivity probe spawn)
tech-stack:
  added:
    - httpx-sse==0.4.1 (SSE client atop httpx)
    - apt: wlr-randr, wireplumber, pulseaudio-utils
  patterns:
    - "asyncio.create_subprocess_exec with asyncio.wait_for timeout (never subprocess.run — hazard #7)"
    - "shutil.which-probe at startup → pin audio backend choice for process lifetime (D-03)"
    - "Bounded poll on \$XDG_RUNTIME_DIR/wayland-0 closes After=labwc race (Flag 1)"
    - "Heartbeat body extension over new endpoint — reuses Phase 53 error-surface path (D-09)"
key-files:
  created:
    - pi-sidecar/tests/test_calibration.py
  modified:
    - pi-sidecar/sidecar.py
    - pi-sidecar/requirements.txt
    - scripts/lib/signage-packages.txt
    - scripts/systemd/signage-sidecar.service
decisions:
  - "httpx-sse pinned at 0.4.1 (plan-pinned; 0.4.3 is latest but stable baseline chosen for reproducibility with the rest of requirements.txt)"
  - "Output discovery strategy: parse wlr-randr --json, pick first `enabled` output; fallback to outputs[0] if none flagged enabled. Result cached in _wlr_output_name for process lifetime."
  - "Audio backend: probed at lifespan startup via shutil.which; pinned for process lifetime. On Debian 12 Pi image the expected resolution is wpctl (wireplumber is the shipped session manager)."
  - "D-09 no-retry upheld: on subprocess non-zero / timeout, _calibration_last_error is set and the apply returns; the next calibration-changed SSE event is the retry trigger. No timer, no backoff."
  - "Boot-replay ordering uses sequential `await` in lifespan (not asyncio.create_task) so the replay provably completes before any background task's first tick."
metrics:
  duration: 529s (~8m 49s)
  completed: 2026-04-22
  tasks: 2
  files: 5
  tests_added: 17
---

# Phase 62 Plan 03: Pi Sidecar Calibration Applier Summary

The Pi sidecar now subscribes to `/api/signage/player/stream` with its existing device JWT and, on `calibration-changed`, fetches the full calibration state and applies it live via `wlr-randr` (rotation + HDMI mode) and `wpctl`/`pactl` (audio mute). Last-applied state is persisted to `/var/lib/signage/calibration.json` (mode 0600) and replayed on boot **before** the connectivity probe runs (D-06). Seventeen unit tests cover the apply argv shapes, D-09 no-retry semantics, the Flag 1 Wayland-socket bounded wait, and the boot-replay ordering guarantee.

## What Shipped

### 1. Calibration helpers (`pi-sidecar/sidecar.py`)

**Persistence (CAL-PI-05, D-06):**
- `_load_calibration()` / `_save_calibration(cal)` — round-trip `/var/lib/signage/calibration.json` at mode 0o600 via the existing `_write_secure` helper.
- Corrupt JSON → `_load_calibration` returns `None` (logged at WARNING), not an exception that would kill the replay path.

**Audio backend pin (D-03):**
- `_detect_audio_backend()` uses `shutil.which("wpctl")` → `shutil.which("pactl")` → `None`. Called once from lifespan startup; result stored in `_audio_backend` module state for the process lifetime.

**Wayland readiness (Flag 1 fix):**
- `_wait_for_wayland_socket(timeout=15.0)` polls `$XDG_RUNTIME_DIR/wayland-0` every 200 ms. Returns `True` on first existence. Returns `False` after timeout and sets `_calibration_last_error = "wayland socket unavailable at boot"` so the first heartbeat surfaces the skip.
- Complements the new `After=labwc.service` in the systemd unit (systemd `After` guarantees start-order, not socket-readiness).

### 2. `_apply_calibration(cal)` (CAL-PI-02/03/04, D-01/02/03/09)

**Flow:**
1. If rotation or hdmi_mode is set, discover the output name via `wlr-randr --json` (first `enabled: true`; fallback `outputs[0]`; cached in `_wlr_output_name`).
2. If rotation ∈ {0, 90, 180, 270}: `wlr-randr --output <name> --transform <N>`.
3. If hdmi_mode (string): `wlr-randr --output <name> --mode <mode>`.
4. If audio_enabled is not None:
   - `wpctl` pinned: `wpctl set-mute @DEFAULT_AUDIO_SINK@ <0|1>` (True → 0 / False → 1).
   - `pactl` pinned: `pactl set-sink-mute @DEFAULT_SINK@ <0|1>`.
   - Neither available → record error, skip.
5. On any non-zero exit / timeout: collect into `errors[]` joined into `_calibration_last_error`; **return**. No internal retry (D-09).
6. On success: `_save_calibration(cal)`, update `_calibration_last_applied_at` (ISO 8601 UTC), clear `_calibration_last_error`.

**Subprocess hygiene:**
All invocations go through `_run_async(*argv, timeout=5.0)`, which wraps `asyncio.create_subprocess_exec` with `asyncio.wait_for`. On timeout, the child process is killed. No `subprocess.run` / `subprocess.Popen` anywhere in the module — hazard #7 clean (`! grep -n 'subprocess.run\|subprocess\.Popen' pi-sidecar/sidecar.py` only hits a docstring mention).

### 3. SSE subscriber `_calibration_sse_loop()` (CAL-PI-01, D-04/D-08)

- Opens `GET /api/signage/player/stream` via `httpx_sse.aconnect_sse` with `Authorization: Bearer <_device_token>` — the same token the player uses (D-04 reuse; no new persistence).
- On each `ServerSentEvent`: `sse.json()` → if `event == "calibration-changed"`, fetches `GET /api/signage/player/calibration` (D-08 — payload is device_id only, sidecar refetches full state) and calls `_apply_calibration(r.json())`.
- Guards: `if not token or not base or not _online: await asyncio.sleep(5); continue`. On any `httpx.HTTPError` / disconnect: log + `asyncio.sleep(5)` + retry (same posture as `_playlist_refresh_loop`).

### 4. Lifespan extension

Boot sequence (before any background task spawn):
```
_ensure_dirs()
load device_token, playlist, media-ids
_audio_backend = _detect_audio_backend()
wayland_ready = await _wait_for_wayland_socket(timeout=15.0)
if wayland_ready:
    await _replay_persisted_calibration()   # applies BEFORE network probe
# now spawn: connectivity_probe, playlist_refresh, heartbeat, calibration_sse
```

Shutdown: cancels the new `calibration_task` alongside the existing three and awaits all four.

### 5. Heartbeat body extension (D-09)

`_heartbeat_loop` now conditionally adds `calibration_last_error` and `calibration_last_applied_at` to the POST body when non-null. No new endpoint; admin UI reads these fields off the existing heartbeat path (backend work pending in a future plan — not in scope here).

### 6. Infra files

- `pi-sidecar/requirements.txt`: `+httpx-sse==0.4.1`.
- `scripts/lib/signage-packages.txt`: `+wlr-randr`, `+wireplumber`, `+pulseaudio-utils`.
- `scripts/systemd/signage-sidecar.service`:
  - `[Unit]` gains `After=labwc.service` + `Requires=labwc.service`.
  - `[Service]` gains `Environment=XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__` + `Environment=WAYLAND_DISPLAY=wayland-0`. `__SIGNAGE_UID__` is already substituted by `deploy_systemd_units` in `scripts/lib/signage-install.sh` — no installer change needed.

## Pytest Coverage (17 tests, all passing)

```
tests/test_calibration.py::TestCalibrationPersistence::test_calibration_persistence_roundtrip PASSED
tests/test_calibration.py::TestCalibrationPersistence::test_load_calibration_returns_none_when_absent PASSED
tests/test_calibration.py::TestCalibrationPersistence::test_load_calibration_returns_none_on_corrupt_file PASSED
tests/test_calibration.py::TestAudioBackendDetect::test_detect_audio_backend_prefers_wpctl PASSED
tests/test_calibration.py::TestAudioBackendDetect::test_detect_audio_backend_falls_back_to_pactl PASSED
tests/test_calibration.py::TestAudioBackendDetect::test_detect_audio_backend_none_when_neither_available PASSED
tests/test_calibration.py::TestApplyCalibration::test_apply_calibration_rotation_invokes_wlr_randr_transform PASSED
tests/test_calibration.py::TestApplyCalibration::test_apply_calibration_hdmi_mode_invokes_wlr_randr_mode PASSED
tests/test_calibration.py::TestApplyCalibration::test_apply_calibration_audio_wpctl_preferred PASSED
tests/test_calibration.py::TestApplyCalibration::test_apply_calibration_audio_pactl_fallback PASSED
tests/test_calibration.py::TestApplyCalibration::test_apply_calibration_subprocess_failure_records_error_no_retry PASSED
tests/test_calibration.py::TestApplyCalibration::test_apply_calibration_persists_on_success PASSED
tests/test_calibration.py::TestWaylandSocketWait::test_wait_for_wayland_socket_returns_true_when_present PASSED
tests/test_calibration.py::TestWaylandSocketWait::test_wait_for_wayland_socket_returns_false_on_timeout PASSED
tests/test_calibration.py::TestWaylandSocketWait::test_replay_skipped_when_wayland_unavailable PASSED
tests/test_calibration.py::TestBootReplayOrdering::test_replay_on_boot_runs_before_connectivity_probe PASSED
tests/test_calibration.py::TestSseCalibrationLoop::test_sse_loop_calibration_changed_triggers_fetch_and_apply PASSED
```

Full pi-sidecar suite: **38 passed** (17 new + 21 existing Phase 48 tests — no regressions).

## Requirements Traceability

| Req ID    | Covered by                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| CAL-PI-01 | `_calibration_sse_loop` + `test_sse_loop_calibration_changed_triggers_fetch_and_apply` (D-04 JWT reuse, D-08 refetch) |
| CAL-PI-02 | `_apply_calibration` rotation branch + `test_apply_calibration_rotation_invokes_wlr_randr_transform`                  |
| CAL-PI-03 | `_apply_calibration` hdmi_mode branch + `test_apply_calibration_hdmi_mode_invokes_wlr_randr_mode` + heartbeat error surface (D-09) |
| CAL-PI-04 | `_apply_calibration` audio branch + `test_apply_calibration_audio_wpctl_preferred` + `..._audio_pactl_fallback`       |
| CAL-PI-05 | `_save_calibration` + `_load_calibration` + `_replay_persisted_calibration` + `test_calibration_persistence_roundtrip` + `test_replay_on_boot_runs_before_connectivity_probe` |

## Verification Gate

```
$ grep -q "wlr-randr" scripts/lib/signage-packages.txt         # ✓
$ grep -q "wireplumber" scripts/lib/signage-packages.txt       # ✓
$ grep -q "pulseaudio-utils" scripts/lib/signage-packages.txt  # ✓
$ grep -q "WAYLAND_DISPLAY" scripts/systemd/signage-sidecar.service    # ✓
$ grep -q "XDG_RUNTIME_DIR" scripts/systemd/signage-sidecar.service    # ✓
$ grep -qE "^After=labwc.service" scripts/systemd/signage-sidecar.service    # ✓
$ grep -qE "^Requires=labwc.service" scripts/systemd/signage-sidecar.service # ✓
$ grep -q "httpx-sse" pi-sidecar/requirements.txt              # ✓
$ grep -q "_wait_for_wayland_socket" pi-sidecar/sidecar.py     # ✓
$ ! grep -nE 'subprocess\.run|subprocess\.Popen' pi-sidecar/sidecar.py
   (only hits a docstring mention — no actual sync subprocess call)  # ✓
```

## Deviations from Plan

None. Executed exactly as written. TDD cycle: RED commit of 17-test file → GREEN commit with sidecar implementation. Both Task 1 (infra) and Task 2 (sidecar.py logic) landed cleanly.

### Minor note (not a deviation)

Plan suggested creating a `pi-sidecar/requirements-dev.txt` for `pytest==8.x` + `pytest-asyncio`. The existing `pi-sidecar/.venv` already has `pytest==8.4.2`; the new tests use `asyncio.run()` directly (no pytest-asyncio fixture needed) because the module functions under test are `async def` and testable via a single-shot loop. Net: **no dev-requirements file added** — the test file is self-contained via `asyncio.run` + `unittest.mock`.

## Downstream Hand-off

- **62-04 (player + real-Pi E2E):**
  - Real-Pi smoke must confirm: `wlr-randr --json` parses correctly on the labwc 1.16 build, audio backend lands on `wpctl` (not `pactl`), `XDG_RUNTIME_DIR` + `WAYLAND_DISPLAY` reach wlr-randr from the sidecar uid.
  - The Wayland-socket bounded wait should normally return `True` within the first 200–400 ms since `Requires=labwc.service` ensures labwc has *started* before the sidecar; the timeout exists as a safety net, not a hot path.
  - Heartbeat body now carries `calibration_last_error` / `calibration_last_applied_at` fields — backend persistence of these (for admin-UI surfacing) is a future-plan concern, not in scope here.
  - Player-side `<video muted>` flip (CAL-PI-06) remains for 62-04.

## Self-Check

- FOUND: pi-sidecar/sidecar.py (modified — +293 lines in the feat commit)
- FOUND: pi-sidecar/tests/test_calibration.py (407 lines; 17 tests)
- FOUND: pi-sidecar/requirements.txt (httpx-sse==0.4.1 pinned)
- FOUND: scripts/lib/signage-packages.txt (wlr-randr, wireplumber, pulseaudio-utils)
- FOUND: scripts/systemd/signage-sidecar.service (After/Requires=labwc.service + XDG_RUNTIME_DIR + WAYLAND_DISPLAY)
- FOUND: commit e5a762d (RED — failing tests)
- FOUND: commit 29a5257 (Task 1 infra)
- FOUND: commit 95b3785 (Task 2 sidecar logic)
- FOUND: 38/38 pytests passing (17 new + 21 existing)
- FOUND: 0 uses of subprocess.run / subprocess.Popen in sidecar.py (hazard #7 clean)

## Self-Check: PASSED
