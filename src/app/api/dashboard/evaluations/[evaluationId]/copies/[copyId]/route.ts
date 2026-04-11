import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

type UpdateBody = {
  status?: string;
  scanned_image_url?: string | null;
  pdf_url?: string | null;
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

  const body = (await req.json()) as UpdateBody;
  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") patch.status = body.status.trim();
  if (body.scanned_image_url !== undefined) patch.scanned_image_url = body.scanned_image_url;
  if (body.pdf_url !== undefined) patch.pdf_url = body.pdf_url;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucune donnée à modifier." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("test_copies")
    .update(patch)
    .eq("id", params.copyId)
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .select("id, status, unique_test_id, pdf_url, scanned_image_url, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Copie introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, copy: data });
}

export async function DELETE(
  _req: Request,
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

  const { error } = await supabase
    .from("test_copies")
    .delete()
    .eq("id", params.copyId)
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase
    .from("test_copies")
    .select("id", { count: "exact", head: true })
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId);
  await supabase
    .from("tests")
    .update({ copies_generated: count ?? 0 })
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId);

  return NextResponse.json({ ok: true });
}

