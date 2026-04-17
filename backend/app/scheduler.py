"""APScheduler integration for Personio sync AND v1.15 sensor polling.

Decisions (preserved from v1.3 and extended in v1.15):
  D-05 (v1.3): In-process AsyncIOScheduler under FastAPI lifespan, in-memory jobstore.
  D-06 (v1.3): Interval changes take effect immediately via reschedule.
  D-07 (v1.3): manual-only (interval == 0) removes the scheduled job.
  SEN-SCH-01..06 (v1.15): single scheduler, shared SnmpEngine, max_instances=1,
    coalesce=True, misfire_grace_time=30, outer asyncio.wait_for, daily retention
    cleanup at 03:00 UTC, reschedule helper for Phase 40 admin settings endpoint.

PITFALLS addressed:
  C-1: single shared SnmpEngine on app.state.snmp_engine — no per-call instantiation.
  C-4: max_instances=1, coalesce=True, misfire_grace_time=30 + outer wait_for.
  C-7: deployment-time --workers 1 invariant lives in docker-compose.yml comment.
  M-7: daily retention cleanup + per-table autovacuum knobs set in 38-01 migration.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from pysnmp.hlapi.v3arch.asyncio import SnmpEngine
from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.models import AppSettings, SensorPollLog, SensorReading

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
SYNC_JOB_ID = "personio_sync"  # existing — unchanged
SENSOR_POLL_JOB_ID = "sensor_poll"  # NEW (v1.15)
SENSOR_RETENTION_JOB_ID = "sensor_retention_cleanup"  # NEW (v1.15)

# OQ-5 fixed retention; not admin-configurable in v1.15 (SEN-SCH-06 / SEN-FUTURE-01).
SENSOR_RETENTION_DAYS = 90

# Module-level engine reference. Populated in lifespan; read by the scheduled
# poll runner. Not a true public API — routers should use
# request.app.state.snmp_engine, which is set to this same object.
# This trick avoids pickling SnmpEngine as APScheduler kwargs (MemoryJobStore
# pickles by default and SnmpEngine may not pickle cleanly).
_engine: SnmpEngine | None = None


# ---------------------------------------------------------------------------
# Personio sync (existing — unchanged)
# ---------------------------------------------------------------------------

async def _load_sync_interval() -> int:
    """Read personio_sync_interval_h from AppSettings singleton."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AppSettings.personio_sync_interval_h).where(AppSettings.id == 1)
        )
        return result.scalar_one_or_none() or 0


async def _run_scheduled_sync() -> None:
    """Scheduled job entry point — opens its own session (not FastAPI Depends)."""
    from app.services import hr_sync
    async with AsyncSessionLocal() as session:
        try:
            await hr_sync.run_sync(session)
        except Exception:
            pass  # sync meta already updated with error status inside run_sync


# ---------------------------------------------------------------------------
# Sensor polling (v1.15)
# ---------------------------------------------------------------------------

async def _load_sensor_interval() -> int:
    """Read AppSettings.sensor_poll_interval_s. Default 60 per schema; 0 disables."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AppSettings.sensor_poll_interval_s).where(AppSettings.id == 1)
        )
        value = result.scalar_one_or_none()
    # Row exists with default 60 by migration; None only on a totally unseeded DB.
    return int(value) if value is not None else 60


async def _run_scheduled_sensor_poll() -> None:
    """APScheduler entry point — opens own session, uses module-level engine.

    PITFALLS C-4: outer asyncio.wait_for with timeout = min(45, interval-5).
    Never raises — any exception is swallowed with a log.exception so the
    scheduler keeps ticking on the next interval.
    """
    from app.services import snmp_poller
    if _engine is None:
        log.warning("sensor_poll skipped — SnmpEngine not initialized on app.state")
        return
    interval_s = await _load_sensor_interval()
    inner_timeout = max(5, min(45, interval_s - 5))
    async with AsyncSessionLocal() as session:
        try:
            await asyncio.wait_for(
                snmp_poller.poll_all(session, _engine, manual=False),
                timeout=inner_timeout,
            )
        except asyncio.TimeoutError:
            log.warning("sensor_poll exceeded %ss timeout", inner_timeout)
        except Exception:
            log.exception("sensor_poll runner failed")


async def _run_sensor_retention_cleanup() -> None:
    """Daily delete of sensor_readings + sensor_poll_log older than 90 days.

    Fixed retention per OQ-5 / SEN-SCH-06. Not admin-configurable in v1.15.
    Runs at 03:00 UTC via CronTrigger (low-traffic window, parallels the
    nightly pg_dump sidecar).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=SENSOR_RETENTION_DAYS)
    async with AsyncSessionLocal() as session:
        try:
            readings_del = await session.execute(
                delete(SensorReading).where(SensorReading.recorded_at < cutoff)
            )
            poll_log_del = await session.execute(
                delete(SensorPollLog).where(SensorPollLog.attempted_at < cutoff)
            )
            await session.commit()
            log.info(
                "sensor_retention_cleanup: deleted readings=%d poll_log=%d cutoff=%s",
                readings_del.rowcount,
                poll_log_del.rowcount,
                cutoff.isoformat(),
            )
        except Exception:
            log.exception("sensor_retention_cleanup failed")
            await session.rollback()


def reschedule_sensor_poll(new_interval_s: int) -> None:
    """Phase 40 admin-settings hook — re-pins sensor_poll to a new interval.

    Contract (SEN-SCH-04):
      - new_interval_s > 0 and job exists → reschedule_job(SENSOR_POLL_JOB_ID, ...).
      - new_interval_s > 0 and job missing → add_job with full guardrail kwargs.
      - new_interval_s <= 0 → remove the job entirely (matches Personio D-07:
        manual-only means no scheduled job, not a paused one).

    Logs old interval → new interval → computed next_run_time. All failures are
    caught and logged; the helper never raises so a broken PUT /api/settings
    request path doesn't leak scheduler internals to the admin UI.
    """
    try:
        existing = scheduler.get_job(SENSOR_POLL_JOB_ID)
        old_interval = (
            existing.trigger.interval.total_seconds() if existing else None
        )
        if new_interval_s <= 0:
            if existing is not None:
                scheduler.remove_job(SENSOR_POLL_JOB_ID)
                log.info(
                    "sensor_poll removed (old_interval=%s, new=0/disabled)",
                    old_interval,
                )
            return
        if existing is None:
            scheduler.add_job(
                _run_scheduled_sensor_poll,
                trigger="interval",
                seconds=new_interval_s,
                id=SENSOR_POLL_JOB_ID,
                replace_existing=True,
                max_instances=1,
                coalesce=True,
                misfire_grace_time=30,
            )
        else:
            scheduler.reschedule_job(
                SENSOR_POLL_JOB_ID,
                trigger="interval",
                seconds=new_interval_s,
            )
        job = scheduler.get_job(SENSOR_POLL_JOB_ID)
        log.info(
            "sensor_poll rescheduled: old=%ss new=%ss next_run=%s",
            old_interval,
            new_interval_s,
            job.next_run_time.isoformat() if job and job.next_run_time else None,
        )
    except Exception:
        log.exception(
            "reschedule_sensor_poll failed (new_interval_s=%s)", new_interval_s
        )


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — starts/stops APScheduler + populates shared SnmpEngine."""
    global _engine
    app.state.scheduler = scheduler

    # v1.15: single shared SnmpEngine (PITFALLS C-1 / SEN-BE-03). Populated
    # before scheduler.start() so both scheduler jobs and HTTP routes read
    # the same engine instance.
    _engine = SnmpEngine()
    app.state.snmp_engine = _engine

    # --- Personio sync (existing) ---
    interval_h = await _load_sync_interval()
    if interval_h > 0:
        scheduler.add_job(
            _run_scheduled_sync,
            trigger="interval",
            hours=interval_h,
            id=SYNC_JOB_ID,
            replace_existing=True,
            max_instances=1,
        )

    # --- Sensor poll (v1.15) ---
    sensor_interval_s = await _load_sensor_interval()
    if sensor_interval_s > 0:
        scheduler.add_job(
            _run_scheduled_sensor_poll,
            trigger="interval",
            seconds=sensor_interval_s,
            id=SENSOR_POLL_JOB_ID,
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=30,
        )

    # --- Sensor retention cleanup (daily at 03:00 UTC — v1.15) ---
    scheduler.add_job(
        _run_sensor_retention_cleanup,
        trigger=CronTrigger(hour=3, minute=0, timezone=timezone.utc),
        id=SENSOR_RETENTION_JOB_ID,
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,  # daily job — 5min grace is fine
    )

    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown()
        _engine = None
        app.state.snmp_engine = None
