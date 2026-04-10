---
phase: 02-file-ingestion-pipeline
plan: 03
subsystem: ui
tags: [react, vite, typescript, tailwind, shadcn, i18n, react-i18next, tanstack-query, sonner, docker]

# Dependency graph
requires:
  - phase: 02-file-ingestion-pipeline
    provides: API contract (upload, uploads, delete endpoints) and Docker Compose base stack

provides:
  - React 19 + TypeScript + Vite 8 frontend project scaffold
  - Tailwind CSS v4 with CSS-first configuration
  - shadcn/ui components: button, card, table, dialog, badge, separator
  - i18n setup with DE (default) and EN translations covering all UI-SPEC copywriting strings
  - Typed API client with uploadFile, getUploads, deleteUpload wrappers
  - TanStack Query root provider in App.tsx
  - Sonner toast root in App.tsx
  - Frontend Dockerfile (node:22-alpine) and docker-compose.yml frontend service

affects: [02-04-PLAN.md (Plan 04 builds upload UI components on this scaffold)]

# Tech tracking
tech-stack:
  added:
    - react@19.2.5
    - react-dom@19.2.5
    - typescript@5.x (via Vite template)
    - vite@8.0.8
    - "@tailwindcss/vite" (Tailwind v4 Vite plugin)
    - tailwindcss@4.2.2
    - "@tanstack/react-query@5.97.0"
    - react-i18next@17.0.2
    - i18next@26.0.4
    - sonner@2.0.7
    - react-dropzone@15.0.0
    - recharts@3.8.1
    - shadcn/ui (button, card, table, dialog, badge, separator)
  patterns:
    - Tailwind v4 CSS-first config with @import "tailwindcss" and @theme block (no tailwind.config.js)
    - Vite proxy /api -> http://api:8000 for Docker-native API calls without env var switching
    - host:0.0.0.0 in vite.config.ts server config (mandatory for Docker port binding)
    - Anonymous /app/node_modules Docker volume to prevent host module clobbering
    - i18n initialized synchronously in i18n.ts, imported in main.tsx before render

key-files:
  created:
    - frontend/src/App.tsx
    - frontend/src/main.tsx
    - frontend/src/i18n.ts
    - frontend/src/index.css
    - frontend/src/lib/api.ts
    - frontend/src/lib/utils.ts
    - frontend/src/locales/de.json
    - frontend/src/locales/en.json
    - frontend/src/components/ui/button.tsx
    - frontend/src/components/ui/card.tsx
    - frontend/src/components/ui/table.tsx
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/badge.tsx
    - frontend/src/components/ui/separator.tsx
    - frontend/vite.config.ts
    - frontend/package.json
    - frontend/tsconfig.json
    - frontend/tsconfig.app.json
    - frontend/components.json
    - frontend/Dockerfile
  modified:
    - docker-compose.yml

key-decisions:
  - "shadcn/ui requires tsconfig.json (root) to have paths alias — not just tsconfig.app.json"
  - "Vite scaffold uses new 9.x create-vite template with different default structure than older templates"
  - "App.tsx is a placeholder — Plan 04 replaces inner content with UploadPage component"

patterns-established:
  - "Pattern: Tailwind v4 CSS-first config — @import 'tailwindcss' + @theme block in index.css, no postcss.config.js"
  - "Pattern: Vite Docker proxy — server.host: 0.0.0.0, server.proxy /api -> http://api:8000"
  - "Pattern: i18n import in main.tsx before App render (synchronous init, DE default)"
  - "Pattern: Anonymous Docker volume /app/node_modules in docker-compose.yml service definition"

requirements-completed: [UPLD-01, UPLD-03, MGMT-01]

# Metrics
duration: 5min
completed: 2026-04-10
---

# Phase 2 Plan 03: Frontend Scaffold Summary

**React 19 + TypeScript + Vite 8 frontend scaffold with Tailwind v4, shadcn/ui components, DE/EN i18n, TanStack Query, and Dockerized dev server added to Compose stack**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T19:25:18Z
- **Completed:** 2026-04-10T19:30:50Z
- **Tasks:** 2
- **Files modified:** 34 (32 created + 2 modified)

## Accomplishments

- Complete React + TypeScript + Vite frontend project scaffold with all Phase 2 and 3 dependencies installed
- Tailwind CSS v4 configured with CSS-first approach; shadcn/ui initialized (slate preset) with 6 components installed
- i18n infrastructure wired with react-i18next: DE default, EN fallback, all 30 UI-SPEC copywriting strings translated
- Typed API client in lib/api.ts covering all three backend endpoints (upload, list, delete)
- Frontend Dockerfile (node:22-alpine) and docker-compose.yml frontend service with correct volume, port, and healthcheck dependency

## Task Commits

1. **Task 1: Scaffold Vite + React + TypeScript project** - `13de566` (feat)
2. **Task 2: Add frontend Docker container to Compose stack** - `c9e6f0c` (feat)

## Files Created/Modified

- `frontend/src/App.tsx` - Root component with QueryClientProvider and Toaster (placeholder — Plan 04 fills with UploadPage)
- `frontend/src/main.tsx` - React root with i18n import
- `frontend/src/i18n.ts` - i18next init with DE/EN resources, DE default language
- `frontend/src/index.css` - Tailwind v4 @import + @theme with project color tokens
- `frontend/src/lib/api.ts` - Typed fetch wrappers: uploadFile, getUploads, deleteUpload
- `frontend/src/locales/de.json` - German translations (30 keys, all UI-SPEC strings)
- `frontend/src/locales/en.json` - English translations (30 keys, all UI-SPEC strings)
- `frontend/src/components/ui/` - 6 shadcn components: button, card, table, dialog, badge, separator
- `frontend/vite.config.ts` - Vite config with tailwindcss plugin, @ alias, Docker host, API proxy
- `frontend/package.json` - All dependencies pinned per CLAUDE.md stack
- `frontend/tsconfig.json` - Root tsconfig with paths alias (required by shadcn init)
- `frontend/tsconfig.app.json` - App tsconfig with baseUrl and paths
- `frontend/components.json` - shadcn configuration (slate preset, Tailwind v4)
- `frontend/Dockerfile` - node:22-alpine, EXPOSE 5173, npm run dev
- `docker-compose.yml` - Added frontend service with port 5173, volumes, depends_on api

## Decisions Made

- shadcn CLI requires the root `tsconfig.json` to have the `@/*` path alias — not just `tsconfig.app.json`. Added `compilerOptions.paths` to root tsconfig.json to satisfy shadcn init.
- The new Vite 9.x create-vite template generates a different default `App.tsx` and `index.css` structure than older templates — both were replaced with the plan's specified content.
- App.tsx contains a placeholder paragraph rather than the full UploadPage; Plan 04 replaces the inner content, keeping the provider wrappers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added path alias to root tsconfig.json for shadcn init**
- **Found during:** Task 1 (shadcn init)
- **Issue:** `npx shadcn@latest init --defaults` failed — it reads `tsconfig.json` (root), not `tsconfig.app.json`. The plan only specified adding paths to `tsconfig.app.json`.
- **Fix:** Added `compilerOptions.baseUrl` and `paths` to `tsconfig.json` root file. Also added `@types/node` devDependency for path resolution in vite.config.ts.
- **Files modified:** `frontend/tsconfig.json`, `frontend/package.json`
- **Verification:** shadcn init ran successfully, components installed
- **Committed in:** `13de566` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for shadcn init to succeed. The root tsconfig paths change is required by the shadcn CLI and has no negative side effects.

## Issues Encountered

- shadcn init requires both Tailwind CSS configured AND path alias in root tsconfig.json before it will proceed. Both had to be set up before running the init command.

## User Setup Required

None - no external service configuration required. Docker Compose handles all service dependencies.

## Known Stubs

- `frontend/src/App.tsx` (line 7-15): Placeholder paragraph `"Frontend scaffold loaded. Upload UI coming in Plan 04."` — intentional stub. Plan 04 replaces the inner content with `<UploadPage />`. The QueryClientProvider and Toaster wrappers are final.

## Next Phase Readiness

- Frontend scaffold is complete and ready for Plan 04 to build the UploadPage, DropZone, UploadHistory, and ErrorList components
- All dependencies are installed: react-dropzone for drag-and-drop, sonner toast API available, TanStack Query client ready
- Translation keys are complete — Plan 04 components call `t("key")` directly
- API types exported from lib/api.ts match Plan 02 backend Pydantic schemas
- Docker Compose stack will run frontend once api service is healthy (Plan 02 must be complete for full stack)

---
*Phase: 02-file-ingestion-pipeline*
*Completed: 2026-04-10*
