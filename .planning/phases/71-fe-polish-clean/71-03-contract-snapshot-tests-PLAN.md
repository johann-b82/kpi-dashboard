---
phase: 71-fe-polish-clean
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/tests/contracts/adapter.contract.test.ts
  - frontend/src/tests/contracts/readMe_minimal.json
  - frontend/src/tests/contracts/readMe_full.json
  - frontend/src/tests/contracts/sales_records.json
  - frontend/src/tests/contracts/personio_employees.json
  - frontend/src/tests/contracts/signage_device_tags.json
  - frontend/src/tests/contracts/signage_schedules.json
  - frontend/src/tests/contracts/signage_playlists.json
  - frontend/src/tests/contracts/signage_playlist_items_per_playlist.json
  - frontend/src/tests/contracts/signage_devices.json
  - frontend/src/tests/contracts/resolved_per_device.json
autonomous: true
requirements: [FE-05]

must_haves:
  truths:
    - "Each migrated GET endpoint has a JSON fixture under frontend/src/tests/contracts/"
    - "A single vitest suite reads each fixture, mocks Directus SDK transport, calls the adapter, and asserts deep-equal to the fixture"
    - "Setting UPDATE_SNAPSHOTS=1 regenerates fixtures (D-01c)"
    - "Tests run in <5s (no live network, mocked SDK)"
  artifacts:
    - path: "frontend/src/tests/contracts/adapter.contract.test.ts"
      provides: "Single test file with one case per migrated read"
      min_lines: 150
    - path: "frontend/src/tests/contracts/*.json"
      provides: "10 baseline fixtures locking adapter response shape"
  key_links:
    - from: "adapter.contract.test.ts"
      to: "signageApi adapter functions"
      via: "import { signageApi } + mock @/lib/directusClient + mock @/lib/apiClient"
      pattern: "vi.mock\\(\"@/lib/directusClient\""
---

<objective>
Freeze the FE adapter's response shape with one vitest snapshot test per migrated read endpoint (FE-05). Mock Directus SDK + apiClient transports, call the adapter, and assert the returned shape deep-equals a checked-in JSON fixture.

Purpose: Lock the Directus/FastAPI boundary at the FE adapter — any future Directus version drift or accidental adapter refactor that changes the wire shape fails CI.
Output: 1 test file + 10 JSON fixtures under `frontend/src/tests/contracts/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/71-fe-polish-clean/71-CONTEXT.md
@.planning/phases/71-fe-polish-clean/71-RESEARCH.md
@frontend/src/signage/lib/signageApi.ts
@frontend/src/signage/pages/DevicesPage.test.tsx
@frontend/src/signage/lib/signageTypes.ts
@frontend/src/lib/api.ts
@frontend/vitest.config.ts

<interfaces>
Migrated read endpoints (D-01b — 10 fixtures total per Open Question 3 recommendation):
1. readMe_minimal — AuthContext readMe call (id, email, first_name, last_name, role, avatar)
2. readMe_full — useCurrentUserProfile call (~adds title, description, language, theme — see Phase 66 hook)
3. sales_records — fetchSalesRecords (in frontend/src/lib/api.ts) via Directus readItems('sales_records')
4. personio_employees — fetchEmployees (Directus readItems('personio_employees') with 9-field allowlist)
5. signage_device_tags — signageApi.listTags() (Phase 68 — collection name 'signage_device_tags', NOT 'signage_tags')
6. signage_schedules — signageApi.listSchedules() (SCHEDULE_FIELDS allowlist)
7. signage_playlists — signageApi.listPlaylists() (composite: rows + tag-map merge — TWO mockResolvedValueOnce calls; Pitfall 4)
8. signage_playlist_items_per_playlist — signageApi.listPlaylistItems(playlistId)
9. signage_devices — signageApi.listDevices() (single Directus call)
10. resolved_per_device — signageApi.getResolvedForDevice(deviceId) (apiClient mock, NOT Directus)

Existing mock pattern in frontend/src/signage/pages/DevicesPage.test.tsx — mocks `@/signage/lib/signageApi`. For contract tests we mock LOWER (the transport) so the adapter actually runs.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create snapshot test harness + 10 fixtures via UPDATE_SNAPSHOTS bootstrap</name>
  <files>frontend/src/tests/contracts/adapter.contract.test.ts, frontend/src/tests/contracts/*.json</files>
  <read_first>
    - frontend/src/signage/lib/signageApi.ts (entire — to know each adapter function's exact wire transformation)
    - frontend/src/lib/api.ts (lines 500-560 for fetchSalesRecords, fetchEmployees Directus calls)
    - frontend/src/signage/pages/DevicesPage.test.tsx (lines 1-80 — vi.mock pattern reference)
    - frontend/vitest.config.ts (test setup, jsdom env)
    - .planning/phases/71-fe-polish-clean/71-RESEARCH.md (Pattern 1 verbatim, Pitfall 4 for composite reads)
  </read_first>
  <action>
    Create `frontend/src/tests/contracts/adapter.contract.test.ts` following RESEARCH.md Pattern 1 verbatim. Structure:

    ```typescript
    import { describe, it, expect, vi, beforeEach } from "vitest";
    import { readFileSync, writeFileSync, existsSync } from "node:fs";
    import path from "node:path";

    vi.mock("@/lib/directusClient", () => ({
      directus: { request: vi.fn() },
    }));
    vi.mock("@/lib/apiClient", () => ({
      apiClient: vi.fn(),
      apiClientWithBody: vi.fn(),
      getAccessToken: () => "test-token",
    }));

    import { signageApi } from "@/signage/lib/signageApi";
    import { directus } from "@/lib/directusClient";
    import { apiClient } from "@/lib/apiClient";
    import { fetchSalesRecords, fetchEmployees } from "@/lib/api"; // adjust import paths
    // For readMe — import from wherever AuthContext readMe call is made (see Phase 66 SUMMARYs)

    const FIXTURES_DIR = __dirname;
    const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

    function snapshot(name: string, actual: unknown): void {
      const fpath = path.join(FIXTURES_DIR, `${name}.json`);
      if (UPDATE || !existsSync(fpath)) {
        writeFileSync(fpath, JSON.stringify(actual, null, 2) + "\n");
        return;
      }
      const expected = JSON.parse(readFileSync(fpath, "utf-8"));
      expect(actual).toEqual(expected);
    }

    describe("FE-05: adapter contract snapshots", () => {
      beforeEach(() => vi.clearAllMocks());
      // 10 cases below
    });
    ```

    For EACH of the 10 endpoints, write an `it()` block that:
    1. Sets `(directus.request as any).mockResolvedValueOnce(<canned-row[]>)` — for composite reads (listPlaylists), call `mockResolvedValueOnce` TWICE in the right order: first for playlist rows, second for tag-map rows (Pitfall 4)
    2. For `getResolvedForDevice` — `(apiClient as any).mockResolvedValueOnce(<resolved-payload>)` instead
    3. Awaits the adapter function
    4. Calls `snapshot('<endpoint_name>', got)` where the name matches the fixture filename

    Canned rows MUST mirror the wire shape Directus returns for that collection (use the field allowlists already defined in signageApi.ts: SCHEDULE_FIELDS, DEVICE_FIELDS, PLAYLIST_FIELDS, etc.). Use stable UUIDs like `"00000000-0000-0000-0000-000000000001"` and ISO date strings `"2026-04-01T00:00:00Z"` so fixtures are deterministic.

    First run: execute `cd frontend && UPDATE_SNAPSHOTS=1 npx vitest run src/tests/contracts/adapter.contract.test.ts` — this CREATES all 10 JSON fixture files (the `existsSync` check + UPDATE flag triggers write-then-pass).

    Second run (same command without UPDATE): all 10 tests must pass against the just-written fixtures.

    Inspect each fixture file briefly to ensure it's not empty `[]` or `null` — if a snapshot is empty, the canned input is wrong; fix the mock and regenerate.

    Add a top-of-file JSDoc explaining the regen flow (`UPDATE_SNAPSHOTS=1 npm test --prefix frontend`) and reviewer convention (commit message `contract: regenerate <endpoint>` per D-01c).

    For composite reads, document the Directus call order in a comment above each `mockResolvedValueOnce` chain (Pitfall 4 — "first call returns playlist rows, second call returns tag-map rows").
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/tests/contracts/adapter.contract.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/tests/contracts/adapter.contract.test.ts` exists
    - 10 JSON fixture files exist in `frontend/src/tests/contracts/`: readMe_minimal, readMe_full, sales_records, personio_employees, signage_device_tags, signage_schedules, signage_playlists, signage_playlist_items_per_playlist, signage_devices, resolved_per_device
    - Each fixture file is non-empty JSON (size > 50 bytes; not `[]\n` or `null\n`)
    - `npx vitest run src/tests/contracts/adapter.contract.test.ts` shows 10 passing tests, 0 failing
    - Test file contains `vi.mock("@/lib/directusClient"` literal
    - Test file contains `process.env.UPDATE_SNAPSHOTS` literal
    - Re-running with `UPDATE_SNAPSHOTS=1` does not produce a git diff (idempotent — output stable)
  </acceptance_criteria>
  <done>10 contract snapshot fixtures committed; vitest suite green; UPDATE_SNAPSHOTS=1 regen flow documented at top of test file.</done>
</task>

</tasks>

<verification>
- 10 contract tests pass
- All 10 JSON fixtures are non-empty, deterministic
- Composite reads (listPlaylists) use the correct mockResolvedValueOnce ordering per Pitfall 4
</verification>

<success_criteria>
FE-05 fully satisfied: every migrated GET adapter call has a frozen wire-shape fixture; reviewer can diff fixture changes during PR.
</success_criteria>

<output>
After completion, create `.planning/phases/71-fe-polish-clean/71-03-SUMMARY.md`.
</output>
