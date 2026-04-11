import { Archive } from "lucide-react";
import { ArchivesTableClient } from "@/components/dashboard/ArchivesTableClient";
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

  const archiveClientRows = rows.map((r) => ({
    id: r.id,
    export: {
      titre: r.title,
      matiere: subjectLabelFr(r.subject),
      niveau: r.level,
      cloturee_le: formatShortDate(r.updated_at),
      copies: r.copies_generated ?? 0,
      corrigees: r.copies_corrected ?? 0,
    },
    title: r.title,
    subjectLabel: subjectLabelFr(r.subject),
    level: r.level,
    dateStr: formatShortDate(r.updated_at),
    copiesGen: r.copies_generated ?? 0,
    copiesCorr: r.copies_corrected ?? 0,
  }));

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
        <ArchivesTableClient rows={archiveClientRows} />
      )}
    </div>
  );
}
