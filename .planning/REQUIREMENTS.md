# Requirements: v1.17 Pi Image Release

**Milestone:** v1.17
**Status:** Active
**Created:** 2026-04-20
**Core Value:** Pre-bake the Phase 48 signage stack into a flashable Raspberry Pi OS Bookworm Lite 64-bit image. Operator flashes one `.img.xz` via Raspberry Pi Imager, boots, and lands on the 6-digit pairing code. No SSH, git, or apt steps between flash and pairing.

**Research:** `.planning/research/debian-trixie-pi-image.md` (Trixie alternative evaluated, CONDITIONAL-GO — deferred to post-v1.17).

**Locked defaults (2026-04-20):**
- Base distro: **Raspberry Pi OS Bookworm Lite 64-bit** (not Trixie, not Full Desktop)
- GUI depth: **Thin** (labwc + Chromium kiosk only; no desktop environment)
- Image builder: **pi-gen** (RPi Foundation, Bash-based)
- First-boot config: **Raspberry Pi Imager custom-settings preseed** for `SIGNAGE_API_URL` + Wi-Fi; no runtime wizard
- Distribution: **GitHub Releases** (`.img.xz` + sha256 + signature; target size ≤ 1 GB compressed)
- Build runner: **self-hosted arm64** (Pi 4 or arm64 VM) — standard GitHub Actions cannot build Pi images

---

## Active Requirements

### Image Build Pipeline (SGN-IMG-*)

- [x] **SGN-IMG-01**: `pi-gen` fork / config lives at `pi-image/` in this repo, builds a valid `.img` from a stock `pi-gen` base (stages 0–2 minimal, stage 3 adds our layer, stages 4–5 omitted since we want Lite).
- [x] **SGN-IMG-02**: Custom pi-gen stage `pi-image/stage-signage/` installs: the Phase 48 apt packages (`chromium-browser`, `unclutter-xfixes`, `labwc`, `seatd`, Carlito/Caladea/Noto/DejaVu fonts, `python3-venv`, `git`), creates the `signage` user with `/home/signage` layout, drops the three systemd user unit files from `scripts/systemd/`, provisions the pi-sidecar venv under `/opt/signage/pi-sidecar/.venv/`, and runs `loginctl enable-linger signage` inside the chroot.
- [x] **SGN-IMG-03**: `scripts/provision-pi.sh` is refactored into two code paths: (a) library sourced by the pi-gen stage for image-build-time installation, (b) standalone script for runtime use on vanilla Bookworm Lite (existing Phase 48 path). Shared installer logic lives in `scripts/lib/signage-install.sh`. Both paths MUST produce byte-identical filesystem state.
- [ ] **SGN-IMG-04**: Built image on first boot produces the 6-digit pairing code on the attached display within 60 s of first-boot cloud-init completion (no operator interaction beyond flash + power).
- [x] **SGN-IMG-05**: Build is reproducible: given the same git SHA + pi-gen SHA, two back-to-back builds produce `.img` files with byte-for-byte identical `/opt/signage`, `/home/signage`, and `/etc/systemd/user/` contents (timestamps acceptable to differ).

### First-Boot Preseed (SGN-IMG-06, SGN-IMG-07)

- [ ] **SGN-IMG-06**: Raspberry Pi Imager "custom settings" preseed file (`/boot/firmware/signage-preseed.conf` or `cloud-init user-data`) supplies: `SIGNAGE_API_URL`, Wi-Fi SSID + PSK, SSH public key (optional), device hostname. The image is pre-bound to the preseed convention — operator sets via Imager UI; no manual file editing.
- [ ] **SGN-IMG-07**: First-boot systemd oneshot (`signage-firstboot.service`) reads the preseed, writes `/etc/signage/config` (mode 0644, owned by signage), restarts the sidecar + player units so they pick up the new URL, and self-disables (`systemctl disable signage-firstboot`). Idempotent across reboots.

### Release + Distribution (SGN-REL-*)

- [ ] **SGN-REL-01**: GitHub Actions workflow `/.github/workflows/pi-image.yml` triggers on a `v1.17.*` git tag (or `workflow_dispatch`), runs on a self-hosted arm64 runner, builds the image via pi-gen, compresses with `xz -9`, computes sha256, signs with minisign (or GPG), and publishes both (`.img.xz`, `.img.xz.sha256`, `.img.xz.minisig`) as release assets.
- [ ] **SGN-REL-02**: A README at `pi-image/README.md` documents: operator flash procedure (Raspberry Pi Imager URL, preseed fields), sha256 + signature verification, rollback (flash previous release), known Pi hardware matrix (Pi 4 recommended; Pi 3B works but slower; Pi 5 supported).
- [ ] **SGN-REL-03**: Release notes template in `.github/RELEASE_TEMPLATE.md` surfaces: Bookworm Lite base version (pinned), apt package versions (captured from `dpkg -l` inside the build), pi-sidecar commit, expected sha256.

### E2E + Verification (SGN-IMG-08)

- [ ] **SGN-IMG-08**: Real-hardware one-flash E2E walkthrough: flash via Imager → first boot → pairing code ≤ 60 s → admin claim via `/signage/pair` → first playback item ≤ 5 s after claim. Recorded in `.planning/phases/49-pi-image-build/49-E2E-RESULTS.md`. Supersedes Phase 48's deferred hardware walkthrough.

---

## Success Criteria (milestone-level)

1. Operator with no prior signage knowledge goes from "downloaded the release" to "kiosk showing pairing code" in under 10 minutes of elapsed time. (SGN-IMG-04, SGN-IMG-06, SGN-IMG-07, SGN-IMG-08)
2. Flashing the image onto a second Pi with a different `SIGNAGE_API_URL` preseed produces a second paired device without re-building the image. (SGN-IMG-06, SGN-IMG-07)
3. CI pipeline publishes a signed `.img.xz` + verification files on every `v1.17.*` tag push, with build duration under 60 minutes on the self-hosted runner. (SGN-REL-01)
4. Image size compressed ≤ 1 GB (.img.xz); uncompressed ≤ 4 GB (fits on an 8 GB SD card with usable headroom). Captured in release notes.

## Hard gates carried forward from v1.16

1. DE/EN i18n parity (CI green) — no UI changes expected, but if any README / first-boot text is bilingual, parity applies.
2. No `--no-sandbox` in the baked Chromium unit. No "Running as root" warning in journal.
3. Sidecar binds `127.0.0.1:8080` only in the baked image as well.
4. `signage` user is NOT root; `loginctl enable-linger` applied during image build.

## Amendments anticipated (to resolve during planning)

- Whether `/boot/firmware/signage-preseed.conf` or `cloud-init user-data` is the preseed file — researcher to confirm which one Raspberry Pi Imager's "custom settings" UI actually writes in Bookworm.
- Whether pi-gen can run fully non-interactively in CI or requires a TTY — may need `pi-gen-action` wrapper.
