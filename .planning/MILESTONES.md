# Milestones

## v1.0 MVP (Shipped: 2026-04-11)

**Phases completed:** 3 phases, 10 plans, 13 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] Fixed Ruff B904 violation in main.py
- Initial Alembic migration creating upload_batches and sales_records tables, Docker Compose stack verified end-to-end with health endpoint, persistence across restarts confirmed.
- 38-column ERP tab-delimited parser with German locale handling, complete SQLAlchemy models with UNIQUE business key, and Pydantic API response schemas
- FastAPI upload router (POST /api/upload, GET /api/uploads, DELETE /api/uploads/{id}) wired into app with Alembic migration to full 38-column PostgreSQL schema including UNIQUE order_number and cascade delete
- React 19 + TypeScript + Vite 8 frontend scaffold with Tailwind v4, shadcn/ui components, DE/EN i18n, TanStack Query, and Dockerized dev server added to Compose stack
- Bilingual React upload page with drag-and-drop DropZone, scrollable ErrorList, UploadHistory table with status badges, and DeleteConfirmDialog — all wired to the FastAPI backend via TanStack Query
- Three async aggregation endpoints (summary, chart, latest-upload) backed by sales_records/upload_batches with a new order_date B-tree index.
- [Rule 1 — Bug] PopoverTrigger API difference caught before commit.

---
