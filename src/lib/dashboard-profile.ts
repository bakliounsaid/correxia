import { createSupabaseServerClient } from "@/lib/supabase-server";
import { adminInitials } from "@/lib/admin-server";

const SUBJECT_LABEL: Record<string, string> = {
  math: "Mathématiques",
  physics: "Physique",
  science: "Sciences",
};

export function subjectLabelFr(subject: string): string {
  const s = (subject || "math").toLowerCase();
  return SUBJECT_LABEL[s] ?? subject;
}

const ROLE_LABEL: Record<string, string> = {
  teacher: "Enseignant",
  school_admin: "Administrateur établissement",
  director: "Direction",
  admin: "Administration plateforme",
};

export type DashboardSidebarProfile = {
  displayName: string;
  subtitle: string;
  initials: string;
  role: string;
};

/**
 * Profil affiché en bas de la sidebar dashboard (nom, matière ou rôle, initiales).
 */
export async function getDashboardSidebarProfile(): Promise<DashboardSidebarProfile> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      displayName: "Invité",
      subtitle: "",
      initials: "?",
      role: "guest",
    };
  }

  const { data: row } = await supabase
    .from("users")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (row?.role === "school_admin") {
    const displayName =
      row.full_name?.trim() || row.email || user.email || "Utilisateur";
    return {
      displayName,
      subtitle: ROLE_LABEL.school_admin,
      initials: adminInitials(row.full_name || "", row.email || user.email),
      role: "school_admin",
    };
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("subject, users ( full_name, email )")
    .eq("user_id", user.id)
    .maybeSingle();

  const u = teacher?.users as
    | { full_name: string; email: string }
    | null
    | undefined;

  if (teacher && u) {
    const displayName =
      u.full_name?.trim() || u.email || user.email || "Utilisateur";
    const subtitle = subjectLabelFr(teacher.subject);
    return {
      displayName,
      subtitle,
      initials: adminInitials(u.full_name || "", u.email || user.email),
      role: "teacher",
    };
  }

  if (row) {
    const displayName =
      row.full_name?.trim() || row.email || user.email || "Utilisateur";
    const subtitle = ROLE_LABEL[row.role] ?? row.role;
    return {
      displayName,
      subtitle,
      initials: adminInitials(row.full_name || "", row.email || user.email),
      role: row.role || "teacher",
    };
  }

  const meta = user.user_metadata as Record<string, string> | undefined;
  const fromMeta = [meta?.first_name, meta?.last_name].filter(Boolean).join(" ");
  const displayName =
    fromMeta.trim() || user.email?.split("@")[0] || "Utilisateur";

  return {
    displayName,
    subtitle: "Compte",
    initials: adminInitials(fromMeta, user.email),
    role: "teacher",
  };
}
