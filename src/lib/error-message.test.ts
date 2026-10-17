import { describe, expect, it } from "vitest";
import { errorMessage, readApiJson } from "@/lib/error-message";

describe("errorMessage", () => {
  it("lit le message d'une Error ou d'un objet { message }", () => {
    expect(errorMessage(new Error("Boom"), "repli")).toBe("Boom");
    expect(errorMessage({ message: "Objet" }, "repli")).toBe("Objet");
  });

  it("utilise le repli pour une valeur sans message exploitable", () => {
    expect(errorMessage(null, "repli")).toBe("repli");
    expect(errorMessage("texte", "repli")).toBe("repli");
    expect(errorMessage({ message: "  " }, "repli")).toBe("repli");
  });
});

describe("readApiJson", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("renvoie les données d'une réponse réussie", async () => {
    await expect(readApiJson<{ n: number }>(json({ ok: true, n: 3 }), "x")).resolves.toMatchObject({ n: 3 });
  });

  it("lève l'erreur renvoyée par l'API", async () => {
    await expect(readApiJson(json({ error: "Quota atteint" }, 402), "x")).rejects.toThrow("Quota atteint");
    await expect(readApiJson(json({ ok: false, error: "Refusé" }), "x")).rejects.toThrow("Refusé");
  });

  it("utilise le repli si la réponse n'est pas du JSON", async () => {
    await expect(readApiJson(new Response("<html>", { status: 500 }), "Serveur indisponible")).rejects.toThrow(
      "Serveur indisponible",
    );
  });
});
