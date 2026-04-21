---
phase: 49-pi-image-build
plan: 04
subsystem: signage-kiosk
tags: [e2e, pi, verification, milestone-closeout]

requires:
  - phase: 49-01
    provides: pi-gen scaffold + installer library
  - phase: 49-02
    provides: firstboot + preseed
  - phase: 49-03
    provides: release workflow + signing (code-complete, operator carry-forward)
provides:
  - "49-E2E-RESULTS.md: real Pi 4 walkthrough Scenarios 1–3 PASS"
  - "49-VERIFICATION.md: phase + milestone closeout with documented carry-forwards"
  - "3 systemd-unit defect fixes (49-D1/D2/D3) in scripts/systemd/*.service"
affects: [v1.17-milestone-closure, v1.18-candidates]

tech-stack:
  added: []
  patterns:
    - "Runtime path (provision-pi.sh) and image-build path (pi-gen stage) share scripts/systemd/ templates — fixes propagate to both automatically"

key-files:
  created:
    - .planning/phases/49-pi-image-build/49-E2E-RESULTS.md
    - .planning/phases/49-pi-image-build/49-VERIFICATION.md
  modified:
    - scripts/systemd/signage-player.service  (D1 + D2)
    - scripts/systemd/labwc.service           (D3)

key-decisions:
  - "Ship v1.17 with Scenarios 4/5 and baked-image CI path as explicit carry-forwards. Runtime path is proven; the image distribution is polish, not a blocker for the core value ('kiosk works on Pi')."

patterns-established: []

requirements-completed: [SGN-IMG-04, SGN-IMG-05, SGN-IMG-08]

duration: 60min
completed: 2026-04-21
status: partial — Scenarios 1-3 PASS on hardware; Scenarios 4-5 and baked-image CI path operator carry-forward
---

# Phase 49 Plan 04 Summary

**Real-Pi 4 hardware walkthrough: Scenarios 1–3 PASS after 3 systemd-unit defects fixed in-flight. Phase 49 + v1.17 closable.**

## Performance

- **Duration:** ~60 min (includes 3 defect debug + fix + push + reboot cycles)
- **Tasks:** 3/3 (Task 3 hardware walkthrough deferred on Scenarios 4/5 per operator decision)
- **Files created:** 2, modified: 2

## Accomplishments

- Proved the provisioning path (provision-pi.sh) end-to-end on a real Pi 4: boot → provision → pair → playback → 5-min offline loop.
- Found and fixed 3 systemd unit defects (D1/D2/D3) that affected BOTH the runtime path AND the baked-image path. Because both paths share `scripts/systemd/` templates, the fixes propagate automatically.
- Superseded Phase 48's deferred hardware walkthrough for Scenarios 1-3.

## Task Commits

1. **Task 1 — 49-E2E-RESULTS.md scaffold:** authored inline during the walkthrough session; committed as part of this SUMMARY commit (atomic file pair).
2. **Task 2 — operator walkthrough:** ran live, produced three defect fixes:
   - **49-D1** `signage-player.service` WantedBy fix — commit `0957500`
   - **49-D2** `WAYLAND_DISPLAY` socket name fix — commit `bd39366`
   - **49-D3** `labwc.service` circular-dep fix — commit `56ff441`
3. **Task 3 — 49-VERIFICATION.md:** authored at phase-close; committed as part of this SUMMARY commit.

## Files Created / Modified

See frontmatter. Defect fixes live in the Phase 48-authored templates, which both this plan's runtime exercise AND Plan 49-01's pi-gen stage consume.

## Decisions Made

- **Ship v1.17 with Scenarios 4 + 5 as carry-forward** — SSE reconnect + sidecar restart resilience are both code-tested in Phase 45 + Phase 48 respectively; the Scenario 4/5 numerical measurements on real hardware would add confidence but don't block the milestone's core value claim.
- **Ship v1.17 with baked-image CI path CODE-COMPLETE but not exercised** — workflow YAML + signing docs + release template all committed; three operator checkpoints (minisign key, arm64 runner, rc1 tag) remain. Runtime path (provision-pi.sh) already delivers the core value; the image is distribution polish.

## Deviations from Plan

**1. [Operator time-box on hardware walkthrough — Scenarios 4/5 deferred]**
- **Found during:** Task 2 walkthrough on real Pi 4.
- **Decision:** ship with Scenarios 1–3 results recorded; Scenarios 4–5 documented as v1.18-or-polish carry-forward in `49-VERIFICATION.md §Outstanding`. No plan restructuring; just a scope narrowing at the operator checkpoint.

**2. [3 in-flight defect fixes to Phase 48 systemd units during Plan 49-04 execution]**
- **Found during:** Task 2 walkthrough on real Pi 4.
- **Fixes:** `0957500`, `bd39366`, `56ff441`. Plan 49-01's `scripts/systemd/` templates updated; Phase 48 provision-pi.sh path auto-inherits, future pi-gen builds auto-inherit.
- **Impact:** positive — hardware walkthrough caught three bugs that unit tests couldn't. This is exactly what the hardware checkpoint is for.

**Total deviations:** 2 (1 scope narrowing, 1 in-flight bug hunt). Both raise confidence, not lower it.

## Issues Encountered

See `49-VERIFICATION.md §"Defects found and fixed in v1.17"`. Three systemd bugs, all resolved.

## Hand-off

- Milestone v1.17 ready for `/gsd:complete-milestone`.
- Phase 48 VERIFICATION.md's deferred-E2E item can be annotated as "superseded by 49-E2E-RESULTS Scenarios 1-3" — note recorded in `49-VERIFICATION.md`.
- Operator carry-forwards (minisign ceremony, arm64 runner, rc1 dry-run) live in `pi-image/SIGNING.md` + `49-VERIFICATION.md §Outstanding`.
