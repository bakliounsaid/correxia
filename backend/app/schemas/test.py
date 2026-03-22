from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    subject: str = Field(default="math", pattern="^(math|physics|science)$")
    level: str = Field(default="Terminale", pattern="^(2nde|1ère|Terminale)$")
    duration_minutes: int | None = None
    total_points: int | None = 20
    questions: list[Any] | dict[str, Any] = Field(default_factory=list)
    rubric: list[Any] | dict[str, Any] = Field(default_factory=list)
    status: str = Field(default="draft", pattern="^(draft|created|in_progress|completed)$")


class TestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None
    questions: list[Any] | dict[str, Any] | None = None
    rubric: list[Any] | dict[str, Any] | None = None
    status: str | None = Field(
        default=None, pattern="^(draft|created|in_progress|completed)$"
    )
    total_points: int | None = None


class TestRead(BaseModel):
    id: UUID
    teacher_id: UUID
    title: str
    description: str | None
    subject: str
    level: str
    duration_minutes: int | None
    total_points: int | None
    questions: list[Any] | dict[str, Any]
    rubric: list[Any] | dict[str, Any]
    status: str
    copies_generated: int
    copies_submitted: int
    copies_corrected: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
