---
phase: 62-signage-calibration
plan: 03
type: execute
wave: 2
depends_on:
  - 62-signage-calibration-01
files_modified:
  - pi-sidecar/requirements.txt
  - pi-sidecar/sidecar.py
  - pi-sidecar/test_calibration.py
  - scripts/lib/signage-packages.txt
  - scripts/systemd/signage-sidecar.service
autonomous: true
requirements:
  - CAL-PI-01
  - CAL-PI-02
  - CAL-PI-03
  - CAL-PI-04
  - CAL-PI-05
must_haves:
  truths:
    - "Sidecar subscribes to /api/signage/player/stream using the existing device JWT"
    - "On calibration-changed SSE event, sidecar fetches GET /api/signage/player/calibration and applies it"
    - "Rotation applied via wlr-randr --output <name> --transform <0|90|180|270>"
    - "HDMI mode applied via wlr-randr --output <name> --mode <WxH@Hz>; errors reported in heartbeat body"
    - "Audio applied via wpctl set-mute @DEFAULT_AUDIO_SINK@ with pactl fallback"
    - "Last-applied state persisted to /var/lib/signage/calibration.json and replayed on boot BEFORE network probe"
  artifacts:
    - path: "pi-sidecar/sidecar.py"
      provides: "SSE listener + calibration apply loop + persist/replay"
      contains: "calibration-changed"
    - path: "pi-sidecar/requirements.txt"
      provides: "httpx-sse or equivalent pinned dependency for SSE"
      contains: "httpx-sse"
    - path: "scripts/lib/signage-packages.txt"
      provides: "wlr-randr, wireplumber, pulseaudio-utils apt packages"
      contains: "wlr-randr"
    - path: "scripts/systemd/signage-sidecar.service"
      provides: "XDG_RUNTIME_DIR + WAYLAND_DISPLAY env passthrough for wlr-randr + wpctl"
      contains: "WAYLAND_DISPLAY"
  key_links:
    - from: "sidecar.py _calibration_sse_loop"
      to: "EventSource /api/signage/player/stream via httpx-sse"
      via: "Authorization: Bearer <device JWT> + aconnect_sse (D-04 D-10 same token player uses)"
      pattern: "calibration-changed"
    - from: "_apply_calibration"
      to: "asyncio.create_subprocess_exec('wlr-randr', ...) + ('wpctl', ...)"
      via: "async subprocess (NO sync subprocess.run per cross-cutting hazard #7)"
      pattern: "create_subprocess_exec.*wlr-randr"
    - from: "_apply_calibration success"
      to: "/var/lib/signage/calibration.json via _write_secure 0o600"
      via: "atomic replace (write .tmp → os.rename); reuses _write_secure helper (sidecar.py line 79)"
      pattern: "calibration.json"
    - from: "sidecar lifespan startup"
      to: "_replay_persisted_calibration BEFORE _connectivity_probe_loop task spawn"
      via: "D-06 replay on boot before network is up"
      pattern: "replay.*calibration"
---

<objective>
Extend the Pi sidecar (`pi-sidecar/sidecar.py`, currently 476 LOC) to be an SSE subscriber in addition to a cache proxy. On `calibration-changed` events it fetches the full calibration state from the backend and applies it live via `wlr-randr` (rotation + HDMI mode per D-01/D-02) and `wpctl` with `pactl` fallback (audio per D-03). Last applied state is persisted to `/var/lib/signage/calibration.json` and replayed on boot BEFORE the network probe runs (D-06), so the display comes up correctly even on offline boot.

Purpose: Make the per-device calibration actually take effect on the Pi, live, without SSH or reboot.

Output: One extended sidecar file + one new dep + 3 new apt packages + systemd unit env passthrough + unit tests covering the apply logic.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/62-signage-calibration/62-CONTEXT.md
@.planning/phases/62-signage-calibration/62-01-SUMMARY.md

<interfaces>
From pi-sidecar/sidecar.py (lines 139-291) — existing asyncio loop + lifespan pattern to extend:

```python
# Three existing background tasks (lines 139-228):
async def _connectivity_probe_loop() -> None: ...   # 10s probe of /api/health
async def _playlist_refresh_loop() -> None: ...     # 30s ETag-aware playlist poll
async def _heartbeat_loop() -> None: ...            # 60s POST /heartbeat

# Lifespan (lines 254-291) spawns all three as asyncio.create_task on startup,
# cancels on shutdown. This is where the NEW _calibration_sse_loop attaches.

# Disk helpers already parameterized to _cache_dir() (lines 64-84):
def _write_secure(path: Path, data: bytes | str) -> None:  # 0o600
def _ensure_dirs() -> None:
```

From backend contract (delivered by 62-01):
- SSE event on `/api/signage/player/stream`: `data: {"event": "calibration-changed", "device_id": "<uuid>"}` (D-08 — device_id only; no inline calibration state).
- Fetch full state: `GET /api/signage/player/calibration` → `{"rotation": 0|90|180|270, "hdmi_mode": "1920x1080@60" | null, "audio_enabled": true|false}`.
- Both use Bearer `<device JWT>` (the same token persisted at `/var/lib/signage/device_token` from Phase 48 — D-04 reuse).

From pi-sidecar/requirements.txt (line 1-3):
```
fastapi==0.115.12
uvicorn==0.34.0
httpx==0.28.1
```
httpx does NOT ship SSE client support. Add `httpx-sse==0.4.1` (or current pin at time of execution — `pip index versions httpx-sse` to confirm).

From scripts/lib/signage-packages.txt — needs +3 packages: `wlr-randr`, `wireplumber`, `pulseaudio-utils`. `wlr-randr` provides rotation+mode CLI; `wireplumber` ships `wpctl`; `pulseaudio-utils` ships `pactl` fallback.

From scripts/systemd/signage-sidecar.service — currently sets `SIGNAGE_API_BASE` and `SIGNAGE_CACHE_DIR`. Needs `XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__` and `WAYLAND_DISPLAY=wayland-0` so wlr-randr and wpctl can talk to the user's labwc compositor and wireplumber instance. Without these the CLIs emit `failed to connect to compositor`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dependencies + packages + systemd env + persisted-state helpers</name>
  <files>pi-sidecar/requirements.txt, scripts/lib/signage-packages.txt, scripts/systemd/signage-sidecar.service, pi-sidecar/sidecar.py</files>
  <behavior>
    - `pi-sidecar/requirements.txt` pins `httpx-sse==0.4.1` (or latest — confirm via pip before commit).
    - `scripts/lib/signage-packages.txt` gains three lines: `wlr-randr`, `wireplumber`, `pulseaudio-utils`.
    - `scripts/systemd/signage-sidecar.service` gains two `Environment=` lines:
      - `Environment=XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__`
      - `Environment=WAYLAND_DISPLAY=wayland-0`
      The `__SIGNAGE_UID__` placeholder is already substituted by `deploy_systemd_units` in scripts/lib/signage-install.sh (line 99) — no installer change needed. Confirm via the existing sed substitution contract.
    - In sidecar.py add module-level constants `_CALIBRATION_FILE = "calibration.json"` and helpers `_load_calibration() -> dict | None` / `_save_calibration(cal: dict) -> None` that use `_write_secure` + `_cache_dir()` mirroring the existing playlist-cache helpers (lines 94-106).
    - Add a `_calibration_last_error: str | None = None` module-level state variable — surfaced in heartbeat body per D-09.
    - Add `_detect_audio_backend() -> Literal["wpctl", "pactl", None]` helper — called once at startup, pinned for process lifetime (D-03 decision). Uses `shutil.which("wpctl")` then `shutil.which("pactl")`.
    - `_heartbeat_loop` (lines 209-228) extended: body now includes `calibration_last_error` and `calibration_last_applied_at` (ISO 8601 UTC) when non-null. Reuses existing heartbeat endpoint — no new endpoint per D-09.
  </behavior>
  <action>
    1. Append `httpx-sse==0.4.1` to pi-sidecar/requirements.txt (confirm version is current via `pip index versions httpx-sse`).

    2. Append `wlr-randr`, `wireplumber`, `pulseaudio-utils` to scripts/lib/signage-packages.txt (one per line, following existing format — no comment lines).

    3. In scripts/systemd/signage-sidecar.service, in the `[Service]` block after the existing `Environment=` lines, add:
       ```
       Environment=XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__
       Environment=WAYLAND_DISPLAY=wayland-0
       ```

    4. In pi-sidecar/sidecar.py:
       - Add import: `import shutil`, `from datetime import datetime, timezone`.
       - After the playlist helpers (line ~113) add `_CALIBRATION_FILE = "calibration.json"` and:
         ```python
         def _load_calibration() -> dict | None:
             path = _cache_dir() / _CALIBRATION_FILE
             if not path.exists():
                 return None
             try:
                 return json.loads(path.read_text())
             except (json.JSONDecodeError, OSError) as exc:
                 logger.warning("Failed to load persisted calibration: %s", exc)
                 return None

         def _save_calibration(cal: dict) -> None:
             _write_secure(_cache_dir() / _CALIBRATION_FILE, json.dumps(cal))
         ```
         (move the already-local `import json as _json` calls to a module-level `import json` if not already present.)
       - Add module state: `_calibration_last_error: Optional[str] = None`, `_calibration_last_applied_at: Optional[str] = None`, `_audio_backend: Optional[str] = None`.
       - Add `def _detect_audio_backend() -> Optional[str]: ...` using `shutil.which("wpctl")` / `shutil.which("pactl")`.
       - In `_heartbeat_loop` body JSON, include the two new fields when non-null.

    5. Tests: create pi-sidecar/test_calibration.py with RED-first test `test_calibration_persistence_roundtrip` using tmp_path + `SIGNAGE_CACHE_DIR` env override — writes a dict, reads it back, asserts shape + 0o600 mode via `os.stat().st_mode & 0o777`.
  </action>
  <verify>
    <automated>cd pi-sidecar && python -m pytest test_calibration.py::test_calibration_persistence_roundtrip -x && grep -q "wlr-randr" ../scripts/lib/signage-packages.txt && grep -q "WAYLAND_DISPLAY" ../scripts/systemd/signage-sidecar.service</automated>
  </verify>
  <done>httpx-sse pinned; three apt packages added; systemd unit carries XDG_RUNTIME_DIR + WAYLAND_DISPLAY; calibration persistence helpers exist with 0o600 mode; heartbeat body extension wired.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SSE listener + calibration apply (wlr-randr + wpctl/pactl) + boot replay</name>
  <files>pi-sidecar/sidecar.py, pi-sidecar/test_calibration.py</files>
  <behavior>
    - New coroutine `_apply_calibration(cal: dict) -> None`:
      - Discovers output name via `wlr-randr --json` (parse JSON, pick first enabled output; cache on first success in module state `_wlr_output_name`).
      - If `cal.get("rotation")` in {0, 90, 180, 270}: runs `wlr-randr --output <name> --transform <N>` via `asyncio.create_subprocess_exec` with a 5s timeout. (CAL-PI-02, D-01)
      - If `cal.get("hdmi_mode")`: runs `wlr-randr --output <name> --mode <mode>` (CAL-PI-03, D-02).
      - If `cal.get("audio_enabled") is not None`: runs `wpctl set-mute @DEFAULT_AUDIO_SINK@ <0|1>` when `_audio_backend == "wpctl"`, else `pactl set-sink-mute @DEFAULT_SINK@ <0|1>`. `audio_enabled=True → mute=0`. (CAL-PI-04, D-03)
      - On any subprocess non-zero exit or timeout: set `_calibration_last_error = "<which cmd>: <stderr>"`. Do NOT retry (D-09 — wait for next event).
      - On success: `_save_calibration(cal)`, `_calibration_last_applied_at = datetime.now(timezone.utc).isoformat()`, clear `_calibration_last_error = None`.
      - ALL subprocess calls use `asyncio.create_subprocess_exec` — NEVER `subprocess.run` (cross-cutting hazard #7).
    - New coroutine `_calibration_sse_loop() -> None`:
      - While alive: if token and online, open SSE stream via `httpx_sse.aconnect_sse` with `Authorization: Bearer <_device_token>` — same token player uses (D-04).
      - For each `ServerSentEvent`: parse JSON; if `event == "calibration-changed"`: fetch `GET /api/signage/player/calibration` with the same auth header, then call `_apply_calibration(response.json())`.
      - On any `httpx.*Error` or disconnect: log, sleep 5s, retry (matches the `_playlist_refresh_loop` resilience posture).
    - Lifespan startup (lines 254-280) extended:
      - BEFORE spawning the three existing tasks, call a NEW synchronous-in-async helper `await _replay_persisted_calibration()` that:
        - Reads `_load_calibration()`. If present, `await _apply_calibration(cal)` — this runs before `_connectivity_probe_loop` even starts, satisfying D-06 "replay on boot BEFORE network is up".
        - At this point `_audio_backend` is already pinned (`_detect_audio_backend()` called as module-level side effect or in lifespan before replay).
      - Then spawn the existing three tasks PLUS a new `asyncio.create_task(_calibration_sse_loop())`.
      - On shutdown: cancel + await the new task just like the existing three.
    - Tests (all with monkeypatched `asyncio.create_subprocess_exec` so no real wlr-randr runs in CI):
      - `test_apply_calibration_rotation_invokes_wlr_randr_transform` — asserts `wlr-randr --output ... --transform 90` argv shape.
      - `test_apply_calibration_hdmi_mode_invokes_wlr_randr_mode` — asserts `--mode 1920x1080@60` argv.
      - `test_apply_calibration_audio_wpctl_preferred` — `_audio_backend="wpctl"` → `wpctl set-mute @DEFAULT_AUDIO_SINK@ 0` (audio_enabled=True).
      - `test_apply_calibration_audio_pactl_fallback` — `_audio_backend="pactl"` → `pactl set-sink-mute @DEFAULT_SINK@ 1` (audio_enabled=False).
      - `test_apply_calibration_subprocess_failure_records_error_no_retry` — monkeypatch subprocess to return returncode=2; assert `_calibration_last_error` set and function did NOT re-invoke on its own (D-09).
      - `test_replay_on_boot_runs_before_connectivity_probe` — patch `_load_calibration` to return a dict; use `asyncio.sleep(0)` ordering to assert `_apply_calibration` was called BEFORE any `httpx.AsyncClient.get` to `/api/health` (D-06).
      - `test_sse_loop_calibration_changed_triggers_fetch_and_apply` — monkeypatch `httpx_sse.aconnect_sse` to yield a single `ServerSentEvent(data=json.dumps({"event": "calibration-changed", "device_id": "..."}))`; monkeypatch `httpx.AsyncClient.get("/calibration")` to return a payload; assert `_apply_calibration` called with that payload.
  </behavior>
  <action>
    1. In pi-sidecar/sidecar.py add the imports: `import shutil`, `from httpx_sse import aconnect_sse`, `from datetime import datetime, timezone`.

    2. Implement `_apply_calibration`, `_calibration_sse_loop`, `_replay_persisted_calibration`, and `_detect_audio_backend` per behavior spec. Keep them near the existing background-task block (lines 139-247) for consistency.

    3. Extend the `lifespan` (lines 254-291):
       - After `_ensure_dirs()`:
         - `_audio_backend = _detect_audio_backend()`
         - `await _replay_persisted_calibration()` — before any background task spawn (D-06).
       - In the background task block, add `calibration_task = asyncio.create_task(_calibration_sse_loop())`.
       - In the shutdown block, cancel + await `calibration_task` alongside the existing three.

    4. Extend `_heartbeat_loop`'s body dict with the two new calibration error/timestamp fields (from Task 1 scaffolding).

    5. Write all 7 tests in pi-sidecar/test_calibration.py. Use `unittest.mock` + `pytest-asyncio` patterns. If pytest-asyncio not pinned, add `pytest==8.x` and `pytest-asyncio==0.24.x` to a new `pi-sidecar/requirements-dev.txt` (do NOT pollute runtime requirements.txt).
  </action>
  <verify>
    <automated>cd pi-sidecar && python -m pytest test_calibration.py -x -v</automated>
  </verify>
  <done>All 7+ tests green. `_apply_calibration` uses only `asyncio.create_subprocess_exec` (no sync subprocess). Rotation/mode/audio each have a dedicated test asserting exact argv. D-06 replay ordering asserted. D-09 no-retry asserted. Both wpctl and pactl paths covered.</done>
</task>

</tasks>

<verification>
```
cd pi-sidecar && python -m pytest -x -v
grep -q "wlr-randr" scripts/lib/signage-packages.txt
grep -q "wireplumber" scripts/lib/signage-packages.txt
grep -q "pulseaudio-utils" scripts/lib/signage-packages.txt
grep -q "WAYLAND_DISPLAY" scripts/systemd/signage-sidecar.service
grep -q "XDG_RUNTIME_DIR" scripts/systemd/signage-sidecar.service
grep -q "httpx-sse" pi-sidecar/requirements.txt
# Enforce cross-cutting hazard #7 — no sync subprocess in signage modules:
! grep -n "subprocess.run\|subprocess\.Popen" pi-sidecar/sidecar.py
```

Real-Pi smoke is deferred to 62-04 (the real-hardware checkpoint). Here we only assert unit-level contracts.
</verification>

<success_criteria>
- CAL-PI-01: `_calibration_sse_loop` connects to `/api/signage/player/stream` with device JWT and handles `calibration-changed` events (D-04 reuse).
- CAL-PI-02: rotation via `wlr-randr --output <n> --transform <N>` (D-01).
- CAL-PI-03: HDMI mode via `wlr-randr --output <n> --mode <mode>`; errors surfaced via heartbeat body (D-09, no new endpoint).
- CAL-PI-04: audio via `wpctl` preferred, `pactl` fallback (D-03), backend pinned at startup.
- CAL-PI-05: persist to `/var/lib/signage/calibration.json` (mode 0600); replay on boot BEFORE network probe (D-06).
- All subprocess calls async (hazard #7).
- systemd unit carries `XDG_RUNTIME_DIR` + `WAYLAND_DISPLAY` so wlr-randr/wpctl can reach compositor + wireplumber.
- Three apt packages added to shared installer SSOT.
</success_criteria>

<output>
After completion, create `.planning/phases/62-signage-calibration/62-03-SUMMARY.md` covering:
- Final httpx-sse version pinned
- Output-discovery strategy (first enabled output from `wlr-randr --json`)
- Audio-backend pinning result on dev machine (wpctl vs pactl)
- Any observations that will affect the 62-04 real-Pi E2E
</output>
