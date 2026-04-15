from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.database import engine
from app.routers.auth import router as auth_router
from app.routers.kpis import router as kpis_router
from app.routers.settings import router as settings_router
from app.routers.sync import router as sync_router
from app.routers.uploads import router as uploads_router
from app.routers.hr_kpis import router as hr_kpis_router
from app.routers.data import router as data_router
from app.scheduler import lifespan

app = FastAPI(title="KPI Dashboard", lifespan=lifespan)

# Phase 28 SessionMiddleware — must be added BEFORE any router so session
# cookies are available to downstream auth routers (Plan 28-02).
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    session_cookie="kpi_session",   # D-03
    max_age=60 * 60 * 8,            # D-02: 8h absolute
    same_site="lax",                # D-02
    https_only=True,                # D-02 Secure flag
)

app.include_router(auth_router)
app.include_router(uploads_router)
app.include_router(kpis_router)
app.include_router(settings_router)
app.include_router(sync_router)
app.include_router(hr_kpis_router)
app.include_router(data_router)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}") from exc
