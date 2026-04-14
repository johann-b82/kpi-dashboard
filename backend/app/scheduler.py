"""APScheduler integration for periodic Personio data sync.

Decisions:
  D-05: In-process AsyncIOScheduler under FastAPI lifespan, in-memory job store.
  D-06: Interval changes take effect immediately via reschedule.
  D-07: manual-only (interval_h == 0) removes the scheduled job.
"""
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import AppSettings
from app.services.users import upsert_user

logger = logging.getLogger("app.auth")

scheduler = AsyncIOScheduler()
SYNC_JOB_ID = "personio_sync"


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan — starts/stops APScheduler."""
    if settings.DISABLE_AUTH:
        # D-15: loud, both to app logger AND stderr so `docker compose logs api | head` catches it.
        logger.warning(
            "⚠ DISABLE_AUTH=true — authentication is bypassed. DO NOT use in production."
        )
        # D-14: upsert synthetic dev user once at startup so app_users reflects the bypass.
        async with AsyncSessionLocal() as session:
            await upsert_user(
                session, sub="dev-user", email="dev@localhost", name="Dev User"
            )
    app.state.scheduler = scheduler
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
    scheduler.start()
    yield
    scheduler.shutdown()
