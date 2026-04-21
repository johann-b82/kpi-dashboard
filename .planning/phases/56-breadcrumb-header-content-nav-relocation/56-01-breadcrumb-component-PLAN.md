---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/lib/breadcrumbs.ts
  - frontend/src/lib/breadcrumbs.test.ts
  - frontend/src/components/Breadcrumb.tsx
  - frontend/src/components/Breadcrumb.test.tsx
autonomous: true
requirements: [HDR-02, HDR-03]
must_haves:
  truths:
    - "matchBreadcrumb('/') returns null (launcher excluded, D-03)"
    - "matchBreadcrumb('/login') returns null (pre-auth excluded, D-03)"
    - "matchBreadcrumb('/settings/sensors') returns a trail with two entries: nav.settings and settings.sensors_link.title"
    - "matchBreadcrumb('/signage/playlists/abc-123') matches Playlists leaf (dynamic segment skipped, D-02)"
    - "Breadcrumb component renders Home crumb first on every mapped route (D-04)"
    - "Last crumb renders as <span aria-current='page'> — not a link (D-06)"
    - "Non-leaf crumbs render as wouter <Link> — Tab focuses, Enter navigates natively (HDR-03)"
    - "ChevronRight separator is aria-hidden (D-05)"
  artifacts:
    - path: "frontend/src/lib/breadcrumbs.ts"
      provides: "BREADCRUMB_ROUTES map + matchBreadcrumb() function"
      contains: "BREADCRUMB_ROUTES"
    - path: "frontend/src/lib/breadcrumbs.test.ts"
      provides: "Pure-function unit tests for matcher"
    - path: "frontend/src/components/Breadcrumb.tsx"
      provides: "Breadcrumb component rendering <nav><ol> of crumbs"
    - path: "frontend/src/components/Breadcrumb.test.tsx"
      provides: "Render + aria-current + keyboard unit tests"
  key_links:
    - from: "Breadcrumb.tsx"
      to: "lib/breadcrumbs.ts"
      via: "matchBreadcrumb(location) called on render"
      pattern: "matchBreadcrumb"
    - from: "Breadcrumb.tsx"
      to: "wouter Link"
      via: "non-leaf crumbs render as <Link href>"
      pattern: "from \"wouter\""
---

<objective>
Add breadcrumb infrastructure: a static route→label-key map + pure matcher
function, and a Breadcrumb component that renders the trail for the current
route. Addresses HDR-02 (breadcrumb trail derived from route) and HDR-03
(keyboard-navigable, localized).

Purpose: First brick of Phase 56. Produces the self-contained Breadcrumb
artifact that Plan 03 (NavBar refactor) will consume. Locked decisions
D-01..D-06 are implemented here.

Output: 4 new files (2 source, 2 test) — no existing files modified.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md

@frontend/src/App.tsx
@frontend/src/i18n.ts
@frontend/src/lib/utils.ts

<interfaces>
<!-- Types the executor needs — extracted from RESEARCH Pattern 1 + repo files. -->
<!-- Use these directly; no codebase exploration needed. -->

From wouter (installed 3.9.0):
```ts
// useLocation() returns [pathname: string, navigate: (path: string) => void]
// <Link href="/foo"> renders a native <a href> and intercepts clicks for SPA nav
import { Link, useLocation } from "wouter";
```

From react-i18next (installed 17.x):
```ts
import { useTranslation } from "react-i18next";
const { t } = useTranslation(); // t(key: string): string
```

From lucide-react (installed 1.8.0):
```ts
import { ChevronRight } from "lucide-react";
// <ChevronRight className="h-4 w-4" aria-hidden />
```

From @/lib/utils:
```ts
export function cn(...inputs: ClassValue[]): string; // tailwind-merge + clsx
```

i18n keys that MUST already exist in both de.json and en.json (verify before use):
- nav.sales, nav.hr, nav.upload, nav.settings
- sensors.title
- settings.sensors_link.title
- docs.nav.docsLabel
- signage.admin.page_title
- signage.admin.nav.media, signage.admin.nav.playlists, signage.admin.nav.devices, signage.admin.nav.schedules

i18n keys this plan REFERENCES but are added in Plan 04 (not this plan):
- nav.home
- breadcrumb.aria_label
- breadcrumb.signage.pair

The Breadcrumb component calls t() on these keys. Until Plan 04 lands,
t("nav.home") will return the key string "nav.home" — acceptable during
Wave 1. The Breadcrumb unit tests in this plan MUST NOT assert on
resolved copy for those three keys; assert on the labelKey value returned
by matchBreadcrumb, or on tag shape (SPAN vs A), not on visible text.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create breadcrumbs.ts route map + matcher</name>
  <files>frontend/src/lib/breadcrumbs.ts, frontend/src/lib/breadcrumbs.test.ts</files>
  <read_first>
    - frontend/src/App.tsx (authoritative route list; every authenticated route pattern must have an entry)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md Pattern 1 (verbatim BREADCRUMB_ROUTES entries + matchesPattern helper + Pitfall 2 on ordering)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md D-01, D-02, D-03
  </read_first>
  <behavior>
    - matchBreadcrumb("/") returns null (D-03 launcher exclusion)
    - matchBreadcrumb("/login") returns null (D-03 pre-auth exclusion)
    - matchBreadcrumb("/foo-unknown") returns null
    - matchBreadcrumb("/sales") returns [{labelKey: "nav.sales", href: "/sales"}]
    - matchBreadcrumb("/hr") returns [{labelKey: "nav.hr", href: "/hr"}]
    - matchBreadcrumb("/upload") returns [{labelKey: "nav.upload", href: "/upload"}]
    - matchBreadcrumb("/sensors") returns [{labelKey: "sensors.title", href: "/sensors"}]
    - matchBreadcrumb("/settings") returns [{labelKey: "nav.settings", href: "/settings"}]
    - matchBreadcrumb("/settings/sensors") returns trail of length 2 with labelKeys ["nav.settings", "settings.sensors_link.title"] (Pitfall 2 specificity — deeper pattern must match FIRST)
    - matchBreadcrumb("/docs") returns [{labelKey: "docs.nav.docsLabel", ...}]
    - matchBreadcrumb("/docs/user/intro") returns [{labelKey: "docs.nav.docsLabel", ...}] (D-02 — dynamic segments skipped, parent is leaf)
    - matchBreadcrumb("/signage/media") returns trail of length 2 ending with labelKey "signage.admin.nav.media"
    - matchBreadcrumb("/signage/playlists") returns trail of length 2 ending with "signage.admin.nav.playlists"
    - matchBreadcrumb("/signage/playlists/abc-123") also returns trail ending with "signage.admin.nav.playlists" (D-02)
    - matchBreadcrumb("/signage/devices") ends with "signage.admin.nav.devices"
    - matchBreadcrumb("/signage/schedules") ends with "signage.admin.nav.schedules"
    - matchBreadcrumb("/signage/pair") trail ends with labelKey "breadcrumb.signage.pair"
  </behavior>
  <action>
Create `frontend/src/lib/breadcrumbs.ts` EXACTLY per RESEARCH Pattern 1. Export:

1. `BreadcrumbEntry` type:
```ts
export type BreadcrumbEntry = {
  labelKey: string;
  href?: string;
};
```

2. `BREADCRUMB_ROUTES` readonly array with these entries IN THIS ORDER (deeper-before-shallower — Pitfall 2):

```ts
export const BREADCRUMB_ROUTES: ReadonlyArray<{
  pattern: string;
  trail: ReadonlyArray<BreadcrumbEntry>;
}> = [
  { pattern: "/sales", trail: [{ labelKey: "nav.sales", href: "/sales" }] },
  { pattern: "/hr", trail: [{ labelKey: "nav.hr", href: "/hr" }] },
  { pattern: "/upload", trail: [{ labelKey: "nav.upload", href: "/upload" }] },
  { pattern: "/sensors", trail: [{ labelKey: "sensors.title", href: "/sensors" }] },
  { pattern: "/settings/sensors", trail: [
      { labelKey: "nav.settings", href: "/settings" },
      { labelKey: "settings.sensors_link.title", href: "/settings/sensors" },
    ] },
  { pattern: "/settings", trail: [{ labelKey: "nav.settings", href: "/settings" }] },
  { pattern: "/docs/:section/:slug", trail: [{ labelKey: "docs.nav.docsLabel", href: "/docs" }] },
  { pattern: "/docs", trail: [{ labelKey: "docs.nav.docsLabel", href: "/docs" }] },
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
```

3. `matchBreadcrumb(pathname: string)` function:
   - Returns null for "/" or "/login"
   - Walks BREADCRUMB_ROUTES top-down, returns first match's `trail`
   - Returns null if no pattern matches

4. Private `matchesPattern(pathname, pattern)` helper per RESEARCH Pattern 1 — splits both on "/" (filter Boolean), fails on length mismatch, else every pattern segment starting with ":" matches any non-empty segment; otherwise literal equality.

Write tests to `frontend/src/lib/breadcrumbs.test.ts` covering the full behavior list above. Use `describe` + `it` + `expect` from `vitest`. Pure-function tests — no DOM, no i18n provider.

CRITICAL: Verify App.tsx route list before finalizing BREADCRUMB_ROUTES. If App.tsx contains an authenticated route pattern not in the list above, ADD an entry for it (document in SUMMARY). If the list contains a pattern NOT in App.tsx, REMOVE it.

Per D-01: this is a static map only — NO per-page hook, NO App.tsx route refactor.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/lib/breadcrumbs.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/lib/breadcrumbs.ts` exists and `rg -n "export const BREADCRUMB_ROUTES" frontend/src/lib/breadcrumbs.ts` returns a match
    - File exports `matchBreadcrumb` function (`rg -n "export function matchBreadcrumb" frontend/src/lib/breadcrumbs.ts` matches)
    - `rg -n "pattern: \"/settings/sensors\"" frontend/src/lib/breadcrumbs.ts` returns a match that appears BEFORE (lower line number than) `rg -n "pattern: \"/settings\"" frontend/src/lib/breadcrumbs.ts` match
    - `rg -n "pattern: \"/signage/playlists/:id\"" frontend/src/lib/breadcrumbs.ts` returns a match BEFORE `pattern: "/signage/playlists"`
    - `rg -n "pattern: \"/docs/:section/:slug\"" frontend/src/lib/breadcrumbs.ts` returns a match BEFORE `pattern: "/docs"`
    - `cd frontend && npx vitest run src/lib/breadcrumbs.test.ts` exits 0 with at least 14 passing tests covering every behavior listed
    - `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "breadcrumbs.ts" || echo "CLEAN"` prints `CLEAN`
  </acceptance_criteria>
  <done>
All behaviors in the list pass; matcher order invariant locked by tests; TypeScript clean for the two new files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create Breadcrumb.tsx component + render tests</name>
  <files>frontend/src/components/Breadcrumb.tsx, frontend/src/components/Breadcrumb.test.tsx</files>
  <read_first>
    - frontend/src/lib/breadcrumbs.ts (from Task 1 — matchBreadcrumb signature)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md Pattern 2 (full Breadcrumb component source + a11y notes) and "Breadcrumb render test" example
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md "Interaction Contract → Breadcrumb" section (classes, semantics)
    - frontend/src/lib/utils.ts (cn helper signature)
  </read_first>
  <behavior>
    - Breadcrumb at "/" returns null (container.firstChild === null)
    - Breadcrumb at "/login" returns null
    - Breadcrumb at "/foo" (unmapped) returns null
    - Breadcrumb at "/sales" renders ONE <nav> with aria-label from t("breadcrumb.aria_label"), containing ONE <ol> with TWO <li> (Home + Sales)
    - On "/sales" the LAST li contains a <span> with aria-current="page" (not an <a>)
    - On "/sales" the FIRST li contains an <a href="/"> (Home link)
    - On "/settings/sensors" exactly THREE <li> render
    - ChevronRight separators render between crumbs — exactly (crumbs.length - 1) separators with aria-hidden="true"
    - First li has NO separator before it; last li has NO separator after it
    - Non-leaf <a> elements have focus-visible:ring-2 focus-visible:ring-ring classes present
    - Wouter <Link> is used for non-leaf crumbs (link rendered as <a> with href attribute)
  </behavior>
  <action>
Create `frontend/src/components/Breadcrumb.tsx` EXACTLY per RESEARCH Pattern 2:

```tsx
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { matchBreadcrumb } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

export function Breadcrumb() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const trail = matchBreadcrumb(location);
  if (!trail) return null;

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

No `dark:` variants. No hardcoded colors — all color classes resolve through tokens (`text-foreground`, `text-muted-foreground`, `hover:text-primary`, `ring-ring`).

Create `frontend/src/components/Breadcrumb.test.tsx` using the RESEARCH "Breadcrumb render test" example as template. Use `wouter/memory-location` hook for route-scoped renders. Tests MUST NOT assert on resolved copy for keys added in Plan 04 (nav.home, breadcrumb.aria_label, breadcrumb.signage.pair) — assert on DOM structure (role, tagName, aria-current, href) and on labelKey values. Acceptable to assert on resolved copy for keys that already exist (nav.sales, nav.settings, etc.).

Test harness shape:
```tsx
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
```

Write tests for every behavior in the list above.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/Breadcrumb.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/Breadcrumb.tsx` exists and exports a named `Breadcrumb` function (`rg -n "export function Breadcrumb" frontend/src/components/Breadcrumb.tsx` matches)
    - `rg -n "aria-current=\"page\"" frontend/src/components/Breadcrumb.tsx` returns a match
    - `rg -n "aria-hidden" frontend/src/components/Breadcrumb.tsx` returns a match (ChevronRight separator)
    - `rg -n "from \"wouter\"" frontend/src/components/Breadcrumb.tsx` returns a match importing Link and useLocation
    - `rg -n "matchBreadcrumb" frontend/src/components/Breadcrumb.tsx` returns a match
    - `rg -n "dark:" frontend/src/components/Breadcrumb.tsx` returns ZERO matches
    - `rg -n "focus-visible:ring-2 focus-visible:ring-ring" frontend/src/components/Breadcrumb.tsx` returns a match (CTRL-04 invariant)
    - `cd frontend && npx vitest run src/components/Breadcrumb.test.tsx` exits 0 with all tests passing
    - `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "Breadcrumb\.tsx|Breadcrumb\.test\.tsx" || echo "CLEAN"` prints `CLEAN`
  </acceptance_criteria>
  <done>
Breadcrumb component renders per spec; tests cover render-null cases, link/current-page semantics, separator placement, and focus-ring presence.
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npx vitest run src/lib/breadcrumbs.test.ts src/components/Breadcrumb.test.tsx` — all tests pass
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "(breadcrumbs\.ts|Breadcrumb\.tsx)" || echo "CLEAN"` — prints `CLEAN`
- `rg -n "dark:" frontend/src/components/Breadcrumb.tsx frontend/src/lib/breadcrumbs.ts` — zero matches (dark-mode invariant)
- `rg -n "export const BREADCRUMB_ROUTES" frontend/src/lib/breadcrumbs.ts` — exactly one match
- `rg -n "export function (Breadcrumb|matchBreadcrumb)" frontend/src/components/Breadcrumb.tsx frontend/src/lib/breadcrumbs.ts` — two matches total
</verification>

<success_criteria>
1. `matchBreadcrumb` correctly returns null for excluded routes and specific trails for every mapped pattern (HDR-02 route derivation)
2. Breadcrumb component renders a proper `<nav><ol><li>` landmark with ChevronRight separators between crumbs (D-05, HDR-02)
3. Home crumb is always first and is a link; last crumb is `<span aria-current="page">` and not a link (D-04, D-06)
4. Dynamic segments are skipped as leaves — `/signage/playlists/:id` renders the same trail as `/signage/playlists` (D-02)
5. No `dark:` variants; focus ring uses `ring-ring` token (dark-mode invariant + CTRL-04)
6. TypeScript clean for all four new files; all unit tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/56-breadcrumb-header-content-nav-relocation/56-01-SUMMARY.md`
</output>
