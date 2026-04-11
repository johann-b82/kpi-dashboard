# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-11
**Phases:** 3 | **Plans:** 10 | **Sessions:** 1 (single execution window)

### What Was Built

- **Dockerized async FastAPI + PostgreSQL 17 stack** — compose with db → migrate → api → frontend, healthchecks on every service, Alembic migration service exits cleanly before api starts
- **38-column ERP tab-delimited ingestion pipeline** — pandas-based parser with German locale handling (decimal comma, DD.MM.YYYY dates), Pydantic v2 validation, UNIQUE `order_number` with cascade delete
- **Bilingual DE/EN React 19 + Vite 8 upload UI** — DropZone drag-and-drop, scrollable inline ErrorList (row/column), UploadHistory table with status badges, DeleteConfirmDialog
- **KPI query API** — three async aggregation endpoints (`/api/kpis` summary, `/api/kpis/chart` time-series, `/api/kpis/latest-upload`), backed by a `order_date` B-tree index for date-range queries
- **Interactive dashboard** — KPI summary cards (revenue, AOV, orders), Recharts bar/line revenue chart with toggle, DateRangeFilter with presets + custom calendar popover, FreshnessIndicator in NavBar
- **Upload → Dashboard auto-refresh** — DropZone onSuccess invalidates `kpiKeys.all`, TanStack Query v5 prefix-invalidates every dashboard query (summary, chart, latestUpload)

### What Worked

- **Parallel wave execution paid off in Phase 3 Wave 1** — backend KPI API and frontend router shell executed in parallel with zero conflicts (different subtrees). Wave 1 finished in ~3 min instead of 6 min sequential.
- **Pre-phase UI-SPEC + discussion + research artifacts** — Phase 3 planning had a clear design contract before execution. Zero design-related deviations during execution; the only deviation was a real bug (base-ui Popover vs Radix) caught immediately by the executor.
- **Async end-to-end from day one** — FastAPI + asyncpg + SQLAlchemy 2.0 async avoided the mid-project "sync-to-async rewrite" pitfall. Matches the I/O-bound nature of the workload.
- **Fixed schema decision** — locking the 38-column shape early (Phase 2) made the parser trivial and let Phase 3 assume column types without defensive coding.
- **TanStack Query prefix invalidation** — `kpiKeys.all = ["kpis"]` turned out to be the cleanest possible auto-refresh mechanism. Single call in DropZone covers every dashboard query without per-query plumbing.
- **Verifier agents caught real issues, not just box-checking** — Phase 3 verifier re-ran live curls against the running stack and confirmed the upload→dashboard flow end-to-end, not just SUMMARY compliance.

### What Was Inefficient

- **Phase 3 chart toggles round-trip** — plan called for granularity toggle + chart-type toggle; during post-verification UX tweak, user asked to remove both, then asked to re-add only chart type. Net: wasted work on GranularityToggle + tabs.tsx (created then deleted), and plan/code divergence that surfaced in the audit. **Lesson:** Visual UX calls are cheaper to make on a clickable prototype than to unwind in code.
- **Phase 2 `status: human_needed` items never closed** — 9/9 automated checks passed, but 5 visual items (drag-drop, toasts, inline errors) stayed pending across the whole milestone. They're non-blocking but clutter the audit. **Lesson:** HUMAN-UAT should be closed same-day via `/gsd:verify-work`, not deferred.
- **Phase 1 SUMMARY frontmatter gap** — `01-01-SUMMARY.md` and `01-02-SUMMARY.md` never listed `requirements-completed: [INFR-01, INFR-02]`. REQUIREMENTS.md was correct via manual edits, but the 3-source cross-reference in audit flagged the mismatch. **Lesson:** SUMMARY frontmatter should be treated as canonical, not the checkbox in REQUIREMENTS.md.
- **Initial ROADMAP.md Phase 3 progress row was stale** — when archiving, roadmap still listed Phase 3 as "0/4 Not started" despite Phase 3 being complete. The CLI didn't update the progress table during phase-complete.

### Patterns Established

- **Audit before archive** — running `/gsd:audit-milestone` before `/gsd:complete-milestone` surfaced the chart-toggle divergence and Phase 2 pending UAT. Worth the extra step on every milestone.
- **Post-execution UX tweaks go through `/gsd:quick`** — small visual changes during the same conversation as execute-phase should still be tracked as tech debt in the milestone audit.
- **Hardcoded sensible defaults for removed controls** — when a toggle is removed, keep the backend flexibility (e.g., `/api/kpis/chart?granularity=` still accepts all values) even if the UI ships one option. Cheap to re-enable later.
- **Base-ui primitives ≠ Radix primitives** — shadcn registries vary. Always check the underlying library before copying Radix-style `asChild` patterns into a project.
- **i18n flat keys (`keySeparator:false`) scale better** — avoids collision between `nav.lastUpdated` and `nav.lastUpdated.never` that would confuse a nested key tree.

### Key Lessons

1. **Deferred human-UAT rots.** If a phase ships `human_needed`, close it within the same session or it never gets done. Schedule visual verification as the final act of each phase, not "later".
2. **Plan/code divergence is invisible until audit.** The chart-toggle removal was a user-approved change, but `03-04-SUMMARY.md` still claimed the toggles existed. Audit caught it; execute-phase didn't. **Action:** post-phase tweaks should amend the affected SUMMARY, not leave it stale.
3. **Parallel waves only help when subtrees are truly independent.** Phase 3 Wave 1 worked because backend (Python) and frontend shell (TS) share no files. Wave 2 and Wave 3 had only one plan each — no parallelism possible. Don't force waves.
4. **Pre-phase design contracts (UI-SPEC, discuss, research) pay for themselves.** Phase 3 had zero mid-execution scope drift because the plan was fully specified before any code.
5. **Verifier agents should re-exercise the live stack, not just read SUMMARY.md.** Phase 3's verifier ran real curls and proved the data was live — that's what "verified" should always mean.

### Cost Observations

- Model mix: primarily sonnet (executors, verifier, integration checker, most orchestration), some opus (orchestrator for high-judgment steps)
- Sessions: 1 (single continuous session from Phase 3 start → milestone ship)
- Notable: Parallel Wave 1 in Phase 3 halved wall time vs sequential. Executor token usage averaged ~60-100k per plan — well within 200k window.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | 1 | 3 | Initial baseline |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 MVP | 0 automated | Manual curl + human-UAT | 0 (first milestone) |

**Note:** v1.0 shipped with no automated test suite — verification was curl-based + human UAT. v1.1 should establish an automated test baseline before adding new features.

### Top Lessons (Verified Across Milestones)

*(Will populate as additional milestones complete. Single-milestone lessons live in the v1.0 section above.)*
