# Phase 11: i18n, Contextual Labels, and Polish - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the DE/EN locale-parity gap left open by Phases 9 and 10: translate every new v1.2 UI string (6 delta keys + 4 chart series keys, plus any period labels replaced with `Intl.DateTimeFormat` output) into informal "du"-tone German, add a persistent locale-parity check script, and run an end-to-end human-verification pass across all 4 date presets × 2 languages × dual delta badges + chart overlay.

**In scope:**
- Translate the 10 EN-only keys currently missing from `frontend/src/locales/de.json`:
  - `dashboard.chart.series.revenue`, `revenueMonth`, `revenueQuarter`, `revenueYear`
  - `dashboard.delta.vsShortPeriod`, `vsShortPeriod_one`, `vsCustomPeriod`, `vsYear`, `noBaseline`, `noBaselineTooltip`
- Extend `frontend/src/lib/periodLabels.ts` with `Intl.DateTimeFormat`-backed month-name interpolation so `{{month}}` is locale-aware (Intl.DateTimeFormat provides "März" / "March" natively given a `"de"` or `"en"` locale code)
- Replace any hardcoded period strings in Phase 9/10 source with locale-aware formatter output
- Ship a persistent locale-parity check script at `frontend/scripts/check-locale-parity.mts`
- End-to-end human verification: upload `sample_export.csv`, cycle through all 4 presets × 2 languages, confirm card deltas + chart overlay + contextual labels behave correctly; "Gesamter Zeitraum" shows em-dashes everywhere

**Out of scope:**
- Currency / number formatting via `Intl.NumberFormat` (deferred from v1.1 Phase 7; belongs in a future dashboard-polish phase)
- Additional languages beyond DE/EN
- ICU MessageFormat plural plugin (i18next defaults already cover DE one/other)
- New period semantics beyond month/quarter/year/allTime (no weekly preset currently exists)
- New CI wiring for the parity script (no CI exists yet; manual invocation + future-CI readiness only)
- Retroactive review of the existing 111 DE keys from Phase 7 (those already passed a "du"-tone pass)

</domain>

<decisions>
## Implementation Decisions

### Period label formatting (Intl.DateTimeFormat wiring)

- **D-01:** The `Intl.DateTimeFormat`-backed month-name helper lives in `frontend/src/lib/periodLabels.ts` — the existing Phase 10 module is extended, **not** forked. No new `intlLabels.ts` / `intl.ts` module. Downstream agents have one source of truth for all locale-aware period strings.
- **D-02:** Quarter labels render as language-agnostic **"Q1 / Q2 / Q3 / Q4"** in both DE and EN. Zero translation, zero new quarter.q1..q4 i18n keys. The interpolation pattern `"Revenue Q{{quarter}}"` / `"Umsatz Q{{quarter}}"` passes the literal number 1–4 into the key — the "Q" prefix lives in the locale string, not the interpolation.
- **D-03:** The i18n-language-code → Intl-locale-string map uses **short codes only**: `"DE"` → `"de"`, `"EN"` → `"en"`. No regional disambiguation (`"de-DE"` / `"en-US"`). Phase 11 only formats month names, which resolve identically across regional variants. If a future phase needs day ordering, week start day, or currency symbol regional rules, it can introduce a richer mapping helper then.
- **D-04:** The month-name helper signature: `getLocalizedMonthName(monthIndex: 0-11, locale: "de" | "en"): string`. Wraps `new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, monthIndex, 1))` — the year-2000 fixed seed avoids DST edge cases. Unit-tested in the existing `verify-phase-NN.mts` pattern.
- **D-05:** `formatChartSeriesLabel(preset, range, locale, t)` (added in Phase 10, currently English-only) is extended to call `getLocalizedMonthName` for the month case and to route all strings through `t()` using the new DE keys. The `range` argument is already unused for the quarter/year/allTime branches — Phase 11 does not change that.

### String inventory scope & audit strategy

- **D-06:** Audit scope is **narrow** — only the 10 known EN-only keys currently missing from `de.json` (verified via `diff <(jq keys en.json) <(jq keys de.json)`) plus any strings replaced by Intl output in D-01..D-05. No full-codebase sweep for hardcoded non-`t()` strings. Rationale: Phase 9/10 plans both passed plan-checker verification gates that explicitly asserted new user-visible strings live in locale files; risk of missed strings is low.
- **D-07:** The planner spot-checks `KpiCard*.tsx`, `RevenueChart.tsx`, `DashboardPage.tsx` for JSX text nodes and `aria-label={...}` values that are NOT wrapped in `t()`. If any are found, they are added to the translation set inline — this is a cheap confirmation, not a separate audit task.
- **D-08:** The locale-parity check script ships as **persistent infrastructure** at `frontend/scripts/check-locale-parity.mts` following the existing `verify-phase-NN-NN.mts` pattern. Runnable via `node --experimental-strip-types frontend/scripts/check-locale-parity.mts`. Exits `1` with a diff report on any key-set divergence, exits `0` when parity holds. Not wired into `smoke-rebuild.sh` this phase (keep that harness focused on rebuild-persistence); phase 11's Plan 11-01 verify step invokes it directly.

### i18next plural handling

- **D-09:** DE plurals mirror the EN `_one` / base-key pair structure exactly. For the `dashboard.delta.vsShortPeriod` family:
  - EN: `vsShortPeriod_one` = `"vs. 1 day earlier"`, `vsShortPeriod` = `"vs. {{count}} days earlier"`
  - DE: `vsShortPeriod_one` = `"vs. 1 Tag zuvor"`, `vsShortPeriod` = `"vs. {{count}} Tage zuvor"`
- **D-10:** No ICU MessageFormat plugin. i18next's default plural rules for German are `one` / `other` — identical in shape to English — so the existing key suffix convention works without adding `i18next-icu` or equivalent. Zero new dependencies.

### German translation choices for new v1.2 UI terms

- **D-11:** Base revenue noun in all 4 `dashboard.chart.series.*` keys is **"Umsatz"** (not "Erlös", not "Einnahmen"). Matches project-wide DE copy and Phase 9/10 ROADMAP examples.
- **D-12:** Year-specific chart series label: `"Umsatz {{year}}"` → e.g. `"Umsatz 2026"` / `"Umsatz 2025"`. Direct structural match to EN `"Revenue {{year}}"`. Not `"Umsatz im Jahr {{year}}"` (too verbose, legend wrap risk on narrow viewports).
- **D-13:** Delta badge comparison prefix keeps the **"vs."** loanword in German (matching Phase 9 ROADMAP examples "vs. Vorperiode" / "vs. Vorjahr"). Not "ggü." (too old-school), not "im Vergleich zu" (too verbose). Applies to all 4 `dashboard.delta.vs*` keys.
- **D-14:** Day-count relative delta (EN: `"vs. {{count}} days earlier"` / `"vs. 1 day earlier"`) translates literally as `"vs. {{count}} Tage zuvor"` / `"vs. 1 Tag zuvor"`. "Tage" stays in the cased nominative (not dative "Tagen") to keep the compact badge framing consistent with the other `vs.*` keys.
- **D-15:** Concrete DE translations locked by this discussion:
  - `dashboard.chart.series.revenue` → `"Umsatz"`
  - `dashboard.chart.series.revenueMonth` → `"Umsatz {{month}}"` (where `{{month}}` is Intl-provided German month name)
  - `dashboard.chart.series.revenueQuarter` → `"Umsatz Q{{quarter}}"`
  - `dashboard.chart.series.revenueYear` → `"Umsatz {{year}}"`
  - `dashboard.delta.vsCustomPeriod` → `"vs. Vorperiode"`
  - `dashboard.delta.vsYear` → `"vs. {{year}}"`
  - `dashboard.delta.vsShortPeriod` → `"vs. {{count}} Tage zuvor"`
  - `dashboard.delta.vsShortPeriod_one` → `"vs. 1 Tag zuvor"`

### Claude's Discretion

- **Exact DE phrasing for `noBaseline` / `noBaselineTooltip`** (EN: `"No comparison period available"`) — Claude proposes during planning, user reviews at verification. Recommended: `"Kein Vergleichszeitraum verfügbar"` for both, or a compact `"Kein Vergleich möglich"` for the badge + longer form for the tooltip. Constraint: informal "du" tone (Phase 7 D-17), avoid both "Sie"-form and stiff reporting prose.
- **Whether `formatChartSeriesLabel` takes the i18n `t` function as an injected parameter** (already established pattern in Phase 10) **or is refactored to import `i18next` directly** — Claude decides based on testability. Injection preserves pure-function testability in `verify-phase-11-NN.mts`; direct import is less plumbing. Default: keep injection to match Phase 10.
- **Exact signature and diff report format of `check-locale-parity.mts`** — Claude decides. Constraints: must exit non-zero on divergence, must print both missing-in-DE and missing-in-EN, must be runnable standalone without build step (uses `--experimental-strip-types`).
- **Number of plans and their wave grouping** — ROADMAP pre-scopes 3 plans (11-01 EN pass, 11-02 DE pass, 11-03 human verification). Planner may collapse 11-01 into 11-02 if the EN pass is trivial (all 10 keys already exist in EN; "EN pass" really means "replace hardcoded strings with `t()` calls + add Intl helpers"), or keep the roadmap structure. Planner's call.
- **Whether to pre-wire `check-locale-parity.mts` into the Phase 11 plan verification loop** as a hard gate — recommended yes. Plan 11-02 should fail-fast if parity diverges.

### Milestone-level human verification checkpoint (SC5)

- **D-16:** The end-to-end milestone verification (Plan 11-03 per ROADMAP) runs as a **manual-only walkthrough** — no new Playwright e2e spec added this phase. Rationale: the existing `rebuild-persistence.spec.ts` from Phase 7 covers branding persistence; adding a second e2e spec covering card deltas + chart overlay + language swap would double the Playwright surface area for marginal confidence gain over a careful human pass. The verification is a human ritual, not an automated one.
- **D-17:** The checkpoint artifact is the standard `11-VERIFICATION.md` produced by `gsd-verifier` — no separate `MILESTONE-AUDIT.md`. A subsequent `/gsd:audit-milestone v1.2` run (post-Phase-11) will consume `11-VERIFICATION.md` for the v1.2 archival audit.
- **D-18:** The human checkpoint matrix: **4 date presets × 2 languages × all 3 cards + chart**. Per-row must pass (no drift, no stale overlay, em-dash fallback where expected, German reads naturally). Checkpoint task body lists the exact steps the user follows — same pattern as Plan 10-02 Task 3.

### Folded Todos

None — no pending todos were matched to this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 (i18n foundation — tone and loanword rules are LOCKED, do not reopen)
- `.planning/phases/07-i18n-integration-and-polish/07-CONTEXT.md` — informal "du" tone rules (D-17), loanword list Dashboard/Upload/KPI/Logo (D-18), key-parity rationale (D-19), review guidance for existing DE keys (D-20)
- `frontend/src/locales/en.json` — source of truth for keys (121 total; 10 new v1.2 keys EN-only)
- `frontend/src/locales/de.json` — target for translation (111 keys; needs 10 more to reach parity)
- `frontend/src/i18n.ts` — i18next + react-i18next runtime; `keySeparator: false`, flat dot-separated keys
- `frontend/src/bootstrap.ts` — language-seeding bootstrap (do NOT modify; this phase adds translations only)

### Phase 9 (KPI card dual deltas — EN strings landed, DE pending)
- `.planning/phases/09-frontend-kpi-card-dual-deltas/09-CONTEXT.md` — delta semantics, baseline contract, em-dash fallback rules
- `frontend/src/components/dashboard/` — KpiCard* components consuming the `dashboard.delta.*` keys
- `frontend/scripts/verify-phase-09-02.mts` — existing delta formatter verify script already asserts DE number formatting (`"▲ +12,4 %"`); Phase 11 does not alter this

### Phase 10 (Chart prior-period overlay — EN strings landed, DE pending, Intl pending)
- `.planning/phases/10-frontend-chart-prior-period-overlay/10-CONTEXT.md` — chart series label semantics (D-09 `formatChartSeriesLabel` contract, D-10 per-preset label shape)
- `.planning/phases/10-frontend-chart-prior-period-overlay/10-02-SUMMARY.md` — final chart state (blue/amber tokens, legend composition)
- `frontend/src/lib/periodLabels.ts` — the module Phase 11 EXTENDS with Intl.DateTimeFormat month-name helper
- `frontend/src/components/dashboard/RevenueChart.tsx` — consumer of `formatChartSeriesLabel`; Phase 11 does not alter the component tree, only the label-producing pipeline

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — I18N-DELTA-01 (full DE/EN parity), I18N-DELTA-02 (locale-aware period labels via Intl.DateTimeFormat)
- `.planning/ROADMAP.md` §Phase 11 — success criteria SC1–SC5, pre-scoped plans 11-01/11-02/11-03
- `.planning/PROJECT.md` — v1.2 milestone goal, stack constraints (no new dependencies)
- `CLAUDE.md` — React 19 + TypeScript + i18next 17 + Tailwind v4 + shadcn; informal "du" tone continues

### Existing test infrastructure (for reference only, not extended)
- `frontend/tests/e2e/rebuild-persistence.spec.ts` — Phase 7 Playwright spec; Phase 11 does NOT add a second e2e spec (per D-16)
- `scripts/smoke-rebuild.sh` — Phase 7 harness; Phase 11 does NOT wire the new parity script into this (per D-08)
- `frontend/scripts/verify-phase-10-01.mts` — pattern for `--experimental-strip-types` verify scripts that the new `check-locale-parity.mts` should match

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `periodLabels.ts` (Phase 10) — already exports `formatChartSeriesLabel(preset, range, locale, t)`. Phase 11 extends it with `getLocalizedMonthName(monthIndex, locale)` and wires the month case through it. Preserves pure-function testability (no i18next import in the helper module).
- `verify-phase-NN-NN.mts` pattern — 3 existing scripts in `frontend/scripts/` show the shape: top-of-file imports, assertion-per-function, colored PASS/FAIL output, exit 0/1 status. The new `check-locale-parity.mts` follows this shape.
- i18next plural rules — already correctly resolving `_one` suffix for count=1; proven by Phase 9's existing EN strings. DE plural rules are a native i18next feature (no plugin) and share the one/other split with EN.
- `t()` / `useTranslation()` hook — already threaded through every dashboard component. Phase 11 does not add new call sites, only new keys + possibly replaces hardcoded strings found in the D-07 spot-check.
- `html[lang]` attribute + bootstrap language seeding — Phase 7 already handles cold-start hot-swap. Phase 11 adds strings only; no bootstrap changes.

### Established Patterns

- **Flat dot-separated keys, `keySeparator: false`** — new DE keys MUST match the EN key set byte-for-byte; any subtree restructuring breaks i18next runtime lookups.
- **Locale file alphabetization** — `en.json` and `de.json` appear sorted (scout diff confirms). New keys should be inserted alphabetically to keep future git diffs readable.
- **Injection over import** — `formatChartSeriesLabel` takes `t` as an argument rather than importing `i18next` directly. Preserves unit-testability in `verify-phase-NN.mts` scripts that run outside React + i18next context.
- **Day-count based delta strings** (discovered during scout) — `vsShortPeriod` uses a `{{count}}` interpolation + i18next plural suffix, not a period-abstracted constant. Important: the Phase 9 ROADMAP example "vs. Vorperiode" applies only to `vsCustomPeriod`, not `vsShortPeriod`.
- **One Intl call per render is fine** — `new Intl.DateTimeFormat("de", { month: "long" })` is cheap; Recharts re-renders are bounded. No memoization needed unless profiling shows otherwise.

### Integration Points

- `periodLabels.ts` → `RevenueChart.tsx` (consumer, already wired) → Recharts `<Legend>` → `name` prop of `<Bar>` / `<Line>`
- `de.json` → `i18next` runtime → `useTranslation().t(key, { month, year, quarter, count })` → rendered JSX text node
- `check-locale-parity.mts` → `en.json` + `de.json` → `process.exit(0|1)` — standalone, no dependencies, runnable pre-commit
- `gsd-planner` → reads this CONTEXT.md → locks D-01..D-18 → produces 3 plans (or fewer if collapsed) → `gsd-plan-checker` verifies against decisions → `gsd-executor` implements

</code_context>

<specifics>
## Specific Ideas

- Intl.DateTimeFormat seed date: `new Date(2000, monthIndex, 1)` — year 2000 chosen arbitrarily; day-1 avoids DST edge cases; no locale-specific day-name drift.
- Short locale codes: `"de"` / `"en"` — exact strings, lowercase, matching the i18next resource keys already in place.
- Parity script filename: `frontend/scripts/check-locale-parity.mts` — "check-" prefix distinguishes from "verify-phase-" per-phase throwaway scripts.
- Parity script invocation: `node --experimental-strip-types frontend/scripts/check-locale-parity.mts`
- Parity script failure output format: one line per diverging key: `MISSING_IN_DE: dashboard.foo.bar` / `MISSING_IN_EN: dashboard.baz.qux`, followed by a summary line `PARITY FAIL: 10 missing in DE, 0 missing in EN`.
- `getLocalizedMonthName` should NOT be memoized — called at most twice per render (current + prior month labels), Intl.DateTimeFormat constructor is O(1) in practice.
- Specific DE phrasings user reviewed at discuss-phase (D-15): `Umsatz`, `Umsatz {{month}}`, `Umsatz Q{{quarter}}`, `Umsatz {{year}}`, `vs. Vorperiode`, `vs. {{year}}`, `vs. {{count}} Tage zuvor`, `vs. 1 Tag zuvor`.
- The existing DE number-formatting output `"▲ +12,4 %"` from Phase 9 is proof that `toLocaleString("de-DE", ...)` (or equivalent) already works in the delta pipeline — Phase 11 does NOT re-implement number formatting.

</specifics>

<deferred>
## Deferred Ideas

- **Intl.NumberFormat / currency formatting pass** — deferred from Phase 7 to "a future Dashboard i18n phase". Not Phase 11. Belongs in a later dashboard-polish phase once the full i18n foundation is stable and the user has observed DE/EN side-by-side on real data.
- **Full codebase hardcoded-string sweep** — explicitly rejected in D-06 as too aggressive. Revisit if Phase 11 verification surfaces missed strings.
- **Playwright e2e spec covering 4 presets × 2 languages × card+chart** — rejected in D-16 as marginal over a careful human walkthrough.
- **Parity script in `smoke-rebuild.sh`** — rejected in D-08; keep rebuild harness narrowly focused.
- **Additional languages beyond DE/EN** — still out of scope (Phase 7 deferred list).
- **ICU MessageFormat plugin** — not needed; i18next defaults handle DE one/other.
- **"Vorwoche / previous week" period labels** — ROADMAP mentioned this as an example but no weekly preset exists in the filter UI. Revisit if a future phase adds a weekly preset.
- **Retroactive tone review of existing 111 DE keys** — Phase 7 already passed this check. Not reopening unless verification surfaces regressions.

### Reviewed Todos (not folded)

None — no pending todos matched this phase.

</deferred>

---

*Phase: 11-i18n-contextual-labels-and-polish*
*Context gathered: 2026-04-12*
</content>
</invoke>