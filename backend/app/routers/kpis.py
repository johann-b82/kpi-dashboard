from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import SalesRecord, UploadBatch
from app.schemas import ChartPoint, KpiSummary, KpiSummaryComparison, LatestUploadResponse
from app.services.kpi_aggregation import aggregate_kpi_summary

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("", response_model=KpiSummary)
async def get_kpi_summary(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    prev_period_start: date | None = Query(None),
    prev_period_end: date | None = Query(None),
    prev_year_start: date | None = Query(None),
    prev_year_end: date | None = Query(None),
    db: AsyncSession = Depends(get_async_db_session),
) -> KpiSummary:
    """Return current-window KPI totals plus optional previous_period / previous_year siblings.

    Comparison windows are opt-in: both start+end params must be present for a
    comparison to be computed. A half-specified window (only start or only end)
    yields a ``None`` comparison object — this is intentional so Phase 9's
    preset-to-bounds mapper can cleanly emit no-comparison for presets like
    "Dieses Jahr" (per CONTEXT decision D) by omitting the params.

    All three aggregations share the same SQL helper (aggregate_kpi_summary)
    so the current and comparison windows can never drift semantically
    (Phase 8 SC5). Sequential awaits on a single AsyncSession rather than
    asyncio.gather: SQLAlchemy AsyncSession is not safe for concurrent
    execute() calls on one connection — gather() would raise InvalidRequestError
    intermittently. The latency cost is <100ms for three single-row aggregates
    and the simpler code is more robust. See 08-02 SUMMARY for details.
    """

    async def _maybe_aggregate(s: date | None, e: date | None) -> dict | None:
        # Both bounds required — a half-specified window is ignored (None).
        if s is None or e is None:
            return None
        return await aggregate_kpi_summary(db, s, e)

    current = await aggregate_kpi_summary(db, start_date, end_date)
    prev_period = await _maybe_aggregate(prev_period_start, prev_period_end)
    prev_year = await _maybe_aggregate(prev_year_start, prev_year_end)

    # Current-window fallback: legacy behavior is zero-filled top-level fields
    # when no rows match (distinct from comparison fields which go null).
    if current is None:
        current = {
            "total_revenue": Decimal("0"),
            "avg_order_value": Decimal("0"),
            "total_orders": 0,
        }

    return KpiSummary(
        total_revenue=current["total_revenue"],
        avg_order_value=current["avg_order_value"],
        total_orders=current["total_orders"],
        previous_period=KpiSummaryComparison(**prev_period) if prev_period else None,
        previous_year=KpiSummaryComparison(**prev_year) if prev_year else None,
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
