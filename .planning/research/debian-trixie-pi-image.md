# Debian 13 "Trixie" aarch64 on Raspberry Pi — Go/No-Go Research

**Report date:** 2026-04-20
**Author:** GSD Research Agent
**Scope:** Decision document for a potential v1.17 "Pi Image Release" phase. Covers whether switching from Raspberry Pi OS Bookworm to Debian 13 Trixie (either upstream or RPi-flavoured) is viable for the Phase 48 signage kiosk stack.
**No code changes proposed.** This is a scoping spike only.

---

## Decision Verdict

**CONDITIONAL-GO — targeting Raspberry Pi OS Trixie (not upstream Debian Trixie)**

The user-facing question was "can we switch from Bookworm to Trixie?" The answer is **yes, if we use Raspberry Pi OS Trixie** — the RPi Foundation's own Trixie-based distribution released in October 2025. That product ships the RPi-patched Chromium (version 140+ as of release, 142 in the November 2025 update), labwc 0.8.1 (bumped to 0.9.4 in November 2025), hardware video decode on Pi 4, and a Trixie-native archive at `archive.raspberrypi.com/debian/` covering the `trixie` suite. The original Phase 48 blocker — "`chromium-browser` only exists for Bookworm" — is resolved.

**The critical catch:** The package name changed. On Raspberry Pi OS Trixie the RPi-patched browser is installed as `chromium` (not `chromium-browser`), and the binary is `/usr/bin/chromium` (not `/usr/bin/chromium-browser`). The Phase 48 systemd unit `signage-player.service` hardcodes `ExecStart=/usr/bin/chromium-browser`. That one line needs updating for Trixie. The `raspi.list` guard in `provision-pi.sh` (Step 0.5) also needs updating to check for `trixie` in the suite field. Both are one-line changes. The remainder of the Phase 48 stack (sidecar, labwc unit, fonts, systemd ordering) is compatible.

**What this is NOT a go for:** Upstream Debian Trixie (without the RPi packages layer). That path is theoretically possible but requires additional manual work to obtain RPi firmware, kernel, and GPU blobs, and it gives you `chromium` from Debian main (version ~130/131 at freeze, updated to ~146 via `trixie-security`) without the v4l2 H.264 decode patches. For a production signage device, Raspberry Pi OS Trixie is the correct choice.

**Effort to enable:** Small (2/5). The required change to the existing Phase 48 deliverables is two lines of code and a documentation update. The image-building pipeline (rpi-image-gen or pi-gen) is an additive v1.17 task that does not touch Phase 48 logic.

---

## Q1: Trixie on Pi — Boot, Kernel, Firmware, Imager

### 1a. Does Trixie boot cleanly on Pi 3B, 4, and 5?

**Raspberry Pi OS Trixie (recommended path):** YES, on all three.

Raspberry Pi OS Trixie was released 2025-10-01 and updated on 2025-11-24 and 2025-12-04. [1] It supports the full hardware range from Pi Zero through Pi 5, Pi 400, Pi 500, and Compute Modules. Pi 3B, Pi 4, and Pi 5 are all first-class targets. The kernel is the RPi-patched Linux 6.12 series (`linux-image-6.12.57+deb13-arm64` and later `6.12.73+deb13-rpi`). [2]

**Upstream Debian Trixie (not recommended):** PARTIAL.

Upstream Debian 13.3 (released 2026-01-10 [3]) provides `raspi-firmware` and `linux-image-rpi` packages from `packages.debian.org`. Documented community attempts show successful boots on Pi 3B and Pi 4 using Debian's arm64 packages plus `raspi-firmware` from Debian main. [4] Pi 5 (BCM2712) requires the `linux-image-6.12.34+deb13-rpi-2712` kernel package. However, the upstream path requires manual configuration of `/boot/firmware/` (which moved from `/boot` in Bookworm), manual kernel package selection, and GPU blob sourcing. Community reports rate this as "works but painful." [5]

**Verdict for this project:** Use Raspberry Pi OS Trixie. Do not attempt upstream Debian Trixie for a production deployment.

### 1b. Bootloader and firmware blobs on Trixie

Raspberry Pi OS Trixie ships firmware via `archive.raspberrypi.com/debian/trixie`. The packages `raspberrypi-bootloader` and `rpi-eeprom` continue to be published for the `trixie` suite. [1] On Pi 5, `rpi-eeprom` manages the EEPROM firmware update mechanism. Debian's own `raspi-firmware` package covers Pi 0/1/2/3/4 families and is available in Debian Trixie main (`packages.debian.org/trixie/raspi-firmware`). [6] The two are not interchangeable — RPi OS Trixie uses the RPi archive's firmware packages.

**`/boot` → `/boot/firmware` migration:** This change landed in Bookworm and carries forward into Trixie. Any provision script referencing `/boot/config.txt` must use `/boot/firmware/config.txt`. [7] The Phase 48 `provision-pi.sh` references `raspi-config nonint do_wayland W2` (Step 9), which internally knows the correct path. No change needed there.

### 1c. Raspberry Pi Imager and preseed

Raspberry Pi Imager 2.0.0 was released 2025-11-24 and is the required version for Trixie images. [8] It switches from the legacy `firstrun.sh` approach to `cloud-init` format for first-boot customisation. Imager 1.8.5 and older **will not apply custom settings** (hostname, SSH, Wi-Fi) to Trixie images. [9]

**Non-RPiOS custom images:** Imager 2.0 supports customisation for custom images only when the image is served from a repository with a JSON manifest. Locally flashed `.img` files do not get the customisation UI. [10] This matters for the v1.17 image distribution plan — see Q8.

**Preseed of `SIGNAGE_API_URL` at flash time:** This is not supported out of the box for custom images in Imager 2.0. Workaround: include a cloud-init `user-data` file baked into the image that reads a config file from a second partition (a pattern used by some kiosk builders). Alternative: document the `git clone + provision-pi.sh` flow (Phase 48 D-3) unchanged.

**Confidence:** HIGH (Imager 2.0 release confirmed [8]; cloud-init switch confirmed [11]; firstrun.sh deprecation confirmed [9]).

---

## Q2: Chromium on Trixie aarch64

### 2a. Does Debian Trixie ship `chromium` in main?

YES. Debian Trixie ships `chromium` in `main` for `arm64` (aarch64). The version available via `trixie-security` as of April 2026 is **146.0.7680.164-1~deb13u1**. [12] This is the stock Debian Chromium build, without RPi GPU patches.

Trixie's package freeze began in early 2025; the initial packaged Chromium version was approximately 131/132 (Debian's policy for stable is to ship the current ESR-equivalent and update it via `trixie-security`). Firefox and Chromium are explicitly allowed to receive major-version updates in stable for security reasons. [13] Point release 13.2 (November 2025) updated Chromium to ~146 in the security channel.

### 2b. Is there a Pi-branded `chromium-browser` for Trixie?

PARTIAL — the RPi-patched Chromium is published for Trixie, but **the package name changed from `chromium-browser` to `chromium`**.

Evidence:
- The GitHub repository `RPi-Distro/chromium` has a `pios/trixie` branch with active development. [14]
- Multiple RPi community sources confirm: "chromium-browser doesn't exist on Trixie; the package to use is `chromium` from the RPi archive." [15][16]
- The RPi archive index at `archive.raspberrypi.org/debian/pool/main/c/chromium-browser/` still shows Bookworm-era `.deb` files — the Trixie package was moved to a `chromium` source package. [17]
- The RPi-patched Chromium on Trixie is version **140** (initial Trixie release, October 2025) and **142** (November 2025 update). [18][19]

**Binary path impact:**

| OS version | Package name | Binary |
|------------|-------------|--------|
| RPi OS Bookworm | `chromium-browser` | `/usr/bin/chromium-browser` |
| RPi OS Trixie | `chromium` | `/usr/bin/chromium` |

This is a **breaking change** for the Phase 48 systemd unit `scripts/systemd/signage-player.service`, which hardcodes `ExecStart=/usr/bin/chromium-browser`. One-line fix required.

### 2c. What RPi-specific patches exist, and are any upstream?

The RPi Chromium fork (`RPi-Distro/chromium`) applies patches in three categories [14]:

1. **V4L2 stateful H.264 decoder plugin** — enables hardware video decode via `/dev/video10` on Pi 3B/4 (BCM2837/BCM2711). These patches are NOT upstream in the Chromium project. They are maintained exclusively by the RPi team and are the primary reason to prefer `chromium` from `archive.raspberrypi.com` over `chromium` from Debian main.

2. **`rpi-chromium-mods`** — a supplementary package with Pi-specific launcher script, flags injection (`/etc/chromium/policies/`), preloaded extensions (h264ify, uBlock Origin Lite as of Trixie). Also sets memory pressure thresholds for 1GB devices.

3. **Power management and GPU compositor tweaks** — patches enabling `--enable-features=VaapiVideoDecoder` path wired to the V4L2 backend. Not upstream.

**The h264ify extension** is no longer needed on Pi 4 under RPi OS Trixie's Chromium (v4l2 H.264 decode handles it natively), but it is still shipped pre-installed for compatibility. On Pi 5 it remains relevant because the Pi 5's BCM2712 lacks an H.264 hardware decoder block entirely (see Q4).

**Confidence:** MEDIUM. Package name confirmed by multiple community and forum sources [15][16][18][19]. Exact patch content from `RPi-Distro/chromium` GitHub tree [14]. Version numbers from forum posts and Phoronix release notes [19].

---

## Q3: Wayland Kiosk on Trixie

### 3a. Does the SGN-OPS-03 flag set work with labwc on Trixie?

**YES, with one binary name correction.**

The Phase 48 CONTEXT.md locks the Chromium flag set:
```
--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required
--disable-session-crashed-bubble --ozone-platform=wayland --app=<url>
```

This flag set is confirmed working on Raspberry Pi OS Trixie with labwc. Multiple community kiosk guides from late 2025 and early 2026 use this exact combination. [20][21] The only required change is replacing `/usr/bin/chromium-browser` with `/usr/bin/chromium` in `signage-player.service`.

Key fact: **labwc is the default Wayland compositor on Raspberry Pi OS Trixie** (and has been since October 2024 on Bookworm). Trixie ships labwc 0.8.1 initially, updated to 0.9.4 in the November 2025 release. [18][19] The compositor itself is identical to Bookworm's labwc — no migration needed for the `labwc.service` systemd unit.

### 3b. Known Chromium bugs on Trixie/labwc/Pi hardware

**Active known issues (as of April 2026):**

1. **Compose key input not passing through Chromium full-screen on Wayland (Pi 500 / labwc).** Filed as `raspberrypi/trixie-feedback#21`. [22] Not relevant to kiosk use (kiosk has no keyboard input for character composition).

2. **Squeekboard (on-screen keyboard) not appearing over Chromium full-screen** — labwc-layer-shell protocol gap. Filed 2025. [20] Not relevant (kiosk uses no on-screen keyboard).

3. **mpv "performs horribly" on Trixie** without manual config tuning — relevant if mpv is used as a video fallback (see Q4). VLC is the better fallback choice.

4. **Pi 1GB RAM Wayland regression:** On RPi OS Trixie, Pi 4 with 1GB RAM **defaults to X11** rather than Wayland. The RAM threshold for Wayland as default was raised. [23] This directly affects Pi 3B (always 1GB) and Pi 4 1GB variant. The `provision-pi.sh` Step 9 already handles this via `raspi-config nonint do_wayland W2` for Pi 3B detection. On a Pi 4 1GB, the same `raspi-config` command must be called. The provision script's current detection (`grep "Raspberry Pi 3"`) would need to be broadened to also catch Pi 4 1GB or simply call `do_wayland W2` unconditionally.

**DRM leases and seatd:** The `seatd` package continues to exist in Trixie and functions identically. `signage-sidecar.service` and `labwc.service` are unaffected.

**Confidence:** HIGH for flag compatibility (multiple 2025 community reports). MEDIUM for Pi 3B/4-1GB Wayland default regression (forum evidence only, not official docs).

---

## Q4: Hardware Video Decode

### 4a. H.264 decode via Chromium on Trixie aarch64

The situation differs by Pi model:

| Pi Model | SoC | H.264 HW block | Chromium HW decode | Fallback |
|----------|-----|---------------|---------------------|---------|
| Pi 3B | BCM2837 | YES (OpenMAX IL / V4L2 M2M) | Partial — high CPU overhead under Wayland; 1080p30 feasible | Software decode (CPU ~50-70%) |
| Pi 4 | BCM2711 | YES (V4L2 stateless) | YES — works via RPi-patched Chromium v4l2 plugin | Software decode |
| Pi 5 | BCM2712 | **NO** H.264 block | **NO** — falls back to software decode | Software A76 CPUs fast enough for 1080p30 software |

**Pi 4 is the primary recommendation** for H.264 video playlist items. The RPi-patched Chromium on Trixie includes the v4l2 H.264 decoder plugin (`/dev/video10`). Users can verify with `sudo lsof /dev/video10` during playback. [24]

**Pi 5 — H.264 in software:** The BCM2712 removed the dedicated H.264 hardware block. Its Quad-Core Cortex-A76 CPUs can software-decode H.264 1080p30 at full speed. Hardware HEVC (H.265) is available via V4L2 stateless, but Chromium's HEVC path is not functional in the RPi build as of April 2026. [25][26] For a signage stack that uses H.264 MP4 items, Pi 5 is effectively software-decode only — which is fine for 1080p30 but may be insufficient for 4K or 1080p60 HLS streams.

**Pi 3B — H.264 in Chromium:** The 1GB RAM constraint and older V4L2 stack make hardware decode in Chromium unreliable at 1080p. 720p H.264 is a safer target. [27]

### 4b. VLC/mpv as fallback for video items

**VLC on Trixie:** Fully supported. Raspberry Pi actively maintains VLC patches. VLC uses V4L2 M2M directly (bypassing Chromium's renderer), giving it reliable H.264 hardware decode on Pi 4 even in cases where Chromium's GPU path is unstable. [28]

**mpv on Trixie:** Works but requires manual configuration of the `hwdec` option in `~/.config/mpv/mpv.conf`. Without this, mpv defaults to software decode and performs poorly on Pi. [29] Not recommended as a first-choice fallback given the configuration overhead.

**The Phase 48 stack uses Chromium for all media rendering** (video, image, PDF). A VLC fallback would require significant frontend changes (native window overlay, IPC to trigger playback) — out of scope for Phase 48 and incompatible with the frozen player contract. VLC is mentioned here only as a system-level check tool, not as a drop-in replacement.

**Confidence:** HIGH for Pi 5 H.264 limitation (official RPi forum confirmed [25]). HIGH for Pi 4 V4L2 working (multiple sources [24][28]). MEDIUM for Pi 3B 1080p feasibility (limited Trixie-specific reports).

---

## Q5: Image Builder Tooling

### 5a. Can pi-gen build a Trixie image?

YES. The official `pi-gen` tool (`RPi-Distro/pi-gen`) supports Trixie via `RELEASE=trixie ARCH=arm64`. The `arm64` branch of pi-gen is the correct branch. [30] pi-gen is historically RPi-OS-centric and does NOT build upstream Debian images — it always pulls from `archive.raspberrypi.com` plus official Debian mirrors, resulting in Raspberry Pi OS images.

**However, pi-gen is being superseded** by the newer `rpi-image-gen`.

### 5b. rpi-image-gen — the recommended tool

`rpi-image-gen` (GitHub: `raspberrypi/rpi-image-gen`) was released in 2025 by the Raspberry Pi Foundation specifically for building highly-customised production images. [31]

Key properties relevant to this project:
- Built on `mmdebstrap` (not debootstrap), enabling reproducible builds.
- Supports Trixie arm64 natively as a first-class host and target.
- Produces `.img` files compatible with Raspberry Pi Imager.
- Configuration-file-driven: a single YAML/JSON profile controls package selection, first-boot scripts, systemd unit injection, and partition layout.
- Fast: uses pre-built binary packages (no source compilation).
- Output: `work/image-*/image.img` (uncompressed) → compress with `xz -T0` for distribution.
- Requires `CAP_SYS_ADMIN` (needs root or a suitable container privilege). **Does not run in standard GitHub Actions without `--privileged`.** Requires a self-hosted runner or equivalent.

**Fitting rpi-image-gen to our use case:**

The target image would include:
- RPi OS Trixie Lite base packages
- `chromium`, `unclutter-xfixes`, `labwc`, `seatd`, `git`, `python3-venv`, fonts (Carlito, Caladea, Noto, DejaVu)
- The signage repo cloned to `/opt/signage` (or populated via a first-boot script)
- The `signage` user pre-created
- Systemd unit files dropped in place
- `loginctl enable-linger signage` called in a first-boot hook

This is conceptually identical to what `provision-pi.sh` does, but baked into the image rather than run post-flash.

### 5c. Alternative tools

| Tool | Verdict | Notes |
|------|---------|-------|
| `pi-gen` (RPi-Distro/pi-gen) | Use only if rpi-image-gen is unavailable | Older, bash-based, harder to extend; still officially supported for Trixie |
| `vmdb2` | Viable for upstream Debian only | Debian's own image builder; does not integrate RPi archive |
| `debos` | Viable but complex | YAML-driven, supports arm64 cross-build; requires QEMU user-static; good for upstream Debian images but RPi archive integration is manual |
| `mkosi` | Viable for systemd-centric images | Modern tool by systemd team; Trixie arm64 support exists; not RPi-archive-aware |
| `edi-pi` | Viable for Trixie arm64 | Community tool; generates Trixie arm64 images for Pi 2/3/4/5; less mature than rpi-image-gen |

**Recommendation:** Use `rpi-image-gen` for v1.17. It is the direction the Raspberry Pi Foundation is investing in, it supports Trixie natively, and its output is directly compatible with Raspberry Pi Imager.

### 5d. Build pipeline specifics

| Property | Estimate |
|----------|---------|
| Build duration | 15–45 minutes (native arm64 runner) |
| Build duration (QEMU cross-build) | 60–120 minutes (not formally supported by rpi-image-gen) |
| Output image uncompressed | ~2.8 GB (RPi OS Trixie Lite + our packages) |
| Output image compressed (.img.xz) | ~500–700 MB (based on published RPi OS Trixie Lite: 487 MiB [32]) |
| CI runner requirement | `--privileged` container or bare-metal arm64 (e.g., self-hosted Pi 4/5 runner) |
| Signing | SHA-256 checksum + GPG detached signature (standard pattern; rpi-image-gen has an open issue for GPG key injection [33]) |

**GitHub Actions limitation:** The 2 GB file size limit on GitHub Releases Assets is relevant. Our image at ~600 MB xz is well within limit. However, the build step itself requires a privileged runner — a standard GitHub-hosted ubuntu-latest runner cannot do this. A self-hosted Pi runner or a privileged Docker container (e.g., GitHub Actions `--privileged` mode on a compatible runner) is required.

**Confidence:** HIGH for rpi-image-gen Trixie support (official documentation [31]). MEDIUM for build time estimates (based on similar projects). LOW for exact image size with our package set (extrapolated from published lite image).

---

## Q6: Desktop / GUI Choice

The user mention of "a GUI" requires clarification in the context of the signage kiosk.

### 6a. Full desktop environments on Trixie + Pi

| Desktop | Available on Trixie | Wayland support | Pi performance | Verdict |
|---------|-------------------|----------------|----------------|---------|
| LXDE | YES (via Debian) | X11 only — no Wayland | Good (lightweight) | Legacy; avoid for new deployments |
| LXQt | YES | Partial Wayland (via Kwin or labwc) | Good | Viable but no RPi integration |
| Xfce | YES | Partial Wayland (Xfwm4 has experimental Wayland) | Good | Reasonable but not default RPi path |
| GNOME | YES | Full Wayland (Mutter) | Poor on Pi 4 1GB; OK on Pi 5 | Too heavy for kiosk; 1.5GB+ RAM |
| Raspberry Pi Desktop (labwc + custom taskbar) | YES (native to RPi OS Trixie) | Full Wayland | Excellent (optimised) | Default and recommended for RPi OS Trixie |

### 6b. Kiosk-only approach (labwc headless for signage, SSH for operator)

This is the Phase 48 approach and the correct design for a signage device:
- labwc starts as a systemd user service for the `signage` user
- Chromium runs in `--kiosk` mode, filling the entire display
- No taskbar, no file manager, no window chrome
- Operator access is SSH-only (pre-configured Wi-Fi via Imager, SSH key injected at flash time via cloud-init)
- The "GUI" the user sees is the signage player itself — not a desktop

**Recommendation:** Do not install a full desktop environment on the kiosk image. Use labwc + Chromium kiosk only. If operator debugging is needed, enable SSH and provide a text-mode diagnostic tool or a locked-down browser URL for a management interface. This matches Phase 48 D-3 and requires no change.

**Confidence:** HIGH (this is the Phase 48 design, confirmed working in research for Phase 48).

---

## Q7: Security and Update Cadence

### 7a. Debian Trixie security updates for Chromium

Debian maintains `trixie-security` (formerly `stable/updates`). Chromium is one of the packages explicitly exempted from the "no new upstream versions in stable" policy — major version updates are allowed for security. [13] As of April 2026, Chromium in Trixie is at 146.x with active security updates via DSAs (Debian Security Advisories).

Update cadence for Chromium in Trixie: approximately **every 2–4 weeks**, matching Chromium's upstream release cadence. This is better than Bookworm (which is effectively frozen without the RPi archive).

**RPi OS Trixie Chromium:** The RPi-patched Chromium (`chromium` from `archive.raspberrypi.com/debian/trixie`) receives updates independently from Debian security. The RPi team tracks the upstream Chromium stable channel. Gap between Chromium stable release and RPi package availability: typically **1–4 weeks**. This means the kiosk may run a Chromium version 1–2 milestones behind the latest at any given time.

For a kiosk serving an internal web app over a local network, a 4-week Chromium update lag is acceptable.

### 7b. RPi firmware and kernel updates under Trixie

The `archive.raspberrypi.com/debian/trixie` repository publishes kernel and firmware updates. On RPi OS Trixie, `sudo apt upgrade` fetches both Debian Trixie security updates (via `deb.debian.org`) and RPi-specific kernel/firmware updates (via the RPi archive). No separate mechanism is needed.

For a pre-baked image, the recommended pattern is:
1. Build the image with packages from a pinned snapshot date.
2. On first boot, run `apt update && apt upgrade` (idempotent) before starting the kiosk services.
3. Quarterly image rebuilds to reduce the delta applied at first boot.

### 7c. Realistic rebuild cadence

| Scenario | Rebuild cadence | Rationale |
|----------|---------------|-----------|
| Security-sensitive deployment | Monthly | Chromium CVE frequency |
| Standard signage deployment | Quarterly | Balance between freshness and rebuild effort |
| Stable enterprise deployment | Semi-annual | Acceptable lag for internal tool |

**Recommendation for v1.17:** Quarterly rebuilds, triggered by a scheduled CI job. Each rebuild produces a new `.img.xz` with a date-stamped filename and a SHA256 + GPG signature.

**Confidence:** HIGH for Trixie-security coverage (official Debian release notes [13]). MEDIUM for RPi archive update cadence (based on historical Bookworm patterns).

---

## Q8: Image Distribution

### 8a. Image size and hosting

| Format | Estimated size |
|--------|---------------|
| Uncompressed `.img` | ~2.8 GB |
| Compressed `.img.xz` | ~500–700 MB |
| Compressed `.img.xz` with our packages | ~600–900 MB (estimate; Chromium adds ~200 MB installed) |

**GitHub Releases:** Maximum individual file size is 2 GB. Our compressed image fits comfortably. GitHub Releases is the simplest hosting option for a project of this scale (fewer than 20 kiosks). No CDN required. [34]

**Self-hosted alternatives:** Cloudflare R2 (free 10 GB storage, 0 egress fees), Backblaze B2 (~$0.006/GB stored), S3-compatible. Only relevant at >20 kiosks or if monthly download volume exceeds GitHub Releases bandwidth (soft limit ~100 GB/month).

### 8b. Integrity signing

Standard pattern:
```bash
sha256sum raspios-trixie-arm64-signage-YYYYMMDD.img.xz > SHA256SUMS
gpg --detach-sign --armor SHA256SUMS
```

Publish `.img.xz`, `SHA256SUMS`, and `SHA256SUMS.asc` alongside each release. Operator verifies with `gpg --verify SHA256SUMS.asc && sha256sum -c SHA256SUMS`.

### 8c. Raspberry Pi Imager preseed for `SIGNAGE_API_URL` — does it work with a custom image?

**PARTIAL — requires workaround.**

Raspberry Pi Imager 2.0 (required for Trixie, released 2025-11-24) supports cloud-init customisation for custom images only via a repository JSON manifest. For a locally-downloaded `.img.xz` file selected via "Choose Custom," Imager **does not display the customisation dialog**. [10]

Workarounds for `SIGNAGE_API_URL` preseed:

1. **Cloud-init user-data baked into the image:** The image includes a placeholder `user-data` file in `/boot/firmware/`. Operator edits this file on the FAT partition before first boot (accessible from any OS without mounting ext4). The provision script reads `SIGNAGE_API_URL` from `/boot/firmware/signage-config` on first boot. This is the cleanest approach.

2. **Continue with Phase 48 D-3 approach:** Operator flashes the base image, SSHs in, and runs `sudo SIGNAGE_API_URL=... /opt/signage/scripts/provision-pi.sh`. This is exactly Phase 48's current design. The pre-baked image just skips the "clone the repo" step by having `/opt/signage` already populated.

3. **RPi Imager JSON manifest:** Publish the image through a JSON manifest (self-hosted or GitHub Pages). Imager will then offer the customisation dialog. More setup, more infrastructure.

**Recommendation for v1.17:** Use approach 1 (cloud-init `/boot/firmware/signage-config`) for operator-friendly preseed. This does not require Imager JSON manifest infrastructure.

**Confidence:** MEDIUM. Imager 2.0 custom image behaviour confirmed by bug reports and Imager changelog [10][8]. Cloud-init approach is documented by RPi Foundation [11].

---

## Effort Estimates

| Task | Effort (1–5) | Timeline | Dependency |
|------|-------------|----------|------------|
| Fix `provision-pi.sh` for Trixie (`chromium` vs `chromium-browser`, Pi 4 1GB Wayland) | 1 | 1 day | None |
| Fix `signage-player.service` binary path (`/usr/bin/chromium`) | 1 | 30 min | None |
| Update `raspi.list` guard check in provision script | 1 | 30 min | None |
| Update admin guide (package name change note) | 1 | 2 hours | None |
| Validate on real Pi 4 Trixie hardware | 3 | 2–3 days | Real hardware access |
| Set up rpi-image-gen pipeline | 3 | 3–5 days | Self-hosted arm64 runner |
| Port provision-pi.sh outputs to rpi-image-gen config | 2 | 2 days | rpi-image-gen setup |
| Image CI pipeline (build + sign + upload to GitHub Releases) | 3 | 2–3 days | Self-hosted runner, GPG key management |
| Cloud-init preseed mechanism for `SIGNAGE_API_URL` | 2 | 1–2 days | rpi-image-gen setup |
| End-to-end kiosk validation on Trixie image | 3 | 1–2 days | Real hardware + built image |

**Total v1.17 estimate:** 3–4 weeks for a solo developer with access to a Pi 4 or Pi 5.

---

## Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | **Binary name regression at Chromium update** — RPi Trixie Chromium is the `chromium` package; if RPi ever renames again (as they did from Bookworm to Trixie), the `signage-player.service` `ExecStart` breaks. | LOW | HIGH | Pin the binary path via a symlink created in `provision-pi.sh`: `ln -sf /usr/bin/chromium /usr/local/bin/signage-chromium`; point `ExecStart` at the symlink. Future renames only require updating the symlink, not the unit file. |
| 2 | **Pi 4 1GB defaults to X11 on Trixie** — Wayland requires > 1GB RAM as default on RPi OS Trixie; Pi 4 1GB + Pi 3B fall back to X11 silently. kiosk `--ozone-platform=wayland` flag fails to connect. | MEDIUM | HIGH | Provision script must call `raspi-config nonint do_wayland W2` unconditionally (not only on Pi 3B detection). Document Pi 3B as minimum-supported with caveats. |
| 3 | **RPi-patched Chromium lags upstream CVEs by 4+ weeks** — RPi's Chromium build takes 1–4 weeks to reach users after upstream release. For a device on a semi-trusted LAN serving internal content, this is generally acceptable but creates a risk window. | MEDIUM | MEDIUM | Document accepted risk in operator runbook. Enable `unattended-upgrades` in the image for the RPi archive. Include kernel and Chromium in auto-upgrade scope. |
| 4 | **H.264 playback regression on Pi 5** — Pi 5 has no H.264 hardware decoder block. Chromium falls back to software decode. At 1080p60 or complex content, CPU may saturate on a Pi 5 with multiple tabs/layers. | HIGH (Pi 5 only) | MEDIUM | Document Pi 4 as the recommended hardware for H.264 video-heavy playlists. If Pi 5 is deployed, recommend H.265 or AV1 encoded source media where the pipeline supports it. |
| 5 | **rpi-image-gen requires privileged CI runner** — Standard GitHub Actions runners cannot mount filesystems or create block devices. Build fails silently or with cryptic errors on a standard runner. | HIGH | MEDIUM | Use a self-hosted arm64 runner (Pi 4/5 works) or a privileged Docker container on a VPS. Document this infrastructure dependency explicitly in the v1.17 planning phase. |
| 6 | **Raspberry Pi Imager preseed not applied to custom images** — Operators who use Imager's "custom image" path without reading the docs will not see the Wi-Fi/hostname customisation dialog, leading to a headless device with no network access after flash. | MEDIUM | HIGH | Bake a `wpa_supplicant.conf` placeholder or cloud-init `network-config` template into `/boot/firmware/`. Include clear flashing instructions in the operator runbook that explain manual editing of the config files. |
| 7 | **Trixie kernel regression for Pi 3B** — Some early Trixie community testers on Pi 3B reported circular dependency issues during Bookworm-to-Trixie upgrade. Clean-install images were not affected. | LOW | MEDIUM | Always distribute as a clean image, never as an upgrade path. The provision script should be applied to a clean flash only. |
| 8 | **GStreamer H.265 hardware decode broken on Trixie** — A confirmed regression in Trixie: GStreamer HEVC hardware decode fails with "format UNKNOWN" on both Pi 4 and Pi 5. Affects any application using GStreamer for H.265 video. | HIGH | LOW (signage uses H.264 MP4 primarily) | Our video playlist items use H.264 MP4. If H.265 source material is added in a future phase, document the limitation and require server-side transcoding to H.264 before delivery to the Pi. |
| 9 | **mpv performance regression on Trixie** — mpv requires manual `hwdec=auto` configuration in `~/.config/mpv/mpv.conf` on Trixie to avoid software decode. Phase 48 does not use mpv directly, but operators who attempt to use mpv for diagnostics will be confused. | LOW | LOW | Document in operator runbook: "If using mpv for diagnostics, add `hwdec=auto` to `~/.config/mpv/mpv.conf`." |
| 10 | **Image size exceeds GitHub Releases 2 GB limit** — If Chromium (~200 MB installed), labwc, and other packages push the compressed image above 2 GB (very unlikely but possible). | LOW | LOW | Monitor image size in CI. If it exceeds 1.8 GB compressed, switch hosting to GitHub LFS or Cloudflare R2. |
| 11 | **Cloud-init vs firstrun.sh transition confusion** — Imager 2.0 uses cloud-init; Imager 1.x used firstrun.sh. Operators with older Imager versions applying custom settings to a Trixie image will see their settings silently dropped. | MEDIUM | MEDIUM | State "requires Imager 2.0.6 or newer" prominently in the image download page and operator runbook. Include a first-boot check that validates cloud-init ran successfully and logs a warning if not. |

---

## Comparison Table

| Property | Bookworm (current, Phase 48) | RPi OS Trixie (proposed) | Upstream Debian Trixie (option C) |
|----------|------------------------------|--------------------------|----------------------------------|
| **Chromium build** | `chromium-browser` from RPi archive (Bookworm); v136+ | `chromium` from RPi archive (Trixie); v140–146 | `chromium` from Debian main; v146 (no RPi patches) |
| **RPi V4L2 H.264 patches** | YES (in `chromium-browser`) | YES (in `chromium`) | NO — stock Chromium; no V4L2 H.264 plugin |
| **Binary path** | `/usr/bin/chromium-browser` | `/usr/bin/chromium` | `/usr/bin/chromium` |
| **Wayland kiosk (labwc)** | Working; confirmed in Phase 48 research | Working; confirmed by 2025 community reports | Works if labwc is manually installed; no RPi integration |
| **HW video decode (Pi 4)** | YES (V4L2 H.264 via RPi-patched Chromium) | YES (same patches, newer kernel) | NO (stock Chromium lacks V4L2 H.264 plugin) |
| **HW video decode (Pi 5)** | H.264: software fallback (no HW block) | H.264: software fallback (same) | H.264: software fallback (same) |
| **Image tooling maturity** | pi-gen (Bookworm); mature | rpi-image-gen (Trixie-native); newer but official | debos/vmdb2; requires manual RPi archive config |
| **First-boot customisation** | Imager 1.x firstrun.sh; well-understood | Imager 2.0 cloud-init; newer, less operator-familiar | cloud-init or manual; no Imager integration |
| **Debian security support** | LTS to ~2028 (Bookworm = Debian 12) | LTS to ~2030 (Trixie = Debian 13) | Same as RPi OS Trixie security channel |
| **Chromium security updates** | Via RPi archive (Bookworm); slower update cadence | Via RPi archive (Trixie) and trixie-security; every 2–4 weeks | Via trixie-security; same cadence |
| **Operator familiarity** | HIGH — well-documented; Phase 48 docs exist | MEDIUM — new OS, new package names; docs need updating | LOW — no RPi-specific documentation ecosystem |
| **Recovery from issues** | Vast community knowledge base | Growing community (Oct 2025+); RPi Foundation official docs | Limited community; requires Debian expertise |
| **provision-pi.sh compatibility** | Native target; no changes needed | Two lines changed (binary name, Wayland guard) | Significant rework (manual firmware, different package names) |
| **Kernel version** | 6.6 LTS | 6.12 LTS | 6.12 LTS |
| **Python 3 version** | 3.11 | 3.12 (Trixie default) | 3.12 |

**Python 3.12 note:** The sidecar venv (`fastapi`, `uvicorn`, `httpx`) is compatible with Python 3.12. No changes needed to `pi-sidecar/requirements.txt`.

---

## Recommended Next Steps (if CONDITIONAL-GO proceeds)

Before code writes begin for v1.17, the following research questions remain open:

1. **Verify `/usr/bin/chromium` binary path on a real Trixie Pi device.**
   The community consistently says the binary is `/usr/bin/chromium`, but the `rpi-chromium-mods` package may install a wrapper script that redirects to the actual binary. Confirm with `which chromium && dpkg -L chromium | grep bin` on a freshly-flashed RPi OS Trixie device. This one data point unblocks the `signage-player.service` fix.

2. **Measure Wayland kiosk startup on Pi 3B with 1GB RAM under Trixie.**
   Confirm that `raspi-config nonint do_wayland W2` (already in Step 9 of provision-pi.sh) successfully enables labwc on a Pi 3B 1GB Trixie device, and that Chromium `--ozone-platform=wayland` connects to the labwc socket. If X11 is required as a fallback on Pi 3B, document the flag change (`--ozone-platform=x11` instead) and the service unit modification needed.

3. **Validate rpi-image-gen on a self-hosted arm64 runner.**
   Run one test build of a minimal Trixie Lite image using rpi-image-gen. Confirm build time, output size, and that the image boots. This is infrastructure validation before designing the CI pipeline. Specifically test that `CAP_SYS_ADMIN` can be granted (e.g., via GitHub Actions self-hosted runner on a Pi 4/5 or a privileged container).

4. **Confirm cloud-init `user-data` placement in rpi-image-gen output.**
   Verify that rpi-image-gen places cloud-init configuration in `/boot/firmware/user-data` by default, and that this file is readable/writable from a host OS before first boot (i.e., it is on the FAT32 boot partition). This validates the `SIGNAGE_API_URL` preseed mechanism for operators without CLI access.

5. **Check RPi archive Trixie suite for `unclutter-xfixes`.**
   Confirm `unclutter-xfixes` is available in Debian Trixie main (it was in Bookworm and is expected to continue). The Phase 48 package list hardcodes this package name. If it was replaced or renamed, the provision script `apt-get install` step fails silently (apt error). Run: `apt-cache show unclutter-xfixes` on a Trixie system.

---

## References

1. [Trixie — the new version of Raspberry Pi OS (official announcement)](https://www.raspberrypi.com/news/trixie-the-new-version-of-raspberry-pi-os/)
2. [Debian 13 Trixie on Raspberry Pi 3B — Brezular's Blog (2025-11-01)](https://brezular.com/2025/11/01/debian-13-trixie-on-raspberry-pi-3b/)
3. [Debian News — Updated Debian 13: 13.3 released (2026-01-10)](https://www.debian.org/News/2026/20260110)
4. [HOWTO: Upgrade Raspberry Pi OS from Bookworm to Trixie — jauderho/GitHub Gist](https://gist.github.com/jauderho/5f73f16cac28669e56608be14c41006c)
5. [Debian 13 Trixie released — upgrade options? — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=390767)
6. [Debian — Details of package raspi-firmware in trixie](https://packages.debian.org/stable/misc/raspi-firmware)
7. [Raspberry Pi OS — Boot directory change to /boot/firmware](https://www.raspberrypi.com/documentation/computers/os.html)
8. [Raspberry Pi Imager 2.0 released — CNX Software (2025-11-24)](https://www.cnx-software.com/2025/11/24/raspberry-pi-imager-2-0-released-with-a-revamped-user-interface-raspberry-pi-connect-support/)
9. [Raspberry Pi Imager and Trixie 11-24: When Your Custom Settings Just Disappear](https://hamradiohacks.substack.com/p/raspberry-pi-imager-and-trixie-11)
10. [BUG: Imager wont use custom settings — raspberrypi/rpi-imager#909](https://github.com/raspberrypi/rpi-imager/issues/909)
11. [Cloud-init on Raspberry Pi OS — Raspberry Pi official](https://www.raspberrypi.com/news/cloud-init-on-raspberry-pi-os/)
12. [Debian — Details of package chromium in trixie arm64](https://packages.debian.org/trixie/arm64/chromium)
13. [5. Issues to be aware of for trixie — release-notes documentation (Debian)](https://www.debian.org/releases/trixie/release-notes/issues.html)
14. [RPi-Distro/chromium — pios/trixie branch (GitHub)](https://github.com/RPi-Distro/chromium/tree/pios/trixie/debian)
15. [Chromium-browser package no longer only chromium — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=374065)
16. [start a chromium browser on boot, latest OS — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=392472)
17. [Index of /debian/pool/main/c/chromium-browser — archive.raspberrypi.org](https://archive.raspberrypi.org/debian/pool/main/c/chromium-browser/)
18. [Raspberry Pi OS Trixie — A New Era Based on Debian 13 — bacloud.com](https://www.bacloud.com/en/blog/212/raspberry-pi-os-trixie--a-new-era-based-on-debian-13.html)
19. [Raspberry Pi OS 2025-11-24 Brings HiDPI Improvements, Wayland Enhancements — Phoronix](https://www.phoronix.com/news/Raspberry-Pi-OS-2025-11-24)
20. [A Chromium Kiosk for Wayland/labwc — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=390764)
21. [Raspberry Pi Kiosk Display System (Bookworm/Trixie) — GitHub](https://github.com/TOLDOTECHNIK/Raspberry-Pi-Kiosk-Display-System)
22. [Compose key works everywhere except Chromium on Wayland (Pi 500) — raspberrypi/trixie-feedback#21](https://github.com/raspberrypi/trixie-feedback/issues/21)
23. [Raspberry Pi OS "Trixie" — A New Era Based on Debian 13 (1GB Wayland default)](https://www.bacloud.com/en/blog/212/raspberry-pi-os-trixie--a-new-era-based-on-debian-13.html)
24. [Does 64-bit Raspberry Pi OS support Hardware Video Decoding in Chromium? — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=346840)
25. [Raspberry Pi 5 and the Lack of Hardware H.264 Decoding — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=391283)
26. [Pi 5 hardware decode of HEVC in Trixie browser — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=393549)
27. [Chromium hardware acceleration issues on RPi 3B+ — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=396128)
28. [Raspberry Pi 5 and the Lack of Hardware H.264 Decoding (VLC comparison)](https://forums.raspberrypi.com/viewtopic.php?t=391283)
29. [RPi 5: MPV dropping frames — Raspberry Pi Forums](https://forums.raspberrypi.com/viewtopic.php?t=393942)
30. [GitHub — RPi-Distro/pi-gen (arm64 branch)](https://github.com/RPi-Distro/pi-gen/tree/arm64)
31. [Introducing rpi-image-gen — Raspberry Pi official](https://www.raspberrypi.com/news/introducing-rpi-image-gen-build-highly-customised-raspberry-pi-software-images/)
32. [The latest Raspberry Pi OS images are now based on Debian 13 "Trixie" — CNX Software (2025-10-06)](https://www.cnx-software.com/2025/10/06/raspberry-pi-os-debian-13-trixie/)
33. [Layer: docker-debian-trixie — Signing missing key — raspberrypi/rpi-image-gen#170](https://github.com/raspberrypi/rpi-image-gen/issues/170)
34. [GitHub Releases documentation (file size limits)](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

---

## Confidence Summary

| Area | Level | Reason |
|------|-------|--------|
| RPi OS Trixie boots on Pi 3B/4/5 | HIGH | Official RPi Foundation release; multiple community confirmations |
| `chromium` package name on Trixie | HIGH | Multiple independent community sources; RPi-Distro/chromium pios/trixie branch exists |
| Binary path `/usr/bin/chromium` | MEDIUM | Community reports consistent; not verified via `dpkg -L` on real hardware |
| SGN-OPS-03 flags work on Trixie/labwc | HIGH | Multiple kiosk guides from 2025 confirm this combination |
| Pi 4 H.264 HW decode on Trixie | MEDIUM | Partially verified; V4L2 plugin in RPi Chromium exists; real-hardware test not done |
| Pi 5 no H.264 HW decode | HIGH | Official RPi Forum posts from RPi engineers; reproducible |
| rpi-image-gen Trixie support | HIGH | Official RPi Foundation documentation |
| Imager 2.0 preseed limitations | MEDIUM | Confirmed via bug reports; cloud-init workaround is documented by RPi |
| Pi 4 1GB defaults to X11 on Trixie | MEDIUM | Multiple forum reports; not confirmed in official documentation |
| Trixie-security Chromium update cadence | HIGH | Debian release notes explicitly cover browser policy |

---

*Researched 2026-04-20. Valid until: 2026-07-20 (90 days; RPi OS Trixie is maturing rapidly, re-verify hardware video decode status and binary paths before v1.17 plan is written).*
