---
phase: 30-bring-up-docs-backup
plan: 03
type: execute
wave: 2
depends_on: [30-01]
files_modified:
  - README.md
  - .planning/phases/30-bring-up-docs-backup/30-03-SUMMARY.md
autonomous: true
requirements: [DOCS-04]
must_haves:
  truths:
    - "README.md contains a v1.11-directus version-history entry"
    - "Entry is a <details> collapsible block (per D-09)"
    - "Entry explains: Directus added (why), Dex/oauth2-proxy abandoned (why), Supabase considered and rejected (why), Outline dropped (impact for users)"
    - "Existing version table ALSO gets a v1.11-directus summary row (per research flag for consistency)"
  artifacts:
    - path: "README.md"
      provides: "v1.11-directus version-history entry"
      contains: "v1.11-directus"
  key_links:
    - from: "README.md version history"
      to: "Past-version pattern (table rows + narrative)"
      via: "New <details> block + new summary table row"
      pattern: "v1.11-directus"
---

<objective>
Add the v1.11-directus version-history entry to `README.md` per D-09. Resolve the research-flagged discrepancy (D-09 says "match existing `<details>` pattern" but README actually uses a table) by doing BOTH: add a new `<details>` block AND add a summary row to the existing table, so the README stays consistent with past minor versions while honoring the user's stated format preference.

Purpose: Close DOCS-04 and tell operators what changed in v1.11.
Output: Updated `README.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-bring-up-docs-backup/30-CONTEXT.md
@.planning/phases/30-bring-up-docs-backup/30-RESEARCH.md
@.planning/DIRECTUS-PIVOT.md
@README.md

<interfaces>
Current README version-history pattern (README.md:227-239, verified): a markdown table:

```
| Version | Date | Description |
| v1.10 | 2026-04-14 | UI Consistency Pass ... |
| v1.9 | 2026-04-14 | Dark Mode & Contrast ... |
...
```

Zero `<details>` blocks exist in README.md currently.

v1.11-directus narrative facts (from DIRECTUS-PIVOT.md + STATE.md):
- ADDED: self-hosted Directus 11 container, email/password auth, two roles (Admin/Viewer), RBAC on FastAPI routes, nightly pg_dump backup sidecar, `docs/setup.md`
- REJECTED: Dex + oauth2-proxy + NPM auth_request (abandoned on `archive/v1.12-phase32-abandoned`) — too many moving parts
- REJECTED: Supabase — evaluated, 5-service stack too heavy vs. Directus's single container
- DROPPED: Outline wiki — no longer part of the stack; shared-Dex use case disappeared
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add v1.11-directus entry to README.md (details block + table row)</name>
  <files>README.md</files>
  <read_first>
    - README.md (entire file — need to find version-history section and preserve surrounding context)
    - .planning/DIRECTUS-PIVOT.md (authoritative narrative for why each alternative was rejected)
  </read_first>
  <action>
**Two edits to README.md.**

**Edit 1: Insert a `<details>` block ABOVE the version-history table** (the table currently begins around README.md:225-229 with a `| Version | Date | Description |` header). Place the new block immediately before the table header.

Content (copy verbatim, then verify the surrounding markdown still renders):

```markdown
<details>
<summary><strong>v1.11-directus</strong> — 2026-04-15 — Auth + RBAC via self-hosted Directus</summary>

### What changed

- **Added: Directus 11 container.** A single `directus/directus:11` service runs alongside the existing Postgres, providing email/password login, two built-in roles (`Admin`, `Viewer`), and an admin UI at `http://localhost:8055` for user management. FastAPI verifies the Directus-issued JWT (HS256 shared secret) on every `/api/*` request; mutation routes require `Admin`, read routes are open to both roles.
- **Added: nightly `pg_dump` backup sidecar.** A `backup` service in `docker-compose.yml` dumps the database nightly at 02:00 local time to `./backups/kpi-YYYY-MM-DD.sql.gz`, with 14-day rolling retention. A positional-arg `./scripts/restore.sh <dump-file>` streams a dump back into the running `db` container.
- **Added: `docs/setup.md`.** A linear bring-up tutorial for first-time operators, including the Viewer→Admin promote click-path and the backup/restore procedure.

### What was rejected

- **Dex + oauth2-proxy + NPM auth_request** (Phase 32, previous attempt) — abandoned. Three moving parts to configure (Dex provider, oauth2-proxy sidecar, NGINX Proxy Manager auth_request directive) to get one sign-in page. Preserved on branch `archive/v1.12-phase32-abandoned` for reference only.
- **Supabase** — evaluated, rejected. Full Supabase is a 5-service stack (Postgres, Auth, PostgREST, Realtime, Studio) when the project only needs sign-in and role assignment. Directus delivers the same outcome in one container on the existing database.

### What was dropped

- **Outline wiki** — removed from the stack entirely. The earlier v1.11/v1.12 plan was to share SSO between KPI Light and Outline via Dex. With Dex gone, the Outline use case is out of scope for this milestone. Existing Outline content (if any was deployed) is unaffected at the data level but no longer managed by this repo.

### Impact for users

- First-time login: browse to `/login`, enter email + password.
- Viewer users see the dashboards but no upload/sync/save controls — those are admin-only and are hidden from the DOM entirely, not just disabled.
- Administrators manage users via Directus at `http://localhost:8055`.

</details>

```

**Edit 2: Insert a new row at the TOP of the version-history table** (immediately after the `| Version | Date | Description |` header and its `|---|---|---|` separator, before the existing `v1.10` row). The row:

```
| v1.11-directus | 2026-04-15 | Auth + RBAC via self-hosted Directus; nightly pg_dump backups; Outline wiki and Dex/oauth2-proxy path dropped |
```

Do NOT rewrite or reformat any existing rows.

Verify after edits:
- The `<details>` block sits above the table.
- The table has exactly one new row at the top; all prior rows (v1.10 through v1.0) remain textually identical.
- No accidental duplicate headers or broken markdown.
  </action>
  <verify>
    <automated>grep -q "v1.11-directus" README.md && grep -q "<details>" README.md && grep -q "<summary><strong>v1.11-directus</strong>" README.md && grep -q "| v1.11-directus | 2026-04-15 |" README.md && grep -q "Dex" README.md && grep -q "Supabase" README.md && grep -q "Outline" README.md && grep -q "nightly pg_dump" README.md && [ $(grep -c "^| v1\." README.md) -ge 11 ]</automated>
  </verify>
  <acceptance_criteria>
    - README.md contains a `<details>` block whose `<summary>` includes `v1.11-directus`
    - README.md contains a new table row starting `| v1.11-directus | 2026-04-15 |`
    - The `<details>` body mentions all four required topics: Directus added, Dex/oauth2-proxy abandoned, Supabase rejected, Outline dropped
    - The `<details>` body mentions `nightly pg_dump`
    - Existing table rows for v1.10 through v1.0 are unchanged (at least 10 pre-existing `| v1.` rows plus the new one = ≥11 total)
    - No duplicate `| Version | Date | Description |` header line introduced
  </acceptance_criteria>
  <done>DOCS-04 satisfied: README explains v1.11-directus pivot in both narrative (details block) and table-row (summary) forms.</done>
</task>

</tasks>

<verification>
- Acceptance criteria automated check passes
- `git diff README.md` shows ONLY additions (no modifications to existing rows) plus the new details block
- Markdown preview renders `<details>` as a collapsible section
</verification>

<success_criteria>
- DOCS-04 fully satisfied
- README version-history table remains consistent with past minor versions (summary row present)
- User's D-09 intent honored (collapsible `<details>` block present for narrative)
</success_criteria>

<output>
Create `.planning/phases/30-bring-up-docs-backup/30-03-SUMMARY.md` noting:
- Exact location the `<details>` block was inserted (line number range)
- Confirmation of unchanged prior table rows (e.g., `git diff --stat README.md` output)
</output>
