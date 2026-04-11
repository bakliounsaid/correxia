import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ensureSchoolClassIds } from "@/lib/supabase-classes-admin";

type CreateTeacherBody = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  subject?: "math" | "physics" | "science";
  className?: string;
  classNames?: string[];
};

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "school_admin") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("admin_user_id", user.id)
    .maybeSingle();
  if (!school?.id) {
    return NextResponse.json(
      { error: "Aucun établissement lié à ce compte." },
      { status: 400 },
    );
  }

  const body = (await req.json()) as CreateTeacherBody;
  const firstNameIn = (body.firstName ?? "").trim();
  const lastNameIn = (body.lastName ?? "").trim();
  const fullNameIn = (body.fullName ?? "").trim();
  const fullName =
    fullNameIn || `${firstNameIn} ${lastNameIn}`.trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const subject = body.subject ?? "math";
  const singleClass = (body.className ?? "").trim();
  const classNames = Array.from(
    new Set(
      (singleClass
        ? [singleClass, ...(body.classNames ?? [])]
        : body.classNames ?? []
      )
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  );

  if (!fullName || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Nom, email et mot de passe (6+) sont requis." },
      { status: 400 },
    );
  }
  if (classNames.length === 0) {
    return NextResponse.json(
      { error: "Vous devez attribuer au moins une classe à l’enseignant." },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Configuration serveur Supabase manquante." },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = firstNameIn || parts[0] || "Enseignant";
  const lastName = lastNameIn || parts.slice(1).join(" ") || "CORREXIA";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      account_type: "teacher_independent",
      first_name: firstName,
      last_name: lastName,
      subject,
    },
  });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "Création du compte impossible." },
      { status: 400 },
    );
  }

  const newUserId = created.user.id;
  const { data: teacherRow, error: teacherErr } = await admin
    .from("teachers")
    .select("id")
    .eq("user_id", newUserId)
    .maybeSingle();
  if (teacherErr || !teacherRow?.id) {
    return NextResponse.json(
      { error: "Compte créé mais profil enseignant introuvable." },
      { status: 500 },
    );
  }

  const { error: patchTeacherErr } = await admin
    .from("teachers")
    .update({
      school_id: school.id,
      is_independent: false,
      subject,
    })
    .eq("id", teacherRow.id);
  if (patchTeacherErr) {
    return NextResponse.json({ error: patchTeacherErr.message }, { status: 500 });
  }

  const { error: patchUserErr } = await admin
    .from("users")
    .update({ full_name: fullName, role: "teacher" })
    .eq("id", newUserId);
  if (patchUserErr) {
    return NextResponse.json({ error: patchUserErr.message }, { status: 500 });
  }

  try {
    const classIds = await ensureSchoolClassIds(admin, school.id, classNames);
    if (classIds.length > 0) {
      const { error: pivotErr } = await admin.from("class_teachers").upsert(
        classIds.map((classId) => ({
          class_id: classId,
          teacher_id: teacherRow.id,
        })),
        { onConflict: "class_id,teacher_id" },
      );
      if (pivotErr) throw new Error(pivotErr.message);
    }
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          e && typeof e === "object" && "message" in e
            ? `Enseignant créé, mais classes non rattachées : ${String((e as { message: string }).message)}`
            : "Enseignant créé, mais classes non rattachées.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    teacher: {
      id: teacherRow.id,
      full_name: fullName,
      email,
      subject,
      class_count: classNames.length,
    },
  });
}

