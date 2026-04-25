---
phase: 71-fe-polish-clean
plan: 01
subsystem: frontend
tags: [error-handling, directus-sdk, adapter, signage]
requires:
  - ApiErrorWithBody class (frontend/src/signage/lib/signageApi.ts:29-38)
  - directus singleton (frontend/src/lib/directusClient.ts)
  - apiClient + apiClientWithBody (frontend/src/lib/apiClient.ts, signage/lib/signageApi.ts)
provides:
  - Central toApiError() helper that normalizes Directus plain-object throws + native Errors into ApiErrorWithBody
  - Every adapter call site in signageApi.ts wraps its transport call in try/catch + toApiError
  - Locked Directus/FastAPI error contract — consumers (PlaylistDeleteDialog, DeviceEditDialog) pattern-match on the same ApiErrorWithBody.body shape regardless of underlying transport
affects:
  - frontend/src/signage/lib/signageApi.ts (every adapter function)
tech-stack:
  added: []
  patterns:
    - Structural error-shape detection (no instanceof on plain-object SDK throws — Pitfall 1)
    - Pass-through on already-typed ApiErrorWithBody (avoids double-wrap)
    - Composite-read try/catch wraps the OUTER awaited expression
key-files:
  created:
    - frontend/src/lib/toApiError.ts
    - frontend/src/lib/toApiError.test.ts
  modified:
    - frontend/src/signage/lib/signageApi.ts
decisions:
  - 'Renamed local interface DirectusErrorShape → DirectusThrownShape so the file contains zero "DirectusError" string occurrences (acceptance criterion + reduces grep false-positives in future audits).'
  - 'Wrapped apiClient + apiClientWithBody calls too (not just Directus SDK calls): toApiError is a pass-through for already-typed ApiErrorWithBody and normalizes plain Error from apiClient — single contract end-to-end.'
  - 'Composite reads (listPlaylists, getPlaylist, replacePlaylistTags, replaceDeviceTags) wrap the OUTER awaited expression in one try/catch, so the first thrower normalizes the whole call (research Pattern 2 guidance).'
metrics:
  duration: 244s
  tasks_completed: 2
  files_changed: 3
  completed: 2026-04-25
requirements: [FE-01, FE-04]
---

# Phase 71 Plan 01: toApiError Adapter Summary

One-liner: Central `toApiError()` helper normalizes Directus SDK plain-object throws into the existing `ApiErrorWithBody` contract; every adapter function in `signageApi.ts` now wraps its transport call in `try { ... } catch (e) { throw toApiError(e); }`.

## What Shipped

**Task 1 (TDD): toApiError helper + 7 unit tests**

- `frontend/src/lib/toApiError.ts` — single export, ~50 LOC.
- Resolution order:
  1. Pass-through if already `ApiErrorWithBody` (avoid double-wrap).
  2. Structural Directus check (`"errors" in err`) — extracts status from `response.status ?? 500`, detail from `errors[0].message`, code from `errors[0].extensions.code`.
  3. Native `Error` → `ApiErrorWithBody(500, { detail: err.message }, err.message)`.
  4. Fallback (string / unknown) → `ApiErrorWithBody(500, { detail: String(err) }, ...)`.
- `frontend/src/lib/toApiError.test.ts` — 7 vitest cases covering identity pass-through, plain-object Directus error with/without `response.status` and `extensions.code`, missing-message fallbacks (`"Directus error (CODE)"` / `"Directus error"`), native Error, and plain string.
- RED → GREEN commit split (TDD).

**Task 2: signageApi.ts wrapping pass**

- One new import: `import { toApiError } from "@/lib/toApiError";`
- Every adapter function refactored from arrow-shorthand `() => directus.request(...) as Promise<T>` to:
  ```ts
  async (): Promise<T> => {
    try { return (await directus.request(...)) as T; }
    catch (e) { throw toApiError(e); }
  }
  ```
- 30 `throw toApiError(e)` sites — exceeds the ≥20 acceptance threshold.
- `apiClient` and `apiClientWithBody` calls also wrapped (`deletePlaylist`, `bulkReplaceItems`, `getResolvedForDevice`, `revokeDevice`, `claimPairingCode`, `updateDeviceCalibration`, `listMedia`, `getMedia`, `deleteMedia`, `listDeviceAnalytics`) — toApiError is a pass-through for `ApiErrorWithBody` already thrown by `apiClientWithBody`.
- Composite reads (`listPlaylists`, `getPlaylist`, `replacePlaylistTags`, `replaceDeviceTags`) wrap the OUTER awaited expression — first thrower normalizes whole call.
- Public TYPE signatures unchanged (still `Promise<T>`) — D-00e preserved.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/lib/toApiError.test.ts` | 7/7 pass |
| `grep -c '"errors" in err' frontend/src/lib/toApiError.ts` | 2 (≥1 required) |
| `grep -c "DirectusError" frontend/src/lib/toApiError.ts` | 0 (must be 0) |
| `grep -c "ApiErrorWithBody" frontend/src/lib/toApiError.ts` | 9 (≥4 required) |
| `grep -c "throw toApiError(" frontend/src/signage/lib/signageApi.ts` | 30 (≥20 required) |
| `grep -c "import { toApiError }" frontend/src/signage/lib/signageApi.ts` | 1 |
| `npx tsc --noEmit` | exit 0, no errors |
| `npx vitest run` (excluding pre-existing toggle + e2e failures) | 22/22 files, 217 passed, 1 skipped |

## Deviations from Plan

**[Rule 1 — Acceptance criteria adjustment] Renamed `DirectusErrorShape` interface to `DirectusThrownShape`**
- **Found during:** Task 1 acceptance verification.
- **Issue:** Acceptance criterion `grep -c "DirectusError" === 0` failed because the file contained the local interface name `DirectusErrorShape` (a type-only symbol, not a runtime import). 3 occurrences (interface decl, type cast, comment).
- **Fix:** Renamed interface to `DirectusThrownShape`; rewrote the comment to drop the literal `DirectusError` string.
- **Files modified:** `frontend/src/lib/toApiError.ts`.
- **Commit:** Folded into the GREEN commit `14e1fba`.

## Deferred Issues

Pre-existing test failures unrelated to this plan, logged to `.planning/phases/71-fe-polish-clean/deferred-items.md`:

- `frontend/src/components/ui/toggle.test.tsx` — 8 failures (`ResizeObserver` undefined in jsdom env). Confirmed pre-existing via `git stash` diff. Out of scope for FE-04.
- `frontend/tests/e2e/rebuild-persistence.spec.ts` — Playwright e2e suite picked up by vitest's default glob; not a vitest test. Pre-existing.

## Authentication Gates

None.

## Self-Check: PASSED

- `frontend/src/lib/toApiError.ts` — FOUND
- `frontend/src/lib/toApiError.test.ts` — FOUND
- `frontend/src/signage/lib/signageApi.ts` — FOUND (modified)
- Commit `37ec949` (RED) — FOUND
- Commit `14e1fba` (GREEN) — FOUND
- Commit `ac99576` (Task 2) — FOUND
