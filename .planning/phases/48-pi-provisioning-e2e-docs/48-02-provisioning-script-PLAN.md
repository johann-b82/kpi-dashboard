---
phase: 48-pi-provisioning-e2e-docs
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/provision-pi.sh
  - scripts/systemd/signage-sidecar.service
  - scripts/systemd/signage-player.service
  - scripts/systemd/labwc.service
  - scripts/README-pi.md
autonomous: true
requirements: [SGN-OPS-03]
must_haves:
  truths:
    - "`sudo ./scripts/provision-pi.sh <api-url>` on fresh Bookworm Lite 64-bit: creates `signage` user, installs apt packages (Phase 44 fonts + chromium-browser + unclutter-xfixes + labwc + seatd + python3-venv), drops three unit files, enables linger, enables+starts all three units"
    - "Script is idempotent — re-running on a provisioned Pi exits 0 without error"
    - "Systemd unit files match RESEARCH §4 verbatim (no paraphrasing) with UID/api-host placeholder substitution"
    - "`chromium-browser` is installed from the RPi archive (NOT Debian `chromium`); provision script errors if `/etc/apt/sources.list.d/raspi.list` is missing (Pitfall 2)"
    - "Kiosk Chromium flag set matches SGN-OPS-03 verbatim"
    - "`unclutter-xfixes` used (NOT `unclutter` — Pitfall 1); signage user added to `video,audio,render,input` groups (Pitfall 10)"
    - "Exit codes per RESEARCH §7 (0/1/2/3/4); usage banner shown when SIGNAGE_API_URL missing"
  artifacts:
    - path: scripts/provision-pi.sh
      provides: "Idempotent bash bootstrap for a fresh Pi"
    - path: scripts/systemd/signage-sidecar.service
      provides: "Verbatim unit from RESEARCH §4.1"
    - path: scripts/systemd/signage-player.service
      provides: "Verbatim unit from RESEARCH §4.2 (kiosk with Wayland socket gate)"
    - path: scripts/systemd/labwc.service
      provides: "Verbatim unit from RESEARCH §4.3 (labwc user service)"
    - path: scripts/README-pi.md
      provides: "Operator-facing quickstart: flash → ssh → clone → ./provision-pi.sh"
  key_links:
    - from: scripts/provision-pi.sh
      to: scripts/systemd/*.service
      via: "install -m 0644 to /home/signage/.config/systemd/user/"
      pattern: "systemd/user"
    - from: scripts/systemd/signage-player.service
      to: /opt/signage/ (frontend kiosk URL)
      via: "Environment=SIGNAGE_API_URL + --app=http://${SIGNAGE_API_URL}/player/"
      pattern: "--app=http"
---

<objective>
Write `scripts/provision-pi.sh` — the one-shot bootstrap that takes a freshly-flashed Raspberry Pi OS Bookworm Lite 64-bit image to a running signage kiosk. Drops the three systemd user units (labwc, sidecar, player), creates the non-root `signage` user, installs the apt package set, enables linger, and starts all services.

Purpose: Satisfies SGN-OPS-03's "operator runbook — Pi image build (Bookworm Lite 64-bit + Chromium 136+ + unclutter + systemd user service)" and "dedicated `signage` user (NOT root — keeps Chromium sandbox enabled)". The script is the glue that makes the sidecar (48-01) and the kiosk flag set meet real hardware.
Output: One bash script + three verbatim systemd unit templates + a short Pi README.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
@.planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
@backend/Dockerfile
@docker-compose.yml
</context>

<pitfalls_inherited>
From 48-RESEARCH.md §11 — directly bind this plan's correctness:

- **Pitfall 1:** Use `unclutter-xfixes`, NOT `unclutter` (fails silently under Wayland).
- **Pitfall 2:** `chromium-browser` (RPi archive) NOT `chromium` (Debian). Script MUST check `/etc/apt/sources.list.d/raspi.list` exists and error with a pointer to the RPi archive if missing.
- **Pitfall 3:** Wayland socket race — the `ExecStartPre` guard loop in `signage-player.service` is load-bearing. Do not remove.
- **Pitfall 4:** `XDG_RUNTIME_DIR` must match the signage user's actual UID. Script MUST compute `SIGNAGE_UID=$(id -u signage)` at provision time and substitute.
- **Pitfall 7:** `loginctl enable-linger` needs systemd 219+. Bookworm ships 252 so fine; add a sanity check anyway (`systemctl --version | head -1`).
- **Pitfall 8:** Do NOT assume a `pi` user exists — Bookworm Lite uses a user set via Raspberry Pi Imager. All references are to `signage`.
- **Pitfall 10:** `signage` user MUST be in groups `video,audio,render,input` — without `render`, Chromium falls back to software rendering on Pi 3B.
</pitfalls_inherited>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Drop the three systemd unit templates VERBATIM from RESEARCH §4</name>
  <files>scripts/systemd/signage-sidecar.service, scripts/systemd/signage-player.service, scripts/systemd/labwc.service</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §4.1 (signage-sidecar.service)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §4.2 (signage-player.service)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §4.3 (labwc.service)
  </read_first>
  <action>
    Create the three files under `scripts/systemd/` with content COPIED VERBATIM from RESEARCH §4.1, §4.2, §4.3. Do not paraphrase. Do not re-order sections. Do not alter the `[Unit]`, `[Service]`, `[Install]` sections.

    Substitute the two placeholders (these are intended, NOT paraphrase):
    - `<api-host>` / `<SIGNAGE_API_URL>` → leave as literal `__SIGNAGE_API_URL__` token; the provision script will `sed` it at install time.
    - `1001` (the hardcoded UID in `XDG_RUNTIME_DIR=/run/user/1001`) → leave as literal `__SIGNAGE_UID__` token; the provision script substitutes from `id -u signage`.

    RESEARCH §4.2 resolves Open Question 1 (template unit vs static unit) by going with **static unit + env substitution** (NOT `%i` template instance) per this plan's decision. Therefore the `--app=http://%i/player/` line in RESEARCH §4.2 is replaced with `--app=http://__SIGNAGE_API_URL__/player/` at file-write time. Record this choice in `scripts/README-pi.md` (Task 3).

    After writing, verify the files contain the load-bearing lines:
    - signage-sidecar.service: `ReadWritePaths=/var/lib/signage`, `PrivateTmp=yes`, `ProtectSystem=strict`, `--host 127.0.0.1`
    - signage-player.service: `ExecStartPre=/bin/bash -c 'while [ ! -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; do sleep 1; done'`, the full SGN-OPS-03 Chromium flag string, `--ozone-platform=wayland`, `Requires=signage-sidecar.service`
    - labwc.service: `ExecStart=/usr/bin/labwc`, `XDG_RUNTIME_DIR=/run/user/__SIGNAGE_UID__`
  </action>
  <verify>
    <automated>test -f scripts/systemd/signage-sidecar.service && test -f scripts/systemd/signage-player.service && test -f scripts/systemd/labwc.service && grep -q "ReadWritePaths=/var/lib/signage" scripts/systemd/signage-sidecar.service && grep -q 'ExecStartPre=/bin/bash -c .while \[ ! -S' scripts/systemd/signage-player.service && grep -q "ozone-platform=wayland" scripts/systemd/signage-player.service && grep -q "autoplay-policy=no-user-gesture-required" scripts/systemd/signage-player.service && grep -q "ExecStart=/usr/bin/labwc" scripts/systemd/labwc.service</automated>
  </verify>
  <done>
    Three unit files exist under `scripts/systemd/` and contain the verbatim content from RESEARCH §4, with the two placeholder tokens (`__SIGNAGE_API_URL__`, `__SIGNAGE_UID__`) in place of values the provision script will substitute.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Write scripts/provision-pi.sh — idempotent bootstrap per RESEARCH §7</name>
  <files>scripts/provision-pi.sh</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §5 (apt package list)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §7 (step-by-step outline + exit codes + idempotency rules)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §11 Pitfalls 1, 2, 4, 7, 8, 10
  </read_first>
  <action>
    Write `scripts/provision-pi.sh` implementing the 10 steps from RESEARCH §7. Structural requirements:

    ```bash
    #!/usr/bin/env bash
    # Phase 48 D-3: idempotent Pi bootstrap. Run as root on a fresh Bookworm Lite 64-bit image.
    # Usage: sudo SIGNAGE_API_URL=host:port ./scripts/provision-pi.sh
    #    or: sudo ./scripts/provision-pi.sh <api-host:port>
    set -euo pipefail
    ```

    Implement each step with the EXACT idempotency guards from RESEARCH §7:

    - **Step 0 Pre-flight:** root check, aarch64 check, SIGNAGE_API_URL presence, print banner, `systemctl --version` check (Pitfall 7).
    - **Step 0.5 (new, Pitfall 2):** `test -f /etc/apt/sources.list.d/raspi.list` — if missing, error with a message pointing to `https://archive.raspberrypi.com/debian/` and exit 2.
    - **Step 1 apt install:** list EXACTLY (from RESEARCH §5):
      ```
      chromium-browser unclutter-xfixes git python3-venv python3-pip \
      labwc seatd \
      fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto-core fonts-dejavu-core \
      ca-certificates curl network-manager
      ```
      Run `apt-get update -qq && apt-get install -y --no-install-recommends <pkgs>`.
    - **Step 2 user creation:** `id signage || useradd -m -s /bin/bash -G video,audio,render,input signage` (Pitfall 10). If the user already exists, ensure all four groups are applied via `usermod -aG video,audio,render,input signage` (idempotent).
    - **Step 3 directory creation:** three `install -d -m <mode> -o signage -g signage` calls per RESEARCH §7 Step 3.
    - **Step 4 repo clone:** if-else per RESEARCH §7 Step 4. Use repo remote from `git -C $(dirname "$0")/.. config --get remote.origin.url` when cloning on a new Pi (operator runs from a local copy; this is the bootstrap case). Otherwise document that the operator must clone manually — favor the simpler path: the script assumes it's been executed from an already-cloned `/opt/signage`.
    - **Step 5 venv:** `python3 -m venv /opt/signage/pi-sidecar/.venv` (note: use the `pi-sidecar/` dir from Plan 48-01). Install from `pi-sidecar/requirements.txt` (NOT inline versions — source of truth is the requirements file).
    - **Step 5.5 (new, Pitfall 6):** After pip install, run `/opt/signage/pi-sidecar/.venv/bin/python -m compileall /opt/signage/pi-sidecar/.venv/lib` so the venv is fully compiled (ProtectSystem=strict prevents runtime `.pyc` writes).
    - **Step 6 unit files:** For each of the three unit files:
      1. Read the template from `scripts/systemd/*.service`.
      2. `sed -e "s|__SIGNAGE_API_URL__|${SIGNAGE_API_URL}|g" -e "s|__SIGNAGE_UID__|$(id -u signage)|g"` (Pitfall 4).
      3. Write to `/home/signage/.config/systemd/user/<name>.service` mode 0644 owned by signage:signage.
    - **Step 7 linger:** `loginctl enable-linger signage` (idempotent).
    - **Step 8 enable+start:** both `systemctl --user daemon-reload` and `systemctl --user enable --now labwc.service signage-sidecar.service signage-player.service` executed as the signage user with `XDG_RUNTIME_DIR=/run/user/$(id -u signage)`.
    - **Step 9 Pi 3B Wayland force:** exact block from RESEARCH §7 Step 9.
    - **Step 10 completion banner:** exact text from RESEARCH §7 Step 10.

    Exit codes: 0 success; 1 missing args/not root; 2 apt failure; 3 git/config failure; 4 pip failure.

    Make the script executable: `chmod +x scripts/provision-pi.sh` (the plan executor runs this).
  </action>
  <verify>
    <automated>test -x scripts/provision-pi.sh && bash -n scripts/provision-pi.sh && grep -q "chromium-browser" scripts/provision-pi.sh && grep -q "unclutter-xfixes" scripts/provision-pi.sh && grep -q "video,audio,render,input" scripts/provision-pi.sh && grep -q "loginctl enable-linger signage" scripts/provision-pi.sh && grep -q "raspi.list" scripts/provision-pi.sh && grep -q "__SIGNAGE_UID__" scripts/provision-pi.sh && grep -q "__SIGNAGE_API_URL__" scripts/provision-pi.sh</automated>
  </verify>
  <done>
    `scripts/provision-pi.sh` exists, is executable, passes `bash -n` syntax check, and contains the 10 steps with all required guards (RPi archive check, group list, linger, UID/URL substitution). Pitfalls 1, 2, 4, 7, 8, 10 are visibly addressed in the script.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Write scripts/README-pi.md — operator quickstart</name>
  <files>scripts/README-pi.md</files>
  <read_first>
    - .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md §7 Step 10 (completion banner wording)
    - .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md D-3 (provisioning mechanism)
  </read_first>
  <action>
    Create `scripts/README-pi.md` — a short operator-facing quickstart. Sections:

    1. **Prerequisites** — Bookworm Lite 64-bit flashed, Wi-Fi + SSH configured via Imager.
    2. **Quickstart**:
       ```
       ssh <user>@<pi-host>
       sudo git clone https://github.com/<org>/kpi-dashboard /opt/signage
       sudo SIGNAGE_API_URL=<api-host:port> /opt/signage/scripts/provision-pi.sh
       ```
    3. **What it does** — one-line per step (1-10 from RESEARCH §7).
    4. **Verifying** — `sudo -u signage journalctl --user -u signage-player -f`, `curl http://localhost:8080/health` on the Pi.
    5. **Re-running** — call out idempotency.
    6. **Exit codes** — copy the 0/1/2/3/4 table from RESEARCH §7.
    7. **Note on unit unit-file strategy** — record that this plan chose static units with token substitution (`__SIGNAGE_API_URL__`, `__SIGNAGE_UID__`) over systemd template units (`%i`), per Open Question 1 resolution.
    8. **Pointer to full runbook** — "See `frontend/src/docs/en/admin-guide/digital-signage.md` for the end-user-facing admin guide and `docs/operator-runbook.md` for the full operator runbook (Plan 48-04)."
  </action>
  <verify>
    <automated>test -f scripts/README-pi.md && grep -q "provision-pi.sh" scripts/README-pi.md && grep -q "loginctl" scripts/README-pi.md && grep -q "idempotent" scripts/README-pi.md</automated>
  </verify>
  <done>
    `scripts/README-pi.md` exists with the 8 sections. Any Pi operator can follow it from flash to kiosk without reading the plan files.
  </done>
</task>

</tasks>

<verification>
- Three unit files exist under `scripts/systemd/` and are VERBATIM from RESEARCH §4.
- `bash -n scripts/provision-pi.sh` exits 0.
- Script contains `raspi.list` check (Pitfall 2) + `unclutter-xfixes` (Pitfall 1) + `video,audio,render,input` groups (Pitfall 10) + UID substitution (Pitfall 4) + linger + idempotency guards.
- Real Pi execution is Plan 48-05's E2E walkthrough — do NOT attempt to run the script from this plan's verification.
</verification>

<success_criteria>
- SGN-OPS-03 satisfied: bootstrap script + unit files + apt package list all present on disk and ready for Plan 48-05 Pi execution.
- Idempotent per `<must_haves>` — verifiable by reading the guards in each step.
- Systemd unit content matches RESEARCH §4 verbatim (no paraphrasing permitted; orchestrator may spot-diff).
</success_criteria>

<output>
After completion, create `.planning/phases/48-pi-provisioning-e2e-docs/48-02-SUMMARY.md` recording:
- Files committed (script + 3 units + README)
- Any deviations from RESEARCH §4 unit content (expected: zero)
- Dry-run status: `bash -n` clean, NOT yet executed on real Pi (Plan 48-05)
- Flag that the Pi-3B Wayland block in Step 9 is best-effort (RESEARCH LOW-confidence note)
</output>

<files_to_read>
- .planning/phases/48-pi-provisioning-e2e-docs/48-CONTEXT.md
- .planning/phases/48-pi-provisioning-e2e-docs/48-RESEARCH.md
- backend/Dockerfile
- pi-sidecar/requirements.txt  (written by Plan 48-01; may not yet exist at time of executor reading — OK, reference only)
- docker-compose.yml
- CLAUDE.md
</files_to_read>
