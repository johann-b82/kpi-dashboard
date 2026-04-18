---
phase: 30
plan: 01
subsystem: frontend/navbar
tags: [i18n, navbar, env-config, wiki-link]
requires: []
provides:
  - WikiLink anchor in NavBar opening https://wiki.internal in new tab
  - nav.wiki i18n key (flat + nested) in EN and DE
  - VITE_WIKI_URL env var override (default https://wiki.internal)
affects:
  - frontend/src/components/NavBar.tsx
  - frontend/src/locales/en.json
  - frontend/src/locales/de.json
  - .env.example
tech_stack:
  added: []
  patterns:
    - Plain <a target="_blank" rel="noopener noreferrer"> for external links (D-03, D-06)
    - import.meta.env.VITE_* with string fallback for runtime-overridable config (D-02)
    - Dual flat + nested i18n key (keySeparator:false precedent, Phase 28 D-04)
key_files:
  created: []
  modified:
    - frontend/src/components/NavBar.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
    - .env.example
decisions:
  - BookOpen (lucide-react) for wiki icon semantics (D-01)
  - Env var VITE_WIKI_URL with https://wiki.internal fallback (D-02)
  - target=_blank + rel=noopener noreferrer for security (D-03)
  - nav.wiki = "Wiki" in both EN and DE (D-04)
  - DOM order: Theme → Language → Wiki → Upload → Settings → UserChunk (D-05)
  - Plain <a> (no wouter Link) because external (D-06)
metrics:
  duration: 5min
  tasks: 3
  files: 4
  completed: 2026-04-15
---

# Phase 30 Plan 01: Wiki NavBar Link Summary

Add external wiki icon to KPI Light NavBar pointing at Phase 29 Outline deployment with env-var-overridable URL and DE/EN translated accessible name.

## Tasks

1. **Task 1** — Append VITE_WIKI_URL block to `.env.example` (commit `dd938c3`).
2. **Task 2** — Add `nav.wiki` flat + nested i18n key to en.json and de.json (commit `13aabea`).
3. **Task 3** — Extend NavBar.tsx: import BookOpen, add WIKI_URL constant, render `<a>` between LanguageToggle and Upload Link (commit `9deead1`).

## Verification

- `grep -q "^VITE_WIKI_URL=https://wiki.internal$" .env.example` → OK
- JSON parse of both locales with `en['nav.wiki']==='Wiki'` + nested form → OK
- `cd frontend && npx tsc --noEmit` → exit 0
- DOM order check (awk `<LanguageToggle>` < `<BookOpen>` < `href="/upload"`) → 103 < 112 < 115 OK

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

All decisions pre-recorded in 30-CONTEXT.md (D-01..D-06); no new ones surfaced during execution.

## Self-Check: PASSED

- FOUND: frontend/src/components/NavBar.tsx (BookOpen import + WIKI_URL + anchor)
- FOUND: frontend/src/locales/en.json (nav.wiki flat + nested)
- FOUND: frontend/src/locales/de.json (nav.wiki flat + nested)
- FOUND: .env.example (VITE_WIKI_URL=https://wiki.internal)
- FOUND: commit dd938c3
- FOUND: commit 13aabea
- FOUND: commit 9deead1
