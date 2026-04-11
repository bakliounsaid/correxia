import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";

type CorrectionResult = {
  score: number;
  confidence: number;
  feedback: string;
  perExercise: Array<{ label: string; score: number; max: number; comment?: string }>;
  hasContent: boolean;
  contentDensity: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const ACADEMIC_CORRECTION_PROTOCOL = [
  "Agis en tant qu'expert en correction académique spécialisé dans l'analyse de documents manuscrits.",
  "Objectif: extraire le contenu de la copie via OCR puis appliquer une logique de correction rigoureuse basée exclusivement sur le barème et les réponses types fournis.",
  "Pour chaque question, décompose l'analyse en 3 étapes:",
  "1) identifier les étapes de raisonnement présentes dans la copie,",
  "2) comparer aux solutions de référence,",
  "3) attribuer les points proportionnellement en respectant les pénalités (erreur de calcul vs erreur de méthode).",
  "En cas d'ambiguïté OCR sur un chiffre/symbole, utiliser le contexte scientifique pour vérifier la cohérence avant de noter.",
  "Produire un feedback structuré justifiant chaque point retiré, pour une transparence totale du curseur de notation.",
].join("\n");

async function ocrFromImageWithAi(imageUrl: string, apiKey: string, printedTemplateText: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
          ACADEMIC_CORRECTION_PROTOCOL,
          "",
                  "Fais une extraction OCR orientée correction et réponds strictement en JSON.",
                  "IMPORTANT: la feuille contient le sujet imprimé. IGNORE ce texte imprimé.",
                  "Ne conserve que le contenu ajouté par l'élève (écriture manuscrite/annotations/calculs).",
                  "Si tu ne détectes aucun ajout élève net, has_content=false et text vide.",
                  "Format: {\"text\": string, \"legibility\": number, \"has_content\": boolean, \"content_density\": number}",
                  "legibility entre 0 et 1 (qualité de lecture).",
                  "has_content=false si copie vide/quasi vide.",
                  "content_density entre 0 et 1.",
                  "",
                  "Texte imprimé de référence à exclure:",
                  printedTemplateText.slice(0, 12000),
                ].join("\n"),
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Erreur OCR IA (${res.status})`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      text?: string;
      legibility?: number;
      has_content?: boolean;
      content_density?: number;
    };
    return {
      text: String(parsed.text ?? "").trim(),
      legibility: clamp(Number(parsed.legibility ?? 0.5), 0, 1),
      hasContent: Boolean(parsed.has_content),
      contentDensity: clamp(Number(parsed.content_density ?? 0.5), 0, 1),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function gradeWithAiText(
  studentText: string,
  correctionText: string,
  totalPoints: number,
  subject: string,
  legibility: number,
  hasContent: boolean,
  contentDensity: number,
): Promise<CorrectionResult> {
  const subjectKey = (subject || "").toLowerCase();
  const subjectGuidelines =
    subjectKey === "physics"
      ? [
          "Spécifique physique: valorise les lois correctes, unités cohérentes, schéma/raisonnement expérimental.",
          "Tolère une autre voie de résolution si les hypothèses et dimensions sont cohérentes.",
        ].join("\n")
      : subjectKey === "science"
        ? [
            "Spécifique sciences: valorise causalité, vocabulaire scientifique pertinent, justification par observations/faits.",
            "Accepte des formulations différentes si le mécanisme scientifique est correct.",
          ].join("\n")
        : [
            "Spécifique mathématiques: valorise la méthode, les étapes intermédiaires et la justesse logique.",
            "Accepte une méthode alternative valide même si différente de la correction type.",
          ].join("\n");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquante.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const userContent: Array<
      | { type: "text"; text: string }
    > = [
      {
        type: "text",
        text: [
          ACADEMIC_CORRECTION_PROTOCOL,
          "",
          "Tu es un correcteur scolaire.",
          "IMPORTANT: n'exige PAS une réponse identique mot à mot.",
          "Accepte les méthodes différentes si elles sont mathématiquement/scientifiquement valides.",
          "Évalue le raisonnement, la cohérence des étapes, et le résultat final.",
          "Accorde du crédit partiel quand la démarche est correcte mais incomplète.",
          "N'applique une forte pénalité que sur les erreurs conceptuelles majeures.",
          "Si la forme diffère mais le fond est juste, la note doit rester élevée.",
          `Barème total: ${totalPoints} points.`,
          `Matière: ${subject || "math"}.`,
          `Lisibilité OCR détectée: ${Math.round(legibility * 100)}%`,
          `has_content: ${hasContent ? "true" : "false"}, content_density: ${contentDensity}`,
          subjectGuidelines,
          "Réponds strictement en JSON: {\"score\": number, \"confidence\": number, \"feedback\": string, \"per_exercise\": [{\"label\": string, \"score\": number, \"max\": number, \"comment\": string}], \"has_content\": boolean, \"content_density\": number}",
          "confidence entre 0 et 1.",
          "Définition de confidence: pourcentage de lisibilité/compréhension de la copie élève.",
          "Si l'écriture est floue, incomplète, ambiguë ou illisible, baisse nettement confidence.",
          "Si la copie est claire et facilement lisible, confidence doit être élevée.",
          "has_content = false si la copie est vide ou quasi vide (hors en-tête).",
          "content_density entre 0 et 1 (0 = vide, 1 = très rempli).",
          "Si has_content=false ou content_density<0.1: score doit être très faible (0 à 2/20).",
          "feedback: 2-4 phrases, expliquant forces/faiblesses sans comparaison littérale de texte.",
          "per_exercise: une ligne par exercice avec score/max.",
          "",
          "Correction type OCR/texte:",
          correctionText.slice(0, 12000),
          "",
          "Copie élève OCR:",
          studentText.slice(0, 12000),
        ].join("\n"),
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`Erreur IA (${response.status}): ${errTxt.slice(0, 180)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      score?: number;
      confidence?: number;
      feedback?: string;
      per_exercise?: Array<{ label?: string; score?: number; max?: number; comment?: string }>;
      has_content?: boolean;
      content_density?: number;
    } = {};
    try {
      parsed = JSON.parse(content) as {
        score?: number;
        confidence?: number;
        feedback?: string;
        per_exercise?: Array<{ label?: string; score?: number; max?: number; comment?: string }>;
        has_content?: boolean;
        content_density?: number;
      };
    } catch {
      parsed = {};
    }
    const perExerciseRaw = Array.isArray(parsed.per_exercise) ? parsed.per_exercise : [];
    const perExercise = perExerciseRaw
      .map((e, i) => ({
        label: String(e.label ?? `Exercice ${i + 1}`),
        score: Number(e.score ?? 0),
        max: Number(e.max ?? 0),
        comment: e.comment ? String(e.comment) : "",
      }))
      .filter((e) => e.max > 0);
    const perSum = perExercise.reduce((s, e) => s + e.score, 0);
    const coherencePenalty =
      perExercise.length > 0
        ? Math.min(0.25, Math.abs(perSum - Number(parsed.score ?? 0)) / Math.max(1, totalPoints))
        : 0;
    const hasContentModel = Boolean(parsed.has_content);
    const contentDensityModel = clamp(Number(parsed.content_density ?? contentDensity), 0, 1);
    const lowContent = !hasContent || !hasContentModel || contentDensityModel < 0.1;
    const rawScore = clamp(Number(parsed.score ?? 0), 0, totalPoints);
    const guardedScore = lowContent ? 0 : rawScore;
    const rawConfidence = clamp(Number(parsed.confidence ?? 0.5) - coherencePenalty, 0, 1);
    const legibilityCap = Math.max(0.15, legibility);
    const guardedConfidence = lowContent
      ? Math.min(rawConfidence, 0.35, legibilityCap)
      : Math.min(rawConfidence, legibilityCap + 0.2);
    const guardedFeedback = lowContent
      ? "Copie détectée comme vide ou quasi vide : note fixée à 0/20. Vérification enseignant recommandée."
      : String(parsed.feedback ?? "Correction IA générée.");
    return {
      score: guardedScore,
      confidence: guardedConfidence,
      feedback: guardedFeedback,
      perExercise,
      hasContent: hasContent && hasContentModel,
      contentDensity: contentDensityModel,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isLikelyImageUrl(url: string | null | undefined) {
  if (!url) return false;
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}

export async function POST(
  _req: Request,
  { params }: { params: { evaluationId: string } },
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const teacherId = await getTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "Profil enseignant introuvable." }, { status: 403 });
  }

  const { data: test } = await supabase
    .from("tests")
    .select("id, teacher_id, total_points, correction_file_url, subject, questions, rubric")
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!test) return NextResponse.json({ error: "Évaluation introuvable." }, { status: 404 });
  if (!test.correction_file_url) {
    return NextResponse.json({ error: "Correction type manquante." }, { status: 409 });
  }

  const { data: copies } = await supabase
    .from("test_copies")
    .select("id, student_id, scanned_image_url")
    .eq("test_id", params.evaluationId)
    .eq("teacher_id", teacherId)
    .not("scanned_image_url", "is", null);
  const candidates = (copies ?? []).filter((c) => Boolean(c.scanned_image_url));
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Aucune feuille élève à corriger (scan manquant)." }, { status: 409 });
  }

  const totalPoints = Number(test.total_points ?? 20) || 20;
  const correctionTextFallback = [
    "Questions:",
    JSON.stringify(test.questions ?? [], null, 2),
    "",
    "Barème:",
    JSON.stringify(test.rubric ?? [], null, 2),
  ].join("\n");
  const printedTemplateText = [
    "Sujet imprimé (questions):",
    JSON.stringify(test.questions ?? [], null, 2),
  ].join("\n");
  const correctionImageUrl = isLikelyImageUrl(test.correction_file_url as string | null)
    ? (test.correction_file_url as string)
    : null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY manquante." }, { status: 500 });
  }
  let correctionOcrText = "";
  if (correctionImageUrl) {
    try {
      const corrOcr = await ocrFromImageWithAi(correctionImageUrl, apiKey, "");
      correctionOcrText = corrOcr.text;
    } catch {
      correctionOcrText = "";
    }
  }
  const correctionReferenceText = correctionOcrText || correctionTextFallback;
  let corrected = 0;
  const failures: string[] = [];

  for (const cp of candidates) {
    try {
      const studentOcr = await ocrFromImageWithAi(
        cp.scanned_image_url as string,
        apiKey,
        printedTemplateText,
      );
      const grading = await gradeWithAiText(
        studentOcr.text,
        correctionReferenceText,
        totalPoints,
        String(test.subject ?? "math"),
        studentOcr.legibility,
        studentOcr.hasContent,
        studentOcr.contentDensity,
      );
      const now = new Date().toISOString();

      const { error: upsertError } = await supabase.from("copy_corrections").upsert(
        {
          copy_id: cp.id,
          test_id: params.evaluationId,
          student_id: cp.student_id,
          teacher_id: teacherId,
          ai_analysis_json: {
            feedback: grading.feedback,
            per_exercise: grading.perExercise,
            has_content: grading.hasContent,
            content_density: grading.contentDensity,
          },
          ai_confidence_score: grading.confidence,
          ai_total_points: grading.score,
          ai_processed_at: now,
          processing_status: "completed",
          validation_status: "pending",
          is_validated: false,
        },
        { onConflict: "copy_id" },
      );
      if (upsertError) throw upsertError;

      await supabase
        .from("test_copies")
        .update({ status: "pending_review" })
        .eq("id", cp.id)
        .eq("test_id", params.evaluationId)
        .eq("teacher_id", teacherId);

      corrected += 1;
    } catch (err: unknown) {
      failures.push(
        `Copie ${cp.id.slice(0, 8)}: ${
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "échec"
        }`,
      );
    }
  }

  const { count } = await supabase
    .from("copy_corrections")
    .select("id", { count: "exact", head: true })
    .eq("test_id", params.evaluationId);
  await supabase
    .from("tests")
    .update({ copies_corrected: count ?? corrected })
    .eq("id", params.evaluationId)
    .eq("teacher_id", teacherId);

  return NextResponse.json({
    ok: true,
    corrected,
    total: candidates.length,
    failures,
  });
}

