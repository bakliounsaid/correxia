import { RubricTotal } from "@/components/evaluations/wizard/RubricTotal";
import { type EditableQuestion, estimateAnswerBoxHeight } from "@/lib/evaluation-questions";

/** Aperçu final du sujet tel qu'il sera imprimé. */
export function StepReview({ title, questions }: { title: string; questions: EditableQuestion[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Étape 4 — Validation finale</h2>
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-2xl font-semibold text-gray-900">{title || "Titre de l'évaluation"}</h3>
          <RubricTotal questions={questions} />
        </div>
        <div className="mt-6 space-y-6">
          {questions.map((q, i) => (
            <article key={q.id} className="border-b border-gray-100 pb-5 last:border-b-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">Exercice {i + 1}</p>
                <span className="text-sm font-semibold text-gray-700">{q.points} pts</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{q.text}</p>
              <div
                className="mt-4 rounded-lg border-2 border-gray-200 bg-white"
                style={{ height: `${estimateAnswerBoxHeight(q.text)}px` }}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
