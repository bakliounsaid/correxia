"""
Tests d'intégration des routes /school/teachers (admin d'établissement) contre la vraie base.
Crée deux établissements et un enseignant indépendant de test, puis supprime tout.
"""

import secrets

import httpx
import pytest

from app.main import app
from app.routers import schools
from tests.integration_support import (
    INTEGRATION,
    create_account,
    delete_account,
    delete_accounts_by_email,
    new_email,
    school_id_of,
    sign_in,
    sql,
)

pytestmark = INTEGRATION

created_emails: list[str] = []


def _school_admin_meta(name: str) -> dict:
    return {"account_type": "school_admin", "school_name": name, "first_name": "Admin", "last_name": name}


@pytest.fixture(scope="module")
async def accounts():
    async with httpx.AsyncClient(timeout=30) as http:
        school_a = await create_account(http, "school-a", _school_admin_meta("Lycée Pytest A"))
        school_b = await create_account(http, "school-b", _school_admin_meta("Lycée Pytest B"))
        independent = await create_account(http, "indep", {"account_type": "teacher_independent"})
        try:
            yield school_a, school_b, independent
        finally:
            await delete_accounts_by_email(http, created_emails)
            for account in (school_a, school_b, independent):
                await delete_account(http, account.user_id)


@pytest.fixture
async def api():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


def _teacher_body(**overrides) -> dict:
    email = new_email("prof")
    created_emails.append(email)
    body = {
        "firstName": "Marie",
        "lastName": "Curie",
        "email": email,
        "password": secrets.token_urlsafe(12),
        "subject": "physics",
        "classNames": ["TS1", "TS2", "TS1 "],
    }
    body.update(overrides)
    return body


async def _create(api, admin, **overrides) -> tuple[dict, dict]:
    body = _teacher_body(**overrides)
    res = await api.post("/school/teachers", headers=admin.headers, json=body)
    assert res.status_code == 200, res.text
    return body, res.json()["teacher"]


# ---------------------------------------------------------------- création


async def test_trigger_creates_school_for_school_admin(accounts):
    school_a, _, _ = accounts
    row = (
        await sql(
            "select s.name, s.subscription_plan, u.role from schools s join users u on u.id = s.admin_user_id "
            "where s.admin_user_id = :u",
            {"u": school_a.user_id},
        )
    ).first()
    assert tuple(row) == ("Lycée Pytest A", "evaluation", "school_admin")


async def test_create_teacher(api, accounts):
    school_a, _, _ = accounts
    body, teacher = await _create(api, school_a)
    assert teacher["full_name"] == "Marie Curie" and teacher["class_count"] == 2

    row = (
        await sql(
            "select t.school_id, t.is_independent, t.subject, u.role, u.full_name "
            "from teachers t join users u on u.id = t.user_id where t.id = :t",
            {"t": teacher["id"]},
        )
    ).first()
    assert (str(row[0]), row[1], row[2], row[3], row[4]) == (
        await school_id_of(school_a.user_id),
        False,
        "physics",
        "teacher",
        "Marie Curie",
    )
    classes = {
        r[0]
        for r in await sql(
            "select c.name from class_teachers ct join classes c on c.id = ct.class_id where ct.teacher_id = :t",
            {"t": teacher["id"]},
        )
    }
    assert classes == {"TS1", "TS2"}

    async with httpx.AsyncClient(timeout=30) as http:
        assert await sign_in(http, body["email"], body["password"]), "le nouvel enseignant doit pouvoir se connecter"


async def test_create_reuses_existing_school_classes(api, accounts):
    school_a, _, _ = accounts
    await _create(api, school_a, classNames=["1ère A"])
    await _create(api, school_a, classNames=["1ère A"])
    count = (
        await sql(
            "select count(*) from classes where school_id = :s and name = '1ère A'",
            {"s": await school_id_of(school_a.user_id)},
        )
    ).scalar()
    assert count == 1


async def test_create_with_existing_email_is_409(api, accounts):
    school_a, _, independent = accounts
    res = await api.post("/school/teachers", headers=school_a.headers, json=_teacher_body(email=independent.email))
    assert res.status_code == 409
    assert res.json()["error"] == "Un compte existe déjà avec cet email."


async def test_create_without_class_is_400(api, accounts):
    school_a, _, _ = accounts
    res = await api.post("/school/teachers", headers=school_a.headers, json=_teacher_body(classNames=[" "]))
    assert res.status_code == 400
    assert "au moins une classe" in res.json()["error"]


async def test_only_school_admin_can_manage(api, accounts):
    _, _, independent = accounts
    res = await api.post("/school/teachers", headers=independent.headers, json=_teacher_body())
    assert res.status_code == 403


async def test_create_rolls_back_and_removes_account_on_db_failure(api, accounts, monkeypatch):
    """Si la transaction échoue après la création du compte Auth, le compte est supprimé (compensation)."""
    school_a, _, _ = accounts

    async def broken(*_args, **_kwargs):
        raise RuntimeError("panne base (test)")

    monkeypatch.setattr(schools, "_ensure_school_classes", broken)
    body = _teacher_body()
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
        res = await c.post("/school/teachers", headers=school_a.headers, json=body)
    assert res.status_code == 500
    auth_users = (await sql("select count(*) from auth.users where email = :e", {"e": body["email"]})).scalar()
    profiles = (await sql("select count(*) from users where email = :e", {"e": body["email"]})).scalar()
    assert (auth_users, profiles) == (0, 0)


# ---------------------------------------------------------------- modification


async def test_update_teacher(api, accounts):
    school_a, _, _ = accounts
    _, teacher = await _create(api, school_a)
    new_mail = new_email("prof-renamed")
    created_emails.append(new_mail)
    new_password = secrets.token_urlsafe(12)
    res = await api.patch(
        f"/school/teachers/{teacher['id']}",
        headers=school_a.headers,
        json={
            "firstName": "Irène",
            "lastName": "Joliot",
            "email": new_mail,
            "password": new_password,
            "subject": "science",
            "classNames": ["TS3"],
        },
    )
    assert res.status_code == 200, res.text
    row = (
        await sql(
            "select u.full_name, u.email, t.subject from teachers t join users u on u.id = t.user_id where t.id = :t",
            {"t": teacher["id"]},
        )
    ).first()
    assert tuple(row) == ("Irène Joliot", new_mail, "science")
    classes = [
        r[0]
        for r in await sql(
            "select c.name from class_teachers ct join classes c on c.id = ct.class_id where ct.teacher_id = :t",
            {"t": teacher["id"]},
        )
    ]
    assert classes == ["TS3"]
    async with httpx.AsyncClient(timeout=30) as http:
        assert await sign_in(http, new_mail, new_password), "email et mot de passe mis à jour dans Auth"


async def test_update_with_taken_email_rolls_back(api, accounts):
    school_a, _, independent = accounts
    body, teacher = await _create(api, school_a)
    res = await api.patch(
        f"/school/teachers/{teacher['id']}",
        headers=school_a.headers,
        json={"firstName": "Autre", "lastName": "Nom", "email": independent.email, "classNames": ["TS9"]},
    )
    assert res.status_code == 409
    row = (
        await sql(
            "select u.full_name, u.email from teachers t join users u on u.id = t.user_id where t.id = :t",
            {"t": teacher["id"]},
        )
    ).first()
    assert tuple(row) == ("Marie Curie", body["email"]), "aucune écriture partielle"
    classes = {
        r[0]
        for r in await sql(
            "select c.name from class_teachers ct join classes c on c.id = ct.class_id where ct.teacher_id = :t",
            {"t": teacher["id"]},
        )
    }
    assert classes == {"TS1", "TS2"}


async def test_other_school_cannot_touch_teacher(api, accounts):
    school_a, school_b, _ = accounts
    _, teacher = await _create(api, school_a)
    res = await api.patch(
        f"/school/teachers/{teacher['id']}",
        headers=school_b.headers,
        json={"firstName": "X", "lastName": "Y", "email": new_email("x"), "classNames": ["A"]},
    )
    assert res.status_code == 404
    assert (await api.delete(f"/school/teachers/{teacher['id']}", headers=school_b.headers)).status_code == 404


# ---------------------------------------------------------------- détachement


async def test_detach_teacher(api, accounts):
    school_a, _, _ = accounts
    _, teacher = await _create(api, school_a)
    res = await api.delete(f"/school/teachers/{teacher['id']}", headers=school_a.headers)
    assert res.status_code == 200
    row = (await sql("select school_id, is_independent from teachers where id = :t", {"t": teacher["id"]})).first()
    links = (await sql("select count(*) from class_teachers where teacher_id = :t", {"t": teacher["id"]})).scalar()
    assert (row[0], row[1], links) == (None, True, 0)
