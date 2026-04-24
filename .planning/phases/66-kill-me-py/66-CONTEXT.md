# Phase 66: Kill `me.py` - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend reads current user identity entirely via the Directus SDK `readMe` call; the FastAPI `/api/me` surface is deleted and guarded by CI. This is the smallest bite of the v1.22 endpoint-migration sequence and exercises the Phase 65 `directus_users` Viewer field allowlist.

**In scope:**
1. `AuthContext` swaps `apiClient("/api/me")` for `directus.request(readMe(...))` on both the silent-refresh hydration path and the post-`signIn` path.
2. A new `useCurrentUserProfile()` React Query hook exposes `first_name`, `last_name`, `avatar` (and whatever else UserMenu / avatar consumers need) to satisfy roadmap success criterion #1.
3. `backend/app/routers/me.py`, its `main.py` registration, the `MeResponse` / route-level schemas, and the router's tests are deleted. `/api/me` returns 404.
4. A CI guard fails the build if `"/api/me"` reappears in `frontend/src/`.

**Not in scope:**
- Any other endpoint migration (Phases 67–71).
- Migrating non-auth data (`data.py`, signage routers) — Phases 67+.
- Field-level allowlist changes on `directus_users` (locked in Phase 65 AUTHZ-02; nothing to revisit here).
- UserMenu redesign — only the minimum wiring needed to consume the new profile hook.

</domain>

<decisions>
## Implementation Decisions

### Architectural locks carried from earlier phases (not revisited)
- **D-00a:** Directus SDK cookie-mode auth + short-lived access token in `apiClient.ts` module singleton (Phase 29/64).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; frontend uses same-origin default via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer + Administrator are the only two roles; Viewer field allowlist on `directus_users` excludes `tfa_secret`, `auth_data`, `external_identifier` (Phase 65 AUTHZ-02). Anything `readMe` requests outside that allowlist will fail for Viewer — the field list chosen in D-03 must stay inside the allowlist.

### Role resolution
- **D-01:** `readMe` requests `role.name` (not role UUID). Frontend maps with an explicit switch:
  - `"Administrator"` → `"admin"`
  - `"Viewer"` → `"viewer"`
  - any other value → treat as unauthenticated (same failure mode as D-09). No silent default.
- **D-02:** No new VITE env vars for role UUIDs. The readable name map replaces the backend's UUID map by design; backend UUID map stays authoritative for JWT claims and is untouched.

### AuthContext shape + profile slice
- **D-03:** `AuthContext.AuthUser` stays minimal: `{ id: string, email: string, role: 'admin' | 'viewer' }`. No expansion.
- **D-04:** `readMe` field list on the AuthContext path is `['id', 'email', 'role.name']` — the minimum needed to hydrate auth state. This keeps the AuthContext fetch tight and stays well inside the Viewer allowlist.
- **D-05:** A new hook `useCurrentUserProfile()` (React Query) issues a second `readMe` call with the full field list (`['id','email','first_name','last_name','avatar','role.name']`) and caches the result. UserMenu + any avatar consumer read from this hook, not from `AuthContext.user`. This satisfies roadmap success criterion #1 (app populates full identity via `readMe`) without contradicting D-03.
- **D-06:** The profile hook's React Query `queryKey` is `['currentUserProfile']`. Invalidated on `signOut` alongside the existing `queryClient.clear()` call. `staleTime` left to Claude's discretion (likely the project default).
- **D-07:** `MeResponse` type in `AuthContext.tsx` is removed along with the `apiClient("/api/me")` calls. No compatibility shim.

### Error + lifecycle behavior
- **D-08:** Silent-refresh success + `readMe` failure = clear auth state → AuthGate redirects to `/login`. Matches today's `apiClient("/api/me")` catch branch exactly. No retry, no error banner.
- **D-09:** Unknown / unmapped role name from `readMe` is treated identically to a `readMe` failure (D-08): clear auth, redirect. Prevents half-authenticated UI when someone adds a third Directus role outside of bootstrap.
- **D-10:** `signIn` flow: after `directus.login()` + `directus.getToken()` + `setAccessToken(token)`, call `readMe` (not `apiClient("/api/me")`) to hydrate. Token is already on the Directus SDK from `login()`, so `directus.request(readMe(...))` is the natural follow-up.

### Deletion + CI guard
- **D-11:** Delete `backend/app/routers/me.py`, its import + `include_router` line in `backend/app/main.py`, the `MeResponse` Pydantic model living inside the router, and any router-level tests under `backend/tests/` that hit `/api/me`. `CurrentUser` / `get_current_user` in `security/directus_auth.py` stay (other routers depend on them).
- **D-12:** CI guard lives as a new step in the existing `.github/workflows/ci.yml` workflow. Step implementation: `grep -rn '"/api/me"' frontend/src/ && exit 1 || exit 0` (single-quoted literal; no regex; exit 1 on any match). Guard runs early (before tests) so a regression fails fast.
- **D-13:** CI guard also includes a cleanup sweep: docstring / comment references to `/api/me` in `frontend/src/auth/FullPageSpinner.tsx`, `frontend/src/auth/AuthContext.tsx`, and `frontend/src/lib/apiClient.ts` are updated or removed so the guard stays green. Planner decides whether to rewrite the comments or delete them.

### Claude's Discretion
- Exact `useCurrentUserProfile` return type name and file location (likely `frontend/src/auth/useCurrentUserProfile.ts`) is the planner's call.
- React Query `staleTime` / `gcTime` for the profile hook — use project defaults unless there's a reason to diverge.
- Whether to wire the guard as an inline `run:` step or a dedicated `scripts/ci/no-api-me.sh`; inline is fine for one grep.
- Whether UserMenu.test.tsx needs updating (depends on whether UserMenu starts consuming the profile hook in this phase vs. a later cosmetic pass).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §MIG-AUTH-01, §MIG-AUTH-02, §MIG-AUTH-03 — acceptance criteria this phase satisfies.
- `.planning/ROADMAP.md` §"Phase 66: Kill `me.py`" — goal + success criteria (note: field list `id, email, first_name, last_name, role, avatar` from roadmap criterion #1).
- `.planning/PROJECT.md` — Directus 11 identity constraint.

### Prior phase context (locks inherited)
- `.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md` — AUTHZ-02 Viewer allowlist on `directus_users` (D-00c above).
- `.planning/phases/64-reverse-proxy/64-CONTEXT.md` — D-05 same-origin `/directus/*` default.
- Phase 29 auth context (cookie-mode SDK + module-singleton token pattern) — see `frontend/src/lib/directusClient.ts` + `frontend/src/lib/apiClient.ts` for the pattern in the code.

### Existing code integration points
- `backend/app/routers/me.py` — to be deleted.
- `backend/app/main.py` — router registration to be removed.
- `backend/app/security/directus_auth.py` — **keep** (`get_current_user`, `require_admin` consumed by other routers).
- `backend/app/schemas.py` — `CurrentUser` stays; anything `me.py`-only goes.
- `frontend/src/auth/AuthContext.tsx` — primary edit target.
- `frontend/src/auth/FullPageSpinner.tsx` — docstring reference to `/api/me` to update.
- `frontend/src/lib/apiClient.ts` — comments referencing `/api/me`; no code change needed here (apiClient stays for other routers).
- `frontend/src/lib/directusClient.ts` — SDK singleton; no change.
- `frontend/src/components/UserMenu.tsx` / `UserMenu.test.tsx` — probable consumer of the new profile hook.
- `.github/workflows/ci.yml` — CI workflow to extend with the guard step.

### Directus external refs
- Directus 11 SDK `@directus/sdk` — `readMe({ fields: [...] })` signature.
- Directus `role.name` default values: built-in `Administrator`, custom `Viewer` (see `directus/bootstrap-roles.sh`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Directus SDK singleton** (`frontend/src/lib/directusClient.ts`) — already configured for cookie auth + REST; `directus.request(readMe(...))` works out of the box.
- **React Query client** — already wired in `AuthProvider` via `useQueryClient()`; the profile hook plugs into the same provider.
- **`apiClient.ts`** — stays. Used by the many other `/api/*` routes. Only the two `/api/me` call sites leave.
- **`setAccessToken` + `trySilentRefresh`** — unchanged. The silent-refresh path still runs before `readMe` on mount.

### Established Patterns
- **Cookie-mode + module-singleton token** (Phase 29/64): `directus.login()` sets httpOnly cookie; short-lived access token lives in `apiClient.ts` module var. `readMe` goes through the SDK (which has its own token) — no need to touch the module singleton for this call.
- **React Query for server state** (project-wide): `useCurrentUserProfile` is idiomatic; do NOT useEffect+useState for it.
- **Phase 65 field allowlists**: anything requested via `readMe` must appear in the Viewer policy field list on `directus_users` or the request 403s for Viewer users. Confirm allowlist covers: `id, email, first_name, last_name, avatar, role.name` (relational read of `role.name` requires both a directus_users read on `role` and a directus_roles read on `name`).

### Integration Points
- AuthProvider initial-hydration `useEffect` (line 89 of AuthContext.tsx): `apiClient<MeResponse>("/api/me")` → `directus.request(readMe({ fields: ['id','email','role.name'] }))` + explicit name map (D-01).
- `signIn` callback (line 115): same swap.
- New file: `frontend/src/auth/useCurrentUserProfile.ts` (approx.).
- `backend/app/main.py`: remove `from app.routers.me import router as me_router` + `app.include_router(me_router)`.
- `.github/workflows/ci.yml`: new step — grep-fail on `/api/me` in `frontend/src/`.

### Things to watch
- **Viewer read on `directus_roles.name`** — the field allowlist fixed in Phase 65 covered `directus_users`; confirm Viewer has read on `directus_roles.name` (at least scoped to its own role). If not, either (a) extend Phase 65's bootstrap-roles.sh permissions for `directus_roles.name` read, or (b) request `role` as UUID and maintain a name lookup table (falls back to D-02 alternative — undesired). Planner should verify before locking D-04.
- **`AuthUser.id` type**: today it's `string` and populated from JSON `id`. `readMe` returns `id: string` too — one-to-one.
- **StrictMode double-fire** — existing `hydratedRef` guard handles this; the swap doesn't change the hazard.

</code_context>

<specifics>
## Specific Ideas

- Name-based role mapping (D-01) was chosen over UUID-based mapping specifically to avoid adding a VITE env-var surface. Keep it that way.
- Two-tier `readMe` (minimal fields for AuthContext, full fields for `useCurrentUserProfile`) is the deliberate shape. Do not collapse them into one call without revisiting D-03/D-05.
- CI guard is a literal-string grep on `"/api/me"` (with quotes) — tolerant to comments that reference it in prose. If planner wants a tighter regex, that's fine, but the principle is "fail on any code that hits that URL."
- Unknown role name → unauthenticated (D-09) is intentionally strict; do not add a "viewer fallback" for unknown roles.
- Backend `CurrentUser` / `Role` enum / `DIRECTUS_*_ROLE_UUID` env vars stay untouched — other routers still rely on them.

</specifics>

<deferred>
## Deferred Ideas

- **UserMenu redesign** to show avatar + full name — the hook lands here; the visual pass is cosmetic, not MIG-AUTH scope. Parking for a later polish phase.
- **Reusable `scripts/ci/no-api-*.sh` guard pattern** — Phases 67–71 will each kill endpoints and need similar guards; extract a reusable script after the third one. Don't premature-abstract in Phase 66.
- **Broader backend-surface absence assertion** (e.g., CI asserts `backend/app/routers/me.py` does not exist) — nice-to-have; the deletion + the frontend-side grep are sufficient for MIG-AUTH.
- **Rollback E2E for Phase 66** — deferred to Phase 71 (FE polish + CLEAN), same as Phase 65's rollback E2E decision.
- **Profile prefetch on login** — could warm `useCurrentUserProfile` queryCache inside `signIn` for a zero-flash UserMenu. Cosmetic; not required by MIG-AUTH.

</deferred>

---

*Phase: 66-kill-me-py*
*Context gathered: 2026-04-24*
