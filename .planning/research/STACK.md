# Stack Research — v1.13 In-App Documentation

**Domain:** In-app Markdown documentation site (role-aware, bilingual, bundled with React frontend)
**Researched:** 2026-04-16
**Confidence:** HIGH (all versions verified against npm registry)

## Context: What Already Exists (Do Not Re-Add)

The following are already in the stack and require zero changes for this milestone:

- React 19 + Vite 8 + TypeScript + Tailwind v4 — rendering and styling
- wouter — routing (add `/docs` and `/docs/:slug` routes)
- react-i18next — bilingual DE/EN (reuse existing `i18n/` setup for doc section titles/labels)
- shadcn/ui — component primitives (cards, sidebar, breadcrumbs)
- Directus JWT (`Admin` / `Viewer` roles) — role-based visibility is already solved; just gate which `.md` files are imported

---

## Recommended Additions

### Core: Markdown Rendering Pipeline

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `react-markdown` | 10.1.0 | Render `.md` strings as React component tree | The standard for this use case. Converts Markdown → React VDOM (not innerHTML), so it's XSS-safe by default and integrates with Tailwind/shadcn without `dangerouslySetInnerHTML`. MDX is overkill — docs content doesn't need embedded React components. `marked` produces HTML strings, which require `dangerouslySetInnerHTML` and lose component customization. |
| `remark-gfm` | 4.0.1 | GitHub-Flavoured Markdown (tables, task lists, strikethrough, autolinks) | GFM tables are expected in setup/config docs. This is the official remark plugin; ships separately from `react-markdown` since v7. remark-gfm v4 matches the remark v15 ecosystem used by react-markdown v10. |

### Syntax Highlighting

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `rehype-highlight` | 7.0.2 | Apply syntax highlighting to fenced code blocks via rehype pipeline | Integrates directly into `react-markdown`'s `rehypePlugins` prop. Uses `lowlight` (highlight.js grammar) under the hood. For a small bundled docs SPA with no build-time step, this is the right weight: no Shiki WASM loading overhead, no SSR required. Produces `<code class="hljs ...">` elements styled by a single CSS import. |
| `highlight.js` | 11.11.1 | Highlight.js grammar registry (peer dep of `rehype-highlight`) | Import only needed language grammars to keep bundle small: `bash`, `yaml`, `python`, `typescript`, `json`. Full hljs auto-import is ~400KB; selective import is ~40KB. |

### Table of Contents

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `rehype-slug` | 6.0.0 | Add `id` attributes to `<h1>`–`<h6>` heading elements | Required for anchor links in the TOC. Runs in the rehype pipeline after Markdown → HTML conversion. |
| `rehype-autolink-headings` | 7.1.0 | Add `<a>` anchor links to headings (for copyable deep links) | Pairs with `rehype-slug`. Configure with `behavior: 'wrap'` to wrap heading text in the link. Must appear after `rehype-slug` in plugin array. |

The TOC component itself is built as a small React hook (`useToc`) that reads heading elements from the rendered DOM via `document.querySelectorAll('h1, h2, h3')` after render — no additional library needed for a docs set of this size.

### Search (Optional — Defer Unless Explicitly Required)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `flexsearch` | 0.8.212 | Client-side full-text search over bundled doc pages | Only add if user feedback requests it. For < 20 pages, sidebar navigation + browser Ctrl+F is sufficient. If added: build index at app startup from imported `.md` files; ~30KB bundle cost. |

Recommendation: **Defer search entirely for v1.13.** A role-aware docs site with < 20 pages is fully navigable without it.

---

## Installation

```bash
# Markdown rendering pipeline
npm install react-markdown remark-gfm

# Syntax highlighting
npm install rehype-highlight highlight.js

# TOC heading anchors
npm install rehype-slug rehype-autolink-headings

# Search — defer; add only if explicitly scoped
# npm install flexsearch
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| MDX (`@mdx-js/react`) | Docs are static Markdown authored by one team; no need to embed React components in content. MDX adds a Vite plugin, a Babel transform, and significant complexity for zero benefit here. | `react-markdown` + remark/rehype plugins |
| `marked` | Produces an HTML string, not React elements — requires `dangerouslySetInnerHTML`, loses Tailwind className injection on headings/code, needs manual XSS sanitization. | `react-markdown` |
| `shiki` / `@shikijs/rehype` | Shiki loads a WASM grammar engine (~1.5MB); designed for SSR or build-time pipelines (Next.js, Astro). For a Vite SPA with client-side rendering, the startup cost is visible. `rehype-highlight` with selective language imports is 10x lighter. | `rehype-highlight` + `highlight.js` |
| `react-syntax-highlighter` | Last release is old; bundles the entire Prism/hljs grammar set even when using individual language modules. Larger bundle than `rehype-highlight` for the same result. | `rehype-highlight` |
| `@tailwindcss/typography` (prose plugin) | Requires a `tailwind.config.js` which Tailwind v4 dropped. Applying the `prose` class will silently do nothing. | Style headings/lists/code via `react-markdown`'s `components` prop with Tailwind utility classes directly. |
| `remark-toc` | Injects a `<ul>` TOC into the Markdown source text itself; hard to position in a sidebar layout; no scroll-sync capability. | Custom `useToc` hook over `document.querySelectorAll` |
| Algolia DocSearch | External SaaS dependency, requires indexing pipeline, overkill for < 30 internal pages. | `flexsearch` if search is ever needed |

---

## Integration Patterns

### Markdown Rendering Component

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
// Import only needed language grammars:
import 'highlight.js/lib/languages/bash';
import 'highlight.js/lib/languages/yaml';
import 'highlight.js/lib/languages/typescript';

// Apply Tailwind utility classes via the `components` prop — NOT prose plugin
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }], rehypeHighlight]}
  components={{
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mb-4 mt-6" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-semibold mb-3 mt-5" {...props}>{children}</h2>
    ),
    code: ({ className, children, ...props }) => (
      <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-sm", className)} {...props}>
        {children}
      </code>
    ),
  }}
>
  {markdownContent}
</ReactMarkdown>
```

### Bundling Markdown Files

Import `.md` files as strings using Vite's `?raw` suffix — no loader plugin required:

```ts
import adminSetupDoc from './docs/admin/setup.md?raw';
import userUploadDoc from './docs/user/upload.md?raw';
```

All docs bundled with the frontend container; no CMS, no API call, no backend changes.

### Role Gating

Gate doc visibility based on the existing `useAuth()` role claim — pure frontend logic:

```ts
const adminDocs = role === 'Admin' ? [adminSetupDoc, adminArchitectureDoc] : [];
const userDocs = [userUploadDoc, userDashboardDoc];
const visibleDocs = [...adminDocs, ...userDocs];
```

No backend changes required.

### Highlight.js Dark Mode

Use the `github` theme and override in `.dark` — consistent with existing Tailwind v4 class strategy:

```ts
// main.tsx or the docs component
import 'highlight.js/styles/github.css';
```

Then in the global CSS file:
```css
.dark .hljs { background: var(--color-muted); color: var(--color-foreground); }
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-markdown@10.1.0` | React 19 | ESM-only; Vite handles this transparently |
| `remark-gfm@4.0.1` | `react-markdown@10` | remark v15 ecosystem — versions must align |
| `rehype-highlight@7.0.2` | `react-markdown@10` | rehype v13 ecosystem — compatible with slug and autolink-headings |
| `rehype-slug@6.0.0` | `rehype-highlight@7` | Same rehype v13 ecosystem |
| `rehype-autolink-headings@7.1.0` | `rehype-slug@6` | Must come after `rehype-slug` in plugin array; slug IDs must exist first |

---

## Sources

- [react-markdown npm](https://www.npmjs.com/package/react-markdown) — v10.1.0 confirmed
- [remark-gfm npm](https://www.npmjs.com/package/remark-gfm) — v4.0.1 confirmed
- [rehype-highlight GitHub](https://github.com/rehypejs/rehype-highlight) — v7.0.2 confirmed
- [highlight.js npm](https://www.npmjs.com/package/highlight.js) — v11.11.1 confirmed
- [rehype-slug npm](https://www.npmjs.com/package/rehype-slug) — v6.0.0 confirmed
- [rehype-autolink-headings npm](https://www.npmjs.com/package/rehype-autolink-headings) — v7.1.0 confirmed
- [flexsearch GitHub](https://github.com/nextapps-de/flexsearch) — v0.8.212 confirmed
- [Shiki rehype integration docs](https://shiki.matsu.io/packages/rehype) — reviewed for SSR-vs-SPA tradeoff; ruled out for client-side SPA
- [rehype-pretty-code](https://rehype-pretty.pages.dev/) — reviewed, same Shiki-based concern; ruled out

---
*Stack research for: v1.13 In-App Documentation additions to KPI Dashboard*
*Researched: 2026-04-16*
