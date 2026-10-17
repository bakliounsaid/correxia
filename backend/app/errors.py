"""Réponses d'erreur uniformes `{"error": "..."}` (format attendu par le frontend)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger("correxia")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail if isinstance(exc.detail, str) else "Erreur."},
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        errors = exc.errors()
        # Message métier écrit dans un validateur (ValueError) : renvoyé tel quel.
        for e in errors:
            if e.get("type") == "value_error":
                message = str(e.get("msg", "")).removeprefix("Value error, ")
                return JSONResponse(status_code=400, content={"error": message})
        fields = [".".join(str(p) for p in e.get("loc", [])[1:]) for e in errors]
        detail = ", ".join(f for f in fields if f)
        return JSONResponse(
            status_code=400,
            content={"error": f"Données invalides{f' ({detail})' if detail else ''}."},
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        # Détail technique dans les logs serveur uniquement, jamais renvoyé au client.
        logger.exception("Erreur non gérée sur %s %s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(status_code=500, content={"error": "Erreur interne du serveur. Réessayez."})
