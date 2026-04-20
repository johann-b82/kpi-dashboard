---
phase: 49-pi-image-build
plan: "01"
subsystem: pi-image
tags: [pi-gen, arm64, installer-library, shell, image-build, signage]
dependency_graph:
  requires: []
  provides: [scripts/lib/signage-install.sh, scripts/lib/signage-packages.txt, pi-image/config, pi-image/stage-signage/*]
  affects: [scripts/provision-pi.sh, pi-sidecar/]
tech_stack:
  added: [pi-gen (git submodule arm64 branch), bash library pattern]
  patterns: [shared installer library with SIGNAGE_BUILD_CONTEXT flag, single-source-of-truth package list]
key_files:
  created:
    - scripts/lib/signage-install.sh
    - scripts/lib/signage-packages.txt
    - pi-image/config
    - pi-image/stage2/SKIP_IMAGES
    - pi-image/stage-signage/EXPORT_IMAGE
    - pi-image/stage-signage/00-packages-nr
    - pi-image/stage-signage/prerun.sh
    - pi-image/stage-signage/01-run-chroot.sh
    - pi-image/stage-signage/signage.conf.template
    - pi-image/.gitignore
    - pi-image/Makefile
    - pi-image/README.md
    - scripts/check-package-list-parity.sh
    - .planning/phases/49-pi-image-build/49-01-BUILD-LOG.md
  modified:
    - scripts/provision-pi.sh
    - .gitmodules
decisions:
  - "Package SSOT: scripts/lib/signage-packages.txt committed as canonical list; 00-packages-nr is a committed copy with CI drift-check (scripts/check-package-list-parity.sh)"
  - "pi-gen vendored as git submodule at pi-image/pi-gen, pinned to arm64 branch SHA 4ad56cc850fa60adcc7f07dc15879bc95cc1d281"
  - "enable_linger_signage branches on SIGNAGE_BUILD_CONTEXT=chroot: file touch vs loginctl (RESEARCH Unknown 6)"
  - "Smoke build deferred to Plan 49-03: macOS Docker Desktop incompatible with pi-gen privileged loop devices; ~12GB free vs 15GB required"
metrics:
  duration: "303 seconds (~5 min)"
  completed: 2026-04-20
  tasks: 3
  files: 15
---

# Phase 49 Plan 01: Pi-gen Pipeline + Installer-Library Refactor Summary

**One-liner:** Shared 7-function installer library (signage-install.sh) with SIGNAGE_BUILD_CONTEXT flag enables byte-identical filesystem state between runtime provision and pi-gen chroot build, backed by a single-source-of-truth package list and git-submodule pi-gen on arm64 branch.

## What Was Built

### Task 1: Installer Library + provision-pi.sh Refactor

- **`scripts/lib/signage-packages.txt`** — 14-package SSOT list (one per line). Both the installer library and `00-packages-nr` derive from it.
- **`scripts/lib/signage-install.sh`** — 7-function shared library:
  - `install_signage_packages()` — reads packages from signage-packages.txt via `mapfile`, calls `apt-get install --no-install-recommends`
  - `create_signage_user()` — idempotent `useradd`/`usermod`, creates `.config/systemd/user/` tree
  - `create_signage_directories()` — `/var/lib/signage/` (0700), `/var/lib/signage/media/` (0700), `/opt/signage/` (0755)
  - `deploy_systemd_units()` — copies `.service` templates with sed substitution; branches `unit_src_dir` on `SIGNAGE_BUILD_CONTEXT`
  - `setup_sidecar_venv()` — creates `.venv`, installs from requirements.txt, pre-compiles bytecode for `ProtectSystem=strict`
  - `enable_linger_signage()` — **chroot**: `mkdir -p /var/lib/systemd/linger && touch /var/lib/systemd/linger/signage`; **runtime**: `loginctl enable-linger signage`
  - `force_wayland_if_pi3()` — no-op in chroot; calls `raspi-config nonint do_wayland W2` on Pi 3B at runtime
- **`scripts/provision-pi.sh`** — refactored to thin orchestrator: sources library, calls 7 shared functions + 4 runtime-only functions (`preflight_checks`, `setup_repo_at_opt_signage`, `enable_and_start_services`, `print_completion_banner`). Runtime behavior preserved.

### Task 2: pi-image/ Scaffold

- **`pi-image/config`** — IMG_NAME, RELEASE=bookworm, DEPLOY_COMPRESSION=xz, COMPRESSION_LEVEL=9, `STAGE_LIST="stage0 stage1 stage2 stage-signage"`, ENABLE_SSH=0, FIRST_USER_PASS="", DISABLE_FIRST_BOOT_USER_RENAME=1, ENABLE_CLOUD_INIT=1
- **`pi-image/stage2/SKIP_IMAGES`** — empty; suppresses intermediate Lite image export
- **`pi-image/stage-signage/EXPORT_IMAGE`** — empty; triggers final image export
- **`pi-image/stage-signage/00-packages-nr`** — space-separated package list from SSOT; comment notes drift-check
- **`pi-image/stage-signage/prerun.sh`** — host-side; copies library + signage-packages.txt + pi-sidecar source + unit templates into chroot rootfs; includes Plan 49-02 guard for signage-firstboot.service
- **`pi-image/stage-signage/01-run-chroot.sh`** — chroot-side; sets `SIGNAGE_BUILD_CONTEXT=chroot`; verifies chromium-browser + labwc present; calls library functions; includes Plan 49-02 guard for firstboot service symlink
- **`pi-image/stage-signage/signage.conf.template`** — preseed placeholder for `/boot/firmware/signage.conf`
- **`pi-image/.gitignore`** — excludes `pi-gen/work/`, `pi-gen/deploy/`, `*.img*`
- **`pi-image/Makefile`** — `make build/clean/submodule` targets
- **`pi-image/README.md`** — build instructions, arm64 branch rationale (Pitfall 1), known pitfalls (#2 disk, #13 CLEAN=1), preseed reference
- **`scripts/check-package-list-parity.sh`** — CI drift-check; exits 1 if SSOT and 00-packages-nr diverge
- **`.gitmodules`** — registers `pi-image/pi-gen` submodule on arm64 branch; pi-gen cloned and initialized at SHA `4ad56cc850fa60adcc7f07dc15879bc95cc1d281`

### Task 3: Smoke Build — Deferred

Local smoke build deferred to Plan 49-03. See `49-01-BUILD-LOG.md` for full reasoning:
1. Free disk ~12 GB vs 15 GB minimum required
2. macOS Docker Desktop incompatible with pi-gen's privileged loop device + chroot operations (`sudo docker` not accepted by Docker Desktop socket)

All pre-build validations pass: `bash -n` on all stage scripts, drift-check green, submodule on correct branch.

## Library Function Count + Parity Check Status

- **Library functions:** 7 (verbatim from RESEARCH §5)
- **Package SSOT:** `scripts/lib/signage-packages.txt` (14 packages)
- **Drift check:** PASS (`bash scripts/check-package-list-parity.sh` → `OK: package lists in sync.`)

## pi-gen Submodule SHA

- **Remote:** https://github.com/RPi-Distro/pi-gen.git
- **Branch:** arm64
- **Pinned SHA:** `4ad56cc850fa60adcc7f07dc15879bc95cc1d281`
- **Approximate tag:** 2026-04-13-raspios-trixie-arm64-3

## Smoke Build Outcome

**Deferred to Plan 49-03** (Hetzner CAX21 self-hosted runner). See `49-01-BUILD-LOG.md`.

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan Amendments

**1. prerun.sh copies signage-packages.txt into chroot alongside signage-install.sh**

The installer library reads packages via `mapfile < signage-packages.txt` relative to `_LIB_DIR`. When the library is copied into the chroot at `/tmp/lib/`, the packages.txt must accompany it. The RESEARCH skeleton did not show this copy step. Added `cp signage-packages.txt "${ROOTFS}/tmp/lib/"` to prerun.sh.

**2. SCRIPT_DIR default in signage-install.sh**

The library sets `SCRIPT_DIR="${SCRIPT_DIR:-$(cd "${_LIB_DIR}/.." && pwd)}"` so `deploy_systemd_units` can find unit templates in the non-chroot path even if the caller forgets to set SCRIPT_DIR before sourcing. This is a defensive default not in the RESEARCH skeleton.

## Known Stubs

None. All files are fully implemented. `signage-firstboot.service` is referenced but guarded (Plan 49-02 will drop the guards once the service exists).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 6c0c6df | feat(49-01): extract installer library and refactor provision-pi.sh |
| 2 | 62c45d4 | feat(49-01): add pi-image/ pi-gen scaffold + stage-signage |
| 3 | a885740 | chore(49-01): document smoke build deferral to Plan 49-03 runner |
