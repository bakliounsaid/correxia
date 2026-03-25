import Link from "next/link";
import { Users, BookOpen } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { getTeacherId, getTeacherRow } from "@/lib/teacher-context";

const ACCENTS = [
  "border-t-primary-500",
  "border-t-ia-500",
  "border-t-success-500",
  "border-t-secondary-500",
];

type StudentClassJoin = { class_name: string | null };

export default async function ClassesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: currentUser } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isSchoolAdmin = currentUser?.role === "school_admin";
  const teacherId = await getTeacherId();
  const teacher = await getTeacherRow();

  if ((!teacherId || !teacher) && !isSchoolAdmin) {
    return (
      <div className="p-8 lg:p-10">
        <header className="mb-4 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Mes classes</h1>
          <p className="mt-1 text-gray-500">
            Regroupement par nom de classe (champ élève).
          </p>
        </header>
        <DashboardEmptyState
          title="Aucune classe"
          message="Aucun profil enseignant n’est associé à ce compte. Après inscription, une ligne teachers doit être créée pour afficher vos classes et élèves."
          icon={Users}
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

  const studentsQuery = supabase.from("students").select("id, class_name");
  const { data: students } = isSchoolAdmin
    ? await studentsQuery.eq("school_id", schoolId ?? "__none__")
    : await studentsQuery.eq("teacher_id", teacherId!);

  const copiesQuery = supabase
    .from("test_copies")
    .select("test_id, students(class_name)");
  const { data: copies } = isSchoolAdmin
    ? await copiesQuery.eq("school_id", schoolId ?? "__none__")
    : await copiesQuery.eq("teacher_id", teacherId!);

  const byClass = new Map<string, number>();
  for (const s of students ?? []) {
    const label = s.class_name?.trim() || "Sans classe";
    byClass.set(label, (byClass.get(label) ?? 0) + 1);
  }

  const evalsByClass = new Map<string, Set<string>>();
  for (const row of copies ?? []) {
    const st = normalizeRelationOne<StudentClassJoin>(
      row.students as StudentClassJoin | StudentClassJoin[] | null,
    );
    const label = st?.class_name?.trim() || "Sans classe";
    if (!evalsByClass.has(label)) evalsByClass.set(label, new Set());
    if (row.test_id) evalsByClass.get(label)!.add(row.test_id);
  }

  const subject = teacher ? subjectLabelFr(teacher.subject) : "Établissement";

  const classNames = Array.from(byClass.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-6 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            {isSchoolAdmin ? "Classes établissement" : "Mes classes"}
        </h1>
        <p className="mt-1 text-gray-500">
            {isSchoolAdmin
              ? "Regroupement des élèves par classe pour l'établissement."
              : "Regroupement par nom de classe (champ élève). Ajoutez des élèves avec une classe pour remplir cette vue."}
        </p>
      </header>

      {classNames.length === 0 ? (
        <DashboardEmptyState
          title="Aucune classe"
          message="Aucun élève enregistré pour le moment. Ajoutez des fiches élèves avec un nom de classe pour voir vos groupes apparaître ici sous forme de cartes."
          icon={Users}
          accentClass="border-t-primary-500"
        >
          <Link
            href="/dashboard/eleves"
            className="inline-flex rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Gérer mes élèves
          </Link>
        </DashboardEmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classNames.map(([title, eleves], i) => (
            <article
              key={title}
              className={`rounded-xl border border-gray-200 border-t-4 bg-white p-6 shadow-card ${ACCENTS[i % ACCENTS.length]}`}
            >
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">{subject}</p>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>
                    <strong className="font-semibold text-gray-900">
                      {eleves}
                    </strong>{" "}
                    Élève{eleves !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span>
                    <strong className="font-semibold text-gray-900">
                      {evalsByClass.get(title)?.size ?? 0}
                    </strong>{" "}
                    Évaluation
                    {(evalsByClass.get(title)?.size ?? 0) !== 1 ? "s" : ""}{" "}
                    (copies)
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
