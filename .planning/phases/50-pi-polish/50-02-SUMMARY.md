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
  duration: ~2m (Tasks 1–2) + operator hardware walkthrough (Task 3, off-session)
  completed_date: 2026-04-21
status: done
---

# Phase 50 Plan 02: E2E Scenarios 4 + 5 Summary

Produced the operator runbook + results template for the v1.17 carry-forward hardware walkthrough (Scenarios 4 + 5), grep-verified every runbook command against the current repo, and — after operator hardware sign-off — closed SGN-POL-04 with both scenarios PASS on v1.18 Pi hardware.

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

### Task 3: Operator runs Scenarios 4 + 5 on real Pi hardware — DONE

Operator ran the full hardware walkthrough on v1.18 test hardware (Raspberry Pi OS Bookworm Lite 64-bit, provisioned via `scripts/provision-pi.sh`) and signed off both scenarios PASS.

**Scenario 4 — Reconnect → admin-mutation arrives:** PASS. Budget ≤ 30 s verified by direct stopwatch observation. No black screen, no error banner. Exact `T1 − T0` delta was not captured numerically.

**Scenario 5 — Sidecar restart → playback continuity:** PASS. Zero visible interruption during `systemctl --user restart signage-sidecar` (5.2). Sidecar `/health` returned `ready:true` within the 15 s budget (5.3). Exact cold-start time not captured numerically. Step 5.6 (SSE post-restart mutation) not exercised in this walkthrough.

**Honesty note:** The operator did not log exact wall-clock timings for `T1 − T0` (Scenario 4) or sidecar cold-start (Scenario 5). Both threshold checks were confirmed by direct observation rather than numerical capture; the results doc reflects this with `not recorded` in the timing columns and PASS verdicts, and the sign-off area explicitly calls out the missing numerical captures. If future regression work requires numerical baselines, the walkthrough should be repeated with `date +"%Y-%m-%dT%H:%M:%S.%N"` markers as the original research methodology prescribed.

Results commit: `476021a` — `docs(50): record Scenarios 4+5 hardware E2E results — SGN-POL-04`.

## Deviations from Plan

None — plan executed exactly as written through Task 2. Task 3 is a planned human-action checkpoint, not a deviation.

## Authentication Gates

None.

## Known Stubs

None.

## SGN-POL-04 Status

**CLOSED** — operator confirmed both Scenario 4 (reconnect → admin-mutation ≤ 30 s) and Scenario 5 (sidecar restart: zero visible interruption + `/health` ready ≤ 15 s) thresholds met on v1.18 Pi hardware on 2026-04-21. Exact timings not captured numerically; thresholds verified by direct observation.

## Self-Check: PASSED

- File exists: `.planning/phases/50-pi-polish/50-E2E-RESULTS.md` — **FOUND**
- Template commit `e616acd` — **FOUND** in `git log --oneline`
- Results commit `476021a` (operator sign-off, Status=PASS) — **FOUND** in `git log --oneline`
- Task 2 grep checks: all five PASS (output captured above)
- Results file Status line: `**Status:** PASS` — **CONFIRMED**
- Operator sign-off block: all three checkboxes checked, Reviewer + Date populated — **CONFIRMED**
