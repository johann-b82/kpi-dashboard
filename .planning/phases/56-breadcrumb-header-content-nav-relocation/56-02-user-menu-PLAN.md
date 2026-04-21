---
phase: 56-breadcrumb-header-content-nav-relocation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/UserMenu.tsx
  - frontend/src/components/UserMenu.test.tsx
autonomous: true
requirements: [HDR-01]
must_haves:
  truths:
    - "User sees a circular 36px avatar trigger with initials derived from their email local-part (D-11)"
    - "Fallback lucide <User> icon renders if email local-part is empty (D-11)"
    - "Clicking the trigger opens a dropdown menu aligned right (align='end')"
    - "Menu contains in order: identity header, divider, Documentation, Settings, divider, Sign out (D-12)"
    - "Identity header row is a <div>, NOT a menu item — not in roving-tabindex (D-12 #1)"
    - "Documentation and Settings rows navigate via client-side routing without full page reload (Pitfall 3)"
    - "Sign out row calls signOut() from useAuth (D-12 #6)"
    - "User menu is backed by the Phase 55 ui/dropdown primitive — no hand-rolled Popover (D-13)"
  artifacts:
    - path: "frontend/src/components/UserMenu.tsx"
      provides: "UserMenu component + initialsFrom helper"
      contains: "export function UserMenu"
    - path: "frontend/src/components/UserMenu.test.tsx"
      provides: "Render + initials + signOut unit tests"
  key_links:
    - from: "UserMenu.tsx"
      to: "@/components/ui/dropdown (Phase 55 primitive)"
      via: "import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator }"
      pattern: "from \"@/components/ui/dropdown\""
    - from: "UserMenu.tsx"
      to: "@/auth/useAuth"
      via: "const { user, signOut } = useAuth()"
      pattern: "useAuth\\("
    - from: "UserMenu.tsx Docs/Settings rows"
      to: "wouter client-side nav"
      via: "Menu.LinkItem render prop with WouterLink OR Menu.Item with navigate() fallback"
      pattern: "(wouter|navigate)"
---

<objective>
Create the UserMenu component: a circular initials avatar trigger that opens
a dropdown containing a non-interactive identity header, Documentation,
Settings, and Sign out rows. First real consumer of the Phase 55 Dropdown
primitive (D-13). Implements HDR-01's "user menu" and the relocation targets
in HDR-04 for Settings/Docs/Sign-out.

Purpose: Self-contained component, ready for NavBar to mount in Plan 03.

Output: 2 new files (1 source, 1 test) — no existing files modified.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-CONTEXT.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md
@.planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md

@frontend/src/components/ui/dropdown.tsx
@frontend/src/components/ui/dropdown.test.tsx
@frontend/src/auth/useAuth.ts
@frontend/src/auth/AuthContext.tsx
@frontend/src/lib/utils.ts

<interfaces>
<!-- Types and API the executor needs — extracted from Phase 55 primitives + auth. -->

Phase 55 Dropdown primitive (from frontend/src/components/ui/dropdown.tsx — READ before editing):
```ts
export function Dropdown(props): JSX.Element;              // wraps Menu.Root
export function DropdownTrigger(props): JSX.Element;       // wraps Menu.Trigger — forwards className via {...props}
export function DropdownContent(props): JSX.Element;       // wraps Menu.Positioner + Menu.Popup — already z-50 isolate; accepts align prop
export function DropdownItem(props): JSX.Element;          // wraps Menu.Item — button-semantic
export function DropdownSeparator(): JSX.Element;          // wraps Menu.Separator
```

For Menu.LinkItem (client-side routing — Pitfall 3):
```ts
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
// MenuPrimitive.LinkItem renders <a href> and accepts `render` prop for composition
```

Auth interfaces (from frontend/src/auth/AuthContext.tsx — CONFIRMED):
```ts
export type AuthUser = { id: string; email: string; role: string };
// NOTE: NO `name` field — initials MUST derive from email local-part.

export function useAuth(): {
  user: AuthUser | null;
  role: string | null;
  isLoading: boolean;
  signIn: (...) => Promise<...>;
  signOut: () => Promise<void>;
};
```

Wouter:
```ts
import { Link as WouterLink, useLocation } from "wouter";
// Preferred approach (Pitfall 3): <Menu.LinkItem render={<WouterLink href="/docs" />} />
// Fallback approach (if render-prop loses base-ui highlight state):
//   const [, navigate] = useLocation();
//   <DropdownItem onClick={() => navigate("/docs")}>Documentation</DropdownItem>
```

i18n keys this plan REFERENCES (added in Plan 04 — acceptable to reference; t() returns key string until Plan 04 lands):
- userMenu.triggerLabel
- userMenu.docs
- userMenu.settings
- userMenu.signOut

Tests in THIS plan must NOT assert on resolved copy for those keys. Assert on
DOM structure (aria-label present; items present by count; click triggers
signOut; initials text content).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement UserMenu component</name>
  <files>frontend/src/components/UserMenu.tsx</files>
  <read_first>
    - frontend/src/components/ui/dropdown.tsx (PRIMARY — confirm exported names, className forwarding, DropdownSeparator availability)
    - frontend/src/auth/AuthContext.tsx (AuthUser shape — confirm email field, no name field)
    - frontend/src/auth/useAuth.ts (useAuth return shape — user + signOut)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md Pattern 3 (full UserMenu source + Pitfall 3 render-prop vs fallback + Pitfall 4 className passthrough)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-UI-SPEC.md "Interaction Contract → UserMenu" + "Initials derivation" sections
  </read_first>
  <behavior>
    - `initialsFrom("johann.bechtold@example.com")` returns "JB"
    - `initialsFrom("admin@example.com")` returns "AD"
    - `initialsFrom("a.b.c@d.e")` returns "AB" (first two parts' first letters)
    - `initialsFrom("@empty.com")` returns null (empty local-part)
    - UserMenu returns null when useAuth() reports user === null
    - UserMenu trigger renders "JB" text content for user email "johann.bechtold@…"
    - UserMenu trigger renders lucide <User> icon when initialsFrom returns null
    - UserMenu trigger has aria-label set from t("userMenu.triggerLabel")
    - DropdownContent contains: identity <div> header, separator, Docs row, Settings row, separator, Sign out row — in that order
  </behavior>
  <action>
Create `frontend/src/components/UserMenu.tsx` per RESEARCH Pattern 3.

1. Export a pure helper `initialsFrom(email: string): string | null`:
```ts
export function initialsFrom(email: string): string | null {
  const local = email.split("@")[0];
  if (!local) return null;
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}
```

2. Export `UserMenu` component. Structure:

```tsx
import { useTranslation } from "react-i18next";
import { LogOut, User as UserIcon } from "lucide-react";
import { Link as WouterLink } from "wouter";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { useAuth } from "@/auth/useAuth";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  if (!user) return null;

  const initials = initialsFrom(user.email);

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={t("userMenu.triggerLabel")}
        className={cn(
          "inline-flex items-center justify-center rounded-full size-9 bg-muted text-sm font-medium",
          "hover:bg-accent/20 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {initials ?? <UserIcon className="h-5 w-5" aria-hidden />}
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground" data-testid="usermenu-identity">
          <div className="font-medium text-foreground truncate">{user.email.split("@")[0]}</div>
          <div className="truncate">{user.email}</div>
        </div>
        <DropdownSeparator />
        <MenuPrimitive.LinkItem
          href="/docs"
          render={<WouterLink href="/docs" />}
          className={cn(
            "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm outline-none",
            "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
          )}
        >
          {t("userMenu.docs")}
        </MenuPrimitive.LinkItem>
        <MenuPrimitive.LinkItem
          href="/settings"
          render={<WouterLink href="/settings" />}
          className={cn(
            "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm outline-none",
            "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
          )}
        >
          {t("userMenu.settings")}
        </MenuPrimitive.LinkItem>
        <DropdownSeparator />
        <DropdownItem
          onClick={() => void signOut()}
          className="text-destructive data-[highlighted]:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {t("userMenu.signOut")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
```

Pitfall 3 contingency: After implementation, manually verify that the Docs/Settings `render={<WouterLink />}` approach preserves base-ui's `data-highlighted` state. If it does NOT (highlight styling broken on hover/arrow-key navigation), replace BOTH LinkItem instances with:

```tsx
// Add at top: import { useLocation } from "wouter";
// In component body: const [, navigate] = useLocation();
<DropdownItem onClick={() => navigate("/docs")}>{t("userMenu.docs")}</DropdownItem>
<DropdownItem onClick={() => navigate("/settings")}>{t("userMenu.settings")}</DropdownItem>
```

Document the chosen path in SUMMARY ("Pitfall 3 resolution: render-prop worked" OR "Pitfall 3 resolution: fell back to Menu.Item + navigate()").

No `dark:` variants. No hardcoded colors — all tokens.
  </action>
  <verify>
    <automated>cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "UserMenu\.tsx" || echo "CLEAN"</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/UserMenu.tsx` exists
    - `rg -n "export function UserMenu" frontend/src/components/UserMenu.tsx` returns exactly one match
    - `rg -n "export function initialsFrom" frontend/src/components/UserMenu.tsx` returns exactly one match
    - `rg -n "from \"@/components/ui/dropdown\"" frontend/src/components/UserMenu.tsx` returns a match importing at least 5 names: Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
    - `rg -n "useAuth" frontend/src/components/UserMenu.tsx` returns a match
    - `rg -n "signOut" frontend/src/components/UserMenu.tsx` returns at least one match invoking signOut()
    - `rg -n "aria-label=\\{t\\(\"userMenu.triggerLabel\"\\)\\}" frontend/src/components/UserMenu.tsx` returns a match
    - `rg -n "dark:" frontend/src/components/UserMenu.tsx` returns ZERO matches
    - `rg -n "focus-visible:ring-2 focus-visible:ring-ring" frontend/src/components/UserMenu.tsx` returns a match
    - `rg -n "size-9" frontend/src/components/UserMenu.tsx` returns a match (36px avatar per UI-SPEC)
    - `rg -n "min-w-56" frontend/src/components/UserMenu.tsx` returns a match (popup width per UI-SPEC)
    - `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "UserMenu.tsx" || echo "CLEAN"` prints `CLEAN`
  </acceptance_criteria>
  <done>
UserMenu component implemented with initials helper, avatar trigger, Dropdown-backed popup containing identity header, Docs/Settings nav rows, Sign-out action; TypeScript clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: UserMenu unit tests</name>
  <files>frontend/src/components/UserMenu.test.tsx</files>
  <read_first>
    - frontend/src/components/UserMenu.tsx (from Task 1 — component + initialsFrom signatures)
    - frontend/src/components/ui/dropdown.test.tsx (harness shape — how base-ui Dropdown is tested in jsdom)
    - frontend/src/auth/AuthContext.tsx (AuthContext + Provider signature for test wrapper)
    - .planning/phases/56-breadcrumb-header-content-nav-relocation/56-RESEARCH.md "UserMenu render test" example
  </read_first>
  <behavior>
    - initialsFrom unit tests: "johann.bechtold@…" → "JB"; "admin@…" → "AD"; "a.b.c@d.e" → "AB"; "@empty.com" → null
    - UserMenu returns null when AuthContext user is null (container.firstChild === null)
    - UserMenu renders a trigger with accessible name from userMenu.triggerLabel key (getByLabelText matching /user menu/i once key lands in Plan 04; for now match by aria-label attribute presence)
    - Trigger has textContent "JB" for email "johann.bechtold@example.com"
    - Trigger has textContent "AD" for email "admin@example.com"
    - Clicking the trigger opens the menu — after click, identity header row (data-testid="usermenu-identity") is in the DOM
    - Clicking the Sign out item calls the signOut mock exactly once
  </behavior>
  <action>
Create `frontend/src/components/UserMenu.test.tsx` mirroring dropdown.test.tsx harness. Template (verbatim per RESEARCH, with refinements to avoid asserting on Plan 04 copy):

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { AuthContext } from "@/auth/AuthContext";
import { UserMenu, initialsFrom } from "./UserMenu";

function withAuth(user: { email: string } | null, signOut = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={{
        user: user ? { id: "u1", email: user.email, role: "admin" } : null,
        role: user ? "admin" : null,
        isLoading: false,
        signIn: vi.fn(),
        signOut,
      }}>
        <UserMenu />
      </AuthContext.Provider>
    </I18nextProvider>,
  );
}

describe("initialsFrom", () => {
  it("two parts → two initials", () => expect(initialsFrom("johann.bechtold@x")).toBe("JB"));
  it("single part → first two chars", () => expect(initialsFrom("admin@x")).toBe("AD"));
  it("three parts → first two parts' initials", () => expect(initialsFrom("a.b.c@x")).toBe("AB"));
  it("empty local-part → null", () => expect(initialsFrom("@x")).toBeNull());
});

describe("UserMenu", () => {
  it("returns null when user is null", () => {
    const { container } = withAuth(null);
    expect(container.firstChild).toBeNull();
  });

  it("renders JB initials for johann.bechtold@…", () => {
    withAuth({ email: "johann.bechtold@example.com" });
    // Trigger is the only element with aria-label attribute
    const trigger = document.querySelector("[aria-label]");
    expect(trigger?.textContent).toBe("JB");
  });

  it("renders AD initials for admin@…", () => {
    withAuth({ email: "admin@example.com" });
    const trigger = document.querySelector("[aria-label]");
    expect(trigger?.textContent).toBe("AD");
  });

  it("opens menu on trigger click and shows identity header", async () => {
    withAuth({ email: "a.b@c.d" });
    const trigger = document.querySelector("[aria-label]") as HTMLElement;
    await userEvent.click(trigger);
    expect(await screen.findByTestId("usermenu-identity")).toBeInTheDocument();
  });

  it("calls signOut on Sign out click", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    withAuth({ email: "a.b@c.d" }, signOut);
    const trigger = document.querySelector("[aria-label]") as HTMLElement;
    await userEvent.click(trigger);
    // Find the sign-out item by its lucide LogOut icon ancestor — assert by role=menuitem and icon presence
    const items = await screen.findAllByRole("menuitem");
    // Sign out is the LAST menuitem (identity header is NOT a menuitem per D-12)
    await userEvent.click(items[items.length - 1]);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
```

If the jsdom-open-menu interaction proves unreliable (Phase 55 plan 55-02 documented jsdom backdrop issues with base-ui Select), document the limitation in SUMMARY and skip the last two tests with a comment linking back to this decision. Minimum coverage: first 5 tests MUST pass.
  </action>
  <verify>
    <automated>cd frontend && npx vitest run src/components/UserMenu.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `frontend/src/components/UserMenu.test.tsx` exists
    - `rg -n "describe\\(.initialsFrom" frontend/src/components/UserMenu.test.tsx` returns a match
    - `rg -n "describe\\(.UserMenu" frontend/src/components/UserMenu.test.tsx` returns a match
    - `cd frontend && npx vitest run src/components/UserMenu.test.tsx` exits 0 with at least 5 passing tests (initialsFrom ×4 + returns-null-when-unauth)
    - `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "UserMenu.test.tsx" || echo "CLEAN"` prints `CLEAN`
  </acceptance_criteria>
  <done>
UserMenu tests run green; initialsFrom thoroughly covered; component smoke covers null-user, initials text, menu open, signOut invocation (or documents jsdom limitations).
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npx vitest run src/components/UserMenu.test.tsx` — passes
- `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "UserMenu" || echo "CLEAN"` — prints `CLEAN`
- `rg -n "dark:" frontend/src/components/UserMenu.tsx` — zero matches
- `rg -n "Dropdown|DropdownTrigger|DropdownContent|DropdownItem|DropdownSeparator" frontend/src/components/UserMenu.tsx` — at least 5 matches (all five primitive names imported)
</verification>

<success_criteria>
1. UserMenu component compiles and renders the Dropdown-backed popup per D-12 order (HDR-01)
2. Avatar trigger renders email-derived initials (JB) or fallback icon (D-11)
3. Sign out action is wired to useAuth().signOut (D-12 #6)
4. Docs and Settings rows navigate to `/docs` and `/settings` via client-side routing (Pitfall 3 resolved either via render-prop or navigate() fallback — documented in SUMMARY)
5. First real consumer of Phase 55 Dropdown primitive (D-13)
6. No `dark:` variants; focus ring uses `ring-ring` token
</success_criteria>

<output>
After completion, create `.planning/phases/56-breadcrumb-header-content-nav-relocation/56-02-SUMMARY.md` — include the Pitfall 3 resolution decision (render-prop worked vs. fallback used).
</output>
