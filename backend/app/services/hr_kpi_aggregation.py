"""HR KPI aggregation service — computes all 5 HR KPIs for calendar month windows.

Computes Overtime Ratio, Sick Leave Ratio, Fluctuation, Skill Development,
and Revenue per Production Employee from synced Personio data and SalesRecord
data. Each KPI is computed for three calendar month windows: current month,
previous month, and same month last year. Sequential awaits only (no
asyncio.gather on shared AsyncSession per Pitfall 2).
"""

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select, and_, or_, cast, Integer as SAInteger
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AppSettings,
    PersonioAbsence,
    PersonioAttendance,
    PersonioEmployee,
    SalesRecord,
)
from app.schemas import HrKpiResponse, HrKpiValue
from app.services.kpi_aggregation import aggregate_kpi_summary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    """Return (first_day, last_day) for a calendar month."""
    last_day_num = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day_num)


def _prev_month(year: int, month: int) -> tuple[int, int]:
    """Return (year, month) for the previous calendar month.

    Handles January underflow (Pitfall 4 in RESEARCH.md).
    """
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _weekday_count(first_day: date, last_day: date) -> int:
    """Count weekdays (Mon-Fri) in the inclusive date range."""
    count = 0
    d = first_day
    while d <= last_day:
        if d.weekday() < 5:
            count += 1
        d += timedelta(days=1)
    return count


# ---------------------------------------------------------------------------
# Headcount helper (D-02: end-of-month snapshot)
# ---------------------------------------------------------------------------


async def _headcount_at_eom(
    session: AsyncSession,
    last_day: date,
    department: str | None = None,
) -> int:
    """Count active employees as of *last_day*.

    Active = hire_date <= last_day AND (termination_date IS NULL OR termination_date > last_day).
    When *department* is given, filter by exact string match (D-11).
    """
    stmt = select(func.count(PersonioEmployee.id)).where(
        PersonioEmployee.hire_date <= last_day,
        or_(
            PersonioEmployee.termination_date.is_(None),
            PersonioEmployee.termination_date > last_day,
        ),
    )
    if department is not None:
        stmt = stmt.where(PersonioEmployee.department == department)
    result = await session.execute(stmt)
    return result.scalar_one() or 0


# ---------------------------------------------------------------------------
# Individual KPI computations
# ---------------------------------------------------------------------------


async def _overtime_ratio(
    session: AsyncSession,
    first_day: date,
    last_day: date,
) -> float | None:
    """HRKPI-01: overtime hours / total hours from attendance records.

    Overtime per record = max(0, worked_hours - daily_quota).
    Daily quota = weekly_working_hours / 5.
    """
    stmt = (
        select(
            PersonioAttendance.start_time,
            PersonioAttendance.end_time,
            PersonioAttendance.break_minutes,
            PersonioEmployee.weekly_working_hours,
        )
        .join(
            PersonioEmployee,
            PersonioAttendance.employee_id == PersonioEmployee.id,
        )
        .where(
            PersonioAttendance.date >= first_day,
            PersonioAttendance.date <= last_day,
        )
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return None

    total_hours = 0.0
    overtime_hours = 0.0

    for row in rows:
        start_minutes = row.start_time.hour * 60 + row.start_time.minute
        end_minutes = row.end_time.hour * 60 + row.end_time.minute
        worked = (end_minutes - start_minutes - row.break_minutes) / 60.0
        if worked <= 0:
            continue

        total_hours += worked

        if row.weekly_working_hours is not None:
            daily_quota = float(row.weekly_working_hours) / 5.0
            overtime_hours += max(0.0, worked - daily_quota)

    if total_hours == 0:
        return None
    return overtime_hours / total_hours


async def _sick_leave_ratio(
    session: AsyncSession,
    first_day: date,
    last_day: date,
    sick_leave_type_id: int,
) -> float | None:
    """HRKPI-02: sick leave hours / total scheduled hours.

    Uses overlap logic: start_date <= last_day AND end_date >= first_day (Pitfall 1).
    """
    # Numerator: sick hours
    absence_stmt = (
        select(
            PersonioAbsence.start_date,
            PersonioAbsence.end_date,
            PersonioAbsence.time_unit,
            PersonioAbsence.hours,
            PersonioAbsence.employee_id,
        )
        .where(
            PersonioAbsence.absence_type_id == sick_leave_type_id,
            PersonioAbsence.start_date <= last_day,
            PersonioAbsence.end_date >= first_day,
        )
    )
    absences = (await session.execute(absence_stmt)).all()

    # Fetch employee weekly hours for per-employee daily rate
    emp_hours_stmt = select(
        PersonioEmployee.id,
        PersonioEmployee.weekly_working_hours,
    )
    emp_rows = (await session.execute(emp_hours_stmt)).all()
    emp_weekly: dict[int, float] = {
        r.id: float(r.weekly_working_hours) if r.weekly_working_hours is not None else 40.0
        for r in emp_rows
    }

    sick_hours = 0.0
    for ab in absences:
        clipped_start = max(ab.start_date, first_day)
        clipped_end = min(ab.end_date, last_day)
        clipped_days = (clipped_end - clipped_start).days + 1
        if clipped_days <= 0:
            continue

        if ab.time_unit == "hours" and ab.hours is not None:
            total_absence_days = (ab.end_date - ab.start_date).days + 1
            if total_absence_days > 0:
                sick_hours += float(ab.hours) * clipped_days / total_absence_days
        else:
            daily_rate = emp_weekly.get(ab.employee_id, 40.0) / 5.0
            sick_hours += daily_rate * clipped_days

    # Denominator: total scheduled hours for all active employees
    weekdays = _weekday_count(first_day, last_day)
    if weekdays == 0:
        return None

    # Active employees at end of month
    active_stmt = select(
        PersonioEmployee.weekly_working_hours,
    ).where(
        PersonioEmployee.hire_date <= last_day,
        or_(
            PersonioEmployee.termination_date.is_(None),
            PersonioEmployee.termination_date > last_day,
        ),
    )
    active_emps = (await session.execute(active_stmt)).all()
    if not active_emps:
        return None

    total_scheduled = 0.0
    for emp in active_emps:
        weekly = float(emp.weekly_working_hours) if emp.weekly_working_hours is not None else 40.0
        total_scheduled += (weekly / 5.0) * weekdays

    if total_scheduled == 0:
        return None
    return sick_hours / total_scheduled


async def _fluctuation(
    session: AsyncSession,
    first_day: date,
    last_day: date,
) -> float | None:
    """HRKPI-03: leavers in period / headcount at end of month (D-02)."""
    leavers_stmt = select(func.count(PersonioEmployee.id)).where(
        PersonioEmployee.termination_date >= first_day,
        PersonioEmployee.termination_date <= last_day,
    )
    leavers = (await session.execute(leavers_stmt)).scalar_one() or 0
    headcount = await _headcount_at_eom(session, last_day)
    if headcount == 0:
        return None
    return leavers / headcount


async def _skill_development(
    session: AsyncSession,
    last_day: date,
    skill_attr_key: str,
) -> float | None:
    """HRKPI-04: employees with non-null configured skill attribute / total headcount.

    Proxy metric: employees with current non-null value for the configured
    attribute. No historical snapshot table exists.
    """
    headcount = await _headcount_at_eom(session, last_day)
    if headcount == 0:
        return None

    # Query active employees with non-null skill attribute value in raw_json
    # JSONB path: raw_json -> 'attributes' -> skill_attr_key -> 'value'
    skilled_stmt = select(func.count(PersonioEmployee.id)).where(
        PersonioEmployee.hire_date <= last_day,
        or_(
            PersonioEmployee.termination_date.is_(None),
            PersonioEmployee.termination_date > last_day,
        ),
        PersonioEmployee.raw_json.isnot(None),
        PersonioEmployee.raw_json["attributes"][skill_attr_key]["value"].as_string().notin_(["null", ""]),
    )
    skilled = (await session.execute(skilled_stmt)).scalar_one() or 0
    return skilled / headcount


async def _revenue_per_production_employee(
    session: AsyncSession,
    first_day: date,
    last_day: date,
    production_dept: str,
) -> float | None:
    """HRKPI-05: total monthly revenue / production dept headcount (D-12, D-13, D-14).

    Revenue numerator reuses aggregate_kpi_summary (same SQL as Sales dashboard).
    Denominator is production-department headcount at end of month.
    """
    summary = await aggregate_kpi_summary(session, first_day, last_day)
    if summary is None:
        return None
    revenue = float(summary["total_revenue"])
    if revenue <= 0:
        return None

    headcount = await _headcount_at_eom(session, last_day, department=production_dept)
    if headcount == 0:
        return None
    return revenue / headcount


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def compute_hr_kpis(db: AsyncSession) -> HrKpiResponse:
    """Compute all 5 HR KPIs for current, previous, and year-ago month windows.

    Sequential awaits on the shared AsyncSession (no asyncio.gather per Pitfall 2).
    """
    today = date.today()
    cur_first, cur_last = _month_bounds(today.year, today.month)
    prev_y, prev_m = _prev_month(today.year, today.month)
    prev_first, prev_last = _month_bounds(prev_y, prev_m)
    ya_first, ya_last = _month_bounds(today.year - 1, today.month)

    # Load singleton settings
    from sqlalchemy import select as sa_select

    settings_row = (
        await db.execute(sa_select(AppSettings).where(AppSettings.id == 1))
    ).scalar_one_or_none()

    sick_type_id = settings_row.personio_sick_leave_type_id if settings_row else None
    prod_dept = settings_row.personio_production_dept if settings_row else None
    skill_key = settings_row.personio_skill_attr_key if settings_row else None

    # --- Overtime Ratio (always configured) ---
    ot_cur = await _overtime_ratio(db, cur_first, cur_last)
    ot_prev = await _overtime_ratio(db, prev_first, prev_last)
    ot_ya = await _overtime_ratio(db, ya_first, ya_last)

    # --- Sick Leave Ratio (needs sick_leave_type_id) ---
    if sick_type_id is not None:
        sl_cur = await _sick_leave_ratio(db, cur_first, cur_last, sick_type_id)
        sl_prev = await _sick_leave_ratio(db, prev_first, prev_last, sick_type_id)
        sl_ya = await _sick_leave_ratio(db, ya_first, ya_last, sick_type_id)
        sick_kpi = HrKpiValue(
            value=sl_cur, previous_period=sl_prev, previous_year=sl_ya
        )
    else:
        sick_kpi = HrKpiValue(value=None, is_configured=False)

    # --- Fluctuation (always configured) ---
    fl_cur = await _fluctuation(db, cur_first, cur_last)
    fl_prev = await _fluctuation(db, prev_first, prev_last)
    fl_ya = await _fluctuation(db, ya_first, ya_last)

    # --- Skill Development (needs skill_attr_key) ---
    if skill_key is not None:
        sd_cur = await _skill_development(db, cur_last, skill_key)
        sd_prev = await _skill_development(db, prev_last, skill_key)
        sd_ya = await _skill_development(db, ya_last, skill_key)
        skill_kpi = HrKpiValue(
            value=sd_cur, previous_period=sd_prev, previous_year=sd_ya
        )
    else:
        skill_kpi = HrKpiValue(value=None, is_configured=False)

    # --- Revenue per Production Employee (needs production_dept) ---
    if prod_dept is not None:
        rpe_cur = await _revenue_per_production_employee(
            db, cur_first, cur_last, prod_dept
        )
        rpe_prev = await _revenue_per_production_employee(
            db, prev_first, prev_last, prod_dept
        )
        rpe_ya = await _revenue_per_production_employee(
            db, ya_first, ya_last, prod_dept
        )
        rpe_kpi = HrKpiValue(
            value=rpe_cur, previous_period=rpe_prev, previous_year=rpe_ya
        )
    else:
        rpe_kpi = HrKpiValue(value=None, is_configured=False)

    return HrKpiResponse(
        overtime_ratio=HrKpiValue(
            value=ot_cur, previous_period=ot_prev, previous_year=ot_ya
        ),
        sick_leave_ratio=sick_kpi,
        fluctuation=HrKpiValue(
            value=fl_cur, previous_period=fl_prev, previous_year=fl_ya
        ),
        skill_development=skill_kpi,
        revenue_per_production_employee=rpe_kpi,
    )
