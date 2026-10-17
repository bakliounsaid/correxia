"use client";

import { Button } from "@/components/ui/Button";

export type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string;
};

type Props = {
  students: StudentOption[];
  selectedIds: string[];
  loading: boolean;
  submitting: boolean;
  onToggle: (studentId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Choix des élèves qui passent l'examen (une feuille de réponses par élève). */
export function StudentPickerModal({ students, selectedIds, loading, submitting, onToggle, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Sélectionner les élèves pour ce test</h3>
        <p className="mt-1 text-sm text-gray-500">Chaque copie aura un code unique par élève.</p>

        <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-gray-100">
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-500">Chargement des élèves...</p>
          ) : students.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">Aucun élève disponible.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <label className="flex items-center gap-3 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => onToggle(s.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <span>
                      {s.last_name} {s.first_name}
                    </span>
                  </label>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{s.class_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">{selectedIds.length} élève(s) sélectionné(s)</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={onConfirm}
              disabled={submitting || loading || students.length === 0}
              loading={submitting}
              loadingText="Génération des copies…"
            >
              Télécharger les feuilles de réponses
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
