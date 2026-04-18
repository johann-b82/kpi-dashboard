---
phase: 29-frontend-login-role-aware-ui
plan: 02
type: execute
wave: 2
depends_on: ["29-01"]
files_modified:
  - frontend/package.json
  - frontend/src/lib/directusClient.ts
  - frontend/src/lib/apiClient.ts
  - frontend/src/auth/AuthContext.tsx
  - frontend/src/auth/useAuth.ts
  - frontend/src/auth/AdminOnly.tsx
  - frontend/src/auth/AuthGate.tsx
  - frontend/src/auth/FullPageSpinner.tsx
  - frontend/src/components/ui/form.tsx
autonomous: true
requirements: [AUTH-03, RBAC-03]
must_haves:
  truths:
    - "apiClient.ts exports an apiClient() wrapper that attaches Authorization: Bearer <token> when a token is set"
    - "AuthContext provides { user, role, signIn, signOut, isLoading } to descendants"
    - "useRole() returns 'admin' | 'viewer' | null"
    - "<AdminOnly> renders null when role !== 'admin'"
    - "<AuthGate> redirects to /login when unauthed and not already there; redirects to / when authed and at /login"
    - "apiClient handles 401 with one silent refresh, then retries; failure clears auth + redirects"
    - "@directus/sdk, react-hook-form, @hookform/resolvers, zod present in package.json"
    - "shadcn form primitive installed at components/ui/form.tsx"
  artifacts:
    - path: "frontend/src/lib/directusClient.ts"
      provides: "Singleton @directus/sdk client in cookie mode"
      contains: "createDirectus"
    - path: "frontend/src/lib/apiClient.ts"
      provides: "apiClient<T>(path, init), setAccessToken, getAccessToken, trySilentRefresh"
      contains: "Authorization"
    - path: "frontend/src/auth/AuthContext.tsx"
      provides: "AuthProvider + AuthContext (user, role, token, signIn, signOut, isLoading)"
      contains: "createContext"
    - path: "frontend/src/auth/useAuth.ts"
      provides: "useAuth(), useRole() hooks"
      contains: "useContext"
    - path: "frontend/src/auth/AdminOnly.tsx"
      provides: "<AdminOnly> wrapper, renders null for Viewer"
      contains: "AdminOnly"
    - path: "frontend/src/auth/AuthGate.tsx"
      provides: "<AuthGate> route guard using wouter"
      contains: "useLocation"
    - path: "frontend/src/auth/FullPageSpinner.tsx"
      provides: "Full-screen Loader2 spinner for isLoading"
      contains: "Loader2"
    - path: "frontend/src/components/ui/form.tsx"
      provides: "shadcn Form primitive (react-hook-form wrapper)"
      contains: "FormField"
  key_links:
    - from: "AuthContext.tsx"
      to: "apiClient.ts"
      via: "setAccessToken(token) called after login/refresh/logout"
      pattern: "setAccessToken"
    - from: "apiClient.ts"
      to: "directusClient.ts"
      via: "trySilentRefresh() calls directus.refresh()"
      pattern: "directus\\.refresh"
    - from: "AuthContext.tsx"
      to: "/api/me"
      via: "apiClient('/api/me') after login/refresh to hydrate role"
      pattern: "/api/me"
---

<objective>
Install auth dependencies and build the reusable auth infrastructure: SDK singleton, apiClient wrapper, AuthContext/useAuth/useRole, AuthGate, AdminOnly, FullPageSpinner. No app wiring yet — that happens in Plan 03.

Purpose: Every downstream piece (LoginPage, migrated api.ts, NavBar sign-out, all admin-only gating) depends on these interfaces. Build and type-check them in isolation so Plan 03 can wire confidently.
Output: Installed deps + 8 new/modified files providing the auth contract surface.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/29-frontend-login-role-aware-ui/29-CONTEXT.md
@.planning/phases/29-frontend-login-role-aware-ui/29-UI-SPEC.md
@.planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md
@frontend/package.json
@frontend/src/App.tsx
@frontend/src/lib/api.ts

<interfaces>
<!-- Contracts this plan EXPORTS — Plan 03 consumes them. -->

From `frontend/src/lib/directusClient.ts`:
```ts
import { createDirectus, authentication, rest } from '@directus/sdk';
export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('cookie', { credentials: 'include' }))
  .with(rest({ credentials: 'include' }));
```

From `frontend/src/lib/apiClient.ts`:
```ts
export function setAccessToken(token: string | null): void;
export function getAccessToken(): string | null;
export async function apiClient<T>(path: string, init?: RequestInit): Promise<T>;
export async function trySilentRefresh(): Promise<boolean>;
```

From `frontend/src/auth/useAuth.ts`:
```ts
export type Role = 'admin' | 'viewer';
export interface AuthUser { id: string; email: string; role: Role; }
export interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>; // throws on failure
  signOut: () => Promise<void>;
}
export function useAuth(): AuthState;
export function useRole(): Role | null;
```

From `frontend/src/auth/AdminOnly.tsx`:
```ts
export function AdminOnly({ children }: { children: React.ReactNode }): JSX.Element | null;
```

From `frontend/src/auth/AuthGate.tsx`:
```ts
export function AuthGate({ children }: { children: React.ReactNode }): JSX.Element;
```

From FastAPI (Plan 01): `GET /api/me` → `{ id: string, email: string, role: 'admin' | 'viewer' }`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install deps + SDK client + apiClient wrapper</name>
  <files>frontend/package.json, frontend/src/lib/directusClient.ts, frontend/src/lib/apiClient.ts, frontend/src/components/ui/form.tsx</files>
  <read_first>
    - frontend/package.json (current deps, scripts — especially typecheck/build)
    - frontend/src/lib/api.ts (existing fetch patterns, error-shape `err.detail`)
    - .planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md lines 125-170 (module singleton pattern, concurrent 401 guard)
  </read_first>
  <action>
    Install (from `frontend/` dir):
    ```
    npm install @directus/sdk@21.2.2 react-hook-form @hookform/resolvers zod
    npx shadcn@latest add form
    ```
    (shadcn add will create `frontend/src/components/ui/form.tsx`.)

    Create `frontend/src/lib/directusClient.ts`:
    ```ts
    import { createDirectus, authentication, rest } from '@directus/sdk';

    const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL ?? 'http://localhost:8055';

    export const directus = createDirectus(DIRECTUS_URL)
      .with(authentication('cookie', { credentials: 'include' }))
      .with(rest({ credentials: 'include' }));
    ```

    Create `frontend/src/lib/apiClient.ts` implementing the module-singleton pattern from RESEARCH.md §"Pattern 1":
    - `let _accessToken: string | null = null;`
    - `setAccessToken(t)`, `getAccessToken()`
    - `apiClient<T>(path, init)`: attach `Authorization: Bearer ${_accessToken}` if token present. **FormData guard**: do NOT add `Content-Type: application/json` if `init.body instanceof FormData`. Merge caller-supplied headers.
    - On 401: call `trySilentRefresh()` — if true, retry once; if false, call `_onAuthFailure()` (module-level setter so AuthContext can plug in cleanup + redirect) and throw.
    - Non-401 non-ok: `throw new Error(body.detail ?? \`\${status} \${statusText}\`)` to preserve existing `err.detail` contract from api.ts.
    - **Concurrent 401 guard**: shared `_refreshPromise: Promise<boolean> | null`. First 401 starts the promise; others await the same one.
    - `trySilentRefresh()`: calls `directus.refresh()`, on success pulls `await directus.getToken()`, calls `setAccessToken(token)`, returns true. On throw: returns false.
    - Export: `setAuthFailureHandler(fn: () => void)` — AuthContext registers a cleanup-and-redirect callback here to avoid circular import.
  </action>
  <acceptance_criteria>
    - `grep -c '"@directus/sdk"' frontend/package.json` == 1
    - `grep -c '"react-hook-form"' frontend/package.json` == 1
    - `grep -c '"zod"' frontend/package.json` == 1
    - `test -f frontend/src/lib/directusClient.ts` passes
    - `test -f frontend/src/lib/apiClient.ts` passes
    - `test -f frontend/src/components/ui/form.tsx` passes
    - `grep -c "createDirectus" frontend/src/lib/directusClient.ts` == 1
    - `grep -c "Authorization" frontend/src/lib/apiClient.ts` >= 1
    - `grep -c "FormData" frontend/src/lib/apiClient.ts` >= 1
    - `grep -c "setAccessToken" frontend/src/lib/apiClient.ts` >= 2 (export + use)
    - `grep -c "trySilentRefresh" frontend/src/lib/apiClient.ts` >= 1
    - `cd frontend && npm run build` exits 0 (TS compiles)
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npm run build</automated>
  </verify>
  <done>Deps installed, SDK singleton + apiClient wrapper compile cleanly, shadcn form primitive present.</done>
</task>

<task type="auto">
  <name>Task 2: AuthContext + hooks + AuthGate + AdminOnly + FullPageSpinner</name>
  <files>frontend/src/auth/AuthContext.tsx, frontend/src/auth/useAuth.ts, frontend/src/auth/AdminOnly.tsx, frontend/src/auth/AuthGate.tsx, frontend/src/auth/FullPageSpinner.tsx</files>
  <read_first>
    - frontend/src/App.tsx (current provider nesting; do NOT modify in this task — Plan 03's job)
    - frontend/src/components/NavBar.tsx (wouter useLocation pattern for AuthGate reference)
    - .planning/phases/29-frontend-login-role-aware-ui/29-UI-SPEC.md §"Full-Page Spinner" (Loader2, h-8 w-8, text-muted-foreground, min-h-screen centered)
    - .planning/phases/29-frontend-login-role-aware-ui/29-CONTEXT.md §D-05 (AuthGate redirect logic)
  </read_first>
  <action>
    Create `frontend/src/auth/FullPageSpinner.tsx` per UI-SPEC:
    ```tsx
    import { Loader2 } from 'lucide-react';
    export function FullPageSpinner() {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    ```

    Create `frontend/src/auth/AuthContext.tsx`:
    - `AuthContext = createContext<AuthState | null>(null)`
    - `AuthProvider` holds state: `user, role, isLoading` (token only in module singleton, not React state — avoids re-renders).
    - On mount (`useEffect([], ...)`): call `trySilentRefresh()`; on success, `apiClient<{id,email,role}>('/api/me')` → `setUser({...})`; on failure, `setUser(null)`. Always `setIsLoading(false)`. Use a `mounted` ref to guard StrictMode double-effect.
    - `signIn(email, password)`:
      1. `await directus.login({ email, password })`
      2. `const token = await directus.getToken(); setAccessToken(token)`
      3. `const me = await apiClient<{id,email,role:'admin'|'viewer'}>('/api/me')`
      4. `setUser(me); setRole(me.role)`
      Throws on Directus error so LoginPage can show inline error.
    - `signOut()`:
      1. `try { await directus.logout() } catch {}` (network failure still clears locally — per D-07)
      2. `setAccessToken(null); setUser(null); setRole(null)`
      3. `queryClient.clear()` via `useQueryClient()`
      4. (Redirect handled by AuthGate reacting to `user === null`.)
    - In `useEffect`, register `setAuthFailureHandler(() => { setAccessToken(null); setUser(null); queryClient.clear(); })` so apiClient 401-path can trigger logout without circular import. The AuthGate's redirect-on-null handles navigation.

    Create `frontend/src/auth/useAuth.ts`:
    ```ts
    import { useContext } from 'react';
    import { AuthContext } from './AuthContext';
    export function useAuth() {
      const ctx = useContext(AuthContext);
      if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
      return ctx;
    }
    export function useRole() { return useAuth().role; }
    ```

    Create `frontend/src/auth/AdminOnly.tsx`:
    ```tsx
    import type { ReactNode } from 'react';
    import { useRole } from './useAuth';
    export function AdminOnly({ children }: { children: ReactNode }) {
      return useRole() === 'admin' ? <>{children}</> : null;
    }
    ```

    Create `frontend/src/auth/AuthGate.tsx` per D-05:
    ```tsx
    import { useEffect, type ReactNode } from 'react';
    import { useLocation } from 'wouter';
    import { useAuth } from './useAuth';
    import { FullPageSpinner } from './FullPageSpinner';
    export function AuthGate({ children }: { children: ReactNode }) {
      const { isLoading, user } = useAuth();
      const [location, setLocation] = useLocation();
      useEffect(() => {
        if (isLoading) return;
        if (!user && location !== '/login') setLocation('/login');
        else if (user && location === '/login') setLocation('/');
      }, [isLoading, user, location, setLocation]);
      if (isLoading) return <FullPageSpinner />;
      return <>{children}</>;
    }
    ```
  </action>
  <acceptance_criteria>
    - All 5 files exist under `frontend/src/auth/`
    - `grep -c "createContext" frontend/src/auth/AuthContext.tsx` == 1
    - `grep -c "directus.login" frontend/src/auth/AuthContext.tsx` >= 1
    - `grep -c "directus.logout" frontend/src/auth/AuthContext.tsx` >= 1
    - `grep -c "/api/me" frontend/src/auth/AuthContext.tsx` >= 1
    - `grep -c "queryClient.clear" frontend/src/auth/AuthContext.tsx` >= 1
    - `grep -c "setAuthFailureHandler" frontend/src/auth/AuthContext.tsx` >= 1
    - `grep -c "useLocation" frontend/src/auth/AuthGate.tsx` == 1
    - `grep -c "return null" frontend/src/auth/AdminOnly.tsx` >= 0 (ok if rendered via ternary)
    - `grep -E "admin'|role === 'admin'" frontend/src/auth/AdminOnly.tsx` matches
    - `grep -c "Loader2" frontend/src/auth/FullPageSpinner.tsx` == 1
    - `cd frontend && npm run build` exits 0 (full TS compile, no errors)
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npm run build</automated>
  </verify>
  <done>All auth infrastructure files compile; AuthContext correctly calls /api/me and clears queryClient on sign-out; AuthGate redirect logic per D-05 is implemented.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npm run build` — full TypeScript compile succeeds
2. `grep -rn "TODO\\|FIXME" frontend/src/auth/ frontend/src/lib/apiClient.ts frontend/src/lib/directusClient.ts` — no unresolved stubs
3. No consumer of these files yet (Plan 03 wires them) — isolation check: `grep -rn "from '@/auth\\|from './auth" frontend/src/ --include="*.tsx" --include="*.ts" | grep -v "frontend/src/auth/"` returns no matches yet (expected — wiring happens in Plan 03)
</verification>

<success_criteria>
- @directus/sdk and shadcn form installed
- apiClient wrapper handles Bearer attach, FormData, 401 with refresh-retry-or-fail, concurrent-refresh guard
- AuthContext exposes { user, role, isLoading, signIn, signOut } and hydrates role from /api/me
- useAuth, useRole, AdminOnly, AuthGate, FullPageSpinner compile and match interface contracts
- Zero TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/phases/29-frontend-login-role-aware-ui/29-02-SUMMARY.md`
</output>
