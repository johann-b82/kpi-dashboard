# Phase 56: Breadcrumb Header + Content-Nav Relocation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 56-breadcrumb-header-content-nav-relocation
**Areas discussed:** Breadcrumb source of truth, Breadcrumb depth & scope, Relocation targets, User menu scope

---

## Breadcrumb source of truth

### Q: How should breadcrumb labels be derived from the current route?

| Option | Description | Selected |
|--------|-------------|----------|
| Static route map | Central config mapping route patterns → i18n keys | ✓ |
| Per-page register hook | Pages call useBreadcrumb() on mount | |
| Route-config driven | Declarative colocated crumbs | |

**User's choice:** Static route map

### Q: How should dynamic segments render?

| Option | Description | Selected |
|--------|-------------|----------|
| Show parent only, skip dynamic leaf | /signage/playlists/:id → "Home › Signage › Playlists" | ✓ |
| Per-page override with real name | Pages supply dynamic label | |
| Show raw id as leaf | "…› Playlists › 42" | |

**User's choice:** Show parent only, skip dynamic leaf

---

## Breadcrumb depth & scope

### Q: On which surfaces should the breadcrumb render?

| Option | Description | Selected |
|--------|-------------|----------|
| Every route except / and /login | Launcher and login get no crumb | ✓ |
| Every authenticated route including / | Launcher shows just "Home" | |
| Only multi-level routes | Hide on single-level routes | |

**User's choice:** Every route except / and /login

### Q: How should the 'Home' crumb behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Always first, links to / | i18n key nav.home (DE "Start", EN "Home") | ✓ |
| Omit Home, start with section | Shorter; breaks spec wording | |

**User's choice:** Always first, links to /

### Q: Visual separator between crumbs?

| Option | Description | Selected |
|--------|-------------|----------|
| Chevron icon (lucide ChevronRight) | Matches existing iconography | ✓ |
| › character | Matches spec text literally | |
| / slash | Classic | |

**User's choice:** ChevronRight icon

### Q: Styling for the current (last) crumb?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain muted text, aria-current="page" | Current page not a link | ✓ |
| Still a link to itself | All crumbs are `<a>` | |

**User's choice:** Plain muted text, aria-current="page"

---

## Relocation targets

### Q: Where does the Sales/HR Toggle go?

| Option | Description | Selected |
|--------|-------------|----------|
| SubHeader left slot on /sales and /hr only | Dashboard-only visibility | ✓ |
| Inline in dashboard page body | Owned by page component | |
| Keep as global in SubHeader everywhere | Visible on all non-launcher routes | |

**User's choice:** SubHeader left slot on /sales and /hr only

### Q: Where does the Upload icon go?

| Option | Description | Selected |
|--------|-------------|----------|
| SubHeader right slot on /sales and /hr only | Dashboard-scoped, admin-gated | ✓ |
| Dashboard page body | Inline in page | |
| Remove from chrome entirely | Direct-URL only | |

**User's choice:** SubHeader right slot on /sales and /hr only

### Q: Where do Settings/Docs/Sign-out go?

| Option | Description | Selected |
|--------|-------------|----------|
| User menu dropdown in top header | Matches HDR-01 "user menu" wording | ✓ |
| Keep as separate icons | Treat as global identity | |
| Split: Settings to SubHeader, others stay | Mixed | |

**User's choice:** User menu dropdown in top header

### Q: Contextual back-to-dashboard button?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove — breadcrumbs replace it | Cleaner; Home crumb is the way back | ✓ |
| Keep in SubHeader | Preserves last-dashboard memory | |
| Keep in top header | Status quo alongside breadcrumb | |

**User's choice:** Remove — breadcrumbs replace it

---

## User menu scope

### Q: Menu trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Circular initials avatar | Derived from auth user name/email | ✓ |
| Generic lucide User icon | Same for everyone | |
| Username + chevron | Shows full name | |

**User's choice:** Circular initials avatar

### Q: Menu items? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Documentation | Link to /docs | ✓ |
| Settings | Link to /settings | ✓ |
| Sign out | Calls signOut() | ✓ |
| User identity header (name/email) | Non-interactive top row | ✓ |

**User's choice:** All four — identity header, Docs, Settings, Sign out

### Q: Menu primitive?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 55 Dropdown primitive | Exactly its intended use case | ✓ |
| Build one-off Popover menu | Hand-rolled | |

**User's choice:** Reuse Phase 55 Dropdown primitive

---

## Claude's Discretion

- Breadcrumb visual sizing, alignment, and truncation behavior at small widths
- SubHeader internal arrangement when combining Sales/HR Toggle + DateRangeFilter + Upload icon
- Initials derivation rule (first+last name vs email local-part)
- Whether to keep the `lastDashboard` sessionStorage memory after removing the back button

## Deferred Ideas

- Dynamic-name crumbs for `:id` routes (e.g., real playlist titles) — follow-up phase with a `useBreadcrumb` override hook
- Real avatar images / user profile page — out of scope
- Command palette / keyboard shortcuts in top header
- Dedicated mobile-responsive breadcrumb pass (truncation, collapse-to-dropdown)
