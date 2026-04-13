import { notFound } from "next/navigation";
import { subjectLabelFr } from "@/lib/dashboard-profile";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRelationOne } from "@/lib/supabase-join";
import { getTeacherId } from "@/lib/teacher-context";
import { CopyReviewWorkspace } from "@/components/dashboard/CopyReviewWorkspace";
import { parsePassagesAVerifier } from "@/lib/copy-revision-passages";

type PageProps = {
  params: { evaluationSlug: string; copyId: string };
};

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
      scanned_image_url,
      pdf_url,
      test_id,
      tests ( title, subject, level, teacher_id ),
      students ( first_name, last_name, classes(name) ),
      copy_corrections ( teacher_validated_points, ai_total_points, ai_confidence_score, ai_analysis_json, is_validated )
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
    classes: { name: string } | { name: string }[] | null;
  };
  type Corr = {
    teacher_validated_points: number | null;
    ai_total_points: number | null;
    ai_confidence_score: number | null;
    ai_analysis_json: {
      feedback?: string;
      per_exercise?: Array<{ label?: string; score?: number; max?: number; comment?: string }>;
      passages_a_verifier?: unknown;
    } | null;
  };

  const test = normalizeRelationOne<TestJoin>(row.tests as TestJoin | TestJoin[] | null);
  const stu = normalizeRelationOne<StudentJoin>(row.students as StudentJoin | StudentJoin[] | null);
  if (!test || test.teacher_id !== teacherId) notFound();

  const cls = stu ? (Array.isArray(stu.classes) ? (stu.classes[0] ?? null) : stu.classes) : null;
  const studentName = stu ? `${stu.first_name} ${stu.last_name}`.trim() : "Élève";
  const classe = cls?.name ?? test.level;
  const corr = normalizeRelationOne<Corr>(row.copy_corrections as Corr | Corr[] | null);
  const passagesAVerifier = parsePassagesAVerifier(corr?.ai_analysis_json?.passages_a_verifier);

  return (
    <CopyReviewWorkspace
      evaluationId={params.evaluationSlug}
      copyId={params.copyId}
      backHref={`/dashboard/evaluations/${params.evaluationSlug}`}
      studentName={studentName}
      testTitle={test.title}
      subjectLabel={subjectLabelFr(test.subject)}
      className={classe}
      status={row.status as string}
      previewUrl={(row.scanned_image_url as string | null) ?? (row.pdf_url as string | null) ?? null}
      aiScore={corr?.ai_total_points ?? null}
      aiConfidence={corr?.ai_confidence_score ?? null}
      aiFeedback={String(corr?.ai_analysis_json?.feedback ?? "")}
      aiPerExercise={
        Array.isArray(corr?.ai_analysis_json?.per_exercise)
          ? (corr?.ai_analysis_json?.per_exercise ?? []).map((x, i) => ({
              label: String(x?.label ?? `Exercice ${i + 1}`),
              score: Number(x?.score ?? 0),
              max: Number(x?.max ?? 0),
              comment: x?.comment ? String(x.comment) : "",
            }))
          : []
      }
      passagesAVerifier={passagesAVerifier}
      validatedScore={corr?.teacher_validated_points ?? null}
    />
  );
}
