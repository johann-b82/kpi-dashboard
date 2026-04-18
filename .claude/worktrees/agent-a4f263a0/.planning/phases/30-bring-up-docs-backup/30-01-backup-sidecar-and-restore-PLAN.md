---
phase: 30-bring-up-docs-backup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.yml
  - .gitignore
  - backup/entrypoint.sh
  - backup/dump.sh
  - scripts/restore.sh
  - .planning/phases/30-bring-up-docs-backup/30-01-SUMMARY.md
autonomous: true
requirements: [DOCS-03]
must_haves:
  truths:
    - "A `backup` service is defined in docker-compose.yml and reaches healthy status on `docker compose up -d`"
    - "The backup sidecar produces a file `./backups/kpi-YYYY-MM-DD.sql.gz` on demand (manual trigger during Phase 30)"
    - "The produced dump can be restored into the running `db` container via `./scripts/restore.sh <file>` with no external tooling"
    - "14-day retention deletes files older than 14 days from `./backups/`"
    - "`./backups/` is gitignored"
  artifacts:
    - path: "docker-compose.yml"
      provides: "backup service definition (postgres:17-alpine, TZ=Europe/Berlin, env_file .env, bind mount ./backups)"
      contains: "backup:"
    - path: "backup/entrypoint.sh"
      provides: "crontab writer + crond -f foreground launcher"
    - path: "backup/dump.sh"
      provides: "pg_dump -Fp --clean --if-exists | gzip with atomic .tmp->rename + 14-day retention"
    - path: "scripts/restore.sh"
      provides: "Positional-arg restore: gunzip-aware, streams into db container via psql -v ON_ERROR_STOP=1"
    - path: ".gitignore"
      provides: "Excludes /backups/ directory"
  key_links:
    - from: "backup sidecar"
      to: "db service"
      via: "depends_on db condition: service_healthy + compose network"
      pattern: "condition: service_healthy"
    - from: "scripts/restore.sh"
      to: "db container"
      via: "docker compose exec -T db psql"
      pattern: "docker compose exec -T db"
---

<objective>
Implement the Docker Compose backup sidecar and companion restore script that satisfy DOCS-03. No documentation work here — this plan produces the executable artifacts that Plan 02's setup.md will document.

Purpose: Close DOCS-03 with a portable, self-contained backup mechanism that lives inside the compose stack (no host cron).
Output: `backup/` sidecar config, `scripts/restore.sh`, compose wiring, `./backups/` gitignored, and verified real restore cycle.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/30-bring-up-docs-backup/30-CONTEXT.md
@.planning/phases/30-bring-up-docs-backup/30-RESEARCH.md
@docker-compose.yml
@.env.example
@.gitignore

<interfaces>
Environment variables available via `env_file: .env` (already used by existing services):
- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_DB

Existing sidecar pattern reference (from docker-compose.yml): `migrate` and `directus-bootstrap-roles` services use `depends_on: db: condition: service_healthy` and `env_file: .env`.

Reused image: `postgres:17-alpine` (already pulled by `db` service; ships pg_dump, pg_restore, psql, gzip, gunzip, BusyBox crond).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create backup sidecar scripts (entrypoint + dump)</name>
  <files>backup/entrypoint.sh, backup/dump.sh</files>
  <read_first>
    - .planning/phases/30-bring-up-docs-backup/30-RESEARCH.md (Architecture Patterns 2 and 3)
    - docker-compose.yml (existing sidecar patterns)
  </read_first>
  <action>
Create the `backup/` directory with two POSIX shell scripts.

**File 1: `backup/entrypoint.sh`** (mode 0755)
```sh
#!/bin/sh
# Backup sidecar entrypoint — writes crontab, execs crond -f in foreground.
# Per D-02: nightly at 02:00 local time (TZ set by compose service).
set -eu
mkdir -p /etc/crontabs
echo "0 2 * * * /usr/local/bin/dump.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] crontab installed; starting crond (TZ=${TZ:-UTC})"
exec crond -f -L /dev/stdout
```

**File 2: `backup/dump.sh`** (mode 0755)
```sh
#!/bin/sh
# Nightly pg_dump: plain-format + gzip, atomic rename, 14-day retention.
# Env (from compose): PGHOST, PGUSER, PGPASSWORD, PGDATABASE.
set -eu
DATE=$(date +%F)
OUT="/backups/kpi-${DATE}.sql.gz"
TMP="${OUT}.tmp"
echo "[backup] starting dump -> ${OUT}"
pg_dump --clean --if-exists --no-owner --no-acl -Fp | gzip -c > "${TMP}"
mv "${TMP}" "${OUT}"
find /backups -maxdepth 1 -name 'kpi-*.sql.gz' -mtime +14 -delete
echo "[backup] wrote ${OUT}"
```

Rationale (per D-04 + research recommendation): `-Fp | gzip` honors the literal `.sql.gz` extension and allows restore via `gunzip -c | psql` without `pg_restore`. `--clean --if-exists` embeds DROP semantics so restore into a non-empty DB works.

`chmod +x backup/entrypoint.sh backup/dump.sh` after creation.
  </action>
  <verify>
    <automated>test -x backup/entrypoint.sh && test -x backup/dump.sh && grep -q "crond -f" backup/entrypoint.sh && grep -q "pg_dump --clean --if-exists" backup/dump.sh && grep -q "mtime +14" backup/dump.sh</automated>
  </verify>
  <acceptance_criteria>
    - `backup/entrypoint.sh` exists, is executable, contains literal `crond -f` and writes `/etc/crontabs/root`
    - `backup/dump.sh` exists, is executable, contains literal `pg_dump --clean --if-exists --no-owner --no-acl -Fp`
    - `backup/dump.sh` writes to `${OUT}.tmp` then `mv` to `${OUT}` (atomic rename)
    - `backup/dump.sh` includes `find /backups -maxdepth 1 -name 'kpi-*.sql.gz' -mtime +14 -delete`
    - Both scripts start with `#!/bin/sh` and use `set -eu`
  </acceptance_criteria>
  <done>Two executable shell scripts committed under `backup/` implementing the scheduler and dump logic.</done>
</task>

<task type="auto">
  <name>Task 2: Wire backup service into docker-compose.yml + gitignore ./backups</name>
  <files>docker-compose.yml, .gitignore</files>
  <read_first>
    - docker-compose.yml (full file — copy migrate service pattern for depends_on structure)
    - .gitignore
  </read_first>
  <action>
**Edit 1: `docker-compose.yml`** — append a new `backup` service (keep alphabetical ordering with existing services; place after existing services, before `volumes:` block).

Add this service block:

```yaml
  backup:
    image: postgres:17-alpine
    container_name: kpi-backup
    env_file: .env
    environment:
      PGHOST: db
      PGUSER: ${POSTGRES_USER}
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ${POSTGRES_DB}
      TZ: Europe/Berlin
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

If the existing file already defines a `backup` service, error out instead of duplicating.

Rationale:
- Reuses `postgres:17-alpine` (already pulled) — no new image surface.
- `TZ: Europe/Berlin` per D-02 ("02:00 local time") and RESEARCH Pitfall 1.
- `restart: unless-stopped` keeps sidecar alive across host reboots.
- `entrypoint.sh` + `dump.sh` mounted read-only — edits to host scripts take effect on restart, no image rebuild.

**Edit 2: `.gitignore`** — append `/backups/` on a new line if not already present.

After edits, run `docker compose config --quiet` to validate the compose file parses.
  </action>
  <verify>
    <automated>docker compose config --quiet && grep -q "^\s*backup:" docker-compose.yml && grep -q "TZ: Europe/Berlin" docker-compose.yml && grep -q "postgres:17-alpine" docker-compose.yml && grep -q "^/backups/" .gitignore</automated>
  </verify>
  <acceptance_criteria>
    - `docker compose config --quiet` exits 0
    - `docker-compose.yml` contains a top-level `backup:` service keyed under `services:`
    - `backup` service uses `image: postgres:17-alpine`
    - `backup` service has `TZ: Europe/Berlin` in environment
    - `backup` service declares `depends_on: db: condition: service_healthy`
    - `backup` service mounts `./backups:/backups`, `./backup/entrypoint.sh:/entrypoint.sh:ro`, `./backup/dump.sh:/usr/local/bin/dump.sh:ro`
    - `.gitignore` contains `/backups/` on its own line
  </acceptance_criteria>
  <done>Compose file validates; `backup` service correctly wired; `./backups/` excluded from git.</done>
</task>

<task type="auto">
  <name>Task 3: Create restore script and exercise a full backup+restore cycle</name>
  <files>scripts/restore.sh</files>
  <read_first>
    - .planning/phases/30-bring-up-docs-backup/30-RESEARCH.md (Architecture Pattern 4; Pitfall 8)
    - scripts/smoke-rebuild.sh (existing script style reference)
  </read_first>
  <action>
**Create `scripts/restore.sh`** (mode 0755):

```sh
#!/bin/sh
# ./scripts/restore.sh <dump-file>
# Streams a dump file (.sql or .sql.gz) into the running `db` compose service.
# Idempotent via pg_dump --clean --if-exists semantics in the dump itself.
set -eu

if [ $# -ne 1 ]; then
  echo "usage: $0 <dump-file>" >&2
  exit 2
fi

DUMP="$1"
if [ ! -f "$DUMP" ]; then
  echo "not found: $DUMP" >&2
  exit 1
fi

# Always operate from repo root so `docker compose` resolves.
cd "$(dirname "$0")/.."

case "$DUMP" in
  *.gz) STREAM="gunzip -c" ;;
  *)    STREAM="cat" ;;
esac

echo "[restore] source: $DUMP"
echo "[restore] target: db container, database \$POSTGRES_DB"
echo "[restore] THIS WILL REPLACE data in the target database. Ctrl-C within 5s to abort."
sleep 5

$STREAM "$DUMP" | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'

echo "[restore] done"
```

Make executable: `chmod +x scripts/restore.sh`.

**Exercise the cycle (satisfies D-06 "exercised at least once" evidence):**

1. Ensure stack is up: `docker compose up -d`.
2. Manually trigger a dump against the running DB:
   `docker compose exec backup /usr/local/bin/dump.sh`
3. Confirm a file lands: `ls -la backups/kpi-*.sql.gz` (exactly one file matching today's date).
4. Run restore against the same DB (round-trip sanity):
   `./scripts/restore.sh backups/kpi-$(date +%F).sql.gz`
   (The `--clean --if-exists` semantics make this a no-op replacement — data should be identical afterwards.)
5. Verify DB is still responsive: `docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt public.*' | head -5`
6. Record outcome (stdout snippets of steps 3, 4, 5) in the plan SUMMARY when closing this plan.

If step 4 fails (e.g., FK violation mid-restore, permission error on `./backups/`), STOP and diagnose — do not mark done. Likely root causes flagged in RESEARCH Pitfalls 3 and 7.
  </action>
  <verify>
    <automated>test -x scripts/restore.sh && grep -q "docker compose exec -T db" scripts/restore.sh && grep -q "ON_ERROR_STOP=1" scripts/restore.sh && grep -q 'cd "\$(dirname "\$0")/\.\."' scripts/restore.sh && ls backups/kpi-*.sql.gz >/dev/null 2>&1</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/restore.sh` exists and is executable
    - Script `cd`s to repo root (contains `cd "$(dirname "$0")/.."`)
    - Script handles `.gz` via `gunzip -c` and plain via `cat`
    - Script uses `docker compose exec -T db` + `psql -v ON_ERROR_STOP=1`
    - At least one file matching `backups/kpi-*.sql.gz` exists (proof that dump ran once)
    - Manual restore cycle completed — outcome logged in plan SUMMARY
  </acceptance_criteria>
  <done>Restore script works end-to-end against a real dump produced by the sidecar; evidence logged for D-06.</done>
</task>

</tasks>

<verification>
- `docker compose config --quiet` passes
- `docker compose up -d` brings `backup` to running
- Manual `docker compose exec backup /usr/local/bin/dump.sh` produces `backups/kpi-YYYY-MM-DD.sql.gz`
- `./scripts/restore.sh backups/kpi-YYYY-MM-DD.sql.gz` completes without error
- `./backups/` not tracked by git
</verification>

<success_criteria>
- All three tasks' acceptance criteria pass
- Real backup+restore cycle logged in SUMMARY (D-06 evidence)
- No changes to application code (purely infra/scripts)
- Enables Plan 02 to document the mechanism that now demonstrably works
</success_criteria>

<output>
After completion, create `.planning/phases/30-bring-up-docs-backup/30-01-SUMMARY.md` with:
- Backup file name produced (e.g., `kpi-2026-04-15.sql.gz`) + size
- Restore command executed verbatim
- Restore exit status + post-restore table count
- Any deviations from the plan (e.g., if Pitfall 7 forced a `user:` override)
</output>
