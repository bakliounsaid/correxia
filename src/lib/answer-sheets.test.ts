import { describe, expect, it } from "vitest";
import {
  type CopyUploadTarget,
  importSummary,
  indexCopiesByQr,
  resolveSheetTarget,
  SHEET_ERRORS,
} from "@/lib/answer-sheets";

const copy = (id: string, qr: string | null): CopyUploadTarget => ({
  id,
  created_at: "2026-01-01T00:00:00Z",
  status: "generated",
  scanned_image_url: null,
  unique_test_id: qr,
});

describe("indexCopiesByQr", () => {
  it("indexe les copies par QR et ignore celles sans code", () => {
    const index = indexCopiesByQr([copy("1", "CX-A"), copy("2", null), copy("3", "CX-B")]);
    expect(Array.from(index.keys())).toEqual(["CX-A", "CX-B"]);
    expect(index.get("CX-B")?.id).toBe("3");
  });
});

describe("resolveSheetTarget", () => {
  const index = indexCopiesByQr([copy("1", "CX-A"), copy("2", "CX-B")]);

  it("retrouve la copie du QR lu", () => {
    expect(resolveSheetTarget("CX-B", index, new Set()).id).toBe("2");
  });

  it("refuse un QR illisible, inconnu ou déjà importé", () => {
    expect(() => resolveSheetTarget(null, index, new Set())).toThrow(SHEET_ERRORS.qrUnreadable);
    expect(() => resolveSheetTarget("CX-Z", index, new Set())).toThrow(SHEET_ERRORS.unknownQr);
    expect(() => resolveSheetTarget("CX-A", index, new Set(["1"]))).toThrow(SHEET_ERRORS.duplicate);
  });
});

describe("importSummary", () => {
  it("résume l'import et limite les erreurs affichées à deux", () => {
    expect(importSummary(3, 3, [])).toBe("3 feuille(s) importée(s). 0 copie(s) sans feuille valide.");
    expect(importSummary(1, 4, ["a.png: x", "b.png: y", "c.png: z"])).toBe(
      "1 feuille(s) importée(s). 3 copie(s) sans feuille valide. Erreurs: a.png: x | b.png: y",
    );
  });
});
