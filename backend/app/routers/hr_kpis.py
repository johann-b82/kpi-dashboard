"""HR KPI endpoint — returns all 5 HR KPIs for the current calendar month.

Per D-03: no date parameters — server computes fixed calendar month windows.
Mirrors the pattern in routers/kpis.py (single GET, single service call).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.schemas import HrKpiResponse
from app.services.hr_kpi_aggregation import compute_hr_kpis

router = APIRouter(prefix="/api/hr", tags=["hr-kpis"])


@router.get("/kpis", response_model=HrKpiResponse)
async def get_hr_kpis(
    db: AsyncSession = Depends(get_async_db_session),
) -> HrKpiResponse:
    """Return all 5 HR KPIs for the current calendar month with prior-period comparisons.

    Each KPI includes value, is_configured, previous_period, and previous_year.
    KPIs requiring unconfigured settings return is_configured=False, value=None.
    When no Personio data exists, all values are None with is_configured=True.
    """
    return await compute_hr_kpis(db)
