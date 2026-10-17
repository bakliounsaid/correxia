"""
Vérifie la base, Supabase Auth, Stripe et la présence des clés à partir de backend/.env
(aucun secret affiché, uniquement ok / erreur).

Usage (depuis le dossier backend) :
    .venv\\Scripts\\python scripts/check_integrations.py
"""

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def main() -> int:
    from app.config import get_settings
    from app.database import engine
    from app.routers.health import integration_status

    result = await integration_status(get_settings())
    await engine.dispose()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["all_ok"] else 1


if __name__ == "__main__":
    loop = asyncio.SelectorEventLoop if sys.platform == "win32" else None
    raise SystemExit(asyncio.run(main(), loop_factory=loop))
