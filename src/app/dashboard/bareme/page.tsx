export default function BaremePage() {
  return (
    <div className="p-8 lg:p-10">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Paramètres du barème
        </h1>
        <p className="mt-1 max-w-2xl text-gray-500">
          Définissez vos grilles de notation par défaut et vos critères réutilisables
          pour accélérer la création d&apos;évaluations. Cette section sera reliée à
          votre compte dans une prochaine version.
        </p>
      </header>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
        Configuration du barème — interface à brancher sur l&apos;API.
      </div>
    </div>
  );
}
