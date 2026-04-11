import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  message: string;
  icon: LucideIcon;
  /** Bordure supérieure accent (ex. border-t-primary-500) */
  accentClass?: string;
  children?: React.ReactNode;
};

/**
 * Carte vide grande, centrée (classes, évaluations, archives, élèves).
 */
export function DashboardEmptyState({
  title,
  message,
  icon: Icon,
  accentClass = "border-t-primary-500",
  children,
}: Props) {
  return (
    <div className="flex w-full items-start justify-center px-4 py-0">
      <article
        className={cn(
          "w-full max-w-2xl rounded-2xl border border-gray-200 border-t-4 bg-white px-6 py-14 text-center shadow-card sm:px-10 sm:py-20",
          accentClass,
        )}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-400 sm:mb-8 sm:h-24 sm:w-24">
          <Icon className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-gray-500 sm:text-base">
          {message}
        </p>
        {children ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
        ) : null}
      </article>
    </div>
  );
}
