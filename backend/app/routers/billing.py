"""
Paiement Stripe (ex-routes Next /api/billing/*).
- checkout : crée la session de paiement (enseignant indépendant ou établissement) ;
- verify   : active l'abonnement au retour du paiement (sans attendre le webhook) ;
- webhook  : source de vérité (renouvellement, impayé, résiliation), signature vérifiée.
Chaque mise à jour d'abonnement (profil + table subscriptions) est faite dans une transaction.
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import plans
from app.config import get_settings
from app.deps import CurrentAuth, CurrentTeacher, DbSession, SchoolAdmin
from app.models import School, Subscription, Teacher
from app.rate_limit import LIMIT_BILLING, LIMIT_READ
from app.services.quota import get_teacher_quota

logger = logging.getLogger("correxia.billing")

router = APIRouter(prefix="/billing", tags=["billing"])


def _stripe_secret() -> str:
    secret = get_settings().stripe_secret_key
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Le paiement en ligne n’est pas configuré.")
    return secret


def _price_id(plan: str) -> str:
    s = get_settings()
    price = {
        "advanced": s.stripe_price_advanced_quarterly,
        "mastery": s.stripe_price_mastery_quarterly,
        "establishment": s.stripe_price_establishment_quarterly,
    }.get(plan)
    if not price:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Prix Stripe manquant pour l’offre « {plan} ».")
    return price


def app_status_from_stripe(stripe_status: str) -> str:
    """Statut Stripe → vocabulaire de l'app (active / pending / paused / cancelled)."""
    if stripe_status in ("active", "trialing"):
        return "active"
    if stripe_status == "incomplete":
        return "pending"
    if stripe_status in ("past_due", "unpaid", "paused"):
        return "paused"
    return "cancelled"


def _id_of(value: Any) -> str | None:
    if isinstance(value, dict):
        return value.get("id")
    return value or None


def _period_end(subscription: dict | None) -> datetime | None:
    """Fin de période en cours (champ déplacé sur les items dans les API Stripe récentes)."""
    if not isinstance(subscription, dict):
        return None
    ts = subscription.get("current_period_end")
    if not ts:
        items = (subscription.get("items") or {}).get("data") or []
        ts = items[0].get("current_period_end") if items else None
    return datetime.fromtimestamp(ts, UTC) if ts else None


async def _stripe_call(fn, *args, **kwargs) -> dict:
    """Appel SDK Stripe (synchrone) hors de la boucle d'événements, résultat en dict."""
    stripe.api_key = _stripe_secret()
    try:
        result = await run_in_threadpool(fn, *args, **kwargs)
    except stripe.StripeError as e:
        logger.warning("Erreur Stripe: %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Le service de paiement a renvoyé une erreur.") from e
    return result.to_dict()


async def _create_checkout(plan: str, metadata: dict[str, str], return_path: str, customer: dict) -> str:
    base = get_settings().frontend_url.rstrip("/")
    session = await _stripe_call(
        stripe.checkout.Session.create,
        mode="subscription",
        line_items=[{"price": _price_id(plan), "quantity": 1}],
        success_url=f"{base}{return_path}?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}{return_path}?checkout=cancel",
        metadata=metadata,
        subscription_data={"metadata": metadata},
        **customer,
    )
    if not session.get("url"):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Stripe n’a pas renvoyé d’URL de paiement.")
    return session["url"]


async def _upsert_subscription_row(
    db: AsyncSession,
    *,
    plan: str,
    app_status: str,
    teacher_id: UUID | None,
    school_id: UUID | None,
    customer_id: str | None,
    subscription_id: str | None,
    period_end: datetime | None,
) -> None:
    """Historique des abonnements (lu par l'admin plateforme), une ligne par abonnement Stripe."""
    if not subscription_id:
        return
    row = await db.scalar(select(Subscription).where(Subscription.stripe_subscription_id == subscription_id))
    if row is None:
        row = Subscription(
            stripe_subscription_id=subscription_id,
            teacher_id=teacher_id,
            school_id=school_id,
            plan_type=plan,
            plan_name=plans.plan_name(plan),
            price_cents=plans.plan_price_cents(plan),
            billing_period="quarterly",
            start_date=datetime.now(UTC),
        )
        db.add(row)
    row.status = app_status if app_status in ("active", "paused", "cancelled") else "paused"
    row.stripe_customer_id = customer_id or row.stripe_customer_id
    row.end_date = period_end or row.end_date
    row.next_billing_date = period_end if app_status == "active" else None


async def _activate_from_session(db: AsyncSession, session: dict, owner_user_id: UUID | None) -> None:
    """
    Applique une session de paiement terminée (verify ou webhook).
    owner_user_id : si fourni (verify), la ligne doit appartenir à cet utilisateur.
    """
    meta = session.get("metadata") or {}
    plan = meta.get("plan")
    customer_id = _id_of(session.get("customer"))
    subscription = session.get("subscription")
    subscription_id = _id_of(subscription)
    period_end = _period_end(subscription if isinstance(subscription, dict) else None)
    now = datetime.now(UTC)

    if meta.get("teacher_id") and plan in ("advanced", "mastery"):
        query = select(Teacher).where(Teacher.id == UUID(meta["teacher_id"]))
        if owner_user_id:
            query = query.where(Teacher.user_id == owner_user_id)
        target = await db.scalar(query)
        teacher_id, school_id = (target.id, None) if target else (None, None)
    elif meta.get("school_id") and plan == "establishment":
        query = select(School).where(School.id == UUID(meta["school_id"]))
        if owner_user_id:
            query = query.where(School.admin_user_id == owner_user_id)
        target = await db.scalar(query)
        teacher_id, school_id = (None, target.id) if target else (None, None)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Métadonnées de session invalides.")

    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte associé au paiement introuvable.")

    target.stripe_customer_id = customer_id
    target.stripe_subscription_id = subscription_id
    target.subscription_plan = plan
    target.subscription_status = "active"
    target.subscription_start_date = now
    target.subscription_end_date = period_end
    await _upsert_subscription_row(
        db,
        plan=plan,
        app_status="active",
        teacher_id=teacher_id,
        school_id=school_id,
        customer_id=customer_id,
        subscription_id=subscription_id,
        period_end=period_end,
    )


async def _verify_session(db: AsyncSession, session_id: str, owner_user_id: UUID) -> None:
    session = await _stripe_call(stripe.checkout.Session.retrieve, session_id, expand=["subscription"])
    if session.get("status") != "complete":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Paiement non finalisé.")
    await _activate_from_session(db, session, owner_user_id)
    await db.commit()


# ---------------------------------------------------------------- quota


@router.get("/quota", dependencies=[Depends(LIMIT_READ)])
async def copy_quota(teacher: CurrentTeacher, db: DbSession):
    """Copies corrigées par l'IA / limite de l'offre (affichage « 12 / 40 copies »)."""
    quota = await get_teacher_quota(db, teacher)
    return {"ok": True, "quota": {**quota.to_dict(), "expired": quota.is_expired()}}


# ---------------------------------------------------------------- enseignant indépendant


class TeacherCheckoutBody(BaseModel):
    plan: Literal["advanced", "mastery"]


class VerifyBody(BaseModel):
    sessionId: str


@router.post("/teacher-checkout", dependencies=[Depends(LIMIT_BILLING)])
async def teacher_checkout(
    body: TeacherCheckoutBody,
    auth: CurrentAuth,
    teacher: CurrentTeacher,
):
    if teacher.is_independent is not True:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "L’abonnement individuel concerne les enseignants en compte libre. "
            "Votre établissement gère l’offre collective.",
        )
    meta = {"user_id": str(teacher.user_id), "teacher_id": str(teacher.id), "plan": body.plan}
    customer = (
        {"customer": teacher.stripe_customer_id} if teacher.stripe_customer_id else {"customer_email": auth.email}
    )
    url = await _create_checkout(body.plan, meta, "/dashboard/abonnement-enseignant", customer)
    return {"url": url}


@router.post("/teacher-checkout/verify", dependencies=[Depends(LIMIT_BILLING)])
async def teacher_checkout_verify(
    body: VerifyBody,
    teacher: CurrentTeacher,
    db: DbSession,
):
    await _verify_session(db, body.sessionId, teacher.user_id)
    return {"ok": True}


# ---------------------------------------------------------------- établissement


class SchoolCheckoutBody(BaseModel):
    plan: Literal["establishment"]


@router.post("/school-checkout", dependencies=[Depends(LIMIT_BILLING)])
async def school_checkout(
    body: SchoolCheckoutBody,
    auth: CurrentAuth,
    ctx: SchoolAdmin,
):
    school = ctx.school
    meta = {"user_id": str(ctx.user.id), "school_id": str(school.id), "plan": body.plan}
    customer = (
        {"customer": school.stripe_customer_id}
        if school.stripe_customer_id
        else {"customer_email": school.email or auth.email}
    )
    url = await _create_checkout(body.plan, meta, "/dashboard/abonnement", customer)
    return {"url": url}


@router.post("/school-checkout/verify", dependencies=[Depends(LIMIT_BILLING)])
async def school_checkout_verify(
    body: VerifyBody,
    ctx: SchoolAdmin,
    db: DbSession,
):
    await _verify_session(db, body.sessionId, ctx.user.id)
    return {"ok": True}


# ---------------------------------------------------------------- webhook


async def _apply_subscription_change(db: AsyncSession, subscription: dict, deleted: bool) -> None:
    app_status = "cancelled" if deleted else app_status_from_stripe(str(subscription.get("status")))
    period_end = _period_end(subscription)
    meta = subscription.get("metadata") or {}

    targets: list[Teacher | School] = []
    if meta.get("teacher_id"):
        targets = list(await db.scalars(select(Teacher).where(Teacher.id == UUID(meta["teacher_id"]))))
    elif meta.get("school_id"):
        targets = list(await db.scalars(select(School).where(School.id == UUID(meta["school_id"]))))
    if not targets:
        # Abonnement créé hors app : on retrouve la ligne par son id Stripe.
        targets = [
            *await db.scalars(select(Teacher).where(Teacher.stripe_subscription_id == subscription["id"])),
            *await db.scalars(select(School).where(School.stripe_subscription_id == subscription["id"])),
        ]
    for target in targets:
        target.subscription_status = app_status
        target.subscription_end_date = period_end or target.subscription_end_date

    row = await db.scalar(select(Subscription).where(Subscription.stripe_subscription_id == subscription["id"]))
    if row:
        row.status = app_status if app_status in ("active", "paused", "cancelled") else "paused"
        row.end_date = period_end or row.end_date
        row.next_billing_date = period_end if app_status == "active" else None
        row.auto_renew = not deleted and not subscription.get("cancel_at_period_end", False)


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: DbSession):
    secret = get_settings().stripe_webhook_secret
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook non configuré.")
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Signature manquante.")

    payload = await request.body()
    try:
        stripe.Webhook.construct_event(payload, signature, secret)
    except Exception as e:  # signature invalide, horodatage expiré, JSON illisible
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Signature invalide.") from e

    event = json.loads(payload)
    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    if event_type == "checkout.session.completed" and obj.get("mode") == "subscription":
        try:
            await _activate_from_session(db, obj, owner_user_id=None)
        except HTTPException as e:
            # Session sans lien avec un compte de l'app : acquittée pour que Stripe n'insiste pas.
            logger.warning("checkout.session.completed ignoré (%s): %s", obj.get("id"), e.detail)
            return {"received": True}
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        await _apply_subscription_change(db, obj, deleted=event_type == "customer.subscription.deleted")
    else:
        return {"received": True}

    # Une erreur ici renvoie 500 : Stripe réessaiera l'envoi.
    await db.commit()
    return {"received": True}
