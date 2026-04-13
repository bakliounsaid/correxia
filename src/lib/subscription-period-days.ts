/** Période de facturation Stripe → nombre de jours affiché en admin. */
const PAID_BILLING_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export function formatDaysLabel(days: number): string {
  return `${days} jour${days !== 1 ? "s" : ""}`;
}

/** Abonnement payant : uniquement une durée en jours (ou "—"). */
export function paidBillingPeriodToDaysLabel(period: string): string {
  const n = PAID_BILLING_DAYS[period];
  if (n != null) return formatDaysLabel(n);
  return "—";
}
