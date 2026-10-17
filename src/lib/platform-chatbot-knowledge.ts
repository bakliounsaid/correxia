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
  "Bonjour ! Je suis l’assistant CORREXIA. Dites-moi ce que vous voulez savoir et je vous réponds directement.";

export const PLATFORM_KNOWLEDGE: PlatformKnowledgeEntry[] = [
  {
    id: "strategie-genese",
    title: "Stratégie & genèse",
    keywords: [
      "strategie",
      "stratégie",
      "genese",
      "genèse",
      "constat",
      "charge mentale",
      "chronophage",
      "correction manuscrite",
      "raisonnement",
      "enseignant sciences",
    ],
    answer:
      "Le constat de départ est clair : en sciences, la correction manuscrite reste difficile à automatiser avec des outils classiques, car elle exige l’analyse des raisonnements, des étapes intermédiaires et des notations symboliques. Cette charge consomme souvent 10 à 15 heures par semaine, ralentit le retour aux élèves et réduit le temps d’accompagnement pédagogique. CORREXIA répond à cette impasse en accélérant la phase technique de correction sans retirer le jugement de l’enseignant.",
  },
  {
    id: "positionnement-vision",
    title: "Positionnement & vision",
    keywords: [
      "positionnement",
      "vision",
      "human in the loop",
      "humain dans la boucle",
      "assistant",
      "remplacer",
      "dernier mot",
      "decision finale",
      "décision finale",
      "hybride",
      "papier",
      "specialisation",
      "spécialisation",
      "maths",
      "physique",
      "svt",
    ],
    answer:
      "Le positionnement de CORREXIA repose sur une IA assistante, jamais remplaçante. Le modèle est “Human-in-the-loop” : l’IA pré-analyse les copies et propose une correction, mais le professeur garde toujours le dernier mot et la décision finale. CORREXIA adopte aussi une approche hybride (papier + numérique) pour respecter les pratiques de classe, et se spécialise en sciences (maths, physique, SVT) afin de fournir une précision adaptée aux notations et raisonnements complexes.",
  },
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
  "Je peux vous aider sur la stratégie CORREXIA, la correction des copies, les tarifs, les comptes établissement et la confidentialité. Dites-moi simplement ce que vous voulez savoir.";

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
