from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import BYTEA, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "success" | "failed" | "partial"

    records: Mapped[list["SalesRecord"]] = relationship(
        "SalesRecord",
        back_populates="batch",
        cascade="all, delete-orphan",
    )


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_batch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("upload_batches.id", ondelete="CASCADE"),
        nullable=False,
    )

    # --- Business key ---
    order_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    # --- String columns ---
    erp_status_flag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    order_subtype: Mapped[str | None] = mapped_column(String(50), nullable=True)
    complexity_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    vv_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    business_area: Mapped[str | None] = mapped_column(Integer, nullable=True)
    project_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    delivery_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manual_lock: Mapped[str | None] = mapped_column(String(10), nullable=True)
    responsible_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    free_field_1: Mapped[str | None] = mapped_column(String(10), nullable=True)
    free_field_2: Mapped[str | None] = mapped_column(String(10), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manual_status: Mapped[str | None] = mapped_column(Integer, nullable=True)
    customer_lock: Mapped[str | None] = mapped_column(Integer, nullable=True)
    material_flag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    end_customer_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_processor_1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    internal_processor_2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approval_comment_1: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_code: Mapped[str | None] = mapped_column(Integer, nullable=True)
    technical_check: Mapped[str | None] = mapped_column(String(10), nullable=True)
    purchase_check: Mapped[str | None] = mapped_column(String(10), nullable=True)
    approval_comment_2: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Date columns (per D-10: nullable, DD.MM.YYYY) ---
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    requested_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    arrival_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Decimal columns (per D-04: NUMERIC exact, nullable) ---
    remaining_value: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    total_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    batch: Mapped["UploadBatch"] = relationship(
        "UploadBatch",
        back_populates="records",
    )


class AppSettings(Base):
    """Singleton settings row — exactly one row with id=1, enforced by CHECK constraint.

    Per D-01 / D-02: logo bytes live on the same row (no separate app_logos table).
    """
    __tablename__ = "app_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_app_settings_singleton"),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=False
    )

    # Colors — oklch strings, validated at the Pydantic layer (see schemas.py)
    color_primary: Mapped[str] = mapped_column(String(64), nullable=False)
    color_accent: Mapped[str] = mapped_column(String(64), nullable=False)
    color_background: Mapped[str] = mapped_column(String(64), nullable=False)
    color_foreground: Mapped[str] = mapped_column(String(64), nullable=False)
    color_muted: Mapped[str] = mapped_column(String(64), nullable=False)
    color_destructive: Mapped[str] = mapped_column(String(64), nullable=False)

    # App identity
    app_name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_language: Mapped[str] = mapped_column(
        String(2), nullable=False
    )  # "DE" | "EN"

    # Logo — all three are nullable together (no logo = fallback to app_name text)
    logo_data: Mapped[bytes | None] = mapped_column(BYTEA, nullable=True)
    logo_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
    logo_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Personio credentials — Fernet-encrypted BYTEA (D-01, D-04)
    personio_client_id_enc: Mapped[bytes | None] = mapped_column(BYTEA, nullable=True)
    personio_client_secret_enc: Mapped[bytes | None] = mapped_column(BYTEA, nullable=True)

    # Sync interval for APScheduler (Phase 13) — default 1 hour
    personio_sync_interval_h: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Personio KPI configuration columns (Phase 13 Plan 01)
    personio_sick_leave_type_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    personio_production_dept: Mapped[str | None] = mapped_column(String(255), nullable=True)
    personio_skill_attr_key: Mapped[str | None] = mapped_column(String(255), nullable=True)


class PersonioEmployee(Base):
    __tablename__ = "personio_employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    termination_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weekly_working_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    attendances: Mapped[list["PersonioAttendance"]] = relationship(
        "PersonioAttendance",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    absences: Mapped[list["PersonioAbsence"]] = relationship(
        "PersonioAbsence",
        back_populates="employee",
        cascade="all, delete-orphan",
    )


class PersonioAttendance(Base):
    __tablename__ = "personio_attendance"
    __table_args__ = (
        Index("ix_personio_attendance_employee_date", "employee_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personio_employees.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_holiday: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    employee: Mapped["PersonioEmployee"] = relationship(
        "PersonioEmployee",
        back_populates="attendances",
    )


class PersonioAbsence(Base):
    __tablename__ = "personio_absences"
    __table_args__ = (
        Index(
            "ix_personio_absences_employee_start_type",
            "employee_id",
            "start_date",
            "absence_type_id",
        ),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("personio_employees.id"), nullable=False
    )
    absence_type_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    time_unit: Mapped[str] = mapped_column(String(10), nullable=False)
    hours: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    employee: Mapped["PersonioEmployee"] = relationship(
        "PersonioEmployee",
        back_populates="absences",
    )


class PersonioSyncMeta(Base):
    __tablename__ = "personio_sync_meta"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_personio_sync_meta_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_sync_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    employees_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attendance_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    absences_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
