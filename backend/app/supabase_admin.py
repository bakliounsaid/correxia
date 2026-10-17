"""Appels Supabase avec la clé service (Storage, Admin Auth). Serveur uniquement."""

import logging
from urllib.parse import quote, unquote, urlparse

import httpx

from app.config import get_settings
from app.http_client import http_client

logger = logging.getLogger("correxia.supabase")

TESTS_BUCKET = "tests"


def _service_headers() -> dict[str, str]:
    key = get_settings().supabase_service_role_key or ""
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _base_url() -> str:
    return (get_settings().supabase_url or "").rstrip("/")


class SupabaseAdminError(Exception):
    """Erreur renvoyée par l'Admin API, avec un message affichable."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _auth_error(res: httpx.Response, fallback: str) -> SupabaseAdminError:
    try:
        data = res.json()
    except ValueError:
        data = {}
    code = str(data.get("error_code") or data.get("code") or "")
    if code == "email_exists" or "already been registered" in str(data.get("msg", "")):
        return SupabaseAdminError("Un compte existe déjà avec cet email.", 409)
    if code in ("weak_password", "validation_failed"):
        return SupabaseAdminError(str(data.get("msg") or "Données de compte invalides."), 400)
    logger.warning("Admin API %s: %s", res.status_code, res.text[:300])
    return SupabaseAdminError(fallback, 502 if res.status_code >= 500 else 400)


async def create_auth_user(email: str, password: str, user_metadata: dict) -> str:
    """Crée un compte confirmé. Le trigger handle_new_user crée users + teachers. Renvoie l'id."""
    try:
        res = await http_client().post(
            f"{_base_url()}/auth/v1/admin/users",
            headers=_service_headers(),
            json={"email": email, "password": password, "email_confirm": True, "user_metadata": user_metadata},
        )
    except httpx.HTTPError as e:
        raise SupabaseAdminError("Service d'authentification injoignable.", 503) from e
    if res.status_code >= 400:
        raise _auth_error(res, "Création du compte impossible.")
    return res.json()["id"]


async def update_auth_user(user_id: str, *, email: str | None = None, password: str | None = None) -> None:
    payload = {k: v for k, v in (("email", email), ("password", password)) if v}
    if not payload:
        return
    try:
        res = await http_client().put(
            f"{_base_url()}/auth/v1/admin/users/{user_id}", headers=_service_headers(), json=payload
        )
    except httpx.HTTPError as e:
        raise SupabaseAdminError("Service d'authentification injoignable.", 503) from e
    if res.status_code >= 400:
        raise _auth_error(res, "Mise à jour du compte impossible.")


async def delete_auth_user(user_id: str) -> None:
    try:
        res = await http_client().delete(f"{_base_url()}/auth/v1/admin/users/{user_id}", headers=_service_headers())
    except httpx.HTTPError:
        logger.exception("Suppression du compte %s impossible", user_id)
        return
    if res.status_code >= 400 and res.status_code != 404:
        logger.warning("Suppression du compte %s refusée (%s): %s", user_id, res.status_code, res.text[:200])


def storage_path_from_url(file_url: str | None, bucket: str = TESTS_BUCKET) -> str | None:
    """Chemin d'un objet du bucket depuis son URL publique ou signée Supabase."""
    if not file_url:
        return None
    try:
        path = urlparse(file_url).path
    except ValueError:
        return None
    for marker in (f"/object/public/{bucket}/", f"/object/sign/{bucket}/"):
        idx = path.find(marker)
        if idx >= 0:
            return unquote(path[idx + len(marker) :])
    return None


async def signed_storage_url(file_url: str, expires_in: int = 3600, bucket: str = TESTS_BUCKET) -> str:
    """
    URL signée d'un fichier du bucket (OpenAI télécharge l'image depuis ses serveurs :
    une URL publique échoue si le bucket devient privé). Renvoie l'URL d'origine en cas d'échec.
    """
    path = storage_path_from_url(file_url, bucket)
    if not path:
        return file_url
    try:
        res = await http_client().post(
            f"{_base_url()}/storage/v1/object/sign/{bucket}/{quote(path)}",
            headers=_service_headers(),
            json={"expiresIn": expires_in},
        )
        signed = res.json().get("signedURL") if res.status_code < 400 else None
    except (httpx.HTTPError, ValueError):
        signed = None
    return f"{_base_url()}/storage/v1{signed}" if signed else file_url


async def remove_storage_objects(paths: list[str], bucket: str = TESTS_BUCKET) -> str | None:
    """Supprime des fichiers du bucket. Renvoie un message d'erreur, ou None si tout est supprimé."""
    if not paths:
        return None
    try:
        res = await http_client().request(
            "DELETE",
            f"{_base_url()}/storage/v1/object/{bucket}",
            headers=_service_headers(),
            json={"prefixes": paths},
        )
    except httpx.HTTPError as e:
        logger.warning("Suppression storage impossible: %s", e)
        return "stockage injoignable"
    if res.status_code >= 400:
        logger.warning("Suppression storage refusée (%s): %s", res.status_code, res.text[:200])
        return f"HTTP {res.status_code}"
    return None
