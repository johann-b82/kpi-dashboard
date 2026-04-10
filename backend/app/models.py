from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "success" | "failed" | "partial"


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_batch_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # Placeholder columns per D-01 -- replaced in Phase 2 migration after sample file review
    col_a: Mapped[str | None] = mapped_column(String(255), nullable=True)
    col_b: Mapped[str | None] = mapped_column(String(255), nullable=True)
    col_c: Mapped[str | None] = mapped_column(String(255), nullable=True)
