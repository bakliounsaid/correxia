import type { SupabaseClient } from "@supabase/supabase-js";

export const TESTS_BUCKET = "tests";

/** Nom de fichier sûr pour un chemin de stockage. */
export function safeStorageName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

/** Profil enseignant de l'utilisateur connecté (lève une erreur lisible sinon). */
export async function getCurrentTeacher(
  supabase: SupabaseClient,
): Promise<{ id: string; school_id: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée. Reconnectez-vous.");
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!teacher?.id) throw new Error("Profil enseignant introuvable.");
  return { id: teacher.id as string, school_id: (teacher.school_id as string | null) ?? null };
}

/** Envoie un fichier dans le bucket des évaluations et renvoie son URL publique. */
export async function uploadToTestsBucket(
  supabase: SupabaseClient,
  path: string,
  file: Blob,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(TESTS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType });
  if (error) throw new Error(`Upload impossible (${error.message}).`);
  return supabase.storage.from(TESTS_BUCKET).getPublicUrl(path).data.publicUrl;
}
