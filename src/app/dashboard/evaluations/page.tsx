import { Calendar, Users, Plus, ClipboardList } from "lucide-react";
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

type TestListRow = {
  id: string;
  title: string;
  subject: string;
  level: string;
  status: string;
  created_at: string;
  copies_generated: number | null;
  copies_corrected: number | null;
  copies_submitted: number | null;
  total_points: number | null;
};

export default async function EvaluationsPage() {
  const teacherId = await getTeacherId();

  let list: TestListRow[] = [];

  if (teacherId) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("tests")
      .select(
        "id, title, subject, level, status, created_at, copies_generated, copies_corrected, copies_submitted, total_points",
      )
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    list = (data ?? []) as TestListRow[];
  }

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Évaluations
          </h1>
          <p className="mt-1 text-gray-500">
            Suivez l&apos;avancement de vos corrections
          </p>
        </div>
        <Link
          href="/dashboard/evaluations/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
          Nouvelle évaluation
        </Link>
      </header>

      {!teacherId ? (
        <DashboardEmptyState
          title="Aucune évaluation"
          message="Profil enseignant requis pour lister vos évaluations. Une fois votre compte lié à la table teachers, vos tests apparaîtront ici."
          icon={ClipboardList}
          accentClass="border-t-amber-500"
        />
      ) : list.length === 0 ? (
        <DashboardEmptyState
          title="Aucune évaluation"
          message="Vous n’avez pas encore créé d’évaluation. Utilisez le bouton ci-dessus ou ajoutez des entrées dans la table tests pour commencer."
          icon={ClipboardList}
          accentClass="border-t-primary-500"
        >
          <Link
            href="/dashboard/evaluations/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
            Nouvelle évaluation
          </Link>
        </DashboardEmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {list.map((e) => {
            const total = e.copies_generated ?? 0;
            const done = e.copies_corrected ?? 0;
            const pct =
              total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

            return (
              <article
                key={e.id}
                className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {e.title}
                      </h2>
                      <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600">
                        {subjectLabelFr(e.subject)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {e.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Niveau {e.level}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {formatShortDate(e.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-500">
                      {done}/{total}
                    </p>
                    <p className="text-xs text-gray-500">copies corrigées</p>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      Progression
                    </span>
                    <span className="font-semibold text-primary-500">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/dashboard/evaluations/${e.id}`}
                    className="text-sm font-medium text-primary-500 hover:text-primary-600"
                  >
                    Voir le détail des copies →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
