"use client";

import type { ReactNode } from "react";
import { AdminSubscriptionStatusBadge } from "@/components/admin/AdminSubscriptionStatusBadge";
import {
  SelectableExportTable,
  type SelectableExportRow,
} from "@/components/ui/SelectableExportTable";

export type AdminSubscriptionsRow = SelectableExportRow & {
  plan_type: string;
  typeLabel: string;
  billing_period: string;
  status: string;
  priceEuros: string;
  startLabel: string;
  endLabel: string;
  createdLabel: string;
};

const exportColumns = [
  { key: "plan", header: "Plan" },
  { key: "type", header: "Type" },
  { key: "periode", header: "Durée (jours)" },
  { key: "statut", header: "Statut" },
  { key: "montant_eur", header: "Montant (€)" },
  { key: "debut", header: "Début" },
  { key: "fin", header: "Fin" },
  { key: "cree_le", header: "Créé le" },
];

export function AdminSubscriptionsTableClient({
  rows,
  toolbarLeft,
}: {
  rows: AdminSubscriptionsRow[];
  toolbarLeft: ReactNode;
}) {
  return (
    <SelectableExportTable<AdminSubscriptionsRow>
      rows={rows}
      exportColumns={exportColumns}
      fileBaseName="admin-abonnements"
      sheetName="Abonnements"
      minWidthClass="min-w-[900px]"
      toolbarLeft={toolbarLeft}
      headerCells={
        <>
          <th className="px-6 py-3">Plan</th>
          <th className="px-6 py-3">Type</th>
          <th className="px-6 py-3">Durée (jours)</th>
          <th className="px-6 py-3">Statut</th>
          <th className="px-6 py-3">Montant</th>
          <th className="px-6 py-3">Début</th>
          <th className="px-6 py-3">Fin</th>
          <th className="px-6 py-3">Créé le</th>
        </>
      }
      renderRow={({ row, selectCell }) => (
        <tr key={row.id} className="border-b border-gray-50 last:border-0">
          {selectCell}
          <td className="px-6 py-4 font-medium text-gray-900">{row.plan_type}</td>
          <td className="px-6 py-4 text-gray-600">{row.typeLabel}</td>
          <td className="px-6 py-4 text-gray-600">{row.billing_period}</td>
          <td className="px-6 py-4">
            <AdminSubscriptionStatusBadge status={row.status} />
          </td>
          <td className="px-6 py-4">
            <span className="font-semibold text-primary-500">{row.priceEuros} €</span>
          </td>
          <td className="px-6 py-4 text-gray-600">{row.startLabel}</td>
          <td className="px-6 py-4 text-gray-600">{row.endLabel}</td>
          <td className="px-6 py-4 text-gray-600">{row.createdLabel}</td>
        </tr>
      )}
    />
  );
}
