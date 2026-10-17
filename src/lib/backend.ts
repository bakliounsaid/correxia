import { getSupabaseBrowserClient } from "@/lib/supabase";

const API_PREFIX = "/api/v1";

/**
 * URL de l'API FastAPI (backend/). Accepte « https://api.example.com » comme « https://api.example.com/api/v1 » :
 * l'oubli du préfixe dans la variable d'environnement est une erreur de déploiement fréquente.
 */
export function apiBaseUrl(configured: string | undefined): string {
  const base = (configured || "http://localhost:8000").trim().replace(/\/+$/, "");
  return base.endsWith(API_PREFIX) ? base : `${base}${API_PREFIX}`;
}

const API_URL = apiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

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
