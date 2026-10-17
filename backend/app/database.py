from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()
if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL manquante dans backend/.env "
        "(Supabase → Project Settings → Database → Connection string, mode Session)."
    )
engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    pool_pre_ping=True,
    # Compatible avec le pooler Supabase (pgbouncer) : pas de prepared statements.
    connect_args={"prepare_threshold": None},
)
SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Une session = une transaction par requête.
    Les routes appellent `await db.commit()` une fois toutes les écritures faites :
    si une étape échoue avant, tout est annulé (rollback) — aucune écriture partielle.
    """
    async with SessionLocal() as session:
        try:
            yield session
        except BaseException:
            await session.rollback()
            raise
