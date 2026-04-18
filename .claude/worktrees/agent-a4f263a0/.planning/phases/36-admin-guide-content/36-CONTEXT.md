# Phase 36: Admin Guide Content - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Author 4 admin guide articles × 2 languages (EN + DE) covering system setup, architecture overview, Personio integration, and user management. Plus rewrite the admin intro stub. No new components, no routing changes — pure content authoring into the existing Phase 34 navigation shell.

Articles:
1. System setup — Docker Compose, environment variables, first start (AGUIDE-01)
2. Architecture overview — services, data flow, tech stack (AGUIDE-02)
3. Personio integration — credentials, sync config, mapping (AGUIDE-03)
4. User management — Directus roles, promoting users (AGUIDE-04)

</domain>

<decisions>
## Implementation Decisions

### Carried Forward from Phase 35
- **D-01:** **Tutorial-style** — step-by-step walkthroughs with numbered instructions
- **D-02:** **Professional casual tone** — friendly but direct
- **D-03:** **Text-only Markdown** — no screenshots or images
- **D-04:** **Blockquote callouts** — `> **Tip:**` and `> **Note:**` style
- **D-05:** **Consistent template** — intro paragraph → sections → tips/notes → related article links
- **D-06:** **Inline Markdown links** for cross-references between articles

### Audience & Technical Depth
- **D-07:** **Ops-savvy admin audience** — assumes familiarity with Docker, environment variables, CLI basics. Articles explain what to configure, not what Docker is. Concise and actionable.

### Sensitive Information Handling
- **D-08:** **Placeholder + .env reference** — use `your-api-key-here` style placeholders in examples. Always reference the `.env` file. Include a `> **Note:**` about never committing secrets to version control.

### Architecture Article Scope
- **D-09:** **Service map + data flow level** — list each service (FastAPI, PostgreSQL, Directus, Vite frontend), how they connect, ports, and data flow. Text-based descriptions, no diagrams. Enough to understand the system without reading source code.

### Cross-Guide Linking
- **D-10:** **Bidirectional cross-linking** — admin articles link to relevant user guide articles (e.g., "users will see the Sales Dashboard") and user guide articles can link back (e.g., "ask your admin to configure Personio"). Use same D-06 inline Markdown link format.

### Claude's Discretion
- Article slug names (kebab-case, e.g., `system-setup`, `architecture`)
- Exact section headings within each article
- Which tips/notes to include and where
- How much detail per configuration step
- German translation style (natural DE, not literal translation)
- Whether to update existing user guide articles with back-links to admin guide, or leave that for a separate task

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AGUIDE-01 through AGUIDE-04 and I18N-01 define what each article must cover

### Phase 35 Context (content decisions to carry forward)
- `.planning/phases/35-user-guide-content/35-CONTEXT.md` — D-01 through D-07 content authoring decisions

### Phase 34 Outputs (navigation shell)
- `frontend/src/lib/docs/registry.ts` — Registry pattern: add `?raw` imports and `sections[]` entries
- `frontend/src/components/docs/DocsSidebar.tsx` — Sidebar reads from `sections[]`, admin section gated by AdminOnly
- `frontend/src/locales/en.json` / `de.json` — Add `docs.nav.*` title keys for new articles

### Phase 33 Outputs (rendering infrastructure)
- `frontend/src/components/docs/MarkdownRenderer.tsx` — Renders article Markdown
- `frontend/src/lib/docs/toc.ts` — Extracts TOC from `##` headings

### Existing Content (patterns to follow)
- `frontend/src/docs/en/admin-guide/intro.md` — Existing stub to replace
- `frontend/src/docs/en/user-guide/intro.md` — Example of completed article (Phase 35 output)

### App Features (content source — read to understand what to document)
- `docker-compose.yml` — Service definitions, ports, healthchecks for AGUIDE-01/02
- `.env.example` — Environment variable reference for AGUIDE-01
- `frontend/src/pages/SettingsPage.tsx` — Settings UI for AGUIDE-03/04
- `frontend/src/components/settings/PersonioCard.tsx` — Personio config UI for AGUIDE-03
- `backend/app/routers/sync.py` — Personio sync backend for AGUIDE-03
- `backend/app/routers/settings.py` — Settings API for AGUIDE-03/04

### User Guide Articles (cross-link targets)
- `frontend/src/docs/en/user-guide/hr-dashboard.md` — References Personio sync (link target for AGUIDE-03)
- `frontend/src/docs/en/user-guide/uploading-data.md` — References admin-only upload page (link target for AGUIDE-04)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Article registry** (`frontend/src/lib/docs/registry.ts`): Same pattern as Phase 35 — add imports and entries
- **Admin section in sidebar**: Already exists in `sections["admin-guide"]` with intro entry
- **i18n locale files**: Add `docs.nav.{articleTitleKey}` keys (nested format under `docs.nav`)

### Established Patterns
- **Content structure**: `frontend/src/docs/{lang}/{section}/{slug}.md`
- **Vite raw imports**: `import content from "../../docs/en/admin-guide/slug.md?raw"`
- **Registry wiring**: MD file → raw import → sections entry → registry entry → i18n title key
- **Heading convention**: `##` for main sections (generates TOC entries)
- **i18n key format**: Nested JSON under `docs.nav` (not flat dot-notation)

### Integration Points
- `frontend/src/lib/docs/registry.ts` — Add 4 new articles × 2 languages = 8 new imports + registry entries
- `frontend/src/locales/en.json` / `de.json` — Add 4 new `docs.nav.*` title keys each (nested format)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for content authoring.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-admin-guide-content*
*Context gathered: 2026-04-16*
