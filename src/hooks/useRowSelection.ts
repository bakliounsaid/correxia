import { useCallback, useEffect, useMemo, useState } from "react";

function rowIdKey(id: unknown): string {
  return String(id);
}

/**
 * Sélection de lignes pour tableaux + export.
 * Les id sont normalisés en string (évite décalage en-tête / lignes si Supabase renvoie un type ambigu).
 * La clé `idsKey` stabilise le Set quand le tableau `validIds` change de référence sans changer le contenu.
 */
export function useRowSelection(validIds: readonly string[]) {
  const idsKey = useMemo(
    () => validIds.map(rowIdKey).join("\u0001"),
    [validIds],
  );
  const normalizedIds = useMemo(() => validIds.map(rowIdKey), [idsKey]);
  const validSet = useMemo(() => new Set(normalizedIds), [normalizedIds]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of Array.from(prev)) {
        if (validSet.has(id)) next.add(id);
      }
      return next;
    });
  }, [validSet]);

  const toggleOne = useCallback((id: string) => {
    const key = rowIdKey(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const everyRowSelected =
        normalizedIds.length > 0 && normalizedIds.every((id) => prev.has(id));
      if (everyRowSelected) return new Set<string>();
      return new Set(normalizedIds);
    });
  }, [normalizedIds]);

  const allSelected =
    normalizedIds.length > 0 && normalizedIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;
  const selectedCount = selectedIds.size;

  const isSelected = useCallback(
    (id: string) => selectedIds.has(rowIdKey(id)),
    [selectedIds],
  );

  const getExportRows = useCallback(
    (allRows: Record<string, unknown>[], idKey = "id" as const) => {
      if (selectedIds.size === 0) return allRows;
      return allRows.filter((row) => {
        const rid = row[idKey];
        return selectedIds.has(rowIdKey(rid));
      });
    },
    [selectedIds],
  );

  return {
    toggleOne,
    toggleAll,
    allSelected,
    someSelected,
    selectedCount,
    isSelected,
    getExportRows,
  };
}
