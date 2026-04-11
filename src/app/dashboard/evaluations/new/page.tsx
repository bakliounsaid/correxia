"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type QuestionItem = { id: string; text: string; points: number };

const STEP_TITLES = [
  "Infos évaluation",
  "Upload cours PDF",
  "Prévisualisation test",
  "Validation finale",
] as const;

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Répartition entière dont la somme vaut exactement `total` (ex. 20 pts sur N exercices). */
function distributePointsToTotal(count: number, total: number): number[] {
  if (count <= 0 || total <= 0) return [];
  const base = Math.floor(total / count);
  const rem = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

function estimateQuestionRows(text: string) {
  const normalized = (text || "").trim();
  const lineBreaks = normalized ? normalized.split("\n").length : 1;
  const estimatedByLength = Math.ceil(normalized.length / 95);
  return Math.max(4, Math.min(16, Math.max(lineBreaks, estimatedByLength)));
}

function estimateAnswerBoxHeight(text: string) {
  const rows = estimateQuestionRows(text);
  return Math.max(128, Math.min(320, 96 + rows * 12));
}

export default function NewEvaluationPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [evaluationDate, setEvaluationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [complexity, setComplexity] = useState<"" | "facile" | "moyen" | "difficile">("");
  const [courseFile, setCourseFile] = useState<File | null>(null);
  const [courseContext, setCourseContext] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { id: uid("q"), text: "Question 1 : Définir la notion principale du chapitre.", points: 10 },
    { id: uid("q"), text: "Question 2 : Résoudre l’exercice d’application.", points: 10 },
  ]);
  const [generating, setGenerating] = useState(false);
  const [submittingWizard, setSubmittingWizard] = useState(false);
  /** Loader du bouton « Suivant » pendant toute la navigation d’étape (génération incluse). */
  const [advancingStep, setAdvancingStep] = useState(false);

  function removeQuestion(questionId: string) {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((q) => q.id !== questionId);
    });
  }

  useEffect(() => {
    let mounted = true;
    async function loadClasses() {
      setClassesLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!mounted) return;
          setClassOptions([]);
          setSchoolName("");
          return;
        }

        // On tente d'abord le profil admin d'école.
        const { data: schoolAdminRow } = await supabase
          .from("schools")
          .select("id, name")
          .eq("admin_user_id", user.id)
          .maybeSingle();

        let resolvedSchoolId: string | null = null;
        let resolvedSchoolName = "";
        let options: string[] = [];
        if (schoolAdminRow?.id) {
          resolvedSchoolId = schoolAdminRow.id as string;
          resolvedSchoolName = (schoolAdminRow.name as string) ?? "";
          const { data: classes } = await supabase
            .from("classes")
            .select("name")
            .eq("school_id", resolvedSchoolId)
            .order("name", { ascending: true });
          options = (classes ?? []).map((c) => c.name as string);
        } else {
          // Sinon, profil enseignant lié à une école.
          const { data: teacher } = await supabase
            .from("teachers")
            .select("id, school_id, schools(name)")
            .eq("user_id", user.id)
            .maybeSingle();

          if (teacher?.school_id) {
            resolvedSchoolId = teacher.school_id as string;
          }

          const schoolJoin = teacher?.schools as { name?: string } | { name?: string }[] | null | undefined;
          const schoolFromJoin = Array.isArray(schoolJoin) ? (schoolJoin[0] ?? null) : schoolJoin;
          resolvedSchoolName = (schoolFromJoin?.name as string) ?? "";

          if (teacher?.id) {
            const { data: links } = await supabase
              .from("class_teachers")
              .select("class_id")
              .eq("teacher_id", teacher.id);
            const ids = (links ?? []).map((l) => l.class_id as string);
            if (ids.length > 0) {
              const { data: classes } = await supabase
                .from("classes")
                .select("name")
                .in("id", ids)
                .order("name", { ascending: true });
              options = (classes ?? []).map((c) => c.name as string);
            }
          }
        }

        // Fallback si le nom n'est pas revenu via la jointure.
        if (!resolvedSchoolName && resolvedSchoolId) {
          const { data: schoolFallback } = await supabase
            .from("schools")
            .select("name")
            .eq("id", resolvedSchoolId)
            .maybeSingle();
          resolvedSchoolName = (schoolFallback?.name as string) ?? "";
        }

        if (!mounted) return;
        setSchoolName(resolvedSchoolName);
        const uniqueSorted = Array.from(new Set(options)).sort((a, b) =>
          a.localeCompare(b, "fr"),
        );
        setClassOptions(uniqueSorted);
        setClassName((prev) => (prev && uniqueSorted.includes(prev) ? prev : ""));
      } finally {
        if (mounted) setClassesLoading(false);
      }
    }
    void loadClasses();
    return () => {
      mounted = false;
    };
  }, []);

  function canGoNext() {
    if (step === 0) return Boolean(title.trim() && className.trim() && complexity);
    if (step === 1) return Boolean(courseFile) || Boolean(courseContext.trim());
    if (step === 2) {
      return questions.length > 0 && questions.every((q) => q.text.trim() && q.points > 0);
    }
    return true;
  }

  async function generateFromCourse() {
    setGenerating(true);
    try {
      const res = await fetch("/api/evaluations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          className,
          complexity: complexity || "moyen",
          courseContext: courseContext.trim() || (courseFile ? `Fichier PDF fourni: ${courseFile.name}` : ""),
          hasCourseFile: Boolean(courseFile),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        questions?: string[];
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Génération impossible.");
      if (Array.isArray(data.questions) && data.questions.length) {
        const pts = distributePointsToTotal(data.questions.length, 20);
        setQuestions(
          data.questions.map((q, i) => ({
            id: uid("q"),
            text: q,
            points: pts[i] ?? 1,
          })),
        );
      }
      return true;
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Génération impossible.",
      });
      return false;
    } finally {
      setGenerating(false);
    }
  }

  async function buildPdfBlob() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 18;
    const left = 14;
    const pageWidth = 210 - left * 2;
    doc.setFontSize(16);
    doc.text(title || "Évaluation", left, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Établissement: ${schoolName || "—"}   Classe: ${className || "—"}`, left, y);
    y += 6;
    doc.text(`Date: ${evaluationDate || "—"}   Durée: ${durationMinutes} min`, left, y);
    y += 10;

    questions.forEach((q, idx) => {
      doc.setFontSize(12);
      doc.text(`Exercice ${idx + 1} (${q.points} pts)`, left, y);
      y += 6;
      doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(q.text, pageWidth);
      doc.text(wrapped, left, y);
      y += wrapped.length * 5 + 3;
      const boxHeight = 44;
      doc.rect(left, y, pageWidth, boxHeight);
      y += boxHeight + 4;
      y += 2;
      if (y > 270 && idx < questions.length - 1) {
        doc.addPage();
        y = 16;
      }
    });
    return doc.output("blob");
  }

  async function handleNext() {
    setAdvancingStep(true);
    try {
      if (step === 1) {
        const ok = await generateFromCourse();
        if (!ok) return;
        setStep(2);
        return;
      }
      setStep((s) => Math.min(STEP_TITLES.length - 1, s + 1));
    } finally {
      setAdvancingStep(false);
    }
  }

  async function finishWizard() {
    setSubmittingWizard(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Session expirée. Reconnectez-vous.");
      }

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id, school_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!teacher?.id) {
        throw new Error("Profil enseignant introuvable.");
      }

      const blob = await buildPdfBlob();
      const safeTitle = (title || "test").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
      const filename = `evaluation-${safeTitle}-${Date.now()}.pdf`;
      const storagePath = `${teacher.id}/${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from("tests")
        .upload(storagePath, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });
      if (uploadErr) {
        throw new Error(
          `Upload impossible (${uploadErr.message}). Vérifiez le bucket 'tests'.`,
        );
      }

      const { data: publicData } = supabase.storage.from("tests").getPublicUrl(storagePath);
      const pdfUrl = publicData.publicUrl || null;

      const { error: sourceErr } = await supabase.from("test_sources").insert({
        teacher_id: teacher.id,
        school_id: teacher.school_id ?? null,
        file_name: filename,
        file_url: pdfUrl,
        file_type: "pdf",
        upload_status: "completed",
      });
      if (sourceErr) {
        throw new Error(`PDF stocké, mais enregistrement en base impossible: ${sourceErr.message}`);
      }

      const totalPoints = questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
      const rubricFromQuestions = questions.map((q, idx) => ({
        id: `exo-${idx + 1}`,
        label: `Exercice ${idx + 1}`,
        points: Number(q.points || 0),
      }));
      const questionsPayload = questions.map((q, idx) => ({
        id: `exo-${idx + 1}`,
        type: "open_question",
        title: `Exercice ${idx + 1}`,
        text: q.text,
        points: Number(q.points || 0),
      }));

      const { data: createdTest, error: testErr } = await supabase
        .from("tests")
        .insert({
          teacher_id: teacher.id,
          school_id: teacher.school_id ?? null,
          title: title.trim(),
          subject: "math",
          level: "Terminale",
          class_name: className.trim() || "Sans classe",
          duration_minutes: durationMinutes,
          total_points: totalPoints,
          rubric: rubricFromQuestions,
          questions: questionsPayload,
          subject_file_url: pdfUrl,
          subject_file_name: filename,
          status: "created",
        })
        .select("id")
        .maybeSingle();
      if (testErr) {
        throw new Error(`PDF stocké, mais création du test impossible: ${testErr.message}`);
      }

      await Swal.fire({
        icon: "success",
        title: "Évaluation validée",
        text: `Le PDF a été stocké et l'évaluation créée${createdTest?.id ? " avec succès" : ""}.`,
        confirmButtonText: "Parfait",
      });
      router.push("/dashboard/evaluations");
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Échec du stockage du PDF.",
      });
    } finally {
      setSubmittingWizard(false);
    }
  }

  return (
    <div className="p-8 lg:p-10">
      <Link href="/dashboard/evaluations" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary-500">
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <header className="mb-6 border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Création d&apos;évaluation</h1>
      </header>

      <ol className="mb-6 grid gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-card md:grid-cols-4">
        {STEP_TITLES.map((label, idx) => (
          <li
            key={label}
            className={`rounded-lg px-3 py-2 text-xs font-semibold md:text-sm ${
              idx === step ? "bg-primary-50 text-primary-700" : idx < step ? "bg-success-50 text-success-700" : "bg-gray-50 text-gray-500"
            }`}
          >
            {idx + 1}. {label}
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Étape 1 — Informations de l&apos;évaluation</h2>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-800">Titre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-800">Date *</label>
                <input
                  type="date"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-800">Classe *</label>
                <select
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
                  disabled={classesLoading || classOptions.length === 0}
                >
                  {classesLoading ? (
                    <option value="">Chargement des classes...</option>
                  ) : classOptions.length === 0 ? (
                    <option value="">Aucune classe disponible</option>
                  ) : (
                    <>
                      <option value="">Sélectionner la classe</option>
                      {classOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-800">Degré de complexité *</label>
                <select
                  required
                  value={complexity}
                  onChange={(e) =>
                    setComplexity(e.target.value as "" | "facile" | "moyen" | "difficile")
                  }
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
                >
                  <option value="">Sélectionner le degré de complexité</option>
                  <option value="facile">Facile</option>
                  <option value="moyen">Moyen</option>
                  <option value="difficile">Difficile</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-800">Durée (minutes) *</label>
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(10, Number(e.target.value || 10)))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Étape 2 — Upload du cours (PDF)</h2>
            <p className="text-sm text-gray-500">
              Ajoutez au moins un support : un PDF, une description, ou les deux.
            </p>
            <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <Upload className="mb-3 h-8 w-8 text-primary-500" />
              <span className="text-sm font-semibold text-gray-900">Sélectionner un cours PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setCourseFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {courseFile ? (
              <p className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
                Fichier chargé : {courseFile.name}
              </p>
            ) : null}
            <textarea
              rows={6}
              value={courseContext}
              onChange={(e) => setCourseContext(e.target.value)}
              placeholder="Description du cours (optionnel)"
              className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none ring-primary-500 focus:ring-2"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Étape 3 — Feuille du test + modification</h2>
              <Button
                type="button"
                variant="outline"
                className="border-gray-200"
                onClick={() => void generateFromCourse()}
                disabled={generating}
                loading={generating}
                loadingText="Génération…"
              >
                <FileText className="h-4 w-4" />
                Régénérer
              </Button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{title || "Titre de l'évaluation"}</h3>
                <p className="text-sm text-gray-600">
                  Total barème :{" "}
                  <span className="font-semibold tabular-nums text-gray-900">
                    {questions.reduce((s, q) => s + Number(q.points || 0), 0)} / 20
                  </span>
                </p>
              </div>
              <div className="mt-4 space-y-4">
                {questions.map((q, i) => (
                  <div key={q.id} className="rounded-lg bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">Exercice {i + 1}</p>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-600">Points</label>
                        <input
                          type="number"
                          min={1}
                          value={q.points}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((it) =>
                                it.id === q.id ? { ...it, points: Math.max(1, Number(e.target.value || 1)) } : it,
                              ),
                            )
                          }
                          className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm outline-none ring-primary-500 focus:ring-2"
                        />
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          disabled={questions.length <= 1}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            questions.length <= 1
                              ? "Au moins une question est requise"
                              : "Supprimer cet exercice"
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={estimateQuestionRows(q.text)}
                      value={q.text}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((it) => (it.id === q.id ? { ...it, text: e.target.value } : it)),
                        )
                      }
                      className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed outline-none ring-primary-500 focus:ring-2"
                    />
                    <div
                      className="mt-3 rounded-lg border-2 border-gray-200 bg-white"
                      style={{ height: `${estimateAnswerBoxHeight(q.text)}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="border-gray-200"
              onClick={() =>
                setQuestions((prev) => [...prev, { id: uid("q"), text: "Nouvelle question...", points: 1 }])
              }
            >
              <Plus className="h-4 w-4" />
              Ajouter une question
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Étape 4 — Validation finale</h2>
            <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-2xl font-semibold text-gray-900">{title || "Titre de l'évaluation"}</h3>
                <p className="text-sm text-gray-600">
                  Total barème :{" "}
                  <span className="font-semibold tabular-nums text-gray-900">
                    {questions.reduce((s, q) => s + Number(q.points || 0), 0)} / 20
                  </span>
                </p>
              </div>
              <div className="mt-6 space-y-6">
                {questions.map((q, i) => (
                  <article key={q.id} className="border-b border-gray-100 pb-5 last:border-b-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">Exercice {i + 1}</p>
                      <span className="text-sm font-semibold text-gray-700">{q.points} pts</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{q.text}</p>
                    <div
                      className="mt-4 rounded-lg border-2 border-gray-200 bg-white"
                      style={{ height: `${estimateAnswerBoxHeight(q.text)}px` }}
                    />
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || generating || submittingWizard || advancingStep}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Précédent
          </Button>
          {step < STEP_TITLES.length - 1 ? (
            <Button
              type="button"
              variant="primary"
              disabled={!canGoNext() || generating || submittingWizard || advancingStep}
              loading={advancingStep}
              loadingText={
                step === 1
                  ? "Génération du sujet…"
                  : step === 0
                    ? "Étape suivante…"
                    : "Chargement…"
              }
              onClick={() => void handleNext()}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="success"
              loading={submittingWizard}
              loadingText="Enregistrement…"
              onClick={() => void finishWizard()}
            >
              Valider l&apos;évaluation
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

