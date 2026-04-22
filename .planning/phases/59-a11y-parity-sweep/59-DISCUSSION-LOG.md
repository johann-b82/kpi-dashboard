# Phase 59: A11y & Parity Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 59-a11y-parity-sweep
**Areas discussed:** Scope boundary, i18n parity gating, Focus-ring policy, Color literal policy, Dark-mode audit method, Pre-existing TS debt

---

## Scope boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: files modified in phase 54–58 commits | Git-derivable scope list; avoids creep | ✓ (recommended) |
| Broader: whole routes those files render | Deeper audit but scope drift | |
| Hybrid: strict list + direct render parents | Middle ground | |

**User's choice:** All recommended → Strict git-derived scope.
**Notes:** Prevents sweep creep; downstream agents can reproduce scope from `git log`.

---

## i18n parity gating (key-count)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual `wc -l` at verification | Status quo | |
| Automated CI/test gate on key-count parity | Fails build on drift; fast signal | ✓ (recommended) |
| Verification-step script, no CI wiring | Middle ground | |

**User's choice:** All recommended → Automated test/CI gate.

## i18n parity gating (du-tone)

| Option | Description | Selected |
|--------|-------------|----------|
| Human DE-copy review on new/renamed keys only | Low-effort human pass | |
| Human review + lint heuristic for formal-German tokens | Two-layer safety | ✓ (recommended) |
| Heuristic only | Fully automated | |

**User's choice:** All recommended → Human review + lint heuristic.
**Notes:** Heuristic flags `Sie`, `Ihnen`, `Ihre`, `Ihr`, capitalized formal address forms.

---

## Focus-ring policy

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical Tailwind focus-ring utility applied across migrated controls | Consistent, token-based, dark-mode safe | ✓ (recommended) |
| Per-component audit, keep existing styles | Preserves current variety | |
| Canonical util as default on shared primitives, per-component for one-offs | Hybrid | |

**User's choice:** All recommended → Canonical utility across migrated controls.
**Notes:** Proposed: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none` — exact utility to be refined in research/planning against project's token spelling.

---

## Hardcoded color literal policy

| Option | Description | Selected |
|--------|-------------|----------|
| Strict zero-hex/rgb/named-color + documented allowlist | ColorPicker exception; data-driven colors OK | ✓ (recommended) |
| Strict surface colors only, data-driven OK without allowlist | Lighter process | |
| Best-effort, no enforcement | Low friction, no guarantee | |

**User's choice:** All recommended → Strict + allowlist.
**Notes:** Allowlist starts with `frontend/src/components/settings/ColorPicker.tsx`.

---

## Dark-mode audit method

| Option | Description | Selected |
|--------|-------------|----------|
| Visual browser pass + screenshots | Confidence, human eye | |
| Automated grep + contrast calc only | Fast, reproducible | |
| Both — automated as gate, visual per surface for confidence | Defense in depth | ✓ (recommended) |

**User's choice:** All recommended → Both.
**Notes:** Screenshots attached per migrated surface to `59-VERIFICATION.md`.

---

## Pre-existing TypeScript debt

| Option | Description | Selected |
|--------|-------------|----------|
| Leave deferred (out of A11Y scope) | Keep in per-phase `deferred-items.md` | ✓ (recommended) |
| Fold into this phase | Clean up now | |
| Split: fold migrated files only, rest deferred | Middle ground | |

**User's choice:** All recommended → Leave deferred.
**Notes:** Candidate for dedicated phase in v1.20+.

---

## Claude's Discretion

- Exact Tailwind focus-ring utility token spelling (must match project's existing `--ring` token).
- Test/script/CI mechanics for the i18n parity gate.
- Phase 59 plan decomposition: single sweep plan vs per-requirement plans — planner's call.

## Deferred Ideas

- Dedicated TypeScript debt cleanup phase in v1.20+.
- Higher-contrast focus-ring variant (`ring-ring-hc`) if WCAG AAA becomes a requirement.
- Broader route-level a11y audit as a follow-up phase if issues surface outside the strict file list.
