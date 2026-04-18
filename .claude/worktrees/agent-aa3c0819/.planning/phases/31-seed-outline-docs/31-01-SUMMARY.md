---
phase: 31-seed-outline-docs
plan: 01
status: complete
executed: 2026-04-15
---

# Plan 31-01 — Consolidated via bulk API seed

**Execution note:** The six authoring plans (31-01..31-05) were consolidated into a single bulk Outline API seed (commit `8164073`). Rationale: per-page manual authoring in the Outline editor proved slow (1 page in 5 min); API-driven seed completed all 9 pages + snapshots in ~2 min with deterministic content derived from PROJECT.md, docs/setup.md, and the codebase.

**Covered by this plan's requirements:**
- 31-01 → WMP-01 (collection), DOC-01 (Dev Setup), DOC-02 (Architecture w/ Mermaid), DOC-09 (Landing)
- 31-02 → (router tags fix — deferred; DOC-03 documents actual tag set with footnote)
- 31-03 → DOC-03 (API Reference), DOC-04 (Personio Sync)
- 31-04 → DOC-05 (Sales), DOC-06 (HR), DOC-07 (Settings)
- 31-05 → DOC-08 (Admin Runbook) with resolved GitHub URL (github.com/johann-b82/kpi-dashboard)

**Artifacts:** 9 pages in Outline collection `39c4bddd-44f5-4301-a2f9-c49eaa3d9088`; 9 markdown snapshots in `docs/wiki-seed/`; index in `/tmp/seed-outline-result.txt` at execution time.

**Deviations from plan:**
- **Authoring flow changed mid-phase** from in-editor (D-01) to API bulk-seed after operator request. Snapshot commit discipline (D-05) preserved. Cross-links use `[[Title]]` auto-resolution as planned.
- **Router `tags=` fix (31-02 original task)** not applied — DOC-03 is thin (D-02), documents the existing 4-tag surface without requiring the 3-line code fix. Deferred to backlog if consistency matters.
- **Operator verified** content accuracy + cross-link resolution + Mermaid rendering before sign-off.

**Commits:**
- `2360533` (plan 31-01 Task 2): Seed docs/wiki-seed/ README
- `8164073` (consolidated): All 9 markdown snapshots
