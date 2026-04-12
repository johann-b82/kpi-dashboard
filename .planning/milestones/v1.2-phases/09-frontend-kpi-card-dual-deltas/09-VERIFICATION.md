---
phase: 09-frontend-kpi-card-dual-deltas
verified: 2026-04-11T00:00:00Z
status: passed
score: 5/5 success criteria verified
human_verification:
  - test: "Visual inspection at 1080p + 1440p with real data"
    expected: "Right-side delta stack vertically centered against value, no grid overflow"
    why_human: "Layout/visual quality not grep-verifiable"
  - test: "Switch presets (thisMonth/thisQuarter/thisYear/allTime) in both DE and EN"
    expected: "Badges re-render with correct labels; DE uses comma decimal, EN uses period; thisYear shows em-dash for prev-period"
    why_human: "Requires running app + locale toggle"
  - test: "Hover em-dash badge on allTime preset"
    expected: "Native title tooltip shows EN 'No comparison period available' (DE parity deferred to Phase 11)"
    why_human: "Native browser tooltip can't be unit-asserted"
---

# Phase 9: Frontend — KPI Card Dual Deltas — Verification Report

**Phase Goal:** Users see at-a-glance growth signals on every summary card — two compact delta badges (vs. Vorperiode, vs. Vorjahr) with arrows, semantic colors, locale-correct percentage formatting, and em-dash fallback.
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | 3 cards render dual delta badges without breaking grid | VERIFIED | `KpiCardGrid.tsx:124-180` — `grid-cols-1 lg:grid-cols-3`, 3 KpiCard instances each with a `<DeltaBadgeStack />` delta slot |
| 2 | Positive ▲ + `text-primary`, negative ▼ + `text-destructive`, format `▲ +12,4 %` DE / `▲ +12.4%` EN | VERIFIED | `deltaFormat.ts:36-64` — Intl percent, `signDisplay:'never'`, manual ▲/▼ + `+`/`−`, `text-primary`/`text-destructive` class branches |
| 3 | Null baseline → grayscale `—` with tooltip | VERIFIED | `deltaFormat.ts:40` returns `—` for null; `DeltaBadge.tsx:35-41` uses native `title` attr with `noBaselineTooltip` from `dashboard.delta.noBaselineTooltip` i18n key; `deltaClassName` maps null → `text-muted-foreground` |
| 4 | Muted secondary label contextual to filter ("vs. März" / "vs. Q1" / etc.) | VERIFIED | `periodLabels.ts:37-81` uses `Intl.DateTimeFormat(..., {month:'long'})` for month-name, quarter derivation from `prevPeriodStart.getMonth()`; `DeltaBadgeStack.tsx:49,57` renders muted secondary span |
| 5 | Cards re-fetch on filter change / new upload via TanStack Query invalidation | VERIFIED | `queryKeys.ts:11-12` — `summary` key embeds `{start, end, prev}`; `KpiCardGrid.tsx:44-52` — `useMemo` prev bounds, `useQuery` keyed on full tuple |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status |
|---|---|---|
| `frontend/src/lib/delta.ts` | `computeDelta`, null/zero guards | VERIFIED — matches CONTEXT signature exactly |
| `frontend/src/lib/prevBounds.ts` | `computePrevBounds`, PrevBounds interface | VERIFIED — 5 preset branches; `thisYear` collapses prev_period to undefined (Phase 8 decision D) |
| `frontend/src/lib/periodLabels.ts` | `formatPrevPeriodLabel`, `formatPrevYearLabel`, Intl-locale-aware | VERIFIED — uses `Intl.DateTimeFormat`, pure, no i18next import |
| `frontend/src/lib/dateUtils.ts` `getPresetRange` | To-date semantics (MTD/QTD/YTD) | VERIFIED — `thisYear → [startOfYear(today), today]` (line 32) |
| `frontend/src/lib/api.ts` `KpiSummary` | nullable `previous_period`/`previous_year` | VERIFIED — `KpiSummary` interface lines 58-66; `fetchKpiSummary` threads 4 `prev_*` query params |
| `DeltaBadge.tsx` | Prop-driven, native title tooltip | VERIFIED |
| `DeltaBadgeStack.tsx` | Two stacked badges w/ muted labels | VERIFIED |
| `KpiCard.tsx` | `delta?: ReactNode` slot | VERIFIED — renders in `flex items-center justify-between` row (post-checkpoint right-side layout) |
| `DateRangeFilter.tsx` | No Popover/Calendar/ZEITRAUM; controlled preset only | VERIFIED — 48 LOC, no custom picker, `justify-end` preset buttons only |
| `DashboardPage.tsx` | `useState<Preset>` (not nullable) | VERIFIED — line 12 `useState<Preset>("thisYear")` |
| `KpiCardGrid.tsx` | Consumes prev bounds, renders DeltaBadgeStack via slot | VERIFIED — `useMemo(computePrevBounds)`, forwards to all 3 KpiCards |
| `frontend/src/locales/en.json` | 6 new `dashboard.delta.*` keys | VERIFIED — lines 64-69 |
| `frontend/src/locales/de.json` | Untouched for delta keys | VERIFIED — `grep delta → No matches` |
| `frontend/src/lib/queryKeys.ts` | `summary` key embeds PrevBounds | VERIFIED — line 11-12 |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `KpiCardGrid` | `/api/kpis` | `fetchKpiSummary(startDate, endDate, prevBounds)` with prev_* params | WIRED |
| `KpiCardGrid` | `computePrevBounds` | `useMemo` on `[preset, range.from, range.to]` | WIRED |
| `KpiCardGrid` | `DeltaBadgeStack` | Passed via `KpiCard.delta` slot prop, 3× | WIRED |
| `DeltaBadgeStack` | `DeltaBadge` | 2× per stack (prev_period + prev_year rows) | WIRED |
| `DashboardPage` | `DateRangeFilter` | Controlled via `{value, preset, onChange}` | WIRED |
| `DashboardPage` → `KpiCardGrid` | `preset` + `range` props | Lifted state, single source of truth | WIRED |
| i18n tooltip key | `DeltaBadge` | `t('dashboard.delta.noBaselineTooltip')` in KpiCardGrid → prop drill | WIRED |

### CONTEXT Decisions (A–F) Honored

| Decision | Honored? | Evidence |
|---|---|---|
| A. To-date preset semantics | YES | `dateUtils.ts:22-36` — all 3 presets clamp end to `today` |
| B. `activePreset` lifted to `DashboardPage` | YES | `DashboardPage.tsx:12` owns state, `DateRangeFilter` fully controlled |
| C. `computePrevBounds` pure util | YES | `prevBounds.ts` — pure, injectable `today`, all 5 branches match CONTEXT table |
| D. `periodLabels` Intl-based pure util | YES | `periodLabels.ts` — no i18next import, Intl month/quarter derivation |
| E. `KpiCard` `delta?: ReactNode` slot | YES | `KpiCard.tsx:14` — plus post-checkpoint right-side flex layout with `items-center` |
| F. `computeDelta` null/zero-prior guard | YES | `delta.ts:20` — returns null for both branches |

### Post-Checkpoint Refinements

| Refinement | Verified |
|---|---|
| Right-side delta layout (not stacked below) | YES — `KpiCard.tsx:31-36` flex row w/ `flex-shrink-0 text-right` |
| Delta stack vertically centered via `items-center` | YES — `KpiCard.tsx:31` |
| ZEITRAUM label removed | YES — no `filter.label` reference in DateRangeFilter |
| Preset buttons right-aligned | YES — `justify-end` on flex wrapper |
| Custom date picker removed | YES — no Popover/Calendar imports, `Preset` type has no `"custom"` member |
| `Preset` narrowed from `Preset \| null` | YES in `DashboardPage.tsx` + `DateRangeFilter.tsx`; `KpiCardGrid` still accepts `Preset \| null` defensively (harmless — util signatures accept null) |

### Requirements Coverage

| ID | Description | Status | Evidence |
|---|---|---|---|
| CARD-01 | Dual delta badges on all 3 cards | SATISFIED | `KpiCardGrid.tsx` 3× `DeltaBadgeStack` |
| CARD-02 | ▲/▼ + semantic color | SATISFIED | `deltaFormat.ts` arrow + className branches |
| CARD-03 | Locale-aware percentage (DE comma / EN period) | SATISFIED | `Intl.NumberFormat` with DE/EN locale tags |
| CARD-04 | Em-dash + tooltip for null | SATISFIED | `DeltaBadge.tsx` native title tooltip |
| CARD-05 | Contextual secondary labels | SATISFIED | `periodLabels.ts` Intl month/quarter |

All 5 marked Complete in REQUIREMENTS.md traceability table (lines 58-62).

### Anti-Patterns Found

None blocking. Notable observations:

| File | Line | Pattern | Severity |
|---|---|---|---|
| `locales/en.json` + `de.json` | 41,46-50 | 6 dead `dashboard.filter.{label,custom,from,to,apply,reset}` keys | INFO — documented as Phase 11 hand-off |
| `periodLabels.ts` | inline | Hardcoded DE strings ("Tage zuvor", "Vorperiode") | INFO — documented as I18N-DELTA-02 Phase 11 hand-off |
| `KpiCardGrid.tsx` | 30 | `preset: Preset \| null` wider than DashboardPage's `Preset` | INFO — defensive typing, not a bug |

None of these block Phase 9's goal; all are explicitly owned by Phase 11.

### Behavioral Spot-Checks

Skipped — verification is static (no running dev server required). The pure utils in `lib/` have their own verify scripts (`frontend/scripts/verify-phase-09-0{1,2}.mts`) per SUMMARY references.

### Gaps Summary

None. All 5 ROADMAP success criteria verified in code, all 6 CONTEXT decisions honored (including post-checkpoint refinements), all 5 CARD requirements marked Complete with concrete implementation evidence, and all Phase 11 hand-off items match the scope boundary set in CONTEXT section "Out of Scope".

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_
