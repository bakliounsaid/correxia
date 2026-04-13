import { AdminEcolesTableClient } from "@/components/admin/AdminEcolesTableClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SchoolRow = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  country: string | null;
  subscription_status: string | null;
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
      "id, name, email, city, country, subscription_status, created_at",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as SchoolRow[];

  const clientRows = rows.map((r) => {
    const st = schoolStatusBadge(r.subscription_status);
    return {
      id: r.id,
      export: {
        nom: r.name,
        email: r.email ?? "",
        ville: r.city ?? "",
        pays: r.country ?? "",
        statut_abo: st.label,
        cree_le: formatDate(r.created_at),
      },
      name: r.name,
      email: r.email,
      city: r.city,
      country: r.country,
      statusLabel: st.label,
      statusBadgeClass: st.className,
      createdLabel: formatDate(r.created_at),
    };
  });

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

      {rows.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Liste des établissements
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">0 établissement</p>
          </div>
          <p className="px-6 py-10 text-center text-sm text-gray-500">Aucun établissement.</p>
        </div>
      ) : (
        <AdminEcolesTableClient
          rows={clientRows}
          toolbarLeft={
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Liste des établissements
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {rows.length} établissement{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
