# Phase 33: Rendering Foundation - Research

**Researched:** 2026-04-16
**Domain:** Markdown rendering pipeline — React, remark/rehype ecosystem, Tailwind typography, lazy loading
**Confidence:** HIGH

## Summary

Phase 33 builds the complete Markdown rendering infrastructure for the docs route: react-markdown with remark/rehype plugins renders Markdown into styled prose; @tailwindcss/typography provides dark-mode-aware prose styles; rehype-highlight adds syntax-highlighted code blocks via highlight.js github/github-dark themes; rehype-slug generates heading IDs for anchor links; the TOC is extracted from the parsed AST and rendered as a sticky right sidebar; and the `/docs` route is lazy-loaded via `React.lazy()` + `Suspense` to avoid increasing the dashboard bundle.

All library choices are locked by CONTEXT.md (D-01 through D-06). The only discretionary areas are implementation details of heading anchors and TOC extraction, responsive breakpoint for TOC collapse, and highlight.js theme selection. The UI-SPEC already specifies those: rehype-slug for IDs, Intersection Observer for active TOC tracking, `lg` (1024px) breakpoint for TOC collapse, and `github` / `github-dark` highlight themes. Research confirms all locked choices are sound and current.

**Primary recommendation:** Install `react-markdown@10.1.0`, `rehype-highlight@7.0.2`, `rehype-slug@6.0.0`, `remark-gfm@4.0.1`, and `@tailwindcss/typography@0.5.19`. Wire up in `DocsPage.tsx` as the lazy-loaded entry point with three new components: `MarkdownRenderer`, `TableOfContents`, and the route registration in `App.tsx`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use **react-markdown** with remark/rehype plugin ecosystem for rendering Markdown to React components
- **D-02:** Use **rehype-highlight** (highlight.js-based) as rehype plugin for syntax-highlighted code blocks
- **D-03:** Use **@tailwindcss/typography** plugin with `prose` / `dark:prose-invert` classes for Markdown styling — consistent with existing Tailwind v4 + dark mode class strategy
- **D-04:** Table of contents rendered as a **sticky right sidebar** alongside the article content, visible while scrolling. Collapses or hides on narrow screens.
- **D-05:** Bilingual docs organized in **locale subfolders** — e.g. `docs/en/upload.md` and `docs/de/upload.md`
- **D-06:** Markdown files loaded via **Vite `?raw` build-time import** — content ships bundled with the lazy-loaded docs route chunk. No runtime fetch.

### Claude's Discretion
- Heading anchor implementation details (remark/rehype plugin choice for generating heading IDs and anchor links)
- TOC extraction approach (remark plugin or post-parse heading scan)
- Responsive breakpoint for TOC sidebar collapse
- Highlight.js theme selection for light/dark modes

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-04 | Docs page is lazy-loaded so it does not impact dashboard bundle size | React.lazy() + Suspense pattern in wouter; all current pages are eagerly imported — this is the first lazy route |
| RENDER-01 | User sees Markdown content rendered as styled prose with dark mode support | react-markdown + @tailwindcss/typography `prose dark:prose-invert`; Tailwind v4 CSS-first config supported via `@plugin` directive |
| RENDER-02 | User sees syntax-highlighted code blocks in documentation | rehype-highlight@7.0.2 (highlight.js); github/github-dark themes; `.dark` class strategy already in place |
| RENDER-03 | User sees clickable heading anchor links for deep linking within articles | rehype-slug@6.0.0 generates stable IDs; custom heading component in react-markdown renders anchor icon |
| RENDER-04 | User sees an in-page table of contents generated from article headings | Extract h2/h3 nodes from remark AST before render; render as sticky `<nav>`; Intersection Observer drives active state |
</phase_requirements>

---

## Standard Stack

### Core — New Packages to Install

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | 10.1.0 | Renders Markdown string to React component tree | Locked D-01; industry standard; remark/rehype plugin ecosystem; ESM-only from v9+ |
| rehype-highlight | 7.0.2 | Syntax highlighting via highlight.js applied as rehype plugin | Locked D-02; integrates directly into react-markdown's rehype plugin pipeline |
| rehype-slug | 6.0.0 | Adds `id` attributes to headings based on text content | Discretion area; standard choice; pairs with rehype-autolink-headings for anchor links |
| remark-gfm | 4.0.1 | GitHub Flavored Markdown (tables, task lists, strikethrough) | Standard complement to react-markdown for full Markdown feature coverage |
| @tailwindcss/typography | 0.5.19 | `prose` classes for polished Markdown prose styling | Locked D-03; Tailwind v4 compatible via `@plugin` CSS directive |

### Supporting — highlight.js Themes (no install, bundled with rehype-highlight)

| Asset | Source | Purpose |
|-------|--------|---------|
| `highlight.js/styles/github.css` | bundled | Light mode syntax theme |
| `highlight.js/styles/github-dark.css` | bundled | Dark mode syntax theme (activated via `.dark` class) |

### Existing Stack Used (no new install)

| Library | Version in package.json | Role in this phase |
|---------|------------------------|-------------------|
| React | ^19.2.4 | React.lazy() + Suspense for lazy route |
| wouter | ^3.9.0 | Route registration for `/docs` |
| tailwindcss | ^4.2.2 | Already installed; typography plugin adds `prose` utilities |
| lucide-react | ^1.8.0 | `Loader2` spinner (Suspense fallback), `Link` icon (heading anchor) |
| react-i18next | ^17.0.2 | TOC title i18n key `docs.toc.title` |

### Alternatives Considered (locked out by CONTEXT.md)

| Instead of | Could Use | Why Locked Out |
|------------|-----------|----------------|
| react-markdown | marked + dangerouslySetInnerHTML | D-01 locks react-markdown |
| rehype-highlight | prism-react-renderer | D-02 locks rehype-highlight |
| @tailwindcss/typography | Hand-rolled prose CSS | D-03 locks typography plugin |

**Installation:**
```bash
npm install react-markdown rehype-highlight rehype-slug remark-gfm @tailwindcss/typography
```

**Version verification (confirmed against npm registry 2026-04-16):**
- react-markdown: 10.1.0
- rehype-highlight: 7.0.2
- rehype-slug: 6.0.0
- remark-gfm: 4.0.1
- @tailwindcss/typography: 0.5.19

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── pages/
│   └── DocsPage.tsx          # Lazy-loaded route entry point
├── components/
│   ├── docs/
│   │   ├── MarkdownRenderer.tsx   # react-markdown + plugins
│   │   └── TableOfContents.tsx    # TOC nav with Intersection Observer
│   └── ui/                   # Existing shadcn components
├── lib/
│   └── docs/
│       └── toc.ts            # Heading extraction utility
└── index.css                 # Add @plugin "@tailwindcss/typography"
```

```
frontend/src/docs/            # OR: src/content/docs/ — bilingual Markdown files
├── en/
│   └── (placeholder).md     # Phase 33 ships infrastructure; content in Phase 35/36
└── de/
    └── (placeholder).md
```

Note: Phase 33 is infrastructure-only. The docs folder needs at least one `.md` stub for end-to-end smoke testing.

### Pattern 1: Lazy-Loaded Route with Suspense (NAV-04)

**What:** Add `/docs` route using `React.lazy()` so the docs chunk is code-split out of the main bundle.
**When to use:** Any route that is not visited on the primary flow (dashboard, upload) and has heavy dependencies (react-markdown ecosystem adds ~80KB gzipped).

```tsx
// frontend/src/App.tsx — add alongside existing eager imports
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const DocsPage = lazy(() => import("./pages/DocsPage"));

// Inside Switch:
<Route path="/docs">
  <Suspense fallback={
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="animate-spin h-6 w-6" aria-label="Loading documentation" />
    </div>
  }>
    <DocsPage />
  </Suspense>
</Route>
```

**wouter note:** wouter `Route` renders children as a render-prop or component prop. Use children syntax or `component` prop — both work with lazy components.

### Pattern 2: react-markdown with Plugin Pipeline (RENDER-01, RENDER-02, RENDER-03)

**What:** Wire rehype-slug + rehype-highlight into react-markdown's plugin arrays. Override the heading renderer to inject anchor icon.

```tsx
// frontend/src/components/docs/MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";   // light mode — dark override in index.css

interface Props {
  content: string;  // raw Markdown string from ?raw import
}

export function MarkdownRenderer({ content }: Props) {
  return (
    <ReactMarkdown
      className="prose dark:prose-invert max-w-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug, rehypeHighlight]}
      components={{
        h2: ({ node, ...props }) => <HeadingWithAnchor level={2} {...props} />,
        h3: ({ node, ...props }) => <HeadingWithAnchor level={3} {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**rehypeHighlight note:** Pass `{ detect: true }` option to auto-detect language when no language fence is given — prevents unhighlighted blocks.

### Pattern 3: TOC Extraction from Markdown AST (RENDER-04)

**What:** Parse Markdown with remark to extract h2/h3 headings before rendering. Returns typed heading list consumed by `TableOfContents`.

```ts
// frontend/src/lib/docs/toc.ts
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";

export interface TocEntry {
  level: 2 | 3;
  text: string;
  id: string;  // slug from heading text — must match rehype-slug output
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

export function extractToc(markdown: string): TocEntry[] {
  const tree = remark().use(remarkGfm).parse(markdown) as Root;
  const entries: TocEntry[] = [];
  for (const node of tree.children) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const text = node.children
        .filter((c) => c.type === "text")
        .map((c) => (c as { value: string }).value)
        .join("");
      entries.push({ level: node.depth, text, id: slugify(text) });
    }
  }
  return entries;
}
```

**Slug alignment:** `rehype-slug` uses `github-slugger` internally. The hand-rolled `slugify` above is an approximation — for exact match, use `github-slugger` package (`npm install github-slugger`) or import `GithubSlugger` to guarantee IDs match.

### Pattern 4: TOC Active Highlighting with Intersection Observer

**What:** Observe each heading element; update active TOC entry when heading enters viewport.

```tsx
// Inside TableOfContents.tsx
useEffect(() => {
  const headings = entries.map(e => document.getElementById(e.id)).filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find(e => e.isIntersecting);
      if (visible) setActiveId(visible.target.id);
    },
    { rootMargin: "0px 0px -60% 0px", threshold: 0.1 }
  );
  headings.forEach(h => h && observer.observe(h));
  return () => observer.disconnect();
}, [entries]);
```

### Pattern 5: Vite `?raw` Import for Markdown Content (D-06)

**What:** Import Markdown files as raw strings at build time — content is bundled into the lazy chunk, no runtime fetch.

```ts
// Inside DocsPage.tsx or a content registry
import uploadContent from "../docs/en/upload.md?raw";
// uploadContent is a string — pass directly to MarkdownRenderer
```

**TypeScript:** Declare module type in `vite-env.d.ts` or a `.d.ts` file:

```ts
declare module "*.md?raw" {
  const content: string;
  export default content;
}
// OR use the generic raw query:
declare module "*?raw" {
  const content: string;
  export default content;
}
```

### Pattern 6: Tailwind v4 Typography Plugin Registration

**What:** Tailwind v4 uses CSS-first config — no `tailwind.config.js`. Register the typography plugin via `@plugin` directive in `index.css`.

```css
/* frontend/src/index.css — add after existing @import lines */
@plugin "@tailwindcss/typography";
```

This unlocks `prose`, `prose-invert`, `prose-sm`, `prose-lg`, and all modifier variants. The `dark:prose-invert` class works with the existing `@custom-variant dark (&:is(.dark *))` already declared in `index.css`.

### Anti-Patterns to Avoid

- **`dangerouslySetInnerHTML` with Markdown:** Never parse Markdown to HTML string and inject it — XSS risk. react-markdown renders to React elements safely.
- **Importing highlight.js themes in both CSS and JS:** Import the CSS file once (in MarkdownRenderer or index.css). Duplicate imports cause doubled style rules.
- **Calling `remark().parse()` on every render:** `extractToc` should be memoized (`useMemo`) or called outside the render cycle — parsing is not free.
- **Using `create_all()` style approaches in routing:** All existing routes use eager imports; adding DocsPage eagerly would add the full react-markdown bundle to the main chunk. Use lazy only.
- **rehype-slug ID mismatch with manual anchors:** Any hand-crafted TOC IDs must use the same slugification algorithm as rehype-slug (`github-slugger`). Divergence causes broken deep links.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown → React rendering | Custom parser | react-markdown | Handles edge cases: nested elements, HTML in Markdown, GFM extensions |
| Syntax highlighting | Custom tokenizer | rehype-highlight (highlight.js) | 190+ languages, maintained, correct token parsing |
| Heading ID generation | Custom slugify | rehype-slug (uses github-slugger) | Handles unicode, collisions, matches GitHub's algorithm |
| Prose typography | Custom CSS reset | @tailwindcss/typography | Dark mode, responsive type scale, list/table/code styles all included |
| Active section tracking | Scroll event + `getBoundingClientRect` | Intersection Observer API | Performant, no main-thread scroll jank, browser-native |

**Key insight:** The remark/rehype pipeline is a well-defined transformation graph. Each plugin does one thing correctly. Mixing custom implementations with plugin outputs creates ID mismatch and style conflicts.

---

## Common Pitfalls

### Pitfall 1: react-markdown ESM-Only (v9+)
**What goes wrong:** Build error or runtime crash if the bundler is configured for CommonJS output.
**Why it happens:** react-markdown v9+ is pure ESM. Most Vite projects (like this one) are already ESM (`"type": "module"` in package.json), so this is not an issue here. But if a backend script or test config uses CJS `require()`, it will break.
**How to avoid:** Vite is already ESM — no action needed. Confirm `"type": "module"` is set in `frontend/package.json` (it is: confirmed).
**Warning signs:** `ERR_REQUIRE_ESM` in Node console, or Vitest config using `require`.

### Pitfall 2: highlight.js Dark Theme Not Activating
**What goes wrong:** Code blocks stay light-themed when dark mode is toggled.
**Why it happens:** highlight.js themes are imported as CSS files. The dark theme needs to be scoped to `.dark` — importing `github-dark.css` globally overrides the light theme for both modes.
**How to avoid:** Import only `github.css` in the component. Add the dark override in `index.css` using the existing custom variant:
```css
.dark .hljs { /* override vars from github-dark.css */ }
```
Or use CSS layer ordering: import `github-dark.css` inside a `.dark` block. Vite supports CSS `@import` with conditions via PostCSS.
**Warning signs:** Dark mode toggle does not change code block colors.

### Pitfall 3: TOC Heading IDs Don't Match Anchor Links
**What goes wrong:** Clicking a TOC item scrolls to the wrong heading or does nothing.
**Why it happens:** rehype-slug uses `github-slugger` which handles unicode, duplicate headings, and special chars differently from a naive `toLowerCase().replace()`.
**How to avoid:** Use `github-slugger` in `toc.ts` instead of a hand-rolled slugify function, or verify output matches for all heading content in the stub articles.
**Warning signs:** `document.getElementById(id)` returns `null` for a valid heading.

### Pitfall 4: Suspense Fallback Breaks Layout on First Load
**What goes wrong:** When the docs route first loads, the Suspense fallback renders without the `pt-28` offset applied by `<main>` in `AppShell`, causing the spinner to appear behind the navbar.
**Why it happens:** `pt-28` is applied on the `<main>` wrapper in `AppShell` — the Suspense fallback is a child of `<main>` and will inherit it. No action needed, but verify visually.
**How to avoid:** Place Suspense boundary inside the route (as shown in Pattern 1), not outside `<main>`.
**Warning signs:** Spinner hidden behind navbar on first docs page visit.

### Pitfall 5: Tailwind v4 Typography Plugin — Incorrect Registration
**What goes wrong:** `prose` classes have no effect; build warning about unknown plugin.
**Why it happens:** Tailwind v4 drops `tailwind.config.js` plugins array. Typography must be registered via `@plugin` in CSS, not in a JS config.
**How to avoid:** Add `@plugin "@tailwindcss/typography";` to `frontend/src/index.css`. Do NOT create a `tailwind.config.js`.
**Warning signs:** `prose` class applied in JSX but renders as unstyled plain text.

---

## Code Examples

### Verified Pattern: React.lazy with wouter Route

```tsx
// Source: React docs (react.dev/reference/react/lazy) + wouter README
import { lazy, Suspense } from "react";
import { Route } from "wouter";
import { Loader2 } from "lucide-react";

const DocsPage = lazy(() => import("./pages/DocsPage"));

// Inside Switch in AppShell:
<Route path="/docs">
  <Suspense fallback={
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading documentation" />
    </div>
  }>
    <DocsPage />
  </Suspense>
</Route>
```

### Verified Pattern: Tailwind v4 Typography Plugin

```css
/* frontend/src/index.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
@plugin "@tailwindcss/typography";  /* ADD THIS LINE */

@custom-variant dark (&:is(.dark *));
/* rest of file unchanged */
```

### Verified Pattern: Two-Column Docs Layout

```tsx
// DocsPage.tsx layout structure (from UI-SPEC)
<div className="flex gap-8 px-6 py-8">
  <article className="flex-1 min-w-0">
    <MarkdownRenderer content={content} />
  </article>
  <aside className="sticky top-24 hidden lg:block w-60 shrink-0">
    <TableOfContents entries={tocEntries} />
  </aside>
</div>
```

### Verified Pattern: heading component with anchor icon

```tsx
// Inside MarkdownRenderer.tsx components prop
function HeadingWithAnchor({ level, id, children, ...props }: HeadingProps) {
  const Tag = `h${level}` as "h2" | "h3";
  return (
    <Tag id={id} className="group flex items-center gap-1" {...props}>
      {children}
      {id && (
        <a
          href={`#${id}`}
          aria-label={`Link to section: ${typeof children === "string" ? children : ""}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-primary"
        >
          <Link className="h-4 w-4" />
        </a>
      )}
    </Tag>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `marked` + `dangerouslySetInnerHTML` | react-markdown + rehype pipeline | 2020–2022 | Safe, composable, plugin ecosystem |
| `tailwind.config.js` plugins array | `@plugin` CSS directive (Tailwind v4) | Tailwind v4 (2024) | No JS config file; CSS-first |
| `PrismJS` (react-syntax-highlighter) | rehype-highlight (highlight.js) | ecosystem shift ~2023 | Direct rehype integration; no wrapper component |
| Scroll event listener for active TOC | Intersection Observer API | Broadly supported ~2019 | No main-thread scroll jank |

**Deprecated / outdated:**
- `react-syntax-highlighter`: Still valid but adds a separate dependency when rehype-highlight integrates directly into the remark/rehype pipeline with no additional component layer.
- `remark-slug`: Deprecated in favor of `rehype-slug`. Always use `rehype-slug`.

---

## Open Questions

1. **Slug algorithm exact match**
   - What we know: rehype-slug uses `github-slugger`; our TOC extraction needs matching IDs
   - What's unclear: Whether `github-slugger` needs to be a direct dependency for `toc.ts`, or if a simpler function covers all expected heading content
   - Recommendation: Add `github-slugger` as a direct dependency to guarantee exact match; it's tiny (~1KB)

2. **highlight.js dark theme CSS injection strategy**
   - What we know: Two approaches work — scoped `.dark .hljs {}` override vs. CSS layer import
   - What's unclear: Which is cleaner with Vite's CSS bundling pipeline
   - Recommendation: Import light theme in MarkdownRenderer; add `.dark` scoped overrides in `index.css` to avoid double-import issues

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure frontend npm packages with no runtime services required)

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on Phase 33 |
|------------|-------------------|
| Frontend: React 19 + TypeScript + Vite 8 | Use `React.lazy()` (available in React 18+); no SSR concerns |
| Tailwind CSS v4 — CSS-first config (no tailwind.config.js) | Typography plugin via `@plugin` directive, not plugins array |
| shadcn/ui — copy-paste pattern, no npm package version lock | Existing `card.tsx` can be reused for TOC container if needed |
| TanStack Query for server state | No server state in Phase 33 — docs content is bundled statically |
| wouter for routing | Route + Suspense pattern; wouter supports both component and children render props |
| Docker Compose — no bare-metal | Build happens inside Docker; `npm install` in frontend Dockerfile covers new packages |

---

## Sources

### Primary (HIGH confidence)
- npm registry direct query (2026-04-16) — all package versions verified
- `frontend/package.json` — existing dependency versions confirmed
- `frontend/src/App.tsx` — routing pattern (wouter Switch/Route, all eager imports)
- `frontend/src/index.css` — Tailwind v4 CSS-first config pattern, `@custom-variant dark`
- `33-CONTEXT.md` — locked decisions D-01 through D-06
- `33-UI-SPEC.md` — visual contract, layout, breakpoints, copy, component inventory

### Secondary (MEDIUM confidence)
- react-markdown README (npm page) — ESM-only status, plugin array API
- @tailwindcss/typography README — `@plugin` directive for v4 registration
- rehype-slug README — uses github-slugger internally

### Tertiary (LOW confidence)
- None — all critical claims verified from package registry or existing project files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry 2026-04-16
- Architecture: HIGH — patterns derived from locked decisions + existing codebase inspection
- Pitfalls: MEDIUM — highlight.js theme injection strategy is implementation-dependent; other pitfalls are HIGH

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable ecosystem; packages release infrequently)
