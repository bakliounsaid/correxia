from contextlib import asynccontextmanager

import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, health, students, subscriptions, tests

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.stripe_secret_key:
        stripe.api_key = settings.stripe_secret_key
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend correction assistée par IA",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"
app.include_router(health.router, prefix=API)
app.include_router(auth.router, prefix=API)
app.include_router(tests.router, prefix=API)
app.include_router(students.router, prefix=API)
app.include_router(subscriptions.router, prefix=API)
