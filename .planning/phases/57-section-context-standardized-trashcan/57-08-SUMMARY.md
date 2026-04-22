---
phase: 57-section-context-standardized-trashcan
plan: 08
subsystem: frontend/signage
tags: [section-header, devices, signage, ui-consistency]
requires:
  - 57-01-section-header-primitive (SectionHeader)
  - 57-04-i18n-section-keys (section.signage.devices.* keys)
provides: SectionHeader adoption on DevicesPage; removal of misappropriated col_name <h2>
affects: [frontend/src/signage/pages/DevicesPage.tsx]
tech_stack:
  added: []
  patterns: [SectionHeader primitive consumption, Revoke-stays-as-is per RESEARCH Pitfall 4]
key_files:
  created: []
  modified:
    - frontend/src/signage/pages/DevicesPage.tsx
decisions:
  - Devices is SectionHeader-only — Revoke (ShieldOff, network credential revoke) stays as-is, NOT migrated to DeleteButton (RESEARCH Pitfall 4)
  - SectionHeader placed inside the main return only (empty-state branch returns early with its own card UI; out of scope for this plan)
metrics:
  duration: 5m
  completed_date: 2026-04-22
requirements: [SECTION-01]
---

# Phase 57 Plan 08: Devices Section Header Summary

Adopted the SectionHeader primitive at the top of DevicesPage and removed the misappropriated `<h2>{col_name}</h2>` that was rendering the "Name" column label as a top-of-section heading. Revoke (ShieldOff) action preserved unchanged per RESEARCH Pitfall 4.

## What Shipped

- `<SectionHeader title={t("section.signage.devices.title")} description={t("section.signage.devices.description")} className="mt-8" />` at top of DevicesPage main return.
- Removed stray `<h2 className="text-lg font-semibold">{t("signage.admin.devices.col_name")}</h2>` at the top of the table flex-row (was line 120). The "Pair new" button stays in its right-aligned action row.
- `signage.admin.devices.col_name` key still used as the actual table column header — only the misappropriated heading usage went away.
- Revoke button (`<ShieldOff />` ~line 219) untouched — semantically distinct from destructive row delete (200 OK network credential revoke vs. row deletion).

## Verification

- `rg "SectionHeader" frontend/src/signage/pages/DevicesPage.tsx` — matches at import + JSX call site.
- `rg "ShieldOff" frontend/src/signage/pages/DevicesPage.tsx` — matches at import + button JSX (preserved).
- Targeted TS check on DevicesPage.tsx + section-header.tsx — clean (zero errors).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleared stale tsc incremental cache**
- **Found during:** Build verification
- **Issue:** `tsconfig.app.tsbuildinfo` referenced a deleted file `SensorAdminHeader.tsx` (deleted by parallel plan 57-09). Initial `npm run build` failed with `TS6053: File ... not found` before tsc would even type-check changed sources.
- **Fix:** Removed stale `frontend/node_modules/.tmp/tsconfig.{app,node}.tsbuildinfo` and root `tsconfig.{app,node}.tsbuildinfo`.
- **Files modified:** none (cache cleanup only)
- **Commit:** n/a (no source change)

### Deferred Issues (out of scope for 57-08)

After clearing the stale cache, additional pre-existing TS errors surfaced in unrelated files (sensor hooks/defaults, signage schedules, playlists). None touch DevicesPage. Logged to `.planning/phases/57-section-context-standardized-trashcan/deferred-items.md`. Per scope-boundary rule these belong to Phase 57's CI-guards plan (57-11) or the originating parallel plans, not 57-08.

## Self-Check: PASSED

- FOUND: `frontend/src/signage/pages/DevicesPage.tsx` (modified, contains `SectionHeader` import + JSX, retains `ShieldOff`)
- FOUND: commit `2e3d481` in git log
