"use client";

import { Upload } from "lucide-react";
import { type EvaluationDraft, INPUT_CLASS } from "@/components/evaluations/wizard/types";

type Props = {
  draft: EvaluationDraft;
  onChange: (patch: Partial<EvaluationDraft>) => void;
};

export function StepCourse({ draft, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Étape 2 — Upload du cours (PDF)</h2>
      <p className="text-sm text-gray-500">Ajoutez au moins un support : un PDF, une description, ou les deux.</p>
      <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
        <Upload className="mb-3 h-8 w-8 text-primary-500" />
        <span className="text-sm font-semibold text-gray-900">Sélectionner un cours PDF</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => onChange({ courseFile: e.target.files?.[0] ?? null })}
        />
      </label>
      {draft.courseFile ? (
        <p className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
          Fichier chargé : {draft.courseFile.name}
        </p>
      ) : null}
      <textarea
        rows={6}
        value={draft.courseContext}
        onChange={(e) => onChange({ courseContext: e.target.value })}
        placeholder="Description du cours (optionnel)"
        className={`${INPUT_CLASS} resize-y`}
      />
    </div>
  );
}
