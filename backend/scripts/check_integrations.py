"""
Teste Supabase + Stripe à partir de backend/.env

Usage (depuis le dossier backend) :
    py scripts/check_integrations.py
"""
import asyncio
import json
import sys
from pathlib import Path

# Racine backend (parent de scripts/)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def main() -> int:
    from app.config import get_settings
    from app.routers.health import integration_status

    get_settings.cache_clear()
    settings = get_settings()
    result = await integration_status(settings)
    print(json.dumps(result, indent=2, ensure_ascii=False))

    sup_ok = result["supabase"].get("ok") is True
    st_ok = result["stripe"].get("ok") is True
    if sup_ok and st_ok:
        return 0
    if not result["supabase"].get("configured") and not result["stripe"].get(
        "configured"
    ):
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
