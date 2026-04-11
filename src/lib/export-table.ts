import * as XLSX from "xlsx";

export type ExportColumn = { key: string; header: string };

function sanitizeFileBase(name: string): string {
  const s = name.replace(/[/\\?*[\]:]/g, "-").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  return s || "export";
}

function cellValue(v: unknown): string | number | boolean {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v;
  return String(v);
}

export function downloadExcel(
  sheetName: string,
  fileBase: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): void {
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((row) => columns.map((c) => cellValue(row[c.key])));
  const aoa = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  const safeSheet = sheetName.replace(/[/\\?*[\]]/g, "").slice(0, 31) || "Feuille1";
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  XLSX.writeFile(wb, `${sanitizeFileBase(fileBase)}.xlsx`);
}
