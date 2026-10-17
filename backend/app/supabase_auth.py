"""Vérification des jetons Supabase Auth (le frontend envoie `Authorization: Bearer <access_token>`)."""

import hashlib
import time
from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import get_settings
from app.http_client import http_client

# Évite un aller-retour vers Supabase à chaque requête (le jeton reste valide ~1 h).
_CACHE_TTL_SECONDS = 60
_cache: dict[str, tuple[float, "AuthUser"]] = {}


@dataclass(frozen=True)
class AuthUser:
    id: UUID
    email: str | None


def _cache_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def verify_access_token(token: str) -> AuthUser:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase non configuré (SUPABASE_URL / SUPABASE_ANON_KEY).",
        )

    key = _cache_key(token)
    now = time.monotonic()
    cached = _cache.get(key)
    if cached and cached[0] > now:
        return cached[1]

    try:
        res = await http_client().get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service d'authentification injoignable.",
        ) from e

    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée ou invalide. Reconnectez-vous.",
        )

    data = res.json()
    user = AuthUser(id=UUID(data["id"]), email=data.get("email"))
    if len(_cache) > 5000:
        _cache.clear()
    _cache[key] = (now + _CACHE_TTL_SECONDS, user)
    return user
