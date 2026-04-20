# 49-01 Build Log

**Date:** 2026-04-20
**Plan:** 49-01 pi-gen pipeline + installer-library refactor

## Runner Host

| Property | Value |
|----------|-------|
| OS | macOS Darwin 25.3.0 |
| Architecture | arm64 (Apple Silicon) |
| Docker | Docker Desktop 29.3.1 (desktop-linux context) |
| Free disk | ~12 GB |

## Build Status: DEFERRED

The local smoke build was **not executed** in Plan 49-01. Deferral is intentional and covered
by the plan specification (Task 3 action block):

> "If this task cannot run locally (no Docker / no arm64 / no 20 GB disk): Record that in
> 49-01-BUILD-LOG.md and defer the smoke to Plan 49-03 Task 3 (which runs the workflow on the
> Hetzner CAX21 runner). Plan 49-01 is still considered complete when Tasks 1 and 2 are done
> and drift-check is green — the smoke build can be deferred to the runner."

### Reasons for deferral

1. **Disk space insufficient:** Free disk is ~12 GB; pi-gen requires ~15 GB minimum (4 GB rootfs
   staging + 3 GB work overhead + 3.5 GB uncompressed image + buffer). With 95% disk utilization
   we're ~3 GB short of safe headroom.

2. **macOS Docker Desktop incompatibility:** pi-gen's `build-docker.sh` probes for rootless mode
   and falls back to `sudo docker`. Docker Desktop on macOS does not accept `sudo docker` (the
   socket is user-owned, not root-owned). The pi-gen Docker container also needs privileged mode
   for loop device creation (`losetup`) and chroot operations — these require a Linux kernel and
   do not work under macOS Docker Desktop's VM-based containerd runtime.

3. **No arm64 Linux runner available locally:** The `build-docker.sh` target is arm64 Linux
   (Debian-based container). Native arm64 execution requires a Linux arm64 host or a properly
   configured arm64 Linux VM.

## What Was Verified

All pre-build validations pass:

- `bash -n` on all stage scripts: PASS
- `scripts/check-package-list-parity.sh` drift-check: PASS (OK: package lists in sync.)
- pi-gen submodule registered on arm64 branch: PASS (SHA 4ad56cc850fa60adcc7f07dc15879bc95cc1d281)
- `pi-image/config` STAGE_LIST correct: PASS
- All 7 installer library functions present: PASS
- All stage-signage files created: PASS

## Deferral Target

**Plan 49-03** (GitHub Actions self-hosted runner setup) will execute the Docker build on a
Hetzner CAX21 arm64 runner and record the full build output here.

The operator command to run when the runner is available:

```bash
cd /path/to/kpi-dashboard
git submodule update --init pi-image/pi-gen
cd pi-image
make build
```

Expected output: `pi-image/pi-gen/deploy/raspios-bookworm-arm64-signage-YYYY-MM-DD.img.xz`
Expected size: ≤ 1 GB compressed (SGN-REL-01 success criterion 4).

## pi-gen Submodule Info

| Field | Value |
|-------|-------|
| Remote | https://github.com/RPi-Distro/pi-gen.git |
| Branch | arm64 |
| Pinned SHA | 4ad56cc850fa60adcc7f07dc15879bc95cc1d281 |
| Tag (approximate) | 2026-04-13-raspios-trixie-arm64-3-g4ad56cc |
