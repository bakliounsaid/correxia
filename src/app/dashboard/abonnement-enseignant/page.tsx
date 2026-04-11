import { GraduationCap } from "lucide-react";
import { TeacherAbonnementClient } from "@/components/dashboard/TeacherAbonnementClient";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SearchParams = { checkout?: string; session_id?: string; upgrade?: string };

export default async function AbonnementEnseignantPage({
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
          message="Connectez-vous pour gérer votre abonnement enseignant."
          icon={GraduationCap}
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

  if (currentUser?.role !== "teacher") {
    return (
      <div className="p-6 lg:p-8">
        <DashboardEmptyState
          title="Compte enseignant requis"
          message="Cette page est réservée aux enseignants (compte individuel). Les administrateurs d’établissement utilisent l’abonnement collectif."
          icon={GraduationCap}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, subscription_plan, subscription_status, stripe_subscription_id, is_independent")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !teacher) {
    return (
      <div className="p-6 lg:p-8">
        <DashboardEmptyState
          title="Profil enseignant introuvable"
          message="Aucune ligne teachers n’est liée à votre compte. Après inscription, le profil doit être créé pour souscrire un pack."
          icon={GraduationCap}
          accentClass="border-t-amber-500"
        />
      </div>
    );
  }

  if (teacher.is_independent !== true) {
    return (
      <div className="p-6 lg:p-8">
        <DashboardEmptyState
          title="Offre gérée par l’établissement"
          message="Votre compte est rattaché à un établissement : l’abonnement payant se fait côté direction, pas en individuel."
          icon={GraduationCap}
          accentClass="border-t-primary-500"
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Abonnement enseignant
        </h1>
        <p className="mt-1 text-gray-500">
          Compte individuel — packs Avancé et Maîtrise. Le pack gratuit Essentiel reste disponible à{" "}
          <a href="/register" className="font-medium text-primary-600 hover:text-primary-700">
            l’inscription
          </a>
          .
        </p>
      </header>

      <TeacherAbonnementClient
        teacher={{
          id: teacher.id as string,
          subscription_plan: (teacher.subscription_plan as string | null) ?? null,
          subscription_status: (teacher.subscription_status as string | null) ?? null,
          stripe_subscription_id: (teacher.stripe_subscription_id as string | null) ?? null,
        }}
        checkout={searchParams.checkout}
        sessionId={searchParams.session_id}
        initialOffersOpen={searchParams.upgrade === "1"}
      />
    </div>
  );
}
