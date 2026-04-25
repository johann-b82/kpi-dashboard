---
phase: 68-mig-sign-tags-schedules
plan: 07
subsystem: ci
tags: [ci, guard, mig-sign, regression-block]
requirements: [MIG-SIGN-01, MIG-SIGN-02]
dependency-graph:
  requires: [68-01, 68-03]
  provides: [pre-stack regression block for /api/signage/tags + /api/signage/schedules]
  affects: [.github/workflows/ci.yml]
tech-stack:
  added: []
  patterns: [pre-stack grep guard (Phase 66/67 pattern)]
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
decisions:
  - Anchored regex (literal-quote and literal-quote-slash) instead of broad pattern — guarantees Phase 69/70 nested tag-map paths (/api/signage/playlists/{id}/tags, /api/signage/devices/{id}/tags) are NOT false-positive matches.
  - Single guard step covers both prefixes via grep -E alternation; mirrors Phase 67 step style.
metrics:
  duration: 38s
  completed: 2026-04-25
---

# Phase 68 Plan 07: CI Grep Guard Summary

**One-liner:** Pre-stack CI guard blocks regression of the deleted `/api/signage/tags` and `/api/signage/schedules` FastAPI routes via anchored grep on `backend/app/`.

## Tasks

| Task | Name                                                                   | Commit  | Files                       |
| ---- | ---------------------------------------------------------------------- | ------- | --------------------------- |
| 1    | Add CI grep guard for /api/signage/tags + /api/signage/schedules        | 79dcc0c | `.github/workflows/ci.yml`  |

## Implementation Details

### Regex Used

```
"/api/signage/tags"|"/api/signage/tags/|"/api/signage/schedules"|"/api/signage/schedules/
```

Four alternations, all literal-quote anchored:
- `"/api/signage/tags"` — exact route literal
- `"/api/signage/tags/` — opens a sub-path under `/api/signage/tags/...`
- `"/api/signage/schedules"` — exact route literal
- `"/api/signage/schedules/` — opens a sub-path under `/api/signage/schedules/...`

The leading `"` anchors to string-quoted route definitions (FastAPI decorator convention) and prevents matches inside structured paths like `/api/signage/playlists/{id}/tags` because that path has `/api/signage/playlists` (not `/api/signage/tags`) before the `/tags` segment.

### False-Positive Verification

Manual regex tests run against the four critical cases:

| Input                                       | Expected | Actual              |
| ------------------------------------------- | -------- | ------------------- |
| `"/api/signage/playlists/abc/tags"`         | NO match | NO match (correct)  |
| `"/api/signage/devices/abc/tags"`           | NO match | NO match (correct)  |
| `"/api/signage/tags"`                       | match    | match (correct)     |
| `"/api/signage/tags/123"`                   | match    | match (correct)     |
| `"/api/signage/schedules"`                  | match    | match (correct)     |

Phase 69 (playlist tag-map writes) and Phase 70 (device tag-map writes) endpoints are not at risk of triggering a false positive.

### Local Run on Current Tree

```
$ grep -rnE '"/api/signage/tags"|"/api/signage/tags/|"/api/signage/schedules"|"/api/signage/schedules/' backend/app/
(no output — exits 1)
```

Nothing in `backend/app/` matched the guard. Plans 68-01 and 68-03 already removed all references; the guard would currently pass in CI.

### YAML Validation

```
$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
(exits 0 — valid YAML)
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml` (modified, line 107 contains the new guard step)
- FOUND: commit `79dcc0c` in `git log`
- FOUND: regex matches expected literals; does NOT match Phase 69/70 nested tag paths
- FOUND: YAML parses; backend/app/ guard exits clean (no current matches)
