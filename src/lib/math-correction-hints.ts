/**
 * Couche d’aide mathématique après OCR : évalue des fragments d’expressions
 * détectés dans le texte (mathjs). Ne remplace pas la vision IA — fournit des
 * indices de cohérence pour le prompt de notation.
 */

import { evaluate } from "mathjs";

function roundNice(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Normalise une portion de texte pour tentative d’évaluation numérique. */
export function normalizeMathFragment(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/×|·|⨉/g, "*").replace(/÷/g, "/");
  s = s.replace(/\s+/g, "");
  s = s.replace(/π/gi, "pi");
  s = s.replace(/√\(/g, "sqrt(").replace(/√(\d)/g, "sqrt($1)");
  s = s.replace(/(\d),(\d+)/g, "$1.$2");
  s = s.replace(/(\d)\(/g, "$1*(");
  s = s.replace(/(\))(\d)/g, "$1*$2");
  return s;
}

/** Caractères autorisés dans une expression soumise à mathjs (évite entrées trop larges). */
function isPlausiblySafeExpr(s: string): boolean {
  if (s.length > 96) return false;
  const withoutFns = s.replace(/\b(sqrt|abs|log|exp|sin|cos|tan|pi|e|i)\b/gi, "");
  return /^[\d+\-*/().^,]+$/.test(withoutFns);
}

/**
 * Tente d’extraire des égalités / expressions et d’en calculer la valeur.
 * Retourne un bloc texte pour enrichir le prompt de correction, ou chaîne vide.
 */
export function buildMathAssistHints(studentOcr: string): string {
  const hints: string[] = [];
  const lines = studentOcr.split(/\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("===") || line.startsWith("[Notes OCR")) continue;
    if (!line.includes("=")) continue;

    const parts = line.split("=");
    if (parts.length < 2) continue;
    const rhs = parts.slice(1).join("=").trim();
    const fragment = (rhs.split(/[;\]]|(?:\s{2,})/)[0] ?? "").trim();
    if (!fragment) continue;

    const norm = normalizeMathFragment(fragment);
    if (!norm || !isPlausiblySafeExpr(norm)) continue;

    try {
      const v = evaluate(norm) as unknown;
      let n: number;
      if (typeof v === "number") n = v;
      else if (v && typeof v === "object" && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
        n = (v as { toNumber: () => number }).toNumber();
      } else n = Number(v);
      if (!Number.isFinite(n)) continue;
      const preview = line.length > 90 ? `${line.slice(0, 87)}…` : line;
      hints.push(`« ${preview} » → partie droite normalisée \`${norm}\` ≈ ${roundNice(n)}`);
    } catch {
      /* expression non interprétable */
    }
  }

  if (hints.length === 0) return "";

  return [
    "Indices mathématiques automatiques (mathjs, à confronter à l’image — l’OCR peut être faux) :",
    ...hints.slice(0, 18),
  ].join("\n");
}

export function subjectUsesMathAssist(subject: string): boolean {
  const k = (subject || "").toLowerCase().trim();
  return k === "math" || k === "physics" || k === "science";
}
