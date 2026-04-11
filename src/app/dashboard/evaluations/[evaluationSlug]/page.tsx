import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { getTeacherId } from "@/lib/teacher-context";
import { EvaluationDetailEditor } from "@/components/dashboard/EvaluationDetailEditor";
import { StartTestButton } from "@/components/dashboard/StartTestButton";
import { EvaluationCopiesTable, type EvaluationCopyRow } from "@/components/dashboard/EvaluationCopiesTable";
import { notFound } from "next/navigation";

type Props = { params: { evaluationSlug: string } };

export default async function EvaluationDetailPage({ params }: Props) {
  const teacherId = await getTeacherId();
  if (!teacherId) notFound();

  const testId = params.evaluationSlug;
  const supabase = createSupabaseServerClient();

  const { data: test } = await supabase
    .from("tests")
    .select(
      "id, title, subject, level, class_name, status, total_points, duration_minutes, created_at, copies_generated, copies_corrected, copies_submitted, questions, rubric, teacher_id, subject_file_url, subject_file_name, correction_file_url, correction_file_name",
    )
    .eq("id", testId)
    .maybeSingle();

  if (!test || test.teacher_id !== teacherId) notFound();

  const { data: copies } = await supabase
    .from("test_copies")
    .select(
      "id, unique_test_id, status, created_at, pdf_url, scanned_image_url, students ( first_name, last_name, classes(name) ), copy_corrections ( teacher_validated_points, ai_total_points, ai_confidence_score, is_validated )",
    )
    .eq("test_id", testId)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  const rows = copies ?? [];
  const depositedRows = rows.filter((r) => Boolean(r.scanned_image_url));
  const allDepositedCopiesValidated =
    depositedRows.length > 0 &&
    depositedRows.every((r) => {
      type Corr = { is_validated: boolean | null };
      const corr = normalizeRelationOne<Corr>(
        r.copy_corrections as Corr | Corr[] | null,
      );
      return corr?.is_validated === true;
    });

  const copyRows: EvaluationCopyRow[] = rows.map((r) => {
    type St = {
      first_name: string;
      last_name: string;
      classes: { name: string } | { name: string }[] | null;
    };
    type Corr = {
      teacher_validated_points: number | null;
      ai_total_points: number | null;
      ai_confidence_score: number | null;
      is_validated: boolean | null;
    };
    const st = normalizeRelationOne<St>(r.students as St | St[] | null);
    const corr = normalizeRelationOne<Corr>(r.copy_corrections as Corr | Corr[] | null);
    const cls = st ? (Array.isArray(st.classes) ? (st.classes[0] ?? null) : st.classes) : null;
    return {
      id: r.id as string,
      unique_test_id: (r.unique_test_id as string | null) ?? null,
      status: (r.status as string) ?? "generated",
      created_at: r.created_at as string,
      pdf_url: (r.pdf_url as string | null) ?? null,
      scanned_image_url: (r.scanned_image_url as string | null) ?? null,
      first_name: st?.first_name ?? "—",
      last_name: st?.last_name ?? "—",
      class_name: cls?.name ?? "—",
      note: corr?.teacher_validated_points ?? null,
      ia_suggested_note: corr?.ai_total_points ?? null,
      precision: corr?.ai_confidence_score ?? null,
    };
  });

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              {test.title}
            </h1>
            <p className="mt-1 text-gray-500">
              {rows.length > 0
                ? `${rows.length} élève${rows.length !== 1 ? "s" : ""} · `
                : ""}
              {(test.class_name as string | null) || test.level} · {subjectLabelFr(test.subject)}
            </p>
          </div>
          <StartTestButton
            evaluationId={testId}
            status={test.status}
            hasCorrectionFile={Boolean(test.correction_file_url)}
            copyCount={rows.length}
            hasDepositedCopy={rows.some((r) => Boolean(r.scanned_image_url))}
            allDepositedCopiesValidated={allDepositedCopiesValidated}
            evaluationTitle={test.title}
            classLabel={(test.class_name as string | null) || test.level}
            durationMinutes={(test.duration_minutes as number | null) ?? null}
            questions={test.questions}
          />
        </div>
      </header>

      {rows.length > 0 ? (
        <section className="mb-10">
          <EvaluationCopiesTable
            evaluationId={testId}
            initialRows={copyRows}
            testTitle={test.title}
            className={(test.class_name as string | null) || test.level}
            durationMinutes={(test.duration_minutes as number | null) ?? null}
            questions={test.questions}
          />
        </section>
      ) : null}

      <EvaluationDetailEditor evaluation={test} />
    </div>
  );
}
