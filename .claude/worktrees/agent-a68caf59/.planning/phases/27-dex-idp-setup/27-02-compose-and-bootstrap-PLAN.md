---
phase: 27-dex-idp-setup
plan: 02
type: execute
wave: 2
depends_on: ["27-01"]
files_modified:
  - docker-compose.yml
  - dex/config.yaml
  - .env
autonomous: false
requirements: [DEX-01, DEX-02, DEX-04, DEX-06]
must_haves:
  truths:
    - "docker compose up brings dex container to healthy state"
    - "https://auth.internal/dex/.well-known/openid-configuration returns valid JSON with issuer == https://auth.internal/dex"
    - "Discovery JSON authorization_endpoint starts with https:// (not http://) — proves X-Forwarded-Proto wiring works"
    - "Discovery scopes_supported array contains offline_access (DEX-06 verified)"
    - "Both seeded users (admin@acm.local, dev@acm.local) can log in via the Dex login form at https://auth.internal/dex/auth"
    - "dex_data named volume persists /data/dex.db across docker compose restart dex"
  artifacts:
    - path: "docker-compose.yml"
      provides: "dex service block, dex_data volume, npm depends_on extension"
      contains: "ghcr.io/dexidp/dex:v2.43.0"
    - path: "dex/config.yaml"
      provides: "Real bcrypt hashes and stable UUIDs substituted for placeholders"
      contains: "$2a$10$"
    - path: ".env"
      provides: "Resolved DEX_KPI_SECRET / DEX_OUTLINE_SECRET (gitignored, local-only)"
      contains: "DEX_KPI_SECRET="
  key_links:
    - from: "docker-compose.yml dex service"
      to: "dex/config.yaml"
      via: "read-only bind mount ./dex/config.yaml:/etc/dex/config.yaml:ro"
      pattern: "\\./dex/config\\.yaml:/etc/dex/config\\.yaml:ro"
    - from: "docker-compose.yml dex service"
      to: "dex_data volume mount"
      via: "named volume mount dex_data:/data"
      pattern: "dex_data:/data"
    - from: "docker-compose.yml npm.depends_on"
      to: "dex healthcheck"
      via: "condition: service_healthy gating"
      pattern: "dex:\\s*\\n\\s*condition:\\s*service_healthy"
    - from: "Browser at https://auth.internal/dex"
      to: "Dex container at dex:5556"
      via: "NPM proxy host with X-Forwarded-Proto https header"
      pattern: "issuer.*https://auth\\.internal/dex"
---

<objective>
Wire the `dex/config.yaml` from plan 27-01 into a running container: add a `dex` compose service, add the `dex_data` named volume, extend `npm.depends_on` to include `dex`. Generate REAL bcrypt hashes (via `dex hash-password`), REAL UUIDs (via `uuidgen`), and REAL client secrets (via `openssl rand -hex 32`) and substitute them into `dex/config.yaml` and `.env`. Then bring the stack up, repoint NPM's `auth.internal` proxy host from the Phase 26 placeholder (`api:8000`) to `dex:5556`, and verify the OIDC discovery endpoint + login form + restart-survival.

Purpose: Make the issuer URL real and reachable. After this plan, `https://auth.internal/dex/.well-known/openid-configuration` returns a valid OIDC discovery document and a human can log in with the seeded `admin` or `dev` user.
Output: docker-compose.yml updated; dex/config.yaml has real hashes/UUIDs; local `.env` has real secrets (gitignored); `dex_data` volume exists; NPM proxy host repointed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/27-dex-idp-setup/27-CONTEXT.md
@.planning/phases/27-dex-idp-setup/27-RESEARCH.md
@.planning/phases/27-dex-idp-setup/27-01-dex-config-skeleton-PLAN.md
@docker-compose.yml
@dex/config.yaml
</context>

<interfaces>
<!-- Existing docker-compose patterns this plan must MATCH. -->
<!-- Extracted from docker-compose.yml after Phase 26. -->

Existing service shape pattern (api):
- `image:` or `build:` pinned exactly
- `restart: unless-stopped` on long-running services (npm uses it)
- Healthcheck uses `127.0.0.1` not `localhost` (busybox IPv6 fix from Phase 26 commit eab26c7)
- `depends_on` blocks use `condition: service_healthy`
- Host port bindings commented out, NOT deleted, with inline rationale (frontend `# ports: # - "5173:5173"`, api `# ports: # - "8000:8000"`)

Existing volumes block:
```yaml
volumes:
  postgres_data:
  npm_data:
  npm_letsencrypt:
```

Existing npm.depends_on block:
```yaml
    depends_on:
      api:
        condition: service_healthy
      frontend:
        condition: service_healthy
```

Existing `.env` shape (POSTGRES_USER=, POSTGRES_PASSWORD=, POSTGRES_DB=).
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add dex service to docker-compose.yml + extend npm depends_on + add dex_data volume</name>
  <files>docker-compose.yml</files>
  <read_first>
    - docker-compose.yml (current state — match indentation, healthcheck shape, comment style)
    - .planning/phases/27-dex-idp-setup/27-RESEARCH.md (section "Code Examples → Compose service block (add to docker-compose.yml)")
    - .planning/phases/27-dex-idp-setup/27-CONTEXT.md (decisions D-17, D-18, D-20, D-21, D-22, D-23, D-24)
    - .planning/phases/26-npm-hostnames/26-02-SUMMARY.md (NPM proxy-host conventions if available)
  </read_first>
  <action>
    Make THREE edits to `docker-compose.yml`:

    EDIT 1 — Insert a new `dex:` service block AFTER the existing `npm:` service definition (before the `volumes:` block at the bottom). Indent at 2 spaces (matches `db`, `migrate`, `api`, `frontend`, `npm`). Use this exact block:

    ```yaml
      dex:
        image: ghcr.io/dexidp/dex:v2.43.0   # D-20: pinned to GHCR (avoids Docker Hub rate limits)
        restart: unless-stopped              # D-24
        command: dex serve /etc/dex/config.yaml
        # D-22: no host port binding — NPM is the edge (Phase 26 D-07 convention).
        # Uncomment for direct curl/debug bypassing NPM. Matches frontend/api hatch.
        # ports:
        #   - "5556:5556"
        volumes:
          - ./dex/config.yaml:/etc/dex/config.yaml:ro   # D-17: read-only bind mount
          - dex_data:/data                              # D-18: SQLite persistence
        environment:
          DEX_KPI_SECRET: "${DEX_KPI_SECRET}"           # D-13: $VAR substitution into config.yaml
          DEX_OUTLINE_SECRET: "${DEX_OUTLINE_SECRET}"
        healthcheck:
          # 127.0.0.1 not localhost — busybox IPv6 (D-21, Phase 26 commit eab26c7).
          # Path is /dex/healthz (not /healthz) because issuer is path-prefixed (D-01).
          test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:5556/dex/healthz || exit 1"]
          interval: 15s
          timeout: 5s
          retries: 3
          start_period: 10s
        # D-23: no depends_on (SQLite is in-container; no DB or Redis dependency)
    ```

    EDIT 2 — Extend `npm.depends_on` to include `dex` alongside the existing `api` and `frontend` gates (D-23). The result MUST be:

    ```yaml
        depends_on:
          api:
            condition: service_healthy
          frontend:
            condition: service_healthy
          dex:
            condition: service_healthy
    ```

    EDIT 3 — Append `dex_data:` to the bottom `volumes:` block (after `npm_letsencrypt:`). Result MUST be:

    ```yaml
    volumes:
      postgres_data:
      npm_data:
      npm_letsencrypt:
      dex_data:
    ```

    Do NOT modify any other service. Do NOT add `depends_on` to `dex` itself (D-23: it has no service dependency). Do NOT add a host port binding (D-22 — debug hatch is commented out only).
  </action>
  <verify>
    <automated>
      docker compose -f docker-compose.yml config --quiet &&
      grep -qE 'image:\s+ghcr\.io/dexidp/dex:v2\.43\.0' docker-compose.yml &&
      grep -q '\./dex/config\.yaml:/etc/dex/config\.yaml:ro' docker-compose.yml &&
      grep -q 'dex_data:/data' docker-compose.yml &&
      grep -q 'wget -qO- http://127\.0\.0\.1:5556/dex/healthz' docker-compose.yml &&
      grep -qE 'DEX_KPI_SECRET:\s+"\$\{DEX_KPI_SECRET\}"' docker-compose.yml &&
      grep -qE 'DEX_OUTLINE_SECRET:\s+"\$\{DEX_OUTLINE_SECRET\}"' docker-compose.yml &&
      awk '/^  npm:/,/^[a-z]/' docker-compose.yml | grep -A2 'depends_on:' | grep -q 'dex:' &&
      awk '/^volumes:/,EOF' docker-compose.yml | grep -qE '^\s+dex_data:\s*$' &&
      ! grep -E '^\s+- "5556:5556"\s*$' docker-compose.yml &&
      echo OK
    </automated>
  </verify>
  <acceptance_criteria>
    - `docker compose config --quiet` exits 0 (YAML + compose schema valid).
    - `dex` service exists with image `ghcr.io/dexidp/dex:v2.43.0`.
    - Healthcheck uses `127.0.0.1` and the `/dex/healthz` path.
    - `dex_data` volume listed under top-level `volumes:`.
    - `npm.depends_on` lists all three: `api`, `frontend`, `dex` (each with `condition: service_healthy`).
    - No active host port binding for 5556 — only the commented `# - "5556:5556"` debug hatch.
  </acceptance_criteria>
  <done>
    docker-compose.yml has a valid `dex` service, the `dex_data` named volume is declared, and NPM gates startup on Dex being healthy.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Generate real bcrypt hashes, UUIDs, secrets and substitute into dex/config.yaml + .env</name>
  <files>dex/config.yaml, .env</files>
  <read_first>
    - dex/config.yaml (placeholder strings to replace: REPLACE_WITH_ADMIN_BCRYPT_HASH, REPLACE_WITH_DEV_BCRYPT_HASH, REPLACE_WITH_UUID_GENERATED_BY_uuidgen)
    - .env.example (template to copy from if .env does not exist locally)
    - .planning/phases/27-dex-idp-setup/27-RESEARCH.md (sections "Add-a-user workflow" and Open Question 2 about `-it`)
    - .planning/phases/27-dex-idp-setup/27-CONTEXT.md (D-04, D-05, D-13)
  </read_first>
  <action>
    Step A — Ensure local `.env` exists. If `.env` does not exist, copy `.env.example` to `.env` first (do NOT git-add `.env` — it is gitignored).

    Step B — Generate two REAL client secrets and write them into `.env`, replacing the placeholder values:

    ```
    KPI_SECRET=$(openssl rand -hex 32)
    OUTLINE_SECRET=$(openssl rand -hex 32)
    sed -i.bak "s|^DEX_KPI_SECRET=.*|DEX_KPI_SECRET=${KPI_SECRET}|" .env
    sed -i.bak "s|^DEX_OUTLINE_SECRET=.*|DEX_OUTLINE_SECRET=${OUTLINE_SECRET}|" .env
    rm .env.bak
    ```

    Step C — Generate two REAL bcrypt hashes using Dex's own `hash-password` subcommand (D-15). The image must be pulled first so the command works without compose:

    ```
    docker pull ghcr.io/dexidp/dex:v2.43.0
    # Pipe a known password in. Use a placeholder password "ChangeMe!2026" for both
    # users — it MUST be rotated by the operator before any human shares the
    # credentials. Document this in plan 27-03's runbook.
    ADMIN_HASH=$(echo -n 'ChangeMe!2026-admin' | docker run --rm -i ghcr.io/dexidp/dex:v2.43.0 dex hash-password)
    DEV_HASH=$(echo -n 'ChangeMe!2026-dev' | docker run --rm -i ghcr.io/dexidp/dex:v2.43.0 dex hash-password)
    ```

    If `dex hash-password` does not accept piped stdin, fall back to running it interactively per Open Question 2 and capturing the output manually:
    ```
    docker run --rm -it ghcr.io/dexidp/dex:v2.43.0 dex hash-password
    ```

    Verify both hashes start with `$2a$10$` or `$2b$10$` (bcrypt cost 10 prefix). If the prefix differs, abort and re-run — Dex must have produced a non-bcrypt output.

    Step D — Generate two REAL UUIDs (D-05, stable, never to change):

    ```
    ADMIN_UUID=$(uuidgen | tr 'A-Z' 'a-z')
    DEV_UUID=$(uuidgen | tr 'A-Z' 'a-z')
    ```

    Step E — Substitute all four placeholder strings in `dex/config.yaml` with the generated values. Replace:
      - `$2a$10$REPLACE_WITH_ADMIN_BCRYPT_HASH` → `${ADMIN_HASH}` (the FULL hash including the `$2a$10$` prefix; do NOT prepend an extra `$2a$10$`)
      - `$2a$10$REPLACE_WITH_DEV_BCRYPT_HASH` → `${DEV_HASH}` (same)
      - The TWO `REPLACE_WITH_UUID_GENERATED_BY_uuidgen` strings → `${ADMIN_UUID}` (first occurrence, under admin@acm.local) and `${DEV_UUID}` (second occurrence, under dev@acm.local). Use `sed` with a counter or use `awk` to replace by line range — verify by grepping that NO `REPLACE_WITH_*` markers remain.

    NOTE: The bcrypt hash contains literal `$` characters that BOTH bash and Dex's `$VAR` substitution will interpret. To avoid Dex trying to substitute `$2a$10$...` as env vars, the hash MUST be enclosed in single quotes in YAML (the placeholder block from plan 27-01 already used double quotes — change them to single quotes during substitution, OR escape every `$` as `$$`). Single-quoted YAML strings are simpler:

    ```yaml
    hash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
    ```

    Step F — Document the placeholder passwords in a comment block at the TOP of `dex/config.yaml` (above `issuer:`), BUT do NOT commit the actual passwords:

    ```
    # SECURITY NOTE: admin and dev users were seeded with placeholder passwords
    # by plan 27-02. The placeholder passwords MUST be rotated before any human
    # shares credentials. See docs/setup.md "Dex first-login" for the rotation
    # workflow. Real passwords are NOT recorded here.
    ```
  </action>
  <verify>
    <automated>
      ! grep -q 'REPLACE_WITH_' dex/config.yaml &&
      grep -cE "hash:\s+'\\\$2[ab]\\\$10\\\$" dex/config.yaml | grep -q '^2$' &&
      grep -cE "userID:\s+\"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\"" dex/config.yaml | grep -q '^2$' &&
      test -f .env &&
      grep -qE '^DEX_KPI_SECRET=[a-f0-9]{64}$' .env &&
      grep -qE '^DEX_OUTLINE_SECRET=[a-f0-9]{64}$' .env &&
      grep -q 'SECURITY NOTE' dex/config.yaml &&
      ! grep -qE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml &&
      echo OK
    </automated>
  </verify>
  <acceptance_criteria>
    - Zero `REPLACE_WITH_*` markers remain in `dex/config.yaml`.
    - Exactly two `hash:` lines starting with `$2a$10$` or `$2b$10$` enclosed in single quotes.
    - Exactly two `userID:` lines containing valid lowercase UUID strings (8-4-4-4-12 hex pattern).
    - `.env` exists locally with two 64-hex-char secrets in `DEX_KPI_SECRET` and `DEX_OUTLINE_SECRET`.
    - `dex/config.yaml` has a top-of-file SECURITY NOTE comment about placeholder passwords.
    - `dex/config.yaml` still references `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` literally for the client `secret:` lines — NOT the resolved 64-hex value (Pitfall 6).
  </acceptance_criteria>
  <done>
    `dex/config.yaml` is fully resolved (no placeholders), `.env` has real client secrets, and the file is ready for `docker compose up dex` to consume successfully.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Bring stack up, verify Dex healthcheck and discovery endpoint reachability internally</name>
  <files></files>
  <read_first>
    - docker-compose.yml (after Task 1)
    - dex/config.yaml (after Task 2)
    - .planning/phases/27-dex-idp-setup/27-RESEARCH.md (sections "Verification curl for success criterion 1" and "Common Pitfalls 1, 2, 3")
  </read_first>
  <action>
    Step A — Pull the Dex image and bring up the dex service alone first to validate config + healthcheck:

    ```
    docker compose pull dex
    docker compose up -d dex
    ```

    Wait up to 30 s for the container to become healthy:
    ```
    for i in 1 2 3 4 5 6; do
      STATUS=$(docker compose ps --format json dex | python3 -c 'import sys,json; print(json.loads(sys.stdin.read()).get("Health","unknown"))' 2>/dev/null || echo unknown)
      echo "attempt $i: $STATUS"
      [ "$STATUS" = "healthy" ] && break
      sleep 5
    done
    ```

    If unhealthy after 30 s, dump logs (`docker compose logs dex --tail=100`) and stop. Common causes (per RESEARCH Pitfalls):
      - YAML parse error in `dex/config.yaml` (unescaped `$` in bcrypt hash → double-quoted string variant)
      - Image fails to find `/etc/dex/config.yaml` (bind-mount path mismatch)
      - Busybox IPv6 issue with healthcheck (the config already uses `127.0.0.1`, so this should NOT happen — but verify with `docker compose exec dex wget -qO- http://127.0.0.1:5556/dex/healthz`).

    Step B — Validate discovery from inside the container (bypasses NPM, isolates Dex correctness):

    ```
    docker compose exec dex wget -qO- http://127.0.0.1:5556/dex/.well-known/openid-configuration > /tmp/dex-discovery.json
    cat /tmp/dex-discovery.json | python3 -c "import sys, json; d=json.load(sys.stdin); print('issuer=',d['issuer']); print('scopes_supported=',d.get('scopes_supported')); assert d['issuer']=='https://auth.internal/dex', 'Issuer mismatch: '+d['issuer']; assert 'offline_access' in d.get('scopes_supported',[]), 'offline_access missing'; print('INTERNAL_DISCOVERY_OK')"
    ```

    The `issuer` claim in this internal discovery MUST be exactly `https://auth.internal/dex` — that string is built from the `issuer:` line in `config.yaml`, NOT from the request's host header, so it works even though the curl is to `127.0.0.1`.

    Step C — Bring the rest of the stack up (so NPM is online for the next checkpoint):
    ```
    docker compose up -d
    docker compose ps
    ```

    All five existing services (db, api, frontend, npm) plus dex MUST report healthy or running (db, api, frontend, npm, dex). The migrate service exits successfully (`completed_successfully`).

    Do NOT attempt to repoint NPM's `auth.internal` proxy host from the CLI — that is a manual NPM-admin-UI step gated by Phase 26 D-09 (NPM is operator-managed via UI, persisted in `npm_data` volume). The next checkpoint task instructs the operator to do it.
  </action>
  <verify>
    <automated>
      docker compose ps --format json dex | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); assert d.get('Health')=='healthy', f'dex not healthy: {d}'; print('DEX_HEALTHY')" &&
      docker compose exec -T dex wget -qO- http://127.0.0.1:5556/dex/.well-known/openid-configuration | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['issuer']=='https://auth.internal/dex', d['issuer']; assert 'offline_access' in d['scopes_supported']; print('INTERNAL_DISCOVERY_OK')"
    </automated>
  </verify>
  <acceptance_criteria>
    - `docker compose ps dex` reports `healthy`.
    - Internal discovery (from inside the dex container) returns JSON with `issuer == "https://auth.internal/dex"` exactly.
    - Internal discovery `scopes_supported` array contains `offline_access` (DEX-06 verified at the protocol level).
    - All other services (db, api, frontend, npm) remain healthy/running — Dex addition did not regress the stack.
  </acceptance_criteria>
  <done>
    Dex container is healthy and serving valid OIDC discovery from within the docker network. The remaining gap to roadmap success criterion 1 is the NPM proxy-host repoint (operator UI step, next checkpoint).
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4: Operator NPM proxy-host repoint for auth.internal → dex:5556</name>
  <files>npm_data (named docker volume — NPM admin UI persists proxy-host config here, no git-tracked file)</files>
  <action>Operator performs the NPM admin-UI steps documented under &lt;how-to-verify&gt; below: edit the auth.internal proxy host to forward to dex:5556 over http, paste the X-Forwarded-Proto Advanced block, save, then run the host-shell curl + browser-login + restart-survival verifications. This task is human-only because Phase 26 D-09 locks NPM proxy-host management to the admin UI (npm_data volume). After completion, operator types the resume signal so Claude continues.</action>
  <verify>
    <automated>MISSING — operator-only step. The host-shell curl assertions in step 7 of &lt;how-to-verify&gt; (`test "$(curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -c 'import sys,json; print(json.load(sys.stdin)["issuer"])')" = "https://auth.internal/dex"`) are runnable by Claude AFTER the operator finishes the UI edit; Claude should re-run them as a post-checkpoint sanity check before declaring the plan done.</automated>
  </verify>
  <done>Operator has reported PASS on all five sub-checks: external discovery JSON correct, authorization_endpoint is https, admin@acm.local login + code redirect succeeded, dev@acm.local login + code redirect succeeded, /data/dex.db survived `docker compose restart dex`.</done>
  <what-built>
    Dex is running and healthy inside the docker network. NPM currently still routes `auth.internal` to the Phase 26 placeholder `api:8000` (per 26-CONTEXT D-02 placeholder). The repoint to `dex:5556` is a manual NPM admin-UI edit because Phase 26 D-09 locked NPM proxy-host management as a UI-only workflow (no automation), persisted in the `npm_data` named volume.
  </what-built>
  <how-to-verify>
    Operator steps (perform exactly in this order):

    1. Open NPM admin UI: http://localhost:81 (use the credentials you set during Phase 26 first-login).
    2. Go to "Hosts → Proxy Hosts". Find the row for `auth.internal`.
    3. Click "Edit". On the "Details" tab:
       - Forward Hostname / IP: change from `api` to `dex`
       - Forward Port: change from `8000` to `5556`
       - Scheme: keep `http` (D-03 — NPM terminates TLS, Dex listens HTTP internally)
       - "Block Common Exploits" stays ON
       - "Websockets Support" stays ON
    4. Switch to the "SSL" tab. Confirm SSL Certificate is the existing `internal-wildcard` cert (Phase 26). "Force SSL" + "HTTP/2 Support" stay ON.
    5. Switch to the "Advanced" tab. Paste this block into the custom Nginx config (REPLACES anything already there for auth.internal):

       ```
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto https;
       proxy_set_header X-Forwarded-For $remote_addr;
       proxy_set_header X-Real-IP $remote_addr;
       ```

       This block is REQUIRED — without `X-Forwarded-Proto https`, Dex would emit `http://` URLs in the discovery document and break OIDC clients (Pitfall 2).

    6. Click "Save". NPM should show a green "Online" status for `auth.internal` within 5 s.

    7. From your host machine (NOT inside a container), run the final external verification:

       ```
       curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -m json.tool
       ```

       Expected output JSON keys:
         - `"issuer": "https://auth.internal/dex"`           ← MUST be exact
         - `"authorization_endpoint": "https://auth.internal/dex/auth"`   ← MUST start with `https://`
         - `"token_endpoint": "https://auth.internal/dex/token"`
         - `"jwks_uri": "https://auth.internal/dex/keys"`
         - `"userinfo_endpoint": "https://auth.internal/dex/userinfo"`
         - `"response_types_supported": ["code"]`
         - `"grant_types_supported": ["authorization_code", "refresh_token"]`
         - `"scopes_supported"` includes `"offline_access"`

       Then run the strict assertion:
       ```
       test "$(curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -c 'import sys,json; print(json.load(sys.stdin)["issuer"])')" = "https://auth.internal/dex" && echo SUCCESS_CRITERION_1_OK || echo FAIL
       ```

       AND:
       ```
       curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["authorization_endpoint"].startswith("https://"), d["authorization_endpoint"]; print("AUTH_ENDPOINT_HTTPS_OK")'
       ```

       If `authorization_endpoint` shows `http://`, return to step 5 and re-check the Advanced block was saved (Pitfall 2).

    8. Open https://auth.internal/dex/auth?client_id=kpi-light&redirect_uri=https://kpi.internal/api/auth/callback&response_type=code&scope=openid+email+profile+offline_access&state=test in a browser. Expect to see Dex's login form (a simple page with email + password fields and a "Log in" button). Log in as `admin@acm.local` with the placeholder password `ChangeMe!2026-admin` (set in Task 2). Expect Dex to redirect to `https://kpi.internal/api/auth/callback?code=...&state=test`. The callback target will 404 (the API endpoint doesn't exist yet — that's Phase 28). The 404 plus the presence of `code=` in the URL proves the login + Authorization Code issuance worked end-to-end.

    9. Repeat step 8 with `dev@acm.local` / `ChangeMe!2026-dev` to confirm both users authenticate.

    10. Restart-survival check (success criterion 5):
        ```
        docker compose restart dex
        # wait for healthy
        docker compose exec dex sh -c 'ls -la /data/dex.db'
        ```
        Confirm `/data/dex.db` still exists (the `dex_data` named volume preserved it). Then re-run step 8 in the SAME browser and confirm the existing session token is still accepted (no re-prompt for password if you have an active session, OR a fresh login still works).

    Report back to Claude with:
      - PASS / FAIL on each: discovery JSON correct (step 7), authorization_endpoint is https (step 7), admin login succeeded (step 8), dev login succeeded (step 9), dex.db survived restart (step 10).
      - If any FAIL, paste the exact JSON output or browser error.
  </how-to-verify>
  <acceptance_criteria>
    - Operator confirms `curl -sk https://auth.internal/dex/.well-known/openid-configuration` returns `issuer == "https://auth.internal/dex"` (success criterion 1).
    - Operator confirms `authorization_endpoint` value starts with `https://` (Pitfall 2 mitigated).
    - Operator confirms BOTH seeded users (admin, dev) successfully log in via the Dex form and Dex issues an authorization code (success criterion 3).
    - Operator confirms `/data/dex.db` exists after `docker compose restart dex` (success criterion 5 — named volume persistence).
  </acceptance_criteria>
  <resume-signal>Type "approved: discovery + admin + dev + restart-survival all PASS" or paste the failing output for diagnosis.</resume-signal>
</task>

</tasks>

<verification>
After all four tasks (including operator checkpoint), the following must hold:

1. `docker compose ps dex` → healthy.
2. `curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["issuer"]=="https://auth.internal/dex"; assert d["authorization_endpoint"].startswith("https://"); assert "offline_access" in d["scopes_supported"]; print("OK")'` → prints OK.
3. Both `admin@acm.local` and `dev@acm.local` complete a Dex login (operator-confirmed in checkpoint).
4. `docker compose exec dex sh -c 'test -f /data/dex.db' && echo OK` after `docker compose restart dex` → OK (volume persistence).
5. `! grep -qE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml` → no real secrets leaked into the git-tracked config.
</verification>

<success_criteria>
- DEX-01: Dex compose service runs `ghcr.io/dexidp/dex:v2.43.0`, mounts `dex_data:/data` for SQLite persistence, reachable as `https://auth.internal` via NPM.
- DEX-02: Discovery returns valid JSON with `issuer == https://auth.internal/dex` (operator checkpoint step 7).
- DEX-04: Both seeded users authenticate via Dex login form (operator checkpoint steps 8 + 9). Bcrypt hash workflow exercised end-to-end (Task 2 + checkpoint).
- DEX-06: `offline_access` appears in `scopes_supported` (verified internally in Task 3 + externally in checkpoint step 7).
- Roadmap success criterion 5: `dex_data` volume survives `docker compose restart dex` (checkpoint step 10).
</success_criteria>

<output>
After completion, create `.planning/phases/27-dex-idp-setup/27-02-SUMMARY.md` documenting:
  - The exact bcrypt hash format used and the placeholder passwords (so plan 27-03 runbook can reference them as "must be rotated").
  - The two stable user UUIDs generated (so they are recoverable from git history).
  - Any deviations: e.g., if `dex hash-password` required `-it` instead of piped stdin (Open Question 2 result).
  - The exact NPM Advanced block the operator pasted (so plan 27-03 runbook copies it verbatim).
  - One-line handoff to plan 27-03: "Runbook source-of-truth values now exist; document them."
</output>
