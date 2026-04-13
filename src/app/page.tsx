import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Leaf,
  ScanLine,
  Shield,
  Sparkles,
} from "lucide-react";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ContactSection } from "@/components/landing/ContactSection";
import { WorkflowMockup } from "@/components/landing/WorkflowMockup";
import { PricingSection } from "@/components/landing/PricingSection";
import { Reveal } from "@/components/landing/Reveal";
import { StatCounter } from "@/components/landing/StatCounter";

const PlatformChatbot = dynamic(
  () =>
    import("@/components/support/PlatformChatbot").then((m) => m.PlatformChatbot),
  { ssr: false, loading: () => null },
);

const faqItems = [
  {
    q: "Comment fonctionne CORREXIA ?",
    a: "Importez le sujet ou vos supports (PDF), définissez le barème, déposez les copies scannées ou photographiées. L’IA analyse et propose une correction que vous validez avant envoi aux élèves.",
  },
  {
    q: "Pour quels niveaux et matières ?",
    a: "L’outil est pensé pour les lycée et classes scientifiques : mathématiques, physique, sciences. Les formules, schémas et raisonnements sont pris en compte dans l’analyse.",
  },
  {
    q: "Puis-je modifier la correction proposée ?",
    a: "Oui. Vous gardez le contrôle : ajustement des points, commentaires personnalisés et validation finale sur chaque copie.",
  },
  {
    q: "Y a-t-il une période d’essai ?",
    a: "Enseignants : le pack Essentiel est gratuit (40 copies ou 30 jours, selon la première limite atteinte). Établissements : l’accès Évaluation offre 14 jours de démo avec jusqu’à 3 enseignants.",
  },
  {
    q: "Comment sont protégées les données ?",
    a: "Données hébergées de façon sécurisée, chiffrement en transit, accès authentifié. Vous pouvez consulter notre politique de confidentialité pour le détail.",
  },
];

const stats = [
  {
    end: 2,
    prefix: "~",
    suffix: " min",
    label: "par copie pour valider après analyse IA",
  },
  { end: 10, suffix: "×", label: "plus rapide qu’une correction entièrement manuelle" },
  {
    end: 3,
    suffix: "+",
    label: "matières scientifiques (maths, physique, sciences)",
  },
  {
    end: 100,
    suffix: "%",
    label: "validation humaine avant publication des notes",
  },
];

const testimonials = [
  {
    quote:
      "J'économise environ 6 heures par semaine sur la correction. Je consacre ce temps aux élèves qui en ont besoin. La validation manuelle reste indispensable, et CORREXIA respecte ça.",
    author: "Thomas D.",
    role: "Professeur de physique-chimie",
    context: "Lycée technologique — Lyon",
    accent: "primary",
  },
  {
    quote:
      "Notre établissement cherchait une solution pérenne pour les évaluations. CORREXIA s'est imposé par sa simplicité et la qualité des analyses. Les statistiques par classe sont précieuses.",
    author: "Sophie M.",
    role: "Directrice pédagogique",
    context: "Lycée privé — Bordeaux",
    accent: "success",
  },
  {
    quote:
      "Les suggestions de l'IA sont pertinentes et le barème est bien respecté. J'apprécie de pouvoir ajuster les points avant validation. Un vrai gain de temps pour les devoirs surveillés.",
    author: "Pierre R.",
    role: "Enseignant de mathématiques",
    context: "Lycée — Nantes",
    accent: "ia",
  },
] as const;

const landingPosts = [
  {
    tag: "Pédagogie",
    title: "Barème et IA : garder le contrôle pédagogique",
    excerpt:
      "Comment structurer un barème clair pour que la correction assistée reste alignée avec vos objectifs.",
  },
  {
    tag: "IA",
    title: "Correction scientifique et vision par ordinateur",
    excerpt:
      "Ce que l'IA voit dans une copie manuscrite de maths ou de physique - et ses limites.",
  },
  {
    tag: "Organisation",
    title: "Flux de travail : de la collecte des copies à la note finale",
    excerpt: "Un parcours type pour les classes de lycée avec CORREXIA.",
  },
] as const;

export const metadata: Metadata = {
  title: "CORREXIA - Correction de copies assistée par IA",
  description:
    "CORREXIA aide les enseignants de sciences a corriger plus vite: scan des copies, application du bareme, validation humaine et statistiques de classe.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CORREXIA - Correction de copies assistée par IA",
    description:
      "Corrigez vos copies manuscrites plus vite, gardez la validation finale, et suivez les performances de vos classes.",
    url: "/",
    siteName: "CORREXIA",
    locale: "fr_FR",
    type: "website",
  },
};

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);
  const primaryCtaHref = isLoggedIn ? "/dashboard" : "/register";
  const primaryCtaLabel = isLoggedIn ? "Accéder au dashboard" : "Démarrer l'essai gratuit";
  const secondaryCtaHref = isLoggedIn ? "/dashboard" : "/register-school";
  const secondaryCtaLabel = isLoggedIn
    ? "Ouvrir mon espace"
    : "Découvrir l'offre établissement";
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CORREXIA",
    url: "https://correxia.app",
    description:
      "Plateforme de correction de copies assistée par IA pour enseignants de sciences et établissements scolaires.",
    areaServed: "FR",
  };

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      <LandingHeader isLoggedIn={isLoggedIn} />
      <script
        type="application/ld+json"
        // Schema.org aide les moteurs à mieux comprendre le produit.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      {/* Hero */}
      <section
        id="accueil"
        className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-secondary-50 via-white to-white"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-400/25 blur-3xl motion-reduce:animate-none animate-hero-glow"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-secondary-400/20 blur-3xl motion-reduce:animate-none animate-hero-glow"
          style={{ animationDelay: "4s" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-5 py-16 text-center md:py-24">
          <h1 className="text-balance text-4xl font-semibold leading-[1.15] tracking-tight text-gray-900 motion-reduce:animate-none animate-hero-fade-up md:text-5xl lg:text-[3.25rem]">
            La correction de copies assistée par l&apos;IA, pour les enseignants de sciences
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 motion-reduce:animate-none animate-hero-fade-up hero-delay-1 md:text-xl">
            CORREXIA analyse vos copies manuscrites, applique votre barème et propose
            une correction que vous validez. Gagnez des heures chaque semaine sans
            sacrifier l&apos;exigence pédagogique ni le retour personnalisé aux élèves.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center motion-reduce:animate-none animate-hero-fade-up hero-delay-2">
            <Link
              href={primaryCtaHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-primary-600 hover:shadow-xl active:scale-[0.98]"
            >
              {primaryCtaLabel}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="#tarifs"
              className="inline-flex items-center justify-center rounded-full border-2 border-gray-300 px-8 py-4 text-base font-semibold text-gray-800 transition-all duration-300 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/50"
            >
              Voir les offres
            </Link>
          </div>
        </div>
      </section>

      {/* Features : 3 cartes style Examino */}
      <section className="bg-[#0a2a1a] px-5 py-16 md:py-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:gap-6">
          {/* Carte 1 — Scan */}
          <Reveal className="flex flex-1" delayMs={0}>
            <div className="group flex h-full flex-1 flex-col rounded-[2rem] bg-[#fdfcf8] p-8 text-center transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-2xl md:p-10">
              <div className="mx-auto flex h-28 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 transition-transform duration-500 group-hover:scale-[1.03]">
                <ScanLine className="h-14 w-14 text-primary-500 motion-safe:animate-float" />
              </div>
              <h2 className="mt-8 text-xl font-bold text-gray-900 md:text-2xl">
                Scannez vos copies manuscrites en un instant
              </h2>
              <p className="mt-4 text-gray-600">
                Numérisez facilement vos copies avec votre smartphone, même écrites
                à la main et peu importe le format.
              </p>
            </div>
          </Reveal>

          {/* Carte 2 — IA (mise en avant) */}
          <Reveal className="flex flex-1" delayMs={100}>
            <div className="group flex h-full flex-1 flex-col rounded-[2rem] border border-white/10 bg-[#1a3a2a] p-8 text-center text-white shadow-xl transition-all duration-500 ease-out hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl md:p-10">
              <div className="mx-auto flex h-28 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl bg-white/5 transition-transform duration-500 group-hover:scale-[1.03]">
                <div className="text-center">
                  <Sparkles className="mx-auto h-12 w-12 text-primary-300 motion-safe:animate-pulse-soft" />
                  <span className="mt-2 block text-2xl font-bold text-white transition-transform duration-300 group-hover:scale-105">
                    20/20
                  </span>
                </div>
              </div>
              <h2 className="mt-8 text-xl font-bold md:text-2xl">
                Analyse et correction automatisée
              </h2>
              <p className="mt-4 text-primary-100">
                L&apos;IA de CORREXIA identifie les erreurs, applique votre barème
                et propose des corrections objectives et équitables.
              </p>
            </div>
          </Reveal>

          {/* Carte 3 — Suivi */}
          <Reveal className="flex flex-1" delayMs={200}>
            <div className="group flex h-full flex-1 flex-col rounded-[2rem] bg-[#fdfcf8] p-8 text-center transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-2xl md:p-10">
              <div className="mx-auto flex h-28 w-full max-w-[200px] flex-col items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-transform duration-500 group-hover:scale-[1.03]">
                <BarChart3 className="h-12 w-12 text-primary-500 motion-safe:animate-float" />
                <span className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Répartition des notes
                </span>
              </div>
              <h2 className="mt-8 text-xl font-bold text-gray-900 md:text-2xl">
                Suivi des performances de la classe
              </h2>
              <p className="mt-4 text-gray-600">
                Recevez des notes détaillées et exportez-les dans vos outils
                pédagogiques.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Témoignages */}
      <section
        id="temoignages"
        className="border-y border-gray-100 bg-secondary-50/60 py-16 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <h2 className="text-center text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              Ils font confiance à CORREXIA
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
              Enseignants et établissements utilisent notre plateforme au quotidien
              pour alléger la correction et maintenir une évaluation équitable.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => {
              const accentStyles = {
                primary:
                  "border-l-4 border-l-primary-500 bg-gradient-to-br from-primary-50/50 to-white",
                success:
                  "border-l-4 border-l-success-500 bg-gradient-to-br from-success-50/50 to-white",
                ia: "border-l-4 border-l-ia-500 bg-gradient-to-br from-ia-50/50 to-white",
              };
              const accent = t.accent as keyof typeof accentStyles;
              return (
                <Reveal key={t.author} delayMs={i * 80}>
                  <div
                    className={`flex h-full flex-col rounded-2xl border border-gray-100 p-6 shadow-sm transition-all duration-300 hover:shadow-md md:p-8 ${accentStyles[accent] || accentStyles.primary}`}
                  >
                    <blockquote className="flex-1 text-base leading-relaxed text-gray-800 md:text-lg">
                      &laquo; {t.quote} &raquo;
                    </blockquote>
                    <footer className="mt-6 border-t border-gray-100 pt-4">
                      <p className="font-semibold text-gray-900">{t.author}</p>
                      <p className="text-sm text-gray-600">{t.role}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{t.context}</p>
                    </footer>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="py-14 md:py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 md:grid-cols-4 md:gap-6">
          {stats.map((s, i) => (
            <Reveal key={s.label} delayMs={i * 80} className="text-center">
              <div className="rounded-2xl py-2 transition-transform duration-300 hover:scale-[1.03]">
                <StatCounter
                  end={s.end}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  duration={1400}
                  className="text-3xl font-bold text-primary-500 md:text-4xl"
                />
                <p className="mt-2 text-sm text-gray-600">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Matières & capacités */}
      <section className="border-t border-gray-100 bg-gray-50 py-16 md:py-24">
        <Reveal className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
            Conçu pour les sciences au lycée
          </h2>
          <p className="mt-4 max-w-2xl text-gray-600">
            Mathématiques, physique-chimie, sciences de la vie et de la Terre :
            CORREXIA analyse les raisonnements, formules LaTeX, schémas et calculs,
            en respectant vos critères d&apos;évaluation.
          </p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
            {[
              "Analyser des calculs et chaînes de raisonnement",
              "Prendre en compte formules, schémas et notations (dont LaTeX côté saisie)",
              "Comparer au corrigé de référence et à votre barème personnalisé",
              "Proposer des commentaires structurés pour vos retours élèves",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-gray-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={primaryCtaHref}
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-primary-600 hover:shadow-lg active:scale-[0.98]"
          >
            {primaryCtaLabel}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </section>

      {/* Simplicité */}
      <section className="py-16 md:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-5 lg:flex-row lg:items-center lg:gap-16">
          <Reveal className="flex-1" delayMs={0}>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
                Un flux de travail adapté à votre pratique
              </h2>
              <p className="mt-4 text-gray-600">
                Créez votre évaluation, importez le sujet et définissez le barème.
                Déposez les copies scannées ou photographiées, validez les
                propositions de l&apos;IA puis exportez les notes. Une interface
                sobre qui ne vous détourne pas de l&apos;essentiel.
              </p>
              <Link
                href={secondaryCtaHref}
                className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-gray-900 px-6 py-3 text-sm font-semibold text-gray-900 transition-all duration-300 hover:bg-gray-900 hover:text-white active:scale-[0.98]"
              >
                {secondaryCtaLabel}
              </Link>
            </div>
          </Reveal>
          <Reveal className="flex-1" delayMs={120}>
            <div className="flex justify-center lg:justify-end">
              <WorkflowMockup />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Qualité des évaluations */}
      <section className="border-t border-gray-100 bg-primary-600 py-16 text-white md:py-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 lg:flex-row lg:items-center lg:gap-16">
          <Reveal className="flex-1" delayMs={0}>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Objectivité et équité dans l&apos;évaluation
              </h2>
              <p className="mt-4 text-primary-100">
                Un barème identique appliqué à toutes les copies réduit les biais
                involontaires et les écarts entre correcteurs. Vous gardez le
                contrôle : ajustements, commentaires personnalisés et validation
                finale restent entre vos mains.
              </p>
              <Link
                href={primaryCtaHref}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary-600 transition-all duration-300 hover:bg-primary-50 hover:shadow-lg active:scale-[0.98]"
              >
                {primaryCtaLabel}
              </Link>
            </div>
          </Reveal>
          <Reveal className="mt-10 w-full flex-1 lg:mt-0" delayMs={100}>
            <div className="rounded-2xl bg-white/10 p-8 backdrop-blur-sm transition-all duration-500 hover:bg-white/15">
              <BarChart3 className="h-12 w-12 text-white/90 motion-safe:animate-float" />
              <p className="mt-4 text-sm text-primary-100">
                Statistiques et exports pour vos bulletins et réunions
                pédagogiques.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Responsable */}
      <section className="py-16 md:py-24">
        <Reveal className="mx-auto max-w-3xl px-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600 transition-transform duration-500 motion-safe:animate-float">
            <Leaf className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-gray-900">
            Une IA au service de la pédagogie
          </h2>
          <p className="mt-4 text-gray-600">
            CORREXIA s&apos;engage sur la transparence de l&apos;usage de l&apos;IA,
            la protection des données personnelles (RGPD) et la responsabilité de
            l&apos;enseignant. L&apos;outil assiste la décision pédagogique, il ne
            la remplace pas.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <span className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary-500" />
              Données et accès sécurisés
            </span>
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary-500" />
              Équité & validation humaine
            </span>
          </div>
        </Reveal>
      </section>

      <Reveal>
        <PricingSection />
      </Reveal>

      <Reveal>
        <ContactSection />
      </Reveal>

      {/* FAQ accordéon */}
      <section id="faq" className="py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <h2 className="text-3xl font-semibold text-gray-900">
              Questions fréquentes
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {faqItems.map((item, i) => (
              <Reveal key={item.q} delayMs={i * 50}>
                <details className="group rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-300 open:border-primary-200 open:shadow-md open:ring-1 open:ring-primary-500/10">
                  <summary className="cursor-pointer list-none font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.q}
                      <span className="text-primary-500 transition-transform duration-300 ease-out group-open:rotate-180">
                        ▼
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Articles (aperçu type blog) */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <h2 className="text-2xl font-semibold text-gray-900">
              Ressources & actualités
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {landingPosts.map((post, i) => (
              <Reveal key={post.title} delayMs={i * 90}>
              <article
                className="group h-full rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  {post.tag}
                </span>
                <h3 className="mt-2 font-semibold text-gray-900">{post.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{post.excerpt}</p>
                <span className="mt-4 inline-block text-sm font-medium text-primary-500 transition-colors group-hover:text-primary-600">
                  Bientôt disponible
                </span>
              </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden border-t border-gray-100 bg-gradient-to-br from-primary-600 to-primary-800 py-16 text-center text-white md:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,255,255,0.18),transparent)] motion-reduce:animate-none animate-hero-glow"
          style={{ animationDuration: "14s" }}
          aria-hidden
        />
        <Reveal className="relative mx-auto max-w-2xl px-5">
          <h2 className="text-2xl font-semibold md:text-3xl">
            Essayez CORREXIA gratuitement
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-100">
            Gagnez du temps sur la correction tout en gardant la validation finale.
            Créez votre compte en quelques minutes.
          </p>
          <Link
            href={primaryCtaHref}
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-primary-600 shadow-lg transition-all duration-300 hover:bg-primary-50 hover:shadow-xl active:scale-[0.98]"
          >
            {primaryCtaLabel}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      {/* Footer multi-colonnes */}
      <footer className="border-t border-gray-200 bg-gray-900 text-gray-300">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-white">
                <CorrexiaLogo variant="svg" size={32} />
                <span className="font-bold">CORREXIA</span>
              </div>
              <p className="mt-3 max-w-xs text-sm text-gray-400">
                Correction assistée par IA pour les enseignants de sciences au
                lycée.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Produit
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>
                    <a href="#tarifs" className="hover:text-white">
                      Tarifs
                    </a>
                  </li>
                  <li>
                    <Link href="/register" className="hover:text-white">
                      S&apos;inscrire
                    </Link>
                  </li>
                  <li>
                    {isLoggedIn ? (
                      <Link href="/dashboard" className="hover:text-white">
                        Dashboard
                      </Link>
                    ) : (
                      <Link href="/login" className="hover:text-white">
                        Se connecter
                      </Link>
                    )}
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Organisation
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>
                    <Link href="/register-school" className="hover:text-white">
                      Établissement
                    </Link>
                  </li>
                  <li>
                    <a href="#temoignages" className="hover:text-white">
                      Témoignages
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="hover:text-white">
                      Centre d&apos;aide
                    </a>
                  </li>
                  <li>
                    <a href="#contact" className="hover:text-white">
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Légal
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>
                    <a href="#" className="hover:text-white">
                      Mentions légales
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      Confidentialité
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-white">
                      CGU
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-12 border-t border-gray-800 pt-8 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} CORREXIA — Tous droits réservés
          </p>
        </div>
      </footer>

      <PlatformChatbot />
    </div>
  );
}
