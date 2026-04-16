# Phase 36: Admin Guide Content - Research

**Researched:** 2026-04-16
**Domain:** Documentation content authoring — Markdown, i18n wiring, registry integration
**Confidence:** HIGH

## Summary

Phase 36 is a pure content authoring phase — no new components, no routing changes. The Phase 34 navigation shell and Phase 33 rendering pipeline are fully operational. The only work is: (1) write 4 admin guide articles × 2 languages as `.md` files, (2) wire each into `registry.ts` with `?raw` imports and `sections[]` entries, (3) add 4 i18n title keys to both `en.json` and `de.json`, and (4) replace the two admin intro stubs with proper overview articles.

The article content must be sourced from reading the actual app: `docker-compose.yml` for the service map, `.env.example` for environment variables, `PersonioCard.tsx` and backend routers for Personio config details, and `en.json` for user management labels. All content decisions (tone, template, callout style, audience depth) are locked from Phase 35 and carried forward verbatim.

**Primary recommendation:** Author articles in the established Phase 35 pattern, wire registry and i18n in one go per article. No new dependencies, no infrastructure changes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tutorial-style — step-by-step walkthroughs with numbered instructions
- **D-02:** Professional casual tone — friendly but direct
- **D-03:** Text-only Markdown — no screenshots or images
- **D-04:** Blockquote callouts — `> **Tip:**` and `> **Note:**` style
- **D-05:** Consistent template — intro paragraph → sections → tips/notes → related article links
- **D-06:** Inline Markdown links for cross-references between articles
- **D-07:** Ops-savvy admin audience — assumes familiarity with Docker, environment variables, CLI basics. Articles explain what to configure, not what Docker is. Concise and actionable.
- **D-08:** Placeholder + .env reference — use `your-api-key-here` style placeholders in examples. Always reference the `.env` file. Include a `> **Note:**` about never committing secrets to version control.
- **D-09:** Service map + data flow level — list each service (FastAPI, PostgreSQL, Directus, Vite frontend), how they connect, ports, and data flow. Text-based descriptions, no diagrams.
- **D-10:** Bidirectional cross-linking — admin articles link to relevant user guide articles and vice versa. Use D-06 inline Markdown link format.

### Claude's Discretion
- Article slug names (kebab-case, e.g., `system-setup`, `architecture`)
- Exact section headings within each article
- Which tips/notes to include and where
- How much detail per configuration step
- German translation style (natural DE, not literal translation)
- Whether to update existing user guide articles with back-links to admin guide, or leave that for a separate task

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGUIDE-01 | Admin can read system setup instructions (Docker Compose, environment variables, first start) | `docker-compose.yml` and `.env.example` fully document all services and env vars |
| AGUIDE-02 | Admin can read architecture overview (services, data flow, tech stack) | `docker-compose.yml` service definitions + port mappings + `depends_on` chain define the full architecture |
| AGUIDE-03 | Admin can read Personio integration setup (credentials, sync config, absence/department mapping) | `PersonioCard.tsx` and `en.json` `settings.personio.*` keys document every config field |
| AGUIDE-04 | Admin can read user management instructions (Directus roles, promoting users) | `.env.example` role UUIDs + `bootstrap-roles.sh` + Directus admin workflow |
| I18N-01 | All documentation content exists in both DE and EN, consistent with the app's current language | Established pattern from Phase 35 — `de/` mirror of `en/` tree, registry wired for both |
</phase_requirements>

---

## Standard Stack

No new dependencies. This phase uses only what already exists in the project.

### Core (already installed)
| Asset | Location | Purpose |
|-------|----------|---------|
| Markdown files | `frontend/src/docs/{lang}/{section}/{slug}.md` | Article content |
| Registry | `frontend/src/lib/docs/registry.ts` | `?raw` imports + `sections[]` + `registry{}` entries |
| i18n locale files | `frontend/src/locales/en.json` / `de.json` | Article title keys under `docs.nav` |
| MarkdownRenderer | `frontend/src/components/docs/MarkdownRenderer.tsx` | Renders articles — no changes needed |

**No npm installs. No new files outside the docs tree and registry.**

---

## Architecture Patterns

### Established File Structure (from Phase 35)
```
frontend/src/docs/
├── en/
│   ├── admin-guide/
│   │   ├── intro.md          ← REPLACE (stub → full overview)
│   │   ├── system-setup.md   ← CREATE
│   │   ├── architecture.md   ← CREATE
│   │   ├── personio.md       ← CREATE
│   │   └── user-management.md ← CREATE
│   └── user-guide/           (Phase 35 — read-only, may add back-links)
└── de/
    ├── admin-guide/
    │   ├── intro.md          ← REPLACE
    │   ├── system-setup.md   ← CREATE
    │   ├── architecture.md   ← CREATE
    │   ├── personio.md       ← CREATE
    │   └── user-management.md ← CREATE
    └── user-guide/           (Phase 35 — read-only, may add back-links)
```

### Registry Wiring Pattern (from Phase 35, confirmed from registry.ts)

**Step 1 — Add `?raw` imports at top of `registry.ts`:**
```typescript
import enSystemSetup from "../../docs/en/admin-guide/system-setup.md?raw";
import deSystemSetup from "../../docs/de/admin-guide/system-setup.md?raw";
// ... repeat for each article × 2 languages
```

**Step 2 — Add entries to `sections["admin-guide"]`:**
```typescript
"admin-guide": [
  { slug: "intro", titleKey: "docs.nav.adminGuideIntro" },
  { slug: "system-setup", titleKey: "docs.nav.adminSystemSetup" },
  { slug: "architecture", titleKey: "docs.nav.adminArchitecture" },
  { slug: "personio", titleKey: "docs.nav.adminPersonio" },
  { slug: "user-management", titleKey: "docs.nav.adminUserManagement" },
],
```

**Step 3 — Add to `registry["en"]["admin-guide"]` and `registry["de"]["admin-guide"]`:**
```typescript
"admin-guide": {
  intro: enAdminIntro,
  "system-setup": enSystemSetup,
  architecture: enArchitecture,
  personio: enPersonio,
  "user-management": enUserManagement,
},
```

### i18n Key Pattern (flat keys with `keySeparator: false`)

State.md records: "i18n keys added as flat keys matching existing keySeparator:false convention." However, `en.json` shows the `docs` section uses **nested JSON** (not flat dot strings). The existing `docs.nav.*` keys are nested objects. New keys must follow the **nested format** exactly.

Add inside `docs.nav` object in both `en.json` and `de.json`:
```json
"adminSystemSetup": "System Setup",
"adminArchitecture": "Architecture",
"adminPersonio": "Personio Integration",
"adminUserManagement": "User Management"
```

German equivalents (natural DE, not literal):
```json
"adminSystemSetup": "Systemeinrichtung",
"adminArchitecture": "Architektur",
"adminPersonio": "Personio-Integration",
"adminUserManagement": "Benutzerverwaltung"
```

### Article Template (locked from D-01, D-04, D-05)
```markdown
# Article Title

Intro paragraph — what this article covers and who it is for.

## Section Heading

Step-by-step content with numbered lists where sequential.

> **Tip:** Optional tip.

> **Note:** Optional note.

## Related Articles

- [Article Name](/docs/section/slug) — one-line description.
```

---

## Content Source Map

The following app artifacts are the authoritative source for each article's content:

### AGUIDE-01: System Setup

**Sources:** `docker-compose.yml`, `.env.example`

Key facts to include:
- **Services:** `db` (postgres:17-alpine), `migrate` (alembic upgrade head), `api` (FastAPI/uvicorn port 8000), `frontend` (Vite port 5173), `directus` (11.17.2 port 8055 — localhost only), `directus-bootstrap-roles` (curl sidecar), `backup` (pg_isready-based)
- **Startup sequence:** `db` healthy → `migrate` completes → `api` healthy + `directus` healthy → `frontend` starts; `directus-bootstrap-roles` runs after `directus` is healthy
- **Required env vars from `.env.example`:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`, `DIRECTUS_ADMINISTRATOR_ROLE_UUID`, `DIRECTUS_VIEWER_ROLE_UUID`
- **Key steps:** Copy `.env.example` → `.env`, fill in secrets, generate DIRECTUS_KEY/SECRET with `openssl rand -base64 32`, run `docker compose up -d`, fetch Administrator UUID on first boot
- **D-08 callout:** Never commit `.env` to version control

### AGUIDE-02: Architecture Overview

**Sources:** `docker-compose.yml` (service definitions, ports, depends_on)

Key facts to include:
- **Services and roles:**
  - `db` — PostgreSQL 17, data store, not exposed externally
  - `migrate` — one-shot Alembic migration runner, exits after completion
  - `api` — FastAPI (Python/asyncpg), port 8000, REST API for frontend + data ingestion
  - `frontend` — Vite/React SPA, port 5173, served in dev mode
  - `directus` — Identity/auth layer, port 8055 (localhost only), Directus 11.17.2
  - `directus-bootstrap-roles` — Idempotent role bootstrap sidecar (curl), runs once
  - `backup` — Scheduled pg_dump service
- **Data flow:** Browser → Vite SPA (5173) → FastAPI (8000) → PostgreSQL (5432); Browser → Directus (8055) for auth tokens; FastAPI → Personio API (external) for HR data
- **Tech stack summary:** FastAPI + SQLAlchemy 2.0 + asyncpg / PostgreSQL 17 / React 19 + Vite 8 + TanStack Query / Directus 11 / Recharts 3
- **Excluded from Directus Data Model UI:** `upload_batches`, `sales_records`, `app_settings`, and Personio tables (DB_EXCLUDE_TABLES)

### AGUIDE-03: Personio Integration

**Sources:** `PersonioCard.tsx`, `en.json` (`settings.personio.*` keys), `backend/app/routers/sync.py`

Key facts to include:
- **Credentials:** Client ID + Client Secret, entered in Settings → Personio section. Write-only inputs (type=password). Stored in backend, not in `.env`.
- **Test connection:** "Test connection" button verifies credentials against Personio API before saving.
- **Sync interval options:** Manual only / Hourly / Every 6 hours / Daily
- **Mapping fields:**
  - Sick leave type — multiselect from absence types fetched from Personio (used to compute Sick Leave Ratio KPI)
  - Production department — multiselect from departments (used to compute Revenue / Prod. Employee KPI)
  - Skill attribute keys — multiselect from custom attributes (used to compute Skill Development KPI)
- **Options loading:** Absence type and department dropdowns populate only after credentials are saved and verified.
- **Manual sync:** "Refresh data" button on HR Dashboard triggers immediate sync.
- **D-08 callout:** Credentials are stored in the backend database, not in `.env` — but still treat as secrets.
- **Cross-link:** Link to [HR Dashboard](/docs/user-guide/hr-dashboard) for how synced data appears.

### AGUIDE-04: User Management

**Sources:** `.env.example` (role UUIDs), `directus/bootstrap-roles.sh` (role creation), Directus admin UI

Key facts to include:
- **Two roles:** Administrator (full access), Viewer (read-only)
- **Viewer role:** UUID fixed in `bootstrap-roles.sh` — `a2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- **Administrator role UUID:** Generated by Directus on first boot; must be fetched and set in `.env` as `DIRECTUS_ADMINISTRATOR_ROLE_UUID`
- **Promoting a user:** Log into Directus admin (`http://localhost:8055`) → Users → select user → change Role to Administrator
- **Creating a user:** Directus admin → Users → + New User → set email, password, role
- **D-08 consideration:** DIRECTUS_ADMIN_PASSWORD is the bootstrap admin credential; store in a password manager
- **Cross-link:** Link to [Uploading Data](/docs/user-guide/uploading-data) noting only Admins can upload.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Markdown rendering | Custom parser | Existing `MarkdownRenderer.tsx` (react-markdown + rehype pipeline) |
| Sidebar registration | Manual DOM manipulation | `sections[]` array in `registry.ts` — sidebar reads from it |
| Language fallback | Custom fallback logic | `registry[lang][section][slug]` lookup — DocsPage already handles missing keys |
| TOC generation | Manual heading scraping | `extractToc()` in `toc.ts` — reads `##` headings automatically |

---

## Common Pitfalls

### Pitfall 1: Nested vs. flat i18n keys
**What goes wrong:** Adding a flat key `"docs.nav.adminSystemSetup": "..."` at the top level of `en.json` instead of inside the nested `docs.nav` object.
**Why it happens:** State.md mentions "flat keys matching keySeparator:false convention" — this referred to earlier non-docs keys. The `docs` section in `en.json` uses nested JSON objects.
**How to avoid:** Open `en.json`, find the `"docs": { "nav": { ... } }` block, add new keys inside that `nav` object. Do NOT add dot-notation string keys at the top level of the file.

### Pitfall 2: Forgetting to update both `sections[]` and `registry{}`
**What goes wrong:** Article file exists, import added, but entry missing from `sections["admin-guide"]` — article never appears in sidebar.
**Why it happens:** Two separate data structures must both be updated.
**How to avoid:** For each new article: (1) create `.md` file, (2) add `?raw` import, (3) add `sections[]` entry, (4) add `registry` entry for both `en` and `de`.

### Pitfall 3: Missing DE mirror file
**What goes wrong:** Registry wired for both `en` and `de`, but the DE `.md` file doesn't exist — Vite build error or runtime registry miss.
**Why it happens:** Easy to forget the DE file when focused on content authoring.
**How to avoid:** Create both `en/admin-guide/{slug}.md` and `de/admin-guide/{slug}.md` before wiring the registry.

### Pitfall 4: Admin intro stubs not replaced
**What goes wrong:** New articles appear in sidebar but the intro still says "Articles will be added in upcoming updates."
**Why it happens:** Intro files exist and are already registered — easy to overlook as "already done."
**How to avoid:** The intro stub replacement is an explicit task. Both `en/admin-guide/intro.md` and `de/admin-guide/intro.md` must be overwritten.

### Pitfall 5: `?raw` import path relative to registry.ts location
**What goes wrong:** Import path resolves wrong because registry is at `frontend/src/lib/docs/registry.ts` — docs are at `frontend/src/docs/`.
**Why it happens:** Relative path is `../../docs/` from `registry.ts` — this is the established pattern (confirmed from existing imports).
**How to avoid:** Copy the import path pattern exactly: `import X from "../../docs/en/admin-guide/{slug}.md?raw"`.

---

## Code Examples

### Adding an article to registry.ts (complete pattern)
```typescript
// Source: frontend/src/lib/docs/registry.ts (Phase 35 pattern)

// 1. Add imports at top of file
import enSystemSetup from "../../docs/en/admin-guide/system-setup.md?raw";
import deSystemSetup from "../../docs/de/admin-guide/system-setup.md?raw";

// 2. Add to sections (controls sidebar order)
"admin-guide": [
  { slug: "intro", titleKey: "docs.nav.adminGuideIntro" },
  { slug: "system-setup", titleKey: "docs.nav.adminSystemSetup" },
  // ...
],

// 3. Add to registry (both lang branches)
en: {
  "admin-guide": {
    intro: enAdminIntro,
    "system-setup": enSystemSetup,
    // ...
  },
},
de: {
  "admin-guide": {
    intro: deAdminIntro,
    "system-setup": deSystemSetup,
    // ...
  },
},
```

### Adding i18n keys (nested object format)
```json
// Source: frontend/src/locales/en.json — inside "docs": { "nav": { ... } }
{
  "docs": {
    "nav": {
      "adminGuideIntro": "Introduction",
      "adminSystemSetup": "System Setup",
      "adminArchitecture": "Architecture",
      "adminPersonio": "Personio Integration",
      "adminUserManagement": "User Management"
    }
  }
}
```

---

## Environment Availability

Step 2.6: SKIPPED — phase is pure content authoring with no external dependencies. All infrastructure was established in Phases 33–35.

---

## Validation Architecture

No automated tests apply to Markdown content authoring. The phase is validated by:

1. `docker compose up` — verify app starts cleanly with the new registry entries
2. Navigate to `/docs/admin-guide/system-setup` in both EN and DE — verify article renders
3. Check TOC sidebar — verify all 4 new articles appear under Admin Guide
4. Verify intro articles are replaced (not stubs)
5. Check language toggle switches content correctly

These are manual smoke tests performed after implementation. No jest/vitest/pytest changes required.

---

## Open Questions

1. **Back-linking user guide articles to admin guide**
   - What we know: D-10 says bidirectional cross-linking; user guide articles already exist
   - What's unclear: Whether to update Phase 35 user guide articles now or defer
   - Recommendation: Claude's discretion per CONTEXT.md — add back-links if they improve the user guide; if time-boxed, defer and note in SUMMARY.md

2. **`bootstrap-roles.sh` content**
   - What we know: The file exists at `directus/bootstrap-roles.sh` and creates the Viewer role with a fixed UUID
   - What's unclear: Exact admin promotion workflow via Directus UI (role assignment steps)
   - Recommendation: Read `bootstrap-roles.sh` and the Directus admin UI flow during implementation to get exact step descriptions for AGUIDE-04

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/lib/docs/registry.ts` — Exact wiring pattern verified
- `frontend/src/locales/en.json` — i18n key structure verified (nested `docs.nav` object)
- `docker-compose.yml` — All services, ports, healthchecks, depends_on chain
- `.env.example` — All required environment variables
- `frontend/src/docs/en/user-guide/intro.md` — Article template to follow
- `frontend/src/docs/en/admin-guide/intro.md` — Stub to be replaced
- `.planning/phases/36-admin-guide-content/36-CONTEXT.md` — All locked decisions
- `frontend/src/components/settings/PersonioCard.tsx` — Personio config fields

### Secondary (MEDIUM confidence)
- `frontend/src/locales/de.json` — DE i18n key structure (nested format, verified matches EN)

---

## Metadata

**Confidence breakdown:**
- Registry wiring pattern: HIGH — confirmed from Phase 35 output in registry.ts
- i18n key format: HIGH — verified nested structure in both locale files
- Article content facts: HIGH — sourced directly from docker-compose.yml, .env.example, PersonioCard.tsx
- German translation style: MEDIUM — natural DE judgment; no translation tool used
- Directus user promotion workflow: MEDIUM — inferred from .env.example comments; read bootstrap-roles.sh during implementation to confirm

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable infrastructure; content decisions locked)
