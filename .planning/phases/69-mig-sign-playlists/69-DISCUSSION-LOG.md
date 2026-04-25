# Phase 69: MIG-SIGN — Playlists - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Discussed:** 2026-04-25
**Mode:** discuss (interactive, single-batch)
**Prior context loaded:** PROJECT.md, REQUIREMENTS.md, STATE.md, 65/66/67/68-CONTEXT.md

---

## Selected gray areas

User selected all 4 presented:
1. Items GET shape
2. Tags PUT diff strategy
3. Hybrid cache invalidation
4. CI guard precision

---

## Q1: Items GET shape

**Question:** How should `listPlaylistItems(playlistId)` read items via Directus?

| Option | Trade-off |
|--------|-----------|
| **Flat readItems + filter** ★ recommended | 1:1 shape parity with FastAPI route; surviving bulk-PUT response stays compatible |
| Nested via readItem('signage_playlists') | One round-trip, but bulk-PUT returns flat list — FE must handle two shapes |
| Flat + minimal fields | Drop created_at/updated_at; tighter Viewer allowlist but FE doesn't render them |

**Selected:** Flat readItems + filter (Recommended)

**Rationale captured in CONTEXT.md D-01:** mirrors `SignagePlaylistItemRead` 8-field shape exactly so surviving bulk-PUT items endpoint and migrated GET stay shape-compatible.

---

## Q2: Tags PUT diff strategy

**Question:** How should `replacePlaylistTags(id, tagIds)` perform atomic tag-map replace?

| Option | Trade-off |
|--------|-----------|
| **FE-side diff via Directus SDK** ★ recommended | Two round-trips worst case; race-tolerant (last-write-wins acceptable for admin tag editing) |
| Directus Flow (server-driven atomic) | Single FE call, but Flow + script op adds moving parts — harder to debug |
| Keep replacePlaylistTags in FastAPI | Defers MIG-SIGN-03 scope explicitly assigned to Phase 69 — out of bounds |

**Selected:** All recommendations (user response: "work with all recommendation and dont ask")

**Rationale captured in CONTEXT.md D-02 / D-02a / D-02b:** FE-side diff using `Promise.all` for parallel delete+create; multi-event SSE tolerated; pattern designed to lift cleanly into a shared `replaceTagMap` util in Phase 71.

---

## Q3: Hybrid cache invalidation

**Question:** React Query invalidation when surviving FastAPI writes (DELETE, bulk-PUT items) complete?

| Option | Trade-off |
|--------|-----------|
| **Namespaced keys + cross-invalidation** ★ recommended | Mirrors Phase 67 D-15 (employees + overtime); explicit scope per writer |
| Single shared key per playlist | Simpler invalidation but every items mutation forces metadata refetch |
| Optimistic update + rollback | Lower latency, more code — Phase 71 territory |

**Selected:** Namespaced keys + cross-invalidation (Recommended)

**Rationale captured in CONTEXT.md D-03 / D-03a / D-03b:** read keys namespaced under `['directus', collection, ...]`; explicit cross-invalidation rules table; optimistic updates explicitly deferred.

---

## Q4: CI guard precision

**Question:** How should the CI grep guard distinguish migrated vs surviving playlist routes?

| Option | Trade-off |
|--------|-----------|
| **Method-anchored regex** ★ recommended | Block `(post|get|patch)` on `/api/signage/playlists` and `put` on `.../tags`; allow `delete` and `put .../items` |
| Route-literal block list | Less precise; risks false positives on table-name references in surviving routes |
| Skip for Phase 69 | Defers to Phase 71 — opens a regression window |

**Selected:** Method-anchored regex (Recommended)

**Rationale captured in CONTEXT.md D-04 / D-04a / D-04b:** three explicit regex patterns; pre-stack CI step adjacent to Phase 67/68 guards; `_notify_playlist_changed` helper intentionally not guarded (still required by surviving routes).

---

## Auto-applied recommendations

User instruction "work with all recommendation and dont ask" was honored from Q2 onward — no further AskUserQuestion calls were issued. The recommended option for Q3 and Q4 was selected and recorded as locked decisions.

## Deferred ideas captured

- Optimistic update + rollback (Phase 71 polish)
- `_notify_playlist_changed` consolidation (Phase 71 CLEAN)
- Shared `replaceTagMap` util factored across Phases 69 + 70 (Phase 71 FE-01)
- Inline edit affordances on Playlists admin page (out of v1.22 scope)
- Contract-snapshot tests per migrated endpoint (Phase 71 FE-04)

---

*Audit log only. Do not feed to downstream agents.*
