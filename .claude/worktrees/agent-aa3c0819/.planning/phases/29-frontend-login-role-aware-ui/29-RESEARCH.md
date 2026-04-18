# Phase 29: Frontend Login + Role-Aware UI — Research

**Researched:** 2026-04-15
**Domain:** React 19 + @directus/sdk cookie-mode auth, wouter routing, TanStack Query integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Auth library: `@directus/sdk`. Chain: `createDirectus(URL).with(authentication('cookie', { credentials: 'include' })).with(rest())`. Rejected hand-rolled fetch.
- **D-02** — Token storage: access token in React state (AuthContext) only. Refresh token in httpOnly cookie (set by Directus, mode `'cookie'`). Boot: call `directus.refresh()` silently; success = session, failure = redirect to `/login`.
- **D-03** — `apiClient` helper at `frontend/src/lib/apiClient.ts` wraps every bare `fetch("/api/...")`. All call sites in `api.ts` migrated. 401 → one silent refresh → retry → else redirect.
- **D-04** — Role gating: `useRole()` hook + `<AdminOnly>` wrapper component. Renders `null` for Viewer.
- **D-05** — Route gating: `<AuthGate>` wraps the `<Switch>` in `App.tsx`. Uses `useLocation()` from wouter.
- **D-06** — Login page: centered-card with shadcn Form. Error copy locked: `"Invalid email or password"`. Never reveals which field.
- **D-07** — Sign-out: `await directus.logout()` → clear AuthContext state → redirect to `/login`. Network failure still clears local state.
- **D-08** — Admin-only UI surfaces: Upload nav link, DropZone CTA buttons, Personio sync button, Settings ActionBar Save+Reset controls, Trash icon on upload history rows.
- **D-09** — 401 policy: one silent refresh, retry. If still 401, clear auth state, redirect to `/login`. No toast on 401.

### Claude's Discretion

- Exact directory layout for auth code (e.g., `frontend/src/auth/{AuthContext,AuthGate,AdminOnly,useAuth}.tsx`)
- Full-page spinner component for `isLoading` state
- Whether `AuthContext` provider lives above or below `QueryClientProvider`
- How `apiClient` accesses the current access token without circular import
- Whether to add "Session expired" toast on forced logout vs silent redirect

### Deferred Ideas (OUT OF SCOPE)

- "Remember me" / extended session
- Social/OIDC login
- Role badge / user avatar in NavBar
- Session-expiry warning modal
- Per-resource permissions
- Login page i18n
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-02 | User can sign in via web UI with email/password; invalid credentials show inline error and do not grant a session | LoginPage.tsx with shadcn Form, directus.login(), error state |
| AUTH-03 | Frontend persists Directus session via @directus/sdk, auto-refreshing access token before expiry | directus.refresh() on boot + SDK auto-refresh timer |
| AUTH-06 | User can sign out; session is cleared and subsequent API calls return 401 | directus.logout() → clear AuthContext → redirect; apiClient sends no token |
| RBAC-03 | Frontend hides admin-only UI actions when useAuth().role === 'Viewer' | AdminOnly component, role resolved from JWT role UUID via directus.getToken() + readMe() |
</phase_requirements>

---

## Summary

Phase 29 wires a complete frontend auth layer on top of the existing Directus + FastAPI backend (Phases 26–28). The primary challenge is the token-access problem: `apiClient` needs the current access token without creating a circular import between `apiClient.ts` and `AuthContext.tsx`. The clean solution is a module-level singleton in `apiClient.ts` that exports a `setAccessToken(token)` setter; `AuthContext` calls this setter whenever the token changes. This avoids React hooks inside a plain async function and avoids circular deps.

The Directus SDK v21 (current npm) supports `directus.getToken()` to retrieve the in-memory access token, but since the SDK stores state independently from React, the most reliable pattern is: after `directus.login()` or `directus.refresh()`, call `await directus.getToken()` and store the result in React state (AuthContext) AND in the module singleton. The role is not in the `@directus/sdk` response — it comes from `GET /users/me` via `readMe()` SDK composable, which returns `{ role: UUID }`. The role UUID must be compared against the env vars `DIRECTUS_ADMINISTRATOR_ROLE_UUID` and `DIRECTUS_VIEWER_ROLE_UUID`. However, the frontend does NOT have access to these env vars. The cleaner approach: use a protected FastAPI endpoint `GET /api/me` (already exists as `current_user` dep) to resolve the role string (`admin`/`viewer`) from the verified JWT — the frontend calls this after login/refresh to hydrate role state.

**CORS CRITICAL:** The current `docker-compose.yml` sets `CORS_ENABLED: "false"` on Directus. This MUST change to `CORS_ENABLED: "true"` with `CORS_ORIGIN: "http://localhost:5173"` (and `CORS_CREDENTIALS: "true"`) for the httpOnly refresh-token cookie to flow between the browser and Directus at port 8055. Without this, `directus.refresh()` on the frontend origin will be blocked.

**Primary recommendation:** AuthContext calls `directus.login()` / `directus.refresh()`, then calls `GET /api/me` (FastAPI) to get the role string, stores both token and role in React state. `apiClient` reads token from a module singleton set by AuthContext. This cleanly separates Directus SDK from FastAPI role resolution.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @directus/sdk | 21.2.2 (current npm) | Login/logout/refresh, cookie-mode session | Locked in D-01. Handles httpOnly cookie refresh automatically. |
| react-hook-form | NOT installed yet | Form validation for LoginPage | Required by shadcn `<Form>` primitive (shadcn Form wraps react-hook-form) |
| @hookform/resolvers | NOT installed yet | Zod/yup resolver for react-hook-form | Required by shadcn Form pattern |
| zod | NOT installed yet | Schema validation for login form | Paired with react-hook-form + shadcn Form |
| wouter | ^3.9.0 (already installed) | Routing + programmatic redirect | Already in use. `useLocation()` returns `[location, setLocation]`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | ^5.97.0 (already installed) | Cache invalidation on sign-out | `queryClient.clear()` on signOut to drop all cached data |
| lucide-react | ^1.8.0 (already installed) | LogOut icon, Loader2 spinner | Already used in NavBar |
| shadcn `form` primitive | copy-paste (new in this phase) | Login form with validation UX | Only new shadcn component needed |

**Installation:**
```bash
cd frontend
npm install @directus/sdk react-hook-form @hookform/resolvers zod
npx shadcn@latest add form
```

**Version verification (as of 2026-04-15):**
- `@directus/sdk`: 21.2.2 (verified npm view)
- `react-hook-form`: verify with `npm view react-hook-form version` before writing package.json
- `zod`: already a transitive dep in many shadcn setups — check if already present first

---

## Architecture Patterns

### Recommended Directory Layout

```
frontend/src/
├── auth/
│   ├── AuthContext.tsx      # createContext, AuthProvider, token + role state
│   ├── useAuth.ts           # useContext(AuthContext) + useRole() hook
│   ├── AuthGate.tsx         # <AuthGate> wrapping <Switch> — redirect logic
│   └── AdminOnly.tsx        # <AdminOnly> component — renders null for Viewer
├── lib/
│   ├── api.ts               # existing — all fetch calls migrated to apiClient
│   ├── apiClient.ts         # NEW — fetch wrapper with Bearer token + 401 handler
│   └── directusClient.ts    # NEW — singleton directus SDK instance
├── pages/
│   └── LoginPage.tsx        # NEW — /login route
└── App.tsx                  # Updated — AuthProvider + AuthGate + /login route
```

### Pattern 1: Module Singleton for Token (avoids circular import)

The key architectural challenge: `apiClient.ts` is a plain module (not a React component), so it cannot call `useAuth()`. The solution is a module-level variable with a setter that `AuthContext` calls whenever the token changes.

```typescript
// frontend/src/lib/apiClient.ts
let _accessToken: string | null = null;

/** Called by AuthContext whenever the token changes (login/refresh/logout). */
export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export async function apiClient<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = _accessToken;
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    const refreshed = await trySilentRefresh(); // calls directus.refresh()
    if (refreshed) return apiClient<T>(path, init);
    clearAuthAndRedirect();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
```

`AuthContext.tsx` imports `setAccessToken` from `apiClient.ts`. `apiClient.ts` imports `directusClient` from `directusClient.ts`. No circular dependency.

### Pattern 2: Directus SDK Singleton

```typescript
// frontend/src/lib/directusClient.ts
import { createDirectus, authentication, rest } from '@directus/sdk';

const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL ?? 'http://localhost:8055';

export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('cookie', { credentials: 'include' }))
  .with(rest({ credentials: 'include' }));
```

`VITE_DIRECTUS_URL` must be added to the Vite config/env. In dev: `http://localhost:8055`. In prod: whatever the operator sets.

### Pattern 3: AuthContext with Role Resolution

```typescript
// frontend/src/auth/AuthContext.tsx
// After login or refresh:
//   1. directus.login({ email, password })  OR  directus.refresh()
//   2. const token = await directus.getToken()
//   3. setAccessToken(token)                 // module singleton
//   4. const me = await apiClient('/api/me') // FastAPI resolves role from JWT
//   5. setState({ user: me, role: me.role, isLoading: false })
```

The FastAPI `GET /api/me` endpoint must exist (or the existing `current_user` dep must be exposed). Check if Phase 27/28 already added it — if not, this phase needs to add a trivial endpoint.

### Pattern 4: wouter Programmatic Redirect

```typescript
// wouter v3 pattern (already in NavBar.tsx and SettingsPage.tsx):
import { useLocation } from 'wouter';
const [location, setLocation] = useLocation();
setLocation('/login'); // navigate programmatically
```

In `AuthGate.tsx` (outside React render, e.g., from `apiClient.ts`), wouter does NOT work. For `clearAuthAndRedirect()` called from `apiClient.ts`, use:
```typescript
window.location.href = '/login'; // fallback for non-React context
```
Or: export a `redirectToLogin` function from `AuthContext` and import it. The module singleton approach is simpler: `apiClient.ts` does `window.location.href = '/login'` on auth failure — acceptable for an internal tool.

### Pattern 5: AuthProvider Placement in App.tsx

`AuthProvider` MUST wrap `QueryClientProvider` OR be inside it. Since `AuthContext` uses `apiClient` (which doesn't use TanStack Query), either order is fine. However, on sign-out, `queryClient.clear()` must be called — and `AuthContext` needs access to `queryClient`. **Recommended:** Place `AuthProvider` inside `QueryClientProvider` so it can call `useQueryClient()`.

```tsx
// App.tsx updated structure:
<QueryClientProvider client={queryClient}>
  <AuthProvider>          {/* inside QueryClientProvider — can call useQueryClient() */}
    <ThemeProvider>
      <SettingsDraftProvider>
        <DateRangeProvider>
          <AuthGate>      {/* wraps Switch, handles redirect logic */}
            <NavBar />
            <SubHeader />
            <main className="pt-28">
              <Switch>
                <Route path="/login" component={LoginPage} />
                <Route path="/" component={DashboardPage} />
                <Route path="/upload" component={UploadPage} />
                <Route path="/hr" component={HRPage} />
                <Route path="/settings" component={SettingsPage} />
              </Switch>
            </main>
          </AuthGate>
        </DateRangeProvider>
      </SettingsDraftProvider>
    </ThemeProvider>
  </AuthProvider>
  <Toaster position="top-right" />
</QueryClientProvider>
```

NavBar and SubHeader are inside AuthGate — they only render when auth is resolved (or on /login where AuthGate shows the route directly).

### Anti-Patterns to Avoid

- **Token in localStorage/sessionStorage:** XSS risk. Access token stays in React state only (D-02).
- **Circular import:** `AuthContext` importing from `apiClient` which imports `AuthContext`. Broken by module singleton pattern.
- **Monkey-patching global fetch:** Rejected in D-03. Hidden side effects, untestable.
- **Infinite refresh loop:** `apiClient` must track "refresh in progress" to prevent concurrent 401s each triggering a refresh. Use a shared promise: if a refresh is already running, await the same promise rather than starting a second.
- **React.StrictMode double-effect on boot:** `useEffect(() => { directus.refresh() }, [])` runs twice in StrictMode (dev only). The SDK is stateless enough that a double-refresh is harmless but add a `mounted` ref guard to prevent double state updates.
- **queryClient.invalidateQueries on signout (WRONG):** Use `queryClient.clear()` — invalidation refetches queries, clear discards them. On sign-out, we don't want stale data refetched.

---

## Fetch Call Site Inventory (exhaustive)

All `fetch()` calls to migrate from `api.ts` to `apiClient`. Every call site is in `frontend/src/lib/api.ts`.

| # | Function | Method | Path | Line (approx) | Notes |
|---|----------|--------|------|---------------|-------|
| 1 | `uploadFile` | POST | `/api/upload` | 28 | FormData body — no `Content-Type` header (browser sets multipart boundary) |
| 2 | `getUploads` | GET | `/api/uploads` | 37 | Simple GET |
| 3 | `deleteUpload` | DELETE | `/api/uploads/${id}` | 43 | Admin-only (RBAC-02) |
| 4 | `fetchKpiSummary` | GET | `/api/kpis?...` | 113 | Query params from PrevBounds |
| 5 | `fetchChartData` | GET | `/api/kpis/chart?...` | 134 | Multiple query params |
| 6 | `fetchLatestUpload` | GET | `/api/kpis/latest-upload` | 139 | Simple GET |
| 7 | `fetchSettings` | GET | `/api/settings` | 169 | Called by ThemeProvider on boot — must work before auth hydration IF settings is public. Currently not protected by auth. See pitfall below. |
| 8 | `updateSettings` | PUT | `/api/settings` | 211 | Admin-only. Has `Content-Type: application/json` header |
| 9 | `uploadLogo` | POST | `/api/settings/logo` | 251 | FormData body |
| 10 | `fetchPersonioOptions` | GET | `/api/settings/personio-options` | 289 | GET |
| 11 | `testPersonioConnection` | POST | `/api/sync/test` | 300 | Admin-only |
| 12 | `fetchSyncMeta` | GET | `/api/sync/meta` | 319 | GET |
| 13 | `triggerSync` | POST | `/api/sync` | 332 | Admin-only |
| 14 | `fetchHrKpis` | GET | `/api/hr/kpis` | 361 | GET |
| 15 | `fetchHrKpiHistory` | GET | `/api/hr/kpis/history` | 374 | GET |
| 16 | `fetchSalesRecords` | GET | `/api/data/sales?...` | 408 | GET |
| 17 | `fetchEmployees` | GET | `/api/data/employees?...` | 437 | GET |

**Total: 17 fetch call sites.** All are in `frontend/src/lib/api.ts`. No bare `fetch` found elsewhere in `frontend/src/`.

**Migration strategy:** Replace each `fetch(path, init)` with `apiClient<ReturnType>(path, init)`. The `apiClient` function handles the token header injection and 401 handling. Error handling in each function (`if (!res.ok) throw`) moves into `apiClient` itself — **verify the existing error shape is preserved** since callers read `err.detail`.

**Special case — `uploadFile` and `uploadLogo`:** FormData bodies must NOT include a `Content-Type` header (browser sets multipart boundary automatically). `apiClient` must NOT add `Content-Type: application/json` when `body` is a `FormData` instance. Add a guard: `if (!(init.body instanceof FormData)) { /* add json header */ }`.

**Special case — `updateSettings`:** Already sets `Content-Type: application/json` in `init.headers`. `apiClient` must merge headers correctly without overriding this — the spread `...(init.headers ?? {})` handles it.

---

## Admin-Only UI Surface Inventory (exhaustive)

All surfaces that must be wrapped with `<AdminOnly>` per D-08.

| # | Component File | Element | Type | Wrap Level |
|---|---------------|---------|------|------------|
| 1 | `frontend/src/components/NavBar.tsx` | `<Link href="/upload">` with `<UploadIcon>` (lines 99–105) | Upload nav icon | Wrap the `<Link>` element |
| 2 | `frontend/src/components/DropZone.tsx` | `<Button>` "Browse" CTA (line 111–116) | File select button | Wrap the `<Button>`. Also: disable the drop zone itself for Viewers — pass `disabled` prop |
| 3 | `frontend/src/components/DropZone.tsx` | The entire `<Card>` content / dropzone area | Drop interaction | Consider wrapping entire `<DropZone>` at `UploadPage.tsx` level |
| 4 | `frontend/src/pages/UploadPage.tsx` | Entire page content | Viewer URL-direct access | Wrap entire page body with `<AdminOnly>` fallback message |
| 5 | `frontend/src/components/settings/PersonioCard.tsx` | Sync trigger `<button>` (lines 179–205) | Personio sync | Wrap the sync button `<button>` only (not the whole card — read-only inputs visible to Viewers) |
| 6 | `frontend/src/components/settings/ActionBar.tsx` | Save `<Button>` (lines 62–70) | Settings save | Wrap the save Button |
| 7 | `frontend/src/components/settings/ActionBar.tsx` | Reset `<Button>` (lines 53–60) | Settings reset/destructive | Wrap the reset Button |
| 8 | `frontend/src/components/settings/ActionBar.tsx` | Discard `<Button>` (lines 43–51, conditional on `isDirty`) | Settings discard | Wrap — though Viewer can't dirty settings, belt-and-suspenders |
| 9 | `frontend/src/components/UploadHistory.tsx` | Trash icon `<Button>` per table row (lines 115–123) | Delete upload batch | Wrap each trash `<Button>` in the `map()` |

**Notes on table column width:** The table in `UploadHistory.tsx` has a column for the Trash button. For Viewers, `<AdminOnly>` renders `null` — the column cell will be empty. This is acceptable (the column slot remains in the DOM). If the layout breaks, wrap the `<TableCell>` instead of just the `<Button>`.

**ActionBar specifics:** The ActionBar renders at the page level in `SettingsPage.tsx` (line 277). The cleanest approach is to pass `isAdmin` as a prop to `ActionBar` and conditionally render all three buttons, OR wrap the entire `ActionBar` with `<AdminOnly>`. The CONTEXT.md says "inputs may remain visible as read-only feel; mutation controls hidden" — so only the ActionBar buttons are hidden, not the whole settings page.

---

## Directus SDK v21 Cookie-Mode API

**Confidence: HIGH** (verified against npm registry v21.2.2 + official docs)

### Setup

```typescript
import { createDirectus, authentication, rest } from '@directus/sdk';

const directus = createDirectus('http://localhost:8055')
  .with(authentication('cookie', { credentials: 'include' }))
  .with(rest({ credentials: 'include' }));
```

The `credentials: 'include'` on both `authentication()` and `rest()` ensures cookies flow on all requests to Directus.

### Key Methods

| Method | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `directus.login` | `login({ email, password })` | `Promise<AuthenticationData>` | Sets httpOnly cookie, stores access token in SDK memory |
| `directus.logout` | `logout()` | `Promise<void>` | Revokes refresh token server-side. Cookie is cleared by Directus response. |
| `directus.refresh` | `refresh()` | `Promise<AuthenticationData>` | Uses httpOnly cookie. Throws if cookie invalid/expired. |
| `directus.getToken` | `getToken()` | `Promise<string \| null>` | Returns current access token from SDK memory. Call after login/refresh. |

### AuthenticationData shape (returned by login/refresh)

```typescript
{
  access_token: string;
  refresh_token: string | null; // null in cookie mode (token is in cookie, not JSON)
  expires: number;              // milliseconds until expiry
  expires_at: number;           // Unix ms timestamp
}
```

### Getting Current User Role

The Directus SDK `readMe()` composable fetches `GET /users/me` and returns the user object including `role` (UUID string). However, the frontend does NOT know which UUID maps to "admin" vs "viewer" without the env vars. **Recommended approach:** call `GET /api/me` (FastAPI) instead. FastAPI's `current_user` dependency resolves the role to `"admin"` or `"viewer"` string from the JWT claim. This is the clean single source of truth.

**Check if `GET /api/me` exists:** Phase 27/28 implemented `get_current_user` as a FastAPI dependency but may not have exposed it as a route. If missing, add:

```python
# backend/app/routes/auth.py (new file or added to existing)
@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    return {"id": str(current_user.id), "email": current_user.email, "role": current_user.role}
```

This is a trivial read endpoint (GET, both roles allowed).

---

## Directus Docker-Compose CORS Configuration Required

**CRITICAL FINDING:** Current `docker-compose.yml` has `CORS_ENABLED: "false"`. This BLOCKS the refresh-token cookie from being sent by the browser from `http://localhost:5173` to `http://localhost:8055` (cross-origin). The frontend cannot complete cookie-mode auth without CORS enabled.

**Required changes to `docker-compose.yml` Directus environment:**

```yaml
CORS_ENABLED: "true"
CORS_ORIGIN: "http://localhost:5173"   # frontend dev origin
CORS_CREDENTIALS: "true"               # allow credentials (cookies) cross-origin
```

For production, `CORS_ORIGIN` must match the actual frontend URL. `CORS_CREDENTIALS: "true"` is the critical flag — without it, browsers refuse to send cookies with cross-origin requests even if CORS is enabled.

**Note:** The Directus admin UI (`http://localhost:8055`) is loopback-only (`127.0.0.1:8055:8055` port binding). CORS only affects the browser's cross-origin requests — the sidecar bootstrap script and backend-to-backend calls are not affected by CORS.

**Confidence: HIGH** — CORS for credentials is a browser-enforced spec (RFC 6454, Fetch spec), not Directus-specific behavior.

---

## How Silent Refresh Works (D-02, D-09)

On app boot:
1. `AuthProvider` renders with `isLoading: true`.
2. `useEffect(() => { tryBoot() }, [])` calls `directus.refresh()`.
3. If success: extract token via `directus.getToken()`, call `GET /api/me` to get role, set state.
4. If failure (no cookie / expired): set `user: null`, `isLoading: false`.
5. `AuthGate` sees `!isLoading && !user` → `setLocation('/login')`.

On 401 from `apiClient`:
1. Call `directus.refresh()` once.
2. If success: update token singleton + AuthContext state, retry original request.
3. If failure: call `queryClient.clear()`, clear AuthContext state, `window.location.href = '/login'`.

**Concurrent 401 guard:** Multiple simultaneous API calls can all 401 at the same time. The refresh must happen exactly once. Pattern:

```typescript
// apiClient.ts
let _refreshPromise: Promise<boolean> | null = null;

async function trySilentRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      await directus.refresh();
      const token = await directus.getToken();
      setAccessToken(token);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}
```

---

## Common Pitfalls

### Pitfall 1: `fetchSettings` Called Before Auth Hydration

**What goes wrong:** `ThemeProvider` calls `fetchSettings` during app boot, before `AuthProvider` has hydrated the token. If `GET /api/settings` is a protected endpoint (requires Bearer), it will 401 on cold start.

**Why it happens:** The provider tree renders top-down. `ThemeProvider` is inside `AuthProvider` but `isLoading` gating in `AuthGate` doesn't prevent `ThemeProvider` from mounting and fetching.

**How to avoid:** Verify `GET /api/settings` allows unauthenticated access (RBAC-01 says "read endpoints return data for both Admin and Viewer" — but that assumes a Viewer token, not no token). If Phase 28 added auth to ALL `/api/*` routes, then `fetchSettings` must be deferred until after auth hydration. If `GET /api/settings` is intentionally public (reasonable for settings like app_name/logo), verify this is still true after Phase 28. If not, `ThemeProvider` must wait for `isLoading: false`.

**Warning signs:** ThemeProvider shows error state on every cold boot; settings fetch returns 401 before login.

### Pitfall 2: CORS Not Updated Before Testing

**What goes wrong:** `directus.refresh()` silently fails with a network error (not a 4xx) because the preflight OPTIONS request is rejected. `AuthGate` redirects to `/login`. Login form calls `directus.login()` — also fails. User is stuck.

**How to avoid:** Update `docker-compose.yml` CORS env vars BEFORE writing any auth code. Verify with `curl -v -H "Origin: http://localhost:5173" http://localhost:8055/auth/refresh` to confirm CORS headers in response.

### Pitfall 3: FormData + `apiClient` Content-Type Collision

**What goes wrong:** `apiClient` adds `Content-Type: application/json` to every request. When `uploadFile` or `uploadLogo` sends a `FormData` body, the `Content-Type` header overrides the browser's `multipart/form-data; boundary=...` — FastAPI cannot parse the file.

**How to avoid:** In `apiClient`, skip the `Content-Type: application/json` header when `init.body instanceof FormData`. The browser sets the correct multipart header automatically.

### Pitfall 4: Role UUID vs Role Name Mismatch

**What goes wrong:** The Directus JWT carries `role` as a UUID (e.g., `a2222222-bbbb-...`). If `AuthContext` tries to compare this to the string `"admin"` or `"viewer"` directly, it will always be `null` and every user appears unauthenticated.

**How to avoid:** Use `GET /api/me` (FastAPI) to get the role as `"admin"` or `"viewer"` string — FastAPI already maps UUIDs to role strings in `directus_auth.py`. Do NOT try to map UUIDs in the frontend.

### Pitfall 5: React StrictMode Double-Boot

**What goes wrong:** In development, React 18/19 StrictMode mounts effects twice. `directus.refresh()` fires twice on boot. The second call may race with the first, causing duplicate state updates or a spurious "session expired" redirect.

**How to avoid:** Use a `mountedRef` pattern:
```typescript
useEffect(() => {
  let mounted = true;
  directus.refresh().then(async () => {
    if (!mounted) return;
    const token = await directus.getToken();
    setAccessToken(token);
    // ... fetch /api/me, set state
  }).catch(() => {
    if (!mounted) return;
    setIsLoading(false);
  });
  return () => { mounted = false; };
}, []);
```

### Pitfall 6: `queryClient.clear()` vs `invalidateQueries()` on Sign-Out

**What goes wrong:** Calling `queryClient.invalidateQueries()` on sign-out triggers refetches of all cached queries. Since the user just signed out, these refetches hit the API with no token, returning 401s, and causing a waterfall of error states.

**How to avoid:** Call `queryClient.clear()` (removes all cached data without triggering refetches) before redirecting to `/login`. Do this AFTER clearing the access token singleton so any in-flight refetch triggered by cache invalidation doesn't get a token.

### Pitfall 7: `GET /api/me` Endpoint Missing

**What goes wrong:** Plan tasks assume `GET /api/me` exists. If Phase 27/28 only added `current_user` as a dependency (not a route), this endpoint returns 404 and role resolution fails silently.

**How to avoid:** Wave 0 of Phase 29 planning should include a task to verify `GET /api/me` route exists or add it. This is a 5-line FastAPI addition.

---

## `settings.logo_url` on Login Page

The LoginPage needs to show the logo (D-06, UI-SPEC). This requires fetching settings, but the user is unauthenticated at this point.

**Options:**
1. Make `GET /api/settings` publicly accessible (no auth required). If Phase 28 did NOT protect this endpoint with `get_current_user`, it's already public.
2. If `GET /api/settings` is protected, show no logo on login page (UI-SPEC: "If null: render nothing — the `<h1>` heading alone is sufficient"). This is the safest fallback.
3. Alternatively, the login page can call `GET /api/settings` via a bare `fetch()` (no auth header) — if the endpoint is public, it succeeds. If not, it fails silently and the logo slot is empty.

**Recommendation:** Verify `GET /api/settings` endpoint auth requirement in Phase 28 output. If it requires auth (returns 401 without Bearer), do NOT try to fetch it on the login page — render without logo. The UI-SPEC explicitly allows this.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| @directus/sdk | D-01 auth | NOT installed | 21.2.2 (npm) | — (locked, no fallback) |
| react-hook-form | shadcn Form | NOT installed | check npm | — (required by Form) |
| @hookform/resolvers | react-hook-form + zod | NOT installed | check npm | — |
| zod | form validation | NOT installed (likely) | check npm | — |
| Node.js / npm | package install | installed | via Docker | — |
| Directus service | cookie auth | running (Phase 26 done) | 11.17.2 | — |
| CORS on Directus | refresh cookie | NOT configured | — | Must be fixed in docker-compose.yml |
| GET /api/me route | role resolution | UNKNOWN | — | Add trivial FastAPI route |

**Missing dependencies with no fallback:**
- CORS must be enabled on Directus before frontend auth can work
- npm packages must be installed

**Missing dependencies with fallback:**
- `GET /api/me` — if missing, add 5-line FastAPI route (Wave 0 task)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (^1.59.1, already in devDeps) |
| Config file | check for playwright.config.ts — may need Wave 0 |
| Quick run command | `npx playwright test --grep @smoke` (if tagged) |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | Login form shows inline error on bad credentials | e2e | `npx playwright test tests/login.spec.ts` | Wave 0 |
| AUTH-02 | Login form succeeds with valid credentials, redirects to `/` | e2e | `npx playwright test tests/login.spec.ts` | Wave 0 |
| AUTH-03 | App boot calls refresh; session persists on reload | e2e | `npx playwright test tests/session.spec.ts` | Wave 0 |
| AUTH-06 | Sign-out clears session; subsequent reload goes to `/login` | e2e | `npx playwright test tests/logout.spec.ts` | Wave 0 |
| RBAC-03 | Viewer role: Upload nav link absent from NavBar | e2e | `npx playwright test tests/rbac.spec.ts` | Wave 0 |
| RBAC-03 | Viewer role: Trash icon absent from UploadHistory | e2e | `npx playwright test tests/rbac.spec.ts` | Wave 0 |
| RBAC-03 | Viewer accessing /upload directly: sees permission message | e2e | `npx playwright test tests/rbac.spec.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** Build check only (`cd frontend && npm run build`)
- **Per wave merge:** `npx playwright test` (requires running stack)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/tests/login.spec.ts` — covers AUTH-02
- [ ] `frontend/tests/session.spec.ts` — covers AUTH-03
- [ ] `frontend/tests/logout.spec.ts` — covers AUTH-06
- [ ] `frontend/tests/rbac.spec.ts` — covers RBAC-03
- [ ] `playwright.config.ts` — verify exists or create

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-mode token refresh | Custom fetch to `/auth/refresh` with cookie parsing | `directus.refresh()` | SDK handles token storage, expiry, cookie semantics |
| Form validation | Manual `useState` + `if (!email)` checks | `react-hook-form` + `zod` + shadcn Form | Accessibility, dirty state, async validation all handled |
| Cross-tab sign-out sync | BroadcastChannel or localStorage events | Not needed for v1.11 | Internal tool; out of scope per deferred ideas |
| Role-based redirect | Per-route checks in each page component | Single `<AuthGate>` + `<AdminOnly>` | DRY, testable, consistent |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Directus v10 snapshot.yml for roles | REST API bootstrap script (Phase 26 decision) | Directus 11 | Role setup already done — Phase 29 just reads roles |
| JWT role as UUID in payload | UUID mapped to string by backend `directus_auth.py` | Phase 27 | Frontend calls `/api/me` to get string role, not UUID |
| bare `fetch()` calls in api.ts | `apiClient()` wrapper (D-03) | Phase 29 | 17 call sites to migrate |

---

## Open Questions

1. **Does `GET /api/settings` require auth after Phase 28?**
   - What we know: RBAC-01 says read endpoints open to both roles — implies Viewer token required, not "no token."
   - What's unclear: Does "Viewer" mean "any authenticated user" or is there a public route exception for settings?
   - Recommendation: Check Phase 28 PLAN or `backend/app/routes/settings.py` for `depends_on=get_current_user`. If protected, login page shows no logo (acceptable per UI-SPEC).

2. **Does `GET /api/me` route exist?**
   - What we know: Phase 27/28 implemented `get_current_user` as a FastAPI dep but may not have exposed it as a GET route.
   - Recommendation: Wave 0 task — grep `backend/app/` for `/me` route; add if absent.

3. **VITE_DIRECTUS_URL in Docker Compose frontend service**
   - What we know: The frontend container runs Vite. `import.meta.env.VITE_*` vars must be defined at build time OR passed via Vite's env.
   - What's unclear: The frontend Dockerfile build vs dev. In dev (volume mount + `vite --host`), env vars can come from a `.env` file in the frontend dir. In production build, they must be baked in.
   - Recommendation: Add `VITE_DIRECTUS_URL=http://localhost:8055` to `.env` (and `.env.example`). The Vite config picks it up automatically.

---

## Sources

### Primary (HIGH confidence)

- npm registry `npm view @directus/sdk version` — confirmed 21.2.2 on 2026-04-15
- `frontend/src/lib/api.ts` (read directly) — 17 fetch call sites enumerated
- `frontend/src/components/NavBar.tsx` (read directly) — Upload link at lines 99–105
- `frontend/src/components/UploadHistory.tsx` (read directly) — Trash button at lines 115–123
- `frontend/src/components/settings/ActionBar.tsx` (read directly) — Save/Reset/Discard buttons
- `frontend/src/components/settings/PersonioCard.tsx` (read directly) — Sync button at lines 179–205
- `frontend/src/components/DropZone.tsx` (read directly) — Browse button at lines 111–116
- `docker-compose.yml` (read directly) — `CORS_ENABLED: "false"` confirmed
- `backend/app/security/directus_auth.py` (read directly) — role UUID→string mapping confirmed
- `directus/bootstrap-roles.sh` (read directly) — role names "Administrator" and "Viewer" confirmed
- [Directus SDK docs — connect/sdk](https://directus.io/docs/guides/connect/sdk)
- [Directus Auth docs](https://directus.io/docs/api/authentication)

### Secondary (MEDIUM confidence)

- [Directus React auth tutorial](https://directus.io/docs/tutorials/getting-started/using-authentication-in-react) — code patterns verified against SDK API
- [Directus tokens/cookies guide](https://directus.io/docs/guides/auth/tokens-cookies) — cookie mode mechanics

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified npm versions, existing deps confirmed in package.json
- Architecture: HIGH — all files read directly, patterns derived from existing codebase
- Fetch call site inventory: HIGH — exhaustive grep of api.ts
- Admin-only UI inventory: HIGH — all component files read directly with line numbers
- Directus SDK API: HIGH — official docs + npm version confirmed
- CORS requirement: HIGH — browser spec + docker-compose.yml read directly
- Pitfalls: HIGH — derived from code analysis + known browser/React patterns

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (Directus and SDK are active — check for minor version changes before executing)
