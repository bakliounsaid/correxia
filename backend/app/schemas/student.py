from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class StudentCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: EmailStr | None = None
    class_name: str | None = Field(default=None, max_length=128)


class StudentUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, min_length=1, max_length=128)
    email: EmailStr | None = None
    class_name: str | None = None
    is_active: bool | None = None


class StudentRead(BaseModel):
    id: UUID
    teacher_id: UUID
    first_name: str
    last_name: str
    email: str | None
    class_name: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
