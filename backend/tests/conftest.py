import asyncio
import os
import sys

import pytest

from app.config import get_settings

# Les tests unitaires n'ouvrent aucune connexion : URL factice si backend/.env n'en fournit pas
# (une variable d'environnement prime sur .env, d'où le test avant de la poser).
if not get_settings().database_url:
    os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test"
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def anyio_backend():
    # psycopg async ne supporte pas la boucle Proactor (défaut sous Windows).
    if sys.platform == "win32":
        return ("asyncio", {"loop_factory": asyncio.SelectorEventLoop})
    return "asyncio"
