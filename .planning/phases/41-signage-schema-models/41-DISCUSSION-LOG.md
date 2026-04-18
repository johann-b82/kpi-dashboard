# Phase 41: Signage Schema & Models - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 41-signage-schema-models
**Areas discussed:** Media storage, Pairing code alphabet, signage_media column shape, Model/schema file organization, Audit timestamps

---

## Media Storage Model (Decision 2 — binds Phases 43+44)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Directus files + RO mount | Directus is primary media store; `directus_uploads:/directus/uploads:ro` mounted into `api`; PPTX slide PNGs live under backend-owned `/app/media/slides/<uuid>/`. Two storage roots — user uploads vs. derived artifacts. | ✓ |
| B. Backend-owned `/app/media/` | Single storage root; converter writes in-place. Loses Directus file picker / thumbnail / metadata features. | |

**User's choice:** A (recommended).
**Notes:** Two storage roots acknowledged as intentional — user uploads (Directus) vs. derived artifacts (backend). Derived artifacts don't belong in the Directus asset browser.

---

## Pairing Code Alphabet

| Option | Description | Selected |
|--------|-------------|----------|
| A. 6-digit numeric `123-456` | Simplest typing; 1M keyspace | |
| B. Crockford base32 no-confusables | 6 chars from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no 0/O/1/I/L), displayed `XXX-XXX`; industry-standard for signage | ✓ |

**User's choice:** B (recommended).
**Notes:** Matches research recommendation and Screenly/Yodeck conventions. Kiosk-readability on small screens is the driver.

---

## signage_media Column Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Generic + type-specific JSONB | Core cols (`id`, `kind`, `title`, `mime_type`, `size_bytes`, `uri`, `duration_ms`, `created_at`, `updated_at`) + PPTX-specific (`conversion_status`, `slide_paths`, `conversion_error`, `conversion_started_at`) + HTML-specific (`html_content` inline) | ✓ |

**User's choice:** Recommended shape accepted.
**Notes:** HTML content kept in DB column (not filesystem) so backup/restore stays atomic. PPTX slides live on filesystem because they are multi-file derived artifacts.

---

## Model/Schema File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| A. Keep flat `models.py`/`schemas.py` | Consistent with v1.3/v1.15 precedent | |
| B. Split into `models/signage.py` + package `__init__.py` | 8 tables (~300 lines) is threshold where split pays off; import paths preserved via re-export | ✓ |

**User's choice:** B (recommended).
**Notes:** Phase 41 is the natural moment (additive, not a refactor). `from app.models import Foo` must still work via re-export. If non-trivial, planner may defer split — but preferred is split now.

---

## Audit Timestamps

| Option | Description | Selected |
|--------|-------------|----------|
| A. `created_at` + `updated_at` on all 8 tables | Uniform; includes join tables; cheap at scale | ✓ |
| B. Only where admin UI needs it | Minimalist | |

**User's choice:** A (recommended).
**Notes:** `signage_playlists.updated_at` is already required by resolver (SGN-BE-06). Uniformity helps debugging pairing/heartbeat issues. Cost is 16 columns at negligible storage.

---

## Claude's Discretion

- Postgres ENUM vs. `CHECK` constraint for `kind` and `conversion_status` — planner picks whichever round-trips cleanly under Alembic downgrade.
- Column widths for `title`, `name`, etc. — sensible defaults.
- Join table PK style — composite vs. synthetic — planner picks to match existing precedent.
- Exposure of join tables (`signage_device_tag_map`, `signage_playlist_tag_map`) to Directus — default exposed unless concrete reason to hide.

## Deferred Ideas

- PPTX worker location (Decision 1) → Phase 44
- Device token format (Decision 4) → Phase 42
- Player offline cache (Decision 3) → Phase 47
- `signage_playlists.updated_at` index tuning → Phase 43
