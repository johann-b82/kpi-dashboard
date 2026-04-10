from datetime import datetime

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
