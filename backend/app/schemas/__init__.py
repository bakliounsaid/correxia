from app.schemas.auth import MeResponse, TokenResponse, UserLogin, UserRegister
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate
from app.schemas.test import TestCreate, TestRead, TestUpdate

__all__ = [
    "UserRegister",
    "UserLogin",
    "TokenResponse",
    "MeResponse",
    "TestCreate",
    "TestRead",
    "TestUpdate",
    "StudentCreate",
    "StudentRead",
    "StudentUpdate",
]
