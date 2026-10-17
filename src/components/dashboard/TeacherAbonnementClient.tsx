"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Sparkles, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  TEACHER_UPGRADE_OFFERS,
  teacherPlanLabel,
  type TeacherOffer,
} from "@/lib/teacher-billing-plans";
import { backendFetch } from "@/lib/backend";
import { cn } from "@/lib/utils";

type TeacherRow = {
  id: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

type Props = {
  teacher: TeacherRow;
  checkout?: string;
  sessionId?: string;
  initialOffersOpen?: boolean;
};

export function TeacherAbonnementClient({
  teacher,
  checkout,
  sessionId,
  initialOffersOpen,
}: Props) {
  const router = useRouter();
  const [offersOpen, setOffersOpen] = useState(() => Boolean(initialOffersOpen));
  const [paying, setPaying] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!initialOffersOpen || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("upgrade") === "1") {
      url.searchParams.delete("upgrade");
      const qs = url.searchParams.toString();
      window.history.replaceState(null, "", qs ? `${url.pathname}?${qs}` : url.pathname);
    }
  }, [initialOffersOpen]);

  const verifySession = useCallback(
    async (sid: string) => {
      const res = await backendFetch("/billing/teacher-checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setBanner({ type: "err", text: data.error ?? "La confirmation du paiement a échoué." });
        return;
      }
      setBanner({
        type: "ok",
        text: "Paiement confirmé. Votre pack enseignant est à jour.",
      });
      router.replace("/dashboard/abonnement-enseignant");
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    if (checkout === "cancel") {
      setBanner({ type: "info", text: "Paiement annulé. Vous pouvez choisir un pack quand vous voulez." });
      router.replace("/dashboard/abonnement-enseignant");
      return;
    }
    if (checkout === "success" && sessionId && !verifiedRef.current) {
      verifiedRef.current = true;
      void verifySession(sessionId);
    }
  }, [checkout, sessionId, router, verifySession]);

  async function startCheckout(offer: TeacherOffer) {
    if (!offer.checkoutPlan) return;
    setPaying(offer.id);
    setBanner(null);
    try {
      const res = await backendFetch("/billing/teacher-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: offer.checkoutPlan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setBanner({
          type: "err",
          text: data.error ?? "Impossible d’ouvrir la page de paiement.",
        });
        return;
      }
      window.location.href = data.url;
    } catch {
      setBanner({ type: "err", text: "Erreur réseau. Réessayez plus tard." });
    } finally {
      setPaying(null);
    }
  }

  const planLabel = teacherPlanLabel(teacher.subscription_plan);

  return (
    <div className="space-y-8">
      {banner ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            banner.type === "ok" && "border-success-200 bg-success-50 text-success-900",
            banner.type === "err" && "border-red-200 bg-red-50 text-red-900",
            banner.type === "info" && "border-primary-200 bg-primary-50 text-primary-900",
          )}
        >
          {banner.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : banner.type === "err" ? (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p>{banner.text}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pack actuel</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{planLabel}</p>
            <p className="mt-1 text-sm text-gray-500">
              Statut :{" "}
              <span className="font-medium text-gray-700">
                {teacher.subscription_status ?? "non renseigné"}
              </span>
              {teacher.stripe_subscription_id ? (
                <span className="ml-2 text-xs text-gray-400">(Stripe actif)</span>
              ) : null}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            className="shrink-0 gap-2"
            onClick={() => setOffersOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Voir les packs payants
          </Button>
        </div>
      </div>

      {offersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="teacher-offers-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <h2 id="teacher-offers-title" className="text-lg font-semibold text-gray-900">
                Packs enseignant (payants)
              </h2>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Fermer"
                onClick={() => setOffersOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {TEACHER_UPGRADE_OFFERS.map((offer) => (
                <div
                  key={offer.id}
                  className={cn(
                    "flex flex-col rounded-2xl border p-5",
                    offer.highlight
                      ? "border-primary-400 bg-primary-50/40 ring-1 ring-primary-500/20"
                      : "border-gray-200 bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">{offer.name}</h3>
                    {offer.badge ? (
                      <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-primary-800">
                        {offer.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3">
                    <span className="text-2xl font-bold text-gray-900">{offer.priceLabel}</span>
                    {offer.priceNote ? (
                      <span className="ml-1 text-sm text-gray-500">{offer.priceNote}</span>
                    ) : null}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-600">
                    {offer.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {offer.footnote ? (
                    <p className="mt-3 text-xs text-gray-500">{offer.footnote}</p>
                  ) : null}
                  <div className="mt-4">
                    {offer.checkoutPlan ? (
                      <Button
                        type="button"
                        variant={offer.highlight ? "primary" : "secondary"}
                        className="w-full"
                        loading={paying === offer.id}
                        disabled={paying !== null}
                        onClick={() => void startCheckout(offer)}
                      >
                        {offer.ctaLabel}
                      </Button>
                    ) : (
                      <Link
                        href={offer.externalHref ?? "#"}
                        className={cn(
                          "inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                          offer.highlight
                            ? "bg-primary-500 text-white hover:bg-primary-600"
                            : "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                        )}
                        onClick={() => setOffersOpen(false)}
                      >
                        {offer.ctaLabel}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
