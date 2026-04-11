import {
  Users,
  Building2,
  CheckCircle2,
  GraduationCap,
  Euro,
  Wallet,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { AdminRecentSubscriptionsTableClient } from "@/components/admin/AdminRecentSubscriptionsTableClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServerClient();

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const [
    teachersRes,
    schoolsRes,
    studentsRes,
    activeSubsRes,
    recentSubsRes,
    allSubsRes,
    teachersMonthRes,
    schoolsMonthRes,
  ] = await Promise.all([
    supabase.from("teachers").select("*", { count: "exact", head: true }),
    supabase.from("schools").select("*", { count: "exact", head: true }),
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("subscriptions")
      .select(
        "id, plan_type, status, billing_period, price_cents, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("subscriptions").select("price_cents, status"),
    supabase
      .from("teachers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
    supabase
      .from("schools")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
  ]);

  const teachersTotal = teachersRes.count ?? 0;
  const schoolsTotal = schoolsRes.count ?? 0;
  const studentsTotal = studentsRes.count ?? 0;
  const activeSubsTotal = activeSubsRes.count ?? 0;
  const recent = recentSubsRes.data ?? [];
  const allSubs = allSubsRes.data ?? [];

  const mrrCents = allSubs
    .filter((s) => s.status === "active")
    .reduce((a, s) => a + (s.price_cents ?? 0), 0);

  const totalRecordedCents = allSubs.reduce(
    (a, s) => a + (s.price_cents ?? 0),
    0,
  );

  const recentClientRows = recent.map((row) => ({
    id: row.id as string,
    export: {
      plan: row.plan_type,
      periode: row.billing_period,
      statut: row.status,
      montant_eur: ((row.price_cents ?? 0) / 100).toFixed(2),
      cree_le: formatDate(row.created_at),
    },
    plan_type: row.plan_type,
    billing_period: row.billing_period,
    status: row.status,
    priceEuros: ((row.price_cents ?? 0) / 100).toFixed(2),
    createdLabel: formatDate(row.created_at),
  }));

  const overviewStats = [
    {
      label: "Enseignants inscrits",
      value: String(teachersTotal),
      icon: Users,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-500",
    },
    {
      label: "Établissements",
      value: String(schoolsTotal),
      icon: Building2,
      iconBg: "bg-secondary-50",
      iconColor: "text-secondary-500",
    },
    {
      label: "Élèves",
      value: String(studentsTotal),
      icon: GraduationCap,
      iconBg: "bg-ia-50",
      iconColor: "text-ia-600",
    },
    {
      label: "Abonnements actifs",
      value: String(activeSubsTotal),
      icon: CheckCircle2,
      iconBg: "bg-success-50",
      iconColor: "text-success-600",
    },
  ];

  const financeStats = [
    {
      label: "MRR estimé (abonnements actifs)",
      value: formatEuro(mrrCents),
      hint: "Somme des price_cents des lignes au statut actif",
      icon: Euro,
      iconBg: "bg-success-50",
      iconColor: "text-success-600",
    },
    {
      label: "Volume enregistré (toutes lignes)",
      value: formatEuro(totalRecordedCents),
      hint: "Somme des montants sur toutes les lignes subscriptions",
      icon: Wallet,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-500",
    },
    {
      label: "Nouveaux enseignants (ce mois)",
      value: String(teachersMonthRes.count ?? 0),
      hint: "Comptes teachers créés depuis le 1er du mois",
      icon: UserPlus,
      iconBg: "bg-warning-50",
      iconColor: "text-warning-500",
    },
    {
      label: "Nouveaux établissements (ce mois)",
      value: String(schoolsMonthRes.count ?? 0),
      hint: "Écoles créées depuis le 1er du mois",
      icon: Building2,
      iconBg: "bg-secondary-50",
      iconColor: "text-secondary-500",
    },
  ];

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Tableau de bord
        </h1>
        <p className="mt-1 text-gray-500">
          Vue d’ensemble : audience, abonnements et encaissements déclarés en base
        </p>
      </header>

      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        Audience & activité
      </p>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                s.iconBg,
              )}
            >
              <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        Encaissements & croissance (données subscriptions)
      </p>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {financeStats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                s.iconBg,
              )}
            >
              <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
            </div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              {s.value}
            </p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            {s.hint ? (
              <p className="mt-2 text-xs leading-snug text-gray-400">{s.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      {recent.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Derniers abonnements
            </h2>
            <Link
              href="/admin/subscriptions"
              className="text-sm font-medium text-primary-500 hover:text-primary-600"
            >
              Voir tout
            </Link>
          </div>
          <p className="px-6 py-10 text-center text-sm text-gray-500">
            Aucun abonnement enregistré pour le moment.
          </p>
        </div>
      ) : (
        <AdminRecentSubscriptionsTableClient
          rows={recentClientRows}
          toolbarLeft={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Derniers abonnements
              </h2>
              <Link
                href="/admin/subscriptions"
                className="text-sm font-medium text-primary-500 hover:text-primary-600"
              >
                Voir tout
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
