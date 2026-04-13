import { AdminSubscriptionsTableClient } from "@/components/admin/AdminSubscriptionsTableClient";
import {
  formatDaysLabel,
  paidBillingPeriodToDaysLabel,
} from "@/lib/subscription-period-days";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SubRow = {
  id: string;
  plan_type: string;
  status: string;
  billing_period: string;
  price_cents: number;
  stripe_subscription_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  teacher_id: string | null;
  school_id: string | null;
};

type TeacherPlanRow = {
  id: string;
  school_id: string | null;
  subscription_plan: string;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  created_at: string;
};

type SchoolPlanRow = {
  id: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  created_at: string;
};

function syntheticRowFromTeacher(t: TeacherPlanRow): SubRow {
  return {
    id: `synthetic-teacher-${t.id}`,
    plan_type: t.subscription_plan,
    status: (t.subscription_status?.trim() || "active").toLowerCase(),
    billing_period: "—",
    price_cents: 0,
    stripe_subscription_id: null,
    start_date: t.subscription_start_date,
    end_date: t.subscription_end_date,
    created_at: t.created_at,
    teacher_id: t.id,
    school_id: null,
  };
}

function syntheticRowFromSchool(s: SchoolPlanRow): SubRow {
  return {
    id: `synthetic-school-${s.id}`,
    plan_type: s.subscription_plan?.trim() || "free",
    status: (s.subscription_status?.trim() || "active").toLowerCase(),
    billing_period: "—",
    price_cents: 0,
    stripe_subscription_id: null,
    start_date: s.subscription_start_date,
    end_date: s.subscription_end_date,
    created_at: s.created_at,
    teacher_id: null,
    school_id: s.id,
  };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Durée affichée pour offres gratuites / synthétiques (dates en base ou règles produit). */
function formatFreeOrSyntheticDuration(r: SubRow): string {
  if (r.start_date && r.end_date) {
    const start = new Date(r.start_date).getTime();
    const end = new Date(r.end_date).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      const days = Math.round((end - start) / 86_400_000);
      if (days >= 0) {
        return formatDaysLabel(days);
      }
    }
  }
  if (r.teacher_id && r.plan_type?.toLowerCase() === "free") {
    return formatDaysLabel(30);
  }
  if (
    r.school_id &&
    (!r.plan_type?.trim() || r.plan_type.toLowerCase() === "free")
  ) {
    return formatDaysLabel(14);
  }
  return "—";
}

function displayBillingPeriod(r: SubRow): string {
  if (!r.id.startsWith("synthetic-")) {
    return paidBillingPeriodToDaysLabel(r.billing_period);
  }
  return formatFreeOrSyntheticDuration(r);
}

export default async function AdminSubscriptionsPage() {
  const supabase = createSupabaseServerClient();

  const [
    { data: subData, error: subError },
    { data: teachersData, error: teachersError },
    { data: schoolsData, error: schoolsError },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, plan_type, status, billing_period, price_cents, stripe_subscription_id, start_date, end_date, created_at, teacher_id, school_id",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("teachers")
      .select(
        "id, school_id, subscription_plan, subscription_status, subscription_start_date, subscription_end_date, created_at, users!inner ( role )",
      )
      .eq("users.role", "teacher"),
    supabase
      .from("schools")
      .select(
        "id, subscription_plan, subscription_status, subscription_start_date, subscription_end_date, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const fromStripe = (subData ?? []) as SubRow[];
  const teacherIdsInStripe = new Set(
    fromStripe.map((r) => r.teacher_id).filter(Boolean) as string[],
  );
  const schoolIdsInStripe = new Set(
    fromStripe.map((r) => r.school_id).filter(Boolean) as string[],
  );

  const syntheticTeachers =
    !teachersError && teachersData
      ? (teachersData as TeacherPlanRow[])
          .filter((t) => !teacherIdsInStripe.has(t.id))
          .filter(
            (t) =>
              !t.school_id || !schoolIdsInStripe.has(t.school_id),
          )
          .map(syntheticRowFromTeacher)
      : [];

  const syntheticSchools =
    !schoolsError && schoolsData
      ? (schoolsData as SchoolPlanRow[])
          .filter((s) => !schoolIdsInStripe.has(s.id))
          .map(syntheticRowFromSchool)
      : [];

  const teacherSchoolById = new Map<string, string | null>();
  if (!teachersError && teachersData) {
    for (const t of teachersData as TeacherPlanRow[]) {
      teacherSchoolById.set(t.id, t.school_id ?? null);
    }
  }

  /** Abonnement établissement dans `subscriptions` : on ne duplique pas les enseignants rattachés. */
  function keepSubscriptionRow(r: SubRow): boolean {
    if (!r.teacher_id) return true;
    const sid = teacherSchoolById.get(r.teacher_id);
    if (sid && schoolIdsInStripe.has(sid)) return false;
    return true;
  }

  const rows = [...fromStripe, ...syntheticTeachers, ...syntheticSchools]
    .filter(keepSubscriptionRow)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const loadError =
    subError?.message ?? teachersError?.message ?? schoolsError?.message;

  const clientRows = rows.map((r) => ({
    id: r.id,
    export: {
      plan: r.plan_type,
      type: r.teacher_id ? "Enseignant" : r.school_id ? "École" : "",
      periode: displayBillingPeriod(r),
      statut: r.status,
      montant_eur: ((r.price_cents ?? 0) / 100).toFixed(2),
      debut: formatDate(r.start_date),
      fin: formatDate(r.end_date),
      cree_le: formatDate(r.created_at),
    },
    plan_type: r.plan_type,
    typeLabel: r.teacher_id ? "Enseignant" : r.school_id ? "École" : "—",
    billing_period: displayBillingPeriod(r),
    status: r.status,
    priceEuros: ((r.price_cents ?? 0) / 100).toFixed(2),
    startLabel: formatDate(r.start_date),
    endLabel: formatDate(r.end_date),
    createdLabel: formatDate(r.created_at),
  }));

  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Subscriptions
        </h1>
        <p className="mt-1 text-gray-500">
          Abonnements facturés (Stripe) et plans enregistrés sur les profils,
          y compris gratuits. Pour un établissement souscrit, les enseignants
          rattachés n’apparaissent pas en doublon.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-lg border border-error-50 bg-error-50 px-4 py-3 text-sm text-error-600">
          Impossible de charger une partie des données ({loadError}).
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Tous les abonnements
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">0 ligne</p>
          </div>
          <p className="px-6 py-10 text-center text-sm text-gray-500">Aucun abonnement.</p>
        </div>
      ) : (
        <AdminSubscriptionsTableClient
          rows={clientRows}
          toolbarLeft={
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Tous les abonnements
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {rows.length} ligne{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
