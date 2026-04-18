# Phase 34: Navigation Shell - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Navbar docs icon, role-filtered sidebar, role-aware default article routing, and bilingual UI chrome. This phase builds the navigation shell around the rendering infrastructure from Phase 33 — no new content authoring, no changes to the Markdown renderer or TOC.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Layout
- **D-01:** **Grouped flat list** — section headers ("User Guide", "Admin Guide") with flat article links underneath. No collapsible trees or tabs. Appropriate for the small article count (~9 total).

### Role Gating
- **D-02:** Viewers see only the User Guide section in the sidebar. Admin Guide section is completely hidden (not grayed out, not locked — invisible).
- **D-03:** If a Viewer navigates directly to an admin article URL, **silently redirect to the user guide intro article**. No 404, no "access denied" — Viewer never knows admin docs exist.

### Navbar Icon
- **D-04:** Use **lucide-react `Library` icon** (stacked books / bookstack style) for the docs navbar link, placed left of the upload icon.
- **D-05:** Docs icon visible to all authenticated roles (Admin and Viewer).

### Article Routing
- **D-06:** URL structure: **`/docs/:section/:slug`** — e.g. `/docs/user-guide/uploading-data`, `/docs/admin-guide/system-setup`. Section prefix enables clean role gating.
- **D-07:** Navigating to bare `/docs` redirects to role-aware default: Admin → `/docs/admin-guide/intro`, Viewer → `/docs/user-guide/intro`.

### i18n
- **D-08:** All sidebar labels, section headers, and navigation chrome use react-i18next keys in existing `en.json`/`de.json` locale files. Article content language follows the global i18n toggle (existing pattern from Phase 33).

### Claude's Discretion
- Sidebar width and responsive breakpoint for sidebar collapse/hide
- Active article highlight style in sidebar
- Transition/animation on route changes (if any)
- Article slug naming convention (kebab-case assumed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Infrastructure
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02, NAV-03, I18N-02 define success criteria
- `CLAUDE.md` — Technology stack, conventions

### Phase 33 Outputs (foundation this phase builds on)
- `.planning/phases/33-rendering-foundation/33-CONTEXT.md` — Rendering decisions (D-01 through D-06)
- `.planning/phases/33-rendering-foundation/33-01-SUMMARY.md` — MarkdownRenderer, extractToc, DocsPage implementation details
- `.planning/phases/33-rendering-foundation/33-02-SUMMARY.md` — TableOfContents component details

### Existing Code
- `frontend/src/App.tsx` — wouter routing, lazy-loaded `/docs` route already exists
- `frontend/src/pages/DocsPage.tsx` — Current docs page with two-column layout (article + TOC)
- `frontend/src/components/NavBar.tsx` — Navbar with Upload, Settings, LogOut icons; add docs icon here
- `frontend/src/auth/AuthContext.tsx` — `Role` type (`"admin" | "viewer"`), `AuthUser` interface
- `frontend/src/auth/useAuth.ts` — Hook to access current user/role
- `frontend/src/auth/AdminOnly.tsx` — Existing role-gating wrapper component
- `frontend/src/locales/en.json` / `de.json` — i18n locale files, already have `docs.toc.title` key

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AdminOnly` component** (`frontend/src/auth/AdminOnly.tsx`): Wraps children and renders only for admin role — use for Admin Guide sidebar section
- **`useAuth` hook**: Returns `{ user, role }` — use for role-aware default routing
- **`MarkdownRenderer`** (`frontend/src/components/docs/MarkdownRenderer.tsx`): Already renders prose with syntax highlighting and anchors
- **`TableOfContents`** (`frontend/src/components/docs/TableOfContents.tsx`): Sticky right sidebar with active heading tracking
- **`extractToc`** (`frontend/src/lib/docs/toc.ts`): Extracts headings from raw Markdown string

### Established Patterns
- **Routing**: wouter `Route`/`Switch` in App.tsx with `useLocation` for active link styling
- **Role gating**: `AdminOnly` wrapper + `useAuth().role` checks
- **i18n**: `useTranslation()` hook with nested key structure (`nav.upload`, `docs.toc.title`)
- **Icon styling**: lucide-react icons with Tailwind classes, active state via `text-primary`

### Integration Points
- `frontend/src/components/NavBar.tsx` — Add Library icon link to `/docs`
- `frontend/src/pages/DocsPage.tsx` — Refactor from single-article view to sidebar + article layout with routing
- `frontend/src/App.tsx` — Expand `/docs` route to handle nested `:section/:slug` params

</code_context>

<specifics>
## Specific Ideas

- User wants a **bookstack/library style** icon (lucide `Library`), not the typical BookOpen

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-navigation-shell*
*Context gathered: 2026-04-16*
