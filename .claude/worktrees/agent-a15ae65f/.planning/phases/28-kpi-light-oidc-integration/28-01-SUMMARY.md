---
phase: 28-kpi-light-oidc-integration
plan: "01"
subsystem: backend-auth-foundation
tags: [oidc, dex, authlib, sessionmiddleware, alembic]
requires: [phase-27-dex-idp-setup]
provides:
  - oauth.dex authlib client (module-level singleton)
  - get_current_user FastAPI dependency
  - upsert_user async service (ON CONFLICT sub)
  - AppUser SQLAlchemy model
  - CurrentUser Pydantic schema
  - app_users table (migration v1_11_app_users)
  - settings.* Pydantic BaseSettings
  - SessionMiddleware mounted on app
affects:
  - backend/app/main.py (middleware wiring)
  - backend/requirements.txt (+3 deps)
  - docker-compose.yml (api env wiring)
  - .env.example (+2 vars)
tech_stack_added:
  - Authlib >=1.6,<2.0
  - itsdangerous >=2.2
  - pydantic-settings >=2.5
patterns:
  - Pydantic validation_alias to reuse Phase 27 DEX_KPI_SECRET env var name
  - authlib module-level OAuth singleton registered at import time
  - Postgres dialect insert().on_conflict_do_update for atomic UPSERT
key_files_created:
  - backend/app/config.py
  - backend/app/security/auth.py
  - backend/app/services/users.py
  - backend/alembic/versions/v1_11_app_users.py
key_files_modified:
  - backend/app/main.py
  - backend/app/models.py
  - backend/app/schemas.py
  - backend/requirements.txt
  - docker-compose.yml
  - .env.example
decisions:
  - down_revision chained from a1b2c3d4e5f7 (hr_kpi_targets) as current head
  - pydantic-settings added explicitly (was not present in requirements.txt)
  - DEX_CLIENT_SECRET reads DEX_KPI_SECRET via validation_alias (no env rename)
metrics:
  duration: 8min
  completed: 2026-04-15
  tasks: 3
  files: 9
---

# Phase 28 Plan 01: Backend Auth Foundation Summary

Landed the OIDC backend primitives every downstream Phase 28 plan depends on: authlib OAuth singleton for Dex, SessionMiddleware with Secure/SameSite=Lax/8h cookies, Pydantic BaseSettings centralizing auth config, the `app_users` table + ORM model + CurrentUser schema, and the atomic `upsert_user` service.

## What Shipped

- **Config (Task 1):** `backend/app/config.py` introduces a Pydantic v2 `BaseSettings` class exporting `DEX_ISSUER`, `DEX_CLIENT_ID`, `DEX_CLIENT_SECRET`, `DEX_REDIRECT_URI`, `SESSION_SECRET`, `DISABLE_AUTH`. `DEX_CLIENT_SECRET` reads from the existing Phase 27 env var `DEX_KPI_SECRET` via `validation_alias` (no rename). Docker Compose now explicitly wires these through to the api service. `.env.example` grew a Phase 28 block documenting `SESSION_SECRET` generation (`openssl rand -hex 32`) and the `DISABLE_AUTH` dev-bypass toggle.
- **Persistence (Task 2):** `AppUser` SQLAlchemy model + `CurrentUser` Pydantic schema + hand-authored Alembic migration `v1_11_app_users` creating `app_users(id, sub UNIQUE NOT NULL, email NOT NULL, name NULLABLE, created_at, last_seen_at)` with both timestamps server-defaulted to `now()`. Forward migration applied cleanly in the `migrate` service; `psql \d app_users` confirms the UNIQUE constraint `uq_app_users_sub` and the `default now()` server defaults.
- **Auth primitives (Task 3):** `backend/app/security/auth.py` registers the module-level `oauth` singleton with Dex via `server_metadata_url` discovery, PKCE S256 challenge method, and scopes `openid email profile offline_access`. `get_current_user` short-circuits to `SYNTHETIC_USER` when `DISABLE_AUTH=true`, otherwise hydrates `CurrentUser` from `request.session['user']` or raises 401. `backend/app/services/users.py` adds `upsert_user` using the Postgres dialect `insert().on_conflict_do_update` keyed on `sub`, refreshing email/name and bumping `last_seen_at=now()`. `main.py` adds `SessionMiddleware` (`kpi_session` cookie, 8h `max_age`, `same_site=lax`, `https_only=True`) immediately before the first `include_router` call.

## Verification Results

- `from app.config import settings; print(settings.DEX_ISSUER, settings.DISABLE_AUTH)` → `https://auth.internal/dex False`
- `docker compose run --rm migrate alembic heads` → `v1_11_app_users (head)`
- `psql -d kpi_db -c "\d app_users"` shows all 6 columns with `now()` server defaults + `uq_app_users_sub UNIQUE CONSTRAINT`
- `from app.security.auth import oauth, get_current_user, SYNTHETIC_USER; list(oauth._clients.keys())` → `['dex']`; `SYNTHETIC_USER.sub` → `dev-user`
- `docker compose up -d api` + `docker compose exec api curl http://localhost:8000/health` → `{"status":"ok"}` (no regression)
- `docker compose logs api` shows no new ERROR / Traceback lines after middleware wiring

## Output Spec Answers

- **Alembic head chosen as down_revision:** `a1b2c3d4e5f7` (the hr_kpi_targets migration from Phase 15/16 era)
- **Phase 27 `DEX_KPI_SECRET` drift:** None. We read the same env var Phase 27 sets — `validation_alias="DEX_KPI_SECRET"` means no rename, no duplicated secret, no drift window. The api container inherits `DEX_KPI_SECRET` via both `env_file: .env` and the explicit `environment:` block (belt-and-braces for future override flexibility).
- **pydantic-settings added to requirements.txt?:** Yes. It was not previously listed. Added `pydantic-settings>=2.5.0` alongside `Authlib>=1.6.0,<2.0` and `itsdangerous>=2.2.0`.

## Deviations from Plan

None — plan executed exactly as written.

## Unblocks

- **Plan 28-02** (auth router: `/api/auth/login`, `/callback`, `/logout`) — can import `oauth`, `upsert_user`, `get_session`, `CurrentUser`
- **Plan 28-03** (router guards applying `get_current_user` as a FastAPI dependency on protected routers)
- **Plan 28-04/05** (dev bypass flow and end-to-end verification) — `DISABLE_AUTH` config + `SYNTHETIC_USER` already wired

## Commits

- `6ae6f76` feat(28-01): add Pydantic settings + Authlib deps + env wiring
- `25c0c72` feat(28-01): add AppUser model, CurrentUser schema, app_users migration
- `e01b6a7` feat(28-01): wire SessionMiddleware + authlib Dex client + auth primitives

## Known Stubs

None. `get_current_user` and `upsert_user` are fully functional — they simply have no route consumers yet (that's Plan 28-02/03 scope, not a stub).

## Self-Check: PASSED

- FOUND: backend/app/config.py
- FOUND: backend/app/security/auth.py
- FOUND: backend/app/services/users.py
- FOUND: backend/alembic/versions/v1_11_app_users.py
- FOUND commit: 6ae6f76
- FOUND commit: 25c0c72
- FOUND commit: e01b6a7
