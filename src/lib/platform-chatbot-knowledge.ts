/**
 * Base de connaissances du chat d’aide CORREXIA (sans appel API externe).
 * Correspondance par mots-clés sur le texte normalisé.
 */

export type PlatformKnowledgeEntry = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
};

export const PLATFORM_CHATBOT_INTRO =
  "Bonjour ! Je suis l’assistant CORREXIA. Posez votre question sur la plateforme, ou choisissez une suggestion ci-dessous.";

export const PLATFORM_KNOWLEDGE: PlatformKnowledgeEntry[] = [
  {
    id: "correction",
    title: "Correction & copies",
    keywords: [
      "corriger",
      "correction",
      "copie",
      "copies",
      "scanner",
      "photo",
      "bareme",
      "barème",
      "ia",
      "valider",
    ],
    answer:
      "Vous importez le sujet (PDF), définissez le barème, puis déposez les copies scannées ou photographiées. L’IA propose une correction : vous validez ou ajustez avant publication. Les matières visées sont surtout les sciences (maths, physique, sciences).",
  },
  {
    id: "evaluations",
    title: "Évaluations",
    keywords: [
      "evaluation",
      "évaluation",
      "test",
      "evaluations",
      "examen",
      "devoir",
    ],
    answer:
      "Les évaluations se gèrent depuis le tableau de bord : création, suivi des copies, statuts (soumis, en relecture, validé, etc.). Vous pouvez lancer la correction groupée et consulter chaque copie.",
  },
  {
    id: "tarifs",
    title: "Tarifs & packs",
    keywords: [
      "prix",
      "tarif",
      "pack",
      "gratuit",
      "free",
      "abonnement",
      "payer",
      "essai",
      "stripe",
    ],
    answer:
      "Les enseignants indépendants ont un pack Essentiel gratuit (limite copies / durée selon les règles affichées sur la page Tarifs). Des packs payants (Avancé, Maîtrise) existent. Les établissements ont une offre démo puis des formules selon contrat — voir la page d’accueil, section Tarifs.",
  },
  {
    id: "ecole",
    title: "Compte établissement",
    keywords: [
      "ecole",
      "établissement",
      "lycee",
      "lycée",
      "college",
      "collège",
      "directeur",
      "admin",
      "enseignant",
      "rattach",
    ],
    answer:
      "Un administrateur établissement peut gérer enseignants, classes et élèves. Les enseignants rattachés à une école utilisent le même espace avec des droits adaptés. L’inscription établissement passe par le parcours dédié sur le site.",
  },
  {
    id: "compte",
    title: "Compte & connexion",
    keywords: [
      "compte",
      "connexion",
      "login",
      "inscription",
      "mot de passe",
      "email",
      "deconnexion",
      "déconnexion",
    ],
    answer:
      "Créez un compte via Inscription, confirmez votre email si demandé, puis connectez-vous. En cas de blocage (trop de tentatives), attendez un peu avant de réessayer. La déconnexion est disponible dans le menu du tableau de bord.",
  },
  {
    id: "donnees",
    title: "Données & confidentialité",
    keywords: [
      "donnee",
      "données",
      "rgpd",
      "confidentialite",
      "confidentialité",
      "securite",
      "sécurité",
      "stockage",
    ],
    answer:
      "Les données sont traitées dans un cadre sécurisé (authentification, hébergement). À l’inscription, l’acceptation du traitement des données (RGPD) est requise. Pour le détail juridique, consultez les pages légales du site.",
  },
  {
    id: "classes",
    title: "Classes & élèves",
    keywords: [
      "classe",
      "classes",
      "eleve",
      "élève",
      "eleves",
      "élèves",
      "import",
      "csv",
    ],
    answer:
      "Vous pouvez gérer vos classes et élèves depuis le tableau de bord (menus Classes / Élèves selon votre profil). Des imports ou listes peuvent être proposés selon votre type de compte.",
  },
];

const DEFAULT_ANSWER =
  "Je n’ai pas trouvé de réponse précise. Reformulez avec des mots comme « correction », « tarif », « établissement » ou « compte ». Vous pouvez aussi consulter la page d’accueil (FAQ, Tarifs, Contact) ou votre tableau de bord une fois connecté.";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findPlatformAnswer(userMessage: string): {
  entry: PlatformKnowledgeEntry | null;
  text: string;
} {
  const q = normalize(userMessage);
  if (!q) {
    return { entry: null, text: DEFAULT_ANSWER };
  }

  let best: { entry: PlatformKnowledgeEntry; score: number } | null = null;

  for (const entry of PLATFORM_KNOWLEDGE) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (k && q.includes(k)) score += 3;
    }
    const titleN = normalize(entry.title);
    if (titleN && q.includes(titleN)) score += 2;
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  if (best && best.score >= 3) {
    return { entry: best.entry, text: best.entry.answer };
  }

  if (best && best.score >= 2) {
    return { entry: best.entry, text: best.entry.answer };
  }

  return { entry: null, text: DEFAULT_ANSWER };
}

export const QUICK_PROMPTS: { label: string; send: string }[] = [
  { label: "Comment corriger des copies ?", send: "Comment fonctionne la correction des copies ?" },
  { label: "Tarifs et essai gratuit", send: "Quels sont les tarifs et le pack gratuit ?" },
  { label: "Compte établissement", send: "Comment ça marche pour un établissement scolaire ?" },
  { label: "Mes données (RGPD)", send: "Comment sont protégées mes données ?" },
];
