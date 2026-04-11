"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SelectableExportTable,
  type SelectableExportRow,
} from "@/components/ui/SelectableExportTable";

export type AdminEcolesRow = SelectableExportRow & {
  name: string;
  email: string | null;
  city: string | null;
  country: string | null;
  statusLabel: string;
  statusBadgeClass: string;
  stripeYes: boolean;
  createdLabel: string;
};

const exportColumns = [
  { key: "nom", header: "Nom" },
  { key: "email", header: "Email" },
  { key: "ville", header: "Ville" },
  { key: "pays", header: "Pays" },
  { key: "statut_abo", header: "Statut abonnement" },
  { key: "stripe", header: "Stripe" },
  { key: "cree_le", header: "Créé le" },
];

export function AdminEcolesTableClient({
  rows,
  toolbarLeft,
}: {
  rows: AdminEcolesRow[];
  toolbarLeft: ReactNode;
}) {
  return (
    <SelectableExportTable<AdminEcolesRow>
      rows={rows}
      exportColumns={exportColumns}
      fileBaseName="admin-ecoles"
      sheetName="Écoles"
      minWidthClass="min-w-[920px]"
      toolbarLeft={toolbarLeft}
      headerCells={
        <>
          <th className="px-6 py-3">Nom</th>
          <th className="px-6 py-3">Email</th>
          <th className="px-6 py-3">Ville</th>
          <th className="px-6 py-3">Pays</th>
          <th className="px-6 py-3">Statut abo.</th>
          <th className="px-6 py-3">Stripe</th>
          <th className="px-6 py-3">Créé le</th>
          <th className="px-6 py-3">Action</th>
        </>
      }
      renderRow={({ row, selectCell }) => (
        <tr key={row.id} className="border-b border-gray-50 last:border-0">
          {selectCell}
          <td className="px-6 py-4 font-medium text-gray-900">{row.name}</td>
          <td className="max-w-[180px] truncate px-6 py-4 text-gray-600">{row.email ?? "—"}</td>
          <td className="px-6 py-4 text-gray-600">{row.city ?? "—"}</td>
          <td className="px-6 py-4 text-gray-600">{row.country ?? "—"}</td>
          <td className="px-6 py-4">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                row.statusBadgeClass,
              )}
            >
              {row.statusLabel}
            </span>
          </td>
          <td className="px-6 py-4">
            {row.stripeYes ? (
              <span className="font-mono text-xs text-primary-500">Oui</span>
            ) : (
              <span className="text-gray-400">Non</span>
            )}
          </td>
          <td className="px-6 py-4 text-gray-600">{row.createdLabel}</td>
          <td className="px-6 py-4">
            <Link
              href="/admin/subscriptions"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-600"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              Abonnements
            </Link>
          </td>
        </tr>
      )}
    />
  );
}
