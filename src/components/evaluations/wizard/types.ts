import type { EditableQuestion } from "@/lib/evaluation-questions";

export type Complexity = "" | "facile" | "moyen" | "difficile";

/** Brouillon d'évaluation construit pas à pas par l'assistant de création. */
export type EvaluationDraft = {
  title: string;
  evaluationDate: string;
  className: string;
  complexity: Complexity;
  durationMinutes: number;
  courseFile: File | null;
  courseContext: string;
  questions: EditableQuestion[];
};

export const WIZARD_STEPS = [
  "Infos évaluation",
  "Upload cours PDF",
  "Prévisualisation test",
  "Validation finale",
] as const;

export const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2";

export function newQuestionId(): string {
  return `q-${Math.random().toString(36).slice(2, 9)}`;
}

/** Le bouton « Suivant » n'est actif que si l'étape en cours est complète. */
export function canGoNext(step: number, draft: EvaluationDraft): boolean {
  if (step === 0) return Boolean(draft.title.trim() && draft.className.trim() && draft.complexity);
  if (step === 1) return Boolean(draft.courseFile) || Boolean(draft.courseContext.trim());
  if (step === 2) return draft.questions.length > 0 && draft.questions.every((q) => q.text.trim() && q.points > 0);
  return true;
}
