"""
Évaluations et copies d'un enseignant (ex-routes Next /api/dashboard/evaluations/*).
Chaque route écrit dans une seule transaction : `await db.commit()` à la fin, rollback sinon.
"""

import secrets
import string
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import CurrentTeacher, DbSession
from app.models import (
    Class,
    ClassTeacher,
    CopyCorrection,
    Student,
    Teacher,
    Test,
    TestCopy,
    TestSource,
)
from app.rate_limit import LIMIT_READ, LIMIT_WRITE
from app.supabase_admin import remove_storage_objects, storage_path_from_url

router = APIRouter(prefix="/evaluations", tags=["evaluations"])

TEST_STATUSES = {"draft", "created", "in_progress", "completed"}
COPY_STATUSES = {
    "generated",
    "printed",
    "in_exam",
    "submitted",
    "pending_review",
    "auto_corrected",
    "validated",
    "archived",
}
SUBJECT_LABEL = {"math": "Mathématiques", "physics": "Physique", "science": "Sciences"}

EVALUATION_FIELDS = (
    "id",
    "title",
    "subject",
    "level",
    "class_name",
    "status",
    "created_at",
    "copies_generated",
    "copies_corrected",
    "copies_submitted",
    "total_points",
    "duration_minutes",
    "questions",
    "rubric",
    "subject_file_url",
    "subject_file_name",
    "correction_file_url",
    "correction_file_name",
)


def _now() -> datetime:
    return datetime.now(UTC)


async def _get_test(db: AsyncSession, evaluation_id: UUID, teacher: Teacher) -> Test:
    test = await db.scalar(select(Test).where(Test.id == evaluation_id, Test.teacher_id == teacher.id))
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Évaluation introuvable.")
    return test


def _target_class_name(test: Test) -> str:
    return (test.class_name or test.level or "").strip()


async def _teacher_target_class_ids(db: AsyncSession, teacher: Teacher, class_name: str) -> list[UUID]:
    """Classes de l'enseignant portant le nom de la classe du test."""
    rows = await db.scalars(
        select(Class.id)
        .join(ClassTeacher, ClassTeacher.class_id == Class.id)
        .where(ClassTeacher.teacher_id == teacher.id, Class.name == class_name)
    )
    return list(rows)


# ---------------------------------------------------------------- évaluation


class StoredItem(BaseModel):
    """Exercice ou ligne de barème tel qu'enregistré (format de src/lib/evaluation-questions.ts)."""

    model_config = {"extra": "allow"}
    points: float = Field(ge=0)


class EvaluationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    class_name: str = Field(min_length=1, max_length=120)
    duration_minutes: int = Field(ge=1, le=600)
    questions: list[StoredItem] = Field(min_length=1, max_length=50)
    rubric: list[StoredItem] = Field(min_length=1, max_length=50)
    subject_file_url: str | None = Field(default=None, max_length=2048)
    subject_file_name: str | None = Field(default=None, max_length=255)

    @field_validator("title", "class_name", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v


@router.post("", dependencies=[Depends(LIMIT_WRITE)])
async def create_evaluation(body: EvaluationCreate, teacher: CurrentTeacher, db: DbSession):
    """Crée l'évaluation et l'enregistrement de son sujet PDF dans une même transaction."""
    if body.subject_file_url:
        db.add(
            TestSource(
                teacher_id=teacher.id,
                school_id=teacher.school_id,
                file_name=body.subject_file_name or "sujet.pdf",
                file_url=body.subject_file_url,
                file_type="pdf",
                upload_status="completed",
            )
        )
    test = Test(
        teacher_id=teacher.id,
        school_id=teacher.school_id,
        title=body.title,
        subject="math",
        level="Terminale",
        class_name=body.class_name,
        duration_minutes=body.duration_minutes,
        # Total recalculé côté serveur : le barème fait foi.
        total_points=round(sum(r.points for r in body.rubric)),
        questions=[q.model_dump() for q in body.questions],
        rubric=[r.model_dump() for r in body.rubric],
        subject_file_url=body.subject_file_url,
        subject_file_name=body.subject_file_name,
        status="created",
    )
    db.add(test)
    await db.commit()
    return {"ok": True, "evaluation": {f: getattr(test, f) for f in EVALUATION_FIELDS}}


class EvaluationPatch(BaseModel):
    title: str | None = None
    subject: str | None = None
    class_name: str | None = None
    level: str | None = None
    status: str | None = None
    total_points: int | None = None
    duration_minutes: int | None = None
    questions: Any = None
    rubric: Any = None
    subject_file_url: str | None = None
    subject_file_name: str | None = None
    correction_file_url: str | None = None
    correction_file_name: str | None = None


@router.patch("/{evaluation_id}", dependencies=[Depends(LIMIT_WRITE)])
async def update_evaluation(
    evaluation_id: UUID,
    body: EvaluationPatch,
    teacher: CurrentTeacher,
    db: DbSession,
):
    patch: dict[str, Any] = {}
    for key in body.model_fields_set:
        value = getattr(body, key)
        if key in ("questions", "rubric"):
            patch[key] = value
        elif value is not None:
            patch[key] = value.strip() if isinstance(value, str) else value
    if not patch:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aucune donnée à modifier.")
    if "status" in patch and patch["status"] not in TEST_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Statut d'évaluation invalide.")

    test = await _get_test(db, evaluation_id, teacher)
    current = (test.status or "").lower()
    correction_only = set(patch) <= {"correction_file_url", "correction_file_name"}
    if not (current == "created" or (current == "in_progress" and correction_only)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Pendant l’examen, seuls le fichier et le nom de la correction type peuvent être mis à jour."
            if current == "in_progress"
            else "Modification autorisée uniquement pour les tests au statut créée, "
            "ou remplacement de la correction type tant que l’examen est en cours.",
        )

    for key, value in patch.items():
        setattr(test, key, value)
    await db.commit()
    return {"ok": True, "evaluation": {f: getattr(test, f) for f in EVALUATION_FIELDS}}


@router.delete("/{evaluation_id}", dependencies=[Depends(LIMIT_WRITE)])
async def delete_evaluation(
    evaluation_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    test = await _get_test(db, evaluation_id, teacher)
    urls = [u for u in (test.subject_file_url, test.correction_file_url) if u]
    storage_paths = [p for p in (storage_path_from_url(u) for u in urls) if p]

    # Test + sources liées dans la même transaction (copies/corrections : ON DELETE CASCADE).
    if urls:
        await db.execute(delete(TestSource).where(TestSource.teacher_id == teacher.id, TestSource.file_url.in_(urls)))
    await db.delete(test)
    await db.commit()

    # Fichiers : best-effort après le commit (le stockage n'est pas transactionnel).
    warning = None
    storage_error = await remove_storage_objects(storage_paths)
    if storage_error:
        warning = f"Évaluation supprimée, mais certains fichiers n'ont pas pu être supprimés ({storage_error})."
    return {"ok": True, "warning": warning}


# ---------------------------------------------------------------- lancement


@router.get("/{evaluation_id}/start", dependencies=[Depends(LIMIT_READ)])
async def list_start_students(
    evaluation_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    test = await _get_test(db, evaluation_id, teacher)
    if not test.correction_file_url:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ajoutez la correction type avant de commencer le test.")

    class_ids = await _teacher_target_class_ids(db, teacher, _target_class_name(test))
    if not class_ids:
        return {"ok": True, "students": []}

    rows = await db.execute(
        select(Student.id, Student.first_name, Student.last_name, Class.name)
        .outerjoin(Class, Class.id == Student.class_id)
        .where(Student.class_id.in_(class_ids))
        .order_by(Student.last_name)
    )
    students = [
        {"id": r.id, "first_name": r.first_name, "last_name": r.last_name, "class_name": r.name or "—"} for r in rows
    ]
    return {"ok": True, "students": students}


class StartBody(BaseModel):
    studentIds: list[UUID] = []


def _unique_test_id(test_id: UUID, student_id: UUID) -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"CX-{str(test_id)[:8].upper()}-{str(student_id)[:8].upper()}-{suffix}"


@router.post("/{evaluation_id}/start", dependencies=[Depends(LIMIT_WRITE)])
async def start_evaluation(
    evaluation_id: UUID,
    body: StartBody,
    teacher: CurrentTeacher,
    db: DbSession,
):
    test = await _get_test(db, evaluation_id, teacher)
    if not test.correction_file_url:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ajoutez la correction type avant de commencer le test.")
    requested = list(dict.fromkeys(body.studentIds))
    if not requested:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aucun élève sélectionné.")

    class_ids = await _teacher_target_class_ids(db, teacher, _target_class_name(test))
    if not class_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La classe du test n'est pas liée à cet enseignant.")

    allowed = set(
        await db.scalars(select(Student.id).where(Student.class_id.in_(class_ids), Student.id.in_(requested)))
    )
    selected = [sid for sid in requested if sid in allowed]
    if not selected:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Élèves non autorisés pour ce test.")

    existing = set(
        await db.scalars(
            select(TestCopy.student_id).where(TestCopy.test_id == test.id, TestCopy.student_id.in_(selected))
        )
    )
    to_create = [sid for sid in selected if sid not in existing]

    # Création des copies + mise à jour du test : une seule transaction.
    for sid in to_create:
        db.add(
            TestCopy(
                test_id=test.id,
                student_id=sid,
                teacher_id=teacher.id,
                school_id=teacher.school_id,
                unique_test_id=_unique_test_id(test.id, sid),
                status="generated",
            )
        )
    await db.flush()
    total = await db.scalar(select(func.count()).select_from(TestCopy).where(TestCopy.test_id == test.id))
    test.status = "in_progress"
    test.copies_generated = total or 0
    await db.commit()

    rows = await db.execute(
        select(
            TestCopy.id, TestCopy.unique_test_id, TestCopy.student_id, Student.first_name, Student.last_name, Class.name
        )
        .join(Student, Student.id == TestCopy.student_id)
        .outerjoin(Class, Class.id == Student.class_id)
        .where(TestCopy.test_id == test.id, TestCopy.student_id.in_(selected))
    )
    copies = [
        {
            "copy_id": r.id,
            "unique_test_id": r.unique_test_id,
            "student_id": r.student_id,
            "first_name": r.first_name or "",
            "last_name": r.last_name or "",
            "class_name": r.name or "—",
        }
        for r in rows
    ]
    return {
        "ok": True,
        "created": len(to_create),
        "already_exists": len(selected) - len(to_create),
        "total_copies": total or 0,
        "test": {
            "id": test.id,
            "title": test.title or "Évaluation",
            "level": test.class_name or test.level or "",
            "duration_minutes": test.duration_minutes,
            "questions": test.questions or [],
        },
        "copies": copies,
    }


@router.post("/{evaluation_id}/reset-imports", dependencies=[Depends(LIMIT_WRITE)])
async def reset_imports(
    evaluation_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    test = await _get_test(db, evaluation_id, teacher)
    imported = await db.scalar(
        select(func.count())
        .select_from(TestCopy)
        .where(
            TestCopy.test_id == test.id,
            TestCopy.teacher_id == teacher.id,
            TestCopy.scanned_image_url.is_not(None),
        )
    )

    # Copies vidées + corrections supprimées + compteurs remis à zéro : tout ou rien.
    await db.execute(
        update(TestCopy)
        .where(TestCopy.test_id == test.id, TestCopy.teacher_id == teacher.id)
        .values(scanned_image_url=None, scanned_uploaded_at=None, status="generated")
    )
    await db.execute(
        delete(CopyCorrection).where(CopyCorrection.test_id == test.id, CopyCorrection.teacher_id == teacher.id)
    )
    test.status = "in_progress"
    test.copies_submitted = 0
    test.copies_corrected = 0
    await db.commit()
    return {"ok": True, "reset_imported_sheets": imported or 0}


# ---------------------------------------------------------------- copies


@router.get("/{evaluation_id}/copies", dependencies=[Depends(LIMIT_READ)])
async def list_copies(
    evaluation_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    rows = await db.execute(
        select(TestCopy.id, TestCopy.created_at, TestCopy.status, TestCopy.scanned_image_url, TestCopy.unique_test_id)
        .where(TestCopy.test_id == evaluation_id, TestCopy.teacher_id == teacher.id)
        .order_by(TestCopy.created_at)
    )
    return {"ok": True, "copies": [dict(r._mapping) for r in rows]}


async def _get_copy(db: AsyncSession, evaluation_id: UUID, copy_id: UUID, teacher: Teacher) -> TestCopy:
    copy = await db.scalar(
        select(TestCopy).where(
            TestCopy.id == copy_id, TestCopy.test_id == evaluation_id, TestCopy.teacher_id == teacher.id
        )
    )
    if not copy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Copie introuvable.")
    return copy


class CopyPatch(BaseModel):
    status: str | None = None
    scanned_image_url: str | None = None
    pdf_url: str | None = None


@router.patch("/{evaluation_id}/copies/{copy_id}", dependencies=[Depends(LIMIT_WRITE)])
async def update_copy(
    evaluation_id: UUID,
    copy_id: UUID,
    body: CopyPatch,
    teacher: CurrentTeacher,
    db: DbSession,
):
    fields = body.model_fields_set
    if not fields:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aucune donnée à modifier.")
    copy = await _get_copy(db, evaluation_id, copy_id, teacher)
    if "status" in fields and body.status is not None:
        new_status = body.status.strip()
        if new_status not in COPY_STATUSES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Statut de copie invalide.")
        copy.status = new_status
    if "scanned_image_url" in fields:
        copy.scanned_image_url = body.scanned_image_url
        copy.scanned_uploaded_at = _now() if body.scanned_image_url else None
    if "pdf_url" in fields:
        copy.pdf_url = body.pdf_url
    await db.commit()
    return {
        "ok": True,
        "copy": {
            "id": copy.id,
            "status": copy.status,
            "unique_test_id": copy.unique_test_id,
            "pdf_url": copy.pdf_url,
            "scanned_image_url": copy.scanned_image_url,
            "created_at": copy.created_at,
        },
    }


@router.delete("/{evaluation_id}/copies/{copy_id}", dependencies=[Depends(LIMIT_WRITE)])
async def delete_copy(
    evaluation_id: UUID,
    copy_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    copy = await _get_copy(db, evaluation_id, copy_id, teacher)
    await db.delete(copy)
    await db.flush()
    remaining = await db.scalar(
        select(func.count())
        .select_from(TestCopy)
        .where(TestCopy.test_id == evaluation_id, TestCopy.teacher_id == teacher.id)
    )
    await db.execute(
        update(Test)
        .where(Test.id == evaluation_id, Test.teacher_id == teacher.id)
        .values(copies_generated=remaining or 0)
    )
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- revue


def _parse_passages(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        zone = str(item.get("zone") or "").strip()
        detail = str(item.get("detail") or "").strip()
        if not zone and not detail:
            continue
        row = {"zone": zone or "Copie", "detail": detail or zone}
        source = str(item.get("source") or "").strip()
        if source:
            row["source"] = source
        out.append(row)
    return out


def _to_number(value: Any, default: float) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return n if n == n and n not in (float("inf"), float("-inf")) else default


@router.get("/{evaluation_id}/copies/{copy_id}/review-data", dependencies=[Depends(LIMIT_READ)])
async def review_data(
    evaluation_id: UUID,
    copy_id: UUID,
    teacher: CurrentTeacher,
    db: DbSession,
):
    row = (
        await db.execute(
            select(TestCopy, Test, Student, Class.name.label("class_name"), CopyCorrection)
            .join(Test, Test.id == TestCopy.test_id)
            .outerjoin(Student, Student.id == TestCopy.student_id)
            .outerjoin(Class, Class.id == Student.class_id)
            .outerjoin(CopyCorrection, CopyCorrection.copy_id == TestCopy.id)
            .where(
                TestCopy.id == copy_id,
                TestCopy.test_id == evaluation_id,
                TestCopy.teacher_id == teacher.id,
                Test.teacher_id == teacher.id,
            )
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Copie introuvable.")
    copy, test, student, class_name, corr = row
    analysis = corr.ai_analysis_json if corr and isinstance(corr.ai_analysis_json, dict) else {}

    per_exercise = []
    raw_items = analysis.get("per_exercise")
    for i, x in enumerate(raw_items if isinstance(raw_items, list) else []):
        x = x if isinstance(x, dict) else {}
        max_value = _to_number(x.get("max", x.get("max_points", x.get("total", 20))), 20)
        per_exercise.append(
            {
                "label": str(x.get("label") or f"Exercice {i + 1}"),
                "score": _to_number(x.get("score", x.get("points", x.get("value", 0))), 0),
                "max": max_value if max_value > 0 else 20,
                "comment": str(x.get("comment") or ""),
            }
        )

    payload = {
        "copyId": copy.id,
        "studentName": f"{student.first_name} {student.last_name}".strip() if student else "Élève",
        "testTitle": test.title,
        "subjectLabel": SUBJECT_LABEL.get((test.subject or "math").lower(), test.subject),
        "className": class_name or test.level,
        "status": copy.status,
        "previewUrl": copy.scanned_image_url or copy.pdf_url,
        "aiScore": corr.ai_total_points if corr else None,
        "aiConfidence": corr.ai_confidence_score if corr else None,
        "aiFeedback": str(analysis.get("feedback") or ""),
        "aiPerExercise": per_exercise,
        "validatedScore": corr.teacher_validated_points if corr else None,
        "passagesAVerifier": _parse_passages(analysis.get("passages_a_verifier")),
    }
    return {"ok": True, "payload": payload}


class ExerciseScore(BaseModel):
    label: str | None = None
    score: float | None = None
    max: float | None = None
    comment: str | None = None


class ReviewBody(BaseModel):
    teacher_validated_points: float
    teacher_feedback: str | None = None
    teacher_comments: str | None = None
    acceptAi: bool = False
    perExerciseTeacher: list[ExerciseScore] = []


@router.patch("/{evaluation_id}/copies/{copy_id}/review", dependencies=[Depends(LIMIT_WRITE)])
async def validate_review(
    evaluation_id: UUID,
    copy_id: UUID,
    body: ReviewBody,
    teacher: CurrentTeacher,
    db: DbSession,
):
    corr = await db.scalar(
        select(CopyCorrection).where(
            CopyCorrection.copy_id == copy_id,
            CopyCorrection.test_id == evaluation_id,
            CopyCorrection.teacher_id == teacher.id,
        )
    )
    if not corr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Correction introuvable.")

    unchanged = abs((corr.ai_total_points or 0) - body.teacher_validated_points) < 0.0001
    analysis = dict(corr.ai_analysis_json) if isinstance(corr.ai_analysis_json, dict) else {}
    analysis["teacher_per_exercise"] = [
        {
            "label": x.label or f"Exercice {i + 1}",
            "score": x.score or 0,
            "max": x.max or 0,
            "comment": x.comment or "",
        }
        for i, x in enumerate(body.perExerciseTeacher)
    ]

    # Validation de la copie + statut + compteurs du test : une seule transaction.
    corr.teacher_validated_points = body.teacher_validated_points
    corr.teacher_feedback = (body.teacher_feedback or "").strip() or None
    corr.teacher_comments = (body.teacher_comments or "").strip() or None
    corr.ai_analysis_json = analysis
    corr.teacher_corrected_at = _now()
    corr.is_validated = True
    corr.validation_status = "accepted_ai" if body.acceptAi or unchanged else "modified"

    await db.execute(
        update(TestCopy)
        .where(TestCopy.id == copy_id, TestCopy.test_id == evaluation_id, TestCopy.teacher_id == teacher.id)
        .values(status="validated")
    )
    await db.flush()

    validated = await db.scalar(
        select(func.count())
        .select_from(CopyCorrection)
        .where(
            CopyCorrection.test_id == evaluation_id,
            CopyCorrection.teacher_id == teacher.id,
            CopyCorrection.is_validated.is_(True),
        )
    )
    pending_deposited = await db.scalar(
        select(func.count())
        .select_from(TestCopy)
        .outerjoin(CopyCorrection, CopyCorrection.copy_id == TestCopy.id)
        .where(
            TestCopy.test_id == evaluation_id,
            TestCopy.teacher_id == teacher.id,
            TestCopy.scanned_image_url.is_not(None),
            func.coalesce(CopyCorrection.is_validated, False).is_(False),
        )
    )
    deposited = await db.scalar(
        select(func.count())
        .select_from(TestCopy)
        .where(
            TestCopy.test_id == evaluation_id,
            TestCopy.teacher_id == teacher.id,
            TestCopy.scanned_image_url.is_not(None),
        )
    )
    all_validated = bool(deposited) and pending_deposited == 0

    test_update = update(Test).where(Test.id == evaluation_id, Test.teacher_id == teacher.id)
    await db.execute(test_update.values(copies_corrected=validated or 0))
    if all_validated:
        await db.execute(
            test_update.where(Test.status.in_(["draft", "created", "in_progress"])).values(status="completed")
        )
    await db.commit()

    return {
        "ok": True,
        "review": {
            "copy_id": corr.copy_id,
            "teacher_validated_points": corr.teacher_validated_points,
            "ai_total_points": corr.ai_total_points,
            "ai_confidence_score": corr.ai_confidence_score,
            "is_validated": corr.is_validated,
            "validation_status": corr.validation_status,
        },
        "evaluationCompleted": all_validated,
    }
