---
quick_id: 260422-j9o
date: 2026-04-22
status: complete
---

# Quick Task 260422-j9o — Summary

## What changed

- **Toggle muted variant** now renders an understated pill (`bg-background shadow-sm` + `text-foreground`) instead of the blue primary fill. Default variant (chart Balken/Fläche, date-range preset) is unchanged.
- **Toggle pill sizing is dynamic** — `useLayoutEffect` + `ResizeObserver` measure the active segment and size the indicator to match. Fixes misalignment on the Sales/HR toggle where `Vertrieb` (77px) and `HR` (43px) differ.
- **NavBar cluster** shrunk to 32px circles: docs link `size-9` → `size-8`; UserMenu avatar `size-9 font-medium` → `size-8 font-normal` (matches the DE/EN label weight).
- **Sales/HR Toggle** in `SubHeader` adopts `variant="muted"` and drops the redundant `border-transparent` className.
- **Locale casing**: `nav.sales` is now title-case (`Vertrieb` / `Sales`) instead of ALL-CAPS.

## Verified
Chrome DevTools MCP on `/sales` (dark mode): indicator class = `bg-background shadow-sm`, active-pill delta vs button = 0px / ≤0.35px. UserMenu `font-weight: 400`.

## Notes
- Docker Vite occasionally served stale transformed output through HMR; a container restart was required after deeper module-level edits. Not a code issue — flagged so future polish sessions know to restart on unexpected staleness.
- Phase 60 (HR Date-Range Filter) was added to the roadmap during this session to capture the HR date-range request — not in scope for this quick task because it requires backend changes.
