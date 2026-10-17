"""
IA : génération d'évaluations et correction des copies (ex-routes Next /api/evaluations/generate
et /api/dashboard/evaluations/[id]/correct).
La correction traite plusieurs copies en parallèle ; chaque copie est enregistrée dans sa propre
transaction (correction + statut + usage), si bien qu'un échec n'annule pas les copies déjà corrigées.
"""

import asyncio
import json
import logging
import time
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.config import get_settings
from app.database import SessionLocal
from app.deps import CurrentTeacher, DbSession
from app.models import CopyCorrection, Teacher, Test, TestCopy
from app.rate_limit import LIMIT_AI
from app.services import correction as corr
from app.services.generation import generate_evaluation
from app.services.math_hints import build_math_assist_hints, subject_uses_math_assist
from app.services.openai_client import AIError
from app.services.quota import (
    copies_already_counted,
    get_teacher_quota,
    record_copy_usage,
    select_within_quota,
)
from app.supabase_admin import signed_storage_url

logger = logging.getLogger("correxia.ai")

router = APIRouter(tags=["ai"])

COPY_CONCURRENCY = 3


# ---------------------------------------------------------------- génération


class RubricItem(BaseModel):
    label: str | None = None
    points: float | None = None


class GenerateBody(BaseModel):
    title: str = ""
    className: str = ""
    complexity: Literal["facile", "moyen", "difficile"] = "moyen"
    courseContext: str = ""
    hasCourseFile: bool = False
    rubric: list[RubricItem] = []


@router.post("/evaluations/generate", dependencies=[Depends(LIMIT_AI)])
async def generate(body: GenerateBody, _teacher: CurrentTeacher):
    title, class_name, course = body.title.strip(), body.className.strip(), body.courseContext.strip()
    if not title or not class_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Titre et classe sont requis.")
    if not course and not body.hasCourseFile:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ajoutez un cours PDF ou une description du cours.")
    rubric_text = (
        ", ".join(
            f"{(r.label or '').strip()} ({r.points:g} pts)" for r in body.rubric if (r.label or "").strip() and r.points
        )
        or "Aucun barème fourni."
    )
    try:
        payload = await generate_evaluation(
            title=title,
            class_name=class_name,
            complexity=body.complexity,
            course_context=course[:20000],
            rubric_text=rubric_text,
        )
    except AIError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
    return {"ok": True, **payload}


# ---------------------------------------------------------------- correction


def _references(test: Test) -> tuple[float, str, str, str]:
    """(barème total, bloc questions+barème, texte imprimé du sujet, correction de repli)."""
    questions = json.dumps(test.questions or [], ensure_ascii=False, indent=2)
    rubric = json.dumps(test.rubric or [], ensure_ascii=False, indent=2)
    total = float(test.total_points or 20) or 20.0
    rubric_block = "\n".join(
        [
            "Questions (structure officielle):",
            questions,
            "",
            "Barème / rubrique (points par exercice — à respecter pour les champs max):",
            rubric,
        ]
    )
    printed = "\n".join(["Sujet imprimé (questions):", questions])
    fallback = "\n".join(["Questions:", questions, "", "Barème:", rubric])
    return total, rubric_block, printed, fallback


async def _save_copy_result(
    teacher: Teacher,
    test_id: UUID,
    copy: TestCopy,
    grade: corr.GradeResult,
    ocr: corr.OcrResult,
    elapsed_ms: int,
) -> None:
    """Correction + statut de la copie + usage du quota : une transaction par copie."""
    passages = corr.dedupe_passages(
        [
            *({**p, "source": "ocr"} for p in ocr.unreadable_parts),
            *({**p, "source": "notation"} for p in grade.notation_incertaine),
        ]
    )
    values = {
        "ai_analysis_json": {
            "feedback": grade.feedback,
            "per_exercise": grade.per_exercise,
            "has_content": grade.has_content,
            "content_density": grade.content_density,
            "passages_a_verifier": passages,
        },
        "ai_confidence_score": grade.confidence,
        "ai_total_points": grade.score,
        "ai_processed_at": datetime.now(UTC),
        "processing_status": "completed",
        "processing_error": None,
        "processing_time_ms": elapsed_ms,
        "validation_status": "pending",
        "is_validated": False,
    }
    async with SessionLocal() as s:
        await s.execute(
            insert(CopyCorrection)
            .values(copy_id=copy.id, test_id=test_id, student_id=copy.student_id, teacher_id=teacher.id, **values)
            .on_conflict_do_update(index_elements=["copy_id"], set_=values)
        )
        await s.execute(update(TestCopy).where(TestCopy.id == copy.id).values(status="pending_review"))
        record_copy_usage(s, teacher, copy.id, test_id)
        await s.commit()


@router.post("/evaluations/{evaluation_id}/correct", dependencies=[Depends(LIMIT_AI)])
async def correct_evaluation(
    evaluation_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    test = await db.scalar(select(Test).where(Test.id == evaluation_id, Test.teacher_id == teacher.id))
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Évaluation introuvable.")
    if not test.correction_file_url:
        raise HTTPException(status.HTTP_409_CONFLICT, "Correction type manquante.")
    scanned = list(
        await db.scalars(
            select(TestCopy)
            .where(
                TestCopy.test_id == test.id, TestCopy.teacher_id == teacher.id, TestCopy.scanned_image_url.is_not(None)
            )
            .order_by(TestCopy.created_at)
        )
    )
    if not scanned:
        raise HTTPException(status.HTTP_409_CONFLICT, "Aucune feuille élève à corriger (scan manquant).")
    if not get_settings().openai_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Correction IA non configurée (OPENAI_API_KEY manquante)."
        )

    # Quota de l'offre : copies déjà comptées recorrigées gratuitement, nouvelles dans la limite du solde.
    quota = await get_teacher_quota(db, teacher)
    if quota.is_expired():
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Votre accès gratuit ({quota.plan_label}) de 30 jours est terminé. "
            "Passez à une offre supérieure pour continuer à corriger.",
        )
    counted = await copies_already_counted(db, teacher.id, [c.id for c in scanned], quota.window_start)
    keep_ids, skipped_ids = select_within_quota([c.id for c in scanned], quota, counted)
    if not keep_ids:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Quota atteint : {quota.used}/{quota.limit} copies corrigées avec le {quota.plan_label}. "
            "Passez à une offre supérieure pour continuer.",
        )
    keep = set(keep_ids)
    candidates = [c for c in scanned if c.id in keep]
    # Fin de la transaction de lecture : rien ne reste ouvert pendant les appels IA (plusieurs minutes).
    await db.commit()

    total_points, rubric_block, printed, correction_fallback = _references(test)
    correction_text = correction_fallback
    if corr.is_likely_image_url(test.correction_file_url):
        try:
            correction_ocr = await corr.ocr_image(await signed_storage_url(test.correction_file_url), "")
            correction_text = correction_ocr.text or correction_fallback
        except AIError:
            logger.warning("OCR de la correction type impossible : repli sur questions + barème")

    subject = str(test.subject or "math")
    semaphore = asyncio.Semaphore(COPY_CONCURRENCY)

    async def correct_one(copy: TestCopy) -> str | None:
        """Renvoie None si la copie est corrigée, sinon le message d'échec."""
        async with semaphore:
            started = time.monotonic()
            try:
                if corr.is_likely_pdf_url(copy.scanned_image_url):
                    raise AIError(
                        "Fichier PDF : l’OCR attend une image (JPG ou PNG). "
                        "Réimportez une photo ou un scan exporté en image, pas en PDF."
                    )
                ocr = await corr.ocr_image(await signed_storage_url(copy.scanned_image_url), printed)
                hints = build_math_assist_hints(ocr.text) if subject_uses_math_assist(subject) else ""
                grade = await corr.grade_copy(
                    student_ocr=ocr,
                    correction_text=correction_text,
                    rubric_block=rubric_block,
                    total_points=total_points,
                    subject=subject,
                    math_hints=hints,
                )
                await _save_copy_result(teacher, test.id, copy, grade, ocr, int((time.monotonic() - started) * 1000))
                return None
            except AIError as e:
                return f"Copie {str(copy.id)[:8]}: {e}"
            except Exception:
                logger.exception("Correction de la copie %s impossible", copy.id)
                return f"Copie {str(copy.id)[:8]}: échec inattendu, réessayez."

    outcomes = await asyncio.gather(*(correct_one(c) for c in candidates))
    failures = [f"Copie {str(cid)[:8]}: quota de copies atteint ({quota.plan_label})." for cid in skipped_ids]
    failures += [msg for msg in outcomes if msg]

    corrected_total = await db.scalar(
        select(func.count()).select_from(CopyCorrection).where(CopyCorrection.test_id == test.id)
    )
    await db.execute(
        update(Test)
        .where(Test.id == test.id, Test.teacher_id == teacher.id)
        .values(copies_corrected=corrected_total or 0)
    )
    await db.commit()

    return {
        "ok": True,
        "corrected": sum(1 for msg in outcomes if msg is None),
        "total": len(scanned),
        "failures": failures,
        "quota": (await get_teacher_quota(db, teacher)).to_dict(),
    }
