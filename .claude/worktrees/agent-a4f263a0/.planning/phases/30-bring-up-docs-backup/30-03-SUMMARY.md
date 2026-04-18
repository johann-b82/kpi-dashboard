---
phase: 30-bring-up-docs-backup
plan: 03
subsystem: docs
tags: [readme, version-history, docs-04, directus-pivot]
requires: [30-01]
provides: [v1.11-directus version-history entry in README.md]
affects: [README.md]
tech-stack:
  added: []
  patterns: [markdown <details> narrative block + summary table row for version history]
key-files:
  created:
    - .planning/phases/30-bring-up-docs-backup/30-03-SUMMARY.md
  modified:
    - README.md
decisions:
  - "Honored D-09 (<details> block) AND preserved README's existing version-table convention by adding BOTH — resolves research-flagged discrepancy"
metrics:
  duration: "2min"
  completed: 2026-04-15
---

# Phase 30 Plan 03: README Version Entry Summary

Added v1.11-directus version-history entry to README.md as a collapsible `<details>` narrative block plus a matching summary row at the top of the existing version table, satisfying DOCS-04 and honoring D-09 while preserving the past-version table convention.

## What Was Done

**README.md edit location:**
- `<details>` narrative block inserted at lines 227–251 (between `## Version History` heading and the version table).
- New table row inserted at line 255 (first data row, above v1.10).
- `git diff --stat`: `README.md | 27 +++++++++++++++++++++++++++` — **27 insertions, 0 deletions, 0 modifications** to any pre-existing content.

**Narrative block covers all four required topics:**
- Directus 11 added (single container, two roles, JWT HS256 verification in FastAPI)
- Dex + oauth2-proxy + NPM auth_request abandoned (three moving parts; archived on `archive/v1.12-phase32-abandoned`)
- Supabase rejected (5-service stack vs Directus single container)
- Outline wiki dropped (Dex-shared-SSO use case disappeared)
- Plus: nightly `pg_dump` backup sidecar, `docs/setup.md`, user impact (login, hidden admin-only controls, Directus admin UI at :8055)

**Table row:**
```
| v1.11-directus | 2026-04-15 | Auth + RBAC via self-hosted Directus; nightly pg_dump backups; Outline wiki and Dex/oauth2-proxy path dropped |
```

## Verification

Automated acceptance check (from PLAN.md `<verify>`):
- `v1.11-directus` present in README: PASS
- `<details>` block present: PASS
- `<summary><strong>v1.11-directus</strong>` present: PASS
- `| v1.11-directus | 2026-04-15 |` row present: PASS
- Mentions Dex / Supabase / Outline / nightly pg_dump: PASS
- `^| v1\.` row count: **12** (≥ 11 required — 11 prior rows v1.10→v1.0 preserved + 1 new)
- No duplicate `| Version | Date | Description |` header introduced: confirmed (single header remains at line 253)

Commit: `35d588e` — `docs(30-03): add v1.11-directus version-history entry`

## Deviations from Plan

None — plan executed exactly as written.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add v1.11-directus entry to README.md (details block + table row) | 35d588e | README.md |

## Self-Check: PASSED

- README.md modifications verified via grep (all acceptance criteria met)
- Commit 35d588e exists in `git log`
- No pre-existing rows modified (diff is pure insertion)
