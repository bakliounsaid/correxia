from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class StudentCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    id_interne: str | None = Field(default=None, max_length=64)
    class_id: UUID


class StudentUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, min_length=1, max_length=128)
    id_interne: str | None = Field(default=None, max_length=64)
    class_id: UUID | None = None


class StudentRead(BaseModel):
    id: UUID
    class_id: UUID
    first_name: str
    last_name: str
    id_interne: str
    created_at: datetime

    model_config = {"from_attributes": True}
