"use client";

import Link from "next/link";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
};

export function RgpdConsentCheckbox({
  id,
  checked,
  onCheckedChange,
  error,
}: Props) {
  return (
    <div>
      <div
        className={cn(
          "flex gap-3 rounded-xl border bg-gray-50/80 p-4",
          error ? "border-error-400 ring-2 ring-error-100" : "border-gray-200",
        )}
      >
        <input
          id={id}
          name="rgpdConsent"
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor={id} className="text-sm leading-snug text-gray-700">
          <span className="font-semibold text-gray-900">*</span> J’accepte la
          collecte et le traitement de mes données personnelles nécessaires à la
          création et à la gestion de mon compte, conformément à la{" "}
          <Link
            href="/#faq"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 underline hover:text-primary-700"
          >
            politique de confidentialité
          </Link>{" "}
          et au RGPD.
        </label>
      </div>
      <div id={`${id}-error`}>
        <FieldError message={error} />
      </div>
    </div>
  );
}
