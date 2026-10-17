"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { StudentFields, StudentRow } from "@/lib/students-data";

const FIELD_CLASS = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm";

type Props = {
  /** Élève modifié, ou null pour un ajout. */
  student: StudentRow | null;
  classOptions: Array<{ id: string; name: string }>;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (fields: StudentFields) => void;
};

/** Ajout ou modification d'un élève. */
export function StudentFormModal({ student, classOptions, saving, onCancel, onSubmit }: Props) {
  const [firstName, setFirstName] = useState(student?.first_name ?? "");
  const [lastName, setLastName] = useState(student?.last_name ?? "");
  const [idInterne, setIdInterne] = useState(student?.id_interne ?? "");
  const [classId, setClassId] = useState(student?.class_id ?? classOptions[0]?.id ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      class_id: classId,
      id_interne: idInterne.trim(),
    });
  }

  return (
    <Modal
      title={student ? "Modifier l’élève" : "Nouvel élève"}
      description="ID interne optionnel : laisser vide pour générer automatiquement un code du type CIA-2026-001."
      onClose={onCancel}
    >
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="student-first" className="mb-1 block text-xs font-semibold text-gray-800">
              Prénom *
            </label>
            <input id="student-first" required className={FIELD_CLASS} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="student-last" className="mb-1 block text-xs font-semibold text-gray-800">
              Nom *
            </label>
            <input id="student-last" required className={FIELD_CLASS} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="student-id" className="mb-1 block text-xs font-semibold text-gray-800">
            ID interne (optionnel)
          </label>
          <input
            id="student-id"
            className={`${FIELD_CLASS} font-mono`}
            placeholder="Ex. CIA-2026-042 ou vide"
            value={idInterne}
            onChange={(e) => setIdInterne(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="student-class" className="mb-1 block text-xs font-semibold text-gray-800">
            Classe *
          </label>
          <select id="student-class" required className={FIELD_CLASS} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Sélectionner la classe</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={saving} loadingText="Enregistrement…">
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
