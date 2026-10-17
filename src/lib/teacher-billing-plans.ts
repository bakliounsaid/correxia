/** Packs enseignant individuel. Chiffres : src/lib/plans.ts (source unique backend/app/plans.json). */

import { formatPrice, PLAN_TEXT, TEACHER_PLANS } from "@/lib/plans";

export type TeacherOfferId = "essential" | "advanced" | "mastery";

export type TeacherCheckoutPlan = "advanced" | "mastery";

export type TeacherOffer = {
  id: TeacherOfferId;
  name: string;
  badge?: string;
  priceLabel: string;
  priceNote?: string;
  highlight?: boolean;
  checkoutPlan?: TeacherCheckoutPlan;
  ctaLabel: string;
  externalHref?: string;
  features: string[];
  footnote?: string;
};

export const TEACHER_OFFERS: TeacherOffer[] = [
  {
    id: "essential",
    name: TEACHER_PLANS.essential.name,
    badge: "Freemium",
    priceLabel: formatPrice(TEACHER_PLANS.essential.price_cents),
    priceNote: "Gratuit",
    ctaLabel: "Créer un compte",
    externalHref: "/register",
    features: [
      PLAN_TEXT.essentialCopies,
      PLAN_TEXT.essentialAccess,
      "Scan et correction basique",
      PLAN_TEXT.essentialHistory,
    ],
    footnote: "Déjà inclus pour les comptes gratuits.",
  },
  {
    id: "advanced",
    name: TEACHER_PLANS.advanced.name,
    priceLabel: formatPrice(TEACHER_PLANS.advanced.price_cents),
    priceNote: "par trimestre (3 mois)",
    highlight: true,
    checkoutPlan: "advanced",
    ctaLabel: "Payer et souscrire",
    features: [
      PLAN_TEXT.advancedCopies,
      "Scan et correction complète",
      "Analyse du raisonnement et des calculs",
      "Statistiques par élève",
      "Historique illimité",
    ],
    footnote: "Paiement sécurisé par carte (Stripe).",
  },
  {
    id: "mastery",
    name: TEACHER_PLANS.mastery.name,
    priceLabel: formatPrice(TEACHER_PLANS.mastery.price_cents),
    priceNote: "par trimestre (3 mois)",
    checkoutPlan: "mastery",
    ctaLabel: "Payer et souscrire",
    features: [
      "Copies illimitées par trimestre",
      "Toutes les matières scientifiques",
      "Feedback IA automatique",
      "Traitement prioritaire",
      "Tableau de bord complet",
    ],
    footnote: "Paiement sécurisé par carte (Stripe).",
  },
];

/** Mise à niveau : packs payants uniquement (sans Essentiel / gratuit). */
export const TEACHER_UPGRADE_OFFERS: TeacherOffer[] = TEACHER_OFFERS.filter(
  (o) => o.checkoutPlan !== undefined,
);

export function teacherPlanLabel(plan: string | null | undefined): string {
  if (!plan) return `${TEACHER_PLANS.essential.name} (gratuit)`;
  const p = plan.toLowerCase();
  if (p === "mastery" || p.includes("maîtrise") || p.includes("mastery")) return TEACHER_PLANS.mastery.name;
  if (p === "advanced" || p.includes("avancé") || p.includes("advanced")) return TEACHER_PLANS.advanced.name;
  if (p === "free" || p.includes("essentiel")) return TEACHER_PLANS.essential.name;
  return plan;
}
