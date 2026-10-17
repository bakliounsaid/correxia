"""Vérification des jetons Supabase Auth (le frontend envoie `Authorization: Bearer <access_token>`)."""

import hashlib
import logging
import time
from dataclasses import dataclass
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.config import get_settings
from app.http_client import http_client

logger = logging.getLogger("correxia.auth")

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
        # Hôte et type d'erreur dans les logs (jamais de clé) : SUPABASE_URL erronée, DNS, réseau…
        logger.error(
            "Supabase Auth injoignable (%s) : %s %s", urlparse(settings.supabase_url).netloc, type(e).__name__, e
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service d'authentification injoignable.",
        ) from e

    if res.status_code != 200:
        if res.status_code not in (401, 403):
            logger.warning("Supabase Auth a répondu %s : %s", res.status_code, res.text[:200])
        elif "api key" in res.text.lower():
            # Clé publique refusée : erreur de configuration, pas une session expirée.
            logger.error("SUPABASE_ANON_KEY refusée par Supabase : %s", res.text[:200])
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
