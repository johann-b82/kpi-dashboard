---
phase: 66-kill-me-py
plan: "01"
subsystem: frontend-auth
tags: [auth, directus-sdk, react-query, permissions]
dependency_graph:
  requires: [65-05]
  provides: [MIG-AUTH-01]
  affects: [frontend/src/auth/AuthContext.tsx, frontend/src/auth/useCurrentUserProfile.ts, directus/bootstrap-roles.sh]
tech_stack:
  added: []
  patterns: [directus-readMe-hydration, role-name-switch-map, react-query-profile-hook]
key_files:
  created:
    - frontend/src/auth/useCurrentUserProfile.ts
  modified:
    - frontend/src/auth/AuthContext.tsx
    - directus/bootstrap-roles.sh
decisions:
  - "mapRoleName() switch maps Administrator->admin, Viewer->viewer, unknown->null (D-01, D-09)"
  - "AuthContext readMe uses minimal fields ['id','email','role.name']; useCurrentUserProfile uses full field set (D-03/D-04/D-05)"
  - "directus_roles Viewer read permission added with fixed UUID b2222222-0004-4000-a000-000000000004 for idempotency"
metrics:
  duration: 102s
  completed: 2026-04-24
  tasks_completed: 3
  files_modified: 3
---

# Phase 66 Plan 01: AuthContext readMe Swap + useCurrentUserProfile Summary

AuthContext identity hydration swapped from `apiClient("/api/me")` to `directus.request(readMe(...))` on both the silent-refresh and signIn paths; `useCurrentUserProfile` React Query hook added for full-field profile access; Viewer policy extended with `directus_roles` read permission.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Viewer permission row for directus_roles.name read | 0922134 | directus/bootstrap-roles.sh |
| 2 | Create useCurrentUserProfile React Query hook | 2141bc9 | frontend/src/auth/useCurrentUserProfile.ts |
| 3 | Swap AuthContext hydration + signIn to directus.request(readMe(...)) | 6e254d9 | frontend/src/auth/AuthContext.tsx |

## What Was Built

**Task 1 — bootstrap-roles.sh:** Added `ensure_permission` call for `directus_roles` with fields `["id","name"]` under fixed UUID `b2222222-0004-4000-a000-000000000004`. Positioned after the `directus_users` row and before the section-5-complete log line. Re-running is a no-op (GET-before-POST). Updated log message to include `directus_roles`. Shell syntax valid (`bash -n` exits 0).

**Task 2 — useCurrentUserProfile.ts:** New file at `frontend/src/auth/useCurrentUserProfile.ts`. Exports `CurrentUserProfile` interface and `useCurrentUserProfile()` hook. Query key `['currentUserProfile']`. Fetches `id, email, first_name, last_name, avatar, role.name` via `readMe`. No `staleTime`/`gcTime` override — project defaults. Invalidated on `signOut` via existing `queryClient.clear()`.

**Task 3 — AuthContext.tsx:**
- Removed `MeResponse` interface (D-07)
- Removed `apiClient` import (no longer used)
- Added `readMe` import from `@directus/sdk`
- Added `mapRoleName()` function: `"Administrator"` → `"admin"`, `"Viewer"` → `"viewer"`, anything else → `null`
- Replaced both `apiClient<MeResponse>("/api/me")` call sites with `directus.request(readMe({ fields: ["id", "email", "role.name"] }))`
- Unknown/unmapped role clears auth state (D-09) rather than silently defaulting
- Updated AuthProvider JSDoc to reference `directus.request(readMe(...))` flow (D-13)
- No `/api/me` string literal remains in the file

## Verification

- `grep -rn '"/api/me"' frontend/src/` → 0 matches (prepares Plan 03 CI guard to pass)
- `grep -n 'directus_roles' directus/bootstrap-roles.sh` → shows `ensure_permission` call
- `frontend/src/auth/useCurrentUserProfile.ts` exists, exports hook + type
- `cd frontend && npx tsc --noEmit` → exits 0 (clean)
- No existing AuthContext tests existed to update

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All fields wired to real Directus readMe calls.

## Self-Check: PASSED

- `frontend/src/auth/useCurrentUserProfile.ts` — FOUND
- `frontend/src/auth/AuthContext.tsx` — FOUND (modified)
- `directus/bootstrap-roles.sh` — FOUND (modified)
- Commits 0922134, 2141bc9, 6e254d9 — FOUND in git log
