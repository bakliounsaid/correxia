"""Formulaire de contact : contact + note dans HubSpot, puis email de confirmation (SMTP)."""

import logging
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from html import escape
from urllib.parse import quote

import httpx
from fastapi.concurrency import run_in_threadpool

from app.config import Settings, get_settings
from app.http_client import http_client

logger = logging.getLogger("correxia.contact")

HUBSPOT_API = "https://api.hubapi.com/crm/v3/objects"
LEAD_STATUSES = {
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "OPEN_DEAL",
    "UNQUALIFIED",
    "ATTEMPTED_TO_CONTACT",
    "CONNECTED",
    "BAD_TIMING",
}
LEAD_STATUS_FR = {
    "nouveau": "NEW",
    "ouvert": "OPEN",
    "en cours": "IN_PROGRESS",
    "opportunite ouverte": "OPEN_DEAL",
    "opportunité ouverte": "OPEN_DEAL",
    "non qualifie": "UNQUALIFIED",
    "non qualifié": "UNQUALIFIED",
    "tentative de contact": "ATTEMPTED_TO_CONTACT",
    "connecte": "CONNECTED",
    "connecté": "CONNECTED",
    "mauvais timing": "BAD_TIMING",
}


class ContactError(Exception):
    """Échec d'enregistrement de la demande (détail technique dans les logs uniquement)."""


def split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


def normalize_hubspot_subject(subject: str) -> str:
    s = subject.strip().lower()
    if "tarif" in s:
        return "Discussion Tarifaire"
    if "demo" in s or "démo" in s:
        return "Démo Produit"
    if "support" in s or "audit" in s:
        return "Audit de Processus"
    return "Autres"


def normalize_lead_status(value: str) -> str:
    raw = value.strip()
    if raw.upper() in LEAD_STATUSES:
        return raw.upper()
    return LEAD_STATUS_FR.get(raw.lower(), "NEW")


def contact_properties(
    s: Settings, *, name: str, email: str, phone: str, role: str, subject: str, message: str
) -> dict:
    firstname, lastname = split_name(name)
    props = {
        "email": email,
        "firstname": firstname,
        "lastname": lastname,
        "phone": phone,
        "jobtitle": role,
        "company": "CORREXIA inbound",
        "website": "correxia.app",
    }
    custom = {
        s.hubspot_role_property: role,
        s.hubspot_subject_property: normalize_hubspot_subject(subject),
        s.hubspot_message_property: message,
        s.hubspot_lead_status_property: normalize_lead_status(s.hubspot_lead_status_value),
    }
    props.update({k.strip().lower(): v for k, v in custom.items() if k and k.strip()})
    return props


async def _hubspot(method: str, path: str, token: str, payload: dict) -> httpx.Response:
    try:
        return await http_client().request(
            method, f"{HUBSPOT_API}/{path}", headers={"Authorization": f"Bearer {token}"}, json=payload, timeout=15.0
        )
    except httpx.HTTPError as e:
        logger.warning("HubSpot injoignable: %s", e)
        raise ContactError("HubSpot injoignable") from e


async def save_to_hubspot(*, name: str, email: str, phone: str, role: str, subject: str, message: str) -> None:
    s = get_settings()
    if not s.hubspot_access_token:
        raise ContactError("HubSpot non configuré")
    token = s.hubspot_access_token
    props = contact_properties(s, name=name, email=email, phone=phone, role=role, subject=subject, message=message)

    # Mise à jour du contact existant (identifié par l'email), sinon création.
    res = await _hubspot("PATCH", f"contacts/{quote(email, safe='')}?idProperty=email", token, {"properties": props})
    if res.status_code == 404:
        res = await _hubspot("POST", "contacts", token, {"properties": props})
    if res.status_code >= 400:
        logger.warning("HubSpot contact %s: %s", res.status_code, res.text[:300])
        raise ContactError("contact HubSpot refusé")
    contact_id = res.json().get("id")
    if not contact_id:
        return

    note = f"Formulaire landing CORREXIA\n\nFonction: {role}\nSujet: {subject}\n\nMessage:\n{message}"
    res = await _hubspot(
        "POST",
        "notes",
        token,
        {
            "properties": {"hs_timestamp": datetime.now(UTC).isoformat(), "hs_note_body": note},
            "associations": [
                {
                    "to": {"id": contact_id},
                    "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 202}],
                }
            ],
        },
    )
    if res.status_code >= 400:
        logger.warning("HubSpot note %s: %s", res.status_code, res.text[:300])
        raise ContactError("note HubSpot refusée")


def acknowledgement_email(*, name: str, email: str, role: str, subject: str, message: str) -> EmailMessage:
    s = get_settings()
    logo = f"{s.frontend_url.rstrip('/')}/logo-correxia-mark.png"
    n, r, sub, m = (escape(v) for v in (name, role, subject, message))
    html = f"""
    <div style="font-family: Arial, sans-serif; background: #f6f7fb; padding: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e8ebf3;">
        <tr><td style="background: linear-gradient(135deg, #0d7bf2, #4f46e5); padding: 20px 24px; color: #ffffff;">
          <img src="{escape(logo)}" alt="CORREXIA" width="44" height="44" style="display:block; border-radius: 8px; margin-bottom: 10px;" />
          <h1 style="margin: 0; font-size: 20px; line-height: 1.25;">Merci pour votre message</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">Nous avons bien reçu votre demande.</p>
        </td></tr>
        <tr><td style="padding: 24px;">
          <p style="margin: 0 0 12px; color: #1f2937; font-size: 14px;">Bonjour {n or "à vous"},</p>
          <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.6;">
            Votre demande a bien été enregistrée. Un membre de l'équipe CORREXIA vous répondra rapidement.
          </p>
          <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px;">
            <p style="margin: 0 0 6px; font-size: 13px; color: #111827;"><strong>Fonction :</strong> {r}</p>
            <p style="margin: 0 0 6px; font-size: 13px; color: #111827;"><strong>Sujet :</strong> {sub}</p>
            <p style="margin: 0; font-size: 13px; color: #111827;"><strong>Message :</strong> {m}</p>
          </div>
          <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">Vous pouvez répondre directement à cet email pour compléter votre demande.</p>
        </td></tr>
      </table>
    </div>"""
    msg = EmailMessage()
    msg["Subject"] = "CORREXIA — Merci pour votre message"
    msg["From"] = s.smtp_sender or ""
    msg["To"] = email
    msg["Reply-To"] = s.smtp_reply_to
    msg.set_content(
        f"Bonjour {name},\n\nVotre demande a bien été reçue. Nous revenons vers vous rapidement.\n\n"
        f"Fonction: {role}\nSujet: {subject}\nMessage: {message}\n\nCORREXIA"
    )
    msg.add_alternative(html, subtype="html")
    return msg


def _send_smtp(msg: EmailMessage, s: Settings) -> None:
    secure = (s.mail_encryption or "").lower() == "ssl" or s.smtp_port == 465
    if secure:
        with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)


async def send_acknowledgement(**fields: str) -> None:
    """Email de confirmation, best-effort : un échec SMTP n'invalide pas la demande enregistrée."""
    s = get_settings()
    if not (s.smtp_host and s.smtp_port and s.smtp_user and s.smtp_password and s.smtp_sender):
        return
    try:
        await run_in_threadpool(_send_smtp, acknowledgement_email(**fields), s)
    except Exception:
        logger.exception("Email de confirmation non envoyé")
