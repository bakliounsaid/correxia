"""Limites par plan (aligné script.md — ajustez selon votre billing réel)."""

from datetime import UTC, datetime

# monthly quota for free; advanced is per quarter in product — enforced simply here
MONTHLY_COPY_LIMIT = {
    "free": 40,
    "advanced": 250 // 3,  # approximation si vous préférez un compteur trimestriel, voir usage_logs
    "mastery": None,
}


def plan_allows_copies(plan: str, copies_used_this_month: int) -> bool:
    limit = MONTHLY_COPY_LIMIT.get(plan, MONTHLY_COPY_LIMIT["free"])
    if limit is None:
        return True
    return copies_used_this_month < limit


def current_period_yyyy_mm() -> str:
    return datetime.now(UTC).strftime("%Y-%m")
