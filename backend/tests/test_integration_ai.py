"""
Tests d'intégration de la correction et de la génération IA contre la vraie base.
OpenAI est simulé : aucun appel facturé, réponses déterministes.
"""

import secrets
import uuid

import httpx
import pytest

from app.main import app
from app.services.openai_client import AIError
from tests.integration_support import INTEGRATION, create_account, delete_account, sql, teacher_id_of

pytestmark = INTEGRATION

OCR_RESPONSE = {
    "text": "=== Exercice 1 ===\nx = 3 × 4",
    "legibility": 0.9,
    "has_content": True,
    "content_density": 0.6,
    "ocr_notes": "",
    "unreadable_parts": [],
}
GRADE_RESPONSE = {
    "score": 15,
    "confidence": 0.8,
    "feedback": "Bonne copie.",
    "has_content": True,
    "content_density": 0.6,
    "per_exercise": [
        {"label": "Ex1", "score": 8, "max": 10, "comment": "Démarche juste."},
        {"label": "Ex2", "score": 7, "max": 10, "comment": "Il manque l'unité."},
    ],
    "notation_incertaine": [],
}


@pytest.fixture(scope="module")
async def teacher():
    async with httpx.AsyncClient(timeout=30) as http:
        account = await create_account(http, "ai", {"account_type": "teacher_independent"})
        account.teacher_id = await teacher_id_of(account.user_id)
        try:
            yield account
        finally:
            await delete_account(http, account.user_id)


@pytest.fixture(autouse=True)
async def reset_rate_limit(teacher):
    """La limite IA (5/min) est testée unitairement ; ici on enchaîne plus d'appels qu'elle n'en permet."""
    await sql("delete from api_rate_limits where bucket_key like :k", {"k": f"%{teacher.user_id}%"})


@pytest.fixture
async def api():
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
def fake_ai(monkeypatch):
    """OpenAI simulé : OCR si l'appel contient une image, notation sinon. `fail_on` = URL dont l'OCR échoue."""
    state = {"calls": 0, "fail_on": set(), "grade": GRADE_RESPONSE}

    async def fake_chat_json(*, model, messages, temperature=0.0, request_timeout=60.0):
        state["calls"] += 1
        content = messages[0]["content"]
        images = [p["image_url"]["url"] for p in content if isinstance(p, dict) and p.get("type") == "image_url"]
        if images:
            if images[0] in state["fail_on"]:
                raise AIError("Erreur IA (500): panne simulée")
            return OCR_RESPONSE
        return state["grade"]

    monkeypatch.setattr("app.services.correction.chat_json", fake_chat_json)
    monkeypatch.setattr("app.services.generation.chat_json", fake_chat_json)
    return state


@pytest.fixture
async def evaluation(teacher):
    """Évaluation en cours avec `n` copies scannées (images), à créer via `make(n)`."""
    created: list[str] = []

    async def make(n: int, *, correction_url: str = "https://example.com/corr.txt") -> dict:
        p = {"t": teacher.teacher_id}
        name = f"PYTEST-AI-{secrets.token_hex(3)}"
        class_id = (
            await sql("insert into classes (teacher_id, name) values (:t, :n) returning id", {**p, "n": name})
        ).scalar()
        test_id = (
            await sql(
                "insert into tests (teacher_id, title, subject, level, class_name, status, total_points, "
                "correction_file_url, questions, rubric) values (:t, 'IA', 'math', 'Terminale', :n, 'in_progress', 20, "
                ":c, '[]', '[]') returning id",
                {**p, "n": name, "c": correction_url},
            )
        ).scalar()
        created.append(str(class_id))
        copies = []
        for i in range(n):
            sid = (
                await sql(
                    "insert into students (class_id, first_name, last_name) values (:c, 'Élève', :l) returning id",
                    {"c": class_id, "l": f"N{i}"},
                )
            ).scalar()
            cid = (
                await sql(
                    "insert into test_copies (test_id, student_id, teacher_id, unique_test_id, status, scanned_image_url, created_at) "
                    "values (:t, :s, :te, :u, 'submitted', :img, now() + make_interval(secs => :i)) returning id",
                    {
                        "t": test_id,
                        "s": sid,
                        "te": teacher.teacher_id,
                        "u": f"CX-PYTEST-{secrets.token_hex(6)}",
                        "img": f"https://example.com/scan-{i}.png",
                        "i": i,
                    },
                )
            ).scalar()
            copies.append(str(cid))
        return {"test_id": str(test_id), "copies": copies, "url": f"/evaluations/{test_id}/correct"}

    yield make
    for class_id in created:
        await sql("delete from tests where class_name = (select name from classes where id = :c)", {"c": class_id})
        await sql("delete from students where class_id = :c", {"c": class_id})
        await sql("delete from classes where id = :c", {"c": class_id})


async def _set_plan(teacher, plan: str = "free", status: str = "active", created_days_ago: int = 1) -> None:
    await sql(
        "update teachers set subscription_plan = :p, subscription_status = :s, "
        "created_at = now() - make_interval(days => :d) where id = :t",
        {"p": plan, "s": status, "d": created_days_ago, "t": teacher.teacher_id},
    )
    await sql("delete from usage_logs where teacher_id = :t", {"t": teacher.teacher_id})


async def _log_fake_usage(teacher, n: int) -> None:
    for _ in range(n):
        await sql(
            "insert into usage_logs (teacher_id, action, action_value) values (:t, 'ai_copy_corrected', :c)",
            {"t": teacher.teacher_id, "c": str(uuid.uuid4())},
        )


# ---------------------------------------------------------------- correction


async def test_correct_saves_each_copy(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "mastery")
    ev = await evaluation(2)
    res = await api.post(ev["url"], headers=teacher.headers)
    body = res.json()
    assert res.status_code == 200, body
    assert (body["corrected"], body["total"], body["failures"]) == (2, 2, [])

    rows = list(
        await sql(
            "select c.status, cc.ai_total_points, cc.processing_status, cc.validation_status, "
            "cc.ai_analysis_json->>'feedback' from test_copies c join copy_corrections cc on cc.copy_id = c.id "
            "where c.test_id = :t",
            {"t": ev["test_id"]},
        )
    )
    assert [tuple(r) for r in rows] == [("pending_review", 15.0, "completed", "pending", "Bonne copie.")] * 2
    usage = (await sql("select count(*) from usage_logs where teacher_id = :t", {"t": teacher.teacher_id})).scalar()
    corrected = (await sql("select copies_corrected from tests where id = :t", {"t": ev["test_id"]})).scalar()
    assert (usage, corrected) == (2, 2)


async def test_one_ai_failure_does_not_cancel_other_copies(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "mastery")
    ev = await evaluation(3)
    fake_ai["fail_on"].add("https://example.com/scan-1.png")
    body = (await api.post(ev["url"], headers=teacher.headers)).json()
    assert body["corrected"] == 2
    assert len(body["failures"]) == 1 and "panne simulée" in body["failures"][0]
    saved = (await sql("select count(*) from copy_corrections where test_id = :t", {"t": ev["test_id"]})).scalar()
    assert saved == 2


async def test_pdf_scan_is_reported(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "mastery")
    ev = await evaluation(1)
    await sql(
        "update test_copies set scanned_image_url = 'https://example.com/scan.pdf' where id = :c",
        {"c": ev["copies"][0]},
    )
    body = (await api.post(ev["url"], headers=teacher.headers)).json()
    assert body["corrected"] == 0 and "PDF" in body["failures"][0]


async def test_free_plan_quota_limits_new_copies(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "free")
    await _log_fake_usage(teacher, 39)  # reste 1 copie sur 40
    ev = await evaluation(2)
    body = (await api.post(ev["url"], headers=teacher.headers)).json()
    assert body["corrected"] == 1
    assert "quota de copies atteint" in body["failures"][0]
    assert (body["quota"]["used"], body["quota"]["remaining"]) == (40, 0)

    res = await api.post(ev["url"], headers=teacher.headers)
    body = res.json()
    assert res.status_code == 200 and body["corrected"] == 1, "recorriger une copie déjà comptée reste gratuit"


async def test_reset_imports_does_not_restore_quota(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "free")
    await _log_fake_usage(teacher, 39)
    ev = await evaluation(1)
    assert (await api.post(ev["url"], headers=teacher.headers)).json()["corrected"] == 1
    assert (await api.post(f"/evaluations/{ev['test_id']}/reset-imports", headers=teacher.headers)).status_code == 200

    other = await evaluation(1)
    res = await api.post(other["url"], headers=teacher.headers)
    assert res.status_code == 402 and "Quota atteint : 40/40" in res.json()["error"]


async def test_expired_free_account_is_402(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "free", created_days_ago=31)
    ev = await evaluation(1)
    res = await api.post(ev["url"], headers=teacher.headers)
    assert res.status_code == 402 and "30 jours est terminé" in res.json()["error"]
    assert fake_ai["calls"] == 0, "aucun appel IA facturé quand l'accès est expiré"


async def test_correct_requires_scans_and_correction(api, teacher, evaluation, fake_ai):
    await _set_plan(teacher, "mastery")
    ev = await evaluation(1, correction_url=None)
    assert (await api.post(ev["url"], headers=teacher.headers)).status_code == 409
    empty = await evaluation(0)
    res = await api.post(empty["url"], headers=teacher.headers)
    assert res.status_code == 409 and "scan manquant" in res.json()["error"]


# ---------------------------------------------------------------- génération


async def test_generate_normalizes_rubric(api, teacher, fake_ai):
    fake_ai["grade"] = {
        "questions": ["Q1", {"text": "Q2"}],
        "rubric": [{"label": "A", "points": 5}, {"label": "B", "points": 5}],
    }
    res = await api.post(
        "/evaluations/generate",
        headers=teacher.headers,
        json={"title": "Dérivées", "className": "TS1", "courseContext": "Cours sur les dérivées"},
    )
    body = res.json()
    assert res.status_code == 200
    assert body["questions"] == ["Q1", "Q2"]
    assert body["rubric"] == [{"label": "A", "points": 10}, {"label": "B", "points": 10}]


async def test_generate_validation_and_ai_error(api, teacher, monkeypatch):
    res = await api.post("/evaluations/generate", headers=teacher.headers, json={"title": "", "className": "TS1"})
    assert res.status_code == 400

    async def down(**_kwargs):
        raise AIError("Service IA injoignable.")

    monkeypatch.setattr("app.services.generation.chat_json", down)
    res = await api.post(
        "/evaluations/generate",
        headers=teacher.headers,
        json={"title": "T", "className": "C", "courseContext": "cours"},
    )
    assert res.status_code == 502 and res.json()["error"] == "Service IA injoignable."


async def test_generate_requires_auth(api):
    res = await api.post("/evaluations/generate", json={"title": "T", "className": "C", "courseContext": "x"})
    assert res.status_code == 401
