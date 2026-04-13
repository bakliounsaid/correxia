"use client";

import type { ReactNode } from "react";
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
  createdLabel: string;
};

const exportColumns = [
  { key: "nom", header: "Nom" },
  { key: "email", header: "Email" },
  { key: "ville", header: "Ville" },
  { key: "pays", header: "Pays" },
  { key: "statut_abo", header: "Statut abonnement" },
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
      minWidthClass="min-w-[720px]"
      toolbarLeft={toolbarLeft}
      headerCells={
        <>
          <th className="px-6 py-3">Nom</th>
          <th className="px-6 py-3">Email</th>
          <th className="px-6 py-3">Ville</th>
          <th className="px-6 py-3">Pays</th>
          <th className="px-6 py-3">Statut abo.</th>
          <th className="px-6 py-3">Créé le</th>
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
          <td className="px-6 py-4 text-gray-600">{row.createdLabel}</td>
        </tr>
      )}
    />
  );
}
