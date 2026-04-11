import { Plus, ClipboardList } from "lucide-react";
import Link from "next/link";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import {
  EvaluationsManager,
  type EvaluationRow,
} from "@/components/dashboard/EvaluationsManager";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

export default async function EvaluationsPage() {
  const teacherId = await getTeacherId();

  let list: EvaluationRow[] = [];

  if (teacherId) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("tests")
      .select(
        "id, title, subject, level, class_name, status, created_at, copies_generated, copies_corrected, copies_submitted, total_points",
      )
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    list = (data ?? []) as EvaluationRow[];
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
        <EvaluationsManager initialRows={list} />
      )}
    </div>
  );
}
