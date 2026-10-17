import { SUPABASE_ENV_ERROR, USER_MESSAGES } from "@/lib/user-messages";

/** Erreur JS (réseau, configuration, réponse API) → message affichable (FR) */
export function mapApiError(error: unknown): string {
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
