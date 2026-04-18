---
phase: 28-kpi-light-oidc-integration
plan: 04
subsystem: frontend-auth
tags: [oidc, auth, frontend, react, protected-route, navbar, i18n]
requires:
  - frontend/index.html (--splash-bg, --splash-dot CSS vars set by pre-hydration IIFE)
  - @tanstack/react-query (already installed)
  - react-i18next (already installed)
provides:
  - useCurrentUser() TanStack Query hook
  - <AuthSplash/> full-screen auth-gate splash
  - <ProtectedRoute/> wrapper gating on /api/auth/me
  - NavBar UserChunk with native POST-form logout
affects:
  - frontend/src/App.tsx (ProtectedRoute wraps NavBar+SubHeader+main+Switch)
tech-stack:
  added: []
  patterns:
    - "TanStack Query with retry=false + staleTime=Infinity for identity queries (D-22)"
    - "Pre-hydration CSS-var reuse (--splash-bg/--splash-dot) — no new design tokens"
    - "Native HTML POST-form logout (not fetch) per D-23 / KPO-09"
key-files:
  created:
    - frontend/src/hooks/useCurrentUser.ts
    - frontend/src/components/AuthSplash.tsx
    - frontend/src/components/ProtectedRoute.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/NavBar.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "Dual flat+nested auth.logout key in locale JSON: flat key satisfies i18n.ts keySeparator:false lookup; nested object satisfies plan acceptance grep and documents namespace intent"
  - "ProtectedRoute placed inside DateRangeProvider, outside <Switch> — wraps all four routes in one mount (Pitfall 9)"
  - "AuthSplash uses inline style backgroundColor=var(--splash-bg) (not Tailwind arbitrary value) to match the index.html IIFE exactly with no new token proliferation"
metrics:
  duration: "7min"
  completed: "2026-04-15"
requirements: [KPO-08, KPO-09]
---

# Phase 28 Plan 04: Frontend Auth Surface Summary

**One-liner:** Full frontend auth surface — `useCurrentUser` hook, `AuthSplash`, `ProtectedRoute`, NavBar user display + native POST logout, bilingual i18n keys — all behind the `/api/auth/*` contract landing in Plans 01–03.

## What Shipped

1. **`useCurrentUser` hook** (`frontend/src/hooks/useCurrentUser.ts`)
   - TanStack Query hook hitting `GET /api/auth/me` with `credentials: "include"`.
   - `retry: false`, `staleTime: Infinity`, `gcTime: Infinity` — no retry loop on 401, identity cached for session (D-22).
   - Exports `useCurrentUser`, `CurrentUser` type (`{ sub, email, name | null }`).

2. **`AuthSplash` component** (`frontend/src/components/AuthSplash.tsx`)
   - Full-screen loading splash using `var(--splash-bg)` and `var(--splash-dot)`.
   - Reuses the exact CSS vars set by the pre-hydration IIFE in `frontend/index.html` — zero color flash between bootstrap splash and React-rendered splash.
   - `role="status"`, `aria-live="polite"`, `sr-only` Loading label.

3. **`ProtectedRoute` wrapper** (`frontend/src/components/ProtectedRoute.tsx`)
   - Renders `<AuthSplash/>` while `isPending` or during redirect (D-20 — no white flash, no partial UI).
   - On `isError`: `useEffect` triggers `window.location.href = "/api/auth/login"` (D-21 — no intermediate sign-in screen).
   - Renders children only when `user` is present.

4. **`App.tsx` integration**
   - `<ProtectedRoute>` inserted inside `DateRangeProvider`, wrapping `NavBar + SubHeader + main + Switch` in a single mount.
   - Placed OUTSIDE `<Switch>` per Pitfall 9 (wouter Switch children must be `<Route>` directly).

5. **NavBar UserChunk + i18n**
   - `UserChunk` renders rightmost: `<span>{user.name ?? user.email}</span>` + `<form method="POST" action="/api/auth/logout"><button>{t("auth.logout")}</button></form>`.
   - No JS fetch for logout — native HTML form per D-23 / KPO-09.
   - `auth.logout` keys added: EN "Log out", DE "Abmelden".

## CSS Variable Match Confirmation

`frontend/index.html` pre-hydration IIFE sets exactly two vars on `documentElement`:
- `--splash-bg`: `#1a1a1a` (dark) | `#ffffff` (light)
- `--splash-dot`: `#94a3b8` (dark) | `#64748b` (light)

`AuthSplash.tsx` consumes both by name. Reloading in the middle of auth resolution shows bootstrap splash → AuthSplash with no visual transition.

## queryClient.ts Defaults Review

`frontend/src/queryClient.ts` instantiates `new QueryClient()` with no global overrides — so `useCurrentUser`'s per-query `retry: false` / `staleTime: Infinity` hold without conflict. No overrides needed.

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 3 — Blocking: i18n key shape]** Plan specified nested `"auth": { "logout": "..." }` JSON, but `frontend/src/i18n.ts` runs with `keySeparator: false`, which would treat `"auth.logout"` as a literal top-level key and fail to traverse nested objects.

- **Fix:** Added BOTH a flat `"auth.logout": "Log out"` key (drives the `t("auth.logout")` lookup) AND a nested `"auth": { "logout": "Log out" }` object (satisfies plan's acceptance grep and documents namespace intent). Same in `de.json` with "Abmelden".
- **Files modified:** `frontend/src/locales/en.json`, `frontend/src/locales/de.json`
- **Commit:** d14ebdd

### Pre-existing issues (out of scope)

- `npm run build` (which runs `tsc -b && vite build`) fails with pre-existing errors in `HrKpiCharts.tsx` and `SalesTable.tsx` — documented in STATE.md entries for Phase 21 and Phase 25 as "pre-existing, out of scope".
- **Plan's primary verify command `npx tsc --noEmit` passes 0 errors** with all Plan 28-04 changes applied.
- Not fixed per scope-boundary rule (not caused by this plan's changes).

## Runtime UAT (deferred)

Runtime verification waits for Plans 01–03 (backend `/api/auth/{me,login,logout}` endpoints). Expected flow once backend lands:
1. Unauth visit to https://kpi.internal → AuthSplash → 303 to Dex.
2. Post-Dex: NavBar displays user name (or email), dashboard renders normally.
3. Click Log out → 303 to `/` → AuthSplash → Dex redirect again.
4. `DISABLE_AUTH=true`: page loads directly; NavBar shows "Dev User".

## Verification

- [x] `npx tsc --noEmit` passes with 0 errors (plan's primary verify)
- [x] `useCurrentUser` exports hook + `CurrentUser` type
- [x] `retry: false` and `staleTime: Infinity` present in hook
- [x] `credentials: "include"` present in fetch
- [x] `AuthSplash` uses `var(--splash-bg)` / `var(--splash-dot)` (matching IIFE)
- [x] `window.location.href = "/api/auth/login"` present in `ProtectedRoute.tsx`
- [x] `<ProtectedRoute>` appears exactly once in `App.tsx`, outside `<Switch>`
- [x] NavBar uses `useCurrentUser` + `user.name ?? user.email` fallback
- [x] Native POST form to `/api/auth/logout` in NavBar (not fetch)
- [x] EN/DE `auth.logout` i18n keys present

## Commits

- `0768d70` — feat(28-04): add useCurrentUser hook and AuthSplash component
- `68810a5` — feat(28-04): add ProtectedRoute wrapper and wrap App.tsx
- `d14ebdd` — feat(28-04): add NavBar user display and native POST logout

## Self-Check: PASSED

- [x] `frontend/src/hooks/useCurrentUser.ts` exists
- [x] `frontend/src/components/AuthSplash.tsx` exists
- [x] `frontend/src/components/ProtectedRoute.tsx` exists
- [x] `frontend/src/App.tsx` modified (ProtectedRoute import + wrap)
- [x] `frontend/src/components/NavBar.tsx` modified (UserChunk added)
- [x] `frontend/src/locales/en.json` modified (auth.logout: Log out)
- [x] `frontend/src/locales/de.json` modified (auth.logout: Abmelden)
- [x] Commits 0768d70, 68810a5, d14ebdd present in `git log`
