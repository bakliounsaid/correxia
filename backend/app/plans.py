"""Offres commerciales : chargées depuis plans.json, source unique partagée avec le frontend."""

import json
from pathlib import Path
from typing import Any

_PLANS: dict[str, Any] = json.loads((Path(__file__).with_name("plans.json")).read_text(encoding="utf-8"))

TEACHER_PLANS: dict[str, dict[str, Any]] = _PLANS["teacher"]
SCHOOL_PLANS: dict[str, dict[str, Any]] = _PLANS["school"]
ALL_PLANS: dict[str, dict[str, Any]] = {**TEACHER_PLANS, **SCHOOL_PLANS}

# Quotas de copies corrigées par l'IA
FREE_COPY_LIMIT: int = TEACHER_PLANS["essential"]["copy_limit"]
FREE_ACCESS_DAYS: int = TEACHER_PLANS["essential"]["access_days"]
ADVANCED_COPY_LIMIT: int = TEACHER_PLANS["advanced"]["copy_limit"]
ADVANCED_WINDOW_DAYS: int = TEACHER_PLANS["advanced"]["copy_window_days"]


def plan_name(plan_id: str) -> str:
    return ALL_PLANS.get(plan_id, {}).get("name", plan_id)


def plan_price_cents(plan_id: str) -> int:
    return ALL_PLANS.get(plan_id, {}).get("price_cents") or 0
