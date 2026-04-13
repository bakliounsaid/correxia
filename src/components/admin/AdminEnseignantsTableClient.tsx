"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  SelectableExportTable,
  type SelectableExportRow,
} from "@/components/ui/SelectableExportTable";

export type AdminEnseignantsRow = SelectableExportRow & {
  fullName: string;
  email: string;
  subject: string;
  planLabel: string;
  planBadgeClass: string;
  profilLabel: string;
  createdLabel: string;
};

const exportColumns = [
  { key: "nom", header: "Nom" },
  { key: "email", header: "Email" },
  { key: "matiere", header: "Matière" },
  { key: "plan", header: "Plan" },
  { key: "profil", header: "Profil" },
  { key: "inscrit_le", header: "Inscrit le" },
];

export function AdminEnseignantsTableClient({
  rows,
  toolbarLeft,
}: {
  rows: AdminEnseignantsRow[];
  toolbarLeft: ReactNode;
}) {
  return (
    <SelectableExportTable<AdminEnseignantsRow>
      rows={rows}
      exportColumns={exportColumns}
      fileBaseName="admin-enseignants"
      sheetName="Enseignants"
      minWidthClass="min-w-[760px]"
      toolbarLeft={toolbarLeft}
      headerCells={
        <>
          <th className="px-6 py-3">Nom</th>
          <th className="px-6 py-3">Email</th>
          <th className="px-6 py-3">Matière</th>
          <th className="px-6 py-3">Plan</th>
          <th className="px-6 py-3">Profil</th>
          <th className="px-6 py-3">Inscrit le</th>
        </>
      }
      renderRow={({ row, selectCell }) => (
        <tr key={row.id} className="border-b border-gray-50 last:border-0">
          {selectCell}
          <td className="px-6 py-4 font-medium text-gray-900">{row.fullName}</td>
          <td className="max-w-[200px] truncate px-6 py-4 text-gray-600">{row.email}</td>
          <td className="px-6 py-4 capitalize text-gray-600">{row.subject}</td>
          <td className="px-6 py-4">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                row.planBadgeClass,
              )}
            >
              {row.planLabel}
            </span>
          </td>
          <td className="px-6 py-4 text-gray-600">{row.profilLabel}</td>
          <td className="px-6 py-4 text-gray-600">{row.createdLabel}</td>
        </tr>
      )}
    />
  );
}
