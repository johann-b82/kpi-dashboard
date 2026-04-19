---
phase: 44-pptx-conversion-pipeline
plan: 01
subsystem: signage-infrastructure
tags: [docker, libreoffice, poppler, fonts, pptx, signage, infra]
requires:
  - backend/Dockerfile baseline (python:3.11-slim + curl)
provides:
  - "soffice on $PATH inside api container"
  - "pdftoppm on $PATH inside api container"
  - "Calibri/Cambria metric-compatible fonts (Carlito/Caladea) inside api container"
  - "Noto + DejaVu broad-glyph font coverage inside api container"
  - "/app/media/slides directory at image build time (root-owned, writable)"
affects:
  - backend/Dockerfile
tech-stack:
  added:
    - "libreoffice-impress (LibreOffice 25.2.3.2)"
    - "libreoffice-core (LibreOffice 25.2.3.2)"
    - "poppler-utils (pdftoppm 25.03.0)"
    - "fonts-crosextra-carlito (Calibri-metric-compatible)"
    - "fonts-crosextra-caladea (Cambria-metric-compatible)"
    - "fonts-noto-core"
    - "fonts-dejavu-core"
  patterns:
    - "Single apt layer combines curl + libreoffice + poppler + fonts (no layer split)"
    - "mkdir -p /app/media/slides as dedicated build step (no chown — image runs as root, no USER directive)"
key-files:
  modified:
    - backend/Dockerfile
  created: []
decisions:
  - "D-16 honored: installed libreoffice-impress + libreoffice-core (no libreoffice meta-package to avoid ~400MB Writer/Calc/Base bloat)"
  - "D-16 honored: Carlito + Caladea for Calibri/Cambria metric compatibility; Noto + DejaVu for fallback glyph coverage"
  - "D-17 honored: /app/media/slides created at build; no VOLUME (ephemeral/re-derivable, cleaned by Phase 43 D-16)"
  - "CMD untouched (--reload preserved per plan instruction — separate concern from SGN-INF-01)"
  - "Single apt layer reused from curl install (no new RUN apt-get update) — image-size regression avoided"
metrics:
  duration: "102s"
  tasks: 1
  files: 1
  completed: "2026-04-19"
---

# Phase 44 Plan 01: Dockerfile LibreOffice + Fonts Summary

Add LibreOffice headless (Impress + Core), poppler `pdftoppm`, and the Calibri/Cambria metric-compatible font stack (Carlito/Caladea/Noto/DejaVu) to the backend image, plus a pre-created `/app/media/slides` directory, so the plan 44-02 PPTX conversion worker has the binaries and fonts it needs to render corporate PPTXs with correct layout.

## What Shipped

### Package list (apt, single layer with existing curl)

```
curl
libreoffice-impress
libreoffice-core
poppler-utils
fonts-crosextra-carlito
fonts-crosextra-caladea
fonts-noto-core
fonts-dejavu-core
```

Installed with `apt-get install --no-install-recommends -y`, followed by `rm -rf /var/lib/apt/lists/*`.

### Directory

`RUN mkdir -p /app/media/slides` added as its own build step. No `chown` — the image has no `USER` directive and runs as root today; the plan explicitly prohibits introducing one.

### CMD (unchanged)

`CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]` — preserved verbatim.

## Verification (acceptance criteria)

Run against `docker run --rm kpi-backend-phase44 …`:

| Check | Result |
| --- | --- |
| `docker build` exit code | 0 |
| `command -v soffice` | `/usr/bin/soffice` |
| `soffice --version` | `LibreOffice 25.2.3.2 520(Build:2)` |
| `command -v pdftoppm` | `/usr/bin/pdftoppm` |
| `pdftoppm -v` (head -1) | `pdftoppm version 25.03.0` |
| `fc-list \| grep -c Carlito` | `4` |
| `fc-list \| grep -c Caladea` | `4` |
| `test -d /app/media/slides && echo yes` | `yes` |
| `grep libreoffice-impress backend/Dockerfile` | matched |
| `grep libreoffice-core backend/Dockerfile` | matched |
| `grep poppler-utils backend/Dockerfile` | matched |
| `grep fonts-crosextra-carlito backend/Dockerfile` | matched |
| `grep fonts-crosextra-caladea backend/Dockerfile` | matched |
| `grep fonts-noto-core backend/Dockerfile` | matched |
| `grep fonts-dejavu-core backend/Dockerfile` | matched |
| `grep 'mkdir -p /app/media/slides' backend/Dockerfile` | 1 match |
| `grep 'rm -rf /var/lib/apt/lists/\*' backend/Dockerfile` | preserved |

## Image Size Notes

The LibreOffice apt layer (with libreoffice-impress + libreoffice-core + their transitive deps such as libreoffice-draw, libreoffice-common, libcups, cmis, poppler libs) is the dominant size contributor. Using the meta-package `libreoffice` instead would pull Writer/Calc/Base/Math/Help and add roughly ~400MB of unused content — explicitly avoided per D-16. Carlito/Caladea/Noto-core/DejaVu-core together weigh in at tens of MB only. Overall build completed in ~64s (apt layer) + ~3.6s unpack on arm64/desktop-linux.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes, no auth gates, no checkpoints.

## Commits

- `e5d29d6` feat(44-01): add LibreOffice, poppler, fidelity fonts, and /app/media/slides to backend image

## Self-Check: PASSED

- FOUND: backend/Dockerfile
- FOUND: commit e5d29d6
- FOUND: all 7 required apt package literals in backend/Dockerfile
- FOUND: `mkdir -p /app/media/slides` literal in backend/Dockerfile
- FOUND: `rm -rf /var/lib/apt/lists/*` preserved
- FOUND: image builds cleanly (`kpi-backend-phase44:latest`)
- FOUND: all runtime checks (soffice/pdftoppm/Carlito/Caladea/slides-dir) green
