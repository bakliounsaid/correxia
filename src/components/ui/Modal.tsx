"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/** Fenêtre modale standard : fond assombri, titre, bouton de fermeture. */
export function Modal({ title, description, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
