"""Tests unitaires de la couche IA : calcul, garde-fous de notation, génération, sélection par quota."""

import uuid

import pytest

from app.services import correction as corr
from app.services import generation as gen
from app.services.math_hints import build_math_assist_hints, normalize_math_fragment, safe_evaluate
from app.services.quota import CopyQuota, select_within_quota

# ---------------------------------------------------------------- calcul


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("3 × 4", "3*4"),
        ("8 ÷ 2", "8/2"),
        ("2π", "2*pi"),
        ("3√2", "3*sqrt(2)"),
        ("√(9)", "sqrt(9)"),
        ("√16", "sqrt(16)"),
        ("2,5", "2.5"),
        ("3(2+1)", "3*(2+1)"),
        ("(1+1)2", "(1+1)*2"),
    ],
)
def test_normalize_math_fragment(raw, expected):
    assert normalize_math_fragment(raw) == expected


@pytest.mark.parametrize(
    ("expr", "expected"),
    [("2+3*4", 14), ("2^3", 8), ("sqrt(16)", 4), ("3*(2+1)", 9), ("-(4)/2", -2), ("2*pi", 6.283185307179586)],
)
def test_safe_evaluate(expr, expected):
    assert safe_evaluate(expr) == pytest.approx(expected)


@pytest.mark.parametrize(
    "expr",
    ["__import__('os')", "x+1", "1/0", "9^9^9", "2" * 100, "open(1)", "sqrt(-1)", "", "(1+"],
)
def test_safe_evaluate_rejects_unsafe_or_invalid(expr):
    assert safe_evaluate(expr) is None


def test_build_math_assist_hints():
    text = "=== Exercice 1 ===\nx = 3 × 4\ny = n'importe quoi\n[Notes OCR: x = 1]"
    hints = build_math_assist_hints(text)
    assert "≈ 12" in hints
    assert hints.count("≈") == 1
    assert build_math_assist_hints("pas de calcul") == ""


# ---------------------------------------------------------------- garde-fous de notation


@pytest.mark.parametrize(
    ("comment", "expected"),
    [
        ("Erreur de calcul à la ligne 2.", True),
        ("Conclusion fausse sur le sens de variation.", True),
        ("Ce n’est pas la bonne méthode.", True),
        ("Raisonnement complet, sans erreur.", False),
        ("Sans erreur de calcul mais conclusion incorrecte.", True),
        ("Très bien.", False),
        ("", False),
    ],
)
def test_comment_signals_error(comment, expected):
    assert corr.comment_signals_error(comment) is expected


def test_full_score_with_critical_comment_is_capped_at_70_percent():
    rows, adjusted = corr.cap_full_score_with_critical_comment(
        [
            {"label": "Ex1", "score": 6, "max": 6, "comment": "Interprétation de l’angle erronée."},
            {"label": "Ex2", "score": 4, "max": 4, "comment": "Parfait."},
        ]
    )
    assert adjusted is True
    assert [r["score"] for r in rows] == [4.25, 4]  # 70 % de 6 = 4.2 → arrondi au quart


def test_inverted_inequality_is_capped_at_35_percent():
    rows, adjusted = corr.cap_inverted_inequality(
        [
            {"label": "Ex1", "score": 5, "max": 8, "comment": "L'élève écrit < au lieu de >."},
            {"label": "Ex2", "score": 2, "max": 8, "comment": "Sens de l'inégalité inversé."},
        ]
    )
    assert adjusted is True
    assert [r["score"] for r in rows] == [2.75, 2]  # 35 % de 8 = 2.8 → 2.75 ; déjà sous le plafond


def _ocr(**kw) -> corr.OcrResult:
    defaults = {"text": "x = 2", "legibility": 0.9, "has_content": True, "content_density": 0.6, "unreadable_parts": []}
    defaults.update(kw)
    return corr.OcrResult(**defaults)


def test_finalize_grade_clamps_scores_and_sums_exercises():
    grade = corr.finalize_grade(
        {
            "score": 99,
            "confidence": 0.9,
            "feedback": "Bien",
            "has_content": True,
            "content_density": 0.7,
            "per_exercise": [
                {"label": "Ex1", "score": 9, "max": 6, "comment": "Juste."},
                {"label": "Ex2", "score": -2, "max": 14, "comment": "Rien."},
                {"label": "Bonus", "score": 3, "max": 0},
            ],
        },
        total_points=20,
        ocr=_ocr(),
    )
    assert [e["score"] for e in grade.per_exercise] == [6, 0]
    assert grade.score == 6
    assert grade.confidence == pytest.approx(0.9)


def test_finalize_grade_empty_copy_scores_zero():
    grade = corr.finalize_grade(
        {"score": 12, "confidence": 0.9, "has_content": False, "per_exercise": [{"score": 12, "max": 20}]},
        total_points=20,
        ocr=_ocr(has_content=False, legibility=0.2),
    )
    assert grade.score == 0
    assert grade.feedback == corr.EMPTY_COPY_FEEDBACK
    assert grade.confidence <= 0.35


def test_finalize_grade_confidence_penalties():
    grade = corr.finalize_grade(
        {
            "confidence": 0.9,
            "has_content": True,
            "content_density": 0.7,
            "per_exercise": [{"label": "Ex1", "score": 6, "max": 6, "comment": "Résultat faux."}],
            "notation_incertaine": [{"zone": "Ex1", "detail": "symbole ambigu"}],
        },
        total_points=20,
        ocr=_ocr(legibility=0.5, unreadable_parts=[{"zone": "Ex2", "detail": "flou"}]),
    )
    # 0.9 - 0.05 (note plafonnée) = 0.85 ; plafond lisibilité 0.5 + 0.2 = 0.7 ; 2 zones douteuses : -0.10
    assert grade.confidence == pytest.approx(0.6)
    assert grade.per_exercise[0]["score"] == 4.25


def test_parse_ocr_merges_notes_and_clamps():
    result = corr.parse_ocr(
        {"text": " 2x = 4 ", "ocr_notes": "Scan flou", "legibility": 3, "unreadable_parts": [{"zone": "Ex1"}]}
    )
    assert result.text == "2x = 4\n\n[Notes OCR: Scan flou]"
    assert result.legibility == 1
    assert result.unreadable_parts == [{"zone": "Ex1", "detail": "Ex1"}]


def test_dedupe_passages():
    items = [{"zone": "Ex1", "detail": "a"}, {"zone": "Ex1 ", "detail": "a"}, {"zone": "Ex2", "detail": "a"}]
    assert len(corr.dedupe_passages(items)) == 2


@pytest.mark.parametrize(
    ("url", "image", "pdf"),
    [
        ("https://x/tests/a.png", True, False),
        ("https://x/tests/a.JPG?token=1", True, False),
        ("https://x/tests/a.pdf", False, True),
        ("https://x/tests/a.pdf?download=1", False, True),
        (None, False, False),
    ],
)
def test_file_type_detection(url, image, pdf):
    assert corr.is_likely_image_url(url) is image
    assert corr.is_likely_pdf_url(url) is pdf


# ---------------------------------------------------------------- génération


def test_normalize_rubric_sum_to_20():
    rubric = gen.normalize_rubric_sum([{"label": label, "points": 5} for label in "ABC"])
    assert sum(r["points"] for r in rubric) == 20
    assert sorted(r["points"] for r in rubric) == [6, 7, 7]


def test_parse_generation_normalizes_and_falls_back():
    parsed = gen.parse_generation(
        {
            "questions": [" Q1 ", {"text": "Q2"}, {"autre": 1}, ""],
            "rubric": [{"label": "A", "points": 10}, {"label": "", "points": 3}],
        },
        "moyen",
    )
    assert parsed["questions"] == ["Q1", "Q2"]
    assert parsed["rubric"] == [{"label": "A", "points": 20}]
    assert parsed_fallback_is_used(gen.parse_generation({}, "facile"))


def parsed_fallback_is_used(payload: dict) -> bool:
    return payload == gen.fallback_payload("facile") and sum(r["points"] for r in payload["rubric"]) == 20


# ---------------------------------------------------------------- sélection par quota


def test_select_within_quota():
    ids = [uuid.uuid4() for _ in range(4)]
    quota = CopyQuota(limit=40, used=39, window_start=None, expires_at=None, plan_label="x")
    keep, skipped = select_within_quota(ids, quota, already_counted={str(ids[2])})
    assert keep == [ids[0], ids[2]]  # 1 place libre + 1 copie déjà comptée
    assert skipped == [ids[1], ids[3]]


def test_select_within_quota_unlimited():
    ids = [uuid.uuid4() for _ in range(3)]
    assert select_within_quota(ids, CopyQuota(None, 0, None, None, "x"), set()) == (ids, [])


@pytest.mark.parametrize(("value", "expected"), [(0.625, 0.75), (1.875, 2.0), (4.2, 4.25), (2.8, 2.75), (1.0, 1.0)])
def test_round_quarter_rounds_half_up_like_js(value, expected):
    # Math.round(2.5) = 3 en JS ; round(2.5) = 2 en Python : la note doit rester identique à l'ancienne version.
    assert corr.round_quarter(value) == expected


@pytest.mark.parametrize(
    ("status_code", "expected"),
    [(401, "clé API refusée"), (403, "clé API refusée"), (429, "saturé"), (400, "pas pu lire"), (503, "indisponible")],
)
def test_openai_errors_are_translated_for_teachers(status_code, expected):
    from app.services.openai_client import user_message_for_status

    message = user_message_for_status(status_code)
    assert expected in message
    assert "sk-" not in message


@pytest.mark.anyio
async def test_openai_error_never_leaks_provider_detail(monkeypatch):
    import httpx

    from app.config import get_settings
    from app.services import openai_client

    class FakeClient:
        async def post(self, *_args, **_kwargs):
            return httpx.Response(401, json={"error": {"message": "Incorrect API key provided: sk-proj-****TloA"}})

    monkeypatch.setattr(get_settings(), "openai_api_key", "sk-test")
    monkeypatch.setattr(openai_client, "http_client", FakeClient)
    with pytest.raises(openai_client.AIError) as exc:
        await openai_client.chat_json(model="m", messages=[])
    assert "sk-proj" not in str(exc.value)
    assert "clé API refusée" in str(exc.value)
