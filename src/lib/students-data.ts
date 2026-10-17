/** Lecture et écriture des élèves (Supabase, côté navigateur). */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { chunk, IMPORT_CHUNK_SIZE, type StudentInsert } from "@/lib/students-import";

export type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  id_interne: string;
  class_id: string;
  class_name: string;
  created_at: string;
};

export const STUDENT_COLUMNS = "id, first_name, last_name, id_interne, class_id, created_at, classes(name)";

type RawStudent = {
  id: string;
  first_name: string;
  last_name: string;
  id_interne: string | null;
  class_id: string;
  created_at: string;
  classes: { name: string } | { name: string }[] | null;
};

export function toStudentRow(s: RawStudent): StudentRow {
  return {
    id: s.id,
    first_name: s.first_name,
    last_name: s.last_name,
    id_interne: s.id_interne ?? "",
    class_id: s.class_id,
    class_name: normalizeRelationOne<{ name: string }>(s.classes)?.name ?? "—",
    created_at: s.created_at,
  };
}

/** Élèves des classes données, triés par nom. */
export async function fetchStudentsOfClasses(supabase: SupabaseClient, classIds: string[]): Promise<StudentRow[]> {
  if (classIds.length === 0) return [];
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .in("class_id", classIds)
    .order("last_name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RawStudent[]).map(toStudentRow);
}

export async function fetchTeacherClassIds(supabase: SupabaseClient, teacherId: string): Promise<string[]> {
  const { data } = await supabase.from("class_teachers").select("class_id").eq("teacher_id", teacherId);
  return (data ?? []).map((l) => l.class_id as string);
}

export type StudentFields = { first_name: string; last_name: string; class_id: string; id_interne: string };

export async function insertStudent(supabase: SupabaseClient, schoolId: string | null, f: StudentFields) {
  const row: StudentInsert = { school_id: schoolId, first_name: f.first_name, last_name: f.last_name, class_id: f.class_id };
  if (f.id_interne) row.id_interne = f.id_interne;
  const { error } = await supabase.from("students").insert(row);
  if (error) throw error;
}

export async function updateStudent(supabase: SupabaseClient, id: string, f: StudentFields) {
  const { error } = await supabase
    .from("students")
    .update({ first_name: f.first_name, last_name: f.last_name, class_id: f.class_id, id_interne: f.id_interne || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStudent(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

/** Insère par lots ; un lot refusé est signalé (lignes concernées) sans bloquer les suivants. */
export async function insertStudentsInChunks(
  supabase: SupabaseClient,
  inserts: Array<{ line: number; row: StudentInsert }>,
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];
  for (const batch of chunk(inserts, IMPORT_CHUNK_SIZE)) {
    const { error } = await supabase.from("students").insert(batch.map((b) => b.row));
    if (error) {
      errors.push(`Lignes import ${batch[0].line}-${batch[batch.length - 1].line} : ${error.message}`);
      continue;
    }
    imported += batch.length;
  }
  return { imported, errors };
}
