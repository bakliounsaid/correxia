"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { StepCourse } from "@/components/evaluations/wizard/StepCourse";
import { StepInfo } from "@/components/evaluations/wizard/StepInfo";
import { StepQuestions } from "@/components/evaluations/wizard/StepQuestions";
import { StepReview } from "@/components/evaluations/wizard/StepReview";
import {
  canGoNext,
  type EvaluationDraft,
  newQuestionId,
  WIZARD_STEPS,
} from "@/components/evaluations/wizard/types";
import { Button } from "@/components/ui/Button";
import { useEvaluationClassOptions } from "@/hooks/useEvaluationClassOptions";
import { backendFetch } from "@/lib/backend";
import { alertError, readApiJson } from "@/lib/error-message";
import { buildSubjectPdfBlob } from "@/lib/evaluation-pdf";
import { distributePointsToTotal, safeFileSlug, toStoredQuestions } from "@/lib/evaluation-questions";
import { getCurrentTeacher, uploadToTestsBucket } from "@/lib/storage-upload";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function createInitialDraft(): EvaluationDraft {
  return {
  title: "",
  evaluationDate: new Date().toISOString().slice(0, 10),
  className: "",
  complexity: "",
  durationMinutes: 60,
  courseFile: null,
  courseContext: "",
  questions: [
    { id: newQuestionId(), text: "Question 1 : Définir la notion principale du chapitre.", points: 10 },
    { id: newQuestionId(), text: "Question 2 : Résoudre l’exercice d’application.", points: 10 },
  ],
  };
}

/** Assistant de création d'évaluation : infos → cours → sujet généré par l'IA → validation. */
export default function NewEvaluationPage() {
  const router = useRouter();
  const { schoolName, classOptions, loading: classesLoading } = useEvaluationClassOptions();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EvaluationDraft>(createInitialDraft);
  const [busy, setBusy] = useState<"none" | "generating" | "advancing" | "saving">("none");
  const update = (patch: Partial<EvaluationDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Une classe qui n'est plus proposée (rechargement des options) est désélectionnée.
  useEffect(() => {
    setDraft((d) => (d.className && !classOptions.includes(d.className) ? { ...d, className: "" } : d));
  }, [classOptions]);

  async function generateFromCourse(): Promise<boolean> {
    setBusy((b) => (b === "advancing" ? b : "generating"));
    try {
      const res = await backendFetch("/evaluations/generate", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          className: draft.className,
          complexity: draft.complexity || "moyen",
          courseContext:
            draft.courseContext.trim() || (draft.courseFile ? `Fichier PDF fourni: ${draft.courseFile.name}` : ""),
          hasCourseFile: Boolean(draft.courseFile),
        }),
      });
      const data = await readApiJson<{ questions?: string[] }>(res, "Génération impossible.");
      if (data.questions?.length) {
        const points = distributePointsToTotal(data.questions.length, 20);
        update({ questions: data.questions.map((text, i) => ({ id: newQuestionId(), text, points: points[i] ?? 1 })) });
      }
      return true;
    } catch (err) {
      await alertError(err, "Génération impossible.");
      return false;
    } finally {
      setBusy((b) => (b === "generating" ? "none" : b));
    }
  }

  async function goNext() {
    setBusy("advancing");
    try {
      // Le passage du cours au sujet déclenche la génération IA.
      if (step === 1 && !(await generateFromCourse())) return;
      setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
    } finally {
      setBusy("none");
    }
  }

  async function saveEvaluation() {
    setBusy("saving");
    try {
      const supabase = getSupabaseBrowserClient();
      const teacher = await getCurrentTeacher(supabase);
      const pdf = await buildSubjectPdfBlob({
        title: draft.title,
        schoolName,
        className: draft.className,
        evaluationDate: draft.evaluationDate,
        durationMinutes: draft.durationMinutes,
        questions: draft.questions,
      });
      const filename = `evaluation-${safeFileSlug(draft.title, "test").toLowerCase()}-${Date.now()}.pdf`;
      const subjectUrl = await uploadToTestsBucket(supabase, `${teacher.id}/${filename}`, pdf, "application/pdf");

      const { questions, rubric } = toStoredQuestions(draft.questions);
      const res = await backendFetch("/evaluations", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          class_name: draft.className || "Sans classe",
          duration_minutes: draft.durationMinutes,
          questions,
          rubric,
          subject_file_url: subjectUrl,
          subject_file_name: filename,
        }),
      });
      await readApiJson(res, "PDF stocké, mais création de l'évaluation impossible.");

      await Swal.fire({
        icon: "success",
        title: "Évaluation validée",
        text: "Le PDF a été stocké et l'évaluation créée avec succès.",
        confirmButtonText: "Parfait",
      });
      router.push("/dashboard/evaluations");
      router.refresh();
    } catch (err) {
      await alertError(err, "Échec du stockage du PDF.");
    } finally {
      setBusy("none");
    }
  }

  const locked = busy !== "none";

  return (
    <div className="p-8 lg:p-10">
      <Link
        href="/dashboard/evaluations"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <header className="mb-6 border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Création d&apos;évaluation</h1>
      </header>

      <ol className="mb-6 grid gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-card md:grid-cols-4">
        {WIZARD_STEPS.map((label, idx) => (
          <li
            key={label}
            aria-current={idx === step ? "step" : undefined}
            className={`rounded-lg px-3 py-2 text-xs font-semibold md:text-sm ${
              idx === step
                ? "bg-primary-50 text-primary-700"
                : idx < step
                  ? "bg-success-50 text-success-700"
                  : "bg-gray-50 text-gray-500"
            }`}
          >
            {idx + 1}. {label}
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
        {step === 0 && (
          <StepInfo draft={draft} classOptions={classOptions} classesLoading={classesLoading} onChange={update} />
        )}
        {step === 1 && <StepCourse draft={draft} onChange={update} />}
        {step === 2 && (
          <StepQuestions
            title={draft.title}
            questions={draft.questions}
            generating={busy === "generating"}
            onRegenerate={() => void generateFromCourse()}
            onChange={(questions) => update({ questions })}
          />
        )}
        {step === 3 && <StepReview title={draft.title} questions={draft.questions} />}

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <Button type="button" variant="ghost" disabled={step === 0 || locked} onClick={() => setStep((s) => s - 1)}>
            Précédent
          </Button>
          {step < WIZARD_STEPS.length - 1 ? (
            <Button
              type="button"
              variant="primary"
              disabled={!canGoNext(step, draft) || locked}
              loading={busy === "advancing"}
              loadingText={step === 1 ? "Génération du sujet…" : step === 0 ? "Étape suivante…" : "Chargement…"}
              onClick={() => void goNext()}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="success"
              loading={busy === "saving"}
              loadingText="Enregistrement…"
              onClick={() => void saveEvaluation()}
            >
              Valider l&apos;évaluation
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
