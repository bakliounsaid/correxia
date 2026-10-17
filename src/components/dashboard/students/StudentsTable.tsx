"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { TableSelectCheckbox } from "@/components/ui/TableSelectCheckbox";
import type { StudentRow } from "@/lib/students-data";

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

type Props = {
  rows: StudentRow[];
  /** Colonne « Actions » (modifier / supprimer) affichée seulement si l'utilisateur gère les élèves. */
  canManage: boolean;
  /** Une action est en cours : sélection et actions bloquées. */
  busy: boolean;
  /** Modifier / supprimer indisponibles (action en cours ou aucune classe). */
  actionsDisabled: boolean;
  deletingId: string | null;
  selection: {
    allSelected: boolean;
    someSelected: boolean;
    isSelected: (id: string) => boolean;
    toggleOne: (id: string) => void;
    toggleAll: () => void;
  };
  onEdit: (student: StudentRow) => void;
  onDelete: (student: StudentRow) => void;
};

export function StudentsTable({ rows, canManage, busy, actionsDisabled, deletingId, selection, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="w-11 px-3 py-3 text-center">
                <TableSelectCheckbox
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  ariaLabel="Tout sélectionner"
                  disabled={busy || rows.length === 0}
                />
              </th>
              <th className="px-6 py-3">ID interne</th>
              <th className="px-6 py-3">Nom</th>
              <th className="px-6 py-3">Prénom</th>
              <th className="px-6 py-3">Classe</th>
              <th className="px-6 py-3">Ajouté le</th>
              {canManage && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0">
                <td className="w-11 px-3 py-4 align-middle">
                  <div className="flex justify-center">
                    <TableSelectCheckbox
                      checked={selection.isSelected(s.id)}
                      onChange={() => selection.toggleOne(s.id)}
                      ariaLabel={`Sélectionner ${s.last_name} ${s.first_name}`}
                      disabled={busy}
                    />
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-gray-800">{s.id_interne}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{s.last_name}</td>
                <td className="px-6 py-4 text-gray-700">{s.first_name}</td>
                <td className="px-6 py-4 text-gray-600">{s.class_name}</td>
                <td className="px-6 py-4 text-gray-500">{formatShortDate(s.created_at)}</td>
                {canManage && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Modifier"
                        aria-label={`Modifier ${s.last_name} ${s.first_name}`}
                        disabled={actionsDisabled}
                        onClick={() => onEdit(s)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600 disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Supprimer"
                        aria-label={`Supprimer ${s.last_name} ${s.first_name}`}
                        disabled={actionsDisabled}
                        onClick={() => onDelete(s)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
