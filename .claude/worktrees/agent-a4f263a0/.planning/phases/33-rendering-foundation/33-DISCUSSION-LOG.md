# Phase 33: Rendering Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 33-rendering-foundation
**Areas discussed:** Markdown library, Prose styling, TOC presentation, Content format

---

## Markdown Library

| Option | Description | Selected |
|--------|-------------|----------|
| react-markdown | Lightweight, renders MD to React via remark/rehype plugins. Easy syntax highlighting, heading IDs, TOC. No build-time compilation. | ✓ |
| MDX | Markdown + JSX — embed React components in docs. Heavier setup, overkill for pure prose + code. | |
| You decide | Claude picks best fit. | |

**User's choice:** react-markdown
**Notes:** None

### Syntax Highlighting Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| rehype-highlight | Uses highlight.js. Lightweight, broad language support, easy CSS theming. | ✓ |
| rehype-prism-plus | Uses Prism.js. Line numbers, line highlighting, copy button. Heavier. | |
| You decide | Claude picks based on project needs. | |

**User's choice:** rehype-highlight
**Notes:** None

---

## Prose Styling

| Option | Description | Selected |
|--------|-------------|----------|
| @tailwindcss/typography | Official Tailwind prose plugin. `prose` class with dark:prose-invert. Minimal effort. | ✓ |
| Custom prose CSS | Hand-written CSS. Full control but more maintenance. | |
| You decide | Claude picks. | |

**User's choice:** @tailwindcss/typography
**Notes:** None

---

## TOC Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Right sidebar | Sticky TOC on right side, visible while scrolling. Common docs pattern. Collapses on narrow screens. | ✓ |
| Inline at top | TOC as list at top of article. Simpler but lost after scrolling. | |
| You decide | Claude picks. | |

**User's choice:** Right sidebar
**Notes:** None

---

## Content Format

| Option | Description | Selected |
|--------|-------------|----------|
| Locale subfolders | e.g. `docs/en/upload.md` and `docs/de/upload.md`. Clean separation. | ✓ |
| Filename suffix | e.g. `docs/upload.en.md`. Flat structure. | |
| i18n JSON keys | Store content as i18n strings. Awkward for long-form Markdown. | |

**User's choice:** Locale subfolders
**Notes:** None

### Loading Strategy Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Build-time import | Vite `?raw` import. Zero fetch latency, bundled with lazy-loaded chunk. | ✓ |
| Runtime fetch | Store in `public/`, fetch via HTTP. Adds loading states. | |
| You decide | Claude picks. | |

**User's choice:** Build-time import
**Notes:** None

---

## Claude's Discretion

- Heading anchor plugin choice
- TOC extraction approach
- Responsive breakpoint for TOC collapse
- Highlight.js theme for light/dark modes

## Deferred Ideas

None
