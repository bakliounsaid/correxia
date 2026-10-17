/** Préparation de l'import CSV d'élèves : rattachement aux classes, lots, message de résultat. */

import type { CsvStudentRow } from "@/lib/students-csv";

export const IMPORT_CHUNK_SIZE = 100;

export type StudentInsert = {
  school_id: string | null;
  first_name: string;
  last_name: string;
  class_id: string;
  id_interne?: string;
};

/** Lignes à insérer (avec leur numéro de ligne CSV) et lignes refusées faute de classe connue. */
export function buildStudentInserts(
  rows: CsvStudentRow[],
  classOptions: Array<{ id: string; name: string }>,
  schoolId: string | null,
): { inserts: Array<{ line: number; row: StudentInsert }>; errors: string[] } {
  const classByName = new Map(classOptions.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const inserts: Array<{ line: number; row: StudentInsert }> = [];
  const errors: string[] = [];
  rows.forEach((r) => {
    const { line } = r;
    const classId = classByName.get((r.class_name ?? "").trim().toLowerCase());
    if (!classId) {
      errors.push(`Ligne import ${line} : classe introuvable dans l'établissement (${r.class_name}).`);
      return;
    }
    const row: StudentInsert = { school_id: schoolId, first_name: r.first_name, last_name: r.last_name, class_id: classId };
    if (r.id_interne) row.id_interne = r.id_interne;
    inserts.push({ line, row });
  });
  return { inserts, errors };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Fenêtre de résultat : succès, import partiel ou échec complet. */
export function importResult(
  imported: number,
  errors: string[],
): { icon: "success" | "warning" | "error"; title: string; text: string } {
  if (imported === 0) return { icon: "error", title: "Erreur", text: errors.slice(0, 3).join(" ") };
  if (errors.length === 0) return { icon: "success", title: "Import réussi", text: `${imported} élève(s) importé(s).` };
  return {
    icon: "warning",
    title: "Import partiel",
    text: `${imported} élève(s) importé(s). Certaines lignes sont en erreur : ${errors.slice(0, 3).join(" | ")}`,
  };
}
