---
phase: 71-fe-polish-clean
plan: 07
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/adr/0001-directus-fastapi-split.md
  - docs/adr/README.md
  - docs/architecture.md
  - README.md
autonomous: true
requirements: [CLEAN-05]

must_haves:
  truths:
    - "A new ADR file at docs/adr/0001-directus-fastapi-split.md records the v1.22 Directus/FastAPI boundary decision in classic ADR format (Context / Decision / Consequences / Alternatives)"
    - "docs/adr/README.md documents the ADR numbering convention (4-digit zero-padded)"
    - "docs/architecture.md has a new section describing the Directus = shape, FastAPI = compute split with link to the ADR"
    - "README.md has a 3-line summary linking to the ADR"
    - "ADR enumerates what STAYS in FastAPI (D-05a list)"
  artifacts:
    - path: "docs/adr/0001-directus-fastapi-split.md"
      provides: "Architecture Decision Record for v1.22 boundary"
      min_lines: 60
    - path: "docs/adr/README.md"
      provides: "ADR convention + index"
    - path: "docs/architecture.md"
      provides: "Updated with Directus/FastAPI split section"
    - path: "README.md"
      provides: "Architecture section with ADR link"
  key_links:
    - from: "README.md"
      to: "docs/adr/0001-directus-fastapi-split.md"
      via: "markdown link"
      pattern: "docs/adr/0001-directus-fastapi-split"
    - from: "docs/architecture.md"
      to: "docs/adr/0001-directus-fastapi-split.md"
      via: "markdown link"
      pattern: "docs/adr/0001-directus-fastapi-split"
---

<objective>
Document the v1.22 Directus/FastAPI architectural boundary in a new ADR, link it from `docs/architecture.md` and `README.md`, and seed `docs/adr/` with a numbering convention README.

Purpose: Lock CLEAN-05 (architecture docs reflect new boundary; decision recorded).
Output: New `docs/adr/` directory + ADR-0001 + index README + appended `architecture.md` section + updated `README.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@docs/architecture.md
@README.md
@.planning/REQUIREMENTS.md

<interfaces>
docs/adr/ does NOT exist (RESEARCH.md confirms — must `mkdir`).
docs/architecture.md exists (72 lines, Phase 64 reverse proxy section). Append new section.
README.md has architecture/features sections — add a 3-line link.

D-05a — ADR MUST enumerate what STAYS in FastAPI:
- upload POST + parsing
- KPI compute endpoints
- Personio/sensor sync (APScheduler)
- signage_player SSE bridge
- signage_pair JWT minting
- media/PPTX
- calibration PATCH
- /api/signage/resolved/{id}

D-05b — Settings called out as deferred-not-decided in Consequences.

Numbering convention: 4-digit zero-padded (`0001-`) per RESEARCH.md Pitfall 8 — supports up to 9999 ADRs without renumbering.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create docs/adr/ directory + ADR-0001 + numbering convention README</name>
  <files>docs/adr/0001-directus-fastapi-split.md, docs/adr/README.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (lines 11-21 — locked architectural decisions verbatim)
    - .planning/phases/71-fe-polish-clean/71-CONTEXT.md (D-05/D-05a/D-05b)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Pitfall 8 — numbering convention)
  </read_first>
  <action>
    Create `docs/adr/` directory and two files.

    File 1 — `docs/adr/README.md` (~10 lines):

    ```markdown
    # Architecture Decision Records

    This directory stores Architecture Decision Records (ADRs) for kpi-dashboard.

    ## Numbering convention

    Files are named `NNNN-kebab-case-title.md` using **4-digit zero-padded** numbers
    (e.g., `0001-directus-fastapi-split.md`). This supports up to 9999 ADRs without
    renumbering and matches the most common community convention.

    ## Index

    - [0001 — Directus / FastAPI Split (v1.22)](./0001-directus-fastapi-split.md)
    ```

    File 2 — `docs/adr/0001-directus-fastapi-split.md` (~80 lines, classic ADR format):

    ```markdown
    # ADR-0001: Directus / FastAPI Split

    **Status:** Accepted
    **Date:** 2026-04-25
    **Milestone:** v1.22 — Backend Consolidation

    ## Context

    Through milestones v1.0–v1.21, kpi-dashboard accumulated ~25 pure-CRUD
    FastAPI endpoints for signage admin, sales/employee row lookups, and
    auth identity. Each endpoint duplicated logic Directus 11 already
    provides natively (filtering, validation, RBAC, REST shape). The
    duplication slowed feature work and created a second source of truth
    for collection schemas already defined in Alembic.

    v1.22 set out to eliminate this duplication while preserving the
    compute-shaped surface (file parsing, KPI aggregation, SSE bridge,
    APScheduler jobs, JWT minting) that Directus cannot express.

    ## Decision

    **Directus = shape. FastAPI = compute.**

    Specifically:

    - **Directus owns:** CRUD on `sales_records`, `personio_employees`,
      `signage_devices`, `signage_playlists`, `signage_playlist_items`,
      `signage_device_tags`, `signage_playlist_tag_map`, `signage_device_tag_map`,
      `signage_schedules`. Identity reads via `readMe()`.
    - **FastAPI owns:** Upload POST + file parsing, KPI compute endpoints,
      Personio + sensor sync (APScheduler), `signage_player` SSE bridge +
      envelope, `signage_pair` JWT minting, media + PPTX (`/api/signage/media*`),
      calibration PATCH (`/api/signage/devices/{id}/calibration`),
      `GET /api/signage/resolved/{id}` (compute-shaped resolver), `DELETE
      /api/signage/playlists/{id}` (preserves structured 409 shape), bulk
      `PUT /api/signage/playlists/{id}/items` (atomic DELETE+INSERT), and
      `GET /api/signage/analytics/devices` (bucketed uptime aggregate).
    - **Alembic remains the sole DDL owner** of `public.*` tables.
      Directus owns metadata rows only.
    - **SSE bridge:** Postgres `LISTEN/NOTIFY` (Option A) — Alembic-owned
      triggers, FastAPI lifespan-hosted asyncpg listener. Single-listener
      invariant via `--workers 1`.
    - **Frontend adapter seam:** `signageApi.ts` wraps Directus SDK calls
      and returns the same shapes existing TanStack Query consumers
      expect; `toApiError()` normalizes Directus plain-object errors to
      `ApiErrorWithBody`.
    - **Cache-key namespaces:** `['directus', <collection>, ...]` and
      `['fastapi', <topic>, ...]` are the canonical patterns. Legacy
      `signageKeys.*` coexists for un-migrated reads (media, analytics).

    ## Consequences

    **Positive:**
    - One source of truth per concern. Schema lives in Alembic; CRUD in
      Directus; compute in FastAPI.
    - Adding new collections requires only an Alembic migration + a
      Directus snapshot YAML edit. No FastAPI router boilerplate.
    - Per-collection field allowlists in `bootstrap-roles.sh` make Viewer
      RBAC explicit and auditable.

    **Negative / tradeoffs:**
    - Composite-PK Directus collections (`signage_playlist_tag_map`,
      `signage_device_tag_map`) registered with `schema:null` return 403
      to admin REST queries — known Directus limitation. Worked around
      with FE-driven tag-map diff (Phase 69 D-02).
    - Directus version drift could break adapter contracts. Mitigated by
      contract-snapshot tests (`frontend/src/tests/contracts/*.json`,
      Phase 71 FE-05).
    - Two error-throwing transports in the FE (Directus plain objects,
      FastAPI plain `Error`). Mitigated by central `toApiError()` helper.

    **Deferred / not decided:**
    - **Settings rewrite to Directus** — oklch/hex validators + SVG
      sanitization + ETag + logo BYTEA are too custom for a clean
      Directus-hook port today. Revisited per-milestone.

    ## Alternatives Considered

    - **Full Directus** (move every endpoint including compute) — rejected
      because Directus aggregations cannot express bucketed uptime, and
      Python tooling for APScheduler / Personio / SNMP / PPTX is
      stronger than Directus Flows.
    - **Full FastAPI** (status quo) — rejected because the duplication
      cost was the trigger for v1.22 in the first place.
    - **Directus Flow webhooks for SSE** — rejected in favor of Postgres
      `LISTEN/NOTIFY` (Option A) for writer-agnostic fan-out (fires on
      Directus, psql, future writers).

    ## References

    - `.planning/REQUIREMENTS.md` — v1.22 requirements
    - `.planning/ROADMAP.md` — milestone phasing
    - `docs/architecture.md` — current architecture diagram + boundary section
    - `docs/operator-runbook.md` `## v1.22 Rollback Procedure` — rollback steps
    ```
  </action>
  <verify>
    <automated>test -f docs/adr/README.md && test -f docs/adr/0001-directus-fastapi-split.md && wc -l docs/adr/0001-directus-fastapi-split.md</automated>
  </verify>
  <acceptance_criteria>
    - Directory `docs/adr/` exists
    - File `docs/adr/README.md` exists, contains literal "4-digit zero-padded"
    - File `docs/adr/0001-directus-fastapi-split.md` exists, line count >= 60
    - ADR contains all four required sections (case-sensitive headings): `## Context`, `## Decision`, `## Consequences`, `## Alternatives Considered`
    - ADR enumerates STAYS-in-FastAPI list (D-05a) — `grep -ci "calibration\|resolved\|signage_pair\|APScheduler\|PPTX" docs/adr/0001-directus-fastapi-split.md` returns >= 5
    - ADR mentions Settings as deferred (D-05b) — `grep -i "settings.*defer\|defer.*settings" docs/adr/0001-directus-fastapi-split.md` matches
  </acceptance_criteria>
  <done>docs/adr/ scaffolded with numbering convention README + ADR-0001 in classic format with all four sections.</done>
</task>

<task type="auto">
  <name>Task 2: Update docs/architecture.md + README.md to link the ADR</name>
  <files>docs/architecture.md, README.md</files>
  <read_first>
    - docs/architecture.md (entire — to match existing section style)
    - README.md (entire — to find architecture/features section)
    - .planning/phases/71-fe-polish-clean/71-CONTEXT.md (D-05)
  </read_first>
  <action>
    File 1 — `docs/architecture.md`: append a new top-level section after the existing content:

    ```markdown
    ## Directus / FastAPI Boundary (v1.22)

    Since v1.22 (2026-04), kpi-dashboard splits its backend along a
    canonical boundary: **Directus = shape, FastAPI = compute**.

    - **Directus serves CRUD** on `sales_records`, `personio_employees`,
      and the signage admin collections (`signage_devices`,
      `signage_playlists`, `signage_playlist_items`, `signage_*_tag_map`,
      `signage_schedules`, `signage_device_tags`). Identity reads via
      `readMe()`.
    - **FastAPI serves compute:** file upload + parsing, KPI aggregation,
      Personio/sensor sync (APScheduler), the `signage_player` SSE
      bridge, JWT minting, media + PPTX, calibration PATCH,
      `/api/signage/resolved/{id}`, and the structured-409 `DELETE
      /playlists/{id}` + atomic bulk `PUT /playlists/{id}/items`.
    - **Postgres LISTEN/NOTIFY** bridges Directus writes back to SSE so
      Pi players see fan-out within ~500 ms regardless of which writer
      (Directus, psql, FastAPI compute) touched the row. Single-listener
      invariant via `--workers 1`.
    - **Alembic** remains the sole DDL owner; Directus stores metadata
      rows only.

    Decision recorded in [ADR-0001](./adr/0001-directus-fastapi-split.md).
    ```

    File 2 — `README.md`: locate the architecture/features section. Add 3 lines (a paragraph + ADR link) at the appropriate spot. Suggested wording:

    ```markdown
    **Architecture (v1.22):** Directus serves shape (CRUD on sales,
    employees, signage admin); FastAPI serves compute (upload, KPIs,
    sync, SSE, calibration). See [ADR-0001](./docs/adr/0001-directus-fastapi-split.md).
    ```

    If README has a `## Architecture` heading, append the 3 lines under it. If not, add a small `## Architecture` section near the top (after the project description, before installation/setup).
  </action>
  <verify>
    <automated>grep -c "Directus / FastAPI Boundary" docs/architecture.md && grep -c "0001-directus-fastapi-split" README.md docs/architecture.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Directus / FastAPI Boundary" docs/architecture.md` returns 1
    - `grep -c "0001-directus-fastapi-split" docs/architecture.md` returns >= 1 (link present)
    - `grep -c "0001-directus-fastapi-split" README.md` returns >= 1 (link present)
    - `grep -ic "directus\|fastapi" README.md` shows new architecture mention
    - `docs/architecture.md` retains all pre-existing sections (line count grew, didn't shrink)
  </acceptance_criteria>
  <done>docs/architecture.md gains the v1.22 boundary section linking ADR-0001; README.md has 3-line architecture summary linking the same ADR.</done>
</task>

</tasks>

<verification>
- docs/adr/0001-directus-fastapi-split.md follows classic ADR format (4 sections)
- docs/architecture.md + README.md both link ADR-0001
- ADR enumerates D-05a stays-in-FastAPI list and D-05b Settings deferral
</verification>

<success_criteria>
CLEAN-05 fully satisfied: README + architecture doc updated; new ADR records the v1.22 Directus/FastAPI split decision with consequences and alternatives.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-07-SUMMARY.md`.
</output>
