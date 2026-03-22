from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_teacher
from app.models import Student, Teacher
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=list[StudentRead])
async def list_students(
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student)
        .where(Student.teacher_id == teacher.id)
        .order_by(Student.last_name, Student.first_name)
    )
    return list(result.scalars().all())


@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
async def create_student(
    body: StudentCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    row = Student(
        teacher_id=teacher.id,
        school_id=teacher.school_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        class_name=body.class_name,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/{student_id}", response_model=StudentRead)
async def get_student(
    student_id: UUID,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(
            Student.id == student_id, Student.teacher_id == teacher.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Élève introuvable")
    return row


@router.patch("/{student_id}", response_model=StudentRead)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(
            Student.id == student_id, Student.teacher_id == teacher.id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Élève introuvable")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: UUID,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Student).where(
            Student.id == student_id, Student.teacher_id == teacher.id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Élève introuvable")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
