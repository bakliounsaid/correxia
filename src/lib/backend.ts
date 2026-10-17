import { getSupabaseBrowserClient } from "@/lib/supabase";

/** URL de l'API FastAPI (backend/), ex. http://localhost:8000/api/v1 en local. */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

/**
 * Appel à l'API métier FastAPI depuis le navigateur, avec le jeton de session Supabase.
 * Même usage que fetch() : renvoie la Response (le backend répond `{ error }` en cas d'échec).
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers });
  } catch {
    // Réseau / backend arrêté : réponse au même format que les erreurs de l'API.
    return new Response(
      JSON.stringify({ error: "Impossible de joindre le serveur. Réessayez dans un instant." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
