---
phase: 44-pptx-conversion-pipeline
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/Dockerfile
autonomous: true
requirements:
  - SGN-INF-01

must_haves:
  truths:
    - "Docker build installs libreoffice-impress, libreoffice-core, poppler-utils, and Calibri/Cambria/Noto/DejaVu font packages"
    - "Inside the built image, `fc-list | grep Carlito` returns at least one font entry"
    - "Inside the built image, `fc-list | grep Caladea` returns at least one font entry"
    - "Inside the built image, `soffice --version` prints a LibreOffice version line"
    - "Inside the built image, `pdftoppm -v` prints a poppler version line"
    - "Directory /app/media/slides exists in the image (owned appropriately, writable by the runtime user)"
  artifacts:
    - path: "backend/Dockerfile"
      provides: "LibreOffice + poppler + fonts apt layer; /app/media/slides mkdir"
      contains: "libreoffice-impress"
  key_links:
    - from: "backend/Dockerfile apt layer"
      to: "signage_pptx.py subprocess calls to soffice + pdftoppm"
      via: "binaries on $PATH inside the api container"
      pattern: "libreoffice-impress|poppler-utils"
---

<objective>
Extend the backend Docker image so that LibreOffice (`soffice --headless`), poppler's `pdftoppm`, and the metric-compatible font set required for PPTX fidelity (Carlito/Caladea/Noto/DejaVu) are present at runtime. Also create `/app/media/slides/` at image build time so the conversion service can write derived slide PNGs without a preflight mkdir.

Purpose: implements SGN-INF-01 per CONTEXT D-16/D-17. Without this layer, the conversion service in plan 44-02 has no binaries to spawn and PPTX renders with wrong fonts (silent failure mode called out in the phase goal).

Output: updated `backend/Dockerfile` that builds with one additional apt layer and one mkdir.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md
@backend/Dockerfile
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add LibreOffice + poppler + fonts apt layer and create /app/media/slides</name>
  <read_first>
    - backend/Dockerfile (current file — minimal python:3.11-slim + curl only)
    - .planning/phases/44-pptx-conversion-pipeline/44-CONTEXT.md §Decisions D-16, D-17
    - .planning/ROADMAP.md §"Phase 44: PPTX Conversion Pipeline" success criterion 3
  </read_first>
  <files>backend/Dockerfile</files>
  <action>
Edit `backend/Dockerfile` to add a single `apt-get install --no-install-recommends -y` layer containing EXACTLY these packages (D-16):

    libreoffice-impress \
    libreoffice-core \
    poppler-utils \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-noto-core \
    fonts-dejavu-core

Combine it with the existing `curl` install so there is still one apt layer (do NOT create a second `RUN apt-get update`). The resulting RUN must also still end with `rm -rf /var/lib/apt/lists/*`.

After the apt layer, add `RUN mkdir -p /app/media/slides` (D-17). Since the image runs as root (no USER directive exists today — do NOT introduce one in this plan), simple `mkdir -p` is sufficient; no chown is required.

Preserve the current CMD line unchanged (uvicorn --reload — the project explicitly runs this way in dev; do not touch it in this plan).

Rationale per D-16: Carlito is Calibri-metric-compatible and Caladea is Cambria-metric-compatible; together with Noto + DejaVu they cover the fonts embedded in virtually every corporate PPTX. Without these, soffice falls back to its default and slides render with wrong layout.

Do NOT:
  - Split the apt install across multiple RUN layers (image-size regression).
  - Add `libreoffice` meta-package (pulls Writer/Calc/Base — ~400MB of unused bloat; we only need Impress + Core).
  - Add a VOLUME for /app/media/slides — per D-17 the dir is ephemeral/re-derivable and already cleaned by Phase 43 D-16 on media DELETE.
  - Remove `--reload` from CMD in this plan (that is a separate concern from SGN-INF-01; leave the existing behavior alone).
  </action>
  <verify>
    <automated>docker build -t kpi-backend-phase44 backend/ && docker run --rm kpi-backend-phase44 sh -c 'command -v soffice && command -v pdftoppm && fc-list | grep -c Carlito && fc-list | grep -c Caladea && test -d /app/media/slides && echo OK'</automated>
  </verify>
  <done>
    - `docker build` of `backend/` completes successfully.
    - Inside the built image: `soffice --version` prints a LibreOffice version line.
    - Inside the built image: `pdftoppm -v` prints a poppler version line (stderr or stdout).
    - Inside the built image: `fc-list | grep -c Carlito` returns ≥1.
    - Inside the built image: `fc-list | grep -c Caladea` returns ≥1.
    - Inside the built image: `/app/media/slides` exists and is a directory.
    - `grep libreoffice-impress backend/Dockerfile` matches.
    - `grep libreoffice-core backend/Dockerfile` matches.
    - `grep poppler-utils backend/Dockerfile` matches.
    - `grep fonts-crosextra-carlito backend/Dockerfile` matches.
    - `grep fonts-crosextra-caladea backend/Dockerfile` matches.
    - `grep fonts-noto-core backend/Dockerfile` matches.
    - `grep fonts-dejavu-core backend/Dockerfile` matches.
    - `grep -c 'mkdir -p /app/media/slides' backend/Dockerfile` returns 1.
  </done>
  <acceptance_criteria>
    - backend/Dockerfile contains the literal string `libreoffice-impress`.
    - backend/Dockerfile contains the literal string `libreoffice-core`.
    - backend/Dockerfile contains the literal string `poppler-utils`.
    - backend/Dockerfile contains the literal string `fonts-crosextra-carlito`.
    - backend/Dockerfile contains the literal string `fonts-crosextra-caladea`.
    - backend/Dockerfile contains the literal string `fonts-noto-core`.
    - backend/Dockerfile contains the literal string `fonts-dejavu-core`.
    - backend/Dockerfile contains the literal string `mkdir -p /app/media/slides`.
    - backend/Dockerfile contains the literal string `rm -rf /var/lib/apt/lists/*` (preserved from current).
    - `docker build -t kpi-backend-phase44 backend/` exits 0.
    - `docker run --rm kpi-backend-phase44 fc-list` output contains the token `Carlito`.
    - `docker run --rm kpi-backend-phase44 fc-list` output contains the token `Caladea`.
    - `docker run --rm kpi-backend-phase44 sh -c 'command -v soffice'` prints a non-empty path.
    - `docker run --rm kpi-backend-phase44 sh -c 'command -v pdftoppm'` prints a non-empty path.
    - `docker run --rm kpi-backend-phase44 sh -c 'test -d /app/media/slides && echo yes'` prints `yes`.
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `docker build -t kpi-backend-phase44 backend/` completes without error.
- `docker run --rm kpi-backend-phase44 sh -c 'soffice --version && pdftoppm -v 2>&1 | head -1 && fc-list | grep -E "Carlito|Caladea" | wc -l'` prints a LibreOffice version, a poppler version, and a count ≥2.
- `docker run --rm kpi-backend-phase44 ls -ld /app/media/slides` shows an existing directory.
</verification>

<success_criteria>
- Dockerfile has been extended with the required apt layer and mkdir.
- All binaries and fonts required by plan 44-02's conversion service are present in the built image.
- Image build still succeeds end-to-end (nothing else regressed).
</success_criteria>

<output>
After completion, create `.planning/phases/44-pptx-conversion-pipeline/44-01-SUMMARY.md` capturing: the exact package list installed, the mkdir location, and any notes on image size delta if worth mentioning.
</output>
