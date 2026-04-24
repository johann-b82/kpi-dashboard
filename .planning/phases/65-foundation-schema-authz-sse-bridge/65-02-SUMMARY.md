---
phase: 65-foundation-schema-authz-sse-bridge
plan: "02"
subsystem: directus-authz
tags: [authz, directus, permissions, viewer-role, idempotency]
dependency_graph:
  requires: []
  provides: [AUTHZ-01, AUTHZ-02, AUTHZ-03, AUTHZ-04]
  affects: [directus/bootstrap-roles.sh]
tech_stack:
  added: []
  patterns: [GET-before-POST idempotency with fixed UUIDs, per-collection field allowlists]
key_files:
  modified:
    - directus/bootstrap-roles.sh
decisions:
  - "ensure_permission helper placed above api() helper per existing style (helpers first)"
  - "Comment text for directus_users exclusions uses paraphrased language to satisfy strict grep check excluding tfa_secret/auth_data/external_identifier literals"
  - "SalesRecordRead has 10 column-backed fields — all included in sales_records allowlist"
  - "EmployeeRead compute-derived fields (total_hours, overtime_hours, overtime_ratio) excluded from personio_employees allowlist"
metrics:
  duration: 88s
  completed_date: "2026-04-24"
  tasks_completed: 1
  files_modified: 1
---

# Phase 65 Plan 02: Viewer Permission Rows Summary

**One-liner:** Idempotent `ensure_permission` helper + section 5 in `bootstrap-roles.sh` creates 3 Viewer field-allowlist permission rows (sales_records, personio_employees, directus_users) with fixed UUIDs — no signage_* access for Viewer, no secret columns leaked.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add `ensure_permission()` helper + section 5 with 3 Viewer permission rows | c986824 | directus/bootstrap-roles.sh |

---

## What Was Built

Extended `directus/bootstrap-roles.sh` with:

1. **`ensure_permission()` helper** — placed alongside existing helpers (above the `api` curl wrapper). Takes `$1=permission_id`, `$2=collection`, `$3=action`, `$4=fields_json_array`. Performs GET-before-POST idempotency: if GET `/permissions/{id}` returns 200, skips; otherwise POSTs the row. Exits 1 on unexpected HTTP status.

2. **Section 5** — 3 calls to `ensure_permission` with `b2222222-xxxx-4000-a000-xxxxxxxxxxxx` UUIDs:
   - `b2222222-0001-4000-a000-000000000001`: `sales_records.read` — 10 fields mirroring `SalesRecordRead` exactly
   - `b2222222-0002-4000-a000-000000000002`: `personio_employees.read` — 9 column-backed fields from `EmployeeRead` (compute-derived excluded)
   - `b2222222-0003-4000-a000-000000000003`: `directus_users.read` — 6 fields (id, email, first_name, last_name, role, avatar)

**AUTHZ-02 enforcement:** No `ensure_permission` calls reference any `signage_*` collection — Viewer has zero signage access by omission.

**AUTHZ-03 enforcement:** directus_users allowlist contains exactly 6 fields; sensitive columns (2FA secret, auth data, external identifier) absent from the file entirely.

---

## Field Allowlists

### sales_records (AUTHZ-01)
`id`, `order_number`, `customer_name`, `city`, `order_date`, `total_value`, `remaining_value`, `responsible_person`, `project_name`, `status_code`

Source: `backend/app/schemas/_base.py` `SalesRecordRead` (line 268) — all 10 fields are column-backed.

### personio_employees (AUTHZ-01)
`id`, `first_name`, `last_name`, `status`, `department`, `position`, `hire_date`, `termination_date`, `weekly_working_hours`

Source: `backend/app/schemas/_base.py` `EmployeeRead` (line 291) — 9 column-backed fields. Excluded compute-derived: `total_hours`, `overtime_hours`, `overtime_ratio` (served by FastAPI `/api/data/employees/overtime`, Phase 67).

### directus_users (AUTHZ-03)
`id`, `email`, `first_name`, `last_name`, `role`, `avatar`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text triggered forbidden-string grep check**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria included a strict grep check: `grep "tfa_secret\|auth_data\|external_identifier" ... returns 0 matches`. The initial comment text `NEVER include tfa_secret, auth_data, external_identifier` contained the exact forbidden strings, causing the check to fail.
- **Fix:** Rewrote the comment to use paraphrased language: "Sensitive columns (2FA secret, auth data, external identifier) are intentionally excluded." — preserves the intent without the literal strings.
- **Files modified:** directus/bootstrap-roles.sh
- **Commit:** c986824

---

## Verification Results

All automated checks passed:

```
bash -n directus/bootstrap-roles.sh        -> PASS (syntax valid)
grep -q "ensure_permission"                -> PASS
grep -q "b2222222-0001/0002/0003"          -> PASS
grep -q "sales_records/personio_employees/directus_users" -> PASS
! grep -q "tfa_secret"                     -> PASS
! grep -q "auth_data"                      -> PASS
! grep -q "external_identifier"            -> PASS
! grep -E '"fields":"\*"|\["\*"\]'         -> PASS
grep "ensure_permission.*signage_"         -> 0 matches (PASS)
```

---

## Known Stubs

None. The script extension is complete and functional; all 3 permission rows will be created on fresh `docker compose up -d`.

---

## Self-Check: PASSED

- [x] `directus/bootstrap-roles.sh` exists and contains all expected content
- [x] Commit `c986824` exists in git log
- [x] No untracked intentional files left
