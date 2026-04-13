# CORREXIA

Plateforme de correction de copies assistée par IA, conçue pour les enseignants de sciences et les établissements scolaires.

## Ce que fait le projet

CORREXIA permet de:

- créer des évaluations avec un barème défini par l'enseignant;
- importer des copies manuscrites (scan/photo);
- proposer une correction assistée par IA;
- laisser la validation finale à l'enseignant;
- suivre les résultats via des tableaux de bord;
- gérer les abonnements (enseignant et établissement).

Le positionnement produit est clair: **l'IA assiste**, l'enseignant garde la décision pédagogique.

## Architecture

Le dépôt contient 2 parties:

- `./` (racine): frontend **Next.js** (App Router, TypeScript, Tailwind, Supabase, Stripe côté web);
- `./backend`: API **FastAPI** (auth, tests, étudiants, abonnements, santé).

### Frontend

Technos principales:

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase SSR

### Backend

Technos principales:

- FastAPI
- Uvicorn
- SQLAlchemy (async)
- Stripe SDK

API exposée sous le préfixe ` /api/v1 `.

## Démarrage local

## 1) Frontend (racine du repo)

```bash
npm install
npm run dev
```

Application disponible sur `http://localhost:3000`.

## 2) Backend (`backend/`)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API disponible sur `http://localhost:8000` (et docs si mode debug actif).

## Variables d'environnement

- Front: copier `.env.local.example` vers `.env.local` à la racine.
- Back: copier `backend/.env.example` vers `backend/.env`.

Ne jamais exposer de secrets backend dans des variables `NEXT_PUBLIC_*`.

## Déploiement recommandé

## Front sur Vercel

- Repository: ce repo
- Root Directory: `.` (racine)
- Build command: `npm run build`

## Backend sur Render

- Repository: ce repo (ou repo dédié backend)
- Root Directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Important en production

- Configurer `CORS_ORIGINS` côté backend avec le domaine Vercel.
- Pointer le frontend vers l'URL publique Render (pas `localhost`).
- Séparer strictement les secrets front/backend.
