import { AdminSubscriptionsTableClient } from "@/components/admin/AdminSubscriptionsTableClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SubRow = {
  id: string;
  plan_type: string;
  plan_name: string | null;
  status: string;
  billing_period: string;
  price_cents: number;
  stripe_subscription_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  teacher_id: string | null;
  school_id: string | null;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminSubscriptionsPage() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, plan_type, plan_name, status, billing_period, price_cents, stripe_subscription_id, start_date, end_date, created_at, teacher_id, school_id",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as SubRow[];

  const clientRows = rows.map((r) => ({
    id: r.id,
    export: {
      plan: r.plan_type,
      libelle: r.plan_name ?? "",
      type: r.teacher_id ? "Enseignant" : r.school_id ? "École" : "",
      periode: r.billing_period,
      statut: r.status,
      montant_eur: ((r.price_cents ?? 0) / 100).toFixed(2),
      debut: formatDate(r.start_date),
      fin: formatDate(r.end_date),
      cree_le: formatDate(r.created_at),
    },
    plan_type: r.plan_type,
    plan_name: r.plan_name,
    typeLabel: r.teacher_id ? "Enseignant" : r.school_id ? "École" : "—",
    billing_period: r.billing_period,
    status: r.status,
    priceEuros: ((r.price_cents ?? 0) / 100).toFixed(2),
    startLabel: formatDate(r.start_date),
    endLabel: formatDate(r.end_date),
    createdLabel: formatDate(r.created_at),
  }));

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Subscriptions
        </h1>
        <p className="mt-1 text-gray-500">
          Historique et statut des abonnements enregistrés en base
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-error-50 bg-error-50 px-4 py-3 text-sm text-error-600">
          Impossible de charger les abonnements ({error.message}).
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Tous les abonnements
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">0 ligne</p>
          </div>
          <p className="px-6 py-10 text-center text-sm text-gray-500">Aucun abonnement.</p>
        </div>
      ) : (
        <AdminSubscriptionsTableClient
          rows={clientRows}
          toolbarLeft={
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Tous les abonnements
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {rows.length} ligne{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
