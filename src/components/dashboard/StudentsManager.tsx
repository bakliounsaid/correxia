"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { CircleUserRound, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { StudentFormModal } from "@/components/dashboard/students/StudentFormModal";
import { type ParsedStudentsCsv, StudentsImportModal } from "@/components/dashboard/students/StudentsImportModal";
import { formatShortDate, StudentsTable } from "@/components/dashboard/students/StudentsTable";
import { Button } from "@/components/ui/Button";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { useRowSelection } from "@/hooks/useRowSelection";
import { errorMessage } from "@/lib/error-message";
import {
  deleteStudent,
  fetchStudentsOfClasses,
  fetchTeacherClassIds,
  insertStudent,
  insertStudentsInChunks,
  type StudentFields,
  type StudentRow,
  updateStudent,
} from "@/lib/students-data";
import { buildStudentInserts, importResult } from "@/lib/students-import";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { omitId } from "@/lib/utils";

export type { StudentRow } from "@/lib/students-data";

type ClassOption = { id: string; name: string };

type Props = {
  initialStudents: StudentRow[];
  classOptions: ClassOption[];
  viewerTeacherId: string | null;
  insertSchoolId: string | null;
  isSchoolAdmin: boolean;
  /** false = enseignant rattaché à un établissement : élèves gérés par l'établissement (lecture seule). */
  canManage: boolean;
  emptyStateFooter?: ReactNode;
};

type ModalState = { kind: "none" } | { kind: "form"; student: StudentRow | null } | { kind: "import" };

const EXPORT_COLUMNS = [
  { key: "id_interne", header: "ID interne" },
  { key: "nom", header: "Nom" },
  { key: "prenom", header: "Prénom" },
  { key: "classe", header: "Classe" },
  { key: "date_ajout", header: "Ajouté le" },
];

async function showSuccess(text: string) {
  await Swal.fire({ icon: "success", title: "Succès", text, timer: 1800, showConfirmButton: false });
}

async function showError(text: string) {
  await Swal.fire({ icon: "error", title: "Erreur", text, confirmButtonText: "OK" });
}

/** Liste des élèves : ajout, modification, suppression, import CSV et export. */
export function StudentsManager({
  initialStudents,
  classOptions,
  viewerTeacherId,
  insertSchoolId,
  isSchoolAdmin,
  canManage,
  emptyStateFooter,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialStudents);
  const [pending, setPending] = useState<"none" | "save" | "delete" | "import">("none");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  useEffect(() => {
    setRows(initialStudents);
  }, [initialStudents]);

  const canMutate = canManage && classOptions.length > 0;
  const busy = pending !== "none";
  const closeModal = () => setModal({ kind: "none" });

  async function refreshList() {
    const supabase = getSupabaseBrowserClient();
    const classIds = isSchoolAdmin
      ? classOptions.map((c) => c.id)
      : viewerTeacherId
        ? await fetchTeacherClassIds(supabase, viewerTeacherId)
        : [];
    try {
      setRows(await fetchStudentsOfClasses(supabase, classIds));
    } catch {
      // Liste conservée telle quelle si le rechargement échoue ; router.refresh() resynchronise la page.
    }
    router.refresh();
  }

  async function saveStudent(student: StudentRow | null, fields: StudentFields) {
    if (!fields.class_id) {
      await showError("La classe est obligatoire.");
      return;
    }
    setPending("save");
    try {
      const supabase = getSupabaseBrowserClient();
      if (student) {
        await updateStudent(supabase, student.id, fields);
        await showSuccess("Élève mis à jour.");
      } else {
        await insertStudent(supabase, insertSchoolId, fields);
        await showSuccess("Élève ajouté.");
      }
      closeModal();
      await refreshList();
    } catch (err) {
      await showError(errorMessage(err, "Enregistrement impossible."));
    } finally {
      setPending("none");
    }
  }

  async function removeStudent(student: StudentRow) {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Supprimer cet élève ?",
      text: `${student.first_name} ${student.last_name} (${student.id_interne})`,
      showCancelButton: true,
      confirmButtonText: "Oui, supprimer",
      cancelButtonText: "Annuler",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;
    setPending("delete");
    setDeletingId(student.id);
    try {
      await deleteStudent(getSupabaseBrowserClient(), student.id);
      await showSuccess("Élève supprimé.");
      await refreshList();
    } catch (err) {
      await showError(errorMessage(err, "Suppression impossible."));
    } finally {
      setPending("none");
      setDeletingId(null);
    }
  }

  async function importStudents(parsed: ParsedStudentsCsv) {
    if (parsed.errors.length && !parsed.rows.length) {
      await showError(parsed.errors.slice(0, 4).join(" "));
      return;
    }
    setPending("import");
    try {
      const { inserts, errors: classErrors } = buildStudentInserts(parsed.rows, classOptions, insertSchoolId);
      const { imported, errors: insertErrors } = await insertStudentsInChunks(getSupabaseBrowserClient(), inserts);
      const result = importResult(imported, [...parsed.errors, ...classErrors, ...insertErrors]);
      if (imported > 0 || result.text) await Swal.fire({ ...result, confirmButtonText: "OK" });
      closeModal();
      await refreshList();
    } catch (err) {
      await showError(errorMessage(err, "Import impossible."));
    } finally {
      setPending("none");
    }
  }

  const rowIds = useMemo(() => rows.map((s) => s.id), [rows]);
  const selection = useRowSelection(rowIds);
  const { getExportRows } = selection;
  const exportRows = useMemo(() => {
    const withIds = rows.map((s) => ({
      id: s.id,
      id_interne: s.id_interne,
      nom: s.last_name,
      prenom: s.first_name,
      classe: s.class_name,
      date_ajout: formatShortDate(s.created_at),
    }));
    return getExportRows(withIds, "id").map((r) => omitId(r as Record<string, unknown>));
  }, [rows, getExportRows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button
              type="button"
              variant="primary"
              className="gap-2"
              disabled={!canMutate || busy}
              onClick={() => setModal({ kind: "form", student: null })}
            >
              <Plus className="h-4 w-4" />
              Ajouter un élève
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={!canMutate || busy}
              onClick={() => setModal({ kind: "import" })}
            >
              <Upload className="h-4 w-4" />
              Importer CSV
            </Button>
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-gray-600">
            {selection.selectedCount > 0
              ? `${selection.selectedCount} sélectionné(s) · export ciblé`
              : `Export de tous (${rows.length})`}
          </span>
          <ListExportButton
            fileBaseName="eleves"
            sheetName="Élèves"
            columns={EXPORT_COLUMNS}
            rows={exportRows}
            disabled={busy || rows.length === 0}
          />
        </div>
      </div>

      {!canManage ? (
        <p className="text-sm text-gray-600">Vos classes et vos élèves sont gérés par votre établissement.</p>
      ) : (
        !canMutate && (
          <p className="text-sm text-amber-800">
            Aucune classe disponible. Créez d&apos;abord des classes pour ajouter des élèves.
          </p>
        )
      )}

      {rows.length === 0 ? (
        <DashboardEmptyState
          title="Aucun élève"
          message={
            canManage
              ? "Aucun élève enregistré pour le moment. Utilisez les boutons ci-dessus pour ajouter une fiche ou importer un CSV."
              : "Aucun élève enregistré pour le moment. Votre établissement les ajoutera à vos classes."
          }
          icon={CircleUserRound}
          accentClass="border-t-ia-500"
        >
          {emptyStateFooter}
        </DashboardEmptyState>
      ) : (
        <StudentsTable
          rows={rows}
          canManage={canManage}
          busy={busy}
          actionsDisabled={busy || !canMutate}
          deletingId={pending === "delete" ? deletingId : null}
          selection={selection}
          onEdit={(student) => setModal({ kind: "form", student })}
          onDelete={(student) => void removeStudent(student)}
        />
      )}

      {modal.kind === "form" && (
        <StudentFormModal
          student={modal.student}
          classOptions={classOptions}
          saving={pending === "save"}
          onCancel={closeModal}
          onSubmit={(fields) => void saveStudent(modal.student, fields)}
        />
      )}
      {modal.kind === "import" && (
        <StudentsImportModal
          importing={pending === "import"}
          hasClasses={classOptions.length > 0}
          onCancel={closeModal}
          onImport={(parsed) => void importStudents(parsed)}
        />
      )}
    </div>
  );
}
