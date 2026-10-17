"""
Tests d'intégration du paiement et du quota contre la vraie base.
L'API Stripe est simulée (aucun paiement réel) ; le webhook reçoit de vrais événements signés.
"""

import hashlib
import hmac
import json
import time
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.config import get_settings
from app.main import app
from app.routers import billing
from tests.integration_support import (
    INTEGRATION,
    create_account,
    delete_account,
    school_id_of,
    sql,
    teacher_id_of,
)

pytestmark = INTEGRATION

WEBHOOK_SECRET = "whsec_pytest"
PERIOD_END = int((datetime.now(UTC) + timedelta(days=90)).timestamp())


@pytest.fixture(scope="module")
async def accounts():
    async with httpx.AsyncClient(timeout=30) as http:
        teacher_a = await create_account(http, "bill-a", {"account_type": "teacher_independent"})
        teacher_b = await create_account(http, "bill-b", {"account_type": "teacher_independent"})
        school = await create_account(
            http, "bill-school", {"account_type": "school_admin", "school_name": "Lycée Pytest Billing"}
        )
        try:
            yield teacher_a, teacher_b, school
        finally:
            for account in (teacher_a, teacher_b, school):
                await delete_account(http, account.user_id)


@pytest.fixture
async def api():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
def stripe_calls(monkeypatch):
    """Remplace les appels Stripe : `responses` donne la réponse, `calls` garde les paramètres envoyés."""
    state = {"responses": [], "calls": []}

    async def fake(fn, *args, **kwargs):
        state["calls"].append({"fn": fn.__qualname__, "args": args, "kwargs": kwargs})
        return state["responses"].pop(0)

    monkeypatch.setattr(billing, "_stripe_call", fake)
    return state


async def _teacher_billing(teacher_id: str) -> tuple:
    return tuple(
        (
            await sql(
                "select subscription_plan, subscription_status, stripe_subscription_id from teachers where id = :t",
                {"t": teacher_id},
            )
        ).first()
    )


def _session(metadata: dict, *, status: str = "complete", sub_id: str | None = None) -> dict:
    return {
        "id": f"cs_{uuid.uuid4().hex[:10]}",
        "mode": "subscription",
        "status": status,
        "customer": "cus_pytest",
        "metadata": metadata,
        "subscription": {"id": sub_id or f"sub_{uuid.uuid4().hex[:10]}", "current_period_end": PERIOD_END},
    }


def _signed(event: dict) -> tuple[bytes, dict]:
    payload = json.dumps(event).encode()
    ts = int(time.time())
    signature = hmac.new(WEBHOOK_SECRET.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return payload, {"stripe-signature": f"t={ts},v1={signature}", "content-type": "application/json"}


# ---------------------------------------------------------------- checkout


async def test_teacher_checkout_returns_url_with_metadata(api, accounts, stripe_calls):
    teacher_a, _, _ = accounts
    stripe_calls["responses"].append({"url": "https://checkout.stripe.test/s1"})
    res = await api.post("/billing/teacher-checkout", headers=teacher_a.headers, json={"plan": "advanced"})
    assert res.status_code == 200 and res.json()["url"] == "https://checkout.stripe.test/s1"
    sent = stripe_calls["calls"][0]["kwargs"]
    assert sent["metadata"] == {
        "user_id": teacher_a.user_id,
        "teacher_id": await teacher_id_of(teacher_a.user_id),
        "plan": "advanced",
    }
    assert sent["success_url"].startswith(get_settings().frontend_url.rstrip("/") + "/dashboard/abonnement-enseignant")
    assert sent["customer_email"] == teacher_a.email


async def test_teacher_checkout_rejects_unknown_plan(api, accounts):
    teacher_a, _, _ = accounts
    res = await api.post("/billing/teacher-checkout", headers=teacher_a.headers, json={"plan": "establishment"})
    assert res.status_code == 400


async def test_school_teacher_cannot_buy_individual_plan(api, accounts):
    _, teacher_b, _ = accounts
    tid = await teacher_id_of(teacher_b.user_id)
    await sql("update teachers set is_independent = false where id = :t", {"t": tid})
    try:
        res = await api.post("/billing/teacher-checkout", headers=teacher_b.headers, json={"plan": "advanced"})
        assert res.status_code == 403
    finally:
        await sql("update teachers set is_independent = true where id = :t", {"t": tid})


async def test_school_checkout_requires_school_admin(api, accounts, stripe_calls):
    teacher_a, _, school = accounts
    assert (
        await api.post("/billing/school-checkout", headers=teacher_a.headers, json={"plan": "establishment"})
    ).status_code == 403
    stripe_calls["responses"].append({"url": "https://checkout.stripe.test/s2"})
    res = await api.post("/billing/school-checkout", headers=school.headers, json={"plan": "establishment"})
    assert res.status_code == 200
    assert stripe_calls["calls"][0]["kwargs"]["metadata"]["school_id"] == await school_id_of(school.user_id)


# ---------------------------------------------------------------- verify


async def test_teacher_verify_activates_plan_and_records_subscription(api, accounts, stripe_calls):
    teacher_a, _, _ = accounts
    tid = await teacher_id_of(teacher_a.user_id)
    session = _session({"teacher_id": tid, "plan": "advanced"})
    stripe_calls["responses"].append(session)
    res = await api.post(
        "/billing/teacher-checkout/verify", headers=teacher_a.headers, json={"sessionId": session["id"]}
    )
    assert res.status_code == 200, res.text
    assert await _teacher_billing(tid) == ("advanced", "active", session["subscription"]["id"])
    row = (
        await sql(
            "select plan_type, price_cents, billing_period, status from subscriptions where stripe_subscription_id = :s",
            {"s": session["subscription"]["id"]},
        )
    ).first()
    assert tuple(row) == ("advanced", 4500, "quarterly", "active")


async def test_verify_session_of_another_teacher_is_refused(api, accounts, stripe_calls):
    teacher_a, teacher_b, _ = accounts
    tid_a = await teacher_id_of(teacher_a.user_id)
    before = await _teacher_billing(tid_a)
    stripe_calls["responses"].append(_session({"teacher_id": tid_a, "plan": "mastery"}))
    res = await api.post("/billing/teacher-checkout/verify", headers=teacher_b.headers, json={"sessionId": "cs_x"})
    assert res.status_code == 404
    assert await _teacher_billing(tid_a) == before


async def test_verify_unfinished_payment_is_400(api, accounts, stripe_calls):
    teacher_a, _, _ = accounts
    stripe_calls["responses"].append(
        _session({"teacher_id": await teacher_id_of(teacher_a.user_id), "plan": "mastery"}, status="open")
    )
    res = await api.post("/billing/teacher-checkout/verify", headers=teacher_a.headers, json={"sessionId": "cs_x"})
    assert res.status_code == 400 and res.json()["error"] == "Paiement non finalisé."


async def test_school_verify_activates_establishment(api, accounts, stripe_calls):
    _, _, school = accounts
    sid = await school_id_of(school.user_id)
    stripe_calls["responses"].append(_session({"school_id": sid, "plan": "establishment"}))
    res = await api.post("/billing/school-checkout/verify", headers=school.headers, json={"sessionId": "cs_x"})
    assert res.status_code == 200
    row = (await sql("select subscription_plan, subscription_status from schools where id = :s", {"s": sid})).first()
    assert tuple(row) == ("establishment", "active")


# ---------------------------------------------------------------- webhook


async def test_webhook_lifecycle(api, accounts, monkeypatch):
    _, teacher_b, _ = accounts
    monkeypatch.setattr(get_settings(), "stripe_webhook_secret", WEBHOOK_SECRET)
    tid = await teacher_id_of(teacher_b.user_id)
    sub_id = f"sub_{uuid.uuid4().hex[:10]}"

    async def send(event_type: str, obj: dict):
        payload, headers = _signed({"id": f"evt_{uuid.uuid4().hex[:8]}", "type": event_type, "data": {"object": obj}})
        res = await api.post("/billing/webhook", content=payload, headers=headers)
        assert res.status_code == 200, res.text

    await send("checkout.session.completed", _session({"teacher_id": tid, "plan": "mastery"}, sub_id=sub_id))
    assert await _teacher_billing(tid) == ("mastery", "active", sub_id)

    subscription = {
        "id": sub_id,
        "status": "past_due",
        "metadata": {"teacher_id": tid},
        "current_period_end": PERIOD_END,
    }
    await send("customer.subscription.updated", subscription)
    assert (await _teacher_billing(tid))[1] == "paused"
    assert (
        await sql("select status from subscriptions where stripe_subscription_id = :s", {"s": sub_id})
    ).scalar() == "paused"

    await send("customer.subscription.deleted", {**subscription, "status": "canceled"})
    assert (await _teacher_billing(tid))[1] == "cancelled"
    row = (
        await sql("select status, auto_renew from subscriptions where stripe_subscription_id = :s", {"s": sub_id})
    ).first()
    assert tuple(row) == ("cancelled", False)


async def test_webhook_finds_subscription_without_metadata(api, accounts, monkeypatch):
    teacher_a, _, _ = accounts
    monkeypatch.setattr(get_settings(), "stripe_webhook_secret", WEBHOOK_SECRET)
    tid = await teacher_id_of(teacher_a.user_id)
    sub_id = f"sub_{uuid.uuid4().hex[:10]}"
    await sql(
        "update teachers set stripe_subscription_id = :s, subscription_status = 'active' where id = :t",
        {"s": sub_id, "t": tid},
    )
    payload, headers = _signed(
        {
            "type": "customer.subscription.updated",
            "data": {"object": {"id": sub_id, "status": "unpaid", "metadata": {}}},
        }
    )
    assert (await api.post("/billing/webhook", content=payload, headers=headers)).status_code == 200
    assert (await _teacher_billing(tid))[1] == "paused"


async def test_webhook_acknowledges_foreign_session(api, monkeypatch):
    monkeypatch.setattr(get_settings(), "stripe_webhook_secret", WEBHOOK_SECRET)
    payload, headers = _signed(
        {
            "type": "checkout.session.completed",
            "data": {"object": _session({"teacher_id": str(uuid.uuid4()), "plan": "advanced"})},
        }
    )
    res = await api.post("/billing/webhook", content=payload, headers=headers)
    assert res.status_code == 200 and res.json() == {"received": True}


# ---------------------------------------------------------------- quota


async def _log_usage(teacher_id: str, copy_id: str, days_ago: int = 0) -> None:
    await sql(
        "insert into usage_logs (teacher_id, action, action_value, created_at) "
        "values (:t, 'ai_copy_corrected', :c, now() - make_interval(days => :d))",
        {"t": teacher_id, "c": copy_id, "d": days_ago},
    )


async def test_quota_counts_distinct_copies(api, accounts):
    teacher_a, _, _ = accounts
    tid = await teacher_id_of(teacher_a.user_id)
    await sql(
        "update teachers set subscription_plan = 'free', subscription_status = 'active' where id = :t", {"t": tid}
    )
    await sql("delete from usage_logs where teacher_id = :t", {"t": tid})
    copy_1, copy_2 = str(uuid.uuid4()), str(uuid.uuid4())
    for copy_id in (copy_1, copy_1, copy_2):  # copy_1 recorrigée : comptée une fois
        await _log_usage(tid, copy_id)
    res = await api.get("/billing/quota", headers=teacher_a.headers)
    q = res.json()["quota"]
    assert (q["limit"], q["used"], q["remaining"], q["planLabel"], q["expired"]) == (40, 2, 38, "Pack ESSENTIEL", False)


async def test_quota_advanced_counts_only_current_quarter(api, accounts):
    teacher_a, _, _ = accounts
    tid = await teacher_id_of(teacher_a.user_id)
    await sql(
        "update teachers set subscription_plan = 'advanced', subscription_status = 'active', "
        "subscription_start_date = now() - interval '100 days' where id = :t",
        {"t": tid},
    )
    await sql("delete from usage_logs where teacher_id = :t", {"t": tid})
    await _log_usage(tid, str(uuid.uuid4()), days_ago=20)  # trimestre précédent
    await _log_usage(tid, str(uuid.uuid4()), days_ago=5)  # trimestre en cours
    q = (await api.get("/billing/quota", headers=teacher_a.headers)).json()["quota"]
    assert (q["limit"], q["used"], q["planLabel"]) == (250, 1, "Pack AVANCÉ")
