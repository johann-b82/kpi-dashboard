from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db_session
from app.security.directus_auth import get_current_user
from app.models import PersonioAttendance, PersonioEmployee, SalesRecord
from app.schemas import EmployeeRead, SalesRecordRead

router = APIRouter(
    prefix="/api/data",
    tags=["data"],
    dependencies=[Depends(get_current_user)],
)


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
    employees = [EmployeeRead.model_validate(r) for r in result.scalars().all()]

    # Compute overtime hours for current month per employee
    today = date.today()
    first_day = date(today.year, today.month, 1)
    last_day = date(today.year, today.month, monthrange(today.year, today.month)[1])

    att_stmt = (
        select(
            PersonioAttendance.employee_id,
            PersonioAttendance.start_time,
            PersonioAttendance.end_time,
            PersonioAttendance.break_minutes,
            PersonioEmployee.weekly_working_hours,
        )
        .join(PersonioEmployee, PersonioAttendance.employee_id == PersonioEmployee.id)
        .where(
            PersonioAttendance.date >= first_day,
            PersonioAttendance.date <= last_day,
        )
    )
    att_rows = (await db.execute(att_stmt)).all()

    overtime_map: dict[int, float] = {}
    total_map: dict[int, float] = {}
    for row in att_rows:
        if row.start_time is None or row.end_time is None:
            continue
        start_min = row.start_time.hour * 60 + row.start_time.minute
        end_min = row.end_time.hour * 60 + row.end_time.minute
        worked = (end_min - start_min - (row.break_minutes or 0)) / 60.0
        if worked <= 0:
            continue
        total_map[row.employee_id] = total_map.get(row.employee_id, 0.0) + worked
        daily_quota = float(row.weekly_working_hours) / 5.0 if row.weekly_working_hours else 8.0
        ot = max(0.0, worked - daily_quota)
        overtime_map[row.employee_id] = overtime_map.get(row.employee_id, 0.0) + ot

    for emp in employees:
        ot = overtime_map.get(emp.id, 0.0)
        total = total_map.get(emp.id, 0.0)
        emp.total_hours = round(total, 1)
        emp.overtime_hours = round(ot, 1)
        emp.overtime_ratio = round(ot / total, 4) if total > 0 and ot > 0 else None

    return employees
