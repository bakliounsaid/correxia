"""Tests unitaires : aucune base de données ni appel réseau."""

import re
import uuid

import httpx
import pytest
from fastapi import HTTPException

from app.config import Settings
from app.main import app
from app.routers import evaluations
from app.supabase_admin import storage_path_from_url

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------- config


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgresql://u:p@h:5432/db", "postgresql+psycopg://u:p@h:5432/db"),
        ("postgres://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgresql+psycopg://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
    ],
)
def test_async_database_url(raw, expected):
    assert Settings(database_url=raw).async_database_url == expected


def test_cors_origin_list_ignores_blanks():
    s = Settings(cors_origins=" http://a.test , ,http://b.test ")
    assert s.cors_origin_list() == ["http://a.test", "http://b.test"]


def test_cors_origin_list_tolerates_trailing_slash_and_quotes():
    """Saisie fréquente sur l'hébergeur : « https://site.app/ » ou entre guillemets. Le navigateur envoie sans « / »."""
    s = Settings(cors_origins="\"https://correxia-vdd9.vercel.app/\", 'http://localhost:3000'")
    assert s.cors_origin_list() == ["https://correxia-vdd9.vercel.app", "http://localhost:3000"]


# ---------------------------------------------------------------- stockage


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://x.supabase.co/storage/v1/object/public/tests/t1/sujet%20A.pdf", "t1/sujet A.pdf"),
        ("https://x.supabase.co/storage/v1/object/sign/tests/t1/c.png?token=abc", "t1/c.png"),
        ("https://x.supabase.co/storage/v1/object/public/autre/t1/c.png", None),
        ("pas une url", None),
        (None, None),
    ],
)
def test_storage_path_from_url(url, expected):
    assert storage_path_from_url(url) == expected


# ---------------------------------------------------------------- helpers évaluations


def test_unique_test_id_format():
    test_id, student_id = uuid.uuid4(), uuid.uuid4()
    value = evaluations._unique_test_id(test_id, student_id)
    assert re.fullmatch(rf"CX-{str(test_id)[:8].upper()}-{str(student_id)[:8].upper()}-[A-Z0-9]{{6}}", value)
    assert value != evaluations._unique_test_id(test_id, student_id)


def test_parse_passages_normalizes_and_skips_empty():
    raw = [
        {"zone": "Ex1", "detail": "illisible", "source": "ocr"},
        {"zone": "", "detail": "rature"},
        {"zone": "Ex3"},
        {"zone": "", "detail": ""},
        "pas un objet",
    ]
    assert evaluations._parse_passages(raw) == [
        {"zone": "Ex1", "detail": "illisible", "source": "ocr"},
        {"zone": "Copie", "detail": "rature"},
        {"zone": "Ex3", "detail": "Ex3"},
    ]
    assert evaluations._parse_passages(None) == []


@pytest.mark.parametrize(
    ("value", "default", "expected"),
    [("7.5", 0, 7.5), (3, 0, 3.0), ("abc", 20, 20), (None, 20, 20), (float("nan"), 0, 0), (float("inf"), 0, 0)],
)
def test_to_number(value, default, expected):
    assert evaluations._to_number(value, default) == expected


def test_target_class_name_prefers_class_name():
    assert evaluations._target_class_name(evaluations.Test(class_name=" TS1 ", level="Terminale")) == "TS1"
    assert evaluations._target_class_name(evaluations.Test(class_name=None, level="Terminale")) == "Terminale"


# ---------------------------------------------------------------- API (sans base)


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_health(client):
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_unknown_route_uses_error_format(client):
    res = await client.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    assert "error" in res.json()


async def test_protected_route_without_token_is_401(client):
    res = await client.get(f"/api/v1/evaluations/{uuid.uuid4()}/copies")
    assert res.status_code == 401
    assert res.json() == {"error": "Non authentifié."}


async def test_invalid_token_is_401(client, monkeypatch):
    async def reject(_token):
        raise HTTPException(401, "Session expirée ou invalide. Reconnectez-vous.")

    monkeypatch.setattr("app.deps.verify_access_token", reject)
    res = await client.get(f"/api/v1/evaluations/{uuid.uuid4()}/copies", headers={"Authorization": "Bearer faux"})
    assert res.status_code == 401
    assert "Session expirée" in res.json()["error"]


async def test_unexpected_error_hides_details():
    @app.get("/api/v1/__test_boom")
    async def boom():
        raise RuntimeError("détail secret")

    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        res = await c.get("/api/v1/__test_boom")
    assert res.status_code == 500
    assert "secret" not in res.text
    assert res.json() == {"error": "Erreur interne du serveur. Réessayez."}


# ---------------------------------------------------------------- rate limiting


async def test_rate_limit_memory_fallback_blocks_after_limit(monkeypatch):
    from app import rate_limit

    class BrokenEngine:
        def connect(self):
            raise ConnectionError("base indisponible")

    monkeypatch.setattr(rate_limit, "engine", BrokenEngine())
    monkeypatch.setattr(rate_limit, "_memory", {})
    key = f"test:{uuid.uuid4()}"
    for _ in range(3):
        await rate_limit._enforce(key, limit=3, window_seconds=60)
    with pytest.raises(HTTPException) as exc:
        await rate_limit._enforce(key, limit=3, window_seconds=60)
    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "60"}


def test_client_ip_ignores_spoofable_forwarded_values():
    from starlette.requests import Request

    from app.rate_limit import client_ip

    # « 6.6.6.6 » est écrit par le client (falsifiable) ; « 10.0.0.1 » est ajouté par le proxy de l'hébergeur.
    request = Request(
        {"type": "http", "headers": [(b"x-forwarded-for", b"6.6.6.6, 10.0.0.1")], "client": ("9.9.9.9", 1)}
    )
    assert client_ip(request) == "10.0.0.1"
    request = Request({"type": "http", "headers": [], "client": ("9.9.9.9", 1)})
    assert client_ip(request) == "9.9.9.9"


async def test_integrations_detail_is_private_outside_debug(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "debug", False)
    res = await client.get("/api/v1/health/integrations")
    assert res.status_code == 401


async def test_unreachable_supabase_is_logged_with_host(monkeypatch, caplog):
    """Une SUPABASE_URL erronée doit laisser une trace exploitable dans les logs (hôte, sans clé)."""
    import httpx

    from app import supabase_auth
    from app.config import get_settings

    class Unreachable:
        async def get(self, *_args, **_kwargs):
            raise httpx.ConnectError("Name or service not known")

    monkeypatch.setattr(get_settings(), "supabase_url", "https://ancien-projet.supabase.co")
    monkeypatch.setattr(get_settings(), "supabase_anon_key", "sb_publishable_secret")
    monkeypatch.setattr(supabase_auth, "http_client", Unreachable)
    with pytest.raises(HTTPException) as exc:
        await supabase_auth.verify_access_token("jeton-inconnu")
    assert exc.value.status_code == 503
    assert "ancien-projet.supabase.co" in caplog.text
    assert "sb_publishable_secret" not in caplog.text


@pytest.mark.parametrize(
    "raw",
    [
        "https://mrflnacostqkqwmhinch.supabase.co",
        ' "https://mrflnacostqkqwmhinch.supabase.co/" ',
        "mrflnacostqkqwmhinch.supabase.co\n",
    ],
)
def test_supabase_url_tolerates_pasted_values(raw):
    assert Settings(supabase_url=raw).supabase_url == "https://mrflnacostqkqwmhinch.supabase.co"


def test_secrets_are_stripped_of_quotes_and_spaces():
    s = Settings(supabase_anon_key=' "sb_publishable_x" ', database_url="'postgresql://u:p@h:5432/db'\n")
    assert (s.supabase_anon_key, s.database_url) == ("sb_publishable_x", "postgresql://u:p@h:5432/db")
