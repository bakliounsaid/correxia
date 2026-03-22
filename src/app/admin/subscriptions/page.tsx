import { AdminSubscriptionStatusBadge } from "@/components/admin/AdminSubscriptionStatusBadge";
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

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Tous les abonnements
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {rows.length} ligne{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Libellé</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Période</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Montant</th>
                <th className="px-6 py-3">Début</th>
                <th className="px-6 py-3">Fin</th>
                <th className="px-6 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    Aucun abonnement.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {r.plan_type}
                    </td>
                    <td className="max-w-[160px] truncate px-6 py-4 text-gray-600">
                      {r.plan_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {r.teacher_id
                        ? "Enseignant"
                        : r.school_id
                          ? "École"
                          : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {r.billing_period}
                    </td>
                    <td className="px-6 py-4">
                      <AdminSubscriptionStatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-primary-500">
                        {((r.price_cents ?? 0) / 100).toFixed(2)} €
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(r.start_date)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(r.end_date)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
