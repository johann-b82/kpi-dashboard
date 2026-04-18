---
phase: 26-npm-hostnames
plan: 03
subsystem: docs
tags: [runbook, readme, onboarding, mkcert, npm, hostnames]

# Dependency graph
requires:
  - phase: 26-01
    provides: docker-compose NPM+cert pipeline that the runbook documents
  - phase: 26-02
    provides: Canonical NPM proxy-host config for kpi/wiki/auth.internal used as the runbook source of truth
provides:
  - docs/setup.md — full v1.11-aware onboarding runbook (prereqs, mkcert, /etc/hosts, certs, compose, NPM first-login, proxy-host walkthrough, verification, troubleshooting, v2 LE path)
  - README.md — Quickstart block + Hostnames table + link to docs/setup.md, with stale :5173/:8000 access instructions updated to the NPM edge reality
affects: [27-dex, 28-outline, 29-oidc-kpi, 31-milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs-only plan: reshape a manually-performed operator checkpoint (26-02 Task 3) into a reproducible runbook for new developers"
    - "README.md as quickstart-only surface; canonical long-form setup content in docs/setup.md — one link from each relevant README section"

key-files:
  created:
    - docs/setup.md
    - .planning/phases/26-npm-hostnames/26-03-SUMMARY.md
  modified:
    - README.md

key-decisions:
  - "Preserved existing README.md content (features, architecture, API table, version history) and inserted Quickstart + Hostnames sections near the top — no destructive rewrite"
  - "Updated the old 'Quick Start' section (which pointed at http://localhost:5173 / :8000) to reflect NPM as sole edge; renamed to 'Detailed Setup' and point readers at docs/setup.md, because 26-02 commented out those host-port bindings"
  - "Updated README.md architecture diagram to include the npm service and show kpi/wiki/auth.internal routing — the old diagram showed frontend proxying /api itself, which is no longer accurate since 26-02"
  - "Title fixed from 'KPI' to 'KPI Light' to match the project name in CLAUDE.md and PROJECT.md"
  - "docs/setup.md avoids any links into .planning/ — those are workflow artifacts and the runbook is a product-facing doc (per plan instruction)"
  - "INF-03 /etc/hosts line documented verbatim in both files; README's version wraps it in the sudo tee one-liner, docs/setup.md shows both the bare line and the tee one-liner — same substring appears character-for-character in both"

requirements-completed: [INF-03, INF-04]

# Metrics
duration: ~2min
completed: 2026-04-14
---

# Phase 26 Plan 03: docs/setup.md Runbook Summary

**First-run runbook (mkcert → /etc/hosts → compose up → NPM bootstrap → verification) landed at docs/setup.md; README.md gained a Quickstart block, a Hostnames table, and an updated architecture diagram — any new developer can now reach a green-padlock https://kpi.internal without asking a human.**

## Performance

- **Duration:** ~2 min (docs-only, no code)
- **Tasks:** 2 (docs/setup.md creation + README.md update)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `docs/setup.md` covers all 7 mandated sections: Prerequisites, One-time machine setup, Per-checkout setup, NPM first-login + proxy-host walkthrough, Verification, Troubleshooting, and the v2 Let's Encrypt migration path (INF-04 future hook).
- NPM proxy-host config transcribed from the 26-02-SUMMARY.md source of truth — field-for-field, including the `/api` custom location advanced block and the Websockets Support flag.
- README.md Quickstart gives a copy-pasteable macOS/Ubuntu onboarding in < 10 lines; long-form details deferred to docs/setup.md.
- Old README "Quick Start" that pointed at `http://localhost:5173` / `:8000` rewritten to match post-26-02 reality (those ports are now commented-out debug hatches) — removes a trap where a first-time user would try `:5173` and hit the commented binding.
- Architecture diagram updated to include the NPM edge service and the three routed hostnames.
- /etc/hosts line verbatim in both docs — verified the string `127.0.0.1 kpi.internal wiki.internal auth.internal` appears character-for-character in each file, so there is no drift risk.

## Task Commits

1. **Task 1: docs/setup.md runbook** — `6e890bb` (docs)
2. **Task 2: README.md Quickstart + hostnames table + link** — `fd782bc` (docs)

**Plan metadata:** (this commit — docs plan close)

## Files Created/Modified

- `docs/setup.md` — 267 lines. Sections: Prerequisites (with mkcert install commands for macOS/Debian/Windows), One-time machine setup (mkcert -install, /etc/hosts line), Per-checkout setup (clone, .env, generate-certs.sh, docker compose up), First-time NPM admin bootstrap (login + SSL cert upload + three proxy-host walkthroughs with field tables and the /api location block), Verification (browser-side checks), Troubleshooting (7-row table of common failure modes), Future v2 LE migration path.
- `README.md` — Title corrected to "KPI Light"; inserted Quickstart + Prerequisites + Hostnames table + Documentation section near the top; old "Quick Start" renamed to "Detailed Setup" and rewritten to point at `https://kpi.internal` (not `http://localhost:5173`), with a note that the host-port bindings are commented-out debug hatches; architecture diagram updated to include the npm service and list the three hostnames.

## Decisions Made

- **Preserve existing README content** — The file had substantive features, architecture, API endpoint table, and version history sections predating v1.11. Those were kept intact; new sections were inserted near the top without deleting anything existing.
- **Update the old Quick Start / architecture diagram** — This is a correctness fix, not scope creep. After 26-02 commented out the `:5173` and `:8000` host port bindings, the old instructions (`Frontend: http://localhost:5173`) no longer work. Leaving them would actively mislead a new developer. Classed under Rule 2 (critical correctness).
- **docs/setup.md avoids `.planning/` links** — Plan instruction: the runbook is product-facing, planning artifacts are internal. Runbook stands on its own.
- **Single `/etc/hosts` line, identical in both docs** — Different framings (bare code block vs tee one-liner), but the `127.0.0.1 kpi.internal wiki.internal auth.internal` substring is character-for-character identical in both files. Reduces drift risk on future edits.
- **Troubleshooting table covers the real failure modes seen or anticipated** — Includes the exact allowedHosts regression message from Vite, the HMR WebSocket symptom the 26-02 operator would have hit without Websockets Support, and the 502 window (which was actively closed by the 26-01 healthcheck chain).

## Deviations from Plan

**Scope addition (within Task 2):** Plan 26-03 Task 2 said to add a Quickstart and preserve existing content. The existing README's "Quick Start" section pointed at `http://localhost:5173` / `http://localhost:8000`, which 26-02 made non-functional by commenting out those host-port bindings. Leaving that block as-is would actively mislead a reader. I rewrote it to reflect the NPM edge reality (same section, new content) and updated the architecture diagram for the same reason. Classed as **Rule 2 — critical correctness fix**. Same commit as the Quickstart addition, no separate commit.

No other deviations. Zero auto-fixes needed; zero checkpoints (plan was fully autonomous by frontmatter declaration).

## Issues Encountered

None. Docs-only plan with clear source material (26-01-SUMMARY and 26-02-SUMMARY provided the exact proxy-host config).

## Discrepancies Between 26-02 Walkthrough and docs/setup.md

None of substance. Two intentional expansions in the runbook:

1. **Advanced block for `/api` location on kpi.internal** — 26-02-SUMMARY showed `proxy_set_header Host $host;` only. Plan 26-03 Task 1 explicitly requested the full forwarded-headers set (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto), so the runbook includes all four. This is a superset — functionally equivalent to 26-02's configuration plus standard-practice forwarded-header propagation.
2. **wiki.internal / auth.internal forwarding** — 26-02-SUMMARY settled on `api:8000` http as the placeholder upstream; the runbook uses the same value. Plan 26-03 task text mentioned "NPM default page or Offline" as a mental alternative, but the chosen canonical config is `api:8000`, which is what the runbook documents.

No other drift.

## Phase 26 Wrap-Up — INF-01 … INF-05 Verification Paths

| Req | Requirement | Verified By | Artifact |
| --- | ----------- | ----------- | -------- |
| INF-01 | NPM is the HTTPS edge; all app traffic flows through it; dev matches prod | 26-02 Task 3 human-verify (operator confirmed `https://kpi.internal` loads through NPM; `:5173`/`:8000` host binds removed) | `docker-compose.yml` (commented-out debug hatches), `26-02-SUMMARY.md` checkpoint log |
| INF-02 | Single-origin SPA + API via `/api` custom location | 26-02 Task 3 (operator confirmed dashboard loads, API calls succeed through `https://kpi.internal/api/*` without CORS) | NPM proxy-host config captured in `26-02-SUMMARY.md` §"NPM Proxy-Host Configuration"; runbook reproduces it in `docs/setup.md` §4.3 |
| INF-03 | `/etc/hosts` line documented verbatim | 26-03 (this plan) | `docs/setup.md` §2.2; `README.md` Quickstart block |
| INF-04 | Future Let's Encrypt migration path documented | 26-03 (this plan) | `docs/setup.md` §7 (Future — AUTH2-03 hook); 26-01 already mounted `npm_letsencrypt` volume in anticipation |
| INF-05 | Healthcheck-gated boot order closes the 502 window | 26-01 Task 3 human-verify (operator confirmed `db → migrate → api → frontend → npm` boot order); 26-02 deviation hardened the frontend healthcheck (loopback-IPv4) | `docker-compose.yml` healthchecks + `depends_on.service_healthy` chain; `26-01-SUMMARY.md` + `26-02-SUMMARY.md` deviation eab26c7 |

All five INF requirements have verification paths documented. Phase 26 is ready for phase-level VERIFICATION pass.

## Next Phase Readiness

- Phase 26 outputs a reproducible onboarding path for new developers (INF-03).
- Placeholder `wiki.internal` and `auth.internal` proxy hosts documented in the runbook with explicit "repointed in Phase 29 / Phase 27" notes — Phase 27 (Dex) and Phase 29 (Outline) can reference docs/setup.md §4.3 and make a one-field proxy-host edit.
- No new tech, no new patterns, no new code — this plan is purely documentation.

---
*Phase: 26-npm-hostnames*
*Completed: 2026-04-14*

## Self-Check: PASSED

- docs/setup.md — FOUND
- README.md — FOUND
- .planning/phases/26-npm-hostnames/26-03-SUMMARY.md — FOUND
- Commit 6e890bb — FOUND
- Commit fd782bc — FOUND
