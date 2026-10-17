import asyncio
from typing import Any

import httpx
import stripe
from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.config import Settings, get_settings
from app.database import engine
from app.deps import (
    BearerCredentials,
    DbSession,
    get_auth_user,
    get_current_user,
    get_platform_admin,
)
from app.http_client import http_client

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Sonde de vie (Render) : ne touche à aucune dépendance."""
    return {"status": "ok", "service": "correxia-api"}


async def _check_database() -> dict[str, Any]:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("select 1"))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "detail": type(e).__name__}


async def _check_supabase_auth(s: Settings) -> dict[str, Any]:
    if not s.supabase_url or not s.supabase_anon_key:
        return {"ok": False, "detail": "SUPABASE_URL / SUPABASE_ANON_KEY manquants"}
    try:
        res = await http_client().get(
            f"{s.supabase_url.rstrip('/')}/auth/v1/health", headers={"apikey": s.supabase_anon_key}, timeout=10
        )
    except httpx.HTTPError as e:
        return {"ok": False, "detail": type(e).__name__}
    return {"ok": res.status_code == 200, "detail": f"HTTP {res.status_code}"}


def _check_stripe(secret: str | None) -> dict[str, Any]:
    if not secret:
        return {"ok": False, "detail": "STRIPE_SECRET_KEY manquante"}
    try:
        stripe.Balance.retrieve(api_key=secret)
        return {"ok": True, "detail": "mode test" if secret.startswith("sk_test") else "mode live"}
    except stripe.StripeError as e:
        return {"ok": False, "detail": type(e).__name__}


async def integration_status(s: Settings) -> dict[str, Any]:
    database, auth, stripe_result = await asyncio.gather(
        _check_database(), _check_supabase_auth(s), asyncio.to_thread(_check_stripe, s.stripe_secret_key)
    )
    configured = {
        "supabase_service_role_key": bool(s.supabase_service_role_key),
        "openai_api_key": bool(s.openai_api_key),
        "stripe_webhook_secret": bool(s.stripe_webhook_secret),
        "hubspot_access_token": bool(s.hubspot_access_token),
        "smtp": bool(s.smtp_host and s.smtp_port and s.smtp_user and s.smtp_password and s.smtp_sender),
    }
    checks = {"database": database, "supabase_auth": auth, "stripe": stripe_result}
    return {
        **checks,
        "configured": configured,
        "all_ok": all(c["ok"] for c in checks.values()) and all(configured.values()),
    }


async def _admin_or_debug(
    credentials: BearerCredentials,
    db: DbSession,
) -> None:
    """Détail des intégrations : mode debug (local) ou admin plateforme uniquement."""
    if get_settings().debug:
        return
    user = await get_current_user(await get_auth_user(credentials), db)
    await get_platform_admin(user)


@router.get("/health/integrations", dependencies=[Depends(_admin_or_debug)])
async def health_integrations():
    """Connectivité base / Supabase Auth / Stripe et présence des clés (jamais leur valeur)."""
    return await integration_status(get_settings())
