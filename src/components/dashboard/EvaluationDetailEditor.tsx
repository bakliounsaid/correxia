"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/Button";
import { backendFetch } from "@/lib/backend";
import { toStoredQuestions } from "@/lib/evaluation-questions";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type EvaluationDetail = {
  id: string;
  title: string;
  subject: string;
  level: string;
  class_name?: string | null;
  status: string;
  total_points: number | null;
  created_at: string | null;
  copies_generated: number | null;
  copies_corrected: number | null;
  copies_submitted: number | null;
  duration_minutes?: number | null;
  questions?: unknown;
  rubric?: unknown;
  subject_file_url?: string | null;
  subject_file_name?: string | null;
  correction_file_url?: string | null;
  correction_file_name?: string | null;
};

type Props = {
  evaluation: EvaluationDetail;
};

type EditableQuestion = {
  id: string;
  text: string;
  points: number;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
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

function statusBadgeClass(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "created") return "bg-blue-50 text-blue-700";
  if (s === "in_progress") return "bg-amber-50 text-amber-700";
  if (s === "completed") return "bg-emerald-50 text-emerald-700";
  if (s === "draft") return "bg-violet-50 text-violet-700";
  return "bg-gray-100 text-gray-700";
}

const KNOWN_SUBJECT_KEYS = ["math", "physics", "science"] as const;

function statusLabelFr(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "created") return "Créée";
  if (s === "in_progress") return "En cours";
  if (s === "completed") return "Terminée";
  if (s === "draft") return "Brouillon";
  if (s === "pending_review") return "En attente de revue";
  return status || "—";
}

export function EvaluationDetailEditor({ evaluation }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<EvaluationDetail>(evaluation);
  const [title, setTitle] = useState(evaluation.title);
  const initialSubject = (evaluation.subject || "").trim();
  const [subject, setSubject] = useState(initialSubject);
  const initialClass =
    (evaluation.class_name || evaluation.level || "").trim() || "";
  const [className, setClassName] = useState(initialClass);
  const [durationMinutes, setDurationMinutes] = useState<number>(evaluation.duration_minutes ?? 60);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const initialQuestionsRaw = Array.isArray(evaluation.questions) ? evaluation.questions : [];
  const normalizedInitialQuestions: EditableQuestion[] =
    initialQuestionsRaw.length > 0
      ? initialQuestionsRaw.map((q, idx) => {
          const row = q as { id?: string; text?: string; points?: number };
          return {
            id: row.id || uid("q"),
            text: row.text || `Question ${idx + 1}`,
            points: Number(row.points ?? 1),
          };
        })
      : [{ id: uid("q"), text: "Question 1", points: 20 }];
  const [questions, setQuestions] = useState<EditableQuestion[]>(normalizedInitialQuestions);

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
          if (mounted) setClassOptions([]);
          return;
        }

        const { data: teacher } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!teacher?.id) {
          if (mounted) setClassOptions([]);
          return;
        }

        const { data: links } = await supabase
          .from("class_teachers")
          .select("class_id")
          .eq("teacher_id", teacher.id);
        const classIds = (links ?? []).map((l) => l.class_id as string).filter(Boolean);
        if (classIds.length === 0) {
          if (mounted) setClassOptions([]);
          return;
        }

        const { data: classes } = await supabase
          .from("classes")
          .select("name")
          .in("id", classIds)
          .order("name", { ascending: true });
        const options = Array.from(new Set((classes ?? []).map((c) => c.name as string))).sort((a, b) =>
          a.localeCompare(b, "fr"),
        );
        if (!mounted) return;
        setClassOptions(options);
      } finally {
        if (mounted) setClassesLoading(false);
      }
    }
    void loadClasses();
    return () => {
      mounted = false;
    };
  }, []);

  const canEdit = (data.status || "").toLowerCase() === "created";

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    if (!subject.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Matière requise",
        text: "Sélectionnez une matière dans la liste.",
      });
      return;
    }
    if (!className.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Classe requise",
        text: "Sélectionnez une classe dans la liste.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await backendFetch(`/evaluations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: (() => {
          const stored = toStoredQuestions(questions.map((q) => ({ ...q, points: Number(q.points || 0) })));
          return JSON.stringify({
            title: title.trim(),
            subject: subject.trim(),
            class_name: className.trim(),
            duration_minutes: durationMinutes,
            total_points: stored.totalPoints,
            questions: stored.questions,
            rubric: stored.rubric,
          });
        })(),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        evaluation?: EvaluationDetail;
      };
      if (!res.ok || !json.ok || !json.evaluation) {
        throw new Error(json.error ?? "Modification impossible.");
      }
      setData(json.evaluation);
      setTitle(json.evaluation.title);
      setSubject((json.evaluation.subject || "").trim());
      setClassName(
        (json.evaluation.class_name || json.evaluation.level || "").trim() || "",
      );
      setDurationMinutes(json.evaluation.duration_minutes ?? 60);
      if (Array.isArray(json.evaluation.questions)) {
        setQuestions(
          json.evaluation.questions.map((q, idx) => {
            const row = q as { id?: string; text?: string; points?: number };
            return {
              id: row.id || uid("q"),
              text: row.text || `Question ${idx + 1}`,
              points: Number(row.points ?? 1),
            };
          }),
        );
      }
      await Swal.fire({
        icon: "success",
        title: "Évaluation modifiée",
        timer: 1200,
        showConfirmButton: false,
      });
      router.refresh();
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "Erreur",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Modification impossible.",
      });
    } finally {
      setBusy(false);
    }
  }

  const showOrphanSubjectOption =
    Boolean(subject.trim()) &&
    !(KNOWN_SUBJECT_KEYS as readonly string[]).includes(subject.trim().toLowerCase());

  return (
    <section className="mb-6">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-expanded={sheetExpanded}
                aria-controls="feuille-test-panel"
                title={sheetExpanded ? "Masquer la feuille du test" : "Afficher la feuille du test"}
                aria-label={sheetExpanded ? "Masquer la feuille du test" : "Afficher la feuille du test"}
                onClick={() => setSheetExpanded((v) => !v)}
                className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                {sheetExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )}
              </button>
              <h2 id="feuille-test-heading" className="text-base font-semibold text-gray-900">
                Feuille du test
              </h2>
            </div>
            {!sheetExpanded ? (
              <p className="ml-9 mt-1 truncate text-sm text-gray-500">
                {title.trim() || "Sans titre"} · {className || "—"} · {questions.length} exercice
                {questions.length !== 1 ? "s" : ""} · {durationMinutes} min
              </p>
            ) : null}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(data.status)}`}>
            {statusLabelFr(data.status)}
          </span>
        </div>
        {sheetExpanded ? (
          <>
            <form
              id="feuille-test-panel"
              className="mt-3 space-y-3"
              onSubmit={onSave}
              aria-labelledby="feuille-test-heading"
            >
          <input
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            required
            disabled={!canEdit || busy}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Matière *</label>
              <select
                required={canEdit}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!canEdit || busy}
              >
                <option value="">Sélectionner la matière</option>
                <option value="math">Mathématiques</option>
                <option value="physics">Physique</option>
                <option value="science">Sciences</option>
                {showOrphanSubjectOption ? (
                  <option value={subject}>{subject}</option>
                ) : null}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Classe *</label>
              <select
                required={canEdit}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                disabled={
                  !canEdit || busy || classesLoading || classOptions.length === 0
                }
              >
                {classesLoading ? (
                  <option value="">Chargement des classes...</option>
                ) : classOptions.length === 0 ? (
                  <option value={className || ""}>
                    {className || "Aucune classe disponible"}
                  </option>
                ) : (
                  <>
                    <option value="">Sélectionner la classe</option>
                    {className && !classOptions.includes(className) ? (
                      <option value={className}>{className}</option>
                    ) : null}
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <input
              type="number"
              min={10}
              step={5}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(10, Number(e.target.value || 10)))}
              disabled={!canEdit || busy}
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="text-lg font-semibold text-gray-900">{title || "Titre de l'évaluation"}</h3>
            <div className="mt-4 space-y-4">
            <div className="space-y-3">
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
                              it.id === q.id
                                ? { ...it, points: Math.max(1, Number(e.target.value || 1)) }
                                : it,
                            ),
                          )
                        }
                        disabled={!canEdit || busy}
                        className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm outline-none ring-primary-500 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        disabled={!canEdit || busy || questions.length <= 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                    disabled={!canEdit || busy}
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
          </div>

          <Button
            type="button"
            variant="outline"
            className="border-gray-200"
            onClick={() =>
              setQuestions((prev) => [
                ...prev,
                { id: uid("q"), text: "Nouvelle question...", points: 1 },
              ])
            }
            disabled={!canEdit || busy}
          >
            <Plus className="h-4 w-4" />
            Ajouter une question
          </Button>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={!canEdit}
              loading={busy}
              loadingText="Enregistrement…"
            >
              Enregistrer
            </Button>
          </div>
        </form>
          </>
        ) : null}
      </div>
    </section>
  );
}

