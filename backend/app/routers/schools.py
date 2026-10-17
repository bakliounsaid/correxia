"""
Gestion des enseignants par l'admin d'établissement (ex-routes Next /api/dashboard/school/teachers).
Le compte Auth est géré par l'Admin API Supabase (hors transaction SQL) : on le crée/modifie
au plus près du commit et on compense (suppression du compte) si la transaction échoue.
"""

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.deps import DbSession, SchoolAdmin
from app.models import Class, ClassTeacher, Teacher, User
from app.rate_limit import LIMIT_WRITE
from app.supabase_admin import (
    SupabaseAdminError,
    create_auth_user,
    delete_auth_user,
    update_auth_user,
)

logger = logging.getLogger("correxia.schools")

router = APIRouter(prefix="/school/teachers", tags=["school-teachers"])

Subject = Literal["math", "physics", "science"]


class TeacherBody(BaseModel):
    firstName: str = Field(min_length=1, max_length=128)
    lastName: str = Field(min_length=1, max_length=128)
    email: EmailStr
    subject: Subject = "math"
    classNames: list[str] = []

    @field_validator("firstName", "lastName", mode="before")
    @classmethod
    def strip_names(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("classNames")
    @classmethod
    def clean_class_names(cls, v: list[str]) -> list[str]:
        names = list(dict.fromkeys(n.strip() for n in v if n and n.strip()))
        if not names:
            raise ValueError("Vous devez attribuer au moins une classe à l’enseignant.")
        if any(len(n) > 120 for n in names):
            raise ValueError("Nom de classe trop long (120 caractères max).")
        return names

    @property
    def full_name(self) -> str:
        return f"{self.firstName} {self.lastName}".strip()

    @property
    def normalized_email(self) -> str:
        return str(self.email).strip().lower()


class TeacherCreate(TeacherBody):
    password: str = Field(min_length=6, max_length=72)


class TeacherUpdate(TeacherBody):
    password: str | None = Field(default=None, max_length=72)


async def _ensure_school_classes(db: AsyncSession, school_id: UUID, names: list[str]) -> list[UUID]:
    await db.execute(
        insert(Class)
        .values([{"school_id": school_id, "name": n} for n in names])
        .on_conflict_do_nothing(index_elements=["school_id", "name"])
    )
    return list(await db.scalars(select(Class.id).where(Class.school_id == school_id, Class.name.in_(names))))


async def _assign_classes(db: AsyncSession, teacher_id: UUID, class_ids: list[UUID]) -> None:
    """Remplace les classes de l'enseignant (dans la transaction en cours)."""
    await db.execute(delete(ClassTeacher).where(ClassTeacher.teacher_id == teacher_id))
    for class_id in class_ids:
        db.add(ClassTeacher(class_id=class_id, teacher_id=teacher_id))


def _teacher_payload(teacher: Teacher, body: TeacherBody) -> dict:
    return {
        "id": teacher.id,
        "full_name": body.full_name,
        "email": body.normalized_email,
        "subject": body.subject,
        "class_name": body.classNames[0],
        "class_count": len(body.classNames),
    }


async def _remove_created_account(user_id: str) -> None:
    """Compensation : supprime le compte créé (et les lignes posées par le trigger)."""
    try:
        async with SessionLocal() as s:
            await s.execute(delete(Teacher).where(Teacher.user_id == UUID(user_id)))
            await s.execute(delete(User).where(User.id == UUID(user_id)))
            await s.commit()
    except Exception:
        logger.exception("Compensation : lignes du compte %s non supprimées", user_id)
    await delete_auth_user(user_id)


@router.post("", dependencies=[Depends(LIMIT_WRITE)])
async def create_school_teacher(
    body: TeacherCreate,
    ctx: SchoolAdmin,
    db: DbSession,
):
    school_id = ctx.school.id
    try:
        user_id = await create_auth_user(
            body.normalized_email,
            body.password,
            {
                "account_type": "teacher_independent",
                "first_name": body.firstName,
                "last_name": body.lastName,
                "subject": body.subject,
            },
        )
    except SupabaseAdminError as e:
        raise HTTPException(e.status_code, e.message) from e

    try:
        teacher = await db.scalar(select(Teacher).where(Teacher.user_id == UUID(user_id)))
        if not teacher:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR, "Compte créé mais profil enseignant introuvable."
            )

        # Rattachement à l'établissement + profil + classes : une seule transaction.
        teacher.school_id = school_id
        teacher.is_independent = False
        teacher.subject = body.subject
        await db.execute(
            update(User).where(User.id == teacher.user_id).values(full_name=body.full_name, role="teacher")
        )
        class_ids = await _ensure_school_classes(db, school_id, body.classNames)
        await _assign_classes(db, teacher.id, class_ids)
        await db.commit()
    except BaseException:
        await db.rollback()
        await _remove_created_account(user_id)
        raise

    return {"ok": True, "teacher": _teacher_payload(teacher, body)}


async def _get_school_teacher(db: AsyncSession, teacher_id: UUID, school_id: UUID) -> Teacher:
    teacher = await db.scalar(select(Teacher).where(Teacher.id == teacher_id, Teacher.school_id == school_id))
    if not teacher:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enseignant introuvable.")
    return teacher


@router.patch("/{teacher_id}", dependencies=[Depends(LIMIT_WRITE)])
async def update_school_teacher(
    teacher_id: UUID,
    body: TeacherUpdate,
    ctx: SchoolAdmin,
    db: DbSession,
):
    password = (body.password or "").strip() or None
    if password and len(password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Le mot de passe doit contenir au moins 6 caractères.")
    teacher = await _get_school_teacher(db, teacher_id, ctx.school.id)

    # 1) Écritures SQL envoyées mais non validées (une contrainte, ex. email déjà pris, échoue ici).
    try:
        await db.execute(
            update(User)
            .where(User.id == teacher.user_id)
            .values(full_name=body.full_name, email=body.normalized_email, role="teacher")
        )
        teacher.subject = body.subject
        class_ids = await _ensure_school_classes(db, ctx.school.id, body.classNames)
        await _assign_classes(db, teacher.id, class_ids)
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet email.") from e

    # 2) Compte Auth : si l'Admin API refuse, la transaction SQL est annulée.
    try:
        await update_auth_user(str(teacher.user_id), email=body.normalized_email, password=password)
    except SupabaseAdminError as e:
        await db.rollback()
        raise HTTPException(e.status_code, e.message) from e

    await db.commit()
    return {"ok": True, "teacher": _teacher_payload(teacher, body)}


@router.delete("/{teacher_id}", dependencies=[Depends(LIMIT_WRITE)])
async def detach_school_teacher(
    teacher_id: UUID,
    ctx: SchoolAdmin,
    db: DbSession,
):
    """Retire l'enseignant de l'établissement (le compte devient indépendant)."""
    teacher = await _get_school_teacher(db, teacher_id, ctx.school.id)
    await db.execute(delete(ClassTeacher).where(ClassTeacher.teacher_id == teacher.id))
    teacher.school_id = None
    teacher.is_independent = True
    await db.commit()
    return {"ok": True}
