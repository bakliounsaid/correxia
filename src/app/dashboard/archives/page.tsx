import { Eye, Download, Archive } from "lucide-react";
import Link from "next/link";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ArchiveRow = {
  id: string;
  title: string;
  subject: string;
  level: string;
  updated_at: string;
  copies_generated: number | null;
  copies_corrected: number | null;
};

export default async function ArchivesPage() {
  const teacherId = await getTeacherId();

  let rows: ArchiveRow[] = [];
  if (teacherId) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("tests")
      .select(
        "id, title, subject, level, updated_at, copies_generated, copies_corrected",
      )
      .eq("teacher_id", teacherId)
      .eq("status", "completed")
      .order("updated_at", { ascending: false });
    rows = (data ?? []) as ArchiveRow[];
  }

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-6 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Archives
        </h1>
        <p className="mt-1 text-gray-500">
          Évaluations au statut « completed » dans la base
        </p>
      </header>

      {!teacherId ? (
        <DashboardEmptyState
          title="Aucune archive"
          message="Profil enseignant requis pour consulter vos archives. Les évaluations clôturées (statut completed) s’afficheront ici."
          icon={Archive}
          accentClass="border-t-amber-500"
        />
      ) : rows.length === 0 ? (
        <DashboardEmptyState
          title="Aucune archive"
          message="Aucune évaluation n’est encore au statut « completed ». Lorsque vous clôturerez une évaluation en base, elle apparaîtra dans ce tableau."
          icon={Archive}
          accentClass="border-t-gray-400"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-4">Évaluation</th>
                  <th className="px-6 py-4">Niveau</th>
                  <th className="px-6 py-4">Clôturée le</th>
                  <th className="px-6 py-4">Copies</th>
                  <th className="px-6 py-4">Corrigées</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">
                        {subjectLabelFr(r.subject)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.level}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatShortDate(r.updated_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {r.copies_generated ?? 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-primary-500">
                        {r.copies_corrected ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/evaluations/${r.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Voir
                        </Link>
                        <button
                          type="button"
                          disabled
                          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
