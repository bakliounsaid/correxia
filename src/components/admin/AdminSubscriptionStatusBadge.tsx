import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  cancelled: "Annulé",
};

export function AdminSubscriptionStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const label = LABELS[key] ?? status;
  const styles =
    key === "active"
      ? "bg-success-50 text-success-600"
      : key === "paused"
        ? "bg-warning-50 text-warning-500"
        : key === "cancelled"
          ? "bg-error-50 text-error-600"
          : "bg-gray-100 text-gray-600";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles,
      )}
    >
      {label}
    </span>
  );
}
