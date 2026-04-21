---
phase: 50-pi-polish
plan: 02
subsystem: signage-operator
tags: [e2e, hardware, signage, runbook, carry-forward]
requires:
  - scripts/provision-pi.sh
  - scripts/lib/signage-packages.txt (network-manager package)
  - docs/operator-runbook.md (systemctl restart signage-sidecar procedure)
  - pi-sidecar/sidecar.py (127.0.0.1:8080 /health endpoint)
provides:
  - .planning/phases/50-pi-polish/50-E2E-RESULTS.md (operator template, Status=PENDING)
affects:
  - SGN-POL-04 (closes on operator sign-off)
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/50-pi-polish/50-E2E-RESULTS.md
  modified: []
decisions:
  - "Template copied verbatim from 50-RESEARCH.md § '50-E2E-RESULTS.md template' — preserves Unicode arrows (→, ≤) and mirrors Phase 48 layout for operator familiarity."
  - "Task 3 is a checkpoint:human-action — requires physical Pi walkthrough; cannot be run inside Claude execution environment."
metrics:
  duration: ~2m
  completed_date: 2026-04-21
status: checkpoint
---

# Phase 50 Plan 02: E2E Scenarios 4 + 5 Summary

Produced the operator runbook + results template for the v1.17 carry-forward hardware walkthrough (Scenarios 4 + 5), with every runbook command grep-verified against the current repo. Execution paused at Task 3 checkpoint: operator must run the walkthrough on a `provision-pi.sh`-provisioned Pi and record numerical timings.

## What was built

- **`.planning/phases/50-pi-polish/50-E2E-RESULTS.md`** — structured recording template, Status=PENDING. Contains all five required H2 sections (Preconditions, Scenario 4, Scenario 5, Pass/Fail Summary, Operator sign-off) with 6-row tables for each scenario (4.1–4.6 and 5.1–5.6). Mirrors Phase 48 layout.

## Task-by-task

### Task 1: Write 50-E2E-RESULTS.md template — DONE

Copied verbatim from `50-RESEARCH.md` § "50-E2E-RESULTS.md template (proposed — planner copies verbatim)". All acceptance criteria satisfied:

- File exists with H1 `# Phase 50 — E2E Walkthrough Results (Scenarios 4 + 5)`
- Contains `**Status:** PENDING`
- All five required H2 headings present
- Contains literal strings `provision-pi.sh`, `nmcli device disconnect wlan0`, `systemctl --user restart signage-sidecar`, `duration_s = 5`
- Scenario 4 table: 6 data rows (4.1 – 4.6); Scenario 5 table: 6 data rows (5.1 – 5.6)
- Unicode arrows (→, ≤) preserved verbatim

Commit: `e616acd` — `docs(50-02): add 50-E2E-RESULTS.md template for Scenarios 4+5`

### Task 2: Grep-verify every runbook command exists — DONE (no diff)

All five verification checks PASS:

| Check | Command | Result |
|-------|---------|--------|
| 1. nmcli availability | `grep -E "network-manager\|nmcli" scripts/provision-pi.sh scripts/lib/signage-packages.txt` | **PASS** — `scripts/lib/signage-packages.txt:network-manager` |
| 2. signage-sidecar references in scripts/ + runbook | `grep -r "signage-sidecar" scripts/` | **PASS** — `scripts/README-pi.md` + `scripts/firstboot.sh` reference the unit |
| 3. Sidecar port 8080 | `grep ":8080" pi-sidecar/sidecar.py` | **PASS** — `Listens on 127.0.0.1:8080` |
| 4. Restart-sidecar procedure in runbook | `grep -E "systemctl.*restart.*signage-sidecar" docs/operator-runbook.md` | **PASS** — multiple matches |
| 5. provision-pi.sh single path | `grep "provision-pi.sh" scripts/README-pi.md` + `! test -d pi-image` | **PASS** — README references provision script, `pi-image/` directory confirmed gone |

No repo files modified by Task 2 (verification only).

### Task 3: Operator runs Scenarios 4 + 5 on real Pi hardware — CHECKPOINT

**Blocked by:** requires physical Raspberry Pi + SSH + admin UI; cannot be simulated inside Claude's execution environment. This is exactly the SGN-POL-04 v1.17 carry-forward that Phase 50 was created to close.

Operator must:
1. Provision a fresh Bookworm Lite 64-bit Pi via `scripts/provision-pi.sh`
2. Pair the Pi and create a test playlist (≥ 3 items, each `duration_s = 5`)
3. Run Scenario 4 (nmcli disconnect → reconnect → admin mutation; measure T1 − T0 ≤ 30 s)
4. Run Scenario 5 (`systemctl --user restart signage-sidecar`; observe visual continuity; cold-start ≤ 15 s)
5. Fill in numerical timings in `50-E2E-RESULTS.md`, flip Status from PENDING to PASS/FAIL, sign off, commit.

Resume signal: operator types "approved" once `50-E2E-RESULTS.md` is filled in and committed.

## Deviations from Plan

None — plan executed exactly as written through Task 2. Task 3 is a planned human-action checkpoint, not a deviation.

## Authentication Gates

None.

## Known Stubs

None.

## SGN-POL-04 Status

**OPEN** — pending operator hardware walkthrough. Closes on Task 3 sign-off.

## Self-Check: PASSED

- File exists: `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` — **FOUND**
- Commit exists: `e616acd` — **FOUND** in `git log --oneline`
- Task 2 grep checks: all five PASS (output captured above)
