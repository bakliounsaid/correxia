import asyncio
from typing import Any

import httpx
import stripe
from fastapi import APIRouter

from app.config import Settings, get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "correxia-api"}


def _supabase_key_wrong_type_hint(key: str) -> str | None:
    """PostgREST attend la clé anon JWT (eyJ...), pas les nouvelles clés sb_*."""
    k = key.strip()
    if k.startswith("sb_publishable_"):
        return (
            "Cle sb_publishable_ refusee par PostgREST (401). Dans Supabase : onglet API Keys, "
            "copiez la ligne **anon public (legacy)** — longue chaine JWT commencant par eyJ... "
            "(pas la cle Publishable sb_publishable_)."
        )
    if k.startswith("sb_secret_"):
        return (
            "Cle sb_secret_ refusee ici : ne mettez pas la secret dans SUPABASE_KEY. "
            "Utilisez la cle **anon public (legacy)** JWT (eyJ...) pour ce test et pour le client."
        )
    return None


async def _check_supabase(url: str | None, key: str | None) -> dict[str, Any]:
    if not url or not key:
        return {
            "configured": False,
            "ok": None,
            "detail": "Missing SUPABASE_URL or SUPABASE_KEY in backend/.env",
        }
    wrong = _supabase_key_wrong_type_hint(key)
    base = url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Reference: cle anon sur PostgREST (fiable pour valider URL + cle)
            r = await client.get(
                f"{base}/rest/v1/",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                },
            )
            if r.status_code == 401:
                detail = wrong or (
                    "SUPABASE_KEY refusee (401). Verifiez la cle **anon (legacy)** JWT (eyJ...) "
                    "dans Project Settings > API, meme projet que SUPABASE_URL. "
                    "Pas la cle Publishable sb_publishable_."
                )
                return {
                    "configured": True,
                    "ok": False,
                    "detail": detail,
                }
            if r.status_code in (200, 404, 406):
                return {
                    "configured": True,
                    "ok": True,
                    "detail": "Supabase URL OK and key accepted by PostgREST.",
                }
            return {
                "configured": True,
                "ok": False,
                    "detail": f"PostgREST HTTP {r.status_code}. Check SUPABASE_URL and SUPABASE_KEY.",
            }
    except httpx.ConnectError as e:
        return {
            "configured": True,
            "ok": False,
            "detail": f"Connect error: {e!s}"[:300],
        }
    except Exception as e:
        return {
            "configured": True,
            "ok": False,
            "detail": str(e)[:300],
        }


def _check_stripe_sync(secret_key: str | None) -> dict[str, Any]:
    if not secret_key:
        return {
            "configured": False,
            "ok": None,
            "detail": "Missing STRIPE_KEY in backend/.env",
        }
    try:
        stripe.api_key = secret_key
        stripe.Balance.retrieve()
        return {
            "configured": True,
            "ok": True,
            "detail": "Stripe key OK (test or live mode).",
        }
    except stripe.error.AuthenticationError:
        sk = (secret_key or "").strip()
        if sk.startswith("pk_"):
            detail = (
                "STRIPE_KEY est une cle publique (pk_...). Il faut la cle **secrete** sk_test_... "
                "ou sk_live_ (Developers > API keys dans Stripe)."
            )
        else:
            detail = "Stripe : cle refusee. Verifiez STRIPE_KEY (sk_test_... ou sk_live_, sans espaces)."
        return {
            "configured": True,
            "ok": False,
            "detail": detail,
        }
    except stripe.error.StripeError as e:
        return {
            "configured": True,
            "ok": False,
            "detail": str(e.user_message or e)[:300],
        }
    except Exception as e:
        return {
            "configured": True,
            "ok": False,
            "detail": str(e)[:300],
        }


async def integration_status(settings: Settings) -> dict[str, Any]:
    supabase = await _check_supabase(settings.supabase_url, settings.supabase_key)
    stripe_result = await asyncio.to_thread(
        _check_stripe_sync, settings.stripe_secret_key
    )
    return {
        "supabase": supabase,
        "stripe": stripe_result,
        "summary": {
            "all_ok": (
                supabase.get("ok") is True and stripe_result.get("ok") is True
            ),
        },
    }


@router.get("/health/integrations")
async def health_integrations():
    """
    Vérifie la connectivité Supabase (URL + clé) et Stripe (clé secrète).
    Ne renvoie jamais les secrets, uniquement ok / erreur.
    """
    return await integration_status(get_settings())
