/** Questions d'une évaluation : formats stockés (tests.questions) et formats d'affichage / PDF. */

export type PrintableQuestion = { label: string; text: string; points: number };

/** Questions du sujet prêtes à imprimer (au moins un exercice vide si aucune question). */
export function toPrintableQuestions(raw: unknown): PrintableQuestion[] {
  const items = Array.isArray(raw) ? (raw as Array<{ title?: string; text?: string; points?: number }>) : [];
  if (items.length === 0) return [{ label: "Exercice 1", text: "", points: 0 }];
  return items.map((q, idx) => ({
    label: q?.title || `Exercice ${idx + 1}`,
    text: q?.text || "",
    points: Number(q?.points ?? 0) || 0,
  }));
}

export type EditableQuestion = { id: string; text: string; points: number };

/** Répartition entière dont la somme vaut exactement `total` (ex. 20 pts sur N exercices). */
export function distributePointsToTotal(count: number, total: number): number[] {
  if (count <= 0 || total <= 0) return [];
  const base = Math.floor(total / count);
  const rem = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

export function totalPoints(questions: Array<{ points: number }>): number {
  return questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
}

/** Format enregistré en base (tests.questions et tests.rubric). */
export function toStoredQuestions(questions: EditableQuestion[]) {
  return {
    questions: questions.map((q, idx) => ({
      id: `exo-${idx + 1}`,
      type: "open_question",
      title: `Exercice ${idx + 1}`,
      text: q.text,
      points: Number(q.points || 0),
    })),
    rubric: questions.map((q, idx) => ({
      id: `exo-${idx + 1}`,
      label: `Exercice ${idx + 1}`,
      points: Number(q.points || 0),
    })),
    totalPoints: totalPoints(questions),
  };
}

/** Hauteur de la zone de saisie selon la longueur de l'énoncé. */
export function estimateQuestionRows(text: string): number {
  const normalized = (text || "").trim();
  const lineBreaks = normalized ? normalized.split("\n").length : 1;
  const estimatedByLength = Math.ceil(normalized.length / 95);
  return Math.max(4, Math.min(16, Math.max(lineBreaks, estimatedByLength)));
}

/** Hauteur (px) de la zone de réponse de l'aperçu, proportionnelle à l'énoncé. */
export function estimateAnswerBoxHeight(text: string): number {
  return Math.max(128, Math.min(320, 96 + estimateQuestionRows(text) * 12));
}

export function safeFileSlug(value: string, fallback: string): string {
  return (value || fallback).replace(/[^a-zA-Z0-9-_]/g, "-");
}
