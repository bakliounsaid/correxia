"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { AlertMessage } from "@/components/ui/AlertMessage";
import { RgpdConsentCheckbox } from "@/components/auth/RgpdConsentCheckbox";
import { FieldError } from "@/components/ui/FieldError";
import { ACCOUNT_TYPE } from "@/lib/account-types";
import { mapApiError } from "@/lib/api-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  isValidEmail,
  mapAuthError,
  USER_MESSAGES,
} from "@/lib/user-messages";
import { cn } from "@/lib/utils";

type RegFieldErrors = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  subject: string;
  rgpdConsent: string;
}>;

/** Valeurs alignées sur public.teachers.subject (CHECK math | physics | science) */
const TEACHER_SUBJECT_OPTIONS = [
  { value: "math", label: "Mathématiques" },
  { value: "physics", label: "Physique-chimie" },
  { value: "science", label: "Sciences (SVT, etc.)" },
] as const;

const inputBase =
  "w-full rounded-xl border bg-gray-50 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary-500";

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegFieldErrors>({});
  const [loading, setLoading] = useState(false);

  const supabaseReady = useMemo(() => {
    try {
      getSupabaseBrowserClient();
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
  }, [emailFromUrl]);

  function validateFields(): boolean {
    const next: RegFieldErrors = {};
    if (!firstName.trim()) {
      next.firstName = USER_MESSAGES.fieldRequired;
    }
    if (!lastName.trim()) {
      next.lastName = USER_MESSAGES.fieldRequired;
    }
    if (!email.trim()) {
      next.email = USER_MESSAGES.fieldRequired;
    } else if (!isValidEmail(email)) {
      next.email = USER_MESSAGES.emailInvalid;
    }
    if (!password) {
      next.password = USER_MESSAGES.fieldRequired;
    } else if (password.length < 6) {
      next.password = USER_MESSAGES.passwordMinLength;
    }
    if (!confirm) {
      next.confirm = USER_MESSAGES.fieldRequired;
    } else if (password !== confirm) {
      next.confirm = USER_MESSAGES.passwordConfirmMismatch;
    }
    if (!subject.trim()) {
      next.subject = USER_MESSAGES.fieldRequired;
    }
    if (!rgpdAccepted) {
      next.rgpdConsent = USER_MESSAGES.rgpdConsentRequired;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setFieldErrors({});
    if (!validateFields()) return;
    if (!supabaseReady) {
      setError(USER_MESSAGES.configSupabase);
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const rgpdAcceptedAt = new Date().toISOString();
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: {
            account_type: ACCOUNT_TYPE.TEACHER_INDEPENDENT,
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            school: school.trim() || undefined,
            subject: subject.trim(),
            rgpd_consent: true,
            rgpd_consent_at: rgpdAcceptedAt,
          },
        },
      });

      if (signErr) {
        setError(mapAuthError(signErr.message, signErr.status));
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (data.user) {
        setInfo(USER_MESSAGES.signupCheckEmail);
        return;
      }

      setError(USER_MESSAGES.signupFailed);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
      {!supabaseReady && (
        <AlertMessage variant="warning">
          {USER_MESSAGES.configSupabase}
        </AlertMessage>
      )}
      {error && <AlertMessage variant="error">{error}</AlertMessage>}
      {info && <AlertMessage variant="info">{info}</AlertMessage>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="reg-first"
            className="mb-1.5 block text-xs font-semibold text-gray-800"
          >
            Prénom
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="reg-first"
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setFieldErrors((f) => ({ ...f, firstName: undefined }));
              }}
              placeholder="Jean"
              aria-invalid={Boolean(fieldErrors.firstName)}
              className={cn(
                inputBase,
                "pl-10 pr-3",
                fieldErrors.firstName
                  ? "border-error-400 ring-2 ring-error-200"
                  : "border-transparent",
              )}
            />
          </div>
          <FieldError message={fieldErrors.firstName} />
        </div>
        <div>
          <label
            htmlFor="reg-last"
            className="mb-1.5 block text-xs font-semibold text-gray-800"
          >
            Nom
          </label>
          <input
            id="reg-last"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setFieldErrors((f) => ({ ...f, lastName: undefined }));
            }}
            placeholder="Dupont"
            aria-invalid={Boolean(fieldErrors.lastName)}
            className={cn(
              inputBase,
              "px-4",
              fieldErrors.lastName
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
          <FieldError message={fieldErrors.lastName} />
        </div>
      </div>
      <div>
        <label
          htmlFor="reg-email"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Adresse email professionnelle
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            placeholder="jean.dupont@lycee.fr"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="reg-school"
            className="mb-1.5 block text-xs font-semibold text-gray-800"
          >
            Établissement
          </label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="reg-school"
              name="school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Lycée Victor Hugo"
              className="w-full rounded-xl border border-transparent bg-gray-50 py-3 pl-10 pr-3 text-sm outline-none ring-primary-500 focus:ring-2"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="reg-subject"
            className="mb-1.5 block text-xs font-semibold text-gray-800"
          >
            Matière
          </label>
          <div className="relative">
            <select
              id="reg-subject"
              name="subject"
              required
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setFieldErrors((f) => ({ ...f, subject: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.subject)}
              className={cn(
                inputBase,
                "cursor-pointer appearance-none border-transparent pl-4 pr-10 text-gray-900",
                fieldErrors.subject
                  ? "border-error-400 ring-2 ring-error-200"
                  : "",
                !subject && "text-gray-500",
              )}
            >
              <option value="">Sélectionner la matière</option>
              {TEACHER_SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <FieldError message={fieldErrors.subject} />
        </div>
      </div>
      <div>
        <label
          htmlFor="reg-password"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Mot de passe
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({
                ...f,
                password: undefined,
                confirm: undefined,
              }));
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            className={cn(
              inputBase,
              "pl-10 pr-4",
              fieldErrors.password
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.password} />
      </div>
      <div>
        <label
          htmlFor="reg-confirm"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="reg-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setFieldErrors((f) => ({ ...f, confirm: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.confirm)}
            className={cn(
              inputBase,
              "pl-10 pr-4",
              fieldErrors.confirm
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.confirm} />
      </div>
      <RgpdConsentCheckbox
        id="reg-rgpd-consent"
        checked={rgpdAccepted}
        onCheckedChange={(v) => {
          setRgpdAccepted(v);
          setFieldErrors((f) => ({ ...f, rgpdConsent: undefined }));
        }}
        error={fieldErrors.rgpdConsent}
      />
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:pointer-events-none disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Création…" : "Créer mon compte"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="text-center text-sm text-gray-600">
        Vous avez déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary-500 hover:text-primary-600"
        >
          Se connecter
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  return (
    <Suspense
      fallback={
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-gray-100" />
      }
    >
      <RegisterFormInner />
    </Suspense>
  );
}
