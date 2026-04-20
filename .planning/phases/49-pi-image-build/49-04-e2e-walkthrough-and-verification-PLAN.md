---
phase: 49-pi-image-build
plan: 04
type: execute
wave: 3
depends_on: [49-01, 49-02, 49-03]
files_modified:
  - .planning/phases/49-pi-image-build/49-E2E-RESULTS.md
  - .planning/phases/49-pi-image-build/49-VERIFICATION.md
  - .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
autonomous: false
requirements: [SGN-IMG-04, SGN-IMG-05, SGN-IMG-08]
must_haves:
  truths:
    - "`49-E2E-RESULTS.md` exists with the 5-scenario scaffold filled by the operator: (1) flash → first-boot → pairing code ≤ 60 s, (2) admin claim → first playback ≤ 5 s, (3) Wi-Fi drop → offline loop holds 5 min, (4) reconnect → admin change arrives ≤ 30 s, (5) reboot resilience (preseed idempotency — signage-firstboot self-disabled, Chromium restore dialog suppressed)"
    - "Security gate PASSED: `journalctl --user -u signage-player` shows no `--no-sandbox` and no 'Running as root' warning; `ps -u signage -f | grep chromium-browser` confirms kiosk runs as `signage`"
    - "`49-VERIFICATION.md` closes out the 4 milestone-level success criteria from ROADMAP.md Phase 49 (flash-to-pairing ≤ 10 min; two-device preseed; tag → signed release ≤ 60 min; compressed ≤ 1 GB, uncompressed ≤ 4 GB)"
    - "`49-VERIFICATION.md` marks SGN-IMG-01..08 and SGN-REL-01..03 as VERIFIED (or DEFERRED with rationale — e.g., SGN-IMG-05 reproducibility test that requires two back-to-back CI builds)"
    - "Phase 48 carry-forward: `48-VERIFICATION.md` is updated to note that its deferred hardware walkthrough (Task 3 in 48-05 — the SGN-OPS-03 scenarios 1–5) is SUPERSEDED by the 49-04 hardware walkthrough if 49-04 passes; status flips `partial` → `verified`"
    - "Any critical defects are routed to `/gsd:plan-phase 49 --gaps` for gap-closure plans; non-critical items are deferred to v1.18"
  artifacts:
    - path: .planning/phases/49-pi-image-build/49-E2E-RESULTS.md
      provides: "Filled-in 5-scenario walkthrough + timing buckets + security-gate check + defects table"
    - path: .planning/phases/49-pi-image-build/49-VERIFICATION.md
      provides: "Phase 49 closeout — requirement verification matrix, milestone-success-criteria table, Phase 48 supersession note, outstanding items"
    - path: .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
      provides: "Updated: 'Outstanding items' section now references 49-E2E-RESULTS.md as backfill for Phase 48's deferred hardware walkthrough"
  key_links:
    - from: .planning/phases/49-pi-image-build/49-E2E-RESULTS.md
      to: .planning/phases/49-pi-image-build/49-VERIFICATION.md
      via: "Scenario pass/fail summary feeds the verification matrix"
      pattern: "Scenario [1-5]"
    - from: .planning/phases/49-pi-image-build/49-VERIFICATION.md
      to: .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
      via: "supersession pointer — 49-04 walkthrough also closes Phase 48's hardware-deferred item"
      pattern: "supersedes|Phase 48"
---

<objective>
Run the real-hardware E2E walkthrough for the baked Pi signage image, record the results, close out Phase 49's verification document, and back-fill Phase 48's hardware-deferred walkthrough in `48-VERIFICATION.md`.

Purpose: Satisfy SGN-IMG-08 (real-hardware one-flash E2E walkthrough recorded in `49-E2E-RESULTS.md`), SGN-IMG-04 (pairing code on display within 60 s measured on real hardware), SGN-IMG-05 (reproducibility measured across two back-to-back CI builds), and close out the v1.17 milestone gates by also superseding the Phase 48 hardware walkthrough deferral (see 48-05-SUMMARY.md "Outstanding items").

Output: 49-E2E-RESULTS.md (operator-filled scaffold) + 49-VERIFICATION.md (closeout) + 48-VERIFICATION.md supersession update.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-pi-image-build/49-CONTEXT.md
@.planning/phases/49-pi-image-build/49-RESEARCH.md
@.planning/phases/49-pi-image-build/49-01-SUMMARY.md
@.planning/phases/49-pi-image-build/49-02-SUMMARY.md
@.planning/phases/49-pi-image-build/49-03-SUMMARY.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-05-e2e-walkthrough-and-verification-PLAN.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-05-e2e-walkthrough-and-verification-SUMMARY.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@pi-image/README.md
@pi-image/SIGNING.md
</context>

<pitfalls_inherited>
- **Pitfall 3 (Wayland socket race):** if pairing code takes >30 s to appear, check `journalctl --user -u signage-player` for crash-loops.
- **Pitfall 5 (`__SIGNAGE_API_URL__` not substituted):** check `journalctl -u signage-firstboot` for errors; `grep __SIGNAGE_API_URL__ /home/signage/.config/systemd/user/*.service` must not match.
- **Pitfall 8 (`/boot/firmware/signage.conf` empty on flashed card):** confirm signage.conf.template was baked into the FAT partition during pi-gen build (mount the first partition and `ls /boot/firmware/signage.conf`).
- **Pitfall 9 (Chromium restore dialog on second boot):** `--disable-session-crashed-bubble` + the ExecStartPost crash-report cleanup should suppress it.
- **Pitfall 11 (`signage-firstboot.service` pre-mount race):** if firstboot fails with "signage.conf not found" but file is on the card, add `After=boot-firmware.mount` to the unit.
</pitfalls_inherited>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Write 49-E2E-RESULTS.md scaffold (5 scenarios, timing buckets, security gate, defects table)</name>
  <files>.planning/phases/49-pi-image-build/49-E2E-RESULTS.md</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md (shape reference — the 5-scenario + timing-bucket + defects-table structure)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 7" (what QEMU could / couldn't verify — informs what the hardware walkthrough must catch)
    - .planning/REQUIREMENTS.md §"Success Criteria (milestone-level)" (the 4 criteria this walkthrough measures)
  </read_first>
  <action>
    Create `.planning/phases/49-pi-image-build/49-E2E-RESULTS.md` with a filled-in-by-operator scaffold:

    ```markdown
    # Phase 49 E2E Walkthrough — Results

    **Status:** scaffold (operator fills timings + pass/fail)
    **Gate for:** v1.17 Pi Image Release milestone closure
    **Supersedes:** Phase 48's hardware-deferred walkthrough (see 48-05-SUMMARY.md "Outstanding items")

    ## Hardware

    - Pi model: ___ (target: Pi 4 2+GB)
    - SD card: ___ (speed class, capacity)
    - Display: HDMI ___ (resolution)
    - Network: ___ (Wi-Fi / Ethernet)

    ## Image under test

    - Release: ___ (e.g. v1.17.0-rc1 from the Plan 49-03 dry-run)
    - sha256: ___
    - minisign verify: PASS / FAIL (paste output)
    - Flashed via: Raspberry Pi Imager version ___

    ## Pre-conditions

    - [ ] sha256sum -c passed before flash
    - [ ] minisign -Vm passed before flash ("Signature and comment signature verified")
    - [ ] Imager custom settings: hostname=___, user=___, Wi-Fi configured, SSH key loaded
    - [ ] `/boot/firmware/signage.conf` edited on SD card before first boot:
          - SIGNAGE_API_URL=___
          - SIGNAGE_HOSTNAME=___ (optional)

    ## Scenario 1 — Flash → Boot → Pairing code (SGN-IMG-04, success criterion 1)

    | Event | Target | Actual |
    |-------|--------|--------|
    | Power on → Linux kernel banner | — | ___ s |
    | Linux banner → systemd multi-user.target | — | ___ s |
    | Multi-user.target → signage-firstboot.service completes | ≤ 30 s | ___ s |
    | Firstboot completes → Chromium kiosk shows pairing code | ≤ 30 s | ___ s |
    | **Power on → pairing code on display (total)** | **≤ 60 s after firstboot completion; ≤ 10 min end-to-end from download** | ___ |

    Pass/fail: ___
    Notes: ___ (any Pitfall 3/5/8/11 symptoms observed)

    ## Scenario 2 — Admin claim → First playback (success criterion 1)

    Steps:
    1. From admin browser, open `http://<api-url>/signage/pair`.
    2. Enter the 6-digit pairing code from the Pi display, device name, tags.
    3. Assign a playlist (at least one image, one video, one PDF — from existing signage fixtures).

    | Event | Target | Actual |
    |-------|--------|--------|
    | Claim submitted → Pi screen changes from pairing code to loading state | — | ___ s |
    | Loading → first playback item rendered | ≤ 5 s | ___ s |

    Pass/fail: ___
    Notes: ___

    ## Scenario 3 — Wi-Fi drop → Offline loop (reuses Phase 48 Scenario 3)

    Steps:
    1. On the Pi, `sudo nmcli device disconnect wlan0`.
    2. Observe for 5 minutes.
    3. Check `curl http://localhost:8080/health` on the Pi (via SSH).

    | Observation | Target | Actual |
    |-------------|--------|--------|
    | Playback continues via sidecar cache | Yes | ___ |
    | /health returns `{"online": false, ...}` | Yes | ___ |
    | Media cache size (`du -sh /var/lib/signage/media`) stable | Yes | ___ |
    | No Chromium crash / restore dialog | Yes | ___ |

    Pass/fail: ___

    ## Scenario 4 — Reconnect → Admin change propagates

    Steps:
    1. `sudo nmcli device connect wlan0`.
    2. In admin UI, add a new item to the assigned playlist (or change transition).
    3. Measure change-to-display time on the Pi.

    | Event | Target | Actual |
    |-------|--------|--------|
    | `nmcli connect` → /health returns online=true | — | ___ s |
    | Admin change saved → playlist change visible on Pi | ≤ 30 s | ___ s |

    Pass/fail: ___

    ## Scenario 5 — Reboot resilience + preseed idempotency

    Steps:
    1. `sudo reboot`.
    2. Observe: pairing flow does NOT re-appear (device is paired); playback resumes.
    3. Confirm `systemctl status signage-firstboot.service` shows `disabled` (self-disable from ExecStartPost).
    4. Confirm `grep SIGNAGE_API_URL /boot/firmware/signage.conf` shows the commented-out form from firstboot.sh's tail sed.
    5. Confirm NO Chromium restore dialog.

    | Observation | Target | Actual |
    |-------------|--------|--------|
    | signage-firstboot disabled after first success | Yes | ___ |
    | signage.conf SIGNAGE_API_URL line commented out | Yes | ___ |
    | Chromium starts without restore dialog | Yes | ___ |
    | Playback resumes within 30 s | Yes | ___ |

    Pass/fail: ___

    ## Security gate (hard-gate carry-forward from v1.16)

    ```
    sudo -u signage journalctl --user -u signage-player | grep -E "no-sandbox|Running as root"
    # Expected: no matches
    ps -u signage -f | grep chromium-browser
    # Expected: process runs as `signage`, NOT root
    id signage
    # Expected: uid != 0
    ```

    | Check | Expected | Actual |
    |-------|----------|--------|
    | No `--no-sandbox` in journal | no matches | ___ |
    | No "Running as root" warning | no matches | ___ |
    | Chromium runs as `signage` user | Yes | ___ |
    | `loginctl show-user signage` shows `Linger=yes` | Yes | ___ |

    Pass/fail: ___

    ## Second-device preseed test (success criterion 2)

    Steps:
    1. Take a second SD card; flash the SAME `.img.xz`.
    2. Edit `/boot/firmware/signage.conf` with a DIFFERENT SIGNAGE_API_URL (or same URL, different SIGNAGE_HOSTNAME).
    3. Boot the second device. Verify it pairs independently — produces a different 6-digit code.

    | Observation | Target | Actual |
    |-------------|--------|--------|
    | Second device shows different pairing code | Yes | ___ |
    | Admin can claim both independently | Yes | ___ |
    | No image rebuild between the two devices | Yes | ___ |

    Pass/fail: ___

    ## Pass/fail summary

    | # | Scenario | Pass/Fail |
    |---|----------|-----------|
    | 1 | Flash → Boot → Pairing | ___ |
    | 2 | Claim → First play | ___ |
    | 3 | Wi-Fi drop → offline | ___ |
    | 4 | Reconnect → admin change | ___ |
    | 5 | Reboot resilience | ___ |
    | Sec | Security gate | ___ |
    | P | Two-device preseed | ___ |

    ## Defects table

    | ID | Severity | Scenario | Description | Suggested fix | Resolution path |
    |----|----------|----------|-------------|---------------|-----------------|
    |    |          |          |             |               |                 |

    ## Milestone-success-criteria check (from ROADMAP Phase 49)

    | # | Criterion | Met? |
    |---|-----------|------|
    | 1 | Download → pairing code ≤ 10 min, no SSH/git/apt | ___ |
    | 2 | Same image + different preseed → two paired devices without rebuild | ___ |
    | 3 | `v1.17.*` tag → signed `.img.xz` in GitHub Releases in ≤ 60 min (see 49-03 Task 4) | ___ |
    | 4 | Compressed ≤ 1 GB, uncompressed ≤ 4 GB | ___ (record `.img.xz` size and decompressed size) |

    ## Sign-off

    - Operator: ___
    - Date: ___
    - v1.17 closable: YES / NO (reasons if no)
    ```
  </action>
  <verify>
    <automated>test -f .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Scenario 1" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Scenario 2" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Scenario 3" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Scenario 4" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Scenario 5" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Security gate" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Second-device preseed" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Pass/fail summary" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md && grep -q "Defects table" .planning/phases/49-pi-image-build/49-E2E-RESULTS.md</automated>
  </verify>
  <done>
    Scaffold exists with all 5 scenarios + security gate + second-device preseed + milestone criteria + defects table + sign-off. Operator has a complete fill-in template.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Operator runs the 5-scenario walkthrough on real Pi 4 hardware + fills 49-E2E-RESULTS.md</name>
  <what-built>
    - Plan 49-01: pi-gen pipeline + installer library
    - Plan 49-02: firstboot service + preseed
    - Plan 49-03: signed release workflow + minisign keys + operator docs
    - Plan 49-04 Task 1: E2E scaffold ready to fill

    This task EXECUTES the walkthrough on real hardware and fills the scaffold with timings.
  </what-built>
  <how-to-verify>
    **Prerequisites:**
    - Pi 4 (2+ GB RAM), microSD card (Class 10+, ≥ 8 GB), HDMI display, Wi-Fi or Ethernet network, Raspberry Pi Imager workstation.
    - A `v1.17.0-rc*` draft release from Plan 49-03 Task 4 (or cut a fresh `workflow_dispatch` if no rc exists yet).
    - Admin UI running at an accessible SIGNAGE_API_URL (from existing dev/staging deployment).

    **Setup (once):**
    1. Download assets from the GitHub Release (`.img.xz`, `.sha256`, `.minisig`, `minisign.pub`).
    2. Verify: `sha256sum -c ...sha256` AND `minisign -Vm ...img.xz -p minisign.pub`. Record both in 49-E2E-RESULTS.md "Image under test".
    3. Flash via Raspberry Pi Imager (Custom image → .img.xz). In Imager custom settings, set hostname, SSH, Wi-Fi.
    4. After flash, mount the SD card on workstation. Edit `/boot/firmware/signage.conf`: set `SIGNAGE_API_URL=<your-api-host:port>`. Save, eject.
    5. Insert SD in Pi. Power on with HDMI display attached. Start a stopwatch.

    **Execute the 5 scenarios** per the scaffold in `49-E2E-RESULTS.md`. Fill every timing bucket and Pass/Fail box.

    **Second-device preseed test** (success criterion 2): flash the SAME `.img.xz` to a second SD card, edit signage.conf with a DIFFERENT SIGNAGE_API_URL (or different hostname), boot, confirm the second device gets its own pairing code and the admin UI can claim both independently.

    **Security gate** commands (run via SSH after Scenario 1):
    ```
    sudo -u signage journalctl --user -u signage-player | grep -E "no-sandbox|Running as root"
    ps -u signage -f | grep chromium-browser
    loginctl show-user signage | grep -i linger
    ```

    **Measure image size** for milestone criterion 4:
    ```
    ls -lh raspios-bookworm-arm64-signage-*.img.xz
    xz -d -k raspios-bookworm-arm64-signage-*.img.xz
    ls -lh raspios-bookworm-arm64-signage-*.img
    ```

    **Record defects** in the Defects table. Critical defects (Scenarios 1/2 outright fail OR security gate fails) block milestone closure and trigger `/gsd:plan-phase 49 --gaps`.

    Commit the filled scaffold.
  </how-to-verify>
  <resume-signal>
    Reply with "walkthrough-complete" after all scenarios + security gate + two-device preseed are recorded and committed, OR "blocked: <scenario#>" with a defect description so the orchestrator can route to gap closure.
  </resume-signal>
  <done>
    49-E2E-RESULTS.md has every timing filled, Pass/Fail boxes ticked, defects recorded, sign-off line populated.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Write 49-VERIFICATION.md + update 48-VERIFICATION.md with supersession note</name>
  <files>.planning/phases/49-pi-image-build/49-VERIFICATION.md, .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-E2E-RESULTS.md (just-filled by operator)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md (current state — Outstanding items section needs update)
    - .planning/REQUIREMENTS.md §SGN-IMG-* and §SGN-REL-*
    - .planning/ROADMAP.md §"Phase 49: Pi Image Build — Success Criteria"
  </read_first>
  <action>
    **Step A — Create `.planning/phases/49-pi-image-build/49-VERIFICATION.md`** (shape follows 48-VERIFICATION.md, extended):

    ```markdown
    # Phase 49 — Pi Image Build — Verification

    **Status:** {verified | partial | blocked}
    **Milestone:** v1.17 Pi Image Release
    **Date:** ___

    ## 1. Summary

    Phase 49 closes SGN-IMG-01..08 and SGN-REL-01..03. Hardware E2E recorded in `49-E2E-RESULTS.md`.
    Phase 48's deferred hardware walkthrough is superseded by the 49-04 run (see §5).

    ## 2. Requirement verification matrix

    | Req | Plan | Verified by | Status |
    |-----|------|-------------|--------|
    | SGN-IMG-01 | 49-01 | `pi-image/` builds `.img` (local smoke OR Plan 49-03 dry-run artifact) | ___ |
    | SGN-IMG-02 | 49-01 | stage-signage prerun + 01-run-chroot install packages, create user, drop units, provision venv, enable linger (file-touch workaround, Pitfall 3) | ___ |
    | SGN-IMG-03 | 49-01 | `scripts/lib/signage-install.sh` + refactored `provision-pi.sh`; byte-identical filesystem state parity contract documented | ___ |
    | SGN-IMG-04 | 49-02 + 49-04 | 49-E2E-RESULTS.md Scenario 1 — pairing code within 60 s of firstboot completion | ___ |
    | SGN-IMG-05 | 49-01 + 49-03 | pi-gen submodule pinned SHA + `IMG_DATE` deterministic stage; full reproducibility test (two back-to-back CI builds) ___ | ___ (DEFERRED if test not yet run) |
    | SGN-IMG-06 | 49-02 | `/boot/firmware/signage.conf` schema baked; README documents operator fields | ___ |
    | SGN-IMG-07 | 49-02 | signage-firstboot.service reads preseed, writes `/etc/signage/config`, patches unit placeholders, restarts services, self-disables; idempotent (ConditionPathExists + tail sed) | ___ |
    | SGN-IMG-08 | 49-04 | `49-E2E-RESULTS.md` 5-scenario walkthrough + security gate + two-device preseed test | ___ |
    | SGN-REL-01 | 49-03 | `.github/workflows/pi-image.yml` + Task 4 dry-run draft release | ___ |
    | SGN-REL-02 | 49-03 | `pi-image/README.md` operator flash/verify/rollback/hardware matrix | ___ |
    | SGN-REL-03 | 49-03 | `.github/RELEASE_TEMPLATE.md` scaffold with 4 required fields | ___ |

    ## 3. Milestone-level success criteria (from ROADMAP Phase 49)

    | # | Criterion | Met? | Evidence |
    |---|-----------|------|----------|
    | 1 | Operator download → pairing code ≤ 10 min | ___ | 49-E2E-RESULTS.md Scenario 1 |
    | 2 | Same image + different preseed → 2 paired devices without rebuild | ___ | 49-E2E-RESULTS.md "Second-device preseed test" |
    | 3 | `v1.17.*` tag → signed release ≤ 60 min | ___ | Plan 49-03 Task 4 workflow_dispatch run URL |
    | 4 | Compressed ≤ 1 GB; uncompressed ≤ 4 GB | ___ | `.img.xz` size and `xz -d` output sizes |

    ## 4. Hard gates (carry-forward from v1.16)

    | Gate | Verified by | Status |
    |------|-------------|--------|
    | DE/EN i18n parity | N/A (no UI strings added in Phase 49) | n/a |
    | No `--no-sandbox` in baked Chromium unit | `grep -E "no-sandbox" scripts/systemd/signage-player.service` → no match | PASS |
    | No "Running as root" warning | 49-E2E-RESULTS.md security gate | ___ |
    | Sidecar binds `127.0.0.1:8080` only | Inherited from `scripts/systemd/signage-sidecar.service` (unchanged in Phase 49) | PASS |
    | `signage` user is NOT root; `loginctl enable-linger` applied at image build | `stage-signage/01-run-chroot.sh` + `/var/lib/systemd/linger/signage` (Pitfall 3 workaround) | ___ |

    ## 5. Phase 48 supersession

    `.planning/phases/48-pi-provisioning-e2e-docs/48-05-SUMMARY.md` flagged the real-hardware walkthrough as DEFERRED to an operator session (`status: partial`). The 49-04 walkthrough (Task 2 above) covers the SAME SGN-OPS-03 scenarios 1–5 on a Pi running the baked image, which is a stricter test than the Phase-48 `provision-pi.sh`-on-vanilla-Bookworm path.

    **Decision:** If 49-04 Scenarios 1–5 all PASS, `48-VERIFICATION.md`'s Outstanding items are considered RESOLVED. Phase 48 status can flip `partial → verified`.

    Cross-link: `48-VERIFICATION.md §Outstanding items` references this document.

    ## 6. Reviewer / Sign-off

    - Operator: ___
    - Date: ___
    - v1.17 closable: YES / NO + reasoning
    ```

    **Step B — Update `.planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md`**:

    Locate the "Outstanding items" (or equivalent) section. Append (or edit) so it reads:

    ```markdown
    ### Outstanding items — RESOLVED via Phase 49

    The real-hardware walkthrough deferred in 48-05 is **superseded** by the Phase 49-04 walkthrough
    (the baked image runs the same signage stack on real Pi hardware). See
    `.planning/phases/49-pi-image-build/49-E2E-RESULTS.md` for the filled scaffold and
    `.planning/phases/49-pi-image-build/49-VERIFICATION.md §5` for the supersession decision.

    Status flip: `partial` → `verified` (conditional on 49-04 Scenarios 1–5 all PASS + security gate PASS).
    ```

    If the filled 49-E2E-RESULTS.md shows any Scenario FAIL, hold the status flip and note the specific
    failing scenario; 48-VERIFICATION.md's Outstanding items stays `partial` until gap-closure lands.
  </action>
  <verify>
    <automated>test -f .planning/phases/49-pi-image-build/49-VERIFICATION.md && grep -q "SGN-IMG-08" .planning/phases/49-pi-image-build/49-VERIFICATION.md && grep -q "SGN-REL-01" .planning/phases/49-pi-image-build/49-VERIFICATION.md && grep -q "Phase 48 supersession" .planning/phases/49-pi-image-build/49-VERIFICATION.md && grep -q "49-E2E-RESULTS.md" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md && grep -q "superseded\|supersedes\|Phase 49" .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md</automated>
  </verify>
  <done>
    49-VERIFICATION.md has all 6 sections (summary, requirement matrix, milestone criteria, hard gates, Phase 48 supersession, sign-off). 48-VERIFICATION.md's Outstanding items section points to 49-E2E-RESULTS.md.
  </done>
</task>

</tasks>

<verification>
- Task 1: Scaffold exists with 5 scenarios + security gate + two-device preseed + milestone criteria + defects table.
- Task 2: Operator fills every timing + pass/fail cell on real Pi 4 hardware. Critical defects trigger gap closure.
- Task 3: 49-VERIFICATION.md closes all SGN-IMG-* + SGN-REL-* rows (verified or DEFERRED with rationale). 48-VERIFICATION.md Outstanding items supersedes to 49-04.
</verification>

<success_criteria>
- SGN-IMG-04 verified: pairing code appears within 60 s of firstboot completion (Scenario 1).
- SGN-IMG-05 verified OR explicitly DEFERRED (reproducibility test requires two back-to-back CI builds; may be deferred to v1.17.1 if only one build has run).
- SGN-IMG-08 verified: real-hardware walkthrough recorded in 49-E2E-RESULTS.md with all 5 scenarios + security gate.
- Phase 48 hardware-deferred walkthrough superseded: 48-VERIFICATION.md updated.
- Milestone success criteria 1, 2, 3, 4 all evaluated; any failures trigger gap-closure before v1.17 ships.
</success_criteria>

<output>
After completion (Task 2 walkthrough filled, Task 3 docs written), commit with a NORMAL commit (Wave 3 — hooks should run; parallel-wave `--no-verify` exception from constraints does NOT apply here). Create `.planning/phases/49-pi-image-build/49-04-SUMMARY.md` recording:
- Operator walkthrough outcome per scenario (link to 49-E2E-RESULTS.md)
- Phase 49 closable: YES / NO
- Phase 48 supersession status
- If YES: ready for ROADMAP milestone flip (v1.17 SHIPPED)
- If NO: list of blockers + recommended next step (gap-closure plan or deferral to v1.17.1)
</output>

<files_to_read>
- .planning/phases/49-pi-image-build/49-CONTEXT.md
- .planning/phases/49-pi-image-build/49-RESEARCH.md
- .planning/phases/49-pi-image-build/49-01-SUMMARY.md
- .planning/phases/49-pi-image-build/49-02-SUMMARY.md
- .planning/phases/49-pi-image-build/49-03-SUMMARY.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-05-e2e-walkthrough-and-verification-SUMMARY.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-VERIFICATION.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md
- .planning/REQUIREMENTS.md
- .planning/ROADMAP.md
- pi-image/README.md
- pi-image/SIGNING.md
- .github/workflows/pi-image.yml
- .github/RELEASE_TEMPLATE.md
- scripts/firstboot.sh
- scripts/lib/signage-install.sh
- pi-image/stage-signage/signage-firstboot.service
</files_to_read>
