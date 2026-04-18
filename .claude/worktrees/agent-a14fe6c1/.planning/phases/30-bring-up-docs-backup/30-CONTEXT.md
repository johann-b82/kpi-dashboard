# Phase 30: Bring-up Docs + Backup - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v1.11-directus milestone loop with operator-facing bring-up documentation and a working nightly Postgres backup + restore:

1. `docs/setup.md` — a first-time operator can clone the repo, follow the doc end-to-end, and end up with a running stack and a usable first Admin account. Includes the Viewer→Admin promote click-path.
2. Nightly `pg_dump` backups landing in `./backups/`, with a scripted, once-exercised restore procedure documented in `docs/setup.md`.
3. `README.md` v1.11-directus version-history entry summarizing the pivot (Directus added; Dex/oauth2-proxy and Supabase rejected; Outline dropped).

Out of scope: any app/code changes beyond a backup sidecar and a `scripts/restore.sh`. No new features, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Backup Mechanism
- **D-01:** Nightly `pg_dump` runs as a **cron sidecar container** added to `docker-compose.yml` — keeps the stack self-contained, matches the project's "no bare-metal dependencies" constraint, and works on any host with Docker.
- **D-02:** Runs **nightly at 02:00 local time**. Not configurable via env var in this phase — fixed schedule keeps the sidecar simple. (If future ops need flexibility, revisit.)

### Backup Retention & File Format
- **D-03:** Rolling **14-day retention** — keep the last 14 daily dumps, delete older files. Predictable disk footprint.
- **D-04:** File naming: `kpi-YYYY-MM-DD.sql.gz` — sortable, gzipped (pg_dump custom/plain format piped through gzip is fine; plan step decides exact pg_dump flags).

### Restore Procedure
- **D-05:** Provide a **scripted restore**: `./scripts/restore.sh <dump-file>` — reduces human error under recovery pressure. `docs/setup.md` walks through running it.
- **D-06:** "Exercised at least once" evidence: during Phase 30 execution, perform a **real restore** into a throwaway target (e.g. scratch DB or the dev DB after `pg_dump`-ing first) and log the outcome in the plan SUMMARY. This satisfies DOCS-03 without adding operator-facing checkbox ceremony.

### docs/setup.md Style
- **D-07:** **Linear tutorial** structure — a single path a first-timer follows top-to-bottom: Prerequisites → Bring-up → First Admin → Promote Viewer→Admin → Backups → Restore → Troubleshooting. No reference-style section shuffling.
- **D-08:** Directus promote-to-Admin click-path: **text-only numbered steps** — resilient to Directus UI updates. No screenshots.

### README v1.11-directus Entry
- **D-09:** Add the v1.11-directus entry as a **`<details>` collapsible block** matching the existing version-history pattern in README.md. Summarize: Directus added (why), Dex/oauth2-proxy abandoned (why), Supabase considered and rejected (why), Outline dropped (what that means for users).

### Claude's Discretion
- Exact `pg_dump` flags, compression level, and whether to use `-Fc` custom format vs `-Fp | gzip` — planner/executor decides. Constraint: the dump must be restorable by `scripts/restore.sh` without external tooling beyond what the backup container already has.
- Backup container base image (e.g. `postgres:17-alpine` reused, or a dedicated cron image). Prefer reusing `postgres:17-alpine` to avoid a new image, unless there's a concrete reason otherwise.
- Exact shell/cron mechanism inside the sidecar (busybox crond, shell loop with `sleep`, etc.) — pick the simplest that survives container restart.
- Troubleshooting section contents — populate based on failure modes surfaced during real bring-up testing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 30 — Goal, success criteria, requirements list
- `.planning/REQUIREMENTS.md` DOCS-01, DOCS-02, DOCS-03, DOCS-04 — Acceptance criteria

### Project context
- `.planning/PROJECT.md` — Project vision, constraints ("no bare-metal dependencies", Docker-only)
- `CLAUDE.md` — Tech stack, Docker Compose conventions, PostgreSQL 17-alpine policy, `docker compose` (v2) syntax

### Existing artifacts to extend or match
- `README.md` — Existing `<details>`-style version-history blocks (v1.9, v1.10, v1.6, etc.) to match for v1.11-directus entry
- `docker-compose.yml` — Service definitions for db/migrate/api/frontend/directus; pattern for adding a backup sidecar
- `.env.example` — Environment variable anchor the setup doc will walk through
- `docs/api.md` — Existing docs tone/style reference

No external specs beyond the above — requirements fully captured here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `postgres:17-alpine` image already pulled — reuse it as the backup sidecar base (has `pg_dump` + `psql`).
- Existing `./migrate` service pattern shows how to run a Postgres-dependent sidecar with `depends_on: db: condition: service_healthy`.
- `.env` / `.env.example` already the convention for secrets (POSTGRES_*, DIRECTUS_*) — setup doc references these, not ad-hoc vars.

### Established Patterns
- All services are Dockerized; `docker compose up -d` is the canonical bring-up command. No host-level cron.
- Docker Compose v2 syntax (`docker compose`, not `docker-compose`) per CLAUDE.md.
- README uses `<details>` collapsibles per shipped version — v1.11-directus follows the same pattern.

### Integration Points
- New sidecar service ("backup" or similar) added to `docker-compose.yml` with a named bind-mount to `./backups/`.
- `scripts/restore.sh` — new directory/file; no existing `scripts/` usage to conflict with.
- `./backups/` directory created on-demand by the sidecar via volume mount; add to `.gitignore`.
- `docs/setup.md` — new file; sits alongside `docs/api.md` already in the repo.

</code_context>

<specifics>
## Specific Ideas

- Target audience for `docs/setup.md`: a first-time operator on a clean machine (no prior context). Assume Docker + Docker Compose v2 are installed; do not document Docker install itself.
- Restore script interface: `./scripts/restore.sh <dump-file>` — positional arg only; no flags. Script must handle gzipped input transparently.
- Backup file naming is date-stamped (`kpi-YYYY-MM-DD.sql.gz`) — one file per day; a second run on the same day overwrites (keeps retention math trivial).

</specifics>

<deferred>
## Deferred Ideas

- Configurable backup schedule via env var (deferred — fixed 02:00 is fine for v1.11).
- Off-host backup shipping (S3, rsync) — future ops phase.
- Backup encryption at rest — future security phase if/when required.
- Screenshots in setup docs — can be added later if operators report confusion; text-only is the v1.11 baseline.

</deferred>

---

*Phase: 30-bring-up-docs-backup*
*Context gathered: 2026-04-15*
