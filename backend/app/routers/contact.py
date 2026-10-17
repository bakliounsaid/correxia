"""Formulaire de contact public de la page d'accueil (ex-route Next /api/contact)."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.rate_limit import LIMIT_CONTACT
from app.services.contact import ContactError, save_to_hubspot, send_acknowledgement

router = APIRouter(tags=["contact"])


class ContactBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=40)
    role: Literal["Enseignant", "Responsable", "Autres"]
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("name", "phone", "subject", "message", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v


@router.post("/contact", dependencies=[Depends(LIMIT_CONTACT)])
async def contact(body: ContactBody):
    fields = {
        "name": body.name,
        "email": str(body.email).lower(),
        "role": body.role,
        "subject": body.subject,
        "message": body.message,
    }
    try:
        await save_to_hubspot(phone=body.phone, **fields)
    except ContactError as e:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Votre message n'a pas pu être enregistré. Réessayez plus tard ou écrivez à contact@correxia.fr.",
        ) from e
    await send_acknowledgement(**fields)
    return {"ok": True}
