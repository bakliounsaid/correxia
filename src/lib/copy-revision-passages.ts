/** Normalise `passages_a_verifier` stocké en JSON (copie_corrections.ai_analysis_json). */
export function parsePassagesAVerifier(raw: unknown): Array<{
  zone: string;
  detail: string;
  source?: string;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ zone: string; detail: string; source?: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const zone = String(o.zone ?? "").trim();
    const detail = String(o.detail ?? "").trim();
    const sourceRaw = o.source != null ? String(o.source).trim() : "";
    if (!zone && !detail) continue;
    const row: { zone: string; detail: string; source?: string } = {
      zone: zone || "Copie",
      detail: detail || zone,
    };
    if (sourceRaw) row.source = sourceRaw;
    out.push(row);
  }
  return out;
}
