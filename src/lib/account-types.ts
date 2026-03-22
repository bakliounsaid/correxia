/**
 * Types d’inscription CORREXIA (stockés dans user_metadata Supabase + trigger SQL).
 */
export const ACCOUNT_TYPE = {
  /** Enseignant indépendant — /register */
  TEACHER_INDEPENDENT: "teacher_independent",
  /** Administrateur d’établissement — onglet « Établissement » sur /register */
  SCHOOL_ADMIN: "school_admin",
  /** Admin plateforme — créé via script Admin API, pas via /register */
  PLATFORM_ADMIN: "platform_admin",
} as const;

export type AccountType =
  (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];
