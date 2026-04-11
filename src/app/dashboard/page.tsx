import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileStack,
  GraduationCap,
  CircleUserRound,
  LayoutGrid,
  School,
  Users,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: currentUser } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (user && currentUser?.role === "school_admin") {
    const { data: school } = await supabase
      .from("schools")
      .select("id, name, city")
      .eq("admin_user_id", user.id)
      .maybeSingle();

    const schoolId = school?.id ?? null;
    const [teachersCountRes, studentsCountRes, classesRes] = schoolId
      ? await Promise.all([
          supabase
            .from("teachers")
            .select("id, users!inner(role)", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("users.role", "teacher"),
          supabase
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId),
          supabase
            .from("classes")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId),
        ])
      : [null, null, null];

    const classesCount = classesRes?.count ?? 0;

    return (
      <div className="p-8 lg:p-10">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Dashboard établissement
          </h1>
          <p className="mt-1 text-gray-500">
            Suivi global de votre établissement : enseignants, élèves et classes.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">
            <School className="h-4 w-4" />
            {school?.name
              ? `${school.name}${school.city ? ` — ${school.city}` : ""}`
              : "Établissement non lié"}
          </p>
        </header>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Enseignants",
              value: String(teachersCountRes?.count ?? 0),
              icon: GraduationCap,
              iconBg: "bg-ia-50",
              iconColor: "text-ia-600",
            },
            {
              label: "Élèves",
              value: String(studentsCountRes?.count ?? 0),
              icon: CircleUserRound,
              iconBg: "bg-secondary-50",
              iconColor: "text-secondary-600",
            },
            {
              label: "Classes",
              value: String(classesCount),
              icon: Users,
              iconBg: "bg-success-50",
              iconColor: "text-success-600",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
            >
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                  s.iconBg,
                )}
              >
                <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
              </div>
              <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const teacherId = await getTeacherId();

  let countClasses = 0;
  let countEleves = 0;
  let countEvaluations = 0;
  let countCopiesTotal = 0;
  let countCopiesACorriger = 0;
  let countCopiesEnCours = 0;
  let countCopiesCorrigees = 0;

  if (teacherId) {
    const [
      testsTotal,
      copiesTotal,
      copiesACorriger,
      copiesEnCours,
      copiesCorrige,
      classTeachersRes,
    ] = await Promise.all([
      supabase
        .from("tests")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId),
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId),
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .in("status", ["submitted", "pending_review"]),
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .eq("status", "auto_corrected"),
      supabase
        .from("test_copies")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .in("status", ["validated", "archived"]),
      supabase.from("class_teachers").select("class_id").eq("teacher_id", teacherId),
    ]);

    countEvaluations = testsTotal.count ?? 0;
    countCopiesTotal = copiesTotal.count ?? 0;
    countCopiesACorriger = copiesACorriger.count ?? 0;
    countCopiesEnCours = copiesEnCours.count ?? 0;
    countCopiesCorrigees = copiesCorrige.count ?? 0;

    const classIds = Array.from(
      new Set(
        (classTeachersRes.data ?? []).map((r: { class_id: string }) => r.class_id),
      ),
    );
    countClasses = classIds.length;
    if (classIds.length > 0) {
      const { count: sc } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .in("class_id", classIds);
      countEleves = sc ?? 0;
    }
  }

  const moyenneElevesParClasse =
    countClasses > 0
      ? (countEleves / countClasses).toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
          minimumFractionDigits: countEleves % countClasses === 0 ? 0 : 1,
        })
      : "—";

  const statsClasses = [
    {
      label: "Mes classes",
      value: String(countClasses),
      icon: LayoutGrid,
      iconBg: "bg-secondary-50",
      iconColor: "text-secondary-600",
    },
    {
      label: "Élèves suivis",
      value: String(countEleves),
      icon: Users,
      iconBg: "bg-ia-50",
      iconColor: "text-ia-600",
    },
    {
      label: "Moyenne d’élèves par classe",
      value: moyenneElevesParClasse,
      icon: BarChart3,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-600",
    },
  ];

  const statsCorrections = [
    {
      label: "Copies à corriger",
      value: String(countCopiesACorriger),
      icon: AlertCircle,
      iconBg: "bg-error-50",
      iconColor: "text-error-600",
    },
    {
      label: "Corrections en cours",
      value: String(countCopiesEnCours),
      hint: "Copies corrigées par l’IA, en attente de validation",
      icon: Clock,
      iconBg: "bg-warning-50",
      iconColor: "text-warning-600",
    },
    {
      label: "Copies corrigées",
      value: String(countCopiesCorrigees),
      hint: "Validées ou archivées",
      icon: CheckCircle2,
      iconBg: "bg-success-50",
      iconColor: "text-success-700",
    },
  ];

  const statsEvaluations = [
    {
      label: "Évaluations créées",
      value: String(countEvaluations),
      icon: ClipboardList,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-600",
    },
    {
      label: "Copies au total",
      value: String(countCopiesTotal),
      icon: FileStack,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-700",
    },
  ];

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Tableau de bord
        </h1>
        <p className="mt-1 text-gray-500">
          Suivi des corrections, de vos évaluations et de vos classes
        </p>
        {!teacherId ? (
          <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Compte sans profil <strong>enseignant</strong> : les indicateurs
            restent à <strong>0</strong> jusqu’à ce qu’une ligne{" "}
            <code className="rounded bg-white/80 px-1 text-xs">teachers</code>{" "}
            soit liée à votre utilisateur.
          </p>
        ) : null}
      </header>

      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Corrections des copies
      </p>
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {statsCorrections.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                s.iconBg,
              )}
            >
              <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            {"hint" in s && s.hint ? (
              <p className="mt-2 text-xs leading-snug text-gray-400">{s.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Évaluations et volumes
      </p>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-2 lg:max-w-3xl">
        {statsEvaluations.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                s.iconBg,
              )}
            >
              <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Classes
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {statsClasses.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-card"
          >
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                s.iconBg,
              )}
            >
              <s.icon className={cn("h-6 w-6", s.iconColor)} strokeWidth={2} />
            </div>
            <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      
    </div>
  );
}
