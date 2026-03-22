import { createSupabaseServerClient } from "@/lib/supabase-server";

export type TeacherRow = {
  id: string;
  subject: string;
  user_id: string;
};

/**
 * Identifiant `teachers.id` pour l’utilisateur connecté, ou null (ex. admin sans profil enseignant).
 */
export async function getTeacherId(): Promise<string | null> {
  const row = await getTeacherRow();
  return row?.id ?? null;
}

export async function getTeacherRow(): Promise<TeacherRow | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("teachers")
    .select("id, subject, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data as TeacherRow | null;
}
