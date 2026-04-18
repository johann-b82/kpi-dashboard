---
phase: 43-media-playlist-device-admin-api-polling
plan: 01
subsystem: signage-schema
tags: [alembic, signage, etag, orm]
requires:
  - v1_16_signage (Phase 41 8-table signage schema)
provides:
  - signage_devices.current_playlist_etag TEXT NULL column
  - SignageDevice.current_playlist_etag Mapped[str | None] ORM attr
affects:
  - Phase 43 Plan 04 heartbeat endpoint (will write this column)
tech_stack:
  added: []
  patterns:
    - additive Alembic migration (Wave-0-style single-concern revision)
key_files:
  created:
    - backend/alembic/versions/v1_16_signage_devices_etag.py
  modified:
    - backend/app/models/signage.py
    - backend/tests/test_signage_schema_roundtrip.py
decisions:
  - down_revision pinned to actual revision id "v1_16_signage" (plan text said "v1_16_signage_schema" but that is the filename, not the Alembic revision id)
  - updated test_signage_schema_roundtrip SIGNAGE_HEAD_REVISION + downgrade step count to reflect the extended chain
metrics:
  duration: "~6m"
  completed: 2026-04-18
requirements:
  - SGN-BE-02
---

# Phase 43 Plan 01: ETag Column Migration Summary

Additive Alembic migration + ORM update adding `signage_devices.current_playlist_etag` (TEXT NULL) so Phase 43 heartbeat can persist the player's last-known playlist ETag.

## What Shipped

- New Alembic revision `v1_16_signage_devices_etag` revising `v1_16_signage`:
  - `upgrade()` → `op.add_column("signage_devices", sa.Column("current_playlist_etag", sa.Text(), nullable=True))`
  - `downgrade()` → `op.drop_column(...)`
- `SignageDevice.current_playlist_etag: Mapped[str | None] = mapped_column(Text, nullable=True)` inserted immediately after `status`. `Text` was already imported.
- Round-trip test updated to track the new head revision and downgrade two steps.

## Verification

- `alembic upgrade head` on live db: moved chain from `v1_16_signage` → `v1_16_signage_devices_etag`.
- `\d signage_devices` shows `current_playlist_etag | text |` row (nullable, no default).
- `alembic downgrade -1 && alembic upgrade head` round-trip clean.
- ORM attribute presence: `python -c "from app.models.signage import SignageDevice; assert hasattr(SignageDevice, 'current_playlist_etag')"` → OK.
- `pytest backend/tests/test_signage_schema_roundtrip.py` → 2 passed.

## Commits

- `2340a3c` — feat(43-01): add current_playlist_etag migration
- `2a3a166` — feat(43-01): add current_playlist_etag to SignageDevice ORM

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected down_revision to actual revision id**
- **Found during:** Task 1
- **Issue:** Plan specified `down_revision = "v1_16_signage_schema"`, but inspection of `backend/alembic/versions/v1_16_signage_schema.py` line 21 shows the Alembic revision id is `"v1_16_signage"`. Using the plan's value verbatim would break the migration chain (Alembic would raise `Can't locate revision identified by 'v1_16_signage_schema'`).
- **Fix:** Used the real revision id `v1_16_signage` for both the file's `down_revision` and the new `revision` string `v1_16_signage_devices_etag`.
- **Files modified:** backend/alembic/versions/v1_16_signage_devices_etag.py
- **Commit:** 2340a3c

**2. [Rule 1 - Bug] Updated round-trip test to reflect new migration chain**
- **Found during:** Task 2 verification
- **Issue:** `tests/test_signage_schema_roundtrip.py` pinned `SIGNAGE_HEAD_REVISION = "v1_16_signage"` and used `alembic downgrade -1` to unwind all signage tables. With the new head rev extending the chain, the test (a) asserted the wrong head revision and (b) downgrading one step only drops the ETag column — tables still exist.
- **Fix:** Updated `SIGNAGE_HEAD_REVISION` to `"v1_16_signage_devices_etag"` and changed `downgrade -1` to `downgrade -2` so the test continues to validate full tear-down of Phase 41 signage tables.
- **Files modified:** backend/tests/test_signage_schema_roundtrip.py
- **Commit:** 2a3a166

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: backend/alembic/versions/v1_16_signage_devices_etag.py
- FOUND: backend/app/models/signage.py (current_playlist_etag present)
- FOUND: commit 2340a3c
- FOUND: commit 2a3a166
