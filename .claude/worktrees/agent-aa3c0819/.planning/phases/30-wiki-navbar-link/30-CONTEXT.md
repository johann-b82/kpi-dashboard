---
phase: 30
name: wiki-navbar-link
created: 2026-04-15
---

# Phase 30 Context — Wiki NavBar Link

## Phase Goal

KPI Light NavBar gains a wiki icon opening Outline (`https://wiki.internal`) in a new tab, positioned between LanguageToggle and Upload icon, with translated tooltip.

## Domain Boundary

**In scope:** NavBar icon button + i18n keys + small env-driven URL config.

**Out of scope:** Embedded wiki UI; any in-app iframing of Outline; auth handoff beyond the shared Dex session from Phases 27-29; wiki search integration (future milestone).

## Carried-Forward Decisions

- **Icon library = lucide-react** — already used by NavBar for Moon/Sun/Upload icons (Phase 22/24 NavBar work)
- **i18n pattern = react-i18next** with flat keys (Phase 07 conventions, reaffirmed in Phase 28 D — dual flat + nested keys because `keySeparator: false`)
- **Outline lives at `https://wiki.internal`** (Phase 29 WIK-01)
- **No dedicated NavBar tests** — existing pattern relies on manual UAT + TS type check (Phase 24/25 precedent)

## Decisions (Phase 30)

### D-01: Use `BookOpen` from lucide-react
Clear library/docs semantic; pairs visually with existing 20-24px icon sizing in NavBar. No custom SVG.

### D-02: URL via env var `VITE_WIKI_URL` with default `https://wiki.internal`
Vite-style env (`VITE_*` is auto-exposed to `import.meta.env`). Code:
```ts
const WIKI_URL = import.meta.env.VITE_WIKI_URL ?? "https://wiki.internal";
```
Add `VITE_WIKI_URL=https://wiki.internal` to `.env.example` alongside existing frontend env vars. Makes a real-domain redeploy a one-env-var change with zero code edit.

### D-03: `target="_blank"` + `rel="noopener noreferrer"`
Standard security posture for external links opened in new tab. Prevents `window.opener` access and referrer leak.

### D-04: i18n key `nav.wiki` → `"Wiki"` in both EN and DE
Per existing dual flat+nested convention (Phase 28 D for `auth.logout`): write both flat key `"nav.wiki": "Wiki"` AND nested `"nav": { "wiki": "Wiki" }` in `en.json` / `de.json` so `t("nav.wiki")` works under `keySeparator: false` and grep-by-nested-key also passes.

Used as the `title` attribute AND `aria-label` on the anchor.

### D-05: Position in NavBar — between LanguageToggle and Upload icon
Exact DOM order: `ThemeToggle` → `LanguageToggle` → **`WikiLink` (new)** → `UploadLink` → `UserChunk`. Matches NAV-02.

### D-06: Rendered as `<a>` not `<button>` or `<Link>`
External link opening in a new tab → plain anchor with `href`. No React Router involvement. No onClick handler needed.

## Folded Todos

None — no pending todos matched Phase 30 scope.

## Deferred Ideas

- **Embedded wiki iframe / in-app doc viewer** — new capability; not in v1.11 scope.
- **Wiki search bar in NavBar** — not in v1.11 scope.
- **Dex session-aware deep link** — unnecessary; Phase 29 known limitation means each app re-auths independently. A direct link to `https://wiki.internal` with no extra query params is correct.

## Specifics

- Icon: `BookOpen` from `lucide-react` (already imported elsewhere in the NavBar)
- Env var: `VITE_WIKI_URL` (default `https://wiki.internal`)
- Attributes: `target="_blank" rel="noopener noreferrer" title={t("nav.wiki")} aria-label={t("nav.wiki")}`
- i18n key: `nav.wiki` (both flat + nested, both locales)

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 30 entry (Goal, Success Criteria 1-3, NAV-01..NAV-03)
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02, NAV-03
- `.planning/phases/29-outline-wiki-deployment/29-CONTEXT.md` — establishes `https://wiki.internal` as the Outline edge
- `frontend/src/components/NavBar.tsx` — file being extended; source of current icon conventions
- `frontend/src/locales/en.json` and `frontend/src/locales/de.json` — i18n targets
- `frontend/.env.example` or repo-root `.env.example` — where `VITE_WIKI_URL=` default is documented (planner to confirm which file frontend env vars live in)
- External: https://lucide.dev/icons/book-open — icon reference

## Success Signals for Research + Planning

Downstream agents should produce plans that:
1. Add a `WikiLink` icon component (or inline `<a>`) between LanguageToggle and Upload in `NavBar.tsx`
2. Wire `VITE_WIKI_URL` with `https://wiki.internal` fallback
3. Add the `nav.wiki` key (flat + nested) to both locale files
4. Document `VITE_WIKI_URL=https://wiki.internal` in the appropriate `.env.example`
5. Passes `tsc --noEmit` — no new TS errors

This phase does not require a dedicated researcher pass — scope is small and patterns are locally established. Planner can proceed directly.
