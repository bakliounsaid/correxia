from typing import Literal
from uuid import UUID

from pydantic import BaseModel, model_validator

PlanKey = Literal["advanced", "mastery", "establishment"]


class CheckoutRequest(BaseModel):
    plan: PlanKey
    school_id: UUID | None = None
    success_url: str | None = None
    cancel_url: str | None = None

    @model_validator(mode="after")
    def establishment_needs_school(self):
        if self.plan == "establishment" and self.school_id is None:
            raise ValueError("school_id requis pour le plan establishment")
        return self


class CheckoutResponse(BaseModel):
    checkout_url: str
