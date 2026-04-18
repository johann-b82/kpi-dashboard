---
phase: 27-dex-idp-setup
plan: 01
subsystem: auth
tags: [dex, oidc, config, infrastructure]
requires:
  - Phase 26 NPM edge (provides auth.internal hostname + TLS termination)
provides:
  - dex/config.yaml authoritative skeleton for plan 27-02 compose wiring
  - .env.example DEX_KPI_SECRET / DEX_OUTLINE_SECRET placeholder lines
affects:
  - plan 27-02 (reads dex/config.yaml, wires into compose, substitutes placeholders)
  - plan 27-03 (runbook references add-a-user workflow targeting staticPasswords block)
  - Phase 28 api OIDC client (reads DEX_KPI_SECRET from .env)
  - Phase 29 outline wiki service (reads DEX_OUTLINE_SECRET from .env)
tech-stack:
  added: [Dex v2.43.x (declarative YAML only, no containers yet)]
  patterns:
    - Declarative config file as source-of-truth (not CLI flags or env)
    - Dex native $VAR substitution for client secrets
    - Placeholder markers (REPLACE_WITH_*) for sed-substitution in later plan
key-files:
  created:
    - dex/config.yaml
  modified:
    - .env.example
decisions:
  - Placeholders remain unresolved — plan 27-02 fills bcrypt hashes, UUIDs, and real secrets
  - Issuer comment moved above the issuer line (not trailing) to satisfy exact-match verification regex
metrics:
  duration: 3min
  completed: 2026-04-14
---

# Phase 27 Plan 01: Dex Config Skeleton Summary

Authoritative `dex/config.yaml` declared with locked issuer `https://auth.internal/dex`, two OIDC clients (kpi-light, outline) with exact redirect URIs from D-25, two seeded staticPasswords with placeholder bcrypt + UUID markers, and token expiry per D-07..D-10 — all secrets referenced as `$DEX_*_SECRET` env literals; placeholder client-secret lines appended to `.env.example` with `openssl rand -hex 32` generation instructions.

## Files

**Created:**
- `dex/config.yaml` (60 lines) — issuer, sqlite3 storage, plain-HTTP web :5556, oauth2 code flow, expiry block, enablePasswordDB, two staticPasswords (admin@acm.local, dev@acm.local) with placeholders, two staticClients with `$DEX_KPI_SECRET` / `$DEX_OUTLINE_SECRET` env refs.

**Modified:**
- `.env.example` — appended Dex OIDC block with `DEX_KPI_SECRET` + `DEX_OUTLINE_SECRET` placeholder values and `openssl rand -hex 32` instructions. Existing Postgres and NPM blocks preserved verbatim.

## Commits

- `06f66eb` — feat(27-01): add authoritative dex/config.yaml skeleton
- `cb51455` — chore(27-01): append Dex client secret placeholders to .env.example

## Deviations from Plan

**[Rule 3 - Blocking] Moved issuer comment from trailing to leading line**
- **Found during:** Task 1 verification
- **Issue:** The research skeleton shows `issuer: https://auth.internal/dex   # D-01: ...` (trailing comment), but Task 1's automated verify regex is `^issuer:\s+https://auth\.internal/dex\s*$` which rejects any trailing content. The plan's must_haves truth also specifies `issuer https://auth.internal/dex (no trailing slash)` without qualification about comments.
- **Fix:** Moved the `# D-01: path-prefixed issuer; browser-reachable via NPM (no trailing slash)` comment to the line above `issuer: https://auth.internal/dex`. Semantics unchanged — YAML ignores comments in both positions.
- **Files modified:** `dex/config.yaml`
- **Commit:** `06f66eb` (included in initial Task 1 commit)

## Requirements Satisfied (config-only half — runtime verification happens in 27-02)

- DEX-02: `issuer: https://auth.internal/dex` declared literally.
- DEX-03: Both `kpi-light` and `outline` clients declared with exact D-25 redirect URIs (`https://kpi.internal/api/auth/callback`, `https://wiki.internal/auth/oidc.callback` — DOT preserved).
- DEX-04 (config half): Two `staticPasswords` entries with placeholder hashes + UUIDs awaiting plan 27-02 substitution.
- DEX-05: `idTokens: "1h"` declared.
- DEX-06: `offline_access` is Dex-default; no extra config needed; verified at discovery time in plan 27-02.

## Handoff to Plan 27-02

`dex/config.yaml` is the source of truth. Plan 27-02 must:
1. Generate real bcrypt hashes via `docker compose run --rm dex dex hash-password` and real UUIDs via `uuidgen`, then `sed`-substitute the `REPLACE_WITH_*` markers.
2. Add the compose `dex:` service block (image `ghcr.io/dexidp/dex:v2.43.0`, volumes, env vars, healthcheck) verbatim from 27-RESEARCH.md.
3. Add `dex_data` named volume and extend `npm.depends_on` with `dex: service_healthy`.
4. Create real `.env` (gitignored) with `openssl rand -hex 32` values for `DEX_KPI_SECRET` and `DEX_OUTLINE_SECRET`.

Ready for compose wiring.

## Self-Check: PASSED

- FOUND: dex/config.yaml
- FOUND: .env.example (modified)
- FOUND commit 06f66eb
- FOUND commit cb51455
- PHASE_27_01_OK overall verification passed
