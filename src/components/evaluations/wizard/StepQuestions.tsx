"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import { RubricTotal } from "@/components/evaluations/wizard/RubricTotal";
import { newQuestionId } from "@/components/evaluations/wizard/types";
import { Button } from "@/components/ui/Button";
import {
  type EditableQuestion,
  estimateAnswerBoxHeight,
  estimateQuestionRows,
} from "@/lib/evaluation-questions";

type Props = {
  title: string;
  questions: EditableQuestion[];
  generating: boolean;
  onRegenerate: () => void;
  onChange: (questions: EditableQuestion[]) => void;
};

/** Aperçu modifiable du sujet : énoncés, points, ajout et suppression d'exercices. */
export function StepQuestions({ title, questions, generating, onRegenerate, onChange }: Props) {
  function update(id: string, patch: Partial<EditableQuestion>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Étape 3 — Feuille du test + modification</h2>
        <Button
          type="button"
          variant="outline"
          className="border-gray-200"
          onClick={onRegenerate}
          disabled={generating}
          loading={generating}
          loadingText="Génération…"
        >
          <FileText className="h-4 w-4" />
          Régénérer
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{title || "Titre de l'évaluation"}</h3>
          <RubricTotal questions={questions} />
        </div>
        <div className="mt-4 space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900">Exercice {i + 1}</p>
                <div className="flex items-center gap-2">
                  <label htmlFor={`points-${q.id}`} className="text-xs font-semibold text-gray-600">
                    Points
                  </label>
                  <input
                    id={`points-${q.id}`}
                    type="number"
                    min={1}
                    value={q.points}
                    onChange={(e) => update(q.id, { points: Math.max(1, Number(e.target.value || 1)) })}
                    className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm outline-none ring-primary-500 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => onChange(questions.filter((it) => it.id !== q.id))}
                    disabled={questions.length <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={questions.length <= 1 ? "Au moins une question est requise" : "Supprimer cet exercice"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
              <textarea
                aria-label={`Énoncé de l'exercice ${i + 1}`}
                rows={estimateQuestionRows(q.text)}
                value={q.text}
                onChange={(e) => update(q.id, { text: e.target.value })}
                className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed outline-none ring-primary-500 focus:ring-2"
              />
              <div
                className="mt-3 rounded-lg border-2 border-gray-200 bg-white"
                style={{ height: `${estimateAnswerBoxHeight(q.text)}px` }}
              />
            </div>
          ))}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="border-gray-200"
        onClick={() => onChange([...questions, { id: newQuestionId(), text: "Nouvelle question...", points: 1 }])}
      >
        <Plus className="h-4 w-4" />
        Ajouter une question
      </Button>
    </div>
  );
}
