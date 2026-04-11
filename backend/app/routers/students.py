from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import Select, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_teacher
from app.models import ClassTeacher, Student, Teacher
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate

router = APIRouter(prefix="/students", tags=["students"])


def _class_ids_for_teacher(teacher_id: UUID) -> Select:
    return select(ClassTeacher.class_id).where(ClassTeacher.teacher_id == teacher_id)


@router.get("", response_model=list[StudentRead])
async def list_students(
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    class_ids_q = _class_ids_for_teacher(teacher.id)
    result = await db.execute(
        select(Student)
        .where(Student.class_id.in_(class_ids_q))
        .order_by(Student.last_name, Student.first_name)
    )
    return result.scalars().all()


@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
async def create_student(
    body: StudentCreate,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    raw_id = (body.id_interne or "").strip()
    row = Student(
        school_id=teacher.school_id,
        first_name=body.first_name,
        last_name=body.last_name,
        id_interne=raw_id or None,
        class_id=body.class_id,
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
    class_ids_q = _class_ids_for_teacher(teacher.id)
    result = await db.execute(
        select(Student).where(
            Student.id == student_id, Student.class_id.in_(class_ids_q)
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
    class_ids_q = _class_ids_for_teacher(teacher.id)
    result = await db.execute(
        select(Student).where(
            Student.id == student_id, Student.class_id.in_(class_ids_q)
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Élève introuvable")
    data = body.model_dump(exclude_unset=True)
    if "id_interne" in data and data["id_interne"] is not None:
        s = str(data["id_interne"]).strip()
        data["id_interne"] = s or None
    for k, v in data.items():
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
    class_ids_q = _class_ids_for_teacher(teacher.id)
    result = await db.execute(
        delete(Student).where(
            Student.id == student_id, Student.class_id.in_(class_ids_q)
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Élève introuvable")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
