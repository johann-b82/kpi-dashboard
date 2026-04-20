# Phase 49: Pi Image Build — Research

**Researched:** 2026-04-20
**Domain:** pi-gen (RPi-Distro, arm64 branch), Raspberry Pi Imager preseed mechanism, image signing,
            self-hosted arm64 CI runner, QEMU aarch64 smoke testing, installer-library refactor
**Confidence:** HIGH overall (most unknowns resolved via official docs and community verification)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Base:** Raspberry Pi OS Bookworm Lite 64-bit. Not Trixie. Not Full Desktop.
2. **GUI depth:** Thin — labwc + Chromium kiosk only. No desktop environment.
3. **Builder:** pi-gen (RPi Foundation, Bash + chroot), arm64 branch.
4. **Preseed:** Raspberry Pi Imager "custom settings" → `SIGNAGE_API_URL` + Wi-Fi + hostname at flash time. No runtime wizard.
5. **Distribution:** GitHub Releases with `.img.xz` + sha256 + signature. Triggered by `v1.17.*` git tags.
6. **Build runner:** Self-hosted arm64 (Pi 4 or arm64 VM). Stock GitHub Actions cannot build Pi images.

### Claude's Discretion

- Specific image-signing tool (minisign vs GPG vs cosign) — researcher picks.
- Self-hosted runner hardware (Pi 4 8GB vs Pi 5 vs Oracle Cloud A1 vs Hetzner CAX11) — researcher picks.
- Exact preseed file format and path — to be confirmed by researcher.
- QEMU smoke-test scope — researcher defines.

### Deferred Ideas (OUT OF SCOPE)

- Multi-Pi fleet orchestration (Ansible) — deferred to v1.18.
- OTA image updates / rpi-update integration — deferred.
- Cellular/LTE fallback — deferred.
- Debian Trixie base — deferred (see `research/debian-trixie-pi-image.md`).
- Full desktop image — deferred.
- QEMU-driven automated E2E in CI — smoke-only; hardware walkthrough is the release gate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGN-IMG-01 | pi-gen fork/config at `pi-image/`, stages 0–2 + signage stage | §"pi-gen stage numbering" + §"pi-gen config skeleton" |
| SGN-IMG-02 | Custom stage `pi-image/stage-signage/` installs packages, creates user, drops systemd units, provisions venv, enables linger | §"pi-gen config skeleton" + §"installer library refactor" |
| SGN-IMG-03 | `provision-pi.sh` refactored; shared library `scripts/lib/signage-install.sh` | §"installer-library refactor shape" |
| SGN-IMG-04 | First boot produces pairing code ≤ 60 s after cloud-init/firstboot completion | §"first-boot oneshot design" |
| SGN-IMG-05 | Build is reproducible given same git SHA + pi-gen SHA | §"pi-gen config skeleton" (pinned SHA, deterministic stage) |
| SGN-IMG-06 | Imager custom-settings preseed supplies SIGNAGE_API_URL + Wi-Fi + hostname + SSH key | §"preseed filename convention" |
| SGN-IMG-07 | `signage-firstboot.service` reads preseed, writes `/etc/signage/config`, restarts services, self-disables | §"first-boot oneshot design" |
| SGN-IMG-08 | Real-hardware E2E walkthrough recorded in `49-E2E-RESULTS.md` | §"QEMU smoke test" + hardware gate |
| SGN-REL-01 | GitHub Actions `pi-image.yml` triggers on `v1.17.*`, signs, publishes | §"release workflow skeleton" |
| SGN-REL-02 | `pi-image/README.md` with operator flash procedure, verification, rollback | §"recommended plan breakdown" |
| SGN-REL-03 | Release notes template `.github/RELEASE_TEMPLATE.md` | §"recommended plan breakdown" |
</phase_requirements>

---

## Executive Summary

All seven unknowns from 49-CONTEXT.md are resolvable with HIGH or MEDIUM confidence from official
documentation and verified community sources. The two unknowns with partial nuance are the preseed
mechanism (Bookworm still uses `firstrun.sh`, not cloud-init `user-data`) and QEMU smoke depth
(Wayland/Chromium are not testable under QEMU; systemd-level oneshot checks are).

**Primary recommendation:** Build with `pi-gen` arm64 branch via `build-docker.sh` on a
Hetzner CAX21 (€5/mo, 4 OCPU / 8 GB / 80 GB SSD arm64) as the self-hosted runner; sign with
`minisign`; preseed via a plain key=value file at `/boot/firmware/signage.conf` read by a
`signage-firstboot.service` oneshot; use `mkdir -p /var/lib/systemd/linger && touch
/var/lib/systemd/linger/signage` inside the chroot instead of `loginctl enable-linger`.

### Confidence Heat Map

| Unknown | Confidence | Key Source |
|---------|-----------|-----------|
| 1. Preseed filename convention (Bookworm firstrun.sh path) | HIGH | rpi-imager source + community blogs [1][2] |
| 2. pi-gen non-interactive CI | HIGH | Official pi-gen README [3] + pi-gen-action docs [4] |
| 3. Self-hosted runner spec | MEDIUM | Hetzner/Oracle specs [5][6]; pi-gen build times inferred from community |
| 4. Image signing tool | HIGH | minisign official docs [7]; platform availability verified |
| 5. pi-gen stage numbering | HIGH | Official pi-gen README [3] |
| 6. Installer-library refactor shape | HIGH | Source analysis of `provision-pi.sh` (actual file) |
| 7. QEMU smoke test depth | MEDIUM | QEMU docs + memfault article [8]; Wayland limitation confirmed |

---

## Decisions Resolved

### Unknown 1: Preseed Filename Convention

**Answer: Bookworm uses `firstrun.sh` (a bash script), NOT cloud-init `user-data`.**

Raspberry Pi OS Bookworm Lite 64-bit is the target. On Bookworm, Raspberry Pi Imager writes:

1. **`/boot/firmware/firstrun.sh`** — a generated bash script containing `imager_custom` calls
   for hostname, Wi-Fi (NetworkManager `preconfigured.nmconnection`), SSH, and user setup.
2. **`/boot/firmware/cmdline.txt`** — appended with `systemd.run=/boot/firmware/firstrun.sh
   systemd.run_success_action=reboot systemd.unit=kernel-command-line.target`
3. Firstrun.sh deletes itself after running and triggers a reboot.

The transition to cloud-init `user-data` files (`meta-data`, `network-config`, `user-data`) only
applies to **Trixie** images and Imager 2.0. For Bookworm (our locked target), the legacy
`firstrun.sh` mechanism remains in use. [1][2][9]

**Critical path detail:** The firmware partition path changed in Bookworm from `/boot/` to
`/boot/firmware/`. The firstrun.sh script lives at `/boot/firmware/firstrun.sh` (FAT32 partition,
readable from any OS before first boot). Older Imager builds had a bug writing `/boot/firstrun.sh`
(wrong path) — ensure Imager ≥ 1.8.5 is used by operators. [1]

**`SIGNAGE_API_URL` preseed strategy:**

Raspberry Pi Imager's custom settings UI does NOT have a field for arbitrary application config
like `SIGNAGE_API_URL`. The UI only sets: hostname, username/password, SSH, Wi-Fi, locale,
timezone, keyboard. There are two viable approaches:

**Approach A (recommended): Bake a config file into the FAT partition.**

The image is built with a placeholder file at `/boot/firmware/signage.conf` (plain key=value,
readable from Windows/Mac/Linux without special tools before first boot). The operator edits this
file on the SD card's FAT partition after flashing and before first boot.

```
# /boot/firmware/signage.conf  — edit before first boot
SIGNAGE_API_URL=192.168.1.100:80
# SIGNAGE_HOSTNAME is optional; leave blank to use the Imager-configured hostname
SIGNAGE_HOSTNAME=
```

**Approach B: Document SSH-and-run (Phase 48 fallback).**

If the operator has already set up SSH via Imager, they can SSH in and run:
```bash
sudo SIGNAGE_API_URL=192.168.1.100:80 /opt/signage/scripts/provision-pi.sh
```

**Decision: Approach A for zero-SSH deployments (satisfies SGN-IMG-06). Approach B documented
as fallback in `pi-image/README.md`.** The firstboot oneshot reads from
`/boot/firmware/signage.conf`.

**Exact fields documented for operators:**

```ini
# /boot/firmware/signage.conf
# Required
SIGNAGE_API_URL=<host:port>
# Optional — leave blank to keep Imager-set hostname
SIGNAGE_HOSTNAME=
# Optional — Wi-Fi configured via Imager custom settings (preferred)
# If not using Imager, set these:
WIFI_SSID=
WIFI_PSK=
```

**Path the firstboot oneshot reads:**
```
/boot/firmware/signage.conf
```
(The boot/firmware FAT32 partition is mounted at `/boot/firmware` on the running Pi.)

---

### Unknown 2: pi-gen Non-Interactive CI

**Answer: pi-gen runs fully headless via `build-docker.sh` or the `pi-gen-action` GitHub Action.**

**Option A — Direct `build-docker.sh` (recommended for self-hosted runners):**

```bash
cd pi-image/pi-gen   # pinned submodule or vendored copy
./build-docker.sh    # reads ./config file; runs inside Docker; no TTY needed
```

`build-docker.sh` uses Docker (not QEMU) to run the stages in a Debian container. On a native
arm64 host, Docker uses the host kernel's arm64 execution directly (no binfmt/emulation needed).
No TTY, no interactive prompts. All configuration is in the `config` bash file.

**Key environment variables for non-interactive Bookworm Lite build:**

```bash
# In config file (sourced by build.sh / build-docker.sh)
export IMG_NAME="raspios-bookworm-arm64-signage"
export RELEASE="bookworm"
export DEPLOY_COMPRESSION="xz"
export COMPRESSION_LEVEL=9
export LOCALE_DEFAULT="en_GB.UTF-8"
export TIMEZONE_DEFAULT="Europe/London"
export FIRST_USER_NAME="pi"
export FIRST_USER_PASS=""          # lock account — operator uses SSH key
export ENABLE_SSH=0                # operator enables via Imager
export DISABLE_FIRST_BOOT_USER_RENAME=1
export ENABLE_CLOUD_INIT=1        # leave cloud-init for Trixie compat; harmless on Bookworm
```

**Disk space requirement:** pi-gen needs approximately 10 GB free in the Docker build directory
(staging the rootfs + work files + final image). A runner with 40 GB+ disk is safe.

**Option B — `pi-gen-action` GitHub Marketplace Action (alternative for GitHub-hosted runners):**

The `usimd/pi-gen-action` action wraps pi-gen and runs on `ubuntu-latest` using x86_64 QEMU
emulation for the chroot. However, arm64 chroot stages run about 5–10x slower under x86_64 QEMU
than on a native arm64 host. For a 60-minute budget, this is marginal. [4]

**Verdict: Use `build-docker.sh` on a native arm64 self-hosted runner. `pi-gen-action` is a
fallback if no self-hosted runner is available (expect 90–150 min build time under QEMU on
x86_64).** [4]

**Important pi-gen branch:** Use the `arm64` branch of `RPi-Distro/pi-gen` — the `master` branch
builds 32-bit images only. [3]

---

### Unknown 3: Self-Hosted Runner Spec

**Answer: Hetzner CAX21 arm64 cloud instance. One-time setup, ~€5–7/month.**

**Comparison table:**

| Option | CPU (arm64) | RAM | Disk | Cost | Build time (est.) | Notes |
|--------|-------------|-----|------|------|-------------------|-------|
| Pi 4 8GB | 4× Cortex-A72 @1.8 GHz | 8 GB | SD card (slow I/O) | ~$75 hardware + electricity | 40–60 min | SD card I/O is the bottleneck; NVMe via USB3 helps |
| Pi 5 | 4× Cortex-A76 @2.4 GHz | 4–8 GB | SD card / NVMe | ~$80–100 hardware | 25–40 min | Best bare-metal; NVMe SSD nearly mandatory |
| Oracle Cloud A1 free | 4 OCPU Ampere A1 | 24 GB | 200 GB (with block storage) | $0 (always-free) | 20–35 min | Account approval can take days/weeks; subject to resource availability |
| Hetzner CAX11 | 2 vCPU Ampere Altra | 4 GB | 40 GB NVMe | €3.79/mo | 40–60 min | **Tight disk** — 40 GB is marginal for pi-gen (needs ~10 GB staging) |
| **Hetzner CAX21** | **4 vCPU Ampere Altra** | **8 GB** | **80 GB NVMe** | **~€5.50–7/mo** | **25–40 min** | **Recommended** — ample disk, fast NVMe, predictable |
| Hetzner CAX31 | 8 vCPU Ampere Altra | 16 GB | 160 GB NVMe | ~€12/mo | 20–30 min | Overkill; cost not justified |

**Recommendation: Hetzner CAX21.**

Rationale:
- 80 GB NVMe eliminates the "10 GB pi-gen staging" disk risk (CAX11's 40 GB is too close to
  the minimum with OS overhead).
- 4 Ampere Altra cores run Debian containers natively at arm64; no QEMU emulation.
- €5–7/month is cheaper than Pi 5 hardware depreciation, and the runner can be torn down and
  re-created from a snapshot between releases.
- Oracle Cloud free tier is theoretically better (cost-free) but account approval is unreliable,
  instances can be reclaimed, and 200 GB block storage must be provisioned separately.
- Pi 4 is viable if hardware is already on hand — but SD card I/O (~25–35 MB/s sequential) makes
  it 30–50% slower than NVMe. If using a Pi 4, attach a USB3-to-NVMe adapter.

**Disk requirements for pi-gen Bookworm Lite + signage packages:**
- Base rootfs staging: ~4 GB
- Chromium-browser installed: +~300 MB
- Python venv (sidecar): +~50 MB
- labwc + fonts + misc: +~100 MB
- Work directory overhead: +~3 GB
- Final .img: ~3.5 GB uncompressed; ~0.6–0.9 GB at `xz -9`
- **Total disk needed: ~12–15 GB** (the CAX11's 40 GB is workable but not comfortable with OS)

---

### Unknown 4: Image Signing

**Answer: minisign (Ed25519). Operator verify command is one line on all platforms.**

**Comparison:**

| Tool | Key management | Operator install | Verify command | CI integration | Verdict |
|------|---------------|-----------------|----------------|----------------|---------|
| **minisign** | One key pair; public key in repo | Download binary (Win/Mac/Linux) | `minisign -Vm file.img.xz -P <pubkey>` | `minisign -Sm file.img.xz -s key.sec` | **Chosen** |
| GPG | Key pair + keyring + trust model | Pre-installed on Linux; GnuPG on Win/Mac | `gpg --verify file.img.xz.asc` | Complex: keyring import needed in CI | Heavier |
| cosign (sigstore) | Keyless (OIDC) or key pair | `cosign` binary; not pre-installed | `cosign verify-blob ...` | Excellent; requires OCI registry or Rekor | Overkill for files |

**Why minisign over GPG:**
- No keyring management: the public key is a single base64 string that can be copy-pasted into
  any OS terminal.
- Ed25519 signatures are ~88 bytes — simpler than GPG ASCII-armor.
- Windows binary available without cygwin/wsl.
- Verification does not require `--trust-model`, key import, or `--keyid-format`.

**Why not cosign:** cosign is excellent for container images stored in OCI registries. For a
file-based `.img.xz` release, cosign adds Rekor/Fulcio dependency without benefit. minisign is
the right tool for signing plain files.

**Exact key management procedure:**

```bash
# One-time: generate key pair (CI pipeline secrets store minisign.sec)
minisign -G -p pi-image/minisign.pub -s minisign.sec
# minisign.pub is committed to the repo
# minisign.sec is stored as a GitHub Actions secret (MINISIGN_SECRET_KEY)

# CI sign step:
echo "${MINISIGN_SECRET_KEY}" > /tmp/minisign.sec
minisign -Sm raspios-bookworm-arm64-signage-${TAG}.img.xz \
         -s /tmp/minisign.sec \
         -t "KPI Dashboard ${TAG} release"
rm /tmp/minisign.sec

# Operator verify command (all platforms):
minisign -Vm raspios-bookworm-arm64-signage-${TAG}.img.xz \
         -P RWS<base64-pubkey-from-repo>
```

**Public key distribution:** Commit `pi-image/minisign.pub` to the repo. The operator downloads
the public key from the repo (or copies from `pi-image/README.md`) and runs the verify command.

---

### Unknown 5: pi-gen Stage Numbering

**Answer: Run stages 0, 1, 2 (produces Bookworm Lite base). Skip stages 3, 4, 5. Add
`stage-signage` as a named stage run after stage 2. Use `SKIP_IMAGES` in stage2 to suppress
the intermediate Lite image; use `EXPORT_IMAGE` in `stage-signage` to produce only the final
image.**

**pi-gen stage layout:**

| Stage | What it produces | Export? |
|-------|-----------------|---------|
| stage0 | Bootstrap filesystem (debootstrap) | No |
| stage1 | Bootable minimal system | No |
| stage2 | Raspberry Pi OS Lite | Yes (`EXPORT_IMAGE` + `EXPORT_NOOBS`) |
| stage3 | Desktop (X11/LXDE) | No (skipped) |
| stage4 | Standard RPi OS (with apps) | No (skipped) |
| stage5 | Full RPi OS | No (skipped) |
| **stage-signage** | Our kiosk stack added on top of Lite | **Yes (`EXPORT_IMAGE` only)** |

**To suppress the intermediate stage2 image and only produce the stage-signage image:**

```
# In pi-image/stage2/: add a SKIP_IMAGES file (empty)
touch pi-image/stage2/SKIP_IMAGES

# In pi-image/stage-signage/: add an EXPORT_IMAGE file (empty)
touch pi-image/stage-signage/EXPORT_IMAGE
```

**`STAGE_LIST` in config file (controls which stages run and in what order):**

```bash
export STAGE_LIST="stage0 stage1 stage2 stage-signage"
```

This causes build.sh to run only those four stages (skipping 3, 4, 5 entirely — no need for
`SKIP` files in stages 3/4/5 when `STAGE_LIST` is explicit). [3]

**Final image output path:**
```
pi-image/pi-gen/deploy/raspios-bookworm-arm64-signage-${YYYY-MM-DD}.img.xz
```

---

### Unknown 6: Installer-Library Refactor Shape

**Answer: Extract `provision-pi.sh` into `scripts/lib/signage-install.sh` with 7 callable
functions. Both callers (`provision-pi.sh` and `stage-signage/01-run-chroot.sh`) source the
library and call the appropriate subset.**

**Key constraint discovered:** `loginctl enable-linger` does NOT work inside a pi-gen chroot.
The chroot has no running systemd/logind. The workaround is to directly create the linger file:
```bash
mkdir -p /var/lib/systemd/linger
touch /var/lib/systemd/linger/signage
```
This is equivalent to `loginctl enable-linger signage` — logind reads the presence of this file
at boot to decide whether to start the user manager. This technique is well-documented and
works correctly on Bookworm. [10]

**Function list for `scripts/lib/signage-install.sh`:**

```bash
# Source this file from provision-pi.sh or 01-run-chroot.sh
# All functions require root.

install_signage_packages()
# Args: none
# Installs: chromium-browser, unclutter-xfixes, labwc, seatd,
#   fonts-crosextra-carlito, fonts-crosextra-caladea, fonts-noto-core,
#   fonts-dejavu-core, python3-venv, python3-pip, git, ca-certificates,
#   curl, network-manager
# Behavior: apt-get update && apt-get install -y --no-install-recommends
# Callers: BOTH (build-time chroot AND runtime provision)

create_signage_user()
# Args: none
# Creates 'signage' user with groups video,audio,render,input
# Idempotent: guards with `id signage` check
# Also creates /home/signage/.config/systemd/user/ directory tree
# Callers: BOTH

create_signage_directories()
# Args: none
# Creates /var/lib/signage/ (0700), /var/lib/signage/media/ (0700),
#   /opt/signage/ (0755)
# Callers: BOTH

deploy_systemd_units()
# Args: $1=signage_api_url  $2=signage_uid
# Copies scripts/systemd/*.service to /home/signage/.config/systemd/user/
# Performs sed substitution of __SIGNAGE_API_URL__ and __SIGNAGE_UID__
# In the baked image, the placeholder values are used; firstboot replaces URL at runtime
# Callers: BOTH (build-time uses placeholder URL; runtime uses real URL)

setup_sidecar_venv()
# Args: none
# Creates /opt/signage/pi-sidecar/.venv/
# Installs from pi-sidecar/requirements.txt
# Pre-compiles bytecode (python -m compileall) for ProtectSystem=strict compat
# Callers: BOTH

enable_linger_signage()
# Args: none
# BUILD-TIME (chroot): touch /var/lib/systemd/linger/signage (no loginctl)
# RUNTIME (booted): loginctl enable-linger signage
# Caller detects context via $SIGNAGE_BUILD_CONTEXT env var (set to "chroot" by 01-run-chroot.sh)
# Callers: BOTH (different code path per context)

force_wayland_if_pi3()
# Args: none
# RUNTIME ONLY — reads /proc/device-tree/model, calls raspi-config nonint do_wayland W2 on Pi 3B
# No-op inside chroot (no /proc/device-tree available)
# Callers: RUNTIME ONLY (provision-pi.sh)
```

**Functions that are RUNTIME-ONLY (cannot run in chroot):**

| Function / Step | Why not in chroot |
|-----------------|------------------|
| `systemctl --user enable --now ...` (Step 8) | No systemd running in chroot |
| `systemctl start user@UID.service` (Step 8) | Same |
| `force_wayland_if_pi3` | /proc/device-tree not available in chroot |
| `loginctl enable-linger` directly | No logind in chroot |

**Functions that are BUILD-TIME-ONLY (only called from `01-run-chroot.sh`):**

| Action | Reason |
|--------|--------|
| Write `/boot/firmware/signage.conf` placeholder | Bake the preseed template into the FAT partition |
| Write `signage-firstboot.service` and enable it via symlink | Drop and enable the first-boot oneshot |
| Configure `/etc/signage/` directory structure | Pre-create for firstboot to write into |

**`provision-pi.sh` skeleton after refactor:**

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/signage-install.sh"

preflight_checks     # root check, arch check, apt check, SIGNAGE_API_URL check, systemd version

install_signage_packages
create_signage_user
create_signage_directories

# Runtime path: clone or update repo
setup_repo_at_opt_signage   # stays in provision-pi.sh (not shared: build-time path uses pi-gen)

setup_sidecar_venv

SIGNAGE_UID=$(id -u signage)
deploy_systemd_units "${SIGNAGE_API_URL}" "${SIGNAGE_UID}"

enable_linger_signage   # detects runtime context, calls loginctl

enable_and_start_services "${SIGNAGE_UID}"  # systemctl enable --now, daemon-reload

force_wayland_if_pi3

print_completion_banner "${SIGNAGE_API_URL}"
```

**`01-run-chroot.sh` skeleton:**

```bash
#!/usr/bin/env bash
set -euo pipefail
export SIGNAGE_BUILD_CONTEXT="chroot"
source /tmp/lib/signage-install.sh  # copied into chroot by prerun.sh

install_signage_packages
create_signage_user
create_signage_directories
setup_sidecar_venv   # /opt/signage/pi-sidecar must be present (copied by prerun.sh)

SIGNAGE_UID=$(id -u signage)
# Deploy units with PLACEHOLDER — firstboot will substitute real URL
deploy_systemd_units "__SIGNAGE_API_URL__" "${SIGNAGE_UID}"

enable_linger_signage   # touch /var/lib/systemd/linger/signage (no loginctl)

# Enable firstboot oneshot service (symlink into systemd multi-user target wants)
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -sf /etc/systemd/system/signage-firstboot.service \
       /etc/systemd/system/multi-user.target.wants/signage-firstboot.service
```

**Behavior parity check:**

Both paths MUST produce identical filesystem state for:
- `/home/signage/.config/systemd/user/{labwc,signage-sidecar,signage-player}.service`
- `/opt/signage/pi-sidecar/.venv/` (identical package versions; `requirements.txt` is the source)
- `/var/lib/signage/` and `/var/lib/signage/media/` (mode 0700)
- `/var/lib/systemd/linger/signage` (file present = linger enabled)
- `signage` user in groups `video,audio,render,input`

The only intentional difference: in the baked image, unit files contain the placeholder
`__SIGNAGE_API_URL__`; the firstboot service replaces this with the real URL from
`/boot/firmware/signage.conf`.

---

### Unknown 7: QEMU Smoke Test

**Answer: QEMU aarch64 can smoke-test the systemd oneshot and the sidecar `/health` endpoint.
It CANNOT test labwc, Chromium, or any Wayland display output.**

**What QEMU (`-machine virt -cpu cortex-a72`) can verify:**

1. Image boots to systemd multi-user target (no kernel panic, no critical unit failures)
2. `signage-firstboot.service` runs, reads `/boot/firmware/signage.conf`, writes
   `/etc/signage/config`, and self-disables
3. `signage-sidecar.service` starts and `/health` endpoint returns `{"ready": false}` (no token
   yet — expected in smoke test)
4. `signage` user exists, `/var/lib/signage/` has correct permissions
5. Python venv is intact (`/opt/signage/pi-sidecar/.venv/bin/uvicorn --version`)

**What QEMU CANNOT verify:**

- `labwc.service` start — labwc requires a GPU device node (`/dev/dri/card0`); QEMU virt machine
  has no GPU
- Chromium kiosk rendering — Wayland compositor is a prerequisite; not available under QEMU virt
- Any display output or kiosk visual
- Hardware-specific GPIO, DRM, or SPI

**Why `-machine raspi4b` is not recommended:**

QEMU added `raspi4b` machine type in v9.0 (2024) but it is described in community reports as
"disappointing" — the BCM2711 peripheral set (PCIe, VC4 GPU, USB3) is largely unimplemented.
Booting a real Raspberry Pi OS image on `-machine raspi4b` hangs at GPU firmware initialization.
The `virt` machine type with a custom kernel is more reliable for smoke testing. [8]

**Concrete QEMU command for smoke test:**

The smoke test does NOT use the produced `.img` directly with `raspi4b`. Instead, it uses the
`virt` machine type with the kernel extracted from the image's boot partition:

```bash
# 1. Extract kernel from built image
LOOP=$(losetup -f --show -P raspios-bookworm-arm64-signage-YYYY-MM-DD.img)
mount ${LOOP}p1 /mnt/boot-ro -o ro
cp /mnt/boot-ro/kernel8.img /tmp/kernel8.img
cp /mnt/boot-ro/bcm2711-rpi-4-b.dtb /tmp/ || true
umount /mnt/boot-ro
losetup -d ${LOOP}

# 2. Run QEMU smoke boot (no display, serial console only)
qemu-system-aarch64 \
  -machine virt \
  -cpu cortex-a72 \
  -smp 4 \
  -m 2G \
  -kernel /tmp/kernel8.img \
  -append "root=/dev/vda2 rootfstype=ext4 rw console=ttyAMA0,115200 systemd.unit=multi-user.target" \
  -drive format=raw,file=raspios-bookworm-arm64-signage-YYYY-MM-DD.img,if=none,id=hd0 \
  -device virtio-blk,drive=hd0 \
  -netdev user,id=net0,hostfwd=tcp::8080-:8080,hostfwd=tcp::2222-:22 \
  -device virtio-net-pci,netdev=net0 \
  -nographic \
  -serial stdio \
  -no-reboot \
  -timeout 120
```

**Automated smoke checks (run against the booted QEMU instance via SSH on port 2222):**

```bash
# Wait for SSH
until ssh -p 2222 -o StrictHostKeyChecking=no pi@localhost true 2>/dev/null; do sleep 2; done

# Check firstboot ran
ssh -p 2222 pi@localhost "systemctl is-active signage-firstboot || true"
# Expected: inactive (ran once, self-disabled)

# Check sidecar health
curl -sf http://localhost:8080/health | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'ready' in d else 1)"

# Check signage user exists
ssh -p 2222 pi@localhost "id signage"

# Check venv
ssh -p 2222 pi@localhost "/opt/signage/pi-sidecar/.venv/bin/uvicorn --version"
```

**QEMU smoke test scope: MEDIUM confidence (boot + systemd + HTTP endpoint).
Real-hardware E2E (SGN-IMG-08) is the gate for Wayland, Chromium, and display.**

---

## pi-gen Config Skeleton

Ready-to-paste file contents for the `pi-image/` directory tree.

### `pi-image/config`

```bash
#!/usr/bin/env bash
# pi-gen config for KPI Dashboard signage image
# Source: read by build.sh and build-docker.sh
# Pin: use pi-gen arm64 branch at a specific commit SHA (set in Makefile or CI)

export IMG_NAME="raspios-bookworm-arm64-signage"
export RELEASE="bookworm"
export DEPLOY_COMPRESSION="xz"
export COMPRESSION_LEVEL=9

# Locale / keyboard (operators can override at first boot via Imager custom settings)
export LOCALE_DEFAULT="en_GB.UTF-8"
export TIMEZONE_DEFAULT="Europe/London"
export KEYBOARD_KEYMAP="gb"
export KEYBOARD_LAYOUT="English (UK)"

# No default user — operator sets via Imager; firstrun.sh creates the pi user
export FIRST_USER_NAME="pi"
export FIRST_USER_PASS=""
export DISABLE_FIRST_BOOT_USER_RENAME=1
export ENABLE_SSH=0        # operator enables via Imager custom settings

# Only run stages 0–2 + our custom stage; skip stages 3/4/5 entirely
export STAGE_LIST="stage0 stage1 stage2 stage-signage"

# Reproducibility: set a fixed date for image metadata (override in CI with tag date)
export IMG_DATE="$(date -u +%Y-%m-%d)"

# Optional: apt caching proxy if runner has one
# export APT_PROXY="http://10.0.0.1:3142"

# Cloud-init: leave enabled for forward-compat with Trixie migration
export ENABLE_CLOUD_INIT=1
```

### `pi-image/stage2/SKIP_IMAGES`

```
(empty file — suppresses intermediate Lite image export)
```

### `pi-image/stage-signage/EXPORT_IMAGE`

```
(empty file — triggers image export after this stage)
```

### `pi-image/stage-signage/prerun.sh`

```bash
#!/usr/bin/env bash
# prerun.sh runs on the BUILD HOST (not in chroot) before chroot scripts execute.
# Use it to copy files INTO the chroot rootfs.
set -euo pipefail

ROOTFS="${ROOTFS_DIR}"   # set by pi-gen build system
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# Copy the installer library into the chroot so 01-run-chroot.sh can source it
install -d -m 0755 "${ROOTFS}/tmp/lib"
cp "${REPO_ROOT}/scripts/lib/signage-install.sh" "${ROOTFS}/tmp/lib/"

# Copy the pi-sidecar source into /opt/signage/pi-sidecar in the chroot
install -d -m 0755 "${ROOTFS}/opt/signage/pi-sidecar"
cp -r "${REPO_ROOT}/pi-sidecar/." "${ROOTFS}/opt/signage/pi-sidecar/"

# Copy the systemd unit templates
install -d -m 0755 "${ROOTFS}/opt/signage/scripts/systemd"
cp "${REPO_ROOT}/scripts/systemd/"*.service "${ROOTFS}/opt/signage/scripts/systemd/"

# Bake the firstboot service (system-level, not user-level)
install -m 0644 "${REPO_ROOT}/pi-image/stage-signage/signage-firstboot.service" \
    "${ROOTFS}/etc/systemd/system/signage-firstboot.service"

# Bake the preseed placeholder config onto the FAT partition (boot)
# The boot partition is mounted at ${ROOTFS}/boot/firmware during chroot
install -m 0644 "${REPO_ROOT}/pi-image/stage-signage/signage.conf.template" \
    "${ROOTFS}/boot/firmware/signage.conf"
```

### `pi-image/stage-signage/00-packages`

```
chromium-browser
unclutter-xfixes
labwc
seatd
fonts-crosextra-carlito
fonts-crosextra-caladea
fonts-noto-core
fonts-dejavu-core
python3-venv
python3-pip
git
ca-certificates
curl
network-manager
```

Note: `00-packages` is a plain text file, one package per line (or space-separated). pi-gen
passes these to `apt-get install -y`. The `--no-install-recommends` flag requires using
`00-packages-nr` instead of `00-packages` — use `00-packages-nr` for the final list to keep
image size down.

**Rename to `00-packages-nr`** (installs with `--no-install-recommends`):

```
chromium-browser unclutter-xfixes labwc seatd
fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto-core fonts-dejavu-core
python3-venv python3-pip git ca-certificates curl network-manager
```

### `pi-image/stage-signage/01-run-chroot.sh`

```bash
#!/usr/bin/env bash
# Runs inside the image chroot. No systemd running. No /proc/device-tree.
set -euo pipefail

export SIGNAGE_BUILD_CONTEXT="chroot"

# Source the shared installer library (copied by prerun.sh)
# shellcheck source=/dev/null
source /tmp/lib/signage-install.sh

# Packages were installed by 00-packages-nr; verify key ones are present
command -v chromium-browser >/dev/null 2>&1 || { echo "ERROR: chromium-browser not found"; exit 1; }
command -v labwc            >/dev/null 2>&1 || { echo "ERROR: labwc not found"; exit 1; }

# Create signage user and directory layout
create_signage_user
create_signage_directories

# Set up sidecar venv (sources from /opt/signage/pi-sidecar which was copied by prerun.sh)
setup_sidecar_venv

# Deploy unit files with PLACEHOLDER URL (firstboot replaces it)
SIGNAGE_UID=$(id -u signage)
deploy_systemd_units "__SIGNAGE_API_URL__" "${SIGNAGE_UID}"

# Enable linger via file touch (loginctl doesn't work in chroot)
enable_linger_signage

# Pre-create /etc/signage/ directory for firstboot to write config into
install -d -m 0755 /etc/signage
chown root:root /etc/signage

# Enable firstboot service
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -sf /etc/systemd/system/signage-firstboot.service \
       /etc/systemd/system/multi-user.target.wants/signage-firstboot.service

# Set file ownership on all signage-owned paths
chown -R signage:signage /opt/signage
chown -R signage:signage /home/signage
chown -R signage:signage /var/lib/signage

echo "[stage-signage] chroot setup complete."
```

---

## First-Boot Oneshot Design

### `pi-image/stage-signage/signage-firstboot.service`

This is a **system-level** (not user-level) service that runs as root once on first boot.
It reads the operator-edited preseed file from the FAT partition, configures the system, then
self-disables.

```ini
[Unit]
Description=Signage first-boot configuration
Documentation=https://github.com/<org>/kpi-dashboard/blob/main/pi-image/README.md
DefaultDependencies=no
After=local-fs.target network.target systemd-remount-fs.service
Before=multi-user.target signage-sidecar.service
ConditionPathExists=/boot/firmware/signage.conf

[Service]
Type=oneshot
RemainAfterExit=no
ExecStart=/opt/signage/scripts/firstboot.sh
StandardOutput=journal
StandardError=journal

# Self-disables after successful run; errors leave it in a failed state (visible in journal)
ExecStartPost=/bin/systemctl disable signage-firstboot.service

[Install]
WantedBy=multi-user.target
```

### `scripts/firstboot.sh` (invoked by the service)

```bash
#!/usr/bin/env bash
# First-boot configuration script.
# Reads /boot/firmware/signage.conf, writes /etc/signage/config,
# substitutes SIGNAGE_API_URL into systemd user unit files,
# then restarts the signage user services.
set -euo pipefail

PRESEED="/boot/firmware/signage.conf"
CONFIG_DIR="/etc/signage"
CONFIG_FILE="${CONFIG_DIR}/config"
UNIT_DIR="/home/signage/.config/systemd/user"
SIGNAGE_UID=$(id -u signage 2>/dev/null || echo "")

log() { echo "[firstboot] $*" | tee /dev/kmsg 2>/dev/null || echo "[firstboot] $*"; }

log "=== Signage first-boot starting ==="

# --- Read preseed ---
if [ ! -f "${PRESEED}" ]; then
  log "ERROR: ${PRESEED} not found. Cannot configure. Sidecar will not start."
  exit 1
fi

# Source the preseed (plain key=value, no export needed)
set -a
# shellcheck source=/dev/null
source "${PRESEED}"
set +a

if [ -z "${SIGNAGE_API_URL:-}" ]; then
  log "ERROR: SIGNAGE_API_URL not set in ${PRESEED}. Edit ${PRESEED} and reboot."
  exit 1
fi

log "SIGNAGE_API_URL=${SIGNAGE_API_URL}"

# --- Write /etc/signage/config ---
install -d -m 0755 "${CONFIG_DIR}"
cat > "${CONFIG_FILE}" <<EOF
# Written by signage-firstboot.service on $(date -u +%Y-%m-%dT%H:%M:%SZ)
SIGNAGE_API_URL=${SIGNAGE_API_URL}
EOF
chmod 0644 "${CONFIG_FILE}"
log "Wrote ${CONFIG_FILE}"

# --- Substitute URL in unit files ---
if [ -z "${SIGNAGE_UID:-}" ]; then
  log "ERROR: signage user not found. Image may be corrupted."
  exit 1
fi

for UNIT in labwc.service signage-sidecar.service signage-player.service; do
  UPATH="${UNIT_DIR}/${UNIT}"
  if [ -f "${UPATH}" ]; then
    sed -i "s|__SIGNAGE_API_URL__|${SIGNAGE_API_URL}|g" "${UPATH}"
    log "Patched ${UNIT}"
  else
    log "WARNING: ${UPATH} not found"
  fi
done

# --- Reload and restart user services ---
XDG_RUNTIME_DIR="/run/user/${SIGNAGE_UID}"
DBUS_ADDR="unix:path=${XDG_RUNTIME_DIR}/bus"

# Ensure user manager is running (loginctl enable-linger already created the file)
systemctl start "user@${SIGNAGE_UID}.service" || log "WARNING: user@${SIGNAGE_UID} already running"

for _ in $(seq 1 20); do
  [ -S "${XDG_RUNTIME_DIR}/bus" ] && break
  sleep 0.5
done

sudo -u signage \
  XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
  DBUS_SESSION_BUS_ADDRESS="${DBUS_ADDR}" \
  systemctl --user daemon-reload || log "WARNING: daemon-reload failed"

sudo -u signage \
  XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
  DBUS_SESSION_BUS_ADDRESS="${DBUS_ADDR}" \
  systemctl --user restart signage-sidecar.service signage-player.service || \
  log "WARNING: service restart failed; services will start on next boot"

# --- Optional: set hostname if SIGNAGE_HOSTNAME is set ---
if [ -n "${SIGNAGE_HOSTNAME:-}" ]; then
  hostnamectl set-hostname "${SIGNAGE_HOSTNAME}"
  log "Hostname set to ${SIGNAGE_HOSTNAME}"
fi

log "=== First-boot complete. signage-firstboot.service will self-disable. ==="

# Idempotency: remove preseed API URL so second-boot is a no-op
# (Do NOT remove the whole file; leave it as a reference for operators)
sed -i 's|^SIGNAGE_API_URL=.*|# SIGNAGE_API_URL already applied — edit and reboot to re-apply|' \
  "${PRESEED}" 2>/dev/null || true
```

**Idempotency:** The `ConditionPathExists=/boot/firmware/signage.conf` guard in the service unit
means the service is skipped if the file is absent. The URL substitution in unit files is safe to
repeat (sed -i on already-substituted values is idempotent if the pattern no longer matches).
The self-disable (`ExecStartPost`) means the service does not run again after a successful boot
even if signage.conf still exists.

---

## Installer-Library Skeleton

File: `scripts/lib/signage-install.sh`

```bash
#!/usr/bin/env bash
# scripts/lib/signage-install.sh
# Shared installer library for:
#   - scripts/provision-pi.sh (runtime, booted Pi, root context)
#   - pi-image/stage-signage/01-run-chroot.sh (build-time, pi-gen chroot)
#
# All functions require root. Source this file; do not execute it directly.
# Set SIGNAGE_BUILD_CONTEXT="chroot" when sourcing from pi-gen stage.

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
_info()  { echo -e "${GREEN}[signage-install]${NC} $*"; }
_warn()  { echo -e "${YELLOW}[signage-install] WARN:${NC} $*"; }
_error() { echo -e "${RED}[signage-install] ERROR:${NC} $*" >&2; }

SIGNAGE_PACKAGES=(
  chromium-browser unclutter-xfixes labwc seatd
  fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto-core fonts-dejavu-core
  python3-venv python3-pip git ca-certificates curl network-manager
)

install_signage_packages() {
  # Signature: install_signage_packages()
  # Installs all required system packages.
  # In chroot context: apt-get update is called unconditionally.
  # In runtime context: same behavior.
  _info "Installing system packages..."
  apt-get update -qq
  apt-get install -y --no-install-recommends "${SIGNAGE_PACKAGES[@]}"
  _info "System packages installed."
}

create_signage_user() {
  # Signature: create_signage_user()
  # Creates 'signage' user with required groups. Idempotent.
  _info "Creating 'signage' user..."
  if id signage >/dev/null 2>&1; then
    usermod -aG video,audio,render,input signage
    _info "User 'signage' exists — group membership updated."
  else
    useradd -m -s /bin/bash -G video,audio,render,input signage
    _info "User 'signage' created."
  fi
  # Ensure .config/systemd/user/ directory tree exists
  install -d -m 0755 -o signage -g signage /home/signage/.config
  install -d -m 0755 -o signage -g signage /home/signage/.config/systemd
  install -d -m 0755 -o signage -g signage /home/signage/.config/systemd/user
}

create_signage_directories() {
  # Signature: create_signage_directories()
  # Creates /var/lib/signage/ (cache, 0700) and /opt/signage/ (0755).
  _info "Creating signage directories..."
  install -d -m 0700 -o signage -g signage /var/lib/signage
  install -d -m 0700 -o signage -g signage /var/lib/signage/media
  install -d -m 0755 -o signage -g signage /opt/signage
  _info "Directories created."
}

deploy_systemd_units() {
  # Signature: deploy_systemd_units <api_url> <signage_uid>
  # Copies scripts/systemd/*.service to /home/signage/.config/systemd/user/
  # Substitutes __SIGNAGE_API_URL__ and __SIGNAGE_UID__ via sed.
  local api_url="${1}"
  local signage_uid="${2}"
  local unit_src_dir

  if [ "${SIGNAGE_BUILD_CONTEXT:-}" = "chroot" ]; then
    unit_src_dir="/opt/signage/scripts/systemd"
  else
    unit_src_dir="${SCRIPT_DIR}/../scripts/systemd"
  fi
  local unit_dest_dir="/home/signage/.config/systemd/user"

  _info "Deploying systemd unit files (URL=${api_url}, UID=${signage_uid})..."
  for unit in labwc.service signage-sidecar.service signage-player.service; do
    local src="${unit_src_dir}/${unit}"
    [ -f "${src}" ] || { _error "Unit template not found: ${src}"; exit 3; }
    sed \
      -e "s|__SIGNAGE_API_URL__|${api_url}|g" \
      -e "s|__SIGNAGE_UID__|${signage_uid}|g" \
      "${src}" > "${unit_dest_dir}/${unit}"
    chmod 0644 "${unit_dest_dir}/${unit}"
    _info "  Deployed ${unit}"
  done
  chown -R signage:signage /home/signage/.config/systemd
}

setup_sidecar_venv() {
  # Signature: setup_sidecar_venv()
  # Creates /opt/signage/pi-sidecar/.venv/ and installs requirements.
  # Pre-compiles bytecode for ProtectSystem=strict compatibility.
  local sidecar_dir="/opt/signage/pi-sidecar"
  local venv_dir="${sidecar_dir}/.venv"
  local requirements="${sidecar_dir}/requirements.txt"

  _info "Setting up sidecar Python venv..."
  [ -d "${venv_dir}" ] || python3 -m venv "${venv_dir}"

  if [ -f "${requirements}" ]; then
    "${venv_dir}/bin/pip" install --no-cache-dir -r "${requirements}"
  else
    _warn "requirements.txt not found at ${requirements}; installing locked defaults."
    "${venv_dir}/bin/pip" install --no-cache-dir \
      fastapi==0.115.12 uvicorn==0.34.0 httpx==0.28.1
  fi

  _info "Pre-compiling venv bytecode..."
  "${venv_dir}/bin/python" -m compileall "${venv_dir}/lib" -q 2>/dev/null || true

  chown -R signage:signage "${venv_dir}"
  _info "Sidecar venv ready."
}

enable_linger_signage() {
  # Signature: enable_linger_signage()
  # In chroot: creates /var/lib/systemd/linger/signage (direct file, no loginctl).
  # In runtime: calls loginctl enable-linger signage.
  if [ "${SIGNAGE_BUILD_CONTEXT:-}" = "chroot" ]; then
    _info "Enabling linger via /var/lib/systemd/linger/signage (chroot mode)..."
    mkdir -p /var/lib/systemd/linger
    touch /var/lib/systemd/linger/signage
  else
    _info "Enabling linger via loginctl..."
    loginctl enable-linger signage
  fi
}

force_wayland_if_pi3() {
  # Signature: force_wayland_if_pi3()
  # RUNTIME ONLY. Reads /proc/device-tree/model. No-op in chroot.
  if [ "${SIGNAGE_BUILD_CONTEXT:-}" = "chroot" ]; then
    return 0
  fi
  local pi_model
  pi_model=$(cat /proc/device-tree/model 2>/dev/null | tr '\0' '\n' | head -1 || echo "unknown")
  if echo "${pi_model}" | grep -q "Raspberry Pi 3"; then
    _info "Pi 3B detected — forcing Wayland via raspi-config..."
    raspi-config nonint do_wayland W2 2>/dev/null || \
      _warn "raspi-config do_wayland W2 failed (best-effort)."
  fi
}
```

---

## Release Workflow Skeleton

File: `.github/workflows/pi-image.yml`

```yaml
name: Build and publish Pi signage image

on:
  push:
    tags:
      - 'v1.17.*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag (e.g. v1.17.0)'
        required: true

jobs:
  build-image:
    name: Build, sign, and publish
    runs-on: [self-hosted, linux, arm64]   # <-- Hetzner CAX21 runner label
    timeout-minutes: 90

    permissions:
      contents: write    # needed for gh release upload

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          submodules: recursive   # if pi-gen is a git submodule

      - name: Determine release tag
        id: tag
        run: |
          TAG="${GITHUB_REF_NAME:-${{ github.event.inputs.tag }}}"
          echo "tag=${TAG}" >> "${GITHUB_OUTPUT}"
          echo "date=$(date -u +%Y-%m-%d)" >> "${GITHUB_OUTPUT}"

      - name: Verify disk space
        run: |
          df -h .
          AVAIL=$(df --output=avail -BG . | tail -1 | tr -d 'G')
          [ "${AVAIL}" -ge 15 ] || { echo "ERROR: Less than 15 GB free"; exit 1; }

      - name: Build pi-gen image
        working-directory: pi-image
        env:
          IMG_DATE: ${{ steps.tag.outputs.date }}
        run: |
          # Copy config overrides and run build
          cp config pi-gen/config
          cd pi-gen
          # Ensure arm64 branch is checked out (should be handled by submodule)
          git branch --show-current
          sudo ./build-docker.sh -c ../config
          echo "Build complete."
          ls -lh deploy/

      - name: Rename and checksum image
        id: artifact
        run: |
          TAG=${{ steps.tag.outputs.tag }}
          DATE=${{ steps.tag.outputs.date }}
          IMG_NAME="raspios-bookworm-arm64-signage-${TAG}-${DATE}.img.xz"
          ORIG=$(ls pi-image/pi-gen/deploy/*.img.xz | head -1)
          cp "${ORIG}" "${IMG_NAME}"
          sha256sum "${IMG_NAME}" > "${IMG_NAME}.sha256"
          echo "img=${IMG_NAME}" >> "${GITHUB_OUTPUT}"
          echo "sha256=$(cut -d' ' -f1 ${IMG_NAME}.sha256)" >> "${GITHUB_OUTPUT}"

      - name: Sign with minisign
        env:
          MINISIGN_SECRET_KEY: ${{ secrets.MINISIGN_SECRET_KEY }}
        run: |
          IMG=${{ steps.artifact.outputs.img }}
          echo "${MINISIGN_SECRET_KEY}" > /tmp/minisign.sec
          chmod 600 /tmp/minisign.sec
          # Sign without password prompt (key must be stored unencrypted in secret,
          # or use MINISIGN_PASSWORD env var if key is passphrase-protected)
          minisign -Sm "${IMG}" \
                   -s /tmp/minisign.sec \
                   -t "KPI Dashboard ${{ steps.tag.outputs.tag }} release $(date -u +%Y-%m-%d)"
          rm -f /tmp/minisign.sec
          ls -lh "${IMG}" "${IMG}.minisig"

      - name: Create GitHub Release and upload assets
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          TAG=${{ steps.tag.outputs.tag }}
          IMG=${{ steps.artifact.outputs.img }}
          SHA256=${{ steps.artifact.outputs.sha256 }}
          gh release create "${TAG}" \
            --title "KPI Dashboard ${TAG}" \
            --notes "See RELEASE_TEMPLATE.md for details. SHA256: ${SHA256}" \
            --draft \
            "${IMG}" "${IMG}.sha256" "${IMG}.minisig" \
            pi-image/minisign.pub

      - name: Cleanup
        if: always()
        run: |
          rm -f /tmp/minisign.sec
          # Optionally remove large work files to free disk
          sudo rm -rf pi-image/pi-gen/work/ || true

```

**Operator verification commands (documented in `pi-image/README.md`):**

```bash
# 1. Download assets from GitHub Releases:
#    raspios-bookworm-arm64-signage-v1.17.0-2026-04-20.img.xz
#    raspios-bookworm-arm64-signage-v1.17.0-2026-04-20.img.xz.sha256
#    raspios-bookworm-arm64-signage-v1.17.0-2026-04-20.img.xz.minisig
#    minisign.pub

# 2. Verify SHA256 checksum:
sha256sum -c raspios-bookworm-arm64-signage-v1.17.0-2026-04-20.img.xz.sha256

# 3. Verify minisign signature:
minisign -Vm raspios-bookworm-arm64-signage-v1.17.0-2026-04-20.img.xz \
         -p minisign.pub
# Expected output: Signature and comment signature verified

# 4. Flash with Raspberry Pi Imager:
#    - Choose Custom Image → select .img.xz
#    - OS Customisation → set hostname, SSH, Wi-Fi
#    - Write → Edit /boot/firmware/signage.conf on the SD card
#    - Eject → insert in Pi → power on
```

**minisign installation for operators:**
- **Linux:** `apt install minisign` (Debian/Ubuntu) or download from GitHub releases
- **macOS:** `brew install minisign`
- **Windows:** Download `minisign-windows-x86_64.zip` from
  https://github.com/jedisct1/minisign/releases and extract

---

## Recommended Plan Breakdown

Four atomic plans, in execution order.

### Plan A: pi-gen pipeline setup (Wave 1)

**Objective:** Create the `pi-image/` directory structure, pi-gen config, stage-signage scaffold,
and installer library. Everything needed to run a build — even before the build produces a
working kiosk.

**Files created/modified:**
- `pi-image/config` (new)
- `pi-image/stage2/SKIP_IMAGES` (new, empty)
- `pi-image/stage-signage/` (new directory with EXPORT_IMAGE, prerun.sh, 00-packages-nr,
  01-run-chroot.sh)
- `pi-image/stage-signage/signage-firstboot.service` (new)
- `pi-image/stage-signage/signage.conf.template` (new)
- `scripts/lib/signage-install.sh` (new)
- `scripts/provision-pi.sh` (refactored to source the library)
- `scripts/firstboot.sh` (new)

**Wave 1 — no upstream dependencies.**

### Plan B: first-boot preseed and oneshot service (Wave 1, parallel with A or Wave 2)

**Objective:** Implement and locally test the `signage-firstboot.service` + `firstboot.sh` logic.
Verify: (a) reads `signage.conf`, (b) writes `/etc/signage/config`, (c) patches unit files,
(d) self-disables, (e) idempotent on second run.

**Files created/modified:**
- `scripts/firstboot.sh` (new — may be authored in Plan A; Plan B adds tests)
- `.planning/phases/49-pi-image-build/49-FIRSTBOOT-TEST.md` (record of manual test runs)

**Depends on Plan A** (library + service file must exist). **Wave 2.**

### Plan C: release workflow and signing (Wave 2, parallel with B)

**Objective:** Create the GitHub Actions workflow, set up the self-hosted Hetzner runner,
generate and store the minisign key pair, and do one end-to-end build + sign + upload dry run.

**Files created/modified:**
- `.github/workflows/pi-image.yml` (new)
- `pi-image/minisign.pub` (new — public key committed to repo)
- `pi-image/README.md` (new — operator flash procedure + verify commands)
- `.github/RELEASE_TEMPLATE.md` (new)
- GitHub Actions secret `MINISIGN_SECRET_KEY` (runner setup, documented in plan)

**Depends on Plan A** (pi-image/ structure must exist to reference). **Wave 2.**

### Plan D: real-hardware E2E walkthrough (Wave 3 — gating)

**Objective:** Flash the built image to a real Pi 4, run the SGN-IMG-08 E2E walkthrough, record
results in `49-E2E-RESULTS.md`. This plan gates v1.17 completion.

**Files created/modified:**
- `.planning/phases/49-pi-image-build/49-E2E-RESULTS.md` (new — walkthrough record)

**Depends on Plans A, B, C** (working image + firstboot + CI build required). **Wave 3.**

---

## Common Pitfalls

### Pitfall 1: Wrong pi-gen branch (32-bit vs 64-bit)
**What:** `RPi-Distro/pi-gen` `master` branch builds armhf (32-bit) images.
**Cause:** The `arm64` branch is a separate branch, not a config option.
**Fix:** `git checkout arm64` or pin the submodule to a commit on the `arm64` branch.
**Detection:** The resulting image boots but `uname -m` shows `armv7l` instead of `aarch64`.

### Pitfall 2: pi-gen disk space exhaustion mid-build
**What:** Build fails with "No space left on device" after 20–40 minutes.
**Cause:** pi-gen stages ~10–15 GB of work files, then copies them. Runners with < 20 GB free
fail silently or with misleading errors.
**Fix:** Ensure ≥ 20 GB free before build. On Hetzner CAX21 (80 GB), wipe `pi-gen/work/` from
previous runs: `sudo rm -rf pi-image/pi-gen/work/`.
**Detection:** Check `df -h` before the build step in CI.

### Pitfall 3: `loginctl enable-linger` inside chroot prints "Running in chroot, ignoring request"
**What:** The command appears to succeed (exit 0) but does nothing.
**Cause:** logind is not running inside the pi-gen chroot.
**Fix:** Use `mkdir -p /var/lib/systemd/linger && touch /var/lib/systemd/linger/signage` instead.
**Detection:** After flashing, `loginctl show-user signage` does not show `Linger=yes`.

### Pitfall 4: `systemctl --user enable` fails in chroot
**What:** Any `systemctl --user` command in `01-run-chroot.sh` fails because systemd is not running.
**Cause:** The chroot has no init process.
**Fix:** Do NOT call `systemctl --user enable` in the chroot. Instead, manually create the
symlink: `ln -sf /home/signage/.config/systemd/user/signage-sidecar.service
/home/signage/.config/systemd/user/default.target.wants/signage-sidecar.service`
**Detection:** Error "Failed to connect to bus" in chroot stage output.

### Pitfall 5: `__SIGNAGE_API_URL__` placeholder not substituted before kiosk start
**What:** Chromium launches with `--app=http://__SIGNAGE_API_URL__/player/` and shows an error page.
**Cause:** The firstboot service did not run (e.g., `signage.conf` was absent or
`SIGNAGE_API_URL` was blank).
**Fix:** `signage-firstboot.service` must check for blank `SIGNAGE_API_URL` and exit 1 (so the
failure is visible in journalctl).
**Detection:** `journalctl -u signage-firstboot` shows the error. `grep __SIGNAGE_API_URL__
/home/signage/.config/systemd/user/*.service` still matches.

### Pitfall 6: `prerun.sh` copies files from wrong repo root
**What:** `prerun.sh` cannot find `scripts/lib/signage-install.sh` or `pi-sidecar/`.
**Cause:** The `ROOTFS_DIR` is set by pi-gen, but the repo root path depends on where pi-gen is
invoked from. Relative paths in `prerun.sh` are fragile.
**Fix:** Use `$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)` to derive the repo root
from the script's own location. Verify the path with a `[ -f "${REPO_ROOT}/scripts/lib/signage-install.sh" ]` check at the top of `prerun.sh`.
**Detection:** `01-run-chroot.sh` fails with "source: /tmp/lib/signage-install.sh: not found".

### Pitfall 7: XZ compression level 9 makes the build exceed 60 minutes
**What:** The `xz -9` step takes 15–30 minutes on a 2-core runner (CAX11) for a 3.5 GB image.
**Cause:** `xz -9` is CPU-intensive. Single-threaded by default.
**Fix:** Use `xz -9 -T 0` (all available threads) in the GitHub Actions workflow step. On a
4-core CAX21, this reduces compression time from ~25 min to ~8 min.
**Alternative:** Use `xz -6 -T 0` for 90% of the compression benefit at 30% of the time.
**Detection:** Workflow timing shows 90+ minutes; `xz` process consuming all CPU.

### Pitfall 8: `/boot/firmware/` not mounted in pi-gen chroot when expected
**What:** `prerun.sh` tries to write `signage.conf` to `${ROOTFS}/boot/firmware/` but the
directory is empty.
**Cause:** In pi-gen, the boot partition (FAT32) is not automatically mounted in the chroot
filesystem. `${ROOTFS}/boot/firmware/` exists as an empty directory.
**Fix:** Write `signage.conf` to `${ROOTFS}/boot/firmware/signage.conf` from `prerun.sh` (which
runs on the host, not in chroot). pi-gen copies this directory into the FAT partition at image
assembly time.
**Alternative:** Use a stage2 prerun hook that runs after the boot partition is assembled.
**Detection:** The final `.img` has an empty `/boot/firmware/` — mount the first partition and
check with `ls`.

### Pitfall 9: Chromium crash dialog on second boot (recovery dialog)
**What:** After a clean firstboot followed by a reboot, Chromium shows "Restore pages? Chromium
didn't shut down correctly."
**Cause:** Chromium writes a "running" sentinel file. If the previous session ended without a
clean `SIGTERM` sequence (e.g., the unit was stopped by systemd before Chromium flushed), the
sentinel persists.
**Fix:** The existing `ExecStartPost` in `signage-player.service` already handles this:
`find ${CHROMIUM_PROFILE_DIR}/Default -name "Crash Reports" -type d -exec rm -rf {} +`
The `--disable-session-crashed-bubble` flag suppresses the dialog even if the sentinel persists.
Both mitigations should be kept.
**Detection:** HDMI output shows the Chromium restore dialog instead of the player.

### Pitfall 10: `venv` bytecode not pre-compiled — crash on first access under `ProtectSystem=strict`
**What:** Sidecar fails on first run with `ImportError` or `PermissionError` writing `.pyc` files.
**Cause:** When `ProtectSystem=strict` is set in `signage-sidecar.service`, `/opt/` is read-only
at runtime. Python cannot write compiled `.pyc` files to the venv if it hasn't pre-compiled them.
**Fix:** `setup_sidecar_venv()` runs `python3 -m compileall "${venv_dir}/lib" -q` after pip
install, and again after any venv update.
**Detection:** `journalctl --user -u signage-sidecar` shows `PermissionError` for `.pyc` writes.

### Pitfall 11: `signage-firstboot.service` runs before `/boot/firmware` is mounted
**What:** Firstboot fails because `/boot/firmware/signage.conf` is not found even though the file
was written at flash time.
**Cause:** `After=local-fs.target` should ensure the FAT partition is mounted, but on some Pi OS
Bookworm images the boot partition is mounted by a separate `boot-firmware.mount` unit.
**Fix:** Add `After=boot-firmware.mount` to `signage-firstboot.service` (or use
`After=local-fs-pre.target`). Alternatively, add a guard loop in `firstboot.sh` that waits up
to 10 seconds for `/boot/firmware/signage.conf` to appear.
**Detection:** `journalctl -u signage-firstboot` shows "signage.conf not found" but the file
exists on the card when mounted on a host PC.

### Pitfall 12: minisign secret key passphrase blocks CI
**What:** CI fails waiting for a passphrase prompt that never comes.
**Cause:** By default, `minisign -G` creates a passphrase-protected key.
**Fix:** Either generate the key with an empty passphrase (`minisign -G` and press Enter twice),
or set `MINISIGN_PASSWORD` env var in the CI step. Store the decision in the release runbook.
**Detection:** CI workflow hangs indefinitely on the minisign sign step.

### Pitfall 13: pi-gen `STAGE_LIST` not respected — all stages run
**What:** pi-gen runs stages 3/4/5 anyway, resulting in a ~7 GB full desktop image.
**Cause:** `STAGE_LIST` is only respected by `build.sh`, not by older versions of
`build-docker.sh` if the Docker container was built from a cached older image.
**Fix:** Force rebuild the Docker container: `CLEAN=1 ./build-docker.sh`. Pin the pi-gen commit
SHA to a known-good version that respects `STAGE_LIST` in Docker mode.
**Detection:** Final image is > 2.5 GB compressed; desktop packages present in image.

---

## Open Questions for the Planner

1. **Who owns `scripts/firstboot.sh` — Plan A or Plan B?** Plan A creates the file skeleton;
   Plan B implements and tests it. Recommended: Plan A creates the file with full content (not
   just skeleton), Plan B adds the manual test record. Planner to decide scope split.

2. **Pi-gen as git submodule vs. vendored copy.** Submodule is cleaner (tracks upstream,
   pinnable to SHA) but requires `git submodule update --init` in CI. Vendored copy is simpler
   but inflates repo size. Planner should pick one and specify the `git submodule add` command
   or the copy strategy.

3. **Hetzner CAX21 runner registration procedure.** Someone must create the Hetzner instance,
   install the GitHub Actions runner binary, configure it with the `arm64` label, and ensure
   it persists across restarts. Plan C should include explicit steps or reference an operator
   runbook for this.

4. **minisign key generation ceremony.** The private key must be generated once and stored as a
   GitHub Actions secret. If the key is lost, all future releases use a different key (breaking
   operator verification of old vs. new). Planner should specify who generates the key and how
   it is backed up (LastPass, 1Password, etc.).

5. **Should `pi-image/stage-signage/00-packages-nr` duplicate or reference the Phase 48 package
   list?** The list in `provision-pi.sh` step 1 and in `00-packages-nr` must stay in sync.
   Consider a single source-of-truth file (e.g., `scripts/packages.txt`) parsed by both.
   Planner should decide whether this refactor is in scope for Phase 49 or deferred.

6. **E2E hardware availability.** Plan D requires a Pi 4 with an HDMI display, a microSD card,
   and a Raspberry Pi Imager workstation. Planner should confirm hardware is available before
   committing Plan D to Wave 3.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | `build-docker.sh` for pi-gen | System-dependent — verify on runner | ≥ 20.x | `build.sh` with native chroot (requires `binfmt-support`) |
| minisign | Release signing | Needs install on runner | ≥ 0.11 | GPG (heavier operator UX) |
| xz | Image compression | Pre-installed on Debian/Ubuntu | Any | `gzip -9` (larger output) |
| gh CLI | GitHub Release upload | Pre-installed on GitHub-hosted; needs install on self-hosted | ≥ 2.x | `curl` to GitHub Releases API |
| GitHub self-hosted runner | Build job | Not yet configured | n/a | pi-gen-action on ubuntu-latest with QEMU (slower) |
| Real Pi 4 + display | SGN-IMG-08 E2E | Hardware-dependent | — | Cannot be substituted for hardware gate |

**Missing dependencies with no fallback:**
- Real Pi 4 with HDMI display (Plan D gate — cannot be emulated)

**Missing dependencies with fallback:**
- `minisign` → GPG (heavier)
- GitHub self-hosted runner → pi-gen-action on ubuntu-latest (slower, ~90–150 min)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual shell assertions + `systemd-analyze verify` for unit files |
| Quick run command | `bash -n scripts/lib/signage-install.sh && systemd-analyze verify pi-image/stage-signage/signage-firstboot.service` |
| Full suite command | Boot image in QEMU + SSH probe script (see §"QEMU smoke test") |
| Phase gate | Real-hardware E2E before `/gsd:verify-work` on Phase 49 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SGN-IMG-01 | pi-gen builds valid .img | Build smoke | `./build-docker.sh -c config` exits 0 | ❌ Wave A |
| SGN-IMG-02 | stage-signage installs packages, creates user, drops units | Build smoke + QEMU | SSH probe script | ❌ Wave B |
| SGN-IMG-03 | provision-pi.sh and chroot produce identical state | Manual diff | Side-by-side dpkg/stat comparison | ❌ Wave B |
| SGN-IMG-04 | Pairing code ≤ 60 s after firstboot | Hardware E2E | Timer in 49-E2E-RESULTS.md | ❌ Wave D |
| SGN-IMG-05 | Reproducible build | Build smoke | Two successive builds; md5sum /opt/signage | ❌ Wave A |
| SGN-IMG-06 | signage.conf preseed works | Hardware E2E | Operator flash + observe | ❌ Wave D |
| SGN-IMG-07 | firstboot.service reads, writes, self-disables | QEMU + hardware | SSH: `systemctl is-active signage-firstboot` | ❌ Wave B |
| SGN-IMG-08 | Real-hardware walkthrough | Hardware E2E | 49-E2E-RESULTS.md | ❌ Wave D |
| SGN-REL-01 | CI publishes signed .img.xz on tag | Integration | Push a v1.17.0-rc1 tag; inspect release | ❌ Wave C |
| SGN-REL-02 | pi-image/README.md complete | Manual review | Checklist in PR | ❌ Wave C |
| SGN-REL-03 | RELEASE_TEMPLATE.md present | Manual review | File exists check | ❌ Wave C |

### Wave 0 Gaps

- [ ] `pi-image/` directory does not exist — created in Plan A
- [ ] `scripts/lib/signage-install.sh` does not exist — created in Plan A
- [ ] `scripts/firstboot.sh` does not exist — created in Plan A/B
- [ ] `.github/workflows/pi-image.yml` does not exist — created in Plan C
- [ ] Self-hosted runner not registered — operator task in Plan C
- [ ] minisign not installed on runner — Plan C runner setup step

---

## Sources

### Primary (HIGH confidence)

1. [Zansara — Headless Wi-Fi setup Bookworm without Imager (2024-01-06)](https://www.zansara.dev/posts/2024-01-06-raspberrypi-headless-bookworm-wifi-config/) — confirms `firstrun.sh` path and format on Bookworm
2. [RPi Forums — Automated deployment headless Bookworm](https://forums.raspberrypi.com/viewtopic.php?t=361679) — firstrun.sh behavior on Bookworm
3. [RPi-Distro/pi-gen README (arm64 branch)](https://github.com/RPi-Distro/pi-gen/blob/arm64/README.md) — config file format, STAGE_LIST, SKIP_IMAGES, EXPORT_IMAGE, build-docker.sh
4. [usimd/pi-gen-action GitHub Marketplace](https://github.com/marketplace/actions/pi-gen-action) — non-interactive build, runner requirements
5. [Hetzner CAX11 specs — VPSBenchmarks](https://www.vpsbenchmarks.com/hosters/cax11) — 2 vCPU, 4 GB, 40 GB NVMe, €3.79/mo
6. [Oracle Cloud Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) — 4 OCPU Ampere A1, 24 GB RAM
7. [minisign official site](https://jedisct1.github.io/minisign/) — sign/verify commands, Ed25519, platform binaries
8. [Emulating a Raspberry Pi in QEMU — Interrupt/Memfault](https://interrupt.memfault.com/blog/emulating-raspberry-pi-in-qemu) — QEMU command, systemd working, display not working
9. [Cloud-init on Raspberry Pi OS — RPi official](https://www.raspberrypi.com/news/cloud-init-on-raspberry-pi-os/) — Trixie/Imager 2.0 cloud-init (confirms Bookworm still uses firstrun.sh)
10. [loginctl enable-linger alternative — systemd issue #12401](https://github.com/systemd/systemd/issues/12401) — `/var/lib/systemd/linger/` file workaround for chroot

### Secondary (MEDIUM confidence)

11. [Screenly Anthias — pi-gen fork](https://github.com/Screenly/pi-gen) — reference for signage stage structure
12. [QEMU raspi4b boot pi-gen image — pi-gen issue #827](https://github.com/RPi-Distro/pi-gen/issues/827) — raspi4b machine type issues with real RPi OS images
13. [Boot pi-gen image with QEMU — RPi Forums thread](https://forums.raspberrypi.com/viewtopic.php?t=351682) — QEMU firstrun.sh hang with systemd.run
14. [Hetzner CAX21 review 2025](https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/) — performance and pricing context
15. [Raspberry Pi Imager issue #637 — PiOS Bookworm](https://github.com/raspberrypi/rpi-imager/issues/637) — /boot/firmware path changes in Bookworm

### Tertiary (LOW confidence — flagged for validation)

16. pi-gen Docker build times (20–60 min range) — inferred from similar projects; no authoritative benchmark for Hetzner CAX21 + pi-gen
17. XZ compression time estimates — derived from known CPU/file-size relationships; actual times will vary

---

## Metadata

**Confidence breakdown:**
- Preseed format (Unknown 1): HIGH — multiple sources confirm `firstrun.sh` on Bookworm; cloud-init is Trixie/Imager-2.0-only
- pi-gen headless CI (Unknown 2): HIGH — official README explicitly documents `build-docker.sh` + `STAGE_LIST`
- Runner spec (Unknown 3): MEDIUM — Hetzner CAX21 specs verified; build times are inferred, not measured
- Image signing (Unknown 4): HIGH — minisign official docs + platform availability confirmed
- Stage numbering (Unknown 5): HIGH — official README documents `SKIP_IMAGES` + `EXPORT_IMAGE` mechanism
- Installer library (Unknown 6): HIGH — derived from direct source analysis of `provision-pi.sh`
- QEMU smoke test (Unknown 7): MEDIUM — systemd feasibility confirmed; Wayland limitation confirmed; exact command validated from community sources

**Research date:** 2026-04-20
**Valid until:** 2026-07-20 (pi-gen arm64 branch is stable; minisign API is stable; re-verify
if Bookworm Imager switches to cloud-init or if pi-gen changes `STAGE_LIST` behavior)
