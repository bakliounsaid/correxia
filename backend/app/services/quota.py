"""
Quota de copies corrigées par l'IA, selon l'offre (chiffres dans app/plans.json, partagé avec le frontend) :
- Pack ESSENTIEL (gratuit) : un nombre de copies, et un accès limité en jours après la création du compte ;
- Pack AVANCÉ (actif)      : un nombre de copies par fenêtre glissante depuis la souscription ;
- Pack MAÎTRISE (actif) et enseignants d'établissement : illimité.

L'usage est inscrit dans usage_logs (action « ai_copy_corrected », une ligne par copie et par
correction) : supprimer des corrections ou réinitialiser les imports ne rend pas de quota.
Une copie déjà comptée dans la fenêtre en cours peut être recorrigée sans consommer de quota.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import plans
from app.models import Teacher, UsageLog

USAGE_ACTION = "ai_copy_corrected"
QUARTER = timedelta(days=plans.ADVANCED_WINDOW_DAYS)


@dataclass(frozen=True)
class CopyQuota:
    limit: int | None  # None = illimité
    used: int
    window_start: datetime | None  # None = depuis la création du compte
    expires_at: datetime | None  # fin de l'accès gratuit
    plan_label: str

    @property
    def remaining(self) -> int | None:
        return None if self.limit is None else max(0, self.limit - self.used)

    def is_expired(self, now: datetime | None = None) -> bool:
        return self.expires_at is not None and (now or datetime.now(UTC)) >= self.expires_at

    def to_dict(self) -> dict:
        return {
            "limit": self.limit,
            "used": self.used,
            "remaining": self.remaining,
            "windowStart": self.window_start,
            "expiresAt": self.expires_at,
            "planLabel": self.plan_label,
        }


def current_quarter_start(subscription_start: datetime | None, now: datetime) -> datetime | None:
    """Début de la fenêtre trimestrielle en cours, ancrée sur la date de souscription."""
    if subscription_start is None or subscription_start > now:
        return None
    elapsed = (now - subscription_start) // QUARTER
    return subscription_start + elapsed * QUARTER


def quota_rules(teacher: Teacher, now: datetime) -> tuple[int | None, datetime | None, datetime | None, str]:
    """(limite, début de fenêtre, expiration, libellé) pour l'enseignant, sans accès base."""
    if teacher.is_independent is False:
        return None, None, None, "Établissement"
    plan = (teacher.subscription_plan or "").lower()
    active = (teacher.subscription_status or "").lower() == "active"
    if active and plan == "mastery":
        return None, None, None, plans.plan_name("mastery")
    if active and plan == "advanced":
        return (
            plans.ADVANCED_COPY_LIMIT,
            current_quarter_start(teacher.subscription_start_date, now),
            None,
            plans.plan_name("advanced"),
        )
    expires = teacher.created_at + timedelta(days=plans.FREE_ACCESS_DAYS) if teacher.created_at else None
    return plans.FREE_COPY_LIMIT, None, expires, plans.plan_name("essential")


def _usage_filters(teacher_id: UUID, window_start: datetime | None) -> list:
    filters = [UsageLog.teacher_id == teacher_id, UsageLog.action == USAGE_ACTION]
    if window_start is not None:
        filters.append(UsageLog.created_at >= window_start)
    return filters


async def get_teacher_quota(db: AsyncSession, teacher: Teacher, now: datetime | None = None) -> CopyQuota:
    now = now or datetime.now(UTC)
    limit, window_start, expires_at, label = quota_rules(teacher, now)
    if limit is None:
        return CopyQuota(None, 0, None, None, label)
    used = await db.scalar(
        select(func.count(func.distinct(UsageLog.action_value))).where(*_usage_filters(teacher.id, window_start))
    )
    return CopyQuota(limit, used or 0, window_start, expires_at, label)


async def copies_already_counted(
    db: AsyncSession, teacher_id: UUID, copy_ids: list[UUID], window_start: datetime | None
) -> set[str]:
    """Parmi ces copies, celles déjà comptées dans la fenêtre (recorrection gratuite)."""
    if not copy_ids:
        return set()
    rows = await db.scalars(
        select(UsageLog.action_value).where(
            *_usage_filters(teacher_id, window_start), UsageLog.action_value.in_([str(c) for c in copy_ids])
        )
    )
    return set(rows)


def select_within_quota(
    copy_ids: list[UUID], quota: CopyQuota, already_counted: set[str]
) -> tuple[list[UUID], list[UUID]]:
    """(copies à corriger, copies refusées) : les déjà comptées passent, les nouvelles dans la limite du solde."""
    if quota.limit is None:
        return list(copy_ids), []
    remaining = quota.remaining or 0
    keep, skipped = [], []
    for copy_id in copy_ids:
        if str(copy_id) in already_counted:
            keep.append(copy_id)
        elif remaining > 0:
            remaining -= 1
            keep.append(copy_id)
        else:
            skipped.append(copy_id)
    return keep, skipped


def record_copy_usage(db: AsyncSession, teacher: Teacher, copy_id: UUID, test_id: UUID) -> None:
    """Inscrit la correction d'une copie (à valider avec la transaction de la correction)."""
    db.add(
        UsageLog(
            teacher_id=teacher.id,
            school_id=teacher.school_id,
            action=USAGE_ACTION,
            action_value=str(copy_id),
            details={"test_id": str(test_id)},
        )
    )
