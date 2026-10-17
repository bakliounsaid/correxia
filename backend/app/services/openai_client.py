"""Appel à l'API OpenAI (chat completions, réponse JSON)."""

import json
import logging

import httpx

from app.config import get_settings
from app.http_client import http_client

logger = logging.getLogger("correxia.openai")

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_TIMEOUT_SECONDS = 60.0


class AIError(Exception):
    """Échec d'un appel IA, avec un message affichable à l'enseignant."""


def user_message_for_status(status_code: int) -> str:
    """Message compréhensible par un enseignant pour une erreur HTTP d'OpenAI."""
    if status_code in (401, 403):
        return "Service IA mal configuré (clé API refusée). Contactez l'administrateur."
    if status_code == 429:
        return "Service IA momentanément saturé. Réessayez dans quelques minutes."
    if status_code == 400:
        return "L'IA n'a pas pu lire ce fichier (image illisible, trop lourde ou inaccessible)."
    if status_code >= 500:
        return "Service IA momentanément indisponible. Réessayez dans quelques minutes."
    return f"Erreur du service IA ({status_code})."


async def chat_json(
    *, model: str, messages: list[dict], temperature: float = 0.0, request_timeout: float = DEFAULT_TIMEOUT_SECONDS
) -> dict:
    """Envoie la conversation et renvoie l'objet JSON produit par le modèle ({} si illisible)."""
    api_key = get_settings().openai_api_key
    if not api_key:
        raise AIError("Correction IA non configurée (OPENAI_API_KEY manquante).")
    try:
        res = await http_client().post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "temperature": temperature,
                "response_format": {"type": "json_object"},
                "messages": messages,
            },
            timeout=request_timeout,
        )
    except httpx.TimeoutException as e:
        raise AIError("Le service IA n'a pas répondu à temps.") from e
    except httpx.HTTPError as e:
        raise AIError("Service IA injoignable.") from e

    if res.status_code >= 400:
        try:
            detail = str(res.json().get("error", {}).get("message", ""))[:320]
        except ValueError:
            detail = res.text[:320]
        # Détail technique (peut contenir un fragment de clé) : logs uniquement.
        logger.warning("OpenAI %s: %s", res.status_code, detail)
        raise AIError(user_message_for_status(res.status_code))

    try:
        content = res.json()["choices"][0]["message"]["content"] or "{}"
        parsed = json.loads(content)
    except (ValueError, KeyError, IndexError, TypeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}
