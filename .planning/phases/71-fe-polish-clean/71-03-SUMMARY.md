---
phase: 71-fe-polish-clean
plan: 03
subsystem: frontend / contract-tests
tags: [vitest, snapshot, contracts, fe-adapter, directus-sdk, FE-05]
requires:
  - signageApi adapter functions (Phase 67/68/69/70 migrations)
  - directusClient + apiClient transport seams
provides:
  - 10 frozen wire-shape fixtures for migrated GET endpoints
  - Single vitest suite that fails CI on FE adapter contract drift
  - UPDATE_SNAPSHOTS=1 regen flow with reviewer convention
affects:
  - frontend/src/tests/contracts/ (new dir)
tech-stack:
  added: []
  patterns:
    - "Pattern 1 (71-RESEARCH): mock transport (directus.request / apiClient), call adapter, deep-equal vs JSON fixture"
    - "Composite-read mocking via mockResolvedValueOnce queue ordering (Pitfall 4)"
key-files:
  created:
    - frontend/src/tests/contracts/adapter.contract.test.ts
    - frontend/src/tests/contracts/readMe_minimal.json
    - frontend/src/tests/contracts/readMe_full.json
    - frontend/src/tests/contracts/sales_records.json
    - frontend/src/tests/contracts/personio_employees.json
    - frontend/src/tests/contracts/signage_device_tags.json
    - frontend/src/tests/contracts/signage_schedules.json
    - frontend/src/tests/contracts/signage_playlists.json
    - frontend/src/tests/contracts/signage_playlist_items_per_playlist.json
    - frontend/src/tests/contracts/signage_devices.json
    - frontend/src/tests/contracts/resolved_per_device.json
  modified: []
decisions:
  - "Used import.meta.url + fileURLToPath to resolve FIXTURES_DIR (vitest runs ESM; __dirname is undefined in the suite's module scope)"
  - "readMe fixtures call directus.request(readMe(...)) directly rather than importing AuthContext / useCurrentUserProfile — those carry React + queryClient deps and are exercised in their own page-level tests; the contract here is the wire-shape returned by Directus, which is what we lock"
  - "fetchEmployees fixture deliberately captures the zero-fill compute fields (total_hours/overtime_hours/overtime_ratio) — the merge-with-overtime hook is a separate consumer; the adapter contract is the row shape it emits before merge"
metrics:
  duration: 90s
  completed: 2026-04-25
  tasks: 1
  files: 11
---

# Phase 71 Plan 03: Adapter Contract Snapshot Tests Summary

Lock the FE adapter wire shape for every migrated GET endpoint with a single vitest suite + 10 deterministic JSON fixtures, regenerable via `UPDATE_SNAPSHOTS=1`.

## What Was Built

A new vitest suite `frontend/src/tests/contracts/adapter.contract.test.ts` (~330 LOC) covering 10 cases — one per migrated GET endpoint per Open Question 3 in 71-RESEARCH.md. Each test mocks the underlying transport (`directus.request` for Directus SDK reads, `apiClient` for the lone FastAPI compute endpoint), invokes the FE adapter function, and deep-equals the result against a checked-in JSON fixture. The fixture is bootstrapped on first run (or on `UPDATE_SNAPSHOTS=1`) and asserted against on every subsequent run.

Coverage:

| # | Endpoint                              | Adapter                              | Transport mocked      |
| - | ------------------------------------- | ------------------------------------ | --------------------- |
| 1 | readMe_minimal                        | AuthContext readMe call              | directus.request      |
| 2 | readMe_full                           | useCurrentUserProfile readMe call    | directus.request      |
| 3 | sales_records                         | fetchSalesRecords                    | directus.request      |
| 4 | personio_employees                    | fetchEmployees                       | directus.request      |
| 5 | signage_device_tags                   | signageApi.listTags                  | directus.request      |
| 6 | signage_schedules                     | signageApi.listSchedules             | directus.request      |
| 7 | signage_playlists                     | signageApi.listPlaylists (composite) | directus.request (x2) |
| 8 | signage_playlist_items_per_playlist   | signageApi.listPlaylistItems         | directus.request      |
| 9 | signage_devices                       | signageApi.listDevices               | directus.request      |
| 10 | resolved_per_device                  | signageApi.getResolvedForDevice      | apiClient             |

Composite read (listPlaylists, Pitfall 4) is handled by chaining two `mockResolvedValueOnce` calls in the call order fixed by the adapter (`Promise.all` with playlists first, tag-map second).

## Verification

- `npx vitest run src/tests/contracts/adapter.contract.test.ts` — 10/10 tests pass in ~0.7s.
- All 10 fixtures are non-empty (smallest 100 bytes, largest 664 bytes; total 4 224 bytes).
- Re-running with `UPDATE_SNAPSHOTS=1` produces zero git diff (idempotent — adapter output is deterministic for the canned inputs).
- Spot-check `signage_playlists.json` confirms the composite read merged tag-map rows into `tag_ids` correctly: playlist 1 -> `[1, 2]`, playlist 2 -> `[2]`.
- Spot-check `personio_employees.json` confirms the zero-fill of `total_hours`, `overtime_hours`, `overtime_ratio` per the `fetchEmployees` adapter.

## Deviations from Plan

None — plan executed exactly as written. Two minor implementation notes (not deviations):

- The plan's `__dirname` reference is undefined in vitest's ESM module scope; resolved via `path.dirname(fileURLToPath(import.meta.url))`.
- The `apiClient` mock had to also export `setAccessToken`, `setAuthFailureHandler`, and `trySilentRefresh` (used by AuthContext at module-load time) so the import graph resolves cleanly.

## Decisions Made

- **readMe fixtures call `directus.request(readMe(...))` directly** rather than importing AuthContext/useCurrentUserProfile. The contract being locked is the Directus wire shape (FE-05); the AuthContext/profile-hook glue is exercised by their own page-level tests. This keeps the contract suite a pure transport-shape lock and avoids dragging React + queryClient + DOM deps into a node-friendly snapshot suite.
- **fetchEmployees fixture captures the zero-fill compute fields.** The adapter contract is the shape returned to its direct consumers, which includes the zero-filled overtime fields. The merge-with-overtime hook is a separate consumer with its own data source.

## Self-Check: PASSED

- File `frontend/src/tests/contracts/adapter.contract.test.ts` — FOUND
- All 10 fixture JSON files — FOUND, all non-empty (>50 bytes)
- Commit `e2c3067` — FOUND on main
- `npx vitest run src/tests/contracts/adapter.contract.test.ts` — 10/10 passing
