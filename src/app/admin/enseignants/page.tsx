import { Eye } from "lucide-react";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { cn } from "@/lib/utils";

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

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Liste des enseignants
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {rows.length} profil{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Nom</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Matière</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Profil</th>
                <th className="px-6 py-3">Inscrit le</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    Aucun enseignant.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const u = r.users;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {u?.full_name ?? "—"}
                      </td>
                      <td className="max-w-[200px] truncate px-6 py-4 text-gray-600">
                        {u?.email ?? "—"}
                      </td>
                      <td className="px-6 py-4 capitalize text-gray-600">
                        {r.subject}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            planBadgeClass(r.subscription_plan),
                          )}
                        >
                          {r.subscription_plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {r.is_independent ? "Indépendant" : "Établissement"}
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
