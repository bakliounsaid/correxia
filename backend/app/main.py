import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine
from app.errors import register_error_handlers
from app.http_client import close_http_client
from app.routers import ai, billing, contact, evaluations, health, schools

settings = get_settings()
logging.basicConfig(level=logging.INFO)
# DEBUG pour le code de l'app uniquement : les bibliothèques HTTP journaliseraient chaque en-tête échangé.
logging.getLogger("correxia").setLevel(logging.DEBUG if settings.debug else logging.INFO)
for noisy in ("httpx", "httpcore", "stripe"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    # Arrêt : libère le pool Postgres et les connexions HTTP sortantes.
    await close_http_client()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="API métier CORREXIA (évaluations, copies, établissements, paiement, IA)",
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list() or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

API = "/api/v1"
app.include_router(health.router, prefix=API)
app.include_router(ai.router, prefix=API)
app.include_router(evaluations.router, prefix=API)
app.include_router(schools.router, prefix=API)
app.include_router(billing.router, prefix=API)
app.include_router(contact.router, prefix=API)
