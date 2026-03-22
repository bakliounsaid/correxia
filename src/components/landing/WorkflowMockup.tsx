"use client";

import { FileText, Check, Sparkles } from "lucide-react";

const mockSteps = [
  { title: "Mise en équation", pts: "4/4", done: true },
  { title: "Résolution", pts: "5.5/6", done: true },
  { title: "Calculs", pts: "3/4", done: true },
  { title: "Conclusion", pts: "—/6", done: false },
];

export function WorkflowMockup() {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 motion-reduce:transition-none hover:-translate-y-1 hover:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)]">
      {/* Barre titre type app */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        </div>
        <div className="ml-2 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs text-gray-500 shadow-sm ring-1 ring-gray-200">
          <FileText className="h-3.5 w-3.5 text-primary-500" />
          <span>Évaluation • Équations différentielles</span>
        </div>
      </div>

      <div className="flex min-h-[220px]">
        {/* Zone copie (gauche) */}
        <div className="flex-1 border-r border-gray-100 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            <span>Copie 3 / 24</span>
          </div>
          <div className="mt-3 space-y-2">
            {[85, 72, 90, 78, 65, 88].map((w, i) => (
              <div
                key={i}
                className="h-2.5 rounded bg-gray-100"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-primary-100 bg-primary-50/50 p-2.5">
            <p className="text-xs text-primary-700">
              Proposition IA : mise en équation correcte, petite imprécision sur
              le coefficient.
            </p>
            <div className="mt-2 flex gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-primary-500 px-2 py-0.5 text-[10px] font-medium text-white">
                <Check className="h-2.5 w-2.5" /> Valider
              </span>
              <span className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                Modifier
              </span>
            </div>
          </div>
        </div>

        {/* Grille de notation (droite) */}
        <div className="w-[140px] shrink-0 bg-gray-50/80 p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Barème
          </p>
          <ul className="space-y-1.5">
            {mockSteps.map((s, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs ${
                  s.done ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                <span className="truncate">{s.title}</span>
                <span
                  className={`shrink-0 font-medium ${
                    s.done ? "text-success-600" : "text-gray-400"
                  }`}
                >
                  {s.pts}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 rounded bg-primary-50 px-2 py-1.5 text-center text-xs font-semibold text-primary-600">
            12.5 / 20
          </div>
        </div>
      </div>
    </div>
  );
}
