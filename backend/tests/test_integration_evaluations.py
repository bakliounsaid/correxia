"""
Tests d'intégration des routes /evaluations contre la vraie base Supabase.
Crée deux enseignants de test (Admin API), puis supprime tout en fin de module.
Ignorés si backend/.env ne contient pas DATABASE_URL / SUPABASE_URL / clés.
"""

import json
import secrets
import uuid
from dataclasses import dataclass

import httpx
import pytest

from app.database import SessionLocal, get_db
from app.main import app
from tests.integration_support import INTEGRATION, create_account, delete_account, teacher_id_of
from tests.integration_support import sql as _sql

pytestmark = INTEGRATION


@dataclass
class SeedTeacher:
    user_id: str
    teacher_id: str
    headers: dict[str, str]


async def _create_teacher(http: httpx.AsyncClient, tag: str) -> SeedTeacher:
    account = await create_account(
        http, tag, {"account_type": "teacher_independent", "first_name": "Pytest", "last_name": tag}
    )
    teacher_id = await teacher_id_of(account.user_id)
    assert teacher_id, "le trigger d'inscription doit créer la ligne teachers"
    return SeedTeacher(account.user_id, teacher_id, account.headers)


@pytest.fixture(scope="module")
async def teachers():
    async with httpx.AsyncClient(timeout=30) as http:
        a = await _create_teacher(http, "a")
        b = await _create_teacher(http, "b")
        try:
            yield a, b
        finally:
            await delete_account(http, a.user_id)
            await delete_account(http, b.user_id)


@pytest.fixture
async def api():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
async def scenario(teachers):
    """Classe de 2 élèves + évaluation « créée » avec correction type, pour l'enseignant A."""
    a, _ = teachers
    name = f"PYTEST-{secrets.token_hex(3)}"
    class_id = (
        await _sql(
            "insert into classes (teacher_id, name) values (:t, :n) returning id", {"t": a.teacher_id, "n": name}
        )
    ).scalar()
    await _sql("insert into class_teachers (class_id, teacher_id) values (:c, :t)", {"c": class_id, "t": a.teacher_id})
    students = [
        (
            await _sql(
                "insert into students (class_id, first_name, last_name) values (:c, :f, :l) returning id",
                {"c": class_id, "f": first, "l": last},
            )
        ).scalar()
        for first, last in (("Ada", "Lovelace"), ("Alan", "Turing"))
    ]
    test_id = (
        await _sql(
            "insert into tests (teacher_id, title, subject, level, class_name, status, total_points, "
            "correction_file_url, questions, rubric) values (:t, 'Pytest', 'math', 'Terminale', :n, 'created', 20, "
            "'https://example.com/corr.png', '[]', '[]') returning id",
            {"t": a.teacher_id, "n": name},
        )
    ).scalar()
    yield {"test_id": str(test_id), "students": [str(s) for s in students], "url": f"/evaluations/{test_id}"}
    await _sql("delete from tests where id = :t", {"t": test_id})
    await _sql("delete from students where class_id = :c", {"c": class_id})
    await _sql("delete from classes where id = :c", {"c": class_id})


async def _start(api, teachers, scenario) -> list[dict]:
    a, _ = teachers
    res = await api.post(f"{scenario['url']}/start", headers=a.headers, json={"studentIds": scenario["students"]})
    assert res.status_code == 200, res.text
    return res.json()["copies"]


async def _add_correction(copy_id: str, points: float = 14.5) -> None:
    analysis = {
        "feedback": "Bien",
        "per_exercise": [{"label": "Ex1", "score": 7, "max": 10}],
        "passages_a_verifier": [{"zone": "Ex1", "detail": "illisible"}],
    }
    await _sql(
        "update test_copies set scanned_image_url = 'https://example.com/scan.png' where id = :c;",
        {"c": copy_id},
    )
    await _sql(
        "insert into copy_corrections (copy_id, test_id, student_id, teacher_id, ai_total_points, "
        "ai_confidence_score, ai_analysis_json, processing_status, validation_status, is_validated) "
        "select id, test_id, student_id, teacher_id, :p, 0.8, cast(:j as jsonb), 'completed', 'pending', false "
        "from test_copies where id = :c",
        {"c": copy_id, "p": points, "j": json.dumps(analysis)},
    )


# ---------------------------------------------------------------- accès


async def test_start_lists_class_students(api, teachers, scenario):
    a, _ = teachers
    res = await api.get(f"{scenario['url']}/start", headers=a.headers)
    assert res.status_code == 200
    assert {s["last_name"] for s in res.json()["students"]} == {"Lovelace", "Turing"}


async def test_other_teacher_cannot_access(api, teachers, scenario):
    _, b = teachers
    for method, path in (
        ("GET", "/start"),
        ("PATCH", ""),
        ("DELETE", ""),
        ("POST", "/reset-imports"),
    ):
        res = await api.request(method, f"{scenario['url']}{path}", headers=b.headers, json={"title": "x"})
        assert res.status_code == 404, f"{method} {path}: {res.status_code}"


# ---------------------------------------------------------------- lancement


async def test_start_creates_copies_once(api, teachers, scenario):
    a, _ = teachers
    copies = await _start(api, teachers, scenario)
    assert len(copies) == 2
    res = await api.post(f"{scenario['url']}/start", headers=a.headers, json={"studentIds": scenario["students"][:1]})
    assert res.json()["created"] == 0 and res.json()["already_exists"] == 1
    status, generated = (
        await _sql("select status, copies_generated from tests where id = :t", {"t": scenario["test_id"]})
    ).first()
    assert (status, generated) == ("in_progress", 2)


async def test_start_rejects_foreign_student(api, teachers, scenario):
    a, _ = teachers
    res = await api.post(f"{scenario['url']}/start", headers=a.headers, json={"studentIds": [str(uuid.uuid4())]})
    assert res.status_code == 403


# ---------------------------------------------------------------- évaluation


async def test_patch_rules_during_exam(api, teachers, scenario):
    a, _ = teachers
    res = await api.patch(scenario["url"], headers=a.headers, json={"title": "Avant examen"})
    assert res.status_code == 200 and res.json()["evaluation"]["title"] == "Avant examen"
    await _start(api, teachers, scenario)
    res = await api.patch(scenario["url"], headers=a.headers, json={"title": "Pendant"})
    assert res.status_code == 409
    res = await api.patch(scenario["url"], headers=a.headers, json={"correction_file_name": "v2.png"})
    assert res.status_code == 200
    res = await api.patch(scenario["url"], headers=a.headers, json={"status": "inconnu"})
    assert res.status_code == 400


# ---------------------------------------------------------------- copies


async def test_copy_patch_and_delete(api, teachers, scenario):
    a, _ = teachers
    copies = await _start(api, teachers, scenario)
    url = f"{scenario['url']}/copies/{copies[0]['copy_id']}"
    res = await api.patch(
        url, headers=a.headers, json={"scanned_image_url": "https://example.com/s.png", "status": "submitted"}
    )
    assert res.status_code == 200 and res.json()["copy"]["status"] == "submitted"
    assert (await api.patch(url, headers=a.headers, json={"status": "faux"})).status_code == 400
    assert (await api.delete(url, headers=a.headers)).status_code == 200
    generated = (await _sql("select copies_generated from tests where id = :t", {"t": scenario["test_id"]})).scalar()
    assert generated == 1
    listed = await api.get(f"{scenario['url']}/copies", headers=a.headers)
    assert len(listed.json()["copies"]) == 1


# ---------------------------------------------------------------- revue


async def test_review_flow_completes_evaluation(api, teachers, scenario):
    a, b = teachers
    copies = await _start(api, teachers, scenario)
    copy_id = copies[0]["copy_id"]
    await _add_correction(copy_id)

    res = await api.get(f"{scenario['url']}/copies/{copy_id}/review-data", headers=a.headers)
    payload = res.json()["payload"]
    assert payload["aiScore"] == 14.5
    assert payload["aiPerExercise"][0] == {"label": "Ex1", "score": 7.0, "max": 10.0, "comment": ""}
    assert payload["passagesAVerifier"] == [{"zone": "Ex1", "detail": "illisible"}]
    assert (await api.get(f"{scenario['url']}/copies/{copy_id}/review-data", headers=b.headers)).status_code == 404

    res = await api.patch(
        f"{scenario['url']}/copies/{copy_id}/review", headers=a.headers, json={"teacher_validated_points": 15}
    )
    assert res.status_code == 200
    assert res.json()["review"]["validation_status"] == "modified"
    assert res.json()["evaluationCompleted"] is True
    row = (
        await _sql(
            "select t.status, t.copies_corrected, c.status from tests t join test_copies c on c.test_id = t.id "
            "where c.id = :c",
            {"c": copy_id},
        )
    ).first()
    assert tuple(row) == ("completed", 1, "validated")


async def test_review_accepting_ai_score(api, teachers, scenario):
    a, _ = teachers
    copy_id = (await _start(api, teachers, scenario))[0]["copy_id"]
    await _add_correction(copy_id, points=12)
    res = await api.patch(
        f"{scenario['url']}/copies/{copy_id}/review", headers=a.headers, json={"teacher_validated_points": 12}
    )
    assert res.json()["review"]["validation_status"] == "accepted_ai"


# ---------------------------------------------------------------- transactions


async def test_reset_imports(api, teachers, scenario):
    a, _ = teachers
    copy_id = (await _start(api, teachers, scenario))[0]["copy_id"]
    await _add_correction(copy_id)
    res = await api.post(f"{scenario['url']}/reset-imports", headers=a.headers)
    assert res.status_code == 200 and res.json()["reset_imported_sheets"] == 1
    corrections = (
        await _sql("select count(*) from copy_corrections where test_id = :t", {"t": scenario["test_id"]})
    ).scalar()
    scans = (
        await _sql(
            "select count(*) from test_copies where test_id = :t and scanned_image_url is not null",
            {"t": scenario["test_id"]},
        )
    ).scalar()
    assert (corrections, scans) == (0, 0)


async def test_reset_imports_rolls_back_when_commit_fails(api, teachers, scenario):
    """Si la transaction échoue, aucune des écritures déjà envoyées ne doit rester."""
    a, _ = teachers
    copy_id = (await _start(api, teachers, scenario))[0]["copy_id"]
    await _add_correction(copy_id)

    async def failing_db():
        async with SessionLocal() as session:

            async def refuse_commit():
                raise RuntimeError("commit refusé (test)")

            session.commit = refuse_commit
            try:
                yield session
            except BaseException:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = failing_db
    try:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
            res = await c.post(f"{scenario['url']}/reset-imports", headers=a.headers)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert res.status_code == 500
    corrections = (await _sql("select count(*) from copy_corrections where copy_id = :c", {"c": copy_id})).scalar()
    scan = (await _sql("select scanned_image_url from test_copies where id = :c", {"c": copy_id})).scalar()
    assert corrections == 1, "la suppression des corrections doit être annulée"
    assert scan is not None, "la remise à zéro de la copie doit être annulée"


async def test_delete_evaluation_cascades(api, teachers, scenario):
    a, _ = teachers
    await _start(api, teachers, scenario)
    res = await api.delete(scenario["url"], headers=a.headers)
    assert res.status_code == 200
    left = (await _sql("select count(*) from test_copies where test_id = :t", {"t": scenario["test_id"]})).scalar()
    assert left == 0


# ---------------------------------------------------------------- création


def _create_body(**overrides) -> dict:
    body = {
        "title": "  Dérivées  ",
        "class_name": "TS1",
        "duration_minutes": 55,
        "questions": [
            {"id": "exo-1", "type": "open_question", "title": "Exercice 1", "text": "Q1", "points": 12},
            {"id": "exo-2", "type": "open_question", "title": "Exercice 2", "text": "Q2", "points": 8},
        ],
        "rubric": [
            {"id": "exo-1", "label": "Exercice 1", "points": 12},
            {"id": "exo-2", "label": "Exercice 2", "points": 8},
        ],
        "subject_file_url": "https://example.com/sujet.pdf",
        "subject_file_name": "sujet.pdf",
    }
    body.update(overrides)
    return body


async def test_create_evaluation_with_subject_in_one_transaction(api, teachers):
    a, _ = teachers
    res = await api.post("/evaluations", headers=a.headers, json=_create_body())
    assert res.status_code == 200, res.text
    evaluation = res.json()["evaluation"]
    assert (evaluation["title"], evaluation["status"], evaluation["total_points"]) == ("Dérivées", "created", 20)
    assert evaluation["questions"][0]["text"] == "Q1"
    sources = (
        await _sql(
            "select count(*) from test_sources where teacher_id = :t and file_url = 'https://example.com/sujet.pdf'",
            {"t": a.teacher_id},
        )
    ).scalar()
    assert sources == 1
    await _sql("delete from test_sources where teacher_id = :t", {"t": a.teacher_id})


async def test_create_evaluation_rejects_invalid_payload(api, teachers):
    a, _ = teachers
    before = (await _sql("select count(*) from tests where teacher_id = :t", {"t": a.teacher_id})).scalar()
    for override in ({"questions": []}, {"title": "  "}, {"duration_minutes": 0}, {"rubric": [{"points": -1}]}):
        res = await api.post("/evaluations", headers=a.headers, json=_create_body(**override))
        assert res.status_code == 400, override
    after = (await _sql("select count(*) from tests where teacher_id = :t", {"t": a.teacher_id})).scalar()
    assert after == before


async def test_create_evaluation_requires_teacher(api):
    assert (await api.post("/evaluations", json=_create_body())).status_code == 401
