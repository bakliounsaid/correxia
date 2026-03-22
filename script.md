=================================================================
CORREXIA - PROMPT COMPLET POUR CURSOR
=================================================================

ATTENTION: Vous recevrez AUSSI un DESIGN SYSTEM séparé.
Utilisez le design system pour styliser TOUTES les pages exactement.

───────────────────────────────────────────────────────────────
DESCRIPTION DU PROJET
───────────────────────────────────────────────────────────────

NOM: CORREXIA

OBJECTIF:
Plateforme SaaS de correction automatisée des copies d'examens/tests
pour les matières scientifiques (Mathématiques, Physique, Sciences) 
dans les lycées.

PROBLÈME RÉSOLU:
- Les enseignants passent 1-2 heures par copie à corriger
- C'est répétitif et fatigant
- Risque d'erreur/fatigue mentale
- Pas d'outils fiables pour correction manuscrite scientifique

SOLUTION:
- Enseignant crée test depuis documents (cours PDF, etc)
- IA génère automatiquement les questions
- Distribution copies PDF aux élèves
- Après examen: upload copies scannées
- IA corrige automatiquement (Claude API)
- Enseignant valide/modifie corrections
- Résultats générés automatiquement

BÉNÉFICES:
✅ Correction 10x plus rapide
✅ Moins fatigant (prof valide seulement)
✅ Cohérence correction (pas de variations prof)
✅ Feedback automatique pour élèves
✅ Statistiques détaillées par classe
✅ Réductions risques erreurs

DURÉE CYCLE TEST:
1. Création test: 15-30 min (au lieu de 1h)
2. Lancement test: 10 min
3. Correction: 5-10 min (au lieu de 1-2h)
TOTAL: ~30 min (au lieu de 3-4h)

UTILISATEURS:
1. Enseignants indépendants (B2C)
   - Créent compte personnel
   - Upload liste élèves propre
   - Paient via abonnement

2. Enseignants d'écoles (B2B)
   - Compte créé par admin école
   - Utilisent élèves de l'école
   - Abonnement payé par école

3. Administrateur d'école
   - Gère école (création, paramètres)
   - Crée comptes enseignants
   - Upload liste élèves
   - Voit statistiques école

4. Admin SAAS
   - Vue globale plateforme
   - Gestion subscriptions
   - Stats tous clients

MODÈLE ÉCONOMIQUE:
- Enseignants indépendants: Abonnement personnel
- Écoles: Abonnement établissement
- Admin SAAS: Récupère pourcentage subscriptions

───────────────────────────────────────────────────────────────
STACK TECHNOLOGIQUE
───────────────────────────────────────────────────────────────

FRONTEND: Next.js 14
┌─────────────────────────────────────┐
│ - Framework: Next.js 14 (React 18)  │
│ - Langage: TypeScript               │
│ - Styling: Tailwind CSS 3           │
│ - State: Zustand                    │
│ - HTTP: Axios                       │
│ - Forms: React Hook Form + Zod      │
│ - Real-time: Socket.io Client       │
│ - Charts: Recharts                  │
│ - PDF: html2pdf / Puppeteer         │
│ - UI Components: Shadcn/ui          │
│ - Icons: Lucide React               │
└─────────────────────────────────────┘

BACKEND: Python + FastAPI
┌─────────────────────────────────────┐
│ - Framework: FastAPI (async)        │
│ - Serveur: Uvicorn                  │
│ - ORM: SQLAlchemy 2.0               │
│ - Validation: Pydantic V2           │
│ - Python: 3.11+                     │
│ - Auth: python-jose + passlib       │
│ - Async Queue: Celery + Redis       │
│ - IA: Anthropic Claude SDK          │
│ - OCR: Tesseract/Pytesseract        │
│ - Images: OpenCV + PIL              │
│ - Paiement: Stripe SDK              │
│ - Email: SendGrid                   │
│ - Tests: Pytest                     │
└─────────────────────────────────────┘

DATABASE: Supabase (PostgreSQL)
┌─────────────────────────────────────┐
│ - PostgreSQL (managed)              │
│ - Row Level Security (RLS)          │
│ - Full-text search                  │
│ - JSON/JSONB support                │
│ - Backups automatiques              │
│ - Scalable                          │
└─────────────────────────────────────┘

STORAGE: Supabase Storage
┌─────────────────────────────────────┐
│ - S3-compatible                     │
│ - Buckets:                          │
│   • test-sources                    │
│   • test-pdfs                       │
│   • copy-scans                      │
│   • exports                         │
└─────────────────────────────────────┘

AUTHENTIFICATION: Supabase Auth
┌─────────────────────────────────────┐
│ - Email + Password                  │
│ - JWT tokens                        │
│ - Session management                │
│ - Email confirmation                │
└─────────────────────────────────────┘

PAIEMENT: Stripe API
┌─────────────────────────────────────┐
│ - Checkout sessions                 │
│ - Subscriptions récurrentes         │
│ - Webhooks (paiement, renouvellement)
└─────────────────────────────────────┘

IA: Claude API (Anthropic)
┌─────────────────────────────────────┐
│ - Claude 3.5 Sonnet                 │
│ - Vision: analyser images copies    │
│ - Reasoning: corriger réponses      │
│ - JSON mode: structurer résultats   │
│ - 200K context window               │
│ - API Key côté backend (sécurisée)  │
└─────────────────────────────────────┘

NOTIFICATIONS: Socket.io
┌─────────────────────────────────────┐
│ - WebSocket bidirectionnel          │
│ - Real-time notifications           │
│ - Updates instantanés               │
└─────────────────────────────────────┘

DÉPLOIEMENT:
┌─────────────────────────────────────┐
│ - Frontend: Vercel (Next.js)        │
│ - Backend: Railway.app (Python)     │
│ - Database: Supabase (managed)      │
└─────────────────────────────────────┘

───────────────────────────────────────────────────────────────
11 TABLES BASE DE DONNÉES (PostgreSQL)
───────────────────────────────────────────────────────────────

1. users
   - id (UUID)
   - email (unique)
   - full_name
   - role (admin|teacher|school_admin|director)
   - is_active
   - avatar_url
   - created_at, updated_at

2. schools
   - id (UUID)
   - name, email, phone
   - address, city, postal_code, country
   - admin_user_id (FK → users)
   - subscription_plan, subscription_status
   - subscription_start_date, subscription_end_date
   - max_teachers, current_teachers
   - stripe_customer_id, stripe_subscription_id
   - is_verified, verification_code
   - created_at, updated_at

3. teachers
   - id (UUID)
   - user_id (FK → users, unique)
   - school_id (FK → schools, nullable)
   - subject (math|physics|science)
   - is_independent
   - subscription_plan (free|advanced|mastery)
   - subscription_status, subscription_start_date, subscription_end_date
   - tests_created, tests_this_month
   - copies_processed
   - stripe_customer_id, stripe_subscription_id
   - created_at, updated_at

4. students
   - id (UUID)
   - school_id (FK → schools)
   - teacher_id (FK → teachers)
   - first_name, last_name
   - email
   - class_name (2nde A, 1ère S, etc)
   - is_active
   - created_at, updated_at

5. test_sources
   - id (UUID)
   - teacher_id (FK → teachers)
   - school_id (FK → schools)
   - file_name, file_url
   - file_type (pdf|docx|txt)
   - file_content (OCR text)
   - file_size_mb
   - upload_status
   - created_at, updated_at

6. tests
   - id (UUID)
   - teacher_id (FK → teachers)
   - school_id (FK → schools)
   - title, description
   - subject (math|physics|science)
   - level (2nde|1ère|Terminale)
   - duration_minutes, total_questions, total_points, passing_grade
   - questions (JSONB array)
   - rubric (JSONB)
   - source_file_ids (UUID array)
   - status (draft|created|in_progress|completed)
   - copies_generated, copies_submitted, copies_corrected
   - created_at, updated_at

7. test_copies
   - id (UUID)
   - test_id (FK → tests)
   - student_id (FK → students)
   - teacher_id (FK → teachers)
   - school_id (FK → schools)
   - unique_test_id (unique)
   - pdf_url, pdf_generated_at
   - scanned_image_url, scanned_uploaded_at
   - status (generated|printed|in_exam|submitted|pending_review|auto_corrected|validated|archived)
   - created_at, updated_at

8. copy_corrections
   - id (UUID)
   - copy_id (FK → test_copies, unique)
   - test_id (FK → tests)
   - student_id (FK → students)
   - teacher_id (FK → teachers)
   - ai_analysis_json (JSONB)
   - ai_confidence_score (float)
   - ai_total_points (float)
   - ai_processed_at (timestamp)
   - teacher_validated_points, teacher_comments, teacher_feedback
   - teacher_corrected_at (timestamp)
   - is_validated (boolean)
   - validation_status (pending|accepted_ai|modified|rejected_ai)
   - processing_status (pending|processing|completed|error)
   - processing_error, processing_time_ms
   - created_at, updated_at

9. subscriptions
   - id (UUID)
   - teacher_id (FK → teachers)
   - school_id (FK → schools)
   - plan_type, plan_name, price_cents
   - billing_period (monthly|quarterly|yearly)
   - status (active|paused|cancelled)
   - stripe_customer_id, stripe_subscription_id (unique), stripe_invoice_id
   - start_date, end_date, next_billing_date
   - auto_renew (boolean)
   - created_at, updated_at

10. usage_logs
    - id (UUID)
    - teacher_id (FK → teachers)
    - school_id (FK → schools)
    - action (string)
    - action_value (string)
    - details (JSONB)
    - created_at

11. statistics
    - id (UUID)
    - teacher_id (FK → teachers)
    - school_id (FK → schools)
    - period (YYYY-MM format)
    - total_tests_created, total_copies_generated, total_copies_corrected, total_copies_validated
    - average_ai_confidence, average_validation_score
    - total_time_saved_hours
    - created_at, updated_at

───────────────────────────────────────────────────────────────
PAGES À DÉVELOPPER (18 PAGES)
───────────────────────────────────────────────────────────────

PUBLIC (sans login):
1. / (Landing Page)
2. /login (Login)
3. /register (Register Indépendant)
4. /register-school (Register École)

DASHBOARD ENSEIGNANT INDÉPENDANT:
5. /dashboard/teacher (Vue d'ensemble)
6. /dashboard/teacher/tests/new/step1 (Upload documents)
7. /dashboard/teacher/tests/new/step2 (Générer test IA)
8. /dashboard/teacher/tests/new/step3 (Modifier questions)
9. /dashboard/teacher/tests/new/step4 (Définir barème)
10. /dashboard/teacher/tests/{test_id} (Détails & actions)
11. /dashboard/teacher/tests/{test_id}/launch (Sélectionner élèves)
12. /dashboard/teacher/tests/{test_id}/upload-copies (Upload copies)
13. /dashboard/teacher/tests/{test_id}/review (Liste corrections)
14. /dashboard/teacher/tests/{test_id}/copy/{copy_id} (Double écran correction) **CRITIQUE**
15. /dashboard/teacher/tests/{test_id}/results (Résultats & stats)
16. /dashboard/teacher/students (Gestion élèves)
17. /dashboard/teacher/subscription (Abonnement)
18. /dashboard/teacher/statistics (Stats globales)

BONUS (Phase 2):
- /dashboard/school/* (Admin école)
- /admin/* (Admin SAAS)
- Intégration Stripe (checkout, webhooks)
- Email notifications

───────────────────────────────────────────────────────────────
LANDING PAGE - DÉTAILS COMPLETS
───────────────────────────────────────────────────────────────

HEADER:
- Logo CORREXIA (gauche)
- Menu: Accueil | Fonctionnalités | Pricing | FAQ
- Boutons: Login | Register (droite)

HERO SECTION:
- Titre grand: "Corrigez 10x Plus Vite"
- Sous-titre: "Correction automatique des copies d'examens
             Mathématiques, Physique, Sciences"
- Image/vidéo démo
- CTA: "Commencer Gratuit" → /register
- Stats:
  • "90% moins de temps de correction"
  • "Utilisé par 500+ enseignants"
  • "Taux satisfaction: 4.8/5"

SECTION PROBLÈME:
- Titre: "Le problème"
- 4 points avec icons:
  1. Correction longue: 1-2h par copie
  2. Fatigant et répétitif
  3. Risque erreurs/variations
  4. Pas de feedback immédiat élèves
- Illustration: Prof fatigué

SECTION SOLUTION:
- Titre: "Notre solution"
- 4 étapes visuelles:
  1. Créer test depuis documents
  2. Distribuer aux élèves
  3. Correction automatique
  4. Valider et publier

SECTION FONCTIONNALITÉS:
- 6 cartes (3 colonnes):
  1. Génération IA Tests
  2. Correction Automatique
  3. Validation Enseignant
  4. Statistiques Détaillées
  5. Gestion Élèves
  6. Matières Scientifiques
- Chaque carte: icon + texte + features

SECTION PRICING:
(Voir détails ci-dessous)

FAQ:
- Q1: Comment la correction IA fonctionne?
- Q2: Peut-on modifier la correction IA?
- Q3: Qu'est-ce qui est inclus dans les packs?
- Q4: Comment je crée un test?
- Q5: Les données sont sécurisées?
- Q6: Puis-je tester gratuitement?

CTA FINAL:
- Titre: "Prêt à économiser 20h/mois?"
- Button: "S'inscrire Maintenant"

FOOTER:
- Copyright, Liens, Réseaux sociaux

───────────────────────────────────────────────────────────────
PRICING - PACKS DÉTAILLÉS
───────────────────────────────────────────────────────────────

ENSEIGNANTS INDÉPENDANTS:

PLAN GRATUIT:
- 0€/mois
- 40 copies/mois
- ✓ Création tests
- ✓ Correction IA
- ✓ Validation manuelle
- ✓ Stats de base
- ✗ Feedback auto
- ✗ Support prioritaire
- Parfait pour: Tester, 1-2 tests/mois, <40 élèves

PLAN AVANCÉ:
- 45€/trimestre
- 250 copies/trimestre
- ✓ Tout du GRATUIT
- ✓ Analyse détaillée
- ✓ Historique illimité
- ✓ Gestion élèves
- ✗ Support perso
- Parfait pour: Usage régulier, 5-10 tests/mois, classes écoles

PLAN MAÎTRISE:
- 79€/trimestre
- Copies illimitées
- ✓ Tout du AVANCÉ
- ✓ Feedback IA automatique
- ✓ Support prioritaire
- ✓ Accès API webhook
- Parfait pour: Utilisation intensive, multiples classes

ÉCOLES:

PLAN ÉTABLISSEMENT:
- 300€/trimestre
- Jusqu'à 10 enseignants
- ✓ Copies illimitées
- ✓ Dashboard admin école
- ✓ Gestion centralisée élèves
- ✓ Statistiques école
- ✓ Support email
- ✓ Branding personnalisé
- Parfait pour: Écoles privées, 10-100 élèves

PLAN INSTITUTION:
- Sur devis
- Enseignants illimités
- ✓ Multi-campus
- ✓ Copies illimitées
- ✓ API personnalisée
- ✓ Intégration systèmes
- ✓ Support 24/7
- ✓ SLA garanti
- Parfait pour: Réseaux écoles, universités, >100 enseignants

───────────────────────────────────────────────────────────────
PAGES DÉTAILLÉES - STRUCTURE
───────────────────────────────────────────────────────────────

[PAGE 1] LANDING PAGE
- Sections: Header, Hero, Problème, Solution, Features, Pricing, FAQ, CTA, Footer
- Layout: Full-width sections
- CTA Buttons: /register, /login

[PAGE 2] REGISTER INDÉPENDANT
- Form fields: Prénom, Nom, Email, Password, Matière
- Validation: Client-side avec Zod
- Submit: POST /api/auth/register
- Redirect: /verify-email → /dashboard

[PAGE 3] REGISTER ÉCOLE
- Form fields: Nom école, Email, Password, Adresse, Ville, CP, Téléphone
- Créer école + compte admin
- Email confirmation
- Redirect: /dashboard/school

[PAGE 4] LOGIN
- Form: Email, Password
- "Se souvenir de moi"
- "Mot de passe oublié"
- Submit: POST /api/auth/login
- Redirect: /dashboard (basé sur rôle)

[PAGE 5] DASHBOARD ENSEIGNANT
- Stats: Tests créés, élèves, copies
- Liste tests récents
- Bouton "+ Créer nouveau test"
- Graphiques stats
- Info abonnement

[PAGES 6-9] CRÉER TEST (4 STEPS)
- Step 1: Upload documents
- Step 2: Générer test IA
- Step 3: Modifier questions
- Step 4: Définir barème
- Progression visuelle (étapes)

[PAGE 10] DÉTAILS TEST
- Infos test (questions, points, status)
- Boutons actions: Démarrer, Modifier, Dupliquer, Stats
- Aperçu questions
- Stats (si déjà lancé)

[PAGE 11] LANCER TEST
- Checkboxes élèves (présents/absents)
- Bouton "Générer copies PDF"
- Download ZIP

[PAGE 12] UPLOAD COPIES
- Drag & drop zone
- Multi-upload
- Progress bar
- "Uploader et Corriger"

[PAGE 13] REVUE CORRECTIONS
- Tableau: Élève | Score IA | Confiance | Status
- Filters: Tous, Validés, En cours
- Click: Voir détail

[PAGE 14] CORRECTION - DOUBLE ÉCRAN **CRITIQUE**
- Gauche: Image copie (zoomable, rotatable)
- Droite: Analyse question par question
  • Réponse élève
  • Réponse attendue
  • Verdict IA (✓/⚠️/❌/❓)
  • Points proposés
  • Feedback
- Couleurs: ✅ vert, ⚠️ orange, ❌ rouge, ❓ rouge (doute)
- Boutons: Valider, Ajuster, Rejeter
- Total score et confiance affichés

[PAGE 15] RÉSULTATS
- Statistiques classe (moyenne, médiane, max, min)
- Graphique distribution
- Tableau résultats par élève
- Analyse par question
- Export CSV/PDF
- "Envoyer aux élèves"

[PAGE 16] GESTION ÉLÈVES
- Tableau: Prénom, Nom, Classe
- Boutons: Ajouter, Import CSV
- Filters, recherche
- Affichage liste

[PAGE 17] ABONNEMENT
- Plan actuel + info
- Barre progression copies
- Options upgrade
- Historique factures
- Bouton annuler

[PAGE 18] STATISTIQUES
- Période sélectionnable
- Résumé (tests, copies, temps)
- Graphiques tendance
- Détails utilisation
- Zones de progrès

───────────────────────────────────────────────────────────────
AUTHENTIFICATION & AUTORISATIONS
───────────────────────────────────────────────────────────────

JWT TOKEN:
{
  "sub": "user_id",
  "email": "email@example.com",
  "role": "teacher|admin|school_admin",
  "school_id": "uuid|null",
  "aud": "authenticated"
}

STOCKAGE: localStorage + httpOnly cookie

MIDDLEWARE:
- Vérifier JWT sur chaque requête
- Rediriger /login si invalide
- Ajouter token aux headers Axios

AUTORISATION:
- Enseignant ne voit que SES tests/élèves
- Admin école voit son école seulement
- Admin SAAS voit tout

───────────────────────────────────────────────────────────────
INTÉGRATION CLAUDE API
───────────────────────────────────────────────────────────────

GÉNÉRER TEST:
Endpoint: POST /api/tests/generate
Input: {
  documents_content: string[],
  level: '2nde'|'1ère'|'Terminale',
  question_count: int,
  subject: 'math'|'physics'|'science'
}
Claude prompt: "À partir de ces documents, génère X questions..."
Output: {
  questions: [{id, type, text, expected_answer, points}],
  rubric: [{question_id, criteria}],
  difficulty: 'easy'|'medium'|'hard'
}

CORRIGER COPIE:
Endpoint: POST /api/copies/correct
Input: {
  image_base64: string,
  questions: [{id, text, expected_answer, points}],
  rubric: {...}
}
Claude prompt: "Corriger cette copie d'examen selon le barème..."
Claude Vision: Analyser image
Claude Reasoning: Déterminer correctness + points
Output: {
  corrections: [{question_id, student_answer, correctness, points, feedback}],
  total_points: float,
  confidence_score: float
}

SÉCURITÉ:
- API Key stockée en variable env (backend)
- Jamais exposée au frontend
- Requêtes toujours depuis backend

───────────────────────────────────────────────────────────────
STRIPE INTEGRATION (PHASE 1 MINIMAL)
───────────────────────────────────────────────────────────────

PRODUITS STRIPE À CRÉER:

1. Pack AVANCÉ
   - Product ID: prod_correxia_advanced
   - Prix: 4500 (centimes) = 45€
   - Récurrence: quarterly

2. Pack MAÎTRISE
   - Product ID: prod_correxia_mastery
   - Prix: 7900 (centimes) = 79€
   - Récurrence: quarterly

3. Pack ÉTABLISSEMENT
   - Product ID: prod_correxia_establishment
   - Prix: 30000 (centimes) = 300€
   - Récurrence: quarterly

CHECKOUT:
POST /api/subscriptions/checkout
Input: {plan: 'advanced'|'mastery'|'establishment'}
Return: {checkout_url: "..."}
Frontend: Rediriger vers Stripe Checkout

WEBHOOKS (Phase 2):
- checkout.session.completed → Créer subscription DB
- customer.subscription.updated → Mettre à jour DB
- customer.subscription.deleted → Annuler subscription
- invoice.payment_failed → Notification utilisateur

───────────────────────────────────────────────────────────────
FLUX COMPLET EN 20 ÉTAPES
───────────────────────────────────────────────────────────────

SEMAINE AVANT EXAMEN:
1. Prof upload documents cours (PDF)
2. IA génère 10-20 questions
3. Prof modifie/valide questions
4. Prof ajoute barème correction
5. Test sauvegardé (status='created')

JOUR DE L'EXAMEN:
6. Prof clique "Lancer test"
7. Sélectionne élèves présents (checkboxes)
8. Clique "Générer PDF"
9. Télécharge ZIP (85 copies uniques)
10. Imprime et distribue aux élèves
11. Test lancé (status='in_progress')
12. Examen: 1 heure

APRÈS EXAMEN:
13. Prof scanne/photo toutes copies
14. Upload copies (batch upload)
15. Queue Celery: Correction IA lancée
16. Claude API: OCR + analyse chaque copie (2-3 min total)
17. Résultats sauvegardés en DB
18. Prof revoit tableau corrections
19. Click copie → Double écran
20. Ajuste si besoin → Valide

RÉSULTATS:
21. Export CSV (pour notes scolaires)
22. Export PDF (pour envoi parents)
23. Stats classe disponibles

BÉNÉFICE TEMPS:
- Sans IA: 2h création + 1h exam + 3h correction = 6h
- Avec IA: 0.5h création + 1h exam + 0.5h validation = 2h
- ÉCONOMISÉ: 4h par classe!

───────────────────────────────────────────────────────────────
POINTS IMPORTANTS
───────────────────────────────────────────────────────────────

🎨 DESIGN:
- Utilisez le DESIGN SYSTEM que vous recevrez
- Stylisez TOUTES les pages exactement selon le design
- Couleurs, typo, composants, spacing: suivre le design
- Le design contient:
  • Palette couleurs
  • Typographie (fonts, sizes)
  • Composants réutilisables
  • Layout grid
  • Spacing system
  • Icons
  • Animations
  • Dark mode (optionnel)

🔐 SÉCURITÉ:
- Claude API key: Variable env (backend seulement)
- JWT verification: Chaque requête
- RLS: Supabase policies
- RGPD: Droit à l'oubli, chiffrement
- Stripe: Webhook signature verification

⚡ PERFORMANCE:
- Image compression avant upload
- Lazy loading images
- Caching queries Supabase
- Optimized Claude prompts
- Batch operations quand possible

📝 CODE:
- TypeScript strict (frontend)
- Pydantic validation (backend)
- Error handling complet
- Logs structurés
- Tests unitaires (Pytest backend)
- ESLint + Prettier (frontend)

🧪 TESTING:
- Pytest (backend)
- Jest (frontend - optionnel)
- Integration tests pour flows
- Mock Claude API tests

───────────────────────────────────────────────────────────────
ÉTAPES DÉVELOPPEMENT RECOMMANDÉES
───────────────────────────────────────────────────────────────

PHASE 1 - CORE (4 semaines):
□ Week 1: Setup + Auth
  - Next.js structure
  - FastAPI structure
  - Supabase tables
  - Supabase Auth integration
  - Login/Register pages

□ Week 2: Dashboard + Tests
  - Dashboard teacher
  - Create test (4 steps)
  - Store tests DB
  - Test details page

□ Week 3: Launch + Corrections
  - Launch test (select students)
  - Generate PDFs
  - Upload copies
  - Claude API integration (correct)

□ Week 4: Validation + Results
  - Double écran correction
  - Validation logic
  - Results page
  - Stats page

PHASE 2 - POLISH (2 semaines):
□ Week 5: UI/UX Polish
  - Design system implementation
  - Responsive design
  - Loading states
  - Error handling

□ Week 6: Testing + Deploy
  - Unit tests
  - Integration tests
  - Vercel deploy
  - Railway deploy

BONUS (Phase 3):
□ School admin pages
□ SAAS admin pages
□ Stripe full integration
□ Email notifications
□ WebSocket real-time
□ Advanced stats/charts

───────────────────────────────────────────────────────────────
NOTES IMPORTANTES
───────────────────────────────────────────────────────────────

1. DESIGN SYSTEM REÇU SÉPARÉMENT:
   → Vous recevrez aussi un design system avec couleurs, typo, composants
   → Utilisez-le pour styliser CHAQUE page exactement
   → Ne partez pas du design par défaut Tailwind

2. CLAUDE API KEY:
   → Stockée en variable env (backend)
   → Jamais exposée au frontend
   → Toutes corrections lancées depuis backend

3. TESTS UNIQUES:
   → Chaque copie PDF a unique_test_id (TEST_ID_STUDENT_ID)
   → Permet tracking + correction

4. DOUBLE ÉCRAN CRITIQUE:
   → C'est LA page la plus importante
   → Image zoomable/rotatable (gauche)
   → Analyse détaillée (droite)
   → Couleurs correctness: ✅ vert, ⚠️ orange, ❌ rouge, ❓ rouge
   → Boutons: Valider, Ajuster, Rejeter

5. CLAUDE API USAGE:
   → Générer tests: ~$0.01 par test (500+ tokens)
   → Corriger copie: ~$0.05 par copie (2000+ tokens)
   → Budget: ~$100/mois pour tests larges

6. FLUX TEMPS:
   → Création test: 15-30 min
   → Génération PDFs: <1 min
   → Upload copies: 2-3 min
   → Correction IA: ~30 sec par copie
   → Validation prof: ~2 min par copie

───────────────────────────────────────────────────────────────
RÉSUMÉ - CE QUE VOUS ALLEZ RECEVOIR
───────────────────────────────────────────────────────────────

1. CE PROMPT (documentation complète)
2. DESIGN SYSTEM (couleurs, typo, composants, layouts)
3. (OPTIONNEL) Fichier Figma/images des designs

AVEC CES 2-3 FICHIERS, VOUS AVEZ TOUT POUR DÉVELOPPER CORREXIA!

───────────────────────────────────────────────────────────────
C'EST PRÊT! COMMENCEZ!
───────────────────────────────────────────────────────────────

Cette documentation couvre:
✅ Description projet complète
✅ Stack technologique détaillée
✅ 11 tables base de données
✅ 18 pages front-end
✅ Landing page complète
✅ Pricing packs détaillés
✅ Intégration Claude API
✅ Intégration Stripe (minimal)
✅ Authentification
✅ Flux complet utilisateur
✅ Points importants
✅ Étapes dev recommandées

PROCHAINE ÉTAPE:
Attendez le DESIGN SYSTEM et commencez par:
1. Setup Next.js + FastAPI
2. Supabase tables
3. Auth pages (login/register)
4. Dashboard
5. Créer test (4 steps)
6. Et ainsi de suite...

Bon développement! 
