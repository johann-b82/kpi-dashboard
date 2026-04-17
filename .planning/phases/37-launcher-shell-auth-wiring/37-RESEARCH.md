# Phase 37: App Launcher - Research

**Researched:** 2026-04-17
**Domain:** React frontend — new route, role-gated tile grid, auth redirect wiring, i18n
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Responsive wrap grid — `auto-fill` / `minmax` CSS grid, 4 tiles across on desktop, fewer on narrow viewports.
- **D-02:** Tile size ~120×120px square.
- **D-03:** `/home` shows the full NavBar + SubHeader, consistent with other routes.
- **D-04:** Greyed-out coming-soon tiles via `opacity-40` on the whole tile card. No hover, no cursor change, no overlay, no tooltip.
- **D-05:** Admin-only tiles are completely absent (not greyed) for Viewer role.
- **D-06:** Active KPI Dashboard tile icon: `LayoutDashboard` from lucide-react.
- **D-07:** Placeholder tiles icon: neutral generic from lucide-react — Claude's discretion (Box chosen in UI-SPEC).
- **D-08:** AuthGate redirect on successful auth: change `setLocation("/")` → `setLocation("/home")`.
- **D-09:** `/home` added to wouter `<Switch>` in `App.tsx` as a new `<Route>`. AuthGate already handles unauthenticated redirect.
- **D-10:** `/` (root) route: leave as-is (renders DashboardPage). No redirect from root needed.
- **D-11:** Page heading uses `settings.app_name` from `useSettings()`.
- **D-12:** All tile labels and page heading use react-i18next keys in existing `en.json` / `de.json`.

### Claude's Discretion

- Exact placeholder icon choice (Box vs Grid2X2 vs similar) — pick for best visual balance at 120px
- Tile border-radius (`rounded-2xl` from UI-SPEC)
- Spacing between tiles (gap: 24px / `lg` token from UI-SPEC)
- Icon size within tile (40px / `w-10 h-10` from UI-SPEC)
- SubHeader content on `/home` (empty/default state)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAUNCH-01 | User sees an iOS-style app grid at `/home` after login | New `LauncherPage.tsx` with CSS grid layout; wouter Route added in App.tsx |
| LAUNCH-02 | Each tile: square rounded-corner icon card with app name label below | Tailwind card pattern — `rounded-2xl`, `flex flex-col items-center`, fixed 120×120px |
| LAUNCH-03 | KPI Dashboard tile navigates to `/sales` on click | `useLocation` from wouter, `setLocation("/sales")` or `<Link to="/sales">` |
| LAUNCH-04 | Coming-soon tiles greyed out, no click action | `opacity-40 pointer-events-none` CSS classes — no custom JS needed |
| LAUNCH-05 | Admin-only tiles hidden from Viewer role | Conditional render: `{user?.role === "admin" && <AdminTile />}` |
| AUTH-01 | Login success redirects to `/home` | Single line change in `AuthGate.tsx` line 26: `"/"` → `"/home"` |
| AUTH-02 | Unauthenticated `/home` redirects to `/login` | Existing AuthGate guard already covers all non-`/login` paths; no change needed |
| BRAND-01 | Dark mode works without additional theming code | Tailwind v4 CSS-variable strategy — `bg-card`, `border-border` tokens already handle dark/light |
| BRAND-02 | Tile labels and page title translated in DE and EN | Add `launcher.*` keys to `en.json` and `de.json`; use `useTranslation()` in component |
| BRAND-03 | Page heading uses app name from Settings | `useSettings()` hook provides `settings.app_name`; same pattern as NavBar |
</phase_requirements>

---

## Summary

Phase 37 is a pure frontend addition — no new backend routes, no new Docker services, no database changes. The work is: (1) create `LauncherPage.tsx` at `frontend/src/pages/`, (2) wire its route in `App.tsx`, (3) update the auth redirect in `AuthGate.tsx`, and (4) add i18n keys to both locale files.

All infrastructure needed is already in place: wouter routing, AuthGate, useAuth/useSettings hooks, lucide-react icons, Tailwind v4 CSS tokens, and react-i18next. This phase is purely additive — no existing functionality changes except the single-line auth redirect and the new Route entry.

The visual pattern (iOS-style tile grid) is a CSS grid with fixed tile dimensions and Tailwind tokens already used throughout the project. Role-gating follows the existing `user?.role === "admin"` check seen in NavBar's `<AdminOnly>` wrapper.

**Primary recommendation:** Implement in a single plan — LauncherPage + i18n keys + auth wiring together. No dependencies between sub-tasks justify splitting into multiple plans.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wouter | existing | Client-side routing | Project router — `<Route>`, `useLocation` |
| react-i18next | existing | i18n keys and `useTranslation()` | Project i18n — `en.json`/`de.json` |
| lucide-react | existing | `LayoutDashboard`, `Box` icons | Project icon library |
| Tailwind v4 | 4.2.2 | CSS grid, token classes | Project CSS — `bg-card`, `rounded-2xl`, etc. |

**No new npm packages needed for this phase.**

---

## Architecture Patterns

### New File

```
frontend/src/pages/LauncherPage.tsx   ← new page component
```

### Modified Files

```
frontend/src/App.tsx                  ← add Route + import
frontend/src/auth/AuthGate.tsx        ← change "/" → "/home" (line 26)
frontend/src/locales/en.json          ← add launcher.* keys
frontend/src/locales/de.json          ← add launcher.* keys
```

### Pattern 1: Tile Grid Layout (CSS Grid)

**What:** CSS grid with `auto-fill` / `minmax(120px, 1fr)` and 24px gap.
**When to use:** Any responsive grid where column count should scale with container width.

```tsx
// LauncherPage.tsx — grid container
<div
  className="grid gap-6"
  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
>
  {/* tiles */}
</div>
```

Note: Tailwind v4 supports arbitrary grid values inline. Alternatively use a `[grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]` Tailwind arbitrary value class.

### Pattern 2: Active Tile Card

**What:** Square card, flex column, icon centred, label below, hover effect.

```tsx
// Active tile — click navigates to /sales
<div
  onClick={() => setLocation("/sales")}
  className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
             flex flex-col items-center justify-center gap-2 p-4
             cursor-pointer hover:bg-accent/10 transition-colors"
>
  <LayoutDashboard className="w-10 h-10 text-foreground" />
  <span className="text-xs font-medium text-muted-foreground text-center truncate w-full">
    {t("launcher.tile.kpi_dashboard")}
  </span>
</div>
```

### Pattern 3: Coming-Soon Tile Card

**What:** Same card shell, `opacity-40 pointer-events-none` — no other changes.

```tsx
// Coming-soon tile — greyed, no interaction
<div
  className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
             flex flex-col items-center justify-center gap-2 p-4
             opacity-40 pointer-events-none"
>
  <Box className="w-10 h-10 text-foreground" />
  <span className="text-xs font-medium text-muted-foreground text-center truncate w-full">
    {t("launcher.tile.coming_soon")}
  </span>
</div>
```

### Pattern 4: Role-Gated Tile (admin-only)

**What:** Conditionally render admin-only tiles — completely absent from DOM for viewer role.

```tsx
// Per LAUNCH-05: absent, not greyed, for viewer role
const { user } = useAuth();
// ...
{user?.role === "admin" && <AdminTile />}
```

Note: In v1.14 there are NO admin-only tiles defined. This pattern is documented but not exercised.

### Pattern 5: Auth Redirect (AuthGate.tsx change)

**What:** Single line change — post-login redirect destination.

```tsx
// AuthGate.tsx line 26 — BEFORE:
setLocation("/");
// AFTER:
setLocation("/home");
```

### Pattern 6: Route Registration (App.tsx)

**What:** Add LauncherPage route to the wouter Switch.

```tsx
// App.tsx — add after LoginPage route
import { LauncherPage } from "./pages/LauncherPage";
// ...
<Route path="/home" component={LauncherPage} />
```

### Pattern 7: i18n Keys

**What:** New `launcher.*` keys in both locale files. Use `useTranslation()` without namespace (consistent with existing flat key pattern in this project).

```json
// en.json additions
"launcher.title": "{{appName}}",
"launcher.tile.kpi_dashboard": "KPI Dashboard",
"launcher.tile.coming_soon": "Coming Soon"
```

```json
// de.json additions
"launcher.title": "{{appName}}",
"launcher.tile.kpi_dashboard": "KPI-Dashboard",
"launcher.tile.coming_soon": "Demnächst"
```

Usage in component:
```tsx
const { t } = useTranslation();
const { data } = useSettings();
const settings = data ?? DEFAULT_SETTINGS;
// heading:
<h1 className="text-2xl font-medium">{settings.app_name}</h1>
// tile label:
<span>{t("launcher.tile.kpi_dashboard")}</span>
```

Note: `launcher.title` key with interpolation is defined for completeness but the heading uses `settings.app_name` directly per D-11. Either approach works.

### Anti-Patterns to Avoid

- **Adding `pointer-events-none` AND `cursor-not-allowed`:** `pointer-events-none` suppresses all pointer events including cursor styling — `cursor-not-allowed` is ignored. Use only `pointer-events-none`.
- **Using wouter `<Link>` inside a div with onClick:** Pick one pattern. For tiles, `onClick` + `setLocation` is cleaner than wrapping the tile in `<Link>`.
- **Adding a redirect from `/` to `/home`:** D-10 explicitly says leave root as-is. Do not add a redirect.
- **Changing AuthGate to redirect anywhere other than `/home` on login:** Only this one redirect line changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role-gated visibility | Custom HOC or context check | `user?.role === "admin"` inline check | Role is already on the auth context; no abstraction needed at this scale |
| Dark mode tile variants | Per-component dark: variants | Tailwind v4 CSS token classes (`bg-card`, `border-border`) | Tokens already handle dark/light switching — BRAND-01 satisfied for free |
| i18n namespace | New namespace file | Flat keys in existing `en.json`/`de.json` | Project uses flat keys throughout; no namespace separation pattern exists |

---

## Common Pitfalls

### Pitfall 1: AuthGate redirect fires on every render
**What goes wrong:** If the `setLocation` call is not inside `useEffect` (it already is), the redirect runs on every render cycle, causing infinite loops.
**Why it happens:** `setLocation` is called unconditionally.
**How to avoid:** The existing `useEffect` with `[isLoading, user, location, setLocation]` deps is correct — only change the string `"/"` to `"/home"`.
**Warning signs:** Browser tab spinning, repeated redirect URL in history.

### Pitfall 2: `pointer-events-none` on tile prevents parent scroll on touch
**What goes wrong:** On mobile, if the tile grid itself has no other scrollable sibling, `pointer-events-none` on tiles is harmless. But if tiles are inside a scroll container, touch-scroll through them may not work.
**Why it happens:** `pointer-events-none` blocks all pointer events including touch.
**How to avoid:** Place `pointer-events-none` only on the tile card element, not the page container. The grid container must NOT have `pointer-events-none`.

### Pitfall 3: Fixed tile width prevents grid from being responsive
**What goes wrong:** Using `w-[120px]` as an explicit class on the tile forces it to 120px regardless of container — the grid column may be wider than 120px on large screens, leaving empty space or misalignment.
**Why it happens:** `w-[120px]` overrides the grid column's implicit sizing.
**How to avoid:** Apply `w-[120px]` and `h-[120px]` to the tile, but also set `justify-self-center` or let the grid's `auto-fill` handle centering. Alternatively, use `min-w-[120px] max-w-[120px]` within the grid cell.

### Pitfall 4: Missing import of LauncherPage in App.tsx
**What goes wrong:** Route renders nothing or throws.
**Why it happens:** Named export must match import style.
**How to avoid:** `LauncherPage` should be a named export (`export function LauncherPage`), imported as `import { LauncherPage } from "./pages/LauncherPage"` — consistent with all other page imports in App.tsx.

---

## Code Examples

### Full LauncherPage skeleton

```tsx
// frontend/src/pages/LauncherPage.tsx
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { LayoutDashboard, Box } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export function LauncherPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data } = useSettings();
  const settings = data ?? DEFAULT_SETTINGS;

  return (
    <div className="max-w-7xl mx-auto px-8 pt-16 pb-8 space-y-12">
      <h1 className="text-2xl font-medium">{settings.app_name}</h1>
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
      >
        {/* Active: KPI Dashboard */}
        <div
          onClick={() => setLocation("/sales")}
          className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                     flex flex-col items-center justify-center gap-2 p-4
                     cursor-pointer hover:bg-accent/10 transition-colors"
        >
          <LayoutDashboard className="w-10 h-10 text-foreground" />
          <span className="text-xs font-medium text-muted-foreground text-center truncate w-full">
            {t("launcher.tile.kpi_dashboard")}
          </span>
        </div>

        {/* Coming-soon tiles (3x) */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[120px] h-[120px] rounded-2xl bg-card border border-border
                       flex flex-col items-center justify-center gap-2 p-4
                       opacity-40 pointer-events-none"
          >
            <Box className="w-10 h-10 text-foreground" />
            <span className="text-xs font-medium text-muted-foreground text-center truncate w-full">
              {t("launcher.tile.coming_soon")}
            </span>
          </div>
        ))}

        {/* Admin-only tile example — no admin tiles in v1.14 */}
        {user?.role === "admin" && null}
      </div>
    </div>
  );
}
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure frontend code change, no new CLI tools, services, or runtimes needed beyond the existing project stack).

---

## Validation Architecture

No test framework is detected for the frontend (no `vitest.config.*`, `jest.config.*`, or `__tests__/` directory found). This phase is pure UI with no data-fetching logic — manual browser verification is the appropriate test strategy.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAUNCH-01 | `/home` renders grid after login | manual smoke | — | N/A |
| LAUNCH-02 | Tile cards are square, rounded, icon+label | manual visual | — | N/A |
| LAUNCH-03 | KPI tile click navigates to `/sales` | manual click | — | N/A |
| LAUNCH-04 | Coming-soon tiles have reduced opacity, no click | manual visual | — | N/A |
| LAUNCH-05 | Admin tiles absent for viewer role | manual with viewer login | — | N/A |
| AUTH-01 | Login success lands on `/home` | manual smoke | — | N/A |
| AUTH-02 | Direct `/home` access while unauthed → `/login` | manual smoke | — | N/A |
| BRAND-01 | Dark mode toggle works on `/home` | manual visual | — | N/A |
| BRAND-02 | Tile labels correct in DE and EN | manual language toggle | — | N/A |
| BRAND-03 | Page heading reflects Settings app name | manual settings edit | — | N/A |

**Wave 0 Gaps:** None — no automated test infrastructure expected for this phase.

---

## Sources

### Primary (HIGH confidence)

- `frontend/src/App.tsx` — verified routing pattern, Switch structure, import style
- `frontend/src/auth/AuthGate.tsx` — verified exact line (line 26) and redirect logic
- `frontend/src/auth/AuthContext.tsx` — verified `Role` type, `useAuth()` shape
- `frontend/src/components/NavBar.tsx` — verified `useSettings()` + `useAuth()` + `useTranslation()` combined usage pattern
- `frontend/src/locales/en.json` — verified flat key structure, no namespaces
- `.planning/phases/37-launcher-shell-auth-wiring/37-UI-SPEC.md` — verified spacing tokens, component specs, color tokens, copywriting contract
- `.planning/phases/37-launcher-shell-auth-wiring/37-CONTEXT.md` — verified all locked decisions

### Secondary (MEDIUM confidence)

- CLAUDE.md — project stack versions and Tailwind v4 CSS-variable strategy confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in existing source files
- Architecture: HIGH — patterns traced directly from existing components
- Pitfalls: MEDIUM — derived from code inspection and common React/Tailwind patterns; no production failures observed
- Auth wiring: HIGH — exact file and line identified in source

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable, no external API dependencies)
