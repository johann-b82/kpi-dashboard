# Phase 36: Admin Guide Content - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 36-admin-guide-content
**Areas discussed:** Audience & tech depth, Sensitive info handling, Architecture article scope, Cross-guide linking

---

## Audience & Tech Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Ops-savvy admin | Knows Docker, env vars, CLI basics. Concise and actionable. | ✓ |
| Mixed audience | Include brief context for concepts like Docker Compose, environment variables. | |
| Full beginner | Assume no prior Docker/server knowledge. Step-by-step from scratch. | |

**User's choice:** Ops-savvy admin
**Notes:** None

---

## Sensitive Info Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder + .env ref | Use `your-api-key-here` placeholders, reference .env file, add security note. | ✓ |
| Redacted only | Show `***` or `<REDACTED>` in examples. | |
| Full .env template | Complete .env.example block with all variables and inline comments. | |

**User's choice:** Placeholder + .env ref
**Notes:** None

---

## Architecture Article Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Service map + data flow | List each service, connections, ports, data flow. Text-based, no diagrams. | ✓ |
| Deep technical | Internal details: SQLAlchemy models, API route structure, component tree. | |
| High-level overview | Big picture only, minimal detail. | |

**User's choice:** Service map + data flow
**Notes:** None

---

## Cross-Guide Linking

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both directions | Admin ↔ User guide cross-references in both directions. | ✓ |
| Admin → User only | Admin references user guide, not vice versa. | |
| No cross-linking | Guides fully independent. | |

**User's choice:** Yes, both directions
**Notes:** None

---

## Claude's Discretion

- Article slug names, section headings, tips/notes placement, detail level, German translation style

## Deferred Ideas

None
