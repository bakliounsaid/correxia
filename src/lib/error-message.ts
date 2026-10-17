import Swal from "sweetalert2";

/** Message affichable d'une erreur inconnue (Error, objet { message }, ou repli). */
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

/** Fenêtre d'erreur standard de l'application. */
export async function alertError(err: unknown, fallback: string): Promise<void> {
  await Swal.fire({ icon: "error", title: "Erreur", text: errorMessage(err, fallback) });
}

type ApiEnvelope = { ok?: boolean; error?: string };

/** Lit la réponse JSON de l'API et lève une erreur avec son message si elle a échoué. */
export async function readApiJson<T extends object = object>(
  res: Response,
  fallback: string,
): Promise<T & ApiEnvelope> {
  const data = (await res.json().catch(() => ({}))) as T & ApiEnvelope;
  if (!res.ok || data.ok === false) throw new Error(data.error ?? fallback);
  return data;
}
