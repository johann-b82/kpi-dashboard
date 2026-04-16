# Architecture Research

**Domain:** In-app Markdown documentation site integrated into existing React SPA
**Researched:** 2026-04-16
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Vite Build (compile-time)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  docs/                                                    │   │
│  │    admin/de/*.md   admin/en/*.md                         │   │
│  │    user/de/*.md    user/en/*.md                          │   │
│  │                                                           │   │
│  │  import.meta.glob("../docs/**/*.md", { eager: true })   │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │ bundled JS (strings)                     │
└───────────────────────┼─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                      React SPA (runtime)                         │
│                                                                  │
│  AuthContext (role: "admin" | "viewer")                          │
│       │                                                          │
│  AppShell (/docs/* routes added to wouter Switch)                │
│       │                                                          │
│  ┌────▼───────────────────────────────────────────────────┐      │
│  │ DocsPage                                                │      │
│  │  ├── DocsSidebar  (nav tree, role-filtered)            │      │
│  │  └── DocsContent  (Markdown -> HTML, slug-driven)      │      │
│  │        └── react-markdown + remark-gfm                 │      │
│  └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `docs/` folder | Markdown source tree, co-located with frontend source | `frontend/src/docs/` — inside `src/` so Vite glob works without config changes |
| `docsManifest.ts` | Derive typed doc tree from glob import; filter by role and lang | Module-level computation on `import.meta.glob` result |
| `DocsPage.tsx` | Top-level page for all `/docs/*` routes | Single wouter route: `<Route path="/docs/:slug*">` |
| `DocsSidebar.tsx` | Tree navigation; role-filtered; links to slugs | Renders manifest; uses wouter `Link`; highlights current slug |
| `DocsContent.tsx` | Renders Markdown string to HTML | `react-markdown` + `remark-gfm`; Tailwind prose classes |
| `NavBar.tsx` (modified) | Adds docs icon (BookOpen) left of UploadIcon | Visible to all authenticated users; wraps in `Link href="/docs"` |

## Recommended Project Structure

```
frontend/src/
├── docs/                         # Markdown content files
│   ├── admin/
│   │   ├── de/
│   │   │   ├── 01-setup.md
│   │   │   ├── 02-architecture.md
│   │   │   └── 03-user-management.md
│   │   └── en/
│   │       ├── 01-setup.md
│   │       ├── 02-architecture.md
│   │       └── 03-user-management.md
│   └── user/
│       ├── de/
│       │   ├── 01-upload.md
│       │   ├── 02-sales-dashboard.md
│       │   └── 03-hr-dashboard.md
│       └── en/
│           ├── 01-upload.md
│           ├── 02-sales-dashboard.md
│           └── 03-hr-dashboard.md
├── pages/
│   └── DocsPage.tsx              # NEW
├── components/
│   └── docs/
│       ├── DocsSidebar.tsx       # NEW
│       ├── DocsContent.tsx       # NEW
│       └── docsManifest.ts       # NEW -- compile-time glob -> typed tree
└── locales/
    ├── de.json                   # MODIFIED -- add docs.* keys
    └── en.json                   # MODIFIED -- add docs.* keys
```

### Structure Rationale

- **`src/docs/`** (inside `src/`): Vite only processes `import.meta.glob` on paths under the project root and relative imports. Placing docs here means zero vite.config.ts changes.
- **`admin/` vs `user/` split**: Role enforcement is structural. The manifest builder excludes the `admin/` subtree for viewers. No risk of accidentally rendering admin content.
- **`de/` and `en/` as folder segment**: Language is a folder key in the glob path — content lookup is `docs[section][lang][slug]`, a direct key access.
- **Numeric filename prefixes** (`01-`, `02-`): Controls sidebar ordering without a separate config file. Parse the prefix for sort order, strip it from the display title.

## Architectural Patterns

### Pattern 1: Compile-Time Glob Import (Static Bundling)

**What:** Vite's `import.meta.glob` resolves all matching file paths at build time and bundles their content as JS string literals. No runtime fetches.

**When to use:** Documentation that ships with the app, no CMS, content authored by developers alongside code.

**Trade-offs:**
- Pro: Zero runtime HTTP requests; works offline; no fetch error states to handle.
- Pro: TypeScript-typed manifest at build time — slug mismatches caught at compile time.
- Con: Adding a doc page requires a frontend rebuild and redeploy. Acceptable for internal ops docs.
- Con: Very large doc sets inflate bundle size. Not a concern here (a few KB of Markdown).

**Example:**
```typescript
// docsManifest.ts
const modules = import.meta.glob("../docs/**/*.md", { eager: true, as: "raw" });
// modules is Record<string, string> — key = path, value = Markdown text
// e.g. { "../docs/admin/de/01-setup.md": "# Setup\n..." }
```

**Alternative rejected:** Lazy `fetch("/docs/admin/en/setup.md")` from `public/`. This requires placing Markdown files in `public/` (unprocessed, untyped), adds fetch lifecycle management per page, and means role enforcement must happen at fetch time rather than at manifest filter time.

### Pattern 2: Role Gate via Manifest Filtering

**What:** `docsManifest.ts` exports a `getManifest(role, lang)` function. Admin gets all entries; Viewer gets only `section === "user"` entries. `DocsPage` also checks before rendering a slug directly via URL.

**When to use:** Two-tier role system where the privileged tier is a strict superset of the unprivileged tier.

**Trade-offs:**
- Pro: Gating is in one place (manifest), not scattered across components.
- Pro: URL-direct access to an admin slug by a Viewer renders an access-denied state, not a content leak — content is never rendered.
- Con: Admin Markdown text is technically in the JS bundle for all users. For operational setup docs this is acceptable; these are not secrets.

**Example:**
```typescript
// docsManifest.ts
export function getManifest(role: Role, lang: string): DocEntry[] {
  return ALL_ENTRIES
    .filter(e => e.lang === lang)
    .filter(e => role === "admin" ? true : e.section === "user")
    .sort((a, b) => a.order - b.order);
}
```

### Pattern 3: Slug-Driven Single Wildcard Route

**What:** One wouter route `/docs/:slug*` handles all doc pages. The `slug` param maps to a manifest entry. Adding new pages requires zero routing changes.

**When to use:** Any multi-page doc site within a SPA.

**Trade-offs:**
- Pro: Direct URL linking works (`/docs/admin/setup`).
- Pro: Zero `App.tsx` changes when new doc pages are added.
- Con: Slug namespace must be unique. Using `section/filename` (e.g., `user/01-upload`) is unique by construction.

**Example:**
```typescript
// App.tsx addition
<Route path="/docs/:slug*" component={DocsPage} />

// DocsPage.tsx
const params = useParams<{ slug: string }>();
const slug = params.slug ?? "";
const entry = manifest.find(e => e.slug === slug);
if (!entry) return <DocsNotFound />;
if (entry.section === "admin" && role !== "admin") return <DocsAccessDenied />;
return <DocsContent markdown={entry.content} />;
```

### Pattern 4: i18n for UI Chrome, Language Folder for Content

**What:** Sidebar section titles, page heading, "not found" messages use `react-i18next` as normal `t("docs.*")` keys. The Markdown content itself is selected by language folder, driven by `i18n.language`. No translation files needed for doc prose.

**When to use:** Bilingual doc site where content is written differently in each language (different prose, different examples) rather than just translated strings.

**Trade-offs:**
- Pro: No need to embed Markdown in JSON locale files. Keeps `de.json`/`en.json` manageable.
- Pro: Language switch reactively re-filters the manifest (component reads `i18n.language`).
- Con: Two parallel Markdown files must be maintained per document. Acceptable for a small, stable doc set.

## Data Flow

### Docs Page Load

```
User navigates to /docs/user/01-upload
    |
wouter matches <Route path="/docs/:slug*">
    |
DocsPage receives slug = "user/01-upload"
    |
getManifest(role, i18n.language)  <- role from AuthContext, lang from i18next
    |
manifest.find(e => e.slug === slug)
    |
entry.section check vs role -> render DocsContent OR DocsAccessDenied
    |
DocsContent: <ReactMarkdown>{entry.content}</ReactMarkdown>
    |
DocsSidebar: same manifest, highlights current slug, groups by section
```

### Language Switch

```
User changes DE <-> EN via existing LanguageToggle (no change to LanguageToggle)
    |
i18n.changeLanguage("de" | "en")
    |
DocsPage re-renders (reads i18n.language)
    |
getManifest(role, "de") returns German entries
    |
slug "user/01-upload" still valid (same slug across languages)
    |
Content switches to German Markdown -- no navigation required
```

### Role Change

```
signOut() -> AuthContext clears user -> role = null
    |
AuthGate redirects to /login (existing behavior, unchanged)
    |
On next login, AuthContext sets new role
    |
DocsPage re-derives manifest from new role
    |
Admin content appears or disappears from sidebar accordingly
```

## Integration Points

### New Components

| Component | Type | Depends On |
|-----------|------|------------|
| `docsManifest.ts` | NEW lib | `import.meta.glob`, `Role` type from AuthContext |
| `DocsContent.tsx` | NEW component | `react-markdown`, `remark-gfm`, Tailwind prose |
| `DocsSidebar.tsx` | NEW component | `docsManifest`, wouter `Link`, `i18next` |
| `DocsPage.tsx` | NEW page | `AuthContext`, all three above |
| `docs/` folder | NEW content | (static Markdown files) |

### Modified Components

| Component | Change |
|-----------|--------|
| `App.tsx` | Add `<Route path="/docs/:slug*" component={DocsPage} />` to Switch; extend `isLogin` exclusion or back-button logic to `/docs` prefix |
| `NavBar.tsx` | Add `BookOpen` icon link left of `UploadIcon`; visible to all authenticated users (not inside `AdminOnly`); extend back-button check to include `/docs` prefix |
| `locales/de.json` | Add `docs.*` keys: section titles, "not found", "access denied", aria-labels |
| `locales/en.json` | Same |

### New npm Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `react-markdown` | Render Markdown string to React elements | De facto standard; React 19 compatible |
| `remark-gfm` | GitHub Flavored Markdown (tables, task lists, strikethrough) | Official remark plugin, always paired with react-markdown |

No Vite plugin required. `import.meta.glob` with `{ as: "raw" }` handles `.md` files as plain strings natively since Vite 4 — zero config change to `vite.config.ts`.

### No Backend Changes Required

The docs feature is entirely frontend. No new FastAPI routes, no DB schema changes, no Alembic migrations, no Docker Compose changes.

## Build Order Recommendation

1. **`docsManifest.ts` + `docs/` folder structure** — No React dependencies. Build and unit-test with Vitest in isolation. Establishes the typed slug system that everything else depends on.

2. **`DocsContent.tsx`** — Depends only on `react-markdown` and Tailwind prose classes. Verify Markdown rendering and dark mode styles work before wiring navigation.

3. **i18n keys** — Add `docs.*` keys to `de.json`/`en.json`. Can run in parallel with step 2. No code changes depend on specific key names until DocsSidebar/DocsPage are written.

4. **`DocsSidebar.tsx`** — Depends on manifest shape and wouter Link. Role filtering tested here against mock role values.

5. **`DocsPage.tsx`** — Composes Sidebar + Content. Role gate logic lives here (reads from existing `AuthContext` — no auth work required).

6. **`App.tsx` + `NavBar.tsx` changes** — Wire the route and add the navbar icon. Last step because all linked components must exist first.

## Anti-Patterns

### Anti-Pattern 1: Fetching Markdown from `public/`

**What people do:** Place `.md` files in `frontend/public/docs/`, then `fetch("/docs/setup.md")` at runtime.

**Why it's wrong:** Creates async loading state per page (spinner on every navigation), bypasses TypeScript type checking (slug typos become 404s not compile errors), requires role enforcement at fetch time (easy to miss), and splits content from code in a way that complicates the Docker build.

**Do this instead:** `import.meta.glob` with `{ as: "raw", eager: true }` — all content bundled, synchronous, TypeScript-typed slugs.

### Anti-Pattern 2: Per-Doc i18n Keys in Locale JSON Files

**What people do:** Add `"docs.setup.body": "# Setup\nThis guide..."` inside `de.json`/`en.json`.

**Why it's wrong:** JSON does not support multi-line strings cleanly; loses Markdown syntax highlighting in editors; inflates locale files; mixes content with UI strings.

**Do this instead:** Keep Markdown in `.md` files under language-namespaced folders. Use locale JSON only for UI chrome (section headings, error states, aria-labels).

### Anti-Pattern 3: Registering One Route Per Doc Page

**What people do:** `<Route path="/docs/setup" component={SetupDoc} />` for each page.

**Why it's wrong:** Every new doc page requires a code change to `App.tsx`. Content and routing are coupled.

**Do this instead:** Single wildcard route `/docs/:slug*` — routing is data-driven from the manifest.

### Anti-Pattern 4: Role Check Inside Markdown Content

**What people do:** Conditionally render Markdown sections based on role within a single file.

**Why it's wrong:** Admin content ends up in the JS bundle for all users. Content authoring becomes complex and error-prone.

**Do this instead:** Separate files per role section. The `admin/` subtree is structurally excluded from the Viewer manifest.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (small internal team, ~10 doc pages) | Static glob import is ideal — zero operational overhead |
| Growing doc set (50+ pages) | Consider lazy glob (`eager: false`) to split doc strings into separate JS chunks; not needed today |
| CMS-managed content | Switch from glob to fetch from a CMS API; keep the `docsManifest.ts` interface stable so components don't change |

## Sources

- Vite `import.meta.glob` with `{ as: "raw" }`: https://vite.dev/guide/features#glob-import — confirmed in Vite 4+ docs. Confidence: HIGH.
- `react-markdown` npm package: standard React Markdown renderer, React 19 compatible. Confidence: HIGH.
- `remark-gfm` npm package: official remark GFM plugin, standard pairing with react-markdown. Confidence: HIGH.
- Existing codebase: `AdminOnly.tsx` and `useAuth.ts` confirm `useRole()` hook returns `"admin" | "viewer" | null` anywhere in the component tree.
- wouter wildcard routes: `path="/docs/:slug*"` captures `slug = "user/01-upload"` for path `/docs/user/01-upload`. Confirmed in wouter 3.x source and README.

---
*Architecture research for: In-app Markdown documentation site (v1.13)*
*Researched: 2026-04-16*
