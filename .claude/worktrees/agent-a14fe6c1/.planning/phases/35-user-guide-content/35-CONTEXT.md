# Phase 35: User Guide Content - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Author 5 user guide articles × 2 languages (EN + DE) covering every user-facing feature. No new components, no routing changes, no UI modifications — pure content authoring that drops into the existing navigation shell from Phase 34.

Articles:
1. Uploading data (UGUIDE-01)
2. Sales dashboard (UGUIDE-02)
3. HR dashboard (UGUIDE-03)
4. Filters, date ranges, chart controls (UGUIDE-04)
5. Language switch and dark mode (UGUIDE-05)

</domain>

<decisions>
## Implementation Decisions

### Article Depth & Tone
- **D-01:** **Tutorial-style** — step-by-step walkthroughs with numbered instructions. Assumes mixed technical levels.
- **D-02:** **Professional casual tone** — friendly but direct. No jargon, no corporate stiffness. Example: "Upload your file by dragging it onto the drop zone."

### Visual Aids
- **D-03:** **Text-only Markdown** — no screenshots or images. Use Markdown formatting (bold, lists, code snippets) to guide users. Avoids image asset pipeline and stays in sync with UI.
- **D-04:** **Blockquote callouts** for tips, warnings, and notes. Use `> **Tip:**` and `> **Note:**` style — renders well with existing Phase 33 prose styling.

### Article Structure
- **D-05:** **Consistent template** across all 5 articles: intro paragraph → step-by-step sections → tips/notes → related article links. Predictable reading experience.
- **D-06:** **Inline Markdown links** for cross-references between articles. Example: `See [Filters & Date Ranges](/docs/user-guide/filters) for details.`

### Content Overlap
- **D-07:** **UGUIDE-04 is a separate article** — dashboard articles (UGUIDE-02/03) mention filters briefly and link to UGUIDE-04 for the full walkthrough. Avoids duplication.

### Claude's Discretion
- Article slug names (kebab-case, e.g., `uploading-data`, `sales-dashboard`)
- Exact section headings within each article
- Which tips/notes to include and where
- How much detail per step (balance completeness with readability)
- German translation style (natural DE, not literal translation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — UGUIDE-01 through UGUIDE-05 define what each article must cover

### Phase 34 Outputs (navigation shell this phase drops into)
- `frontend/src/lib/docs/registry.ts` — Registry pattern: add `?raw` imports and `sections[]` entries for each new article
- `frontend/src/components/docs/DocsSidebar.tsx` — Sidebar reads from `sections[]` in registry
- `frontend/src/locales/en.json` / `de.json` — Add `docs.nav.*` title keys for each new article

### Phase 33 Outputs (rendering infrastructure)
- `frontend/src/components/docs/MarkdownRenderer.tsx` — Renders article Markdown as styled prose
- `frontend/src/lib/docs/toc.ts` — Extracts TOC from headings (articles should use `##` for main sections)

### Existing Content (patterns to follow)
- `frontend/src/docs/en/user-guide/intro.md` — Existing stub to be replaced with real content
- `frontend/src/docs/de/user-guide/intro.md` — German stub to be replaced

### App Features (content source — read to understand what to document)
- `frontend/src/pages/UploadPage.tsx` — Upload feature for UGUIDE-01
- `frontend/src/pages/DashboardPage.tsx` — Sales dashboard for UGUIDE-02
- `frontend/src/pages/HRPage.tsx` — HR dashboard for UGUIDE-03
- `frontend/src/components/DateRangeFilter.tsx` or similar — Filters for UGUIDE-04
- `frontend/src/components/LanguageToggle.tsx` — Language toggle for UGUIDE-05
- `frontend/src/components/ThemeToggle.tsx` — Dark mode toggle for UGUIDE-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Article registry** (`frontend/src/lib/docs/registry.ts`): Add new imports and entries — pattern established
- **Sidebar sections** (`sections` in registry): Add article entries for sidebar navigation
- **i18n locale files**: Add `docs.nav.{articleTitleKey}` for each new article

### Established Patterns
- **Content structure**: `frontend/src/docs/{lang}/{section}/{slug}.md` file convention
- **Vite raw imports**: `import content from "../../docs/en/user-guide/slug.md?raw"`
- **Registry wiring**: Each article needs: MD file, raw import, sections entry, registry entry, i18n title key
- **Heading convention**: Use `##` for main sections (generates TOC entries via extractToc)

### Integration Points
- `frontend/src/lib/docs/registry.ts` — Add 5 new articles × 2 languages = 10 new imports + registry entries
- `frontend/src/locales/en.json` / `de.json` — Add 5 new `docs.nav.*` title keys each

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

*Phase: 35-user-guide-content*
*Context gathered: 2026-04-16*
