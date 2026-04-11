import { CircleUserRound } from "lucide-react";
import {
  StudentsManager,
  type StudentRow,
} from "@/components/dashboard/StudentsManager";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

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
      <div className="p-6 lg:p-8">
        <header className="mb-4 border-b border-gray-200 pb-4">
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

  let insertSchoolId: string | null = null;
  if (isSchoolAdmin) {
    insertSchoolId = schoolId;
  } else if (teacherId) {
    const { data: tr } = await supabase
      .from("teachers")
      .select("school_id")
      .eq("id", teacherId)
      .maybeSingle();
    insertSchoolId = tr?.school_id ?? null;
  }

  let classOptions: { id: string; name: string }[] = [];
  if (isSchoolAdmin) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId ?? "__none__")
      .order("name", { ascending: true });
    classOptions = (classes ?? []) as { id: string; name: string }[];
  } else if (teacherId) {
    const { data: links } = await supabase
      .from("class_teachers")
      .select("class_id")
      .eq("teacher_id", teacherId);
    const classIds = (links ?? []).map((l) => l.class_id as string);
    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds)
        .order("name", { ascending: true });
      classOptions = (classes ?? []) as { id: string; name: string }[];
    }
  }

  const classIds = classOptions.map((c) => c.id);
  const { data: students } =
    classIds.length > 0
      ? await supabase
          .from("students")
          .select("id, first_name, last_name, id_interne, class_id, created_at, classes(name)")
          .in("class_id", classIds)
          .order("last_name", { ascending: true })
      : { data: [] };

  const list = (students ?? []).map((s) => {
    const c = Array.isArray(s.classes) ? (s.classes[0] ?? null) : s.classes;
    return {
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      id_interne: s.id_interne ?? "",
      class_id: s.class_id,
      class_name: c?.name ?? "—",
      created_at: s.created_at,
    };
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
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
      </header>

      <StudentsManager
        initialStudents={list as StudentRow[]}
        viewerTeacherId={isSchoolAdmin ? null : teacherId}
        insertSchoolId={insertSchoolId}
        isSchoolAdmin={isSchoolAdmin}
        classOptions={classOptions}
      />
    </div>
  );
}
