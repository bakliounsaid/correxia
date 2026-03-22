"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { RegisterSchoolForm } from "@/components/auth/RegisterSchoolForm";

type Mode = "teacher" | "school";

function RegisterSwitcherInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("teacher");

  useEffect(() => {
    setMode(searchParams.get("type") === "school" ? "school" : "teacher");
  }, [searchParams]);

  return (
    <>
      <div
        className="mb-6 flex justify-center"
        role="tablist"
        aria-label="Type d’inscription"
      >
        <div className="inline-flex w-full max-w-md rounded-full border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "teacher"}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              mode === "teacher"
                ? "bg-primary-500 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setMode("teacher")}
          >
            Enseignant
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "school"}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              mode === "school"
                ? "bg-ia-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setMode("school")}
          >
            Établissement
          </button>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900">
        {mode === "teacher"
          ? "Compte enseignant indépendant"
          : "Compte administrateur établissement"}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {mode === "teacher"
          ? "Packs B2C (Essentiel, Avancé, Maîtrise). Un compte = un prof."
          : "Plan B2B : votre établissement et votre accès admin sont créés ensemble."}
      </p>

      <div className="mt-6">
        {mode === "teacher" ? <RegisterForm /> : <RegisterSchoolForm />}
      </div>
    </>
  );
}

export function RegisterSwitcherPanel() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded-full bg-gray-100" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      }
    >
      <RegisterSwitcherInner />
    </Suspense>
  );
}
