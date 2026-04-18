---
phase: 07-i18n-integration-and-polish
plan: 01
subsystem: test-infrastructure
tags: [infra, testing, docker, playwright, pytest]
requires:
  - backend/requirements-dev.txt (pre-existing)
provides:
  - backend/Dockerfile installs dev deps (pytest stack) into api image
  - frontend @playwright/test@1.59.1 devDependency
  - chromium cached in host Playwright cache
  - README Testing section referencing smoke-rebuild.sh
affects:
  - Wave 5 rebuild harness (plan 07-06)
tech-stack:
  added:
    - "@playwright/test@1.59.1 (frontend devDep)"
  patterns:
    - "single-stage Dockerfile installs both requirements.txt and requirements-dev.txt (Research Pitfall 2 option A)"
    - "Playwright browser install is a manual one-shot host operation; no postinstall hook (Pitfall 3)"
key-files:
  created:
    - .planning/phases/07-i18n-integration-and-polish/07-01-SUMMARY.md
  modified:
    - backend/Dockerfile
    - frontend/package.json
    - frontend/package-lock.json
    - README.md
decisions:
  - "Used single-stage Dockerfile with always-install dev deps (recommended by research for internal app; ~30 MB cost acceptable)"
  - "chromium lives under ~/Library/Caches/ms-playwright on macOS (not ~/.cache/ms-playwright as plan text assumed) — this is the OS-default Playwright cache location, not a code change"
metrics:
  duration: "8min"
  completed: 2026-04-11
requirements: [I18N-01, I18N-02]
---

# Phase 7 Plan 01: Test Infrastructure Bootstrap Summary

**One-liner:** pytest is now bundled into the api container image and `@playwright/test@1.59.1` plus chromium are available on the host, unblocking the Wave 5 rebuild persistence harness.

## What Was Done

### Task 1 — Install requirements-dev.txt in api Dockerfile (commit `f444978`)

- `backend/Dockerfile` now `COPY`s both `requirements.txt` and `requirements-dev.txt`, then `pip install`s both in a single layer.
- Verified: `docker compose build api` succeeds; `which pytest` inside the container returns `/usr/local/bin/pytest`; `import pytest, pytest_asyncio, httpx, asgi_lifespan` succeeds.
- Unblocks `docker compose exec api pytest` for every subsequent Phase 7 plan.

### Task 2 — Add @playwright/test and document smoke-rebuild workflow (commit `a21e57d`)

- `cd frontend && npm install -D @playwright/test@1.59.1` — updates `package.json` and `package-lock.json`.
- `npx playwright install chromium` — downloaded chromium 147.0.7727.15 and the headless shell into the host Playwright cache.
- `README.md` gained a `## Testing` section with two sub-sections:
  - Backend unit/integration tests via `docker compose exec api pytest`
  - End-to-end rebuild persistence smoke test via `./scripts/smoke-rebuild.sh` (forward reference — the script lands in plan 07-06)
- Verified: `npm ls @playwright/test` prints `@playwright/test@1.59.1`; `npx playwright --version` prints `Version 1.59.1`; chromium present in host cache.

## Deviations from Plan

### Path note (not a code deviation)

The plan's acceptance-criterion command `ls ~/.cache/ms-playwright | grep -q chromium` is Linux-centric. On macOS, Playwright stores its browser cache at `~/Library/Caches/ms-playwright/` (OS default). Chromium is present there as `chromium-1217` and `chromium_headless_shell-1217`. No code or config change was needed — this is purely an OS-path detail the plan did not anticipate. Future macOS-aware docs (or the smoke-rebuild harness in plan 07-06) should reference the Playwright-managed path, not hardcode `~/.cache/`.

### Auto-fixed issues

None — no Rule 1/2/3 fixes were required.

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -q "requirements-dev.txt" backend/Dockerfile` | exit 0 | exit 0 | PASS |
| `docker compose build api` | success | success | PASS |
| `which pytest` in api container | non-empty path | `/usr/local/bin/pytest` | PASS |
| `import pytest, pytest_asyncio, httpx, asgi_lifespan` in api | ok | ok | PASS |
| `@playwright/test` devDependency | `^1.59.1` | `^1.59.1` | PASS |
| `npx playwright --version` | `1.59.x` | `1.59.1` | PASS |
| chromium cached on host | present | `~/Library/Caches/ms-playwright/chromium-1217` | PASS (macOS path) |
| README has `## Testing` | yes | yes | PASS |
| README references `smoke-rebuild.sh` | yes | yes | PASS |

## Self-Check: PASSED

- `backend/Dockerfile` FOUND (modified)
- `frontend/package.json` FOUND (modified)
- `frontend/package-lock.json` FOUND (modified)
- `README.md` FOUND (modified)
- Commit `f444978` FOUND in `git log`
- Commit `a21e57d` FOUND in `git log`
