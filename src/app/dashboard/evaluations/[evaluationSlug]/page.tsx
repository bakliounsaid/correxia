import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { getTeacherId } from "@/lib/teacher-context";
import { notFound } from "next/navigation";

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = { params: { evaluationSlug: string } };

export default async function EvaluationDetailPage({ params }: Props) {
  const teacherId = await getTeacherId();
  if (!teacherId) notFound();

  const testId = params.evaluationSlug;
  const supabase = createSupabaseServerClient();

  const { data: test } = await supabase
    .from("tests")
    .select("id, title, subject, level, teacher_id")
    .eq("id", testId)
    .maybeSingle();

  if (!test || test.teacher_id !== teacherId) notFound();

  const { data: copies } = await supabase
    .from("test_copies")
    .select(
      "id, status, created_at, students ( first_name, last_name, class_name )",
    )
    .eq("test_id", testId)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  const rows = copies ?? [];

  return (
    <div className="p-8 lg:p-10">
      <Link
        href="/dashboard/evaluations"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux évaluations
      </Link>
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          {test.title}
        </h1>
        <p className="mt-1 text-gray-500">
          {subjectLabelFr(test.subject)} · {test.level} · {rows.length} copie
          {rows.length !== 1 ? "s" : ""}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-gray-500">
          Aucune copie pour cette évaluation. Générez des copies côté produit ou
          insérez des lignes dans{" "}
          <code className="rounded bg-gray-100 px-1 text-sm">test_copies</code>.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Élève</th>
                <th className="px-6 py-3">Classe</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                type St = {
                  first_name: string;
                  last_name: string;
                  class_name: string | null;
                };
                const st = normalizeRelationOne<St>(
                  r.students as St | St[] | null,
                );
                const name = st
                  ? `${st.first_name} ${st.last_name}`.trim()
                  : "—";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {st?.class_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.status}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatShortDate(r.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/evaluations/${testId}/copie/${r.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-xs font-medium text-white hover:bg-primary-600"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Réviser
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
