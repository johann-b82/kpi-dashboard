# Feature Research

**Domain:** In-app documentation site for a role-gated KPI dashboard (internal tool)
**Milestone:** v1.13 In-App Documentation
**Researched:** 2026-04-16
**Confidence:** HIGH — well-established patterns with clear precedents in internal tool documentation

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = documentation feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sidebar navigation with section grouping | All documentation sites use left-nav; users scan structure, they don't read linearly | LOW | Two top-level groups: "Nutzerhandbuch" and "Administratorhandbuch"; flat list within each |
| Markdown-rendered content | Markdown is the universal authoring format; raw `.md` text displayed in-app = broken | LOW | `react-markdown` + `remark-gfm`; no CMS, no external service |
| Prose styling (readable typography) | Unstyled `react-markdown` output is a wall of text with no spacing or hierarchy | LOW | `@tailwindcss/typography` plugin: `prose` + `dark:prose-invert` classes — one install, zero custom CSS |
| Role-based section visibility (Admin vs Viewer) | App already has Admin/Viewer roles; docs that ignore this expose admin internals to Viewers | LOW | Read `user.role` from existing JWT auth context; Admin section hidden for Viewers |
| Bilingual content (DE/EN) | App is fully bilingual (DE/EN); English-only docs would be jarring for German-speaking users | MEDIUM | Two `.md` files per article (`upload.de.md` / `upload.en.md`); language driven by existing `i18next.language` |
| Docs entrypoint in navbar | Users need to discover docs without asking for help | LOW | Icon button in existing navbar action area (already scoped in v1.13 target) |
| Dark mode compatibility | App has dark mode; a white docs page inside a dark app = obvious inconsistency | LOW | Free with `prose dark:prose-invert` if Tailwind Typography is installed |
| Active article highlighted in sidebar | Standard navigation feedback; missing = users lose track of location | LOW | Compare current route/slug to sidebar item |
| User Guide: How to upload a file | File upload is the primary action; first thing new users need to do | LOW | Cover accepted formats (CSV/TXT tab-delimited), column requirements, upload history, error messages |
| User Guide: Reading the Sales dashboard | KPI cards + delta badges + amber overlay chart are not self-explanatory without context | LOW | Explain each card (revenue, avg order value, orders), what the delta percentages mean, date presets |
| User Guide: Reading the HR dashboard | 5 HR KPIs with dual delta badges need definition; metric names are opaque without explanation | LOW | Define each metric formula; explain sick leave ratio, overtime ratio, fluctuation, skill development, revenue/employee |
| User Guide: Date filters and period comparison | "vs. Vorperiode" and "vs. Vorjahr" + amber overlay confuse new users consistently | LOW | Explain the 3 presets, how prior period is computed, what the amber chart overlay shows |
| Admin Guide: Initial Docker Compose setup | Admins running the stack need bring-up instructions | MEDIUM | Cover `.env` variables, `docker compose up`, Alembic migrations, healthcheck behavior |
| Admin Guide: User management via Directus | How to add users, set Admin/Viewer role, change passwords in Directus UI | LOW | Step-by-step; the Directus admin path (`/directus/admin`) is not obvious to first-time operators |
| Admin Guide: Personio configuration | Most complex settings page in the app; 3 multi-select fields with non-obvious semantics | MEDIUM | Cover credentials (write-only fields), sync interval, absence type mapping, department mapping, skill attribute key |

### Differentiators (Competitive Advantage)

Features that add meaningful value beyond baseline expectations for an internal tool of this size.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Role-aware doc landing page | Admin lands on Admin Guide entry; Viewer lands on User Guide entry — zero navigation friction | LOW | Conditional default article in docs route based on `user.role`; ~1 hour work |
| In-page anchor TOC (right-side) | Long articles (Docker setup, Personio config) benefit from jump-to-section links | LOW | Extract h2/h3 headings from `react-markdown` AST → render sticky right-side TOC; `remark` plugin or manual heading scan |
| "Last updated" date visible on each article | Builds trust that docs are maintained; signals staleness immediately | LOW | Frontmatter metadata at top of each `.md` file; displayed as small text below article title |
| Contextual help deep links from Settings | Users on the Personio settings section can click `?` to jump directly to the Personio configuration doc | MEDIUM | `?doc=personio-config` query param routing in docs component; useful specifically for Settings because it is the most complex page |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full-text search | Feels like a docs site must-have | For <15 articles, search adds ~30 kB JS (Fuse.js/FlexSearch), requires an index build step, and provides near-zero value over a clear sidebar; complexity-to-value is negative at this scale | Structure sidebar clearly; revisit search only if article count grows beyond 15 |
| CMS / editable-in-browser docs | Non-developers want to edit without a redeploy | Adds a new service dependency (Directus content type or separate CMS), new auth surface, and persistent storage complexity; this app's docs are static Markdown bundled with the frontend — that is the right call for this scope | Markdown files in `src/docs/`; edit via Git; redeploy is ~30 seconds |
| Versioned documentation | Professional SaaS doc sites version per release | Overkill for a single-instance internal app with one team; manual versioning creates drift and maintenance burden | Single "current" doc set; update docs in the same PR as the feature |
| Feedback widgets (thumbs up/down) | Used in SaaS docs to measure quality | No analytics infra; data goes nowhere; creates false promise of action | Collect feedback via Slack or team meetings |
| Auto-generated API docs embedded in user docs | FastAPI's `/api/docs` Swagger UI already exists | Users are not API consumers; embedding Swagger in user-facing docs confuses audiences | Keep Swagger at `/api/docs` for developers only |
| Collapsible sidebar sections | Seems like a nice UX touch | With 2 sections and ~8 total articles, collapsing adds interaction cost for zero space savings | Flat, always-expanded sidebar at this scale |

---

## Feature Dependencies

```
[Role-based section visibility]
    └──requires──> [user.role from existing JWT auth context — already built]

[Bilingual article content]
    └──requires──> [i18next.language state from existing i18n — already built]

[Docs entrypoint in navbar]
    └──requires──> [wouter route /docs added]

[Markdown rendering]
    └──requires──> [react-markdown + remark-gfm — new dependency, ~50 kB]

[Prose styling (dark mode compatible)]
    └──requires──> [@tailwindcss/typography — new dependency, ~15 kB]
                       └──note──> Only new infra dependency; integrates with existing Tailwind v4 setup

[In-page anchor TOC]
    └──requires──> [Markdown rendering — table stakes above]
    └──enhances──> [long-form Admin Guide articles]

[Role-aware landing page]
    └──requires──> [Role-based section visibility — table stakes above]

[Contextual help deep links from Settings]
    └──requires──> [Docs router supports ?doc= query param]
                       └──requires──> [Sidebar navigation — table stakes above]
```

### Dependency Notes

- **React-markdown is a new npm dependency** but has no Docker or backend impact — pure frontend, Vite-bundled.
- **@tailwindcss/typography is a new dependency** but is a Tailwind plugin — integrates with the existing Tailwind v4 CSS-first config (no `tailwind.config.js` needed; add via `@plugin "@tailwindcss/typography"` in CSS).
- **No new backend, database, or Docker changes required** — docs are static Markdown files bundled at build time.
- **No new i18n keys needed for article content** — article language is selected by loading the correct `.de.md` or `.en.md` file. Sidebar labels and any UI chrome (e.g., "Last updated", article titles in sidebar) do need i18n keys.

---

## Content Category Breakdown

### User Guide (Viewers + Admins)

| Article | Key Content | DE/EN |
|---------|-------------|-------|
| Datei hochladen / File Upload | Accepted formats (CSV, TXT tab-delimited), 38-column requirement, what happens on upload, upload history, how to interpret error messages | Both |
| Sales-Dashboard | Revenue card, avg order value, orders card, delta badges (vs. Vorperiode / vs. Vorjahr), what the amber overlay chart shows, date presets (30d / 90d / 12m / allTime), bar/line toggle | Both |
| HR-Dashboard | 5 KPI definitions (overtime ratio formula, sick leave ratio formula, fluctuation rate, skill development, revenue per employee), dual delta badges, what "–" means, sync freshness indicator | Both |
| Datumsfilter & Periodenvergleich / Date Filters | How the 3 presets work, how "previous period" is computed, what the amber chart overlay represents, why delta shows "–" for allTime | Both |
| Dunkelmodus / Dark Mode | How to toggle sun/moon icon, OS preference auto-detection, localStorage persistence | Both |

### Admin Guide (Admins only)

| Article | Key Content | DE/EN |
|---------|-------------|-------|
| Docker Compose Setup | Prerequisites (Docker, Docker Compose v2), required `.env` variables, first-run `docker compose up`, Alembic migration service, healthcheck behavior, how to verify startup | Both |
| Benutzerverwaltung / User Management | Directus admin URL, creating a user, setting Admin vs Viewer role, resetting a password, cookie-mode session notes | Both |
| Personio-Konfiguration / Personio Configuration | API credentials (client_id + client_secret, write-only fields), sync interval options, absence type multi-select (how to identify correct type), department multi-select, skill attribute key (how to find the Personio custom attribute key), manual sync trigger | Both |
| Backup & Wiederherstellung / Backup & Restore | Nightly `pg_dump` sidecar, 14-day retention location, `scripts/restore.sh` usage, how to verify backup integrity | Both |

---

## MVP Definition

### Launch With (v1.13)

All scoped v1.13 target features — no trimming needed; scope is well-bounded.

- [ ] Navbar docs icon linking to `/docs`
- [ ] Sidebar with two sections: "Nutzerhandbuch" and "Administratorhandbuch"
- [ ] Role-based visibility: Viewers see only User Guide section; Admins see both sections
- [ ] Markdown rendering via `react-markdown` + `remark-gfm`
- [ ] Prose styling via `@tailwindcss/typography` (dark mode compatible via `prose-invert`)
- [ ] Bilingual articles: all content in `.de.md` and `.en.md`, language driven by `i18next.language`
- [ ] User Guide: 5 articles (Upload, Sales Dashboard, HR Dashboard, Date Filters, Dark Mode)
- [ ] Admin Guide: 4 articles (Docker Setup, User Management, Personio Config, Backup & Restore)
- [ ] Active article highlighted in sidebar

### Add If Time Permits in v1.13

- [ ] In-page anchor TOC — low effort, high value for long Admin articles
- [ ] Role-aware landing page redirect (Admin → Admin Guide default article) — ~1 hour

### Defer to Future Milestone

- [ ] Contextual `?doc=` deep links from Settings — useful but not critical; add if Settings-related support requests surface
- [ ] Full-text search — only if article count grows meaningfully beyond 15

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Navbar docs icon + `/docs` route | HIGH | LOW | P1 |
| Sidebar with section grouping | HIGH | LOW | P1 |
| Role-based section visibility | HIGH | LOW | P1 |
| react-markdown rendering | HIGH | LOW | P1 |
| @tailwindcss/typography prose styling | HIGH | LOW | P1 |
| Bilingual articles (DE/EN) | HIGH | MEDIUM | P1 |
| Active sidebar item highlight | MEDIUM | LOW | P1 |
| User Guide — all 5 articles authored | HIGH | MEDIUM | P1 |
| Admin Guide — all 4 articles authored | HIGH | MEDIUM | P1 |
| Dark mode compatible prose | HIGH | LOW | P1 (free with typography plugin) |
| In-page anchor TOC | MEDIUM | LOW | P2 |
| Role-aware landing redirect | LOW | LOW | P2 |
| Contextual help links from Settings | MEDIUM | MEDIUM | P3 |
| Full-text search | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.13 launch
- P2: Should have, add in v1.13 if time permits
- P3: Defer to future milestone

---

## Implementation Notes

### Markdown Library

Use `react-markdown` with `remark-gfm` plugin. This covers headings, paragraphs, code blocks, ordered/unordered lists, tables, and bold/italic — everything needed for prose documentation. No need for MDX (JSX compilation overhead is unnecessary for prose-only content) and no need for Fumadocs (standalone framework, wrong abstraction for docs bundled inside an existing Vite app).

### Typography Plugin for Tailwind v4

`@tailwindcss/typography` integrates with Tailwind v4 via the CSS `@plugin` directive:

```css
@plugin "@tailwindcss/typography";
```

Apply to the markdown container with `className="prose dark:prose-invert max-w-none"`. The `dark:prose-invert` class uses Tailwind's existing dark mode class strategy (already set up in v1.9) — no additional config.

### File Organization (Recommended)

```
src/docs/
  user/
    upload.de.md          upload.en.md
    sales-dashboard.de.md sales-dashboard.en.md
    hr-dashboard.de.md    hr-dashboard.en.md
    date-filters.de.md    date-filters.en.md
    dark-mode.de.md       dark-mode.en.md
  admin/
    docker-setup.de.md    docker-setup.en.md
    user-management.de.md user-management.en.md
    personio-config.de.md personio-config.en.md
    backup-restore.de.md  backup-restore.en.md
```

Static imports at build time via Vite's `?raw` import suffix or a manifest — no API call, no CMS, instant load.

### No Backend Changes Required

All documentation is static Markdown bundled into the React frontend. No new FastAPI endpoints, no new database tables, no new Docker services. The only new dependencies are two npm packages (`react-markdown`, `remark-gfm`, `@tailwindcss/typography`).

---

## Sources

- [react-markdown npm](https://www.npmjs.com/package/react-markdown) — standard Markdown → React component; widely used, Vite-compatible
- [remark-gfm GitHub](https://github.com/remarkjs/remark-gfm) — tables, strikethrough, code blocks in react-markdown
- [Fumadocs](https://www.fumadocs.dev/) — evaluated, rejected for this use case (standalone framework)
- [Docsie: Role-Based Documentation Access Control](https://www.docsie.io/solutions/role-based-documentation-access/) — role visibility patterns
- [Docsie: Role-Based Permissions for Documentation Teams](https://www.docsie.io/blog/glossary/role-based-permissions/) — permission model patterns
- [KPI Dashboard documentation best practices — Qlik](https://www.qlik.com/us/dashboard-examples/kpi-dashboards)
- [KPI Dashboard complete guide 2026 — Improvado](https://improvado.io/blog/kpi-dashboard)

---

*Feature research for: KPI Dashboard v1.13 In-App Documentation*
*Researched: 2026-04-16*
