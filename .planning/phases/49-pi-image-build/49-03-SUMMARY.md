---
phase: 49-pi-image-build
plan: "03"
subsystem: ci-workflow, signing
tags: [github-actions, minisign, pi-image, signing, release, arm64, hetzner]
dependency_graph:
  requires: [49-01]
  provides: [.github/workflows/pi-image.yml, .github/RELEASE_TEMPLATE.md, pi-image/SIGNING.md]
  affects: [pi-image/README.md, pi-image/minisign.pub (pending)]
tech_stack:
  added: [minisign (Ed25519 signing), GitHub Actions self-hosted runner, gh CLI release workflow]
  patterns: [private-key-never-in-git, secret-in-github-actions, shred-after-use]
key_files:
  created:
    - .github/workflows/pi-image.yml
    - .github/RELEASE_TEMPLATE.md
    - pi-image/SIGNING.md
  modified:
    - pi-image/README.md
  pending:
    - pi-image/minisign.pub  # operator must commit after key ceremony (Task 2)
decisions:
  - "Workflow verbatim from RESEARCH §6: trigger on v1.17.* tags + workflow_dispatch; runs on [self-hosted, linux, arm64]; signs with MINISIGN_SECRET_KEY secret; private key shredded from /tmp after each job"
  - "minisign empty passphrase (RESEARCH Pitfall 12): non-empty passphrase hangs CI; operator generates key with Enter/Enter"
  - "xz compression: pi-gen default (single-threaded) is acceptable on CAX21 4-core; optional xz -9 -T 0 fallback step is commented out in the workflow for activation if needed"
  - "pi-image/minisign.pub committed to repo; MINISIGN_SECRET_KEY stored as GitHub Actions secret only; private key never in git"
metrics:
  duration: "~8 min"
  completed: 2026-04-20
  tasks: 2  # of 4 autonomous tasks; 2 checkpoint:human-action tasks pending
  files: 4
---

# Phase 49 Plan 03: Release Workflow and Signing Summary

**One-liner:** GitHub Actions workflow (pi-image.yml) builds and minisign-signs Pi images on v1.17.* tag push or workflow_dispatch on a Hetzner CAX21 self-hosted arm64 runner; SIGNING.md and README document the key ceremony, operator verification flow, and runner registration; two human-action checkpoints (key ceremony + workflow dry-run) are pending operator completion.

## What Was Built

### Task 1: .github/workflows/pi-image.yml + .github/RELEASE_TEMPLATE.md (committed 28af7a3)

- **`.github/workflows/pi-image.yml`** — verbatim from RESEARCH §6 "Release Workflow Skeleton":
  - Triggers on `v1.17.*` tag push + `workflow_dispatch` (with `tag` input)
  - `runs-on: [self-hosted, linux, arm64]` — Hetzner CAX21 label
  - `timeout-minutes: 90`
  - Steps: checkout (submodules recursive) → disk space check (≥ 15 GB) → pi-gen build (via `build-docker.sh -c ../config`) → rename + sha256sum → minisign sign (writes `MINISIGN_SECRET_KEY` to `/tmp/minisign.sec`, signs, `rm -f` immediately) → `gh release create --draft` with 4 assets → cleanup (`shred` guard + `rm -rf pi-gen/work/`)
  - Commented-out optional fallback `xz -9 -T 0` re-compression step (Pitfall 7 mitigation)
  - `MINISIGN_SECRET_KEY: ${{ secrets.MINISIGN_SECRET_KEY }}` — secret never literal in YAML

- **`.github/RELEASE_TEMPLATE.md`** — SGN-REL-03 scaffold:
  - Downloads table: `.img.xz`, `.sha256`, `.minisig`, `minisign.pub`
  - Verification commands: `sha256sum -c` + `minisign -Vm`
  - Base section: OS (Bookworm Lite 64-bit), pi-gen commit `<abbrev-sha>`, build date, pi-sidecar commit `<abbrev-sha>`, runner
  - Apt package versions table (hand-fill for first release; CI auto-populate deferred)
  - Hardware matrix (Pi 4 recommended, Pi 5 supported, Pi 3B slower, Pi Zero 2 W unsupported)
  - Preseed reference + rollback section

### Task 2: Minisign Key Ceremony — PENDING OPERATOR ACTION

**Status: Checkpoint surfaced to operator.** `pi-image/minisign.pub` is NOT yet in the repo.

Blocks: SGN-REL-01 (workflow cannot sign without the key pair), workflow dry-run (Task 4).

The operator must:
1. Run `minisign -G -p pi-image/minisign.pub -s /tmp/minisign.sec` on a trusted local machine
2. Commit `pi-image/minisign.pub`
3. Paste `/tmp/minisign.sec` contents into GitHub secret `MINISIGN_SECRET_KEY`
4. Back up the private key to a password manager
5. `shred -u /tmp/minisign.sec`

See checkpoint details below and `pi-image/SIGNING.md` for full runbook.

### Task 3: pi-image/SIGNING.md + pi-image/README.md extensions (committed a8aec30)

- **`pi-image/SIGNING.md`** (new):
  - Key pair description (public = committed, private = NEVER committed)
  - PENDING notice for minisign.pub
  - One-time generation ceremony with exact commands (empty passphrase, commit, secret, backup, shred)
  - Backup policy section with password manager placeholder
  - Rotation procedure (4 steps: new key, commit, overwrite secret, patch release)
  - CI usage note: writes to /tmp, signs, removes; keys never persist between jobs
  - Operator verification commands (`sha256sum -c` + `minisign -Vm`)
  - Cross-platform install: Linux (apt), macOS (brew), Windows (scoop/choco + direct download)

- **`pi-image/README.md`** (extended with):
  - "Operator: Download, Verify, Flash" — 4-step flow verbatim from RESEARCH §6
  - Hardware matrix (Pi 4 recommended → Pi Zero 2 W unsupported)
  - Rollback section
  - minisign install (Linux/macOS/Windows)
  - "Operator: Self-hosted CI runner setup" — 3-command block for Hetzner CAX21 registration

### Task 4: Workflow Dry-Run — PENDING OPERATOR ACTION

**Status: Checkpoint surfaced to operator.** Requires:
1. Hetzner CAX21 runner registered and "Idle" in GitHub Actions
2. `MINISIGN_SECRET_KEY` secret set (from Task 2)
3. Trigger via `gh workflow run pi-image.yml --field tag=v1.17.0-rc1` or GitHub UI

Blocks: SGN-REL-01 verified build duration (≤ 60 min), draft release creation.

## Checkpoints Outstanding

### Checkpoint A: Task 2 — Key Ceremony

Blocking. The workflow cannot sign any image until `pi-image/minisign.pub` is committed and
`MINISIGN_SECRET_KEY` is stored as a GitHub Actions secret.

### Checkpoint B: Task 4 — Workflow Dry-Run

Depends on Checkpoint A + Hetzner CAX21 runner registration. The runner cannot be provisioned
by this agent; it requires operator SSH access to the Hetzner console.

## Known Stubs

- `pi-image/minisign.pub` — absent; SIGNING.md documents which commit will add it (operator key ceremony)
- Apt package version table in RELEASE_TEMPLATE.md — placeholder `<version>` fields; hand-fill at first release; CI auto-populate deferred to a future enhancement

## Security Invariant Verification

The YAML uses `${{ secrets.MINISIGN_SECRET_KEY }}` only inside the `env:` block of the "Sign with minisign" step. The private key:
1. Is written to `/tmp/minisign.sec` at runtime (`chmod 600`)
2. Is removed immediately after signing (`rm -f /tmp/minisign.sec`)
3. Has an `always()` cleanup step as belt-and-suspenders
4. Is NEVER committed to git in any file in this plan

## Deviations from Plan

### Plan Amendments

**1. Task 3 executed before Task 2 checkpoint surfaced**

The plan orders tasks 1→2→3→4, but Tasks 2 and 4 are human-action checkpoints while Task 3 is a fully autonomous `type="auto"` task with no dependency on the key ceremony outcome. Task 3 was executed and committed before surfacing the Task 2 checkpoint so that all documentation is in place when the operator returns from the key ceremony. This is a sequencing optimization that does not affect any success criterion.

**2. SIGNING.md includes PENDING notice for minisign.pub**

Added a `> PENDING:` notice block at the top of the "Key pair" section to make it immediately visible that `pi-image/minisign.pub` has not yet been committed. This is additional context not in the plan template but aligns with the security invariant (never commit private key, document the state clearly).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 28af7a3 | feat(49-03): add pi-image.yml workflow + RELEASE_TEMPLATE.md |
| 3 | a8aec30 | feat(49-03): add SIGNING.md + extend README with operator verification + runner setup |

## Carry-forward to Plan 49-04

- Public key pending: `pi-image/minisign.pub` (blocks SGN-REL-01 closeout)
- Runner registration pending (blocks workflow green run)
- Workflow dry-run outcome: TBD — record run URL + draft release URL in 49-04 verification

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `.github/workflows/pi-image.yml` exists | FOUND |
| `.github/RELEASE_TEMPLATE.md` exists | FOUND |
| `pi-image/SIGNING.md` exists | FOUND |
| `pi-image/README.md` exists | FOUND |
| Commit 28af7a3 exists | FOUND |
| Commit a8aec30 exists | FOUND |
| `pi-image/minisign.pub` absent (correct) | CONFIRMED |
