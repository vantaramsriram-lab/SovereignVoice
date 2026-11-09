"""SovereignVoice FastAPI application.

The backend is the ONLY component that talks to external AI providers.
Credentials live in backend/.env and are never returned to the browser.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import analysis, health
from app.config import settings
from app.errors import IntegrationError, NotConfiguredError

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s :: %(message)s",
)
logger = logging.getLogger("sovereignvoice")

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Log the integration state once, without ever printing a credential."""
    status = settings.public_status()
    logger.info(
        "Startup: gnani_key_configured=%s llm_configured=%s cors=%s",
        status["gnani_api_key_configured"],
        status["llm"]["configured"],
        ",".join(settings.CORS_ORIGINS) or "*",
    )
    if not settings.gnani_configured:
        logger.warning(
            "API_KEY_ID is not set. Both Gnani Prisma (STT) and Gnani Timbre (TTS) "
            "will return a configuration error until it is added to backend/.env."
        )
    if not settings.llm_configured:
        logger.warning(
            "GROQ_API_KEY / GROQ_MODEL / GROQ_API_URL are incomplete. "
            "LLM analysis will return a configuration error."
        )
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Enterprise multilingual voice intelligence for BFSI collection operations.\n\n"
        "Pipeline: Gnani Prisma STT -> Llama 3.2 3B Instruct -> CRM validation -> "
        "Gnani Timbre TTS.\n\n"
        "This service performs analysis and response generation only. It never "
        "places calls, sends messages or approves concessions."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Disposition", "X-Audio-Voice"],
)

# /health (unprefixed, as specified) and /api/* routes
app.include_router(health.router)
app.include_router(analysis.router)


@app.exception_handler(IntegrationError)
async def integration_error_handler(_: Request, exc: IntegrationError) -> JSONResponse:
    """Map typed integration failures to clear, safe HTTP responses."""
    payload = exc.to_payload()
    if isinstance(exc, NotConfiguredError):
        logger.warning("Integration not configured: %s", exc.message)
    else:
        logger.error("%s failure: %s", exc.service, exc.message)
    return JSONResponse(status_code=exc.http_status, content=payload)


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "pipeline": [
            "Gnani Prisma STT",
            "Llama 3.2 3B Instruct",
            "CRM intelligence validation",
            "Gnani Timbre TTS",
        ],
    }
