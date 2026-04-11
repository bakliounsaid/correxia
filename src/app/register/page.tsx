import { Check } from "lucide-react";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { RegisterSwitcherPanel } from "@/components/auth/RegisterSwitcherPanel";

const features = [
  "Analyse automatique des copies",
  "Suggestions de notation intelligentes",
  "Commentaires personnalisés",
  "Export et statistiques avancées",
];

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative flex flex-1 flex-col justify-between bg-gradient-to-b from-[#5B21B6] to-[#7C3AED] px-8 py-10 text-white lg:max-w-[42%] lg:px-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <CorrexiaLogo size={28} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-wide">CORREXIA</p>
              <p className="text-xs text-white/80">
                Correction assistée par IA
              </p>
            </div>
          </div>
          <h1 className="mt-12 max-w-sm text-3xl font-semibold leading-tight">
            Créer un compte
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/85">
            Enseignant ou établissement : choisissez le bon onglet à droite, une
            seule page pour tout.
          </p>
        </div>
        <ul className="mt-10 space-y-4 lg:mt-0">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-gray-100 px-6 py-12 lg:px-12">
        <div className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 shadow-card">
          <RegisterSwitcherPanel />
        </div>
        <p className="mx-auto mt-8 max-w-lg text-center text-xs text-gray-500">
          L’acceptation du traitement des données (case obligatoire dans le
          formulaire) formalise votre consentement au RGPD. Consultez aussi nos
          conditions d&apos;utilisation et notre politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
