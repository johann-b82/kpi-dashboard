---
phase: 43-media-playlist-device-admin-api-polling
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/services/signage_resolver.py
  - backend/app/schemas/signage.py
  - backend/tests/test_signage_resolver.py
autonomous: true
requirements:
  - SGN-BE-06
must_haves:
  truths:
    - "Given a device with tags and an enabled matching playlist, resolver returns the highest-priority playlist's items ordered by position ASC"
    - "Given a device with no tags, resolver returns the empty envelope (playlist_id=None, items=[])"
    - "Given a device with tags but no matching playlist, resolver returns the empty envelope"
    - "Given two matching playlists, higher priority wins; tie broken by updated_at DESC"
  artifacts:
    - path: backend/app/services/signage_resolver.py
      provides: "resolve_playlist_for_device() async service"
      contains: "async def resolve_playlist_for_device"
    - path: backend/app/schemas/signage.py
      provides: "PlaylistEnvelope, PlaylistEnvelopeItem, HeartbeatRequest response/request schemas"
      contains: "class PlaylistEnvelope"
    - path: backend/tests/test_signage_resolver.py
      provides: "pytest-asyncio tests covering D-06/D-07/D-08"
      contains: "priority DESC"
  key_links:
    - from: backend/app/services/signage_resolver.py
      to: backend/app/models/signage.py
      via: "selectinload of SignagePlaylist.items"
      pattern: "selectinload\\(SignagePlaylist"
---

<objective>
Build the pure tag-to-playlist resolver service (SGN-BE-06) and add the Pydantic response/request envelopes consumed by Plan 04's player router. This plan is file-disjoint from all other Plan 43 plans so it runs in Wave 1.

Purpose: The resolver is the single source of truth for "which playlist should this device play right now?". Isolating it in a service keeps the router thin and the resolver directly testable without the FastAPI layer.

Output: One new service module, one extended schemas module, one new test file covering decisions D-06/D-07/D-08.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md
@.planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md
@backend/app/models/signage.py
@backend/app/schemas/signage.py
@backend/tests/conftest.py

<interfaces>
From backend/app/models/signage.py (Phase 41):
- class SignageDevice — id, status, last_seen_at, revoked_at, current_item_id
- class SignagePlaylist — id, name, priority, enabled, updated_at, items (relationship → SignagePlaylistItem)
- class SignagePlaylistItem — id, playlist_id, media_id, position, duration_ms, transition, updated_at
- class SignageMedia — id, kind, uri (or equivalent path/url field; inspect model), title
- class SignageDeviceTagMap — device_id, tag_id
- class SignagePlaylistTagMap — playlist_id, tag_id
- class SignageDeviceTag — id, name

From backend/app/schemas/signage.py (Phase 41 — 19 Pydantic schemas exist):
Review existing schema naming convention (Base/Create/Read trios) before adding new ones.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add PlaylistEnvelope + HeartbeatRequest Pydantic schemas</name>
  <files>backend/app/schemas/signage.py</files>
  <read_first>
    - backend/app/schemas/signage.py (full file; learn the existing schema style — snake_case, ConfigDict, field conventions)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-CONTEXT.md §decisions D-06, D-07, D-11
  </read_first>
  <behavior>
    - PlaylistEnvelopeItem serializes with fields: media_id (UUID), kind (str), uri (str), duration_ms (int), transition (str), position (int)
    - PlaylistEnvelope serializes with fields: playlist_id (UUID | None), name (str | None), items (list[PlaylistEnvelopeItem]), resolved_at (datetime)
    - PlaylistEnvelope with playlist_id=None and items=[] and resolved_at=<utc now> is valid (empty envelope per D-06)
    - HeartbeatRequest accepts {"current_item_id": "<uuid>", "playlist_etag": "<str>"} and both fields are Optional (nullable)
    - HeartbeatRequest with {"current_item_id": null, "playlist_etag": null} is valid
  </behavior>
  <action>
    Append to `backend/app/schemas/signage.py` (keep existing code untouched; add at the end of the file after existing classes):

    ```python
    # -------------------- Phase 43: Player envelopes (D-06, D-07, D-11) --------------------

    class PlaylistEnvelopeItem(BaseModel):
        """Single item in the resolved playlist envelope. D-07."""
        model_config = ConfigDict(from_attributes=True)

        media_id: uuid.UUID
        kind: str
        uri: str
        duration_ms: int
        transition: str
        position: int


    class PlaylistEnvelope(BaseModel):
        """Tag-resolved playlist envelope returned by GET /api/signage/player/playlist.

        Empty when playlist_id is None and items is []. D-06/D-07.
        """
        model_config = ConfigDict(from_attributes=True)

        playlist_id: uuid.UUID | None = None
        name: str | None = None
        items: list[PlaylistEnvelopeItem] = Field(default_factory=list)
        resolved_at: datetime


    class HeartbeatRequest(BaseModel):
        """Player -> server heartbeat payload. D-11."""
        model_config = ConfigDict(extra="ignore")

        current_item_id: uuid.UUID | None = None
        playlist_etag: str | None = None
    ```

    If `BaseModel`, `ConfigDict`, `Field`, `datetime`, `uuid` are not already imported at the top of the file, add missing imports. Inspect the existing file first to avoid duplicate imports.

    If the SignageMedia ORM model's URL/path field is NOT named `uri`, adapt the envelope item to the actual field name and document the mapping in the resolver (Task 2). The `kind` and `uri` values MUST be populated from the joined media row in the envelope builder.
  </action>
  <verify>
    <automated>cd backend && python -c "from app.schemas.signage import PlaylistEnvelope, PlaylistEnvelopeItem, HeartbeatRequest; import uuid; from datetime import datetime, timezone; e = PlaylistEnvelope(playlist_id=None, name=None, items=[], resolved_at=datetime.now(timezone.utc)); print(e.model_dump_json()); h = HeartbeatRequest(current_item_id=None, playlist_etag=None); print(h.model_dump_json())"</automated>
  </verify>
  <acceptance_criteria>
    - grep -nE "^class PlaylistEnvelope\b|^class PlaylistEnvelopeItem\b|^class HeartbeatRequest\b" backend/app/schemas/signage.py returns 3 lines
    - `python -c "from app.schemas.signage import PlaylistEnvelope, PlaylistEnvelopeItem, HeartbeatRequest"` exits 0
    - PlaylistEnvelope accepts empty-envelope construction (playlist_id=None, items=[])
    - HeartbeatRequest accepts null current_item_id and null playlist_etag
  </acceptance_criteria>
  <done>Three new Pydantic classes importable, empty-envelope construction works, existing schemas untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement signage_resolver service with tests</name>
  <files>backend/app/services/signage_resolver.py, backend/tests/test_signage_resolver.py</files>
  <read_first>
    - backend/app/models/signage.py (especially SignagePlaylist, SignagePlaylistItem, SignageDeviceTagMap, SignagePlaylistTagMap, SignageMedia)
    - backend/app/services/signage_pairing.py (existing service style, imports, async session usage)
    - backend/tests/test_signage_pair_router.py (pytest-asyncio fixture style, AsyncSession seeding pattern)
    - backend/tests/conftest.py (db session fixture — confirm async session + test DB setup)
    - .planning/phases/43-media-playlist-device-admin-api-polling/43-RESEARCH.md §"Pattern: Tag Resolver Query (D-08, SGN-BE-06)"
  </read_first>
  <behavior>
    Test cases (must exist in test_signage_resolver.py):
    1. test_resolver_empty_envelope_when_device_has_no_tags — device with zero tag_map rows → envelope.playlist_id is None, items == []
    2. test_resolver_empty_envelope_when_no_playlist_matches — device with tag T1, but only playlists tag-mapped to T2 → empty envelope
    3. test_resolver_empty_envelope_when_match_is_disabled — matching playlist with enabled=False → empty envelope
    4. test_resolver_returns_highest_priority_playlist — two enabled matching playlists, priority 10 vs 5 → returns priority-10 playlist
    5. test_resolver_priority_tie_broken_by_updated_at_desc — two enabled matching playlists with equal priority → returns one with later updated_at
    6. test_resolver_items_ordered_by_position_asc — playlist has items at positions 3,1,2 → envelope.items ordered 1,2,3
    7. test_resolver_item_fields_populated — envelope item carries media_id, kind, uri, duration_ms, transition, position from joined media row
  </behavior>
  <action>
    Create `backend/app/services/signage_resolver.py`:

    ```python
    """Phase 43 SGN-BE-06: tag-to-playlist resolver.

    Per CONTEXT.md D-06/D-07/D-08/D-10:
    - Empty envelope on no-match (200 OK, not 404).
    - priority DESC, updated_at DESC, LIMIT 1.
    - Pure read — does NOT update last_seen_at (that's /heartbeat's job, D-10).
    """
    from __future__ import annotations

    from datetime import datetime, timezone

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import selectinload

    from app.models.signage import (
        SignageDevice,
        SignageDeviceTagMap,
        SignageMedia,
        SignagePlaylist,
        SignagePlaylistItem,
        SignagePlaylistTagMap,
    )
    from app.schemas.signage import PlaylistEnvelope, PlaylistEnvelopeItem


    def _empty_envelope() -> PlaylistEnvelope:
        return PlaylistEnvelope(
            playlist_id=None,
            name=None,
            items=[],
            resolved_at=datetime.now(timezone.utc),
        )


    async def resolve_playlist_for_device(
        db: AsyncSession, device: SignageDevice
    ) -> PlaylistEnvelope:
        """Resolve the single best-matching playlist for a device (D-08)."""
        # Step 1: device tag ids
        tag_rows = await db.execute(
            select(SignageDeviceTagMap.tag_id).where(
                SignageDeviceTagMap.device_id == device.id
            )
        )
        tag_ids = [row[0] for row in tag_rows.fetchall()]
        if not tag_ids:
            return _empty_envelope()

        # Step 2: best enabled matching playlist
        playlist_stmt = (
            select(SignagePlaylist)
            .join(
                SignagePlaylistTagMap,
                SignagePlaylistTagMap.playlist_id == SignagePlaylist.id,
            )
            .where(
                SignagePlaylist.enabled.is_(True),
                SignagePlaylistTagMap.tag_id.in_(tag_ids),
            )
            .order_by(
                SignagePlaylist.priority.desc(),
                SignagePlaylist.updated_at.desc(),
            )
            .limit(1)
            .options(
                selectinload(SignagePlaylist.items).selectinload(
                    SignagePlaylistItem.media
                )
            )
        )
        playlist = (await db.execute(playlist_stmt)).scalar_one_or_none()
        if playlist is None:
            return _empty_envelope()

        # Step 3: build envelope
        items_sorted = sorted(playlist.items, key=lambda it: it.position)
        envelope_items = [
            PlaylistEnvelopeItem(
                media_id=it.media_id,
                kind=it.media.kind if it.media is not None else "",
                uri=(it.media.uri if it.media is not None else ""),
                duration_ms=it.duration_ms,
                transition=it.transition,
                position=it.position,
            )
            for it in items_sorted
        ]
        return PlaylistEnvelope(
            playlist_id=playlist.id,
            name=playlist.name,
            items=envelope_items,
            resolved_at=datetime.now(timezone.utc),
        )


    def compute_playlist_etag(envelope: PlaylistEnvelope) -> str:
        """SHA256 over deterministic tuple (D-09). Used by player router (Plan 04)."""
        import hashlib
        import json

        if envelope.playlist_id is None:
            return hashlib.sha256(b"empty").hexdigest()
        parts: list[str] = [str(envelope.playlist_id)]
        for it in sorted(envelope.items, key=lambda i: i.position):
            parts.append(f"{it.media_id}:{it.position}:{it.duration_ms}:{it.transition}")
        return hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()
    ```

    IMPORTANT: If `SignageMedia.uri` is NOT the actual field name (inspect model first), substitute the real attribute (e.g., `media.url`, `media.path`). Do the same for `SignageMedia.kind`. If the `SignagePlaylistItem.media` relationship is not defined on the ORM, use an explicit join instead. Do NOT invent columns — read the model.

    Create `backend/tests/test_signage_resolver.py` with pytest-asyncio tests mirroring the seeding patterns in `backend/tests/test_signage_pair_router.py`. Each test seeds the required rows (device, device_tag, tag_map, playlist, playlist_tag_map, playlist_items, media) via the existing async session fixture, then calls `await resolve_playlist_for_device(db, device)` and asserts:

    - Test 1 (no tags): `envelope.playlist_id is None` and `envelope.items == []`
    - Test 2 (no match): same as above
    - Test 3 (disabled match): same as above
    - Test 4 (priority): `envelope.playlist_id == high_priority_playlist.id`
    - Test 5 (tie-break): `envelope.playlist_id == newer_updated_at_playlist.id`
    - Test 6 (position ordering): `[i.position for i in envelope.items] == [1, 2, 3]`
    - Test 7 (item fields): assert each item has non-empty `kind` and `uri` matching the seeded media, plus correct `duration_ms` and `transition`

    RED first: run the test file, confirm it fails (import error or resolver missing). GREEN: make tests pass. Do NOT update last_seen_at in the resolver (D-10 — test 8 optional: seed a device with last_seen_at=None, call resolver, assert last_seen_at still None).
  </action>
  <verify>
    <automated>cd backend && pytest tests/test_signage_resolver.py -x -v</automated>
  </verify>
  <acceptance_criteria>
    - File backend/app/services/signage_resolver.py exists with `async def resolve_playlist_for_device` and `def compute_playlist_etag`
    - grep -q "priority.desc()" backend/app/services/signage_resolver.py → exit 0
    - grep -q "updated_at.desc()" backend/app/services/signage_resolver.py → exit 0
    - grep -q "selectinload" backend/app/services/signage_resolver.py → exit 0
    - File backend/tests/test_signage_resolver.py exists with ≥6 test functions
    - `pytest backend/tests/test_signage_resolver.py -x` exits 0 with ≥6 tests passing
    - Resolver does NOT reference `last_seen_at` (grep -c "last_seen_at" backend/app/services/signage_resolver.py → 0)
  </acceptance_criteria>
  <done>Resolver service + ETag helper implemented; 6+ pytest-asyncio tests pass covering D-06/D-07/D-08; no last_seen_at mutation.</done>
</task>

</tasks>

<verification>
- Schemas importable: `from app.schemas.signage import PlaylistEnvelope, PlaylistEnvelopeItem, HeartbeatRequest`
- Resolver importable: `from app.services.signage_resolver import resolve_playlist_for_device, compute_playlist_etag`
- Resolver tests: `pytest backend/tests/test_signage_resolver.py -x -v` all pass
- No regression: `pytest backend/tests/test_signage_schema_roundtrip.py backend/tests/test_signage_pair_router.py -x` passes
</verification>

<success_criteria>
1. Tag-based resolver returns empty envelope on no-tags/no-match/disabled-match (D-06).
2. On successful match, envelope items ordered by position ASC with full media info (D-07).
3. Priority DESC, updated_at DESC tie-break verified by tests (D-08, SGN-BE-06).
4. compute_playlist_etag() produces a deterministic SHA256 usable by Plan 04's router.
5. Resolver never mutates last_seen_at (D-10).
</success_criteria>

<output>
After completion, create `.planning/phases/43-media-playlist-device-admin-api-polling/43-02-SUMMARY.md`
</output>
