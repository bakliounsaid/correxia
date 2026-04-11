"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";
import { downloadExcel, type ExportColumn } from "@/lib/export-table";
import { Button } from "@/components/ui/Button";

type Props = {
  fileBaseName: string;
  sheetName: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  disabled?: boolean;
  className?: string;
  label?: string;
};

export function ListExportButton({
  fileBaseName,
  sheetName,
  columns,
  rows,
  disabled,
  className,
  label = "Exporter",
}: Props) {
  const onClick = useCallback(() => {
    downloadExcel(sheetName, fileBaseName, columns, rows);
  }, [fileBaseName, sheetName, columns, rows]);

  return (
    <Button
      type="button"
      variant="outline"
      className={className ? `border-gray-200 ${className}` : "border-gray-200"}
      disabled={disabled || rows.length === 0}
      onClick={onClick}
      title="Télécharger la liste au format Excel (.xlsx)"
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
