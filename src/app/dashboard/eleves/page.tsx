import Link from "next/link";
import { CircleUserRound, Plus } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ElevesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: currentUser } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isSchoolAdmin = currentUser?.role === "school_admin";
  const teacherId = await getTeacherId();

  if (!teacherId && !isSchoolAdmin) {
    return (
      <div className="p-8 lg:p-10">
        <header className="mb-4 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Mes élèves
          </h1>
          <p className="mt-1 text-gray-500">
            Gérez la liste de vos élèves et leurs classes
          </p>
        </header>
        <DashboardEmptyState
          title="Profil enseignant requis"
          message="Connectez-vous avec un compte disposant d’une ligne teachers dans Supabase pour afficher et gérer vos élèves."
          icon={CircleUserRound}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  let schoolId: string | null = null;
  if (isSchoolAdmin && user) {
    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .eq("admin_user_id", user.id)
      .maybeSingle();
    schoolId = school?.id ?? null;
  }

  const studentsQuery = supabase
    .from("students")
    .select(
      "id, first_name, last_name, email, class_name, is_active, created_at",
    )
    .order("last_name", { ascending: true });

  const { data: students } = isSchoolAdmin
    ? await studentsQuery.eq("school_id", schoolId ?? "__none__")
    : await studentsQuery.eq("teacher_id", teacherId!);

  const list = students ?? [];

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            {isSchoolAdmin ? "Élèves établissement" : "Mes élèves"}
          </h1>
          <p className="mt-1 text-gray-500">
            {isSchoolAdmin
              ? "Liste des élèves rattachés à votre établissement"
              : "Liste des élèves rattachés à votre compte enseignant"}
          </p>
        </div>
        <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-500">
          <Plus className="h-5 w-5" strokeWidth={2} />
          Ajout via API / SQL (bientôt formulaire)
        </span>
      </header>

      {list.length === 0 ? (
        <DashboardEmptyState
          title="Aucun élève"
          message={
            isSchoolAdmin
              ? "Aucun élève rattaché à votre établissement pour le moment."
              : "Vous n’avez pas encore d’élève enregistré. Ajoutez des lignes dans la table students (liées à votre teacher_id) ou attendez le formulaire d’ajout dans l’application."
          }
          icon={CircleUserRound}
          accentClass="border-t-ia-500"
        >
          <Link
            href="/dashboard/classes"
            className="inline-flex rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
          >
            Voir mes classes
          </Link>
        </DashboardEmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Prénom</th>
                  <th className="px-6 py-3">Classe</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3">Ajouté le</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {s.last_name}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{s.first_name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {s.class_name?.trim() || "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-4 text-gray-600">
                      {s.email ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          s.is_active
                            ? "rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-600"
                            : "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                        }
                      >
                        {s.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatShortDate(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
