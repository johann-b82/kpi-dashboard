---
phase: 49-pi-image-build
milestone: v1.17
phase_number: 49
phase_name: Pi Image Build
phase_slug: pi-image-build
requirements: [SGN-IMG-01, SGN-IMG-02, SGN-IMG-03, SGN-IMG-04, SGN-IMG-05, SGN-IMG-06, SGN-IMG-07, SGN-IMG-08, SGN-REL-01, SGN-REL-02, SGN-REL-03]
created: 2026-04-20
---

# Phase 49 CONTEXT — Pi Image Build

## Domain

Pre-bake the Phase 48 signage stack into a flashable Raspberry Pi OS Bookworm Lite 64-bit `.img.xz` so a non-developer operator goes from "downloaded the release" to "kiosk showing pairing code" in ≤ 10 minutes, with no SSH / git / apt steps between flash and pairing. Covers: pi-gen pipeline + custom stage, first-boot preseed, release workflow + signing, one-flash E2E.

## Pre-locked decisions

All six milestone-level decisions are locked in `.planning/REQUIREMENTS.md §"Locked defaults"`. Do NOT re-open. Summary:

1. **Base:** Raspberry Pi OS Bookworm Lite 64-bit. Not Trixie (see `research/debian-trixie-pi-image.md` — CONDITIONAL-GO deferred to post-v1.17). Not Full Desktop tier.
2. **GUI depth:** Thin. labwc + Chromium kiosk only. No desktop environment. Operator uses SSH for admin.
3. **Builder:** pi-gen (RPi Foundation, Bash + chroot).
4. **Preseed:** Raspberry Pi Imager "custom settings" → `SIGNAGE_API_URL` + Wi-Fi + hostname at flash time. No runtime wizard.
5. **Distribution:** GitHub Releases with `.img.xz` + sha256 + signature. Triggered by `v1.17.*` git tags.
6. **Build runner:** Self-hosted arm64 (Pi 4 or arm64 VM). Stock GitHub Actions cannot build Pi images.

## Inherited from Phase 48 (frozen contracts)

- `scripts/systemd/signage-sidecar.service`, `signage-player.service`, `labwc.service` — verbatim targets for the baked image.
- `scripts/provision-pi.sh` — will be refactored (see SGN-IMG-03) to share installer logic with the pi-gen stage via `scripts/lib/signage-install.sh`; the standalone runtime path must keep working.
- `pi-sidecar/` FastAPI app + `pi-sidecar/requirements.txt` — baked into the image at `/opt/signage/pi-sidecar/.venv/`.
- `signage` user, `/var/lib/signage/` at mode 0700, `loginctl enable-linger` — all applied inside the chroot at image build time.

## Open questions for the researcher to close

1. **Preseed filename convention.** Does Raspberry Pi Imager (2025+) Bookworm "custom settings" UI write `/boot/firmware/signage-preseed.conf`, a cloud-init `user-data` file, or something else? Exact path + format (INI, YAML, key=value) MUST be nailed down before the first-boot oneshot can read it.
2. **pi-gen non-interactive CI.** Does pi-gen run headless in CI today, or does it want a TTY / prompt? Options to evaluate: `pi-gen-action` GitHub action wrapper, Docker-based pi-gen runs, direct chroot invocation.
3. **Self-hosted runner spec.** Minimum hardware for a reasonable build: Pi 4 8GB vs Pi 5 vs an arm64 VM (e.g. Oracle Cloud free tier, Hetzner CAX11). Build duration expectation.
4. **Image signing choice.** minisign (simple, key handling manageable, modern) vs GPG (familiar, heavier key management) vs sigstore (cosign on arm64). Pick one; justify.
5. **Stage numbering in pi-gen.** pi-gen stages 0–5 conventionally: 0 bootstrap, 1 base RPi, 2 Lite, 3 dev+apps, 4 desktop, 5 RPi-specific desktop apps. We want to stop after stage 2 and add `stage-signage` as stage 3-equivalent. Confirm with pi-gen's `EXPORT_*` flags which stages produce an `.img`.
6. **Installer-library refactor shape.** `scripts/lib/signage-install.sh` must be sourceable from both `scripts/provision-pi.sh` (runtime, root on a booted Pi) AND the pi-gen chroot stage (build-time, inside `chroot`). The boundary between "distinct code paths" vs "shared code" needs to be sketched concretely — every apt install, file drop, systemctl call.
7. **Testing without a Pi.** Can the built image be smoke-tested via QEMU aarch64 before shipping? Depth of smoke test: boots / first-boot oneshot runs / pairing code appears. Don't go past "smoke"; real-hardware E2E is the gate.

## Scope boundaries

**NOT in Phase 49:**
- Multi-Pi fleet orchestration (Ansible, fleet-wide config push) — deferred to v1.18.
- OTA image updates, rpi-update integration — deferred.
- Cellular/LTE fallback — deferred.
- Debian Trixie base — deferred (research doc has the reactivation criteria).
- Full desktop image — deferred (reopen if operator feedback says SSH-only is too austere).
- QEMU-driven automated E2E in CI — smoke-only; hardware walkthrough is the release gate.

## Success criteria

Reproduced from REQUIREMENTS.md §"Success Criteria (milestone-level)":

1. Operator goes download → pairing code in ≤ 10 min, no SSH/git/apt.
2. Same image + different preseed → two devices, no rebuild.
3. `v1.17.*` tag → signed `.img.xz` published to GitHub Releases in ≤ 60 min.
4. Compressed ≤ 1 GB; uncompressed ≤ 4 GB.

## Next step

Spawning `gsd-phase-researcher` to close the 7 open questions and produce `49-RESEARCH.md`, then `gsd-planner` for 3–4 PLAN.md files, then `gsd-plan-checker` to validate.
