import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

type ReviewBody = {
  teacher_validated_points?: number;
  teacher_feedback?: string;
  teacher_comments?: string;
  acceptAi?: boolean;
  perExerciseTeacher?: Array<{ label?: string; score?: number; max?: number; comment?: string }>;
};

export async function PATCH(
  req: Request,
  { params }: { params: { evaluationId: string; copyId: string } },
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const teacherId = await getTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "Profil enseignant introuvable." }, { status: 403 });
  }

  const body = (await req.json()) as ReviewBody;
  if (typeof body.teacher_validated_points !== "number" || Number.isNaN(body.teacher_validated_points)) {
    return NextResponse.json({ error: "Note validée invalide." }, { status: 400 });
  }

  const { data: current } = await supabase
    .from("copy_corrections")
    .select("ai_total_points, ai_analysis_json")
    .eq("copy_id", params.copyId)
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  const aiScore = Number((current?.ai_total_points as number | null) ?? 0);
  const teacherScore = Number(body.teacher_validated_points);
  const acceptAi = Boolean(body.acceptAi);
  const unchanged = Math.abs(aiScore - teacherScore) < 0.0001;
  const validationStatus = acceptAi || unchanged ? "accepted_ai" : "modified";

  const teacherPerExercise = Array.isArray(body.perExerciseTeacher)
    ? body.perExerciseTeacher.map((x, i) => ({
        label: String(x?.label ?? `Exercice ${i + 1}`),
        score: Number(x?.score ?? 0),
        max: Number(x?.max ?? 0),
        comment: x?.comment ? String(x.comment) : "",
      }))
    : [];
  const baseAnalysis =
    current && typeof current.ai_analysis_json === "object" && current.ai_analysis_json
      ? (current.ai_analysis_json as Record<string, unknown>)
      : {};

  const patch = {
    teacher_validated_points: teacherScore,
    teacher_feedback: body.teacher_feedback?.trim() || null,
    teacher_comments: body.teacher_comments?.trim() || null,
    ai_analysis_json: {
      ...baseAnalysis,
      teacher_per_exercise: teacherPerExercise,
    },
    teacher_corrected_at: new Date().toISOString(),
    is_validated: true,
    validation_status: validationStatus,
  };

  const { data, error } = await supabase
    .from("copy_corrections")
    .update(patch)
    .eq("copy_id", params.copyId)
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .select("copy_id, teacher_validated_points, ai_total_points, ai_confidence_score, is_validated, validation_status")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Correction introuvable." }, { status: 404 });
  }

  await supabase
    .from("test_copies")
    .update({ status: "validated" })
    .eq("id", params.copyId)
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId);

  const { count } = await supabase
    .from("copy_corrections")
    .select("id", { count: "exact", head: true })
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .eq("is_validated", true);
  await supabase
    .from("tests")
    .update({ copies_corrected: count ?? 0 })
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId);

  const { data: depositedCopies } = await supabase
    .from("test_copies")
    .select("id, copy_corrections(is_validated)")
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .not("scanned_image_url", "is", null);

  const allDepositedValidated =
    Array.isArray(depositedCopies) &&
    depositedCopies.length > 0 &&
    depositedCopies.every((row) => {
      const raw = row.copy_corrections as { is_validated?: boolean } | { is_validated?: boolean }[] | null;
      const corr = Array.isArray(raw) ? raw[0] : raw;
      return corr?.is_validated === true;
    });

  if (allDepositedValidated) {
    await supabase
      .from("tests")
      .update({ status: "completed" })
      .eq("id", params.evaluationId)
      .eq("teacher_id", teacherId)
      .in("status", ["draft", "created", "in_progress"]);
  }

  return NextResponse.json({
    ok: true,
    review: data,
    evaluationCompleted: allDepositedValidated,
  });
}

