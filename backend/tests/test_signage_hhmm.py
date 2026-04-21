"""Unit tests for app.services._hhmm helpers and Pydantic Schedule schemas.

Pure-Python tests — no DB required. Covers D-04 helper contracts,
D-05 weekday ordering, and SGN-TIME-01 validation behaviour at the
Pydantic boundary.
"""
from __future__ import annotations

import datetime
import uuid

import pytest
from pydantic import ValidationError

from app.services._hhmm import hhmm_to_time, now_hhmm_in_tz, time_to_hhmm


# --------------------------------------------------------------------------
# hhmm_to_time / time_to_hhmm
# --------------------------------------------------------------------------


def test_hhmm_to_time_examples():
    assert hhmm_to_time(730) == datetime.time(7, 30)
    assert hhmm_to_time(1430) == datetime.time(14, 30)
    assert hhmm_to_time(0) == datetime.time(0, 0)
    assert hhmm_to_time(2359) == datetime.time(23, 59)


def test_time_to_hhmm_examples():
    assert time_to_hhmm(datetime.time(14, 30)) == 1430
    assert time_to_hhmm(datetime.time(0, 0)) == 0
    assert time_to_hhmm(datetime.time(7, 30)) == 730
    assert time_to_hhmm(datetime.time(23, 59)) == 2359


def test_hhmm_to_time_rejects_invalid_minute():
    """1299 is in the numeric range (0..2359) but has minute=99 → ValueError.
    Guards against in-range-but-structurally-invalid HHMM ints (Pitfall 3).
    """
    with pytest.raises(ValueError):
        hhmm_to_time(1299)


def test_hhmm_round_trip():
    """time_to_hhmm(hhmm_to_time(x)) == x for every valid HHMM value."""
    for h in range(24):
        for m in (0, 15, 30, 45, 59):
            packed = h * 100 + m
            assert time_to_hhmm(hhmm_to_time(packed)) == packed


# --------------------------------------------------------------------------
# now_hhmm_in_tz
# --------------------------------------------------------------------------


def test_now_hhmm_in_tz_shape():
    """Returns (weekday, hhmm) with weekday in 0..6 and hhmm in 0..2359."""
    weekday, hhmm = now_hhmm_in_tz("Europe/Berlin")
    assert 0 <= weekday <= 6
    assert 0 <= hhmm <= 2359
    assert isinstance(weekday, int) and isinstance(hhmm, int)


def test_now_hhmm_in_tz_works_for_utc():
    weekday, hhmm = now_hhmm_in_tz("UTC")
    assert 0 <= weekday <= 6
    assert 0 <= hhmm <= 2359


# --------------------------------------------------------------------------
# Model + Pydantic imports
# --------------------------------------------------------------------------


def test_signage_schedule_model_importable():
    from app.models.signage import SignageSchedule

    assert SignageSchedule.__tablename__ == "signage_schedules"


def test_schedule_pydantic_importable():
    from app.schemas.signage import ScheduleCreate, ScheduleRead, ScheduleUpdate

    assert ScheduleCreate is not None
    assert ScheduleRead is not None
    assert ScheduleUpdate is not None


# --------------------------------------------------------------------------
# ScheduleCreate validation
# --------------------------------------------------------------------------


def test_schedule_create_valid():
    from app.schemas.signage import ScheduleCreate

    sc = ScheduleCreate(
        playlist_id=uuid.uuid4(),
        weekday_mask=31,  # Mo-Fr
        start_hhmm=700,
        end_hhmm=1100,
    )
    assert sc.weekday_mask == 31
    assert sc.start_hhmm == 700
    assert sc.end_hhmm == 1100
    assert sc.priority == 0
    assert sc.enabled is True


def test_schedule_create_rejects_weekday_mask_out_of_range():
    from app.schemas.signage import ScheduleCreate

    with pytest.raises(ValidationError):
        ScheduleCreate(
            playlist_id=uuid.uuid4(),
            weekday_mask=128,  # > 127
            start_hhmm=700,
            end_hhmm=1100,
        )


def test_schedule_create_rejects_zero_width_window():
    from app.schemas.signage import ScheduleCreate

    with pytest.raises(ValidationError):
        ScheduleCreate(
            playlist_id=uuid.uuid4(),
            weekday_mask=1,
            start_hhmm=1100,
            end_hhmm=1100,
        )


def test_schedule_create_rejects_midnight_spanning():
    from app.schemas.signage import ScheduleCreate

    with pytest.raises(ValidationError):
        ScheduleCreate(
            playlist_id=uuid.uuid4(),
            weekday_mask=1,
            start_hhmm=2200,
            end_hhmm=200,
        )


def test_schedule_create_rejects_structural_hhmm():
    """1299 passes the numeric bound (ge=0, le=2359) but has minute=99."""
    from app.schemas.signage import ScheduleCreate

    with pytest.raises(ValidationError):
        ScheduleCreate(
            playlist_id=uuid.uuid4(),
            weekday_mask=1,
            start_hhmm=1299,
            end_hhmm=1400,
        )
