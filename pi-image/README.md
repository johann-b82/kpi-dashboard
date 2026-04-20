# Pi Image Build — KPI Dashboard Signage

Builds a flashable Raspberry Pi OS Bookworm Lite 64-bit `.img.xz` with the KPI Dashboard
signage stack pre-installed. An operator goes from "downloaded the release" to "kiosk showing
pairing code" in ≤ 10 minutes, with no SSH/git/apt steps between flash and pairing.

## Quick Start

### Prerequisites

- A self-hosted **arm64** runner (see [Runner Spec](#runner-spec)).
- Docker installed on the runner.
- ~15 GB free disk space.
- `git` with submodule support.

### 1. Initialize the pi-gen submodule

```bash
git submodule update --init pi-image/pi-gen
```

Or from within the `pi-image/` directory:

```bash
make submodule
```

### 2. Build the image

```bash
cd pi-image
make build
```

This runs:
1. Copies `pi-image/config` into `pi-gen/config`
2. Runs `sudo CLEAN=1 ./build-docker.sh -c ../config` inside the `pi-gen/` submodule
3. Produces `pi-gen/deploy/raspios-bookworm-arm64-signage-YYYY-MM-DD.img.xz`

Expected build time: **25–40 minutes** on a Hetzner CAX21 (4 vCPU arm64 Altra, 80 GB NVMe).

### 3. Flash the image

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) to flash the `.img.xz`.

Enable "Custom settings" in Imager to configure:
- Hostname
- SSH (optional for admin access)
- Wi-Fi credentials
- Locale / timezone

### 4. Edit the preseed file

After flashing, mount the SD card's FAT partition (visible from any OS) and edit
`/boot/firmware/signage.conf`:

```ini
# /boot/firmware/signage.conf
# Required
SIGNAGE_API_URL=192.168.1.100:80
# Optional — leave blank to keep Imager-set hostname
SIGNAGE_HOSTNAME=
```

### 5. First boot

Insert the SD card, power on the Pi. The `signage-firstboot.service` reads `signage.conf`,
configures the system, and self-disables. The kiosk should display a pairing code within 30s.

See `signage.conf.template` for all supported fields.

---

## Directory Structure

```
pi-image/
├── config                      # pi-gen config (IMG_NAME, STAGE_LIST, etc.)
├── Makefile                    # `make build` / `make clean`
├── .gitignore                  # excludes pi-gen/work/, pi-gen/deploy/, *.img*
├── stage2/
│   └── SKIP_IMAGES             # suppresses intermediate Lite image export
├── stage-signage/
│   ├── EXPORT_IMAGE            # triggers image export after this stage
│   ├── 00-packages-nr          # apt packages (--no-install-recommends); SSOT: scripts/lib/signage-packages.txt
│   ├── prerun.sh               # host-side: copies library + sidecar + units into chroot rootfs
│   ├── 01-run-chroot.sh        # chroot-side: creates user, deploys units, enables linger
│   └── signage.conf.template   # preseed placeholder baked into /boot/firmware/signage.conf
└── pi-gen/                     # git submodule — RPi-Distro/pi-gen on arm64 branch (pinned SHA)
```

---

## Stage Configuration

pi-gen stage layout for this build:

| Stage | What it produces | Built? |
|-------|-----------------|--------|
| stage0 | Bootstrap filesystem (debootstrap) | Yes |
| stage1 | Bootable minimal system | Yes |
| stage2 | Raspberry Pi OS Lite | Yes (no image export — SKIP_IMAGES) |
| stage-signage | Signage kiosk stack | **Yes** (EXPORT_IMAGE) |
| stage3/4/5 | Desktop environments | Skipped (not in STAGE_LIST) |

---

## pi-gen Submodule — Vendoring Decision

**pi-gen is vendored as a git submodule at `pi-image/pi-gen`, pinned to a specific SHA on the
`arm64` branch** (not `master`).

**Why the `arm64` branch?** The `master` branch of `RPi-Distro/pi-gen` builds 32-bit (armv7l)
images. The `arm64` branch builds 64-bit (aarch64) Bookworm images. This is a load-bearing
distinction — using `master` would produce a 32-bit image even on a 64-bit-capable Pi. See
[pi-gen Common Pitfall #1](https://github.com/RPi-Distro/pi-gen/blob/arm64/README.md).

**Why a submodule (not a vendored copy)?**

- Tracks upstream cleanly; one-command update: `cd pi-image/pi-gen && git fetch && git checkout <new-sha>`
- Keeps repo size reasonable (the full pi-gen checkout is ~50 MB of shell + Docker)
- Pinned to a specific SHA for reproducibility — the submodule commit is locked in `.gitmodules`
- Matches the `submodules: recursive` checkout pattern in the CI workflow

**To update pi-gen to a newer arm64 SHA:**

```bash
cd pi-image/pi-gen
git fetch origin arm64
git checkout <target-sha>
cd ../..
git add pi-image/pi-gen
git commit -m "chore: update pi-gen submodule to <target-sha>"
```

---

## Runner Spec

**Recommended: Hetzner CAX21** (~€5–7/month)

| Spec | Value |
|------|-------|
| CPU | 4 vCPU Ampere Altra (arm64) |
| RAM | 8 GB |
| Disk | 80 GB NVMe |
| Expected build time | 25–40 min |

Stock GitHub Actions runners (x86_64) require QEMU emulation for arm64 chroot stages, adding
30–90 minutes to build time and pushing the 60-minute budget. A self-hosted arm64 runner is
**required** for production builds.

See `.github/workflows/pi-image.yml` for the full CI workflow.

---

## Known Pitfalls

**Pitfall 1 — arm64 vs master branch of pi-gen:**
Always use the `arm64` branch. The `master` branch targets armv7l (32-bit). A mismatch causes
the built image to report `uname -m = armv7l` instead of `aarch64`.

**Pitfall 2 — Disk space:**
pi-gen needs ~12–15 GB free: ~4 GB rootfs staging + ~300 MB Chromium + ~3 GB work overhead
+ ~3.5 GB uncompressed image. A runner with 40 GB disk is marginal; 80 GB is comfortable.
If the build fails with "No space left on device", run `make clean` and free disk.

**Pitfall 13 — CLEAN=1:**
Always pass `CLEAN=1` to `build-docker.sh`. Without it, pi-gen may reuse a stale Docker
container from a previous run, resulting in an oversized or corrupted image.
Command: `sudo CLEAN=1 ./build-docker.sh -c ../config`

---

## Preseed Reference

See `stage-signage/signage.conf.template` for all supported fields.

The operator-facing flash procedure (flash → edit preseed → boot → pair) is documented in
`pi-image/README.md` (this file) and the operator runbook at `docs/operator-runbook.md`.

Full preseed + first-boot documentation is covered by Plan 49-02.

---

## Runtime Fallback (SSH path)

If the operator has SSH access (configured via Imager), they can run the provisioner manually:

```bash
sudo SIGNAGE_API_URL=192.168.1.100:80 /opt/signage/scripts/provision-pi.sh
```

This is the Phase 48 fallback and produces identical filesystem state to the baked image
(modulo the firstboot preseed substitution).
