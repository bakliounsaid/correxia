import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { insertStudentsInChunks, toStudentRow } from "@/lib/students-data";
import { buildStudentInserts, chunk, importResult } from "@/lib/students-import";

const classes = [
  { id: "c1", name: "TS1" },
  { id: "c2", name: "1ère A" },
];

describe("buildStudentInserts", () => {
  it("rattache chaque ligne à sa classe (sans tenir compte de la casse) et signale les classes inconnues", () => {
    const { inserts, errors } = buildStudentInserts(
      [
        { line: 2, id_interne: "A-1", first_name: "Ada", last_name: "Lovelace", class_name: "ts1" },
        { line: 3, id_interne: null, first_name: "Alan", last_name: "Turing", class_name: " 1ère a " },
        { line: 7, id_interne: null, first_name: "Grace", last_name: "Hopper", class_name: "TS9" },
      ],
      classes,
      "school-1",
    );
    expect(inserts).toEqual([
      { line: 2, row: { school_id: "school-1", first_name: "Ada", last_name: "Lovelace", class_id: "c1", id_interne: "A-1" } },
      { line: 3, row: { school_id: "school-1", first_name: "Alan", last_name: "Turing", class_id: "c2" } },
    ]);
    expect(errors).toEqual(["Ligne import 7 : classe introuvable dans l'établissement (TS9)."]);
  });
});

describe("chunk", () => {
  it("découpe en lots de taille fixe", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("importResult", () => {
  it("succès, import partiel ou échec", () => {
    expect(importResult(3, [])).toEqual({ icon: "success", title: "Import réussi", text: "3 élève(s) importé(s)." });
    expect(importResult(2, ["e1", "e2", "e3", "e4"])).toEqual({
      icon: "warning",
      title: "Import partiel",
      text: "2 élève(s) importé(s). Certaines lignes sont en erreur : e1 | e2 | e3",
    });
    expect(importResult(0, ["e1", "e2"])).toEqual({ icon: "error", title: "Erreur", text: "e1 e2" });
  });
});

describe("insertStudentsInChunks", () => {
  it("insère par lots et continue après un lot refusé", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "duplicate key" } })
      .mockResolvedValueOnce({ error: null });
    const supabase = { from: () => ({ insert }) } as unknown as SupabaseClient;
    const rows = Array.from({ length: 150 }, (_, i) => ({
      line: i + 2,
      row: { school_id: null, first_name: "A", last_name: `N${i}`, class_id: "c1" },
    }));

    const result = await insertStudentsInChunks(supabase, rows);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toHaveLength(100);
    expect(result).toEqual({ imported: 50, errors: ["Lignes import 2-101 : duplicate key"] });
  });
});

describe("toStudentRow", () => {
  it("aplatit la classe jointe et remplace les valeurs absentes", () => {
    expect(
      toStudentRow({
        id: "s1",
        first_name: "Ada",
        last_name: "L",
        id_interne: null,
        class_id: "c1",
        created_at: "2026-01-01",
        classes: [{ name: "TS1" }],
      }),
    ).toEqual({ id: "s1", first_name: "Ada", last_name: "L", id_interne: "", class_id: "c1", class_name: "TS1", created_at: "2026-01-01" });
  });
});
