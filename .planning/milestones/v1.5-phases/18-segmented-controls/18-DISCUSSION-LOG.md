# Phase 18: Segmented Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 18-segmented-controls
**Areas discussed:** Visual style, Nav tab replacement, Sizing & density, Settings page sync

---

## Visual Style

### Active Segment Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Dark foreground fill | Active segment gets bg-foreground + text-background (dark pill on light container). Uses existing semantic tokens. | ✓ |
| Primary color fill | Active segment gets bg-primary + text-primary-foreground (branded pill). More colorful but depends on theme settings. | |
| You decide | Claude picks the approach that best fits the existing theme tokens and SEG-01 spec. | |

**User's choice:** Dark foreground fill
**Notes:** Matches SEG-01 "dark active state" literally. Uses semantic tokens for theme compatibility.

### Container Style

| Option | Description | Selected |
|--------|-------------|----------|
| Background only | Container is bg-muted with rounded-full. No border. Clean look. | ✓ |
| Subtle border | Container has bg-muted + border border-border. Slightly more defined edge. | |

**User's choice:** Background only
**Notes:** Consistent with v1.4 decision to remove SubHeader border.

---

## Nav Tab Replacement

### Navigation Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap Links in segments | Each segment is a wouter <Link>. URL source of truth. Preserves <a> semantics. | |
| onClick + navigate | Segments are <button> elements. onClick calls navigate(). Loses <a> semantics. | ✓ |
| You decide | Claude picks the approach that preserves routing behavior with correct semantics. | |

**User's choice:** onClick + navigate
**Notes:** User accepted the trade-off of losing right-click "open in new tab" for an internal tool.

---

## Sizing & Density

### Size Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single size everywhere | One consistent size (h-8 text-sm). Uniform look reinforces unified control goal. | ✓ |
| Two sizes (sm + default) | Navbar/chart use sm; SubHeader uses default. Context-adapted. | |
| You decide | Claude picks based on what looks right in each context. | |

**User's choice:** Single size everywhere
**Notes:** None.

---

## Settings Page Sync

### PreferencesCard DE/EN Picker

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same component | PreferencesCard uses same SegmentedControl. Consistent visual language. Draft flow unchanged. | ✓ |
| No, keep current style | Only the 4 controls listed in SEG-02 through SEG-05 get the new component. | |
| You decide | Claude decides based on visual consistency. | |

**User's choice:** Yes, same component
**Notes:** Visual consistency across the entire app.

---

## Claude's Discretion

- Component file location and internal API design
- Exact padding/gap values within h-8 text-sm constraint
- Transition/hover effects
- Whether to extract shared hooks or keep integration inline

## Deferred Ideas

None — discussion stayed within phase scope.
