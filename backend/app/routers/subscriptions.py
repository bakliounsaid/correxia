from datetime import UTC, datetime
from uuid import UUID

import stripe
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import School, Subscription, Teacher, User
from app.schemas.subscription import CheckoutRequest, CheckoutResponse

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def _price_id(plan: str) -> str:
    s = get_settings()
    mapping = {
        "advanced": s.stripe_price_advanced_quarterly,
        "mastery": s.stripe_price_mastery_quarterly,
        "establishment": s.stripe_price_establishment_quarterly,
    }
    pid = mapping.get(plan)
    if not pid:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe non configuré pour le plan « {plan} » (variable PRICE manquante).",
        )
    return pid


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Stripe n'est pas configuré (STRIPE_KEY).",
        )
    stripe.api_key = settings.stripe_secret_key

    result = await db.execute(select(Teacher).where(Teacher.user_id == user.id))
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(403, detail="Profil enseignant requis")

    price_id = _price_id(body.plan)
    success = str(body.success_url or settings.stripe_success_url)
    cancel = str(body.cancel_url or settings.stripe_cancel_url)
    join = "&" if "?" in success else "?"
    success_with_session = f"{success}{join}session_id={{CHECKOUT_SESSION_ID}}"

    meta = {
        "user_id": str(user.id),
        "teacher_id": str(teacher.id),
        "plan": body.plan,
    }
    if body.plan == "establishment" and body.school_id:
        meta["school_id"] = str(body.school_id)

    params: dict = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_with_session,
        "cancel_url": cancel,
        "metadata": meta,
        "subscription_data": {"metadata": meta},
    }
    if teacher.stripe_customer_id:
        params["customer"] = teacher.stripe_customer_id
    else:
        params["customer_email"] = user.email

    try:
        session = await run_in_threadpool(stripe.checkout.Session.create, **params)
    except stripe.error.StripeError as e:
        raise HTTPException(502, detail=str(e.user_message or e)) from e

    return CheckoutResponse(checkout_url=session.url or "")


async def _upsert_teacher_plan(
    db: AsyncSession,
    teacher_id: UUID,
    customer_id: str,
    subscription_id: str,
    plan_key: str,
    sub_status: str,
    price_cents: int = 0,
) -> None:
    res = await db.execute(select(Teacher).where(Teacher.id == teacher_id))
    teacher = res.scalar_one_or_none()
    if not teacher:
        return
    teacher.stripe_customer_id = customer_id
    teacher.stripe_subscription_id = subscription_id
    if plan_key in ("advanced", "mastery"):
        teacher.subscription_plan = plan_key
    teacher.subscription_status = sub_status
    if sub_status == "active":
        teacher.subscription_start_date = datetime.now(UTC)
    await db.flush()

    sub_row = Subscription(
        teacher_id=teacher.id,
        school_id=None,
        plan_type=plan_key,
        plan_name=plan_key,
        price_cents=price_cents,
        billing_period="quarterly",
        status="active" if sub_status in ("active", "trialing") else sub_status,
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        start_date=datetime.now(UTC),
        auto_renew=True,
    )
    db.add(sub_row)


async def _upsert_school_plan(
    db: AsyncSession,
    school_id: UUID,
    customer_id: str,
    subscription_id: str,
    sub_status: str,
    price_cents: int = 0,
) -> None:
    res = await db.execute(select(School).where(School.id == school_id))
    school = res.scalar_one_or_none()
    if not school:
        return
    school.stripe_customer_id = customer_id
    school.stripe_subscription_id = subscription_id
    school.subscription_plan = "establishment"
    school.subscription_status = sub_status
    school.subscription_start_date = datetime.now(UTC)
    await db.flush()
    ex = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id
        )
    )
    if ex.scalar_one_or_none() is None:
        db.add(
            Subscription(
                teacher_id=None,
                school_id=school.id,
                plan_type="establishment",
                plan_name="Établissement",
                price_cents=price_cents,
                billing_period="quarterly",
                status="active"
                if sub_status in ("active", "trialing")
                else sub_status,
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
                start_date=datetime.now(UTC),
                auto_renew=True,
            )
        )


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, detail="Webhook Stripe non configuré")
    stripe.api_key = settings.stripe_secret_key or ""

    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    if not sig:
        raise HTTPException(400, detail="Signature manquante")

    try:
        event = await run_in_threadpool(
            stripe.Webhook.construct_event, payload, sig, settings.stripe_webhook_secret
        )
    except ValueError as e:
        raise HTTPException(400, detail="Payload invalide") from e
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(400, detail="Signature invalide") from e

    etype = event["type"]
    data = event["data"]["object"]

    if etype == "checkout.session.completed":
        meta = data.get("metadata") or {}
        plan = meta.get("plan", "")
        customer_id = data.get("customer") or ""
        sub_id = data.get("subscription") or ""
        if not sub_id:
            return {"received": True}
        try:
            stripe_sub = await run_in_threadpool(stripe.Subscription.retrieve, sub_id)
        except stripe.error.StripeError:
            return {"received": True}
        price_cents = 0
        try:
            items = stripe_sub["items"]["data"]
            if items:
                price_cents = items[0]["price"]["unit_amount"] or 0
        except (KeyError, IndexError):
            pass
        status_s = stripe_sub.get("status", "active")

        if plan == "establishment" and meta.get("school_id"):
            await _upsert_school_plan(
                db,
                UUID(meta["school_id"]),
                customer_id,
                sub_id,
                status_s,
                price_cents,
            )
        elif meta.get("teacher_id"):
            await _upsert_teacher_plan(
                db,
                UUID(meta["teacher_id"]),
                customer_id,
                sub_id,
                plan or "advanced",
                status_s,
                price_cents,
            )
        await db.commit()
        return {"received": True}

    if etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        sub_id = data.get("id") or ""
        status_s = data.get("status", "cancelled")

        tres = await db.execute(
            select(Teacher).where(Teacher.stripe_subscription_id == sub_id)
        )
        teacher = tres.scalar_one_or_none()
        if teacher:
            teacher.subscription_status = status_s
            if etype == "customer.subscription.deleted":
                teacher.subscription_plan = "free"
                teacher.subscription_status = "cancelled"
                teacher.stripe_subscription_id = None
        else:
            sres = await db.execute(
                select(School).where(School.stripe_subscription_id == sub_id)
            )
            school = sres.scalar_one_or_none()
            if school:
                school.subscription_status = status_s
                if etype == "customer.subscription.deleted":
                    school.subscription_status = "cancelled"
        await db.commit()
        return {"received": True}

    return {"received": True}
