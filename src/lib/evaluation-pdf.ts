/** PDF d'une évaluation (A4) : feuilles de réponses élèves avec QR, trame de correction, sujet. */

import { safeFileSlug, toPrintableQuestions, type EditableQuestion } from "@/lib/evaluation-questions";
import { PDF_QR_PNG_WIDTH_PX, PDF_QR_SIZE_MM } from "@/lib/qr-scan";

const LEFT = 14;
const PAGE_WIDTH = 210 - LEFT * 2;

export type AnswerSheetTest = {
  title: string;
  level: string;
  duration_minutes?: number | null;
  questions: unknown;
};

export type AnswerSheetCopy = {
  unique_test_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
};

async function newA4() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "mm", format: "a4" });
}

/** Une feuille de réponses par élève, avec son QR code (identifiant de copie) sur chaque page. */
export async function downloadAnswerSheetsPdf(test: AnswerSheetTest, copies: AnswerSheetCopy[]): Promise<void> {
  const doc = await newA4();
  const QRCode = (await import("qrcode")) as {
    toDataURL: (text: string, opts?: { margin?: number; width?: number; errorCorrectionLevel?: string }) => Promise<string>;
  };
  const questions = toPrintableQuestions(test.questions);
  const pageDate = new Date().toLocaleDateString("fr-FR");
  const durationLabel = test.duration_minutes ? `${test.duration_minutes} min` : "—";

  for (let copyIndex = 0; copyIndex < copies.length; copyIndex += 1) {
    const cp = copies[copyIndex]!;
    if (copyIndex > 0) doc.addPage();
    const startPage = doc.getNumberOfPages();

    doc.setFontSize(10);
    doc.text(`Établissement: —`, LEFT, 14);
    doc.text(`Élève: ${cp.last_name} ${cp.first_name}`.trim(), LEFT, 19);
    doc.text(`Classe: ${cp.class_name || test.level || "—"}`, LEFT, 24);
    doc.setFontSize(16);
    doc.text(test.title || "Évaluation", 105, 16, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Durée: ${durationLabel}`, 105, 22, { align: "center" });
    doc.text(`Date: ${pageDate}`, 196, 14, { align: "right" });
    doc.line(LEFT, 28, LEFT + PAGE_WIDTH, 28);

    let y = 34;
    for (const q of questions) {
      doc.setFontSize(12);
      doc.text(`${q.label}${q.points > 0 ? ` (${q.points} pts)` : ""}`, LEFT, y);
      y += 5;
      doc.setFontSize(11);
      if (q.text) {
        const wrapped = doc.splitTextToSize(q.text, PAGE_WIDTH);
        doc.text(wrapped, LEFT, y);
        y += wrapped.length * 5 + 2;
      }
      const boxHeight = 34;
      if (y + boxHeight > 285) {
        doc.addPage();
        y = 16;
      }
      doc.rect(LEFT, y, PAGE_WIDTH, boxHeight);
      y += boxHeight + 5;
    }

    const qrDataUrl = await QRCode.toDataURL(cp.unique_test_id, {
      margin: 1,
      width: PDF_QR_PNG_WIDTH_PX,
      errorCorrectionLevel: "Q",
    });
    for (let p = startPage; p <= doc.getNumberOfPages(); p += 1) {
      doc.setPage(p);
      doc.addImage(qrDataUrl, "PNG", 210 - 14 - PDF_QR_SIZE_MM, 297 - 8 - PDF_QR_SIZE_MM, PDF_QR_SIZE_MM, PDF_QR_SIZE_MM);
    }
  }

  doc.save(`copies-${safeFileSlug(test.title, "evaluation")}.pdf`);
}

/** Trame que l'enseignant remplit avec la correction attendue de chaque exercice. */
export async function downloadCorrectionTemplatePdf(params: {
  title: string;
  classLabel: string;
  durationMinutes?: number | null;
  questions: unknown;
}): Promise<void> {
  const doc = await newA4();
  let y = 16;
  doc.setFontSize(15);
  doc.text(`Trame de correction type - ${params.title || "Evaluation"}`, LEFT, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Classe: ${params.classLabel || "—"}   Duree: ${params.durationMinutes ?? "—"} min`, LEFT, y);
  y += 8;
  doc.text("Document enseignant: remplir la correction attendue pour chaque exercice.", LEFT, y);
  y += 8;

  for (const q of toPrintableQuestions(params.questions)) {
    if (y > 245) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.text(`${q.label}${q.points > 0 ? ` (${q.points} pts)` : ""}`, LEFT, y);
    y += 5;
    doc.setFontSize(10);
    if (q.text) {
      const wrapped = doc.splitTextToSize(q.text, PAGE_WIDTH);
      doc.text(wrapped, LEFT, y);
      y += wrapped.length * 4.5 + 2;
    }
    doc.text("Correction attendue (type):", LEFT, y);
    y += 3;
    const boxHeight = 52;
    doc.rect(LEFT, y, PAGE_WIDTH, boxHeight);
    y += boxHeight + 6;
  }

  doc.save(`trame-correction-type-${safeFileSlug(params.title, "evaluation")}.pdf`);
}

/** Sujet de l'évaluation (stocké avec l'évaluation à sa création). */
export async function buildSubjectPdfBlob(params: {
  title: string;
  schoolName: string;
  className: string;
  evaluationDate: string;
  durationMinutes: number;
  questions: EditableQuestion[];
}): Promise<Blob> {
  const doc = await newA4();
  let y = 18;
  doc.setFontSize(16);
  doc.text(params.title || "Évaluation", LEFT, y);
  y += 8;
  doc.setFontSize(11);
  doc.text(`Établissement: ${params.schoolName || "—"}   Classe: ${params.className || "—"}`, LEFT, y);
  y += 6;
  doc.text(`Date: ${params.evaluationDate || "—"}   Durée: ${params.durationMinutes} min`, LEFT, y);
  y += 10;

  params.questions.forEach((q, idx) => {
    doc.setFontSize(12);
    doc.text(`Exercice ${idx + 1} (${q.points} pts)`, LEFT, y);
    y += 6;
    doc.setFontSize(11);
    const wrapped = doc.splitTextToSize(q.text, PAGE_WIDTH);
    doc.text(wrapped, LEFT, y);
    y += wrapped.length * 5 + 3;
    const boxHeight = 44;
    doc.rect(LEFT, y, PAGE_WIDTH, boxHeight);
    y += boxHeight + 6;
    if (y > 270 && idx < params.questions.length - 1) {
      doc.addPage();
      y = 16;
    }
  });
  return doc.output("blob");
}
