/** Packs enseignant individuel (hors offre gratuite Essentiel). */

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
    name: "Pack ESSENTIEL",
    badge: "Freemium",
    priceLabel: "0€",
    priceNote: "Gratuit",
    ctaLabel: "Créer un compte",
    externalHref: "/register",
    features: [
      "Jusqu’à 40 copies",
      "Accès 30 jours ou 40 copies",
      "Scan et correction basique",
      "Historique limité à 30 jours",
    ],
    footnote: "Déjà inclus pour les comptes gratuits.",
  },
  {
    id: "advanced",
    name: "Pack AVANCÉ",
    priceLabel: "45€",
    priceNote: "par trimestre (3 mois)",
    highlight: true,
    checkoutPlan: "advanced",
    ctaLabel: "Payer et souscrire",
    features: [
      "Jusqu’à 250 copies par trimestre",
      "Scan et correction complète",
      "Analyse du raisonnement et des calculs",
      "Statistiques par élève",
      "Historique illimité",
    ],
    footnote: "Paiement sécurisé par carte (Stripe).",
  },
  {
    id: "mastery",
    name: "Pack MAÎTRISE",
    priceLabel: "79€",
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
  if (!plan) return "Pack ESSENTIEL (gratuit)";
  const p = plan.toLowerCase();
  if (p === "mastery" || p.includes("maîtrise") || p.includes("mastery")) return "Pack MAÎTRISE";
  if (p === "advanced" || p.includes("avancé") || p.includes("advanced")) return "Pack AVANCÉ";
  if (p === "free" || p.includes("essentiel")) return "Pack ESSENTIEL";
  return plan;
}
