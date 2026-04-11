import { AdminEnseignantsTableClient } from "@/components/admin/AdminEnseignantsTableClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";

type UserJoin = { full_name: string; email: string };

type TeacherRow = {
  id: string;
  subject: string;
  subscription_plan: string;
  subscription_status: string | null;
  created_at: string;
  is_independent: boolean;
  users: UserJoin | null;
};

function planBadgeClass(plan: string) {
  const p = plan.toLowerCase();
  if (p === "free") return "bg-gray-100 text-gray-700";
  if (p === "advanced") return "bg-primary-50 text-primary-600";
  if (p === "mastery") return "bg-ia-100 text-ia-700";
  return "bg-gray-100 text-gray-600";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminEnseignantsPage() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teachers")
    .select(
      "id, subject, subscription_plan, subscription_status, created_at, is_independent, users ( full_name, email )",
    )
    .order("created_at", { ascending: false });

  const rows: TeacherRow[] = (data ?? []).map((row) => ({
    ...(row as Omit<TeacherRow, "users">),
    users: normalizeRelationOne<UserJoin>(
      (row as { users?: UserJoin | UserJoin[] | null }).users,
    ),
  }));

  const clientRows = rows.map((r) => {
    const u = r.users;
    const fullName = u?.full_name ?? "—";
    const email = u?.email ?? "—";
    return {
      id: r.id,
      export: {
        nom: fullName === "—" ? "" : fullName,
        email: email === "—" ? "" : email,
        matiere: r.subject,
        plan: r.subscription_plan,
        profil: r.is_independent ? "Indépendant" : "Établissement",
        inscrit_le: formatDate(r.created_at),
      },
      fullName,
      email,
      subject: r.subject,
      planLabel: r.subscription_plan,
      planBadgeClass: planBadgeClass(r.subscription_plan),
      profilLabel: r.is_independent ? "Indépendant" : "Établissement",
      createdLabel: formatDate(r.created_at),
    };
  });

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Enseignants
        </h1>
        <p className="mt-1 text-gray-500">
          Profils enseignants liés à un compte utilisateur
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-error-50 bg-error-50 px-4 py-3 text-sm text-error-600">
          Impossible de charger la liste ({error.message}). Vérifiez les
          politiques RLS ou la relation <code>teachers → users</code>.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Liste des enseignants
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">0 profil</p>
          </div>
          <p className="px-6 py-10 text-center text-sm text-gray-500">Aucun enseignant.</p>
        </div>
      ) : (
        <AdminEnseignantsTableClient
          rows={clientRows}
          toolbarLeft={
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Liste des enseignants
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {rows.length} profil{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
