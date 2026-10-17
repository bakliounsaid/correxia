import { totalPoints } from "@/lib/evaluation-questions";

/** Total du barème, affiché sur 20. */
export function RubricTotal({ questions }: { questions: Array<{ points: number }> }) {
  return (
    <p className="text-sm text-gray-600">
      Total barème : <span className="font-semibold tabular-nums text-gray-900">{totalPoints(questions)} / 20</span>
    </p>
  );
}
