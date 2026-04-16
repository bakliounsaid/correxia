"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleUserRound, Download, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Button } from "@/components/ui/Button";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { TableSelectCheckbox } from "@/components/ui/TableSelectCheckbox";
import { useRowSelection } from "@/hooks/useRowSelection";
import { omitId } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  parseStudentsCsv,
  STUDENTS_CSV_EXAMPLE_CONTENT,
  STUDENTS_CSV_EXAMPLE_FILENAME,
} from "@/lib/students-csv";

export type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  id_interne: string;
  class_id: string;
  class_name: string;
  created_at: string;
};

type ClassOption = { id: string; name: string };

type Props = {
  initialStudents: StudentRow[];
  classOptions: ClassOption[];
  viewerTeacherId: string | null;
  insertSchoolId: string | null;
  isSchoolAdmin: boolean;
  emptyStateFooter?: ReactNode;
};

const IMPORT_CHUNK_SIZE = 100;

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeClassJoin(
  value: { name: string } | { name: string }[] | null | undefined,
): { name: string } | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function StudentsManager({
  initialStudents,
  classOptions,
  viewerTeacherId,
  insertSchoolId,
  isSchoolAdmin,
  emptyStateFooter,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialStudents);
  const [pendingAction, setPendingAction] = useState<"none" | "save" | "delete" | "import">("none");
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [modal, setModal] = useState<"none" | "add" | "edit" | "import">("none");
  const [editTarget, setEditTarget] = useState<StudentRow | null>(null);
  const [fFirst, setFFirst] = useState("");
  const [fLast, setFLast] = useState("");
  const [fIdInterne, setFIdInterne] = useState("");
  const [fClassId, setFClassId] = useState("");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ReturnType<typeof parseStudentsCsv> | null>(
    null,
  );

  useEffect(() => {
    setRows(initialStudents);
  }, [initialStudents]);

  function errMessage(err: unknown, fallback: string): string {
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: string }).message);
    }
    return fallback;
  }

  async function swalSuccess(text: string) {
    await Swal.fire({
      icon: "success",
      title: "Succès",
      text,
      timer: 1800,
      showConfirmButton: false,
    });
  }

  async function swalError(text: string) {
    await Swal.fire({
      icon: "error",
      title: "Erreur",
      text,
      confirmButtonText: "OK",
    });
  }

  function resetForm() {
    setFFirst("");
    setFLast("");
    setFIdInterne("");
    setFClassId(classOptions[0]?.id ?? "");
  }

  function closeModal() {
    setModal("none");
    setEditTarget(null);
    setImportPreview(null);
    setImportText("");
  }

  async function refreshList() {
    const supabase = getSupabaseBrowserClient();
    let classIds: string[] = [];
    if (isSchoolAdmin) {
      classIds = classOptions.map((c) => c.id);
    } else if (viewerTeacherId) {
      const { data: links } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("teacher_id", viewerTeacherId);
      classIds = (links ?? []).map((l) => l.class_id as string);
    }
    if (classIds.length === 0) {
      setRows([]);
      router.refresh();
      return;
    }
    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, id_interne, class_id, created_at, classes(name)")
      .in("class_id", classIds)
      .order("last_name", { ascending: true });
    if (!error && data) {
      setRows(
        data.map((s) => ({
          id: s.id as string,
          first_name: s.first_name as string,
          last_name: s.last_name as string,
          id_interne: (s.id_interne as string | null) ?? "",
          class_id: s.class_id as string,
          class_name: normalizeClassJoin(s.classes as { name: string } | { name: string }[] | null)?.name ?? "—",
          created_at: s.created_at as string,
        })),
      );
    }
    router.refresh();
  }

  function openAdd() {
    resetForm();
    setEditTarget(null);
    setModal("add");
  }

  function openEdit(s: StudentRow) {
    setEditTarget(s);
    setFFirst(s.first_name);
    setFLast(s.last_name);
    setFIdInterne(s.id_interne);
    setFClassId(s.class_id);
    setModal("edit");
  }

  async function onSubmitAddEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!fClassId) {
      await swalError("La classe est obligatoire.");
      return;
    }
    setPendingAction("save");
    try {
      const supabase = getSupabaseBrowserClient();
      const idTrim = fIdInterne.trim();
      if (modal === "add") {
        const insert: Record<string, unknown> = {
          school_id: insertSchoolId,
          first_name: fFirst.trim(),
          last_name: fLast.trim(),
          class_id: fClassId,
        };
        if (idTrim) insert.id_interne = idTrim;
        const { error } = await supabase.from("students").insert(insert);
        if (error) throw error;
        await swalSuccess("Élève ajouté.");
      } else if (modal === "edit" && editTarget) {
        const patch: Record<string, unknown> = {
          first_name: fFirst.trim(),
          last_name: fLast.trim(),
          class_id: fClassId,
          id_interne: idTrim || null,
        };
        const { error } = await supabase.from("students").update(patch).eq("id", editTarget.id);
        if (error) throw error;
        await swalSuccess("Élève mis à jour.");
      }
      closeModal();
      await refreshList();
    } catch (err: unknown) {
      await swalError(errMessage(err, "Enregistrement impossible."));
    } finally {
      setPendingAction("none");
    }
  }

  async function onDelete(s: StudentRow) {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Supprimer cet élève ?",
      text: `${s.first_name} ${s.last_name} (${s.id_interne})`,
      showCancelButton: true,
      confirmButtonText: "Oui, supprimer",
      cancelButtonText: "Annuler",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;
    setPendingAction("delete");
    setPendingRowId(s.id);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("students").delete().eq("id", s.id);
      if (error) throw error;
      await swalSuccess("Élève supprimé.");
      await refreshList();
    } catch (err: unknown) {
      await swalError(errMessage(err, "Suppression impossible."));
    } finally {
      setPendingAction("none");
      setPendingRowId(null);
    }
  }

  function downloadExampleCsv() {
    const blob = new Blob([STUDENTS_CSV_EXAMPLE_CONTENT], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = STUDENTS_CSV_EXAMPLE_FILENAME;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPickCsvFile(file: File | null) {
    setImportPreview(null);
    setImportText("");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const t = String(reader.result ?? "");
      setImportText(t);
      setImportPreview(parseStudentsCsv(t));
    };
    reader.readAsText(file, "UTF-8");
  }

  async function runImport() {
    const parsed = importPreview ?? parseStudentsCsv(importText);
    if (parsed.errors.length && !parsed.rows.length) {
      await swalError(parsed.errors.slice(0, 4).join(" "));
      return;
    }
    const classByName = new Map(classOptions.map((c) => [c.name.trim().toLowerCase(), c.id]));
    setPendingAction("import");
    const supabase = getSupabaseBrowserClient();
    let ok = 0;
    const rowErrors: string[] = [...parsed.errors];
    try {
      const payload: Array<Record<string, unknown>> = [];
      const payloadLineNumbers: number[] = [];

      for (let i = 0; i < parsed.rows.length; i++) {
        const r = parsed.rows[i];
        const classId = classByName.get((r.class_name ?? "").trim().toLowerCase());
        if (!classId) {
          rowErrors.push(
            `Ligne import ${i + 2} : classe introuvable dans l'établissement (${r.class_name}).`,
          );
          continue;
        }
        const insert: Record<string, unknown> = {
          school_id: insertSchoolId,
          first_name: r.first_name,
          last_name: r.last_name,
          class_id: classId,
        };
        if (r.id_interne) insert.id_interne = r.id_interne;
        payload.push(insert);
        payloadLineNumbers.push(i + 2);
      }

      for (let i = 0; i < payload.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = payload.slice(i, i + IMPORT_CHUNK_SIZE);
        const chunkLineNumbers = payloadLineNumbers.slice(i, i + IMPORT_CHUNK_SIZE);
        const { error } = await supabase.from("students").insert(chunk);
        if (error) {
          const firstLine = chunkLineNumbers[0];
          const lastLine = chunkLineNumbers[chunkLineNumbers.length - 1];
          rowErrors.push(`Lignes import ${firstLine}-${lastLine} : ${error.message}`);
          continue;
        }
        ok += chunk.length;
      }

      if (ok > 0) {
        const details = rowErrors.slice(0, 3).join(" | ");
        await Swal.fire({
          icon: rowErrors.length ? "warning" : "success",
          title: rowErrors.length ? "Import partiel" : "Import réussi",
          text: `${ok} élève(s) importé(s).${rowErrors.length ? ` Certaines lignes sont en erreur : ${details}` : ""}`,
          confirmButtonText: "OK",
        });
      }
      if (rowErrors.length && ok === 0) {
        await swalError(rowErrors.slice(0, 3).join(" "));
      }
      closeModal();
      await refreshList();
    } catch (err: unknown) {
      await swalError(errMessage(err, "Import impossible."));
    } finally {
      setPendingAction("none");
    }
  }

  const canMutate = classOptions.length > 0;
  const isAnyPending = pendingAction !== "none";

  const studentExportColumns = useMemo(
    () => [
      { key: "id_interne", header: "ID interne" },
      { key: "nom", header: "Nom" },
      { key: "prenom", header: "Prénom" },
      { key: "classe", header: "Classe" },
      { key: "date_ajout", header: "Ajouté le" },
    ],
    [],
  );

  const rowIds = useMemo(() => rows.map((s) => s.id), [rows]);
  const {
    toggleOne,
    toggleAll,
    allSelected,
    someSelected,
    isSelected,
    getExportRows,
    selectedCount,
  } = useRowSelection(rowIds);

  const studentExportRowsWithId = useMemo(
    () =>
      rows.map((s) => ({
        id: s.id,
        id_interne: s.id_interne,
        nom: s.last_name,
        prenom: s.first_name,
        classe: s.class_name,
        date_ajout: formatShortDate(s.created_at),
      })),
    [rows],
  );

  const studentExportRows = useMemo(() => {
    const picked = getExportRows(studentExportRowsWithId, "id");
    return picked.map((r) => omitId(r as Record<string, unknown>));
  }, [getExportRows, studentExportRowsWithId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" className="gap-2" disabled={!canMutate || isAnyPending} onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Ajouter un élève
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={!canMutate || isAnyPending}
          onClick={() => {
            setImportPreview(null);
            setImportText("");
            setModal("import");
          }}
        >
          <Upload className="h-4 w-4" />
          Importer CSV
        </Button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-gray-600">
            {selectedCount > 0
              ? `${selectedCount} sélectionné(s) · export ciblé`
              : `Export de tous (${rows.length})`}
          </span>
          <ListExportButton
            fileBaseName="eleves"
            sheetName="Élèves"
            columns={studentExportColumns}
            rows={studentExportRows}
            disabled={isAnyPending || rows.length === 0}
          />
        </div>
      </div>

      {!canMutate && (
        <p className="text-sm text-amber-800">
          Aucune classe disponible. Créez d&apos;abord des classes pour ajouter des élèves.
        </p>
      )}

      {rows.length === 0 ? (
        <DashboardEmptyState
          title="Aucun élève"
          message="Aucun élève enregistré pour le moment. Utilisez les boutons ci-dessus pour ajouter une fiche ou importer un CSV."
          icon={CircleUserRound}
          accentClass="border-t-ia-500"
        >
          {emptyStateFooter}
        </DashboardEmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="w-11 px-3 py-3 text-center">
                    <TableSelectCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                      ariaLabel="Tout sélectionner"
                      disabled={isAnyPending || rows.length === 0}
                    />
                  </th>
                  <th className="px-6 py-3">ID interne</th>
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Prénom</th>
                  <th className="px-6 py-3">Classe</th>
                  <th className="px-6 py-3">Ajouté le</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="w-11 px-3 py-4 align-middle">
                      <div className="flex justify-center">
                        <TableSelectCheckbox
                          checked={isSelected(s.id)}
                          onChange={() => toggleOne(s.id)}
                          ariaLabel={`Sélectionner ${s.last_name} ${s.first_name}`}
                          disabled={isAnyPending}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-800">{s.id_interne}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{s.last_name}</td>
                    <td className="px-6 py-4 text-gray-700">{s.first_name}</td>
                    <td className="px-6 py-4 text-gray-600">{s.class_name}</td>
                    <td className="px-6 py-4 text-gray-500">{formatShortDate(s.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Modifier"
                          disabled={isAnyPending || !canMutate}
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600 disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          disabled={isAnyPending || !canMutate}
                          onClick={() => void onDelete(s)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          {pendingAction === "delete" && pendingRowId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              onClick={closeModal}
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>

            {(modal === "add" || modal === "edit") && (
              <>
                <h2 className="text-lg font-semibold text-gray-900">{modal === "add" ? "Nouvel élève" : "Modifier l’élève"}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  ID interne optionnel : laisser vide pour générer automatiquement un code du type CIA-2026-001.
                </p>
                <form className="mt-4 space-y-3" onSubmit={onSubmitAddEdit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-800">Prénom *</label>
                      <input required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" value={fFirst} onChange={(e) => setFFirst(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-800">Nom *</label>
                      <input required className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" value={fLast} onChange={(e) => setFLast(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-800">ID interne (optionnel)</label>
                    <input
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm"
                      placeholder="Ex. CIA-2026-042 ou vide"
                      value={fIdInterne}
                      onChange={(e) => setFIdInterne(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-800">Classe *</label>
                    <select
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                      value={fClassId}
                      onChange={(e) => setFClassId(e.target.value)}
                    >
                      <option value="">Sélectionner la classe</option>
                      {classOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={closeModal} disabled={isAnyPending}>
                      Annuler
                    </Button>
                    <Button type="submit" variant="primary" loading={pendingAction === "save"} loadingText="Enregistrement…">
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </>
            )}

            {modal === "import" && (
              <>
                <h2 className="text-lg font-semibold text-gray-900">Importer des élèves (CSV)</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Colonnes : <strong>id_interne</strong> (facultatif), <strong>nom</strong>, <strong>prénom</strong>, <strong>classe</strong>.
                  La classe doit déjà exister dans l&apos;établissement.
                </p>
                <button
                  type="button"
                  onClick={downloadExampleCsv}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  <Download className="h-4 w-4" />
                  Télécharger un fichier CSV d’exemple
                </button>
                <div className="mt-4">
                  <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => onPickCsvFile(e.target.files?.[0] ?? null)} />
                </div>
                {importPreview && (
                  <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                    <p>
                      <strong>{importPreview.rows.length}</strong> ligne(s) prête(s) à importer.
                    </p>
                    {importPreview.errors.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-amber-800">
                        {importPreview.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeModal} disabled={isAnyPending}>
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={pendingAction === "import"}
                    loadingText="Import…"
                    disabled={!importPreview?.rows.length || !classOptions.length}
                    onClick={() => void runImport()}
                  >
                    Lancer l’import
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

