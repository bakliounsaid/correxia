"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import {
  SelectableExportTable,
  type SelectableExportRow,
} from "@/components/ui/SelectableExportTable";

export type ArchiveTableRow = SelectableExportRow & {
  title: string;
  subjectLabel: string;
  level: string;
  dateStr: string;
  copiesGen: number;
  copiesCorr: number;
};

const archiveExportColumns = [
  { key: "titre", header: "Évaluation" },
  { key: "matiere", header: "Matière" },
  { key: "niveau", header: "Niveau" },
  { key: "cloturee_le", header: "Clôturée le" },
  { key: "copies", header: "Copies" },
  { key: "corrigees", header: "Corrigées" },
];

export function ArchivesTableClient({ rows }: { rows: ArchiveTableRow[] }) {
  return (
    <SelectableExportTable<ArchiveTableRow>
      rows={rows}
      exportColumns={archiveExportColumns}
      fileBaseName="archives-evaluations"
      sheetName="Archives"
      minWidthClass="min-w-[900px]"
      headerCells={
        <>
          <th className="px-6 py-4">Évaluation</th>
          <th className="px-6 py-4">Niveau</th>
          <th className="px-6 py-4">Clôturée le</th>
          <th className="px-6 py-4">Copies</th>
          <th className="px-6 py-4">Corrigées</th>
          <th className="px-6 py-4">Actions</th>
        </>
      }
      renderRow={({ row, selectCell }) => (
        <tr key={row.id} className="border-b border-gray-50 last:border-0">
          {selectCell}
          <td className="px-6 py-4">
            <p className="font-medium text-gray-900">{row.title}</p>
            <p className="text-xs text-gray-500">{row.subjectLabel}</p>
          </td>
          <td className="px-6 py-4 text-gray-600">{row.level}</td>
          <td className="px-6 py-4 text-gray-600">{row.dateStr}</td>
          <td className="px-6 py-4 text-gray-600">{row.copiesGen}</td>
          <td className="px-6 py-4">
            <span className="font-semibold text-primary-500">{row.copiesCorr}</span>
          </td>
          <td className="px-6 py-4">
            <Link
              href={`/dashboard/evaluations/${row.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              <Eye className="h-3.5 w-3.5" />
              Voir
            </Link>
          </td>
        </tr>
      )}
    />
  );
}
