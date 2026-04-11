/** Offres affichées aux administrateurs d’établissement (aligné sur la page d’accueil). */

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
    name: "Accès ÉVALUATION",
    badge: "Démo gratuite",
    priceLabel: "0€",
    priceNote: "14 jours fixes",
    ctaLabel: "En savoir plus",
    externalHref: "/register-school",
    features: [
      "Jusqu’à 3 enseignants",
      "Copies illimitées pendant la période test",
      "Toutes les matières scientifiques",
      "Dashboard enseignant et directeur",
    ],
    footnote: "Idéal pour tester avant de souscrire à une offre payante.",
  },
  {
    id: "establishment",
    name: "Pack ÉTABLISSEMENT",
    priceLabel: "300€",
    priceNote: "par trimestre (3 mois)",
    highlight: true,
    checkoutPlan: "establishment",
    ctaLabel: "Payer et souscrire",
    features: [
      "Jusqu’à 10 enseignants",
      "Copies illimitées par trimestre",
      "Dashboard enseignant + vue directeur",
      "Statistiques consolidées établissement",
      "Archivage sécurisé conforme RGPD",
    ],
    footnote: "Paiement sécurisé par carte (Stripe). Facturation trimestrielle.",
  },
  {
    id: "institution",
    name: "Pack INSTITUTION",
    priceLabel: "Sur devis",
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
  if (p.includes("institution")) return "Pack INSTITUTION";
  if (p.includes("establishment") || p.includes("établissement")) return "Pack ÉTABLISSEMENT";
  if (p.includes("eval") || p.includes("démo") || p.includes("demo")) return "Accès ÉVALUATION";
  return plan;
}
