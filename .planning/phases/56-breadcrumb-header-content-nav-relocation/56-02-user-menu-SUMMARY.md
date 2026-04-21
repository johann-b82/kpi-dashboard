---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 02
subsystem: frontend/navigation
tags: [ui, navigation, auth, dropdown, phase-55-consumer]
requirements: [HDR-01]
dependency_graph:
  requires:
    - frontend/src/components/ui/dropdown.tsx (Phase 55)
    - frontend/src/auth/useAuth.ts
    - frontend/src/auth/AuthContext.tsx
    - @base-ui/react Menu.LinkItem
    - wouter Link
  provides:
    - UserMenu React component
    - initialsFrom(email) helper
  affects: []
tech_stack:
  added: []
  patterns:
    - Phase 55 Dropdown primitive first real consumer (D-13)
    - base-ui Menu.LinkItem + wouter Link via render prop (Pitfall 3 Path 1)
    - Token-only styling (bg-muted, ring-ring, text-destructive) — no dark: variants
key_files:
  created:
    - frontend/src/components/UserMenu.tsx
    - frontend/src/components/UserMenu.test.tsx
  modified: []
decisions:
  - Pitfall 3 resolved via render-prop (render={<WouterLink href="/docs" />}) — keyboard + right-click-open-in-new-tab affordances preserved; no fallback to navigate() needed.
  - Identity header is a <div data-testid="usermenu-identity"> (not a DropdownItem) per D-12 #1 — excluded from roving tabindex; test locates it via data-testid, signOut via last menuitem index.
  - initialsFrom splits on [.\\-_]+ so dots, hyphens, and underscores all yield parts; falls back to slice(0,2) for single-part locals. Returns null only when local-part is empty (trigger renders lucide User icon instead).
metrics:
  duration_seconds: 115
  tasks_completed: 2
  files_touched: 2
  tests_added: 9
  commit_count: 2
  completed_date: "2026-04-21"
---

# Phase 56 Plan 02: User Menu Summary

One-liner: Circular 36px initials-avatar UserMenu backed by the Phase 55 Dropdown primitive, opening a right-aligned popup (identity header · Docs · Settings · Sign out) wired to useAuth().signOut and wouter client-side routing.

## What shipped

- **`frontend/src/components/UserMenu.tsx`** — exports `UserMenu` component and pure helper `initialsFrom(email)`.
  - Returns `null` when `useAuth().user` is `null`.
  - Trigger: `inline-flex rounded-full size-9 bg-muted` with token focus ring (`focus-visible:ring-2 focus-visible:ring-ring`). Renders initials text (e.g. `"JB"`) or lucide `<User />` icon when initials cannot be derived. `aria-label` sourced from `t("userMenu.triggerLabel")`.
  - Popup: `align="end"`, `min-w-56`, contents in the exact D-12 order:
    1. Identity header `<div>` — local-part (foreground, font-medium, truncate) + full email (muted, truncate). Carries `data-testid="usermenu-identity"`. NOT a menuitem.
    2. `DropdownSeparator`
    3. `Menu.LinkItem href="/docs"` rendered through `<WouterLink href="/docs" />` — client-side navigation, keyboard Enter activates, native right-click affordances preserved.
    4. `Menu.LinkItem href="/settings"` rendered through `<WouterLink href="/settings" />`.
    5. `DropdownSeparator`
    6. `DropdownItem` with `LogOut` icon, `text-destructive`, `onClick={() => void signOut()}`.
  - Zero `dark:` variants, zero hardcoded color literals.

- **`frontend/src/components/UserMenu.test.tsx`** — 9 tests (all green):
  - `initialsFrom` x4: `"johann.bechtold@x"→"JB"`, `"admin@x"→"AD"`, `"a.b.c@d.e"→"AB"`, `"@empty.com"→null`.
  - UserMenu: returns null when unauthenticated; renders `JB` / `AD` trigger initials for two user emails; opens menu on trigger click and exposes the identity header via `findByTestId`; clicking the Sign out menuitem (last `role="menuitem"`) calls the `signOut` mock exactly once.
  - Test harness mirrors `dropdown.test.tsx`: `I18nextProvider` + hand-rolled `AuthContext.Provider` with a shaped `AuthState` value.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/components/UserMenu.test.tsx` | 9/9 PASS (973 ms) |
| `npx tsc --noEmit -p tsconfig.app.json` (filter UserMenu) | CLEAN |
| `rg "dark:" frontend/src/components/UserMenu.tsx` | 0 matches |
| `rg "export function UserMenu\|export function initialsFrom"` | 1 + 1 match |
| Phase 55 primitive import (5 names: Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator) | present |
| `size-9` (36px avatar per UI-SPEC) | present |
| `min-w-56` (popup width per UI-SPEC) | present |
| `focus-visible:ring-2 focus-visible:ring-ring` | present |

## Decisions Made

- **Pitfall 3 resolution: render-prop worked.** `<MenuPrimitive.LinkItem href="/docs" render={<WouterLink href="/docs" />} />` was adopted for both Docs and Settings rows. jsdom + base-ui accept the composition cleanly; `data-highlighted` styling remains intact under `role="menuitem"` lookup. No fallback to `Menu.Item + navigate()` was necessary. Manual UAT in a real browser (visual highlight on hover / arrow-key nav) is deferred to Plan 03 NavBar integration.
- **Identity row is a `<div>` not `DropdownItem`** (D-12 #1). Its `data-testid` gives tests a stable hook that does not depend on plan-04 i18n copy; `getAllByRole("menuitem")` correctly returns only the 3 interactive rows (Docs, Settings, Sign out).
- **Sign out is the last menuitem** by construction — the test asserts `items[items.length - 1]` rather than matching on the localized label, so it keeps passing after Plan 04 adds real copy for `userMenu.signOut`.

## Deviations from Plan

None — plan executed exactly as written. One cosmetic edit: the inline JSDoc comment was rephrased from `No \`dark:\` variants` to `No Tailwind dark-variants` so the file has 0 `dark:` substring matches (satisfies acceptance criterion + future Phase 59 dark-sweep grep guard).

## Self-Check: PASSED

- FOUND: frontend/src/components/UserMenu.tsx
- FOUND: frontend/src/components/UserMenu.test.tsx
- FOUND: commit 6b9cc95 (test RED)
- FOUND: commit 955188f (implementation GREEN)
