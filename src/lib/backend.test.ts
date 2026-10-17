import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: () => ({ auth: { getSession } }) }));

import { apiBaseUrl, backendFetch } from "@/lib/backend";

describe("apiBaseUrl", () => {
  it.each([
    ["https://correxia-2.onrender.com", "https://correxia-2.onrender.com/api/v1"],
    ["https://correxia-2.onrender.com/", "https://correxia-2.onrender.com/api/v1"],
    ["https://correxia-2.onrender.com/api/v1", "https://correxia-2.onrender.com/api/v1"],
    ["https://correxia-2.onrender.com/api/v1/", "https://correxia-2.onrender.com/api/v1"],
    [undefined, "http://localhost:8000/api/v1"],
  ])("%s → %s", (configured, expected) => {
    expect(apiBaseUrl(configured)).toBe(expected);
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
});

describe("backendFetch", () => {
  it("appelle l'API avec le jeton de session et le JSON", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "jwt-123" } } });
    await backendFetch("/evaluations/ev1", { method: "PATCH", body: JSON.stringify({ a: 1 }) });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/evaluations/ev1");
    expect(init.method).toBe("PATCH");
    expect(init.headers.get("Authorization")).toBe("Bearer jwt-123");
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });

  it("n'envoie pas d'en-tête Authorization sans session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await backendFetch("contact", { method: "POST", body: "{}" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/contact");
    expect(init.headers.has("Authorization")).toBe(false);
  });

  it("transforme une panne réseau en réponse d'erreur lisible", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const res = await backendFetch("/billing/quota");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Impossible de joindre le serveur. Réessayez dans un instant." });
  });
});
