"""HR KPI endpoints — current month + 12-month history.

Per D-03: no date parameters — server computes fixed calendar month windows.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import AppSettings
from app.schemas import HrKpiHistoryPoint, HrKpiResponse
from app.services.hr_kpi_aggregation import (
    _fluctuation,
    _month_bounds,
    _overtime_ratio,
    _prev_month,
    _revenue_per_production_employee,
    _sick_leave_ratio,
    compute_hr_kpis,
)

router = APIRouter(prefix="/api/hr", tags=["hr-kpis"])


@router.get("/kpis", response_model=HrKpiResponse)
async def get_hr_kpis(
    db: AsyncSession = Depends(get_async_db_session),
) -> HrKpiResponse:
    """Return all 5 HR KPIs for the current calendar month with prior-period comparisons."""
    return await compute_hr_kpis(db)


@router.get("/kpis/history", response_model=list[HrKpiHistoryPoint])
async def get_hr_kpi_history(
    db: AsyncSession = Depends(get_async_db_session),
) -> list[HrKpiHistoryPoint]:
    """Return 4 HR KPIs for each of the last 12 months (oldest first)."""
    today = date.today()

    settings_row = (
        await db.execute(sa_select(AppSettings).where(AppSettings.id == 1))
    ).scalar_one_or_none()

    sick_type_ids: list[int] = (settings_row.personio_sick_leave_type_id or []) if settings_row else []
    prod_depts: list[str] = (settings_row.personio_production_dept or []) if settings_row else []

    # Build 12 month windows (current month + 11 prior)
    months: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(12):
        months.append((y, m))
        y, m = _prev_month(y, m)
    months.reverse()

    points: list[HrKpiHistoryPoint] = []
    for year, month in months:
        first, last = _month_bounds(year, month)

        ot = await _overtime_ratio(db, first, last)
        sl = await _sick_leave_ratio(db, first, last, sick_type_ids) if sick_type_ids else None
        fl = await _fluctuation(db, first, last)
        rpe = await _revenue_per_production_employee(db, first, last, prod_depts) if prod_depts else None

        points.append(HrKpiHistoryPoint(
            month=f"{year}-{month:02d}",
            overtime_ratio=ot,
            sick_leave_ratio=sl,
            fluctuation=fl,
            revenue_per_production_employee=rpe,
        ))

    return points
