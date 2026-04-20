---
phase: 49-pi-image-build
plan: 02
type: execute
wave: 2
depends_on: [49-01]
files_modified:
  - pi-image/stage-signage/signage-firstboot.service
  - pi-image/stage-signage/signage.conf.template
  - scripts/firstboot.sh
  - pi-image/stage-signage/01-run-chroot.sh
  - pi-image/stage-signage/prerun.sh
  - pi-image/README.md
autonomous: true
requirements: [SGN-IMG-04, SGN-IMG-06, SGN-IMG-07]
must_haves:
  truths:
    - "`pi-image/stage-signage/signage-firstboot.service` exists verbatim from RESEARCH §4 with ConditionPathExists=/boot/firmware/signage.conf and ExecStartPost systemctl disable"
    - "`scripts/firstboot.sh` reads /boot/firmware/signage.conf, writes /etc/signage/config with SIGNAGE_API_URL, patches __SIGNAGE_API_URL__ in the three systemd user unit files, reloads + restarts signage-sidecar.service and signage-player.service, and optionally sets hostname"
    - "The service self-disables after successful run (ExecStartPost systemctl disable) and is idempotent (ConditionPathExists guard + sed-after-substitution is a no-op on second boot)"
    - "The pi-gen stage-signage chroot wiring enables signage-firstboot.service via symlink into /etc/systemd/system/multi-user.target.wants/"
    - "`pi-image/README.md` documents the operator-facing preseed schema (SIGNAGE_API_URL, SIGNAGE_HOSTNAME, WIFI_SSID, WIFI_PSK) and the flash-then-edit-SD workflow"
    - "`unclutter-xfixes` package is confirmed available in Debian Bookworm main (one-line apt-cache check documented; flagged if missing so the package list is adjusted)"
  artifacts:
    - path: pi-image/stage-signage/signage-firstboot.service
      provides: "System-level oneshot unit; runs once on first boot, reads preseed, self-disables"
      contains: "ConditionPathExists=/boot/firmware/signage.conf ExecStart=/opt/signage/scripts/firstboot.sh"
    - path: scripts/firstboot.sh
      provides: "First-boot script — reads preseed, writes /etc/signage/config, sed-patches unit files, restarts user services, optionally sets hostname"
      contains: "PRESEED=/boot/firmware/signage.conf SIGNAGE_API_URL __SIGNAGE_API_URL__"
    - path: pi-image/stage-signage/signage.conf.template
      provides: "Preseed placeholder baked onto FAT partition at build time"
    - path: pi-image/README.md
      provides: "Operator-facing preseed schema + flash workflow (extended from Plan 49-01)"
  key_links:
    - from: pi-image/stage-signage/signage-firstboot.service
      to: scripts/firstboot.sh
      via: "ExecStart=/opt/signage/scripts/firstboot.sh"
      pattern: "ExecStart=.*firstboot\\.sh"
    - from: scripts/firstboot.sh
      to: /boot/firmware/signage.conf
      via: "source \"${PRESEED}\" where PRESEED=/boot/firmware/signage.conf"
      pattern: "source.*signage\\.conf"
    - from: scripts/firstboot.sh
      to: /etc/signage/config
      via: "cat > ${CONFIG_FILE} with SIGNAGE_API_URL"
      pattern: "/etc/signage/config"
    - from: scripts/firstboot.sh
      to: "/home/signage/.config/systemd/user/{labwc,signage-sidecar,signage-player}.service"
      via: "sed -i s|__SIGNAGE_API_URL__|${SIGNAGE_API_URL}|g"
      pattern: "__SIGNAGE_API_URL__"
    - from: pi-image/stage-signage/01-run-chroot.sh
      to: pi-image/stage-signage/signage-firstboot.service
      via: "ln -sf into /etc/systemd/system/multi-user.target.wants/"
      pattern: "multi-user.target.wants/signage-firstboot"
---

<objective>
Implement the first-boot preseed mechanism: bake `/boot/firmware/signage.conf` as a placeholder onto the FAT partition, ship `signage-firstboot.service` (oneshot, self-disabling) + `scripts/firstboot.sh` that reads the preseed, writes `/etc/signage/config`, patches unit placeholders, and restarts the signage user services. Wire the firstboot unit into the pi-gen stage so it is enabled at image-build time.

Purpose: Satisfy SGN-IMG-06 (Imager-assisted preseed supplies SIGNAGE_API_URL + Wi-Fi + hostname), SGN-IMG-07 (firstboot oneshot reads preseed, writes config, restarts services, self-disables, idempotent), and SGN-IMG-04 (pairing code appears on display within 60 s of firstboot completion).

Output: Self-disabling oneshot unit + firstboot.sh script (verbatim from RESEARCH §4) + pi-gen stage-signage wiring + operator-facing preseed schema in `pi-image/README.md`. Verified by a local rebuild smoke where a sample `signage.conf` drives `/etc/signage/config` to the expected contents.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-pi-image-build/49-CONTEXT.md
@.planning/phases/49-pi-image-build/49-RESEARCH.md
@.planning/phases/49-pi-image-build/49-01-SUMMARY.md
@.planning/REQUIREMENTS.md
@scripts/lib/signage-install.sh
@scripts/lib/signage-packages.txt
@pi-image/stage-signage/01-run-chroot.sh
@pi-image/stage-signage/prerun.sh
@pi-image/README.md
@scripts/systemd/signage-sidecar.service
@scripts/systemd/signage-player.service
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Author signage-firstboot.service (verbatim RESEARCH §4) + signage.conf.template + unclutter-xfixes availability check</name>
  <files>pi-image/stage-signage/signage-firstboot.service, pi-image/stage-signage/signage.conf.template</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"First-Boot Oneshot Design → `pi-image/stage-signage/signage-firstboot.service`" (VERBATIM)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 1 → Exact fields documented for operators" (VERBATIM signage.conf schema)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md Pitfall 11 (add `After=boot-firmware.mount` consideration)
    - pi-image/stage-signage/signage.conf.template (may already exist from Plan 49-01 — confirm/overwrite)
  </read_first>
  <action>
    **Step A — Create `pi-image/stage-signage/signage-firstboot.service` VERBATIM from RESEARCH §"First-Boot Oneshot Design":**

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

    Replace `<org>` with `johann-bechtold` (or leave the placeholder if the org name is not finalized; flag in SUMMARY).

    **Step B — (Re)write `pi-image/stage-signage/signage.conf.template` VERBATIM from RESEARCH §"Unknown 1":**

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

    **Step C — `unclutter-xfixes` one-line availability verification (RESEARCH §"Open Questions for the Planner" #5 / CONTEXT OQ):**
    Run on any Debian Bookworm box (or document the expected check for the CAX21 runner):
    ```
    apt-cache policy unclutter-xfixes 2>/dev/null | head -5
    ```
    Expected: a `Candidate:` line with a version string; not `(none)`. Record the result in the plan SUMMARY. If the package is unavailable on plain Bookworm main (non-raspi archive), note it and the package list may need `unclutter` instead — but RESEARCH confirms `unclutter-xfixes` is in Debian main, and the existing `provision-pi.sh` already uses it successfully, so this is a one-line sanity check, not a redesign.

    **Step D — systemd-analyze verify:**
    ```
    systemd-analyze verify pi-image/stage-signage/signage-firstboot.service
    ```
    Must exit 0. If `systemd-analyze` is unavailable locally, defer to a CI run and note in SUMMARY.
  </action>
  <verify>
    <automated>test -f pi-image/stage-signage/signage-firstboot.service && grep -q "ConditionPathExists=/boot/firmware/signage.conf" pi-image/stage-signage/signage-firstboot.service && grep -q "ExecStart=/opt/signage/scripts/firstboot.sh" pi-image/stage-signage/signage-firstboot.service && grep -q "ExecStartPost=/bin/systemctl disable signage-firstboot.service" pi-image/stage-signage/signage-firstboot.service && test -f pi-image/stage-signage/signage.conf.template && grep -q "SIGNAGE_API_URL" pi-image/stage-signage/signage.conf.template && grep -q "SIGNAGE_HOSTNAME" pi-image/stage-signage/signage.conf.template</automated>
  </verify>
  <done>
    Firstboot service unit matches RESEARCH verbatim. signage.conf template has the 4 documented keys. unclutter-xfixes availability confirmed (or flagged).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Author scripts/firstboot.sh (verbatim RESEARCH §4) + wire into pi-gen stage</name>
  <files>scripts/firstboot.sh, pi-image/stage-signage/01-run-chroot.sh, pi-image/stage-signage/prerun.sh</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"First-Boot Oneshot Design → `scripts/firstboot.sh`" (VERBATIM)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md Pitfall 5 (blank SIGNAGE_API_URL must cause exit 1)
    - pi-image/stage-signage/01-run-chroot.sh (from Plan 49-01; has the firstboot enable-symlink guard)
    - pi-image/stage-signage/prerun.sh (from Plan 49-01; has the firstboot-missing guard)
  </read_first>
  <action>
    **Step A — Create `scripts/firstboot.sh` VERBATIM from RESEARCH §"First-Boot Oneshot Design → `scripts/firstboot.sh`":**

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

    `chmod +x scripts/firstboot.sh`.

    **Step B — Drop the Plan 49-01 guards** in `pi-image/stage-signage/prerun.sh` and `01-run-chroot.sh`:
    - In `prerun.sh`: remove the `if [ ! -f ... signage-firstboot.service ]` WARN guard — the file now exists. The `install -m 0644 ... signage-firstboot.service ...` line copies it into `${ROOTFS}/etc/systemd/system/` unconditionally.

      ALSO ADD: copy `scripts/firstboot.sh` into `${ROOTFS}/opt/signage/scripts/firstboot.sh` (mode 0755), e.g.:
      ```bash
      install -d -m 0755 "${ROOTFS}/opt/signage/scripts"
      install -m 0755 "${REPO_ROOT}/scripts/firstboot.sh" "${ROOTFS}/opt/signage/scripts/firstboot.sh"
      ```
    - In `01-run-chroot.sh`: the `ln -sf /etc/systemd/system/signage-firstboot.service /etc/systemd/system/multi-user.target.wants/signage-firstboot.service` line can now run unconditionally (drop any Plan 49-01 WARN guard).

    **Step C — Extend `pi-image/README.md`** with an operator-facing "First-boot preseed" section:
    - Path: `/boot/firmware/signage.conf` (FAT32 partition, readable from Windows/Mac/Linux SD mount)
    - Required fields: `SIGNAGE_API_URL=<host:port>`
    - Optional fields: `SIGNAGE_HOSTNAME=`, `WIFI_SSID=`, `WIFI_PSK=` (Wi-Fi preferably via Imager custom settings)
    - Flash workflow: flash `.img.xz` via Imager → eject → remount SD on workstation → edit `/boot/firmware/signage.conf` → eject → insert in Pi → power on.
    - What happens on first boot (cite the service + script): service reads preseed, writes `/etc/signage/config`, patches unit placeholders, restarts signage user services, self-disables.
    - Re-applying: edit `signage.conf`, set `SIGNAGE_API_URL=...` again (the idempotency tail-sed will have commented it out), `sudo systemctl enable --now signage-firstboot.service` OR reboot.
  </action>
  <verify>
    <automated>test -x scripts/firstboot.sh && grep -q 'PRESEED="/boot/firmware/signage.conf"' scripts/firstboot.sh && grep -q "/etc/signage/config" scripts/firstboot.sh && grep -q "__SIGNAGE_API_URL__" scripts/firstboot.sh && grep -q "systemctl disable signage-firstboot" pi-image/stage-signage/signage-firstboot.service && grep -q "firstboot.sh" pi-image/stage-signage/prerun.sh && grep -q "multi-user.target.wants/signage-firstboot" pi-image/stage-signage/01-run-chroot.sh && bash -n scripts/firstboot.sh && grep -q "First-boot preseed" pi-image/README.md</automated>
  </verify>
  <done>
    firstboot.sh is verbatim RESEARCH §4; prerun.sh copies it into the chroot at `/opt/signage/scripts/firstboot.sh`; 01-run-chroot.sh enables the unit unconditionally; README has operator schema + flash workflow.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Local rebuild smoke + firstboot shell-level simulation</name>
  <files>.planning/phases/49-pi-image-build/49-02-FIRSTBOOT-TEST.md</files>
  <read_first>
    - scripts/firstboot.sh (just-written)
    - pi-image/stage-signage/signage-firstboot.service
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 7: QEMU Smoke Test" (shell-level ≠ QEMU, but same spirit)
  </read_first>
  <action>
    Two verifications:

    **A. Local rebuild smoke** — on a Docker+arm64 box (or defer to CAX21 runner): `cd pi-image && make build`. Confirm a new `.img.xz` is produced. If the local build was deferred in Plan 49-01, also defer here — just record the deferral in `49-02-FIRSTBOOT-TEST.md`.

    **B. Shell-level firstboot simulation** — runs on any Linux host (no Pi required). This proves the SCRIPT logic is correct even without the QEMU/hardware gate:
    ```bash
    # Create a throwaway sandbox
    SANDBOX=$(mktemp -d)
    mkdir -p "${SANDBOX}/boot/firmware" "${SANDBOX}/etc/signage" "${SANDBOX}/home/signage/.config/systemd/user"
    cat > "${SANDBOX}/boot/firmware/signage.conf" <<EOF
    SIGNAGE_API_URL=192.168.1.100:80
    SIGNAGE_HOSTNAME=
    WIFI_SSID=
    WIFI_PSK=
    EOF
    # Drop placeholder unit files
    for U in labwc signage-sidecar signage-player; do
      echo "ExecStart=/usr/bin/chromium-browser --app=http://__SIGNAGE_API_URL__/player/" \
        > "${SANDBOX}/home/signage/.config/systemd/user/${U}.service"
    done
    # Run a patched firstboot.sh with PRESEED / CONFIG_DIR / UNIT_DIR rebased onto SANDBOX
    # (cannot test the systemctl branch without systemd; assert static-transformation portion only)
    sed -e "s|/boot/firmware/|${SANDBOX}/boot/firmware/|g" \
        -e "s|/etc/signage|${SANDBOX}/etc/signage|g" \
        -e "s|/home/signage/.config/systemd/user|${SANDBOX}/home/signage/.config/systemd/user|g" \
        -e "/systemctl/d" -e "/user@/d" -e "/hostnamectl/d" \
        scripts/firstboot.sh > "${SANDBOX}/firstboot-test.sh"
    chmod +x "${SANDBOX}/firstboot-test.sh"
    SIGNAGE_UID=$(id -u) bash "${SANDBOX}/firstboot-test.sh" || true
    # Assertions
    test -f "${SANDBOX}/etc/signage/config"
    grep -q "SIGNAGE_API_URL=192.168.1.100:80" "${SANDBOX}/etc/signage/config"
    ! grep -q "__SIGNAGE_API_URL__" "${SANDBOX}/home/signage/.config/systemd/user/signage-player.service"
    grep -q "192.168.1.100:80" "${SANDBOX}/home/signage/.config/systemd/user/signage-player.service"
    ```

    Record PASS/FAIL per assertion in `.planning/phases/49-pi-image-build/49-02-FIRSTBOOT-TEST.md`.

    Also document: what Plan 49-04 (hardware E2E) will cover that this shell-level test cannot — (a) `systemctl disable` self-disable behaviour, (b) boot-order dependency on `boot-firmware.mount` (Pitfall 11), (c) `sudo -u signage systemctl --user restart` with real linger.
  </action>
  <verify>
    <automated>test -f .planning/phases/49-pi-image-build/49-02-FIRSTBOOT-TEST.md && grep -qE "(PASS|DEFERRED)" .planning/phases/49-pi-image-build/49-02-FIRSTBOOT-TEST.md</automated>
  </verify>
  <done>
    Shell simulation either PASSES every assertion (config file contents + placeholder substitution) or is explicitly DEFERRED to Plan 49-04 with reasoning. Real-hardware gaps are documented.
  </done>
</task>

</tasks>

<verification>
- Task 1: `signage-firstboot.service` matches RESEARCH §4 verbatim; `signage.conf.template` has the 4 keys; `unclutter-xfixes` availability confirmed.
- Task 2: `scripts/firstboot.sh` matches RESEARCH §4 verbatim; prerun.sh copies it to `/opt/signage/scripts/firstboot.sh`; 01-run-chroot.sh enables the unit unconditionally; README schema complete.
- Task 3: Shell simulation PASSES or is deferred; rebuild smoke succeeds or defers to runner.
- `systemd-analyze verify signage-firstboot.service` exits 0 (or flagged for CI).
</verification>

<success_criteria>
- SGN-IMG-06 verified: `/boot/firmware/signage.conf` is baked with the 4 documented keys; README documents the operator-facing schema.
- SGN-IMG-07 verified: `signage-firstboot.service` reads preseed, writes `/etc/signage/config`, patches unit files, restarts services, self-disables (ExecStartPost); idempotent (ConditionPathExists + sed-after-substitution is a no-op on second run; tail-sed in firstboot.sh comments out SIGNAGE_API_URL after success).
- SGN-IMG-04 groundwork: on the baked image with a valid preseed, the firstboot service completes before `signage-sidecar.service` starts (`Before=signage-sidecar.service`) — the ≤ 60 s gate is actually measured in Plan 49-04 on real hardware.
</success_criteria>

<output>
After completion, commit with `--no-verify` (Wave 2 parallel with 49-03) and create `.planning/phases/49-pi-image-build/49-02-SUMMARY.md` recording:
- Firstboot service + script match RESEARCH §4 verbatim (yes/no, note any deltas)
- Shell-level simulation result
- Rebuild smoke result (local or deferred)
- unclutter-xfixes availability confirmed
- Hardware gaps carried into Plan 49-04
</output>

<files_to_read>
- .planning/phases/49-pi-image-build/49-CONTEXT.md
- .planning/phases/49-pi-image-build/49-RESEARCH.md
- .planning/phases/49-pi-image-build/49-01-SUMMARY.md
- .planning/REQUIREMENTS.md
- scripts/lib/signage-install.sh
- scripts/lib/signage-packages.txt
- scripts/systemd/signage-sidecar.service
- scripts/systemd/signage-player.service
- pi-image/stage-signage/01-run-chroot.sh
- pi-image/stage-signage/prerun.sh
- pi-image/README.md
</files_to_read>
