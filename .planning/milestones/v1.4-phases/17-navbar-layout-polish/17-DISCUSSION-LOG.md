# Phase 17: Navbar & Layout Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 17-navbar-layout-polish
**Areas discussed:** Logo sizing, Upload icon placement, Sub-header layout, Tab underline style

---

## Logo Sizing

### Q1: How small should the logo be?

| Option | Description | Selected |
|--------|-------------|----------|
| ~32px (compact) | About half current size. Logo becomes a small icon beside the tabs. | ✓ |
| ~40px (balanced) | Noticeably smaller but still prominent. Middle ground. | |
| You decide | Claude picks a proportional size. | |

**User's choice:** ~32px (compact)
**Notes:** None

### Q2: Should the navbar height shrink to match?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep h-16 (64px) | More whitespace around the 32px logo. | ✓ |
| Shrink to h-12 (48px) | Tighter navbar, more screen real estate for content. | |
| You decide | Claude picks based on visual balance with sub-header. | |

**User's choice:** Keep h-16 (64px)
**Notes:** None

---

## Upload Icon Placement

### Q1: Which icon should represent Upload?

| Option | Description | Selected |
|--------|-------------|----------|
| Upload (arrow-up-from-line) | Classic upload arrow. Unambiguous. | ✓ |
| CloudUpload | Arrow into a cloud. Common in SaaS apps. | |
| FilePlus | File with plus sign. Emphasizes 'add a data file'. | |
| You decide | Claude picks most visually consistent icon. | |

**User's choice:** Upload (arrow-up-from-line)
**Notes:** None

### Q2: Navigate to page or open modal?

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /upload page | Same behavior as current tab, just moved to icon. | ✓ |
| You decide | Claude picks best approach for existing architecture. | |

**User's choice:** Navigate to /upload page
**Notes:** None

### Q3: Active state on /upload route?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, highlight like gear | text-primary when on /upload, consistent with gear icon. | ✓ |
| No active state | Always text-foreground. Upload is a utility action. | |

**User's choice:** Yes, highlight like gear
**Notes:** None

---

## Sub-header Layout

### Q1: Which tabs show the sub-header?

| Option | Description | Selected |
|--------|-------------|----------|
| Sales tab only | Contextual — only shows where presets are relevant. | |
| All tabs (always visible) | Persistent presence. Freshness-only on non-filter tabs. | ✓ |
| Sales + Upload tabs | Freshness relevant to both Sales and Upload. | |

**User's choice:** All tabs (always visible)
**Notes:** None

### Q2: What shows on non-filter tabs?

| Option | Description | Selected |
|--------|-------------|----------|
| Freshness only (right-aligned) | Left side empty, freshness right-aligned. | ✓ |
| Empty bar (just the line) | Separator only, no content. | |
| You decide | Claude picks best approach. | |

**User's choice:** Freshness only (right-aligned)
**Notes:** None

### Q3: Fixed/sticky or scrolls with content?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed/sticky | Stays visible while scrolling. Presets always accessible. | ✓ |
| Scrolls with content | Part of page flow. Saves space when scrolled. | |

**User's choice:** Fixed/sticky
**Notes:** None

### Q4: FreshnessIndicator location?

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-header only | Remove from navbar action area, show only in sub-header. | ✓ |
| Both navbar and sub-header | Keep in both places. | |

**User's choice:** Sub-header only
**Notes:** None

---

## Tab Underline Style

### Q1: Underline thickness and bold?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current (2px + bold) | Already matches spec. Minimal change needed. | ✓ |
| Thicker underline (3px), no bold | Heavier line, lighter text. More modern feel. | |
| You decide | Claude picks best combination. | |

**User's choice:** Keep current (2px + bold)
**Notes:** None

### Q2: Inactive tab hover behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep hover:text-primary | Existing behavior. Good affordance. | ✓ |
| Subtle underline on hover | Faint muted underline previewing active state. | |
| You decide | Claude picks most polished hover behavior. | |

**User's choice:** Keep hover:text-primary
**Notes:** None

---

## Claude's Discretion

- Sub-header height, padding, and background color
- Separator line implementation (navbar border-b vs separate element)
- DateRangeFilter state lifting approach (context, URL state, or prop drilling)
- Exact icon ordering validation in action area
- FreshnessIndicator visibility on all tabs (since sub-header is always visible)

## Deferred Ideas

None — discussion stayed within phase scope
