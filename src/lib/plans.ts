/**
 * Offres commerciales : chiffres importés au build depuis backend/app/plans.json, la source unique
 * qu'applique aussi l'API (quotas, prix Stripe). Ne jamais réécrire ces valeurs ailleurs dans le frontend.
 */
import plans from "../../backend/app/plans.json";

export const TEACHER_PLANS = plans.teacher;
export const SCHOOL_PLANS = plans.school;

/** 4500 → « 45€ » ; null → « Sur devis ». */
export function formatPrice(cents: number | null): string {
  if (cents === null) return "Sur devis";
  const euros = cents / 100;
  return `${Number.isInteger(euros) ? euros : euros.toFixed(2).replace(".", ",")}€`;
}

const { essential, advanced } = TEACHER_PLANS;

/** Phrases réutilisées sur la page d'accueil, l'abonnement et la FAQ. */
export const PLAN_TEXT = {
  essentialCopies: `Jusqu’à ${essential.copy_limit} copies`,
  essentialAccess: `Accès ${essential.access_days} jours ou ${essential.copy_limit} copies`,
  essentialHistory: `Historique limité à ${essential.history_days} jours`,
  advancedCopies: `Jusqu’à ${advanced.copy_limit} copies par trimestre`,
  maxTeachers: (count: number) => `Jusqu’à ${count} enseignants`,
  trialDays: `${SCHOOL_PLANS.evaluation.trial_days} jours fixes`,
} as const;
