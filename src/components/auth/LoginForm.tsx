"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { AlertMessage, ConfigCode } from "@/components/ui/AlertMessage";
import { FieldError } from "@/components/ui/FieldError";
import { mapApiError } from "@/lib/api-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  isValidEmail,
  mapAuthError,
  mapUrlErrorParam,
  USER_MESSAGES,
} from "@/lib/user-messages";
import { cn } from "@/lib/utils";

type LoginFieldErrors = Partial<{ email: string; password: string }>;

const inputBase =
  "w-full rounded-xl border bg-gray-50 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlRedirect = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [redirectTo, setRedirectTo] = useState("/dashboard");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(mapUrlErrorParam(urlError));
    setRedirectTo(urlRedirect && urlRedirect.startsWith("/") ? urlRedirect : "/dashboard");
  }, [urlError, urlRedirect]);

  const supabaseReady = useMemo(() => {
    try {
      getSupabaseBrowserClient();
      return true;
    } catch {
      return false;
    }
  }, []);

  function validateFields(): boolean {
    const next: LoginFieldErrors = {};
    if (!email.trim()) {
      next.email = USER_MESSAGES.fieldRequired;
    } else if (!isValidEmail(email)) {
      next.email = USER_MESSAGES.emailInvalid;
    }
    if (!password) {
      next.password = USER_MESSAGES.fieldRequired;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validateFields()) return;
    if (!supabaseReady) {
      setError(USER_MESSAGES.configSupabase);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) {
        setError(mapAuthError(signErr.message, signErr.status));
        return;
      }
      router.push(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
      {!supabaseReady && (
        <AlertMessage variant="warning">
          {USER_MESSAGES.configSupabaseShort}{" "}
          <ConfigCode>.env.local</ConfigCode> — puis{" "}
          <ConfigCode>npm run dev</ConfigCode>.
        </AlertMessage>
      )}
      {error && <AlertMessage variant="error">{error}</AlertMessage>}
      <div>
        <label
          htmlFor="login-email"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Adresse email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            placeholder="votre.email@exemple.fr"
            aria-invalid={Boolean(fieldErrors.email)}
            className={cn(
              inputBase,
              "pl-10 pr-4",
              fieldErrors.email
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.email} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="login-password"
            className="text-xs font-semibold text-gray-800"
          >
            Mot de passe
          </label>
          <span className="text-xs text-gray-400" title="Bientôt disponible">
            Mot de passe oublié ?
          </span>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
            placeholder="••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
            className={cn(
              inputBase,
              "pl-10 pr-10",
              fieldErrors.password
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.password} />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-60"
      >
        {loading ? "Connexion…" : "Se connecter"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="text-center text-sm text-gray-600">
        Vous n&apos;avez pas de compte ?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary-500 hover:text-primary-600"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="mt-8 h-40 animate-pulse rounded-xl bg-gray-100" />}>
      <LoginFormInner />
    </Suspense>
  );
}
