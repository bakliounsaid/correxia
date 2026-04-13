"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Download, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  decodeQrFromImageFile,
  PDF_QR_PNG_WIDTH_PX,
  PDF_QR_SIZE_MM,
} from "@/lib/qr-scan";

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string;
};

type GeneratedCopy = {
  copy_id: string;
  unique_test_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
};

type TestPayload = {
  id: string;
  title: string;
  level: string;
  duration_minutes?: number | null;
  questions: unknown;
};

type CopyUploadTarget = {
  id: string;
  created_at: string;
  status: string;
  scanned_image_url: string | null;
  unique_test_id: string | null;
};

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
  const isStartableStatus = normalizedStatus === "created" || normalizedStatus === "in_progress";
  const [hasLocalCorrectionFile, setHasLocalCorrectionFile] = useState(hasCorrectionFile);
  /** Trame + upload / remplacement correction type : autorisé tant que l’évaluation n’est pas terminée (créée ou en cours). */
  const canEditCorrectionFiles =
    normalizedStatus === "created" || normalizedStatus === "in_progress";
  const showStartExam = normalizedStatus === "created" && copyCount === 0;
  const showDepositSheets = isStartableStatus && copyCount > 0;
  const showLaunchCorrection =
    isStartableStatus &&
    hasLocalCorrectionFile &&
    hasDepositedCopy &&
    !allDepositedCopiesValidated;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const answerSheetsInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCorrection, setUploadingCorrection] = useState(false);
  const [uploadingAnswerSheets, setUploadingAnswerSheets] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  useEffect(() => {
    setHasLocalCorrectionFile(hasCorrectionFile);
  }, [hasCorrectionFile]);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/evaluations/${evaluationId}/start`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        students?: StudentOption[];
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Chargement impossible.");
      const rows = data.students ?? [];
      setStudents(rows);
      setSelectedIds(rows.map((s) => s.id));
    } catch (err: unknown) {
      setOpen(false);
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Chargement impossible.",
      });
    } finally {
      setLoading(false);
    }
  }

  function toggle(studentId: string) {
    setSelectedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  }

  async function generatePrintablePdf(test: TestPayload, copies: GeneratedCopy[]) {
    const { jsPDF } = await import("jspdf");
    const QRCode = (await import("qrcode")) as {
      toDataURL: (
        text: string,
        opts?: { margin?: number; width?: number; errorCorrectionLevel?: string },
      ) => Promise<string>;
    };
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const questions = Array.isArray(test.questions)
      ? (test.questions as Array<{ text?: string; title?: string; points?: number }>)
      : [];
    const normalizedQuestions =
      questions.length > 0
        ? questions.map((q, idx) => ({
            label: q.title || `Exercice ${idx + 1}`,
            text: q.text || "",
            points: Number(q.points ?? 0),
          }))
        : [{ label: "Exercice 1", text: "", points: 0 }];

    for (let copyIndex = 0; copyIndex < copies.length; copyIndex += 1) {
      const cp = copies[copyIndex]!;
      if (copyIndex > 0) doc.addPage();
      const startPage = doc.getNumberOfPages();
      const left = 14;
      const pageWidth = 210 - left * 2;
      const pageDate = new Date().toLocaleDateString("fr-FR");
      const durationLabel = test.duration_minutes ? `${test.duration_minutes} min` : "—";

      const drawHeader = () => {
        doc.setFontSize(10);
        doc.text(`Établissement: —`, left, 14);
        doc.text(`Élève: ${cp.last_name} ${cp.first_name}`.trim(), left, 19);
        doc.text(`Classe: ${cp.class_name || test.level || "—"}`, left, 24);

        doc.setFontSize(16);
        doc.text(test.title || "Évaluation", 105, 16, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Durée: ${durationLabel}`, 105, 22, { align: "center" });

        doc.setFontSize(10);
        doc.text(`Date: ${pageDate}`, 196, 14, { align: "right" });
        doc.line(left, 28, left + pageWidth, 28);
      };

      drawHeader();
      let y = 34;

      normalizedQuestions.forEach((q) => {
        doc.setFontSize(12);
        const pts = q.points > 0 ? ` (${q.points} pts)` : "";
        doc.text(`${q.label}${pts}`, left, y);
        y += 5;
        doc.setFontSize(11);
        if (q.text) {
          const wrapped = doc.splitTextToSize(q.text, pageWidth);
          doc.text(wrapped, left, y);
          y += wrapped.length * 5 + 2;
        }
        const boxHeight = 34;
        if (y + boxHeight > 285) {
          doc.addPage();
          y = 16;
        }
        doc.rect(left, y, pageWidth, boxHeight);
        y += boxHeight + 5;
      });

      const qrDataUrl = await QRCode.toDataURL(cp.unique_test_id, {
        margin: 1,
        width: PDF_QR_PNG_WIDTH_PX,
        errorCorrectionLevel: "Q",
      });
      const qrSize = PDF_QR_SIZE_MM;
      const endPage = doc.getNumberOfPages();
      for (let p = startPage; p <= endPage; p += 1) {
        doc.setPage(p);
        const qrY = 297 - 8 - qrSize;
        const qrX = 210 - 14 - qrSize;
        doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      }
    }

    doc.save(`copies-${(test.title || "evaluation").replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`);
  }

  async function onStart() {
    if (selectedIds.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "Sélection requise",
        text: "Sélectionnez au moins un élève.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/evaluations/${evaluationId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedIds }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        created?: number;
        already_exists?: number;
        total_copies?: number;
        test?: TestPayload;
        copies?: GeneratedCopy[];
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Impossible de démarrer le test.");

      const generatedCopies = Array.isArray(data.copies) ? data.copies : [];
      if (data.test && generatedCopies.length > 0) {
        await generatePrintablePdf(data.test, generatedCopies);
      }

      setOpen(false);
      await Swal.fire({
        icon: "success",
        title: "Feuilles de réponses prêtes",
        text: `${data.created ?? 0} copie(s) créée(s), ${data.already_exists ?? 0} déjà existante(s). Les feuilles de réponses ont été téléchargées.`,
        confirmButtonText: "Parfait",
      });
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Impossible de démarrer le test.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function runAiCorrection() {
    setCorrecting(true);
    try {
      const res = await fetch(`/api/dashboard/evaluations/${evaluationId}/correct`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        corrected?: number;
        total?: number;
        failures?: string[];
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Correction IA impossible.");
      const failures = Array.isArray(data.failures) ? data.failures : [];
      await Swal.fire({
        icon: failures.length ? "warning" : "success",
        title: failures.length ? "Correction partielle" : "Correction terminée",
        text: `${data.corrected ?? 0}/${data.total ?? 0} copie(s) corrigée(s).${
          failures.length ? ` Erreurs: ${failures.slice(0, 2).join(" | ")}` : ""
        }`,
      });
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Correction IA impossible.",
      });
    } finally {
      setCorrecting(false);
    }
  }

  async function onPickCorrectionFile(file: File | null) {
    if (!file) return;
    setUploadingCorrection(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!teacher?.id) throw new Error("Profil enseignant introuvable.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
      const storagePath = `${teacher.id}/${evaluationId}/correction-${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("tests").upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (uploadErr) throw new Error(`Upload impossible (${uploadErr.message}).`);

      const { data: publicData } = supabase.storage.from("tests").getPublicUrl(storagePath);
      const res = await fetch(`/api/dashboard/evaluations/${evaluationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correction_file_url: publicData.publicUrl,
          correction_file_name: file.name,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Mise à jour impossible.");

      await Swal.fire({
        icon: "success",
        title: "Correction type ajoutée",
        timer: 1200,
        showConfirmButton: false,
      });
      setHasLocalCorrectionFile(true);
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Upload impossible.",
      });
    } finally {
      setUploadingCorrection(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function downloadCorrectionTemplate() {
    setDownloadingTemplate(true);
    try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const left = 14;
    const pageWidth = 210 - left * 2;
    let y = 16;
    const items = Array.isArray(questions)
      ? (questions as Array<{ title?: string; text?: string; points?: number }>)
      : [];
    const normalized =
      items.length > 0
        ? items.map((q, idx) => ({
            label: q.title || `Exercice ${idx + 1}`,
            text: q.text || "",
            points: Number(q.points ?? 0),
          }))
        : [{ label: "Exercice 1", text: "", points: 0 }];

    doc.setFontSize(15);
    doc.text(`Trame de correction type - ${evaluationTitle || "Evaluation"}`, left, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Classe: ${classLabel || "—"}   Duree: ${durationMinutes ?? "—"} min`, left, y);
    y += 8;
    doc.text("Document enseignant: remplir la correction attendue pour chaque exercice.", left, y);
    y += 8;

    normalized.forEach((q) => {
      if (y > 245) {
        doc.addPage();
        y = 16;
      }
      doc.setFontSize(12);
      const pts = q.points > 0 ? ` (${q.points} pts)` : "";
      doc.text(`${q.label}${pts}`, left, y);
      y += 5;
      doc.setFontSize(10);
      if (q.text) {
        const wrapped = doc.splitTextToSize(q.text, pageWidth);
        doc.text(wrapped, left, y);
        y += wrapped.length * 4.5 + 2;
      }
      doc.setFontSize(10);
      doc.text("Correction attendue (type):", left, y);
      y += 3;
      const boxHeight = 52;
      doc.rect(left, y, pageWidth, boxHeight);
      y += boxHeight + 6;
    });

    doc.save(`trame-correction-type-${(evaluationTitle || "evaluation").replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`);
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function onUploadAllAnswerSheets(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingAnswerSheets(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée. Reconnectez-vous.");

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!teacher?.id) throw new Error("Profil enseignant introuvable.");

      const copiesRes = await fetch(`/api/dashboard/evaluations/${evaluationId}/copies`);
      const copiesJson = (await copiesRes.json()) as {
        ok?: boolean;
        error?: string;
        copies?: CopyUploadTarget[];
      };
      if (!copiesRes.ok || !copiesJson.ok) {
        throw new Error(copiesJson.error ?? "Chargement des copies impossible.");
      }
      const targets = (copiesJson.copies ?? []).sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      if (targets.length === 0) {
        throw new Error("Aucune copie disponible. Lancez d'abord la génération des copies.");
      }

      const inputFiles = Array.from(files);
      const availableByQr = new Map(
        targets
          .filter((t) => Boolean(t.unique_test_id))
          .map((t) => [t.unique_test_id as string, t]),
      );
      const consumedCopyIds = new Set<string>();
      let successCount = 0;
      const failures: string[] = [];

      for (let i = 0; i < inputFiles.length; i += 1) {
        const f = inputFiles[i];
        try {
          if (!f.type.startsWith("image/")) {
            throw new Error(
              "Format non supporté pour la lecture du QR : utilisez une photo ou un scan JPG ou PNG (pas de PDF).",
            );
          }
          const qrValue = await decodeQrFromImageFile(f);
          if (!qrValue) {
            throw new Error(
              "QR code introuvable ou illisible : exportez la page en entier (évitez le zoom sur une zone), bonne lumière, pas de flou. Les applis « PDF Scanner » avec grosses marges noires posent souvent problème — préférez une photo de la feuille seule ou régénérez les copies (QR plus grand).",
            );
          }
          const target = availableByQr.get(qrValue);
          if (!target) {
            throw new Error("QR code non lié à une copie de ce test");
          }
          if (consumedCopyIds.has(target.id)) {
            throw new Error("copie déjà importée dans ce lot (doublon QR)");
          }

          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
          const storagePath = `${teacher.id}/${evaluationId}/answer-sheets/${target.id}-${Date.now()}-${safeName}`;
          const { error: uploadErr } = await supabase.storage.from("tests").upload(storagePath, f, {
            cacheControl: "3600",
            upsert: false,
            contentType: f.type || "application/octet-stream",
          });
          if (uploadErr) throw new Error(uploadErr.message);

          const { data: publicData } = supabase.storage.from("tests").getPublicUrl(storagePath);
          const patchRes = await fetch(`/api/dashboard/evaluations/${evaluationId}/copies/${target.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scanned_image_url: publicData.publicUrl,
              status: "submitted",
            }),
          });
          const patchJson = (await patchRes.json()) as { ok?: boolean; error?: string };
          if (!patchRes.ok || !patchJson.ok) {
            throw new Error(patchJson.error ?? "Mise à jour copie impossible.");
          }
          consumedCopyIds.add(target.id);
          successCount += 1;
        } catch (err: unknown) {
          failures.push(
            `${f.name}: ${
              err && typeof err === "object" && "message" in err
                ? String((err as { message: string }).message)
                : "échec upload"
            }`,
          );
        }
      }

      const summary = [
        `${successCount} feuille(s) importée(s).`,
        `${targets.length - consumedCopyIds.size} copie(s) sans feuille valide.`,
        failures.length > 0 ? `Erreurs: ${failures.slice(0, 2).join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      await Swal.fire({
        icon: failures.length > 0 ? "warning" : "success",
        title: failures.length > 0 ? "Import partiel" : "Import terminé",
        text: summary,
      });
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Import des feuilles impossible.",
      });
    } finally {
      setUploadingAnswerSheets(false);
      if (answerSheetsInputRef.current) answerSheetsInputRef.current.value = "";
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
          disabled={!canEditCorrectionFiles || downloadingTemplate}
          loading={downloadingTemplate}
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
          onClick={() => fileInputRef.current?.click()}
          disabled={!canEditCorrectionFiles || uploadingCorrection}
          title={
            canEditCorrectionFiles
              ? "Uploader la correction type"
              : "Le test n'est plus modifiable"
          }
          loading={uploadingCorrection}
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
            disabled={uploadingAnswerSheets}
            loading={uploadingAnswerSheets}
            loadingText="Import..."
            title="Déposer les feuilles d'examen scannées (import multiple, QR)"
          >
            <Upload className="h-4 w-4" />
            Déposer feuilles d&apos;examen
          </Button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/*"
          className="hidden"
          onChange={(e) => void onPickCorrectionFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={answerSheetsInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => void onUploadAllAnswerSheets(e.target.files)}
        />
        {showStartExam ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => void openModal()}
            disabled={!isStartableStatus}
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
            disabled={correcting}
            title="Lancer la correction OCR + IA sur les copies déposées"
            loading={correcting}
            loadingText="Correction IA…"
          >
            <Play className="h-4 w-4" />
            Lancer la correction
          </Button>
        ) : null}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Sélectionner les élèves pour ce test
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Chaque copie aura un code unique par élève.
            </p>

            <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-gray-100">
              {loading ? (
                <p className="px-4 py-6 text-sm text-gray-500">Chargement des élèves...</p>
              ) : students.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">Aucun élève disponible.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {students.map((s) => {
                    const checked = selectedIds.includes(s.id);
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <label className="flex items-center gap-3 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(s.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          />
                          <span>
                            {s.last_name} {s.first_name}
                          </span>
                        </label>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {s.class_name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">{selectedCount} élève(s) sélectionné(s)</p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => void onStart()}
                  disabled={submitting || loading || students.length === 0}
                  loading={submitting}
                  loadingText="Génération des copies…"
                >
                  Télécharger les feuilles de réponses
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const StartTestButton = memo(StartTestButtonInner);

