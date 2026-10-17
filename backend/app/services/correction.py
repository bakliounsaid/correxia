"""
Correction IA d'une copie : OCR du manuscrit (vision) puis notation selon barème + correction type,
suivies de garde-fous déterministes (bornes, cohérence note/commentaire, sens des inégalités,
confiance). Portage fidèle de l'ancienne route Next /api/dashboard/evaluations/[id]/correct.
"""

import json
import math
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from app.config import get_settings
from app.services.openai_client import chat_json

OCR_TIMEOUT_SECONDS = 55.0
GRADE_TIMEOUT_SECONDS = 55.0

ACADEMIC_CORRECTION_PROTOCOL = "\n".join(
    [
        "Tu es un expert en correction de copies scientifiques (maths, physique, sciences).",
        "Objectif: transcription fidèle du manuscrit puis notation strictement alignée sur le barème et la correction type fournis.",
        "Pour chaque exercice: (1) lister ce que l'élève a réellement écrit ou calculé, (2) comparer à la référence, (3) attribuer les points selon le barème (méthode, justesse, résultat).",
        "Distingue clairement: erreur de calcul mineure, erreur de méthode, réponse incomplète, notation juste mais mal rédigée.",
        "Si l'OCR est ambigu sur un symbole ou un chiffre, ne pas inventer: signaler l'incertitude et pénaliser prudemment ou baisser la confidence.",
        "Feedback: phrases courtes, factuelles, point par point (ce qui est acquis / ce qui manque / l'erreur précise).",
    ]
)

OCR_INSTRUCTIONS = "\n".join(
    [
        "Mission: OCR haute fidélité pour correction ultérieure. Réponse = un seul objet JSON valide.",
        "La feuille contient du texte imprimé (énoncé): IGNORE tout le texte clairement imprimé du sujet.",
        "Extrais UNIQUEMENT l'écriture manuscrite de l'élève: calculs, réponses, schémas annotés, ratures visibles.",
        "Transcris dans l'ordre de lecture (haut → bas). Pour chaque exercice du sujet, commence une section:",
        "=== Exercice N ===",
        "Symboles maths: restitue fidèlement + − × ÷ = < > ≤ ≥ √ ^ Δ π Σ ∫, fractions en ligne (a+b)/c ou a/b, exposants ^n si lisibles.",
        "Pour les calculs, privilégie une forme exploitable: exposants en ^2, ^3, racines sqrt(...), constante pi, multiplication explicite 3*(-2) si ambigu.",
        "Ne complète pas une démarche manquante. Si illisible: [illisible] ou (?). Ne déduis pas un chiffre douteux du seul contexte.",
        "Si aucune trace manuscrite utile: has_content=false, text vide, legibility basse.",
        "Format JSON strict:",
        '{"text": string, "legibility": number, "has_content": boolean, "content_density": number, "ocr_notes": string, "unreadable_parts": [{"zone": string, "detail": string}]}',
        'unreadable_parts: tableau vide si tout est lisible. Sinon une entrée par problème: zone = repère (ex. "Exercice 2", "marge droite"), detail = ce qui n’a pas pu être transcrit fidèlement (barré, flou, coupé…).',
        "ocr_notes: une phrase globale sur la qualité du scan ou chaîne vide.",
        "legibility, content_density ∈ [0,1].",
    ]
)

SUBJECT_GUIDELINES = {
    "physics": "\n".join(
        [
            "Spécifique physique: valorise les lois correctes, unités cohérentes, schéma/raisonnement expérimental.",
            "Tolère une autre voie de résolution si les hypothèses et dimensions sont cohérentes.",
        ]
    ),
    "science": "\n".join(
        [
            "Spécifique sciences: valorise causalité, vocabulaire scientifique pertinent, justification par observations/faits.",
            "Accepte des formulations différentes si le mécanisme scientifique est correct.",
        ]
    ),
    "math": "\n".join(
        [
            "Spécifique mathématiques: valorise la méthode, les étapes intermédiaires et la justesse logique.",
            "Accepte une méthode alternative valide même si différente de la correction type.",
        ]
    ),
}

EMPTY_COPY_FEEDBACK = (
    "Copie détectée comme vide ou quasi vide : note fixée à 0/20. Vérification enseignant recommandée."
)


# ---------------------------------------------------------------- utilitaires purs


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def to_float(value: Any, default: float) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return n if n == n else default


def round_quarter(n: float) -> float:
    # floor(x + 0.5) comme Math.round en JS (round() de Python arrondit 0.5 au pair : 2.5 → 2).
    return math.floor(n * 4 + 0.5) / 4


def normalize_revision_passages(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        zone = str(item.get("zone") or item.get("location") or item.get("where") or item.get("exercice") or "").strip()
        detail = str(
            item.get("detail") or item.get("note") or item.get("reason") or item.get("description") or ""
        ).strip()
        if not zone and not detail:
            continue
        out.append({"zone": zone or "Copie", "detail": detail or zone})
    return out


def dedupe_passages(items: list[dict]) -> list[dict]:
    seen, result = set(), []
    for it in items:
        key = f"{it['zone'].strip()}\n{it['detail'].strip()}"
        if key not in seen:
            seen.add(key)
            result.append(it)
    return result


def uncertainty_penalty(count: int) -> float:
    """Pénalité de confiance progressive et plafonnée selon le nombre de zones douteuses."""
    return 0.0 if count <= 0 else min(0.25, 0.03 + count * 0.035)


_COMMENT_SIGNALS_ERROR = re.compile(
    "|".join(
        [
            r"erreur\s+(de|d'|dans|sur|aux?)",
            r"erreurs\s+",
            "incorrect",
            "incorrecte",
            "erroné",
            "erronée",
            "faux",
            "fausse",
            r"n['’]est pas",
            "ne sont pas",
            "pas correct",
            "pas juste",
            "invalide",
            "mauvais",
            "mauvaise",
            "mal interpr",
            r"interprétation.{0,60}(incorrect|erron|faus)",
            r"conclusion.{0,50}(faus|incorrect|erron)",
            "ne convient pas",
            "inadéquat",
        ]
    ),
    re.IGNORECASE,
)
_NO_ERROR = re.compile(r"(sans|aucune|pas\s+d['’])\s+erreur", re.IGNORECASE)
_BUT = re.compile(r"\bmais\b", re.IGNORECASE)

_INEQUALITY_CONFLICT = re.compile(
    "|".join(
        [
            r"(<\s*(au\s+lieu\s+de|au\s+lieu\s+d['’])\s*>|>\s*(au\s+lieu\s+de|au\s+lieu\s+d['’])\s*<)",
            r"(<=\s*(au\s+lieu\s+de|au\s+lieu\s+d['’])\s*>=|>=\s*(au\s+lieu\s+de|au\s+lieu\s+d['’])\s*<=)",
            r"(signe\s+d['’]?in[ée]galit[ée].{0,40}(faux|invers|incorrect|erron))",
            r"(sens\s+de\s+l['’]?in[ée]galit[ée].{0,40}(faux|invers|incorrect|erron))",
            r"(inf[ée]rieur.{0,40}(au\s+lieu\s+de|au\s+lieu\s+d['’]).{0,20}sup[ée]rieur)",
            r"(sup[ée]rieur.{0,40}(au\s+lieu\s+de|au\s+lieu\s+d['’]).{0,20}inf[ée]rieur)",
        ]
    ),
    re.IGNORECASE,
)


def comment_signals_error(comment: str) -> bool:
    c = comment.strip()
    if not c or not _COMMENT_SIGNALS_ERROR.search(c):
        return False
    return not (_NO_ERROR.search(c) and not _BUT.search(c))


def cap_full_score_with_critical_comment(rows: list[dict]) -> tuple[list[dict], bool]:
    """Note maximale + commentaire signalant une erreur → plafond à ~70 % du max."""
    adjusted, out = False, []
    for e in rows:
        if e["max"] > 0 and e["score"] >= e["max"] - 1e-6 and comment_signals_error(e.get("comment", "")):
            new_score = clamp(min(e["score"], round_quarter(e["max"] * 0.7)), 0, e["max"])
            if abs(new_score - e["score"]) > 1e-6:
                adjusted = True
            e = {**e, "score": new_score}
        out.append(e)
    return out, adjusted


def cap_inverted_inequality(rows: list[dict]) -> tuple[list[dict], bool]:
    """Commentaire signalant une inversion du sens d'inégalité → plafond à ~35 % du max."""
    adjusted, out = False, []
    for e in rows:
        if e["max"] > 0 and _INEQUALITY_CONFLICT.search(e.get("comment", "") or ""):
            new_score = clamp(min(e["score"], round_quarter(e["max"] * 0.35)), 0, e["max"])
            if abs(new_score - e["score"]) > 1e-6:
                adjusted = True
            e = {**e, "score": new_score}
        out.append(e)
    return out, adjusted


# ---------------------------------------------------------------- OCR


@dataclass
class OcrResult:
    text: str
    legibility: float
    has_content: bool
    content_density: float
    unreadable_parts: list[dict] = field(default_factory=list)


def parse_ocr(parsed: dict) -> OcrResult:
    base = str(parsed.get("text") or "").strip()
    notes = str(parsed.get("ocr_notes") or "").strip()
    if notes and base:
        text = f"{base}\n\n[Notes OCR: {notes}]"
    elif notes:
        text = f"[Notes OCR: {notes}]"
    else:
        text = base
    return OcrResult(
        text=text,
        legibility=clamp(to_float(parsed.get("legibility"), 0.5), 0, 1),
        has_content=bool(parsed.get("has_content")),
        content_density=clamp(to_float(parsed.get("content_density"), 0.5), 0, 1),
        unreadable_parts=normalize_revision_passages(parsed.get("unreadable_parts")),
    )


async def ocr_image(image_url: str, printed_template_text: str) -> OcrResult:
    parsed = await chat_json(
        model=get_settings().openai_ocr_model,
        request_timeout=OCR_TIMEOUT_SECONDS,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "\n".join(
                            [
                                ACADEMIC_CORRECTION_PROTOCOL,
                                "",
                                OCR_INSTRUCTIONS,
                                "",
                                "Texte imprimé du sujet (à ne PAS recopier comme production élève):",
                                printed_template_text[:12000],
                            ]
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}},
                ],
            }
        ],
    )
    return parse_ocr(parsed)


# ---------------------------------------------------------------- notation


@dataclass
class GradeResult:
    score: float
    confidence: float
    feedback: str
    per_exercise: list[dict]
    has_content: bool
    content_density: float
    notation_incertaine: list[dict]


def grading_prompt(
    *,
    student_text: str,
    correction_text: str,
    rubric_block: str,
    total_points: float,
    subject: str,
    ocr: OcrResult,
    math_hints: str,
) -> str:
    return "\n".join(
        [
            ACADEMIC_CORRECTION_PROTOCOL,
            "",
            "Tu corriges comme en contrôle classique: précis, motivé, sans généralités vagues.",
            "N'exige pas une copie conforme mot à mot à la correction type si la démarche et le résultat sont valides.",
            "En revanche, sois strict sur: erreurs de définition, erreurs de raisonnement, résultats faux, unités incohérentes, réponses hors sujet.",
            "Point CRITIQUE: en inégalités, le sens du signe est obligatoire. Si la correction attend '>' et que l'élève met '<' (ou l'inverse), c'est une erreur majeure.",
            "Même règle pour <= / >= et pour les formulations 'supérieur / inférieur': une inversion de sens doit entraîner une perte nette de points.",
            "Ne valide jamais comme 'juste' une conclusion dont le sens d'inégalité est inversé, même si le calcul intermédiaire est correct.",
            "Accorde des demi-points ou quarts de barème quand c'est pertinent; cite l'exigence du barème dans le commentaire d'exercice.",
            f'Barème total de l\'évaluation: {total_points:g} points (la somme des "max" dans per_exercise doit rejoindre ce total).',
            f"Matière: {subject or 'math'}.",
            f"Lisibilité OCR (fiabilité transcription): {round(ocr.legibility * 100)}%.",
            f"has_content (pipeline): {'true' if ocr.has_content else 'false'}, content_density: {ocr.content_density:g}.",
            "Si la transcription contient [illisible] ou (?), intègre ce doute: ne pas sur-pénaliser un passage illisible, mais baisse confidence.",
            SUBJECT_GUIDELINES.get((subject or "").lower(), SUBJECT_GUIDELINES["math"]),
            "",
            "Référence officielle — questions + barème (respecte les points max par exercice):",
            rubric_block[:14000],
            "",
            "Correction type (référence rédigée / OCR):",
            correction_text[:12000],
            "",
            "Copie élève (transcription OCR structurée Exercice 1, 2…):",
            student_text[:12000],
            "",
            *(
                [
                    "Recoupement calculatoire automatique (sur le texte OCR — peut être faux si l’OCR est mauvais; la copie image reste la vérité):",
                    math_hints[:6000],
                    "",
                ]
                if math_hints
                else []
            ),
            "Passages déjà signalés comme peu lisibles par l’étape OCR (à reprendre dans notation_incertaine si la note en dépend encore):",
            json.dumps(ocr.unreadable_parts[:40], ensure_ascii=False),
            "",
            "Réponds en JSON strict:",
            '{"score": number, "confidence": number, "feedback": string, "per_exercise": [{"label": string, "score": number, "max": number, "comment": string}], "has_content": boolean, "content_density": number, "notation_incertaine": [{"zone": string, "detail": string}]}',
            "Règles:",
            '- per_exercise: un objet par exercice du barème ci-dessus; chaque "max" = points prévus au barème pour cet exercice.',
            "- INTERDIT: pour tout exercice, score > max ou score < 0. Exemple invalide: 7/6. Chaque score doit être compris entre 0 et max inclus.",
            "- score (total) = somme des score de per_exercise (après respect des max); doit aussi être ≤ au barème total de l’évaluation.",
            "- comment: 1-3 phrases, ce qui est juste / faux / manquant, en référence au contenu élève (pas générique).",
            "- COHÉRENCE NOTE / COMMENTAIRE (obligatoire): si le commentaire d’un exercice signale une erreur, une conclusion fausse, une interprétation incorrecte ou une méthode invalide, la note de CET exercice NE PEUT PAS être le maximum. Réserve au moins 25–50 % des points selon la gravité.",
            "- Inégalités: si l'élève inverse le sens (< vs >, <= vs >=, supérieur vs inférieur), c'est une erreur conceptuelle importante: pas de note maximale et pénalité significative.",
            "- Exemple INTERDIT: « interprétation de l’angle erronée » ou « conclusion fausse » avec 6/6. Dans ce cas la note doit baisser (ex. 3–5/6 selon le barème partiel).",
            "- confidence 0-1: ta certitude sur la justesse de la correction compte tenu de l'OCR.",
            '- notation_incertaine: [] si tout est clair. Sinon une entrée par zone où l’enseignant doit relire la copie (ex. zone="Exercice 3", detail="la note dépend d’un symbole ambigu dans la transcription"). Ne duplique pas inutilement l’OCR si déjà couvert.',
            "- Si des indices calculatoires contredisent ton interprétation du texte OCR, privilégie la cohérence avec l’énoncé et baisse confidence; l’image papier prime toujours sur le texte.",
            "- Si copie vide ou quasi vide: has_content false, score quasi nul, feedback explicite.",
        ]
    )


def finalize_grade(parsed: dict, *, total_points: float, ocr: OcrResult) -> GradeResult:
    """Garde-fous déterministes appliqués à la réponse brute du modèle de notation."""
    notation_incertaine = normalize_revision_passages(parsed.get("notation_incertaine"))
    raw_rows = parsed.get("per_exercise") if isinstance(parsed.get("per_exercise"), list) else []
    rows = []
    for i, e in enumerate(raw_rows):
        e = e if isinstance(e, dict) else {}
        max_points = to_float(e.get("max"), 0)
        if max_points <= 0:
            continue
        rows.append(
            {
                "label": str(e.get("label") or f"Exercice {i + 1}"),
                "score": clamp(to_float(e.get("score"), 0), 0, max_points),
                "max": max_points,
                "comment": str(e.get("comment") or ""),
            }
        )
    rows, comment_fixed = cap_full_score_with_critical_comment(rows)
    rows, inequality_fixed = cap_inverted_inequality(rows)

    per_sum = sum(e["score"] for e in rows)
    model_total = clamp(to_float(parsed.get("score"), 0), 0, total_points)
    raw_score = clamp(per_sum, 0, total_points) if rows else model_total
    coherence_penalty = min(0.25, abs(per_sum - raw_score) / max(1, total_points)) if rows else 0.0

    has_content_model = bool(parsed.get("has_content"))
    density = clamp(to_float(parsed.get("content_density"), ocr.content_density), 0, 1)
    low_content = not ocr.has_content or not has_content_model or density < 0.1

    raw_confidence = clamp(
        to_float(parsed.get("confidence"), 0.5)
        - coherence_penalty
        - (0.05 if comment_fixed else 0)
        - (0.15 if inequality_fixed else 0),
        0,
        1,
    )
    uncertainty = uncertainty_penalty(len(dedupe_passages([*ocr.unreadable_parts, *notation_incertaine])))
    legibility_cap = max(0.15, ocr.legibility)
    confidence = min(raw_confidence, 0.35, legibility_cap) if low_content else min(raw_confidence, legibility_cap + 0.2)
    return GradeResult(
        score=0.0 if low_content else raw_score,
        confidence=clamp(confidence - uncertainty, 0, 1),
        feedback=EMPTY_COPY_FEEDBACK if low_content else str(parsed.get("feedback") or "Correction IA générée."),
        per_exercise=rows,
        has_content=ocr.has_content and has_content_model,
        content_density=density,
        notation_incertaine=notation_incertaine,
    )


async def grade_copy(
    *,
    student_ocr: OcrResult,
    correction_text: str,
    rubric_block: str,
    total_points: float,
    subject: str,
    math_hints: str,
) -> GradeResult:
    parsed = await chat_json(
        model=get_settings().openai_grade_model,
        request_timeout=GRADE_TIMEOUT_SECONDS,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": grading_prompt(
                            student_text=student_ocr.text,
                            correction_text=correction_text,
                            rubric_block=rubric_block,
                            total_points=total_points,
                            subject=subject,
                            ocr=student_ocr,
                            math_hints=math_hints,
                        ),
                    }
                ],
            }
        ],
    )
    return finalize_grade(parsed, total_points=total_points, ocr=student_ocr)


# ---------------------------------------------------------------- fichiers

_IMAGE_URL = re.compile(r"\.(png|jpe?g|webp|gif)(\?|$)", re.IGNORECASE)


def is_likely_image_url(url: str | None) -> bool:
    return bool(url and _IMAGE_URL.search(url))


def is_likely_pdf_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        return urlparse(url).path.lower().endswith(".pdf")
    except ValueError:
        return ".pdf" in url.lower()
