import { Eye } from "lucide-react";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

type SchoolRow = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  country: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
};

function schoolStatusBadge(status: string | null) {
  if (!status)
    return { label: "—", className: "bg-gray-100 text-gray-600" };
  const s = status.toLowerCase();
  if (s === "active")
    return { label: status, className: "bg-success-50 text-success-600" };
  if (s === "trialing" || s === "pending")
    return { label: status, className: "bg-warning-50 text-warning-500" };
  return { label: status, className: "bg-gray-100 text-gray-700" };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminEcolesPage() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("schools")
    .select(
      "id, name, email, city, country, subscription_status, stripe_subscription_id, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as SchoolRow[];

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Écoles
        </h1>
        <p className="mt-1 text-gray-500">
          Établissements enregistrés et statut d’abonnement
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-error-50 bg-error-50 px-4 py-3 text-sm text-error-600">
          Impossible de charger la liste ({error.message}).
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Liste des établissements
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {rows.length} établissement{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Nom</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Ville</th>
                <th className="px-6 py-3">Pays</th>
                <th className="px-6 py-3">Statut abo.</th>
                <th className="px-6 py-3">Stripe</th>
                <th className="px-6 py-3">Créé le</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    Aucun établissement.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const st = schoolStatusBadge(r.subscription_status);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {r.name}
                      </td>
                      <td className="max-w-[180px] truncate px-6 py-4 text-gray-600">
                        {r.email ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {r.city ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {r.country ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            st.className,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.stripe_subscription_id ? (
                          <span className="font-mono text-xs text-primary-500">
                            Oui
                          </span>
                        ) : (
                          <span className="text-gray-400">Non</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href="/admin/subscriptions"
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-600"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                          Abonnements
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
