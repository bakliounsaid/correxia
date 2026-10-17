"""Outils partagés des tests d'intégration : comptes Supabase de test et accès SQL direct."""

import secrets
from dataclasses import dataclass

import httpx
import pytest
from sqlalchemy import text

from app.config import get_settings
from app.database import engine

S = get_settings()
CONFIGURED = bool(
    S.supabase_url
    and S.supabase_anon_key
    and S.supabase_service_role_key
    and "localhost:5432/test" not in S.database_url
)
INTEGRATION = [
    pytest.mark.anyio,
    pytest.mark.integration,
    pytest.mark.skipif(not CONFIGURED, reason="backend/.env non configuré pour les tests d'intégration"),
]
ADMIN_HEADERS = {
    "apikey": S.supabase_service_role_key or "",
    "Authorization": f"Bearer {S.supabase_service_role_key}",
}
TEST_EMAIL_PREFIX = "pytest-"


@dataclass
class Account:
    user_id: str
    email: str
    password: str
    headers: dict[str, str]


async def sql(query: str, params: dict | None = None):
    async with engine.connect() as conn:
        result = await conn.execute(text(query), params or {})
        await conn.commit()
        return result


def new_email(tag: str) -> str:
    return f"{TEST_EMAIL_PREFIX}{tag}-{secrets.token_hex(4)}@example.com"


async def sign_in(http: httpx.AsyncClient, email: str, password: str) -> dict[str, str]:
    res = await http.post(
        f"{S.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": S.supabase_anon_key},
        json={"email": email, "password": password},
    )
    res.raise_for_status()
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def create_account(http: httpx.AsyncClient, tag: str, metadata: dict) -> Account:
    email, password = new_email(tag), secrets.token_urlsafe(16)
    res = await http.post(
        f"{S.supabase_url}/auth/v1/admin/users",
        headers=ADMIN_HEADERS,
        json={"email": email, "password": password, "email_confirm": True, "user_metadata": metadata},
    )
    res.raise_for_status()
    user_id = res.json()["id"]
    return Account(user_id, email, password, await sign_in(http, email, password))


async def teacher_id_of(user_id: str) -> str | None:
    value = (await sql("select id from teachers where user_id = :u", {"u": user_id})).scalar()
    return str(value) if value else None


async def school_id_of(user_id: str) -> str | None:
    value = (await sql("select id from schools where admin_user_id = :u", {"u": user_id})).scalar()
    return str(value) if value else None


async def delete_account(http: httpx.AsyncClient, user_id: str) -> None:
    """Supprime un compte de test et tout ce qui lui appartient (ordre imposé par les clés étrangères)."""
    teacher_id, school_id = await teacher_id_of(user_id), await school_id_of(user_id)
    if teacher_id:
        t = {"t": teacher_id}
        await sql("delete from subscriptions where teacher_id = :t", t)
        await sql("delete from usage_logs where teacher_id = :t", t)
        await sql("delete from tests where teacher_id = :t", t)
        await sql("delete from students where class_id in (select id from classes where teacher_id = :t)", t)
        await sql("delete from classes where teacher_id = :t", t)
        await sql("delete from class_teachers where teacher_id = :t", t)
        await sql("delete from teachers where id = :t", t)
    if school_id:
        s = {"s": school_id}
        await sql("delete from subscriptions where school_id = :s", s)
        await sql("delete from usage_logs where school_id = :s", s)
        await sql("delete from classes where school_id = :s", s)
        await sql("delete from schools where id = :s", s)
    await sql("delete from users where id = :u", {"u": user_id})
    await sql("delete from api_rate_limits where bucket_key like :k", {"k": f"%{user_id}%"})
    await http.delete(f"{S.supabase_url}/auth/v1/admin/users/{user_id}", headers=ADMIN_HEADERS)


async def delete_accounts_by_email(http: httpx.AsyncClient, emails: list[str]) -> None:
    for email in emails:
        user_id = (await sql("select id from auth.users where email = :e", {"e": email})).scalar()
        if user_id:
            await delete_account(http, str(user_id))
