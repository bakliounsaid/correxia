"""Client HTTP partagé (pool de connexions), lié à la boucle d'événements courante."""

import asyncio

import httpx

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None


def http_client() -> httpx.AsyncClient:
    """Réutilise le même client tant que la boucle ne change pas (une boucle fermée rend ses connexions inutilisables)."""
    global _client, _client_loop
    loop = asyncio.get_running_loop()
    if _client is None or _client.is_closed or _client_loop is not loop:
        _client = httpx.AsyncClient(timeout=20.0)
        _client_loop = loop
    return _client


async def close_http_client() -> None:
    """Ferme les connexions ouvertes (arrêt de l'application)."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
