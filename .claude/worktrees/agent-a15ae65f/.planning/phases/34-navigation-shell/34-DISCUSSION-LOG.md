# Phase 34: Navigation Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 34-navigation-shell
**Areas discussed:** Sidebar layout, Role gating UX, Navbar icon placement, Article routing

---

## Sidebar Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped flat list | Section headers with flat article links underneath. Simple, scannable. | ✓ |
| Collapsible tree | Expand/collapse sections. More compact but adds interaction overhead. | |
| Tabbed sections | Tabs to switch between User Guide and Admin Guide. | |

**User's choice:** Grouped flat list
**Notes:** Recommended for the small article count (~9 total)

---

## Role Gating UX

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to user intro | Silently redirect Viewer to user guide intro. No error, no confusion. | ✓ |
| Show 404 page | Generic page not found. Viewer may wonder why link doesn't work. | |
| Show access denied | Message revealing admin docs exist. | |

**User's choice:** Redirect to user intro
**Notes:** Viewer never knows admin docs exist

---

## Navbar Icon Placement

| Option | Description | Selected |
|--------|-------------|----------|
| BookOpen | Open book icon — universally recognized as documentation. | |
| FileText | Document with text lines — more generic. | |
| HelpCircle | Question mark in circle — implies help/FAQ. | |

**User's choice:** "bookstack" (free text) — mapped to lucide `Library` icon (stacked books)
**Notes:** User specifically wanted a bookstack style rather than the standard open book

---

## Article Routing

| Option | Description | Selected |
|--------|-------------|----------|
| /docs/:section/:slug | Clear hierarchy, easy role gating by section prefix. | ✓ |
| /docs/:slug | Flat URLs, simpler but no section context. | |
| /docs/:lang/:slug | Language in URL — conflicts with existing i18n toggle approach. | |

**User's choice:** /docs/:section/:slug
**Notes:** Section prefix enables clean role gating

---

## Claude's Discretion

- Sidebar width and responsive breakpoint
- Active article highlight style
- Route transition animations
- Article slug naming convention

## Deferred Ideas

None
