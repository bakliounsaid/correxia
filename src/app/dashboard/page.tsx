import { AlertCircle, CheckCircle2, Clock, Upload, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { getTeacherId } from "@/lib/teacher-context";
import { cn } from "@/lib/utils";

type UiStatut = "Terminé" | "En cours" | "À corriger";

function mapCopyStatus(status: string): UiStatut {
  if (status === "validated" || status === "archived") return "Terminé";
  if (status === "submitted" || status === "pending_review") return "À corriger";
  if (status === "auto_corrected") return "En cours";
  return "En cours";
}

function StatusBadge({ statut }: { statut: UiStatut }) {
  const styles = {
    Terminé: "bg-success-50 text-success-600",
    "En cours": "bg-warning-50 text-warning-500",
    "À corriger": "bg-error-50 text-error-600",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[statut],
      )}
    >
      {statut}
    </span>
  );
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type TestJoin = {
  title: string;
  subject: string;
  total_points: number | null;
};
type StudentJoinDash = { first_name: string; last_name: string };
type CorrJoin = {
  teacher_validated_points: number | null;
  ai_total_points: number | null;
};

type CopyRow = {
  id: string;
  status: string;
  created_at: string;
  test_id: string;
  tests: TestJoin | null;
  students: StudentJoinDash | null;
  copy_corrections: CorrJoin | null;
};

function normalizeDashboardCopyRow(raw: {
  id: string;
  status: string;
  created_at: string;
  test_id: string;
  tests: TestJoin | TestJoin[] | null;
  students: StudentJoinDash | StudentJoinDash[] | null;
  copy_corrections: CorrJoin | CorrJoin[] | null;
}): CopyRow {
  const corrRaw = raw.copy_corrections;
  const corr = Array.isArray(corrRaw) ? (corrRaw[0] ?? null) : corrRaw;
  return {
    id: raw.id,
    status: raw.status,
    created_at: raw.created_at,
    test_id: raw.test_id,
    tests: normalizeRelationOne(raw.tests),
    students: normalizeRelationOne(raw.students),
    copy_corrections: corr,
  };
}

export default async function DashboardPage() {
  const teacherId = await getTeacherId();

  let countACorriger = 0;
  let countEnCours = 0;
  let countTerminees = 0;
  let rows: CopyRow[] = [];

  if (teacherId) {
    const supabase = createSupabaseServerClient();
    const [aCorriger, enCours, terminees, copiesRes] = await Promise.all([
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .in("status", ["submitted", "pending_review"]),
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .eq("status", "auto_corrected"),
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .in("status", ["validated", "archived"]),
      supabase
        .from("test_copies")
        .select(
          `
        id,
        status,
        created_at,
        test_id,
        tests ( title, subject, total_points ),
        students ( first_name, last_name ),
        copy_corrections ( teacher_validated_points, ai_total_points )
      `,
        )
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    countACorriger = aCorriger.count ?? 0;
    countEnCours = enCours.count ?? 0;
    countTerminees = terminees.count ?? 0;
    rows = (copiesRes.data ?? []).map((r) =>
      normalizeDashboardCopyRow(
        r as Parameters<typeof normalizeDashboardCopyRow>[0],
      ),
    );
  }

  const stats = [
    {
      label: "Copies à corriger",
      value: String(countACorriger),
      icon: AlertCircle,
      iconBg: "bg-error-50",
      iconColor: "text-error-600",
    },
    {
      label: "Corrections en cours",
      value: String(countEnCours),
      icon: Clock,
      iconBg: "bg-warning-50",
      iconColor: "text-warning-500",
    },
    {
      label: "Copies corrigées",
      value: String(countTerminees),
      icon: CheckCircle2,
      iconBg: "bg-success-50",
      iconColor: "text-success-600",
    },
  ];

  const emptyCopiesMessage = teacherId
    ? "Aucune copie pour l’instant. Créez une évaluation et des élèves pour générer des copies."
    : "Aucune copie : associez d’abord un profil enseignant à votre compte (inscription ou trigger Supabase sur la table teachers).";

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Tableau de bord
        </h1>
        <p className="mt-1 text-gray-500">
          Gérez vos corrections et suivez l&apos;avancement de vos évaluations
        </p>
        {!teacherId ? (
          <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Compte sans profil <strong>enseignant</strong> : les indicateurs
            restent à <strong>0</strong> jusqu’à ce qu’une ligne{" "}
            <code className="rounded bg-white/80 px-1 text-xs">teachers</code>{" "}
            soit liée à votre utilisateur.
          </p>
        ) : null}
      </header>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                s.iconBg,
              )}
            >
              <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-10 rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-500">
          <Upload className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          Déposez vos documents
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          ou cliquez pour sélectionner des fichiers
        </p>
        <p className="mt-3 text-xs text-gray-400">
          Formats acceptés : PDF, JPG, PNG • Taille max : 10 Mo par fichier
        </p>
        <Button className="mt-6 rounded-lg px-8" type="button" disabled>
          Sélectionner des fichiers
        </Button>
        <p className="mt-3 text-xs text-gray-400">
          Upload à brancher sur Supabase Storage / API.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Liste des copies
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Élève</th>
                <th className="px-6 py-3">Évaluation</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Note suggérée</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    {emptyCopiesMessage}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const stu = r.students;
                  const eleve = stu
                    ? `${stu.first_name} ${stu.last_name}`.trim()
                    : "—";
                  const test = r.tests;
                  const matiere = test
                    ? `${subjectLabelFr(test.subject)} — ${test.title}`
                    : "—";
                  const ui = mapCopyStatus(r.status);
                  const corr = r.copy_corrections;
                  const pts =
                    corr?.teacher_validated_points ?? corr?.ai_total_points;
                  const max = test?.total_points;
                  const note =
                    pts != null && max != null
                      ? `${pts} / ${max}`
                      : pts != null
                        ? `${pts} pts`
                        : null;

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {eleve}
                      </td>
                      <td className="max-w-[220px] px-6 py-4 text-gray-600">
                        {matiere}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatShortDate(r.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge statut={ui} />
                      </td>
                      <td className="px-6 py-4">
                        {note ? (
                          <span className="font-semibold text-primary-500">
                            {note}
                          </span>
                        ) : (
                          <span className="text-gray-400">En attente</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/evaluations/${r.test_id}/copie/${r.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-600"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                          Réviser
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
