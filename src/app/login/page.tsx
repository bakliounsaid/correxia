import Link from "next/link";
import { CorrexiaLogo } from "@/components/brand/CorrexiaLogo";
import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  searchParams: { redirect?: string; error?: string };
};

export default function LoginPage({ searchParams }: Props) {
  const adminRedirect =
    typeof searchParams.redirect === "string" &&
    searchParams.redirect.startsWith("/admin");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative flex flex-1 flex-col justify-between bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#A78BFA] px-8 py-10 text-white lg:max-w-[46%] lg:px-12">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <CorrexiaLogo size={28} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-wide">CORREXIA</p>
              <p className="text-xs text-white/80">
                Correction assistée par IA
              </p>
            </div>
          </Link>
          <h1 className="mt-14 max-w-md text-3xl font-semibold leading-tight lg:text-4xl">
            Simplifiez vos corrections avec l&apos;IA
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85">
            Gagnez du temps tout en gardant le contrôle : l&apos;outil analyse et
            vous assiste à chaque étape, pour une notation cohérente et
            explicable.
          </p>
        </div>
        <div className="mt-10 space-y-3 lg:mt-0">
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold">Correction 10x plus rapide</p>
            <p className="mt-1 text-xs text-white/80">
              L&apos;IA détecte et analyse automatiquement les étapes de résolution.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold">Notation intelligente</p>
            <p className="mt-1 text-xs text-white/80">
              Suggestions de notes basées sur votre barème personnalisé.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-gradient-to-b from-secondary-50 to-white px-6 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
          <h2 className="text-2xl font-semibold text-gray-900">Bon retour !</h2>
          <p className="mt-1 text-sm text-gray-500">
            Connectez-vous avec l&apos;email et le mot de passe de votre compte.
          </p>
          {adminRedirect ? (
            <p className="mt-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">
              Accès <strong>administration plateforme</strong> : après connexion,
              vous serez redirigé vers le tableau de bord admin.
            </p>
          ) : (
            <p className="mt-3 text-center text-sm text-gray-500">
              <Link
                href="/login?redirect=/admin"
                className="font-medium text-primary-500 hover:text-primary-600"
              >
                Connexion administrateur plateforme
              </Link>
            </p>
          )}

          <LoginForm />
        </div>
        <p className="mx-auto mt-8 max-w-md text-center text-xs text-gray-500">
          En vous connectant, vous acceptez nos{" "}
          <a className="font-medium text-gray-700 underline" href="#">
            Conditions d&apos;utilisation
          </a>{" "}
          et notre{" "}
          <a className="font-medium text-gray-700 underline" href="#">
            Politique de confidentialité
          </a>
          .
        </p>
      </div>
    </div>
  );
}
