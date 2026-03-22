import axios from "axios";
import { SUPABASE_ENV_ERROR, USER_MESSAGES } from "@/lib/user-messages";

function detailToString(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return String(item);
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/** Erreurs API FastAPI / Axios / Error JS → message affichable (FR) */
export function mapApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      if ("detail" in data) {
        const text = detailToString(data.detail);
        if (text) return text;
      }
      if ("message" in data && typeof data.message === "string") {
        return data.message;
      }
    }
    if (status === 401) {
      return "Session expirée ou non autorisée. Reconnectez-vous.";
    }
    if (status === 403) {
      return "Vous n’avez pas les droits pour cette action.";
    }
    if (status === 404) {
      return "Ressource introuvable.";
    }
    if (status === 422) {
      return "Données invalides. Vérifiez les champs du formulaire.";
    }
    if (status && status >= 500) {
      return "Le serveur est temporairement indisponible. Réessayez plus tard.";
    }
    if (error.code === "ECONNABORTED") {
      return "La requête a expiré. Réessayez.";
    }
    if (error.code === "ERR_NETWORK" || !error.response) {
      return "Impossible de joindre le serveur. Vérifiez que l’API est démarrée et l’URL (NEXT_PUBLIC_API_URL).";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) {
    if (
      error.message.includes("NEXT_PUBLIC_SUPABASE") ||
      error.message === SUPABASE_ENV_ERROR
    ) {
      return USER_MESSAGES.configSupabase;
    }
    return error.message;
  }
  return USER_MESSAGES.genericUnexpected;
}
