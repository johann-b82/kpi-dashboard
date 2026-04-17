# Phase 37: Launcher Shell & Auth Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 37-launcher-shell-auth-wiring
**Areas discussed:** Tile grid layout & sizing, NavBar on /home, Coming-soon tile behavior, Tile icon source

---

## Tile Grid Layout & Sizing

### Grid structure

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive wrap, 4-up on desktop | CSS grid auto-fill/minmax — 4 tiles across on wide screens, fewer on narrow | ✓ |
| Fixed 4-column, no wrap | Always 4 columns regardless of viewport | |
| 2×2 fixed grid | Always exactly 2×2 | |

**User's choice:** Responsive wrap, 4-up on desktop
**Notes:** Scales naturally as tiles are added in future milestones.

### Tile size

| Option | Description | Selected |
|--------|-------------|----------|
| Square, ~120px × 120px | True iOS-style compact proportions | ✓ |
| Square, ~160px × 160px | Larger, more prominent | |
| Claude's discretion | Let Claude decide based on Tailwind token sizing | |

**User's choice:** ~120×120px square

---

## NavBar on /home

| Option | Description | Selected |
|--------|-------------|----------|
| Full NavBar + SubHeader | Consistent with all other authenticated pages | ✓ |
| NavBar only, no SubHeader | Hide SubHeader since nothing meaningful to show | |
| No chrome (full-page launcher) | Hides NavBar and SubHeader — requires special-casing | |

**User's choice:** Full NavBar + SubHeader
**Notes:** No special-casing of AuthGate shell required.

---

## Coming-Soon Tile Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced opacity, no hover effect | ~40–50% opacity, no cursor change | ✓ |
| Opacity + 'Coming soon' label overlay | Greyed out + small badge text | |
| Full opacity, locked icon + tooltip | Lock icon + hover tooltip | |

**User's choice:** Reduced opacity, no hover effect
**Notes:** Matches iOS greyed-out app pattern — clean and minimal.

---

## Tile Icon Source

### KPI Dashboard active tile icon

| Option | Description | Selected |
|--------|-------------|----------|
| LayoutDashboard | lucide-react grid-of-rectangles icon | ✓ |
| BarChart2 | Emphasizes analytics/KPI nature | |
| Claude's discretion | Claude picks from lucide-react | |

**User's choice:** LayoutDashboard

### Placeholder tiles icon

| Option | Description | Selected |
|--------|-------------|----------|
| Generic app icon (Box or Grid) | Neutral lucide-react icon | ✓ |
| Question mark / placeholder icon | Makes 'unknown future app' explicit | |
| Claude's discretion | Claude decides based on visual balance | |

**User's choice:** Generic app icon (Claude's discretion on exact icon)

---

## Claude's Discretion

- Exact placeholder icon (Box vs Grid2X2 vs similar)
- Tile border-radius token
- Gap spacing between tiles
- Icon size within tile card
- SubHeader state on /home

## Deferred Ideas

None raised during discussion.
