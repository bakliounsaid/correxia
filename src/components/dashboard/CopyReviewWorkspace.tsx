"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Send } from "lucide-react";
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
  /** Zones peu lisibles ou notation fragile — à contrôler sur l’image de la copie. */
  passagesAVerifier?: Array<{ zone: string; detail: string; source?: string }>;
  validatedScore: number | null;
  /** Vue intégrée (overlay) : barre d’action en bas, pas de navigation pleine page */
  variant?: "page" | "modal";
  onClose?: () => void;
  onRevisionSaved?: () => void;
};

function formatConfidence(v: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  const p = v <= 1 ? v * 100 : v;
  const normalized = clampLocal(p, 0, 100);
  return `${normalized.toFixed(1)}%`;
}

function confidenceLabel(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "Non évaluée";
  const p = v <= 1 ? v * 100 : v;
  if (p >= 85) return "Très élevée";
  if (p >= 70) return "Élevée";
  if (p >= 50) return "Moyenne";
  return "Faible";
}

function formatScoreOnCopy(v: number): string {
  if (!Number.isFinite(v)) return "—/20";
  return `${Number(v.toFixed(2))}/20`;
}

function clampLocal(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildClampedPerExercise(
  rows: Props["aiPerExercise"],
): Array<{ label: string; score: number; max: number; comment: string }> {
  return rows.map((x) => ({
    label: x.label,
    score: clampLocal(Number(x.score || 0), 0, x.max || 20),
    max: x.max,
    comment: x.comment || "",
  }));
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

function clampZoom(v: number) {
  return clampLocal(v, 0.5, 3);
}

function CopyReviewWorkspaceInner(props: Props) {
  const isModal = props.variant === "modal";
  const [zoom, setZoom] = useState(1);
  const [perExercise, setPerExercise] = useState(() => buildClampedPerExercise(props.aiPerExercise));
  const [showPerExerciseDetails, setShowPerExerciseDetails] = useState<boolean>(true);
  const [score, setScore] = useState<number>(() => {
    if (props.validatedScore != null) return props.validatedScore;
    const clamped = buildClampedPerExercise(props.aiPerExercise);
    if (clamped.length > 0) return clamped.reduce((s, x) => s + x.score, 0);
    return props.aiScore ?? 0;
  });
  const [saving, setSaving] = useState(false);

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
            teacher_feedback: "",
            teacher_comments: "",
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
  const scoreOnCopy = formatScoreOnCopy(score);
  const scoreOverlay = (
    <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md border-2 border-red-600 bg-white/85 px-3 py-1.5 shadow-md backdrop-blur-[1px]">
      <p className="-rotate-3 text-xl font-extrabold italic tracking-wide text-red-700 sm:text-2xl">
        {scoreOnCopy}
      </p>
    </div>
  );

  const noteBlock = (
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
  );

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
              : "relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-gray-100 p-4"
          }
        >
          {!props.previewUrl?.toLowerCase().endsWith(".pdf") ? (
            <div className="absolute left-5 top-5 z-20 flex items-center gap-1 rounded-lg border border-gray-200 bg-white/95 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setZoom((z) => clampZoom(z - 0.25))}
                className="rounded px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                aria-label="Dézoomer"
              >
                -
              </button>
              <span className="min-w-[56px] text-center text-xs font-medium text-gray-700">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => clampZoom(z + 0.25))}
                className="rounded px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                aria-label="Zoomer"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Reset
              </button>
            </div>
          ) : null}
          {props.previewUrl ? (
            props.previewUrl.toLowerCase().endsWith(".pdf") ? (
              isModal ? (
                <div className="absolute inset-2 sm:inset-3">
                  <iframe
                    title="Aperçu de la copie (PDF)"
                    src={props.previewUrl}
                    className="h-full w-full rounded-lg border border-gray-200 bg-white"
                  />
                  {scoreOverlay}
                </div>
              ) : (
                <div className="relative h-[80vh] w-full">
                  <iframe
                    title="Aperçu de la copie (PDF)"
                    src={props.previewUrl}
                    className="h-full w-full rounded-lg border border-gray-200 bg-white"
                  />
                  {scoreOverlay}
                </div>
              )
            ) : isModal ? (
              <div className="absolute inset-2 overflow-auto sm:inset-3">
                <img
                  src={props.previewUrl}
                  alt="Copie élève"
                  className="mx-auto block max-h-[calc(100dvh-260px)] w-auto max-w-full rounded-lg border border-gray-200 bg-white shadow-sm"
                  style={{ height: "auto", transform: `scale(${zoom})`, transformOrigin: "top center" }}
                />
                {scoreOverlay}
              </div>
            ) : (
              <div className="relative">
                <img
                  src={props.previewUrl}
                  alt="Copie élève"
                  className="max-h-[80vh] w-auto rounded-lg border border-gray-200 bg-white"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                />
                {scoreOverlay}
              </div>
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
        {isModal ? noteBlock : null}
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <p>
            <strong>Proposition IA :</strong> {props.aiScore != null ? `${props.aiScore}/20` : "—"}
          </p>
          {props.aiPerExercise.length > 0 ? (
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={() => setShowPerExerciseDetails((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                <span>Détail par exercice</span>
                <span className="text-xs font-normal text-gray-500">{perExercise.length} éléments</span>
              </button>

              {showPerExerciseDetails ? (
                <div className="space-y-1">
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
          ) : null}
          <p>
            <strong>Précision IA :</strong> {formatConfidence(props.aiConfidence)}
          </p>
          <p className="text-xs text-gray-600">
            Niveau de confiance : <strong>{confidenceLabel(props.aiConfidence)}</strong>
          </p>
          <p className="text-xs text-gray-500">
            Basée sur la lisibilité et la clarté de la copie (si écriture floue/ambiguë, la précision baisse).
          </p>
          {props.passagesAVerifier && props.passagesAVerifier.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-amber-950">
              <p className="flex items-start gap-2 text-sm font-semibold leading-snug">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                À relire sur la copie (réponses peu lisibles ou interprétation fragile)
              </p>
              <ul className="mt-2 list-none space-y-2 text-xs leading-relaxed">
                {props.passagesAVerifier.map((p, i) => (
                  <li
                    key={`${p.zone}-${i}`}
                    className="rounded-md border border-amber-100/80 bg-white/60 px-2.5 py-1.5"
                  >
                    <span className="font-medium text-amber-950">{p.zone}</span>
                    <span className="text-amber-900/90"> — {p.detail}</span>
                    {p.source ? (
                      <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-amber-800/70">
                        {p.source === "ocr" ? "Transcription" : p.source === "notation" ? "Notation" : p.source}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            <strong>Remarque finale IA :</strong> {props.aiFeedback || "—"}
          </p>
        </div>
        {!isModal ? noteBlock : null}
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

