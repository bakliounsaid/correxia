import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

type UpdateBody = {
  title?: string;
  subject?: string;
  class_name?: string;
  level?: string;
  status?: string;
  total_points?: number;
  duration_minutes?: number;
  questions?: unknown;
  rubric?: unknown;
  subject_file_url?: string;
  subject_file_name?: string;
  correction_file_url?: string;
  correction_file_name?: string;
};

function getStoragePathFromPublicUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    const markers = ["/object/public/tests/", "/object/sign/tests/"];
    for (const marker of markers) {
      const idx = url.pathname.indexOf(marker);
      if (idx >= 0) {
        const raw = url.pathname.slice(idx + marker.length);
        return decodeURIComponent(raw);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { evaluationId: string } },
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const teacherId = await getTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "Profil enseignant introuvable." }, { status: 403 });
  }

  const evaluationId = params.evaluationId;
  const body = (await req.json()) as UpdateBody;
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.subject === "string") patch.subject = body.subject.trim();
  if (typeof body.class_name === "string") patch.class_name = body.class_name.trim();
  if (typeof body.level === "string") patch.level = body.level.trim();
  if (typeof body.status === "string") patch.status = body.status.trim();
  if (typeof body.total_points === "number") patch.total_points = body.total_points;
  if (typeof body.duration_minutes === "number") patch.duration_minutes = body.duration_minutes;
  if (body.questions !== undefined) patch.questions = body.questions;
  if (body.rubric !== undefined) patch.rubric = body.rubric;
  if (typeof body.subject_file_url === "string") patch.subject_file_url = body.subject_file_url.trim();
  if (typeof body.subject_file_name === "string") patch.subject_file_name = body.subject_file_name.trim();
  if (typeof body.correction_file_url === "string") patch.correction_file_url = body.correction_file_url.trim();
  if (typeof body.correction_file_name === "string") patch.correction_file_name = body.correction_file_name.trim();
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à modifier." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("tests")
    .select("id, status")
    .eq("id", evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Évaluation introuvable." }, { status: 404 });
  }
  if ((existing.status ?? "").toLowerCase() !== "created") {
    return NextResponse.json(
      { error: "Modification autorisée uniquement pour les tests au statut created." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("tests")
    .update(patch)
    .eq("id", evaluationId)
    .eq("teacher_id", teacherId)
    .select(
      "id, title, subject, level, class_name, status, created_at, copies_generated, copies_corrected, copies_submitted, total_points, duration_minutes, questions, rubric, subject_file_url, subject_file_name, correction_file_url, correction_file_name",
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Évaluation introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, evaluation: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { evaluationId: string } },
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const teacherId = await getTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "Profil enseignant introuvable." }, { status: 403 });
  }
  const evaluationId = params.evaluationId;

  const { data: existing } = await supabase
    .from("tests")
    .select("id, subject_file_url, correction_file_url")
    .eq("id", evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Évaluation introuvable." }, { status: 404 });
  }

  const urls = [
    (existing.subject_file_url as string | null) ?? null,
    (existing.correction_file_url as string | null) ?? null,
  ].filter(Boolean) as string[];
  const storagePaths = urls
    .map((url) => getStoragePathFromPublicUrl(url))
    .filter((p): p is string => Boolean(p));

  const { error } = await supabase
    .from("tests")
    .delete()
    .eq("id", evaluationId)
    .eq("teacher_id", teacherId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Nettoyage best-effort des références "source" éventuelles.
  if (urls.length > 0) {
    await supabase.from("test_sources").delete().eq("teacher_id", teacherId).in("file_url", urls);
  }

  // Nettoyage best-effort du bucket storage lié à l'évaluation.
  let storageWarning: string | null = null;
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("tests").remove(storagePaths);
    if (storageError) {
      storageWarning = `Évaluation supprimée, mais certains fichiers storage n'ont pas pu être supprimés (${storageError.message}).`;
    }
  }

  return NextResponse.json({ ok: true, warning: storageWarning });
}

