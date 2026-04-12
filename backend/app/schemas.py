import re
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field


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


class KpiSummaryComparison(BaseModel):
    """Sibling shape for previous_period / previous_year in KpiSummary.

    Separated from KpiSummary so nested comparisons cannot themselves carry
    further nested comparisons. Null when the caller did not request the
    comparison or when the prior window had zero matching rows (DELTA-05).
    """

    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int


class KpiSummary(BaseModel):
    total_revenue: Decimal
    avg_order_value: Decimal
    total_orders: int
    previous_period: KpiSummaryComparison | None = None
    previous_year: KpiSummaryComparison | None = None


class ChartPoint(BaseModel):
    date: str  # ISO date string "YYYY-MM-DD" (bucket-truncated by granularity)
    # `revenue` is None only in the `previous` series of ChartResponse for
    # missing trailing buckets (CHART-03 null gap). The `current` series
    # always carries concrete Decimal revenues.
    revenue: Decimal | None = None


class ChartResponse(BaseModel):
    """Wrapped chart response (Phase 8 breaking change vs. bare list[ChartPoint]).

    `current` is always a concrete bucket list (possibly empty).
    `previous` is null unless the caller requested a comparison via
    ``comparison=previous_period|previous_year`` with ``prev_start`` +
    ``prev_end`` present. Buckets in `previous` are positionally aligned to
    `current` — their ``date`` strings are rewritten to the current X-axis
    dates so Recharts can share a single date domain across both series.
    Missing trailing prior buckets are emitted as ``revenue=None`` (CHART-03).
    """

    current: list[ChartPoint]
    previous: list[ChartPoint] | None = None


class LatestUploadResponse(BaseModel):
    uploaded_at: datetime | None  # None when no uploads exist


# --------------------------------------------------------------------------
# Phase 4 — Settings schemas (BRAND-09 strict color validation)
# --------------------------------------------------------------------------
# Per D-10: matches oklch(L C H) where
#   L is 0..1 decimal OR 0..100 percent
#   C is numeric (0..0.5-ish in practice)
#   H is numeric with optional 'deg' suffix
# Alpha (oklch(L C H / alpha)) is rejected — frontend culori emits plain form.
_OKLCH_RE = re.compile(
    r"^oklch\(\s*"
    r"(?:0|1|0?\.\d+|100%|\d{1,2}(?:\.\d+)?%?)"      # L
    r"\s+"
    r"(?:\d+(?:\.\d+)?)"                              # C
    r"\s+"
    r"(?:-?\d+(?:\.\d+)?)(?:deg)?"                    # H
    r"\s*\)$"
)
# Per D-10: full CSS-injection blacklist.
_FORBIDDEN_CHARS: frozenset[str] = frozenset(";{}\"'`\\<>")
_FORBIDDEN_TOKENS: tuple[str, ...] = ("url(", "expression(", "/*", "*/")


def _validate_oklch(value: str) -> str:
    """Strict oklch validator. Belt-and-braces: blacklist runs BEFORE regex."""
    if not isinstance(value, str):
        raise ValueError("color must be a string")
    if any(ch in _FORBIDDEN_CHARS for ch in value):
        raise ValueError("color contains forbidden character")
    lowered = value.lower()
    if any(tok in lowered for tok in _FORBIDDEN_TOKENS):
        raise ValueError("color contains forbidden token")
    if not _OKLCH_RE.match(value):
        raise ValueError("color must be a valid oklch(L C H) string")
    return value


OklchColor = Annotated[str, AfterValidator(_validate_oklch)]


class SettingsUpdate(BaseModel):
    """Request body for PUT /api/settings. Does NOT include logo bytes (D-05)."""

    color_primary: OklchColor
    color_accent: OklchColor
    color_background: OklchColor
    color_foreground: OklchColor
    color_muted: OklchColor
    color_destructive: OklchColor
    app_name: Annotated[str, Field(min_length=1, max_length=100)]
    default_language: Literal["DE", "EN"]
    # Personio credentials — Optional; None means "don't change existing value" (D-03)
    personio_client_id: str | None = None
    personio_client_secret: str | None = None


class SettingsRead(BaseModel):
    """Response body for GET/PUT /api/settings. Includes logo_url (D-03)."""

    color_primary: str
    color_accent: str
    color_background: str
    color_foreground: str
    color_muted: str
    color_destructive: str
    app_name: str
    default_language: Literal["DE", "EN"]
    logo_url: str | None
    logo_updated_at: datetime | None
    # Personio write-only — only expose boolean, never raw credentials (D-03, PERS-01)
    personio_has_credentials: bool = False

    model_config = {"from_attributes": True}
