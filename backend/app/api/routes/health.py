"""Health + integration status endpoints.

Never returns credentials. Only booleans, endpoint URLs and model names that
are already visible in the source tree.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Backend health and integration configuration")
async def health() -> dict:
    status = settings.public_status()
    integrations = {
        "stt": status["prisma"]["configured"],
        "llm": status["llm"]["configured"],
        "tts": status["timbre"]["configured"],
    }
    ready = all(integrations.values())
    return {
        "status": "ok" if ready else "degraded",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pipeline_ready": ready,
        "integrations": integrations,
        "config": status,
        "notes": [
            "Gnani Prisma and Gnani Timbre share exactly ONE credential: API_KEY_ID.",
            "That single key is sent to both providers via the X-API-Key-ID header.",
            "Groq (LLM) uses its own GROQ_API_KEY, which is separate by design.",
            "No credential value is ever returned by this endpoint.",
        ],
    }
