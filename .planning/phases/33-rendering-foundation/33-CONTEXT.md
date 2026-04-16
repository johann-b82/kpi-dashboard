# Phase 33: Rendering Foundation - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Markdown rendering pipeline — the docs page infrastructure that turns `.md` content into polished, dark-mode-aware prose with syntax-highlighted code blocks, clickable heading anchors, a generated table of contents, and lazy-loaded routing. No navigation shell, no content authoring — infrastructure only.

</domain>

<decisions>
## Implementation Decisions

### Markdown Library
- **D-01:** Use **react-markdown** with remark/rehype plugin ecosystem for rendering Markdown to React components
- **D-02:** Use **rehype-highlight** (highlight.js-based) as rehype plugin for syntax-highlighted code blocks

### Prose Styling
- **D-03:** Use **@tailwindcss/typography** plugin with `prose` / `dark:prose-invert` classes for Markdown styling — consistent with existing Tailwind v4 + dark mode class strategy

### TOC Presentation
- **D-04:** Table of contents rendered as a **sticky right sidebar** alongside the article content, visible while scrolling. Collapses or hides on narrow screens.

### Content Format
- **D-05:** Bilingual docs organized in **locale subfolders** — e.g. `docs/en/upload.md` and `docs/de/upload.md`
- **D-06:** Markdown files loaded via **Vite `?raw` build-time import** — content ships bundled with the lazy-loaded docs route chunk. No runtime fetch.

### Claude's Discretion
- Heading anchor implementation details (remark/rehype plugin choice for generating heading IDs and anchor links)
- TOC extraction approach (remark plugin or post-parse heading scan)
- Responsive breakpoint for TOC sidebar collapse
- Highlight.js theme selection for light/dark modes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Infrastructure
- `.planning/REQUIREMENTS.md` — NAV-04, RENDER-01 through RENDER-04 define the success criteria for this phase
- `CLAUDE.md` — Technology stack, conventions, shadcn/ui wraps @base-ui/react (not Radix)

### Existing Code
- `frontend/src/App.tsx` — wouter routing setup; lazy-loaded `/docs` route must be added here
- `frontend/src/index.css` — Tailwind v4 CSS-first config with `:root`/`.dark` token blocks; typography plugin integrates here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui card component** (`frontend/src/components/ui/card.tsx`): Could wrap TOC or article containers
- **Tailwind v4 dark mode tokens**: `:root`/`.dark` CSS variable system already in place — typography plugin will inherit

### Established Patterns
- **Routing**: wouter `Route`/`Switch` in App.tsx — all pages currently eagerly imported (no lazy loading yet)
- **Styling**: Tailwind v4 class strategy with CSS variables; no `tailwind.config.js`
- **i18n**: react-i18next with DE/EN JSON files — docs chrome labels go here, but article content is in `.md` files

### Integration Points
- `frontend/src/App.tsx` — add lazy-loaded `/docs` route via `React.lazy()` + `Suspense`
- `frontend/src/index.css` — add `@plugin "@tailwindcss/typography"` (Tailwind v4 CSS-first config)
- New `frontend/src/pages/DocsPage.tsx` — lazy-loaded entry point for the docs rendering pipeline

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-rendering-foundation*
*Context gathered: 2026-04-16*
