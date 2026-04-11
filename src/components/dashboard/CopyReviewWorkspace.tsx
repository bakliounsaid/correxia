"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/Button";

type Props = {
  evaluationId: string;
  copyId: string;
  /** Utilisé en vue page pleine (lien Retour). Ignoré en modale si onClose est fourni. */
  backHref: string;
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
  /** Vue intégrée (overlay) : barre d’action en bas, pas de navigation pleine page */
  variant?: "page" | "modal";
  onClose?: () => void;
  onRevisionSaved?: () => void;
};

function formatConfidence(v: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  const p = v <= 1 ? v * 100 : v;
  return `${Math.round(p)}%`;
}

function clampLocal(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function statusLabelFr(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "created") return "Créée";
  if (s === "in_progress") return "En cours";
  if (s === "pending_review") return "En attente de revue";
  if (s === "validated") return "Validée";
  if (s === "completed") return "Terminée";
  return status || "—";
}

function CopyReviewWorkspaceInner(props: Props) {
  const isModal = props.variant === "modal";
  const [score, setScore] = useState<number>(props.validatedScore ?? props.aiScore ?? 0);
  const [feedback, setFeedback] = useState("");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [perExercise, setPerExercise] = useState(
    props.aiPerExercise.map((x) => ({
      label: x.label,
      score: x.score,
      max: x.max,
      comment: x.comment || "",
    })),
  );

  const changed = useMemo(() => {
    if (props.aiScore == null) return true;
    return Math.abs(score - props.aiScore) > 0.0001;
  }, [props.aiScore, score]);

  async function onValidate() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/dashboard/evaluations/${props.evaluationId}/copies/${props.copyId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacher_validated_points: score,
            teacher_feedback: feedback,
            teacher_comments: comments,
            acceptAi: !changed,
            perExerciseTeacher: perExercise,
          }),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        evaluationCompleted?: boolean;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Validation impossible.");
      await Swal.fire({
        icon: "success",
        title: data.evaluationCompleted ? "Évaluation terminée" : "Révision enregistrée",
        text: data.evaluationCompleted
          ? "Toutes les copies déposées sont validées. Le test est passé au statut Terminée."
          : undefined,
        timer: data.evaluationCompleted ? 2200 : 1200,
        showConfirmButton: false,
      });
      props.onRevisionSaved?.();
      if (isModal) props.onClose?.();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Validation impossible.",
      });
    } finally {
      setSaving(false);
    }
  }

  const validateLabel = changed ? "Enregistrer la révision" : "Valider la note";

  const mainRow = (
    <>
      <div
        className={
          isModal
            ? "flex min-h-[55dvh] flex-[3] flex-col border-b border-gray-200 bg-white lg:min-h-0 lg:border-b-0 lg:border-r"
            : "flex min-h-[45vh] flex-1 flex-col border-b border-gray-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r"
        }
      >
        <div className={`shrink-0 border-b border-gray-100 px-3 py-2 sm:px-4 sm:py-3 ${isModal ? "lg:py-2" : ""}`}>
          {!isModal ? (
            <Link
              href={props.backHref}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          ) : null}
          <h1
            className={`truncate text-base font-semibold text-gray-900 sm:text-lg ${!isModal ? "mt-2" : ""}`}
          >
            {props.studentName} — {props.testTitle}
          </h1>
          <p className="text-xs text-gray-500">
            {props.className} · {props.subjectLabel} · {statusLabelFr(props.status)}
          </p>
        </div>
        <div
          className={
            isModal
              ? "relative min-h-0 flex-1 bg-gray-100 p-2 sm:p-3"
              : "flex min-h-0 flex-1 items-start justify-center overflow-auto bg-gray-100 p-4"
          }
        >
          {props.previewUrl ? (
            props.previewUrl.toLowerCase().endsWith(".pdf") ? (
              isModal ? (
                <iframe
                  title="Aperçu de la copie (PDF)"
                  src={props.previewUrl}
                  className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-lg border border-gray-200 bg-white sm:inset-3 sm:h-[calc(100%-1.5rem)] sm:w-[calc(100%-1.5rem)]"
                />
              ) : (
                <iframe
                  title="Aperçu de la copie (PDF)"
                  src={props.previewUrl}
                  className="h-[80vh] w-full rounded-lg border border-gray-200 bg-white"
                />
              )
            ) : isModal ? (
              <div className="absolute inset-2 overflow-auto sm:inset-3">
                <img
                  src={props.previewUrl}
                  alt="Copie élève"
                  className="mx-auto block w-full max-w-[min(100%,1400px)] rounded-lg border border-gray-200 bg-white shadow-sm"
                  style={{ height: "auto" }}
                />
              </div>
            ) : (
              <img
                src={props.previewUrl}
                alt="Copie élève"
                className="max-h-[80vh] w-auto rounded-lg border border-gray-200 bg-white"
              />
            )
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
              Aucune feuille uploadée pour cette copie.
            </div>
          )}
        </div>
      </div>

      <aside
        className={`w-full shrink-0 bg-gray-50 p-4 sm:p-5 lg:w-[min(100%,380px)] lg:max-w-[420px] lg:flex-[1] ${isModal ? "max-h-[min(36dvh,320px)] min-h-0 overflow-y-auto border-t border-gray-200 lg:max-h-none lg:border-t-0" : ""}`}
      >
        <h2 className="text-lg font-semibold text-gray-900">Détails de correction</h2>
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <p>
            <strong>Proposition IA :</strong> {props.aiScore != null ? `${props.aiScore}/20` : "—"}
          </p>
          <p>
            <strong>Précision IA :</strong> {formatConfidence(props.aiConfidence)}
          </p>
          <p className="text-xs text-gray-500">
            Basée sur la lisibilité et la clarté de la copie (si écriture floue/ambiguë, la précision baisse).
          </p>
          <p>
            <strong>Analyse IA :</strong> {props.aiFeedback || "—"}
          </p>
          {props.aiPerExercise.length > 0 ? (
            <div className="mt-2 space-y-1">
              <p className="font-semibold text-gray-900">Détail par exercice</p>
              {perExercise.map((ex, i) => (
                <div key={`${ex.label}-${i}`} className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-red-700">{ex.label}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={ex.max || 20}
                      step={0.25}
                      value={ex.score}
                      onChange={(e) => {
                        const next = Number(e.target.value || 0);
                        setPerExercise((prev) =>
                          prev.map((p, idx) =>
                            idx === i ? { ...p, score: clampLocal(next, 0, p.max || 20) } : p,
                          ),
                        );
                      }}
                      className="w-24 rounded border border-red-300 bg-white px-2 py-1 text-sm text-red-700"
                    />
                    <span className="text-red-700">/ {ex.max}</span>
                  </div>
                  {ex.comment ? <p className="mt-1 text-xs text-red-600">{ex.comment}</p> : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setScore(
                    Number(
                      perExercise.reduce((s, ex) => s + Number(ex.score || 0), 0).toFixed(2),
                    ),
                  )
                }
                className="mt-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Recalculer la note finale depuis les exercices
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <label className="block text-sm font-semibold text-gray-900">Note finale enseignant (/20)</label>
          <input
            type="number"
            min={0}
            max={20}
            step={0.25}
            value={score}
            onChange={(e) => setScore(Number(e.target.value || 0))}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback élève"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Commentaire interne enseignant"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
          />
          {!isModal ? (
            <Button
              type="button"
              variant="success"
              className="rounded-full px-4 py-2"
              loading={saving}
              loadingText="Enregistrement de la révision…"
              onClick={() => void onValidate()}
            >
              <Send className="h-4 w-4" />
              {validateLabel}
            </Button>
          ) : null}
        </div>
      </aside>
    </>
  );

  if (isModal) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">{mainRow}</div>
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_14px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => props.onClose?.()} disabled={saving}>
              Fermer
            </Button>
            <Button
              type="button"
              variant="success"
              className="min-w-[160px]"
              loading={saving}
              loadingText="Enregistrement de la révision…"
              onClick={() => void onValidate()}
            >
              <Send className="h-4 w-4" />
              {validateLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="flex min-h-screen flex-col lg:flex-row">{mainRow}</div>;
}

export const CopyReviewWorkspace = memo(CopyReviewWorkspaceInner);

