"""
Dépendances FastAPI partagées. Les routes les utilisent via les alias `Annotated` en bas du fichier :
    async def route(teacher: CurrentTeacher, db: DbSession): ...
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import School, Teacher, User
from app.supabase_auth import AuthUser, verify_access_token

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


async def get_auth_user(credentials: BearerCredentials) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifié.")
    return await verify_access_token(credentials.credentials)


CurrentAuth = Annotated[AuthUser, Depends(get_auth_user)]


async def get_current_user(auth: CurrentAuth, db: DbSession) -> User:
    user = await db.scalar(select(User).where(User.id == auth.id))
    if not user or user.is_active is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profil utilisateur introuvable.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_teacher(user: CurrentUser, db: DbSession) -> Teacher:
    teacher = await db.scalar(select(Teacher).where(Teacher.user_id == user.id))
    if not teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profil enseignant introuvable.")
    return teacher


@dataclass
class SchoolAdminContext:
    user: User
    school: School


async def get_school_admin(user: CurrentUser, db: DbSession) -> SchoolAdminContext:
    if user.role != "school_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    school = await db.scalar(select(School).where(School.admin_user_id == user.id))
    if not school:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucun établissement lié à ce compte.")
    return SchoolAdminContext(user=user, school=school)


async def get_platform_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    return user


CurrentTeacher = Annotated[Teacher, Depends(get_current_teacher)]
SchoolAdmin = Annotated[SchoolAdminContext, Depends(get_school_admin)]
