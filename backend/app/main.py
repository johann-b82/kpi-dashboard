from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from app.database import engine
from app.routers.kpis import router as kpis_router
from app.routers.settings import router as settings_router
from app.routers.sync import router as sync_router
from app.routers.uploads import router as uploads_router
from app.routers.hr_kpis import router as hr_kpis_router
from app.routers.data import router as data_router
from app.routers.me import router as me_router
from app.scheduler import lifespan

app = FastAPI(title="KPI Dashboard", lifespan=lifespan)

app.include_router(uploads_router)
app.include_router(kpis_router)
app.include_router(settings_router)
app.include_router(sync_router)
app.include_router(hr_kpis_router)
app.include_router(data_router)
app.include_router(me_router)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}") from exc
