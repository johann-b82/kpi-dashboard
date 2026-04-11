"""Async test harness for backend/tests/.

Provides:
  - `client`: httpx.AsyncClient bound to the FastAPI ASGI app via ASGITransport,
    wrapped in asgi-lifespan's LifespanManager so startup/shutdown events fire.
  - `reset_settings`: autouse fixture that resets the app_settings singleton row
    to DEFAULT_SETTINGS before each test, guaranteeing isolation.
"""
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest_asyncio.fixture
async def client():
    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest_asyncio.fixture(autouse=True)
async def reset_settings():
    """Reset app_settings singleton to DEFAULT_SETTINGS before each test.

    Guarded by ImportError because AppSettings / DEFAULT_SETTINGS are created in
    Plans 02 and 03 of this phase; before those merge, this fixture is a no-op
    so `pytest --collect-only` still works on a partial tree.
    """
    try:
        from sqlalchemy import update

        from app.database import AsyncSessionLocal
        from app.defaults import DEFAULT_SETTINGS
        from app.models import AppSettings
    except ImportError:
        yield
        return

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(AppSettings)
            .where(AppSettings.id == 1)
            .values(
                logo_data=None,
                logo_mime=None,
                logo_updated_at=None,
                **DEFAULT_SETTINGS,
            )
        )
        await db.commit()
    yield
