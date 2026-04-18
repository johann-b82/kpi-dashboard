---
phase: 30-bring-up-docs-backup
plan: "02"
subsystem: documentation
tags: [docs, setup, directus, backup, restore, operator-tutorial]
requires:
  - .env.example (secret-generation commands + post-boot UUID recipe)
  - docker-compose.yml (service names + TZ value)
  - scripts/restore.sh (from Plan 01)
  - backup sidecar (from Plan 01)
provides:
  - docs/setup.md — linear tutorial from clone to running stack + first Admin + Viewer→Admin promote + backup/restore ops
affects:
  - docs/setup.md (new file)
tech-stack:
  added: []
  patterns:
    - "Linear top-to-bottom operator tutorial (no reference-style shuffling, per D-07)"
    - "Text-only click-path for Directus UI (per D-08)"
key-files:
  created:
    - docs/setup.md
    - .planning/phases/30-bring-up-docs-backup/30-02-SUMMARY.md
  modified: []
decisions:
  - Kept frontend port as 5173 (Vite default from docker-compose.yml) rather than 3000 — matches actual compose config
  - Fetched Administrator UUID recipe copied verbatim from .env.example comment so there is exactly one canonical source
  - Added extra troubleshooting entry for 401 on /auth/login when fetching role UUID (common first-time slip)
metrics:
  duration: ~3min
  completed: 2026-04-15
---

# Phase 30 Plan 02: Setup Docs Summary

Authored `docs/setup.md` — a single linear tutorial that takes a first-time operator from a clean machine to a running KPI Light stack, a bootstrapped first admin, the click-path for promoting a Viewer to Admin in the Directus UI, and operation of the nightly backup / one-command restore flow shipped in Plan 01. Closes DOCS-01, DOCS-02, and the documentation half of DOCS-03.

## What Was Built

- **`docs/setup.md`** — 196 lines, seven top-level sections in the exact order locked by D-07: Prerequisites → Bring-up → First Admin → Promote Viewer to Admin → Backups → Restore → Troubleshooting.
- **Verbatim secret-generation snippets** (`openssl rand -base64 32` for KEY/SECRET, `openssl rand -base64 24` for admin password) matching `.env.example` exactly.
- **Nine numbered Bring-up steps** covering the two-phase `up -d` pattern (partial `db directus` bring-up → fetch Administrator role UUID → full `up -d`), which is the non-obvious path the existing `.env.example` comment already assumes.
- **Directus Viewer→Admin promote click-path** as seven text-only numbered steps (D-08), anchored on "User Directory" wording for grep-based verification.
- **Backups section** documenting 02:00 Europe/Berlin schedule, `kpi-YYYY-MM-DD.sql.gz` filename, 14-day retention, and manual-trigger command — all consistent with Plan 01's sidecar.
- **Restore section** using `./scripts/restore.sh backups/kpi-2026-04-15.sql.gz` — the exact filename format produced and verified in Plan 01 (`30-01-SUMMARY.md`).
- **Troubleshooting** covering six failure modes: first-boot bootstrap immutability (Pitfall 5), `down -v` data loss (Pitfall 6), `./backups/` permission mismatch (Pitfall 7), TZ drift (Pitfall 1), Directus healthcheck hang on missing secrets, restore failures before stack is up, plus a locally-surfaced addition for `/auth/login` 401 during UUID fetch.

## Tasks Completed

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | Author docs/setup.md linear tutorial | `b477184` | `docs/setup.md` |

## Acceptance Criteria

- [x] `docs/setup.md` exists, 196 lines (≥120 required)
- [x] All seven section headers present in the mandated order
- [x] Contains verbatim `openssl rand -base64 32` and `openssl rand -base64 24`
- [x] Contains `./scripts/restore.sh` example with a `.sql.gz` filename
- [x] Contains `docker compose up -d` (v2 syntax only; 0 occurrences of legacy hyphenated `docker-compose ` form)
- [x] Contains `User Directory` (Directus UI click-path anchor)
- [x] Troubleshooting calls out `down -v` data-loss risk
- [x] References `02:00` backup schedule and `14`-day retention
- [x] Restore command byte-for-byte matches Plan 01 output (`kpi-2026-04-15.sql.gz`)

## Deviations from Plan

**Section-order deviation:** none — sections are in the exact order locked by D-07.

**Content additions beyond the baseline plan:**

1. **[Rule 2 — Missing critical troubleshooting]** Added a "`curl ... /auth/login` returns 401" entry to Troubleshooting. This is a direct consequence of step 6 of Bring-up (the UUID fetch) and is the most likely first-time stumble when `.env` values were mistyped. Not listed in RESEARCH Pitfalls, but operationally inevitable.
2. **Frontend port documented as 5173, not 3000.** The plan action text mentioned `localhost:3000` as an example; `docker-compose.yml` actually exposes the Vite dev server on `5173`. Used the real value to keep copy-paste steps working — treated as Rule 1 (would have been a bug in the doc otherwise).

No architectural changes. No CLAUDE.md conflicts.

## Known Stubs

None — this is pure documentation; all referenced commands, files, and services exist and were exercised in Plan 01.

## Self-Check: PASSED

- FOUND: `docs/setup.md` (196 lines)
- FOUND: commit `b477184` — docs(30-02): author setup.md linear tutorial
- FOUND: seven section headers (`## Prerequisites`, `## Bring-up`, `## First Admin (verify bootstrap)`, `## Promote Viewer to Admin`, `## Backups`, `## Restore`, `## Troubleshooting`)
- FOUND: `openssl rand -base64 32` and `openssl rand -base64 24` verbatim
- FOUND: `./scripts/restore.sh backups/kpi-2026-04-15.sql.gz`
- FOUND: `docker compose up -d` (v2 syntax)
- VERIFIED: 0 occurrences of legacy `docker-compose ` (hyphenated v1 CLI)
- FOUND: `User Directory` click-path anchor
- FOUND: `down -v` warning
- FOUND: `02:00` schedule, `14` day retention
