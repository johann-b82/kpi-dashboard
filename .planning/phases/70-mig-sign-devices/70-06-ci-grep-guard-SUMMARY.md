---
phase: 70-mig-sign-devices
plan: 06
subsystem: ci
tags: [ci, guard, grep, signage, devices, mig-sign-04]
requirements: [MIG-SIGN-04]
dependency_graph:
  requires: ["70-02"]
  provides: ["Phase 70 method-anchored device-route grep guard"]
  affects: [".github/workflows/ci.yml"]
tech_stack:
  added: []
  patterns: ["method-anchored file-scoped grep guard (Phase 69 D-04 lesson re-applied)"]
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
decisions:
  - "Insertion point chosen immediately after Phase 69 guard, before docker compose up — matches D-06b pre-stack pattern"
  - "Two-grep design: (1) method-anchored regex for get|patch|delete on '' or '/{device_id}' with `grep -v /calibration\"` allow-list; (2) separate strict-literal regex for put on /{device_id}/tags"
  - "Suffix negative filter `grep -v '/calibration\"'` is the explicit Pitfall 3 fix — calibration PATCH stays allowed even when grep also catches it"
  - "Did NOT guard against `_notify_device_self` helper per D-06c — Phase 71 CLEAN may consolidate, but it is intentionally retained today"
metrics:
  duration: "~2m"
  completed: 2026-04-25
  tasks: 1
  files: 1
---

# Phase 70 Plan 06: CI Grep Guard Summary

Defense-in-depth grep guard added to `.github/workflows/ci.yml` — blocks reintroduction of the five migrated FastAPI device routes (list, by-id GET, name PATCH, DELETE, tags PUT) inside `backend/app/routers/signage_admin/devices.py`, while explicitly allowing the surviving calibration PATCH and not affecting the new `signage_admin/resolved.py` file.

## What Changed

A new step `Phase 70 — block reintroduced device CRUD routes (MIG-SIGN-04)` inserted in `.github/workflows/ci.yml` immediately after the Phase 69 playlist guard and before `docker compose up` (pre-stack — fails in <1s on regression).

The step runs two greps scoped to a single file:

1. `@router\.(get|patch|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]` piped into `grep -v '/calibration"'`. Matches list (`""`), by-id GET, name PATCH, DELETE on `/{device_id}`. The negative filter is the belt-and-suspenders allow-list for the surviving calibration PATCH.
2. `@router\.put\(\s*"/\{device_id\}/tags"` — strict literal for the migrated tags PUT.

The new `GET /api/signage/resolved/{device_id}` lives in `signage_admin/resolved.py` (different file) and is therefore out of scope of this grep — exactly as designed per D-06b.

## Verification

- YAML valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` → OK
- `grep -c "Phase 70" .github/workflows/ci.yml` → 8 (≥1)
- `grep -c "MIG-SIGN-04" .github/workflows/ci.yml` → 4 (≥1)
- `grep -c "signage_admin/devices.py" .github/workflows/ci.yml` → 2 (≥1)
- Dry-run 1 against current devices.py: `grep -nE '@router\.(get|patch|delete)\(\s*"(/?\{?device_id\}?)?"\s*[,)]' backend/app/routers/signage_admin/devices.py | grep -v '/calibration"' | wc -l` → 0
- Dry-run 2 against current devices.py: `grep -nE '@router\.put\(\s*"/\{device_id\}/tags"' backend/app/routers/signage_admin/devices.py | wc -l` → 0
- Adversarial mental test: re-adding `@router.patch("/{device_id}", ...)` in devices.py would match Dry-run 1 and trip the guard.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `b8b99fe` ci(70-06): add Phase 70 device-route grep guard (MIG-SIGN-04)

## Self-Check: PASSED

- FOUND: .github/workflows/ci.yml (modified)
- FOUND: b8b99fe in git log
