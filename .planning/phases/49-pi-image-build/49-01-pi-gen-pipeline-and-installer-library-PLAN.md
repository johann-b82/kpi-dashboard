---
phase: 49-pi-image-build
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - pi-image/config
  - pi-image/README.md
  - pi-image/.gitignore
  - pi-image/Makefile
  - pi-image/stage2/SKIP_IMAGES
  - pi-image/stage-signage/EXPORT_IMAGE
  - pi-image/stage-signage/00-packages-nr
  - pi-image/stage-signage/prerun.sh
  - pi-image/stage-signage/01-run-chroot.sh
  - pi-image/stage-signage/signage.conf.template
  - scripts/lib/signage-install.sh
  - scripts/lib/signage-packages.txt
  - scripts/provision-pi.sh
  - .gitmodules
autonomous: true
requirements: [SGN-IMG-01, SGN-IMG-02, SGN-IMG-03, SGN-IMG-05]
must_haves:
  truths:
    - "`scripts/lib/signage-install.sh` exists with the 7 functions from RESEARCH §5 (install_signage_packages, create_signage_user, create_signage_directories, deploy_systemd_units, setup_sidecar_venv, enable_linger_signage, force_wayland_if_pi3)"
    - "`scripts/provision-pi.sh` is refactored to source the library and call the functions; runtime behaviour (SGN-IMG-03 byte-identical filesystem-state guarantee) is preserved"
    - "`pi-image/` directory tree exists with pi-gen config, stage2/SKIP_IMAGES, stage-signage/{EXPORT_IMAGE, 00-packages-nr, prerun.sh, 01-run-chroot.sh, signage.conf.template}"
    - "Both the installer library and `pi-image/stage-signage/00-packages-nr` derive the package list from a single source-of-truth (`scripts/lib/signage-packages.txt`)"
    - "pi-gen is added as a git submodule at `pi-image/pi-gen` pinned to a commit on the `arm64` branch (decision logged in `pi-image/README.md`)"
    - "A local Docker build (`./build-docker.sh -c ../config` from `pi-image/pi-gen/`) completes and drops an `.img.xz` in `pi-image/pi-gen/deploy/`"
  artifacts:
    - path: scripts/lib/signage-install.sh
      provides: "Shared 7-function installer library sourceable from both runtime and chroot"
      contains: "install_signage_packages create_signage_user create_signage_directories deploy_systemd_units setup_sidecar_venv enable_linger_signage force_wayland_if_pi3"
    - path: scripts/lib/signage-packages.txt
      provides: "Single source-of-truth apt package list (consumed by installer library and 00-packages-nr)"
    - path: scripts/provision-pi.sh
      provides: "Runtime provisioner (thin wrapper around library)"
    - path: pi-image/config
      provides: "pi-gen config with STAGE_LIST=stage0..stage2 + stage-signage, arm64, Bookworm, xz -9"
    - path: pi-image/stage-signage/prerun.sh
      provides: "Host-side staging — copies library, pi-sidecar source, unit templates, firstboot unit and signage.conf template into the chroot rootfs"
    - path: pi-image/stage-signage/01-run-chroot.sh
      provides: "Chroot-time installer (sources /tmp/lib/signage-install.sh with SIGNAGE_BUILD_CONTEXT=chroot)"
    - path: pi-image/stage-signage/00-packages-nr
      provides: "Plain-text apt package list for pi-gen, generated from scripts/lib/signage-packages.txt"
    - path: pi-image/stage-signage/signage.conf.template
      provides: "Preseed placeholder baked into /boot/firmware/signage.conf at build time"
    - path: pi-image/README.md
      provides: "Build instructions (Docker build, pi-gen submodule init, Makefile targets); vendoring decision rationale"
    - path: pi-image/Makefile
      provides: "`make build` wrapper around pi-gen/build-docker.sh"
    - path: pi-image/.gitignore
      provides: "Excludes pi-gen/work/ and pi-gen/deploy/"
  key_links:
    - from: scripts/provision-pi.sh
      to: scripts/lib/signage-install.sh
      via: "source at top of script"
      pattern: "source.*signage-install\\.sh"
    - from: pi-image/stage-signage/01-run-chroot.sh
      to: scripts/lib/signage-install.sh
      via: "copied to /tmp/lib/ by prerun.sh, sourced under SIGNAGE_BUILD_CONTEXT=chroot"
      pattern: "source /tmp/lib/signage-install\\.sh"
    - from: pi-image/stage-signage/00-packages-nr
      to: scripts/lib/signage-packages.txt
      via: "generated/symlinked during prerun.sh OR committed identical content with CI drift-check"
      pattern: "chromium-browser"
    - from: pi-image/config
      to: pi-image/stage-signage/
      via: "STAGE_LIST=\"stage0 stage1 stage2 stage-signage\""
      pattern: "STAGE_LIST"
---

<objective>
Create the `pi-image/` pi-gen pipeline skeleton and refactor `scripts/provision-pi.sh` to share an installer library with the pi-gen chroot stage. Produce a locally-buildable `.img.xz` at the end of the plan.

Purpose: Satisfy SGN-IMG-01 (pi-gen config at `pi-image/`), SGN-IMG-02 (stage-signage installs packages / user / units / venv / linger), SGN-IMG-03 (shared installer library with byte-identical filesystem-state guarantee between runtime and build-time paths), and SGN-IMG-05 (reproducible build groundwork — deterministic stage, pinned pi-gen SHA).

Output: `pi-image/` directory tree, `scripts/lib/signage-install.sh` library + `scripts/lib/signage-packages.txt` single-source-of-truth, refactored `scripts/provision-pi.sh`, and a local Docker-driven pi-gen smoke build producing an `.img.xz`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-pi-image-build/49-CONTEXT.md
@.planning/phases/49-pi-image-build/49-RESEARCH.md
@.planning/REQUIREMENTS.md
@scripts/provision-pi.sh
@scripts/systemd/signage-sidecar.service
@scripts/systemd/signage-player.service
@scripts/systemd/labwc.service
@pi-sidecar/requirements.txt
</context>

<decisions_recorded_in_this_plan>
- **Single source-of-truth for the apt package list:** `scripts/lib/signage-packages.txt` (one package per line). The installer library reads it into `SIGNAGE_PACKAGES` (array). `pi-image/stage-signage/00-packages-nr` is a plain-text copy of the same file (space-separated on one or more lines as pi-gen expects). Rationale: pi-gen's `00-packages-nr` MUST be a static text file on disk (pi-gen's `install_packages()` greps it verbatim), so symlinking into `scripts/lib/` is unreliable across build-host/chroot; a committed copy + a CI drift-check (added in plan 49-01 task 2) is the simplest correct design.
- **pi-gen vendoring:** git submodule at `pi-image/pi-gen`, pinned to a specific SHA on the `arm64` branch (not master — RESEARCH Pitfall 1). Rationale: submodule is cleaner (tracks upstream, pinnable, one-line update), keeps repo size reasonable, and matches the `submodules: recursive` line already in the RESEARCH §6 workflow skeleton. `.gitmodules` line added.
</decisions_recorded_in_this_plan>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refactor provision-pi.sh into scripts/lib/signage-install.sh + scripts/lib/signage-packages.txt</name>
  <files>scripts/lib/signage-install.sh, scripts/lib/signage-packages.txt, scripts/provision-pi.sh</files>
  <read_first>
    - scripts/provision-pi.sh (full file — extract pre-flight checks, step 1–9 into library functions)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Installer-Library Skeleton" (VERBATIM function signatures and body)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 6: Installer-Library Refactor Shape"
  </read_first>
  <action>
    **Step A — Create `scripts/lib/signage-packages.txt`** (single source-of-truth):
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

    **Step B — Create `scripts/lib/signage-install.sh`** from RESEARCH §"Installer-Library Skeleton" VERBATIM, with ONE amendment: replace the hardcoded `SIGNAGE_PACKAGES=(...)` array literal with a read-from-file:
    ```bash
    _LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    mapfile -t SIGNAGE_PACKAGES < <(grep -v '^\s*#' "${_LIB_DIR}/signage-packages.txt" | grep -v '^\s*$')
    ```
    Keep all 7 functions verbatim: `install_signage_packages`, `create_signage_user`, `create_signage_directories`, `deploy_systemd_units`, `setup_sidecar_venv`, `enable_linger_signage`, `force_wayland_if_pi3`. `deploy_systemd_units` branches `unit_src_dir` on `SIGNAGE_BUILD_CONTEXT=chroot` per RESEARCH (chroot uses `/opt/signage/scripts/systemd`, runtime uses `${SCRIPT_DIR}/../scripts/systemd`).

    **Step C — Refactor `scripts/provision-pi.sh`** into the skeleton from RESEARCH §"provision-pi.sh skeleton after refactor":
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    source "${SCRIPT_DIR}/lib/signage-install.sh"

    preflight_checks     # root, arch, apt, SIGNAGE_API_URL, systemd version, raspi.list
    install_signage_packages
    create_signage_user
    create_signage_directories
    setup_repo_at_opt_signage   # stays here — build-time path uses pi-gen prerun.sh instead
    setup_sidecar_venv
    SIGNAGE_UID=$(id -u signage)
    deploy_systemd_units "${SIGNAGE_API_URL}" "${SIGNAGE_UID}"
    enable_linger_signage   # auto-detects runtime context → loginctl
    enable_and_start_services "${SIGNAGE_UID}"
    force_wayland_if_pi3
    print_completion_banner "${SIGNAGE_API_URL}"
    ```
    Functions `preflight_checks`, `setup_repo_at_opt_signage`, `enable_and_start_services`, `print_completion_banner` stay in `provision-pi.sh` (not shared — runtime-only). Preserve the raspi.list check (Pitfall 2 in provision-pi.sh Step 0.5) and Step 8's user@UID bus-bringup loop verbatim.

    **Byte-identical guarantee (SGN-IMG-03):** The filesystem-state contract per RESEARCH §"Behavior parity check" is:
    - `/home/signage/.config/systemd/user/{labwc,signage-sidecar,signage-player}.service` identical (modulo `__SIGNAGE_API_URL__` placeholder in chroot vs. real URL in runtime — the documented intentional difference)
    - `/opt/signage/pi-sidecar/.venv/` identical packages (pinned by requirements.txt)
    - `/var/lib/signage/` + `/var/lib/signage/media/` mode 0700 owned by signage
    - `/var/lib/systemd/linger/signage` present
    - `signage` user in groups `video,audio,render,input`

    Add a banner comment at the top of `signage-install.sh` documenting the shared-library contract and the `SIGNAGE_BUILD_CONTEXT=chroot` flag.
  </action>
  <verify>
    <automated>bash -n scripts/lib/signage-install.sh && bash -n scripts/provision-pi.sh && test -f scripts/lib/signage-packages.txt && grep -q "chromium-browser" scripts/lib/signage-packages.txt && grep -q "source.*signage-install\.sh" scripts/provision-pi.sh && grep -qE "^install_signage_packages\(\)" scripts/lib/signage-install.sh && grep -qE "^create_signage_user\(\)" scripts/lib/signage-install.sh && grep -qE "^create_signage_directories\(\)" scripts/lib/signage-install.sh && grep -qE "^deploy_systemd_units\(\)" scripts/lib/signage-install.sh && grep -qE "^setup_sidecar_venv\(\)" scripts/lib/signage-install.sh && grep -qE "^enable_linger_signage\(\)" scripts/lib/signage-install.sh && grep -qE "^force_wayland_if_pi3\(\)" scripts/lib/signage-install.sh</automated>
  </verify>
  <done>
    Library has all 7 functions. Packages list is the single source. provision-pi.sh sources the library and is a thin orchestrator. `bash -n` parses both files with zero errors.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create pi-image/ pi-gen scaffold (config, stage2/SKIP_IMAGES, stage-signage/*)</name>
  <files>pi-image/config, pi-image/README.md, pi-image/.gitignore, pi-image/Makefile, pi-image/stage2/SKIP_IMAGES, pi-image/stage-signage/EXPORT_IMAGE, pi-image/stage-signage/00-packages-nr, pi-image/stage-signage/prerun.sh, pi-image/stage-signage/01-run-chroot.sh, pi-image/stage-signage/signage.conf.template, .gitmodules</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"pi-gen Config Skeleton" (VERBATIM contents for every file)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Common Pitfalls" (pitfalls 1, 6, 8, 13 are load-bearing)
    - scripts/lib/signage-packages.txt (written in Task 1 — copy its content into 00-packages-nr)
  </read_first>
  <action>
    Create every file in `pi-image/` VERBATIM from RESEARCH §"pi-gen Config Skeleton":

    - `pi-image/config` — VERBATIM from RESEARCH §"pi-gen Config Skeleton → `pi-image/config`" (IMG_NAME, RELEASE=bookworm, DEPLOY_COMPRESSION=xz, COMPRESSION_LEVEL=9, STAGE_LIST="stage0 stage1 stage2 stage-signage", ENABLE_SSH=0, FIRST_USER_PASS="", DISABLE_FIRST_BOOT_USER_RENAME=1, ENABLE_CLOUD_INIT=1).
    - `pi-image/stage2/SKIP_IMAGES` — empty file (touch).
    - `pi-image/stage-signage/EXPORT_IMAGE` — empty file (touch).
    - `pi-image/stage-signage/00-packages-nr` — copy lines from `scripts/lib/signage-packages.txt` (strip comments/blank lines), space-separated or one-per-line. Add a comment at the top: `# Generated from scripts/lib/signage-packages.txt — drift-check in CI`.
    - `pi-image/stage-signage/prerun.sh` — VERBATIM from RESEARCH §"pi-gen Config Skeleton → `pi-image/stage-signage/prerun.sh`" (copies `scripts/lib/signage-install.sh` into `${ROOTFS}/tmp/lib/`, pi-sidecar source into `${ROOTFS}/opt/signage/pi-sidecar/`, systemd unit templates into `${ROOTFS}/opt/signage/scripts/systemd/`, firstboot service unit into `${ROOTFS}/etc/systemd/system/signage-firstboot.service`, signage.conf.template into `${ROOTFS}/boot/firmware/signage.conf`). Make it executable (chmod +x).

      NOTE: `signage-firstboot.service` and `scripts/firstboot.sh` are CREATED by Plan 49-02 — in this plan, prerun.sh references them but they don't exist yet. Add a guard at the top of prerun.sh: `if [ ! -f "${REPO_ROOT}/pi-image/stage-signage/signage-firstboot.service" ]; then echo "WARN: signage-firstboot.service missing (Plan 49-02 not yet merged); continuing without firstboot bake-in"; fi` — this makes Plan 49-01's smoke build succeed even before Plan 49-02 lands, and Plan 49-02 drops the guard once the service exists.
    - `pi-image/stage-signage/01-run-chroot.sh` — VERBATIM from RESEARCH §"pi-gen Config Skeleton → `pi-image/stage-signage/01-run-chroot.sh`" (sets `SIGNAGE_BUILD_CONTEXT=chroot`, sources `/tmp/lib/signage-install.sh`, guards on chromium-browser + labwc presence, calls the library functions in order, deploys units with `__SIGNAGE_API_URL__` placeholder, creates `/etc/signage/`, enables `signage-firstboot.service` via symlink into `/etc/systemd/system/multi-user.target.wants/`, chowns signage dirs). Make it executable. Same Plan 49-02 guard: if the firstboot.service symlink target is missing, skip the `ln -sf` and emit a WARN.
    - `pi-image/stage-signage/signage.conf.template` — the placeholder from RESEARCH §"Unknown 1 → Exact fields documented for operators":
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
    - `pi-image/.gitignore`:
      ```
      pi-gen/work/
      pi-gen/deploy/
      *.img
      *.img.xz
      *.img.xz.sha256
      *.img.xz.minisig
      ```
    - `pi-image/Makefile`:
      ```makefile
      .PHONY: build clean submodule
      submodule:
      	git submodule update --init --recursive pi-gen
      build: submodule
      	cp config pi-gen/config
      	cd pi-gen && sudo CLEAN=1 ./build-docker.sh -c ../config
      	@echo "Image: pi-gen/deploy/"
      	@ls -lh pi-gen/deploy/*.img.xz || true
      clean:
      	sudo rm -rf pi-gen/work pi-gen/deploy
      ```
    - `pi-image/README.md` — build instructions:
      - How to init submodule (`git submodule update --init pi-image/pi-gen`)
      - How to build locally (`cd pi-image && make build`)
      - Vendoring decision: submodule on `arm64` branch at pinned SHA (cite Pitfall 1)
      - Preseed schema (defer to Plan 49-02 for operator-facing flash docs; reference `signage.conf.template`)
      - Known pitfalls #1 (arm64 branch), #2 (disk space), #13 (STAGE_LIST + CLEAN=1)
    - `.gitmodules` — add (or create) entry:
      ```
      [submodule "pi-image/pi-gen"]
      	path = pi-image/pi-gen
      	url = https://github.com/RPi-Distro/pi-gen.git
      	branch = arm64
      ```
      Run `git submodule add -b arm64 https://github.com/RPi-Distro/pi-gen.git pi-image/pi-gen` if the submodule is not yet registered. If network access in this task is blocked, note the command in the SUMMARY and have the operator run it before Task 3.

    **Add a CI drift-check script** at `scripts/check-package-list-parity.sh`:
    ```bash
    #!/usr/bin/env bash
    # Verifies scripts/lib/signage-packages.txt and pi-image/stage-signage/00-packages-nr stay in sync.
    set -euo pipefail
    LIB_LIST=$(grep -v '^\s*#' scripts/lib/signage-packages.txt | grep -v '^\s*$' | sort -u)
    STAGE_LIST=$(grep -v '^\s*#' pi-image/stage-signage/00-packages-nr | tr ' ' '\n' | grep -v '^\s*$' | sort -u)
    if [ "$LIB_LIST" != "$STAGE_LIST" ]; then
      echo "DRIFT: signage-packages.txt and 00-packages-nr differ"
      diff <(echo "$LIB_LIST") <(echo "$STAGE_LIST")
      exit 1
    fi
    echo "OK: package lists in sync."
    ```
    Make executable.
  </action>
  <verify>
    <automated>test -f pi-image/config && grep -q 'STAGE_LIST="stage0 stage1 stage2 stage-signage"' pi-image/config && test -f pi-image/stage2/SKIP_IMAGES && test -f pi-image/stage-signage/EXPORT_IMAGE && test -f pi-image/stage-signage/00-packages-nr && grep -q chromium-browser pi-image/stage-signage/00-packages-nr && test -x pi-image/stage-signage/prerun.sh && test -x pi-image/stage-signage/01-run-chroot.sh && test -f pi-image/stage-signage/signage.conf.template && grep -q SIGNAGE_API_URL pi-image/stage-signage/signage.conf.template && test -f pi-image/README.md && test -f pi-image/Makefile && test -f pi-image/.gitignore && bash -n pi-image/stage-signage/prerun.sh && bash -n pi-image/stage-signage/01-run-chroot.sh && bash scripts/check-package-list-parity.sh</automated>
  </verify>
  <done>
    Every pi-gen file matches RESEARCH §"pi-gen Config Skeleton" verbatim (with prerun/01-chroot having the Plan 49-02 guard noted above). Drift-check passes. `.gitmodules` registers pi-gen on the arm64 branch. Scripts parse.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Local Docker smoke build — produce an .img.xz in pi-gen/deploy/</name>
  <files>pi-image/pi-gen/deploy/ (read-only — .gitignored), .planning/phases/49-pi-image-build/49-01-BUILD-LOG.md</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 2: pi-gen Non-Interactive CI"
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Common Pitfalls" #2 and #13
    - pi-image/Makefile (written in Task 2)
  </read_first>
  <action>
    On a machine with Docker + 20 GB free disk:
    1. `git submodule update --init --recursive pi-image/pi-gen` (if not already registered).
    2. `cd pi-image && make build`.
       - This runs `cp config pi-gen/config && cd pi-gen && sudo CLEAN=1 ./build-docker.sh -c ../config`.
       - Expected build time: 25–40 min on a machine with 4 arm64 cores + NVMe (RESEARCH §"Unknown 3" Hetzner CAX21 estimate). Longer under x86_64 QEMU emulation.
    3. Verify an `.img.xz` appears under `pi-image/pi-gen/deploy/`. Check size is ≤ 1 GB (SGN-REL-01 success criterion 4 — compressed ≤ 1 GB).
    4. Record the build log summary in `.planning/phases/49-pi-image-build/49-01-BUILD-LOG.md`:
       - Runner host (arch, RAM, disk)
       - Build duration wall-clock
       - Final image path + size + sha256
       - Any warnings/errors

    **If this task cannot run locally (no Docker / no arm64 / no 20 GB disk):** Record that in 49-01-BUILD-LOG.md and defer the smoke to Plan 49-03 Task 3 (which runs the workflow on the Hetzner CAX21 runner). Plan 49-01 is still considered complete when Tasks 1 and 2 are done and drift-check is green — the smoke build can be deferred to the runner.

    **Failure triage:**
    - "No space left" → Pitfall 2: free 20 GB or move work dir.
    - Resulting image is > 2.5 GB → Pitfall 13: `CLEAN=1` may not have rebuilt the docker container; run `docker rm -f pigen_work` and retry.
    - `uname -m` in image is `armv7l` → Pitfall 1: submodule on wrong branch; `cd pi-image/pi-gen && git checkout arm64` and retry.
  </action>
  <verify>
    <automated>test -f .planning/phases/49-pi-image-build/49-01-BUILD-LOG.md && (ls pi-image/pi-gen/deploy/*.img.xz 2>/dev/null || grep -qi "deferred" .planning/phases/49-pi-image-build/49-01-BUILD-LOG.md)</automated>
  </verify>
  <done>
    Either an `.img.xz` exists in `pi-image/pi-gen/deploy/` OR the build log explicitly documents the deferral to the runner. Build log captures host, duration, size, sha256, and any warnings.
  </done>
</task>

</tasks>

<verification>
- Task 1: library + packages.txt + refactored provision-pi.sh all parse; 7 library functions present; package list is single-source-of-truth.
- Task 2: `pi-image/` tree matches RESEARCH §"pi-gen Config Skeleton" verbatim; drift-check green; submodule registered for arm64 branch.
- Task 3: local smoke produces `.img.xz` OR is explicitly deferred to Plan 49-03's runner with reasoning in 49-01-BUILD-LOG.md.
- `bash -n` on every shell file in scripts/lib/ and pi-image/stage-signage/.
</verification>

<success_criteria>
- SGN-IMG-01 verified: `pi-image/` builds a valid `.img` from stock pi-gen base (Task 3 smoke) OR ready to build once runner exists (Task 3 deferral is accepted).
- SGN-IMG-02 verified: stage-signage prerun + chroot scripts install packages, create user, deploy units, provision venv, enable linger (via file touch per Pitfall 3 workaround).
- SGN-IMG-03 verified: `scripts/lib/signage-install.sh` exists; provision-pi.sh sources it; both code paths converge on identical filesystem state (parity contract documented in library header).
- SGN-IMG-05 groundwork: pi-gen pinned to a submodule SHA; `IMG_DATE` and deterministic stage enable reproducible builds (actual bit-for-bit reproducibility test is deferred to Plan 49-03's CI run-twice check).
</success_criteria>

<output>
After completion, commit with `--no-verify` (parallel-wave plan per planner constraints) and create `.planning/phases/49-pi-image-build/49-01-SUMMARY.md` recording:
- Library function count + parity-check status
- pi-gen submodule SHA pinned
- Smoke build outcome (local success / deferred)
- Any amendments to RESEARCH §5/§"pi-gen Config Skeleton"
</output>

<files_to_read>
- .planning/phases/49-pi-image-build/49-CONTEXT.md
- .planning/phases/49-pi-image-build/49-RESEARCH.md
- .planning/REQUIREMENTS.md
- scripts/provision-pi.sh
- scripts/systemd/signage-sidecar.service
- scripts/systemd/signage-player.service
- scripts/systemd/labwc.service
- pi-sidecar/requirements.txt
</files_to_read>
