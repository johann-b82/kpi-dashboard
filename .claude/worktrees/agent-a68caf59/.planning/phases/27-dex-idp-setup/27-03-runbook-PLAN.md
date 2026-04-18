---
phase: 27-dex-idp-setup
plan: 03
type: execute
wave: 3
depends_on: ["27-02"]
files_modified:
  - docs/setup.md
files_modified_optional:
  - README.md
autonomous: true
requirements: [DEX-01, DEX-04]
must_haves:
  truths:
    - "docs/setup.md contains a 'Dex first-login' section with operator steps in order"
    - "Bcrypt hash generation command (docker compose run --rm dex dex hash-password) is documented verbatim"
    - "NPM proxy-host edit for auth.internal → dex:5556 is documented including the X-Forwarded-Proto Advanced block"
    - "Add-a-user workflow (hash-password + uuidgen + edit config + restart) is documented end-to-end"
    - "Placeholder-password rotation requirement is documented"
    - "dex_data volume + restart-survival behavior is documented"
  artifacts:
    - path: "docs/setup.md"
      provides: "Dex first-login runbook section + add-a-user workflow + secret rotation note"
      contains: "dex hash-password"
  key_links:
    - from: "docs/setup.md Dex section"
      to: "dex/config.yaml staticPasswords block"
      via: "operator follows runbook to add an entry, restart dex, verify login"
      pattern: "staticPasswords"
---

<objective>
Document the Dex operator workflow in `docs/setup.md` so the next person to add a user, rotate a secret, or rebuild the stack can do it without reading the planning artifacts. This is the artifact that closes DEX-04's "bcrypt hash generation command for adding new users is documented in the repo" success criterion.

Purpose: Make Dex a maintainable shared service. Phase 26 established `docs/setup.md` as the operator runbook (with sections like "First-time NPM bootstrap"); this plan extends it with a "Dex first-login" section in the same style.
Output: `docs/setup.md` updated; optionally `README.md` Quickstart gains a one-line note pointing to the new section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/27-dex-idp-setup/27-CONTEXT.md
@.planning/phases/27-dex-idp-setup/27-RESEARCH.md
@.planning/phases/27-dex-idp-setup/27-02-compose-and-bootstrap-PLAN.md
@docs/setup.md
@README.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Append "Dex first-login" + "Add a Dex user" sections to docs/setup.md</name>
  <files>docs/setup.md</files>
  <read_first>
    - docs/setup.md (existing structure — match heading style, code-fence style, numbered-step style from the NPM and hostnames sections)
    - .planning/phases/27-dex-idp-setup/27-RESEARCH.md (sections "Add-a-user workflow", "Verification curl", "Common Pitfalls")
    - .planning/phases/27-dex-idp-setup/27-CONTEXT.md (decisions D-13, D-15, D-16, D-25)
    - .planning/phases/27-dex-idp-setup/27-02-SUMMARY.md (if it exists at execution time — pulls in the actual NPM Advanced block and placeholder passwords)
  </read_first>
  <action>
    Append TWO new top-level sections to the END of `docs/setup.md` (preserving every existing line):

    SECTION 1 — "## Dex first-login" — covering the FIRST-TIME bring-up of Dex on a fresh machine. Include:

    1. Generate Dex client secrets:
       ```
       openssl rand -hex 32   # paste into .env as DEX_KPI_SECRET=
       openssl rand -hex 32   # paste into .env as DEX_OUTLINE_SECRET=
       ```
       Note: `dex/config.yaml` is git-tracked and references these via `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` — never edit `config.yaml` to hardcode a secret (Pitfall 6).

    2. Bring Dex up:
       ```
       docker compose up -d dex
       docker compose ps dex   # STATUS must be "healthy" within 30 s
       ```

    3. Configure NPM to route `auth.internal` to Dex (one-time per environment, persisted in `npm_data` volume — Phase 26 D-09):
       - Open http://localhost:81 → Hosts → Proxy Hosts → edit the `auth.internal` row.
       - Details tab: forward to `dex:5556` over `http`. Block Common Exploits ON, Websockets ON.
       - SSL tab: select the `internal-wildcard` cert (created in Phase 26). Force SSL ON, HTTP/2 ON.
       - Advanced tab: paste this block exactly:
         ```
         proxy_set_header Host $host;
         proxy_set_header X-Forwarded-Proto https;
         proxy_set_header X-Forwarded-For $remote_addr;
         proxy_set_header X-Real-IP $remote_addr;
         ```
         Without `X-Forwarded-Proto https`, Dex emits `http://` URLs in its discovery document and OIDC clients break (Pitfall 2 from 27-RESEARCH).
       - Save.

    4. Verify the issuer end-to-end from a host shell:
       ```
       curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -m json.tool
       # Expect: "issuer": "https://auth.internal/dex"
       # Expect: "authorization_endpoint" starts with "https://"
       # Expect: "scopes_supported" contains "offline_access"
       ```
       Strict assertion (one-liner):
       ```
       test "$(curl -sk https://auth.internal/dex/.well-known/openid-configuration | python3 -c 'import sys,json; print(json.load(sys.stdin)["issuer"])')" = "https://auth.internal/dex" && echo OK || echo FAIL
       ```

    5. Verify a seeded user can log in:
       ```
       open 'https://auth.internal/dex/auth?client_id=kpi-light&redirect_uri=https://kpi.internal/api/auth/callback&response_type=code&scope=openid+email+profile+offline_access&state=test'
       ```
       Log in as `admin@acm.local` (placeholder password documented in `.planning/phases/27-dex-idp-setup/27-02-SUMMARY.md`). Dex redirects to `https://kpi.internal/api/auth/callback?code=...` — the 404 there is expected until Phase 28; the `code=` param proves Dex issued an Authorization Code.

    6. **SECRET ROTATION (do this before sharing access with humans):**
       The placeholder passwords seeded by plan 27-02 (`ChangeMe!2026-admin`, `ChangeMe!2026-dev`) are documented in git history and MUST be rotated. Follow "Add or rotate a Dex user" below to set new passwords for both seeded users.

    SECTION 2 — "## Add or rotate a Dex user" — the canonical D-15 workflow:

    1. Generate a bcrypt hash:
       ```
       docker compose run --rm dex dex hash-password
       # Interactive prompt — enter the new password twice.
       # Output: $2a$10$... — copy this entire string including the $2a$10$ prefix.
       ```
       If stdin is not a TTY, fall back to: `docker run --rm -it ghcr.io/dexidp/dex:v2.43.0 dex hash-password`.

    2. Generate a stable UUID (NEW users only — existing users keep their UUID forever, per D-05 / Pitfall 4):
       ```
       uuidgen | tr 'A-Z' 'a-z'
       # macOS / Linux. Windows: powershell -Command "[guid]::NewGuid()"
       ```

    3. Edit `dex/config.yaml`. Under `staticPasswords:`, append a new entry (or REPLACE the `hash:` line for an existing user — keep the `userID:` unchanged for rotations):
       ```yaml
       - email: "newuser@acm.local"
         hash: '$2a$10$...paste hash from step 1...'
         username: "newuser"
         userID: "...paste uuid from step 2..."
       ```
       Use SINGLE quotes around `hash:` so the literal `$` characters are not interpreted by Dex's `$VAR` substitution.

    4. Restart Dex (~ 2 s):
       ```
       docker compose restart dex
       docker compose ps dex   # back to healthy
       ```

    5. Verify the new user can log in by repeating Section 1 step 5 with the new email.

    6. **Removing a user:** Delete the entry from `dex/config.yaml` and `docker compose restart dex`. Existing refresh tokens for that user become invalid on next use (Dex can't find a matching staticPassword entry). For immediate revocation, `docker compose down dex && docker volume rm <project>_dex_data && docker compose up -d dex` — this also wipes ALL sessions for ALL users (D-16, the nuclear option).

    SECTION 3 — "## Dex storage and persistence":

    - SQLite database at `/data/dex.db` inside the container, backed by the `dex_data` named Docker volume (D-18).
    - Survives `docker compose restart dex` and `docker compose down`. WIPED by `docker compose down -v`.
    - To inspect: `docker compose exec dex sh -c 'ls -la /data/'`.
    - To back up: `docker run --rm -v <project>_dex_data:/data -v "$PWD":/backup alpine tar czf /backup/dex_data.tgz /data` (Phase v2.x has a real backup story; for v1.11, manual snapshot is sufficient — admin runbook in Phase 31 covers automation).

    SECTION 4 — "## Known limitations":

    - No RP-initiated logout — Dex does not expose `end_session_endpoint` (Pitfall 7, GitHub issue dexidp/dex#1697). Mitigation: 1h ID token TTL (D-07) bounds session sprawl. Per-app logout works (clears the app cookie); cross-app SSO logout does not.
    - Hot-reload requires `docker compose restart dex` (no file-watcher). Restart is < 2 s.
    - Stable `userID` is permanent — never regenerate for an existing user (Pitfall 4, breaks all stored `sub` references in downstream apps).

    Match the existing `docs/setup.md` heading depth (use `##` for top-level sections, `###` for sub-sections, fenced code blocks with language hints `bash` and `yaml`).

    If `27-02-SUMMARY.md` exists at execution time, copy the EXACT NPM Advanced block from there into Section 1 step 3 (it should already match the block above — this is a sanity check, not a re-derivation).
  </action>
  <verify>
    <automated>
      grep -q '## Dex first-login' docs/setup.md &&
      grep -q '## Add or rotate a Dex user' docs/setup.md &&
      grep -q '## Dex storage and persistence' docs/setup.md &&
      grep -q '## Known limitations' docs/setup.md &&
      grep -q 'dex hash-password' docs/setup.md &&
      grep -q 'uuidgen' docs/setup.md &&
      grep -q 'openssl rand -hex 32' docs/setup.md &&
      grep -q 'X-Forwarded-Proto https' docs/setup.md &&
      grep -q 'docker compose restart dex' docs/setup.md &&
      grep -q 'dex_data' docs/setup.md &&
      grep -q 'end_session_endpoint' docs/setup.md &&
      grep -q 'auth.internal/dex/.well-known/openid-configuration' docs/setup.md &&
      grep -q 'admin@acm.local' docs/setup.md &&
      grep -q 'ROTATION' docs/setup.md &&
      echo OK
    </automated>
  </verify>
  <acceptance_criteria>
    - All four new sections present as `##` headings.
    - Bcrypt-hash command literally documented as `dex hash-password`.
    - NPM Advanced block with `X-Forwarded-Proto https` literally present.
    - Add-a-user workflow lists all four steps: hash-password → uuidgen → edit config → restart.
    - Secret-rotation requirement for the placeholder passwords explicitly noted.
    - `dex_data` volume + `down -v` warning + restart-survival behavior documented.
    - `end_session_endpoint` limitation called out so future contributors do not try to implement RP-initiated cross-app logout.
    - Existing `docs/setup.md` content intact (NPM bootstrap section, hostnames section, etc., still grep-findable).
  </acceptance_criteria>
  <done>
    `docs/setup.md` is the single-source operator runbook for Dex: how to bring it up, how to add users, how to rotate secrets, how persistence works, what doesn't work and why.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add one-line Dex pointer to README.md Quickstart</name>
  <files>README.md</files>
  <read_first>
    - README.md (find the existing Quickstart section that Phase 26 added)
    - .planning/phases/26-npm-hostnames/26-03-SUMMARY.md (if available — confirms README structure)
  </read_first>
  <action>
    Locate the Quickstart section in `README.md` (Phase 26 added it; it documents `docker compose up --build` and the three hostnames). Append exactly ONE line at the end of that section, before the next `##` heading:

    ```
    - **Dex IdP**: identity provider at `https://auth.internal/dex`. First-login + add-user workflow → see `docs/setup.md` "Dex first-login".
    ```

    Do NOT modify any other line in `README.md`. Do NOT add a Dex code block to README — the depth lives in `docs/setup.md` (DRY).

    If the Quickstart section already references Dex (e.g. someone ran a previous version of this plan), make this task a no-op: confirm the line exists and skip.
  </action>
  <verify>
    <automated>
      grep -q 'Dex IdP' README.md &&
      grep -q 'auth.internal/dex' README.md &&
      grep -q 'docs/setup.md' README.md &&
      echo OK
    </automated>
  </verify>
  <acceptance_criteria>
    - `README.md` Quickstart section contains a single Dex bullet pointing to `https://auth.internal/dex` and to `docs/setup.md`.
    - No other README content modified.
  </acceptance_criteria>
  <done>
    A reader landing on README sees Dex exists and knows where to find the operator runbook.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. `docs/setup.md` contains the four new sections and all required commands.
2. `README.md` Quickstart has a Dex pointer.
3. The runbook stands alone — a fresh operator can follow it without reading any planning artifact:
   ```
   grep -c '^## ' docs/setup.md   # count of top-level sections increased by ≥4
   ```
</verification>

<success_criteria>
- DEX-04 (documentation half): "bcrypt hash workflow for adding new users is documented in the repo" — satisfied by the "## Add or rotate a Dex user" section.
- DEX-01 (operator-runbook half): the operator steps for first-time bring-up of Dex (including the NPM proxy-host edit) are captured so the next clean-VM deploy can follow them without reading the planning artifacts. Phase 31's E2E-01 ("fresh `docker compose up --build` on a clean VM produces a working stack") inherits this runbook directly.
</success_criteria>

<output>
After completion, create `.planning/phases/27-dex-idp-setup/27-03-SUMMARY.md` listing:
  - The four new section headings added to `docs/setup.md`.
  - The line added to `README.md` Quickstart.
  - One-line "Phase 27 documentation closed; ready for /gsd:verify-phase" handoff.
</output>
