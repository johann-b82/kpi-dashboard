---
phase: 29
phase_name: frontend-login-role-aware-ui
milestone: v1.11-directus
status: ready-for-plan
created: 2026-04-15
---

# Phase 29 Context — Frontend Login + Role-Aware UI

**Goal:** Browser login page, `@directus/sdk`-managed session with silent refresh, bearer token on every `/api/*` call via a shared `apiClient` wrapper, admin-only UI hidden (not disabled) for Viewers, clean sign-out.

**Requirements:** AUTH-02, AUTH-03, AUTH-06, RBAC-03

## Scouted state (relevant facts from existing code)

- Router: **wouter** (`wouter: ^3.9.0`) — not React Router. Route/Switch from wouter.
- Current API layer: **plain `fetch()`** in `frontend/src/lib/api.ts`. No axios, no interceptor pattern.
- `@directus/sdk` **not yet installed** — will be added in this phase.
- Existing providers wrap the app in `App.tsx`: `ThemeProvider`, `QueryClientProvider`, `SettingsDraftProvider`, `DateRangeProvider`, `Toaster` (sonner).
- Routes: `/`, `/upload`, `/hr`, `/settings`.
- Nav: `NavBar` component (Phase 5).

## Locked decisions (from milestone / prior phases / this discussion)

### D-01 — Auth library: `@directus/sdk`

Add `@directus/sdk` to `frontend/package.json`. Use:

```ts
import { createDirectus, authentication, rest } from '@directus/sdk';

const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('cookie', { credentials: 'include' }))
  .with(rest());
```

The SDK handles `login()`, `logout()`, `refresh()`, access-token retrieval, and auto-refresh timer. Rejected hand-rolled fetch — reinvents the SDK.

### D-02 — Token storage: in-memory (access) + httpOnly cookie (refresh)

- **Access token:** React state only (inside `AuthContext`). Never written to `localStorage` or `sessionStorage`.
- **Refresh token:** httpOnly cookie set by Directus (mode `'cookie'`). Not accessible to JS → XSS-resistant.
- **App boot:** call `directus.refresh()` silently. If it succeeds → we have a session. If it fails → redirect to `/login`.

Requires Directus CORS to allow credentials and `AUTH_DISABLE_ACCOUNT_DELETE` etc. remain defaults. Frontend fetch calls to Directus must use `credentials: 'include'`.

### D-03 — `apiClient` helper (single source of truth)

Create `frontend/src/lib/apiClient.ts` wrapping fetch:

```ts
export async function apiClient<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getAccessToken(); // from AuthContext
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    // try one silent refresh then retry; if still 401, redirect /login
    if (await trySilentRefresh()) return apiClient<T>(path, init);
    redirectToLogin();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}
```

Replace every bare `fetch("/api/...")` in `frontend/src/lib/api.ts` with `apiClient(...)`. Planner must inventory and migrate all call sites.

Rejected: axios (too much churn), global `fetch` monkey-patch (hidden, untestable).

### D-04 — Role gating: `useRole()` hook + `<AdminOnly>` wrapper

```tsx
// frontend/src/auth/useAuth.tsx
export function useAuth() { /* returns { user, role, signIn, signOut, isLoading } */ }
export function useRole() { return useAuth().role; } // 'admin' | 'viewer' | null

// frontend/src/auth/AdminOnly.tsx
export function AdminOnly({ children }: { children: ReactNode }) {
  return useRole() === 'admin' ? <>{children}</> : null;
}
```

Usage:

```tsx
<AdminOnly><Button onClick={save}>Save</Button></AdminOnly>
```

Inline `if (role === 'admin')` allowed where JSX wrap is awkward. Rejected route-only guards — criterion 4 requires in-page hiding.

### D-05 — Route gating: top-level `<AuthGate>`

```tsx
// frontend/src/auth/AuthGate.tsx
function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  const [location, setLocation] = useLocation(); // wouter
  useEffect(() => {
    if (!isLoading && !user && location !== '/login') setLocation('/login');
    if (!isLoading && user && location === '/login') setLocation('/');
  }, [isLoading, user, location]);
  if (isLoading) return <FullPageSpinner />;
  return <>{children}</>;
}
```

Wrap the `<Switch>` in `App.tsx` with `<AuthGate>`. `/login` rendered when unauthed, normal routes when authed.

### D-06 — Login page: centered-card with shadcn Form

`frontend/src/pages/LoginPage.tsx` — vertical layout on neutral background:

- Brand logo (reuse existing asset from NavBar)
- `<h1>` "Sign in"
- shadcn `<Form>` with email + password inputs (`<Input type="email">`, `<Input type="password">`)
- Submit `<Button>` — "Sign in"
- Inline error text below form on failure (not toast). Exact copy: `"Invalid email or password"` — never reveals which field.

Matches dashboard aesthetic (Phase 5/25: dark-mode-aware neutrals, shadcn primitives, Tailwind v4).

### D-07 — Sign-out: call Directus `/auth/logout` server-side

Sign-out flow:
1. `await directus.logout()` — Directus revokes refresh token server-side.
2. Clear `AuthContext` state (access token, user, role).
3. Redirect to `/login` via `setLocation('/login')`.
4. If the logout HTTP call fails (network), still clear local state and redirect — don't block user from signing out.

Criterion 5 enforcement: on next page refresh, `directus.refresh()` fails (refresh token revoked) → `AuthGate` redirects to `/login`. Next `/api/*` call from stale state → 401 (no token).

### D-08 — Admin-only UI surfaces to hide from Viewers

Per user confirmation, wrap each of these with `<AdminOnly>`:

1. **Upload page nav link** in `NavBar` + the upload page CTA buttons
2. **Personio sync trigger** button (on HR page / settings)
3. **Settings page Save button** + destructive controls (inputs may remain visible as read-only feel; mutation controls hidden)
4. **Delete controls** — any trash/delete icon on upload batch rows, etc.

Viewer accessing `/upload` directly by URL: shown a "You don't have permission" message (or `<AdminOnly>` wrapping the whole page content). Route itself remains mounted — no URL-level redirect for these (Viewer can still see Dashboard, HR, Settings).

### D-09 — 401 handling policy

In `apiClient`: on 401, attempt **one** silent refresh. If refresh succeeds, retry original request. If refresh fails, clear auth state and redirect to `/login`. Never loop indefinitely. No toast on 401 (route change communicates it).

## Claude's Discretion

- Exact directory layout for auth code (e.g., `frontend/src/auth/{AuthContext,AuthGate,AdminOnly,useAuth}.tsx`) — planner picks.
- Full-page spinner component for `isLoading` state — any simple shadcn-compatible spinner.
- Whether `AuthContext` provider lives above or below `QueryClientProvider` (likely above — queries need `apiClient` which needs auth).
- How `apiClient` accesses the current access token without creating a circular import (module singleton + setter, or exported hook).
- Whether to add a "Session expired, please sign in again" toast on forced logout vs silent redirect.

## Deferred Ideas

- **"Remember me" checkbox / extended session** — out of scope; Directus defaults apply.
- **Social/OIDC login** — not in milestone v1.11.
- **Role badge / user avatar in NavBar** — could be part of Phase 29 polish but planner may defer.
- **Session-expiry warning modal** — too elaborate for internal tool.
- **Per-resource permissions (e.g., "my uploads")** — not in scope.
- **Login page i18n** — follow existing i18n conventions if Phase 7 provides them; otherwise English-only for now.

## Scope Guardrail

Phase 29 only wires frontend auth on top of the existing backend (Phases 27–28). It does NOT:
- Modify backend endpoints.
- Change Directus configuration beyond enabling cookie-mode auth if not already.
- Introduce new routes beyond `/login`.
- Redesign the existing dashboard layout.
