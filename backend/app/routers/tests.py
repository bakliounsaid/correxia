from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_teacher
from app.models import Teacher, Test
from app.schemas.test import TestCreate, TestRead, TestUpdate

router = APIRouter(prefix="/tests", tags=["tests"])


@router.get("", response_model=list[TestRead])
async def list_tests(
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Test).where(Test.teacher_id == teacher.id).order_by(Test.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=TestRead, status_code=status.HTTP_201_CREATED)
async def create_test(
    body: TestCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    row = Test(
        teacher_id=teacher.id,
        school_id=teacher.school_id,
        title=body.title,
        description=body.description,
        subject=body.subject,
        level=body.level,
        duration_minutes=body.duration_minutes,
        total_points=body.total_points,
        questions=body.questions if isinstance(body.questions, list) else body.questions,
        rubric=body.rubric if isinstance(body.rubric, list) else body.rubric,
        status=body.status,
    )
    db.add(row)
    teacher.tests_created += 1
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/{test_id}", response_model=TestRead)
async def get_test(
    test_id: UUID,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Test).where(Test.id == test_id, Test.teacher_id == teacher.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    return row


@router.patch("/{test_id}", response_model=TestRead)
async def update_test(
    test_id: UUID,
    body: TestUpdate,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Test).where(Test.id == test_id, Test.teacher_id == teacher.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: UUID,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Test).where(Test.id == test_id, Test.teacher_id == teacher.id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
