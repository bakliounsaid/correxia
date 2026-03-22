from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    subject: str = Field(default="math", pattern="^(math|physics|science)$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TeacherBrief(BaseModel):
    id: UUID
    subject: str
    subscription_plan: str
    subscription_status: str | None
    stripe_customer_id: str | None

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserBrief
    teacher: TeacherBrief
