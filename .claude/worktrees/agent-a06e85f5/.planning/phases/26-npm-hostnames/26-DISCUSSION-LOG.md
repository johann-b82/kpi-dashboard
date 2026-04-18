# Phase 26: NPM + Hostnames - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-14
**Mode:** interactive (3 of 6 identified gray areas selected for discussion; 3 left to Claude's discretion)

---

## Pre-discussion context

**Already locked from milestone scoping (v1.11):**
- Hostnames: `kpi.internal`, `wiki.internal`, `auth.internal`
- `.internal` TLD (chosen over `.local` to avoid mDNS conflicts)
- Single-VM deployment; real-domain Let's Encrypt deferred to v2
- NPM chosen as reverse proxy

**Carrying forward from prior milestones:**
- Docker Compose healthcheck pattern (`condition: service_healthy` gating)
- `.env` file for secrets — never hardcoded in `docker-compose.yml`
- No bare-metal deps — everything in containers

---

## Gray areas identified (6)

1. Certificate strategy
2. Frontend dev behavior
3. Port exposure on host
4. NPM admin bootstrap
5. NPM data persistence
6. Healthcheck gate for NPM

## User selection

User selected: **1, 2, 4**
Remaining (3, 5, 6) → Claude's discretion during planning

---

## Q1: Certificate strategy

**Options presented:**

| Option | Pros | Cons |
|---|---|---|
| A. mkcert (local CA, auto-trusted) | Green padlock, real-feel UX | Per-machine `mkcert -install` step |
| B. Raw OpenSSL self-signed + manual trust | Simplest to script | Click-through warning every session |
| C. NPM's built-in self-signed | Zero config outside NPM UI | Same click-through warning as B |

**Recommendation:** A (mkcert) — one-time setup per machine, dramatically better UX until real Let's Encrypt

**User answer:** "take all recommendations" → **A (mkcert)** locked

---

## Q2: Frontend dev behavior

**Options presented:**

| Option | Dev loop | Complexity |
|---|---|---|
| A. NPM proxies `kpi.internal` → `frontend:5173` with WebSocket upgrade | Same as today via HTTPS URL | Vite HMR proxy config ~10 lines |
| B. Dev on `localhost:5173`, NPM for prod builds only | Fastest feedback | OIDC redirects break in dev |
| C. Two compose files (dev + prod) | Clean separation | Two Compose worlds to maintain |

**Recommendation:** A — dev environment matches prod, critical for Phase 28 OIDC flow testing

**User answer:** "take all recommendations" → **A (NPM proxies with HMR over HTTPS)** locked

---

## Q4: NPM admin bootstrap

**Options presented:**

| Option | |
|---|---|
| A. Manual one-time setup (UI + documented runbook) | Low complexity, one-time pain |
| B. Automated bootstrap via NPM API | Reproducible, but maintenance cost |
| C. Hybrid — SQLite import on first start | Brittle; NPM schema evolves |

**Recommendation:** A — milestone-setup tool, not continuously rebuilt; manual + runbook fits the use case

**User answer:** "take all recommendations" → **A (manual + runbook)** locked

---

## Claude's discretion (not discussed)

- **Port exposure on host** — Drop `:8000` and `:5173` host bindings; route all traffic through NPM (`:80`/`:443`); keep `:81` for NPM admin
- **NPM data persistence** — Two named volumes: `npm_data` (active) and `npm_letsencrypt` (reserved for future)
- **Healthcheck gate** — NPM starts after `api` is healthy; brief 502 window on fresh boot acceptable

---

## Deferred / out of scope for this phase

- Dex or Outline config → later phases
- Let's Encrypt DNS-01 → v2 backlog (AUTH2-03)
- Automated NPM bootstrap → v2 if rebuild cadence justifies
