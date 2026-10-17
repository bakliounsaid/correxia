"use client";

import { type Complexity, type EvaluationDraft, INPUT_CLASS } from "@/components/evaluations/wizard/types";

type Props = {
  draft: EvaluationDraft;
  classOptions: string[];
  classesLoading: boolean;
  onChange: (patch: Partial<EvaluationDraft>) => void;
};

export function StepInfo({ draft, classOptions, classesLoading, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Étape 1 — Informations de l&apos;évaluation</h2>
      <div>
        <label htmlFor="wizard-title" className="mb-1.5 block text-xs font-semibold text-gray-800">
          Titre *
        </label>
        <input
          id="wizard-title"
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="wizard-date" className="mb-1.5 block text-xs font-semibold text-gray-800">
            Date *
          </label>
          <input
            id="wizard-date"
            type="date"
            value={draft.evaluationDate}
            onChange={(e) => onChange({ evaluationDate: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="wizard-class" className="mb-1.5 block text-xs font-semibold text-gray-800">
            Classe *
          </label>
          <select
            id="wizard-class"
            required
            value={draft.className}
            onChange={(e) => onChange({ className: e.target.value })}
            className={INPUT_CLASS}
            disabled={classesLoading || classOptions.length === 0}
          >
            {classesLoading ? (
              <option value="">Chargement des classes...</option>
            ) : classOptions.length === 0 ? (
              <option value="">Aucune classe disponible</option>
            ) : (
              <>
                <option value="">Sélectionner la classe</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="wizard-complexity" className="mb-1.5 block text-xs font-semibold text-gray-800">
            Degré de complexité *
          </label>
          <select
            id="wizard-complexity"
            required
            value={draft.complexity}
            onChange={(e) => onChange({ complexity: e.target.value as Complexity })}
            className={INPUT_CLASS}
          >
            <option value="">Sélectionner le degré de complexité</option>
            <option value="facile">Facile</option>
            <option value="moyen">Moyen</option>
            <option value="difficile">Difficile</option>
          </select>
        </div>
        <div>
          <label htmlFor="wizard-duration" className="mb-1.5 block text-xs font-semibold text-gray-800">
            Durée (minutes) *
          </label>
          <input
            id="wizard-duration"
            type="number"
            min={10}
            step={5}
            value={draft.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: Math.max(10, Number(e.target.value || 10)) })}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
