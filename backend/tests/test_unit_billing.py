"""Tests unitaires du paiement et du quota (sans base ni appel Stripe)."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.config import get_settings
from app.main import app
from app.models import Teacher
from app.routers import billing
from app.services import quota

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 17, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("stripe_status", "expected"),
    [
        ("active", "active"),
        ("trialing", "active"),
        ("incomplete", "pending"),
        ("past_due", "paused"),
        ("unpaid", "paused"),
        ("paused", "paused"),
        ("canceled", "cancelled"),
        ("incomplete_expired", "cancelled"),
    ],
)
def test_app_status_from_stripe(stripe_status, expected):
    assert billing.app_status_from_stripe(stripe_status) == expected


def test_period_end_top_level_and_items():
    ts = int(NOW.timestamp())
    assert billing._period_end({"current_period_end": ts}) == NOW
    assert billing._period_end({"items": {"data": [{"current_period_end": ts}]}}) == NOW
    assert billing._period_end({}) is None
    assert billing._period_end("sub_123") is None


def test_id_of():
    assert billing._id_of("cus_1") == "cus_1"
    assert billing._id_of({"id": "sub_1"}) == "sub_1"
    assert billing._id_of(None) is None


# ---------------------------------------------------------------- quota (règles)


def _teacher(**kw) -> Teacher:
    defaults = {
        "is_independent": True,
        "subscription_plan": "free",
        "subscription_status": "active",
        "subscription_start_date": NOW - timedelta(days=10),
        "created_at": NOW - timedelta(days=10),
    }
    defaults.update(kw)
    return Teacher(**defaults)


def test_school_teacher_is_unlimited():
    assert quota.quota_rules(_teacher(is_independent=False), NOW)[0] is None


def test_mastery_active_is_unlimited():
    limit, _, _, label = quota.quota_rules(_teacher(subscription_plan="mastery"), NOW)
    assert (limit, label) == (None, "Pack MAÎTRISE")


def test_advanced_active_has_quarter_window():
    start = NOW - timedelta(days=100)
    limit, window, expires, label = quota.quota_rules(
        _teacher(subscription_plan="advanced", subscription_start_date=start), NOW
    )
    assert (limit, window, expires, label) == (250, start + timedelta(days=90), None, "Pack AVANCÉ")


def test_inactive_paid_plan_falls_back_to_free():
    limit, _, _, label = quota.quota_rules(_teacher(subscription_plan="mastery", subscription_status="cancelled"), NOW)
    assert (limit, label) == (40, "Pack ESSENTIEL")


def test_free_plan_expires_after_30_days():
    created = NOW - timedelta(days=31)
    limit, window, expires, _ = quota.quota_rules(_teacher(created_at=created), NOW)
    assert (limit, window, expires) == (40, None, created + timedelta(days=30))
    assert quota.CopyQuota(limit, 0, window, expires, "x").is_expired(NOW)
    assert not quota.CopyQuota(limit, 0, window, NOW + timedelta(days=1), "x").is_expired(NOW)


@pytest.mark.parametrize(
    ("days_since_start", "expected_offset_days"),
    [(0, 0), (89, 0), (90, 90), (200, 180)],
)
def test_current_quarter_start(days_since_start, expected_offset_days):
    start = NOW - timedelta(days=days_since_start)
    assert quota.current_quarter_start(start, NOW) == start + timedelta(days=expected_offset_days)


def test_current_quarter_start_without_or_future_start():
    assert quota.current_quarter_start(None, NOW) is None
    assert quota.current_quarter_start(NOW + timedelta(days=1), NOW) is None


def test_quota_remaining():
    assert quota.CopyQuota(40, 45, None, None, "x").remaining == 0
    assert quota.CopyQuota(40, 12, None, None, "x").remaining == 28
    assert quota.CopyQuota(None, 0, None, None, "x").remaining is None


# ---------------------------------------------------------------- webhook (signature)


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


async def test_webhook_not_configured_is_503(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "stripe_webhook_secret", None)
    res = await client.post("/billing/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=x"})
    assert res.status_code == 503


async def test_webhook_without_signature_is_400(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "stripe_webhook_secret", "whsec_test")
    res = await client.post("/billing/webhook", content=b"{}")
    assert res.status_code == 400 and res.json()["error"] == "Signature manquante."


async def test_webhook_with_forged_signature_is_400(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "stripe_webhook_secret", "whsec_test")
    res = await client.post(
        "/billing/webhook", content=b'{"type":"x"}', headers={"stripe-signature": "t=1700000000,v1=deadbeef"}
    )
    assert res.status_code == 400 and res.json()["error"] == "Signature invalide."


def test_quota_and_prices_come_from_plans_json():
    """plans.json est la seule source : quotas et prix appliqués par le backend en dérivent."""
    import json
    from pathlib import Path

    from app import plans

    data = json.loads(Path(plans.__file__).with_name("plans.json").read_text(encoding="utf-8"))
    essential, advanced = data["teacher"]["essential"], data["teacher"]["advanced"]

    limit, _, expires, label = quota.quota_rules(_teacher(created_at=NOW), NOW)
    assert (limit, expires, label) == (
        essential["copy_limit"],
        NOW + timedelta(days=essential["access_days"]),
        essential["name"],
    )
    assert quota.quota_rules(_teacher(subscription_plan="advanced"), NOW)[0] == advanced["copy_limit"]
    assert timedelta(days=advanced["copy_window_days"]) == quota.QUARTER
    assert plans.plan_price_cents("establishment") == data["school"]["establishment"]["price_cents"]


def test_signup_trigger_trial_matches_plans_json():
    """Le trigger SQL d'inscription ne peut pas lire plans.json : on vérifie qu'il reste aligné."""
    from pathlib import Path

    from app.plans import SCHOOL_PLANS

    migration = Path(__file__).resolve().parents[2] / "supabase/migrations/20261017120000_add_missing_schema.sql"
    trial_days = SCHOOL_PLANS["evaluation"]["trial_days"]
    assert f"interval '{trial_days} days'" in migration.read_text(encoding="utf-8")
