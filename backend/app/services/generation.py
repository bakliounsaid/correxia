"""Génération d'une évaluation (questions + barème sur 20) à partir du cours. Portage de l'ancienne route Next."""

import logging
from typing import Any

from app.services.openai_client import AIError, chat_json

logger = logging.getLogger("correxia.generation")

GENERATION_MODEL = "gpt-4o-mini"
TOTAL_POINTS = 20


def normalize_question(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("text", "question", "title", "statement", "content", "prompt"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
    return ""


def normalize_rubric_sum(rubric: list[dict], total: int = TOTAL_POINTS) -> list[dict]:
    """Ramène la somme des points à `total` (parts entières, méthode des plus forts restes)."""
    current = sum(r["points"] for r in rubric)
    if not rubric or current == total or current <= 0:
        return rubric
    scaled = [r["points"] / current * total for r in rubric]
    floors = [int(x) for x in scaled]
    deficit = total - sum(floors)
    by_remainder = sorted(range(len(scaled)), key=lambda i: scaled[i] - floors[i], reverse=True)
    for i in by_remainder[:deficit]:
        floors[i] += 1
    return [{"label": r["label"], "points": floors[i]} for i, r in enumerate(rubric)]


def fallback_payload(complexity: str) -> dict:
    hint = {
        "facile": "restitution et application directe",
        "difficile": "analyse et justification avancée",
    }.get(complexity, "raisonnement intermédiaire")
    return {
        "questions": [
            f"Définir les notions clés du cours ({hint}).",
            "Résoudre un exercice d'application étape par étape.",
            "Expliquer et justifier la méthode choisie sur un cas similaire.",
        ],
        "rubric": [
            {"label": "Compréhension du cours", "points": 6},
            {"label": "Méthode et raisonnement", "points": 8},
            {"label": "Qualité de la rédaction", "points": 6},
        ],
    }


def build_prompt(*, title: str, class_name: str, complexity: str, course_context: str, rubric_text: str) -> str:
    return "\n".join(
        [
            "Tu es un générateur d'évaluations scolaires.",
            "Réponds strictement en JSON avec les clés questions (string[]) et rubric ({label, points}[]).",
            f"Titre: {title}",
            f"Classe: {class_name}",
            f"Complexité: {complexity}",
            f"Barème à respecter: {rubric_text}",
            f"Contenu du cours :\n{course_context}"
            if course_context
            else "Aucun contenu de cours fourni. Génère une évaluation cohérente avec le titre, la classe et la complexité.",
            "Contraintes: 3 à 6 questions maximum, format exercice clair, espace de réponse implicite.",
            f"L'évaluation est notée sur {TOTAL_POINTS} au total : la somme des points du tableau rubric doit être exactement {TOTAL_POINTS}.",
        ]
    )


def parse_generation(parsed: dict, complexity: str) -> dict:
    questions = [q for q in (normalize_question(v) for v in parsed.get("questions") or []) if q][:8]
    rubric = []
    for r in parsed.get("rubric") or []:
        if not isinstance(r, dict):
            continue
        label = str(r.get("label") or "").strip()
        try:
            points = float(r.get("points") or 0)
        except (TypeError, ValueError):
            points = 0
        if label and points > 0:
            rubric.append({"label": label, "points": points})
    rubric = normalize_rubric_sum(rubric)
    fallback = fallback_payload(complexity)
    return {"questions": questions or fallback["questions"], "rubric": rubric or fallback["rubric"]}


async def generate_evaluation(
    *, title: str, class_name: str, complexity: str, course_context: str, rubric_text: str
) -> dict:
    """Questions + barème. Repli sur un modèle d'évaluation générique si la réponse IA est inexploitable."""
    try:
        parsed = await chat_json(
            model=GENERATION_MODEL,
            temperature=0.4,
            messages=[
                {
                    "role": "user",
                    "content": build_prompt(
                        title=title,
                        class_name=class_name,
                        complexity=complexity,
                        course_context=course_context,
                        rubric_text=rubric_text,
                    ),
                }
            ],
        )
    except AIError:
        raise
    except Exception:
        logger.exception("Génération : réponse inexploitable, repli sur le modèle générique")
        return fallback_payload(complexity)
    return parse_generation(parsed, complexity)
