---
phase: 25-page-layout-parity
created: 2026-04-14
status: ready-for-research
requirements: [UC-06, UC-07, UC-08, UC-09, UC-10]
---

# Phase 25: Page Layout Parity — Context

## Goal

Align `/upload` and `/settings` page wrappers with the dashboard container so every surface in the app reads the same visual canvas, padding rhythm, and vertical spacing. The dashboard container (`max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` — plus `pb-32` swap on Settings for sticky ActionBar clearance) is the reference.

## Current State

| Page | Wrapper | Notes |
|---|---|---|
| `/` (Sales) | `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` | Reference — unchanged |
| `/hr` | `max-w-7xl mx-auto px-6 pt-4 pb-8 space-y-8` | Reference — unchanged |
| `/upload` | `max-w-[800px] mx-auto px-4 py-12` | Narrower canvas, tighter horizontal padding, bigger vertical padding, uses `<Separator>` between sections |
| `/settings` | `max-w-5xl mx-auto px-6 pt-4 pb-32` | One step narrower, missing `space-y-8` rhythm; inner cards currently sit inside 5xl |

File refs:
- [frontend/src/pages/UploadPage.tsx](frontend/src/pages/UploadPage.tsx)
- [frontend/src/pages/SettingsPage.tsx](frontend/src/pages/SettingsPage.tsx)
- [frontend/src/pages/DashboardPage.tsx](frontend/src/pages/DashboardPage.tsx) (reference container)
- [frontend/src/pages/HRPage.tsx](frontend/src/pages/HRPage.tsx) (reference container)

## Decisions

### 1. Upload body layout (UC-08)

**Decision:** Two-column side-by-side — DropZone on the left, UploadHistory on the right — when viewport affords it.

**Rationale:** The wider 7xl canvas makes stacking feel wasteful. Side-by-side lets the user drop a file and immediately see it appear in the history beside the zone, reinforcing the cause→effect of upload.

**Implementation hints (for researcher/planner):**
- Use a responsive grid (e.g., `grid grid-cols-1 lg:grid-cols-2 gap-8` or `md:grid-cols-2`). Pick the breakpoint that looks right against actual table content width — researcher should check UploadHistory's minimum comfortable width.
- On narrow viewports (mobile / small tablet), stack vertically — DropZone first, then UploadHistory below.
- ErrorList (when present) spans full width above the two columns, not inside either column.
- Section headings (`page_title`, `history_title`) stay — the `history_title` moves above its column rather than above a divider.

### 2. Settings inner cards (UC-07, UC-09)

**Decision:** Cards expand with the wrapper — no inner 5xl cap. The outer wrapper becomes `max-w-7xl`, and the existing Cards (PersonioCard, HrTargetsCard, ColorPicker section, LogoUpload, etc.) flow to whatever width the 7xl container gives them.

**Rationale:** User explicitly chose "expand" over "constrain for readability". Keeps Settings visually indistinguishable from the dashboards at the container level. Any per-field readability constraints stay where they already live (e.g., `max-w-md` on individual inputs like the Personio URL field at [SettingsPage.tsx:171](frontend/src/pages/SettingsPage.tsx#L171)) — those are component-internal and stay.

**Implementation hints:**
- Change outer wrapper: `max-w-5xl mx-auto px-6 pt-4 pb-32` → `max-w-7xl mx-auto px-6 pt-4 pb-32 space-y-8`.
- Error-state wrapper at [SettingsPage.tsx:72](frontend/src/pages/SettingsPage.tsx#L72) (`max-w-5xl mx-auto px-6 py-8`) also aligns to the new container.
- Do NOT add inner `max-w-*` wrappers around Cards — they flow to 7xl.
- Verify ActionBar sticky positioning still clears content at the new width (pb-32 preserved).

### 3. Upload separator handling (UC-06, UC-09)

**Decision:** Keep the `<Separator className="my-8" />` divider between drop-zone area and upload history.

**Rationale:** User explicitly chose separator over `space-y-8` rhythm. With the two-column body layout (decision #1), the separator sits between the error surface (top, full width) and the two-column grid below — giving a clear visual break between "act" and "review history" regions.

**Implementation hints:**
- Outer wrapper still adopts `space-y-8` from the dashboard container spec (UC-06 requires it literally).
- Child rhythm inside the wrapper is not forced to `space-y-8` — the `<Separator>` between error surface and body can stay as-is.
- If `space-y-8` on the wrapper visually conflicts with `<Separator my-8>`, researcher should flag which wins — but the intent is: wrapper sets overall cadence; separator remains as an in-flow divider.

## Gray Areas Resolved

- Upload body reflow → A (side-by-side)
- Settings inner cards → expand
- Upload separator → keep

## Gray Areas NOT Relevant (pre-answered by ROADMAP)

- Container token (`max-w-7xl` + exact padding tokens) — mandated by UC-06/UC-07 literally
- Dashboard changes — NONE (UC-10 explicitly requires no regression; dashboards stay as-is)
- Delta label correctness — done in Phase 24; UC-10 just re-verifies it survives this layout pass

## Deferred Ideas

None captured this session.

## Canonical Refs

- [.planning/ROADMAP.md](../../ROADMAP.md) — Phase 25 entry with success criteria 1–5
- [.planning/REQUIREMENTS.md](../../REQUIREMENTS.md) — UC-06, UC-07, UC-08, UC-09, UC-10
- [.planning/PROJECT.md](../../PROJECT.md) — v1.10 milestone goal
- [frontend/src/pages/DashboardPage.tsx](../../../frontend/src/pages/DashboardPage.tsx) — reference container
- [frontend/src/pages/UploadPage.tsx](../../../frontend/src/pages/UploadPage.tsx) — target of restructure
- [frontend/src/pages/SettingsPage.tsx](../../../frontend/src/pages/SettingsPage.tsx) — target of restructure

No external ADRs or specs referenced — this is a pure layout consolidation phase.

## Next Step

`/gsd:plan-phase 25` — create PLAN with researcher informed by these decisions.
