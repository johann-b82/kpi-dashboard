---
phase: 71-fe-polish-clean
plan: 07
subsystem: docs
tags: [docs, adr, architecture, v1.22, clean]
requires: []
provides:
  - docs/adr/ directory + numbering convention
  - ADR-0001 recording v1.22 Directus/FastAPI boundary
  - architecture.md boundary section linked to ADR
  - README.md architecture summary linked to ADR
affects:
  - docs/adr/0001-directus-fastapi-split.md
  - docs/adr/README.md
  - docs/architecture.md
  - README.md
tech-stack:
  added: []
  patterns: [classic-adr-format, 4-digit-zero-padded-numbering]
key-files:
  created:
    - docs/adr/0001-directus-fastapi-split.md
    - docs/adr/README.md
  modified:
    - docs/architecture.md
    - README.md
decisions:
  - 4-digit zero-padded ADR numbering (NNNN-) supports 9999 ADRs without renumbering (RESEARCH.md Pitfall 8)
  - Settings rewrite documented as deferred-not-decided in ADR Consequences (D-05b)
  - ADR enumerates D-05a stays-in-FastAPI list verbatim (calibration, resolved, signage_pair, APScheduler, PPTX, structured-409 DELETE, bulk PUT items, analytics/devices)
metrics:
  duration: 85s
  tasks: 2
  files: 4
  completed: 2026-04-25
---

# Phase 71 Plan 07: Architecture Doc + ADR Summary

ADR-0001 records the v1.22 Directus = shape, FastAPI = compute decision in classic ADR format; `docs/architecture.md` + `README.md` link to it.

## What Was Built

- New `docs/adr/` directory with index README documenting 4-digit zero-padded numbering convention.
- ADR-0001 (`docs/adr/0001-directus-fastapi-split.md`, 95 lines) capturing the v1.22 boundary in Context / Decision / Consequences / Alternatives Considered sections, including the D-05a stays-in-FastAPI list and D-05b Settings deferral.
- New "Directus / FastAPI Boundary (v1.22)" section appended to `docs/architecture.md` summarizing the split with a link to ADR-0001.
- 3-line architecture summary added to `README.md` under the existing `## Architecture` heading, linking ADR-0001.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create docs/adr/ + ADR-0001 + numbering convention README | 7a1cf46 | docs/adr/README.md, docs/adr/0001-directus-fastapi-split.md |
| 2 | Update docs/architecture.md + README.md to link the ADR | b76d728 | docs/architecture.md, README.md |

## Verification

- `wc -l docs/adr/0001-directus-fastapi-split.md` → 95 (>= 60 required)
- All four required headings present (`## Context`, `## Decision`, `## Consequences`, `## Alternatives Considered`) — count 4
- D-05a enumeration grep (`calibration|resolved|signage_pair|APScheduler|PPTX`) → 6 matches (>= 5 required)
- D-05b Settings deferral grep matches: "Settings rewrite to Directus — deferred"
- `grep -c "Directus / FastAPI Boundary" docs/architecture.md` → 1
- `grep -c "0001-directus-fastapi-split" README.md docs/architecture.md` → 1 each
- `docs/adr/README.md` contains literal "4-digit zero-padded"

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: docs/adr/0001-directus-fastapi-split.md
- FOUND: docs/adr/README.md
- FOUND: docs/architecture.md (modified)
- FOUND: README.md (modified)
- FOUND: 7a1cf46
- FOUND: b76d728
