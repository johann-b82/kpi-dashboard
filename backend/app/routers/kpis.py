from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SalesRecord, UploadBatch
from app.schemas import ChartPoint, KpiSummary, LatestUploadResponse

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("", response_model=KpiSummary)
async def get_kpi_summary(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: AsyncSession = Depends(get_async_db_session),
) -> KpiSummary:
    stmt = (
        select(
            func.sum(SalesRecord.total_value).label("total_revenue"),
            func.avg(SalesRecord.total_value).label("avg_order_value"),
            func.count(SalesRecord.id).label("total_orders"),
        )
        .where(SalesRecord.total_value > 0)
    )
    if start_date is not None:
        stmt = stmt.where(SalesRecord.order_date >= start_date)
    if end_date is not None:
        stmt = stmt.where(SalesRecord.order_date <= end_date)

    row = (await db.execute(stmt)).one()
    return KpiSummary(
        total_revenue=row.total_revenue or Decimal("0"),
        avg_order_value=row.avg_order_value or Decimal("0"),
        total_orders=row.total_orders or 0,
    )


@router.get("/chart", response_model=list[ChartPoint])
async def get_chart_data(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    granularity: Literal["daily", "weekly", "monthly"] = Query("monthly"),
    db: AsyncSession = Depends(get_async_db_session),
) -> list[ChartPoint]:
    trunc_map = {"daily": "day", "weekly": "week", "monthly": "month"}
    bucket = func.date_trunc(trunc_map[granularity], SalesRecord.order_date).label("bucket")

    stmt = (
        select(bucket, func.sum(SalesRecord.total_value).label("revenue"))
        .where(SalesRecord.total_value > 0)
        .where(SalesRecord.order_date.isnot(None))
        .group_by(bucket)
        .order_by(bucket)
    )
    if start_date is not None:
        stmt = stmt.where(SalesRecord.order_date >= start_date)
    if end_date is not None:
        stmt = stmt.where(SalesRecord.order_date <= end_date)

    result = await db.execute(stmt)
    return [
        ChartPoint(date=row.bucket.date().isoformat(), revenue=row.revenue)
        for row in result.all()
    ]


@router.get("/latest-upload", response_model=LatestUploadResponse)
async def get_latest_upload(
    db: AsyncSession = Depends(get_async_db_session),
) -> LatestUploadResponse:
    result = await db.execute(select(func.max(UploadBatch.uploaded_at)))
    ts = result.scalar()
    return LatestUploadResponse(uploaded_at=ts)
