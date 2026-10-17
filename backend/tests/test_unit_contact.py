"""Tests du formulaire de contact : HubSpot et SMTP simulés, rate limit en mémoire (aucun appel réel)."""

import uuid

import httpx
import pytest

from app import rate_limit
from app.config import get_settings
from app.main import app
from app.services import contact as svc

pytestmark = pytest.mark.anyio

VALID = {
    "name": "Ada Lovelace",
    "email": "Ada@Example.com",
    "phone": "0600000000",
    "role": "Enseignant",
    "subject": "Demande de démo",
    "message": "Bonjour, je voudrais une démo.",
}


def test_split_name():
    assert svc.split_name("  Ada  King Lovelace ") == ("Ada", "King Lovelace")
    assert svc.split_name("Ada") == ("Ada", "")
    assert svc.split_name("   ") == ("", "")


@pytest.mark.parametrize(
    ("subject", "expected"),
    [
        ("Question tarifs", "Discussion Tarifaire"),
        ("Démo", "Démo Produit"),
        ("demo produit", "Démo Produit"),
        ("Support technique", "Audit de Processus"),
        ("Partenariat", "Autres"),
        ("", "Autres"),
    ],
)
def test_normalize_hubspot_subject(subject, expected):
    assert svc.normalize_hubspot_subject(subject) == expected


@pytest.mark.parametrize(
    ("value", "expected"), [("New", "NEW"), ("en cours", "IN_PROGRESS"), ("Connecté", "CONNECTED"), ("??", "NEW")]
)
def test_normalize_lead_status(value, expected):
    assert svc.normalize_lead_status(value) == expected


def test_contact_properties_custom_keys_are_lowercased():
    props = svc.contact_properties(
        get_settings().model_copy(update={"hubspot_role_property": "Fonction", "hubspot_subject_property": " Sujet "}),
        name="Ada Lovelace",
        email="ada@example.com",
        phone="1",
        role="Enseignant",
        subject="tarifs",
        message="m",
    )
    assert props["fonction"] == "Enseignant"
    assert props["sujet"] == "Discussion Tarifaire"
    assert (props["firstname"], props["lastname"]) == ("Ada", "Lovelace")


def test_acknowledgement_email_escapes_user_input():
    msg = svc.acknowledgement_email(
        name="<script>alert(1)</script>",
        email="a@example.com",
        role="Enseignant",
        subject='"><img src=x onerror=alert(1)>',
        message="a & b",
    )
    html = msg.get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert "<img src=x" not in html
    assert "a &amp; b" in html


# ---------------------------------------------------------------- route


@pytest.fixture
def memory_rate_limit(monkeypatch):
    class NoDatabase:
        def connect(self):
            raise ConnectionError("tests unitaires : pas de base")

    monkeypatch.setattr(rate_limit, "engine", NoDatabase())
    monkeypatch.setattr(rate_limit, "_memory", {})


@pytest.fixture
def fake_hubspot(monkeypatch, memory_rate_limit):
    state = {"calls": [], "contact_status": 404, "emails": []}

    async def fake(method, path, token, payload):
        state["calls"].append((method, path, payload))
        if method == "PATCH":
            return httpx.Response(state["contact_status"], json={"id": "c-1"} if state["contact_status"] == 200 else {})
        if path == "contacts":
            return httpx.Response(201, json={"id": "c-2"})
        return httpx.Response(201, json={"id": "n-1"})

    async def fake_send(**fields):
        state["emails"].append(fields)

    monkeypatch.setattr(svc, "_hubspot", fake)
    monkeypatch.setattr("app.routers.contact.send_acknowledgement", fake_send)
    monkeypatch.setattr(get_settings(), "hubspot_access_token", "pat-test")
    return state


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


def _ip() -> dict:
    return {"X-Forwarded-For": f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"}


async def test_contact_creates_hubspot_contact_and_note(client, fake_hubspot):
    res = await client.post("/contact", json=VALID, headers=_ip())
    assert res.status_code == 200 and res.json() == {"ok": True}
    methods = [(m, p.split("?")[0]) for m, p, _ in fake_hubspot["calls"]]
    assert methods == [("PATCH", "contacts/ada%40example.com"), ("POST", "contacts"), ("POST", "notes")]
    note = fake_hubspot["calls"][2][2]
    assert note["associations"][0]["to"]["id"] == "c-2"
    assert fake_hubspot["emails"][0]["email"] == "ada@example.com"


async def test_contact_updates_existing_hubspot_contact(client, fake_hubspot):
    fake_hubspot["contact_status"] = 200
    assert (await client.post("/contact", json=VALID, headers=_ip())).status_code == 200
    assert [m for m, _, _ in fake_hubspot["calls"]] == ["PATCH", "POST"]  # mise à jour + note


@pytest.mark.parametrize(
    "override",
    [{"role": "Hacker"}, {"email": "pas-un-email"}, {"message": ""}, {"name": "   "}, {"message": "x" * 5001}],
)
async def test_contact_rejects_invalid_input(client, fake_hubspot, override):
    res = await client.post("/contact", json={**VALID, **override}, headers=_ip())
    assert res.status_code == 400
    assert fake_hubspot["calls"] == []


async def test_hubspot_failure_hides_details(client, fake_hubspot, monkeypatch):
    async def refuse(method, path, token, payload):
        return httpx.Response(401, text='{"message":"token pat-secret invalide"}')

    monkeypatch.setattr(svc, "_hubspot", refuse)
    res = await client.post("/contact", json=VALID, headers=_ip())
    assert res.status_code == 502
    assert "pat-secret" not in res.text and "contact@correxia.fr" in res.json()["error"]
    assert fake_hubspot["emails"] == []


async def test_contact_is_rate_limited_per_ip(client, fake_hubspot):
    ip = _ip()
    statuses = [(await client.post("/contact", json=VALID, headers=ip)).status_code for _ in range(6)]
    assert statuses == [200] * 5 + [429]
    other_ip = await client.post("/contact", json=VALID, headers=_ip())
    assert other_ip.status_code == 200


async def test_smtp_failure_does_not_fail_request(monkeypatch):
    s = get_settings()
    for key, value in {
        "smtp_host": "smtp.test",
        "smtp_port": 465,
        "smtp_user": "u",
        "smtp_password": "p",
        "smtp_from": "C <c@x>",
    }.items():
        monkeypatch.setattr(s, key, value)

    def boom(*_args):
        raise OSError("SMTP indisponible")

    monkeypatch.setattr(svc, "_send_smtp", boom)
    await svc.send_acknowledgement(name="A", email="a@example.com", role="Autres", subject="s", message="m")


async def test_spoofed_forwarded_for_does_not_bypass_rate_limit(client, fake_hubspot):
    """Changer la première valeur de X-Forwarded-For à chaque requête ne contourne pas la limite."""
    proxy_seen_ip = "203.0.113.7"
    statuses = [
        (
            await client.post("/contact", json=VALID, headers={"X-Forwarded-For": f"1.1.1.{i}, {proxy_seen_ip}"})
        ).status_code
        for i in range(6)
    ]
    assert statuses == [200] * 5 + [429]
