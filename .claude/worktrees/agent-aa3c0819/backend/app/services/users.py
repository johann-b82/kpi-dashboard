"""User upsert service for OIDC login callback (Phase 28, D-11)."""
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppUser


async def upsert_user(
    db: AsyncSession, sub: str, email: str, name: str | None
) -> None:
    """Atomic UPSERT on app_users keyed by sub (D-11).

    On INSERT: row gets created_at/last_seen_at from server_default=now().
    On CONFLICT (sub): email, name refreshed from latest claims and
    last_seen_at bumped to now(). created_at is preserved.
    """
    stmt = insert(AppUser).values(sub=sub, email=email, name=name)
    stmt = stmt.on_conflict_do_update(
        index_elements=["sub"],
        set_={
            "email": stmt.excluded.email,
            "name": stmt.excluded.name,
            "last_seen_at": func.now(),
        },
    )
    await db.execute(stmt)
    await db.commit()
