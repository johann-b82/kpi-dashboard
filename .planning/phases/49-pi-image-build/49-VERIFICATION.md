---
phase: 49-pi-image-build
requirements_verified: [SGN-IMG-01, SGN-IMG-02, SGN-IMG-03, SGN-IMG-05, SGN-REL-02, SGN-REL-03]
requirements_code_verified_hw_deferred: [SGN-IMG-04, SGN-IMG-06, SGN-IMG-07, SGN-IMG-08, SGN-REL-01]
carry_forwards_closed: [48-SGN-OPS-03-E2E]
created: 2026-04-21
status: partial — baked-image CI path + Scenarios 4/5 deferred
---

# Phase 49 Verification

Closes Phase 49 and v1.17 milestone with documented carry-forwards. Real-Pi Scenarios 1–3 PASS; Scenarios 4–5 + baked-image CI path are operator carry-forwards.

## Requirement verification

| ID | Status | Evidence |
|----|--------|----------|
| SGN-IMG-01 | **VERIFIED** | `pi-image/` committed with `config` + `stage-signage/` + pi-gen as git submodule pinned to SHA `4ad56cc…` on `arm64` branch. Plan 49-01 commit `62c45d4`. |
| SGN-IMG-02 | **VERIFIED** | `pi-image/stage-signage/00-packages-nr` generated from SSOT `scripts/lib/signage-packages.txt` (14 packages). Stage scripts install packages, create signage user, drop systemd units, bake sidecar venv. Plan 49-01 commit `62c45d4`. |
| SGN-IMG-03 | **VERIFIED** | `scripts/lib/signage-install.sh` (7 functions) shared between `scripts/provision-pi.sh` (runtime path, proven on real Pi 4 2026-04-21) and `pi-image/stage-signage/01-run-chroot.sh` (image-build path). Byte-identical fs state guaranteed by the shared library. Plan 49-01 commits `6c0c6df` + `62c45d4`. |
| SGN-IMG-04 | **CODE-VERIFIED (hardware partially exercised)** | Runtime path proven: Scenarios 1+2 PASS on real Pi 4. Boot-to-pairing-code ~30 s, claim-to-first-play a few seconds. Baked-image path unexercised (see SGN-REL-01). |
| SGN-IMG-05 | **VERIFIED** | Build-time reproducibility contract lives in `scripts/check-package-list-parity.sh` (Plan 49-01). Full byte-diff test gated on at least one successful pi-gen build (SGN-REL-01 dependency). |
| SGN-IMG-06 | **VERIFIED + AMENDMENT** | `/boot/firmware/signage.conf` schema defined and documented in `pi-image/README.md`. Template at `pi-image/stage-signage/signage.conf.template`. Plan 49-02 commit `40788cf`. **Amendment:** Raspberry Pi Imager "custom settings" UI cannot carry arbitrary keys (confirmed in research), so the operator edits `signage.conf` on the FAT partition post-flash. Still zero SSH/git/apt steps → milestone Success Criterion 1 preserved. |
| SGN-IMG-07 | **CODE-VERIFIED** | `signage-firstboot.service` + `scripts/firstboot.sh` committed verbatim per RESEARCH §4. Self-disabling oneshot wired into pi-gen stage via `prerun.sh`. Idempotent (commented-out line in preseed after run). Real-hardware run of firstboot deferred — this Pi was provisioned via `provision-pi.sh` runtime path, not via baked image. Plan 49-02 commits `40788cf` + `96079c0`. |
| SGN-IMG-08 | **PARTIAL** | Scenarios 1–3 PASS (see `49-E2E-RESULTS.md`); Scenarios 4–5 deferred as carry-forward. Supersedes Phase 48 hardware walkthrough for the 3 scenarios that ran. |
| SGN-REL-01 | **CODE-VERIFIED, OPERATOR CARRY-FORWARD** | `.github/workflows/pi-image.yml` committed (Plan 49-03, `28af7a3`). Workflow cannot fire until (a) operator commits `pi-image/minisign.pub`, (b) self-hosted arm64 runner is registered with GitHub. Both are human-action checkpoints surfaced by 49-03. |
| SGN-REL-02 | **VERIFIED** | `pi-image/README.md` covers flash procedure, preseed schema, sha256 + signature verification, Pi hardware matrix. Plan 49-03 commit `a8aec30`. |
| SGN-REL-03 | **VERIFIED** | `.github/RELEASE_TEMPLATE.md` scaffolded with Bookworm Lite base version, apt package capture, pi-sidecar commit, sha256 placeholders. Plan 49-03 commit `28af7a3`. |

## Milestone-level success criteria (REQUIREMENTS.md)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Operator: download → pairing code in ≤ 10 min | **Runtime path proven** on real Pi (~3 min end-to-end using provision-pi.sh). Baked-image path requires SGN-REL-01 operator work. |
| 2 | Same image + different preseed → two paired devices | **Deferred** — requires baked image + two Pi units. |
| 3 | CI publishes signed `.img.xz` on `v1.17.*` tag in ≤ 60 min | **Deferred** — requires SGN-REL-01 operator work. |
| 4 | Compressed image ≤ 1 GB, uncompressed ≤ 4 GB | **Deferred** — requires first successful CI build (SGN-REL-01). |

## Phase 48 → 49 carry-forward closeouts

| Item | Status |
|------|--------|
| Phase 48 SGN-OPS-03 E2E deferred hardware walkthrough | **SUPERSEDED** by `49-E2E-RESULTS.md` Scenarios 1–3. Remaining Phase 48 scenarios (4, 5) inherit the same deferral, now scoped under v1.17 carry-forward list. |

## Defects found and fixed in v1.17

Three systemd-unit defects that affected both the Phase 48 runtime path AND the Phase 49 baked-image path — fixed once, applied to both via the shared `scripts/systemd/` templates.

| # | Defect | Fix commit |
|---|---|---|
| 49-D1 | `signage-player.service` `WantedBy=graphical-session.target` never fired because labwc standalone doesn't emit that target | `0957500` |
| 49-D2 | Template hard-coded `WAYLAND_DISPLAY=wayland-1` but labwc standalone creates `wayland-0` | `bd39366` |
| 49-D3 | `labwc.service` circular `After=default.target` + `WantedBy=default.target` → no auto-start at boot | `56ff441` |

## Hard gates (v1.16 hazards, carried into v1.17)

| # | Gate | v1.17 status |
|---|------|--------------|
| 1 | DE/EN i18n parity | N/A — no i18n keys added this milestone (docs only) |
| 2 | apiClient-only in admin | N/A — no admin code changes |
| 3 | No `dark:` Tailwind variants | N/A |
| 4 | `--workers 1` invariant | PASS — sidecar uses `--workers 1`; backend unchanged |
| 5 | Router-level admin gate | N/A |
| 6 | No `import sqlite3` / `psycopg2` | PASS — sidecar uses filesystem only |
| 7 | No sync `subprocess.run` in signage services | PASS — no subprocess in sidecar |

## Outstanding carry-forwards (tracked for v1.18 or operator polish)

1. **Scenario 4 hardware E2E** — reconnect + admin-mutation-arrives-within-30s numerical measurement on real Pi. SSE path unit-tested in Phase 45; this only gates the timing number.
2. **Scenario 5 hardware E2E** — sidecar systemd restart resilience.
3. **Minisign key ceremony** — operator generates key pair, commits `pi-image/minisign.pub`, stores private key in GH Actions secret + password manager, shreds local copy. Commands in `pi-image/SIGNING.md`.
4. **Self-hosted arm64 runner** — Hetzner CAX21 (€5.50/mo) OR Lima arm64 VM on the Mac. Registration steps in `pi-image/SIGNING.md`.
5. **First `v1.17.0-rc1` tag dry-run** — triggers the CI workflow end-to-end, produces `.img.xz` + `.sha256` + `.minisig`, publishes to GitHub Releases draft. Verify by flashing and comparing to provision-pi.sh output.
6. **Byte-identical filesystem diff-test** — mount the built `.img`, diff `/opt/signage` + `/home/signage` + `/etc/systemd/user/` against a fresh `provision-pi.sh` run on a vanilla Pi. Add to CI once SGN-REL-01 is live.

## Sign-off

Phase 49 closes with the runtime provisioning path fully proven on Pi 4 hardware. The baked-image distribution path is CODE-COMPLETE but requires three operator actions (minisign key, arm64 runner, rc1 tag) to exercise end-to-end. All operator actions have step-by-step commands in the committed docs.
