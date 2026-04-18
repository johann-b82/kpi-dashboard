# Phase 13: Sync Service & Settings Extension - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 13-sync-service-settings-extension
**Areas discussed:** Sync execution model, Auto-discovery timing, Settings page layout, Phase boundary with HR tab

---

## Sync Execution Model

### Q1: Sync blocking vs async

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking request | POST /api/sync blocks until complete, returns summary counts | ✓ |
| Async with polling | Returns job ID, frontend polls for status | |
| Blocking with timeout fallback | Start blocking, fall back after 30s | |

**User's choice:** Blocking request
**Notes:** Simple approach, sufficient for small-to-medium employee counts

### Q2: Sync response content

| Option | Description | Selected |
|--------|-------------|----------|
| Counts only | {employees_synced, attendance_synced, absences_synced, status, error_message?} | ✓ |
| Counts + change details | Also include {new, updated, deleted} per entity | |
| Counts + full sync log | Per-entity diff log | |

**User's choice:** Counts only

### Q3: Data handling strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Upsert by Personio ID | INSERT ON CONFLICT DO UPDATE per entity | ✓ |
| Full replace per sync | DELETE all + INSERT fresh each time | |
| Soft-delete + upsert | Upsert active, mark disappeared as deleted | |

**User's choice:** Upsert by Personio ID

### Q4: Interval change behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate reschedule | Reschedule APScheduler job when settings change | ✓ |
| Restart required | Read interval on startup only | |

**User's choice:** Immediate reschedule

---

## Auto-Discovery Timing

### Q1: When to fetch absence types and departments

| Option | Description | Selected |
|--------|-------------|----------|
| On settings page load | Live fetch from Personio when Settings opens | ✓ |
| After each sync | Run as part of sync job, cache locally | |
| On-demand with short TTL cache | First load fetches live, cache for 1h | |

**User's choice:** On settings page load

### Q2: Fallback when credentials missing or API fails

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled + hint text | Dropdowns disabled with hint message | ✓ |
| Empty dropdown + toast | Interactable but empty, toast explains | |
| Manual text input fallback | Free-text entry when Personio unavailable | |

**User's choice:** Disabled + hint text

---

## Settings Page Layout

### Q1: Field organization

| Option | Description | Selected |
|--------|-------------|----------|
| Separate 'Personio' section | Distinct section below branding with own heading | ✓ |
| Tabbed settings | Split into Branding and Personio tabs | |
| Inline with existing | Append at bottom of current form | |

**User's choice:** Separate 'Personio' section

### Q2: Section visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Section always expanded | ✓ |
| Collapsible accordion | Section collapses to save space | |

**User's choice:** Always visible

### Q3: Save action

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared save | One Speichern button for whole form | ✓ |
| Separate save per section | Independent save buttons per section | |

**User's choice:** Single shared save

---

## Phase Boundary with HR Tab

### Q1: What Phase 13 delivers

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-only + Settings UI | Sync service, endpoints, Settings Personio section. No HR tab. | ✓ |
| Include minimal HR page | Also create bare-bones /hr route with sync button | |
| Move sync button to Settings | Put manual sync trigger in Settings section | |

**User's choice:** Backend-only + Settings UI

### Q2: Credential test button

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, test button | "Verbindung testen" button calls POST /api/sync/test | ✓ |
| No, just save | Errors surface on first sync attempt | |

**User's choice:** Yes, test button

---

## Claude's Discretion

- APScheduler setup pattern within FastAPI lifespan
- PersonioClient method additions for data fetching
- Sync service internal structure
- Personio API pagination handling

## Deferred Ideas

None — discussion stayed within phase scope
