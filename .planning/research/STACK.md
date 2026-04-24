# Stack Research — v1.22 Backend Consolidation

**Milestone:** v1.22 Directus-first CRUD
**Researched:** 2026-04-24
**Overall confidence:** HIGH
**Scope:** Incremental stack additions only. Core stack (FastAPI 0.135.3, asyncpg 0.31.0, SQLAlchemy 2.0.49, Alembic 1.18.4, React 19.2.5, Vite 8, TanStack Query 5.97.0, Directus 11.17.2, PostgreSQL 17-alpine) is **not re-researched** — see CLAUDE.md.

---

## Domain

Moving **pure CRUD** FastAPI routers (`signage_admin/{devices,playlists,playlist_items,schedules,tags,analytics}`, `data.py` sales/employees lookups, `me.py`) to Directus 11.17.2 collections on top of **Alembic-owned Postgres tables** (`signage_devices`, `signage_device_tags`, `signage_device_tag_map`, `signage_playlists`, `signage_playlist_items`, `signage_playlist_tag_map`, `signage_schedules`, `signage_heartbeat_event`, `sales_records`, `personio_employees`). FastAPI retains compute (upload parsing, KPIs aggregation, SSE, Personio sync, signage_player envelope/heartbeat, signage_pair JWT, PPTX subprocess, sensor polling).

The core research question is: **who owns DDL, and what glue do we need to register the existing tables in Directus metadata without colliding with Alembic?** Answer: Alembic stays the exclusive DDL owner; Directus learns about the tables through a one-off introspection (`register-existing-tables`) plus a schema snapshot that carries only Directus metadata (collections/fields/relations configuration rows), never DDL.

---

## New Dependencies (frontend)

All versions verified against npm registry on 2026-04-24. The SDK is already at `^21.2.2` in `frontend/package.json` and is the **current** major (21.x) — no bump needed.

| Package | Version (pin) | Why | Alternative rejected |
|---|---|---|---|
| `@directus/sdk` | **already present — keep `^21.2.2`** | Official TypeScript SDK; composable (`authentication` + `rest` modules already wired in `directusClient.ts`); request builders return plain Promises → drop directly into TanStack Query `queryFn`. Cookie-mode auth already working same-origin behind Caddy `/directus/*`. | Raw `fetch()` to `/directus/items/*` — loses typed collection interfaces, token-refresh logic, and query-string composition (`readItems(..., { filter, fields, sort, limit })`). Custom `apiClient.ts` wrapper — already retained for FastAPI compute endpoints; reusing it for Directus duplicates SDK auth handling and fights the cookie-mode flow. |
| `@directus/errors` | **do not add to frontend** | Frontend-side: Directus returns errors as standard JSON `{errors:[{message, extensions:{code}}]}` over HTTP 4xx/5xx. The SDK already parses this and throws a structured error. Map `extensions.code === "RECORD_NOT_UNIQUE" / "FAILED_VALIDATION"` into user-facing toasts at the TanStack Query `onError` level. No additional package. | N/A |

**No new frontend packages are strictly required.** The single-client pattern already exists (`frontend/src/lib/directusClient.ts`). TanStack Query stays in place — each moved endpoint becomes a hook whose `queryFn` calls `directus.request(readItems('signage_devices', { ... }))`.

### Frontend integration pattern (no new packages)

```ts
// src/features/signage/hooks/useDevices.ts
import { readItems, createItem, updateItem, deleteItem } from "@directus/sdk";
import { directus } from "@/lib/directusClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const devicesKeys = {
  all: ["directus", "signage_devices"] as const,
  list: (filter?: object) => [...devicesKeys.all, "list", filter] as const,
};

export function useDevices() {
  return useQuery({
    queryKey: devicesKeys.list(),
    queryFn: () =>
      directus.request(
        readItems("signage_devices", {
          fields: ["id", "name", "status", "rotation", "hdmi_mode", "audio_enabled", "last_seen_at"],
          sort: ["name"],
          limit: -1,
        }),
      ),
  });
}
```

**Cache-key convention:** prefix all Directus-backed keys with `["directus", <collection>, ...]` so legacy FastAPI keys (`["signage", "devices"]`) can be invalidated independently during the cut-over. No `@tanstack/query-directus` bridge exists (confirmed via npm registry + RFC discussion #17808) — the manual queryKey pattern above is what the community uses today.

---

## New Dependencies (backend / Directus extensions)

| Package / asset | Version | Where it lives | Why |
|---|---|---|---|
| `@directus/extensions-sdk` | `17.1.3` | `directus-extensions/` npm workspace (new) — only at build time | Needed to compile the one custom hook we need (see below). CLI: `directus-extension build`. Only required because we need server-side validation that matches existing FastAPI Pydantic constraints. |
| `@directus/errors` | bundled with Directus 11 runtime — declare as peer only | inside the hook extension | `throw new InvalidPayloadError({ reason: "rotation must be 0, 90, 180, or 270" })` propagates as proper 422/400 responses instead of raw 500s. Already available to extensions at runtime, no install into the Directus image needed. |
| Custom hook extension: `kpi-validation-hooks` | 1.0.0 (this repo) | `directus-extensions/kpi-validation-hooks/` bind-mounted into `directus:/directus/extensions/` | Single `hook` extension registering: (a) `items.signage_devices.create/update` → pre-validate `rotation ∈ {0,90,180,270}` and `audio_enabled ∈ {true,false}` (DB CHECK catches it anyway, but friendlier error); (b) `items.signage_playlist_items.delete` → translate Postgres FK RESTRICT (SQLSTATE `23503`) on `signage_media → signage_playlist_items` into HTTP 409 with a `reason` message (matches existing FastAPI behaviour for calibration + item lifecycle tests). |
| Directus schema snapshot | YAML in `directus/snapshots/v1.22.yaml` | checked into the repo; applied by a compose one-shot service | Ships collection/field/relation **metadata only** (display names, interfaces, icons, sort order, field-level permissions) — does **not** touch DDL. Applied via `npx directus schema apply --yes ./snapshots/v1.22.yaml` inside the Directus container. |

### Do NOT add a Directus-extension-managed migration

The [Directus docs Migrations](https://directus.io/docs/configuration/migrations) feature is for Directus itself evolving the `directus_*` system tables — not for app DDL. Using it for `signage_*` would fight Alembic. Keep all table DDL in Alembic; use snapshot-apply only for Directus metadata.

### About `directus-sync` / `directus-extension-schema-sync`

Third-party tools (`directus-sync` on npm, `directus-extension-schema-sync`) exist for promoting schema between environments. **Do not add them.** They duplicate what `npx directus schema snapshot`/`apply` already does since v11, and they add a dependency we'd have to audit. One canonical snapshot file per milestone + the built-in CLI is sufficient for our single-environment deploy.

---

## Directus Configuration Changes

### `docker-compose.yml` — `directus` service

1. **`DB_EXCLUDE_TABLES`** — remove the tables we're now surfacing. Keep Alembic-only tables hidden:
   - **Remove from exclude list:** `signage_devices`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags`, `signage_heartbeat_event` (+ join tables `signage_device_tag_map`, `signage_playlist_tag_map`, `signage_schedules`, plus `sales_records`, `personio_employees`).
   - **Keep in exclude list:** `alembic_version`, `upload_batches`, `app_settings`, `personio_attendance`, `personio_absences`, `personio_sync_meta`, `sensors`, `sensor_readings`, `sensor_poll_log`, `signage_pairing_sessions`, `signage_media` (Directus-owned uploads — **do not** re-expose; stays Directus-native, FastAPI already reads it via path resolution).
2. **Extensions mount:** add `./directus-extensions/dist:/directus/extensions:ro` (build output; build runs host-side or via a one-shot container).
3. **Schema bootstrap service** (new, similar to `directus-bootstrap-roles`):
   ```yaml
   directus-schema-apply:
     image: directus/directus:11.17.2
     entrypoint: ["/bin/sh","-c","npx directus schema apply --yes /snapshots/v1.22.yaml"]
     volumes:
       - ./directus/snapshots:/snapshots:ro
     depends_on:
       directus:
         condition: service_healthy
     restart: "no"
   ```
4. **`bootstrap-roles.sh` extension:** add per-collection policy-permission rows for the newly surfaced collections. Viewer policy gets `read` on all 10 collections; Administrator (built-in) already has full access. Use the existing `POST /permissions` REST pattern (GET-before-POST idempotent). This is a script edit, not a new tool.

### Handling Alembic-owned tables in Directus metadata

Directus 11 since v11.10.0 has the [known issue #25760](https://github.com/directus/directus/issues/25760) where `schema apply` tries to CREATE an already-existing table. **Mitigation documented in the snapshot workflow:**

- Snapshot file must be **generated** against a Directus instance where the tables already exist physically but are not yet in `directus_collections`. Do this once (dev workstation), author the yaml with `meta:` entries only, and commit.
- In v11 the recommended workaround is to use `POST /collections` with `{schema: null, meta: {...}}` — this registers the Directus metadata row without issuing any DDL. Our `bootstrap-roles.sh` pattern scales to this: extend it to a `bootstrap-collections.sh` or fold it in.
- **If `schema apply` ever barfs with "Collection already exists" during CI/boot,** fall back to the REST `POST /collections {schema: null}` path. This is the only part of the plan with MEDIUM confidence; the REST path is always available and proven.

---

## Alembic ↔ Directus Ownership Model

**Single source of truth for DDL: Alembic.** Non-negotiable — Alembic owns every `public.*` table, every column, every CHECK, every FK, every index. Directus gets **zero** DDL authority over `public.*` in v1.22.

| Concern | Owner | Tool | Notes |
|---|---|---|---|
| Create/drop tables | **Alembic** | migration files | Status quo. Directus `DB_EXCLUDE_TABLES` prevents Directus Data Model UI from even offering a "delete collection" that would DROP a table. |
| Add/remove columns | **Alembic** | migration files | Same. Snapshot regen happens only *after* Alembic migration lands. |
| CHECK constraints (e.g., `rotation IN (0,90,180,270)`, `weekday_mask BETWEEN 0 AND 127`) | **Alembic** | existing migrations | Directus hook re-validates for friendlier error messages, but the DB is the last line of defence. |
| Foreign keys + RESTRICT behaviour | **Alembic** | existing `ondelete="RESTRICT"` on `signage_playlist_items.media_id`, `signage_schedules.playlist_id` | Directus hook translates Postgres `23503` → HTTP 409 on delete; does **not** redefine the constraint. |
| Directus metadata (collection icon, field display, Admin/Viewer policy rows) | **Directus** | `directus_collections`, `directus_fields`, `directus_relations`, `directus_permissions` — written via `schema apply` + `bootstrap-collections.sh` | Lives in separate `directus_*` tables; never touches `public.*`. |
| UUID / integer primary keys | **Alembic** | existing `gen_random_uuid()` server defaults | Directus respects whatever default the DB has; no change needed. |
| `created_at` / `updated_at` | **Alembic** (server defaults + `onupdate`) | existing | Directus can optionally mark these `readonly` via the metadata snapshot so admin UI users don't fight the DB triggers. |

### Workflow for any schema change during v1.22

1. Write Alembic migration (add column / change CHECK / etc.).
2. `alembic upgrade head` (runs automatically via `migrate` compose service).
3. On dev workstation: `docker compose exec directus npx directus schema snapshot /snapshots/v1.22.yaml` — regenerates YAML against the new DB shape.
4. Commit the new `v1.22.yaml`.
5. `directus-schema-apply` one-shot service reapplies on next `docker compose up`.

---

## DO NOT Add

| Item | Why not |
|---|---|
| **A second ORM on the backend** (Prisma, Drizzle, tRPC) | SQLAlchemy 2.0 + asyncpg stays for FastAPI compute endpoints. Directus owns the Items API for moved collections. Adding a JS ORM would split schema authority three ways. |
| **A separate auth library** (Auth.js/NextAuth, clerk, lucia, passport) | Directus is the identity provider (shipped v1.11-directus). Frontend gets its session via `@directus/sdk` cookie-mode; FastAPI validates HS256 JWTs with shared secret. Adding another auth lib = two bugs to chase. |
| **`directus-sync` / `directus-extension-schema-sync`** | The built-in `schema snapshot/apply` CLI + our `bootstrap-roles.sh` REST pattern already cover every sync need for a single-environment deploy. |
| **A Directus migration extension to own `signage_*` DDL** | Alembic is the DDL source of truth. Directus migrations are for `directus_*` system tables only. Cross-over = split-brain. |
| **`@tanstack/query-sync-storage-persister` or offline-first sync wrappers (Indirectus RFC)** | Out of scope — we have a LAN-only, always-online deployment. Offline handling on the signage Pi is a separate compute path (sidecar cache) that doesn't touch this milestone. |
| **A TanStack Query bridge to Directus** (no such official package exists in npm as of 2026-04) | Not needed; the manual queryFn pattern (shown above) is the community-standard approach per the [dev.to / TanStack Start guide](https://dev.to/wadethomastt/connecting-tanstack-start-to-directus-with-the-sdk-type-safe-data-fetching-in-one-file-1e0c). Adding a wrapper = one more thing to maintain. |
| **GraphQL layer** (`@directus/sdk` graphql composable, codegen) | SDK `rest()` composable + `readItems/createItem/...` is simpler and matches our existing fetch-style code. GraphQL adds codegen tooling for zero runtime win in this size of app. |
| **A new error-shape contract between frontend and Directus** | Reuse what the SDK throws. Do not wrap Directus errors into the existing FastAPI `{detail: "..."}` shape — that forces a translation layer and hides Directus error codes that the UI actually benefits from (`RECORD_NOT_UNIQUE`, `FAILED_VALIDATION`). Update toast handlers to read `error.errors?.[0]?.extensions?.code`. |
| **Server-side schema-typed SDK generator** (e.g., hand-rolled `Schema` type from collection scans) — optional deferral | Directus SDK supports a generic `createDirectus<Schema>()` typed-client. Worth adding **only after** all collections land; premature for v1.22 Phase 1. Track as a post-v1.22 cleanup. |

---

## Version Verification Table

| Package / asset | Pinned version | Verified where | Confidence |
|---|---|---|---|
| `@directus/sdk` | `^21.2.2` (already present) | npm registry — latest as of 2026-04-24; last published ~14 days prior | HIGH |
| `@directus/extensions-sdk` | `17.1.3` | npm registry — last published ~8 days prior | HIGH |
| `create-directus-extension` | `11.0.29` (scaffolding only; npx, not a dep) | npm registry | HIGH |
| `@directus/errors` | runtime-provided by Directus 11.17.2 — no pin | Directus docs — "available to all extensions without installation" | HIGH |
| `directus/directus:11.17.2` image | **unchanged** from v1.11-directus | docker-compose.yml | HIGH |
| `@tanstack/react-query` | **unchanged at `^5.97.0`** | docker-compose / package.json | HIGH |
| Directus schema-apply CLI (`npx directus schema apply`) | ships inside `directus/directus:11.17.2` image | [Directus Schema API docs](https://directus.io/docs/api/schema) | HIGH — known issue #25760 flagged for existing-table case, documented mitigation above | MEDIUM on the existing-table path |

**Confidence caveats:**
- The "schema apply against already-existing Alembic-owned tables" path has a documented edge case ([#25760](https://github.com/directus/directus/issues/25760)). Mitigation (REST `POST /collections {schema: null}`) is documented but adds work to the roadmap. Flag for the requirements author as **phase-level risk**: worst-case we fall back to scripted REST registration (same pattern as `bootstrap-roles.sh`), which is HIGH confidence.
- No official `@directus/sdk` ↔ TanStack Query bridge exists on npm (searched 2026-04-24). The manual queryFn-wraps-SDK pattern is what's in use by the community and what this milestone should adopt.

---

## Sources

- [@directus/sdk on npm](https://www.npmjs.com/package/@directus/sdk)
- [@directus/extensions-sdk on npm](https://www.npmjs.com/package/@directus/extensions-sdk)
- [Directus Schema API docs](https://directus.io/docs/api/schema)
- [Directus Hooks guide](https://directus.io/docs/guides/extensions/api-extensions/hooks)
- [Validate Phone Numbers with Twilio in a Custom Hook (InvalidPayloadError pattern)](https://directus.io/docs/tutorials/extensions/validate-phone-numbers-with-twilio-in-a-custom-hook)
- [Directus errors guide (`@directus/errors`, `createError`)](https://directus.io/docs/guides/connect/errors)
- [Directus 11 Breaking Changes](https://directus.io/docs/releases/breaking-changes/version-11)
- [Collections guide — adding to existing database](https://directus.io/docs/guides/data-model/collections)
- [Add Directus to an Existing Database (learndirectus.com)](https://learndirectus.com/add-directus-to-an-existing-database/)
- [Issue #25760 — v11.10.0 schema apply "Collection already exists" regression](https://github.com/directus/directus/issues/25760)
- [Discussion #16407 — Applying schema snapshot has no effect](https://github.com/directus/directus/discussions/16407)
- [Discussion #17808 — [RFC] Directus Offline First SDK + TanStack Query wrapper (Indirectus)](https://github.com/directus/directus/discussions/17808)
- [Connecting TanStack Start to Directus with the SDK (community pattern)](https://dev.to/wadethomastt/connecting-tanstack-start-to-directus-with-the-sdk-type-safe-data-fetching-in-one-file-1e0c)
- [Throwing Validation Error from Custom Hook (community forum)](https://community.directus.io/t/throwing-validation-error-from-custom-hook/606)
- Repo files inspected: `docker-compose.yml`, `directus/bootstrap-roles.sh`, `backend/app/models/signage.py`, `backend/app/models/__init__.py`, `frontend/src/lib/directusClient.ts`, `frontend/package.json`, `.planning/PROJECT.md`.
