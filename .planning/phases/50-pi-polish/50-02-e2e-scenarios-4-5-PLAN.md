---
phase: 50-pi-polish
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/50-pi-polish/50-E2E-RESULTS.md
autonomous: false
requirements:
  - SGN-POL-04
user_setup:
  - service: raspberry-pi-hardware
    why: "SGN-POL-04 requires actual hardware walkthrough — timings cannot be simulated"
    env_vars: []
    dashboard_config:
      - task: "Provision a physical Pi via scripts/provision-pi.sh on fresh Raspberry Pi OS Bookworm Lite 64-bit"
        location: "Operator workstation + physical Pi"
      - task: "Pair the Pi and load a test playlist with >= 3 items, each duration_s = 5"
        location: "Admin UI at /signage"
      - task: "SSH access to the Pi + open admin browser window"
        location: "Operator workstation"
must_haves:
  truths:
    - ".planning/phases/50-pi-polish/50-E2E-RESULTS.md exists with Scenario 4 + Scenario 5 sections populated with numerical timings"
    - "Scenario 4 recorded T1 - T0 <= 30.0 s on a provision-pi.sh-provisioned Pi"
    - "Scenario 5 recorded visual continuity = PASS (zero black frames) and sidecar cold-start <= 15 s"
    - "All runbook commands referenced in the doc exist verbatim in current repo / provisioning"
  artifacts:
    - path: ".planning/phases/50-pi-polish/50-E2E-RESULTS.md"
      provides: "E2E results template + (once operator runs it) recorded hardware timings for Scenarios 4 and 5"
      contains: "## Scenario 4"
  key_links:
    - from: ".planning/phases/50-pi-polish/50-E2E-RESULTS.md"
      to: "scripts/provision-pi.sh"
      via: "Preconditions section references provision-pi.sh as the required provisioning path"
      pattern: "provision-pi\\.sh"
    - from: ".planning/phases/50-pi-polish/50-E2E-RESULTS.md"
      to: "docs/operator-runbook.md"
      via: "Scenario 5 procedure cites operator-runbook restart-sidecar flow"
      pattern: "systemctl --user restart signage-sidecar"
---

<objective>
Close SGN-POL-04 — the v1.17 operator carry-forward — by (a) producing the `50-E2E-RESULTS.md` runbook+template file with all commands verified against the current repo, and (b) flagging the operator checkpoint to record actual hardware timings on a `provision-pi.sh`-provisioned Pi for Scenarios 4 (reconnect -> admin-mutation-arrives <= 30 s) and 5 (sidecar systemd restart -> playback continuity).

Purpose: The Phase 49 milestone shipped with the Scenarios-4+5 walkthrough deferred because the hardware E2E could not be run inside Claude's execution environment. Phase 50 finalises this by (1) committing a ready-to-run operator runbook with exact commands for both scenarios and (2) giving the operator a structured recording template so results land back in `.planning/` for milestone closure.

Output:
- `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` — verbatim template from 50-RESEARCH.md, status PENDING until operator fills it in.
- This plan itself is the runbook — operators can execute directly from the task actions on the Pi.
- Claude-executable acceptance: template file exists with all five required H2 sections; every command in the doc verified present in repo via grep.
- Operator-run acceptance: hardware timings filled in; both scenarios PASS. **This portion is explicitly flagged as a carry-over until the operator completes the walkthrough.**
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/50-pi-polish/50-RESEARCH.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md
@docs/operator-runbook.md
@scripts/provision-pi.sh
@scripts/README-pi.md

<interfaces>
Commands and paths this plan's document will reference. All must exist in the current repo.

Verified-present commands (from 50-RESEARCH.md Scenario 4 + 5 methodology sections):

- `sudo nmcli device disconnect wlan0` — network-manager is installed by `scripts/provision-pi.sh` (Task 2 grep-verifies).
- `sudo nmcli device connect wlan0` — same.
- `sudo -u signage XDG_RUNTIME_DIR=/run/user/$(id -u signage) systemctl --user restart signage-sidecar` — systemd user unit installed by provision-pi.sh.
- `sudo -u signage journalctl --user -u signage-sidecar -f --output=short-precise` — systemd core.
- `curl -fs http://localhost:8080/health | grep -q '"ready":true'` — sidecar HTTP API on port 8080.
- `date +"%Y-%m-%dT%H:%M:%S.%N T_label"` — GNU date on operator laptop.

Timing budget anchors (from 50-RESEARCH.md):
- Scenario 4: 30 s budget; dominated by `useSseWithPollingFallback.ts` 30 s polling fallback tick + current item's remaining playback duration. Methodology precondition: test playlist items have `duration_s = 5` (else advance-tick dominates budget).
- Scenario 5: sidecar cold-start expected 5-15 s; visual continuity is binary (PASS/FAIL) — the in-DOM `<img>/<video>/<canvas>` already holds its decoded frame so restart does nothing to the current frame.

Template file structure (must mirror Phase 48's 48-E2E-RESULTS.md layout, per 50-RESEARCH.md "50-E2E-RESULTS.md template" section). Required H2 sections:
- `## Preconditions`
- `## Scenario 4: Reconnect -> Admin Change Arrives <= 30 s` (use the exact arrow/character form as in research: "Reconnect -> Admin Change Arrives <= 30 s" appears in research with Unicode arrow/le-char; match research verbatim)
- `## Scenario 5: Sidecar Restart -> Playback Continuity`
- `## Pass/Fail Summary`
- `## Operator sign-off`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Write 50-E2E-RESULTS.md template verbatim from 50-RESEARCH.md</name>
  <files>.planning/phases/50-pi-polish/50-E2E-RESULTS.md</files>
  <read_first>
    - .planning/phases/50-pi-polish/50-RESEARCH.md section titled "50-E2E-RESULTS.md template (proposed — planner copies verbatim)" — this is the source-of-truth content to paste
    - .planning/phases/48-pi-provisioning-e2e-docs/48-E2E-RESULTS.md (for layout parity reference only)
    - scripts/provision-pi.sh (confirm `network-manager` or nmcli-providing package is in the apt install list)
    - docs/operator-runbook.md (confirm `systemctl --user restart signage-sidecar` is the documented restart procedure)
  </read_first>
  <action>
    Create the file `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` by copying VERBATIM the template from `50-RESEARCH.md` section "50-E2E-RESULTS.md template (proposed — planner copies verbatim)". The template content to paste begins at the line `# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)` and ends at the line `Reviewer: _________________________  Date: ______________`.

    Preserve exactly (these strings must appear in the output file):
    - The H1 heading `# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)`.
    - `**Status:** PENDING — awaiting real Pi hardware walkthrough by operator.`
    - The metadata block: `**Date:**`, `**Hardware:**`, `**Pi OS version:**`, `**Chromium version:**`, `**Sidecar version:**`, `**Backend version:**`, `**Network:**`.
    - The `## Preconditions` checkbox list including the `provision-pi.sh` line and the `duration_s = 5` methodology note.
    - The `## Scenario 4: Reconnect` section with the 6-row markdown table (rows 4.1 through 4.6), a Pass criterion line, and a Notes / anomalies free-text block.
    - The `## Scenario 5: Sidecar Restart` section with the 6-row markdown table (rows 5.1 through 5.6), Pass criterion, and Notes.
    - The `## Pass/Fail Summary` 2-row table.
    - The `## Operator sign-off` 3-checkbox block with the `Reviewer: ... Date: ...` footer.

    Do not add any content that isn't in the research template. Do not delete any rows. Preserve the exact Unicode arrows/characters (e.g. `→`, `≤`, `−`) that the research template uses.
  </action>
  <verify>
    <automated>test -f .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "^## Preconditions$" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "^## Scenario 4" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "^## Scenario 5" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "^## Pass/Fail Summary$" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "^## Operator sign-off$" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "PENDING" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "provision-pi.sh" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "nmcli device disconnect wlan0" .planning/phases/50-pi-polish/50-E2E-RESULTS.md &amp;&amp; grep -q "systemctl --user restart signage-sidecar" .planning/phases/50-pi-polish/50-E2E-RESULTS.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` exists
    - Contains the exact H1 `# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)`
    - Contains `**Status:** PENDING` (signals operator has not yet run it)
    - Contains H2 `## Preconditions`
    - Contains an H2 starting with `## Scenario 4`
    - Contains an H2 starting with `## Scenario 5`
    - Contains H2 `## Pass/Fail Summary`
    - Contains H2 `## Operator sign-off`
    - Contains the literal string `provision-pi.sh`
    - Contains the literal string `nmcli device disconnect wlan0`
    - Contains the literal string `systemctl --user restart signage-sidecar`
    - Contains the literal string `duration_s = 5` (methodology precondition)
    - Scenario 4 markdown table has 6 data rows labelled 4.1 through 4.6
    - Scenario 5 markdown table has 6 data rows labelled 5.1 through 5.6
  </acceptance_criteria>
  <done>50-E2E-RESULTS.md template file committed to the phase directory with all five H2 sections, STATUS=PENDING, and exact-verbatim commands ready for operator execution.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Grep-verify every runbook command exists in the current repo</name>
  <files>(none modified — verification only)</files>
  <read_first>
    - scripts/provision-pi.sh (grep for network-manager / nmcli in the apt-install portion)
    - scripts/lib/signage-packages.txt (canonical apt package list per STATE.md 2026-04-21 note)
    - docs/operator-runbook.md (confirm the restart-sidecar procedure)
    - pi-sidecar/sidecar.py (confirm port 8080 + /health)
    - scripts/README-pi.md (confirm provision-pi.sh is the single provisioning path)
    - .planning/phases/50-pi-polish/50-E2E-RESULTS.md (just-written file from Task 1)
  </read_first>
  <action>
    Grep-verify every command and path that the newly-written `50-E2E-RESULTS.md` references actually exists in the current repo. Run each check below and confirm PASS before marking this task complete:

    1. nmcli availability — verify `network-manager` package (provides `nmcli`) is installed by provisioning:
       `grep -E "network-manager|nmcli" scripts/provision-pi.sh scripts/lib/signage-packages.txt`
       Must match at least one line. If it does NOT match, STOP — `50-E2E-RESULTS.md` references a command operators cannot run. Flag to orchestrator.

    2. systemd user unit for signage-sidecar exists:
       `grep -rn "signage-sidecar" scripts/ docs/operator-runbook.md 2>/dev/null | head -20`
       Must return references to `signage-sidecar.service` (or the file name as actually installed by provision-pi.sh).

    3. Sidecar /health endpoint + port 8080:
       `grep -E "localhost:8080|port.*8080|:8080" pi-sidecar/sidecar.py docs/operator-runbook.md | head -10`
       Must confirm the sidecar serves on 8080.

    4. Operator runbook restart-sidecar procedure:
       `grep -n "systemctl.*restart.*signage-sidecar" docs/operator-runbook.md`
       Must match at least once.

    5. provision-pi.sh is the single provisioning path:
       `grep -n "provision-pi.sh" scripts/README-pi.md docs/operator-runbook.md | head -5`
       Must match. Also confirm the retired pi-image directory is gone: `! test -d pi-image`.

    Record one PASS/FAIL line per check in your scratchpad for the SUMMARY. If any check FAILS, stop and escalate — do not silently continue and do not weaken the template to match a missing command.
  </action>
  <verify>
    <automated>grep -qE "network-manager|nmcli" scripts/provision-pi.sh scripts/lib/signage-packages.txt &amp;&amp; grep -qr "signage-sidecar" scripts/ &amp;&amp; grep -q ":8080" pi-sidecar/sidecar.py &amp;&amp; grep -qE "systemctl.*restart.*signage-sidecar" docs/operator-runbook.md &amp;&amp; grep -q "provision-pi.sh" scripts/README-pi.md &amp;&amp; ! test -d pi-image</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "network-manager|nmcli" scripts/provision-pi.sh scripts/lib/signage-packages.txt` matches at least one line
    - `grep -r "signage-sidecar" scripts/` returns at least one match (systemd unit installation path)
    - `grep ":8080" pi-sidecar/sidecar.py` returns at least one match (sidecar port confirmed)
    - `grep -E "systemctl.*restart.*signage-sidecar" docs/operator-runbook.md` returns at least one match
    - `grep "provision-pi.sh" scripts/README-pi.md` returns at least one match
    - `test -d pi-image` returns non-zero (directory retired 2026-04-21 per STATE.md; must NOT reappear)
    - No file in the repo modified by this task (git diff --stat shows no staged or unstaged changes)
  </acceptance_criteria>
  <done>All five grep checks pass. Every command the operator will read in 50-E2E-RESULTS.md is known to exist in the current repo — no dangling references.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Operator runs Scenarios 4 + 5 on real Pi hardware and records timings</name>
  <files>.planning/phases/50-pi-polish/50-E2E-RESULTS.md</files>
  <read_first>
    - .planning/phases/50-pi-polish/50-E2E-RESULTS.md (the template just written; operator fills in the blanks)
    - .planning/phases/50-pi-polish/50-RESEARCH.md sections "Scenario 4 methodology" and "Scenario 5 methodology" (the background explanation of WHY each step is there — read before running so you can interpret anomalies)
    - docs/operator-runbook.md (general operator context)
  </read_first>
  <action>
  <what-built>
    Claude has produced `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` — a structured recording template with two scenarios. Every command in the template has been grep-verified to exist in the current repo. The operator now needs to run the walkthrough on physical Pi hardware and fill in the blanks.
  </what-built>
  <how-to-verify>
    **Preconditions (one-time setup):**
    1. Fresh Raspberry Pi with Raspberry Pi OS Bookworm Lite 64-bit.
    2. Run `scripts/provision-pi.sh` against the Pi per `scripts/README-pi.md`.
    3. Pair the Pi in the admin UI.
    4. In admin UI, create a **test playlist** with **at least 3 items**, each `duration_s = 5`. (Short durations are a methodology precondition — see RESEARCH Pitfall 5.)
    5. Let the playlist loop at least once so `/var/lib/signage/media/` has cached copies of all items.
    6. Confirm baseline: on the Pi, `curl http://localhost:8080/health` returns `{"ready":true,"online":true,...}`.

    **Scenario 4 — Reconnect -> Admin Change (budget: T1 - T0 <= 30 s):**
    1. In one terminal on the Pi: `sudo -u signage journalctl --user -u signage-sidecar -f --output=short-precise`.
    2. On operator laptop: `date +"%Y-%m-%dT%H:%M:%S.%N T_disconnect"; ssh signage@<pi> sudo nmcli device disconnect wlan0`.
    3. Wait 40 s. Confirm sidecar journal prints `online=false` after ~30 s. Playback continues from cache.
    4. `date +"%Y-%m-%dT%H:%M:%S.%N T_reconnect"; ssh signage@<pi> sudo nmcli device connect wlan0`.
    5. Watch sidecar journal for `online=true` (typically within 15 s).
    6. In admin UI, perform a playlist mutation (swap items 1 and 2 via drag-drop, OR delete item 1). **Record wall-clock T0** immediately on "Save" click.
    7. Watch the Pi HDMI display. When the new first item appears on screen, **record wall-clock T1**.
    8. Compute `T1 - T0`. **Pass if <= 30.0 s**, no black screen, no error banner.
    9. Fill rows 4.1 through 4.6 of the Scenario 4 table in `50-E2E-RESULTS.md`.

    **Scenario 5 — Sidecar Restart -> Playback Continuity:**
    1. With playback still running steadily:
       ```
       SIGNAGE_UID=$(id -u signage)
       date +"%Y-%m-%dT%H:%M:%S.%N T0" \
         && sudo -u signage XDG_RUNTIME_DIR=/run/user/${SIGNAGE_UID} \
              systemctl --user restart signage-sidecar \
         && until curl -fs http://localhost:8080/health | grep -q '"ready":true'; do sleep 1; done \
         && date +"%Y-%m-%dT%H:%M:%S.%N T1"
       ```
    2. **Observer watches display continuously** from T0 through T0 + 30 s. Record: any black frame? any broken-image icon? any error overlay?
    3. Confirm sidecar journal shows `Loaded persisted device token from disk.`
    4. Let playback continue 60 s post-restart. Count successful item advances.
    5. **Pass if:** row 5.2 is zero visible interruption AND `T1 - T0 <= 15 s`.
    6. Fill rows 5.1 through 5.6 of the Scenario 5 table.

    **Close-out:**
    7. Change the file's `**Status:** PENDING` line to `**Status:** PASS` (or `**Status:** FAIL — <notes>`).
    8. Fill in metadata block at top (Date, Hardware, Pi OS version, Chromium version, Sidecar/Backend git SHAs, Network details).
    9. Fill in the `## Pass/Fail Summary` table with the two scenarios.
    10. Sign the operator sign-off block.
    11. Commit: `git add .planning/phases/50-pi-polish/50-E2E-RESULTS.md && git commit -m "docs(50): record Scenarios 4+5 hardware E2E results — SGN-POL-04"`.

    **If Scenario 4 T1 - T0 > 30 s:** per 50-RESEARCH.md OQ4, this is a legitimate finding that opens a follow-up defect, NOT a blocker for this plan. Record the observed number honestly in the doc; the orchestrator decides whether to raise the budget, optimise the polling interval, or accept as-measured.
  </how-to-verify>
  </action>
  <verify>
    Operator-recorded numerical timings in .planning/phases/50-pi-polish/50-E2E-RESULTS.md (Scenario 4 T1 - T0 and Scenario 5 cold-start); Status line flipped from PENDING to PASS/FAIL; file committed. See &lt;acceptance_criteria&gt; for exact checks.
  </verify>
  <resume-signal>
    Type "approved" when `50-E2E-RESULTS.md` is filled in and committed. Describe issues if either scenario failed.
  </resume-signal>
  <acceptance_criteria>
    - `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` `**Status:**` line is no longer `PENDING`
    - Metadata block top-of-file has non-placeholder values for Date, Hardware, Pi OS version
    - Scenario 4 row 4.6 has a numerical `T1 − T0` value in the Actual column (not blank, not `___`)
    - Scenario 5 row 5.3 has a numerical cold-start value in the Actual column
    - `## Pass/Fail Summary` table has Result = PASS (or FAIL with explanation) for both scenarios
    - Operator sign-off block has all three checkboxes checked and Reviewer/Date lines filled
    - File is committed to git (`git log -1 .planning/phases/50-pi-polish/50-E2E-RESULTS.md` shows a commit beyond the template-creation commit)
  </acceptance_criteria>
  <done>Operator has physically run both scenarios on a provision-pi.sh-provisioned Pi, recorded numerical timings, signed off, and committed. SGN-POL-04 CLOSED.</done>
</task>

</tasks>

<verification>
Phase-level checks:
- `test -f .planning/phases/50-pi-polish/50-E2E-RESULTS.md` — file exists after Task 1.
- `grep -c "^## " .planning/phases/50-pi-polish/50-E2E-RESULTS.md` — at least 5 (five required H2 sections).
- Task 2 grep-verifications all return PASS (see Task 2 acceptance criteria).
- Post-Task-3: file no longer says `PENDING`; has numerical timings in Scenarios 4 and 5 tables.
</verification>

<success_criteria>
- [ ] `50-E2E-RESULTS.md` exists in `.planning/phases/50-pi-polish/` with all five required H2 sections (Preconditions, Scenario 4, Scenario 5, Pass/Fail Summary, Operator sign-off).
- [ ] Every command referenced in the doc (`nmcli device disconnect wlan0`, `systemctl --user restart signage-sidecar`, `curl localhost:8080/health`, `provision-pi.sh`) is grep-verified to exist in the current repo.
- [ ] Operator-phase acceptance (**carry-over until operator runs on hardware**): Scenario 4 T1 - T0 <= 30 s; Scenario 5 visual continuity = PASS and sidecar cold-start <= 15 s; both recorded numerically in the doc.
- [ ] Plan marked non-autonomous — orchestrator must surface the checkpoint to the operator before the phase is considered complete.
</success_criteria>

<output>
After completion, create `.planning/phases/50-pi-polish/50-02-SUMMARY.md` with:
- Link to the committed `50-E2E-RESULTS.md`.
- Task 2 grep-verification results (5 PASS/FAIL lines).
- For Task 3: the operator-recorded Scenario 4 T1 - T0 and Scenario 5 cold-start + visual-continuity verdict.
- Note that SGN-POL-04 is CLOSED (or open with specific carry-forward if either scenario failed).
</output>
