import { GraduationCap } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";

export default async function EnseignantsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 lg:p-10">
        <DashboardEmptyState
          title="Connexion requise"
          message="Connectez-vous pour accéder à la gestion des enseignants."
          icon={GraduationCap}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (currentUser?.role !== "school_admin") {
    return (
      <div className="p-8 lg:p-10">
        <DashboardEmptyState
          title="Accès établissement requis"
          message="Cette page est réservée aux comptes administrateur établissement."
          icon={GraduationCap}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("admin_user_id", user.id)
    .maybeSingle();

  if (!school?.id) {
    return (
      <div className="p-8 lg:p-10">
        <DashboardEmptyState
          title="Établissement introuvable"
          message="Aucun établissement n'est lié à ce compte administrateur."
          icon={GraduationCap}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, subject, created_at, users!inner ( full_name, email, role )")
    .eq("school_id", school.id)
    .eq("users.role", "teacher")
    .order("created_at", { ascending: false });

  const list = teachers ?? [];

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-6 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Enseignants
        </h1>
        <p className="mt-1 text-gray-500">
          Gestion des enseignants rattachés à votre établissement.
        </p>
      </header>

      {list.length === 0 ? (
        <DashboardEmptyState
          title="Aucun enseignant"
          message="Aucun enseignant n'est encore rattaché à votre établissement."
          icon={GraduationCap}
          accentClass="border-t-ia-500"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Matière</th>
                  <th className="px-6 py-3">Date d'ajout</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const u = normalizeRelationOne<{ full_name: string; email: string }>(
                    t.users as
                      | { full_name: string; email: string }
                      | { full_name: string; email: string }[]
                      | null,
                  );
                  return (
                    <tr key={t.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {u?.full_name?.trim() || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{u?.email || "—"}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {subjectLabelFr(t.subject)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(t.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

