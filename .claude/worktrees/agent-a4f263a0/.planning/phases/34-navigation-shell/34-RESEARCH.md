# Phase 34: Navigation Shell - Research

**Researched:** 2026-04-16
**Domain:** React routing (wouter), role-gated sidebar, i18n nav chrome
**Confidence:** HIGH

## Summary

Phase 34 adds the navigation shell around Phase 33's rendering foundation: a Library icon in the navbar linking to `/docs`, a role-filtered sidebar with grouped article sections, role-aware default routing at `/docs`, and bilingual UI chrome via react-i18next. All building blocks are already in the codebase — this phase is pure assembly work: no new npm packages, no new design patterns, no backend changes.

The main structural change is refactoring `DocsPage.tsx` from a single-article view (hardcoded `getting-started`) into a two-panel layout: a left sidebar with role-gated sections and a right article column that renders based on `/:section/:slug` URL params. The existing `AdminOnly` component, `useRole()` hook, wouter routing, and i18n `useTranslation()` pattern handle all the logic; this phase only wires them together in the docs context.

**Primary recommendation:** Build a `DocsSidebar` component that reads `useRole()` and uses `AdminOnly` for the admin section; refactor `DocsPage` to extract article content from a static registry keyed by `section/slug`; expand the wouter route from `/docs` to `/docs/:section/:slug`; redirect bare `/docs` with a `useEffect`/`useLocation` role check.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Grouped flat list sidebar — section headers with flat article links underneath. No collapsible trees or tabs.
- **D-02:** Viewers see only the User Guide section. Admin Guide is completely hidden (not grayed out, not locked — invisible).
- **D-03:** Viewer navigating directly to an admin article URL → silently redirect to user guide intro. No 404, no error message.
- **D-04:** Use lucide-react `Library` icon for the docs navbar link, placed left of the upload icon.
- **D-05:** Docs icon visible to all authenticated roles (Admin and Viewer).
- **D-06:** URL structure: `/docs/:section/:slug` — e.g. `/docs/user-guide/uploading-data`.
- **D-07:** Bare `/docs` redirects role-aware: Admin → `/docs/admin-guide/intro`, Viewer → `/docs/user-guide/intro`.
- **D-08:** All sidebar labels, section headers, and navigation chrome use react-i18next keys in existing `en.json`/`de.json`.

### Claude's Discretion
- Sidebar width and responsive breakpoint for sidebar collapse/hide
- Active article highlight style in sidebar
- Transition/animation on route changes (if any)
- Article slug naming convention (kebab-case assumed)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | User can access documentation via a book icon in the navbar (left of upload icon) | Add `Library` icon `Link` to `/docs` in `NavBar.tsx`, left of the upload icon; use same `linkClass` pattern as existing upload/settings icons |
| NAV-02 | User sees a role-filtered sidebar with doc sections (Admins see User + Admin guides, Viewers see User guide only) | `DocsSidebar` component using `AdminOnly` wrapper for admin section; `useRole()` for active-link logic |
| NAV-03 | User lands on a role-aware default article when navigating to /docs (Admin→admin intro, Viewer→user intro) | wouter `useLocation` redirect in `DocsPage` when `section`/`slug` params absent; `useRole()` to determine target |
| I18N-02 | All UI chrome (sidebar labels, section titles, nav elements) has DE/EN i18n keys | Add new keys to `en.json`/`de.json` under `docs.nav.*` namespace; consume via `useTranslation()` |
</phase_requirements>

## Standard Stack

No new packages needed. All required dependencies are already installed.

### Already Installed — Relevant to This Phase
| Library | Version (installed) | Usage in Phase 34 |
|---------|--------------------|--------------------|
| wouter | ^3.9.0 | Nested route `/docs/:section/:slug`, `useParams`, `useLocation` for redirect |
| lucide-react | ^1.8.0 | `Library` icon for navbar docs link |
| react-i18next | ^17.0.2 | `useTranslation()` for sidebar labels and section headers |
| i18next | ^26.0.4 | Locale files `en.json`/`de.json` already structured |

**Installation:** No new packages to install.

## Architecture Patterns

### Recommended Project Structure (new files)
```
frontend/src/
├── components/
│   └── docs/
│       ├── MarkdownRenderer.tsx   (Phase 33, unchanged)
│       ├── TableOfContents.tsx    (Phase 33, unchanged)
│       └── DocsSidebar.tsx        (NEW — Phase 34)
├── pages/
│   └── DocsPage.tsx               (MODIFIED — refactored from single-article to routed)
├── lib/
│   └── docs/
│       ├── toc.ts                 (Phase 33, unchanged)
│       └── registry.ts            (NEW — article content map, section/slug → MD import)
└── App.tsx                        (MODIFIED — expand /docs route to handle nested params)
```

### Pattern 1: Nested Route in wouter
**What:** wouter v3 supports parameterized routes via `<Route path="/docs/:section/:slug">`. The `useParams()` hook extracts `section` and `slug` from the URL.
**When to use:** Required by D-06 for `/docs/:section/:slug` URL structure.

```tsx
// In App.tsx — expand from bare /docs to nested params
<Route path="/docs/:section/:slug">
  <Suspense fallback={<Loader2 ... />}>
    <DocsPage />
  </Suspense>
</Route>
// Keep the bare /docs route pointing to the same component — it handles redirect internally
<Route path="/docs">
  <Suspense fallback={<Loader2 ... />}>
    <DocsPage />
  </Suspense>
</Route>
```

**Note on wouter v3:** `useParams()` returns an object keyed by param names. Both `/docs` and `/docs/:section/:slug` can point to the same lazy component; the component checks if params are present and redirects if not.

### Pattern 2: Role-Aware Redirect at /docs
**What:** When `DocsPage` renders without `section`/`slug` params (bare `/docs`), use `useRole()` + `useLocation` to issue an immediate redirect.
**When to use:** Required by D-07.

```tsx
// Inside DocsPage — at top before render
const { section, slug } = useParams<{ section: string; slug: string }>();
const role = useRole();
const [, navigate] = useLocation();

useEffect(() => {
  if (!section || !slug) {
    navigate(
      role === "admin"
        ? "/docs/admin-guide/intro"
        : "/docs/user-guide/intro",
      { replace: true }
    );
  }
}, [section, slug, role, navigate]);
```

### Pattern 3: Admin Article Guard (D-03)
**What:** When a Viewer navigates directly to `/docs/admin-guide/anything`, redirect silently to user guide intro.
**When to use:** Required by D-03.

```tsx
useEffect(() => {
  if (section === "admin-guide" && role !== "admin") {
    navigate("/docs/user-guide/intro", { replace: true });
  }
}, [section, role, navigate]);
```

### Pattern 4: DocsSidebar with AdminOnly
**What:** Flat grouped list. User Guide section always visible. Admin Guide section wrapped in `<AdminOnly>`. Active article highlighted with `border-l-2 border-primary` pattern (consistent with TableOfContents active style from Phase 33).

```tsx
// DocsSidebar.tsx
import { AdminOnly } from "@/auth/AdminOnly";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";

export function DocsSidebar({ articles }: DocsSidebarProps) {
  const { t } = useTranslation();
  const { section, slug } = useParams<{ section: string; slug: string }>();

  return (
    <nav className="w-56 shrink-0">
      <SectionGroup
        title={t("docs.nav.userGuide")}
        section="user-guide"
        articles={articles["user-guide"]}
        activeSection={section}
        activeSlug={slug}
      />
      <AdminOnly>
        <SectionGroup
          title={t("docs.nav.adminGuide")}
          section="admin-guide"
          articles={articles["admin-guide"]}
          activeSection={section}
          activeSlug={slug}
        />
      </AdminOnly>
    </nav>
  );
}
```

### Pattern 5: Article Content Registry
**What:** Static registry mapping `section/slug` keys to raw Markdown content imported at build time (Vite `?raw` imports). This extends the pattern already used in Phase 33's `DocsPage.tsx` (`contentMap`).

```ts
// frontend/src/lib/docs/registry.ts
// Stub entries for intro articles — Phase 35/36 will add real content
import enUserIntro from "../../docs/en/user-guide/intro.md?raw";
import deUserIntro from "../../docs/de/user-guide/intro.md?raw";
import enAdminIntro from "../../docs/en/admin-guide/intro.md?raw";
import deAdminIntro from "../../docs/de/admin-guide/intro.md?raw";

type Registry = Record<string, Record<string, Record<string, string>>>;
// registry[lang][section][slug] = rawMarkdown
export const registry: Registry = {
  en: {
    "user-guide":  { intro: enUserIntro },
    "admin-guide": { intro: enAdminIntro },
  },
  de: {
    "user-guide":  { intro: deUserIntro },
    "admin-guide": { intro: deAdminIntro },
  },
};
```

**Why static imports, not dynamic:** Vite's glob import (`import.meta.glob`) is an alternative, but static imports are simpler for the small fixed set here and consistent with Phase 33's pattern. Dynamic glob can be adopted in Phase 35 when real articles are added.

### Pattern 6: Navbar Library Icon (D-04, D-05)
**What:** Add `Library` link to navbar between the LanguageToggle/ThemeToggle block and the upload icon. Visible to all authenticated roles (not wrapped in `AdminOnly`).

```tsx
// In NavBar.tsx — inside the ml-auto flex block, left of the upload icon
import { Library } from "lucide-react";

const docsLinkClass =
  "inline-flex items-center justify-center rounded-md p-2 hover:bg-accent/10 transition-colors " +
  (location === "/docs" || location.startsWith("/docs/") ? "text-primary" : "text-foreground");

// JSX — before the AdminOnly upload block:
<Link href="/docs" aria-label={t("docs.nav.docsLabel")} className={docsLinkClass}>
  <Library className="h-5 w-5" />
</Link>
```

**Active state:** `location.startsWith("/docs/")` is needed because the actual URL will be `/docs/user-guide/intro` etc., not bare `/docs`.

### DocsPage Refactored Layout
**What:** Replace the current single-column article + TOC layout with a three-column layout: sidebar (left) + article (center) + TOC (right).

```tsx
<div className="flex gap-8 px-6 py-8 max-w-7xl mx-auto">
  <DocsSidebar articles={sidebarArticles} />
  <article className="flex-1 min-w-0">
    <MarkdownRenderer content={content} />
  </article>
  <aside className="sticky top-24 hidden lg:block w-60 shrink-0">
    <TableOfContents entries={tocEntries} />
  </aside>
</div>
```

### Anti-Patterns to Avoid
- **Dynamic import for role guard logic:** Don't lazy-import admin-guide articles at the routing layer as a security measure — the role guard is purely navigational (Viewer can't see admin sidebar, redirected on direct URL). Article content in the bundle is not a security risk for an internal tool.
- **wouter nested `<Switch>` inside DocsPage:** Keep routing flat in App.tsx and use params in DocsPage. Nested routers add complexity with no benefit here.
- **`location === "/docs"` for active detection:** The navbar icon active state check must use `startsWith("/docs/")` to cover all nested article URLs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role-based component visibility | Custom `if (role === "admin")` wrappers everywhere | `AdminOnly` component (already exists) | Consistent pattern, already in codebase |
| i18n string lookup | Inline language conditionals | `useTranslation()` + locale files | Already established project pattern |
| Route param extraction | Manual `window.location.pathname.split("/")` | `useParams()` from wouter | Type-safe, reactive to navigation |
| Redirect logic | `window.location.href =` | `useLocation()` navigate with `{ replace: true }` | History-aware, works with SPA back button |

## Common Pitfalls

### Pitfall 1: Active State on Docs Icon
**What goes wrong:** `location === "/docs"` returns false for all article URLs since actual URL is `/docs/user-guide/intro` etc.
**Why it happens:** The redirect from bare `/docs` happens before the component can render, so `location` never stays at `/docs`.
**How to avoid:** Use `location.startsWith("/docs/")` or `location === "/docs" || location.startsWith("/docs/")` for the active class check.

### Pitfall 2: useParams Returns Empty Object on Bare /docs Route
**What goes wrong:** `useParams()` returns `{}` (not `undefined`) when the route matched is `/docs` (no params). Destructuring `{ section, slug }` gives `undefined` for both — this is correct behavior and must be handled explicitly.
**Why it happens:** wouter v3 `useParams()` always returns an object, never `null`.
**How to avoid:** Guard with `if (!section || !slug)` before rendering article content, triggering the redirect.

### Pitfall 3: Missing Stub MD Files for Intro Articles
**What goes wrong:** Registry imports `user-guide/intro.md` and `admin-guide/intro.md` at build time — if these files don't exist, Vite will throw a build error.
**Why it happens:** `?raw` imports are resolved at build time.
**How to avoid:** Create minimal stub `.md` files for both intro articles (in both `en/` and `de/` directories) as part of this phase. Phase 35/36 will replace content.

### Pitfall 4: Sidebar Appearing on /docs Before Redirect Completes
**What goes wrong:** On bare `/docs`, the sidebar renders for one frame before `useEffect` fires the redirect, causing a flash.
**Why it happens:** `useEffect` runs after paint.
**How to avoid:** Guard the main layout render: if `!section || !slug`, return `null` (or the Loader spinner) — don't render the full sidebar/article layout. The redirect `useEffect` will fire immediately.

### Pitfall 5: Docs i18n Keys Conflict with Existing Structure
**What goes wrong:** `en.json` already has a `docs` object (`docs.toc.title`, `docs.loading`, `docs.empty`). Adding flat string keys like `"docs.nav.userGuide"` at the top level alongside the nested object will cause TypeScript/i18next key collision.
**Why it happens:** Mixed dot-notation and nested object structure in the same JSON.
**How to avoid:** Add all new keys as nested object properties inside the existing `docs` object: `docs.nav.userGuide`, `docs.nav.adminGuide`, `docs.nav.docsLabel`. Do NOT add them as flat dot-notation strings at the top level.

## i18n Keys to Add

New keys needed in both `en.json` and `de.json`, inside the existing `docs` object:

```json
// en.json — add inside "docs": { ... }
"nav": {
  "docsLabel": "Documentation",
  "userGuide": "User Guide",
  "adminGuide": "Admin Guide"
}
```

```json
// de.json — add inside "docs": { ... }
"nav": {
  "docsLabel": "Dokumentation",
  "userGuide": "Benutzerhandbuch",
  "adminGuide": "Administratorhandbuch"
}
```

## Directory Structure for Stub Articles

Phase 34 must create these stub MD files to satisfy registry imports:

```
frontend/src/docs/
├── en/
│   ├── getting-started.md     (exists — Phase 33)
│   ├── user-guide/
│   │   └── intro.md           (NEW stub — Phase 34)
│   └── admin-guide/
│       └── intro.md           (NEW stub — Phase 34)
└── de/
    ├── getting-started.md     (exists — Phase 33)
    ├── user-guide/
    │   └── intro.md           (NEW stub — Phase 34)
    └── admin-guide/
        └── intro.md           (NEW stub — Phase 34)
```

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure frontend component work, no new npm packages, no external services)

## Sources

### Primary (HIGH confidence)
- Codebase read: `frontend/src/App.tsx`, `NavBar.tsx`, `DocsPage.tsx`, `AuthContext.tsx`, `AdminOnly.tsx`, `useAuth.ts`, `en.json`, `de.json`
- Phase 33 summaries: `33-01-SUMMARY.md`, `33-02-SUMMARY.md`
- `frontend/package.json` — verified installed versions: wouter ^3.9.0, react-i18next ^17.0.2, lucide-react ^1.8.0
- `34-CONTEXT.md` — locked decisions D-01 through D-08

### Secondary (MEDIUM confidence)
- wouter v3 `useParams()` and `useLocation()` API — based on installed version ^3.9.0 and established usage patterns already in `App.tsx` and `NavBar.tsx`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already installed and in active use
- Architecture: HIGH — all patterns extend existing codebase conventions directly
- Pitfalls: HIGH — derived from reading actual source files and understanding the existing patterns

**Research date:** 2026-04-16
**Valid until:** Stable — no external dependencies
