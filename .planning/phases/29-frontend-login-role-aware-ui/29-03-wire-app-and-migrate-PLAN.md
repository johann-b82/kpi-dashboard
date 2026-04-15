---
phase: 29-frontend-login-role-aware-ui
plan: 03
type: execute
wave: 3
depends_on: ["29-02"]
files_modified:
  - frontend/src/pages/LoginPage.tsx
  - frontend/src/lib/api.ts
  - frontend/src/App.tsx
  - frontend/src/components/NavBar.tsx
  - frontend/src/components/DropZone.tsx
  - frontend/src/pages/UploadPage.tsx
  - frontend/src/components/UploadHistory.tsx
  - frontend/src/components/settings/PersonioCard.tsx
  - frontend/src/components/settings/ActionBar.tsx
autonomous: false
requirements: [AUTH-02, AUTH-03, AUTH-06, RBAC-03]
must_haves:
  truths:
    - "Unauthenticated user hitting / is redirected to /login"
    - "Valid email+password at /login redirects to dashboard and survives a full page reload"
    - "Invalid credentials render inline error 'Invalid email or password' — no toast, no session"
    - "Silent access-token refresh happens before expiry without user re-login"
    - "Every /api/* call from frontend carries Authorization: Bearer <jwt>"
    - "Viewer does not see Upload nav icon, DropZone buttons, Personio sync button, Settings Save/Reset/Discard, or per-row delete trash icons"
    - "Sign-out button in NavBar clears session, redirects to /login, and the session does NOT restore on reload"
    - "After sign-out, any /api/* call returns 401"
  artifacts:
    - path: "frontend/src/pages/LoginPage.tsx"
      provides: "/login page with shadcn Form, email+password, inline error, submit loading state"
      contains: "Sign in"
    - path: "frontend/src/lib/api.ts"
      provides: "All 17 fetch calls migrated to apiClient<T>"
      contains: "apiClient"
    - path: "frontend/src/App.tsx"
      provides: "AuthProvider + AuthGate + /login route wired into provider tree"
      contains: "AuthProvider"
  key_links:
    - from: "App.tsx"
      to: "AuthContext + AuthGate"
      via: "AuthProvider inside QueryClientProvider; AuthGate wraps Switch"
      pattern: "AuthProvider"
    - from: "LoginPage.tsx"
      to: "AuthContext.signIn"
      via: "useAuth().signIn on form submit"
      pattern: "signIn"
    - from: "NavBar.tsx"
      to: "AuthContext.signOut"
      via: "LogOut icon button triggers signOut()"
      pattern: "signOut"
    - from: "api.ts (all 17 functions)"
      to: "apiClient"
      via: "apiClient<ReturnType>(path, init) replacing bare fetch"
      pattern: "apiClient"
---

<objective>
Wire Plan 02's infrastructure into the running app: mount AuthProvider + AuthGate in App.tsx, build LoginPage, migrate all 17 fetch call sites in api.ts to apiClient, add NavBar sign-out button, wrap all 9 admin-only surfaces with `<AdminOnly>`. End-to-end human verification checkpoint.

Purpose: This plan produces the user-visible Phase 29 deliverable. Every success criterion from ROADMAP is observed here.
Output: Working /login, authed dashboard, role-aware UI, clean sign-out.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/29-frontend-login-role-aware-ui/29-CONTEXT.md
@.planning/phases/29-frontend-login-role-aware-ui/29-UI-SPEC.md
@.planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md
@frontend/src/App.tsx
@frontend/src/lib/api.ts
@frontend/src/components/NavBar.tsx
@frontend/src/components/DropZone.tsx
@frontend/src/pages/UploadPage.tsx
@frontend/src/components/UploadHistory.tsx
@frontend/src/components/settings/PersonioCard.tsx
@frontend/src/components/settings/ActionBar.tsx
@frontend/src/auth/AuthContext.tsx
@frontend/src/lib/apiClient.ts

<interfaces>
<!-- All imported from Plan 02 -->
- `apiClient<T>(path, init?): Promise<T>` from `@/lib/apiClient`
- `AuthProvider` from `@/auth/AuthContext`
- `useAuth()`, `useRole()` from `@/auth/useAuth`
- `<AuthGate>` from `@/auth/AuthGate`
- `<AdminOnly>` from `@/auth/AdminOnly`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build LoginPage + wire AuthProvider/AuthGate/Route in App.tsx</name>
  <files>frontend/src/pages/LoginPage.tsx, frontend/src/App.tsx</files>
  <read_first>
    - frontend/src/App.tsx (current provider nesting order: ThemeProvider > QueryClientProvider > SettingsDraftProvider > DateRangeProvider)
    - .planning/phases/29-frontend-login-role-aware-ui/29-UI-SPEC.md §"Login Card" (full spec: layout, typography, states, copy — static wordmark "KPI Light" per orchestrator override, NO logo fetch)
    - .planning/phases/29-frontend-login-role-aware-ui/29-CONTEXT.md §D-06 (login copy locked)
    - frontend/src/components/ui/form.tsx (shadcn Form primitives installed in Plan 02)
    - frontend/src/components/ui/input.tsx, button.tsx, card.tsx, label.tsx (existing primitives)
  </read_first>
  <action>
    Create `frontend/src/pages/LoginPage.tsx` implementing UI-SPEC §"Login Card" exactly:
    - Outer: `<div className="min-h-screen bg-background flex items-center justify-center px-4">`
    - shadcn `<Card className="w-full max-w-sm">` with `<CardHeader>` (brand wordmark) + `<CardContent>` (form)
    - Brand: **static text wordmark** per orchestrator override — `<p className="text-center text-2xl font-semibold mb-4">KPI Light</p>` (NO `/api/settings` fetch — login page is unauthed; dynamic logo remains NavBar-only).
    - Heading: `<h1 className="text-2xl font-semibold text-center text-foreground mb-6">Sign in</h1>`
    - react-hook-form + zod schema: `z.object({ email: z.string().email(), password: z.string().min(1) })`.
    - Fields: Email (autoFocus, autoComplete="email", placeholder "email@example.com"), Password (type=password, autoComplete="current-password", placeholder "Password"). Labels: "Email", "Password". `space-y-4` between fields.
    - Submit button: `<Button type="submit" className="w-full" size="default" disabled={isSubmitting}>`. Default: "Sign in". Submitting: `<Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…`.
    - Inline error below button: `<p className="text-[13px] text-destructive text-center mt-2">Invalid email or password</p>` rendered ONLY when `loginError === true`. Never reveal which field. No toast (D-06).
    - onSubmit: `try { await signIn(email, password); } catch { setLoginError(true); }`. On success, AuthGate's redirect handles navigation to `/`.

    Update `frontend/src/App.tsx`:
    - Import `AuthProvider`, `AuthGate`, `LoginPage`.
    - Insert `<AuthProvider>` INSIDE `<QueryClientProvider>` (so AuthContext can use `useQueryClient` per RESEARCH §"Pattern 5").
    - Wrap the `<Switch>` with `<AuthGate>`.
    - Add `<Route path="/login" component={LoginPage} />` as the first route inside `<Switch>`.
    - NavBar and SubHeader should NOT render on `/login`. Simplest: render them inside AuthGate-protected children, or conditionally on `location !== '/login'` via wouter `useLocation()`. Prefer a conditional render in App.tsx: only show NavBar/SubHeader when `location !== '/login'`.

    Final App.tsx shape (matches RESEARCH §"Pattern 5"):
    ```tsx
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SettingsDraftProvider>
            <DateRangeProvider>
              <AuthGate>
                {location !== '/login' && <><NavBar /><SubHeader /></>}
                <main className={location === '/login' ? '' : 'pt-28'}>
                  <Switch>
                    <Route path="/login" component={LoginPage} />
                    <Route path="/" component={DashboardPage} />
                    {/* existing routes */}
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
  </action>
  <acceptance_criteria>
    - `test -f frontend/src/pages/LoginPage.tsx` passes
    - `grep -c "Sign in" frontend/src/pages/LoginPage.tsx` >= 2 (heading + button)
    - `grep -c "Invalid email or password" frontend/src/pages/LoginPage.tsx` == 1
    - `grep -c "KPI Light" frontend/src/pages/LoginPage.tsx` >= 1 (static wordmark)
    - `grep -c "/api/settings" frontend/src/pages/LoginPage.tsx` == 0 (no settings fetch on login page)
    - `grep -c "sonner\\|toast" frontend/src/pages/LoginPage.tsx` == 0 (no toasts on login errors)
    - `grep -c "AuthProvider" frontend/src/App.tsx` >= 2 (import + usage)
    - `grep -c "AuthGate" frontend/src/App.tsx` >= 2
    - `grep -c 'path="/login"' frontend/src/App.tsx` == 1
    - `cd frontend && npm run build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npm run build</automated>
  </verify>
  <done>LoginPage renders per UI-SPEC; App.tsx provider tree matches RESEARCH §"Pattern 5"; TypeScript compiles.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Migrate all 17 fetch sites to apiClient + wrap 9 admin-only surfaces + NavBar sign-out</name>
  <files>frontend/src/lib/api.ts, frontend/src/components/NavBar.tsx, frontend/src/components/DropZone.tsx, frontend/src/pages/UploadPage.tsx, frontend/src/components/UploadHistory.tsx, frontend/src/components/settings/PersonioCard.tsx, frontend/src/components/settings/ActionBar.tsx</files>
  <read_first>
    - frontend/src/lib/api.ts (all 17 functions — enumerated in RESEARCH §"Fetch Call Site Inventory")
    - .planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md §"Fetch Call Site Inventory" (exact table of 17 sites)
    - .planning/phases/29-frontend-login-role-aware-ui/29-RESEARCH.md §"Admin-Only UI Surface Inventory" (exact table of 9 surfaces, line numbers)
    - .planning/phases/29-frontend-login-role-aware-ui/29-UI-SPEC.md §"NavBar Sign-Out Addition" (LogOut icon, rightmost position, aria-label "Sign out")
    - .planning/phases/29-frontend-login-role-aware-ui/29-UI-SPEC.md §"AdminOnly Wrapper" (Viewer /upload shows "You don't have permission to access this page.")
  </read_first>
  <action>
    **Part A — Migrate 17 fetch calls** in `frontend/src/lib/api.ts`. For each of the 17 functions below (per RESEARCH inventory), replace `const res = await fetch(path, init); if (!res.ok) throw ...; return res.json()` with `return apiClient<ReturnType>(path, init);`. Drop manual 401/error handling — apiClient centralizes it:

    1. uploadFile → POST /api/upload (FormData — do NOT set Content-Type)
    2. getUploads → GET /api/uploads
    3. deleteUpload → DELETE /api/uploads/${id}
    4. fetchKpiSummary → GET /api/kpis
    5. fetchChartData → GET /api/kpis/chart
    6. fetchLatestUpload → GET /api/kpis/latest-upload
    7. fetchSettings → GET /api/settings
    8. updateSettings → PUT /api/settings (keeps Content-Type: application/json)
    9. uploadLogo → POST /api/settings/logo (FormData)
    10. fetchPersonioOptions → GET /api/settings/personio-options
    11. testPersonioConnection → POST /api/sync/test
    12. fetchSyncMeta → GET /api/sync/meta
    13. triggerSync → POST /api/sync
    14. fetchHrKpis → GET /api/hr/kpis
    15. fetchHrKpiHistory → GET /api/hr/kpis/history
    16. fetchSalesRecords → GET /api/data/sales
    17. fetchEmployees → GET /api/data/employees

    Import: `import { apiClient } from './apiClient';`. Remove any now-unused helpers that duplicate apiClient's logic. Preserve exported function signatures and return types exactly (callers rely on them).

    **Part B — NavBar sign-out button** in `frontend/src/components/NavBar.tsx` per UI-SPEC §"NavBar Sign-Out Addition":
    - Import `LogOut` from `lucide-react`, `useAuth` from `@/auth/useAuth`.
    - Add as rightmost item after Settings gear in the `ml-auto flex items-center gap-4` cluster.
    - `<button type="button" aria-label="Sign out" onClick={() => signOut()} className="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors text-foreground"><LogOut className="h-5 w-5" /></button>`
    - Wrap the existing Upload nav `<Link href="/upload">` icon with `<AdminOnly>` (Viewer doesn't see it at all).

    **Part C — Wrap 9 admin-only surfaces** with `<AdminOnly>` per RESEARCH inventory:
    1. NavBar Upload link (done in Part B)
    2. DropZone.tsx: wrap the "Browse" `<Button>` (~line 111) with `<AdminOnly>`.
    3. UploadPage.tsx: wrap entire page body content in `<AdminOnly>`; add else-branch `<p className="text-muted-foreground text-sm text-center py-16">You don't have permission to access this page.</p>` by checking `useRole() === 'admin'` at page-level (AdminOnly returns null for Viewer so use an inline ternary here, per D-04 "Inline allowed where JSX wrap is awkward").
    4. PersonioCard.tsx: wrap the sync trigger `<button>` (~lines 179–205) with `<AdminOnly>`. Read-only inputs remain visible.
    5. ActionBar.tsx: wrap Save `<Button>`, Reset `<Button>`, and Discard `<Button>` individually with `<AdminOnly>` (simpler than prop-threading).
    6. UploadHistory.tsx: wrap the trash-icon `<Button>` inside the table row map with `<AdminOnly>` (~line 115). The empty TableCell is acceptable per RESEARCH note.

    Each wrap: `<AdminOnly>{existing JSX}</AdminOnly>`. Import `AdminOnly` from `@/auth/AdminOnly` in each file.
  </action>
  <acceptance_criteria>
    - `grep -c "apiClient" frontend/src/lib/api.ts` >= 17 (one per migrated function, minimum)
    - `grep -cE "await fetch\\(" frontend/src/lib/api.ts` == 0 (all bare fetches migrated)
    - `grep -c "AdminOnly" frontend/src/components/NavBar.tsx` >= 1
    - `grep -c "LogOut" frontend/src/components/NavBar.tsx` >= 2 (import + JSX)
    - `grep -c 'aria-label="Sign out"' frontend/src/components/NavBar.tsx` == 1
    - `grep -c "signOut" frontend/src/components/NavBar.tsx` >= 1
    - `grep -c "AdminOnly" frontend/src/components/DropZone.tsx` >= 1
    - `grep -c "AdminOnly\\|useRole" frontend/src/pages/UploadPage.tsx` >= 1
    - `grep -c "You don't have permission" frontend/src/pages/UploadPage.tsx` == 1
    - `grep -c "AdminOnly" frontend/src/components/UploadHistory.tsx` >= 1
    - `grep -c "AdminOnly" frontend/src/components/settings/PersonioCard.tsx` >= 1
    - `grep -c "AdminOnly" frontend/src/components/settings/ActionBar.tsx` >= 3 (Save, Reset, Discard)
    - `cd frontend && npm run build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd frontend && npm run build && grep -cE "await fetch\\(" frontend/src/lib/api.ts</automated>
  </verify>
  <done>All 17 fetch sites use apiClient; no bare fetch remains; 9 admin-only surfaces are hidden from Viewers; NavBar has sign-out button; TS compiles.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking" status="approved">
  <name>Task 3: Human end-to-end verification of all 5 ROADMAP success criteria (APPROVED 2026-04-15)</name>
  <what-built>
    Complete Phase 29 deliverable: /login page, AuthProvider + AuthGate, silent refresh on boot, bearer token injection via apiClient across all 17 API calls, 9 admin-only UI surfaces hidden for Viewer, NavBar sign-out.
  </what-built>
  <how-to-verify>
    Prerequisite: `docker compose up -d` (all services). Ensure one Admin and one Viewer user exist in Directus (Phase 26 bootstrapped an Admin; create a Viewer via Directus UI at http://localhost:8055 if missing).

    Then run `cd frontend && npm run dev` and visit http://localhost:5173.

    **Criterion 1 — Login flow:**
    1. Open incognito window → http://localhost:5173 → expect redirect to /login
    2. Submit empty form → expect HTML5 validation (email/password required)
    3. Submit wrong password → expect inline red text "Invalid email or password" below button (NOT a toast), no session cookie, still on /login
    4. Submit valid Admin credentials → redirects to / (dashboard renders)
    5. Full page reload (Cmd+R) → still logged in (session survives reload)

    **Criterion 2 — Silent refresh:**
    6. DevTools → Application → Cookies → confirm a `directus_session_token` httpOnly cookie exists on localhost:8055
    7. Leave tab open for a few minutes (or manually trigger by reducing Directus ACCESS_TOKEN_TTL); dashboard queries continue to succeed — no /login redirect

    **Criterion 3 — Bearer token on every /api/* call:**
    8. DevTools → Network → filter `/api/` → click any request (e.g., `/api/kpis`) → Request Headers contain `Authorization: Bearer ey...`
    9. Verify AT LEAST 3 different `/api/*` endpoints show the header

    **Criterion 4 — Viewer hides admin UI:**
    10. Sign out (top-right LogOut icon), sign in as Viewer
    11. NavBar: NO Upload icon visible (not grayed — absent). Sign-out icon IS visible.
    12. Navigate to /upload manually → page shows "You don't have permission to access this page."
    13. Navigate to /settings → Save, Reset, Discard buttons absent. Inputs may still render.
    14. On HR / settings page: Personio sync button absent.
    15. On /upload page (via direct URL, viewer view — expected permission message)
    16. Open DOM inspector on Settings page → search for `Save` button in the DOM → NOT present (hidden, not just disabled)

    **Criterion 5 — Sign-out:**
    17. Click LogOut icon in NavBar → redirected to /login
    18. Reload /login → stays on /login (session does NOT restore)
    19. Open DevTools Console → `fetch('/api/kpis')` → returns 401 (no bearer token attached since signed-out)

    Report PASS/FAIL per criterion 1–5. If any FAIL, describe exact observed behavior.
  </how-to-verify>
  <resume-signal>Type "approved" if all 5 criteria PASS, or describe failures.</resume-signal>
</task>

</tasks>

<verification>
All 5 ROADMAP success criteria for Phase 29 must PASS in human verification (Task 3):
1. Unauth → /login; valid creds → dashboard + reload-persistent; invalid → inline error
2. Silent refresh before expiry
3. `Authorization: Bearer` on every /api/* call
4. Viewer: admin-only surfaces hidden from DOM (not disabled)
5. Sign-out clears session; reload does NOT restore; subsequent /api/* → 401
</verification>

<success_criteria>
- All 17 fetch sites migrated to apiClient
- All 9 admin-only UI surfaces wrapped with AdminOnly (or equivalent inline role check for UploadPage's page-level fallback)
- NavBar has LogOut sign-out button with aria-label="Sign out"
- LoginPage renders per UI-SPEC with static "KPI Light" wordmark, no /api/settings call
- App.tsx provider tree: AuthProvider inside QueryClientProvider; AuthGate wraps Switch
- Human verification confirms all 5 ROADMAP criteria
</success_criteria>

<output>
After completion, create `.planning/phases/29-frontend-login-role-aware-ui/29-03-SUMMARY.md`
</output>
