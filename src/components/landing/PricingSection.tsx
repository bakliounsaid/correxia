"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

type Feature = { label: string; included: boolean };

type Plan = {
  name: string;
  badge?: string;
  price: string;
  priceNote?: string;
  highlight?: boolean;
  cta: string;
  href: string;
  ctaStyle?: "primary" | "secondary" | "outline";
  features: Feature[];
  footnote?: string;
};

const b2cPlans: Plan[] = [
  {
    name: "Pack ESSENTIEL",
    badge: "Freemium",
    price: "0€",
    priceNote: "Gratuit",
    cta: "Commencer gratuitement",
    href: "/register",
    ctaStyle: "outline",
    features: [
      { label: "Jusqu’à 40 copies", included: true },
      { label: "Accès 30 jours ou 40 copies (le premier atteint bloque)", included: true },
      { label: "Scan et correction basique", included: true },
      { label: "Historique limité à 30 jours", included: true },
      { label: "Analyse détaillée du raisonnement", included: false },
      { label: "Statistiques avancées", included: false },
      { label: "Feedback IA automatique", included: false },
    ],
    footnote: "Blocage automatique après 30 jours ou 40 copies.",
  },
  {
    name: "Pack AVANCÉ",
    price: "45€",
    priceNote: "par trimestre (3 mois)",
    highlight: true,
    cta: "Choisir Avancé",
    href: "/register",
    ctaStyle: "primary",
    features: [
      { label: "Jusqu’à 250 copies par trimestre", included: true },
      { label: "Durée : 3 mois (calendrier scolaire)", included: true },
      { label: "Scan et correction complète", included: true },
      { label: "Analyse détaillée du raisonnement", included: true },
      { label: "Analyse des calculs", included: true },
      { label: "Statistiques par élève", included: true },
      { label: "Historique illimité", included: true },
      { label: "Feedback IA automatique", included: false },
      { label: "Traitement prioritaire", included: false },
    ],
    footnote: "Accès bloqué après 250 copies sur la période.",
  },
  {
    name: "Pack MAÎTRISE",
    price: "79€",
    priceNote: "par trimestre (3 mois)",
    cta: "Choisir Maîtrise",
    href: "/register",
    ctaStyle: "secondary",
    features: [
      { label: "Copies illimitées par trimestre", included: true },
      { label: "Toutes les matières scientifiques", included: true },
      { label: "Scan et correction complète, précision maximale", included: true },
      { label: "Analyse du raisonnement et des calculs", included: true },
      { label: "Analyse comparative entre classes", included: true },
      { label: "Statistiques par élève + tableau de bord complet", included: true },
      { label: "Feedback IA généré automatiquement", included: true },
      { label: "Historique illimité", included: true },
      { label: "Traitement prioritaire (support accéléré)", included: true },
    ],
  },
];

const b2bPlans: Plan[] = [
  {
    name: "Accès ÉVALUATION",
    badge: "Démo gratuite",
    price: "0€",
    priceNote: "14 jours fixes",
    cta: "Demander la démo",
    href: "/register-school",
    ctaStyle: "outline",
    features: [
      { label: "Jusqu’à 3 enseignants", included: true },
      { label: "Copies illimitées pendant la période test", included: true },
      { label: "Toutes les matières scientifiques", included: true },
      { label: "Scan et correction complète", included: true },
      { label: "Formation initiale (visio)", included: true },
      { label: "Support dédié", included: true },
      { label: "Dashboard enseignant et directeur", included: true },
      { label: "Archivage long terme après la période", included: false },
      { label: "Export final après la période", included: false },
    ],
    footnote: "Données supprimées après 14 jours — pas de sauvegarde longue durée.",
  },
  {
    name: "Pack ÉTABLISSEMENT",
    price: "300€",
    priceNote: "par trimestre (3 mois)",
    highlight: true,
    cta: "Souscrire pour mon établissement",
    href: "/register-school",
    ctaStyle: "primary",
    features: [
      { label: "Jusqu’à 10 enseignants", included: true },
      { label: "Copies illimitées par trimestre", included: true },
      { label: "Toutes les matières scientifiques", included: true },
      { label: "Scan et correction complète", included: true },
      { label: "Analyse raisonnement + calculs", included: true },
      { label: "Dashboard enseignant (chaque prof) + directeur (vue globale)", included: true },
      { label: "Statistiques consolidées établissement", included: true },
      { label: "Archivage sécurisé conforme RGPD", included: true },
      { label: "Formation initiale et support dédié", included: true },
    ],
    footnote: "Facturation trimestrielle. Au-delà de 10 enseignants → Pack Institution.",
  },
  {
    name: "Pack INSTITUTION",
    price: "Sur devis",
    priceNote: "Offre personnalisée",
    cta: "Nous contacter",
    href: "/#contact",
    ctaStyle: "secondary",
    features: [
      { label: "Multi-campus illimité", included: true },
      { label: "Enseignants illimités", included: true },
      { label: "Copies illimitées", included: true },
      { label: "Matières scientifiques complètes + précision maximale", included: true },
      { label: "Analyses comparatives classes et établissements", included: true },
      { label: "Dashboards enseignant, directeur et administrateur multi-campus", included: true },
      { label: "Déploiement et hébergement dédié", included: true },
      { label: "SLA contractuel, branding personnalisé, intégrations API", included: true },
      { label: "Support prioritaire 24/7, archivage RGPD", included: true },
    ],
    footnote: "Aucune limite technique — tarif sur mesure.",
  },
];

function FeatureRow({ label, included }: Feature) {
  return (
    <li className="flex gap-2.5 text-sm leading-snug text-gray-700">
      {included ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" aria-hidden />
      )}
      <span className={included ? "" : "text-gray-500"}>{label}</span>
    </li>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const ctaClasses =
    plan.ctaStyle === "primary"
      ? "bg-primary-500 text-white hover:bg-primary-600"
      : plan.ctaStyle === "secondary"
        ? "bg-ia-600 text-white hover:bg-ia-700"
        : "border border-gray-200 text-gray-900 hover:bg-gray-50";

  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl md:p-8 ${
        plan.highlight
          ? "border-primary-500 bg-white shadow-card ring-1 ring-primary-500/20"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
        {plan.badge && (
          <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700">
            {plan.badge}
          </span>
        )}
      </div>
      <p className="mt-4">
        <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
        {plan.priceNote && (
          <span className="ml-2 text-sm text-gray-500">{plan.priceNote}</span>
        )}
      </p>
      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((f) => (
          <FeatureRow key={f.label} {...f} />
        ))}
      </ul>
      {plan.footnote && (
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
          {plan.footnote}
        </p>
      )}
      <Link
        href={plan.href}
        className={`mt-6 flex w-full justify-center rounded-full py-3 text-sm font-semibold transition-all duration-300 active:scale-[0.98] ${ctaClasses}`}
      >
        {plan.cta}
      </Link>
    </div>
  );
}

export function PricingSection() {
  const [segment, setSegment] = useState<"b2c" | "b2b">("b2c");
  const plans = segment === "b2c" ? b2cPlans : b2bPlans;

  return (
    <section id="tarifs" className="border-t border-gray-100 bg-gray-50 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-3xl font-semibold text-gray-900">Tarifs</h2>
        <p className="mt-2 max-w-2xl text-gray-600">
          Choisissez l’offre adaptée à votre situation : enseignant indépendant
          ou établissement scolaire.
        </p>

        <div
          className="mt-8 flex justify-center"
          role="tablist"
          aria-label="Type d’offre"
        >
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              role="tab"
              aria-selected={segment === "b2c"}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 md:px-8 ${
                segment === "b2c"
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setSegment("b2c")}
            >
              Enseignants indépendants
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={segment === "b2b"}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 md:px-8 ${
                segment === "b2b"
                  ? "bg-ia-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setSegment("b2b")}
            >
              Établissements scolaires
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
          {segment === "b2c"
            ? "B2C — enseignants indépendants"
            : "B2B — écoles et réseaux"}
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}
