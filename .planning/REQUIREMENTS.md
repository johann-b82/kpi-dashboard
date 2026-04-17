# Requirements: v1.14 App Launcher

**Milestone:** v1.14  
**Status:** Active  
**Created:** 2026-04-17  

---

## Active Requirements

### Launcher Page

- [ ] **LAUNCH-01**: User sees an iOS-style app grid at `/home` after login
- [ ] **LAUNCH-02**: Each tile displays a square rounded-corner icon card with the app name label below
- [ ] **LAUNCH-03**: KPI Dashboard tile is active — clicking it navigates to `/sales`
- [ ] **LAUNCH-04**: Placeholder "coming soon" tiles are visually greyed out with no click action
- [ ] **LAUNCH-05**: Admin-only tiles are hidden (not just disabled) from Viewer role users

### Auth & Routing

- [ ] **AUTH-01**: Login success redirects to `/home` instead of the previous `/sales` default
- [ ] **AUTH-02**: Unauthenticated access to `/home` redirects to `/login`

### Branding & Polish

- [ ] **BRAND-01**: Launcher page uses the existing Tailwind CSS token system — dark mode works without additional theming code
- [ ] **BRAND-02**: Tile labels and page title are fully translated in DE and EN
- [ ] **BRAND-03**: Page heading uses the app name from Settings (same source as the navbar logo/name)

---

## Future Requirements

- Launcher fetches available apps dynamically from a config endpoint (currently hardcoded)
- External app tiles that open in a new tab
- Drag-to-reorder tiles per user
- Notification badges on tiles (e.g. unread items)

---

## Out of Scope

- New Docker services or backend routes (pure frontend change)
- Per-user tile visibility preferences (role-based visibility only)
- Custom tile icon upload (uses hardcoded icons for v1.14)
- Deep-link restoration (e.g. redirect to original destination after login) — deferred

---

## Traceability

| REQ-ID | Phase | Notes |
|--------|-------|-------|
| LAUNCH-01 | Phase 37 | |
| LAUNCH-02 | Phase 37 | |
| LAUNCH-03 | Phase 37 | |
| LAUNCH-04 | Phase 37 | |
| LAUNCH-05 | Phase 37 | |
| AUTH-01 | Phase 37 | |
| AUTH-02 | Phase 37 | |
| BRAND-01 | Phase 37 | |
| BRAND-02 | Phase 37 | |
| BRAND-03 | Phase 37 | |
