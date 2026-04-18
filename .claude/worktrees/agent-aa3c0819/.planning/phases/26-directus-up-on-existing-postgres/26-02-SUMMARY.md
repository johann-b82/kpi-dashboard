---
phase: 26
plan: 02
subsystem: infrastructure
tags: [directus, snapshot, roles, docker-compose, v1.11]
requirements: [CFG-01]
requires: [directus service (26-01), directus_roles + directus_permissions tables]
provides: [reproducible Admin + Viewer role config, directus-snapshot sidecar]
affects: [docker-compose.yml, directus/snapshot.yml]
tech_added: []
patterns:
  - one-shot sidecar via image reuse + entrypoint override
  - depends_on service_healthy for schema-apply ordering
  - fixed UUIDs in declarative config for cross-machine determinism
key_files_created:
  - directus/snapshot.yml
key_files_modified:
  - docker-compose.yml
decisions:
  - Fixed UUIDs for both roles (a1111111... / a2222222...) — Directus resolves by ID; name-only would duplicate on re-apply
  - Sidecar pattern chosen over `docker compose run` (no manual step per INFRA-01) and over entrypoint-wrap (cleaner separation of bootstrap vs long-running app)
  - Reuse directus/directus:11.17.2 image rather than adding a CLI-only image — guarantees CLI version parity
metrics:
  duration: ~2min
  completed: 2026-04-15
---

# Phase 26 Plan 02: Snapshot Roles and Apply — Summary

Committed `directus/snapshot.yml` as the source of truth for the two-role config (Admin full-access; Viewer read-own) with fixed UUIDs for determinism, and added a `directus-snapshot` sidecar service to `docker-compose.yml` that runs `npx directus schema apply --yes` after `directus` becomes healthy, exits 0, and is idempotent on re-runs.

## What was built

- **directus/snapshot.yml:** new 42-line YAML declaring `version: 1`, `directus: 11.17.2`, `vendor: postgres`, empty `collections`/`fields`/`relations`, and two `roles` with fixed UUIDs (`a1111111-...` Admin; `a2222222-...` Viewer). Viewer gets one read permission on `directus_users` filtered by `id _eq $CURRENT_USER` across 6 fields.
- **docker-compose.yml:** 6th service `directus-snapshot` appended after the `directus` block. Reuses `directus/directus:11.17.2`, shares DB env vars, mounts `./directus:/directus-snapshot:ro`, depends on `directus: service_healthy`, overrides entrypoint to `/bin/sh -c` running `npx directus schema apply --yes /directus-snapshot/snapshot.yml`, `restart: "no"`.

## Verification

- `test -f directus/snapshot.yml` — PASS; contains both fixed UUIDs, `name: Admin`, `name: Viewer`.
- `docker compose config` (with placeholder env) — PASS; output includes `directus-snapshot` service, command `npx directus schema apply --yes /directus-snapshot/snapshot.yml`, target mount `/directus-snapshot`.
- End-to-end smoke run (docker compose up → apply → idempotent re-run) deferred to Plan 03 which owns bring-up verification.

## Deviations from Plan

None. Plan executed exactly as written. No Rule 1/2/3 auto-fixes.

## Commits

- `953b72d` feat(26-02): add directus snapshot.yml with Admin and Viewer roles
- `30a42c3` feat(26-02): add directus-snapshot sidecar service

## Follow-on

- Plan 03: bring-up verification (`docker compose up -d` end-to-end, first-Admin sign-in, both roles visible in admin UI, idempotency check on second `up`).

## Self-Check: PASSED

- directus/snapshot.yml: FOUND
- docker-compose.yml modified (directus-snapshot present): FOUND
- Commit 953b72d: FOUND
- Commit 30a42c3: FOUND
