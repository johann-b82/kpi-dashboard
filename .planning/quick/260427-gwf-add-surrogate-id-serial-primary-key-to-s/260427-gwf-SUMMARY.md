---
quick: 260427-gwf
title: Add surrogate id SERIAL PRIMARY KEY to signage tag-map junction tables
one_liner: "Alembic v1_24 swaps composite PK for surrogate `id SERIAL PRIMARY KEY` + UNIQUE pair on signage_playlist_tag_map and signage_device_tag_map so Directus 11 can introspect them."
tags: [signage, alembic, directus, schema, junction-tables]
requires: [v1_23_signage_schedule_check]
provides:
  - "Single-column id PK on signage_playlist_tag_map / signage_device_tag_map"
  - "uq_signage_playlist_tag_map_pair / uq_signage_device_tag_map_pair UNIQUE constraints"
  - "Directus visibility for both tag-map collections (no more 'doesn't have a primary key column' warns)"
affects:
  - backend/alembic/versions/v1_24_signage_tag_map_surrogate_id.py
key_files:
  created:
    - backend/alembic/versions/v1_24_signage_tag_map_surrogate_id.py
  modified: []
decisions:
  - "Revision id `v1_24_tag_map_surrogate_id` (26 chars) — `alembic_version.version_num` is VARCHAR(32). Initial id `v1_24_signage_tag_map_surrogate_id` (34 chars) failed with StringDataRightTruncationError; transactional DDL rolled the whole upgrade back, so no cleanup was needed (Rule 3 fix)."
  - "Add UNIQUE on the pair BEFORE dropping the composite PK so the no-duplicate-pairs invariant is never temporarily relaxed."
  - "New PK constraints get Postgres-default names (`signage_*_tag_map_pkey`) because `ADD COLUMN id SERIAL PRIMARY KEY` doesn't take a constraint name. Original composite PK names (`pk_signage_*_tag_map`) are preserved for downgrade restoration."
  - "Plain `SERIAL` (32-bit) chosen over `BIGSERIAL` for consistency with `signage_device_tags.id` and `signage_playlists.id`-style sizing — matches CLAUDE.md tech-stack precedent."
metrics:
  duration: "~2 min"
  completed: 2026-04-27
---

# Quick 260427-gwf: Add Surrogate id PK to Signage Tag-Map Tables — Summary

## What Shipped

Alembic migration `v1_24_signage_tag_map_surrogate_id.py` (revision id `v1_24_tag_map_surrogate_id`) applied to dev DB. Both junction tables now satisfy Directus 11's single-column-PK introspection requirement.

### Alembic head before/after

| | head |
|---|---|
| before | `v1_23_signage_schedule_check` |
| after  | `v1_24_tag_map_surrogate_id` |

### Constraint changes (per table)

**signage_playlist_tag_map**
- Dropped: `pk_signage_playlist_tag_map` PRIMARY KEY (playlist_id, tag_id)
- Added: `uq_signage_playlist_tag_map_pair` UNIQUE (playlist_id, tag_id)
- Added: `signage_playlist_tag_map_pkey` PRIMARY KEY (id) on new `id SERIAL`

**signage_device_tag_map**
- Dropped: `pk_signage_device_tag_map` PRIMARY KEY (device_id, tag_id)
- Added: `uq_signage_device_tag_map_pair` UNIQUE (device_id, tag_id)
- Added: `signage_device_tag_map_pkey` PRIMARY KEY (id) on new `id SERIAL`

Triggers (`signage_*_tag_map_notify` AFTER INSERT/UPDATE/DELETE → `signage_notify()`) are untouched — they reference pair columns by name, not the PK.

### Round-trip sanity check

`alembic downgrade -1` cleanly restores `pk_signage_playlist_tag_map` / `pk_signage_device_tag_map` (composite PK on original pair, original names). `alembic upgrade head` re-applies idempotently. Both tables had zero rows when migrated; no data preservation concerns surfaced.

## Verification Evidence

### 1. Plan automated verifier (Task 1)

```sql
SELECT
  (SELECT COUNT(*)=1 FROM pg_index WHERE indrelid='signage_playlist_tag_map'::regclass AND indisprimary AND array_length(indkey,1)=1)
  AND (SELECT COUNT(*)=1 FROM pg_index WHERE indrelid='signage_device_tag_map'::regclass AND indisprimary AND array_length(indkey,1)=1)
  AND (SELECT COUNT(*)=1 FROM pg_constraint WHERE conname='uq_signage_playlist_tag_map_pair' AND contype='u')
  AND (SELECT COUNT(*)=1 FROM pg_constraint WHERE conname='uq_signage_device_tag_map_pair' AND contype='u');
-- → t
```

### 2. Directus boot log post-restart (Task 2)

`docker compose restart directus` → boot completed in ~3 s. Last 5 minutes of `docker logs kpi-dashboard-directus-1`:

```
[10:14:28.014] INFO: Extensions loaded
[10:14:28.018] INFO: Initializing bootstrap...
[10:14:28.019] INFO: Database already initialized, skipping install
[10:14:28.019] INFO: Running migrations...
[10:14:28.049] INFO: Done
[10:14:30.386] WARN: PostGIS isn't installed. Geometry type support will be limited.
```

Plan's negative-grep verifier:

```bash
docker logs --since 5m kpi-dashboard-directus-1 2>&1 \
  | grep -cE 'Collection "signage_(device|playlist)_tag_map" doesn'\''t have a primary key'
# → 0
```

The only WARN in the boot window is the unrelated PostGIS notice. The two missing-PK warnings for `signage_playlist_tag_map` / `signage_device_tag_map` are GONE.

### 3. Operator UI confirmation (Task 3 — checkpoint:human-verify)

Per the run constraints, log evidence is the primary acceptance signal; browser-based UI confirmation is left to the operator at their convenience. To verify in the Directus admin UI:

1. Open `http://localhost:8055/admin/`
2. Settings → Data Model
3. Confirm `signage_playlist_tag_map` and `signage_device_tag_map` now appear in the collection list
4. (Optional) Auto-detected primary key field should be `id` for both
5. Add the same `(playlist_id, tag_id)` or `(device_id, tag_id)` row twice → expect failure (UNIQUE invariant preserved)

## Deviations from Plan

### [Rule 3 — Blocking issue] Revision id length

- **Found during:** Task 1 first `alembic upgrade head`
- **Issue:** Initial revision id `v1_24_signage_tag_map_surrogate_id` (34 chars) exceeds `alembic_version.version_num` `VARCHAR(32)` limit, causing `StringDataRightTruncationError` on the version-bump UPDATE. Transactional DDL rolled the whole migration back automatically — no manual cleanup required.
- **Fix:** Shortened revision id to `v1_24_tag_map_surrogate_id` (26 chars). Filename kept as `v1_24_signage_tag_map_surrogate_id.py` for descriptive readability; migration docstring documents the asymmetry.
- **Files modified:** `backend/alembic/versions/v1_24_signage_tag_map_surrogate_id.py`
- **Commit:** 6055369

### [Rule 1 — Bug avoided] PK constraint naming on `ADD COLUMN ... SERIAL PRIMARY KEY`

- **Found during:** Plan authoring expected to name the new PK explicitly. Postgres' `ADD COLUMN id SERIAL PRIMARY KEY` form does NOT accept a constraint name and produces the default `<table>_pkey`.
- **Decision:** Accept Postgres defaults (`signage_playlist_tag_map_pkey` / `signage_device_tag_map_pkey`); the original `pk_signage_*_tag_map` names are reserved for the downgrade restore step. Net effect: upgrade picks new default-named PKs, downgrade restores the original named composite PKs. Idempotent on either side.
- **Commit:** 6055369

## Carry-forward / Follow-ups

- **v1.22 carry-forward xfails:** This migration removes the schema-level blocker (single-column PK present), but Directus also needs **collection metadata rows** registered in `directus_collections` for these two tables before its REST/SDK exposes them. The composite-PK `schema:null` collection metadata gap (Phase 69 P06 SSE tag_map test, Phase 70 P05 SSE test 3) was filed against the missing metadata, NOT solely the missing PK — those xfails will likely still be xfail until a follow-up `/gsd:quick` registers the collection metadata via Directus REST `POST /collections {schema:null}` (or equivalent) and adds the bootstrap-roles permission rows. Re-evaluate by re-running the xfail tests once the post-migration permission/metadata pass lands.
- **Optional:** A follow-up could also rename the new PKs from `<table>_pkey` to `pk_<table>` for naming consistency with the rest of the schema, but that's cosmetic and not required for Directus.

## Self-Check

- [x] `backend/alembic/versions/v1_24_signage_tag_map_surrogate_id.py` exists — verified
- [x] Commit `6055369` exists in `git log` — verified
- [x] `alembic upgrade head` ran clean (post fix); round-trip downgrade/upgrade clean
- [x] Plan automated verifier returns `t`
- [x] Directus boot log shows zero matches for the missing-PK warning regex

## Self-Check: PASSED
