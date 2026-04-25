# Phase 71: FE polish + CLEAN — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the Directus/FastAPI boundary in place across the v1.22 migration:
- Contract-snapshot tests freeze adapter response shapes
- All migrated FastAPI routers / schemas / tests / `main.py` registrations are deleted
- Rollback from a clean checkout (pre-Phase-68) is proven via documented runbook
- CI grep guards block literal regression of migrated routes
- Architecture docs reflect the new Directus = shape, FastAPI = compute split

**Out of scope (carried forward, not in this phase):**
- Optimistic updates on Directus writes (Phase 69 D-03b, Phase 70 D-05b)
- Settings rewrite to Directus (deferred — see PROJECT.md)
- New Directus collections or schema changes
- Any surviving FastAPI compute endpoint changes

</domain>

<decisions>
## Implementation Decisions

### Carried forward from prior phases (locked, not re-asked)
- **D-00a:** Directus SDK cookie-mode auth + short-lived token in `apiClient.ts` singleton (Phases 29/64; reused 66–70).
- **D-00b:** Caddy reverse-proxies `/directus/*` → `directus:8055`; same-origin via `VITE_DIRECTUS_URL` fallback (Phase 64 D-05).
- **D-00c:** Viewer field allowlists locked in Phase 65 (AUTHZ-04). Admin = `admin_access: true`.
- **D-00d:** Phase 65 LISTEN bridge is the SSE source of truth for Directus-originated writes. `--workers 1` invariant + single asyncpg listener preserved.
- **D-00e:** `signageApi.ts` public function signatures stable (Phases 67/68/69/70). This phase MAY introduce a structural seam refactor if needed (Phase 68 D-07 punted that to here) — but only if the snapshot test work makes it cleaner.
- **D-00f:** Hand-maintained TS row types — no Directus schema codegen.
- **D-00g:** Canonical Directus client at `@/lib/directusClient` (Phase 68 Plan 04).
- **D-00h:** Each prior phase added its own scoped CI grep guard. Phase 71 keeps them as-is and adds only the new CLEAN-04 guards (DB_EXCLUDE_TABLES superset check, SSE `--workers 1` invariant comment preservation).

### Contract-snapshot tests (FE-05)
- **D-01:** **JSON fixture files + deep-equal diff.** One `.json` baseline per migrated GET endpoint under `frontend/src/tests/contracts/`. Test fetches via the adapter (with mocked Directus SDK), `expect(response).toEqual(baseline)`. Diffs surface in PR review as fixture file changes.
- **D-01a:** **Frontend adapter-level only.** Tests run in vitest with mocked Directus SDK. The adapter is the contract surface for FE consumers — that's where the lock matters. No backend pytest equivalent (Directus version drift surfaces in admin Directus CRUD smoke tests already added in Phases 68/69/70).
- **D-01b:** **Coverage = all migrated reads.** ~9 fixtures: `/api/me` (now Directus `readMe`), sales (`fetchSalesRecords`), employees (`fetchEmployees`), `signage_tags`, `signage_schedules`, `signage_playlists`, `signage_playlist_items` (per-playlist), `signage_devices`, `/api/signage/resolved/{id}` (per-device). Writes are NOT covered (lower regression risk; consumers don't pattern-match write responses).
- **D-01c:** **Regen flow = `UPDATE_SNAPSHOTS=1 npm test`** overwrites fixtures. Commit message convention `contract: regenerate <endpoint>` flagged by reviewer (no automated CI gate — humans decide if a shape change is intentional).

### Cache purge on first post-deploy boot (FE-02/03)
- **D-02:** **Versioned localStorage key.** Key `kpi.cache_purge_v22` set to `"done"` after the one-shot purge runs. Hardcoded version constant in `frontend/src/App.tsx` boot path (or wherever the QueryClient is instantiated). Bumped manually in v1.23+ if another purge is needed.
- **D-02a:** **Scope = legacy `['signage', ...]` only.** `queryClient.removeQueries({queryKey:['signage']})`. The new `['directus', <collection>, ...]` and `['fastapi', <key>, ...]` namespaces stay untouched. Goal is to evict pre-Phase-65 cached `/api/signage/*` responses, NOT to nuke the entire cache.
- **D-02b:** **New cache-key namespace already in place.** Phases 67/68/69/70 introduced `['directus', <collection>, ...]` and `['fastapi', <topic>, ...]` keys alongside legacy `signageKeys.*`. Phase 71 documents this as the canonical pattern in the architecture doc; legacy `signageKeys.*` consumers will be culled when their components are touched (not in this phase).

### DirectusError normalization (FE-04)
- **D-03:** **Central `toApiError()` helper** at `frontend/src/lib/toApiError.ts`. Every adapter call wraps with `try { ... } catch (e) { throw toApiError(e) }`. Returns/throws an `ApiErrorWithBody({status, detail, code?})` matching the existing FastAPI error contract.
- **D-03a:** **FK 409 reshape lives inside `toApiError()`.** Detect FK constraint violations from Directus error code (e.g., `RECORD_NOT_UNIQUE` or FK-specific codes — confirm during research) and reshape the body to `{detail: "...", schedule_ids: [...]}` so existing consumers (`PlaylistDeleteDialog`, etc.) receive the same shape they got from FastAPI's surviving `DELETE /playlists/{id}` (Phase 69 contract). Single source of truth for error shape.
- **D-03b:** **Today's reshape population:** Directus's FK error doesn't include the offender IDs in the response — the helper may need to issue a follow-up Directus `readItems` filtered by the FK before throwing, OR rely on the surviving FastAPI DELETE for any endpoint where the structured body is required. Researcher should establish which Directus-served deletes actually exist in the migrated surface; if all deletes-with-FK-dependents stay on FastAPI (which is the current state), `toApiError` only needs message normalization, not ID reshape. **Defer ID-reshape implementation until a Directus-served DELETE with FK dependents is added.**

### Rollback verification (CLEAN-03)
- **D-04:** **Signage golden-path checklist** (~10 min). Steps: checkout commit before Phase 68 → `docker compose down -v && up -d` → wait for health → log in as Admin → `/signage/devices` renders v1.21 7-column shape → `/signage/playlists` renders → pair one device end-to-end → push one playlist → view one sales dashboard. Pass = all 6 steps green; fail = open issue, abort rollback.
- **D-04a:** **Lives in `docs/operator-runbook.md`** as a new top-level section `## v1.22 Rollback Procedure`. Same place as Pi provisioning + deploy + restore-from-backup runbooks. CLEAN-03 already names this file.
- **D-04b:** **Pre-Phase-68 commit** is the rollback target (NOT pre-Phase-65). Phase 65 was schema-additive (new triggers + tag map joins); rolling back past it would require dropping triggers and is out of scope. The runbook explicitly notes this as a known limitation.

### Architecture documentation (CLEAN-05)
- **D-05:** **ADR + README link.** New file `docs/adr/0001-directus-fastapi-split.md` in classic decision-record format: Context (the v1.22 migration), Decision (Directus = shape, FastAPI = compute), Consequences (FE adapter pattern, snapshot tests, cache namespace, what stays in FastAPI), Alternatives Considered (full Directus / full FastAPI / status quo). README's architecture section gets a 3-line summary linking to the ADR.
- **D-05a:** ADR enumerates what STAYS in FastAPI: upload POST + parsing, KPI compute endpoints, Personio/sensor sync (APScheduler), signage_player SSE bridge, signage_pair JWT minting, media/PPTX, calibration PATCH, `/api/signage/resolved/{id}`. This is the canonical "FastAPI surface" reference.
- **D-05b:** Settings is called out as deferred-not-decided in the Consequences section (preserves the v1.22 PROJECT.md scoping note).

### Dead code deletion (CLEAN-01/02)
- **D-06:** **Single-PR atomic sweep.** One plan deletes all migrated FastAPI routers + schemas + their dedicated tests + `main.py` registrations in one wave. No partial states. The plan ends with a passing surface assertion (D-07) before the doc commit.
- **D-06a:** **Devices.py keeps its name.** Phase 70 already trimmed it to calibration-only. No rename — would ripple imports for cosmetic gain.
- **D-06b:** **Files in deletion scope (researcher confirms exact list):**
  - `backend/app/routers/me.py` (already deleted in Phase 66 — verify gone)
  - `backend/app/routers/data.py` (already deleted in Phase 67 — verify gone)
  - `backend/app/routers/signage_admin/tags.py` + `schedules.py` (Phases 68 — verify gone)
  - `backend/app/routers/signage_admin/playlists.py` partial (Phase 69 trimmed; surviving DELETE + bulk PUT items remain — verify shape)
  - `backend/app/routers/signage_admin/playlist_items.py` partial (Phase 69 — verify shape)
  - Any orphaned schema modules under `backend/app/schemas/` for the migrated collections
  - Tests under `backend/tests/signage/` and `backend/tests/test_data_*.py` / `test_me_*.py` that still hit the deleted FastAPI surface
- **D-06c:** **Clarification:** Phases 66–70 already deleted most of this code as they migrated. CLEAN-01/02 in Phase 71 is the **catch-all sweep** for any orphans — schemas no longer imported, helper functions only used by deleted handlers, dead test files. The researcher's first task is to inventory what actually remains.

### FastAPI surface assertion (CLEAN-02)
- **D-07:** **OpenAPI paths snapshot.** New test `backend/tests/test_openapi_paths_snapshot.py` reads `app.openapi()['paths']`, sorts the keys, asserts equality with `backend/tests/contracts/openapi_paths.json`. Regenerated with `UPDATE_SNAPSHOTS=1` (same env var as FE-05 for consistency). Catches accidental re-registration of a deleted router.

### DB_EXCLUDE_TABLES superset check (CLEAN-04)
- **D-08:** **Pytest assertion** at `backend/tests/test_db_exclude_tables_superset.py`. Imports `DB_EXCLUDE_TABLES` from `backend/app/config.py` (or wherever it lives — researcher confirms path), asserts the set is a superset of the v1.22 migrated collection names: `{'signage_tags', 'signage_schedules', 'signage_playlists', 'signage_playlist_items', 'signage_playlist_tag_map', 'signage_devices', 'signage_device_tag_map', 'sales_records', 'employees'}` (final list confirmed by researcher cross-checking REQUIREMENTS.md). Test fails loudly if a future PR removes any entry.

### CI guard consolidation strategy (CLEAN-04)
- **D-09:** **Keep per-phase guard steps as-is.** Phases 66/67/68/69/70 each added a scoped, working grep guard. Phase 71 adds only what's missing:
  - `/api/me` grep in `frontend/src/` (FE shouldn't call the deleted endpoint — likely already covered by Phase 66, verify)
  - `GET /api/data/sales` + `GET /api/data/employees` grep in backend code (verify Phase 67 covers; extend if not)
  - SSE `--workers 1` invariant — add a CI step that greps `backend/Dockerfile` (or compose) for the `--workers 1` literal and the explanatory comment; fails if either is missing
  - DB_EXCLUDE_TABLES superset (Pytest, see D-08)
- **D-09a:** **No CI workflow refactor.** Resist the urge to consolidate guards into a `guards.sh` script — disturbs working CI for cosmetic gain. Phase 71 is about locking, not restructuring.

### Claude's Discretion
- Exact ADR file numbering convention (`0001` zero-padded vs `001`) — researcher checks if any prior ADRs exist; otherwise plan picks the convention.
- Whether to extract a shared `replaceCollectionTagMap(collection, parentCol, parentId, tagIds)` util now that both `replacePlaylistTags` and `replaceDeviceTags` exist (Phase 70 D-03d primed this). Recommend YES if the snapshot tests are easier with the shared util — but leave it to the planner to weigh the diff cost.
- The exact set of legacy `signageKeys.*` consumers to either rename to the new `['directus', ...]` namespace or leave alone. Suggested heuristic: if a component already touches new keys, finish the rename; otherwise leave for ad-hoc cleanup.

### Folded Todos
None — `todo match-phase 71` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scoping & requirements
- `.planning/ROADMAP.md` §"Phase 71: FE polish + CLEAN" — goal, depends-on, requirement IDs, success criteria
- `.planning/REQUIREMENTS.md` — FE-01..FE-05 (lines 93–97), CLEAN-01..CLEAN-05 (lines 101–105), traceability table (lines 140–149)
- `.planning/PROJECT.md` §"Current Milestone: v1.22 Backend Consolidation" — out-of-scope items (Settings, sensors CRUD, etc.)

### Prior-phase context (locked decisions Phase 71 inherits)
- `.planning/phases/65-foundation-schema-authz-sse-bridge/65-CONTEXT.md` — LISTEN bridge contract, Viewer allowlists
- `.planning/phases/66-kill-me-py/66-CONTEXT.md` — first FastAPI deletion pattern + CI grep guard template
- `.planning/phases/67-migrate-data-py-sales-employees-split/67-CONTEXT.md` — D-01 inline-swap pattern, D-02 hand-maintained TS types, D-15 query-key namespacing
- `.planning/phases/68-mig-sign-tags-schedules/68-CONTEXT.md` — D-07 inline swap, D-12 grep guard, Plan 04 canonical client import path
- `.planning/phases/69-mig-sign-playlists/69-CONTEXT.md` — D-02 FE-driven tag-map diff pattern, D-03 query-key namespacing, D-04 method-anchored grep
- `.planning/phases/70-mig-sign-devices/70-CONTEXT.md` — D-01 resolved endpoint contract, D-02 useQueries cross-source merge, D-03d shared-util-priming note
- `.planning/phases/70-mig-sign-devices/70-VERIFICATION.md` — final state of MIG-SIGN at end of v1.22 migration phases

### FE adapter & types
- `frontend/src/signage/lib/signageApi.ts` — adapter functions whose contracts FE-05 freezes
- `frontend/src/signage/lib/signageTypes.ts` (or wherever `SignageDevice`, `SignagePlaylist`, etc. live — researcher confirms path) — TS row types
- `frontend/src/lib/directusClient.ts` (Phase 68 Plan 04) — canonical SDK import path
- `frontend/src/lib/apiClient.ts` — `ApiErrorWithBody` contract that `toApiError()` must produce

### Backend surface
- `backend/app/main.py` — router registrations to remove (CLEAN-02)
- `backend/app/routers/signage_admin/__init__.py` — package router; Phase 70 added `resolved.py` here
- `backend/app/routers/signage_admin/devices.py` — surviving calibration PATCH only after Phase 70
- `backend/app/config.py` (or `settings.py` — researcher confirms) — `DB_EXCLUDE_TABLES` definition for D-08
- `backend/app/listen_bridge.py` (or wherever the asyncpg LISTEN consumer lives) — `--workers 1` invariant comment to preserve

### Tests
- `backend/tests/signage/test_pg_listen_sse.py` — Phase 65 SSE pattern; not modified by Phase 71 but referenced
- `backend/tests/signage/test_admin_directus_crud_smoke.py` — Phases 68/69/70 admin smoke pattern
- `backend/tests/test_rbac.py` — READ_ROUTES catalog; final cleanup of any deleted routes still listed
- `backend/tests/signage/test_permission_field_allowlists.py` — Phase 65/68/69/70 commentary

### Operator docs
- `docs/operator-runbook.md` — destination for D-04 rollback section
- `README.md` — destination for D-05 ADR link
- `docs/adr/` — destination directory for D-05 ADR (create if missing)
- `.github/workflows/ci.yml` — destination for D-09 grep guards

### CI grep guards (existing — don't disturb)
- Phase 66 guard: blocks `/api/me` in `frontend/src/`
- Phase 67 guard: blocks `/api/data/sales` + `/api/data/employees` in `backend/app/`
- Phase 68 guard: blocks `/api/signage/tags` + `/api/signage/schedules` in `backend/app/`
- Phase 69 guard: blocks migrated playlist routes scoped to `playlists.py` / `playlist_items.py`
- Phase 70 guard: blocks migrated device routes scoped to `signage_admin/devices.py`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`signageApi.ts` adapter functions** — all Directus-swap work done across Phases 67–70. FE-01 is essentially DONE; Phase 71 just locks shapes via snapshots and adds error-normalization wrapping.
- **Vitest + React Testing Library** — already in use in `frontend/src/signage/pages/DevicesPage.test.tsx` (Phase 70). Same setup works for snapshot tests.
- **`ApiErrorWithBody`** in `frontend/src/lib/apiClient.ts` — established error contract that `toApiError()` produces.
- **`directusClient.ts`** (Phase 68 Plan 04) — canonical client; `toApiError()` lives next to it.
- **`replacePlaylistTags` (Phase 69 D-02) + `replaceDeviceTags` (Phase 70 D-03)** — primed for shared-util extraction; planner's call.
- **OpenAPI introspection** — FastAPI's `app.openapi()` is the existing API for D-07 snapshot.
- **Per-phase CI grep step pattern** — Phases 66–70 each have a working step in `.github/workflows/ci.yml`; D-09 mirrors that shape.

### Established Patterns
- **Public adapter signatures stable** (D-00e) — Phase 71 may refactor internals but consumers don't change.
- **Per-writer-surface query keys** (Phase 67 D-15) — `['directus', collection, ...]` and `['fastapi', topic, ...]`. Locked.
- **Hand-maintained TS row types** (Phase 67 D-02) — no codegen.
- **Method-anchored, file-scoped grep guards** (Phase 69 D-04) — precision over breadth.
- **JSON contract baselines + UPDATE env var** — establish in this phase as the project pattern (FE-05 + D-07).

### Integration Points
- `frontend/src/App.tsx` (or QueryClient instantiation site) — D-02 cache purge on boot
- `frontend/src/lib/toApiError.ts` (NEW) — D-03 normalization
- `frontend/src/tests/contracts/*.json` (NEW directory) — D-01 baselines
- `backend/tests/contracts/openapi_paths.json` (NEW) — D-07 baseline
- `backend/tests/test_openapi_paths_snapshot.py` (NEW) — D-07 assertion
- `backend/tests/test_db_exclude_tables_superset.py` (NEW) — D-08 assertion
- `docs/adr/0001-directus-fastapi-split.md` (NEW) — D-05 ADR
- `docs/operator-runbook.md` — D-04 rollback section appended
- `README.md` — D-05 link added
- `.github/workflows/ci.yml` — D-09 new grep steps appended

</code_context>

<specifics>
## Specific Ideas

- All gray-area answers landed on the recommended option — strong default-driven phase. The planner should treat this as a "lock and document" phase, not a creative one.
- The `toApiError()` helper is the only NEW runtime code. Everything else is tests, docs, and CI.
- The single-PR sweep for CLEAN-01/02 is acceptable BECAUSE Phases 66–70 already did most of the deletion incrementally — the sweep is a finishing pass, not a flag-day rewrite.
- ADR format establishes a precedent: `docs/adr/` may grow over future milestones. The numbering choice (0001 vs 001) is the planner's call, but consistency matters more than the choice itself.

</specifics>

<deferred>
## Deferred Ideas

- **Optimistic updates** on Directus writes — Phase 69 D-03b + Phase 70 D-05b explicitly punted; not Phase 71.
- **Settings rewrite to Directus** — PROJECT.md v1.22 milestone scoping calls this out as next-milestone candidate.
- **Shared `replaceCollectionTagMap()` util** — only if the planner finds it cleans up snapshot test setup; otherwise post-v1.22.
- **Legacy `signageKeys.*` consumer cleanup** — ad-hoc, when the next change happens to touch the component. Not a Phase 71 line item.
- **Backend-level snapshot tests** (Directus version-drift detection) — covered today by admin Directus CRUD smoke; revisit if Directus version bump introduces breakage.
- **CI guard consolidation into `guards.sh`** — explicitly rejected for Phase 71 (D-09a); revisit only if the per-phase guards become unmaintainable.
- **ADR-002+ topics** (e.g., per-collection RLS strategy, future Settings ADR) — created when their decisions are made, not preemptively.

</deferred>

---

*Phase: 71-fe-polish-clean*
*Context gathered: 2026-04-25*
