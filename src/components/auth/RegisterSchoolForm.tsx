"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, Lock, Mail, MapPin, Phone } from "lucide-react";
import { ACCOUNT_TYPE } from "@/lib/account-types";
import { RgpdConsentCheckbox } from "@/components/auth/RgpdConsentCheckbox";
import { AlertMessage, type AlertVariant } from "@/components/ui/AlertMessage";
import { FieldError } from "@/components/ui/FieldError";
import { mapApiError } from "@/lib/api-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  isValidEmail,
  mapAuthError,
  USER_MESSAGES,
} from "@/lib/user-messages";
import { cn } from "@/lib/utils";

type SchoolField =
  | "schoolName"
  | "email"
  | "city"
  | "postal"
  | "address"
  | "phone"
  | "password"
  | "confirm"
  | "rgpdConsent";

type SchoolFieldErrors = Partial<Record<SchoolField, string>>;
type FlashMessage = { variant: AlertVariant; message: string } | null;

const inputBase =
  "w-full rounded-xl border bg-gray-50 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary-500";

export function RegisterSchoolForm() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SchoolFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage>(null);
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
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function pushFlash(variant: AlertVariant, message: string) {
    setFlash({ variant, message });
  }

  function validateFields(): boolean {
    const next: SchoolFieldErrors = {};
    if (!schoolName.trim()) next.schoolName = USER_MESSAGES.fieldRequired;
    if (!email.trim()) {
      next.email = USER_MESSAGES.fieldRequired;
    } else if (!isValidEmail(email)) {
      next.email = USER_MESSAGES.emailInvalid;
    }
    if (!city.trim()) next.city = USER_MESSAGES.fieldRequired;
    if (!postal.trim()) next.postal = USER_MESSAGES.fieldRequired;
    if (!address.trim()) next.address = USER_MESSAGES.fieldRequired;
    if (!phone.trim()) next.phone = USER_MESSAGES.fieldRequired;
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
    if (!validateFields()) {
      pushFlash("warning", "Merci de corriger les champs indiqués.");
      return;
    }
    if (!supabaseReady) {
      setError(USER_MESSAGES.configSupabase);
      pushFlash("error", USER_MESSAGES.configSupabase);
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
            account_type: ACCOUNT_TYPE.SCHOOL_ADMIN,
            school_name: schoolName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            postal_code: postal.trim(),
            first_name: "Administrateur",
            last_name: schoolName.trim().slice(0, 200),
            subject: "math",
            rgpd_consent: true,
            rgpd_consent_at: rgpdAcceptedAt,
          },
        },
      });

      if (signErr) {
        const msg = mapAuthError(signErr.message, signErr.status);
        setError(msg);
        pushFlash("error", msg);
        return;
      }

      if (data.session) {
        pushFlash("success", "Compte créé avec succès.");
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (data.user) {
        setInfo(USER_MESSAGES.signupCheckEmail);
        pushFlash("success", USER_MESSAGES.signupCheckEmail);
        return;
      }

      setError(USER_MESSAGES.signupFailed);
      pushFlash("error", USER_MESSAGES.signupFailed);
    } catch (err) {
      const msg = mapApiError(err);
      setError(msg);
      pushFlash("error", msg);
    } finally {
      setLoading(false);
    }
  }

  function clearField(key: SchoolField) {
    setFieldErrors((f) => ({ ...f, [key]: undefined }));
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
      {!supabaseReady && (
        <AlertMessage variant="warning">{USER_MESSAGES.configSupabase}</AlertMessage>
      )}
      {flash && <AlertMessage variant={flash.variant}>{flash.message}</AlertMessage>}
      {error && <AlertMessage variant="error">{error}</AlertMessage>}
      {info && <AlertMessage variant="info">{info}</AlertMessage>}

      <div>
        <label
          htmlFor="school-name"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Nom de l&apos;établissement
        </label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="school-name"
            name="schoolName"
            value={schoolName}
            onChange={(e) => {
              setSchoolName(e.target.value);
              clearField("schoolName");
            }}
            placeholder="Lycée Jean Moulin"
            aria-invalid={Boolean(fieldErrors.schoolName)}
            className={cn(
              inputBase,
              "pl-10 pr-4",
              fieldErrors.schoolName
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.schoolName} />
      </div>
      <div>
        <label
          htmlFor="school-email"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Email administrateur
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="school-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField("email");
            }}
            placeholder="admin@etablissement.fr"
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
            htmlFor="school-city"
            className="mb-1.5 block text-xs font-semibold text-gray-800"
          >
            Ville
          </label>
          <input
            id="school-city"
            name="city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              clearField("city");
            }}
            aria-invalid={Boolean(fieldErrors.city)}
            className={cn(
              inputBase,
              "px-4",
              fieldErrors.city
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
          <FieldError message={fieldErrors.city} />
        </div>
        <div>
          <label
            htmlFor="school-postal"
            className="mb-1.5 block text-xs font-semibold text-gray-800"
          >
            Code postal
          </label>
          <input
            id="school-postal"
            name="postal"
            value={postal}
            onChange={(e) => {
              setPostal(e.target.value);
              clearField("postal");
            }}
            aria-invalid={Boolean(fieldErrors.postal)}
            className={cn(
              inputBase,
              "px-4",
              fieldErrors.postal
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
          <FieldError message={fieldErrors.postal} />
        </div>
      </div>
      <div>
        <label
          htmlFor="school-address"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Adresse
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            id="school-address"
            name="address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              clearField("address");
            }}
            aria-invalid={Boolean(fieldErrors.address)}
            className={cn(
              inputBase,
              "pl-10 pr-4",
              fieldErrors.address
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.address} />
      </div>
      <div>
        <label
          htmlFor="school-phone"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Téléphone
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="school-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearField("phone");
            }}
            aria-invalid={Boolean(fieldErrors.phone)}
            className={cn(
              inputBase,
              "pl-10 pr-4",
              fieldErrors.phone
                ? "border-error-400 ring-2 ring-error-200"
                : "border-transparent",
            )}
          />
        </div>
        <FieldError message={fieldErrors.phone} />
      </div>
      <div>
        <label
          htmlFor="school-password"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Mot de passe
        </label>
        <input
          id="school-password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldErrors((f) => ({
              ...f,
              password: undefined,
              confirm: undefined,
            }));
          }}
          autoComplete="new-password"
          aria-invalid={Boolean(fieldErrors.password)}
          className={cn(
            inputBase,
            "px-4",
            fieldErrors.password
              ? "border-error-400 ring-2 ring-error-200"
              : "border-transparent",
          )}
        />
        <FieldError message={fieldErrors.password} />
      </div>
      <div>
        <label
          htmlFor="school-confirm"
          className="mb-1.5 block text-xs font-semibold text-gray-800"
        >
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="school-confirm"
            name="confirm"
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearField("confirm");
            }}
            autoComplete="new-password"
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
        id="school-rgpd-consent"
        checked={rgpdAccepted}
        onCheckedChange={(v) => {
          setRgpdAccepted(v);
          clearField("rgpdConsent");
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
        <Link href="/login" className="text-primary-500 hover:text-primary-600">
          Déjà inscrit ? Se connecter
        </Link>
      </p>
    </form>
  );
}
