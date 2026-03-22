"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";

export function ContactSection() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
    const subject = (form.elements.namedItem("subject") as HTMLSelectElement)?.value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement)?.value;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;

    const mailto = `mailto:contact@correxia.fr?subject=${encodeURIComponent(subject || "Contact CORREXIA")}&body=${encodeURIComponent(
      `Nom : ${name || "—"}\nEmail : ${email || "—"}\n\nMessage :\n${message || ""}`,
    )}`;
    window.location.href = mailto;
    setSent(true);
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
          onSubmit={handleSubmit}
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
              <option value="">Choisir…</option>
              <option value="Demande de démo établissement">
                Demande de démo établissement
              </option>
              <option value="Question sur les tarifs">
                Question sur les tarifs
              </option>
              <option value="Support technique">Support technique</option>
              <option value="Partenariat">Partenariat</option>
              <option value="Autre">Autre</option>
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-primary-600 hover:shadow-md active:scale-[0.98] sm:w-auto sm:px-8"
          >
            <Send className="h-4 w-4" />
            {sent ? "Redirection vers votre client mail…" : "Envoyer"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Une fenêtre d’envoi d’email s’ouvrira. Sinon, écrivez à{" "}
          <a
            href="mailto:contact@correxia.fr"
            className="font-medium text-primary-600 hover:underline"
          >
            contact@correxia.fr
          </a>
          .
        </p>
      </div>
    </section>
  );
}
