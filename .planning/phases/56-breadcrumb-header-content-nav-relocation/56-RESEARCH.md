# Phase 56: Breadcrumb Header + Content-Nav Relocation — Research

**Researched:** 2026-04-21
**Domain:** React 19 + wouter routing + @base-ui/react Menu + Tailwind v4 + i18next
**Confidence:** HIGH

## Summary

Phase 56 strips all content/page controls from the top header (`NavBar.tsx`),
adds a breadcrumb trail, and consolidates Settings/Docs/Sign-out behind a
single user-menu dropdown. Sales/HR Toggle and Upload icon relocate into the
existing `SubHeader.tsx` on `/sales` and `/hr` only, preserving the existing
`AdminOnly` admin gate on upload.

Repo reconnaissance confirms every building block already exists:

- `wouter@3.9.0` exposes `useLocation()` + `useRoute(pattern)` — `useLocation`
  alone (returning the current pathname) is enough to drive a static
  route→label lookup per D-01.
- `@base-ui/react@1.3.0` Menu ships a `LinkItem` subpath — ideal for the
  Docs / Settings menu rows (preserves keyboard semantics + navigates via
  an `<a>` rather than an `onClick` + programmatic navigate).
- The Phase 55 `ui/dropdown.tsx` primitive is a thin wrapper over
  `@base-ui/react/menu` with **zero call sites today**; the user menu is
  its first consumer, which satisfies D-13 exactly.
- i18n is a **flat-dotted single-translation namespace** at
  `frontend/src/locales/{de,en}.json` (503 keys each today). Parity is
  enforced by `frontend/scripts/check-locale-parity.mts` comparing
  `Object.keys` sets. Every new key introduced this phase must land in
  both files.
- The existing `NavBar.tsx` already uses `wouter`'s `<Link href>` for
  route navigation — the breadcrumb crumbs reuse the same component.
- `SubHeader.tsx` already does per-route conditional rendering on
  `location === "/sales"` — the Toggle + Upload slots extend the same
  pattern without a new abstraction.

**Primary recommendation:** Mirror Phase 55's wave shape exactly:

- **Wave 1** adds `frontend/src/lib/breadcrumbs.ts` (route→label-key map) +
  `frontend/src/components/Breadcrumb.tsx` + `frontend/src/components/UserMenu.tsx`.
- **Wave 2** edits `NavBar.tsx` (strip content controls + wire Breadcrumb
  + UserMenu) and `SubHeader.tsx` (add Toggle + Upload on `/sales` `/hr`)
  in one plan (they share the `location`-driven conditional-render
  contract and should land atomically so the chrome is coherent at
  every commit).
- **Wave 3** removes the now-unused `lastDashboard` sessionStorage
  memory and the `nav.back_to_*` i18n keys; adds new `nav.home` +
  breadcrumb-label keys; runs `check-locale-parity.mts` gate.

Use base-ui's `Menu.LinkItem` for Docs/Settings rows so keyboard /
focus semantics are correct and `<a>` is rendered (screen readers treat
these as navigable links, not buttons). Use plain `Menu.Item onClick` for
Sign-out.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Breadcrumb source of truth (HDR-02)**
- **D-01:** Breadcrumb labels come from a **static route→label map**
  (`frontend/src/lib/breadcrumbs.ts`) keyed by route pattern, values
  are i18n keys. Lookup driven by `useLocation()` from `wouter`. No
  per-page register hook, no route-config refactor.
- **D-02:** **Dynamic segments are skipped as leaves.** For
  `/signage/playlists/:id`, the crumb renders `Home › Signage ›
  Playlists` — the dynamic id is the current page itself and isn't
  worth an extra crumb. No async name resolution needed.

**Breadcrumb depth & scope (HDR-02, HDR-03)**
- **D-03:** Breadcrumb renders on every route **except `/` (launcher)
  and `/login`**. On those routes, the top header has no crumb
  (launcher hides chrome entirely today; login is pre-auth).
- **D-04:** `Home` is always the first crumb on every non-excluded
  route and links to `/`. Localized via new i18n key `nav.home` — DE:
  `Start`, EN: `Home`. DE/EN key-count parity required (HDR-03).
- **D-05:** Separator is the lucide `ChevronRight` icon (not the `›`
  character), matching the existing lucide iconography in
  `NavBar.tsx`. Rendered as decorative (`aria-hidden`).
- **D-06:** The current (last) crumb renders as **plain muted text
  with `aria-current="page"`** — not a link. Prior crumbs render as
  `<a>` via wouter's `Link`. Matches HDR-02 wording (`<a>` links for
  navigable items) while avoiding the self-link a11y smell.

**Relocation targets (HDR-04)**
- **D-07:** The **Sales/HR segmented Toggle** moves to the
  **SubHeader left slot on `/sales` and `/hr` only**. Other routes
  don't render it. Today the SubHeader left slot holds the
  date-range filter on `/sales`; the Toggle joins that slot (planner
  decides arrangement — Toggle + DateRangeFilter stacked or
  side-by-side).
- **D-08:** The **Upload icon** moves to the **SubHeader right slot
  on `/sales` and `/hr` only**, preserving the existing `AdminOnly`
  gate. Still links to `/upload`. Not shown on signage, settings,
  docs, sensors.
- **D-09:** The **Settings gear, Docs shortcut, and Sign-out**
  consolidate into a **user menu dropdown** in the top header's right
  side (after theme + language toggles). This satisfies HDR-01's
  "user menu" wording and HDR-04's "per-page settings gear" removal
  in one move.
- **D-10:** The **contextual back-to-last-dashboard button**
  (currently shown on `/settings`, `/upload`, `/docs`) is **removed**.
  Breadcrumbs provide the way back. The existing `lastDashboard`
  sessionStorage memory can also be removed if nothing else depends
  on it (planner to verify grep — **research confirms: only
  NavBar.tsx reads/writes `lastDashboard`; safe to remove all five
  sites in one pass**).

**User menu (HDR-01)**
- **D-11:** **Trigger** is a circular initials avatar derived from the
  authenticated user's name/email (e.g. `JB`). Falls back to a generic
  lucide `User` icon if no name is available. Sized to match the
  other header icon buttons.
- **D-12:** **Menu contents (in order):**
  1. Non-interactive identity header row (name + email, muted)
  2. Divider
  3. Documentation → `/docs`
  4. Settings → `/settings`
  5. Divider
  6. Sign out (calls `signOut()` from `useAuth`)
- **D-13:** **Backed by the Phase 55 `Dropdown` primitive**
  (`ui/dropdown.tsx`). The Dropdown was scoped as an action-menu
  primitive with no current call sites — the user menu is its first
  consumer. No hand-rolled Popover.

### Claude's Discretion
- Exact visual sizing / spacing of the breadcrumb trail within the
  64px top header (alignment, gap, truncation at small widths)
- Whether `max-w-7xl` container needs adjustment to accommodate
  breadcrumb + user menu
- Whether to extract a shared `BREADCRUMB_ROUTES` constant alongside
  route config or keep it with the Breadcrumb component
- How the SubHeader arranges the new Sales/HR toggle + existing
  DateRangeFilter + upload icon (layout details — left-slot internal
  arrangement)
- Whether to add a subtle hover/focus style to the initials avatar
  beyond the primitive's default
- Exact initials derivation rule (first+last name? first 2 letters
  of email local-part? whichever works with current auth user
  shape). **Research finding: `AuthUser` shape is
  `{id, email, role}` — NO `name` field exists. Initials MUST derive
  from the email local-part (e.g. `johann.bechtold@…` → `JB`).**

### Deferred Ideas (OUT OF SCOPE)
- **Dynamic-name crumbs** (e.g., showing an actual playlist title on
  `/signage/playlists/:id`): not required in Phase 56. If needed
  later, introduce a `useBreadcrumb([...])` hook and per-page
  override; track as a follow-up.
- **User profile page / avatar upload**: the menu trigger uses
  initials only. Any real avatar image or profile-editing surface is
  a separate phase.
- **Command palette / keyboard nav shortcuts**: out of scope — top
  header stays mouse/icon driven.
- **Mobile-responsive behavior of breadcrumb trail** (truncation,
  collapse-to-dropdown): not explicitly scoped; planner may choose
  a simple overflow-ellipsis fallback, but a dedicated responsive
  pass can be a later phase if needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HDR-01 | Top header shows only brand/logo, user menu, language toggle, theme toggle. No content tabs, no route-specific actions, no in-header page controls. | NavBar currently renders: brand → Sales/HR Toggle (or ArrowLeft back-button) → ThemeToggle → LanguageToggle → Docs Library icon → Upload icon (AdminOnly) → Settings gear → Sign-out icon. All page controls on the right side collapse into a single `UserMenu` (Phase 55 `Dropdown`). Back button is removed (D-10). |
| HDR-02 | Top header renders `Home › Section › [Subsection]` breadcrumb derived from current route; items are `<a>` links. | Static `breadcrumbs.ts` map keyed by route pattern (D-01). `useLocation()` returns current pathname; matched against patterns (`/sales`, `/signage/playlists`, etc.) — see §Pattern 2 for match order. Crumbs render as wouter `<Link>` (which renders `<a>`); current crumb renders as `<span aria-current="page">` (D-06). |
| HDR-03 | Breadcrumb items are keyboard-navigable (Tab/Enter) and localized DE/EN with full key parity. | wouter `<Link>` renders a native `<a>` — Tab/Enter work by default; Enter triggers navigation via wouter's click handler. New keys land in both locale files; CI gate is `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` — exits 1 on any missing key in either direction. |
| HDR-04 | Sales/HR toggle, upload button, per-page settings gear migrate to SubHeader or owning page. | Sales/HR Toggle → SubHeader left slot on `/sales` + `/hr` (D-07). Upload icon → SubHeader right slot on `/sales` + `/hr`, AdminOnly gate preserved (D-08). Settings gear → user-menu Settings row (D-09). Docs shortcut also folds into user menu. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **React 19.2.x + TypeScript + Vite 8 + Tailwind v4 + `@base-ui/react`** (NOT Radix).
- **No `tailwind.config.js`** — Tailwind v4 is CSS-first.
- **Primitives** live under `frontend/src/components/ui/`. Consumer
  components (Breadcrumb, UserMenu) live directly under
  `frontend/src/components/`.
- **GSD Workflow Enforcement:** start work via GSD commands; no direct
  edits outside a GSD workflow.
- **v1.19 cross-cutting hazards** (from STATE.md): DE/EN i18n parity,
  no `dark:` variants (use tokens — **NOTE: NavBar currently contains no
  `dark:` variants; keep it that way**), visible focus ring on every
  migrated control, pure frontend only (no backend changes).

## Standard Stack

### Core (already installed — verified against `frontend/package.json` + `node_modules/`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wouter | 3.9.0 | Routing — `useLocation()` drives breadcrumb; `<Link>` renders `<a>` crumbs | Already the project router; no alternative. `useLocation()` returns `[pathname, navigate]`; pathname is all the breadcrumb needs. |
| @base-ui/react | 1.3.0 | Menu primitive for user-menu dropdown; exports `Menu.LinkItem` for `<a>`-rendering menu rows | Same family as Phase 55's `Dropdown` wrapper. `Menu.LinkItem` provides proper `<a>` + menuitem semantics + keyboard nav without custom code. |
| lucide-react | 1.8.0 | `ChevronRight` (separator, D-05), `User` (avatar fallback, D-11), existing `Upload`, `Settings`, `Library`, `LogOut` icons (already imported in NavBar) | Existing iconography; do not introduce a second icon library. |
| i18next + react-i18next | 26.x / 17.x | Breadcrumb labels via `t()` | Existing setup in `frontend/src/i18n.ts`; flat-dotted keys with `keySeparator: false`. |
| tailwind-merge + clsx (`cn`) | 3.5.0 / 2.1.1 | Class composition | Existing `@/lib/utils` helper. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @testing-library/react | installed | Unit tests for Breadcrumb + UserMenu + breadcrumbs.ts lookup | Phase 55 template: `Breadcrumb.test.tsx`, `UserMenu.test.tsx`, `lib/breadcrumbs.test.ts` (pure function). jsdom env already configured in `vitest.config.ts`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Phase 55 `Dropdown` primitive | Hand-rolled `<Popover>` + button list | Rejected by D-13. Also: Popover does not give menuitem / roving-tabindex / auto-focus-restoration semantics — would fail HDR-01 a11y implicitly. |
| `Menu.LinkItem` (base-ui) | `Menu.Item` + wouter `navigate()` onClick | Rejected — `Menu.Item` renders `<div role=menuitem>`, which denies users the standard open-in-new-tab / right-click-copy-link affordance. `Menu.LinkItem` renders `<a>` and keyboard-activates via Enter naturally. |
| lucide `ChevronRight` | literal `›` character | Rejected by D-05. |
| Route-config tree (declarative) | Static map | Rejected by D-01 — map is simpler, no refactor of `App.tsx` route list. |
| shadcn/ui `Breadcrumb` component | Hand-rolled Breadcrumb | shadcn's Breadcrumb is Radix-flavored and targets `asChild`; this project uses `@base-ui/react` with `render`-prop pattern. Translating shadcn template to base-ui is more work than writing the ~40-line Breadcrumb component directly. Hand-roll. |

**Installation:** No new packages required. Everything ships in already-installed deps.

**Version verification:** Not applicable — no new packages. `wouter@3.9.0`, `@base-ui/react@1.3.0`, and `lucide-react@1.8.0` confirmed via `frontend/package.json`. 503-key DE/EN parity confirmed via `wc -l frontend/src/locales/*.json` + existing CI gate.

## Architecture Patterns

### Recommended File Layout

```
frontend/src/
├── lib/
│   ├── breadcrumbs.ts          # NEW — static route→label-key map + matcher
│   └── breadcrumbs.test.ts     # NEW — pure-function unit tests
├── components/
│   ├── Breadcrumb.tsx          # NEW — renders crumbs for current location
│   ├── Breadcrumb.test.tsx     # NEW — render + keyboard + aria-current
│   ├── UserMenu.tsx            # NEW — initials avatar + Dropdown consumer
│   ├── UserMenu.test.tsx       # NEW — render + item clicks + signOut
│   ├── NavBar.tsx              # EDIT — strip content controls, wire Breadcrumb + UserMenu
│   └── SubHeader.tsx           # EDIT — add Sales/HR Toggle + Upload on /sales & /hr
└── locales/
    ├── de.json                 # EDIT — add nav.home, breadcrumb.*, userMenu.* keys
    └── en.json                 # EDIT — mirror every new key
```

### Pattern 1: Route → label-key Map (`lib/breadcrumbs.ts`)

```tsx
// Source: .planning/phases/56-.../56-CONTEXT.md D-01, D-02; wouter route table in App.tsx
// frontend/src/lib/breadcrumbs.ts

/**
 * Static route→breadcrumb-label-key map. Values are i18n keys resolved via t().
 *
 * Each entry is an ORDERED chain of crumbs (excluding the implicit Home crumb,
 * which is prepended at render time, D-04). Leaf order == display order.
 *
 * Dynamic segments (e.g. /signage/playlists/:id) MUST resolve to the pattern
 * that owns the dynamic segment (parent "playlists" as leaf, D-02). The matcher
 * walks patterns longest-first so `/signage/playlists/:id` matches before the
 * generic `/signage/playlists`.
 */
export type BreadcrumbEntry = {
  /** i18n key for this crumb label. */
  labelKey: string;
  /** Href for this crumb. Omit on the leaf pattern when it equals the
   *  current route itself (the renderer always renders the last crumb
   *  as aria-current="page", D-06). */
  href?: string;
};

export const BREADCRUMB_ROUTES: ReadonlyArray<{
  pattern: string; // wouter-flavoured path pattern (":id" segments allowed)
  trail: ReadonlyArray<BreadcrumbEntry>;
}> = [
  // Dashboards
  { pattern: "/sales", trail: [{ labelKey: "nav.sales", href: "/sales" }] },
  { pattern: "/hr", trail: [{ labelKey: "nav.hr", href: "/hr" }] },
  // Upload
  { pattern: "/upload", trail: [{ labelKey: "nav.upload", href: "/upload" }] },
  // Sensors (dashboard)
  { pattern: "/sensors", trail: [{ labelKey: "sensors.title", href: "/sensors" }] },
  // Settings tree — note order (deeper first so matcher picks specific)
  { pattern: "/settings/sensors", trail: [
      { labelKey: "nav.settings", href: "/settings" },
      { labelKey: "settings.sensors_link.title", href: "/settings/sensors" },
    ] },
  { pattern: "/settings", trail: [{ labelKey: "nav.settings", href: "/settings" }] },
  // Docs tree — :section/:slug → parent "Documentation" leaf (D-02)
  { pattern: "/docs/:section/:slug", trail: [{ labelKey: "docs.nav.docsLabel", href: "/docs" }] },
  { pattern: "/docs", trail: [{ labelKey: "docs.nav.docsLabel", href: "/docs" }] },
  // Signage — each sub-route gets its own leaf
  { pattern: "/signage/playlists/:id", trail: [
      { labelKey: "signage.admin.page_title", href: "/signage/media" },
      { labelKey: "signage.admin.nav.playlists", href: "/signage/playlists" },
    ] },
  { pattern: "/signage/playlists", trail: [
      { labelKey: "signage.admin.page_title", href: "/signage/media" },
      { labelKey: "signage.admin.nav.playlists", href: "/signage/playlists" },
    ] },
  { pattern: "/signage/devices", trail: [
      { labelKey: "signage.admin.page_title", href: "/signage/media" },
      { labelKey: "signage.admin.nav.devices", href: "/signage/devices" },
    ] },
  { pattern: "/signage/media", trail: [
      { labelKey: "signage.admin.page_title", href: "/signage/media" },
      { labelKey: "signage.admin.nav.media", href: "/signage/media" },
    ] },
  { pattern: "/signage/schedules", trail: [
      { labelKey: "signage.admin.page_title", href: "/signage/media" },
      { labelKey: "signage.admin.nav.schedules", href: "/signage/schedules" },
    ] },
  { pattern: "/signage/pair", trail: [
      { labelKey: "signage.admin.page_title", href: "/signage/media" },
      { labelKey: "breadcrumb.signage.pair", href: "/signage/pair" },
    ] },
] as const;

/**
 * Match a pathname against the route table. Returns the trail for the first
 * matching pattern, or null for routes excluded from breadcrumbs (/, /login)
 * or unknown routes.
 *
 * Dynamic segments (":id") match any non-empty segment with no "/".
 */
export function matchBreadcrumb(pathname: string): ReadonlyArray<BreadcrumbEntry> | null {
  if (pathname === "/" || pathname === "/login") return null;
  for (const { pattern, trail } of BREADCRUMB_ROUTES) {
    if (matchesPattern(pathname, pattern)) return trail;
  }
  return null;
}

function matchesPattern(pathname: string, pattern: string): boolean {
  const pSegs = pathname.split("/").filter(Boolean);
  const tSegs = pattern.split("/").filter(Boolean);
  if (pSegs.length !== tSegs.length) return false;
  return tSegs.every((t, i) => t.startsWith(":") ? (pSegs[i] ?? "").length > 0 : t === pSegs[i]);
}
```

**Why this shape:**
- Order-matters list (not object map) so planner can put specific
  patterns (`/settings/sensors`) **before** less-specific ones
  (`/settings`) and the matcher picks the first hit. Avoids sort complexity.
- Trail is a flat `[parent?, leaf]` array; renderer prepends Home and
  renders the last entry as `aria-current="page"` plain text (D-06).
- Labels are `labelKey` strings (not pre-resolved text), so the matcher
  is locale-agnostic and can be unit-tested without an i18n provider.
- `BREADCRUMB_ROUTES` is `as const` → readonly; TS catches drift.

### Pattern 2: Breadcrumb Component (`components/Breadcrumb.tsx`)

```tsx
// Source: CONTEXT D-04/D-05/D-06 + wouter Link rendering <a>
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { matchBreadcrumb } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

export function Breadcrumb() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const trail = matchBreadcrumb(location);
  if (!trail) return null; // /, /login, or unmapped routes

  // Prepend implicit Home crumb (D-04). Home is always a link — never the leaf.
  const crumbs = [{ labelKey: "nav.home", href: "/" }, ...trail];

  return (
    <nav aria-label={t("breadcrumb.aria_label")} className="flex items-center gap-1.5 text-sm">
      <ol className="flex items-center gap-1.5">
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />}
              {isLast ? (
                <span aria-current="page" className="text-muted-foreground">
                  {t(c.labelKey)}
                </span>
              ) : (
                <Link
                  href={c.href ?? "/"}
                  className={cn(
                    "text-foreground hover:text-primary transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                  )}
                >
                  {t(c.labelKey)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

**A11y notes:**
- Wrap in `<nav aria-label>` — screen readers announce it as a
  breadcrumb landmark.
- `<ol>` (ordered list) conveys the hierarchy, not `<ul>`.
- Separator is `aria-hidden` (D-05).
- Last crumb uses `aria-current="page"` + NOT a link (D-06).
- wouter `<Link>` renders `<a href>`; Tab focuses it, Enter navigates
  (HDR-03 satisfied natively — no custom keyboard handler needed).
- Focus-visible ring uses existing `--ring` token for parity with
  other nav focus rings.

### Pattern 3: User Menu (`components/UserMenu.tsx`)

```tsx
// Source: CONTEXT D-09, D-11, D-12, D-13; base-ui Menu.LinkItem exists at
// /frontend/node_modules/@base-ui/react/menu/link-item/ (verified 2026-04-21)
import { useTranslation } from "react-i18next";
import { LogOut, User as UserIcon } from "lucide-react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { useAuth } from "@/auth/useAuth";
import { cn } from "@/lib/utils";

// Initials from email local-part (AuthUser has no `name` field — verified
// via /frontend/src/auth/AuthContext.tsx). "johann.bechtold@x.com" → "JB".
// Fallback: first 2 chars of local-part uppercased. No local-part → null.
function initialsFrom(email: string): string | null {
  const local = email.split("@")[0];
  if (!local) return null;
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  if (!user) return null; // AuthGate normally prevents this, but be defensive.

  const initials = initialsFrom(user.email);

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={t("userMenu.triggerLabel")}
        className={cn(
          "inline-flex items-center justify-center rounded-full size-9 bg-muted text-sm font-medium",
          "hover:bg-accent/20 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {initials ?? <UserIcon className="h-5 w-5" aria-hidden />}
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-56">
        {/* Identity header row — NON-interactive, muted (D-12 #1) */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="font-medium text-foreground truncate">{user.email.split("@")[0]}</div>
          <div className="truncate">{user.email}</div>
        </div>
        <DropdownSeparator />
        {/* Menu.LinkItem renders <a> — Tab/Enter navigate, right-click copies link */}
        <MenuPrimitive.LinkItem
          href="/docs"
          data-slot="dropdown-link-item"
          className={cn(
            "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm outline-none",
            "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
          )}
        >
          {t("userMenu.docs")}
        </MenuPrimitive.LinkItem>
        <MenuPrimitive.LinkItem
          href="/settings"
          data-slot="dropdown-link-item"
          className={cn(
            "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm outline-none",
            "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
          )}
        >
          {t("userMenu.settings")}
        </MenuPrimitive.LinkItem>
        <DropdownSeparator />
        <DropdownItem
          onClick={() => void signOut()}
          className="text-destructive data-[highlighted]:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {t("userMenu.signOut")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
```

**Notes:**
- `Menu.LinkItem` renders a real `<a href>` — wouter will NOT
  intercept the click (wouter's `<Link>` is the client-router wrapper).
  See §Pitfall 3 for the fix options; recommended approach is to wrap
  `LinkItem` with wouter's `Link` via the `render` prop pattern. OR
  accept a full-page navigation for two surfaces (Docs, Settings) —
  acceptable for an internal tool and keeps code simple. **Planner
  decides.** Research-preferred: wouter `Link` wrap (see Pitfall 3).
- DropdownTrigger accepts className directly because the existing
  `ui/dropdown.tsx` passes it through to `@base-ui/react/menu/trigger`.
- The identity header is a plain `<div>` (NOT a `Menu.Item`) — base-ui
  Items are focusable + in the roving-tabindex; non-interactive rows
  should NOT be menu items.

### Pattern 4: NavBar Refactor

After D-01..D-13, `NavBar.tsx` becomes roughly 50 lines (currently 157):

```tsx
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { UserMenu } from "@/components/UserMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

export function NavBar() {
  const [location] = useLocation();
  const isLauncher = location === "/";
  const { data } = useSettings();
  const settings = data ?? DEFAULT_SETTINGS;

  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center gap-6">
        {/* Brand slot — unchanged */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          {settings.logo_url != null && (
            <img src={settings.logo_url} alt={settings.app_name}
                 className="max-h-8 max-w-8 object-contain" />
          )}
          <span className="text-sm font-medium">{settings.app_name}</span>
        </Link>
        {/* Breadcrumb — suppressed on launcher; returns null on /login anyway (AppShell skips NavBar there) */}
        {!isLauncher && <Breadcrumb />}
        {/* Right side: global identity only (HDR-01) */}
        <div className="ml-auto flex items-center gap-4">
          <ThemeToggle />
          <LanguageToggle />
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
```

**Removed from NavBar:**
- `useEffect` writing `lastDashboard` to sessionStorage (+ getter)
- Back-to-dashboard `<Button variant="ghost"><ArrowLeft>` block
- Sales/HR `<Toggle>` block (moves to SubHeader)
- Docs `<Link>` icon
- Upload `<AdminOnly><Link>` icon (moves to SubHeader)
- Settings gear `<Link>` icon
- Sign-out `<Button>` icon
- `ArrowLeft`, `UploadIcon`, `SettingsIcon`, `LogOut`, `Library` lucide imports (all moved into UserMenu/SubHeader)
- `useAuth` (moves to UserMenu)
- `AdminOnly` (moves to SubHeader with Upload)
- `Toggle`, `Button` imports

### Pattern 5: SubHeader Refactor (Toggle + Upload on `/sales` and `/hr`)

```tsx
// Existing SubHeader already uses per-route conditionals (location === "/sales").
// Extend that pattern — do NOT introduce a new abstraction.

// (imports already present: useLocation, useTranslation, useDateRange, ...)
import { Link } from "wouter";
import { Upload as UploadIcon } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { AdminOnly } from "@/auth/AdminOnly";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";

export function SubHeader() {
  const [location, navigate] = useLocation();
  const { preset, range, handleFilterChange } = useDateRange();
  const { t } = useTranslation();
  if (location === "/") return null;

  const isDashboard = location === "/sales" || location === "/hr";

  return (
    <div className="fixed top-16 inset-x-0 h-12 bg-background z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Left slot: dashboard controls on /sales and /hr */}
        <div className="flex items-center gap-3">
          {isDashboard && (
            <Toggle
              segments={[
                { value: "/sales", label: t("nav.sales") },
                { value: "/hr", label: t("nav.hr") },
              ] as const}
              value={location === "/hr" ? "/hr" : "/sales"}
              onChange={(path) => navigate(path)}
              aria-label={t("nav.dashboardToggleLabel")}
              className="border-transparent"
            />
          )}
          {location === "/sales" && (
            <DateRangeFilter value={range} preset={preset} onChange={handleFilterChange} />
          )}
        </div>
        {/* Right slot: existing freshness indicators + new Upload icon on dashboards */}
        <div className="flex items-center gap-3">
          {isDashboard && (
            <AdminOnly>
              <Link
                href="/upload"
                aria-label={t("nav.upload")}
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-1.5 hover:bg-accent/10 transition-colors",
                  location === "/upload" ? "text-primary" : "text-foreground",
                )}
              >
                <UploadIcon className="h-4 w-4" />
              </Link>
            </AdminOnly>
          )}
          {location === "/sensors" ? (
            <SensorFreshnessIndicator />
          ) : location === "/hr" ? (
            <HrFreshnessIndicator />
          ) : (
            <FreshnessIndicator />
          )}
        </div>
      </div>
    </div>
  );
}
```

**Planner's discretion (per CONTEXT):** Exact left-slot arrangement of
Toggle + DateRangeFilter (`gap-3` side-by-side shown above is a
reasonable default).

**Note:** SubHeader height stays `h-12`; total chrome remains `64+48 =
112px` → `pt-28` in AppShell is unchanged.

### Anti-Patterns to Avoid

- **Deriving crumb labels by splitting pathname** — e.g.,
  `/signage/playlists` → ["Signage", "Playlists"]. Labels must be
  localized via i18n keys; pathname-based derivation breaks DE/EN
  parity (HDR-03).
- **Rendering Home crumb inside the map** — D-04 says "always first";
  simplest impl prepends at render time (see Pattern 2). Putting it
  in every map entry is redundant and error-prone.
- **Using wouter `<Link>` inside `Menu.Item onClick`** — wouter's
  client-side navigation triggers on click AND Enter, but `Menu.Item`
  swallows some events. Use `Menu.LinkItem` (native `<a>`) or wrap
  LinkItem with `render={<WouterLink />}`.
- **Programmatic `navigate()` in a menu item's onClick** — works but
  denies open-in-new-tab / right-click affordance. Prefer `<a>`.
- **Keeping `lastDashboard` sessionStorage writes** — five code sites
  reference it, all in `NavBar.tsx`. Remove them all or leave none
  (no partial state).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Breadcrumb a11y semantics (landmark, list, current-page) | Custom div flex with spans | `<nav aria-label>`, `<ol>`, `aria-current="page"` — see Pattern 2 | Three attributes; SR support is native; no library needed. |
| Menu roving-tabindex / Enter-activation / focus-restoration | Custom keyboard handler | `@base-ui/react/menu` (via Phase 55 `Dropdown`) | Already chosen in D-13. |
| Route-pattern matching with `:id` segments | Regex per route | ~10-line `matchesPattern` helper in `breadcrumbs.ts` (Pattern 1) | Our patterns are trivially shaped (`/a/:x/b`); full pattern lib (path-to-regexp) is overkill. regexparam is available (wouter bundles it) but exposes no stable public API. |
| Initials generation | Word-frequency / NLP | Split local-part on `.-_`, take first-letters | `AuthUser` has only `email`; trivial; mirror the Gmail/Gitea convention. |
| Focus ring | Per-element color classes | Existing `focus-visible:ring-2 focus-visible:ring-ring` tokens | Matches Phase 55 CTRL-04 invariant. |

**Key insight:** Every building block already exists in this codebase
(wouter Link + useLocation, Phase 55 Dropdown, base-ui Menu.LinkItem,
lucide icons, tailwind-merge). This phase is composition, not
primitive engineering — do NOT introduce a new library.

## Common Pitfalls

### Pitfall 1: Pre-existing TS errors in `SalesTable.tsx` / others mask regressions
**What goes wrong:** `npm run build` fails on `tsc -b` due to 5 pre-existing files (documented in Phase 54's `deferred-items.md`).
**Why it happens:** Accumulated tech debt; not caused by this phase.
**How to avoid:** Verify each edit with scoped `cd frontend && npx tsc --noEmit` against the specific touched file. Do NOT gate on full-repo build.
**Warning signs:** `npm run build` green before Phase 56 starts (it isn't).

### Pitfall 2: Breadcrumb matcher order vs. wouter route declaration order
**What goes wrong:** Planner copies route list from `App.tsx` verbatim into `BREADCRUMB_ROUTES`, but `App.tsx` lists `/signage/playlists/:id` BEFORE `/signage/playlists` (wouter Switch "first match wins"). The breadcrumb matcher in Pattern 1 ALSO walks top-down — fine — but `/settings/sensors` MUST come before `/settings` or `/settings/sensors` matches `/settings` (because `matchesPattern` checks segment count equality, but if someone swaps it to startsWith later…).
**Why it happens:** Lookalike-but-different route-matching semantics between wouter Switch and the breadcrumb matcher.
**How to avoid:** Pattern 1's `matchesPattern` uses strict segment-count equality — so `/settings/sensors` vs `/settings` cannot collide by accident. Still, keep deeper-before-shallower order in the `BREADCRUMB_ROUTES` array so the code is robust to future helper changes. Add a unit test that locks the order (see `breadcrumbs.test.ts` suggestions below).
**Warning signs:** `/settings/sensors` page shows `Home › Settings` instead of `Home › Settings › Sensor monitoring`.

### Pitfall 3: `Menu.LinkItem` href triggers a full page navigation, bypassing wouter
**What goes wrong:** `<MenuPrimitive.LinkItem href="/docs">` renders a plain `<a>` — browser treats the click as a full navigation (200ms blank flash, React unmounts, re-bootstraps).
**Why it happens:** wouter's client-side routing ONLY intercepts clicks on its own `<Link>` component (not arbitrary `<a>` tags).
**How to avoid:** Two workable options:

1. **Preferred:** Use base-ui's `render` prop to compose `Menu.LinkItem` with a wouter `<Link>`:
   ```tsx
   import { Link as WouterLink } from "wouter";
   <MenuPrimitive.LinkItem
     href="/docs"
     render={<WouterLink href="/docs" />}
     className="..."
   >
     {t("userMenu.docs")}
   </MenuPrimitive.LinkItem>
   ```
   **But verify first** — the `render` prop merges the rendered element with base-ui's internal attrs; wouter's `<Link>` might not forward all data-* attrs needed for `data-highlighted`. If it doesn't, use option 2.

2. **Fallback:** Use `Menu.Item` with `onClick={() => navigate("/docs")}`. Accept the loss of open-in-new-tab affordance. Acceptable for an internal tool if option 1 proves fiddly.

**How to verify:** Manually click Docs from Sales page — URL should change without the page flashing blank / React console "bootstrapping".

**Warning signs:** Docs / Settings clicks cause full reload (network tab shows `index.html` request).

### Pitfall 4: DropdownTrigger `className` passthrough
**What goes wrong:** Styling the initials avatar via `className` on `DropdownTrigger` — base-ui's `Menu.Trigger` DOES forward `className` to its rendered `<button>`, so this works. But the `ui/dropdown.tsx` wrapper doesn't explicitly thread `className`; it forwards via `{...props}`.
**Why it happens:** Assumption that thin wrappers always pass props.
**How to avoid:** Confirmed by reading `ui/dropdown.tsx` — it spreads `{...props}` into `MenuPrimitive.Trigger`, which accepts `className`. Safe. If the planner touches `ui/dropdown.tsx` to tighten types, keep the spread.
**Warning signs:** Avatar renders unstyled (default button look) despite passing `className`.

### Pitfall 5: `lastDashboard` sessionStorage dangling reference
**What goes wrong:** D-10 removes the back button and the `lastDashboard` memory. But if the cleanup sweep misses one reference, TS errors OR dead writes.
**Why it happens:** Grep sweep missed one call site.
**How to avoid:** **Research confirmed: `rg -n "lastDashboard" frontend/src` returns FIVE hits, all in `frontend/src/components/NavBar.tsx` (lines 12, 47, 54, 55, 92). No other file references it.** Removing them all with NavBar's refactor leaves zero references — include a CI grep guard `rg -q "lastDashboard" frontend/src && exit 1 || true` as a post-edit check.
**Warning signs:** `rg lastDashboard frontend/src` returns any hit after Phase 56.

### Pitfall 6: DE/EN i18n key-count divergence
**What goes wrong:** New `nav.home` / `userMenu.*` / `breadcrumb.*` keys land in EN but get forgotten in DE. `check-locale-parity.mts` fails in CI.
**Why it happens:** Two-file edits are easy to miss.
**How to avoid:** Every new key lands in BOTH files in the same plan task. Gate: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts` must print `PARITY OK: N keys in both`.
**Warning signs:** CI output includes `MISSING_IN_DE: nav.home` or similar.

### Pitfall 7: `breadcrumb.aria_label` and `nav.dashboardToggleLabel` new keys forgotten
**What goes wrong:** Patterns 2 and 5 above reference i18n keys that don't exist today (`breadcrumb.aria_label`, `nav.dashboardToggleLabel`, `userMenu.triggerLabel`, `userMenu.docs`, `userMenu.settings`, `userMenu.signOut`, `breadcrumb.signage.pair`, `nav.home`). Missing any = `t("...")` returns the key string — ugly UI.
**Why it happens:** Invisible keys (aria-label, trigger-label) are easy to miss in QA.
**How to avoid:** Planner's i18n task explicitly lists ALL new keys added this phase:
  - `nav.home` — DE `Start`, EN `Home`
  - `breadcrumb.aria_label` — DE `Brotkrumen`, EN `Breadcrumb`
  - `breadcrumb.signage.pair` — DE `Koppeln`, EN `Pair`
  - `userMenu.triggerLabel` — DE `Benutzermenü`, EN `User menu`
  - `userMenu.docs` — DE `Dokumentation`, EN `Documentation`
  - `userMenu.settings` — DE `Einstellungen`, EN `Settings`
  - `userMenu.signOut` — DE `Abmelden`, EN `Sign out`
  - `nav.dashboardToggleLabel` — DE `Dashboard-Auswahl`, EN `Dashboard`
  **Obsolete keys to remove:** `nav.back`, `nav.back_to_sales`, `nav.back_to_hr` (3 keys × 2 files = 6 entries).
**Warning signs:** UI shows `breadcrumb.aria_label` literal or `userMenu.docs` literal.

### Pitfall 8: base-ui Menu requires a Portal — z-index fights with fixed NavBar
**What goes wrong:** `NavBar` is `z-50` (fixed top-0). `Dropdown`'s `Menu.Popup` renders in a portal and needs to layer ABOVE the header for the identity-header row to appear below the trigger.
**Why it happens:** Portal defaults to document.body with no z-index.
**How to avoid:** `ui/dropdown.tsx` already applies `isolate z-50` on the `Positioner` and `z-50` on the `Popup` — confirmed by reading the file. No extra work.
**Warning signs:** User menu popup appears BEHIND the NavBar or other fixed surfaces (none present on these routes).

## Runtime State Inventory

> Phase 56 is a pure frontend component refactor. Still, the "runtime state" checklist is useful because D-10 removes a sessionStorage key.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Browser `sessionStorage.lastDashboard`** (set by NavBar.tsx:47, read by NavBar.tsx:12) — written when user visits `/sales` or `/hr`. Value will be orphaned in every authenticated user's tab/window after deploy. | None — `sessionStorage` is per-tab and clears on tab close. Orphan key is harmless (not read by anything post-deploy). No migration task needed. |
| Live service config | None — phase is pure frontend. | None |
| OS-registered state | None. | None |
| Secrets / env vars | None. | None |
| Build artifacts / installed packages | None — no new deps. | None |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — Only stale `sessionStorage.lastDashboard` values in existing browser tabs. Harmless (unread). No action.

## Code Examples

### breadcrumbs.ts unit tests (conceptual — drives implementation)

```ts
// frontend/src/lib/breadcrumbs.test.ts
import { describe, it, expect } from "vitest";
import { matchBreadcrumb } from "./breadcrumbs";

describe("matchBreadcrumb", () => {
  it("returns null for / (launcher)", () => expect(matchBreadcrumb("/")).toBeNull());
  it("returns null for /login", () => expect(matchBreadcrumb("/login")).toBeNull());
  it("returns null for unknown route", () => expect(matchBreadcrumb("/foo")).toBeNull());
  it("matches /sales", () => {
    expect(matchBreadcrumb("/sales")?.[0].labelKey).toBe("nav.sales");
  });
  it("matches /settings/sensors BEFORE /settings (specificity)", () => {
    const t = matchBreadcrumb("/settings/sensors");
    expect(t?.map((c) => c.labelKey)).toEqual(["nav.settings", "settings.sensors_link.title"]);
  });
  it("matches dynamic /signage/playlists/:id to Playlists leaf", () => {
    const t = matchBreadcrumb("/signage/playlists/abc-123");
    expect(t?.map((c) => c.labelKey)).toEqual([
      "signage.admin.page_title",
      "signage.admin.nav.playlists",
    ]);
  });
  it("matches /docs/user/intro", () => {
    const t = matchBreadcrumb("/docs/user/intro");
    expect(t?.[0].labelKey).toBe("docs.nav.docsLabel");
  });
});
```

### Breadcrumb render test (keyboard + aria-current)

```tsx
// frontend/src/components/Breadcrumb.test.tsx
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { Breadcrumb } from "./Breadcrumb";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <I18nextProvider i18n={i18n}>
      <Router hook={hook}>
        <Breadcrumb />
      </Router>
    </I18nextProvider>,
  );
}

describe("Breadcrumb", () => {
  it("renders nothing on /", () => {
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });
  it("renders Home › Settings › Sensor monitoring on /settings/sensors", () => {
    renderAt("/settings/sensors");
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    const items = nav.querySelectorAll("li");
    expect(items).toHaveLength(3);
  });
  it("last crumb has aria-current=page and is not a link", () => {
    renderAt("/sales");
    const current = screen.getByText(/sales/i);
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.tagName).toBe("SPAN");
  });
  it("non-leaf crumbs are <a> links", () => {
    renderAt("/settings/sensors");
    const home = screen.getByRole("link", { name: /home/i });
    expect(home.tagName).toBe("A");
    expect(home.getAttribute("href")).toBe("/");
  });
});
```

### UserMenu render test (items, sign-out, initials)

```tsx
// frontend/src/components/UserMenu.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { UserMenu } from "./UserMenu";
import { AuthContext } from "@/auth/AuthContext";

function withAuth(user: { email: string } | null, signOut = vi.fn()) {
  return render(
    <AuthContext.Provider value={{
      user: user ? { id: "u1", email: user.email, role: "admin" } : null,
      role: user ? "admin" : null,
      isLoading: false,
      signIn: vi.fn(),
      signOut,
    }}>
      <UserMenu />
    </AuthContext.Provider>,
  );
}

describe("UserMenu", () => {
  it("renders JB initials for johann.bechtold@…", () => {
    withAuth({ email: "johann.bechtold@example.com" });
    expect(screen.getByLabelText(/user menu/i)).toHaveTextContent("JB");
  });
  it("renders fallback icon for single-word local-part", () => {
    withAuth({ email: "admin@example.com" });
    expect(screen.getByLabelText(/user menu/i)).toHaveTextContent("AD");
  });
  it("calls signOut on Sign out click", async () => {
    const signOut = vi.fn();
    withAuth({ email: "a@b.c" }, signOut);
    await userEvent.click(screen.getByLabelText(/user menu/i));
    await userEvent.click(await screen.findByText(/sign out/i));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Breadcrumb driven by React Router `matchRoutes` against declarative route tree | Breadcrumb driven by `useLocation` + static map | (project-specific) | Works with wouter (no declarative tree); simpler; keeps routes as flat `<Switch>`. |
| Menu via Radix `DropdownMenu` | @base-ui/react `Menu` | 2024-Q3 | Same team; `render` prop replaces `asChild`; already adopted in this repo. |
| `<nav>` with chevron text | `<nav aria-label>` + `<ol>` + lucide ChevronRight + `aria-current="page"` | W3C APG 2023 | SR landmark + ordered list semantics now standard. |

**Deprecated / not used here:**
- `react-router-dom` — not installed.
- `@radix-ui/*` — not installed; do NOT mix.
- shadcn/ui Breadcrumb component copies — Radix-flavored; translate to
  wouter + base-ui manually (or just hand-roll, as recommended).

## Open Questions

1. **Should `Menu.LinkItem` render via `render={<WouterLink />}` (client-side nav) or accept full page reload on Docs/Settings?**
   - What we know: `Menu.LinkItem` ships a real `<a href>`. wouter only intercepts clicks on its own `<Link>` component. Full reload works but is ugly.
   - What's unclear: Whether base-ui's `render` prop cleanly merges wouter `<Link>`'s `onClick` with base-ui's internal menu-item-close behavior.
   - Recommendation: Planner tries the `render={<WouterLink href="/docs" />}` approach first in the Wave 1 prototype. If it breaks (lost `data-highlighted`, or Menu doesn't close after click), fall back to `Menu.Item onClick={() => navigate("/docs")}` for those two rows. Document the chosen path in SUMMARY.

2. **Does `/signage/pair` need a dedicated "Pair" crumb leaf or should it inherit from a generic signage parent?**
   - What we know: `App.tsx` routes `/signage/pair` to `PairPage`; no existing i18n key for "Pair" in locales.
   - What's unclear: Whether current users navigate to `/signage/pair` frequently enough to warrant a crumb leaf vs. showing `Home › Digital Signage`.
   - Recommendation: Add a new key `breadcrumb.signage.pair` (DE `Koppeln`, EN `Pair`) for explicit naming. Trivial; follows HDR-03 spirit (every route has a clear crumb).

3. **Does the identity-header row in the dropdown need to link to anything?**
   - What we know: D-12 #1 says "Non-interactive identity header row" — explicit.
   - What's unclear: Nothing. Locked. Render as `<div>`, not `<Menu.Item>`.
   - Recommendation: Confirm in plan — do NOT make it a menu item.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `wouter` (`useLocation`, `Link`) | Breadcrumb, NavBar | ✓ | 3.9.0 | — |
| `@base-ui/react/menu` (`Menu.LinkItem`, `Menu.Root`, `Menu.Trigger`, `Menu.Popup`, `Menu.Item`, `Menu.Separator`) | UserMenu | ✓ | 1.3.0 | — |
| `lucide-react` (`ChevronRight`, `User`, `LogOut`) | Breadcrumb, UserMenu | ✓ | 1.8.0 | — |
| `react-i18next` + `i18next` | Breadcrumb, UserMenu, SubHeader | ✓ | 17.0.2 / 26.0.4 | — |
| `@/components/ui/dropdown` (Phase 55) | UserMenu | ✓ | phase-local | — |
| `@/components/ui/toggle` (Phase 54) | SubHeader | ✓ | phase-local | — |
| `@/auth/useAuth` + `@/auth/AdminOnly` | UserMenu, SubHeader | ✓ | project | — |
| `vitest` + `@testing-library/react` + `wouter/memory-location` | tests | ✓ | configured (`vitest.config.ts`, jsdom env) | — |
| `frontend/scripts/check-locale-parity.mts` CI gate | Wave 3 i18n verification | ✓ | project script | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence)
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/NavBar.tsx` — current top-header structure and all controls to remove.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/SubHeader.tsx` — per-route conditional-render pattern to extend.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/App.tsx` — authoritative route list for breadcrumb map entries.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/auth/AuthContext.tsx` — `AuthUser` shape = `{id, email, role}` (no `name` field — initials MUST derive from email).
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/dropdown.tsx` — Phase 55 primitive; spreads `{...props}` to base-ui (so className passthrough works); already includes `align="end"` default.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/components/ui/dropdown.test.tsx` — test harness shape to mirror for UserMenu.test.tsx.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/node_modules/@base-ui/react/menu/index.parts.d.ts` — confirms `LinkItem` export.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/node_modules/wouter/types/index.d.ts` — `useLocation`, `Link`, `useRoute` signatures; wouter 3.9.0 contract.
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/i18n.ts` — i18n setup (flat-dotted keys via `keySeparator: false`, single `translation` namespace).
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/src/locales/en.json` + `de.json` — existing keys to reuse (`nav.sales`, `nav.hr`, `nav.upload`, `nav.settings`, `sensors.title`, `signage.admin.page_title`, `signage.admin.nav.{media,playlists,devices,schedules}`, `settings.sensors_link.title`, `docs.nav.docsLabel`) and to delete (`nav.back`, `nav.back_to_sales`, `nav.back_to_hr`).
- `/Users/johannbechtold/Documents/kpi-dashboard/frontend/scripts/check-locale-parity.mts` — CI parity gate; compares Object.keys sets.
- `.planning/phases/56-.../56-CONTEXT.md` — D-01..D-13 user decisions.
- `.planning/phases/55-consolidated-form-controls/55-RESEARCH.md` — Phase 55 primitives contract + testing template to mirror.
- `.planning/REQUIREMENTS.md` §HDR-01..04 — acceptance criteria.

### Secondary (MEDIUM confidence)
- W3C APG breadcrumb pattern — `<nav aria-label>`, `<ol>`, `aria-current="page"` (not re-fetched this phase; well-established).

### Tertiary (LOW confidence)
- None — all findings verified against installed packages or project files.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in installed `node_modules` and `package.json`.
- Architecture: HIGH — existing NavBar, SubHeader, Dropdown, i18n setup all directly read; every component call site verified.
- Pitfalls: HIGH — `lastDashboard` grep (5 hits, all NavBar) + Pattern 1 matcher logic + locale parity script source all verified on the working repo.
- Phase 55 primitive reuse: HIGH — `ui/dropdown.tsx` source read directly; it has zero call sites today, so UserMenu is the first consumer (as D-13 intends).

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable deps; re-verify only if `wouter` or `@base-ui/react` major-version bumps, or if auth `AuthUser` shape gains a `name` field).
