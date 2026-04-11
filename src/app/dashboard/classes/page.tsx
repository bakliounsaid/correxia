import Link from "next/link";
import { Users, BookOpen } from "lucide-react";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId, getTeacherRow } from "@/lib/teacher-context";

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
      <div className="p-5 lg:p-6">
        <header className="mb-3 border-b border-gray-200 pb-3">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Mes classes</h1>
          <p className="mt-1 text-gray-500">Regroupement par classes de l&apos;établissement.</p>
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

  const classIdsForTeacher = teacherId
    ? (
        await supabase
          .from("class_teachers")
          .select("class_id")
          .eq("teacher_id", teacherId)
      ).data?.map((l) => l.class_id as string) ?? []
    : [];

  const { data: classes } = isSchoolAdmin
    ? await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId ?? "__none__")
        .order("name", { ascending: true })
    : classIdsForTeacher.length > 0
      ? await supabase
          .from("classes")
          .select("id, name")
          .in("id", classIdsForTeacher)
          .order("name", { ascending: true })
      : { data: [] };

  const classMap = new Map((classes ?? []).map((c) => [c.id as string, c.name as string]));
  const classIds = Array.from(classMap.keys());

  const { data: students } =
    classIds.length > 0
      ? await supabase
          .from("students")
          .select("id, class_id")
          .in("class_id", classIds)
      : { data: [] };

  const byClass = new Map<string, number>();
  for (const cid of classIds) {
    byClass.set(cid, 0);
  }
  for (const s of students ?? []) {
    const cid = s.class_id as string;
    if (!byClass.has(cid)) continue;
    byClass.set(cid, (byClass.get(cid) ?? 0) + 1);
  }

  const { data: copies } =
    classIds.length > 0
      ? isSchoolAdmin
        ? await supabase
            .from("test_copies")
            .select("test_id, students(class_id)")
            .eq("school_id", schoolId ?? "__none__")
        : await supabase
            .from("test_copies")
            .select("test_id, students(class_id)")
            .eq("teacher_id", teacherId!)
      : { data: [] };

  const evalsByClass = new Map<string, Set<string>>();
  for (const row of copies ?? []) {
    const st = Array.isArray(row.students) ? (row.students[0] ?? null) : row.students;
    const cid = (st?.class_id as string) ?? "";
    if (!classMap.has(cid)) continue;
    if (!evalsByClass.has(cid)) evalsByClass.set(cid, new Set());
    if (row.test_id) evalsByClass.get(cid)?.add(row.test_id as string);
  }

  const subject = teacher ? subjectLabelFr(teacher.subject) : "Établissement";

  const cards = classIds
    .map((cid) => ({
      id: cid,
      title: classMap.get(cid) ?? "—",
      eleves: byClass.get(cid) ?? 0,
      evals: evalsByClass.get(cid)?.size ?? 0,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));

  const classNames = cards;

  const classExportColumns = [
    { key: "classe", header: "Classe" },
    { key: "eleves", header: "Élèves" },
    { key: "evaluations", header: "Évaluations (copies)" },
  ];
  const classExportRows = classNames.map((c) => ({
    classe: c.title,
    eleves: c.eleves,
    evaluations: c.evals,
  })) as Record<string, unknown>[];

  return (
    <div className="p-5 lg:p-6">
      <header className="mb-3 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              {isSchoolAdmin ? "Classes établissement" : "Mes classes"}
            </h1>
            <p className="mt-1 text-gray-500">
              {isSchoolAdmin
                ? "Chaque classe distincte de l’établissement apparaît ici."
                : "Classes qui vous sont affectées via le pivot classes-enseignants."}
            </p>
          </div>
          {classNames.length > 0 ? (
            <ListExportButton
              fileBaseName="classes"
              sheetName="Classes"
              columns={classExportColumns}
              rows={classExportRows}
            />
          ) : null}
        </div>
      </header>

      {classNames.length === 0 ? (
        <DashboardEmptyState
          title="Aucune classe"
          message="Aucune classe disponible pour le moment."
          icon={Users}
          accentClass="border-t-primary-500"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classNames.map((card) => (
            <Link
              key={card.id}
              href={`/dashboard/classes/${card.id}`}
              className="h-full rounded-xl border border-gray-100 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
              <p className="text-sm text-gray-500">{subject}</p>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>
                    <strong className="font-semibold text-gray-900">{card.eleves}</strong>{" "}
                    Élève{card.eleves !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span>
                    <strong className="font-semibold text-gray-900">{card.evals}</strong>{" "}
                    Évaluation{card.evals !== 1 ? "s" : ""} (copies)
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
