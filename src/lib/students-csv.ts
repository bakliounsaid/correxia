/** Import CSV élèves : id_interne, nom, prénom, classe. */

/** Exemple téléchargeable (UTF-8 avec BOM pour Excel). */
export const STUDENTS_CSV_EXAMPLE_FILENAME = "correxia-exemple-eleves.csv";

/** Séparateur point-virgule : colonnes bien distinctes dans Excel (réglages régionaux FR). */
export const STUDENTS_CSV_EXAMPLE_CONTENT = [
  "\uFEFFid_interne;nom;prenom;classe",
  ";Dupont;Jean;2nde3",
  "CIA-2026-001;Martin;Sophie;Terminale C",
  ";Bernard;Paul;1ère2",
].join("\r\n");

export type CsvStudentRow = {
  /** Numéro de ligne dans le fichier (1 = en-têtes), pour des messages d'erreur exacts. */
  line: number;
  id_interne: string | null;
  first_name: string;
  last_name: string;
  class_name: string | null;
};

const HEADER_MAP: Record<string, keyof CsvStudentRow | "__ignore"> = {
  id_interne: "id_interne",
  "id interne": "id_interne",
  id_intern: "id_interne",
  internal_id: "id_interne",
  first_name: "first_name",
  prenom: "first_name",
  prénom: "first_name",
  last_name: "last_name",
  nom: "last_name",
  class_name: "class_name",
  classe: "class_name",
  class: "class_name",
};

function detectDelimiter(line: string): "," | ";" {
  let comma = 0;
  let semi = 0;
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (!inQ) {
      if (c === ",") comma++;
      if (c === ";") semi++;
    }
  }
  return semi > comma ? ";" : ",";
}

function parseCsvLine(line: string, delim: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === delim) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
}

export function parseStudentsCsv(text: string): {
  rows: CsvStudentRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) {
    errors.push("Fichier vide.");
    return { rows: [], errors };
  }

  // Numéros relevés avant d'écarter les lignes vides : ce sont ceux du fichier.
  const lines = raw
    .split(/\r?\n/)
    .map((text, idx) => ({ text, no: idx + 1 }))
    .filter((l) => l.text.trim().length > 0);
  if (lines.length < 2) {
    errors.push(
      "Le CSV doit contenir une ligne d’en-têtes et au moins une ligne de données.",
    );
    return { rows: [], errors };
  }

  const delim = detectDelimiter(lines[0].text);
  const headers = parseCsvLine(lines[0].text, delim).map(normHeader);
  const colIndex: Partial<Record<keyof CsvStudentRow, number>> = {};

  headers.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (!key || key === "__ignore") return;
    colIndex[key] = i;
  });

  if (
    colIndex.first_name === undefined ||
    colIndex.last_name === undefined ||
    colIndex.class_name === undefined
  ) {
    errors.push(
      "Colonnes obligatoires : nom, prénom, classe (id_interne facultatif). Séparateur : point-virgule (;) ou virgule (,). En-têtes : id_interne, nom, prenom, classe.",
    );
    return { rows: [], errors };
  }

  const rows: CsvStudentRow[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li].text, delim);
    const lineNo = lines[li].no;
    const first_name = (cells[colIndex.first_name!] ?? "").trim();
    const last_name = (cells[colIndex.last_name!] ?? "").trim();
    const classRaw = (cells[colIndex.class_name!] ?? "").trim();
    if (!first_name || !last_name) {
      errors.push(`Ligne ${lineNo} : prénom et nom sont obligatoires.`);
      continue;
    }
    if (!classRaw) {
      errors.push(`Ligne ${lineNo} : classe obligatoire.`);
      continue;
    }
    const idRaw =
      colIndex.id_interne !== undefined
        ? (cells[colIndex.id_interne] ?? "").trim()
        : "";
    rows.push({
      line: lineNo,
      id_interne: idRaw || null,
      first_name,
      last_name,
      class_name: classRaw,
    });
  }

  return { rows, errors };
}
