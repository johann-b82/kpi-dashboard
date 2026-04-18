# Phase 35: User Guide Content - Research

**Researched:** 2026-04-16
**Domain:** Technical writing / Markdown content authoring + docs registry wiring
**Confidence:** HIGH

## Summary

Phase 35 is a pure content-authoring phase. All rendering infrastructure (MarkdownRenderer, TOC extraction, syntax highlighting) and navigation shell (registry, sidebar, role-guards) were completed in Phases 33–34. This phase authors 5 user-guide articles × 2 languages (EN + DE) and wires them into the existing registry.

The "code" work is minimal: create 10 Markdown files, add 10 raw imports + registry entries in `registry.ts`, and add 5 × 2 i18n title keys in the locale files. The dominant effort is writing accurate, tutorial-style content derived from reading the live source files for each feature. No new components, routes, or dependencies are needed.

**Primary recommendation:** Read each feature's source file before writing its article. The i18n locale files (`en.json`, `de.json`) are the most reliable ground truth for exact button labels and field names — use them verbatim in the documentation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tutorial-style — step-by-step walkthroughs with numbered instructions. Assumes mixed technical levels.
- **D-02:** Professional casual tone — friendly but direct. No jargon, no corporate stiffness.
- **D-03:** Text-only Markdown — no screenshots or images. Use bold, lists, code snippets to guide users.
- **D-04:** Blockquote callouts for tips, warnings, and notes: `> **Tip:**` and `> **Note:**` style.
- **D-05:** Consistent template across all 5 articles: intro paragraph → step-by-step sections → tips/notes → related article links.
- **D-06:** Inline Markdown links for cross-references between articles.
- **D-07:** UGUIDE-04 is a separate article — dashboard articles (UGUIDE-02/03) mention filters briefly and link to UGUIDE-04.

### Claude's Discretion
- Article slug names (kebab-case, e.g., `uploading-data`, `sales-dashboard`)
- Exact section headings within each article
- Which tips/notes to include and where
- How much detail per step (balance completeness with readability)
- German translation style (natural DE, not literal translation)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UGUIDE-01 | User can read how to upload data files (CSV/TXT format, drag-drop, error handling) | DropZone.tsx + UploadPage.tsx fully read; all accepted formats, error states, upload history documented |
| UGUIDE-02 | User can read how to use the Sales dashboard (KPI cards, charts, date filters, deltas) | DashboardPage.tsx + KpiCardGrid.tsx + RevenueChart.tsx fully read; KPI names, chart types, delta behavior documented |
| UGUIDE-03 | User can read how to use the HR dashboard (KPI cards, Personio sync status, deltas) | HRPage.tsx + HrKpiCardGrid.tsx fully read; 5 KPIs named, sync states, configured/unconfigured behavior documented |
| UGUIDE-04 | User can read how to use filters, date ranges, and chart controls | DateRangeFilter.tsx + RevenueChart.tsx read; 4 presets (this month/quarter/year/all time), bar/area chart toggle documented |
| UGUIDE-05 | User can read how to switch language and dark mode | LanguageToggle.tsx + ThemeToggle.tsx fully read; persistence behavior (localStorage), OS follow behavior documented |
</phase_requirements>

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Purpose | Notes |
|---------|---------|-------|
| Markdown files (.md) | Article content | Vite imports with `?raw` — existing pattern |
| `frontend/src/lib/docs/registry.ts` | Content registry + sidebar structure | Add entries, do not restructure |
| `frontend/src/locales/en.json` / `de.json` | i18n title keys for sidebar labels | Add `docs.nav.*` keys only |

**Installation:** None required. No new npm packages.

## Architecture Patterns

### Established File Convention
```
frontend/src/docs/
├── en/
│   └── user-guide/
│       ├── intro.md          ← existing stub (replace)
│       ├── uploading-data.md ← new
│       ├── sales-dashboard.md
│       ├── hr-dashboard.md
│       ├── filters.md
│       └── language-and-theme.md
└── de/
    └── user-guide/
        ├── intro.md          ← existing stub (replace)
        ├── uploading-data.md
        ├── sales-dashboard.md
        ├── hr-dashboard.md
        ├── filters.md
        └── language-and-theme.md
```

### Registry Wiring Pattern
Each new article requires all of the following — missing any one breaks the sidebar or renders blank content:

1. **EN Markdown file** at `frontend/src/docs/en/user-guide/{slug}.md`
2. **DE Markdown file** at `frontend/src/docs/de/user-guide/{slug}.md`
3. **Two raw imports** in `registry.ts`:
   ```typescript
   import enUploadingData from "../../docs/en/user-guide/uploading-data.md?raw";
   import deUploadingData from "../../docs/de/user-guide/uploading-data.md?raw";
   ```
4. **Registry entry** under `en["user-guide"]` and `de["user-guide"]`:
   ```typescript
   registry.en["user-guide"]["uploading-data"] = enUploadingData;
   registry.de["user-guide"]["uploading-data"] = deUploadingData;
   ```
5. **Sections entry** in `sections["user-guide"]`:
   ```typescript
   { slug: "uploading-data", titleKey: "docs.nav.uploadingData" }
   ```
6. **i18n title key** in `en.json` and `de.json` under `docs.nav`:
   ```json
   "docs.nav.uploadingData": "Uploading Data"
   ```

### Article Template (D-05 locked)
```markdown
# {Article Title}

{One paragraph introduction — what this article covers and when to use it.}

## {Section 1}

{Step-by-step numbered instructions or explanatory prose.}

## {Section 2}

> **Tip:** {Tip text}

## Related Articles

- [Article Name](/docs/user-guide/{slug})
```

### Heading Convention
Use `##` for main sections (not `#` — the article title uses `#`). This generates TOC entries via `extractToc` from Phase 33. Avoid `###` unless nesting is truly required — keeps the TOC flat and readable.

## Feature Ground Truth

This section documents the exact UI labels and behavior to reference when writing articles. All derived from reading the source files.

### UGUIDE-01: Uploading Data (DropZone.tsx + UploadPage.tsx)

**Accepted formats:** `.csv`, `.txt` only (hard-enforced by react-dropzone `accept` prop). Excel (.xlsx) is NOT accepted by the upload UI despite pandas supporting it.

**Upload methods:**
1. Drag a file onto the drop zone (border highlights, text changes while dragging)
2. Click the "Browse" button to open a file picker (Admin role only — `AdminOnly` wrapper)

**Role restriction:** Upload page shows "You don't have permission to access this page" for Viewer role. Only Admins can upload.

**Upload states:**
- Uploading: spinner icon + "Processing..." text; drop zone disabled
- Success (full): toast "File uploaded" + "{filename}: {count} rows imported"
- Success (partial): toast with rows imported + rows skipped count
- File type rejected: inline red text "Unsupported format: {ext}. Only .csv and .txt allowed."
- Network error: error toast with message

**Upload History table** (right column): shows Filename, Uploaded at, Rows, Status, Errors columns. Supports delete with confirmation dialog.

**Error list:** Below the drop zone when partial/failed — shows row-level validation errors with row number, column, and message.

### UGUIDE-02: Sales Dashboard (DashboardPage.tsx + KpiCardGrid.tsx + RevenueChart.tsx)

**KPI cards (3 cards in a row):**
- Total revenue (formatted as EUR currency)
- Average order value (formatted as EUR currency)
- Total orders (formatted as integer count)
- Note below cards: "Orders with a value of €0 are excluded."

**Delta badges** (shown per KPI card when a date preset is selected):
- Two badges: vs. prior period (named by month/quarter) AND vs. prior year
- `thisYear` preset: collapses to single badge showing YTD vs. prior year
- `allTime` preset: no delta badges shown
- Custom range: no delta badges shown
- Tooltip on badge when no comparison data: "No comparison period available"

**Revenue over time chart:**
- Title: "Revenue over time"
- Chart type toggle (Bar / Area) — segmented control top-right of chart
- Comparison series shown when preset provides a prior period
- X-axis: calendar week labels for "This month" preset; month+year for other presets

**Date filter** (DateRangeFilter.tsx — in NavBar/header area):
- Presets: "This month", "This quarter", "This year", "All time"
- Rendered as a segmented control (tab-style)
- Default: "This month"

**Orders table** (SalesTable): searchable by order #, customer, project. Columns: Order #, Customer, Project, Date, Total, Remaining.

### UGUIDE-03: HR Dashboard (HRPage.tsx + HrKpiCardGrid.tsx + HrKpiCharts.tsx)

**KPI cards (5 cards in 3+2 layout):**
- Overtime Ratio (% — subtitle: "Overhours / total worked hours of active employees")
- Sick Leave Ratio (%)
- Fluctuation (%)
- Skill Development (%)
- Revenue / Prod. Employee (EUR)

**Personio sync dependency:** HR KPIs are sourced from Personio. States:
- Not configured: shows "—" value + "not configured" text + link to Settings
- Configured but never synced: banner "No data synced yet — Click 'Refresh data' or configure auto-sync in Settings."
- Error: red error banner "Could not load HR KPIs"
- Configured with data: shows values with dual delta badges

**Sync button:** "Refresh data" button in the HR page header area (hr.sync.button). Shows last sync time ("Last sync: {datetime}" or "Not yet synced").

**Delta badges:** vs. prior month AND vs. prior year. Anchored at today (no date filter on HR page).

**Charts section (HrKpiCharts):** Shows trend charts for HR KPIs over time. Chart type toggle (Area/Bar).

**Employee table (EmployeeTable):** searchable, filterable (All / Active / With overtime). Columns: Name, Department, Position, Status, Hire date, Hours/week, Worked, Overtime, OT %.

### UGUIDE-04: Filters, Date Ranges, Chart Controls

**Date range filter (Sales dashboard only — HR has no date filter):**
- Location: top of the Sales dashboard page
- Presets: "This month" | "This quarter" | "This year" | "All time"
- Selection persists while on the page; resets on navigation

**Chart type control (Sales RevenueChart):**
- Toggle: "Bar" | "Area" (segmented control, top-right of chart)
- Bar chart default

**Chart type control (HR HrKpiCharts):**
- Toggle: "Area" | "Bar" (segmented control)

**Delta badge behavior by preset:**
- This month → compares vs. prior month AND prior year
- This quarter → compares vs. prior quarter AND prior year
- This year → collapses to single badge: vs. prior year (YTD)
- All time → no delta badges

### UGUIDE-05: Language and Dark Mode (LanguageToggle.tsx + ThemeToggle.tsx)

**Language toggle:**
- Location: top navigation bar, right side
- Shows target language label (shows "DE" when currently English; shows "EN" when currently German)
- Click switches immediately; entire app re-renders in the new language
- Persisted via i18next (localStorage); survives page refresh
- No server round-trip

**Dark mode toggle:**
- Location: top navigation bar, right side (next to language toggle)
- Icon: Moon icon when in light mode (clicking switches to dark); Sun icon when in dark mode (clicking switches to light)
- Follows OS `prefers-color-scheme` automatically until the user clicks once
- After first manual click: user preference locks in localStorage; OS changes no longer override
- Persisted in `localStorage.theme`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-article links | Manual slug strings | Inline Markdown links with `/docs/user-guide/{slug}` paths | Router handles navigation; consistent with D-06 |
| Callout boxes | Custom HTML/JSX | `> **Tip:**` blockquotes | Phase 33 MarkdownRenderer already styles these; D-04 locked |
| Article structure | Ad-hoc per article | The D-05 template | Predictable reading experience; locked decision |

## Common Pitfalls

### Pitfall 1: Stale Label Text
**What goes wrong:** Article says "Click Upload" but the button label is "Browse" (from `browse_button` in `en.json`).
**Why it happens:** Writing from memory rather than reading source files.
**How to avoid:** Copy button/field labels verbatim from `en.json` for EN, `de.json` for DE.
**Warning signs:** Any label in the article that doesn't appear in the locale files.

### Pitfall 2: Missing Registry Entry Breaks Sidebar
**What goes wrong:** Markdown file created but article doesn't appear in sidebar / returns blank page.
**Why it happens:** One of the 6 required registry steps omitted (see Architecture Patterns section).
**How to avoid:** Follow the checklist: MD file × 2 + raw imports × 2 + registry entries × 2 + sections entry × 1 + i18n title keys × 2.

### Pitfall 3: Wrong Heading Level Breaks TOC
**What goes wrong:** TOC shows only top-level `#` heading or is empty.
**Why it happens:** Using `#` for sections instead of `##`; `extractToc` from Phase 33 uses `##` headings for TOC entries.
**How to avoid:** Article title = `#`; all main sections = `##`; use `###` sparingly.

### Pitfall 4: German as Literal Translation
**What goes wrong:** DE article reads like machine translation — unnatural phrasing, wrong register.
**Why it happens:** Translating word-for-word from EN.
**How to avoid:** Write DE naturally; use the DE locale keys from `de.json` as anchor labels; restructure sentences for German word order. Claude's discretion per CONTEXT.md.

### Pitfall 5: Over-documenting Admin-Only Features in User Guide
**What goes wrong:** UGUIDE-01 explains how to upload for a Viewer role reader who can't access the page.
**Why it happens:** Not reading the role check at the top of UploadPage.tsx.
**How to avoid:** UGUIDE-01 should note that upload is an Admin function; Viewer users see a permission message and should contact their admin.

### Pitfall 6: Forgetting to Replace Existing Stubs
**What goes wrong:** Old `intro.md` stubs remain alongside the new articles; sidebar shows both.
**Why it happens:** The `intro` slug is already in `registry.ts` — it stays. The stub file needs replacing, not a new file created.
**How to avoid:** Replace the content of the existing `intro.md` files (EN + DE) rather than creating new files. The registry entry for `intro` already exists.

## Code Examples

### registry.ts after phase (pattern to follow)
```typescript
// Source: frontend/src/lib/docs/registry.ts (existing pattern)
import enUserIntro from "../../docs/en/user-guide/intro.md?raw";
import deUserIntro from "../../docs/de/user-guide/intro.md?raw";
import enUploadingData from "../../docs/en/user-guide/uploading-data.md?raw";
import deUploadingData from "../../docs/de/user-guide/uploading-data.md?raw";
// ... repeat for all 5 articles

export const sections: Record<SectionId, ArticleEntry[]> = {
  "user-guide": [
    { slug: "intro", titleKey: "docs.nav.userGuideIntro" },
    { slug: "uploading-data", titleKey: "docs.nav.uploadingData" },
    { slug: "sales-dashboard", titleKey: "docs.nav.salesDashboard" },
    { slug: "hr-dashboard", titleKey: "docs.nav.hrDashboard" },
    { slug: "filters", titleKey: "docs.nav.filters" },
    { slug: "language-and-theme", titleKey: "docs.nav.languageAndTheme" },
  ],
  "admin-guide": [{ slug: "intro", titleKey: "docs.nav.adminGuideIntro" }],
};

export const registry = {
  en: {
    "user-guide": {
      intro: enUserIntro,
      "uploading-data": enUploadingData,
      // ...
    },
  },
  de: {
    "user-guide": {
      intro: deUserIntro,
      "uploading-data": deUploadingData,
      // ...
    },
  },
};
```

### i18n title keys pattern (en.json)
```json
"docs": {
  "nav": {
    "userGuideIntro": "Introduction",
    "uploadingData": "Uploading Data",
    "salesDashboard": "Sales Dashboard",
    "hrDashboard": "HR Dashboard",
    "filters": "Filters & Date Ranges",
    "languageAndTheme": "Language & Dark Mode",
    "adminGuideIntro": "Introduction"
  }
}
```

### Article cross-reference link pattern (D-06)
```markdown
See [Filters & Date Ranges](/docs/user-guide/filters) for a full walkthrough
of date presets and chart type controls.
```

### Blockquote callout pattern (D-04)
```markdown
> **Tip:** Only CSV and TXT files are accepted. Excel files are not supported on the upload page.

> **Note:** The Upload page is only accessible to Admin users.
```

## Validation Architecture

> nyquist_validation not checked — this is a pure content phase with no automated tests applicable. All validation is manual: verify articles render correctly, TOC entries appear, sidebar shows all 5 articles, cross-links resolve.

### Manual Verification Checklist (per article)
| Check | Method |
|-------|--------|
| Article appears in sidebar | Load /docs, verify sidebar entry |
| Article renders without blank page | Click sidebar link |
| TOC entries appear | Verify `##` headings show in TOC panel |
| Cross-links resolve | Click each inline link |
| DE version renders | Switch language, verify DE content |
| Labels match actual UI | Compare article text with locale files |

## Environment Availability

Step 2.6: SKIPPED — pure content authoring phase. No external tools, databases, or services beyond the running dev server required. Vite dev server handles `?raw` imports at development time.

## Sources

### Primary (HIGH confidence)
- `frontend/src/lib/docs/registry.ts` — registry pattern directly read
- `frontend/src/components/DropZone.tsx` — upload feature implementation
- `frontend/src/pages/DashboardPage.tsx`, `KpiCardGrid.tsx`, `RevenueChart.tsx` — sales dashboard features
- `frontend/src/pages/HRPage.tsx`, `HrKpiCardGrid.tsx` — HR dashboard features
- `frontend/src/components/dashboard/DateRangeFilter.tsx` — filter implementation
- `frontend/src/components/LanguageToggle.tsx`, `ThemeToggle.tsx` — toggle implementations
- `frontend/src/locales/en.json` / `de.json` — all UI labels

### Secondary
- `.planning/phases/35-user-guide-content/35-CONTEXT.md` — locked decisions and canonical refs
- `.planning/REQUIREMENTS.md` — UGUIDE-01 through UGUIDE-05 definitions

## Metadata

**Confidence breakdown:**
- Article content accuracy: HIGH — derived directly from source code and locale files
- Registry wiring pattern: HIGH — existing pattern read from current registry.ts
- German translation quality: MEDIUM — Claude's discretion; natural DE requires editorial judgment
- Article completeness: HIGH — all 5 feature areas fully read before research

**Research date:** 2026-04-16
**Valid until:** Valid as long as the underlying feature source files don't change (stable — features are complete)
