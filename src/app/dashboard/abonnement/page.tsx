import { CreditCard } from "lucide-react";
import { SchoolAbonnementClient } from "@/components/dashboard/SchoolAbonnementClient";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SearchParams = { checkout?: string; session_id?: string; upgrade?: string };

export default async function AbonnementEtablissementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 lg:p-8">
        <DashboardEmptyState
          title="Connexion requise"
          message="Connectez-vous pour gérer l’abonnement de votre établissement."
          icon={CreditCard}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (currentUser?.role !== "school_admin") {
    return (
      <div className="p-6 lg:p-8">
        <DashboardEmptyState
          title="Accès établissement requis"
          message="La gestion de l’abonnement est réservée aux administrateurs d’établissement."
          icon={CreditCard}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  const { data: school, error } = await supabase
    .from("schools")
    .select("id, name, subscription_plan, subscription_status, stripe_subscription_id")
    .eq("admin_user_id", user.id)
    .maybeSingle();

  if (error || !school) {
    return (
      <div className="p-6 lg:p-8">
        <DashboardEmptyState
          title="Établissement introuvable"
          message="Aucune école n’est liée à ce compte administrateur."
          icon={CreditCard}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Abonnement établissement
        </h1>
        <p className="mt-1 text-gray-500">
          {school.name} — offre actuelle et offres payantes. La démo gratuite reste accessible via{" "}
          <a href="/register-school" className="font-medium text-primary-600 hover:text-primary-700">
            inscription établissement
          </a>
          .
        </p>
      </header>

      <SchoolAbonnementClient
        school={{
          id: school.id as string,
          name: school.name as string,
          subscription_plan: (school.subscription_plan as string | null) ?? null,
          subscription_status: (school.subscription_status as string | null) ?? null,
          stripe_subscription_id: (school.stripe_subscription_id as string | null) ?? null,
        }}
        checkout={searchParams.checkout}
        sessionId={searchParams.session_id}
        initialOffersOpen={searchParams.upgrade === "1"}
      />
    </div>
  );
}
