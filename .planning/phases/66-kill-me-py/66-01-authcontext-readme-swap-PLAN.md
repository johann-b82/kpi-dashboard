---
phase: 66-kill-me-py
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/auth/AuthContext.tsx
  - frontend/src/auth/useCurrentUserProfile.ts
  - directus/bootstrap-roles.sh
autonomous: true
requirements: [MIG-AUTH-01]

must_haves:
  truths:
    - "Post-login hydration populates AuthUser via directus.request(readMe(...)), not apiClient('/api/me')"
    - "Silent-refresh hydration populates AuthUser via directus.request(readMe(...)), not apiClient('/api/me')"
    - "useCurrentUserProfile() React Query hook is available to consumers (UserMenu, avatar)"
    - "Unknown role.name values clear auth (D-09) instead of silently defaulting to viewer"
    - "Viewer users can read directus_roles.name via Directus REST (permission row exists)"
  artifacts:
    - path: "frontend/src/auth/AuthContext.tsx"
      provides: "AuthProvider with readMe-based hydration and signIn flows"
      contains: "directus.request(readMe"
    - path: "frontend/src/auth/useCurrentUserProfile.ts"
      provides: "useCurrentUserProfile hook via React Query"
      contains: "['currentUserProfile']"
    - path: "directus/bootstrap-roles.sh"
      provides: "Viewer permission row for directus_roles.name read"
      contains: "directus_roles"
  key_links:
    - from: "frontend/src/auth/AuthContext.tsx"
      to: "@directus/sdk readMe"
      via: "directus.request(readMe({ fields: ['id','email','role.name'] }))"
      pattern: "directus\\.request\\(readMe"
    - from: "frontend/src/auth/useCurrentUserProfile.ts"
      to: "@directus/sdk readMe"
      via: "useQuery with queryKey ['currentUserProfile']"
      pattern: "queryKey:\\s*\\['currentUserProfile'\\]"
---

<objective>
Swap the two `apiClient<MeResponse>("/api/me")` call sites in `frontend/src/auth/AuthContext.tsx` for `directus.request(readMe(...))`, add a `useCurrentUserProfile()` React Query hook that exposes full profile fields (for future UserMenu/avatar consumers), and ensure the Viewer Directus permission allows reading `directus_roles.name` so the role-name resolution works for non-admin users.

Purpose: Phase 66 MIG-AUTH-01 — frontend identity hydration via Directus SDK, no `/api/me` network call.
Output: AuthContext populates `{id, email, role}` via `readMe`; `useCurrentUserProfile` hook available for UI; Directus permission extended.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/66-kill-me-py/66-CONTEXT.md
@frontend/src/auth/AuthContext.tsx
@frontend/src/lib/directusClient.ts
@frontend/src/lib/apiClient.ts
@directus/bootstrap-roles.sh

<interfaces>
<!-- Current AuthContext exports -->
From frontend/src/auth/AuthContext.tsx:
```typescript
export type Role = "admin" | "viewer";
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
export interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
// MeResponse (line 37-41) MUST be deleted in this plan.
```

From frontend/src/lib/directusClient.ts:
```typescript
export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication("cookie", { credentials: "include" }))
  .with(rest({ credentials: "include" }));
```

From @directus/sdk (runtime contract):
```typescript
import { readMe } from "@directus/sdk";
// readMe({ fields: ['id','email','role.name'] }) returns { id, email, role: { name } }
```

From directus/bootstrap-roles.sh (existing pattern — line 190):
```bash
ensure_permission "b2222222-0003-4000-a000-000000000003" "directus_users" "read" \
  '["id","email","first_name","last_name","role","avatar"]'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add Viewer permission row for directus_roles.name read</name>
  <read_first>
    - directus/bootstrap-roles.sh (entire file — pattern for ensure_permission section 5)
    - .planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md (AUTHZ-02 field allowlist locks)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-00c, D-01, "Things to watch" — Viewer read on directus_roles.name)
  </read_first>
  <files>directus/bootstrap-roles.sh</files>
  <behavior>
    - After bootstrap, Viewer policy has a `read` permission row on `directus_roles` with fields `["id","name"]`.
    - Re-running the bootstrap script is a no-op on this row (GET-before-POST idempotence).
    - Viewer JWT can request `GET /directus/roles/<self-role-id>?fields=name` and receive 200.
  </behavior>
  <action>
    Open `directus/bootstrap-roles.sh`. Locate the AUTHZ-03 `directus_users` ensure_permission block at line 188–191 (fixed UUID `b2222222-0003-4000-a000-000000000003`).

    Immediately AFTER that block and BEFORE the `log "section 5 complete..."` log line at line 195, insert a new `ensure_permission` call for `directus_roles`:

    ```bash
    # Phase 66 MIG-AUTH-01: directus_roles — Viewer needs to read role.name so
    # frontend readMe({ fields: ['id','email','role.name'] }) resolves for Viewer.
    # Fields restricted to id + name; permissions excludes admin_access, app_access,
    # icon, description, parent, children, users, policies.
    ensure_permission "b2222222-0004-4000-a000-000000000004" "directus_roles" "read" \
      '["id","name"]'
    ```

    Update the `log` line at line 195 to mention the new row:
    ```bash
    log "section 5 complete: sales_records + personio_employees + directus_users + directus_roles Viewer-readable; no signage_* permissions for Viewer"
    ```

    Do NOT modify any other section. Do NOT grant Viewer write/mutate on `directus_roles`. Do NOT touch Admin — Administrator has `admin_access:true` and bypasses policy rows.
  </action>
  <verify>
    <automated>grep -n 'directus_roles' directus/bootstrap-roles.sh | grep -q 'ensure_permission.*directus_roles.*read'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '"directus_roles"' directus/bootstrap-roles.sh` returns at least one line matching the `ensure_permission` pattern.
    - `grep -n 'b2222222-0004-4000-a000-000000000004' directus/bootstrap-roles.sh` returns exactly one line.
    - `grep -n '"id","name"' directus/bootstrap-roles.sh` returns at least one line (the new row's fields).
    - The new block sits between the existing `directus_users` ensure_permission (line ~190 pre-edit) and the `log "section 5 complete..."` line.
    - `bash -n directus/bootstrap-roles.sh` exits 0 (shell syntax valid).
  </acceptance_criteria>
  <done>
    `directus/bootstrap-roles.sh` grants Viewer policy read access to `directus_roles` (id, name), committed idempotently with a fixed UUID. Script still passes `bash -n` syntax check.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create useCurrentUserProfile React Query hook</name>
  <read_first>
    - frontend/src/auth/AuthContext.tsx (for QueryClient provider pattern + import conventions)
    - frontend/src/lib/directusClient.ts (SDK singleton — exported `directus`)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-05, D-06 — hook contract)
  </read_first>
  <files>frontend/src/auth/useCurrentUserProfile.ts</files>
  <behavior>
    - `useCurrentUserProfile()` returns a React Query result whose `data` is `{ id, email, first_name, last_name, avatar, role: { name } }` when the Directus session is valid.
    - Query key is exactly `['currentUserProfile']` (array, single element).
    - Uses `directus.request(readMe({ fields: ['id','email','first_name','last_name','avatar','role.name'] }))` as the queryFn.
    - Hook is callable from any component inside `<AuthProvider>` (React Query client is provided upstream — do not create a new QueryClient in the hook).
  </behavior>
  <action>
    Create a new file `frontend/src/auth/useCurrentUserProfile.ts` (per D-05 naming, file location is Claude's discretion but this path matches the `frontend/src/auth/` colocation with `AuthContext.tsx`).

    Contents:

    ```typescript
    import { useQuery } from "@tanstack/react-query";
    import { readMe } from "@directus/sdk";

    import { directus } from "@/lib/directusClient";

    /**
     * Phase 66 D-05: full-field profile fetch for UserMenu + avatar consumers.
     *
     * Second `readMe` call (distinct from the minimal one in AuthContext) so
     * AuthContext stays tight on `id, email, role.name` and the UI layer pulls
     * first_name / last_name / avatar on demand.
     *
     * Field list mirrors the Viewer allowlist on `directus_users` fixed in
     * Phase 65 (AUTHZ-03): id, email, first_name, last_name, avatar, role.
     * `role.name` requires the Viewer read permission on `directus_roles`
     * added in Plan 66-01 Task 1.
     *
     * Invalidated by AuthContext.signOut() via queryClient.clear() (existing).
     */
    export interface CurrentUserProfile {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      avatar: string | null;
      role: { name: string } | null;
    }

    export function useCurrentUserProfile() {
      return useQuery<CurrentUserProfile>({
        queryKey: ["currentUserProfile"],
        queryFn: async () => {
          const res = await directus.request(
            readMe({
              fields: ["id", "email", "first_name", "last_name", "avatar", "role.name"],
            }),
          );
          return res as CurrentUserProfile;
        },
      });
    }
    ```

    Do NOT add `staleTime` or `gcTime` — D-06 says project defaults. Do NOT call `queryClient.invalidateQueries` inside the hook — signOut's existing `queryClient.clear()` handles it. Do NOT export anything besides the hook and the type.
  </action>
  <verify>
    <automated>test -f frontend/src/auth/useCurrentUserProfile.ts && grep -q "queryKey: \[\"currentUserProfile\"\]" frontend/src/auth/useCurrentUserProfile.ts && grep -q "readMe" frontend/src/auth/useCurrentUserProfile.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f frontend/src/auth/useCurrentUserProfile.ts` exits 0.
    - `grep -c 'export function useCurrentUserProfile' frontend/src/auth/useCurrentUserProfile.ts` returns 1.
    - `grep -c "queryKey: \[\"currentUserProfile\"\]" frontend/src/auth/useCurrentUserProfile.ts` returns 1.
    - `grep -c 'first_name' frontend/src/auth/useCurrentUserProfile.ts` returns >= 1 (field appears in `fields` array).
    - `grep -c 'last_name' frontend/src/auth/useCurrentUserProfile.ts` returns >= 1.
    - `grep -c 'avatar' frontend/src/auth/useCurrentUserProfile.ts` returns >= 1.
    - `grep -c 'role.name' frontend/src/auth/useCurrentUserProfile.ts` returns >= 1.
    - `grep -c 'from "@directus/sdk"' frontend/src/auth/useCurrentUserProfile.ts` returns 1.
    - `grep -c 'from "@tanstack/react-query"' frontend/src/auth/useCurrentUserProfile.ts` returns 1.
    - `cd frontend && npx tsc --noEmit` exits 0 (no TypeScript errors introduced).
  </acceptance_criteria>
  <done>
    `frontend/src/auth/useCurrentUserProfile.ts` exists, exports `useCurrentUserProfile` and `CurrentUserProfile`, uses `['currentUserProfile']` as its query key, fetches the full allowlisted field set via `readMe`, and compiles clean under `tsc --noEmit`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Swap AuthContext hydration + signIn to directus.request(readMe(...))</name>
  <read_first>
    - frontend/src/auth/AuthContext.tsx (entire file — both call sites at lines 99 and 115, MeResponse at 37-41, hydratedRef logic)
    - frontend/src/lib/directusClient.ts (SDK singleton usage pattern)
    - frontend/src/lib/apiClient.ts (setAccessToken + trySilentRefresh — keep using for refresh path)
    - .planning/phases/66-kill-me-py/66-CONTEXT.md (D-01, D-04, D-07, D-08, D-09, D-10, D-13)
  </read_first>
  <files>frontend/src/auth/AuthContext.tsx</files>
  <behavior>
    - Silent-refresh hydration (line 89-107 in `useEffect`) calls `directus.request(readMe({ fields: ['id','email','role.name'] }))` instead of `apiClient<MeResponse>("/api/me")`.
    - signIn callback (line 109-119) calls the same readMe request after `directus.login()` + `setAccessToken(token)`.
    - Both paths map `role.name` → `'admin' | 'viewer'` via an explicit switch: `"Administrator"` → `"admin"`, `"Viewer"` → `"viewer"`, anything else → clear auth (same as fetch failure).
    - `MeResponse` interface is deleted.
    - `apiClient` import is removed from the import list (other AuthContext members still need `setAccessToken`, `setAuthFailureHandler`, `trySilentRefresh`).
    - Stale comment at line 50 (`GET /api/me`) is rewritten to describe the readMe flow (D-13).
    - No `"/api/me"` literal string remains in the file.
  </behavior>
  <action>
    Edit `frontend/src/auth/AuthContext.tsx`:

    1. **Imports** (top of file, current lines 11-17). Add `readMe` from `@directus/sdk` and drop `apiClient` from the `@/lib/apiClient` import (keep the other three):

    ```typescript
    import { readMe } from "@directus/sdk";

    import { directus } from "@/lib/directusClient";
    import {
      setAccessToken,
      setAuthFailureHandler,
      trySilentRefresh,
    } from "@/lib/apiClient";
    ```

    2. **Delete `MeResponse`** (current lines 37-41). Remove the entire interface block.

    3. **Add a role name → Role mapper** above `AuthProvider`. Insert between the `AuthContext` export and `AuthProvider`:

    ```typescript
    /**
     * D-01: map Directus role.name to the frontend Role union.
     * Unknown names return null — caller clears auth (D-09) instead of
     * silently defaulting to viewer.
     */
    function mapRoleName(name: string | null | undefined): Role | null {
      switch (name) {
        case "Administrator":
          return "admin";
        case "Viewer":
          return "viewer";
        default:
          return null;
      }
    }
    ```

    4. **Rewrite the block comment at line 43-57** (the JSDoc above `AuthProvider`). Keep its intent but replace "GET /api/me" with "directus.request(readMe(...))":

    ```typescript
    /**
     * AuthProvider — owns user/role/isLoading React state. The short-lived access
     * token does NOT live in React state; it sits in apiClient.ts's module
     * singleton to avoid re-rendering every consumer on every refresh.
     *
     * On mount: attempt a silent refresh (uses the httpOnly Directus refresh
     * cookie set on a prior login). If it succeeds, hydrate the user via
     * directus.request(readMe(...)) — Phase 66 MIG-AUTH-01 replaces the old
     * GET that used to live on a deleted FastAPI route. If readMe fails or
     * the role name is unmapped, we land unauthenticated and <AuthGate>
     * redirects to /login.
     *
     * signIn / signOut delegate to the Directus SDK, then sync the module-singleton
     * token and React state. signOut also clears the React Query cache so a new
     * user doesn't see the previous user's data.
     */
    ```

    5. **Replace hydration call** (current line 99). Replace:

    ```typescript
    const me = await apiClient<MeResponse>("/api/me");
    setUser(me);
    ```

    with:

    ```typescript
    const profile = await directus.request(
      readMe({ fields: ["id", "email", "role.name"] }),
    ) as { id: string; email: string; role: { name: string } | null };
    const mappedRole = mapRoleName(profile.role?.name);
    if (!mappedRole) {
      // D-09: unknown/unmapped role clears auth like a readMe failure.
      setUser(null);
      return;
    }
    setUser({ id: String(profile.id), email: profile.email, role: mappedRole });
    ```

    6. **Replace signIn call** (current line 115). Replace:

    ```typescript
    const me = await apiClient<MeResponse>("/api/me");
    setUser(me);
    ```

    with:

    ```typescript
    const profile = await directus.request(
      readMe({ fields: ["id", "email", "role.name"] }),
    ) as { id: string; email: string; role: { name: string } | null };
    const mappedRole = mapRoleName(profile.role?.name);
    if (!mappedRole) {
      // D-09: unknown role after a fresh login — clear and reject.
      clearLocalAuth();
      throw new Error("unknown_role");
    }
    setUser({ id: String(profile.id), email: profile.email, role: mappedRole });
    ```

    7. **Verify no `"/api/me"` string literal remains** in the file. If any JSDoc or inline comment still contains the literal string `/api/me`, rewrite the comment to reference `directus.request(readMe(...))` or delete it (per D-13). The grep guard in Plan 03 fails on any match to `"/api/me"` (with quotes) under `frontend/src/`.

    Do NOT touch `apiClient.ts` — other routers still use apiClient. Do NOT touch `trySilentRefresh`, `setAccessToken`, `setAuthFailureHandler` — all still in use. Do NOT expand `AuthUser` (D-03 locks `{id, email, role}`). Do NOT add retry logic on readMe failure (D-08 — same behavior as current catch branch).

    If the `apiClient` import becomes unused anywhere else in the file after these edits, remove it from the import. `apiClient` itself stays in `frontend/src/lib/apiClient.ts` untouched.
  </action>
  <verify>
    <automated>cd frontend && grep -c 'apiClient<MeResponse>' src/auth/AuthContext.tsx && exit 1 || grep -c 'directus.request(readMe' src/auth/AuthContext.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'directus.request(readMe' frontend/src/auth/AuthContext.tsx` returns exactly 2 (one for hydration, one for signIn).
    - `grep -c '"/api/me"' frontend/src/auth/AuthContext.tsx` returns 0 (literal double-quoted string gone from file, including comments — D-13).
    - `grep -c 'apiClient<MeResponse>' frontend/src/auth/AuthContext.tsx` returns 0.
    - `grep -c 'interface MeResponse' frontend/src/auth/AuthContext.tsx` returns 0.
    - `grep -c 'function mapRoleName' frontend/src/auth/AuthContext.tsx` returns 1.
    - `grep -c '"Administrator"' frontend/src/auth/AuthContext.tsx` returns 1 (the switch case).
    - `grep -c '"Viewer"' frontend/src/auth/AuthContext.tsx` returns 1 (the switch case).
    - `grep -c "from \"@directus/sdk\"" frontend/src/auth/AuthContext.tsx` returns >= 1 (readMe import).
    - `grep -c 'import { apiClient' frontend/src/auth/AuthContext.tsx` returns 0 (no longer imports apiClient symbol).
    - `grep -n 'trySilentRefresh\|setAccessToken\|setAuthFailureHandler' frontend/src/auth/AuthContext.tsx` shows all three still imported and referenced.
    - `cd frontend && npx tsc --noEmit` exits 0.
    - `cd frontend && npx vitest run src/auth/` exits 0 (any existing AuthContext tests still pass — adjust assertions if tests mock `/api/me`; the tests should be updated in the same commit if they do).
  </acceptance_criteria>
  <done>
    `AuthContext.tsx` hydrates via `directus.request(readMe({ fields: ['id','email','role.name'] }))` on both the silent-refresh and signIn paths, maps `role.name` through an explicit switch with unknown-name → clear-auth behavior, no longer references `/api/me` (string or comment), and the frontend compiles + existing tests pass.
  </done>
</task>

</tasks>

<verification>
- `grep -rn '"/api/me"' frontend/src/` returns no matches (prepares Plan 03 guard to pass).
- `grep -n 'directus_roles' directus/bootstrap-roles.sh` shows the new ensure_permission call.
- `frontend/src/auth/useCurrentUserProfile.ts` exists and exports `useCurrentUserProfile` + `CurrentUserProfile`.
- Frontend `npx tsc --noEmit` clean; any existing `AuthContext.test.tsx` or `useAuth.test.tsx` mocks of `/api/me` have been replaced with `directus.request` mocks or removed if they only asserted the deleted pathway.
- Backend is untouched in this plan (Plan 02 deletes the router).
</verification>

<success_criteria>
- Both `/api/me` call sites in `AuthContext.tsx` are replaced with `directus.request(readMe(...))`.
- `useCurrentUserProfile` hook is importable from `frontend/src/auth/useCurrentUserProfile.ts` with query key `['currentUserProfile']`.
- Viewer policy can read `directus_roles.name` (bootstrap script updated).
- Unknown role name clears auth instead of silently defaulting.
- No `"/api/me"` string literal remains anywhere in `frontend/src/auth/AuthContext.tsx`.
</success_criteria>

<output>
After completion, create `.planning/phases/66-kill-me-py/66-01-SUMMARY.md`.
</output>
