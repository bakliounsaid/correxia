import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

export async function POST(
  _req: Request,
  { params }: { params: { evaluationId: string } },
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

  const { data: test } = await supabase
    .from("tests")
    .select("id")
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!test) {
    return NextResponse.json({ error: "Évaluation introuvable." }, { status: 404 });
  }

  const { data: copies } = await supabase
    .from("test_copies")
    .select("id, scanned_image_url")
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId);

  const importedCount = (copies ?? []).filter((c) => Boolean(c.scanned_image_url)).length;

  const { error: resetCopiesError } = await supabase
    .from("test_copies")
    .update({
      scanned_image_url: null,
      status: "generated",
    })
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId);
  if (resetCopiesError) {
    return NextResponse.json({ error: resetCopiesError.message }, { status: 500 });
  }

  const { error: deleteCorrectionsError } = await supabase
    .from("copy_corrections")
    .delete()
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId);
  if (deleteCorrectionsError) {
    return NextResponse.json({ error: deleteCorrectionsError.message }, { status: 500 });
  }

  const { error: testUpdateError } = await supabase
    .from("tests")
    .update({
      status: "in_progress",
      copies_submitted: 0,
      copies_corrected: 0,
    })
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId);
  if (testUpdateError) {
    return NextResponse.json({ error: testUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reset_imported_sheets: importedCount,
  });
}

