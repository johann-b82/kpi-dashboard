---
phase: 57-section-context-standardized-trashcan
plan: 01
subsystem: frontend-ui-primitives
tags: [primitive, section-header, typography, tdd, ui-spec]
requirements: [SECTION-01]
dependency_graph:
  requires:
    - frontend/src/lib/utils.ts (cn helper)
    - react-i18next (useTranslation for i18n.language)
  provides:
    - SectionHeader primitive at @/components/ui/section-header (title, description, className, children never)
  affects:
    - Wave B section-page migrations (57-05 media, 57-06 playlists, 57-07 schedules, 57-08 devices, 57-09 sensors, 57-10 upload-history)
tech_stack:
  added: []
  patterns:
    - "Pure presentational primitive — no interactivity, null-safe on empty title"
    - "Token-driven colors (text-foreground / text-muted-foreground) — zero dark: variants"
    - "font-medium harmonization per UI-SPEC §Typography (replaces ad-hoc font-semibold in PlaylistEditorPage SOTT)"
    - "lang={i18n.language} on description for browser hyphenation on DE/EN switches"
    - "TDD RED→GREEN: failing tests first (Task 1), minimal implementation second (Task 2)"
key_files:
  created:
    - frontend/src/components/ui/section-header.tsx
    - frontend/src/components/ui/__tests__/section-header.test.tsx
  modified: []
decisions:
  - "font-medium NOT font-semibold (harmonization from Playlist-editor SOTT per UI-SPEC §Typography)"
  - "mb-6 wrapper + mt-1 title→description rhythm (UI-SPEC §SectionHeader rhythm)"
  - "children?: never type-level block — non-interactive primitive by contract"
  - "Null-return when title is empty string (defensive render guard)"
  - "cn merge from @/lib/utils matches canonical project import style (verified against button.tsx/badge.tsx)"
metrics:
  duration: "~2m"
  tasks: 2
  files: 2
  completed: "2026-04-22T08:38:57Z"
---

# Phase 57 Plan 01: SectionHeader Primitive Summary

Extracted the Playlist-editor heading+description pattern into a reusable `SectionHeader` primitive under `components/ui/` with TDD (6 failing tests first, then minimal GREEN implementation), harmonizing typography to `font-medium` per UI-SPEC and unblocking every Wave B admin-section migration in Phase 57.

## What Was Built

- **`frontend/src/components/ui/section-header.tsx`** — 29-line pure component exporting `SectionHeader({ title, description, className })`. Renders `<section><h2 /><p lang={i18n.language} /></section>`. Returns `null` when title is empty. `children?: never` blocks misuse at the type level. Uses `cn` from `@/lib/utils` to merge consumer `className` onto the `mb-6` wrapper.
- **`frontend/src/components/ui/__tests__/section-header.test.tsx`** — 6 vitest cases covering (1) h2 + font-medium, (2) p + text-muted-foreground + text-xs, (3) lang attribute == i18n.language, (4) null-on-empty-title, (5) consumer className pass-through, (6) zero `dark:` variants on any DOM node.

## Verification Performed

- `npm --prefix frontend test -- section-header --run` → **6/6 passed** (GREEN)
- Primitive module resolves via `@/components/ui/section-header` alias
- Runtime assertion: test 6 iterates all DOM nodes and asserts no `dark:` class literal appears on any element
- Source comment mentions `dark:` once (explaining "zero dark variants"); actual Tailwind classes contain zero `dark:` prefixes — test 6 catches this at runtime, CI grep guards in Plan 57-11 will enforce source-level

## Commits

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 (RED) | test(57-01): add failing tests for SectionHeader primitive | 13dea69 |
| 2 (GREEN) | feat(57-01): implement SectionHeader primitive | 5595855 |

## Deviations from Plan

None — plan executed exactly as written. TDD RED→GREEN cycle clean; no auto-fixes, no architectural surprises, no auth gates.

## Known Stubs

None. The primitive is complete and consumable; Wave B migrations (57-05..57-10) will import it as a drop-in replacement for ad-hoc heading+description blocks across admin sections.

## Downstream Unblocks

- 57-05 media-migration: SectionHeader ready for `/signage/media`
- 57-06 playlists-migration: SectionHeader ready for `/signage/playlists` (replaces SOTT source)
- 57-07 schedules-migration, 57-08 devices-section-header, 57-09 sensors-migration, 57-10 upload-history-migration
- 57-11 ci-guards-verification: can add grep guards for `font-semibold` + `dark:` on section-header.tsx

## Self-Check: PASSED

- FOUND: frontend/src/components/ui/section-header.tsx
- FOUND: frontend/src/components/ui/__tests__/section-header.test.tsx
- FOUND: 13dea69 (Task 1 RED commit)
- FOUND: 5595855 (Task 2 GREEN commit)
