import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "error" | "warning" | "info" | "success";

const variantClass: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-primary-200 bg-primary-50 text-primary-900",
  success: "border-success-200 bg-success-50 text-gray-800",
};

type Props = {
  variant: AlertVariant;
  children: ReactNode;
  className?: string;
  /** Par défaut : alert pour error, status pour le reste (accessibilité) */
  role?: "alert" | "status";
};

/**
 * Alerte inline harmonisée pour tout le projet (formulaires, dashboard, etc.).
 */
export function AlertMessage({
  variant,
  children,
  className,
  role,
}: Props) {
  const r = role ?? (variant === "error" ? "alert" : "status");
  return (
    <div
      role={r}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        variantClass[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Surlignage des noms de variables / commandes dans les alertes */
export function ConfigCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-gray-200/90 px-1 py-0.5 font-mono text-[0.85em] text-gray-900">
      {children}
    </code>
  );
}
