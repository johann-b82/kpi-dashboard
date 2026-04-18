---
phase: 26-directus-up-on-existing-postgres
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.yml
  - .env.example
autonomous: true
requirements:
  - INFRA-01
  - INFRA-03
  - INFRA-04
  - CFG-02
  - CFG-03

must_haves:
  truths:
    - "A `directus` service is declared in docker-compose.yml using the pinned 11.x image"
    - "The Directus service reuses the existing `db` Postgres via DB_* env vars (no new Postgres instance)"
    - "The Directus service exposes `127.0.0.1:8055:8055` (loopback only, per D-04)"
    - "The Directus service has a healthcheck hitting `/server/health` with start_period >= 30s"
    - "Alembic's `migrate` service runs to completion before `directus` starts (depends_on: service_completed_successfully)"
    - "`DB_EXCLUDE_TABLES` lists all 7 Alembic-managed tables plus `alembic_version` so Directus's Data Model UI hides them"
    - "First-Admin bootstrap is env-driven via `ADMIN_EMAIL` + `ADMIN_PASSWORD`"
    - "`.env.example` documents every Directus secret with a generation command (or clear default marker)"
  artifacts:
    - path: "docker-compose.yml"
      provides: "5th service `directus` + named volume `directus_uploads`"
      contains: "directus/directus:"
    - path: ".env.example"
      provides: "Directus env var documentation block"
      contains: "DIRECTUS_KEY"
  key_links:
    - from: "docker-compose.yml:directus"
      to: "db service"
      via: "DB_HOST=db, DB_USER=${POSTGRES_USER}, DB_DATABASE=${POSTGRES_DB}, depends_on: db: service_healthy"
      pattern: "DB_HOST.*db"
    - from: "docker-compose.yml:directus"
      to: "migrate service"
      via: "depends_on: migrate: service_completed_successfully"
      pattern: "service_completed_successfully"
    - from: ".env.example"
      to: "docker-compose.yml:directus env block"
      via: "variable names (DIRECTUS_KEY, DIRECTUS_SECRET, DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD)"
      pattern: "DIRECTUS_(KEY|SECRET|ADMIN_EMAIL|ADMIN_PASSWORD)"
---

<objective>
Add a single `directus/directus:11.17.2` service to the existing 4-service docker-compose.yml, wired into the existing `db` Postgres via DB_* env vars. Document every Directus secret in `.env.example` with generation commands. This plan produces a compose definition that will boot Directus to healthy on `docker compose up` (actual boot + sign-in verification is Plan 03).

Purpose: Land the infrastructure spine for v1.11-directus (INFRA-01/03/04) and pre-wire the app-table exclusion (CFG-02) and first-Admin bootstrap (CFG-03) at the compose/env layer — without writing any backend or frontend code.

Output:
- `docker-compose.yml` gains a 5th service `directus` with healthcheck, loopback port binding, full DB_* env block, DB_EXCLUDE_TABLES, ADMIN_EMAIL/ADMIN_PASSWORD, KEY, SECRET, and a named volume `directus_uploads` mounted at `/directus/uploads`.
- `.env.example` gains a documented Directus block (KEY, SECRET, ADMIN_EMAIL, ADMIN_PASSWORD) with `openssl` generation commands.

Version note (deviation from CONTEXT D-05):
- CONTEXT locked `directus/directus:11.9.0`. At plan-time, Docker Hub shows 11.17.2 as the current 11.x stable (verified 2026-04-15). We pin `11.17.2` instead — same minor-major line, patch-level supersession. Noted in plan; CONTEXT marker below.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-directus-up-on-existing-postgres/26-CONTEXT.md
@.planning/DIRECTUS-PIVOT.md
@docker-compose.yml
@backend/app/models.py

<interfaces>
<!-- Confirmed from backend/app/models.py at plan-time: 7 __tablename__ entries -->
<!-- App tables (Alembic-managed, must be EXCLUDED from Directus): -->
<!--   upload_batches, sales_records, app_settings, -->
<!--   personio_employees, personio_attendance, personio_absences, personio_sync_meta -->
<!-- Plus alembic_version (migration state) -->
<!-- Deviation from CONTEXT D-03: `hr_kpi_targets` is listed there but does NOT exist in models.py — -->
<!-- HR KPI targets live on app_settings (columns target_overtime_ratio, etc.). REMOVE from exclude list. -->
<!-- Existing .env keys already present: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB -->
<!-- Existing services: db (healthy), migrate (completes), api (healthy), frontend -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add `directus` service to docker-compose.yml</name>
  <files>docker-compose.yml</files>
  <action>
Append a new `directus` service to the existing `services:` block, after `frontend`. Add a new named volume `directus_uploads` to the `volumes:` block at the bottom.

Service definition (insert verbatim, respecting existing 2-space YAML indent):

```yaml
  directus:
    image: directus/directus:11.17.2
    env_file: .env
    ports:
      - "127.0.0.1:8055:8055"
    volumes:
      - directus_uploads:/directus/uploads
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    environment:
      # --- Core secrets (from .env) ---
      KEY: ${DIRECTUS_KEY}
      SECRET: ${DIRECTUS_SECRET}

      # --- Database connection — reuse existing `db` service ---
      DB_CLIENT: pg
      DB_HOST: db
      DB_PORT: 5432
      DB_DATABASE: ${POSTGRES_DB}
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}

      # --- Hide Alembic-managed app tables from Directus Data Model UI ---
      # Comma-separated, no spaces (per Directus docs). Verified against backend/app/models.py.
      DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version

      # --- First-Admin bootstrap (D-01); ignored on subsequent boots ---
      ADMIN_EMAIL: ${DIRECTUS_ADMIN_EMAIL}
      ADMIN_PASSWORD: ${DIRECTUS_ADMIN_PASSWORD}

      # --- Public URL for email/oauth redirects (operator-only for v1.11) ---
      PUBLIC_URL: http://127.0.0.1:8055

      # --- Harden defaults for loopback-only operator UI ---
      CORS_ENABLED: "false"
      TELEMETRY: "false"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8055/server/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

Then update the `volumes:` block at the bottom of the file to add `directus_uploads:`:

```yaml
volumes:
  postgres_data:
  directus_uploads:
```

Rationale notes (per D-01 through D-06):
- `directus/directus:11.17.2` (not 11.9.0 from CONTEXT): verified latest 11.x patch on Docker Hub at plan-time. Use this — same major.minor line policy; patch supersession is safe.
- `127.0.0.1:8055:8055` per D-04 — admin UI is operator-only, never LAN-exposed.
- `depends_on: migrate: service_completed_successfully` per CONTEXT risk note — avoids lock race on `alembic_version` between Alembic and Directus's schema migrator.
- `DB_EXCLUDE_TABLES`: 7 real tables from `backend/app/models.py` + `alembic_version`. CONTEXT's list included `hr_kpi_targets` which does NOT exist (HR targets are columns on `app_settings`). Corrected here.
- `start_period: 30s` per D-06 — Directus runs ~30 internal migrations on first boot.
- `CORS_ENABLED: false` — frontend never calls Directus in v1.11 (DIRECTUS-PIVOT locked decision #6); keep CORS off to reduce attack surface.
- Do NOT hardcode secrets; every `${VAR}` is resolved from the existing `.env` via `env_file`.
  </action>
  <verify>
    <automated>docker compose config | grep -E "directus/directus:11|DB_EXCLUDE_TABLES|127.0.0.1:8055|service_completed_successfully"</automated>
  </verify>
  <done>
`docker compose config` succeeds (YAML valid, interpolation resolves), shows the `directus` service with image `directus/directus:11.17.2`, loopback port `127.0.0.1:8055`, `DB_EXCLUDE_TABLES` comma-joined 8 entries, `depends_on` on both `db` (healthy) and `migrate` (completed), and the `directus_uploads` named volume is declared.
  </done>
</task>

<task type="auto">
  <name>Task 2: Document Directus secrets in .env.example</name>
  <files>.env.example</files>
  <action>
Append a Directus configuration block to `.env.example` (create the file if it doesn't exist; otherwise append after the existing Postgres section). The block must document every secret the compose file references.

Block to append verbatim (preserve blank line before):

```dotenv

# --- Directus (v1.11 auth layer) ---
# Random 32-byte base64 keys. Regenerate for each environment.
# Generation: openssl rand -base64 32
DIRECTUS_KEY=
DIRECTUS_SECRET=

# First-Admin bootstrap (Directus seeds this user on first boot only; ignored on subsequent boots).
# DIRECTUS_ADMIN_EMAIL: any valid email; operator documents it for the team.
# DIRECTUS_ADMIN_PASSWORD: generate with `openssl rand -base64 24` and store in a password manager.
DIRECTUS_ADMIN_EMAIL=admin@example.com
DIRECTUS_ADMIN_PASSWORD=
```

If `.env.example` does not yet exist in the repo, create it with the existing Postgres section followed by the Directus block. To determine existing Postgres keys, inspect the repo's current `.env` patterns via compose (do not read `.env` directly — it is gitignored). The minimum Postgres block to include if absent:

```dotenv
# --- Postgres ---
POSTGRES_USER=kpi
POSTGRES_PASSWORD=
POSTGRES_DB=kpi
```

Rationale (per D-01, INFRA-04):
- `openssl rand -base64 32` for KEY/SECRET: Directus's canonical recommendation; 32 bytes = 256 bits of entropy.
- `DIRECTUS_ADMIN_EMAIL` has a placeholder default (`admin@example.com`); operator should change before bring-up.
- `DIRECTUS_ADMIN_PASSWORD` MUST be blank in `.env.example` — forces operator to set it before first `docker compose up`. Directus refuses to bootstrap without a password.

Do NOT commit a real `.env`. Only `.env.example`.
  </action>
  <verify>
    <automated>grep -E "^DIRECTUS_(KEY|SECRET|ADMIN_EMAIL|ADMIN_PASSWORD)=" .env.example && grep -E "openssl rand" .env.example</automated>
  </verify>
  <done>
`.env.example` contains all four Directus keys (`DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`) with `openssl rand -base64` generation hints inline as comments. Postgres keys present (either pre-existing or added in this task).
  </done>
</task>

</tasks>

<verification>
Run `docker compose config` — exits 0, no warnings about undefined variables (`warning: The "X" variable is not set` indicates `.env` is missing entries from `.env.example`; this is acceptable since this plan only touches `.env.example`, not `.env`).

Optionally smoke-boot (non-blocking, Plan 03 does the real bring-up):
```bash
cp .env.example .env  # only if .env doesn't exist
# fill in POSTGRES_PASSWORD, DIRECTUS_KEY, DIRECTUS_SECRET, DIRECTUS_ADMIN_PASSWORD
docker compose up -d db migrate directus
docker compose ps  # `directus` should be "healthy" within ~60s
docker compose down
```

Do NOT commit a real `.env` if you create one for smoke-testing.
</verification>

<success_criteria>
- `docker compose config` passes (valid YAML, all interpolations resolve).
- `directus` service pinned to `directus/directus:11.17.2`.
- Port binding is `127.0.0.1:8055:8055` (not `0.0.0.0`).
- `DB_EXCLUDE_TABLES` contains exactly 8 comma-joined entries matching `backend/app/models.py` + `alembic_version`.
- `depends_on` includes both `db: service_healthy` and `migrate: service_completed_successfully`.
- Healthcheck uses `wget -qO- http://127.0.0.1:8055/server/health` with `start_period: 30s`.
- `.env.example` documents all four DIRECTUS_* keys with generation commands.
</success_criteria>

<output>
After completion, create `.planning/phases/26-directus-up-on-existing-postgres/26-01-SUMMARY.md`.
</output>
