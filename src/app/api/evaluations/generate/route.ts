import { NextResponse } from "next/server";

type GenerateBody = {
  title?: string;
  className?: string;
  complexity?: "facile" | "moyen" | "difficile";
  courseContext?: string;
  hasCourseFile?: boolean;
  rubric?: Array<{ label?: string; points?: number }>;
};

type GeneratedPayload = {
  questions: string[];
  rubric: Array<{ label: string; points: number }>;
};

function normalizeQuestionValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const obj = value as {
    text?: unknown;
    question?: unknown;
    title?: unknown;
    statement?: unknown;
    content?: unknown;
    prompt?: unknown;
  };
  const candidate = [
    obj.text,
    obj.question,
    obj.title,
    obj.statement,
    obj.content,
    obj.prompt,
  ].find((v) => typeof v === "string" && String(v).trim().length > 0);
  return typeof candidate === "string" ? candidate.trim() : "";
}

/** Ajuste les points du barème pour que la somme soit exactement 20 (parts entières, méthode des plus forts restes). */
function normalizeRubricSum20(
  rubric: Array<{ label: string; points: number }>,
): Array<{ label: string; points: number }> {
  if (!rubric.length) return rubric;
  const sum = rubric.reduce((s, r) => s + r.points, 0);
  if (sum === 20) return rubric;
  if (sum <= 0) return rubric;
  const scaled = rubric.map((r) => (r.points / sum) * 20);
  const floors = scaled.map((x) => Math.floor(x));
  const deficit = 20 - floors.reduce((a, b) => a + b, 0);
  const remainder = scaled.map((x, i) => ({ i, frac: x - floors[i] }));
  remainder.sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < deficit; k++) {
    out[remainder[k].i] += 1;
  }
  return rubric.map((r, i) => ({ label: r.label, points: out[i] }));
}

function fallbackPayload(body: GenerateBody): GeneratedPayload {
  const level = body.complexity ?? "moyen";
  const lvlHint =
    level === "facile"
      ? "restitution et application directe"
      : level === "difficile"
        ? "analyse et justification avancée"
        : "raisonnement intermédiaire";
  return {
    questions: [
      `Définir les notions clés du cours (${lvlHint}).`,
      "Résoudre un exercice d'application étape par étape.",
      "Expliquer et justifier la méthode choisie sur un cas similaire.",
    ],
    rubric: [
      { label: "Compréhension du cours", points: 6 },
      { label: "Méthode et raisonnement", points: 8 },
      { label: "Qualité de la rédaction", points: 6 },
    ],
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as GenerateBody;
  const title = (body.title ?? "").trim();
  const className = (body.className ?? "").trim();
  const courseContext = (body.courseContext ?? "").trim();
  const hasCourseFile = Boolean(body.hasCourseFile);
  const complexity = body.complexity ?? "moyen";
  const rubricText =
    (body.rubric ?? [])
      .map((r) => `${String(r.label ?? "").trim()} (${Number(r.points ?? 0)} pts)`)
      .filter((v) => !v.startsWith(" (0 pts)") && !v.startsWith(" (NaN pts)"))
      .join(", ") || "Aucun barème fourni.";

  if (!title || !className) {
    return NextResponse.json(
      { error: "Titre et classe sont requis." },
      { status: 400 },
    );
  }
  if (!courseContext && !hasCourseFile) {
    return NextResponse.json(
      { error: "Ajoutez un cours PDF ou une description du cours." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY manquante. Ajoutez-la dans .env.local puis redémarrez le serveur.",
      },
      { status: 500 },
    );
  }

  try {
    const prompt = [
      "Tu es un générateur d'évaluations scolaires.",
      "Réponds strictement en JSON avec les clés questions (string[]) et rubric ({label, points}[]).",
      `Titre: ${title}`,
      `Classe: ${className}`,
      `Complexité: ${complexity}`,
      `Barème à respecter: ${rubricText}`,
      courseContext
        ? "Contenu du cours :\n" + courseContext
        : "Aucun contenu de cours fourni. Génère une évaluation cohérente avec le titre, la classe et la complexité.",
      "Contraintes: 3 à 6 questions maximum, format exercice clair, espace de réponse implicite.",
      "L'évaluation est notée sur 20 au total : la somme des points du tableau rubric doit être exactement 20.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      return NextResponse.json(
        { error: `Erreur API IA: ${txt.slice(0, 240)}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: Partial<GeneratedPayload> = {};
    try {
      parsed = JSON.parse(content) as Partial<GeneratedPayload>;
    } catch {
      parsed = fallbackPayload(body);
    }

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map(normalizeQuestionValue).filter(Boolean).slice(0, 8)
      : [];
    let rubric = Array.isArray(parsed.rubric)
      ? parsed.rubric
          .map((r) => ({
            label: String(r?.label ?? "").trim(),
            points: Number(r?.points ?? 0),
          }))
          .filter((r) => r.label && r.points > 0)
      : [];

    if (rubric.length) {
      rubric = normalizeRubricSum20(rubric);
    }

    const safe = {
      questions: questions.length ? questions : fallbackPayload(body).questions,
      rubric: rubric.length ? rubric : fallbackPayload(body).rubric,
    };

    return NextResponse.json({ ok: true, ...safe });
  } catch {
    const safe = fallbackPayload(body);
    return NextResponse.json({ ok: true, ...safe });
  }
}

