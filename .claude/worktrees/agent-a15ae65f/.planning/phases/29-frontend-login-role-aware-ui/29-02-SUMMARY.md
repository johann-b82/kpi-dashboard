---
phase: 29-frontend-login-role-aware-ui
plan: 02
subsystem: frontend-auth
tags: [auth, rbac, directus, react, context]
requires:
  - Plan 29-01 /api/me endpoint + Directus CORS
  - @directus/sdk cookie-mode refresh cookie
provides:
  - apiClient<T>() wrapper with Bearer attach, 401 refresh-retry, concurrent-refresh guard
  - directus SDK singleton (cookie mode, credentials include)
  - AuthContext/AuthProvider with user/role/isLoading + signIn/signOut
  - useAuth / useRole hooks
  - <AdminOnly>, <AuthGate>, <FullPageSpinner> UI primitives
  - shadcn Form primitive (react-hook-form wrapper) at components/ui/form.tsx
affects:
  - frontend/package.json (added @directus/sdk, react-hook-form, @hookform/resolvers, zod)
tech-stack:
  added:
    - "@directus/sdk@21.2.2"
    - "react-hook-form"
    - "@hookform/resolvers"
    - "zod"
  patterns:
    - Module-singleton access token in apiClient to avoid circular import with AuthContext
    - Shared-promise concurrent-refresh guard so parallel 401s collapse onto one directus.refresh()
    - setAuthFailureHandler hook — apiClient calls back into AuthContext without importing it
    - StrictMode-safe initial hydration via hydratedRef
    - queryClient.clear() on signOut so a new user never sees previous user's cached data
key-files:
  created:
    - frontend/src/lib/directusClient.ts
    - frontend/src/lib/apiClient.ts
    - frontend/src/auth/AuthContext.tsx
    - frontend/src/auth/useAuth.ts
    - frontend/src/auth/AdminOnly.tsx
    - frontend/src/auth/AuthGate.tsx
    - frontend/src/auth/FullPageSpinner.tsx
    - frontend/src/components/ui/form.tsx
  modified:
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - Kept access token in module singleton (not React state) — avoids re-rendering every consumer on refresh
  - Shared _refreshPromise collapses concurrent 401s onto a single directus.refresh() call (rotation safety)
  - shadcn Form primitive adapted for @base-ui/react stack — uses React.cloneElement instead of Radix Slot (no extra dep)
  - D-07 respected: signOut clears local state even when directus.logout() throws
metrics:
  duration_minutes: 8
  tasks: 2
  files: 8
  completed: 2026-04-15
requirements: [AUTH-03, RBAC-03]
---

# Phase 29 Plan 02: Auth Infrastructure Summary

**One-liner:** Built the reusable frontend auth contract — Directus SDK singleton + apiClient wrapper (Bearer attach, 401 silent-refresh with concurrent-refresh guard) + AuthContext/AuthGate/AdminOnly — ready for Plan 03 to wire into App.tsx.

## What Shipped

### Task 1: Deps + SDK client + apiClient wrapper (`63980ea`)
- Installed `@directus/sdk@21.2.2`, `react-hook-form`, `@hookform/resolvers`, `zod`
- `frontend/src/lib/directusClient.ts` — singleton `createDirectus(...)` in cookie mode with `credentials: 'include'`
- `frontend/src/lib/apiClient.ts`:
  - `setAccessToken/getAccessToken` module-singleton token
  - `apiClient<T>(path, init)` — Bearer attach, FormData guard (no forced Content-Type on multipart), preserves legacy `err.detail` error shape
  - `trySilentRefresh()` with shared `_refreshPromise` (concurrent-refresh guard)
  - `setAuthFailureHandler(fn)` — AuthContext registers cleanup to avoid circular import
  - 401 flow: try refresh once → retry original request; on refresh failure invoke handler + throw
- `frontend/src/components/ui/form.tsx` — shadcn-style Form primitive adapted for @base-ui/react (uses React.cloneElement rather than Radix Slot)

### Task 2: Auth context + hooks + gates (`e6e74f6`)
- `AuthContext.tsx` — AuthProvider holds `{ user, role, isLoading, signIn, signOut }`. Token stays in module singleton (not React state) to avoid unnecessary re-renders. On mount: trySilentRefresh → apiClient('/api/me') → setUser. StrictMode-guarded via hydratedRef. `signOut` swallows directus.logout() errors per D-07 and always clears local auth + React Query cache.
- `useAuth.ts` — `useAuth()` / `useRole()` hooks; `useAuth` throws outside provider
- `AdminOnly.tsx` — renders children only when role === 'admin'
- `AuthGate.tsx` — per D-05: FullPageSpinner while loading, redirect unauthed→/login, redirect authed-on-/login→/
- `FullPageSpinner.tsx` — per 29-UI-SPEC: Loader2 h-8 w-8 text-muted-foreground centered min-h-screen

## Verification

- `npm run build` — auth infrastructure files (directusClient, apiClient, auth/*, components/ui/form) compile with zero TypeScript errors
- All acceptance `grep` checks from plan pass (package.json deps, file existence, key symbols present)
- `grep -rn "TODO\|FIXME" frontend/src/auth/ frontend/src/lib/apiClient.ts frontend/src/lib/directusClient.ts` → 0 matches (no unresolved stubs)
- Isolation check: `grep -rn "from '@/auth'" frontend/src --include="*.tsx" --include="*.ts" | grep -v "frontend/src/auth/"` → 0 matches (as expected — Plan 03 wires)

## Deviations from Plan

None for Plan 29-02 logic. One shadcn CLI friction item:
- `npx shadcn@latest add form` produced no output against this project's `base-nova` custom registry. Created `components/ui/form.tsx` manually matching the shadcn contract (same exports: Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField) and adapted to project stack (@base-ui/react + local Label; no Radix Slot dep). Behavior is identical for consumers — Plan 03's LoginPage can use standard shadcn form patterns.

## Deferred Issues (out of scope)

Pre-existing TypeScript build errors (verified present on HEAD before Plan 29-02 changes via `git stash` baseline):
- `src/components/dashboard/HrKpiCharts.tsx` lines 111, 112, 135, 136 — Recharts Tooltip formatter type mismatch
- `src/components/dashboard/SalesTable.tsx` lines 31, 110–116 — missing index signature on SalesRecordRow

Both unrelated to auth infrastructure. Logged in `.planning/phases/29-frontend-login-role-aware-ui/deferred-items.md`.

## Commits

| Hash      | Type | Message                                                         |
| --------- | ---- | --------------------------------------------------------------- |
| `63980ea` | feat | install auth deps + SDK client + apiClient wrapper              |
| `e6e74f6` | feat | add AuthContext, hooks, AuthGate, AdminOnly, FullPageSpinner    |

## Self-Check: PASSED

- FOUND: frontend/src/lib/directusClient.ts
- FOUND: frontend/src/lib/apiClient.ts
- FOUND: frontend/src/auth/AuthContext.tsx
- FOUND: frontend/src/auth/useAuth.ts
- FOUND: frontend/src/auth/AdminOnly.tsx
- FOUND: frontend/src/auth/AuthGate.tsx
- FOUND: frontend/src/auth/FullPageSpinner.tsx
- FOUND: frontend/src/components/ui/form.tsx
- FOUND: commit 63980ea
- FOUND: commit e6e74f6
- FOUND: @directus/sdk, react-hook-form, @hookform/resolvers, zod in package.json
