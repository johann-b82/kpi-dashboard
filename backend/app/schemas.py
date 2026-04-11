from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ValidationErrorDetail(BaseModel):
    row: int
    column: str
    message: str


class UploadResponse(BaseModel):
    id: int
    filename: str
    row_count: int
    error_count: int
    status: str
    errors: list[ValidationErrorDetail]


class UploadBatchSummary(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    row_count: int
    error_count: int
    status: str

    model_config = {"from_attributes": True}


class KpiSummary(BaseModel):
    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int


class ChartPoint(BaseModel):
    date: str  # ISO date string "YYYY-MM-DD" truncated by granularity
    revenue: Decimal


class LatestUploadResponse(BaseModel):
    uploaded_at: datetime | None  # None when no uploads exist
