"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { AdminSubscriptionStatusBadge } from "@/components/admin/AdminSubscriptionStatusBadge";
import {
  SelectableExportTable,
  type SelectableExportRow,
} from "@/components/ui/SelectableExportTable";

export type AdminRecentSubRow = SelectableExportRow & {
  plan_type: string;
  billing_period: string;
  status: string;
  priceEuros: string;
  createdLabel: string;
};

const exportColumns = [
  { key: "plan", header: "Plan" },
  { key: "periode", header: "Période" },
  { key: "statut", header: "Statut" },
  { key: "montant_eur", header: "Montant (€)" },
  { key: "cree_le", header: "Créé le" },
];

export function AdminRecentSubscriptionsTableClient({
  rows,
  toolbarLeft,
}: {
  rows: AdminRecentSubRow[];
  toolbarLeft: ReactNode;
}) {
  return (
    <SelectableExportTable<AdminRecentSubRow>
      rows={rows}
      exportColumns={exportColumns}
      fileBaseName="admin-abonnements-recents"
      sheetName="Abonnements"
      minWidthClass="min-w-[720px]"
      toolbarLeft={toolbarLeft}
      headerCells={
        <>
          <th className="px-6 py-3">Plan</th>
          <th className="px-6 py-3">Période</th>
          <th className="px-6 py-3">Statut</th>
          <th className="px-6 py-3">Montant</th>
          <th className="px-6 py-3">Créé le</th>
          <th className="px-6 py-3">Action</th>
        </>
      }
      renderRow={({ row, selectCell }) => (
        <tr key={row.id} className="border-b border-gray-50 last:border-0">
          {selectCell}
          <td className="px-6 py-4 font-medium text-gray-900">{row.plan_type}</td>
          <td className="px-6 py-4 text-gray-600">{row.billing_period}</td>
          <td className="px-6 py-4">
            <AdminSubscriptionStatusBadge status={row.status} />
          </td>
          <td className="px-6 py-4">
            <span className="font-semibold text-primary-500">{row.priceEuros} €</span>
          </td>
          <td className="px-6 py-4 text-gray-600">{row.createdLabel}</td>
          <td className="px-6 py-4">
            <Link
              href="/admin/subscriptions"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-600"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              Détails
            </Link>
          </td>
        </tr>
      )}
    />
  );
}
