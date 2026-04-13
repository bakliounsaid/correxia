import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Retire `id` pour l’export tableur sans variable ESLint « unused ». */
export function omitId(row: Record<string, unknown>): Record<string, unknown> {
  const next = { ...row };
  delete next.id;
  return next;
}
