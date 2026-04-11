import { GraduationCap } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { TeachersManager } from "@/components/dashboard/TeachersManager";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";

export default async function EnseignantsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 lg:p-8">
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
      <div className="p-6 lg:p-8">
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
      <div className="p-6 lg:p-8">
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

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", school.id)
    .order("name", { ascending: true });

  const { data: links } = await supabase
    .from("class_teachers")
    .select("teacher_id, class_id")
    .in("class_id", (classes ?? []).map((c) => c.id));

  const list = teachers ?? [];
  const classMap = new Map((classes ?? []).map((c) => [c.id as string, c.name as string]));
  const classOptions = (classes ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));
  const classesByTeacher = new Map<string, string[]>();
  for (const l of links ?? []) {
    const tid = l.teacher_id as string;
    const cn = classMap.get(l.class_id as string);
    if (!cn) continue;
    if (!classesByTeacher.has(tid)) classesByTeacher.set(tid, []);
    classesByTeacher.get(tid)!.push(cn);
  }

  const normalizedTeachers = list.map((t) => {
    const u = normalizeRelationOne<{ full_name: string; email: string }>(
      t.users as
        | { full_name: string; email: string }
        | { full_name: string; email: string }[]
        | null,
    );
    return {
      id: t.id,
      full_name: u?.full_name?.trim() || "—",
      email: u?.email || "—",
      subject: t.subject as "math" | "physics" | "science",
      class_names: classesByTeacher.get(t.id) ?? [],
      created_at: t.created_at,
    };
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-4 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Enseignants
        </h1>
        <p className="mt-1 text-gray-500">
          Gestion des enseignants rattachés à votre établissement.
        </p>
      </header>

      {list.length === 0 ? (
        <>
          <TeachersManager initialTeachers={[]} classOptions={classOptions} />
          <div className="mt-4">
          <DashboardEmptyState
            title="Aucun enseignant"
            message="Aucun enseignant n'est encore rattaché à votre établissement."
            icon={GraduationCap}
            accentClass="border-t-ia-500"
          />
          </div>
        </>
      ) : (
        <TeachersManager
          initialTeachers={normalizedTeachers}
          classOptions={classOptions}
        />
      )}
    </div>
  );
}

