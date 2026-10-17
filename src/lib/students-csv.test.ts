import { describe, expect, it } from "vitest";
import { parseStudentsCsv, STUDENTS_CSV_EXAMPLE_CONTENT } from "@/lib/students-csv";

describe("parseStudentsCsv", () => {
  it("lit le fichier d'exemple fourni aux enseignants (BOM, point-virgule, CRLF)", () => {
    const { rows, errors } = parseStudentsCsv(STUDENTS_CSV_EXAMPLE_CONTENT);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({
      line: 3,
      id_interne: "CIA-2026-001",
      first_name: "Sophie",
      last_name: "Martin",
      class_name: "Terminale C",
    });
  });

  it("accepte la virgule, les guillemets et des en-têtes variés", () => {
    const { rows } = parseStudentsCsv('Prénom,Nom,Classe\n"Ada","King, Lovelace",TS1');
    expect(rows).toEqual([{ line: 2, id_interne: null, first_name: "Ada", last_name: "King, Lovelace", class_name: "TS1" }]);
  });

  it("garde les numéros de ligne du fichier malgré les lignes vides", () => {
    const { rows, errors } = parseStudentsCsv("nom;prenom;classe\n\nDupont;Jean;TS1\n;Paul;TS1\n\nMartin;Lea;");
    expect(rows.map((r) => r.line)).toEqual([3]);
    expect(errors).toEqual(["Ligne 4 : prénom et nom sont obligatoires.", "Ligne 6 : classe obligatoire."]);
  });

  it("explique les fichiers inexploitables", () => {
    expect(parseStudentsCsv("  ").errors).toEqual(["Fichier vide."]);
    expect(parseStudentsCsv("nom;prenom;classe").errors[0]).toContain("au moins une ligne de données");
    expect(parseStudentsCsv("nom;age\nDupont;12").errors[0]).toContain("Colonnes obligatoires");
  });
});
