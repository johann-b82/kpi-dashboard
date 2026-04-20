---
phase: 48-pi-provisioning-e2e-docs
plan: 04
subsystem: docs
tags: [markdown, i18n, digital-signage, operator-runbook, bilingual, raspberry-pi]
dependency_graph:
  requires: [48-02]
  provides:
    - frontend/src/docs/en/admin-guide/digital-signage.md
    - frontend/src/docs/de/admin-guide/digital-signage.md
    - docs/operator-runbook.md
  affects: [48-05-e2e-walkthrough]
tech_stack:
  added: []
  patterns: [bilingual-markdown-docs, docs-registry-ts-pattern, i18n-nested-key]
key_files:
  created:
    - frontend/src/docs/en/admin-guide/digital-signage.md
    - frontend/src/docs/de/admin-guide/digital-signage.md
    - docs/operator-runbook.md
  modified:
    - frontend/src/lib/docs/registry.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/de.json
decisions:
  - "toc.ts is a heading-extraction utility, not a section list — sections and registry are both in registry.ts. Digital-signage registered in registry.ts only."
  - "digital-signage placed after architecture and before personio in admin-guide section list (logical grouping, not strict alphabetical)"
  - "Operator runbook at docs/operator-runbook.md (repo root docs/) per D-5 and RESEARCH §9 OQ5 resolution"
metrics:
  duration: 540s
  completed_date: "2026-04-20"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 48 Plan 04: Bilingual Admin Guide + Operator Runbook Summary

**One-liner:** Bilingual digital-signage admin guide (EN/DE, informal "du" tone) covering onboarding/media/playlists/offline/PPTX + technical operator runbook with verbatim systemd units and SGN-OPS-03 Chromium flag set.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | EN + DE admin guides + docs registration | `fe63f13` | `frontend/src/docs/en/admin-guide/digital-signage.md`, `frontend/src/docs/de/admin-guide/digital-signage.md`, `registry.ts`, `en.json`, `de.json` |
| 2 | Operator runbook | `b3b6f60` | `docs/operator-runbook.md` |

---

## Content Coverage

### Admin Guide Word Counts

| File | Words |
|------|-------|
| `frontend/src/docs/en/admin-guide/digital-signage.md` | 1,640 |
| `frontend/src/docs/de/admin-guide/digital-signage.md` | 1,560 |
| `docs/operator-runbook.md` | 3,114 |

### SGN-OPS-01 Coverage

| Required Topic | Covered in EN | Covered in DE |
|----------------|:---:|:---:|
| Pi onboarding (flash → provision → pair → tag) | Section: "Onboarding a Pi" (Steps 1–4) | "Einen Pi einrichten" (Schritte 1–4) |
| Media upload + supported formats | Section: "Uploading Media" | "Medien hochladen" |
| Playlist building + tag targeting | Section: "Building Playlists" | "Playlists erstellen" |
| Offline behavior (sidecar, 5 min target, 30s reconnect) | Section: "Offline Behavior" | "Offline-Verhalten" |
| Wi-Fi troubleshooting | Section: "Troubleshooting → Wi-Fi Connectivity" | "Fehlerbehebung → WLAN-Konnektivität" |
| PPTX best practices (embed fonts, avoid OLE) | Section: "PPTX Best Practices" | "PPTX Best Practices" |

---

## DE Tone Check

```bash
grep -E "Sie |Ihre |Ihr |Ihnen" frontend/src/docs/de/admin-guide/digital-signage.md
# (empty — PASS)
```

No formal pronouns in the DE file. Informal "du" tone is consistent throughout.

---

## Registry + i18n Changes

### registry.ts additions

```typescript
// New imports (inserted alphabetically — 'd' before 'p')
import enDigitalSignage from "../../docs/en/admin-guide/digital-signage.md?raw";
import deDigitalSignage from "../../docs/de/admin-guide/digital-signage.md?raw";

// sections["admin-guide"] — new entry after "architecture"
{ slug: "digital-signage", titleKey: "docs.nav.adminDigitalSignage" },

// registry.en["admin-guide"] — new entry
"digital-signage": enDigitalSignage,

// registry.de["admin-guide"] — new entry
"digital-signage": deDigitalSignage,
```

**Note on toc.ts:** The plan mentioned `toc.ts` as a possible owner of the section list. On inspection, `toc.ts` is a heading-extraction utility (`extractToc(markdown)`). All sections and registry data live in `registry.ts`. No changes were made to `toc.ts`.

### i18n key additions

Both locale files received the `adminDigitalSignage` key under `docs.nav`:

```json
"adminDigitalSignage": "Digital Signage"
```

Value is identical in EN and DE — "Digital Signage" is a proper noun invariant across both languages (per RESEARCH §9 note).

i18n parity confirmed: key present in both `frontend/src/locales/en.json` (line 430) and `frontend/src/locales/de.json` (line 430).

---

## Operator Runbook

### Sections Written (11/11)

| # | Section | Key content |
|---|---------|-------------|
| 1 | Pi Hardware Requirements | Models, RAM, storage, Pi 3B caveats |
| 2 | Software Stack | Full package list, RPi archive note, unclutter-xfixes |
| 3 | Pi Image (from scratch) | Imager steps, SSH + Wi-Fi pre-configure, first-boot verification |
| 4 | Provision Script Reference | Invocation, exit codes table, idempotency contract, token substitution |
| 5 | Systemd Service Reference | Full verbatim content of all 3 unit files + journalctl commands |
| 6 | Full Chromium Flag Set | SGN-OPS-03 flag set verbatim + per-flag explanations + reliability flags |
| 7 | Sidecar Cache Reference | /var/lib/signage/ layout, inspection commands, /health contract |
| 8 | signage User and Security | Non-root rationale, groups, systemd hardening table |
| 9 | Recovery Procedures | 8 procedures: restart kiosk/sidecar/labwc/all, reprovision, factory reset, Chromium profile fix, Wayland socket race |
| 10 | Fallback: Image-Only Playlist | SGN-OPS-03 explicit fallback, export steps from PowerPoint/Impress |
| 11 | Notes on Documentation Path Amendment | SGN-OPS-01 path typo, actual convention, handoff to Plan 48-05 |

### SGN-OPS-03 Chromium Flag Set — Verbatim Presence Confirmed

```
/usr/bin/chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble \
  --ozone-platform=wayland \
  --app=http://<api-host>/player/
```

### Path Amendment Note

Section 11 of the runbook contains the explicit note:

> REQUIREMENTS.md SGN-OPS-01 originally referenced `frontend/src/docs/admin/digital-signage.{en,de}.md`. The actual path used follows the established in-app docs convention: `frontend/src/docs/{en,de}/admin-guide/digital-signage.md`. Plan 48-05's `48-VERIFICATION.md` formalizes this amendment.

---

## Deviations from Plan

### Deviation 1 — toc.ts is not a section list file

**Rule:** Rule 1 (Auto-fix bugs — plan referenced wrong file)
**Found during:** Task 1
**Issue:** Plan specified editing `frontend/src/lib/docs/toc.ts` to add the admin-guide section entry. On inspection, `toc.ts` is a pure utility function (`extractToc`) for parsing headings from markdown strings. It contains no section list or slug registry.
**Fix:** Registered `digital-signage` exclusively in `registry.ts` (which contains both `sections` and `registry`). This is the correct file — all existing admin-guide entries follow this pattern.
**Files modified:** `registry.ts` only (toc.ts unchanged)
**Impact:** None — behavior is identical. The plan's description of "read both, edit whichever actually holds the section list" was correctly followed.

---

## Known Stubs

None — all sections contain real content. No placeholder text or hardcoded empty values.

---

## SGN-OPS Requirement Status

| Requirement | Status | Evidence |
|-------------|--------|---------|
| SGN-OPS-01 | SATISFIED | EN + DE admin guides cover all 6 required topics |
| SGN-OPS-02 | SATISFIED | Both locale docs indexes register `digital-signage` slug |
| SGN-OPS-03 (admin-facing half) | SATISFIED | Operator runbook has Pi image, Chromium flag set, systemd unit, signage user, image-only fallback |

---

## Handoff to Plan 48-05

- `48-VERIFICATION.md` should formalize the SGN-OPS-01 path amendment (Section 11 of runbook documents it; 48-05 makes it official).
- E2E walkthrough will validate that the admin guide's onboarding steps match real Pi behavior.
- The docs build (frontend) should be verified in Plan 48-05 via `npm run build` or `npm run dev` navigation.

## Self-Check: PASSED

Files confirmed on disk:

- `frontend/src/docs/en/admin-guide/digital-signage.md` ✓
- `frontend/src/docs/de/admin-guide/digital-signage.md` ✓
- `docs/operator-runbook.md` ✓
- `frontend/src/lib/docs/registry.ts` updated ✓
- `frontend/src/locales/en.json` updated ✓
- `frontend/src/locales/de.json` updated ✓

Commits confirmed:

- `fe63f13` ✓ (Task 1 — admin guides + docs registration)
- `b3b6f60` ✓ (Task 2 — operator runbook)
