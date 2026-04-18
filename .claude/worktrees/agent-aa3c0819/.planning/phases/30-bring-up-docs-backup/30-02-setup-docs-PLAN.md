---
phase: 30-bring-up-docs-backup
plan: 02
type: execute
wave: 2
depends_on: [30-01]
files_modified:
  - docs/setup.md
  - .planning/phases/30-bring-up-docs-backup/30-02-SUMMARY.md
autonomous: true
requirements: [DOCS-01, DOCS-02, DOCS-03]
must_haves:
  truths:
    - "A first-time operator can follow docs/setup.md top-to-bottom and reach a running stack + usable first Admin"
    - "docs/setup.md documents the Viewer→Admin promote click-path in Directus UI"
    - "docs/setup.md includes the restore procedure using ./scripts/restore.sh"
    - "Troubleshooting section warns about `docker compose down -v` data loss and first-boot admin bootstrap"
  artifacts:
    - path: "docs/setup.md"
      provides: "Linear tutorial: Prerequisites → Bring-up → First Admin → Promote Viewer→Admin → Backups → Restore → Troubleshooting"
      min_lines: 150
      contains: "## Promote Viewer to Admin"
  key_links:
    - from: "docs/setup.md Bring-up section"
      to: ".env.example + openssl rand commands"
      via: "Copy/paste-safe snippets matching .env.example verbatim"
      pattern: "openssl rand -base64"
    - from: "docs/setup.md Backups section"
      to: "scripts/restore.sh + backup service"
      via: "Command examples"
      pattern: "./scripts/restore.sh"
---

<objective>
Produce `docs/setup.md` — a linear tutorial a first-time operator follows end-to-end to bring up the stack, create a first Admin, learn to promote Viewers to Admin, and operate the backup/restore flow. Satisfies DOCS-01, DOCS-02, and the documentation portion of DOCS-03.

Purpose: Close the milestone loop so a new operator is not blocked on tribal knowledge.
Output: `docs/setup.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-bring-up-docs-backup/30-CONTEXT.md
@.planning/phases/30-bring-up-docs-backup/30-RESEARCH.md
@.planning/phases/30-bring-up-docs-backup/30-01-SUMMARY.md
@.env.example
@docker-compose.yml
@docs/api.md
@directus/bootstrap-roles.sh

<interfaces>
From `.env.example` — operator must set these (copy secret-generation commands verbatim into setup.md):
- `DIRECTUS_KEY` — generate via `openssl rand -base64 32`
- `DIRECTUS_SECRET` — generate via `openssl rand -base64 32`
- `DIRECTUS_ADMIN_EMAIL` — operator chooses
- `DIRECTUS_ADMIN_PASSWORD` — generate via `openssl rand -base64 24`
- `DIRECTUS_ADMINISTRATOR_ROLE_UUID` — fetched AFTER first bring-up via Directus REST API (documented in .env.example)
- Standard Postgres vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

Backup from Plan 01:
- Sidecar runs at 02:00 Europe/Berlin
- Files land in `./backups/kpi-YYYY-MM-DD.sql.gz`
- Restore: `./scripts/restore.sh <dump-file>`

Directus role model (from `directus/bootstrap-roles.sh` + `docs/api.md`):
- Built-in role: `Administrator` (Directus ships this)
- Custom roles: `Admin`, `Viewer` (bootstrapped by Phase 26)
- Promote click-path: User Directory → click user → Role field → select Administrator → Save
- Takes effect on next JWT refresh (≤ token TTL)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author docs/setup.md linear tutorial</name>
  <files>docs/setup.md</files>
  <read_first>
    - .env.example (MUST read in full to copy secret-generation commands verbatim and the post-boot UUID-fetch recipe)
    - .planning/phases/30-bring-up-docs-backup/30-RESEARCH.md (Pitfalls 5, 6, 7 feed Troubleshooting)
    - .planning/phases/30-bring-up-docs-backup/30-01-SUMMARY.md (confirms actual backup filename format produced)
    - docker-compose.yml (verify service names referenced: db, directus, api, frontend, backup, migrate, directus-bootstrap-roles)
    - directus/bootstrap-roles.sh (confirm exact role names used — Admin vs Administrator distinction)
  </read_first>
  <action>
Create `docs/setup.md` as a SINGLE linear tutorial in this EXACT section order (per D-07):

1. **Title + one-paragraph intro**: "This guide takes a clean machine to a running KPI Light stack. Follow sections top-to-bottom. Assumes Docker Engine + Docker Compose v2 are already installed."

2. **Prerequisites** — required:
   - Docker Engine + `docker compose` v2 (`docker compose version` check)
   - `openssl` (macOS + Linux default)
   - `git`
   - **Critical warning** (per D-08 text-only, and RESEARCH Pitfall 5): "Decide `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` BEFORE first `docker compose up -d`. Directus seeds the first admin only on an empty database. Changing these values later requires editing the user via the Directus admin UI or destroying the database volume."

3. **Bring-up** — numbered steps:
   1. `git clone <repo-url> && cd acm-kpi-light`
   2. `cp .env.example .env`
   3. Edit `.env` — walk through each required var. Include verbatim:
      ```bash
      # DIRECTUS_KEY / DIRECTUS_SECRET
      openssl rand -base64 32
      # DIRECTUS_ADMIN_PASSWORD
      openssl rand -base64 24
      ```
      Note POSTGRES_* must also be set (document by pointing to `.env.example` comments).
   4. Create the backups dir: `mkdir -p backups`
   5. First bring-up (without `DIRECTUS_ADMINISTRATOR_ROLE_UUID`):
      `docker compose up -d db directus`
      Wait for both to be healthy: `docker compose ps`.
   6. Fetch the Administrator role UUID (copy the exact curl+jq snippet from `.env.example`'s trailing comment). Paste the resulting UUID into `.env` as `DIRECTUS_ADMINISTRATOR_ROLE_UUID=...`.
   7. Full bring-up: `docker compose up -d`
   8. Verify healthy: `docker compose ps` — all services should show `healthy` or `running`.
   9. Open `http://localhost:8055`; sign in with `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD`.

4. **First Admin (verify bootstrap)**:
   - Log in to Directus admin UI at `http://localhost:8055`.
   - Expect to land on the Content module. Confirm user menu shows the email you set.
   - Log in to the app at `http://localhost:3000` (or configured frontend port) with the same credentials.

5. **Promote Viewer to Admin** (text-only steps per D-08 — this satisfies DOCS-02):
   1. Sign in to Directus admin UI at `http://localhost:8055` as an Administrator.
   2. Left sidebar → **User Directory**.
   3. Click the user you want to promote (shows user detail form).
   4. Locate the **Role** field (typically on the right panel or in the main form).
   5. Change role from **Viewer** → **Administrator**.
   6. Click **Save** (checkmark icon top-right).
   7. The user's next JWT refresh (within their current token TTL) grants admin access. To force immediate effect, the user signs out and back in.

6. **Backups** — describe the sidecar:
   - Service name: `backup` in `docker-compose.yml`.
   - Schedule: nightly at **02:00 Europe/Berlin** (fixed — change `TZ:` in `docker-compose.yml` service if your host is in another zone).
   - Output directory: `./backups/` (bind-mounted, gitignored).
   - Filename pattern: `kpi-YYYY-MM-DD.sql.gz`.
   - Retention: 14 days — older files auto-deleted.
   - Manual trigger (for testing or ad-hoc dump): `docker compose exec backup /usr/local/bin/dump.sh`
   - Verify service is running: `docker compose ps backup`.

7. **Restore** — restore procedure (satisfies DOCS-03 docs portion):
   ```bash
   ./scripts/restore.sh backups/kpi-2026-04-15.sql.gz
   ```
   - Script handles both `.sql` and `.sql.gz` transparently.
   - Streams the dump into the running `db` container via `psql` with `ON_ERROR_STOP=1`.
   - **Warning**: Replaces all data in `$POSTGRES_DB`. A 5-second countdown allows Ctrl-C abort.
   - State that this exact procedure was exercised during Phase 30 execution (reference the log in `.planning/phases/30-bring-up-docs-backup/30-01-SUMMARY.md`).

8. **Troubleshooting** — populate from RESEARCH Pitfalls:
   - **"I changed `DIRECTUS_ADMIN_EMAIL` in `.env` but sign-in still uses the old email"** — Pitfall 5: first-boot only; fix via Directus UI.
   - **"I ran `docker compose down -v` and everything is gone"** — Pitfall 6: `-v` deletes the `postgres_data` volume. Use `docker compose down` (no `-v`) to stop services while preserving data. To recover, restore from `./backups/` via `./scripts/restore.sh`.
   - **"backup container can't write to ./backups/"** — Pitfall 7: host permission mismatch. Fix: `chmod 777 backups` OR add `user: "${UID}:${GID}"` to the backup service.
   - **"Backup timestamps are 2 hours off"** — Pitfall 1: TZ in compose service defaults here to `Europe/Berlin`. Change to your local zone and `docker compose up -d backup` to recreate the container.
   - **"`docker compose up` hangs on directus health"** — confirm `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD` are set and non-empty in `.env`.
   - **"Restore fails with `no such container: db`"** — `./scripts/restore.sh` requires the stack to be up (`docker compose up -d` first).

Tone: direct, imperative. No marketing language. No hedging. Every command is copy-paste-ready against the current repo state. Use fenced code blocks (` ```bash `) for all commands.

Target length: 150-250 lines.
  </action>
  <verify>
    <automated>test -f docs/setup.md && grep -q "## Prerequisites" docs/setup.md && grep -q "## Bring-up" docs/setup.md && grep -q "## Promote Viewer to Admin" docs/setup.md && grep -q "## Backups" docs/setup.md && grep -q "## Restore" docs/setup.md && grep -q "## Troubleshooting" docs/setup.md && grep -q "openssl rand -base64 32" docs/setup.md && grep -q "openssl rand -base64 24" docs/setup.md && grep -q "./scripts/restore.sh" docs/setup.md && grep -q "docker compose up -d" docs/setup.md && grep -q "kpi-" docs/setup.md && grep -q "14" docs/setup.md && grep -q "02:00" docs/setup.md && grep -q "User Directory" docs/setup.md && grep -q "down -v" docs/setup.md && [ $(wc -l < docs/setup.md) -ge 120 ]</automated>
  </verify>
  <acceptance_criteria>
    - `docs/setup.md` exists with ≥120 lines
    - Contains all seven section headers in order: Prerequisites, Bring-up, First Admin, Promote Viewer to Admin, Backups, Restore, Troubleshooting
    - Contains verbatim `openssl rand -base64 32` and `openssl rand -base64 24`
    - Contains `./scripts/restore.sh` example with a `.sql.gz` filename
    - Contains `docker compose up -d` (v2 syntax, no hyphen)
    - Contains the string `User Directory` (Directus UI click-path anchor)
    - Contains `down -v` warning in Troubleshooting
    - References `02:00` and `14` (day retention)
    - NO occurrence of legacy `docker-compose` (hyphenated) CLI syntax
  </acceptance_criteria>
  <done>A first-time operator can follow `docs/setup.md` end-to-end without asking questions of anyone who has seen the codebase before.</done>
</task>

</tasks>

<verification>
- All acceptance criteria automated checks pass
- `grep -c "docker-compose " docs/setup.md` returns 0 (no v1 CLI form)
- Content matches locked decisions D-07, D-08
- Restore command in doc is identical to what Plan 01 produced
</verification>

<success_criteria>
- DOCS-01 satisfied (bring-up walkthrough complete)
- DOCS-02 satisfied (promote click-path documented)
- DOCS-03 documentation half satisfied (restore procedure present; execution half already done in Plan 01)
</success_criteria>

<output>
Create `.planning/phases/30-bring-up-docs-backup/30-02-SUMMARY.md` noting:
- Final line count of setup.md
- Any deviations from the planned section order
- Troubleshooting entries added beyond the baseline (if any emerged during Plan 01 execution)
</output>
