"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  parseStudentsCsv,
  STUDENTS_CSV_EXAMPLE_CONTENT,
  STUDENTS_CSV_EXAMPLE_FILENAME,
} from "@/lib/students-csv";

export type ParsedStudentsCsv = ReturnType<typeof parseStudentsCsv>;

type Props = {
  importing: boolean;
  hasClasses: boolean;
  onCancel: () => void;
  onImport: (parsed: ParsedStudentsCsv) => void;
};

function downloadExampleCsv() {
  const url = URL.createObjectURL(new Blob([STUDENTS_CSV_EXAMPLE_CONTENT], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = STUDENTS_CSV_EXAMPLE_FILENAME;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

/** Choix du fichier CSV, aperçu des lignes valides et des erreurs, puis lancement de l'import. */
export function StudentsImportModal({ importing, hasClasses, onCancel, onImport }: Props) {
  const [preview, setPreview] = useState<ParsedStudentsCsv | null>(null);

  function pickFile(file: File | null) {
    setPreview(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(parseStudentsCsv(String(reader.result ?? "")));
    reader.readAsText(file, "UTF-8");
  }

  return (
    <Modal
      title="Importer des élèves (CSV)"
      description={
        <>
          Colonnes : <strong>id_interne</strong> (facultatif), <strong>nom</strong>, <strong>prénom</strong>,{" "}
          <strong>classe</strong>. La classe doit déjà exister dans l&apos;établissement.
        </>
      }
      onClose={onCancel}
    >
      <button
        type="button"
        onClick={downloadExampleCsv}
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <Download className="h-4 w-4" />
        Télécharger un fichier CSV d’exemple
      </button>
      <div className="mt-4">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Fichier CSV"
          className="text-sm"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {preview && (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
          <p>
            <strong>{preview.rows.length}</strong> ligne(s) prête(s) à importer.
          </p>
          {preview.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-amber-800">
              {preview.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={importing}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={importing}
          loadingText="Import…"
          disabled={!preview?.rows.length || !hasClasses}
          onClick={() => preview && onImport(preview)}
        >
          Lancer l’import
        </Button>
      </div>
    </Modal>
  );
}
