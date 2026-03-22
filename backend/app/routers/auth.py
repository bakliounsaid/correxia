from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Teacher, User
from app.schemas.auth import MeResponse, TeacherBrief, TokenResponse, UserBrief, UserLogin, UserRegister
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà enregistré",
        )
    user = User(
        email=body.email,
        full_name=body.full_name,
        role="teacher",
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    teacher = Teacher(
        user_id=user.id,
        subject=body.subject,
        is_independent=True,
        subscription_plan="free",
    )
    db.add(teacher)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id, user.email, user.role)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    token = create_access_token(user.id, user.email, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Teacher).where(Teacher.user_id == user.id))
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil enseignant introuvable",
        )
    return MeResponse(
        user=UserBrief.model_validate(user),
        teacher=TeacherBrief.model_validate(teacher),
    )
