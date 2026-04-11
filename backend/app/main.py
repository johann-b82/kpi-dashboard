from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from app.database import engine
from app.routers.kpis import router as kpis_router
from app.routers.uploads import router as uploads_router

app = FastAPI(title="ACM KPI Light")

app.include_router(uploads_router)
app.include_router(kpis_router)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}") from exc
