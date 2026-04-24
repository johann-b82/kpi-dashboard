# Phase 64 — Deferred Items

Out-of-scope findings discovered during Phase 64 execution. Logged here per
the scope-boundary rule; to be addressed in a future phase or quick task.

## D-A: `migrate` service fails on stale backend image

**Observed:** `docker compose up -d --wait migrate` fails with
`Can't locate revision identified by 'v1_21_signage_calibration'`.

**Root cause:** The currently running `api` / `migrate` backend image
(built 2 days ago per `docker compose ps`) predates the v1_21 Alembic
revision file (`backend/alembic/versions/v1_21_signage_calibration.py`).
The DB's `alembic_version` row points at `v1_21_signage_calibration`, but
that revision file is not present inside the old image.

**Not a Phase 64 regression.** Compose config + Caddyfile are orthogonal.
The running api container (healthy from prior boot) is sufficient for the
Phase 64 verification script once we bypass the stale `migrate` service.

**Resolution needed:** `docker compose build --no-cache api` to rebake
the backend image with the current `alembic/versions/` tree, then a clean
compose up should succeed. Defer to the next backend-touching phase or a
quick task (e.g. `quick: rebake backend image`). Not blocking Phase 64
sign-off.

## D-B: Backend has `/health` but no `/api/health`

**Observed:** The plan's success criteria expected
`curl -sI http://localhost/api/health → 200`, but FastAPI exposes its
liveness probe at `/health` (top-level, no `/api` prefix). Only `/health`
returns 200; `/api/health` returns 404.

**Impact:** The verify script was updated to probe `/api/me` (401 expected
without auth) as the "proxy routes /api/* to FastAPI" proof instead of the
plan's `/api/health`. Observationally equivalent: any FastAPI-originated
response proves the proxy routing works.

**Resolution needed (optional):** Add a trivial `GET /api/health` endpoint
mirroring `/health` so the docker healthcheck, verify script, and any
future external monitoring all speak one URL. Cosmetic; not blocking.
