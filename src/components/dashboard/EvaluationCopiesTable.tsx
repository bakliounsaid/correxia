"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, X } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/Button";
import { ListExportButton } from "@/components/ui/ListExportButton";
import { TableSelectCheckbox } from "@/components/ui/TableSelectCheckbox";
import { useRowSelection } from "@/hooks/useRowSelection";
import { CopyReviewWorkspace } from "@/components/dashboard/CopyReviewWorkspace";

export type EvaluationCopyRow = {
  id: string;
  unique_test_id: string | null;
  status: string;
  created_at: string;
  pdf_url: string | null;
  scanned_image_url: string | null;
  first_name: string;
  last_name: string;
  class_name: string;
  note: number | null;
  ia_suggested_note: number | null;
  precision: number | null;
};

type Props = {
  evaluationId: string;
  initialRows: EvaluationCopyRow[];
  testTitle: string;
  className: string;
  durationMinutes: number | null;
  questions: unknown;
};

type ReviewPayload = {
  copyId: string;
  studentName: string;
  testTitle: string;
  subjectLabel: string;
  className: string;
  status: string;
  previewUrl: string | null;
  aiScore: number | null;
  aiConfidence: number | null;
  aiFeedback: string;
  aiPerExercise: Array<{ label: string; score: number; max: number; comment?: string }>;
  validatedScore: number | null;
};

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EvaluationCopiesTableInner({
  evaluationId,
  initialRows,
  testTitle,
  className,
  durationMinutes,
  questions,
}: Props) {
  const router = useRouter();
  const rows = initialRows;
  const [reviewCopyId, setReviewCopyId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewPayload | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const closeReview = useCallback(() => {
    setReviewCopyId(null);
    setReviewData(null);
  }, []);

  useEffect(() => {
    if (!reviewCopyId) {
      setReviewData(null);
      return;
    }
    let cancelled = false;
    setReviewLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/evaluations/${evaluationId}/copies/${reviewCopyId}/review-data`,
        );
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          payload?: ReviewPayload;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok || !json.payload) {
          await Swal.fire({
            icon: "error",
            title: "Chargement impossible",
            text: json.error ?? "Impossible d’ouvrir la révision.",
          });
          setReviewCopyId(null);
          setReviewData(null);
          return;
        }
        setReviewData(json.payload);
      } catch {
        if (!cancelled) {
          void Swal.fire({
            icon: "error",
            title: "Erreur réseau",
            text: "Réessayez dans un instant.",
          });
          setReviewCopyId(null);
          setReviewData(null);
        }
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewCopyId, evaluationId]);

  useEffect(() => {
    if (!reviewCopyId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeReview();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewCopyId, closeReview]);

  function canReview(row: EvaluationCopyRow) {
    const s = (row.status || "").toLowerCase();
    return ["pending_review", "auto_corrected", "validated", "archived", "completed"].includes(s);
  }

  function formatPrecision(value: number | null) {
    if (value == null || Number.isNaN(value)) return "—";
    const percent = value <= 1 ? value * 100 : value;
    return `${Math.round(percent)}%`;
  }

  const copyExportColumns = useMemo(
    () => [
      { key: "nom", header: "Nom" },
      { key: "prenom", header: "Prénom" },
      { key: "classe", header: "Classe" },
      { key: "date", header: "Date" },
      { key: "note", header: "Note" },
      { key: "proposition_ia", header: "Proposition IA" },
      { key: "precision_ia", header: "Précision IA" },
      { key: "statut", header: "Statut copie" },
    ],
    [],
  );

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

  const copyExportRowsWithId = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        nom: r.last_name || "—",
        prenom: r.first_name || "—",
        classe: r.class_name || "—",
        date: formatShortDate(r.created_at),
        note: r.note != null ? `${r.note}/20` : "À valider",
        proposition_ia: r.ia_suggested_note != null ? `${r.ia_suggested_note}/20` : "—",
        precision_ia: formatPrecision(r.precision),
        statut: r.status,
      })),
    [rows],
  );

  const copyExportRows = useMemo(() => {
    const picked = getExportRows(copyExportRowsWithId, "id");
    return picked.map(({ id: _id, ...rest }) => rest) as Record<string, unknown>[];
  }, [getExportRows, copyExportRowsWithId]);

  async function onDownload(row: EvaluationCopyRow) {
    const url = row.pdf_url || row.scanned_image_url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")) as {
        toDataURL: (text: string, opts?: { margin?: number; width?: number }) => Promise<string>;
      };
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const left = 14;
      const pageWidth = 210 - left * 2;
      const pageDate = new Date().toLocaleDateString("fr-FR");
      const durationLabel = durationMinutes ? `${durationMinutes} min` : "—";
      const drawHeader = () => {
        doc.setFontSize(10);
        doc.text("Établissement: —", left, 14);
        doc.text(`Élève: ${row.last_name} ${row.first_name}`.trim(), left, 19);
        doc.text(`Classe: ${row.class_name || className || "—"}`, left, 24);

        doc.setFontSize(16);
        doc.text(testTitle || "Évaluation", 105, 16, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Durée: ${durationLabel}`, 105, 22, { align: "center" });

        doc.setFontSize(10);
        doc.text(`Date: ${pageDate}`, 196, 14, { align: "right" });
        doc.line(left, 28, left + pageWidth, 28);
      };
      drawHeader();
      let y = 34;
      const parsedQuestions = Array.isArray(questions)
        ? (questions as Array<{ title?: string; text?: string; points?: number }>)
        : [];
      const normalized =
        parsedQuestions.length > 0
          ? parsedQuestions.map((q, idx) => ({
              title: q.title || `Exercice ${idx + 1}`,
              text: q.text || "",
              points: Number(q.points ?? 0),
            }))
          : [{ title: "Exercice 1", text: "", points: 0 }];

      normalized.forEach((q) => {
        doc.setFontSize(12);
        const pts = q.points > 0 ? ` (${q.points} pts)` : "";
        doc.text(`${q.title}${pts}`, left, y);
        y += 5;
        doc.setFontSize(11);
        if (q.text) {
          const wrapped = doc.splitTextToSize(q.text, pageWidth);
          doc.text(wrapped, left, y);
          y += wrapped.length * 5 + 2;
        }
        const boxHeight = 36;
        if (y + boxHeight > 285) {
          doc.addPage();
          y = 16;
        }
        doc.rect(left, y, pageWidth, boxHeight);
        y += boxHeight + 5;
      });

      if (row.unique_test_id) {
        const qrDataUrl = await QRCode.toDataURL(row.unique_test_id, { margin: 1, width: 90 });
        const qrSize = 12;
        const pages = doc.getNumberOfPages();
        for (let p = 1; p <= pages; p += 1) {
          doc.setPage(p);
          const qrY = 297 - 8 - qrSize;
          const qrX = 210 - 14 - qrSize;
          doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
        }
      }

      doc.save(`test-${row.last_name}-${row.first_name}.pdf`);
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Téléchargement impossible",
        text: "Le PDF n'est pas disponible et la génération locale a échoué.",
      });
    }
  }


  return (
    <>
      {reviewCopyId ? (
        <div
          className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-review-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReview();
          }}
        >
          <div
            className="flex h-full w-full max-h-[100dvh] flex-col overflow-hidden bg-white shadow-2xl sm:max-w-[min(96vw,1680px)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <h2 id="copy-review-modal-title" className="text-base font-semibold text-gray-900">
                Révision de copie
              </h2>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 gap-1"
                onClick={closeReview}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {reviewLoading ? (
                <div className="flex h-full min-h-[200px] items-center justify-center p-8 text-sm text-gray-500">
                  Chargement de la copie…
                </div>
              ) : reviewData ? (
                <CopyReviewWorkspace
                  key={reviewData.copyId}
                  variant="modal"
                  evaluationId={evaluationId}
                  copyId={reviewData.copyId}
                  backHref={`/dashboard/evaluations/${evaluationId}`}
                  studentName={reviewData.studentName}
                  testTitle={reviewData.testTitle}
                  subjectLabel={reviewData.subjectLabel}
                  className={reviewData.className}
                  status={reviewData.status}
                  previewUrl={reviewData.previewUrl}
                  aiScore={reviewData.aiScore}
                  aiConfidence={reviewData.aiConfidence}
                  aiFeedback={reviewData.aiFeedback}
                  aiPerExercise={reviewData.aiPerExercise}
                  validatedScore={reviewData.validatedScore}
                  onClose={closeReview}
                  onRevisionSaved={() => router.refresh()}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Copies de l&apos;évaluation</span>
            <span className="text-sm text-gray-600">
              {selectedCount > 0
                ? `${selectedCount} sélectionnée(s) · export ciblé`
                : `Export de toutes (${rows.length})`}
            </span>
          </div>
          <ListExportButton
            fileBaseName={`copies-${evaluationId.slice(0, 8)}`}
            sheetName="Copies"
            columns={copyExportColumns}
            rows={copyExportRows}
            disabled={Boolean(reviewCopyId) || rows.length === 0}
          />
        </div>
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="w-11 px-3 py-3 text-center">
              <TableSelectCheckbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
                ariaLabel="Tout sélectionner"
                disabled={Boolean(reviewCopyId) || rows.length === 0}
              />
            </th>
            <th className="px-6 py-3">Nom</th>
            <th className="px-6 py-3">Prénom</th>
            <th className="px-6 py-3">Classe</th>
            <th className="px-6 py-3">Date</th>
            <th className="px-6 py-3">Note</th>
            <th className="px-6 py-3">Proposition IA</th>
            <th className="px-6 py-3">Précision IA</th>
            <th className="px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 last:border-0">
              <td className="w-11 px-3 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-center">
                  <TableSelectCheckbox
                    checked={isSelected(r.id)}
                    onChange={() => toggleOne(r.id)}
                    ariaLabel={`Sélectionner copie ${r.last_name} ${r.first_name}`}
                    disabled={Boolean(reviewCopyId)}
                  />
                </div>
              </td>
              <td className="px-6 py-4 font-medium text-gray-900">{r.last_name || "—"}</td>
              <td className="px-6 py-4 text-gray-700">{r.first_name || "—"}</td>
              <td className="px-6 py-4 text-gray-600">{r.class_name || "—"}</td>
              <td className="px-6 py-4 text-gray-600">{formatShortDate(r.created_at)}</td>
              <td className="px-6 py-4 text-gray-700">{r.note != null ? `${r.note}/20` : "À valider"}</td>
              <td className="px-6 py-4 text-gray-700">
                {r.ia_suggested_note != null ? `${r.ia_suggested_note}/20` : "—"}
              </td>
              <td className="px-6 py-4 text-gray-700">{formatPrecision(r.precision)}</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-1">
                  {canReview(r) ? (
                    <button
                      type="button"
                      onClick={() => setReviewCopyId(r.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-600"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Réviser
                    </button>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500"
                      title="La révision sera disponible une fois la correction IA effectuée sur cette copie."
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      Après correction
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDownload(r)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export const EvaluationCopiesTable = memo(EvaluationCopiesTableInner);

