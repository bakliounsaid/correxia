/** Import des feuilles d'examen scannées : association scan → copie via le QR code imprimé. */

export type CopyUploadTarget = {
  id: string;
  created_at: string;
  status: string;
  scanned_image_url: string | null;
  unique_test_id: string | null;
};

export const SHEET_ERRORS = {
  notImage:
    "Format non supporté pour la lecture du QR : utilisez une photo ou un scan JPG ou PNG (pas de PDF).",
  qrUnreadable:
    "QR code introuvable ou illisible : exportez la page en entier (évitez le zoom sur une zone), bonne lumière, pas de flou. Les applis « PDF Scanner » avec grosses marges noires posent souvent problème — préférez une photo de la feuille seule ou régénérez les copies (QR plus grand).",
  unknownQr: "QR code non lié à une copie de ce test",
  duplicate: "copie déjà importée dans ce lot (doublon QR)",
} as const;

/** Copies indexées par code QR, dans l'ordre de création. */
export function indexCopiesByQr(copies: CopyUploadTarget[]): Map<string, CopyUploadTarget> {
  const sorted = [...copies].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return new Map(
    sorted.filter((c) => Boolean(c.unique_test_id)).map((c) => [c.unique_test_id as string, c]),
  );
}

/** Copie correspondant au QR lu, ou erreur explicite (QR illisible, inconnu ou déjà importé). */
export function resolveSheetTarget(
  qrValue: string | null,
  copiesByQr: Map<string, CopyUploadTarget>,
  alreadyImported: Set<string>,
): CopyUploadTarget {
  if (!qrValue) throw new Error(SHEET_ERRORS.qrUnreadable);
  const target = copiesByQr.get(qrValue);
  if (!target) throw new Error(SHEET_ERRORS.unknownQr);
  if (alreadyImported.has(target.id)) throw new Error(SHEET_ERRORS.duplicate);
  return target;
}

export function importSummary(imported: number, totalCopies: number, failures: string[]): string {
  return [
    `${imported} feuille(s) importée(s).`,
    `${totalCopies - imported} copie(s) sans feuille valide.`,
    failures.length > 0 ? `Erreurs: ${failures.slice(0, 2).join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
