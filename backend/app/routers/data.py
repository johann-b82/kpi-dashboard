from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.models import PersonioEmployee, SalesRecord
from app.schemas import EmployeeRead, SalesRecordRead

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/sales", response_model=list[SalesRecordRead])
async def list_sales_records(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    customer: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_async_db_session),
) -> list[SalesRecordRead]:
    stmt = select(SalesRecord).order_by(SalesRecord.order_date.desc().nullslast())

    if start_date:
        stmt = stmt.where(SalesRecord.order_date >= start_date)
    if end_date:
        stmt = stmt.where(SalesRecord.order_date <= end_date)
    if customer:
        stmt = stmt.where(SalesRecord.customer_name.ilike(f"%{customer}%"))
    if search:
        stmt = stmt.where(
            SalesRecord.order_number.ilike(f"%{search}%")
            | SalesRecord.customer_name.ilike(f"%{search}%")
            | SalesRecord.project_name.ilike(f"%{search}%")
        )

    result = await db.execute(stmt.limit(500))
    return [SalesRecordRead.model_validate(r) for r in result.scalars().all()]


@router.get("/employees", response_model=list[EmployeeRead])
async def list_employees(
    department: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_async_db_session),
) -> list[EmployeeRead]:
    stmt = select(PersonioEmployee).order_by(PersonioEmployee.last_name.asc().nullslast())

    if department:
        stmt = stmt.where(PersonioEmployee.department.ilike(f"%{department}%"))
    if status:
        stmt = stmt.where(PersonioEmployee.status == status)
    if search:
        stmt = stmt.where(
            PersonioEmployee.first_name.ilike(f"%{search}%")
            | PersonioEmployee.last_name.ilike(f"%{search}%")
            | PersonioEmployee.position.ilike(f"%{search}%")
        )

    result = await db.execute(stmt.limit(500))
    return [EmployeeRead.model_validate(r) for r in result.scalars().all()]
