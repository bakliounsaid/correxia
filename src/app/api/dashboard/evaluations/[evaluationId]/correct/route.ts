import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getTeacherId } from "@/lib/teacher-context";
import { buildMathAssistHints, subjectUsesMathAssist } from "@/lib/math-correction-hints";

type ServerSupabase = ReturnType<typeof createSupabaseServerClient>;

/** Extrait le chemin storage du bucket `tests` depuis une URL publique ou signée Supabase. */
function getTestsStoragePathFromPublicUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const markers = ["/object/public/tests/", "/object/sign/tests/"];
    for (const marker of markers) {
      const idx = url.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(url.pathname.slice(idx + marker.length));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * OpenAI télécharge l’URL depuis ses serveurs : une URL « publique » Supabase peut être 403 si le bucket est privé.
 * On génère une URL signée avec la session enseignant pour que le téléchargement réussisse.
 */
async function resolveVisionImageUrl(fileUrl: string, supabase: ServerSupabase): Promise<string> {
  const path = getTestsStoragePathFromPublicUrl(fileUrl);
  if (!path) return fileUrl;
  const { data, error } = await supabase.storage.from("tests").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return fileUrl;
  return data.signedUrl;
}

function isLikelyPdfUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /\.pdf(\?|#|$)/i.test(u.pathname);
  } catch {
    return /\.pdf/i.test(url);
  }
}

type RevisionPassage = { zone: string; detail: string };

type CorrectionResult = {
  score: number;
  confidence: number;
  feedback: string;
  perExercise: Array<{ label: string; score: number; max: number; comment?: string }>;
  hasContent: boolean;
  contentDensity: number;
  /** Zones où la note repose sur une interprétation fragile (complète l’OCR). */
  notationIncertaine: RevisionPassage[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRevisionPassages(raw: unknown): RevisionPassage[] {
  if (!Array.isArray(raw)) return [];
  const out: RevisionPassage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const zone = String(o.zone ?? o.location ?? o.where ?? o.exercice ?? "").trim();
    const detail = String(o.detail ?? o.note ?? o.reason ?? o.description ?? "").trim();
    if (!zone && !detail) continue;
    out.push({ zone: zone || "Copie", detail: detail || zone });
  }
  return out;
}

function dedupePassages<T extends { zone: string; detail: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const it of items) {
    const k = `${it.zone.trim()}\n${it.detail.trim()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(it);
  }
  return result;
}

function uncertaintyPenaltyFromPassages(count: number): number {
  if (count <= 0) return 0;
  // Pénalité progressive plafonnée: quelques zones douteuses sont tolérées,
  // une copie largement ambiguë doit faire baisser clairement la confiance.
  return Math.min(0.25, 0.03 + count * 0.035);
}

type PerExerciseRow = { label: string; score: number; max: number; comment: string };

/**
 * Le modèle attribue parfois la note max tout en décrivant une erreur dans le commentaire.
 * On borne la note si le texte contredit une attribution pleine.
 */
const COMMENT_INDICATE_ERREUR = new RegExp(
  [
    "erreur\\s+(de|d'|dans|sur|aux?)",
    "erreurs\\s+",
    "incorrect",
    "incorrecte",
    "erroné",
    "erronée",
    "faux",
    "fausse",
    "n['’]est pas",
    "ne sont pas",
    "pas correct",
    "pas juste",
    "invalide",
    "mauvais",
    "mauvaise",
    "mal interpr",
    "interprétation.{0,60}(incorrect|erron|faus)",
    "conclusion.{0,50}(faus|incorrect|erron)",
    "ne convient pas",
    "inadéquat",
  ].join("|"),
  "i",
);

function commentSuggestsPenaltyAtFullScore(comment: string): boolean {
  const c = comment.trim();
  if (!c || !COMMENT_INDICATE_ERREUR.test(c)) return false;
  if (/(sans|aucune|pas\s+d['’])\s+erreur/i.test(c) && !/\bmais\b/i.test(c)) return false;
  return true;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/** Si note = max et commentaire négatif → plafond ~70 % du max (jamais plein pot avec erreur explicite). */
function reconcileScoreWithCommentCritique(items: PerExerciseRow[]): {
  rows: PerExerciseRow[];
  adjusted: boolean;
} {
  let adjusted = false;
  const rows = items.map((e) => {
    if (e.max <= 0) return e;
    const atFull = e.score >= e.max - 1e-6;
    if (!atFull) return e;
    const c = (e.comment || "").trim();
    if (!c || !commentSuggestsPenaltyAtFullScore(c)) return e;
    const cap = roundQuarter(e.max * 0.7);
    const newScore = clamp(Math.min(e.score, cap), 0, e.max);
    if (Math.abs(newScore - e.score) > 1e-6) adjusted = true;
    return { ...e, score: newScore };
  });
  return { rows, adjusted };
}

/**
 * Garde-fou ciblé: inversion du sens d'inégalité (<, >, <=, >=) ou confusion
 * "inférieur/supérieur" = erreur conceptuelle forte en maths/physique.
 * Si le commentaire signale explicitement cette inversion, on plafonne la note
 * de l'exercice à ~35% du max (erreur conceptuelle forte).
 */
function reconcileScoreWithInequalityDirectionConflict(items: PerExerciseRow[]): {
  rows: PerExerciseRow[];
  adjusted: boolean;
} {
  const conflictRegex = new RegExp(
    [
      "(<\\s*(au\\s+lieu\\s+de|au\\s+lieu\\s+d['’])\\s*>|>\\s*(au\\s+lieu\\s+de|au\\s+lieu\\s+d['’])\\s*<)",
      "(<=\\s*(au\\s+lieu\\s+de|au\\s+lieu\\s+d['’])\\s*>=|>=\\s*(au\\s+lieu\\s+de|au\\s+lieu\\s+d['’])\\s*<=)",
      "(signe\\s+d['’]?in[ée]galit[ée].{0,40}(faux|invers|incorrect|erron))",
      "(sens\\s+de\\s+l['’]?in[ée]galit[ée].{0,40}(faux|invers|incorrect|erron))",
      "(inf[ée]rieur.{0,40}(au\\s+lieu\\s+de|au\\s+lieu\\s+d['’]).{0,20}sup[ée]rieur)",
      "(sup[ée]rieur.{0,40}(au\\s+lieu\\s+de|au\\s+lieu\\s+d['’]).{0,20}inf[ée]rieur)",
    ].join("|"),
    "i",
  );

  let adjusted = false;
  const rows = items.map((e) => {
    if (e.max <= 0) return e;
    const c = (e.comment || "").trim();
    if (!c || !conflictRegex.test(c)) return e;
    const cap = roundQuarter(e.max * 0.35);
    const newScore = clamp(Math.min(e.score, cap), 0, e.max);
    if (Math.abs(newScore - e.score) > 1e-6) adjusted = true;
    return { ...e, score: newScore };
  });
  return { rows, adjusted };
}

const OCR_MODEL = process.env.OPENAI_OCR_MODEL ?? "gpt-4o";
const GRADE_MODEL = process.env.OPENAI_GRADE_MODEL ?? "gpt-4o-mini";

const ACADEMIC_CORRECTION_PROTOCOL = [
  "Tu es un expert en correction de copies scientifiques (maths, physique, sciences).",
  "Objectif: transcription fidèle du manuscrit puis notation strictement alignée sur le barème et la correction type fournis.",
  "Pour chaque exercice: (1) lister ce que l'élève a réellement écrit ou calculé, (2) comparer à la référence, (3) attribuer les points selon le barème (méthode, justesse, résultat).",
  "Distingue clairement: erreur de calcul mineure, erreur de méthode, réponse incomplète, notation juste mais mal rédigée.",
  "Si l'OCR est ambigu sur un symbole ou un chiffre, ne pas inventer: signaler l'incertitude et pénaliser prudemment ou baisser la confidence.",
  "Feedback: phrases courtes, factuelles, point par point (ce qui est acquis / ce qui manque / l'erreur précise).",
].join("\n");

const OCR_INSTRUCTIONS = [
  "Mission: OCR haute fidélité pour correction ultérieure. Réponse = un seul objet JSON valide.",
  "La feuille contient du texte imprimé (énoncé): IGNORE tout le texte clairement imprimé du sujet.",
  "Extrais UNIQUEMENT l'écriture manuscrite de l'élève: calculs, réponses, schémas annotés, ratures visibles.",
  "Transcris dans l'ordre de lecture (haut → bas). Pour chaque exercice du sujet, commence une section:",
  "=== Exercice N ===",
  "Symboles maths: restitue fidèlement + − × ÷ = < > ≤ ≥ √ ^ Δ π Σ ∫, fractions en ligne (a+b)/c ou a/b, exposants ^n si lisibles.",
  "Pour les calculs, privilégie une forme exploitable: exposants en ^2, ^3, racines sqrt(...), constante pi, multiplication explicite 3*(-2) si ambigu.",
  "Ne complète pas une démarche manquante. Si illisible: [illisible] ou (?). Ne déduis pas un chiffre douteux du seul contexte.",
  "Si aucune trace manuscrite utile: has_content=false, text vide, legibility basse.",
  "Format JSON strict:",
  '{"text": string, "legibility": number, "has_content": boolean, "content_density": number, "ocr_notes": string, "unreadable_parts": [{"zone": string, "detail": string}]}',
  "unreadable_parts: tableau vide si tout est lisible. Sinon une entrée par problème: zone = repère (ex. \"Exercice 2\", \"marge droite\"), detail = ce qui n’a pas pu être transcrit fidèlement (barré, flou, coupé…).",
  "ocr_notes: une phrase globale sur la qualité du scan ou chaîne vide.",
  "legibility, content_density ∈ [0,1].",
].join("\n");

async function ocrFromImageWithAi(imageUrl: string, apiKey: string, printedTemplateText: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OCR_MODEL,
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
                  OCR_INSTRUCTIONS,
                  "",
                  "Texte imprimé du sujet (à ne PAS recopier comme production élève):",
                  printedTemplateText.slice(0, 12000),
                ].join("\n"),
              },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      let detail = raw.slice(0, 320).replace(/\s+/g, " ").trim();
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        if (j?.error?.message) detail = j.error.message.slice(0, 320);
      } catch {
        /* garder detail brut */
      }
      throw new Error(
        detail ? `Erreur OCR IA (${res.status}): ${detail}` : `Erreur OCR IA (${res.status})`,
      );
    }
    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      text?: string;
      legibility?: number;
      has_content?: boolean;
      content_density?: number;
      ocr_notes?: string;
      unreadable_parts?: unknown;
    };
    const baseText = String(parsed.text ?? "").trim();
    const notes = String(parsed.ocr_notes ?? "").trim();
    const unreadableNormalized = normalizeRevisionPassages(parsed.unreadable_parts);
    const combined =
      notes && baseText
        ? `${baseText}\n\n[Notes OCR: ${notes}]`
        : notes && !baseText
          ? `[Notes OCR: ${notes}]`
          : baseText;
    return {
      text: combined,
      legibility: clamp(Number(parsed.legibility ?? 0.5), 0, 1),
      hasContent: Boolean(parsed.has_content),
      contentDensity: clamp(Number(parsed.content_density ?? 0.5), 0, 1),
      unreadableParts: unreadableNormalized,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function gradeWithAiText(
  studentText: string,
  correctionText: string,
  rubricAndQuestionsBlock: string,
  totalPoints: number,
  subject: string,
  legibility: number,
  hasContent: boolean,
  contentDensity: number,
  ocrUnreadableParts: RevisionPassage[],
  mathAssistHints: string,
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
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const userContent: Array<
      | { type: "text"; text: string }
    > = [
      {
        type: "text",
        text: [
          ACADEMIC_CORRECTION_PROTOCOL,
          "",
          "Tu corriges comme en contrôle classique: précis, motivé, sans généralités vagues.",
          "N'exige pas une copie conforme mot à mot à la correction type si la démarche et le résultat sont valides.",
          "En revanche, sois strict sur: erreurs de définition, erreurs de raisonnement, résultats faux, unités incohérentes, réponses hors sujet.",
          "Point CRITIQUE: en inégalités, le sens du signe est obligatoire. Si la correction attend '>' et que l'élève met '<' (ou l'inverse), c'est une erreur majeure.",
          "Même règle pour <= / >= et pour les formulations 'supérieur / inférieur': une inversion de sens doit entraîner une perte nette de points.",
          "Ne valide jamais comme 'juste' une conclusion dont le sens d'inégalité est inversé, même si le calcul intermédiaire est correct.",
          "Accorde des demi-points ou quarts de barème quand c'est pertinent; cite l'exigence du barème dans le commentaire d'exercice.",
          `Barème total de l'évaluation: ${totalPoints} points (la somme des \"max\" dans per_exercise doit rejoindre ce total).`,
          `Matière: ${subject || "math"}.`,
          `Lisibilité OCR (fiabilité transcription): ${Math.round(legibility * 100)}%.`,
          `has_content (pipeline): ${hasContent ? "true" : "false"}, content_density: ${contentDensity}.`,
          "Si la transcription contient [illisible] ou (?), intègre ce doute: ne pas sur-pénaliser un passage illisible, mais baisse confidence.",
          subjectGuidelines,
          "",
          "Référence officielle — questions + barème (respecte les points max par exercice):",
          rubricAndQuestionsBlock.slice(0, 14000),
          "",
          "Correction type (référence rédigée / OCR):",
          correctionText.slice(0, 12000),
          "",
          "Copie élève (transcription OCR structurée Exercice 1, 2…):",
          studentText.slice(0, 12000),
          "",
          ...(mathAssistHints
            ? [
                "Recoupement calculatoire automatique (bibliothèque mathjs sur le texte OCR — peut être faux si l’OCR est mauvais; la copie image reste la vérité):",
                mathAssistHints.slice(0, 6000),
                "",
              ]
            : []),
          "Passages déjà signalés comme peu lisibles par l’étape OCR (à reprendre dans notation_incertaine si la note en dépend encore):",
          JSON.stringify(ocrUnreadableParts.slice(0, 40)),
          "",
          "Réponds en JSON strict:",
          '{"score": number, "confidence": number, "feedback": string, "per_exercise": [{"label": string, "score": number, "max": number, "comment": string}], "has_content": boolean, "content_density": number, "notation_incertaine": [{"zone": string, "detail": string}]}',
          "Règles:",
          "- per_exercise: un objet par exercice du barème ci-dessus; chaque \"max\" = points prévus au barème pour cet exercice.",
          "- INTERDIT: pour tout exercice, score > max ou score < 0. Exemple invalide: 7/6. Chaque score doit être compris entre 0 et max inclus.",
          "- score (total) = somme des score de per_exercise (après respect des max); doit aussi être ≤ au barème total de l’évaluation.",
          "- comment: 1-3 phrases, ce qui est juste / faux / manquant, en référence au contenu élève (pas générique).",
          "- COHÉRENCE NOTE / COMMENTAIRE (obligatoire): si le commentaire d’un exercice signale une erreur, une conclusion fausse, une interprétation incorrecte ou une méthode invalide, la note de CET exercice NE PEUT PAS être le maximum. Réserve au moins 25–50 % des points selon la gravité.",
          "- Inégalités: si l'élève inverse le sens (< vs >, <= vs >=, supérieur vs inférieur), c'est une erreur conceptuelle importante: pas de note maximale et pénalité significative.",
          "- Exemple INTERDIT: « interprétation de l’angle erronée » ou « conclusion fausse » avec 6/6. Dans ce cas la note doit baisser (ex. 3–5/6 selon le barème partiel).",
          "- confidence 0-1: ta certitude sur la justesse de la correction compte tenu de l'OCR.",
          "- notation_incertaine: [] si tout est clair. Sinon une entrée par zone où l’enseignant doit relire la copie (ex. zone=\"Exercice 3\", detail=\"la note dépend d’un symbole ambigu dans la transcription\"). Ne duplique pas inutilement l’OCR si déjà couvert.",
          "- Si des indices mathjs contredisent ton interprétation du texte OCR, privilégie la cohérence avec l’énoncé et baisse confidence; l’image papier prime toujours sur le texte.",
          "- Si copie vide ou quasi vide: has_content false, score quasi nul, feedback explicite.",
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
        model: GRADE_MODEL,
        temperature: 0,
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
      notation_incertaine?: unknown;
    } = {};
    try {
      parsed = JSON.parse(content) as {
        score?: number;
        confidence?: number;
        feedback?: string;
        per_exercise?: Array<{ label?: string; score?: number; max?: number; comment?: string }>;
        has_content?: boolean;
        content_density?: number;
        notation_incertaine?: unknown;
      };
    } catch {
      parsed = {};
    }
    const notationIncertaine = normalizeRevisionPassages(parsed.notation_incertaine);
    const perExerciseRaw = Array.isArray(parsed.per_exercise) ? parsed.per_exercise : [];
    let perExercise: PerExerciseRow[] = perExerciseRaw
      .map((e, i) => ({
        label: String(e.label ?? `Exercice ${i + 1}`),
        score: Number(e.score ?? 0),
        max: Number(e.max ?? 0),
        comment: e.comment ? String(e.comment) : "",
      }))
      .filter((e) => e.max > 0)
      .map((e) => ({
        ...e,
        score: clamp(e.score, 0, e.max),
      }));
    const { rows: reconciled, adjusted: scoreCommentMismatchFixed } =
      reconcileScoreWithCommentCritique(perExercise);
    const { rows: reconciledIneq, adjusted: inequalityMismatchFixed } =
      reconcileScoreWithInequalityDirectionConflict(reconciled);
    perExercise = reconciledIneq;
    const perSum = perExercise.reduce((s, e) => s + e.score, 0);
    const modelTotal = clamp(Number(parsed.score ?? 0), 0, totalPoints);
    const rawScore =
      perExercise.length > 0 ? clamp(perSum, 0, totalPoints) : modelTotal;
    const coherencePenalty =
      perExercise.length > 0
        ? Math.min(0.25, Math.abs(perSum - rawScore) / Math.max(1, totalPoints))
        : 0;
    const hasContentModel = Boolean(parsed.has_content);
    const contentDensityModel = clamp(Number(parsed.content_density ?? contentDensity), 0, 1);
    const lowContent = !hasContent || !hasContentModel || contentDensityModel < 0.1;
    const guardedScore = lowContent ? 0 : rawScore;
    const rawConfidence = clamp(
      Number(parsed.confidence ?? 0.5) -
        coherencePenalty -
        (scoreCommentMismatchFixed ? 0.05 : 0) -
        (inequalityMismatchFixed ? 0.15 : 0),
      0,
      1,
    );
    const uncertaintyCount = dedupePassages([...ocrUnreadableParts, ...notationIncertaine]).length;
    const uncertaintyPenalty = uncertaintyPenaltyFromPassages(uncertaintyCount);
    const legibilityCap = Math.max(0.15, legibility);
    const guardedConfidencePreClamp = lowContent
      ? Math.min(rawConfidence, 0.35, legibilityCap)
      : Math.min(rawConfidence, legibilityCap + 0.2);
    const guardedConfidence = clamp(guardedConfidencePreClamp - uncertaintyPenalty, 0, 1);
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
      notationIncertaine,
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
  const rubricAndQuestionsBlock = [
    "Questions (structure officielle):",
    JSON.stringify(test.questions ?? [], null, 2),
    "",
    "Barème / rubrique (points par exercice — à respecter pour les champs max):",
    JSON.stringify(test.rubric ?? [], null, 2),
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
      const resolvedCorr = await resolveVisionImageUrl(correctionImageUrl, supabase);
      const corrOcr = await ocrFromImageWithAi(resolvedCorr, apiKey, "");
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
      const scanUrl = cp.scanned_image_url as string;
      if (isLikelyPdfUrl(scanUrl)) {
        throw new Error(
          "Fichier PDF : l’OCR attend une image (JPG ou PNG). Réimportez une photo ou un scan exporté en image, pas en PDF.",
        );
      }
      const resolvedScan = await resolveVisionImageUrl(scanUrl, supabase);
      const studentOcr = await ocrFromImageWithAi(resolvedScan, apiKey, printedTemplateText);
      const subjectStr = String(test.subject ?? "math");
      const mathAssistHints = subjectUsesMathAssist(subjectStr)
        ? buildMathAssistHints(studentOcr.text)
        : "";
      const grading = await gradeWithAiText(
        studentOcr.text,
        correctionReferenceText,
        rubricAndQuestionsBlock,
        totalPoints,
        subjectStr,
        studentOcr.legibility,
        studentOcr.hasContent,
        studentOcr.contentDensity,
        studentOcr.unreadableParts,
        mathAssistHints,
      );
      const passagesAVerifier = dedupePassages([
        ...studentOcr.unreadableParts.map((p) => ({ ...p, source: "ocr" as const })),
        ...grading.notationIncertaine.map((p) => ({ ...p, source: "notation" as const })),
      ]);
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
            passages_a_verifier: passagesAVerifier,
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

