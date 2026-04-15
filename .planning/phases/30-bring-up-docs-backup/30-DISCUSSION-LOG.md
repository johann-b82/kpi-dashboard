# Phase 30: Bring-up Docs + Backup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 30-bring-up-docs-backup
**Areas discussed:** Backup mechanism, Backup retention, Restore procedure, Setup doc style
**Mode:** User selected "recommended" — all default options locked in one pass.

---

## Backup mechanism

### 1a — Mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Cron sidecar container | Service in docker-compose.yml; self-contained, Docker-only | ✓ (recommended) |
| Host cron script | `docker compose exec db pg_dump` from host | |
| Other | — | |

### 1b — Schedule
| Option | Description | Selected |
|--------|-------------|----------|
| Nightly 02:00 local | Fixed schedule | ✓ (recommended) |
| Different time | — | |
| Configurable via env var | Default 02:00, overridable | |

**User's choice:** Recommended defaults (cron sidecar, 02:00 nightly fixed).

---

## Backup retention

### 2a — Retention policy
| Option | Description | Selected |
|--------|-------------|----------|
| 14-day rolling | Keep last 14 daily dumps | ✓ (recommended) |
| 7 daily + 4 weekly | Tiered retention | |
| Keep all | No rotation | |
| Configurable | Env var | |

### 2b — File naming
| Option | Description | Selected |
|--------|-------------|----------|
| `kpi-YYYY-MM-DD.sql.gz` | Sortable, gzipped | ✓ (recommended) |
| Uncompressed `.sql` | Simpler, larger | |
| Other | — | |

**User's choice:** Recommended defaults.

---

## Restore procedure

### 3a — Format
| Option | Description | Selected |
|--------|-------------|----------|
| Scripted | `./scripts/restore.sh <dump>` | ✓ (recommended) |
| Manual steps only | Docs only, no script | |
| Both | Script + manual fallback | |

### 3b — "Exercised at least once" evidence
| Option | Description | Selected |
|--------|-------------|----------|
| Real restore in Phase 30 | Logged in SUMMARY | ✓ (recommended) |
| Operator checkbox in docs | Self-attest | |
| Both | — | |

**User's choice:** Recommended defaults.

---

## Setup doc style

### 4a — Structure
| Option | Description | Selected |
|--------|-------------|----------|
| Linear tutorial | Single top-to-bottom path | ✓ (recommended) |
| Reference-style | Section-per-topic | |
| Other | — | |

### 4b — Directus promote click-path
| Option | Description | Selected |
|--------|-------------|----------|
| Text-only numbered | Resilient to UI rot | ✓ (recommended) |
| Text + screenshots | Clearer, stale-prone | |
| Screenshots only | — | |

### 4c — README v1.11-directus entry
| Option | Description | Selected |
|--------|-------------|----------|
| `<details>` collapsible | Matches existing version blocks | ✓ (recommended) |
| Top-level highlight | Since it's a pivot | |

**User's choice:** Recommended defaults.

---

## Claude's Discretion

- Exact `pg_dump` flags and compression format
- Backup sidecar base image (reuse `postgres:17-alpine` preferred)
- Cron mechanism inside sidecar (busybox crond, shell loop, etc.)
- Troubleshooting section contents for `docs/setup.md`

## Deferred Ideas

- Configurable backup schedule via env var
- Off-host backup shipping (S3/rsync)
- Backup encryption at rest
- Screenshots in setup docs
