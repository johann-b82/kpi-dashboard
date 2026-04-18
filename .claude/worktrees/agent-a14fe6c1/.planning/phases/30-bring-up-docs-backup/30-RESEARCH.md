# Phase 30: Bring-up Docs + Backup — Research

**Researched:** 2026-04-15
**Domain:** Operator documentation + Postgres backup/restore (Docker Compose sidecar pattern)
**Confidence:** HIGH

## Summary

Phase 30 closes the v1.11-directus milestone with operator-facing bring-up docs (`docs/setup.md`), a nightly `pg_dump` cron sidecar added to `docker-compose.yml`, a positional-arg restore script, and a README version-history entry. No application code changes.

All technical building blocks are standard: `pg_dump`/`pg_restore`/`psql` from the official `postgres:17-alpine` image (already pulled), BusyBox `crond` inside the same image for scheduling, a bind-mounted `./backups/` directory, and markdown docs. The one non-obvious item is the `<details>` vs. table contradiction in the version-history pattern (see User Constraints).

**Primary recommendation:** Reuse `postgres:17-alpine` as the backup sidecar base image. Run a tiny shell entrypoint that writes a crontab, execs `crond -f` foreground, and on tick runs `pg_dump -Fc | gzip` via `PGPASSWORD` + `pg_dump -h db -U $POSTGRES_USER -d $POSTGRES_DB` with the service name resolved over the compose network. Same image gives the restore script `pg_restore`/`psql`/`gunzip` for consistency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Backup Mechanism**
- **D-01:** Nightly `pg_dump` runs as a **cron sidecar container** added to `docker-compose.yml` — keeps the stack self-contained, matches the project's "no bare-metal dependencies" constraint, and works on any host with Docker.
- **D-02:** Runs **nightly at 02:00 local time**. Not configurable via env var in this phase — fixed schedule keeps the sidecar simple.

**Backup Retention & File Format**
- **D-03:** Rolling **14-day retention** — keep the last 14 daily dumps, delete older files.
- **D-04:** File naming: `kpi-YYYY-MM-DD.sql.gz` — sortable, gzipped. A second run on the same day overwrites.

**Restore Procedure**
- **D-05:** Provide a **scripted restore**: `./scripts/restore.sh <dump-file>` — positional arg only; no flags. Must handle gzipped input transparently.
- **D-06:** "Exercised at least once" evidence: during Phase 30 execution, perform a **real restore** into a throwaway target and log the outcome in the plan SUMMARY.

**docs/setup.md Style**
- **D-07:** **Linear tutorial** structure: Prerequisites → Bring-up → First Admin → Promote Viewer→Admin → Backups → Restore → Troubleshooting. No reference-style section shuffling.
- **D-08:** Directus promote-to-Admin click-path: **text-only numbered steps**. No screenshots.

**README v1.11-directus Entry**
- **D-09:** Add the v1.11-directus entry as a **`<details>` collapsible block** matching the existing version-history pattern in README.md. Summarize: Directus added (why), Dex/oauth2-proxy abandoned (why), Supabase considered and rejected (why), Outline dropped (what that means for users).

> ⚠️ **Research flag for planner:** D-09 claims `<details>` matches "the existing version-history pattern", but `README.md` currently uses a **table** (`| Version | Date | Description |`) for version history, with zero `<details>` blocks. The planner must resolve this discrepancy in Plan 01 — either (a) add a new `<details>` block above/below the table per the user's stated intent, or (b) confirm with the user before switching to a table row. Recommend (a): add `<details>` block as a v1.11-directus section, plus add a summary row `| v1.11-directus | 2026-04-15 | Auth + RBAC via Directus; nightly pg_dump backups |` to the table for consistency with past entries. Do **not** silently rewrite prior version rows as `<details>` — that is deferred.

### Claude's Discretion

- Exact `pg_dump` flags, compression level, and whether to use `-Fc` custom format vs `-Fp | gzip`. Constraint: dump must be restorable by `scripts/restore.sh` without external tooling beyond what the backup container already has.
- Backup container base image (e.g. `postgres:17-alpine` reused, or a dedicated cron image). Prefer reusing `postgres:17-alpine`.
- Exact shell/cron mechanism inside the sidecar (busybox crond, shell loop with `sleep`, etc.) — pick the simplest that survives container restart.
- Troubleshooting section contents — populate based on failure modes surfaced during real bring-up testing.

### Deferred Ideas (OUT OF SCOPE)

- Configurable backup schedule via env var (fixed 02:00 is fine for v1.11).
- Off-host backup shipping (S3, rsync).
- Backup encryption at rest.
- Screenshots in setup docs.
- Any app/code changes beyond a backup sidecar and `scripts/restore.sh`. No new features, no UI changes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | `docs/setup.md` covers first-time bring-up: clone → copy `.env.example` → generate secrets → `docker compose up -d` → first admin auto-bootstrapped → sign in to Directus admin UI to verify. | Existing `.env.example` already documents `openssl rand -base64 32` for `DIRECTUS_KEY`/`DIRECTUS_SECRET` and `openssl rand -base64 24` for `DIRECTUS_ADMIN_PASSWORD`. The one post-boot step (fetch `DIRECTUS_ADMINISTRATOR_ROLE_UUID`) is documented in `.env.example` and must be copied into `docs/setup.md` verbatim. |
| DOCS-02 | Promote-Viewer-to-Admin flow via Directus admin UI (click-path). | Directus 11 UI path: User Directory → click user → **Role** field → change from "Viewer" to "Administrator" → Save. Role change takes effect on next JWT refresh (≤ token TTL) per `docs/api.md`. |
| DOCS-03 | Nightly `pg_dump`, backups in `./backups/`, restore procedure exercised once. | `pg_dump` + `pg_restore` ship in `postgres:17-alpine`. BusyBox `crond` also ships in alpine (via `busybox-extras`; on `postgres:17-alpine` specifically, `crond` is available — verify in Wave 0). Bind mount `./backups/` per existing volume pattern. |
| DOCS-04 | README v1.11-directus version-history entry. | Existing table-based history at README.md:225-239; user decided `<details>` block. See D-09 flag above. |
</phase_requirements>

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| `postgres:17-alpine` | already pinned in docker-compose.yml | Backup sidecar base image — provides `pg_dump`, `pg_restore`, `psql`, `gzip`/`gunzip` | Already pulled; matches server version (critical — dump/restore tool version must be ≥ server); no new image to vet |
| BusyBox `crond` | bundled in alpine base | In-container nightly scheduler at 02:00 | Minimal (no new dependency), survives container restart via compose `restart: unless-stopped`, standard alpine idiom |
| `pg_dump -Fc` (custom format) | Postgres 17 | Compressed, restorable dump | `-Fc` is compressed by default (zlib level 6), restorable with `pg_restore`, parallel-restore capable, selective-table restore possible. Alternative: `-Fp \| gzip` (plain SQL + gzip) — simpler to inspect by eye but requires `psql` to restore and loses `pg_restore` features. |
| `gzip` wrapping | bundled | Produces `.sql.gz` naming per D-04 | Note: `-Fc` output is ALREADY compressed. To honor `kpi-YYYY-MM-DD.sql.gz` naming and keep a single restore code path, choose **one**: (a) `pg_dump -Fp \| gzip > kpi-$(date +%F).sql.gz` — plain + gzip, restore via `gunzip -c \| psql`. (b) `pg_dump -Fc > kpi-$(date +%F).dump` — change naming to `.dump`. **Recommend (a)** because it honors D-04's literal `.sql.gz` extension and keeps the restore script trivial (`gunzip -c <file> \| psql`). |

### Supporting
| Tool | Version | Purpose | When to Use |
|---|---|---|---|
| `find ./backups -name 'kpi-*.sql.gz' -mtime +14 -delete` | coreutils/busybox | 14-day retention enforcement (D-03) | Run after each successful dump in the cron job |
| `set -euo pipefail` | POSIX shell | Fail-fast discipline in cron + restore scripts | Any shell script in this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Cron sidecar | Host cron calling `docker compose exec db pg_dump` | Violates "no bare-metal dependencies" constraint; rejected by D-01. |
| Cron sidecar | Ofelia, `mcuadros/ofelia` scheduler image | Extra image, extra concepts (labels on services). Overkill for one daily job. |
| BusyBox `crond` | `while sleep 86400; do ...` shell loop | Drifts on container restart (loses elapsed time). `crond` re-fires on correct clock time. |
| `pg_dump -Fp \| gzip` | `pg_dump -Fc` | See note above; `.sql.gz` extension prefers plain+gzip. |
| Reuse `postgres:17-alpine` | Dedicated `alpine:3.20` + `apk add postgresql17-client` | Extra image, extra surface. Reuse wins. |

**Installation:** No new dependencies. Backup sidecar uses `image: postgres:17-alpine` (already in registry cache). Restore script is a pure shell script.

**Version verification:**
- `docker compose exec db pg_dump --version` — confirms server-side version matches tool version used in sidecar (both 17.x).
- On the Mac dev host: `pg_dump --version` → confirmed `/opt/homebrew/bin/pg_dump` available (optional path: operator-side restore from dump).

## Architecture Patterns

### Recommended Project Structure (additions only)

```
acm-kpi-light/
├── backups/                        # bind-mounted, gitignored, created on-demand
│   └── kpi-YYYY-MM-DD.sql.gz
├── backup/                         # NEW — backup sidecar config
│   ├── entrypoint.sh               # writes crontab, execs crond -f
│   └── dump.sh                     # the actual dump + retention command
├── scripts/
│   ├── restore.sh                  # NEW — ./scripts/restore.sh <dump-file>
│   ├── smoke-rebuild.sh            # existing
│   └── verify-phase-04.sh          # existing
├── docs/
│   ├── setup.md                    # NEW — linear tutorial
│   └── api.md                      # existing
├── docker-compose.yml              # MODIFY — add `backup` service
├── .gitignore                      # MODIFY — add /backups/
└── README.md                       # MODIFY — add v1.11-directus entry
```

### Pattern 1: Sidecar with cron + shared password via env
**What:** A service that runs continuously but does work on a schedule, sharing DB credentials with `db` via `env_file: .env`.
**When to use:** Nightly scheduled tasks that must be portable across hosts.
**Example (sidecar service block):**
```yaml
  backup:
    image: postgres:17-alpine
    env_file: .env
    environment:
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGHOST: db
      PGUSER: ${POSTGRES_USER}
      PGDATABASE: ${POSTGRES_DB}
      TZ: Europe/Berlin           # so "02:00 local" matches operator expectation
    volumes:
      - ./backups:/backups
      - ./backup/entrypoint.sh:/entrypoint.sh:ro
      - ./backup/dump.sh:/usr/local/bin/dump.sh:ro
    depends_on:
      db:
        condition: service_healthy
    entrypoint: ["/bin/sh", "/entrypoint.sh"]
    restart: unless-stopped
```
**Notes:**
- `PGPASSWORD` + `PGHOST`/`PGUSER`/`PGDATABASE` let `pg_dump` run without flags or a `.pgpass` file.
- `TZ` is critical — without it, `crond` fires at 02:00 UTC, not operator-local 02:00. Alpine reads `/etc/localtime` if `TZ` is set.
- `restart: unless-stopped` ensures the sidecar comes back after a host reboot.

### Pattern 2: BusyBox crond foreground with one-shot log forwarding
**What:** Write the crontab at container start, then `exec crond -f -L /dev/stdout` to keep PID 1 alive and forward logs.
**Example (`backup/entrypoint.sh`):**
```sh
#!/bin/sh
set -eu
echo "0 2 * * * /usr/local/bin/dump.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
exec crond -f -L /dev/stdout
```
**Why:** `crond -f` keeps the container alive; `-L /dev/stdout` routes cron's own logs to `docker logs backup`. The `>> /proc/1/fd/1` redirect routes `dump.sh` output to the same place.

### Pattern 3: Dump script with inline retention
**Example (`backup/dump.sh`):**
```sh
#!/bin/sh
set -euo pipefail   # alpine /bin/sh supports -u -e; pipefail is ash-compatible
DATE=$(date +%F)                # YYYY-MM-DD (local, per TZ)
OUT="/backups/kpi-${DATE}.sql.gz"
pg_dump -Fp --no-owner --no-acl | gzip -c > "${OUT}.tmp"
mv "${OUT}.tmp" "${OUT}"        # atomic: no half-written file ever has the final name
find /backups -maxdepth 1 -name 'kpi-*.sql.gz' -mtime +14 -delete
echo "[backup] wrote ${OUT}"
```
**Why `.tmp` → `mv`:** If a dump is interrupted (container kill, DB crash mid-dump), the operator never sees a truncated file with the canonical name. Standard discipline.
**Why `--no-owner --no-acl`:** Restore into a fresh database with a possibly-different role name (e.g. dev vs prod) won't fail on `SET ROLE` / `ALTER OWNER TO`.

### Pattern 4: Restore script (handles gzipped transparently)
**Example (`scripts/restore.sh`):**
```sh
#!/bin/sh
set -eu
if [ $# -ne 1 ]; then
  echo "usage: $0 <dump-file>" >&2
  exit 2
fi
DUMP="$1"
[ -f "$DUMP" ] || { echo "not found: $DUMP" >&2; exit 1; }

# Run inside the existing db container so we don't need host-side psql.
# Stream dump via stdin to avoid temp files and path-translation issues.
case "$DUMP" in
  *.gz) CMD="gunzip -c '$DUMP'" ;;
  *)    CMD="cat '$DUMP'" ;;
esac

echo "[restore] restoring $DUMP into database \$POSTGRES_DB via db container"
echo "[restore] THIS WILL DROP AND RECREATE THE PUBLIC SCHEMA. Ctrl-C within 5s to abort."
sleep 5
eval "$CMD" | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
echo "[restore] done"
```
**Why stream via `docker compose exec -T`:** Avoids copying the dump into the db container. `-T` disables the TTY so the pipe works.
**Why `ON_ERROR_STOP=1`:** A partial restore is worse than no restore; surface the first error instead of silently continuing.
**Note on schema reset:** Plain-format dumps from `pg_dump` on a single DB **do not** include `DROP DATABASE` / `CREATE DATABASE` by default. For a clean restore into a non-empty DB, the planner must decide: (a) operator drops public schema first (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`), or (b) use `pg_dump --clean --if-exists` which embeds per-object DROPs. **Recommend (b)** — embed the clean semantics in the dump so `restore.sh` stays a single pipe.

### Anti-Patterns to Avoid

- **Running pg_dump from host cron:** Violates "no bare-metal dependencies" (D-01 rejected this).
- **`docker compose exec db pg_dump` from a host-side loop:** Same violation, and requires the operator's shell session to stay alive.
- **Calling `pg_dump` against Directus's own tables with a narrowed schema:** Directus tables (`directus_*`) share the DB; a backup that skips them is incomplete — the restored stack would lose users/roles. **Back up the whole database.**
- **`docker compose down -v` in restore docs:** That deletes the `postgres_data` volume, breaking the schema the restore assumes. Restore assumes a running `db` with (possibly empty) schema.
- **Mismatched pg_dump/server major versions:** Refuses to start. Pin sidecar to `postgres:17-alpine` to match `db`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Schedule nightly run | Shell `while sleep 86400` loop | BusyBox `crond` | Sleep drift on restart; no missed-run detection; crond handles both. |
| DB dump format | `SELECT * INTO OUTFILE` / custom SQL | `pg_dump` | Foreign keys, sequences, enums, extensions, large objects — custom dumps miss edge cases. |
| Restore-into-empty-DB | Manual `CREATE TABLE` then `COPY FROM` | `pg_restore` or `psql` on `pg_dump` output | `pg_dump` output is idempotent-adjacent with `--clean --if-exists`. |
| Gzip detection in restore | MIME sniffing | File extension switch | Dump files in this project have known extensions (`.sql.gz` or `.sql`). |
| Timezone handling in cron | Manual offset math | `TZ=Europe/Berlin` env var | Alpine reads it directly. |

**Key insight:** Every tool needed already ships in `postgres:17-alpine`. The phase is a configuration + documentation exercise, not a software build.

## Common Pitfalls

### Pitfall 1: Cron fires at UTC instead of local time
**What goes wrong:** Sidecar runs, but "02:00" is UTC, so European operators see backups timestamped 04:00 local. File naming uses `date +%F` which also depends on TZ — misaligned file dates if days roll over between UTC and local.
**Why:** Alpine's default TZ is UTC; `crond` and `date` both honor the `TZ` env var.
**How to avoid:** Set `TZ: Europe/Berlin` (or operator's zone) in the sidecar service env. Document this in `docs/setup.md`.
**Warning signs:** `docker logs backup` shows "starting 02:00 UTC" instead of operator-local.

### Pitfall 2: pg_dump version mismatch
**What goes wrong:** Sidecar pulls `postgres:latest` (say 18) while `db` is 17 → `pg_dump` refuses to dump with a server-version error.
**How to avoid:** Pin sidecar to `postgres:17-alpine`, same as `db` service.

### Pitfall 3: Restore leaves orphaned data / FK conflicts
**What goes wrong:** Operator restores into a DB that already has `directus_users` rows; unique constraints explode mid-restore.
**How to avoid:** Use `pg_dump --clean --if-exists` so the dump itself drops objects before recreating them. Document that restore targets a DB with the correct empty schemas (or drops public schema).

### Pitfall 4: Half-written dump from interrupted container
**What goes wrong:** Container killed mid-dump → `kpi-2026-04-15.sql.gz` is truncated and silently overwrites last good backup.
**How to avoid:** Write to `.tmp` then atomic `mv`. Pattern shown in `dump.sh` above.

### Pitfall 5: First-boot bootstrap is one-shot — ADMIN_EMAIL ignored on subsequent boots
**What goes wrong:** Operator edits `DIRECTUS_ADMIN_EMAIL` in `.env` post-bring-up, expects it to change. It doesn't — Directus seeds this user only on empty DB.
**How to avoid:** `docs/setup.md` Prerequisites section MUST say: "Decide these values BEFORE first `docker compose up`. Changes later require Directus UI or destroying the DB volume."

### Pitfall 6: Operator runs `docker compose down -v`
**What goes wrong:** Deletes `postgres_data` volume → entire database gone → bootstrap runs again → new first admin with a NEW password (if `.env` changed) → old Directus users gone.
**How to avoid:** Troubleshooting section must call out the difference between `docker compose down` (keeps data) and `docker compose down -v` (destroys data). Explicitly warn.

### Pitfall 7: `./backups/` permission mismatch
**What goes wrong:** Bind-mounted `./backups/` is owned by host user; `pg_dump` inside `postgres:17-alpine` runs as `postgres` (uid 70). Cannot write.
**How to avoid:** Create `./backups/` with world-writable perms in the bring-up doc (`mkdir -p backups && chmod 777 backups`), OR run the sidecar as `user: "${UID}:${GID}"` with `pg_dump` — it doesn't need to be `postgres`. Recommend the latter (less surprising perm sprawl). Verify at Wave 0.

### Pitfall 8: Restore script assumes it's running from repo root
**What goes wrong:** `docker compose exec -T db ...` only works from the compose project directory (or with `-f` pointing to it). If operator runs `./scripts/restore.sh /tmp/foo.sql.gz` from `/tmp`, it fails.
**How to avoid:** `cd "$(dirname "$0")/.."` at the top of `restore.sh` so it always `cd`s to repo root regardless of where invoked.

## Code Examples

All examples are in the "Architecture Patterns" section above, authored from first principles against verified tool behaviors. Primary references:
- `pg_dump` / `pg_restore` flags: https://www.postgresql.org/docs/17/app-pgdump.html
- BusyBox crond: https://git.busybox.net/busybox/tree/miscutils/crond.c
- Docker Compose healthcheck + depends_on: already proven in existing `migrate` + `directus-bootstrap-roles` services in `docker-compose.yml`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Host cron + `docker exec` | Sidecar container | Docker Compose v2 norms, 2023+ | Portable across hosts; no host tooling. |
| `pg_dumpall` for whole-cluster | `pg_dump` for single DB | Always (this is the single-DB case) | Directus + app share one DB; `pg_dump kpi_db` captures both. |
| `docker-compose` (v1 hyphen) | `docker compose` (v2) | 2023 GA, v1 EOL | All docs/scripts must use v2 syntax. Verified in CLAUDE.md. |

**Deprecated/outdated:**
- `docker-compose` CLI — do not use. Verified Docker Compose v5.1.1 on dev host supports `docker compose` only.

## Open Questions

1. **Which timezone does the user expect "02:00 local" to mean?**
   - What we know: "nightly at 02:00 local time" (D-02); dev host likely Europe/Berlin based on `acm` prefix and prior patterns.
   - What's unclear: explicit TZ string.
   - Recommendation: planner should ask once during Plan 01, then hardcode `TZ: Europe/Berlin` in the sidecar. Document in setup.md as a single editable spot for re-deploys in other zones.

2. **Does README already have a `<details>` block I missed?**
   - What we know: `grep -c "details" README.md` → 0 matches. Current pattern is a markdown table (README.md:225-239).
   - What's unclear: whether user's D-09 reference to "existing version-history pattern" means the table (not `<details>`) or whether user intends to start a new `<details>` style here.
   - Recommendation: Planner's Plan 04 adds a **new** `<details><summary>v1.11-directus</summary>` block ABOVE the table, AND a summary row in the table, per the flag in User Constraints.

3. **Should `public` schema be pre-dropped before restore, or should dump embed DROPs?**
   - What we know: restore must work into a running `db` service (possibly non-empty).
   - What's unclear: which side owns the cleanup.
   - Recommendation: dump with `pg_dump --clean --if-exists` so restore.sh stays a single pipe. Document in setup.md Restore section that restore replaces all data in `$POSTGRES_DB`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Docker Engine | compose stack | ✓ | 29.3.1 | — |
| Docker Compose v2 | compose stack | ✓ | v5.1.1 plugin | — |
| `postgres:17-alpine` image | backup sidecar | ✓ (already pulled by `db` service) | 17-alpine | — |
| BusyBox `crond` | scheduler | Needs Wave 0 verify | inside alpine | `while sleep`+`date` loop (lesser) |
| Host-side `pg_dump` | optional operator-side restore | ✓ | /opt/homebrew/bin/pg_dump | run `psql` inside `db` container (preferred anyway) |
| `openssl rand` | secret generation in docs | assumed available | standard on macOS + Linux | Python `secrets`/`base64` one-liner |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all primary paths are satisfied.

**Wave 0 quick-check:** `docker run --rm postgres:17-alpine sh -c 'which crond && crond --help 2>&1 | head -3'` — confirms BusyBox crond is present. If it isn't (unlikely), the sidecar entrypoint can fall back to a supervised `while true; do sleep $((...)); /usr/local/bin/dump.sh; done` pattern.

## Project Constraints (from CLAUDE.md)

- **No bare-metal dependencies** — everything Dockerized. Backup MUST be a container, not host cron.
- **PostgreSQL image policy:** `postgres:17-alpine`, never `latest`. Reuse this same tag for the backup sidecar.
- **Docker Compose v2 syntax** (`docker compose`, no hyphen). All doc examples must use this form.
- **`.env` for all credentials**, never hardcode in `docker-compose.yml`. Backup sidecar uses `env_file: .env` + `PGPASSWORD` env.
- **Run migrations via Alembic** — the restore procedure assumes the dump already includes the schema; `migrate` service will no-op on an already-current Alembic version (or bump forward if dump is from an older deploy).
- **GSD workflow enforcement** — this phase runs entirely through `/gsd:execute-phase`; plans and tasks will be the edit channel.

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` (project stack + constraints) — authoritative for this codebase.
- `docker-compose.yml` (current service definitions) — verified reusable patterns (healthcheck, env_file, depends_on conditions).
- `.env.example` — verified current secret generation commands (`openssl rand -base64 32` / `-base64 24`) for DIRECTUS_KEY/SECRET/ADMIN_PASSWORD; verified post-boot Administrator UUID fetch procedure.
- `README.md` (current version-history table) — verified `<details>` claim in D-09 contradicts actual pattern (table only).
- `directus/bootstrap-roles.sh` — verified that Directus ships an "Administrator" role by name (not "Admin"), and that Viewer promotion in the UI means changing role from the Viewer UUID to the Administrator UUID.
- `docs/api.md` — verified that Directus role changes take effect on next JWT refresh; this is what DOCS-02 click-path must explain to the operator.
- PostgreSQL 17 pg_dump docs: https://www.postgresql.org/docs/17/app-pgdump.html — `--clean`, `--if-exists`, `-Fp`, `-Fc` semantics.

### Secondary (MEDIUM confidence)
- Docker Compose healthcheck + sidecar pattern — proven in this repo's existing `migrate` and `directus-bootstrap-roles` services.
- BusyBox `crond -f -L /dev/stdout` pattern — widely documented alpine idiom.

### Tertiary (LOW confidence)
- None material to this phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools ship in the already-used `postgres:17-alpine`; zero new dependencies.
- Architecture: HIGH — sidecar pattern matches existing `migrate` and `directus-bootstrap-roles` services.
- Pitfalls: HIGH — enumerated from known Postgres + Docker + cron failure modes; one (schema perm mismatch on `./backups/`) flagged for Wave 0.
- Docs style: MEDIUM — D-09 contradicts observed README pattern; flagged to planner for explicit resolution.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — stable domain, no fast-moving dependencies).
