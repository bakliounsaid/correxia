import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";
import { normalizeRelationOne } from "@/lib/supabase-join";

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  classes: { name: string } | { name: string }[] | null;
};

type CopyRow = {
  id: string;
  unique_test_id: string;
  student_id: string;
  students: { first_name: string; last_name: string; classes: { name: string } | { name: string }[] | null } | { first_name: string; last_name: string; classes: { name: string } | { name: string }[] | null }[] | null;
};

function makeUniqueTestId(testId: string, studentId: string) {
  const t = testId.slice(0, 8).toUpperCase();
  const s = studentId.slice(0, 8).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CX-${t}-${s}-${r}`;
}

export async function GET(
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

  const { data: test } = await supabase
    .from("tests")
    .select("id, class_name, level, subject_file_url, correction_file_url")
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (!test) {
    return NextResponse.json({ error: "Évaluation introuvable." }, { status: 404 });
  }
  if (!test.correction_file_url) {
    return NextResponse.json(
      { error: "Ajoutez la correction type avant de commencer le test." },
      { status: 409 },
    );
  }

  const targetClassName =
    ((test as { class_name?: string | null; level?: string }).class_name ??
      (test as { level?: string }).level ??
      "").trim();

  const { data: links } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", teacherId);
  const classIds = (links ?? []).map((l) => l.class_id as string).filter(Boolean);
  if (classIds.length === 0) {
    return NextResponse.json({ ok: true, students: [] });
  }

  const { data: allowedClasses } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds)
    .eq("name", targetClassName);
  const targetClassIds = (allowedClasses ?? []).map((c) => c.id as string);
  if (targetClassIds.length === 0) {
    return NextResponse.json({ ok: true, students: [] });
  }

  const { data: students, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, class_id, classes(name)")
    .in("class_id", targetClassIds)
    .order("last_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = (students ?? []).map((s) => {
    const row = s as StudentRow;
    const cls = normalizeRelationOne<{ name: string }>(
      row.classes as { name: string } | { name: string }[] | null,
    );
    return {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      class_name: cls?.name ?? "—",
    };
  });

  return NextResponse.json({ ok: true, students: payload });
}

export async function POST(
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

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, school_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher) {
    return NextResponse.json({ error: "Enseignant introuvable." }, { status: 404 });
  }

  const { data: test } = await supabase
    .from("tests")
    .select("id, status, title, level, class_name, duration_minutes, questions, subject_file_url, correction_file_url")
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!test) {
    return NextResponse.json({ error: "Évaluation introuvable." }, { status: 404 });
  }
  if (!test.correction_file_url) {
    return NextResponse.json(
      { error: "Ajoutez la correction type avant de commencer le test." },
      { status: 409 },
    );
  }

  const body = (await req.json()) as { studentIds?: string[] };
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds.filter(Boolean) : [];
  if (studentIds.length === 0) {
    return NextResponse.json({ error: "Aucun élève sélectionné." }, { status: 400 });
  }

  const targetClassName =
    ((test as { class_name?: string | null; level?: string }).class_name ??
      (test as { level?: string }).level ??
      "").trim();

  const { data: links } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", teacherId);
  const classIds = (links ?? []).map((l) => l.class_id as string).filter(Boolean);
  if (classIds.length === 0) {
    return NextResponse.json({ error: "Aucune classe liée à cet enseignant." }, { status: 400 });
  }

  const { data: allowedClasses } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds)
    .eq("name", targetClassName);
  const targetClassIds = (allowedClasses ?? []).map((c) => c.id as string);
  if (targetClassIds.length === 0) {
    return NextResponse.json(
      { error: "La classe du test n'est pas liée à cet enseignant." },
      { status: 400 },
    );
  }

  const { data: allowedStudents } = await supabase
    .from("students")
    .select("id")
    .in("class_id", targetClassIds)
    .in("id", studentIds);
  const allowedIds = new Set((allowedStudents ?? []).map((s) => s.id as string));
  const filtered = studentIds.filter((id) => allowedIds.has(id));
  if (filtered.length === 0) {
    return NextResponse.json({ error: "Élèves non autorisés pour ce test." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("test_copies")
    .select("student_id")
    .eq("test_id", params.evaluationId)
    .in("student_id", filtered);
  const existingSet = new Set((existing ?? []).map((e) => e.student_id as string));

  const toCreate = filtered.filter((id) => !existingSet.has(id));
  if (toCreate.length > 0) {
    const rows = toCreate.map((studentId) => ({
      test_id: params.evaluationId,
      student_id: studentId,
      teacher_id: teacher.id,
      school_id: teacher.school_id ?? null,
      unique_test_id: makeUniqueTestId(params.evaluationId, studentId),
      status: "generated",
    }));
    const { error: insertError } = await supabase.from("test_copies").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { count } = await supabase
    .from("test_copies")
    .select("id", { count: "exact", head: true })
    .eq("test_id", params.evaluationId);

  await supabase
    .from("tests")
    .update({
      status: "in_progress",
      copies_generated: count ?? 0,
    })
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId);

  const { data: copiesRows, error: copiesError } = await supabase
    .from("test_copies")
    .select("id, unique_test_id, student_id, students(first_name, last_name, classes(name))")
    .eq("test_id", params.evaluationId)
    .in("student_id", filtered);
  if (copiesError) {
    return NextResponse.json({ error: copiesError.message }, { status: 500 });
  }

  const copies = (copiesRows ?? []).map((r) => {
    const row = r as CopyRow;
    const student = normalizeRelationOne<{
      first_name: string;
      last_name: string;
      classes: { name: string } | { name: string }[] | null;
    }>(row.students);
    const cls = normalizeRelationOne<{ name: string }>(student?.classes ?? null);
    return {
      copy_id: row.id,
      unique_test_id: row.unique_test_id,
      student_id: row.student_id,
      first_name: student?.first_name ?? "",
      last_name: student?.last_name ?? "",
      class_name: cls?.name ?? "—",
    };
  });

  return NextResponse.json({
    ok: true,
    created: toCreate.length,
    already_exists: filtered.length - toCreate.length,
    total_copies: count ?? 0,
    test: {
      id: test.id,
      title: (test as { title?: string }).title ?? "Évaluation",
      level: (test as { class_name?: string | null; level?: string }).class_name ?? (test as { level?: string }).level ?? "",
      duration_minutes: (test as { duration_minutes?: number | null }).duration_minutes ?? null,
      questions: (test as { questions?: unknown }).questions ?? [],
    },
    copies,
  });
}

