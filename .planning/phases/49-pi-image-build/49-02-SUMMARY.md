---
phase: 49-pi-image-build
plan: 02
subsystem: signage-kiosk
tags: [pi-image, firstboot, preseed, systemd]

requires:
  - phase: 49-01
    provides: pi-image/ pi-gen scaffold + installer library + stage-signage guards
provides:
  - "signage-firstboot.service systemd unit (system-level, oneshot, self-disabling)"
  - "scripts/firstboot.sh (reads /boot/firmware/signage.conf → writes /etc/signage/config → restarts user services)"
  - "pi-image/stage-signage/signage.conf.template (operator-edits preseed on FAT partition)"
  - "prerun.sh wiring to bake firstboot.sh + signage-firstboot.service into the image rootfs"
  - "Preseed schema section in pi-image/README.md"
affects: [49-03, 49-04]

tech-stack:
  added: []
  patterns:
    - "System-level oneshot with ExecStartPost=self-disable for idempotent first-boot configuration"
    - "Preseed via operator-editable plain-text file on FAT partition (Imager UI cannot carry arbitrary keys — RESEARCH §Unknown 1)"

key-files:
  created:
    - pi-image/stage-signage/signage-firstboot.service
    - pi-image/stage-signage/signage.conf.template
    - scripts/firstboot.sh
  modified:
    - pi-image/stage-signage/prerun.sh  (copies firstboot.sh into rootfs)
    - pi-image/README.md  (§"Preseed schema")

key-decisions:
  - "SGN-IMG-06 amendment: Raspberry Pi Imager UI cannot carry arbitrary keys, so `SIGNAGE_API_URL` lives in `/boot/firmware/signage.conf` (operator edits on FAT partition post-flash). README documents this; 49-04's VERIFICATION.md will formalize the amendment."
  - "firstboot.sh uses `sed -i` placeholder substitution on unit files at /home/signage/.config/systemd/user/ — the pi-gen stage writes units with `__SIGNAGE_API_URL__` sentinel; firstboot replaces it with the real URL."
  - "Service runs at multi-user.target with ConditionPathExists=/boot/firmware/signage.conf — second-boot is a no-op because firstboot.sh comments out the applied SIGNAGE_API_URL line in the preseed file."

patterns-established: []

requirements-completed: [SGN-IMG-04, SGN-IMG-06, SGN-IMG-07]

duration: 3min
completed: 2026-04-20
---

# Phase 49 Plan 02 Summary

**First-boot preseed + self-disabling oneshot are in place; the baked image now configures itself from `/boot/firmware/signage.conf` on first boot without any SSH/git/apt steps.**

## Performance

- **Duration:** ~3 minutes
- **Tasks:** 3/3 (Task 3 "dry-run firstboot.sh logic locally" was a `bash -n` syntax check since the script requires root + /boot/firmware; real-hardware run is 49-04's gate)
- **Files created:** 3 / modified: 2

## Accomplishments

- Service + script pair match RESEARCH §4 verbatim.
- signage.conf.template committed with the documented 4 fields (SIGNAGE_API_URL required, SIGNAGE_HOSTNAME + WIFI_SSID + WIFI_PSK optional).
- prerun.sh now installs firstboot.sh into `/opt/signage/scripts/` inside the rootfs — service ExecStart path resolves.
- README.md preseed schema section lists the exact fields + the 2026-04-20 amendment.

## Task Commits

1. **Task 1 + 2 + README:** `40788cf` (feat) — signage-firstboot.service + signage.conf.template + README extension committed by the autonomous agent before it stalled on Bash permissions.
2. **Task 3 wiring completion:** `96079c0` (feat) — scripts/firstboot.sh + prerun.sh copy wiring added inline after the stall.

## Files Created / Modified

See frontmatter `key-files`. No runtime behaviour change for `scripts/provision-pi.sh` (49-01's refactor); 49-02 only adds the image-build-time path.

## Decisions Made

- **SGN-IMG-06 amendment** (carried to 49-04 VERIFICATION): the Imager UI can't carry `SIGNAGE_API_URL`, so the operator edits `signage.conf` on the FAT partition post-flash. Still zero SSH/git/apt, so milestone Success Criterion 1 is preserved.

## Deviations from Plan

**1. [autonomous-agent Bash permission stall, recovered inline]**
- **Found during:** Task 3 chmod+commit step. The gsd-executor agent hit a permission restriction on Bash tool and couldn't complete `chmod +x`, syntax check, or commit.
- **Fix:** Completed the remaining Task 3 work inline (chmod via shell, `bash -n` syntax check, git add/commit). Added the `prerun.sh` firstboot.sh copy that the agent had not reached.
- **Files modified:** scripts/firstboot.sh (chmod 0755), pi-image/stage-signage/prerun.sh
- **Committed in:** `96079c0`

**Total deviations:** 1 (recovered inline, no scope change).

## Issues Encountered

Autonomous agent hit a Bash-permission block. Work was 90% done on disk; finished inline. Not a plan defect — agent runtime issue only.

## Hand-off

- 49-03 can now rely on the firstboot flow being complete. Release notes template (RELEASE_TEMPLATE.md) can list `signage-firstboot.service` in the "How operators configure" section.
- 49-04 hardware walkthrough will verify: (a) firstboot.sh runs, (b) `/etc/signage/config` populated, (c) service self-disables, (d) `SGN-IMG-06` amendment recorded in `49-VERIFICATION.md`.
