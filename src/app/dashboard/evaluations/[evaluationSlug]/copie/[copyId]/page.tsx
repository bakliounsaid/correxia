import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Minus,
  Plus,
  RotateCw,
  Search,
  ZoomIn,
  ZoomOut,
  Send,
  Sparkles,
} from "lucide-react";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { getTeacherId } from "@/lib/teacher-context";

const steps = [
  {
    n: 1,
    title: "Mise en équation du problème",
    desc: "Identification des conditions initiales et forme standard.",
    score: "4",
    max: "4",
    ia: "Excellente mise en équation : la forme y' + 2y = 3e^{-x} est correctement identifiée.",
  },
  {
    n: 2,
    title: "Méthode de résolution",
    desc: "Application du facteur intégrant ou variation des constantes.",
    score: "5.5",
    max: "6",
    ia: "La méthode est appropriée ; une petite imprécision sur le coefficient multiplicateur.",
  },
  {
    n: 3,
    title: "Calculs intermédiaires",
    desc: "Primitives et simplifications.",
    score: "3",
    max: "4",
    ia: "Erreur de signe sur une étape ; le reste est cohérent.",
  },
  {
    n: 4,
    title: "Conclusion et vérification",
    desc: "Solution finale et vérification.",
    score: "6",
    max: "6",
    ia: "Réponse finale correcte et vérification mentionnée.",
  },
];

type PageProps = {
  params: { evaluationSlug: string; copyId: string };
};

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function CopyReviewPage({ params }: PageProps) {
  const teacherId = await getTeacherId();
  if (!teacherId) notFound();

  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase
    .from("test_copies")
    .select(
      `
      id,
      status,
      created_at,
      test_id,
      tests ( title, subject, level, teacher_id ),
      students ( first_name, last_name, class_name ),
      copy_corrections ( teacher_validated_points, ai_total_points, is_validated )
    `,
    )
    .eq("id", params.copyId)
    .eq("test_id", params.evaluationSlug)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (!row) notFound();

  type TestJoin = {
    title: string;
    subject: string;
    level: string;
    teacher_id: string;
  };
  type StudentJoin = {
    first_name: string;
    last_name: string;
    class_name: string | null;
  };

  const test = normalizeRelationOne<TestJoin>(
    row.tests as TestJoin | TestJoin[] | null,
  );
  const stu = normalizeRelationOne<StudentJoin>(
    row.students as StudentJoin | StudentJoin[] | null,
  );

  if (!test || test.teacher_id !== teacherId) notFound();

  const studentName = stu
    ? `${stu.first_name} ${stu.last_name}`.trim()
    : "Élève";
  const classe = stu?.class_name ?? test.level;
  const corrRaw = row.copy_corrections;
  const corr = Array.isArray(corrRaw) ? corrRaw[0] : corrRaw;
  const corrTyped = corr as {
    teacher_validated_points: number | null;
    ai_total_points: number | null;
  } | null;
  const pts =
    corrTyped?.teacher_validated_points ?? corrTyped?.ai_total_points ?? null;
  const noteFinale = pts != null ? String(pts) : "—";
  const noteMax = "20";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex min-h-[45vh] flex-1 flex-col border-b border-gray-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <Link
              href={`/dashboard/evaluations/${params.evaluationSlug}`}
              className="mb-1 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
            <h1 className="truncate text-lg font-semibold text-gray-900">
              {studentName} — {test.title}
            </h1>
            <p className="text-xs text-gray-500">
              Copie #{row.id.slice(0, 8)}… — {classe} —{" "}
              {formatShortDate(row.created_at)} · {subjectLabelFr(test.subject)}{" "}
              · {row.status}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              className="rounded p-2 text-gray-600 hover:bg-white"
              aria-label="Zoom arrière"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-gray-600">100%</span>
            <button
              type="button"
              className="rounded p-2 text-gray-600 hover:bg-white"
              aria-label="Zoom avant"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-2 text-gray-600 hover:bg-white"
              aria-label="Recherche"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-2 text-gray-600 hover:bg-white"
              aria-label="Pivoter"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-start justify-center overflow-auto bg-gray-100 p-6">
          <div className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-400">
              Aperçu de la copie
            </p>
            <h2 className="mt-4 text-base font-semibold text-gray-900">
              {test.title}
            </h2>
            <p className="mt-4 text-sm text-gray-600">
              Document numérique ou scan à afficher ici (URL stockée en base :
              champs <code className="text-xs">pdf_url</code> /{" "}
              <code className="text-xs">scanned_image_url</code>).
            </p>
          </div>
        </div>
      </div>

      <aside className="flex w-full flex-col bg-gray-50 lg:w-[420px] lg:shrink-0 xl:w-[460px]">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold text-primary-500">
              Note finale{" "}
              <span className="tabular-nums">
                {noteFinale} / {noteMax}
              </span>
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-success-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-success-600"
            >
              <Send className="h-4 w-4" />
              Valider et Envoyer
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5">
          <div className="rounded-xl border border-primary-100 bg-primary-50/80 p-4 text-sm text-primary-800">
            <p className="font-semibold text-primary-700">Analyse IA</p>
            <p className="mt-1 text-primary-700/90">
              Données détaillées à brancher sur{" "}
              <code className="text-xs">copy_corrections</code> (barème dynamique
              ci-dessous encore en démo).
            </p>
          </div>

          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
                  {s.n}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">{s.desc}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {s.score} / {s.max}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2 rounded-lg bg-ia-50 p-3 text-sm text-ia-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ia-500" />
                    <p>{s.ia}</p>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-gray-700">
                    Votre commentaire
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ajoutez vos commentaires personnalisés..."
                    className="mt-1 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none ring-primary-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-900">
              Commentaire général
            </label>
            <textarea
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
              placeholder="Synthèse pour l&apos;élève..."
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
