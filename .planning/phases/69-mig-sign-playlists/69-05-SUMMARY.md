---
phase: 69-mig-sign-playlists
plan: 05
subsystem: ci
tags: [ci, guard, mig-sign, regression-block, playlists]
requirements: [MIG-SIGN-03]
dependency-graph:
  requires: [69-01, 69-02]
  provides: [pre-stack regression block for migrated playlist routes (POST/GET/PATCH on root + by-id, PUT on /{id}/tags)]
  affects: [.github/workflows/ci.yml]
tech-stack:
  added: []
  patterns: [pre-stack grep guard with method-anchored regex (Phase 66/67/68 pattern, extended to discriminate on HTTP verb)]
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
decisions:
  - Three complementary greps instead of one — (a) literal path string, (b) POST/GET/PATCH decorator scoped to surviving file `playlists.py`, (c) `/tags` PUT scoped to `playlists.py` + `playlist_items.py` only (NOT devices.py).
  - Rule 1 deviation from plan-as-written — plan's third grep (`backend/app/routers/signage_admin/`) would false-positive on the surviving `@router.put("/{device_id}/tags")` in `devices.py` (Phase 70 device-tags surface). Scoped the third grep to the two playlist files to fix.
  - `_notify_playlist_changed` intentionally not guarded (D-04b — surviving DELETE + bulk-PUT still depend on it).
metrics:
  duration: 78s
  completed: 2026-04-25
---

# Phase 69 Plan 05: CI Grep Guard Summary

**One-liner:** Pre-stack CI guard blocks regression of the migrated playlist routes (POST/GET/PATCH on root + by-id, PUT on `/{id}/tags`) via three complementary greps on `backend/app/`, while explicitly allowing the surviving DELETE on `/{playlist_id}`, bulk-PUT on `/{playlist_id}/items`, and the unrelated Phase 70 device-tags PUT on `/{device_id}/tags`.

## Tasks

| Task | Name                                                              | Commit  | Files                      |
| ---- | ----------------------------------------------------------------- | ------- | -------------------------- |
| 1    | Add method-anchored CI grep guard for migrated playlist routes    | 591d0e5 | `.github/workflows/ci.yml` |

## Implementation Details

### Regexes Used

**(a) Literal path string check** — block reappearance of `"/api/signage/playlists"` literal under `backend/app/`:

```
"/api/signage/playlists"|"/api/signage/playlists/
```

Rationale: catches accidental client-style URL hardcodes, comments, docstrings, or modules that re-introduce the literal. The surviving DELETE + bulk-PUT decorators use the relative `"/{playlist_id}"` form on the sub-router and DO NOT contain this literal — so this check has zero false-positives on the survivors.

**(b) POST/GET/PATCH decorator check** — scoped to `backend/app/routers/signage_admin/playlists.py`:

```
@router\.(post|get|patch)\b
```

Rationale: the surviving file's only decorator is `@router.delete("/{playlist_id}", status_code=204)` (line 79). The `(post|get|patch)` alternation cannot match `delete`. Reintroducing root POST, root GET, by-id GET, or by-id PATCH on this file lights up.

**(c) `/tags` PUT discriminator** — scoped to `playlists.py` + `playlist_items.py` only:

```
@router\.put\b[^@]*"/?\{[^}]+\}/tags"?
```

Rationale: the surviving bulk-PUT in `playlist_items.py` is on `"/{playlist_id}/items"` — the `/tags` suffix in the regex is the precise discriminator. Scoping to `playlists.py` + `playlist_items.py` (and explicitly NOT `devices.py`) is required because `devices.py:167` has `@router.put("/{device_id}/tags")` — the Phase 70 device-tags surface, which is allowed.

### False-positive Probes (Survivors Must Pass)

Verified locally on the post-Plan-69-01/02/03 tree:

| Survivor                                                          | Probe Outcome                          |
| ----------------------------------------------------------------- | -------------------------------------- |
| `playlists.py:79` `@router.delete("/{playlist_id}", ...)`          | (b) does not match (delete excluded)   |
| `playlist_items.py:50` `@router.put("/{playlist_id}/items", ...)`  | (c) does not match (`/items` ≠ `/tags`) |
| `devices.py:167` `@router.put("/{device_id}/tags")`                | (c) does not match (file out of scope) |

Plus full clean-tree run: all three greps exit 1 / 2 (no match) — guard currently passes on `main`.

### Sentinel Injection Probes (Block-Clauses Must Catch)

Each block-clause was probed with a temporary sentinel + revert:

| Sentinel injected                                                                | Caught by | Result            |
| -------------------------------------------------------------------------------- | --------- | ----------------- |
| `TEST_A_LITERAL = "/api/signage/playlists"` in `playlists.py`                    | (a)       | grep exit 0 (match) |
| `@router.post("")` in `playlists.py`                                              | (b)       | grep exit 0 (match) |
| `@router.put("/{playlist_id}/tags")` in `playlist_items.py`                       | (c)       | grep exit 0 (match) |

Tree reverted via `git checkout` after each probe; final clean-tree re-check confirmed all three greps exit non-zero before commit.

### `_notify_playlist_changed` — Intentionally Not Guarded (D-04b)

The plan explicitly DOES NOT add a regex against the `_notify_playlist_changed` helper because the surviving `@router.delete("/{playlist_id}")` and `@router.put("/{playlist_id}/items")` still call it (to broadcast `playlist-changed` SSE on bulk-replace + delete). Guarding the helper would break the survivors and is inverted from the actual goal: we want the helper to live, not die.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Third grep scope was too broad in plan-as-written**
- **Found during:** Task 1, while running the false-positive probes on the survivor list.
- **Issue:** Plan's task body specified `grep -rnE '@router\.put\b[^@]*"/?\{[^}]+\}/tags"?' backend/app/routers/signage_admin/` — a directory-wide scope. But `backend/app/routers/signage_admin/devices.py:167` has the surviving Phase 70 device-tags route `@router.put("/{device_id}/tags")`, which would match this regex and trip the guard on every CI run.
- **Fix:** Scoped the third grep to two explicit files — `playlists.py` and `playlist_items.py`. This is sufficient (any reintroduction of playlist `/tags` PUT would land in one of those two files) and keeps the Phase 70 device-tags route out of scope.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** 591d0e5

The plan author flagged a related concern in `<interfaces>` (note about path-string false-positives) but didn't catch this specific verb+path collision. The regex is now correct; the plan's intent is preserved (block the migrated playlist `/tags` PUT) while the surviving device `/tags` PUT remains allowed.

## Verification

| Check                                                              | Result |
| ------------------------------------------------------------------ | ------ |
| `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` | exit 0 |
| `grep -n "Guard — no migrated playlist routes in backend (MIG-SIGN-03)" .github/workflows/ci.yml` | exit 0 (line 133) |
| (a) literal-path probe on clean tree                                | exit 1 (no match) |
| (b) POST/GET/PATCH probe on `playlists.py`                          | exit 1 (no match) |
| (c) `/tags` PUT probe on `playlists.py` + `playlist_items.py`        | exit 1 (no match) |
| Sentinel A injection                                                | flips (a) to exit 0 |
| Sentinel B injection                                                | flips (b) to exit 0 |
| Sentinel C injection                                                | flips (c) to exit 0 |
| Surviving DELETE in `playlists.py:79`                               | does not trigger any block clause |
| Surviving bulk-PUT items in `playlist_items.py:50`                  | does not trigger any block clause |
| Surviving devices-tags PUT in `devices.py:167`                      | does not trigger any block clause |

## Self-Check: PASSED

- Modified file `.github/workflows/ci.yml` exists.
- Commit `591d0e5` exists in `git log`.
- All probes recorded in this Summary were executed against the working tree.
