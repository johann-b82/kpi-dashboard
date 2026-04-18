---
phase: 43-media-playlist-device-admin-api-polling
plan: 02
subsystem: api
tags: [fastapi, pydantic, sqlalchemy-async, selectinload, signage, resolver]

requires:
  - phase: 41-schema-foundation
    provides: Signage ORM models (SignagePlaylist, SignagePlaylistItem, SignageMedia, tag maps) + 19 schemas
  - phase: 42-device-auth-pairing-flow
    provides: Device token + claim flow (device identity feeding the resolver)
provides:
  - resolve_playlist_for_device async service (priority DESC, updated_at DESC, LIMIT 1)
  - compute_playlist_etag SHA256 helper (D-09, used by 43-04)
  - PlaylistEnvelope / PlaylistEnvelopeItem / HeartbeatRequest Pydantic schemas (D-06/D-07/D-11)
affects:
  - 43-03-admin-crud-router
  - 43-04-player-router-and-heartbeat-sweeper
  - 43-05-dep-audit-and-ci-grep-guards

tech-stack:
  added: []
  patterns:
    - "Resolver isolates tag-matching SQL in service layer; routers stay thin"
    - "Envelope is the single wire-format seam; duration_s→duration_ms conversion lives in the resolver"
    - "compute_playlist_etag is content-hash-only (no timestamps) — stable across polls"

key-files:
  created:
    - backend/app/services/signage_resolver.py
    - backend/tests/test_signage_resolver.py
  modified:
    - backend/app/schemas/signage.py

key-decisions:
  - "duration_s → duration_ms conversion lives at the envelope boundary (resolver), not in the ORM or router, so the wire contract stays stable if the column is later migrated"
  - "transition coerced to empty string on wire (ORM nullable String(32)) — avoids Optional[str] on every downstream consumer"
  - "Empty envelope uses the sentinel etag sha256('empty') so unmatched polls still validate If-None-Match"
  - "Defensive sorted() on playlist.items even though the relationship is order_by position — protects against future relationship edits silently breaking envelope ordering"

patterns-established:
  - "Resolver test harness pattern: asyncpg for SQL seeding, AsyncSessionLocal for exercising ORM relationship loading — mirrors test_signage_pair_router.py"
  - "Schema acceptance uses `ConfigDict(from_attributes=True)` alongside existing `model_config = {...}` dict style — both valid in pydantic v2, ConfigDict chosen here for explicit typing"

requirements-completed:
  - SGN-BE-06

duration: 3m
completed: 2026-04-18
---

# Phase 43 Plan 02: Resolver and Player Envelopes Summary

**Tag-to-playlist resolver service with SHA256 ETag helper, plus PlaylistEnvelope/HeartbeatRequest schemas — the pure read-path foundation for Plan 43-04's player router.**

## Performance

- **Duration:** ~3m
- **Started:** 2026-04-18T21:38:35Z
- **Completed:** 2026-04-18T21:41:44Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 extended)

## Accomplishments
- `resolve_playlist_for_device()` implements D-06/D-07/D-08: tag intersection, priority DESC / updated_at DESC tie-break, LIMIT 1, empty envelope on no-match.
- `compute_playlist_etag()` produces a deterministic content hash — ready for Plan 43-04's `If-None-Match` short-circuit (D-09).
- Three new schemas (`PlaylistEnvelope`, `PlaylistEnvelopeItem`, `HeartbeatRequest`) encode the player wire contract.
- 10/10 pytest-asyncio tests cover all three decisions plus the D-10 purity invariant (resolver does NOT mutate device presence timestamp). No regressions on `test_signage_schema_roundtrip` or `test_signage_pair_router` (15/15 pass).

## Task Commits

Each task was committed atomically (`--no-verify` per parallel executor policy):

1. **Task 1: Add PlaylistEnvelope + HeartbeatRequest schemas** — `2023b67` (feat)
2. **Task 2 RED: Failing resolver tests** — `475c89a` (test)
3. **Task 2 GREEN: Implement signage_resolver** — `c4cda49` (feat)

Plan metadata commit follows.

## Files Created/Modified
- `backend/app/services/signage_resolver.py` — tag resolver + ETag helper (SGN-BE-06)
- `backend/tests/test_signage_resolver.py` — 10 pytest-asyncio tests (D-06/D-07/D-08/D-10 + ETag)
- `backend/app/schemas/signage.py` — added PlaylistEnvelope, PlaylistEnvelopeItem, HeartbeatRequest; import ConfigDict

## Decisions Made

- **duration_s → duration_ms at the envelope boundary.** The ORM stores seconds (`SignagePlaylistItem.duration_s`) but the D-07 wire contract specifies `duration_ms`. Centralizing the conversion in the resolver means a future column migration won't ripple through every router/test.
- **Defensive `sorted(playlist.items, key=position)` even though the ORM relationship already declares `order_by=SignagePlaylistItem.position`.** Belt-and-braces — a future relationship edit shouldn't silently break envelope ordering.
- **Empty-envelope etag = `sha256('empty')`.** Every unmatched poll still validates an `If-None-Match`, so the 30s polling cycle stays at 0 bytes until the device is tagged.
- **`transition` coerced to `""` on the wire.** ORM column is nullable `String(32)`, but making the schema field `str | None` forces every downstream consumer into Optional handling for a value that's purely cosmetic. Empty string preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted plan's envelope item to match actual ORM column name**
- **Found during:** Task 2 (writing resolver)
- **Issue:** The plan code block referenced `it.duration_ms` on `SignagePlaylistItem`, but the Phase 41 model defines the column as `duration_s` (seconds).
- **Fix:** Resolver multiplies `duration_s * 1000` at envelope construction time; documented the mapping in both the resolver module docstring and the `PlaylistEnvelopeItem` docstring.
- **Files modified:** `backend/app/services/signage_resolver.py`, `backend/app/schemas/signage.py`
- **Verification:** `test_resolver_item_fields_populated` seeds `duration_s=7` and asserts `duration_ms == 7000`. Passes.
- **Committed in:** `c4cda49` (Task 2 GREEN commit)

**2. [Rule 2 - Missing Critical] Transition coercion to empty string**
- **Found during:** Task 1 (schema design)
- **Issue:** Plan spec'd `transition: str` (non-nullable), but ORM column is nullable and most seeded items will have None.
- **Fix:** Resolver coerces `it.transition or ""`; schema field stays `str`. Single-point conversion keeps the wire contract simple.
- **Files modified:** `backend/app/services/signage_resolver.py`
- **Verification:** `test_resolver_item_fields_populated` with `transition="fade"` passes; implicit null-coercion exercised in position-ordering test.
- **Committed in:** `c4cda49`

**3. [Rule 3 - Blocking] Dropped plan's `SignageMedia` import from resolver**
- **Found during:** Task 2
- **Issue:** Plan's skeleton imports `SignageMedia`, but the resolver never references it directly — media is loaded via `SignagePlaylistItem.media` relationship. Unused import would fail lint/ruff.
- **Fix:** Omitted the unused import; media access stays via the relationship.
- **Committed in:** `c4cda49`

**4. [Rule 3 - Blocking] Renamed `last_seen_at` mention in docstring to satisfy acceptance grep**
- **Found during:** Task 2 verification
- **Issue:** Plan acceptance criterion requires `grep -c "last_seen_at" backend/app/services/signage_resolver.py == 0`. The D-10 purity comment originally used the literal column name.
- **Fix:** Rephrased to "device presence timestamp" — preserves the semantic while satisfying the grep guard that Plan 43-05's CI will enforce.
- **Committed in:** `c4cda49`

---

**Total deviations:** 4 auto-fixed (1 missing-critical, 3 blocking). All are adaptations to the actual Phase 41 ORM shape — no scope creep.
**Impact on plan:** None. All plan success criteria met; all acceptance greps pass.

## Issues Encountered
None. Local `python3` lacks PEP 604 union syntax support for the `_base.py` module, so verification runs inside the `api` container (`docker compose exec api ...`) — standard for this project.

## User Setup Required
None — no external service configuration.

## Next Phase Readiness
- Plan 43-03 (admin CRUD router) and Plan 43-04 (player router + heartbeat sweeper) can import `resolve_playlist_for_device` and `compute_playlist_etag` directly; both are file-disjoint from this plan (Wave 1/2 split in Plan 43 plan set).
- `PlaylistEnvelope` and `HeartbeatRequest` are the wire contract Plan 43-04 will return/accept.
- Plan 43-05's dep-audit + grep guards will find the router-level admin gate, the etag helper, and the purity invariant already in place.

---
*Phase: 43-media-playlist-device-admin-api-polling*
*Completed: 2026-04-18*

## Self-Check: PASSED

All created files exist on disk; all 3 task commits verified in git log.
