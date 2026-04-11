import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, Users } from "lucide-react";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { notFound } from "next/navigation";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";
import { normalizeRelationOne } from "@/lib/supabase-join";

type PageProps = {
  params: { classId: string };
};

export default async function ClassDetailPage({ params }: PageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isSchoolAdmin = currentUser?.role === "school_admin";
  const teacherId = await getTeacherId();
  const classId = params.classId;

  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_id, name")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) notFound();

  if (isSchoolAdmin) {
    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .eq("admin_user_id", user.id)
      .maybeSingle();
    if (!school?.id || school.id !== cls.school_id) notFound();
  } else {
    if (!teacherId) notFound();
    const { data: link } = await supabase
      .from("class_teachers")
      .select("id")
      .eq("class_id", classId)
      .eq("teacher_id", teacherId)
      .maybeSingle();
    if (!link) notFound();
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, id_interne, created_at")
    .eq("class_id", classId)
    .order("last_name", { ascending: true });

  const { data: teacherLinks } = await supabase
    .from("class_teachers")
    .select("teacher_id, teachers(subject, users(full_name, email))")
    .eq("class_id", classId);

  const teachers = (teacherLinks ?? [])
    .map((row) => {
      const t = normalizeRelationOne(
        row.teachers as
          | { subject: string; users: { full_name: string; email: string } | { full_name: string; email: string }[] | null }
          | { subject: string; users: { full_name: string; email: string } | { full_name: string; email: string }[] | null }[]
          | null,
      );
      if (!t) return null;
      const u = normalizeRelationOne(
        t.users as
          | { full_name: string; email: string }
          | { full_name: string; email: string }[]
          | null,
      );
      return {
        id: row.teacher_id as string,
        subject: t.subject,
        name: u?.full_name?.trim() || u?.email || "Enseignant",
      };
    })
    .filter((v): v is { id: string; subject: string; name: string } => Boolean(v));

  const teachersBySubject = new Map<string, { id: string; name: string }[]>();
  for (const t of teachers) {
    const key = t.subject || "math";
    if (!teachersBySubject.has(key)) teachersBySubject.set(key, []);
    teachersBySubject.get(key)!.push({ id: t.id, name: t.name });
  }

  const subjectSections = Array.from(teachersBySubject.entries()).sort(([a], [b]) =>
    subjectLabelFr(a).localeCompare(subjectLabelFr(b), "fr"),
  );

  const { data: copies } = await supabase
    .from("test_copies")
    .select("test_id, students!inner(class_id)")
    .eq("students.class_id", classId);
  const evaluationCount = new Set((copies ?? []).map((c) => c.test_id).filter(Boolean)).size;

  const studentExportColumns = [
    { key: "nom", header: "Nom" },
    { key: "prenom", header: "Prénom" },
    { key: "id_interne", header: "ID interne" },
  ];
  const studentExportRows = (students ?? []).map((s) => ({
    nom: s.last_name,
    prenom: s.first_name,
    id_interne: s.id_interne ?? "",
  })) as Record<string, unknown>[];

  const teacherExportColumns = [
    { key: "matiere", header: "Matière" },
    { key: "nom", header: "Enseignant" },
  ];
  const teacherExportRows = subjectSections.flatMap(([subject, list]) =>
    list.map((t) => ({
      matiere: subjectLabelFr(subject),
      nom: t.name,
    })),
  ) as Record<string, unknown>[];

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/dashboard/classes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux classes
      </Link>

      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{cls.name}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
            <Users className="h-4 w-4 text-gray-400" />
            {students?.length ?? 0} élève{(students?.length ?? 0) !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
            <GraduationCap className="h-4 w-4 text-gray-400" />
            {teachers.length} prof{teachers.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
            <BookOpen className="h-4 w-4 text-gray-400" />
            {evaluationCount} évaluation{evaluationCount !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Liste des élèves</h2>
            {studentExportRows.length > 0 ? (
              <ListExportButton
                fileBaseName={`classe-${classId.slice(0, 8)}-eleves`}
                sheetName="Élèves"
                columns={studentExportColumns}
                rows={studentExportRows}
              />
            ) : null}
          </div>
          <div className="p-5">
            {!students || students.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun élève dans cette classe.</p>
            ) : (
              <ul className="space-y-2">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">
                      {`${s.first_name} ${s.last_name}`.trim()}
                    </span>
                    <span className="font-mono text-xs text-gray-500">{s.id_interne || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Professeurs par matière</h2>
            {teacherExportRows.length > 0 ? (
              <ListExportButton
                fileBaseName={`classe-${classId.slice(0, 8)}-profs`}
                sheetName="Enseignants"
                columns={teacherExportColumns}
                rows={teacherExportRows}
              />
            ) : null}
          </div>
          <div className="space-y-4 p-5">
            {subjectSections.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun enseignant affecté à cette classe.</p>
            ) : (
              subjectSections.map(([subject, list]) => (
                <div key={subject}>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    {subjectLabelFr(subject)}
                  </h3>
                  <ul className="space-y-2">
                    {list.map((t) => (
                      <li key={t.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {t.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

