# Roadmap: KPI Light

## Milestones

- ✅ **v1.0 MVP** — Phases 1–3 (shipped 2026-04-11) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Branding & Settings** — Phases 4–7 (shipped 2026-04-11) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Period-over-Period Deltas** — Phases 8–11 (shipped 2026-04-12) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 HR KPI Dashboard & Personio-Integration** — Phases 12–16 (shipped 2026-04-12) — [archive](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 Navbar & Layout Polish** — Phase 17 (shipped 2026-04-12) — [archive](milestones/v1.4-ROADMAP.md)
- ✅ **v1.5 Segmented Controls** — Phase 18 (shipped 2026-04-12) — [archive](milestones/v1.5-ROADMAP.md)
- ✅ **v1.6 Multi-Select HR Criteria** — Phases 19–20 (shipped 2026-04-12) — [archive](milestones/v1.6-ROADMAP.md)
- ✅ **v1.9 Dark Mode & Contrast** — Phases 21–23 (shipped 2026-04-14) — [archive](milestones/v1.9-ROADMAP.md)
- ✅ **v1.10 UI Consistency Pass** — Phases 24–25 (shipped 2026-04-14)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–3) — SHIPPED 2026-04-11</summary>

- [x] Phase 1: Infrastructure and Schema (2/2 plans) — completed 2026-04-10
- [x] Phase 2: File Ingestion Pipeline (4/4 plans) — completed 2026-04-10
- [x] Phase 3: Dashboard Frontend (4/4 plans) — completed 2026-04-11

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Branding & Settings (Phases 4–7) — SHIPPED 2026-04-11</summary>

- [x] Phase 4: Backend — Schema, API, and Security (6/6 plans) — completed 2026-04-11
- [x] Phase 5: Frontend Plumbing — ThemeProvider and NavBar (3/3 plans) — completed 2026-04-11
- [x] Phase 6: Settings Page and Sub-components (4/4 plans) — completed 2026-04-11
- [x] Phase 7: i18n Integration and Polish (6/6 plans) — completed 2026-04-11

</details>

<details>
<summary>✅ v1.2 Period-over-Period Deltas (Phases 8–11) — SHIPPED 2026-04-12</summary>

- [x] Phase 8: Backend — Comparison Aggregation and Chart Overlay API (3/3 plans) — completed 2026-04-11
- [x] Phase 9: Frontend — KPI Card Dual Deltas (3/3 plans) — completed 2026-04-12
- [x] Phase 10: Frontend — Chart Prior-Period Overlay (2/2 plans) — completed 2026-04-12
- [x] Phase 11: i18n, Contextual Labels, and Polish (2/2 plans) — completed 2026-04-12

</details>

<details>
<summary>✅ v1.3 HR KPI Dashboard & Personio-Integration (Phases 12–16) — SHIPPED 2026-04-12</summary>

- [x] Phase 12: HR Schema & Personio Client (2/2 plans) — completed 2026-04-12
- [x] Phase 13: Sync Service & Settings Extension (3/3 plans) — completed 2026-04-12
- [x] Phase 14: Navigation & HR Tab Shell (2/2 plans) — completed 2026-04-12
- [x] Phase 15: HR KPI Cards & Dashboard (2/2 plans) — completed 2026-04-12
- [x] Phase 16: i18n & Polish (1/1 plan) — completed 2026-04-12

</details>

<details>
<summary>✅ v1.4 Navbar & Layout Polish (Phase 17) — SHIPPED 2026-04-12</summary>

- [x] Phase 17: Navbar & Layout Polish (2/2 plans) — completed 2026-04-12

</details>

<details>
<summary>✅ v1.5 Segmented Controls (Phase 18) — SHIPPED 2026-04-12</summary>

- [x] Phase 18: Segmented Controls (2/2 plans) — completed 2026-04-12

</details>

<details>
<summary>✅ v1.6 Multi-Select HR Criteria (Phases 19–20) — SHIPPED 2026-04-12</summary>

- [x] Phase 19: Backend — Array Migration, API, and KPI Aggregation (2/2 plans) — completed 2026-04-12
- [x] Phase 20: Frontend — Checkbox List UI and i18n (2/2 plans) — completed 2026-04-12

</details>

<details>
<summary>✅ v1.9 Dark Mode & Contrast (Phases 21–23) — SHIPPED 2026-04-14</summary>

- [x] Phase 21: Dark Mode Theme Infrastructure (4/4 plans) — completed 2026-04-14
- [x] Phase 22: Dark Mode Toggle & Preference (3/3 plans) — completed 2026-04-14
- [x] Phase 23: Contrast Audit & Fix (5/5 plans) — completed 2026-04-14 (D-12 waiver on axe + WebAIM)

</details>

<details>
<summary>✅ v1.10 UI Consistency Pass (Phases 24–25) — SHIPPED 2026-04-14</summary>

- [x] Phase 24: Delta Label Unification (1/1 plan) — completed 2026-04-14
- [x] Phase 25: Page Layout Parity (3/3 plans) — completed 2026-04-14

</details>

### v1.11-directus Directus Pivot (In Progress)

- [x] **Phase 26: Directus Up, on Existing Postgres** — Single `directus/directus:11` container added to compose; connects to the existing `db`; admin UI at `http://localhost:8055`; first Admin bootstrapped; two roles (`Admin`, `Viewer`) configured (completed 2026-04-15)
- [ ] **Phase 27: FastAPI Directus Auth Dependency** — FastAPI verifies Directus JWT (HS256 shared secret); `current_user` dep resolves `{ id, email, role }`; unauthenticated requests → 401
- [ ] **Phase 28: RBAC Enforcement on All Routes** — Mutation routes gated on `role == 'Admin'` (403 for Viewer); read routes open to both; documented matrix
- [ ] **Phase 29: Frontend Login + Role-Aware UI** — `/login` via `@directus/sdk`, axios bearer interceptor, session auto-refresh, Viewer UI hides admin-only actions, sign-out clears session
- [ ] **Phase 30: Bring-up Docs + Backup** — `docs/setup.md` + README v1.11-directus entry + nightly `pg_dump` + restore procedure

## Phase Details

### Phase 24: Delta Label Unification
**Goal**: Both Sales and HR dashboards read delta badges from a single shared `kpi.delta.*` i18n namespace, covering month / quarter / year granularities with full DE/EN parity, and `periodLabels.ts` is simplified or retired.
**Depends on**: Phase 23
**Requirements**: UC-01, UC-02, UC-03, UC-04, UC-05
**Success Criteria** (what must be TRUE):
  1. Sales KPI card delta badges display `vs. prev. month` / `vs. Vormonat`, `vs. prev. quarter` / `vs. Vorquartal`, and `vs. prev. year` / `vs. Vorjahr` — matching the HR dashboard style exactly
  2. Quarter granularity delta labels appear correctly on both the Sales and HR dashboards in both DE and EN
  3. `KpiCardGrid` and `HrKpiCardGrid` both resolve their delta label strings from the same `kpi.delta.*` keys — no duplicate or divergent label logic exists in either component
  4. `scripts/check-locale-parity.mts` exits with code 0 (no missing keys between `en.json` and `de.json`)
  5. `frontend/src/lib/periodLabels.ts` contains no unreferenced absolute-period formatters — either the file is deleted or only referenced code remains
**Plans**: 1 plan
- [x] 24-01-delta-label-unification-PLAN.md
**UI hint**: yes

### Phase 25: Page Layout Parity
**Goal**: `/upload` and `/settings` use the same `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` container as the dashboards.
**Depends on**: Phase 24
**Requirements**: UC-06, UC-07, UC-08, UC-09, UC-10
**Success Criteria** (what must be TRUE):
  1. `/upload` page outer wrapper uses `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8`
  2. `/settings` page outer wrapper uses `max-w-7xl mx-auto px-6 pt-4 space-y-8 pb-32`
  3. `/upload` body layout (DropZone + UploadHistory) uses the wider canvas sensibly
  4. Padding rhythm consistent across `/`, `/hr`, `/upload`, `/settings`
  5. Human UAT confirms no visual regressions
**Plans**: 3 plans
- [x] 25-01-upload-container-and-grid-PLAN.md
- [x] 25-02-settings-container-PLAN.md
- [x] 25-03-uat-layout-parity-PLAN.md
**UI hint**: yes

### Phase 26: Directus Up, on Existing Postgres
**Goal**: A single `directus/directus:11` container boots alongside the existing `db`, `api`, and `frontend` via `docker compose up`; the admin UI is reachable at `http://localhost:8055`; the first Admin is auto-bootstrapped from `.env`; and two roles (`Admin`, `Viewer`) are configured reproducibly.
**Depends on**: Phase 25 (v1.10 baseline)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, CFG-01, CFG-02, CFG-03
**Success Criteria** (what must be TRUE):
  1. `docker compose up` from a clean checkout brings `db`, `directus`, `api`, and `frontend` all to `healthy` with no manual intervention between commands
  2. Developer can open `http://localhost:8055`, sign in as the bootstrapped first Admin (credentials from `.env`), and see the Directus admin UI
  3. The `db` Postgres instance contains both Alembic-owned `public.*` app tables and Directus's `directus_*` tables without collision
  4. Directus's Data Model UI does NOT show `public.*` app tables (`DB_EXCLUDE_TABLES` or equivalent in effect)
  5. Two roles exist reproducibly — `Admin` (full access) and `Viewer` (read-only own user) — defined via `directus/snapshot.yml` or bootstrap script
  6. `.env.example` documents every Directus secret (`DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`) with generation commands
**Plans**: 3 plans
- [x] 26-01-compose-service-and-env-PLAN.md — Add `directus/directus:11.17.2` service to compose reusing existing `db`; document secrets in `.env.example`
- [x] 26-02-snapshot-roles-and-apply-PLAN.md — Author `directus/snapshot.yml` with Admin + Viewer roles; add `directus-snapshot` sidecar that applies it on every bring-up
- [x] 26-03-bringup-verification-PLAN.md — Clean `docker compose up`, DB coexistence check, human-verify admin UI + role list + hidden app tables

### Phase 27: FastAPI Directus Auth Dependency
**Goal**: FastAPI verifies Directus-issued JWTs (HS256 shared secret), resolves a `current_user` with role, and rejects unauthenticated or expired tokens with 401 — the server-side auth backbone without yet gating on role.
**Depends on**: Phase 26
**Requirements**: AUTH-01, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A seeded user can `POST /auth/login` directly to Directus with email+password and receive a valid JWT (access + refresh tokens)
  2. Any `/api/*` request without a valid `Authorization: Bearer <jwt>` returns 401; expired or malformed tokens also return 401
  3. `current_user` FastAPI dependency is importable from `backend/app/security/directus_auth.py` and resolves `{ id, email, role }` from the verified JWT
  4. Unit tests cover: valid token → user resolved; expired → 401; wrong-signature → 401; missing bearer → 401
  5. `backend/app/config.py` reads `DIRECTUS_SECRET` from env with a clear error if unset
**Plans**: 2 plans
- [ ] 27-01-auth-dependency-foundation-PLAN.md — config.py (Pydantic BaseSettings), Role enum, CurrentUser schema, get_current_user dependency (HS256 verify + UUID→Role map), 8 unit tests
- [ ] 27-02-router-wiring-and-env-PLAN.md — Fetch Administrator UUID from running Directus, populate .env/.env.example, wire dependencies=[Depends(get_current_user)] on all 6 routers, e2e tests

### Phase 28: RBAC Enforcement on All Routes
**Goal**: Every FastAPI read route is open to both roles and every mutation route requires `role == 'Admin'`, returning 403 with a machine-readable body for Viewer users. Role changes made in Directus admin UI take effect on next JWT refresh.
**Depends on**: Phase 27
**Requirements**: RBAC-01, RBAC-02, RBAC-04, RBAC-05
**Success Criteria** (what must be TRUE):
  1. With a valid Viewer JWT: every `GET /api/kpis`, `/api/hr/kpis`, `/api/data/*`, and `GET /api/settings` returns 200
  2. With a valid Viewer JWT: every `POST /api/uploads/*`, `POST /api/sync/personio`, `PUT /api/settings`, and `DELETE /api/data/*` returns 403 with body `{"detail": "admin role required"}`
  3. With a valid Admin JWT: all routes (read + mutate) succeed exactly as in v1.10
  4. Promoting a Viewer to Admin in the Directus admin UI takes effect on the user's next token refresh (within JWT TTL)
  5. The API contract (inline in code or in `docs/api.md`) documents the Admin-vs-Viewer route matrix
**Plans**: TBD

### Phase 29: Frontend Login + Role-Aware UI
**Goal**: Users authenticate through a browser login page; the frontend manages session + refresh via `@directus/sdk`, attaches the bearer token to every API call, hides admin-only UI affordances from Viewer users, and handles sign-out cleanly.
**Depends on**: Phase 28
**Requirements**: AUTH-02, AUTH-03, AUTH-06, RBAC-03
**Success Criteria** (what must be TRUE):
  1. User lands on `/login` when unauthenticated; after submitting valid email+password they are redirected to the Sales dashboard and stay signed in across full page reloads; invalid credentials show an inline error and do not grant a session
  2. The frontend auto-refreshes the Directus access token before expiry without forcing the user to re-login during a session
  3. Every outgoing `/api/*` call carries an `Authorization: Bearer <jwt>` header set by a shared axios (or fetch) interceptor
  4. Viewer users see a functional dashboard but admin-only controls (upload button, Personio sync trigger, settings Save button, delete controls) are hidden — not just disabled — from the DOM
  5. Signing out from the UI clears the client session and returns the user to `/login`; refreshing after sign-out does not restore the session; subsequent `/api/*` calls return 401
**Plans**: TBD
**UI hint**: yes

### Phase 30: Bring-up Docs + Backup
**Goal**: A first-time operator can clone the repo, follow `docs/setup.md`, and end up with a running stack, a first Admin user, the promote-to-Admin flow documented, and a working nightly backup — closing the loop on the milestone.
**Depends on**: Phase 29
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. Following `docs/setup.md` end-to-end on a clean machine produces a running stack with a usable first Admin account — no undocumented manual steps
  2. `docs/setup.md` includes the click-path for promoting a Viewer to Admin via the Directus admin UI, verifiable by a second operator without code spelunking
  3. A nightly `pg_dump` runs (cron sidecar or host script), produces timestamped dump files under `./backups/`, and `docs/setup.md` documents a restore procedure that has been exercised at least once
  4. `README.md` contains a v1.11-directus version-history entry explaining the pivot (Directus added, Dex/oauth2-proxy abandoned, Supabase considered and rejected, Outline dropped)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–3 | v1.0 | 10/10 | Complete | 2026-04-11 |
| 4–7 | v1.1 | 19/19 | Complete | 2026-04-11 |
| 8–11 | v1.2 | 10/10 | Complete | 2026-04-12 |
| 12–16 | v1.3 | 10/10 | Complete | 2026-04-12 |
| 17 | v1.4 | 2/2 | Complete | 2026-04-12 |
| 18 | v1.5 | 2/2 | Complete | 2026-04-12 |
| 19–20 | v1.6 | 4/4 | Complete | 2026-04-12 |
| 21 | v1.9 | 4/4 | Complete | 2026-04-14 |
| 22 | v1.9 | 3/3 | Complete | 2026-04-14 |
| 23 | v1.9 | 5/5 | Complete | 2026-04-14 |
| 24 | v1.10 | 1/1 | Complete | 2026-04-14 |
| 25 | v1.10 | 3/3 | Complete | 2026-04-14 |
| 26 | v1.11-directus | 3/3 | Complete    | 2026-04-15 |
| 27 | v1.11-directus | 0/2 | In progress | — |
| 28 | v1.11-directus | 0/? | Not started | — |
| 29 | v1.11-directus | 0/? | Not started | — |
| 30 | v1.11-directus | 0/? | Not started | — |
