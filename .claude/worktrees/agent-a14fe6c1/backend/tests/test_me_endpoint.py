from httpx import AsyncClient, ASGITransport

from tests.test_directus_auth import _mint, ADMIN_UUID, VIEWER_UUID, USER_UUID


async def test_me_admin_returns_role_admin():
    from app.main import app
    token = _mint(ADMIN_UUID)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == USER_UUID
    assert body["role"] == "admin"
    assert "@" in body["email"]


async def test_me_viewer_returns_role_viewer():
    from app.main import app
    token = _mint(VIEWER_UUID)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["role"] == "viewer"


async def test_me_no_auth_returns_401():
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/me")
    assert r.status_code == 401


async def test_me_expired_token_returns_401():
    from app.main import app
    token = _mint(ADMIN_UUID, exp_minutes=-5)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
