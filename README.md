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

```
Browser
  │
  ├── Next.js (Vercel)  ── UI, pages, Supabase Auth session (cookies)
  │                        reads/writes simple data directly through supabase-js
  │
  └── FastAPI (Render)  ── all business API under /api/v1
        │                  evaluations & copies, school teachers, Stripe, AI correction,
        │                  quotas, contact form
        │
        └── Supabase  ── Postgres (direct connection, real transactions), Auth, Storage
```

- **`./` (root) — Next.js frontend**: Next.js 14, React 18, TypeScript, Tailwind, Supabase SSR.
  Calls the API through `src/lib/backend.ts` (`backendFetch`), which sends the user's Supabase access token.
- **`./backend` — FastAPI API**: FastAPI, SQLAlchemy (async, psycopg), Stripe SDK, OpenAI (HTTP).
  The API verifies Supabase tokens itself: there is a single login system (Supabase Auth).
- **`./supabase/migrations`** — SQL migrations to apply, in order, in the Supabase SQL Editor.

### Backend layout

| Path | Role |
|---|---|
| `app/routers/evaluations.py` | evaluations, launching a test, copies, teacher review, import reset |
| `app/routers/schools.py` | school admin: create / update / detach teachers (Supabase Admin API) |
| `app/routers/billing.py` | Stripe checkout, payment verification, webhook, copy quota |
| `app/routers/ai.py` | AI evaluation generation and copy correction (3 copies in parallel) |
| `app/routers/contact.py` | public contact form (HubSpot + confirmation email) |
| `app/services/` | correction rules, safe math evaluator, quotas, OpenAI, HubSpot/SMTP |
| `app/rate_limit.py` | rate limiting shared across instances (Postgres counter) |
| `app/errors.py` | uniform `{"error": "..."}` responses, no technical detail leaked |

Every route that writes runs in **one database transaction** (commit at the end, rollback on error).
AI correction commits **one transaction per copy**, so a failure does not cancel copies already corrected.

### Plans and quotas

| Plan | AI-corrected copies |
|---|---|
| Pack ESSENTIEL (free) | 40 copies, access 30 days after sign-up |
| Pack AVANCÉ | 250 copies per quarter |
| Pack MAÎTRISE, school teachers | unlimited |

Usage is recorded in `usage_logs`, so deleting corrections or resetting imports does not give quota back.

## Local setup

### 1) Database (Supabase)

Apply the files of `supabase/migrations/` in order (SQL Editor). They are idempotent.

### 2) Backend (`backend/`)

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt     # Windows
# source .venv/bin/activate && pip install -r requirements-dev.txt   (macOS / Linux)
copy .env.example .env        # then fill in the values
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000 --loop asyncio:SelectorEventLoop
```

- `--loop asyncio:SelectorEventLoop` is required on **Windows only** (psycopg async does not support the default Proactor loop).
- `DATABASE_URL`: Supabase → **Connect** → Connection string → **Session pooler** (IPv4). The direct host is IPv6-only.
- With `DEBUG=true`: API docs at `http://localhost:8000/docs`, integration check at `/api/v1/health/integrations`.
- Check every integration without starting the server: `.venv\Scripts\python scripts/check_integrations.py`.

### 3) Frontend (repo root)

```bash
npm install
copy .env.local.example .env.local   # then fill in the values
npm run dev
```

App available at `http://localhost:3000`.

### 4) Stripe webhook (local)

```bash
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

Copy the displayed `whsec_...` into `STRIPE_WEBHOOK_SECRET` in `backend/.env`.

## Tests and code quality

```bash
cd backend
.venv\Scripts\python -m pytest                         # all tests (~3 min)
.venv\Scripts\python -m pytest -m "not integration"    # unit tests only (~5 s)
.venv\Scripts\ruff check .                             # lint (rules in backend/ruff.toml)
.venv\Scripts\ruff format .                            # formatting
```

Frontend: `npm test` (Vitest + Testing Library), `npx tsc --noEmit` and `npm run lint`.

Plans, prices and quotas live in one file, `backend/app/plans.json`: the API reads it at startup and the
frontend imports it at build time (`src/lib/plans.ts`). Change an offer there only.

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request: backend lint, format
check and unit tests; frontend type check, lint, tests and production build.

- **Unit tests** need no database or network.
- **Integration tests** run against the Supabase database configured in `backend/.env`: they create
  test accounts (`pytest-…@example.com`) and delete everything afterwards. They are skipped when
  `backend/.env` is not configured. OpenAI, Stripe API calls, HubSpot and SMTP are always mocked.

## Environment variables

| Where | File | Contains |
|---|---|---|
| Frontend | `.env.local` (from `.env.local.example`) | public values only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` |
| Backend | `backend/.env` (from `backend/.env.example`) | all secrets: database, Supabase service key, OpenAI, Stripe, HubSpot, SMTP |

`.env` files are git-ignored. Never put a secret in a `NEXT_PUBLIC_*` variable.

## Deployment

### Backend on Render

`render.yaml` describes the service (Render → **New → Blueprint** → this repository).
Fill in the secret variables in the Render dashboard, including:

- `CORS_ORIGINS` and `FRONTEND_URL`: the public Vercel URL;
- `DATABASE_URL`: the Session pooler connection string.

Health check: `GET /api/v1/health`.

### Frontend on Vercel

- Root Directory: `.` (root), build command: `npm run build`.
- Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com/api/v1`.

### Stripe

Webhook endpoint: `https://<render-service>.onrender.com/api/v1/billing/webhook`, events
`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Security notes

- **Row Level Security is currently disabled** on the Supabase tables. The business rules are enforced
  by the FastAPI routes, but the frontend still reads and writes some tables directly with the public key,
  which anyone can use. Enable RLS with policies before storing real student data.
- The `tests` storage bucket is public: anyone with a file URL can open it.
- Rate limits: reads 120/min, writes 60/min, billing 10/min, AI 5/min per user; contact form 5 per 10 min per IP.
