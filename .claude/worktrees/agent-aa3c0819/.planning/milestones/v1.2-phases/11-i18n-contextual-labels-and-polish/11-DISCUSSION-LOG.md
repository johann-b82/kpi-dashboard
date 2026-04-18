# Phase 11: i18n, Contextual Labels, and Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Downstream agents read `11-CONTEXT.md` instead.

**Gathered:** 2026-04-12
**Mode:** discuss (interactive, 3 of 4 presented gray areas selected)

---

## Gray Area Selection

**Presented areas (4):**
1. Period label formatting (Intl.DateTimeFormat wiring)
2. String inventory & parity-check mechanism
3. German translations for new v1.2 UI terms
4. Milestone-level human verification checkpoint

**User selected:** 1, 2, 3
**Skipped:** 4 (defaulted to manual-only walkthrough per Phase 7 precedent — see D-16/17/18)

---

## Area 1: Period label formatting (Intl.DateTimeFormat wiring)

### Q1.1 — Module location

**Q:** Where should the Intl.DateTimeFormat-based label formatter live?

**Options:**
- **Extend periodLabels.ts (Recommended)** — Add new Intl-backed functions alongside the existing formatChartSeriesLabel / formatPeriodLabel helpers. Single source of truth. ✅ **selected**
- New `frontend/src/lib/intlLabels.ts` — Separate module dedicated to Intl formatters. Clean separation but two files to keep in sync.

**→ D-01**

### Q1.2 — Quarter labels

**Q:** How should quarter labels render? Intl.DateTimeFormat has no quarter primitive.

**Options:**
- **Language-agnostic "Q1 / Q2 / Q3 / Q4" (Recommended)** — Same label in both languages. Compact, universally understood. ✅ **selected**
- Translated: "Q1" (EN) / "1. Quartal" (DE) — Verbose in legend.
- Translated short: "Q1" (EN) / "1. Qu." (DE) — Unusual.

**→ D-02**

### Q1.3 — Locale code mapping

**Q:** How should the i18n language code map to the Intl locale string?

**Options:**
- **Short codes: "de" / "en" (Recommended)** — Intl resolves defaults. Sufficient for month names. ✅ **selected**
- Regional codes: "de-DE" / "en-US" — Adds mapping helper for no current benefit.
- Regional codes: "de-DE" / "en-GB" — Only matters for day-level labels.

**→ D-03**

---

## Area 2: String inventory & parity-check mechanism

### Q2.1 — Audit aggression

**Q:** How aggressive should the string inventory audit be?

**Options:**
- **Just the 10 known missing keys + any Intl-replaced strings (Recommended)** — Matches ROADMAP scope. Plan-checker gates in 9/10 already asserted user-visible strings lived in locale files. ✅ **selected**
- Full sweep: grep Phase 9/10 source for non-t() strings — Catches more, risks scope creep.
- Full sweep + pre-translation checklist — Most thorough, slowest.

**→ D-06, D-07**

### Q2.2 — i18next plural handling

**Q:** How should plural handling work for the `vsShortPeriod_one` / `vsShortPeriod` pair?

**Context provided:** The actual EN strings are day-count based ("vs. {{count}} days earlier" / "vs. 1 day earlier"), not period-abstracted like the ROADMAP example suggested.

**Options:**
- **Mirror EN: add matching _one + base key in de.json (Recommended)** — German default plural rules are one/other, same as English. Zero config changes. ✅ **selected**
- Collapse plurals: ICU-style interpolation — Requires ICU plugin (new dependency).
- Investigate further — Pause and audit.

**→ D-09, D-10**

### Q2.3 — Parity-check persistence

**Q:** Should Phase 11 ship a persistent locale-parity check script, or one-shot only?

**Options:**
- **Persistent script: frontend/scripts/check-locale-parity.mts (Recommended)** — Matches verify-phase-NN pattern. Low cost, high future value. ✅ **selected**
- One-shot inline diff in plan verification — Fastest but Phase 12+ has to reinvent.
- Persistent script + wire into smoke-rebuild.sh — More thorough, more surface area.

**→ D-08**

---

## Area 3: German translations for new v1.2 UI terms

### Q3.1 — Revenue base noun

**Q:** Base noun for "Revenue" in the 4 chart.series keys?

**Options:**
- **Umsatz (Recommended)** — Matches project-wide usage and Phase 9/10 ROADMAP examples. ✅ **selected**
- Erlös — More accounting-formal.
- Einnahmen — More colloquial.

**→ D-11, D-15**

### Q3.2 — Year label form

**Q:** How should the year-specific chart series label render? (EN: "Revenue {{year}}")

**Options:**
- **"Umsatz {{year}}" — "Umsatz 2026" (Recommended)** — Direct structural match. Compact. ✅ **selected**
- "Umsatz im Jahr {{year}}" — Verbose; legend wrap risk.
- "{{year}}" bare — Loses noun context.

**→ D-12, D-15**

### Q3.3 — Comparison prefix

**Q:** How should "vs." prefix read in the delta badge labels?

**Options:**
- **Keep "vs." loanword (Recommended)** — Matches compact EN forms. Common in German business dashboards. ✅ **selected**
- "ggü." — Old-school financial reporting.
- "im Vergleich zu" — Doubles badge width.

**→ D-13**

### Q3.4 — Day-count delta phrasing

**Q:** How should the German form of `vsShortPeriod` ("vs. {{count}} days earlier") read?

**Options:**
- **Literal: "vs. {{count}} Tage zuvor" / "vs. 1 Tag zuvor" (Recommended)** — Direct structural match. Preserves "vs." framing. ✅ **selected**
- Natural: "vor {{count}} Tagen" — Loses "vs." framing, creates inconsistency.
- Shorter: "vs. Vortag" / "vs. letzten X Tagen" — Harder to i18next-ify cleanly.

**→ D-14, D-15**

---

## Close-out

**Q:** Ready to write CONTEXT.md, more questions, or revisit?

**Options:**
- **Ready for context (Recommended)** ✅ **selected**
- More questions (Area 4: milestone verification checkpoint)
- Revisit one of the 3 areas

**Result:** Area 4 defaulted in CONTEXT.md per Phase 7 precedent: manual-only walkthrough, VERIFICATION.md as artifact, separate from /gsd:audit-milestone. See D-16/17/18.

---

## Decision Summary

18 locked decisions (D-01 through D-18) covering:
- Module location for Intl helpers (periodLabels.ts extension)
- Quarter rendering (language-agnostic "Q1/Q2/Q3/Q4")
- Locale code mapping (short "de"/"en")
- getLocalizedMonthName signature
- formatChartSeriesLabel extension
- Narrow audit scope (10 known keys + spot-checked JSX)
- Plural mirroring (no ICU plugin)
- Persistent parity script
- Revenue noun ("Umsatz")
- Year label shape ("Umsatz {{year}}")
- "vs." loanword
- Day-count literal translation
- All 8 concrete DE strings for the v1.2 key set
- Manual-only milestone verification
- VERIFICATION.md as artifact (no separate MILESTONE-AUDIT.md)
- Human checkpoint matrix (4 presets × 2 languages × 3 cards + chart)

Claude's Discretion retained for:
- Exact `noBaseline` / `noBaselineTooltip` phrasing
- `formatChartSeriesLabel` `t` injection vs import
- `check-locale-parity.mts` exact signature and report format
- Plan collapsing (3 plans or fewer)
- Parity-script gating in plan verification loop

---

*Phase: 11-i18n-contextual-labels-and-polish*
*Discussion conducted: 2026-04-12*
</content>
</invoke>