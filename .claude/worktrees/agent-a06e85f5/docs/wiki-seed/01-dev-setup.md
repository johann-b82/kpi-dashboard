# Dev Setup

A zero-to-running walkthrough. For the exhaustive reference, see the canonical [`docs/setup.md`](https://github.com/johann-b82/kpi-dashboard/blob/main/docs/setup.md) in the repo.

## Prerequisites

- macOS, Linux, or WSL2
- Docker Engine 24+ with Docker Compose v2 (`docker compose`, not `docker-compose`)
- `mkcert` (`brew install mkcert` / `apt install mkcert` / scoop)
- `git` and `openssl`
- ~2 GB free disk for images + volumes

## 1. Clone and configure `.env`

```bash
git clone https://github.com/johann-b82/kpi-dashboard.git acm-kpi-light
cd acm-kpi-light
cp .env.example .env
```

Fill in the secrets `.env` expects. Generate once per checkout:

```bash
# Session signing and OIDC client secrets (64 hex chars each)
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -hex 32   # → DEX_KPI_SECRET
openssl rand -hex 32   # → DEX_OUTLINE_SECRET
openssl rand -hex 32   # → OUTLINE_SECRET_KEY
openssl rand -hex 32   # → OUTLINE_UTILS_SECRET

# DB password (32 hex chars is fine)
openssl rand -hex 16   # → OUTLINE_DB_PASSWORD
```

Leave `DISABLE_AUTH=false` for normal dev. Flip to `true` if you need to skip Dex (e.g. pure frontend iteration) — a synthetic dev user is injected.

## 2. Hosts file

KPI Dashboard lives at three internal hostnames. Add this line to your hosts file (`/etc/hosts` on mac/Linux, `C:\Windows\System32\drivers\etc\hosts` on Windows):

```
127.0.0.1 kpi.internal wiki.internal auth.internal
```

## 3. Trust the local CA and generate certs

```bash
mkcert -install        # one-time — installs the mkcert root CA into your OS/browser trust stores
./scripts/generate-certs.sh
```

This produces `certs/fullchain.pem` + `certs/privkey.pem` covering all three hostnames via SAN.

## 4. Bring the stack up

```bash
docker compose up --build -d
docker compose ps
```

All 9 services should reach `healthy` within ~60 seconds:

- `db` (KPI Dashboard Postgres)
- `migrate` (Alembic migrations; exits 0 when done)
- `api` (FastAPI)
- `frontend` (Vite dev server)
- `dex` (OIDC provider)
- `npm` (Nginx Proxy Manager — edge TLS)
- `outline-db` (Outline Postgres)
- `outline-redis` (Outline cache)
- `outline` (wiki)

See [[Docker Compose Architecture]] for the dependency graph.

## 5. First-boot one-time config

- **NPM admin UI** (`http://localhost:81`) — sign in as `admin@example.com` / `changeme`, change the password, review the three pre-wired proxy hosts.
- **Dex users** — two static users are seeded with placeholder passwords (`admin@acm.local` / `ChangeMe!2026-admin` and `dev@acm.local` / `ChangeMe!2026-dev`). Rotate before sharing with anyone. See [[Admin Runbook]] for the bcrypt workflow.

## 6. Verify

- `https://kpi.internal` → green padlock, redirects to Dex, login returns to dashboard.
- `https://wiki.internal` → Outline, same Dex credentials (see [[Admin Runbook]] for known cross-app SSO limitation).
- `https://auth.internal/dex/.well-known/openid-configuration` → JSON with `issuer: https://auth.internal/dex`.

## Quick dev loops

- `docker compose logs -f api` — follow FastAPI logs.
- `docker compose exec api alembic upgrade head` — apply new migrations without rebuilding.
- `docker compose exec db psql -U kpi_user -d kpi_db` — direct DB access.
- Edit a file under `frontend/src/` and save — Vite HMR reloads in <1s through the NPM-terminated HTTPS.
