# Phase 5: Frontend Plumbing — ThemeProvider and NavBar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 5-frontend-plumbing-themeprovider-and-navbar
**Areas discussed:** FOUC strategy, NavBar layout, CSS variable injection, useSettings hook shape

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| FOUC strategy | Gating + loading behavior during settings fetch | ✓ |
| NavBar layout | Logo/text coexistence, Settings link placement, bar height | ✓ |
| CSS var injection | How ThemeProvider writes oklch tokens onto :root | ✓ |
| useSettings hook shape | Query config, side-effect ownership, brand text source, title handling | ✓ |

**User's choice:** All four areas selected.

---

## FOUC strategy

### Q1: What renders while GET /api/settings is loading?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen skeleton (Recommended) | ThemeProvider blocks children until settings resolve. Neutral background, centered skeleton. Zero flash risk. | ✓ |
| Empty NavBar + page skeleton | Shell NavBar with skeleton body. Slightly faster perceived load, more moving parts. | |
| Blank neutral screen | Pure background color, no spinner. Cheapest, may feel broken. | |

**User's choice:** Full-screen skeleton.

### Q2: Error handling if GET /api/settings fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to built-in defaults + toast (Recommended) | Apply frontend defaults, render app, fire sonner error toast. | ✓ |
| Full-screen error with retry | Block app entirely behind an error screen with Retry. | |
| Silent fall back to defaults | Use defaults, no toast. | |

**User's choice:** Fall back to defaults + toast.

---

## NavBar layout

### Q1: Logo and app name coexistence?

| Option | Description | Selected |
|--------|-------------|----------|
| Logo OR text, mutually exclusive (Recommended) | If logo set: logo only. Otherwise: stored app_name text. Matches BRAND-03 literal. | ✓ |
| Logo AND text always | Both visible. Wider footprint, cramped at 1080p. | |
| Logo always, text as aria only | Logo slot always present with placeholder. Bad for no-logo default case. | |

**User's choice:** Logo XOR text.

### Q2: Settings link placement?

| Option | Description | Selected |
|--------|-------------|----------|
| Right side, icon only (Recommended) | Gear icon grouped with FreshnessIndicator + LanguageToggle. Treats Settings as a utility. | ✓ |
| Left side, text link | Text link after Upload. Equal-weight nav. | |
| Right side, text link | Text instead of icon. | |

**User's choice:** Right side, gear icon.

### Q3: NavBar height to accommodate 60×60 logo?

| Option | Description | Selected |
|--------|-------------|----------|
| Fit in h-16, max 56×56 visual (Recommended) | Keep existing h-16 bar. CSS constrain logo to ~56px. Interprets "60×60" as size class. | ✓ |
| Grow NavBar to h-20 (80px) | Bump height to fit literal 60×60. Shifts page layout. | |

**User's choice:** Fit in h-16.

---

## CSS variable injection

### Q1: How does ThemeProvider write the 6 oklch tokens?

| Option | Description | Selected |
|--------|-------------|----------|
| document.documentElement.style.setProperty (Recommended) | useEffect calls setProperty for each token. Inline style specificity overrides :root defaults. React-friendly. | ✓ |
| Inject a <style> tag into <head> | Create/update <style id='app-theme'>. More moving parts, no advantage here. | |
| Rewrite index.css at build time | Not viable for runtime data. Listed to rule out. | |

**User's choice:** setProperty on document.documentElement.

### Q2: Which tokens does Phase 5 inject?

| Option | Description | Selected |
|--------|-------------|----------|
| Only the 6 user-editable tokens (Recommended) | primary, accent, background, foreground, muted, destructive. Other tokens stay as defaults. | ✓ |
| 6 + auto-derive foregrounds | Compute contrasting foregrounds via culori. Out of scope for Phase 5. | |

**User's choice:** 6 tokens only.

---

## useSettings hook shape

### Q1: TanStack Query configuration?

| Option | Description | Selected |
|--------|-------------|----------|
| queryKey ['settings'], staleTime Infinity, gcTime Infinity (Recommended) | Fetch once; never auto-refetch. Phase 6 mutation invalidates. Matches v1.0 kpiKeys pattern. | ✓ |
| queryKey ['settings'], default staleTime (0) | Refetches on focus. Unnecessary traffic. | |
| No TanStack Query — React context | Breaks v1.0 pattern. Rejected. | |

**User's choice:** staleTime Infinity.

### Q2: Hook return shape + side-effect ownership?

| Option | Description | Selected |
|--------|-------------|----------|
| Hook returns data; ThemeProvider applies side effects (Recommended) | useSettings returns { data, isLoading, error }. ThemeProvider is single writer for CSS vars + title. | ✓ |
| Hook applies side effects internally | Any component calling useSettings triggers side effects. Fragile. | |
| Hook returns data + explicit applyTheme() | Flexible but pushes complexity to Phase 6. | |

**User's choice:** Hook returns data; ThemeProvider owns side effects.

### Q3: Fate of nav.brand i18n key?

| Option | Description | Selected |
|--------|-------------|----------|
| Use settings.app_name, keep nav.brand in locales (Recommended) | Delete t('nav.brand') call site in NavBar. Leave locale keys for Phase 7. | ✓ |
| Delete nav.brand from locale files now | Also edits de.json/en.json. Touches Phase 7 territory. | |

**User's choice:** Use app_name, leave locale keys alone.

### Q4: How does ThemeProvider set document.title?

| Option | Description | Selected |
|--------|-------------|----------|
| Single useEffect in ThemeProvider (Recommended) | useEffect on settings.app_name sets document.title. One writer. | ✓ |
| Per-page useEffect with app name prefix | Each page sets its own title. Boilerplate for zero current benefit. | |

**User's choice:** Single useEffect in ThemeProvider.

---

## Claude's Discretion

- Skeleton visual style (spinner vs shimmer bars vs fade-in)
- ThemeProvider as wrapper component vs hook + gate component split
- Settings gear tooltip i18n keys (likely `nav.settings`)
- `fetchSettings` lives in `lib/api.ts` (recommended) or new `lib/settings.ts`
- Test strategy (vitest + RTL + jsdom; MSW or fetch mocks — match existing v1.0 setup)
- Whether to prefetch settings in main.tsx for micro-optimization

## Deferred Ideas

- Language wiring via i18n.changeLanguage → Phase 7 (I18N-02)
- Removing nav.brand locale keys from de.json/en.json → Phase 7
- Page-specific document.title suffixes → not needed today
- Dark mode → v1.2+
- Settings prefetch in main.tsx → planner's call
- Auto-derived foreground contrast colors → Phase 6 + culori
- DELETE /api/settings/logo endpoint → backend deferred
