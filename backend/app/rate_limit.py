"""
Rate limiting à fenêtre fixe, partagé entre toutes les instances via Postgres
(table public.api_rate_limits, cf. supabase/migrations/*_api_rate_limits.sql).
Repli en mémoire (par instance) si la table est absente ou la base injoignable.
"""

import logging
import random
import time
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, status
from sqlalchemy import text

from app.database import engine
from app.deps import CurrentAuth

logger = logging.getLogger("correxia.rate_limit")

_HIT_SQL = text(
    """
    insert into public.api_rate_limits (bucket_key, window_start, hits)
    values (:key, to_timestamp(:window_start), 1)
    on conflict (bucket_key, window_start)
    do update set hits = public.api_rate_limits.hits + 1
    returning hits
    """
)
_CLEANUP_SQL = text("delete from public.api_rate_limits where window_start < now() - interval '1 day'")

_memory: dict[tuple[str, int], int] = {}
_db_unavailable_logged = False


async def _hit(key: str, window_seconds: int) -> int:
    global _db_unavailable_logged
    window_start = int(time.time() // window_seconds * window_seconds)
    try:
        async with engine.connect() as conn:
            hits = (await conn.execute(_HIT_SQL, {"key": key, "window_start": window_start})).scalar_one()
            if random.random() < 0.01:  # noqa: S311 — échantillonnage du nettoyage, pas de la cryptographie
                await conn.execute(_CLEANUP_SQL)
            await conn.commit()
            return int(hits)
    except Exception:
        if not _db_unavailable_logged:
            logger.warning("Rate limit Postgres indisponible : repli en mémoire.", exc_info=True)
            _db_unavailable_logged = True
        if len(_memory) > 10000:
            _memory.clear()
        mem_key = (key, window_start)
        _memory[mem_key] = _memory.get(mem_key, 0) + 1
        return _memory[mem_key]


def client_ip(request: Request) -> str:
    """
    IP du client vue par le proxy de l'hébergeur (Render), qui l'ajoute en DERNIER dans
    X-Forwarded-For. Les valeurs précédentes sont fournies par le client et falsifiables.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last = forwarded.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else "unknown"


async def _enforce(key: str, limit: int, window_seconds: int) -> None:
    if await _hit(key, window_seconds) > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de requêtes. Patientez un instant puis réessayez.",
            headers={"Retry-After": str(window_seconds)},
        )


def rate_limit_user(bucket: str, limit: int, window_seconds: int = 60) -> Callable[..., Awaitable[None]]:
    """Limite par utilisateur connecté (routes authentifiées)."""

    async def dependency(auth: CurrentAuth) -> None:
        await _enforce(f"{bucket}:user:{auth.id}", limit, window_seconds)

    return dependency


def rate_limit_ip(bucket: str, limit: int, window_seconds: int = 60) -> Callable[..., Awaitable[None]]:
    """Limite par adresse IP (routes publiques)."""

    async def dependency(request: Request) -> None:
        await _enforce(f"{bucket}:ip:{client_ip(request)}", limit, window_seconds)

    return dependency


# Limites par type de route
LIMIT_READ = rate_limit_user("read", 120)
LIMIT_WRITE = rate_limit_user("write", 60)
LIMIT_BILLING = rate_limit_user("billing", 10)
LIMIT_AI = rate_limit_user("ai", 5)
LIMIT_CONTACT = rate_limit_ip("contact", 5, 600)
