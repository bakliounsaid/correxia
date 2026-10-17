"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Download, Play, RotateCcw, Upload } from "lucide-react";
import { StudentPickerModal, type StudentOption } from "@/components/dashboard/start-test/StudentPickerModal";
import { Button } from "@/components/ui/Button";
import {
  type CopyUploadTarget,
  importSummary,
  indexCopiesByQr,
  resolveSheetTarget,
  SHEET_ERRORS,
} from "@/lib/answer-sheets";
import { backendFetch } from "@/lib/backend";
import { alertError, errorMessage, readApiJson } from "@/lib/error-message";
import {
  type AnswerSheetCopy,
  type AnswerSheetTest,
  downloadAnswerSheetsPdf,
  downloadCorrectionTemplatePdf,
} from "@/lib/evaluation-pdf";
import { decodeQrFromImageFile } from "@/lib/qr-scan";
import { getCurrentTeacher, safeStorageName, uploadToTestsBucket } from "@/lib/storage-upload";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  evaluationId: string;
  status: string;
  hasCorrectionFile: boolean;
  /** Nombre de copies élèves générées pour ce test */
  copyCount: number;
  /** Au moins une copie a une feuille déposée (scan) */
  hasDepositedCopy: boolean;
  /** Toutes les copies avec scan ont une note validée par l'enseignant */
  allDepositedCopiesValidated?: boolean;
  evaluationTitle: string;
  classLabel: string;
  durationMinutes?: number | null;
  questions?: unknown;
};

/** Actions d'une évaluation : correction type, lancement de l'examen, dépôt des feuilles, correction IA. */
function StartTestButtonInner({
  evaluationId,
  status,
  hasCorrectionFile,
  copyCount,
  hasDepositedCopy,
  allDepositedCopiesValidated = false,
  evaluationTitle,
  classLabel,
  durationMinutes,
  questions,
}: Props) {
  const router = useRouter();
  const normalizedStatus = (status || "").toLowerCase();
  /** Trame + upload / remplacement de la correction type : tant que l’évaluation n’est pas terminée. */
  const isEditable = normalizedStatus === "created" || normalizedStatus === "in_progress";
  const [hasLocalCorrectionFile, setHasLocalCorrectionFile] = useState(hasCorrectionFile);
  const showStartExam = normalizedStatus === "created" && copyCount === 0;
  const showDepositSheets = isEditable && copyCount > 0;
  const showLaunchCorrection =
    isEditable && hasLocalCorrectionFile && hasDepositedCopy && !allDepositedCopiesValidated;

  const correctionInputRef = useRef<HTMLInputElement | null>(null);
  const answerSheetsInputRef = useRef<HTMLInputElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<
    "none" | "start" | "template" | "correction" | "sheets" | "reset" | "ai"
  >("none");

  useEffect(() => {
    setHasLocalCorrectionFile(hasCorrectionFile);
  }, [hasCorrectionFile]);

  async function openStudentPicker() {
    setPickerOpen(true);
    setLoadingStudents(true);
    try {
      const res = await backendFetch(`/evaluations/${evaluationId}/start`);
      const data = await readApiJson<{ students?: StudentOption[] }>(res, "Chargement impossible.");
      const rows = data.students ?? [];
      setStudents(rows);
      setSelectedIds(rows.map((s) => s.id));
    } catch (err) {
      setPickerOpen(false);
      await alertError(err, "Chargement impossible.");
    } finally {
      setLoadingStudents(false);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  }

  async function startExam() {
    if (selectedIds.length === 0) {
      await Swal.fire({ icon: "warning", title: "Sélection requise", text: "Sélectionnez au moins un élève." });
      return;
    }
    setBusy("start");
    try {
      const res = await backendFetch(`/evaluations/${evaluationId}/start`, {
        method: "POST",
        body: JSON.stringify({ studentIds: selectedIds }),
      });
      const data = await readApiJson<{
        created?: number;
        already_exists?: number;
        test?: AnswerSheetTest;
        copies?: AnswerSheetCopy[];
      }>(res, "Impossible de démarrer le test.");
      if (data.test && data.copies?.length) await downloadAnswerSheetsPdf(data.test, data.copies);

      setPickerOpen(false);
      await Swal.fire({
        icon: "success",
        title: "Feuilles de réponses prêtes",
        text: `${data.created ?? 0} copie(s) créée(s), ${data.already_exists ?? 0} déjà existante(s). Les feuilles de réponses ont été téléchargées.`,
        confirmButtonText: "Parfait",
      });
      router.refresh();
    } catch (err) {
      await alertError(err, "Impossible de démarrer le test.");
    } finally {
      setBusy("none");
    }
  }

  async function runAiCorrection() {
    setBusy("ai");
    try {
      const res = await backendFetch(`/evaluations/${evaluationId}/correct`, { method: "POST" });
      const data = await readApiJson<{ corrected?: number; total?: number; failures?: string[] }>(
        res,
        "Correction IA impossible.",
      );
      const failures = data.failures ?? [];
      await Swal.fire({
        icon: failures.length ? "warning" : "success",
        title: failures.length ? "Correction partielle" : "Correction terminée",
        text: `${data.corrected ?? 0}/${data.total ?? 0} copie(s) corrigée(s).${
          failures.length ? ` Erreurs: ${failures.slice(0, 2).join(" | ")}` : ""
        }`,
      });
      router.refresh();
    } catch (err) {
      await alertError(err, "Correction IA impossible.");
    } finally {
      setBusy("none");
    }
  }

  async function uploadCorrectionFile(file: File | null) {
    if (!file) return;
    setBusy("correction");
    try {
      const supabase = getSupabaseBrowserClient();
      const teacher = await getCurrentTeacher(supabase);
      const path = `${teacher.id}/${evaluationId}/correction-${Date.now()}-${safeStorageName(file.name)}`;
      const url = await uploadToTestsBucket(supabase, path, file, file.type || "application/octet-stream");
      const res = await backendFetch(`/evaluations/${evaluationId}`, {
        method: "PATCH",
        body: JSON.stringify({ correction_file_url: url, correction_file_name: file.name }),
      });
      await readApiJson(res, "Mise à jour impossible.");

      await Swal.fire({ icon: "success", title: "Correction type ajoutée", timer: 1200, showConfirmButton: false });
      setHasLocalCorrectionFile(true);
      router.refresh();
    } catch (err) {
      await alertError(err, "Upload impossible.");
    } finally {
      setBusy("none");
      if (correctionInputRef.current) correctionInputRef.current.value = "";
    }
  }

  async function downloadCorrectionTemplate() {
    setBusy("template");
    try {
      await downloadCorrectionTemplatePdf({ title: evaluationTitle, classLabel, durationMinutes, questions });
    } finally {
      setBusy("none");
    }
  }

  async function importAnswerSheets(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy("sheets");
    try {
      const supabase = getSupabaseBrowserClient();
      const teacher = await getCurrentTeacher(supabase);
      const res = await backendFetch(`/evaluations/${evaluationId}/copies`);
      const { copies = [] } = await readApiJson<{ copies?: CopyUploadTarget[] }>(
        res,
        "Chargement des copies impossible.",
      );
      if (copies.length === 0) throw new Error("Aucune copie disponible. Lancez d'abord la génération des copies.");

      const copiesByQr = indexCopiesByQr(copies);
      const imported = new Set<string>();
      const failures: string[] = [];
      // Séquentiel : chaque scan est décodé puis rattaché à sa copie, un doublon de QR est refusé.
      for (const file of Array.from(files)) {
        try {
          if (!file.type.startsWith("image/")) throw new Error(SHEET_ERRORS.notImage);
          const target = resolveSheetTarget(await decodeQrFromImageFile(file), copiesByQr, imported);
          const path = `${teacher.id}/${evaluationId}/answer-sheets/${target.id}-${Date.now()}-${safeStorageName(file.name)}`;
          const url = await uploadToTestsBucket(supabase, path, file, file.type || "application/octet-stream");
          const patch = await backendFetch(`/evaluations/${evaluationId}/copies/${target.id}`, {
            method: "PATCH",
            body: JSON.stringify({ scanned_image_url: url, status: "submitted" }),
          });
          await readApiJson(patch, "Mise à jour copie impossible.");
          imported.add(target.id);
        } catch (err) {
          failures.push(`${file.name}: ${errorMessage(err, "échec upload")}`);
        }
      }

      await Swal.fire({
        icon: failures.length > 0 ? "warning" : "success",
        title: failures.length > 0 ? "Import partiel" : "Import terminé",
        text: importSummary(imported.size, copies.length, failures),
      });
      router.refresh();
    } catch (err) {
      await alertError(err, "Import des feuilles impossible.");
    } finally {
      setBusy("none");
      if (answerSheetsInputRef.current) answerSheetsInputRef.current.value = "";
    }
  }

  async function resetImportedSheets() {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Réinitialiser les feuilles importées ?",
      text: "Cela supprime les scans déposés et les corrections IA de ce test, pour permettre un nouvel import propre.",
      showCancelButton: true,
      confirmButtonText: "Oui, réinitialiser",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#d33",
    });
    if (!confirm.isConfirmed) return;

    setBusy("reset");
    try {
      const res = await backendFetch(`/evaluations/${evaluationId}/reset-imports`, { method: "POST" });
      const data = await readApiJson<{ reset_imported_sheets?: number }>(res, "Réinitialisation impossible.");
      await Swal.fire({
        icon: "success",
        title: "Réinitialisation terminée",
        text: `${data.reset_imported_sheets ?? 0} feuille(s) importée(s) supprimée(s). Vous pouvez réimporter de nouvelles feuilles.`,
      });
      router.refresh();
    } catch (err) {
      await alertError(err, "Réinitialisation impossible.");
    } finally {
      setBusy("none");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-gray-200"
          onClick={() => void downloadCorrectionTemplate()}
          disabled={!isEditable || busy !== "none"}
          loading={busy === "template"}
          loadingText="Préparation du PDF…"
          title="Télécharger une trame dédiée à la correction type (document enseignant)"
        >
          <Download className="h-4 w-4" />
          Trame de correction (enseignant)
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-gray-200"
          onClick={() => correctionInputRef.current?.click()}
          disabled={!isEditable || busy !== "none"}
          title={isEditable ? "Uploader la correction type" : "Le test n'est plus modifiable"}
          loading={busy === "correction"}
          loadingText="Upload..."
        >
          <Upload className="h-4 w-4" />
          {hasLocalCorrectionFile ? "Remplacer correction type" : "Uploader correction type"}
        </Button>
        {showDepositSheets ? (
          <Button
            type="button"
            variant="outline"
            className="border-gray-200"
            onClick={() => answerSheetsInputRef.current?.click()}
            disabled={busy !== "none"}
            loading={busy === "sheets"}
            loadingText="Import..."
            title="Déposer les feuilles d'examen scannées (import multiple, QR)"
          >
            <Upload className="h-4 w-4" />
            Déposer feuilles d&apos;examen
          </Button>
        ) : null}
        {copyCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => void resetImportedSheets()}
            disabled={busy !== "none"}
            loading={busy === "reset"}
            loadingText="Réinitialisation..."
            title="Supprimer les feuilles importées et les corrections IA liées pour réimporter proprement"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser feuilles importées
          </Button>
        ) : null}
        <input
          ref={correctionInputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/*"
          className="hidden"
          onChange={(e) => void uploadCorrectionFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={answerSheetsInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => void importAnswerSheets(e.target.files)}
        />
        {showStartExam ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => void openStudentPicker()}
            disabled={!isEditable || busy !== "none"}
            title="Choisir les élèves et générer les feuilles de réponses (PDF)"
          >
            <Play className="h-4 w-4" />
            Commencer l&apos;examen
          </Button>
        ) : null}
        {showLaunchCorrection ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => void runAiCorrection()}
            disabled={busy !== "none"}
            title="Lancer la correction OCR + IA sur les copies déposées"
            loading={busy === "ai"}
            loadingText="Correction IA…"
          >
            <Play className="h-4 w-4" />
            Lancer la correction
          </Button>
        ) : null}
      </div>

      {pickerOpen && (
        <StudentPickerModal
          students={students}
          selectedIds={selectedIds}
          loading={loadingStudents}
          submitting={busy === "start"}
          onToggle={toggleStudent}
          onCancel={() => setPickerOpen(false)}
          onConfirm={() => void startExam()}
        />
      )}
    </>
  );
}

export const StartTestButton = memo(StartTestButtonInner);
