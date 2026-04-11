"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { TableSelectCheckbox } from "@/components/ui/TableSelectCheckbox";
import { useRowSelection } from "@/hooks/useRowSelection";

export type EvaluationRow = {
  id: string;
  title: string;
  subject: string;
  level: string;
  class_name?: string | null;
  status: string;
  created_at: string;
  copies_generated: number | null;
  copies_corrected: number | null;
  copies_submitted: number | null;
  total_points: number | null;
};

function subjectLabelFr(subject: string): string {
  const map: Record<string, string> = {
    math: "Mathématiques",
    physics: "Physique",
    science: "Sciences",
  };
  return map[(subject || "").toLowerCase()] ?? subject;
}

type Props = {
  initialRows: EvaluationRow[];
};

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "created") return "bg-blue-50 text-blue-700";
  if (s === "in_progress") return "bg-amber-50 text-amber-700";
  if (s === "completed") return "bg-emerald-50 text-emerald-700";
  if (s === "draft") return "bg-violet-50 text-violet-700";
  return "bg-gray-100 text-gray-700";
}

function statusLabelFr(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "created") return "Créée";
  if (s === "in_progress") return "En cours";
  if (s === "completed") return "Terminée";
  if (s === "draft") return "Brouillon";
  if (s === "pending_review") return "En attente de revue";
  return status || "—";
}

export function EvaluationsManager({ initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function onDelete(row: EvaluationRow) {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Supprimer cette évaluation ?",
      text: row.title,
      showCancelButton: true,
      confirmButtonText: "Oui, supprimer",
      cancelButtonText: "Annuler",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;
    setPendingDeleteId(row.id);
    try {
      const res = await fetch(`/api/dashboard/evaluations/${row.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Suppression impossible.");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      await Swal.fire({
        icon: "success",
        title: "Évaluation supprimée",
        timer: 1200,
        showConfirmButton: false,
      });
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Suppression impossible.",
      });
    } finally {
      setPendingDeleteId(null);
    }
  }

  const evaluationExportColumns = useMemo(
    () => [
      { key: "titre", header: "Titre" },
      { key: "matiere", header: "Matière" },
      { key: "classe", header: "Classe" },
      { key: "date", header: "Date" },
      { key: "statut", header: "Statut" },
      { key: "copies_generees", header: "Copies générées" },
      { key: "copies_corrigees", header: "Copies corrigées" },
      { key: "copies_deposees", header: "Copies déposées" },
      { key: "bareme", header: "Barème (pts)" },
    ],
    [],
  );

  const rowIds = useMemo(() => rows.map((e) => e.id), [rows]);
  const {
    toggleOne,
    toggleAll,
    allSelected,
    someSelected,
    isSelected,
    getExportRows,
    selectedCount,
  } = useRowSelection(rowIds);

  const evaluationExportRowsWithId = useMemo(
    () =>
      rows.map((e) => ({
        id: e.id,
        titre: e.title,
        matiere: subjectLabelFr(e.subject),
        classe: e.class_name ?? "",
        date: formatShortDate(e.created_at),
        statut: statusLabelFr(e.status),
        copies_generees: e.copies_generated ?? 0,
        copies_corrigees: e.copies_corrected ?? 0,
        copies_deposees: e.copies_submitted ?? 0,
        bareme: e.total_points ?? "",
      })),
    [rows],
  );

  const evaluationExportRows = useMemo(() => {
    const picked = getExportRows(evaluationExportRowsWithId, "id");
    return picked.map(({ id: _id, ...r }) => r) as Record<string, unknown>[];
  }, [getExportRows, evaluationExportRowsWithId]);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
          <span className="mr-auto text-sm text-gray-600">
            {selectedCount > 0
              ? `${selectedCount} sélectionné(s) · export ciblé`
              : `Export de tous (${rows.length})`}
          </span>
          <ListExportButton
            fileBaseName="evaluations"
            sheetName="Évaluations"
            columns={evaluationExportColumns}
            rows={evaluationExportRows}
            disabled={pendingDeleteId != null || rows.length === 0}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="w-11 px-3 py-3 text-center">
                  <TableSelectCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    ariaLabel="Tout sélectionner"
                    disabled={pendingDeleteId !== null || rows.length === 0}
                  />
                </th>
                <th className="px-6 py-3">Titre</th>
                <th className="px-6 py-3">Matière</th>
                <th className="px-6 py-3">Classe</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                return (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    onClick={() => router.push(`/dashboard/evaluations/${e.id}`)}
                  >
                    <td
                      className="w-11 px-3 py-4 align-middle"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <div className="flex justify-center">
                        <TableSelectCheckbox
                          checked={isSelected(e.id)}
                          onChange={() => toggleOne(e.id)}
                          ariaLabel={`Sélectionner ${e.title}`}
                          disabled={pendingDeleteId !== null}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{e.title}</td>
                    <td className="px-6 py-4 text-gray-700">{subjectLabelFr(e.subject)}</td>
                    <td className="px-6 py-4 text-gray-700">{e.class_name || e.level}</td>
                    <td className="px-6 py-4 text-gray-600">{formatShortDate(e.created_at)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(e.status)}`}
                      >
                        {statusLabelFr(e.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Ouvrir le détail"
                          disabled={pendingDeleteId !== null}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            router.push(`/dashboard/evaluations/${e.id}`);
                          }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600 disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          disabled={pendingDeleteId !== null}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void onDelete(e);
                          }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          {pendingDeleteId === e.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

