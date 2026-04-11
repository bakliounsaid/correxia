import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureSchoolClass } from "@/lib/supabase-classes-admin";

type UpdateTeacherBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  subject?: "math" | "physics" | "science";
  className?: string;
  classNames?: string[];
  password?: string;
};

async function getContext() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié.", status: 401 as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "school_admin") {
    return { error: "Accès refusé.", status: 403 as const };
  }

  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("admin_user_id", user.id)
    .maybeSingle();
  if (!school?.id) {
    return { error: "Aucun établissement lié à ce compte.", status: 400 as const };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: "Configuration serveur Supabase manquante.", status: 500 as const };
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { supabase, admin, schoolId: school.id };
}

export async function PATCH(
  req: Request,
  { params }: { params: { teacherId: string } },
) {
  const ctx = await getContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { admin, schoolId } = ctx;
  const teacherId = params.teacherId;

  const { data: teacher, error: tErr } = await admin
    .from("teachers")
    .select("id, user_id")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (tErr || !teacher) {
    return NextResponse.json({ error: "Enseignant introuvable." }, { status: 404 });
  }

  const body = (await req.json()) as UpdateTeacherBody;
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const classNames = Array.from(
    new Set(
      ((body.className ? [body.className] : []).concat(body.classNames ?? []))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
  const subject = body.subject ?? "math";
  const password = body.password ?? "";

  if (!firstName || !lastName || !email || classNames.length === 0) {
    return NextResponse.json(
      { error: "Prénom, nom, email et classe sont obligatoires." },
      { status: 400 },
    );
  }

  const { error: userErr } = await admin
    .from("users")
    .update({ full_name: `${firstName} ${lastName}`.trim(), role: "teacher" })
    .eq("id", teacher.user_id);
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const authPayload: { email: string; password?: string } = { email };
  if (password.trim()) authPayload.password = password.trim();
  const { error: authErr } = await admin.auth.admin.updateUserById(
    teacher.user_id,
    authPayload,
  );
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  const { error: teacherErr } = await admin
    .from("teachers")
    .update({ subject })
    .eq("id", teacher.id);
  if (teacherErr) {
    return NextResponse.json({ error: teacherErr.message }, { status: 500 });
  }

  try {
    const classIds: string[] = [];
    for (const className of classNames) {
      classIds.push(await ensureSchoolClass(admin, schoolId, className));
    }
    const { error: wipeErr } = await admin
      .from("class_teachers")
      .delete()
      .eq("teacher_id", teacher.id);
    if (wipeErr) throw new Error(wipeErr.message);
    const { error: pivotErr } = await admin.from("class_teachers").insert(
      classIds.map((classId) => ({
        class_id: classId,
        teacher_id: teacher.id,
      })),
    );
    if (pivotErr) throw new Error(pivotErr.message);
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          e && typeof e === "object" && "message" in e
            ? String((e as { message: string }).message)
            : "Affectation de classe impossible.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    teacher: {
      id: teacher.id,
      full_name: `${firstName} ${lastName}`.trim(),
      email,
      subject,
      class_name: classNames[0],
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { teacherId: string } },
) {
  const ctx = await getContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { admin, schoolId } = ctx;
  const teacherId = params.teacherId;

  const { data: teacher, error: tErr } = await admin
    .from("teachers")
    .select("id, user_id")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (tErr || !teacher) {
    return NextResponse.json({ error: "Enseignant introuvable." }, { status: 404 });
  }

  const { error: tcErr } = await admin
    .from("class_teachers")
    .delete()
    .eq("teacher_id", teacher.id);
  if (tcErr) {
    return NextResponse.json({ error: tcErr.message }, { status: 500 });
  }

  const { error: teacherDetachErr } = await admin
    .from("teachers")
    .update({ school_id: null, is_independent: true })
    .eq("id", teacher.id)
    .eq("school_id", schoolId);
  if (teacherDetachErr) {
    return NextResponse.json({ error: teacherDetachErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

