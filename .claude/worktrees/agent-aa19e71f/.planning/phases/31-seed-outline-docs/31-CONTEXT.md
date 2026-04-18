---
phase: 31
name: seed-outline-docs
created: 2026-04-15
---

# Phase 31 Context — Seed Outline Docs

## Phase Goal

The "KPI Dashboard" Outline collection contains 8 authored documentation pages reachable from a collection landing page with a table of contents, reflecting the v1.10 state of the application. The collection creation + permission model is documented so future projects (Project Y, Project Z, ...) follow the same pattern. Final v1.11 E2E UATs signed off.

## Domain Boundary

**In scope:**
- Create the "KPI Dashboard" collection in Outline
- Author 8 pages: Dev Setup (DOC-01), Docker Compose Architecture (DOC-02), API Reference (DOC-03), Personio Sync Runbook (DOC-04), Sales Dashboard User Guide (DOC-05), HR Dashboard User Guide (DOC-06), Settings Walkthrough (DOC-07), Admin Runbook (DOC-08)
- Landing page with TOC + cross-links (DOC-09)
- Collection + permission recipe (WMP-01, WMP-02, WMP-03)
- Markdown export snapshot committed to `docs/wiki-seed/` for disaster recovery
- Final E2E UATs: E2E-01, E2E-03, E2E-04, E2E-05

**Out of scope:**
- Embedded-screenshot maintenance (text-only decision D-07)
- Auto-sync from FastAPI OpenAPI to Outline (thin-page decision D-02)
- Outline markdown-export automation (manual-export acceptable — D-06)
- A second project's docs (validates WMP-03 pattern only)

## Carried-Forward Decisions

- **Outline reachable at `https://wiki.internal`** (Phase 29 WIK-01)
- **Dex `staticPasswords` does NOT deliver silent cross-app SSO** (Phase 29 Known Limitation) — **E2E-04 must be reframed** as "NavBar icon opens Outline in a new tab; same credentials work without needing a second account", NOT "no login prompt". This reframe mirrors Phase 29 SC #3.
- **`admin@acm.local` / `ChangeMe!2026-admin` is a placeholder password** flagged for rotation in `dex/config.yaml` SECURITY NOTE — any admin-runbook content must treat this as a placeholder and document rotation
- **`docs/setup.md` is the canonical operator runbook in repo** — Phase 26/27/28/29 all wrote into it. DOC-08 in Outline references it rather than duplicating.
- **i18n UI label convention: reference EN strings** — DE parity is maintained via `react-i18next`; docs reference labels as "Settings → Appearance" (EN) without mirroring DE.

## Decisions (Phase 31)

### D-01: Author directly in the Outline editor, export snapshots to repo
Primary authoring surface = Outline WYSIWYG/markdown editor. After each page is authored and reviewed, **export to markdown via Outline's built-in "Download as Markdown"** and commit the snapshot to `docs/wiki-seed/` (see D-05).

**Rationale:** 1-A flow is fastest for prose-heavy pages (8 docs, mostly narrative); editor previews, link autocompletion, and Mermaid rendering all work in-place. The D-06 snapshot provides git-history disaster recovery without the overhead of a draft-in-repo → paste flow.

### D-02: DOC-03 API Reference is THIN
The Outline page contains:
- One-paragraph intro stating the live, always-current spec is at `https://kpi.internal/api/docs` (FastAPI Swagger UI)
- One table listing the 7 tag groups (settings, uploads, kpis, hr_kpis, sync, data, auth) with 1-line descriptions + link to the Swagger section
- A short "Auth pattern" and "Error shape" section (these don't rot)
- NO per-endpoint request/response examples (those live in Swagger and would drift)

**Rationale:** Avoids doc rot. The organizing model (tags, auth, error shape) is stable; the surface changes. Reviewers can always click through to the live spec.

### D-03: Mermaid diagrams for DOC-02
Outline renders Mermaid natively in markdown fenced blocks (```` ```mermaid ```` ). Diagram shows all 9 compose services with healthcheck-gated `depends_on` edges and volume mounts.

**Rationale:** Editable, diffable, readable. Outline renders inline — no image upload required.

### D-04: DOC-08 Admin Runbook = summary + link to `docs/setup.md` + Outline-specific ops
The Outline page contains:
- 3-paragraph "What this page is for" intro
- Link to the canonical operator runbook: `https://github.com/ORG/REPO/blob/main/docs/setup.md` (replace ORG/REPO with the actual repo URL during authoring)
- Outline-specific ops sections NOT in docs/setup.md:
  - Adding a Dex user (full bcrypt workflow inline — copy-pasteable)
  - Outline DB + attachment backup commands (copy-pasteable)
  - Rotating OIDC client secrets (inline — high-stakes, deserves to be discoverable in the wiki)
- Cross-link to DOC-01 Dev Setup

**Rationale:** Avoids duplication (D-03 rot risk) while giving non-dev ops people a wiki-discoverable view. Dev flow stays in repo; ops-who-don't-clone flow stays in Outline.

### D-05: Repo snapshot location = `docs/wiki-seed/`
After each Outline page is authored:
```
docs/wiki-seed/
  00-landing.md
  01-dev-setup.md
  02-architecture.md
  03-api-reference.md
  04-personio-sync.md
  05-sales-dashboard.md
  06-hr-dashboard.md
  07-settings.md
  08-admin-runbook.md
  README.md    # explains that these are Outline exports, how to regenerate
```
Filenames use `##-slug.md` prefix matching DOC-01..DOC-08 numbering. The landing page (DOC-09) is `00-landing.md`.

`docs/wiki-seed/README.md` explains: "These are markdown exports of the KPI Dashboard Outline collection. Outline is canonical; this directory is a snapshot for version history and disaster recovery. Regenerate via: Outline UI → each page → ⋯ menu → Download → Markdown."

**Rationale:** Permanent git history of wiki content, cheap disaster recovery, operator can grep wiki content from repo. Manual export is acceptable — updates are low-frequency (per-milestone, not per-PR).

### D-06: Export cadence = at phase completion + at milestone completion
Export snapshots during Phase 31 execution after each page is authored. After v1.11 ships, one final re-export captures any post-UAT edits. Post-v1.11 milestones re-export the KPI Dashboard collection at milestone boundaries; no per-edit syncing.

**Rationale:** Low-overhead, predictable. Matches the project's milestone-based release cadence.

### D-07: Text-only docs, reference UI labels in EN
No screenshots. Navigation references use literal EN labels as they appear in the NavBar/Settings (e.g. "Settings → Appearance → Logo"). DE parity is implicit via i18n.

**Rationale:** Screenshots rot every UI change; text is resilient through v1.12+.

### D-08: Permission model — single "KPI Dashboard" collection, all internal members read+write
- Collection name: `KPI Dashboard`
- Collection icon: book/library emoji (choose in UI during creation)
- Permissions: **members read+write**; no per-page permission overrides
- Admin-runbook page (DOC-08) is NOT permission-restricted — every member can see + edit

**Rationale:** Internal-tool trust model; Outline auto-versions documents so accidental edits are reversible. Restricting admin content would force an out-of-band "how do I get access" step that slows ops response.

### D-09: Multi-project pattern (WMP-03) = one collection per project
Future projects (Project Y, Project Z) each get **their own top-level Outline collection**, NOT a nested page inside "KPI Dashboard". The recipe lives in DOC-08 Admin Runbook:
1. In Outline: New Collection → name = project name → icon → save
2. Set permissions: members read+write (mirror KPI Dashboard default)
3. Clone the 8-page structure or use custom set as needed
4. Update Outline landing page (workspace home) to list all active project collections

**Rationale:** Flat structure scales; each project's docs have their own URL space and permission envelope. Nested would force cross-project permission work.

### D-10: E2E-04 reframe — match Phase 29 SSO limitation
E2E-04 UAT criterion is REWORDED from "NavBar wiki icon opens Outline; user is already logged in (Dex SSO session shared)" to:

> **E2E-04 (reframed):** Clicking the NavBar wiki icon in KPI Dashboard opens `https://wiki.internal` in a new tab. If the user has not yet authenticated to Outline in this browser, they are redirected through Dex and can log in with the same credentials used for KPI Dashboard. Silent cross-app SSO is a documented known limitation (`docs/setup.md` Known limitations, Phase 29).

**Rationale:** Honest acceptance bar given Dex staticPasswords design. Value delivered = shared credentials + nav affordance, not one-click SSO. The reframe is consistent with how Phase 29 SC #3 was handled.

## Folded Todos

None — no pending todos matched Phase 31 scope.

## Deferred Ideas

- **Automated markdown → Outline sync** — low value until doc churn justifies it
- **Generated API reference from OpenAPI** — thin-page D-02 eliminates the need for v1.11
- **Screenshots with auto-regen pipeline** — explicitly ruled out by D-07
- **Admin/member per-page permission splits** — not needed for internal tool (D-08)
- **Public / external-customer-facing docs** — different mission; different milestone
- **Second project onboarding (WIK2-04 backlog)** — this phase documents the recipe; actually onboarding Project Y happens when that project exists

## Specifics

- Canonical repo runbook link in DOC-08 (planner/executor: resolve the actual `git remote -v` origin URL at author time; don't commit `ORG/REPO` placeholder)
- Landing page (DOC-09) structure: intro → 8-item TOC → "See also: `docs/setup.md` on GitHub" footer
- Cross-link format: Outline wiki-links by page title (Outline auto-resolves)
- Mermaid block style: `graph TD` with healthcheck-gated deps as solid arrows, optional runtime deps as dashed

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 31 entry with Success Criteria 1-5
- `.planning/REQUIREMENTS.md` — DOC-01..DOC-09, WMP-01..WMP-03, E2E-01/03/04/05
- `docs/setup.md` — canonical operator runbook (DOC-08 links to this)
- `.planning/phases/29-outline-wiki-deployment/29-CONTEXT.md` — Outline deploy, backup posture, Known limitations source
- `.planning/phases/27-dex-idp-setup/27-CONTEXT.md` — Dex bcrypt user-add workflow (feeds DOC-08)
- `.planning/phases/26-npm-hostnames/26-CONTEXT.md` — hostname + TLS setup (feeds DOC-01)
- `frontend/src/components/NavBar.tsx` — reference for DOC-05/06/07 "NavBar → X" labels
- `frontend/src/locales/en.json` — EN labels referenced in docs (DOC-05/06/07)
- `backend/app/routers/*.py` — tags referenced in DOC-03
- External: https://github.com/outline/outline/blob/v0.86.0/docs — Outline editor + Mermaid reference
- External: Outline collection permission docs (researcher/planner to cite exact URL)

## Success Signals for Research + Planning

Downstream agents should produce plans that:
1. Create the "KPI Dashboard" collection with D-08 permissions as Task 1 (blocker for all subsequent pages)
2. Author all 8 pages (DOC-01..DOC-08) + landing (DOC-09) in Outline, each checked for cross-links and correct reference to other pages
3. Export each page to `docs/wiki-seed/##-slug.md` and commit the snapshot as part of phase execution (not a separate phase)
4. Add `docs/wiki-seed/README.md` documenting D-05 regen recipe
5. Deliver DOC-08 with the E2E-reframed limitation + resolved GitHub origin URL (not a placeholder)
6. Sign off E2E-01, E2E-03, E2E-04 (reframed per D-10), E2E-05 via human UAT

Planner should consider splitting the 8 pages into logical waves (e.g. wave 1 = collection + landing + dev-setup + architecture; wave 2 = user guides; wave 3 = admin runbook + UAT) to let the operator review each bundle before committing. Authoring is non-autonomous by nature (prose + human judgment), so plans will be checkpoint-heavy.
