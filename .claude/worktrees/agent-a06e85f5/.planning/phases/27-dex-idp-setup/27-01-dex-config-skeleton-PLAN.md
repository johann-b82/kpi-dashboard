---
phase: 27-dex-idp-setup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - dex/config.yaml
  - .env.example
autonomous: true
requirements: [DEX-02, DEX-03, DEX-04, DEX-05, DEX-06]
must_haves:
  truths:
    - "dex/config.yaml exists with issuer https://auth.internal/dex (no trailing slash)"
    - "dex/config.yaml declares two staticClients (kpi-light, outline) with exact redirect URIs from D-25"
    - "dex/config.yaml declares two staticPasswords (admin@acm.local, dev@acm.local) with placeholder bcrypt + UUID markers"
    - "dex/config.yaml uses $DEX_KPI_SECRET / $DEX_OUTLINE_SECRET literals (no resolved secrets)"
    - "dex/config.yaml token expiry: idTokens 1h; refreshTokens validIfNotUsedFor 720h, absoluteLifetime 2160h, disableRotation false"
    - ".env.example contains DEX_KPI_SECRET and DEX_OUTLINE_SECRET placeholder lines with openssl-rand instructions"
  artifacts:
    - path: "dex/config.yaml"
      provides: "Authoritative Dex configuration: issuer, storage, web, oauth2, expiry, staticPasswords, staticClients"
      contains: "issuer: https://auth.internal/dex"
    - path: ".env.example"
      provides: "Documented placeholders for DEX_KPI_SECRET and DEX_OUTLINE_SECRET"
      contains: "DEX_KPI_SECRET="
  key_links:
    - from: "dex/config.yaml staticClients[].secret"
      to: ".env DEX_KPI_SECRET / DEX_OUTLINE_SECRET"
      via: "Dex native $VAR substitution at boot"
      pattern: "secret:\\s+\\$DEX_(KPI|OUTLINE)_SECRET"
---

<objective>
Create the authoritative `dex/config.yaml` skeleton and document the secret env vars in `.env.example`. This is a pure declarative-config plan — no compose changes, no containers booted. Output is the source-of-truth file every later step (compose service, secret resolution, login verification) will read.

Purpose: Lock the issuer URL, client list, redirect URIs, token lifetimes, and seed-user shape into a single git-tracked artifact so plan 27-02 only has to (a) wire it into compose and (b) replace placeholder hashes/UUIDs with real values.
Output: `dex/config.yaml` (NEW), `.env.example` (appended).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/27-dex-idp-setup/27-CONTEXT.md
@.planning/phases/27-dex-idp-setup/27-RESEARCH.md
@.env.example
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create dex/config.yaml from research skeleton</name>
  <files>dex/config.yaml</files>
  <read_first>
    - .planning/phases/27-dex-idp-setup/27-RESEARCH.md (section "Code Examples → Full dex/config.yaml")
    - .planning/phases/27-dex-idp-setup/27-CONTEXT.md (decisions D-01, D-03, D-04..D-12, D-25, D-26)
  </read_first>
  <action>
    Create new directory `dex/` and new file `dex/config.yaml` by copying the skeleton verbatim from 27-RESEARCH.md "Code Examples → Full `dex/config.yaml`".

    The file MUST contain these exact values (per locked decisions):

    - `issuer: https://auth.internal/dex` (D-01, no trailing slash, no quotes)
    - `storage.type: sqlite3` with `storage.config.file: /data/dex.db` (D-18)
    - `web.http: 0.0.0.0:5556` (D-03, plain HTTP — NPM terminates TLS)
    - `logger.level: "info"`, `logger.format: "json"` (Discretion)
    - `oauth2.skipApprovalScreen: true` (D-11)
    - `oauth2.responseTypes: [code]` (D-12)
    - `oauth2.grantTypes: [authorization_code, refresh_token]` (D-12)
    - `expiry.idTokens: "1h"` (D-07, satisfies DEX-05)
    - `expiry.refreshTokens.validIfNotUsedFor: "720h"` (D-08)
    - `expiry.refreshTokens.absoluteLifetime: "2160h"` (D-09)
    - `expiry.refreshTokens.disableRotation: false` (D-10)
    - `enablePasswordDB: true`
    - `staticPasswords` with TWO entries — both with placeholder hash and userID strings:
        - email `"admin@acm.local"`, username `"admin"`, hash `"$2a$10$REPLACE_WITH_ADMIN_BCRYPT_HASH"`, userID `"REPLACE_WITH_UUID_GENERATED_BY_uuidgen"`
        - email `"dev@acm.local"`, username `"dev"`, hash `"$2a$10$REPLACE_WITH_DEV_BCRYPT_HASH"`, userID `"REPLACE_WITH_UUID_GENERATED_BY_uuidgen"`
      (D-04, D-05; placeholders are intentional — plan 27-02 substitutes real values.)
    - `staticClients` with TWO entries (D-25):
        - id: `kpi-light`, secret: `$DEX_KPI_SECRET` (literal, NO quotes — env-var ref per D-13), name: `"KPI Light"`, redirectURIs: `[https://kpi.internal/api/auth/callback]`
        - id: `outline`, secret: `$DEX_OUTLINE_SECRET`, name: `"Outline Wiki"`, redirectURIs: `[https://wiki.internal/auth/oidc.callback]` — the DOT in `oidc.callback` is intentional (Pitfall 5; copy exact string).

    Do NOT add: `web.allowedOrigins`, `web.https`/`web.tlsCert`/`web.tlsKey`, `grpc:` block, `telemetry:` block, `connectors:` block. None are needed for static-password + Authorization Code (Discretion section).

    Do NOT resolve `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` to literal values (Pitfall 6). The literal `$VAR` form is what Dex substitutes at boot.

    Add a top header comment block: `# ./dex/config.yaml — Dex v2.43.x — see .planning/phases/27-dex-idp-setup/27-RESEARCH.md` and an inline comment marking each token-expiry field with its decision ID.
  </action>
  <verify>
    <automated>
      test -f dex/config.yaml &&
      grep -qE '^issuer:\s+https://auth\.internal/dex\s*$' dex/config.yaml &&
      grep -qE '^\s*file:\s+/data/dex\.db' dex/config.yaml &&
      grep -qE '^\s*http:\s+0\.0\.0\.0:5556' dex/config.yaml &&
      grep -qE '^\s*idTokens:\s+"1h"' dex/config.yaml &&
      grep -qE '^\s*validIfNotUsedFor:\s+"720h"' dex/config.yaml &&
      grep -qE '^\s*absoluteLifetime:\s+"2160h"' dex/config.yaml &&
      grep -qE '^\s*disableRotation:\s+false' dex/config.yaml &&
      grep -qE '^\s*skipApprovalScreen:\s+true' dex/config.yaml &&
      grep -q '"admin@acm.local"' dex/config.yaml &&
      grep -q '"dev@acm.local"' dex/config.yaml &&
      grep -qE 'id:\s+kpi-light' dex/config.yaml &&
      grep -qE 'id:\s+outline' dex/config.yaml &&
      grep -q 'https://kpi.internal/api/auth/callback' dex/config.yaml &&
      grep -q 'https://wiki.internal/auth/oidc.callback' dex/config.yaml &&
      grep -qE 'secret:\s+\$DEX_KPI_SECRET' dex/config.yaml &&
      grep -qE 'secret:\s+\$DEX_OUTLINE_SECRET' dex/config.yaml &&
      grep -q 'REPLACE_WITH_ADMIN_BCRYPT_HASH' dex/config.yaml &&
      grep -q 'REPLACE_WITH_DEV_BCRYPT_HASH' dex/config.yaml &&
      ! grep -qE 'web\.allowedOrigins|^\s*grpc:|^\s*telemetry:' dex/config.yaml &&
      ! grep -qE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml &&
      echo OK
    </automated>
  </verify>
  <acceptance_criteria>
    - File `dex/config.yaml` exists.
    - Exactly the line `issuer: https://auth.internal/dex` is present (no trailing slash, no quoted variant).
    - Both client redirect URIs literally present including the DOT in `oidc.callback`.
    - Both client `secret:` lines reference `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` literally (no 32+ hex char value committed).
    - Both staticPasswords entries present with the two placeholder hash strings AND the placeholder userID string (so plan 27-02 can `sed`-replace deterministically).
    - No `web.https`, `grpc:`, `telemetry:`, or `web.allowedOrigins` blocks.
  </acceptance_criteria>
  <done>
    Static `dex/config.yaml` exists, locked to issuer `https://auth.internal/dex`, with exact client + user shape defined. Placeholders for secrets/hashes/UUIDs remain unresolved — plan 27-02 fills them in.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Append Dex secret block to .env.example</name>
  <files>.env.example</files>
  <read_first>
    - .env.example
    - .planning/phases/27-dex-idp-setup/27-RESEARCH.md (section "Code Examples → .env.example append")
    - .planning/phases/27-dex-idp-setup/27-CONTEXT.md (decisions D-13, D-14)
  </read_first>
  <action>
    Append the Dex secrets block to the END of `.env.example` (preserving every existing line — Postgres + NPM blocks stay verbatim).

    Append exactly this block (newline between it and the existing NPM block):

    ```
    # --- Dex OIDC (dex service) ---
    # Client secrets for the two OIDC clients Dex hosts (D-13, D-14).
    # These same names are read by the api service (Phase 28) and the
    # outline service (Phase 29) — single source of truth across the stack.
    # Generate real values with:
    #   openssl rand -hex 32
    # Never commit real secrets — only placeholders in this file.
    # The real .env file is gitignored.
    DEX_KPI_SECRET=changeme-kpi-light-client-secret
    DEX_OUTLINE_SECRET=changeme-outline-client-secret
    ```

    Do NOT modify any line above the new block. Do NOT add the real `.env` file (it is gitignored — that's plan 27-02's local-state concern, not this plan's git-tracked one).
  </action>
  <verify>
    <automated>
      grep -q 'DEX_KPI_SECRET=changeme-kpi-light-client-secret' .env.example &&
      grep -q 'DEX_OUTLINE_SECRET=changeme-outline-client-secret' .env.example &&
      grep -q 'openssl rand -hex 32' .env.example &&
      grep -q 'POSTGRES_USER=kpi_user' .env.example &&
      grep -q 'NPM has no env vars' .env.example &&
      echo OK
    </automated>
  </verify>
  <acceptance_criteria>
    - Both new lines `DEX_KPI_SECRET=...` and `DEX_OUTLINE_SECRET=...` present with placeholder values (NOT real 64-hex-char secrets).
    - `openssl rand -hex 32` instruction line present so operators know how to generate.
    - Existing Postgres and NPM blocks intact (POSTGRES_USER and NPM bootstrap notes still grep-findable).
  </acceptance_criteria>
  <done>
    `.env.example` lists the two Dex secret env var names with placeholder values and a clear instruction to use `openssl rand -hex 32` for real values.
  </done>
</task>

</tasks>

<verification>
After both tasks complete, the following must hold:

1. `dex/config.yaml` parses as valid YAML (no syntax errors) — confirm with `python3 -c "import yaml; yaml.safe_load(open('dex/config.yaml'))"` (yaml lib is part of stdlib via PyYAML — already available because `pandas` requires it). If PyYAML is missing, fall back to: `docker run --rm -v "$PWD/dex:/etc/dex:ro" ghcr.io/dexidp/dex:v2.43.0 dex serve --help` (smoke test that the image accepts `dex serve` invocation — config validation happens at boot in plan 27-02).
2. No real secret value has slipped into either file:
   `! grep -rE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml .env.example`
3. Both files are git-tracked (no .gitignore exclusion blocks them).

Combined grep (one-liner):
```
test -f dex/config.yaml && \
  grep -qE '^issuer: https://auth\.internal/dex$' dex/config.yaml && \
  grep -q 'DEX_KPI_SECRET=changeme-kpi-light-client-secret' .env.example && \
  ! grep -rE 'secret:\s+[a-f0-9]{32,}' dex/config.yaml .env.example && \
  echo PHASE_27_01_OK
```
</verification>

<success_criteria>
- DEX-02: `issuer: https://auth.internal/dex` declared (the discovery endpoint will be served at this issuer once Dex boots in plan 27-02).
- DEX-03: Both `kpi-light` and `outline` clients with exact redirect URIs declared.
- DEX-04 (config half): Two `staticPasswords` entries shaped correctly with placeholders awaiting real bcrypt hashes (plan 27-02) and the doc workflow (plan 27-03).
- DEX-05: `idTokens: "1h"` declared.
- DEX-06: `offline_access` is exposed by Dex by default (no extra config required); confirmed by the discovery `scopes_supported` array in plan 27-02 verification.
- DEX-01 (config half): `storage.type: sqlite3`, `web.http: 0.0.0.0:5556`, paths set up so plan 27-02's compose service block has zero ambiguity.
</success_criteria>

<output>
After completion, create `.planning/phases/27-dex-idp-setup/27-01-SUMMARY.md` documenting the file shape, any deviations from the research skeleton, and a one-line "ready for compose wiring" handoff for plan 27-02.
</output>
