# Phase 70: MIG-SIGN — Devices - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 70-mig-sign-devices
**Areas discussed:** Hybrid resolved-playlist endpoint shape; List page fetch strategy; `replaceDeviceTags` diff strategy; Computed-field naming on Directus row

---

## Hybrid resolved-playlist endpoint shape

| Option | Description | Selected |
|--------|-------------|----------|
| A. Match today's attach shape | `{current_playlist_id, current_playlist_name, tag_ids}` mirrors `SignageDeviceRead` extras at devices.py:67-78 — zero FE shape churn; literal field-copy merge | ✓ |
| B. Minimal | `{playlist_id, name}` — cleaner contract, but FE must rename on merge | |
| C. Full envelope | `{playlist_id, name, etag, expires_at, ...}` — gives FE etag, but more than list needs (etag is a per-player concern) | |

**User's choice:** A (recommended)
**Notes:** Locked as D-01. Preserves the existing TS row shape so consumers (`DevicesPage`, dialogs) need no field renames; merge becomes `{...directusRow, ...resolvedResponse}`.

---

## List page fetch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A. `useQueries` per-device | One `readItems('signage_devices')` + N parallel `useQueries` keyed `['fastapi', 'resolved', deviceId]`; native React Query caching per-device; SSE invalidation per-device is trivial | ✓ |
| B. Bulk endpoint | New `GET /api/signage/resolved?device_ids=...` returning `Record<id, {...}>`; one round-trip but new shape, harder bulk invalidation | |
| C. Server-merged | Keep FastAPI `GET /devices` doing the merge — defeats Phase 70 goal | |

**User's choice:** A (recommended)
**Notes:** Locked as D-02. Per-device key aligns with SSE bridge — `device-changed`/`playlist-changed` for device X invalidates only `['fastapi', 'resolved', X]`. <20 devices in practice, so N parallel HTTP/2 requests are negligible.

---

## `replaceDeviceTags` diff strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A. FE-driven diff via Directus SDK | Mirror Phase 69 D-02 exactly: read existing map, compute add/remove, parallel `deleteItems`+`createItems`; tag-map LISTEN trigger fires `playlist-changed` per row write | ✓ |
| B. Keep PUT tags on FastAPI | Defer migration to Phase 71 — keeps `_notify_device_self` explicit but splits MIG-SIGN-04 across two phases and breaks success criterion #1 | |

**User's choice:** A (recommended)
**Notes:** Locked as D-03. Phase 65 LISTEN bridge on `signage_device_tag_map` is writer-agnostic — replaces `_notify_device_self` semantically; FE listener invalidates per-device resolved cache key (D-02c) so player still refetches.

---

## Computed-field naming on Directus row

| Option | Description | Selected |
|--------|-------------|----------|
| A. Keep names verbatim | `current_playlist_id`, `current_playlist_name` populated client-side after merge; zero consumer changes | ✓ |
| B. Rename to `resolved_*` | Cleaner mental model but ripples through every consumer + `SignageDeviceRead` schema | |

**User's choice:** A (recommended)
**Notes:** Locked as D-04. Add a TSDoc comment noting the fields are computed via `/api/signage/resolved/{id}`, not Directus-backed.

---

## Claude's Discretion

- Pydantic-to-TS field name parity check for `SignageDevice` (planner verifies hand-typed vs collection schema)
- Wave/plan ordering finalized by planner (tentative: Wave 1 = router migration + new resolved router + FE swap with `useQueries` merge; Wave 2 = SSE regression + CI guard + admin smoke + test triage)
- `Promise.all` vs sequential in `replaceDeviceTags` (Phase 69 used parallel — recommend same)
- Whether the new `resolved.py` router carries its own request log decorator
- Whether to bundle FE merge logic into the same plan as the FE adapter swap or split

## Deferred Ideas

- Optimistic update + rollback for tag-map writes — Phase 71 polish
- Bulk `GET /api/signage/resolved?device_ids=...` — only justified at >50 devices
- Renaming `current_playlist_*` to `resolved_*` — cosmetic
- Consolidating `_notify_device_self` / `_notify_playlist_changed` — Phase 71 CLEAN
- Shared `replaceTagMap(...)` util — Phase 71 FE-01
- Contract-snapshot tests per migrated endpoint — Phase 71 FE-04
