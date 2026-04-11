"use client";

import { useMemo, type ReactNode } from "react";
import { useRowSelection } from "@/hooks/useRowSelection";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { TableSelectCheckbox } from "@/components/ui/TableSelectCheckbox";
import type { ExportColumn } from "@/lib/export-table";

export type SelectableExportRow = {
  id: string;
  export: Record<string, unknown>;
};

type Props<T extends SelectableExportRow> = {
  rows: T[];
  exportColumns: ExportColumn[];
  fileBaseName: string;
  sheetName: string;
  disabled?: boolean;
  headerCells: ReactNode;
  renderRow: (ctx: {
    id: string;
    index: number;
    row: T;
    selectCell: ReactNode;
  }) => ReactNode;
  minWidthClass?: string;
  toolbarLeft?: ReactNode;
};

export function SelectableExportTable<T extends SelectableExportRow>({
  rows,
  exportColumns,
  fileBaseName,
  sheetName,
  disabled,
  headerCells,
  renderRow,
  minWidthClass = "min-w-[720px]",
  toolbarLeft,
}: Props<T>) {
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const {
    toggleOne,
    toggleAll,
    allSelected,
    someSelected,
    isSelected,
    getExportRows,
    selectedCount,
  } = useRowSelection(rowIds);

  const allExportRows = useMemo(
    () => rows.map((r) => ({ ...r.export, id: r.id })),
    [rows],
  );

  const exportRowsForButton = useMemo(
    () => getExportRows(allExportRows, "id"),
    [getExportRows, allExportRows],
  );

  const rowsWithoutId = useMemo(
    () => exportRowsForButton.map(({ id: _id, ...rest }) => rest) as Record<string, unknown>[],
    [exportRowsForButton],
  );

  const selectionHint =
    selectedCount > 0
      ? `${selectedCount} ligne(s) sélectionnée(s) · export ciblé`
      : `Aucune sélection · export de tout (${rows.length} ligne(s))`;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          {toolbarLeft}
          <span className="text-sm text-gray-600">{selectionHint}</span>
        </div>
        <ListExportButton
          fileBaseName={fileBaseName}
          sheetName={sheetName}
          columns={exportColumns}
          rows={rowsWithoutId}
          disabled={disabled || rows.length === 0}
        />
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-sm ${minWidthClass}`}>
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="w-11 px-3 py-3 text-center">
                <TableSelectCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  ariaLabel="Tout sélectionner"
                  disabled={disabled || rows.length === 0}
                />
              </th>
              {headerCells}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) =>
              renderRow({
                id: row.id,
                index,
                row,
                selectCell: (
                  <td key={`cb-${row.id}`} className="w-11 px-3 py-3 align-middle">
                    <div className="flex justify-center">
                      <TableSelectCheckbox
                        checked={isSelected(row.id)}
                        onChange={() => toggleOne(row.id)}
                        ariaLabel={`Sélectionner la ligne ${index + 1}`}
                        disabled={disabled}
                      />
                    </div>
                  </td>
                ),
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
