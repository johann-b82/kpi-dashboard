"""Personio sync orchestrator — fetches data from Personio API and upserts into PostgreSQL.

Decisions:
  D-01: Manual sync is blocking — run_sync() awaits all fetches and upserts.
  D-03: Upsert by Personio ID via INSERT ... ON CONFLICT DO UPDATE.
  D-04: Sync results persisted to personio_sync_meta singleton.
"""
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AppSettings,
    PersonioAbsence,
    PersonioAttendance,
    PersonioEmployee,
    PersonioSyncMeta,
)
from app.schemas import SyncResult
from app.security.fernet import decrypt_credential
from app.services.personio_client import PersonioAPIError, PersonioClient


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def run_sync(session: AsyncSession) -> SyncResult:
    """Fetch all Personio data and upsert into PostgreSQL.

    Executes fetches sequentially (not asyncio.gather) to avoid rate-limit
    bursts and to keep FK ordering safe: employees must be upserted before
    attendances and absences.

    Raises:
        PersonioAPIError: On any Personio API failure (after updating sync meta).
        ValueError: If Personio credentials are not configured.
    """
    settings = await _get_settings(session)

    if not settings.personio_client_id_enc or not settings.personio_client_secret_enc:
        raise ValueError("Personio credentials not configured — set them in Settings first")

    client_id = decrypt_credential(settings.personio_client_id_enc)
    client_secret = decrypt_credential(settings.personio_client_secret_enc)

    client = PersonioClient(client_id=client_id, client_secret=client_secret)
    emp_count = att_count = abs_count = 0

    try:
        # Sequential fetches — employees first for FK ordering
        raw_employees = await client.fetch_employees()
        raw_attendances = await client.fetch_attendances()
        raw_absences = await client.fetch_absences()

        # Normalize
        employees = [_normalize_employee(r) for r in raw_employees]
        attendances = [_normalize_attendance(r) for r in raw_attendances]
        absences = [_normalize_absence(r) for r in raw_absences]

        # Upsert in FK order: employees -> attendances -> absences
        emp_count = await _upsert(session, PersonioEmployee, employees)
        att_count = await _upsert(session, PersonioAttendance, attendances)
        abs_count = await _upsert(session, PersonioAbsence, absences)

        await _update_sync_meta(session, emp_count, att_count, abs_count, "ok")

    except PersonioAPIError as exc:
        await _update_sync_meta(session, emp_count, att_count, abs_count, "error", str(exc))
        raise

    finally:
        await client.close()

    return SyncResult(
        employees_synced=emp_count,
        attendance_synced=att_count,
        absences_synced=abs_count,
        status="ok",
    )


# ---------------------------------------------------------------------------
# Normalizers — map nested Personio attributes.field_name.value to flat dicts
# ---------------------------------------------------------------------------


def _normalize_employee(raw: dict) -> dict:
    """Extract flat fields from nested Personio employee response."""
    attrs = raw.get("attributes", {})
    return {
        "id": raw["id"],
        "first_name": attrs.get("first_name", {}).get("value"),
        "last_name": attrs.get("last_name", {}).get("value"),
        "status": attrs.get("status", {}).get("value"),
        "department": attrs.get("department", {}).get("value"),
        "position": attrs.get("position", {}).get("value"),
        "hire_date": attrs.get("hire_date", {}).get("value"),
        "termination_date": attrs.get("termination_date", {}).get("value"),
        "weekly_working_hours": attrs.get("weekly_working_hours", {}).get("value"),
        "synced_at": datetime.now(timezone.utc),
        "raw_json": raw,
    }


def _normalize_attendance(raw: dict) -> dict:
    """Extract flat fields from nested Personio attendance response."""
    attrs = raw.get("attributes", {})
    # employee reference can be a nested dict or a direct id field
    employee_val = attrs.get("employee", {}).get("value")
    if isinstance(employee_val, dict):
        employee_id = employee_val.get("id")
    else:
        employee_id = attrs.get("employee_id", {}).get("value")
    return {
        "id": raw["id"],
        "employee_id": employee_id,
        "date": attrs.get("date", {}).get("value"),
        "start_time": attrs.get("start_time", {}).get("value"),
        "end_time": attrs.get("end_time", {}).get("value"),
        "break_minutes": attrs.get("break", {}).get("value", 0),
        "is_holiday": attrs.get("is_holiday", {}).get("value", False),
        "synced_at": datetime.now(timezone.utc),
        "raw_json": raw,
    }


def _normalize_absence(raw: dict) -> dict:
    """Extract flat fields from nested Personio absence response.

    Maps to PersonioAbsence model columns: id, employee_id, absence_type_id,
    start_date, end_date, time_unit, hours, synced_at, raw_json.
    """
    attrs = raw.get("attributes", {})
    # employee_id can be a direct int or a nested dict reference
    employee_id_val = attrs.get("employee_id", {}).get("value")
    if not isinstance(employee_id_val, int):
        employee_ref = attrs.get("employee", {}).get("value")
        employee_id_val = employee_ref.get("id") if isinstance(employee_ref, dict) else None
    # absence_type_id from type.value.id or type_id.value
    type_val = attrs.get("type", {}).get("value")
    if isinstance(type_val, dict):
        absence_type_id = type_val.get("id")
    else:
        absence_type_id = attrs.get("type_id", {}).get("value")
    return {
        "id": raw["id"],
        "employee_id": employee_id_val,
        "absence_type_id": absence_type_id,
        "start_date": attrs.get("start_date", {}).get("value"),
        "end_date": attrs.get("end_date", {}).get("value"),
        "time_unit": attrs.get("time_unit", {}).get("value") or "days",
        "hours": attrs.get("hours", {}).get("value"),
        "synced_at": datetime.now(timezone.utc),
        "raw_json": raw,
    }


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


async def _upsert(session: AsyncSession, model, rows: list[dict]) -> int:
    """Generic INSERT ... ON CONFLICT DO UPDATE upsert for Personio models.

    Returns the number of rows affected (inserted + updated).
    """
    if not rows:
        return 0
    stmt = pg_insert(model).values(rows)
    # All columns except the PK "id"
    update_cols = {
        col.name: stmt.excluded[col.name]
        for col in model.__table__.columns
        if col.name != "id"
    }
    upsert_stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_=update_cols,
    )
    result = await session.execute(upsert_stmt)
    await session.commit()
    return result.rowcount


async def _update_sync_meta(
    session: AsyncSession,
    emp_count: int,
    att_count: int,
    abs_count: int,
    status: str,
    error: str | None = None,
) -> None:
    """Update the personio_sync_meta singleton row (id=1)."""
    stmt = (
        update(PersonioSyncMeta)
        .where(PersonioSyncMeta.id == 1)
        .values(
            last_synced_at=datetime.now(timezone.utc),
            last_sync_status=status,
            last_sync_error=error,
            employees_synced=emp_count,
            attendance_synced=att_count,
            absences_synced=abs_count,
        )
    )
    await session.execute(stmt)
    await session.commit()


async def _get_settings(session: AsyncSession) -> AppSettings:
    """Fetch the AppSettings singleton row (id=1)."""
    result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
    return result.scalar_one()
