import Link from "next/link";
import {
  ChevronDown,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const criteres = [
  { label: "Mise en équation du problème", pts: 4 },
  { label: "Résolution", pts: 6 },
  { label: "Calculs", pts: 4 },
  { label: "Vérification", pts: 4 },
  { label: "Rédaction", pts: 2 },
];

export default function NewEvaluationPage() {
  return (
    <div className="p-8 lg:p-10">
      <Link
        href="/dashboard/evaluations"
        className="mb-4 inline-flex text-sm font-medium text-gray-600 hover:text-primary-500"
      >
        ← Retour
      </Link>
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Créer une évaluation
        </h1>
        <p className="mt-1 text-gray-500">
          Configurez votre évaluation et uploadez le corrigé de référence
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Informations générales
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-800">
                Nom de l&apos;évaluation *
              </label>
              <input
                type="text"
                placeholder="Ex: Contrôle - Équations différentielles"
                className="w-full rounded-lg border border-transparent bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 placeholder:text-gray-400 focus:ring-2"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-800">
                  Matière *
                </label>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-transparent bg-gray-50 px-4 py-3 text-left text-sm text-gray-500"
                >
                  Sélectionner
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-800">
                  Classe *
                </label>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-transparent bg-gray-50 px-4 py-3 text-left text-sm text-gray-500"
                >
                  Sélectionner
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-800">
                Date de l&apos;évaluation *
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-transparent bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-800">
                Description (optionnel)
              </label>
              <textarea
                rows={4}
                placeholder="Ajoutez des notes ou instructions spécifiques..."
                className="w-full resize-none rounded-lg border border-transparent bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 placeholder:text-gray-400 focus:ring-2"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Barème</h2>
            <span className="text-sm font-bold text-primary-500">
              Total 20 pts
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {criteres.map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                  {c.label}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-600">
                  {c.pts} pts
                </span>
                <button
                  type="button"
                  className="p-1.5 text-error-500 hover:bg-error-50 rounded-md"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-4 w-full border-gray-200">
            <Plus className="h-4 w-4" />
            Ajouter un critère
          </Button>
          <Button variant="success" className="mt-4 w-full rounded-lg py-3">
            <Save className="h-4 w-4" />
            Créer l&apos;évaluation
          </Button>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-card">
        <h2 className="text-base font-semibold text-gray-900">
          Corrigé de référence *
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          L&apos;IA utilisera ce document comme vérité absolue pour comparer les
          copies des élèves.
        </p>
        <div className="mt-6 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
          <Upload className="mx-auto mb-4 h-10 w-10 text-primary-500" />
          <p className="font-semibold text-gray-900">Uploadez le corrigé</p>
          <p className="mt-1 text-sm text-gray-500">PDF, JPG ou PNG • Max 10 Mo</p>
          <Button className="mt-6">Sélectionner un fichier</Button>
        </div>
      </section>
    </div>
  );
}
