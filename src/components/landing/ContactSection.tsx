"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";

type RoleOption = "Enseignant" | "Responsable" | "Autres";

export function ContactSection() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSent(false);
    try {
      const form = e.currentTarget;
      const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
      const subject = (form.elements.namedItem("subject") as HTMLSelectElement)?.value;
      const message = (form.elements.namedItem("message") as HTMLTextAreaElement)?.value;
      const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
      const phone = (form.elements.namedItem("phone") as HTMLInputElement)?.value;
      const role = (form.elements.namedItem("role") as HTMLSelectElement)?.value as RoleOption;

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          role,
          subject,
          message,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Envoi impossible pour le moment.");
      }

      setSent(true);
      form.reset();
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    void handleSubmit(e).catch((err: unknown) => {
      const fallback = "Envoi impossible pour le moment. Réessayez dans quelques instants.";
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : fallback;
      setError(message || fallback);
    });
  }

  return (
    <section
      id="contact"
      className="border-t border-gray-100 bg-white py-16 md:py-24"
    >
      <div className="mx-auto max-w-3xl px-5">
        <div className="mx-auto mb-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-500">
          <Mail className="h-8 w-8" strokeWidth={1.75} />
        </div>
        <h2 className="text-center text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
          Contactez-nous
        </h2>
        <p className="mt-4 text-center text-gray-600">
          Une question sur les tarifs, une démo pour votre établissement ou un
          partenariat ? Remplissez le formulaire ci-dessous.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-10 space-y-4 rounded-2xl border border-gray-200 bg-gray-50/50 p-6 md:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contact-name"
                className="block text-sm font-semibold text-gray-800"
              >
                Nom *
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                placeholder="Votre nom"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="contact-email"
                className="block text-sm font-semibold text-gray-800"
              >
                Email *
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                placeholder="votre@email.fr"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="contact-phone"
                className="block text-sm font-semibold text-gray-800"
              >
                Téléphone *
              </label>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                required
                placeholder="+33 6 12 34 56 78"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="contact-role"
                className="block text-sm font-semibold text-gray-800"
              >
                Fonction *
              </label>
              <select
                id="contact-role"
                name="role"
                required
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Sélectionner votre fonction</option>
                <option value="Enseignant">Enseignant</option>
                <option value="Responsable">Responsable</option>
                <option value="Autres">Autres</option>
              </select>
            </div>
          </div>
          <div>
            <label
              htmlFor="contact-subject"
              className="block text-sm font-semibold text-gray-800"
            >
              Sujet *
            </label>
            <select
              id="contact-subject"
              name="subject"
              required
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Sélectionner le sujet</option>
              <option value="Démo Produit">Démo Produit</option>
              <option value="Discussion Tarifaire">Discussion Tarifaire</option>
              <option value="Audit de Processus">Audit de Processus</option>
              <option value="Autres">Autres</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="contact-message"
              className="block text-sm font-semibold text-gray-800"
            >
              Message *
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={5}
              placeholder="Décrivez votre demande..."
              className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-primary-600 hover:shadow-md active:scale-[0.98] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-8"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Send className="h-4 w-4 shrink-0" />
            )}
            {pending
              ? "Envoi en cours…"
              : sent
                ? "Message envoyé"
                : "Envoyer"}
          </button>
          {sent ? (
            <p className="text-sm text-success-700">
              Merci ! Votre message a bien été envoyé.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
        </form>

      </div>
    </section>
  );
}
