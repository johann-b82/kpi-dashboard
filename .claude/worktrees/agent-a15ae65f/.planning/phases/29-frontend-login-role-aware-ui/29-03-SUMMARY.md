---
phase: 29-frontend-login-role-aware-ui
plan: 03
subsystem: frontend-auth
tags: [auth, rbac, react, directus, login, wouter, apiClient]
requires:
  - phase: 29-02-auth-infrastructure
    provides: apiClient, AuthProvider, AuthGate, AdminOnly, useAuth/useRole, shadcn Form primitive
  - phase: 29-01-backend-me-endpoint-and-cors
    provides: GET /api/me + Directus CORS with credentials
provides:
  - /login page (static "KPI Light" wordmark, react-hook-form + zod, inline error)
  - AuthProvider + AuthGate mounted inside QueryClientProvider in App.tsx
  - All 17 frontend fetch sites migrated to apiClient (bearer + silent refresh everywhere)
  - 9 admin-only UI surfaces hidden from Viewer role (Upload nav, DropZone Browse, UploadHistory delete, PersonioCard sync, ActionBar Save/Reset/Discard, UploadPage page-level guard)
  - NavBar LogOut sign-out button (aria-label "Sign out")
affects:
  - Phase 30 (docs) — user-facing flow is now complete and documentable
tech-stack:
  added: []
  patterns:
    - "AuthGate wraps Switch inside AuthProvider inside QueryClientProvider (Pattern 5 from RESEARCH)"
    - "Conditional NavBar/SubHeader render via wouter useLocation() — login page is chromeless"
    - "AdminOnly wrapper for JSX-level role hiding; inline useRole() ternary for page-level fallbacks (D-04)"
    - "apiClient centralizes bearer attach + 401 silent-refresh-retry — callers stay ignorant of auth mechanics"
key-files:
  created:
    - frontend/src/pages/LoginPage.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/lib/api.ts
    - frontend/src/components/NavBar.tsx
    - frontend/src/components/DropZone.tsx
    - frontend/src/pages/UploadPage.tsx
    - frontend/src/components/UploadHistory.tsx
    - frontend/src/components/settings/PersonioCard.tsx
    - frontend/src/components/settings/ActionBar.tsx
key-decisions:
  - "Login page uses static 'KPI Light' wordmark — no /api/settings fetch on unauthed route (orchestrator override)"
  - "NavBar/SubHeader suppressed on /login via useLocation() check — cleanest way to avoid chrome on the login screen"
  - "UploadPage uses inline useRole() guard (not AdminOnly wrapper) because it needs an else-branch 'You don't have permission' message at page level (D-04)"
  - "ActionBar wraps Save/Reset/Discard individually in AdminOnly (simpler than prop-threading)"
patterns-established:
  - "Admin-only surfaces: wrap JSX in <AdminOnly>; Viewer sees nothing (not disabled)"
  - "Page-level viewer fallback: useRole() ternary renders permission message"
requirements-completed: [AUTH-02, AUTH-03, AUTH-06, RBAC-03]
duration: 10min
completed: 2026-04-15
---

# Phase 29 Plan 03: Wire App + Migrate Fetch Sites Summary

**Shipped the Phase 29 user-visible deliverable: /login page, role-aware UI across 9 admin surfaces, NavBar sign-out, and full fetch→apiClient migration (17 call sites) — all 5 ROADMAP success criteria verified by the user.**

## Performance

- **Duration:** ~10 min (execution) + human verification time
- **Completed:** 2026-04-15
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- `/login` page renders per 29-UI-SPEC (static wordmark, react-hook-form + zod, inline error, no toast)
- `AuthProvider` + `AuthGate` mounted inside `QueryClientProvider` — session hydrates on boot, unauth redirects to /login
- All 17 frontend API calls now flow through `apiClient` — zero bare `fetch(` remains in `frontend/src/lib/api.ts`. Every `/api/*` request carries `Authorization: Bearer …` and transparently handles 401→refresh→retry.
- 9 admin-only UI surfaces wrapped with `<AdminOnly>` (or inline `useRole()` for page-level fallback): Upload nav icon, DropZone Browse button, UploadHistory per-row delete, PersonioCard sync trigger, ActionBar Save/Reset/Discard, UploadPage body.
- NavBar `LogOut` icon button (aria-label "Sign out") clears session and React Query cache on click.

## Task Commits

1. **Task 1: Build LoginPage + wire AuthProvider/AuthGate in App.tsx** — `f9bbf65` (feat)
2. **Task 2: Migrate 17 fetch sites to apiClient + wrap 9 admin-only surfaces + NavBar sign-out** — `b7a6298` (feat)
3. **Task 3: Human end-to-end verification** — APPROVED by user (no commit; verification checkpoint)

## Files Created/Modified

- `frontend/src/pages/LoginPage.tsx` (created) — /login page with shadcn Form, inline error, Loader2 submit state
- `frontend/src/App.tsx` — AuthProvider inside QueryClientProvider; AuthGate wraps Switch; chromeless on /login
- `frontend/src/lib/api.ts` — all 17 functions now use `apiClient<T>()`; multipart uploads preserve no Content-Type
- `frontend/src/components/NavBar.tsx` — LogOut button added; Upload link wrapped in AdminOnly
- `frontend/src/components/DropZone.tsx` — Browse button wrapped in AdminOnly
- `frontend/src/pages/UploadPage.tsx` — page-level useRole() guard + viewer permission message
- `frontend/src/components/UploadHistory.tsx` — delete trash button wrapped in AdminOnly
- `frontend/src/components/settings/PersonioCard.tsx` — sync trigger wrapped in AdminOnly
- `frontend/src/components/settings/ActionBar.tsx` — Save, Reset, Discard individually wrapped in AdminOnly

## Decisions Made

- Static "KPI Light" wordmark on /login (no /api/settings call — route is unauthed by design)
- Conditional NavBar/SubHeader rendering via `useLocation()` — cleaner than forking an unauth layout tree
- Inline `useRole()` ternary for UploadPage page-level fallback instead of wrapping entire body in AdminOnly (D-04 allows this pattern when an else-branch message is required)

## Deviations from Plan

None — plan executed exactly as written. All 5 ROADMAP success criteria verified PASS by the user.

## Human Verification Results (Task 3)

User approved all 5 criteria:
1. **Login flow** — PASS: unauth → /login, invalid creds → inline error, valid → dashboard, reload-persistent
2. **Silent refresh** — PASS: session cookie present; dashboard queries continue without re-login
3. **Bearer token on /api/*** — PASS: `Authorization: Bearer …` observed on every /api/* request
4. **Viewer hides admin UI** — PASS: Upload icon absent; /upload shows permission message; Settings Save/Reset/Discard absent from DOM; Personio sync absent
5. **Sign-out** — PASS: clears session; reload stays on /login; subsequent /api/* → 401

## Issues Encountered

None.

## Next Phase Readiness

Phase 29 is complete. All user-visible auth/RBAC flows live. Phase 30 (docs: setup.md, README entry, nightly pg_dump, promote-to-Admin flow) is unblocked and ready to plan.

Carry-forward: pre-existing TypeScript build errors in `HrKpiCharts.tsx` and `SalesTable.tsx` remain deferred (logged in `deferred-items.md` during Plan 29-02). Unrelated to auth — do not block Phase 30.

## Self-Check: PASSED

- FOUND: .planning/phases/29-frontend-login-role-aware-ui/29-03-SUMMARY.md
- FOUND: commit f9bbf65 (Task 1)
- FOUND: commit b7a6298 (Task 2)
- Task 3 human verification: APPROVED by user (all 5 ROADMAP criteria PASS)

---
*Phase: 29-frontend-login-role-aware-ui*
*Completed: 2026-04-15*
