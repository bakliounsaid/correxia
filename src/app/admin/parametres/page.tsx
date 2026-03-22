import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AdminParametresPage() {
  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Paramètres
        </h1>
        <p className="mt-1 text-gray-500">
          Raccourcis et zone réservée à la configuration future
        </p>
      </header>

      <div className="max-w-xl rounded-xl border border-gray-100 bg-white p-8 shadow-card">
        <h2 className="text-base font-semibold text-gray-900">
          Espace administrateur
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Les préférences avancées (notifications, intégrations, clés API) pourront
          être ajoutées ici. Pour l’instant, utilisez le tableau de bord et les
          listes pour suivre l’activité.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className={cn(
              "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              "bg-primary-500 text-white hover:bg-primary-600",
            )}
          >
            Retour au dashboard admin
          </Link>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-gray-800 px-4 py-2.5 text-sm font-medium transition-colors",
              "text-gray-900 hover:bg-gray-900 hover:text-white",
            )}
          >
            Page d’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
