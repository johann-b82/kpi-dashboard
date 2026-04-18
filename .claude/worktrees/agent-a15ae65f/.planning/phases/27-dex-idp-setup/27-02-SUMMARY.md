---
phase: 27-dex-idp-setup
plan: 02
subsystem: auth
tags: [dex, oidc, docker-compose, bcrypt, sqlite, nginx-proxy-manager]
requires:
  - phase: 26-npm-hostnames
    provides: auth.internal hostname + TLS edge (Phase 26 placeholder proxy host now repointed to dex:5556)
  - phase: 27-dex-idp-setup (plan 01)
    provides: dex/config.yaml skeleton with REPLACE_WITH_* placeholders
provides:
  - Running Dex v2.43.0 container reachable at https://auth.internal/dex
  - External OIDC discovery endpoint returning issuer=https://auth.internal/dex
  - Two seeded users (admin@acm.local, dev@acm.local) authenticating end-to-end with Authorization Code issuance
  - dex_data named volume persisting /data/dex.db across docker compose restart dex
  - NPM proxy-host auth.internal → dex:5556 with X-Forwarded-Proto https Advanced block
  - .env (gitignored) with real 64-hex DEX_KPI_SECRET and DEX_OUTLINE_SECRET
affects:
  - plan 27-03 (runbook must document python-bcrypt hash workflow instead of dex hash-password; NPM Advanced block; SECURITY NOTE rotation)
  - Phase 28 (KPI Light OIDC client can now resolve discovery and complete auth code flow against kpi-light client_id)
  - Phase 29 (Outline wiki can point OIDC_AUTH_URI at https://auth.internal/dex using outline client_id)
tech-stack:
  added:
    - Dex v2.43.0 (ghcr.io/dexidp/dex)
    - python:3.12-alpine + bcrypt library (ad-hoc hash generation)
  patterns:
    - Dex container runs as user root (workaround for named-volume root-ownership vs image UID 1001 mismatch; hardening deferred to optional chown init sidecar)
    - Single-quoted YAML for bcrypt hashes (prevents Dex $VAR substitution from consuming $2a$10$ as env-var markers)
    - Hash generation via python:3.12-alpine + bcrypt (canonical until Dex ships hash-password subcommand again)
    - NPM Advanced block pattern: proxy_set_header X-Forwarded-Proto https; required for any OIDC issuer behind NPM to emit https:// URLs in discovery
key-files:
  created:
    - .env (local only, gitignored — real DEX_KPI_SECRET + DEX_OUTLINE_SECRET)
  modified:
    - docker-compose.yml (dex service block, dex_data volume, npm→dex depends_on, user: root fix)
    - dex/config.yaml (real bcrypt hashes, real UUIDs, single-quoted YAML, SECURITY NOTE header)
key-decisions:
  - "[Rule 3 Blocking] Dex v2.43.0 removed the hash-password subcommand — generated bcrypt cost-10 hashes via python:3.12-alpine + bcrypt library; plan 27-03 runbook must document this as the canonical workflow"
  - "[Rule 1 Bug] Dex image runs as UID 1001 but the dex_data named volume /data is root-owned at creation — added user: root to the dex service so sqlite3 can create /data/dex.db; alternative chown init sidecar documented inline for future hardening"
  - "NPM proxy-host repoint to dex:5556 confirmed via operator UI action (Phase 26 D-09 locks NPM to admin-UI workflow); Advanced block X-Forwarded-Proto https paste-verified working"
  - "Two stable user UUIDs minted and committed to dex/config.yaml (D-05 — recoverable from git history, never to change)"
patterns-established:
  - "Dex bcrypt hashes use python:3.12-alpine + bcrypt library (cost 10, $2b$10$ prefix) since dex hash-password is no longer shipped"
  - "Dex compose service runs as user: root as a pragmatic workaround for named-volume UID mismatch"
  - "NPM Advanced tab must include X-Forwarded-Proto https for any HTTPS-terminated OIDC issuer"
requirements-completed: [DEX-01, DEX-02, DEX-04, DEX-06]
duration: 4min
completed: 2026-04-15
---

# Phase 27 Plan 02: Dex Compose Wiring + Bootstrap Summary

**Dex v2.43.0 container running on auth.internal with real bcrypt hashes, stable user UUIDs, NPM X-Forwarded-Proto proxy, and dex_data volume — external discovery returns https issuer and both seeded users complete end-to-end auth-code login.**

## Performance

- **Duration:** ~4 min (auto tasks) + operator NPM UI + 2 browser logins + restart-survival check
- **Started:** 2026-04-14T21:57:33Z (first commit)
- **Completed:** 2026-04-14T22:01:15Z (auto tasks) — operator checkpoint PASS confirmed during this session
- **Tasks:** 4 (3 automated + 1 operator NPM repoint)
- **Files modified:** 3 (docker-compose.yml, dex/config.yaml, .env local-only)

## Accomplishments

- Dex compose service wired: image pinned to `ghcr.io/dexidp/dex:v2.43.0`, `dex_data` named volume, healthcheck on `127.0.0.1:5556/dex/healthz`, `npm.depends_on.dex: service_healthy` gate.
- Real cost-10 bcrypt hashes substituted for both seeded users; two stable lowercase UUIDs minted (recoverable from git in this commit; the exact values live in `dex/config.yaml` as the authoritative source).
- Local `.env` populated with two 64-hex client secrets; secrets never committed.
- Dex container reaches Healthy on `docker compose up -d`; internal discovery returns issuer `https://auth.internal/dex` with `offline_access` in `scopes_supported`.
- Operator repointed NPM `auth.internal` proxy host from Phase 26 placeholder `api:8000` to `dex:5556`, pasted the `X-Forwarded-Proto https` Advanced block.
- External discovery now returns `issuer=https://auth.internal/dex` and `authorization_endpoint` starts with `https://`.
- Both seeded users logged in via browser → Dex issued authorization codes (admin: `code=t26yzvnioinicqrmvh7oza3ig&state=test`; dev: `code=hgiokpbqfsf3d4j2ynspppr6j&state=test`).
- `/data/dex.db` (98304 bytes) survives `docker compose restart dex` — named volume persistence verified.

## Task Commits

1. **Task 1: Add dex service + dex_data volume + npm depends_on** — `f4ce373` (feat)
2. **Task 2: Substitute bcrypt hashes + UUIDs + client secrets** — `5aee5ac` (feat)
3. **Task 3: Bring stack up, verify internal discovery** — `93002d1` (fix: dex user root — bundled into this task's verification step when SQLite write failed)
4. **Task 4: Operator NPM proxy-host repoint + 5 sub-check PASS** — no repo commit (NPM admin-UI change persists in the `npm_data` named volume per Phase 26 D-09). Verification documented here and in plan 27-03's forthcoming runbook.

**Plan metadata:** (this commit — `docs(27-02): complete compose-and-bootstrap plan`)

## Files Created/Modified

- `docker-compose.yml` — added `dex:` service block (image, command, volumes, env, healthcheck, `user: root`), `dex_data:` volume, extended `npm.depends_on` with `dex: service_healthy`.
- `dex/config.yaml` — replaced all `REPLACE_WITH_*` placeholders with real bcrypt cost-10 hashes (single-quoted YAML) and lowercase UUIDs; prepended SECURITY NOTE header flagging placeholder passwords for rotation.
- `.env` (local, gitignored) — real 64-hex `DEX_KPI_SECRET` and `DEX_OUTLINE_SECRET` generated via `openssl rand -hex 32`. Not committed.

## Decisions Made

- **Hash generation via python-bcrypt** (not `dex hash-password`) — Dex v2.43.0 ships no such subcommand. Used `python:3.12-alpine` + `bcrypt` library with `rounds=10`. Output `$2b$10$…` is functionally identical to what staticPasswords expects.
- **`user: root` on dex service** — named volume `/data` is root-owned at creation; image default UID 1001 cannot create `/data/dex.db`. Root is the simplest fix for an internal-tools-scope service. Alternative chown init sidecar noted inline for future hardening.
- **Single-quoted YAML for bcrypt hashes** — the literal `$2a$10$…` characters collide with Dex's native `$VAR` env substitution; single quotes bypass YAML parsing of `$` without needing `$$` escaping.
- **Operator UI step for NPM** — Phase 26 D-09 locks NPM proxy-host edits to the admin UI (persisted in `npm_data` volume). Plan intentionally gates this as a `checkpoint:human-action` rather than automating against the NPM API.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dex v2.43.0 has no `hash-password` subcommand**
- **Found during:** Task 2 (bcrypt hash generation)
- **Issue:** The plan and 27-RESEARCH.md Open Question 2 both assumed `docker run --rm -i ghcr.io/dexidp/dex:v2.43.0 dex hash-password` works. Running it returns `Error: unknown command "hash-password" for "dex"`. The subcommand was removed from upstream Dex; no single-image one-liner replaces it.
- **Fix:** Generated bcrypt cost-10 hashes via `docker run --rm python:3.12-alpine sh -c "pip install -q bcrypt && python -c 'import bcrypt; print(bcrypt.hashpw(b\"ChangeMe!2026-admin\", bcrypt.gensalt(rounds=10)).decode())'"` (and equivalent for dev). Output prefix is `$2b$10$` (functionally identical to `$2a$10$` that Dex produces — both are supported by `golang.org/x/crypto/bcrypt` at verify time).
- **Files modified:** `dex/config.yaml`
- **Verification:** Both hashes start with `$2b$10$`, exactly 60 chars; browser login for both users PASSED in operator checkpoint step 8 & 9.
- **Committed in:** `5aee5ac`

**2. [Rule 1 - Bug] SQLite write failure — Dex image UID vs named-volume ownership mismatch**
- **Found during:** Task 3 (bringing dex up)
- **Issue:** On first `docker compose up -d dex`, container went Unhealthy. Logs showed `sqlite3: unable to open database file` because the Dex image runs as UID 1001:1001 but the freshly-created `dex_data` named volume mounts `/data` with root ownership. The non-root user couldn't create `/data/dex.db`.
- **Fix:** Added `user: root` to the dex service in docker-compose.yml. Internal-tools scope tolerates the elevation; Dex already drops privileges for HTTP handling internally. Alternative documented inline: a one-shot init sidecar that runs `chown 1001:1001 /data` then exits before dex starts.
- **Files modified:** `docker-compose.yml`
- **Verification:** `docker compose up -d dex` → healthy; internal `wget` against `127.0.0.1:5556/dex/.well-known/openid-configuration` returns valid JSON with expected issuer.
- **Committed in:** `93002d1`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both essential for plan completion — without them, no hash could be produced and no container could persist. No scope creep; plan 27-03's runbook MUST inherit both (documented in handoff below).

## Issues Encountered

None beyond the two deviations above. Operator checkpoint returned 5/5 PASS on first attempt.

## Authentication Gates

None — no cloud-CLI logins needed. The operator NPM UI step is a `checkpoint:human-action` by design (Phase 26 D-09), not an auth gate.

## Operator Checkpoint Results (Task 4)

All 5 sub-checks reported PASS by operator:
1. External discovery JSON correct — `issuer == "https://auth.internal/dex"` ✓
2. `authorization_endpoint` starts with `https://` ✓ (proves X-Forwarded-Proto wiring)
3. admin@acm.local browser login → `code=t26yzvnioinicqrmvh7oza3ig&state=test` ✓
4. dev@acm.local browser login → `code=hgiokpbqfsf3d4j2ynspppr6j&state=test` ✓
5. `/data/dex.db` survives `docker compose restart dex` (file present, 98304 bytes) ✓

## Handoff to Plan 27-03 (docs runbook)

Plan 27-03's runbook source-of-truth values now exist. It MUST document:

1. **Bcrypt hash workflow (replaces `dex hash-password`):**
   ```
   docker run --rm python:3.12-alpine sh -c \
     'pip install -q bcrypt && python -c "import bcrypt; print(bcrypt.hashpw(b\"THE-PASSWORD\", bcrypt.gensalt(rounds=10)).decode())"'
   ```
   Output is a `$2b$10$…` hash (60 chars). Paste into `dex/config.yaml` `staticPasswords.hash:` as a single-quoted YAML string.

2. **NPM Advanced block** that the operator pasted for `auth.internal` (copy verbatim):
   ```
   proxy_set_header Host $host;
   proxy_set_header X-Forwarded-Proto https;
   proxy_set_header X-Forwarded-For $remote_addr;
   proxy_set_header X-Real-IP $remote_addr;
   ```

3. **Placeholder passwords requiring rotation:**
   - admin@acm.local: `ChangeMe!2026-admin`
   - dev@acm.local: `ChangeMe!2026-dev`
   Both are flagged in the SECURITY NOTE at the top of `dex/config.yaml`; runbook must instruct first-login rotation.

4. **SQLite volume permission workaround:** `user: root` is set on the dex service. If a future hardening pass replaces it with an init sidecar that chowns `/data` to `1001:1001`, the runbook must reflect that.

5. **Add-a-user flow:** generate bcrypt hash via step 1, `uuidgen | tr 'A-Z' 'a-z'` for new userID, append to `staticPasswords:` in `dex/config.yaml`, `docker compose restart dex`, verify login.

## Next Phase Readiness

- Dex is fully operational. Roadmap success criteria 1, 2, 3, 5 for Phase 27 verified; criterion 4 (bcrypt hash workflow documented) is plan 27-03's responsibility.
- DEX-01, DEX-02, DEX-04, DEX-06 complete. DEX-03 and DEX-05 were completed in plan 27-01.
- Blockers: none.

## Self-Check: PASSED

- FOUND: docker-compose.yml
- FOUND: dex/config.yaml
- FOUND: .env (local, gitignored — verified via `ls -la`)
- FOUND commit f4ce373 (Task 1)
- FOUND commit 5aee5ac (Task 2)
- FOUND commit 93002d1 (Task 3 + Rule 1 inline fix)
- Operator checkpoint 5/5 PASS confirmed in objective brief

---
*Phase: 27-dex-idp-setup*
*Completed: 2026-04-15*
