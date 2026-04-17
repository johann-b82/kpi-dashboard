# Phase 37: Launcher Shell & Auth Wiring - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

New `/home` route — iOS-style grid of square rounded-corner tile cards with role-aware visibility, login redirect wiring (`/login` success → `/home`), unauthenticated guard on `/home`, full DE/EN i18n, and dark-mode via existing Tailwind token system. Pure frontend change — no new backend routes, no new Docker services.

</domain>

<decisions>
## Implementation Decisions

### Grid Layout
- **D-01:** Responsive wrap grid — `auto-fill` / `minmax` CSS grid, 4 tiles across on desktop, fewer on narrow viewports. Scales naturally as tiles are added.
- **D-02:** Tile size ~120×120px square. True iOS-style compact proportions — large enough for readable icon + label.

### Page Chrome
- **D-03:** `/home` shows the full NavBar + SubHeader, consistent with `/sales`, `/hr`, `/docs`. No special-casing of the AuthGate shell. SubHeader will render its default state (nothing route-specific to show on the launcher).

### Coming-Soon Tiles
- **D-04:** Greyed-out via reduced opacity (~40–50%) on the whole tile card. No hover effect, no cursor change, no overlay text, no tooltip. Matches iOS greyed-out app pattern — clean and minimal.
- **D-05:** Admin-only tiles are completely absent (not greyed, not locked) for Viewer role, per LAUNCH-05.

### Tile Icons (lucide-react)
- **D-06:** KPI Dashboard active tile: `LayoutDashboard` icon from lucide-react.
- **D-07:** Placeholder / coming-soon tiles: neutral generic icon from lucide-react (e.g., `Box` or `Grid2X2`). Claude's discretion on exact icon for best visual balance.

### Auth & Routing
- **D-08:** `AuthGate` redirect on successful auth: change `setLocation("/")` → `setLocation("/home")`. This is the only change needed for AUTH-01.
- **D-09:** `/home` added to the wouter `<Switch>` in `App.tsx` as a new `<Route>`. `AuthGate` already handles unauthenticated redirect to `/login` for all non-`/login` paths (AUTH-02 satisfied by existing guard).
- **D-10:** `/` (root) route: leave as-is (currently renders `DashboardPage`). No redirect from root needed.

### Branding & i18n
- **D-11:** Page title / heading uses `settings.app_name` from `useSettings()` hook — same source as NavBar logo text.
- **D-12:** All tile labels and page heading use react-i18next keys in existing `en.json` / `de.json` locale files.

### Claude's Discretion
- Exact placeholder icon choice (Box vs Grid2X2 vs similar) — pick for best visual balance at 120px
- Tile border-radius (existing `rounded-2xl` or similar Tailwind token)
- Spacing between tiles (gap value in the grid)
- Icon size within tile (relative to tile card dimensions)
- SubHeader content on `/home` (likely empty / default state — Claude handles)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — LAUNCH-01 through LAUNCH-05, AUTH-01, AUTH-02, BRAND-01, BRAND-02, BRAND-03

### Key Existing Files
- `frontend/src/App.tsx` — wouter routing, AuthGate wiring, NavBar/SubHeader render condition; add `/home` Route here, update auth redirect
- `frontend/src/auth/AuthGate.tsx` — Auth redirect logic (line 26: `setLocation("/")` → `setLocation("/home")`)
- `frontend/src/auth/AuthContext.tsx` — `Role` type (`"admin" | "viewer"`), `useAuth()` hook
- `frontend/src/components/NavBar.tsx` — uses `useSettings()` for `settings.app_name`; `useAuth()` for role
- `frontend/src/hooks/useSettings.ts` (or `useSettingsDraft.ts`) — provides `settings.app_name`
- `frontend/src/locales/en.json` — add i18n keys for launcher page
- `frontend/src/locales/de.json` — add German translations for same keys

### Project Infrastructure
- `CLAUDE.md` — Technology stack, Tailwind v4 CSS-variable token system, lucide-react for icons

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAuth()` hook — provides `user.role` for admin-only tile gating
- `useSettings()` hook — provides `settings.app_name` for page heading (BRAND-03)
- `lucide-react` — already installed; `LayoutDashboard` available for KPI Dashboard tile
- `AuthGate` — existing unauthenticated redirect (handles AUTH-02 with no changes)
- Tailwind v4 CSS-variable tokens — dark mode works automatically via class strategy (BRAND-01)

### Established Patterns
- i18n: `react-i18next` keys in `en.json`/`de.json`, `useTranslation()` hook in components
- Role gating: check `user?.role === "admin"` (see NavBar admin-only surfaces)
- Routing: wouter `<Route path="..." component={...} />` added to `<Switch>` in `App.tsx`
- Auth redirect: `setLocation(...)` inside `useEffect` in `AuthGate.tsx`

### Integration Points
- `App.tsx` `<Switch>`: add `<Route path="/home" component={LauncherPage} />`
- `AuthGate.tsx`: change the authed-on-login redirect from `"/"` to `"/home"`
- `frontend/src/pages/`: add new `LauncherPage.tsx`
- Locale files: add `launcher.*` i18n namespace or keys

</code_context>

<specifics>
## Specific Ideas

- The visual reference is iOS home screen — square tiles in a clean grid, icon centered in the card with label text below. No card shadow needed (opacity treatment is the only visual differentiator for coming-soon tiles).
- 3 placeholder tiles + 1 active KPI Dashboard tile = 4 total tiles for v1.14 launch.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 37-launcher-shell-auth-wiring*
*Context gathered: 2026-04-17*
