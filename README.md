# CORREXIA

AI-assisted exam correction platform designed for science teachers and schools.

## What the project does

CORREXIA allows you to:

- create assessments with a grading scheme defined by the teacher;
- import handwritten exam papers (scan/photo);
- get an AI-assisted correction suggestion;
- leave the final validation to the teacher;
- track results through dashboards;
- manage subscriptions (teacher and school plans).

The product positioning is clear: **AI assists**, the teacher keeps the final pedagogical decision.

## Architecture

The repository contains 2 parts:

- `./` (root): **Next.js** frontend (App Router, TypeScript, Tailwind, Supabase, Stripe on the web side);
- `./backend`: **FastAPI** API (auth, tests, students, subscriptions, health).

### Frontend

Main technologies:

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase SSR

### Backend

Main technologies:

- FastAPI
- Uvicorn
- SQLAlchemy (async)
- Stripe SDK

API exposed under the `/api/v1` prefix.

## Local setup

### 1) Frontend (repo root)

```bash
npm install
npm run dev
```

App available at `http://localhost:3000`.

### 2) Backend (`backend/`)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API available at `http://localhost:8000` (with docs if debug mode is active).

## Environment variables

- Frontend: copy `.env.local.example` to `.env.local` at the repo root.
- Backend: copy `backend/.env.example` to `backend/.env`.

Never expose backend secrets through `NEXT_PUBLIC_*` variables.

## Recommended deployment

### Frontend on Vercel

- Repository: this repo
- Root Directory: `.` (root)
- Build command: `npm run build`

### Backend on Render

- Repository: this repo (or a dedicated backend repo)
- Root Directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Important in production

- Configure `CORS_ORIGINS` on the backend with the Vercel domain.
- Point the frontend to the public Render URL (not `localhost`).
- Keep frontend/backend secrets strictly separated.