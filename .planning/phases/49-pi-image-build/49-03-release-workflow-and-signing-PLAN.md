---
phase: 49-pi-image-build
plan: 03
type: execute
wave: 2
depends_on: [49-01]
files_modified:
  - .github/workflows/pi-image.yml
  - .github/RELEASE_TEMPLATE.md
  - pi-image/minisign.pub
  - pi-image/SIGNING.md
  - pi-image/README.md
autonomous: false
requirements: [SGN-REL-01, SGN-REL-02, SGN-REL-03]
must_haves:
  truths:
    - "`.github/workflows/pi-image.yml` triggers on `v1.17.*` tag push AND on `workflow_dispatch`; runs on `[self-hosted, linux, arm64]`; builds via pi-gen; xz -9 -T 0; sha256; minisigns; publishes to GitHub Releases (draft)"
    - "`pi-image/minisign.pub` is committed to the repo; `SIGNAGE_IMAGE_SIGN_KEY` (a.k.a. MINISIGN_SECRET_KEY) is a GitHub Actions secret — plan documents the generation ceremony but the private key is NEVER committed"
    - "`pi-image/SIGNING.md` documents the one-time key generation ceremony (`minisign -G -p pi-image/minisign.pub -s minisign.sec` with empty passphrase per RESEARCH Pitfall 12) + rotation procedure + passphrase/backup guidance"
    - "`.github/RELEASE_TEMPLATE.md` includes: Bookworm Lite base version (pinned), apt package versions captured from `dpkg -l`, pi-sidecar commit, expected sha256 — matching SGN-REL-03 scaffold"
    - "`pi-image/README.md` includes the 4-step operator verification flow (download → sha256 -c → minisign -Vm → flash) verbatim from RESEARCH §6 Operator verification commands"
    - "Hetzner CAX21 runner registration is documented as three operator commands in `pi-image/README.md` — NOT in files_modified (runner registration is an off-repo operator action)"
    - "A dry-run via `workflow_dispatch` succeeds end-to-end (build + sign + draft release) OR the blocking operator checkpoint records the dry-run outcome"
  artifacts:
    - path: .github/workflows/pi-image.yml
      provides: "Build/sign/publish workflow triggered by v1.17.* tags or workflow_dispatch"
      contains: "self-hosted linux arm64 minisign MINISIGN_SECRET_KEY gh release create"
    - path: .github/RELEASE_TEMPLATE.md
      provides: "Release-notes scaffold — base version, apt package versions, pi-sidecar commit, sha256"
    - path: pi-image/minisign.pub
      provides: "Committed minisign public key for operator verification"
    - path: pi-image/SIGNING.md
      provides: "Key ceremony + rotation + passphrase/backup runbook"
    - path: pi-image/README.md
      provides: "Operator flash + verification procedure + runner registration commands (3 lines for Hetzner CAX21)"
  key_links:
    - from: .github/workflows/pi-image.yml
      to: pi-image/pi-gen
      via: "working-directory: pi-image + cp config pi-gen/config + cd pi-gen + sudo ./build-docker.sh"
      pattern: "build-docker\\.sh"
    - from: .github/workflows/pi-image.yml
      to: pi-image/minisign.pub
      via: "uploaded as release asset alongside .img.xz + .sha256 + .minisig"
      pattern: "minisign\\.pub"
    - from: .github/workflows/pi-image.yml
      to: secrets.MINISIGN_SECRET_KEY
      via: "env: MINISIGN_SECRET_KEY: ${{ secrets.MINISIGN_SECRET_KEY }}"
      pattern: "secrets\\.MINISIGN_SECRET_KEY"
    - from: pi-image/README.md
      to: pi-image/minisign.pub
      via: "operator `minisign -Vm ...img.xz -p minisign.pub` verification flow"
      pattern: "minisign -Vm"
---

<objective>
Ship the release workflow: generate the minisign key pair (public committed, private stored as GitHub Actions secret), author `.github/workflows/pi-image.yml`, write the RELEASE template, document operator verification + runner registration in `pi-image/README.md` and `pi-image/SIGNING.md`, and dry-run the workflow via `workflow_dispatch` once the Hetzner CAX21 runner is online.

Purpose: Satisfy SGN-REL-01 (workflow on tag publishes signed .img.xz + .sha256 + .minisig), SGN-REL-02 (README operator flash + verification + rollback + hardware matrix), and SGN-REL-03 (RELEASE template surfaces base version, apt versions, pi-sidecar commit, sha256).

Output: CI workflow + signing infra + operator docs. Not autonomous because runner registration + key generation ceremony require operator keystrokes, and the workflow_dispatch dry-run needs the runner to be live.
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
@pi-image/config
@pi-image/Makefile
@pi-image/README.md
</context>

<user_setup>
  - service: hetzner-cloud
    why: "Self-hosted arm64 runner (stock GitHub Actions cannot build Pi images — RESEARCH §3)"
    env_vars: []
    dashboard_config:
      - task: "Create CAX21 arm64 instance (4 vCPU Ampere Altra, 8 GB RAM, 80 GB NVMe, ~€5–7/mo)"
        location: "Hetzner Cloud console → Add Server → arm64 → CAX21"
      - task: "Register GitHub Actions runner on the instance"
        location: "GitHub repo → Settings → Actions → Runners → New self-hosted runner → Linux arm64; follow on-screen config with label `arm64`"
      - task: "Install Docker, minisign, gh CLI, xz on the runner"
        location: "SSH into CAX21 and run `apt-get install -y docker.io minisign xz-utils gh`"
  - service: github-actions-secret
    why: "Store minisign private key for CI signing step (never committed)"
    env_vars:
      - name: MINISIGN_SECRET_KEY
        source: "Generated in Plan 49-03 Task 2 ceremony; paste full contents of minisign.sec into GitHub repo → Settings → Secrets and variables → Actions → New repository secret"
    dashboard_config:
      - task: "Add secret MINISIGN_SECRET_KEY with the raw minisign.sec file contents"
        location: "GitHub repo → Settings → Secrets and variables → Actions"
</user_setup>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Author .github/workflows/pi-image.yml (verbatim RESEARCH §6) + .github/RELEASE_TEMPLATE.md (SGN-REL-03 scaffold)</name>
  <files>.github/workflows/pi-image.yml, .github/RELEASE_TEMPLATE.md</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Release Workflow Skeleton" (VERBATIM .github/workflows/pi-image.yml content)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md Pitfall 7 (xz -9 -T 0) and Pitfall 12 (minisign passphrase)
    - .planning/REQUIREMENTS.md §"SGN-REL-03" (base version, apt versions, pi-sidecar commit, expected sha256)
  </read_first>
  <action>
    **Step A — Create `.github/workflows/pi-image.yml` VERBATIM from RESEARCH §"Release Workflow Skeleton":**

    ```yaml
    name: Build and publish Pi signage image

    on:
      push:
        tags:
          - 'v1.17.*'
      workflow_dispatch:
        inputs:
          tag:
            description: 'Release tag (e.g. v1.17.0)'
            required: true

    jobs:
      build-image:
        name: Build, sign, and publish
        runs-on: [self-hosted, linux, arm64]   # Hetzner CAX21 runner label
        timeout-minutes: 90

        permissions:
          contents: write    # needed for gh release upload

        steps:
          - name: Checkout repository
            uses: actions/checkout@v4
            with:
              submodules: recursive

          - name: Determine release tag
            id: tag
            run: |
              TAG="${GITHUB_REF_NAME:-${{ github.event.inputs.tag }}}"
              echo "tag=${TAG}" >> "${GITHUB_OUTPUT}"
              echo "date=$(date -u +%Y-%m-%d)" >> "${GITHUB_OUTPUT}"

          - name: Verify disk space
            run: |
              df -h .
              AVAIL=$(df --output=avail -BG . | tail -1 | tr -d 'G')
              [ "${AVAIL}" -ge 15 ] || { echo "ERROR: Less than 15 GB free"; exit 1; }

          - name: Build pi-gen image
            working-directory: pi-image
            env:
              IMG_DATE: ${{ steps.tag.outputs.date }}
            run: |
              cp config pi-gen/config
              cd pi-gen
              git branch --show-current
              sudo ./build-docker.sh -c ../config
              echo "Build complete."
              ls -lh deploy/

          - name: Rename and checksum image
            id: artifact
            run: |
              TAG=${{ steps.tag.outputs.tag }}
              DATE=${{ steps.tag.outputs.date }}
              IMG_NAME="raspios-bookworm-arm64-signage-${TAG}-${DATE}.img.xz"
              ORIG=$(ls pi-image/pi-gen/deploy/*.img.xz | head -1)
              cp "${ORIG}" "${IMG_NAME}"
              sha256sum "${IMG_NAME}" > "${IMG_NAME}.sha256"
              echo "img=${IMG_NAME}" >> "${GITHUB_OUTPUT}"
              echo "sha256=$(cut -d' ' -f1 ${IMG_NAME}.sha256)" >> "${GITHUB_OUTPUT}"

          - name: Sign with minisign
            env:
              MINISIGN_SECRET_KEY: ${{ secrets.MINISIGN_SECRET_KEY }}
            run: |
              IMG=${{ steps.artifact.outputs.img }}
              echo "${MINISIGN_SECRET_KEY}" > /tmp/minisign.sec
              chmod 600 /tmp/minisign.sec
              minisign -Sm "${IMG}" \
                       -s /tmp/minisign.sec \
                       -t "KPI Dashboard ${{ steps.tag.outputs.tag }} release $(date -u +%Y-%m-%d)"
              rm -f /tmp/minisign.sec
              ls -lh "${IMG}" "${IMG}.minisig"

          - name: Create GitHub Release and upload assets
            env:
              GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
            run: |
              TAG=${{ steps.tag.outputs.tag }}
              IMG=${{ steps.artifact.outputs.img }}
              SHA256=${{ steps.artifact.outputs.sha256 }}
              gh release create "${TAG}" \
                --title "KPI Dashboard ${TAG}" \
                --notes "See RELEASE_TEMPLATE.md for details. SHA256: ${SHA256}" \
                --draft \
                "${IMG}" "${IMG}.sha256" "${IMG}.minisig" \
                pi-image/minisign.pub

          - name: Cleanup
            if: always()
            run: |
              rm -f /tmp/minisign.sec
              sudo rm -rf pi-image/pi-gen/work/ || true
    ```

    **Amendment from RESEARCH Pitfall 7:** In the "Build pi-gen image" step, after `build-docker.sh` exits, re-compress with multi-threaded xz if the image is > 800 MB — OR override `DEPLOY_COMPRESSION` in the config to let pi-gen do it single-threaded on the CAX21's 4 cores. Note in the workflow that pi-gen's default xz is single-threaded; if build duration breaches the 60-minute budget, uncomment an extra step:
    ```yaml
          - name: (fallback) Re-compress with xz -T 0
            if: false  # enable if single-threaded xz pushes build over 60 min
            run: |
              cd pi-image/pi-gen/deploy
              xz -d *.img.xz
              xz -9 -T 0 *.img
    ```

    **Step B — Create `.github/RELEASE_TEMPLATE.md` (SGN-REL-03 scaffold):**

    ```markdown
    # KPI Dashboard vX.Y.Z Pi Signage Image

    ## Downloads

    | Asset | SHA256 |
    |-------|--------|
    | `raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz` | `<sha256>` |
    | `raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz.sha256` | — |
    | `raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz.minisig` | — |
    | `minisign.pub` | (identity file; verify against repo copy) |

    ## Verification

    ```bash
    sha256sum -c raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz.sha256
    minisign -Vm raspios-bookworm-arm64-signage-vX.Y.Z-YYYY-MM-DD.img.xz -p minisign.pub
    ```

    ## Base

    - **OS:** Raspberry Pi OS Bookworm Lite 64-bit
    - **pi-gen commit:** `<abbrev-sha>` on branch `arm64`
    - **Build date:** YYYY-MM-DD (UTC)
    - **pi-sidecar commit:** `<abbrev-sha>`
    - **Runner:** self-hosted arm64 (Hetzner CAX21)

    ## Apt package versions (from `dpkg -l` inside the built image)

    <!-- Populated by CI in a future enhancement; hand-filled for first release -->

    | Package | Version |
    |---------|---------|
    | chromium-browser | <version> |
    | unclutter-xfixes | <version> |
    | labwc | <version> |
    | seatd | <version> |
    | python3-venv | <version> |
    | git | <version> |
    | network-manager | <version> |

    ## Hardware matrix

    - **Recommended:** Raspberry Pi 4 (2+ GB RAM)
    - **Supported:** Raspberry Pi 5
    - **Supported (slower):** Raspberry Pi 3B / 3B+ (Wayland forced via raspi-config)
    - **Not supported:** Pi Zero 2 W (insufficient RAM for Chromium)

    ## Preseed (operator edits on SD after flash, before first boot)

    See `pi-image/README.md` for the `/boot/firmware/signage.conf` schema.

    ## Rollback

    To roll back, re-flash the previous release's `.img.xz`.
    ```

    This is a template — CI leaves placeholders for the tag-specific fields. A follow-up enhancement could auto-populate the dpkg table from a build-time artifact.
  </action>
  <verify>
    <automated>test -f .github/workflows/pi-image.yml && grep -q "on:" .github/workflows/pi-image.yml && grep -q "v1.17.\*" .github/workflows/pi-image.yml && grep -q "self-hosted, linux, arm64" .github/workflows/pi-image.yml && grep -q "MINISIGN_SECRET_KEY" .github/workflows/pi-image.yml && grep -q "minisign -Sm" .github/workflows/pi-image.yml && grep -q "gh release create" .github/workflows/pi-image.yml && grep -q "submodules: recursive" .github/workflows/pi-image.yml && test -f .github/RELEASE_TEMPLATE.md && grep -q "Raspberry Pi OS Bookworm Lite 64-bit" .github/RELEASE_TEMPLATE.md && grep -q "pi-gen commit" .github/RELEASE_TEMPLATE.md && grep -q "pi-sidecar commit" .github/RELEASE_TEMPLATE.md && grep -q "minisign -Vm" .github/RELEASE_TEMPLATE.md</automated>
  </verify>
  <done>
    Workflow matches RESEARCH §6 verbatim (with Pitfall 7 note for optional xz -T 0 fallback). RELEASE template has base version, apt versions, pi-sidecar commit, sha256, hardware matrix, and verification commands.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Minisign key-ceremony — operator runs locally, commits pi-image/minisign.pub, stores minisign.sec as GitHub Actions secret</name>
  <what-built>
    The workflow YAML (Task 1) references `pi-image/minisign.pub` (public key, committed) and `secrets.MINISIGN_SECRET_KEY` (private key, GitHub Actions secret). Neither exists yet. This task is the one-time key-generation ceremony.
  </what-built>
  <how-to-verify>
    **Operator runs on a trusted local machine (NOT CI, NOT this Claude session):**

    1. **Install minisign:** `apt install minisign` (Linux), `brew install minisign` (macOS), or download from https://github.com/jedisct1/minisign/releases (Windows).

    2. **Generate key pair with EMPTY passphrase** (RESEARCH Pitfall 12 — non-empty passphrase hangs CI):
       ```bash
       cd <repo-root>
       minisign -G -p pi-image/minisign.pub -s /tmp/minisign.sec
       # When prompted for passphrase, press Enter TWICE (empty passphrase)
       ```
       The file `pi-image/minisign.pub` is ~88 bytes starting with `untrusted comment:` and a base64 payload prefixed `RWS`.
       The file `/tmp/minisign.sec` contains the private key.

    3. **Commit the public key:**
       ```bash
       git add pi-image/minisign.pub
       git commit --no-verify -m "feat(49-03): add minisign public key for Pi image release signing"
       ```

    4. **Store the private key as a GitHub Actions secret:**
       - Open `/tmp/minisign.sec` in a text editor, copy the ENTIRE file contents (5–10 lines).
       - GitHub repo → Settings → Secrets and variables → Actions → New repository secret.
       - Name: `MINISIGN_SECRET_KEY`
       - Value: paste file contents.
       - Save.

    5. **Back up the private key** to a password manager (1Password, Bitwarden, LastPass, or a hardware-encrypted USB). **If the private key is lost, all future releases use a different key and operators will see minisign verification failures when upgrading.** Document the backup location in `pi-image/SIGNING.md` (Task 3).

    6. **Securely delete `/tmp/minisign.sec`:**
       ```bash
       shred -u /tmp/minisign.sec   # Linux
       # or: rm -P /tmp/minisign.sec (macOS)
       ```

    7. **Verify the key round-trips:**
       ```bash
       echo "hello" > /tmp/test.txt
       # Sign with the secret (recreate it temporarily from the GitHub secret clipboard, or skip)
       # (Alternatively: wait for Task 4's workflow_dispatch to do the end-to-end validation)
       ```

    Reply with the sha256 of the committed `pi-image/minisign.pub` (just for audit) and confirmation that the GitHub secret `MINISIGN_SECRET_KEY` is saved.
  </how-to-verify>
  <resume-signal>
    Reply with "key-committed" along with the sha256 of pi-image/minisign.pub, OR "blocked: <reason>" if the operator cannot run the ceremony right now (in which case Task 3 and Task 4 defer until this is resolved).
  </resume-signal>
  <done>
    `pi-image/minisign.pub` exists in the repo, GitHub Actions secret `MINISIGN_SECRET_KEY` is set, private key is backed up to a password manager, `/tmp/minisign.sec` shredded.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Author pi-image/SIGNING.md + extend pi-image/README.md with operator verification + runner registration</name>
  <files>pi-image/SIGNING.md, pi-image/README.md</files>
  <read_first>
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 4: Image Signing" (key management procedure + operator verify command — VERBATIM)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Release Workflow Skeleton → Operator verification commands" (4-step operator flow — VERBATIM)
    - .planning/phases/49-pi-image-build/49-RESEARCH.md §"Unknown 3: Self-Hosted Runner Spec" (Hetzner CAX21 rationale)
    - pi-image/README.md (current state after Plan 49-01 + 49-02)
  </read_first>
  <action>
    **Step A — Create `pi-image/SIGNING.md`:**

    ```markdown
    # Pi Image Signing — Key Ceremony and Rotation

    KPI Dashboard Pi signage images are signed with [minisign](https://jedisct1.github.io/minisign/)
    (Ed25519). Operators verify downloaded images against the committed public key before flashing.

    ## Key pair

    - **Public key (committed):** `pi-image/minisign.pub` — 88 bytes, starts with `RWS`.
    - **Private key (NEVER committed):** stored as GitHub Actions secret `MINISIGN_SECRET_KEY` +
      a copy in the project password manager (see "Backup" below).

    ## One-time generation ceremony

    Performed by: **<operator name>**
    Performed on: **<date>**
    Platform: **<OS/host>**

    1. Install minisign (`apt install minisign` / `brew install minisign` / download from
       <https://github.com/jedisct1/minisign/releases>).
    2. Generate with an EMPTY passphrase (RESEARCH Pitfall 12 — a non-empty passphrase hangs CI):
       ```bash
       minisign -G -p pi-image/minisign.pub -s /tmp/minisign.sec
       # Enter Enter (empty) twice when prompted
       ```
    3. Commit `pi-image/minisign.pub` to the repo.
    4. Copy the contents of `/tmp/minisign.sec` into the GitHub Actions secret
       `MINISIGN_SECRET_KEY` (Settings → Secrets and variables → Actions).
    5. Back up the private key to the project password manager.
    6. `shred -u /tmp/minisign.sec`.

    ## Backup

    Primary backup: <1Password vault entry, team shared> (item: "KPI Dashboard minisign secret key").
    Secondary backup: <offline encrypted USB / Yubikey / etc.>

    **If the private key is lost, all future releases use a different key and operators who have
    downloaded the old `minisign.pub` will see verification failures when upgrading.** In that case,
    rotate (below) and publish a v1.17.z patch release that bumps `minisign.pub`.

    ## Rotation

    1. Run the generation ceremony again with a fresh key pair.
    2. Update `pi-image/minisign.pub` (commit).
    3. Overwrite the `MINISIGN_SECRET_KEY` GitHub Actions secret.
    4. Cut a new release (`v1.17.<next>`) and ship a `ROTATION.md` alongside the release notes
       telling operators to download the new `minisign.pub` from the repo (or from the release
       assets).

    ## CI usage

    `.github/workflows/pi-image.yml` step "Sign with minisign" writes the secret to
    `/tmp/minisign.sec`, signs the `.img.xz`, and removes the file. Signature file is uploaded to
    the GitHub Release as `.img.xz.minisig`.

    ## Operator verification

    ```bash
    sha256sum -c <image>.img.xz.sha256
    minisign -Vm <image>.img.xz -p minisign.pub
    # Expected output: Signature and comment signature verified
    ```
    ```

    **Step B — Extend `pi-image/README.md`** (append the following sections; do not delete content
    written by Plans 49-01 or 49-02):

    1. **Operator flash procedure (VERBATIM from RESEARCH §6 "Operator verification commands"):**
       ```markdown
       ## Operator: Download, Verify, Flash

       1. From the GitHub Releases page for the tag `v1.17.Z`, download:
          - `raspios-bookworm-arm64-signage-v1.17.Z-YYYY-MM-DD.img.xz`
          - `raspios-bookworm-arm64-signage-v1.17.Z-YYYY-MM-DD.img.xz.sha256`
          - `raspios-bookworm-arm64-signage-v1.17.Z-YYYY-MM-DD.img.xz.minisig`
          - `minisign.pub`

       2. Verify SHA256 checksum:
          ```
          sha256sum -c raspios-bookworm-arm64-signage-v1.17.Z-YYYY-MM-DD.img.xz.sha256
          ```

       3. Verify minisign signature:
          ```
          minisign -Vm raspios-bookworm-arm64-signage-v1.17.Z-YYYY-MM-DD.img.xz -p minisign.pub
          ```
          Expected output: `Signature and comment signature verified`.

       4. Flash with Raspberry Pi Imager:
          - Choose Custom Image → select the `.img.xz`
          - OS Customisation → set hostname, SSH, Wi-Fi
          - Write → eject → mount SD on workstation → edit `/boot/firmware/signage.conf` (see Plan 49-02 schema)
          - Eject SD → insert in Pi → power on

       ## Hardware matrix

       - **Recommended:** Raspberry Pi 4 (2+ GB RAM)
       - **Supported:** Raspberry Pi 5
       - **Supported (slower):** Raspberry Pi 3B / 3B+ (Wayland forced via raspi-config by `force_wayland_if_pi3`)
       - **Not supported:** Pi Zero 2 W (insufficient RAM for Chromium)

       ## Rollback

       Re-flash the previous release's `.img.xz`. The preseed file survives in the FAT partition,
       so the operator does not need to re-edit `signage.conf` unless the SIGNAGE_API_URL changed.

       ## minisign install

       - Linux: `apt install minisign`
       - macOS: `brew install minisign`
       - Windows: download `minisign-windows-x86_64.zip` from <https://github.com/jedisct1/minisign/releases>
       ```

    2. **Self-hosted runner registration (three operator commands, off-repo):**
       ```markdown
       ## Operator: Self-hosted CI runner setup (one-time, per release environment)

       The pi-image workflow runs on a self-hosted arm64 runner. Recommended spec: Hetzner CAX21
       (4 vCPU Ampere Altra, 8 GB RAM, 80 GB NVMe, ~€5–7/month — see RESEARCH §3 for comparison).

       On the Hetzner CAX21 instance (after SSH'ing in as root):

       ```
       # 1. Install runner dependencies
       apt update && apt install -y docker.io minisign xz-utils curl jq

       # 2. Install and register the GitHub Actions runner
       #    (follow on-screen config from GitHub repo → Settings → Actions → Runners → New self-hosted runner)
       #    Label: arm64
       ./config.sh --url https://github.com/<org>/<repo> --token <provided-token> --labels arm64

       # 3. Install the runner as a persistent systemd service
       sudo ./svc.sh install && sudo ./svc.sh start
       ```

       Confirm the runner appears "Idle" in the GitHub Actions Runners list before the first
       `workflow_dispatch`.
       ```
  </action>
  <verify>
    <automated>test -f pi-image/SIGNING.md && grep -q "minisign -G" pi-image/SIGNING.md && grep -q "MINISIGN_SECRET_KEY" pi-image/SIGNING.md && grep -q "Rotation" pi-image/SIGNING.md && grep -q "Operator: Download, Verify, Flash" pi-image/README.md && grep -q "minisign -Vm" pi-image/README.md && grep -q "Self-hosted CI runner setup" pi-image/README.md && grep -q "CAX21" pi-image/README.md && grep -q "Hardware matrix" pi-image/README.md</automated>
  </verify>
  <done>
    SIGNING.md documents ceremony + rotation + backup. README has operator flash + verify + hardware matrix + rollback + runner-registration commands.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4: Dry-run the workflow via workflow_dispatch — validates YAML + runner + signing end-to-end</name>
  <what-built>
    `.github/workflows/pi-image.yml` (Task 1), minisign public+private keys (Task 2), operator docs
    (Task 3). This task runs the full pipeline against a throwaway tag to confirm it works before
    the first real `v1.17.0` tag push.
  </what-built>
  <how-to-verify>
    **Prerequisite:** the Hetzner CAX21 runner is registered, online, and showing "Idle" in GitHub
    Actions Runners list. The `MINISIGN_SECRET_KEY` secret is set.

    1. **Trigger the workflow_dispatch:**
       - GitHub repo → Actions → "Build and publish Pi signage image" → Run workflow.
       - Input `tag`: `v1.17.0-rc1` (dry-run tag — will create a draft release).
       - Click "Run workflow".

    2. **Observe the run:**
       - "Checkout repository" — should pass (submodules: recursive pulls pi-gen).
       - "Verify disk space" — CAX21 80 GB has plenty.
       - "Build pi-gen image" — expect 25–40 min on CAX21 (RESEARCH §3).
       - "Rename and checksum image" — produces `raspios-bookworm-arm64-signage-v1.17.0-rc1-YYYY-MM-DD.img.xz` + `.sha256`.
       - "Sign with minisign" — produces `.minisig`.
       - "Create GitHub Release and upload assets" — draft release created; assets uploaded.

    3. **Verify the draft release locally:**
       ```bash
       gh release download v1.17.0-rc1 --dir /tmp/rc1-test
       cd /tmp/rc1-test
       sha256sum -c *.sha256
       minisign -Vm *.img.xz -p minisign.pub
       # Expected: Signature and comment signature verified
       ```

    4. **Teardown:**
       - After validation, either delete the draft release + tag (`gh release delete v1.17.0-rc1 --yes && git push --delete origin v1.17.0-rc1`) OR promote it to a full release if this is actually the first release.

    **Failure triage:**
    - Runner offline → re-check Task 3 runner registration commands.
    - Minisign hangs → RESEARCH Pitfall 12: generated key has a non-empty passphrase; regenerate with empty passphrase.
    - `CLEAN=1` build produces a > 2.5 GB image → Pitfall 13: `STAGE_LIST` not respected; force-rebuild docker container.
    - Build timeout > 90 min → Pitfall 7: switch `DEPLOY_COMPRESSION=gz` temporarily or add the `xz -T 0` post-step.

    Record the run URL + outcome in a comment on this plan's SUMMARY.
  </how-to-verify>
  <resume-signal>
    Reply with "dry-run-passed" + the GitHub Actions run URL + the draft release URL, OR "blocked: <reason>" with the failure step.
  </resume-signal>
  <done>
    Draft release `v1.17.0-rc1` exists with all 4 assets; local sha256 check passes; local minisign verify passes. (Draft can then be deleted or promoted.)
  </done>
</task>

</tasks>

<verification>
- Task 1: workflow YAML and RELEASE template match RESEARCH §6 + SGN-REL-03 scaffold.
- Task 2: minisign.pub committed; MINISIGN_SECRET_KEY set as GitHub secret; private key backed up; session tmp file shredded.
- Task 3: SIGNING.md + README.md cover ceremony, rotation, operator flash, verify, hardware matrix, rollback, runner registration.
- Task 4: workflow_dispatch dry-run produces a draft release with all 4 assets; local verification passes.
</verification>

<success_criteria>
- SGN-REL-01 verified: workflow triggers on `v1.17.*` tag or workflow_dispatch; produces signed `.img.xz` + `.sha256` + `.minisig` + `minisign.pub` uploaded to GitHub Releases; dry-run under 60 min confirms build-duration budget.
- SGN-REL-02 verified: `pi-image/README.md` covers download/verify/flash procedure + sha256 + signature verification + rollback + hardware matrix.
- SGN-REL-03 verified: `.github/RELEASE_TEMPLATE.md` has the 4 required fields (base version, apt versions, pi-sidecar commit, expected sha256).
</success_criteria>

<output>
After completion (all 4 tasks resolved or explicitly deferred), commit with `--no-verify` (Wave 2 parallel with 49-02) and create `.planning/phases/49-pi-image-build/49-03-SUMMARY.md` recording:
- Workflow YAML + RELEASE template status
- Key ceremony outcome (Task 2 — sha256 of minisign.pub, backup location reference)
- Dry-run URL + draft release URL + outcome (Task 4)
- Any deferrals / follow-ups
</output>

<files_to_read>
- .planning/phases/49-pi-image-build/49-CONTEXT.md
- .planning/phases/49-pi-image-build/49-RESEARCH.md
- .planning/phases/49-pi-image-build/49-01-SUMMARY.md
- .planning/REQUIREMENTS.md
- pi-image/config
- pi-image/Makefile
- pi-image/README.md
</files_to_read>
