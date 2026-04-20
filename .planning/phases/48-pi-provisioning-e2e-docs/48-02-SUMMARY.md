---
phase: 48-pi-provisioning-e2e-docs
plan: 02
subsystem: pi-provisioning
tags: [bash, systemd, raspberry-pi, kiosk, chromium, wayland, labwc]
dependency_graph:
  requires: []
  provides: [scripts/provision-pi.sh, scripts/systemd/signage-sidecar.service, scripts/systemd/signage-player.service, scripts/systemd/labwc.service, scripts/README-pi.md]
  affects: [48-05-e2e-walkthrough]
tech_stack:
  added: []
  patterns: [idempotent-bash-bootstrap, systemd-user-service, sed-token-substitution]
key_files:
  created:
    - scripts/provision-pi.sh
    - scripts/systemd/signage-sidecar.service
    - scripts/systemd/signage-player.service
    - scripts/systemd/labwc.service
    - scripts/README-pi.md
  modified: []
decisions:
  - "Static systemd units with __SIGNAGE_API_URL__ / __SIGNAGE_UID__ token substitution chosen over template units (%i) — simpler provision script, cleaner journalctl -u names, resolves Open Question 1 from RESEARCH §12"
  - "Sidecar venv path: /opt/signage/pi-sidecar/.venv (matches Plan 48-01 pi-sidecar/ directory) — not /opt/signage/sidecar/ from RESEARCH §7 draft outline"
  - "Pi 3B Wayland block (Step 9) implemented as best-effort with warn-only fallback — LOW confidence per research"
metrics:
  duration: 211s
  completed_date: "2026-04-20"
  tasks_completed: 3
  files_created: 5
  files_modified: 0
---

# Phase 48 Plan 02: Provisioning Script + Systemd Units Summary

**One-liner:** Idempotent `provision-pi.sh` bash bootstrap (10 steps, 5 exit codes) + three verbatim systemd user unit templates for labwc / sidecar / Chromium kiosk with `__SIGNAGE_API_URL__` + `__SIGNAGE_UID__` placeholder substitution.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Drop three systemd unit templates VERBATIM from RESEARCH §4 | `8614bea` | `scripts/systemd/signage-sidecar.service`, `signage-player.service`, `labwc.service` |
| 2 | Write scripts/provision-pi.sh — idempotent bootstrap per RESEARCH §7 | `1b6f42e` | `scripts/provision-pi.sh` |
| 3 | Write scripts/README-pi.md — operator quickstart | `8eca5da` | `scripts/README-pi.md` |

---

## Verification Status

- `bash -n scripts/provision-pi.sh` — PASS
- `shellcheck` — NOT INSTALLED on dev machine; script passes `bash -n` and visual audit. Annotate for E2E plan.
- All 20 automated unit/script checks from PLAN.md — PASS
- NOT executed on real Pi hardware — execution is Plan 48-05's scope

---

## Systemd Unit Content Fidelity

### signage-sidecar.service
Verbatim from RESEARCH §4.1 with the following intentional substitutions:
- `ExecStart` path updated from `/opt/signage/sidecar/bin/uvicorn` to `/opt/signage/pi-sidecar/.venv/bin/uvicorn` and `WorkingDirectory` to `/opt/signage/pi-sidecar` — aligns with Plan 48-01's `pi-sidecar/` directory name.
- `SIGNAGE_API_BASE=http://<api-host>:8000` → `SIGNAGE_API_BASE=http://__SIGNAGE_API_URL__:8000` (placeholder for sed substitution).

Load-bearing lines confirmed present:
- `ReadWritePaths=/var/lib/signage` ✓
- `PrivateTmp=yes` ✓
- `ProtectSystem=strict` ✓
- `--host 127.0.0.1` ✓

### signage-player.service
Verbatim from RESEARCH §4.2 with the following intentional substitutions:
- `--app=http://%i/player/` → `--app=http://__SIGNAGE_API_URL__/player/` — static unit strategy (Open Question 1 resolution: static unit + sed over template unit `%i`).
- `XDG_RUNTIME_DIR=/run/user/1001` → `XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__` (Pitfall 4).

Load-bearing lines confirmed present:
- `ExecStartPre=/bin/bash -c 'while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; do sleep 1; done'` ✓
- Full SGN-OPS-03 Chromium flag string: `--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --ozone-platform=wayland` ✓
- `--ozone-platform=wayland` ✓
- `Requires=signage-sidecar.service` ✓

### labwc.service
Verbatim from RESEARCH §4.3 with:
- `XDG_RUNTIME_DIR=/run/user/1001` → `XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__` (Pitfall 4).

Load-bearing lines confirmed present:
- `ExecStart=/usr/bin/labwc` ✓

---

## Pitfall Compliance

| Pitfall | Description | Status |
|---------|-------------|--------|
| Pitfall 1 | `unclutter-xfixes` not `unclutter` | ADDRESSED — `unclutter-xfixes` in apt list |
| Pitfall 2 | `chromium-browser` from RPi archive; check `raspi.list` | ADDRESSED — Step 0.5 exits 2 if missing |
| Pitfall 3 | Wayland socket race — `ExecStartPre` guard loop | ADDRESSED — verbatim in signage-player.service |
| Pitfall 4 | `XDG_RUNTIME_DIR` must use actual UID | ADDRESSED — `SIGNAGE_UID=$(id -u signage)` at provision time |
| Pitfall 6 | `ProtectSystem=strict` blocks runtime `.pyc` writes | ADDRESSED — Step 5.5 `python -m compileall` |
| Pitfall 7 | `loginctl enable-linger` needs systemd 219+ | ADDRESSED — Step 0 version check |
| Pitfall 8 | Do not assume `pi` user exists | ADDRESSED — all references use `signage` user |
| Pitfall 10 | `signage` in `video,audio,render,input` groups | ADDRESSED — `useradd -G video,audio,render,input` + `usermod -aG` on re-run |

---

## Deviations from Plan

### Deviation 1 — Sidecar venv path updated to match Plan 48-01

**Rule:** Rule 2 (auto-add missing critical functionality / alignment)
**Found during:** Task 2
**Issue:** RESEARCH §7 Step 5 references `/opt/signage/sidecar/bin/uvicorn` and `WorkingDirectory=/opt/signage/sidecar`. Plan 48-01's plan specifies the sidecar lives at `pi-sidecar/` (per the plan's file listing). Using the §7 path would cause the unit file to reference a non-existent binary.
**Fix:** Changed ExecStart path to `/opt/signage/pi-sidecar/.venv/bin/uvicorn` and WorkingDirectory to `/opt/signage/pi-sidecar` in `signage-sidecar.service`. The provision script's Step 5 venv creation path updated to match.
**Files modified:** `scripts/systemd/signage-sidecar.service`, `scripts/provision-pi.sh`
**Commit:** `1b6f42e` (Task 2 commit includes this alignment)

---

## Known Stubs

None — all script steps are fully implemented. The venv/pip step gracefully warns if `pi-sidecar/requirements.txt` (written by Plan 48-01) is not yet present and falls back to inline package versions from RESEARCH §1.

---

## Flags for Plan 48-05 (E2E)

- `shellcheck` was not available on the dev machine. Run `shellcheck scripts/provision-pi.sh` on the Pi (it is available via `apt install shellcheck`) before accepting the walkthrough as complete.
- Step 9 (Pi 3B Wayland force via `raspi-config nonint do_wayland W2`) is LOW confidence — validate on real Pi 3B hardware. If it fails, document the workaround in E2E results.
- Real-hardware execution will confirm whether `XDG_RUNTIME_DIR` is created automatically at linger-enable time or requires the explicit `mkdir` in Step 8 of the script. The script includes both for safety.

## Self-Check: PASSED

Files confirmed on disk:
- scripts/provision-pi.sh ✓ (executable)
- scripts/systemd/signage-sidecar.service ✓
- scripts/systemd/signage-player.service ✓
- scripts/systemd/labwc.service ✓
- scripts/README-pi.md ✓

Commits confirmed:
- 8614bea ✓ (Task 1 — systemd units)
- 1b6f42e ✓ (Task 2 — provision-pi.sh)
- 8eca5da ✓ (Task 3 — README-pi.md)
