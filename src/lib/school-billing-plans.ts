/** Offres établissement. Chiffres : src/lib/plans.ts (source unique backend/app/plans.json). */

import { formatPrice, PLAN_TEXT, SCHOOL_PLANS } from "@/lib/plans";

export type SchoolOfferId = "evaluation" | "establishment" | "institution";

export type SchoolOffer = {
  id: SchoolOfferId;
  name: string;
  badge?: string;
  priceLabel: string;
  priceNote?: string;
  highlight?: boolean;
  /** Plan Stripe côté API (checkout) */
  checkoutPlan?: "establishment";
  ctaLabel: string;
  /** Lien externe si pas de paiement en ligne */
  externalHref?: string;
  features: string[];
  footnote?: string;
};

export const SCHOOL_OFFERS: SchoolOffer[] = [
  {
    id: "evaluation",
    name: SCHOOL_PLANS.evaluation.name,
    badge: "Démo gratuite",
    priceLabel: formatPrice(SCHOOL_PLANS.evaluation.price_cents),
    priceNote: PLAN_TEXT.trialDays,
    ctaLabel: "En savoir plus",
    externalHref: "/register-school",
    features: [
      PLAN_TEXT.maxTeachers(SCHOOL_PLANS.evaluation.max_teachers),
      "Copies illimitées pendant la période test",
      "Toutes les matières scientifiques",
      "Dashboard enseignant et directeur",
    ],
    footnote: "Idéal pour tester avant de souscrire à une offre payante.",
  },
  {
    id: "establishment",
    name: SCHOOL_PLANS.establishment.name,
    priceLabel: formatPrice(SCHOOL_PLANS.establishment.price_cents),
    priceNote: "par trimestre (3 mois)",
    highlight: true,
    checkoutPlan: "establishment",
    ctaLabel: "Payer et souscrire",
    features: [
      PLAN_TEXT.maxTeachers(SCHOOL_PLANS.establishment.max_teachers),
      "Copies illimitées par trimestre",
      "Dashboard enseignant + vue directeur",
      "Statistiques consolidées établissement",
      "Archivage sécurisé conforme RGPD",
    ],
    footnote: "Paiement sécurisé par carte (Stripe). Facturation trimestrielle.",
  },
  {
    id: "institution",
    name: SCHOOL_PLANS.institution.name,
    priceLabel: formatPrice(SCHOOL_PLANS.institution.price_cents),
    priceNote: "Offre personnalisée",
    ctaLabel: "Nous contacter",
    externalHref: "/#contact",
    features: [
      "Multi-campus, enseignants illimités",
      "Déploiement et hébergement dédié",
      "SLA contractuel, intégrations API",
      "Support prioritaire 24/7",
    ],
    footnote: "Tarif sur mesure — échange avec l’équipe commerciale.",
  },
];

/** Mise à niveau : offres payantes ou sur devis uniquement (sans démo gratuite). */
export const SCHOOL_UPGRADE_OFFERS: SchoolOffer[] = SCHOOL_OFFERS.filter(
  (o) => o.id !== "evaluation",
);

export function offerLabelFromPlan(plan: string | null | undefined): string {
  if (!plan) return "Aucune offre référencée";
  const p = plan.toLowerCase();
  if (p.includes("institution")) return SCHOOL_PLANS.institution.name;
  if (p.includes("establishment") || p.includes("établissement")) return SCHOOL_PLANS.establishment.name;
  if (p.includes("eval") || p.includes("démo") || p.includes("demo")) return SCHOOL_PLANS.evaluation.name;
  return plan;
}
