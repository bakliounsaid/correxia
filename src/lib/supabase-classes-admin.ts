import type { SupabaseClient } from "@supabase/supabase-js";

/** Client service : table `classes` absente des types DB générés. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, "public", any>;

function classesFrom(admin: AdminClient) {
  return admin as unknown as {
    from: (table: "classes") => {
      upsert: (
        rows: { school_id: string; name: string }[],
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col2: string,
            val2: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
          in: (
            col2: string,
            vals: string[],
          ) => Promise<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

export async function ensureSchoolClass(
  admin: AdminClient,
  schoolId: string,
  className: string,
): Promise<string> {
  const name = className.trim();
  const db = classesFrom(admin);
  const { error: upsertErr } = await db
    .from("classes")
    .upsert([{ school_id: schoolId, name }], { onConflict: "school_id,name" });
  if (upsertErr) throw new Error(upsertErr.message);

  const { data, error: fetchErr } = await db
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .eq("name", name)
    .maybeSingle();
  if (fetchErr || !data?.id) {
    throw new Error(fetchErr?.message ?? "Classe introuvable.");
  }
  return data.id as string;
}

export async function ensureSchoolClassIds(
  admin: AdminClient,
  schoolId: string,
  names: string[],
): Promise<string[]> {
  const classNames = Array.from(
    new Set(names.map((n) => n.trim()).filter(Boolean)),
  );
  if (!classNames.length) return [];

  const db = classesFrom(admin);
  const { error: upsertErr } = await db
    .from("classes")
    .upsert(
      classNames.map((n) => ({ school_id: schoolId, name: n })),
      { onConflict: "school_id,name" },
    );
  if (upsertErr) throw new Error(upsertErr.message);

  const { data, error: fetchErr } = await db
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("name", classNames);
  if (fetchErr) throw new Error(fetchErr.message);

  return (data ?? []).map((c) => c.id as string);
}
