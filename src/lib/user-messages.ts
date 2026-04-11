/** Textes utilisateur réutilisables (FR) — formulaires et alertes */
export const USER_MESSAGES = {
  emailPasswordRequired: "Renseignez l’email et le mot de passe.",
  passwordMinLength: "Le mot de passe doit contenir au moins 6 caractères.",
  passwordMismatch: "Les deux mots de passe ne correspondent pas.",
  signupFailed: "Inscription impossible pour le moment. Réessayez plus tard.",
  /** HTTP 429 — limite Supabase Auth (trop de tentatives), pas un souci d’URL ou de clé */
  authRateLimited:
    "Trop de tentatives d’inscription ou de connexion en peu de temps (limite Supabase). Ce n’est pas un problème de connexion à votre base : attendez 15 à 60 minutes, évitez les clics répétés sur « Envoyer », puis réessayez.",
  signupCheckEmail:
    "Compte créé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour activer l’accès, puis connectez-vous.",
  genericUnexpected: "Une erreur inattendue s’est produite. Réessayez.",
  configSupabase:
    "Configuration Supabase manquante : ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local à la racine du projet, puis redémarrez npm run dev.",
  configSupabaseShort:
    "Ajoutez un fichier .env.local avec les clés Supabase (URL + clé anon), puis redémarrez npm run dev.",
  fillRequiredFields: "Remplissez tous les champs obligatoires.",
  /** Case RGPD non cochée à l’inscription */
  rgpdConsentRequired:
    "Vous devez accepter le traitement de vos données (RGPD) pour créer un compte.",
  schoolSignupPending:
    "L’inscription établissement en ligne arrive bientôt. En attendant, contactez-nous via la page d’accueil (section Contact).",
  /** Utilisé avec setCustomValidity sur le champ confirmation */
  passwordConfirmMismatch: "Les deux mots de passe doivent être identiques.",
  /** Sous les champs après une tentative d’envoi */
  fieldRequired: "Ce champ est obligatoire.",
  emailInvalid: "Veuillez saisir une adresse email valide.",
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Message technique court (throw) — affichage utilisateur via USER_MESSAGES.configSupabase */
export const SUPABASE_ENV_ERROR =
  "NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant dans .env.local";

/** Paramètres ?error= sur /login, /register, etc. */
export function mapUrlErrorParam(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "auth_callback":
      return "La confirmation du lien a échoué ou a expiré. Redemandez un email ou connectez-vous.";
    case "access_denied":
      return "Accès refusé. Réessayez ou utilisez un autre compte.";
    default:
      return "Une erreur s’est produite lors de l’authentification. Réessayez.";
  }
}

/** Messages Supabase Auth (anglais API → français) */
export function mapAuthError(message: string, httpStatus?: number): string {
  if (httpStatus === 429) {
    return USER_MESSAGES.authRateLimited;
  }
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (m.includes("user already registered")) {
    return "Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez le mot de passe.";
  }
  if (m.includes("password") && m.includes("least")) {
    return USER_MESSAGES.passwordMinLength;
  }
  if (m.includes("email not confirmed")) {
    return "Confirmez d’abord votre email (lien reçu par message).";
  }
  if (m.includes("invalid email")) {
    return "Adresse email invalide.";
  }
  if (m.includes("signup_disabled")) {
    return "Les inscriptions sont temporairement désactivées.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return USER_MESSAGES.authRateLimited;
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Problème de connexion réseau. Vérifiez votre connexion internet.";
  }
  if (m.includes("jwt") || m.includes("token")) {
    return "Session expirée ou invalide. Déconnectez-vous et reconnectez-vous.";
  }
  return message;
}
